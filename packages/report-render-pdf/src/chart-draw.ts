import { RenderRefusal, type AxisChart, type PieChart } from '@formancy/report-runtime'
import { BarChart, LineChart, PieChart as PieSeries } from 'echarts/charts'
import { GridComponent, LegendComponent, TitleComponent } from 'echarts/components'
import { init, setPlatformAPI, use, type EChartsType } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { setPlatformAPI as setZrenderPlatform } from 'zrender/lib/core/platform.js'
import type { ChartFaces } from './chart-faces.js'
import { held, named, points, tooLarge, type Plot } from './chart-held.js'
import { withMeasurer } from './chart-measure.js'
import { pieArcs } from './chart-arcs.js'
import { barWidth, chartOption, chartWords, pieCircle, POINT_RADIUS, VALUE_LABEL_DISTANCE, type ChartLayout } from './chart-option.js'
import { readChartSvg, type PlacedWord } from './chart-svg.js'
import type { FaceWidths } from './engine.js'

/**
 * A chart laid out by ECharts, and refused where its words would meet,
 * leave its box or stand in its plot, or its ticks, its categories or its
 * bars would be too close or too thin to read (0058). ECharts lays the
 * chart out; the drawing reads where it put things and only snaps what
 * ECharts chose, and pdfmake prints every word in the box the drawing
 * reads back (`chart-svg.ts`).
 *
 * A bar or a line chart is laid out three times, every tick labelled in
 * the first two:
 *
 * 1. **The bands.** Across the whole box, read for where the title and
 *    the legend stand, which no plot moves: the band at the top is the
 *    title's line and a gap under it, with a value label's line and its
 *    distance from its mark where values are labelled, or a line's
 *    marker's radius where they are not, which no clip of ECharts' holds
 *    and the box's would cut; the band at the foot is the legend's rows
 *    and a gap above them. A bar below zero
 *    labelled under its end has its room between the plot's foot and the
 *    category labels, which the option stands that much further down
 *    (`chart-option.ts`), and ECharts fits with them.
 * 2. **The plot.** ECharts fits the plot, and its axes' words, between the
 *    bands and the box's sides; the plot is read by `convertToPixel` at
 *    the lowest tick's place and the highest's, and half a slot past the
 *    first and the last categories' middles.
 * 3. **Drawn.** The plot's top on the first half point at or below
 *    ECharts', and its height the most that fits above ECharts' foot with
 *    every interval between ticks a whole number of points, so that every
 *    gridline stands on its tick (zrender moves a thin line to a half
 *    point); every `tickEvery`-th tick labelled from the lowest, the
 *    fewest that set their labels `TICK_CLEARANCE` lines apart.
 *
 * Bars under `MIN_BAR_WIDTH` are refused in whichever layout first lays
 * them out, before its words are read: ECharts draws a bar under 1 point
 * at 1, and leaves undrawn the bars, and their labels, a group so widened
 * pushes past its slot. Between the second layout and the third, a plot
 * too short for two tick labels that far apart, and a category label
 * wider than its slot less half a line, are refused: a label is never
 * turned, and a tick, a category or a bar is never dropped. A pie is laid
 * out twice: the bands, then drawn in the largest square centred between
 * them, refused where that square is narrower than `MIN_PIE_DIAMETER`, the
 * arcs of its slices written again on its circle before its drawing is
 * read (`chart-arcs.ts`). Every layout is ECharts' own under
 * the render's measurer (`chart-measure.ts`), disposed after it is read.
 *
 * The drawn layout's words are then held: two that meet, one past the
 * box, or one in the plot that is not a value's label, refuse the chart
 * (`chart-held.ts`, the rule an empty chart's words are held to as well).
 * Every refusal here is `content-too-large`, naming the chart and its box
 * and the sizes that do not fit, and quoting no word; the drawing's reader
 * refuses what ECharts wrote that it does not hold to as `unsupported`. A
 * font the measurer was not handed, a canvas or an image asked for, and a
 * formatter asked for what the block does not have are the option's
 * errors, thrown as they are: an invariant of the renderer's, which no
 * report can cause.
 *
 * The one module that imports ECharts' code, which a document holding a
 * chart loads the first time it draws one; its components are registered
 * at the first draw, never at import.
 */

/** Lines: printed tick labels stand at least this far apart, middle to middle. Chosen, as a table's padding is. */
export const TICK_CLEARANCE = 1.25

/**
 * Points: the narrowest a bar is drawn: the least width, to the quarter
 * point, at which every bar of a bar chart is a run of at least one pixel
 * of its colour (each channel within 8) with a white pixel (each channel
 * at least 247) between it and the next, in the page PDF.js draws at the
 * density of the Studio's Preview at 100 % on a screen of device pixel
 * ratio 2: 96/72 CSS pixels to the point times 2, 8/3 device pixels to the
 * point.
 *
 * Measured on 2026-11-13 on a Mac (Apple M2), Node 22.23.4, pdfjs-dist
 * 6.4.299, which draws on @napi-rs/canvas 1.0.11, and ECharts 6.1.0: bar
 * charts laid out by ECharts at the option's gaps and drawn by `renderPdf`,
 * 3960 of them: widths of 0.25 to 5 points in quarter points, each with one,
 * two and eight series, three tick sets (the width of the value axis'
 * labels, which moves the plot) and 22 left margins, twenty across one
 * device pixel from 40 points and the starters' 56.69 and 42.52. The pixel
 * rows judged are those inside the bars, which no gridline or axis line
 * crosses. 3.25 failed on 17 of 198 charts, 3.5 and every width above it,
 * to 5, on none.
 *
 * Why it holds wherever a chart stands: zrender writes every coordinate to
 * 0.1 point, so a gap the SVG writes is a multiple of 0.1 point, at least
 * a quarter of the bar less 0.15 (two edges each off by 0.05, and a width
 * by 0.05); at 3.5 that is 0.8 point, 2.13 pixels, and two pixels always
 * hold a whole pixel the bars leave white, wherever they stand. At 3.25 it
 * is 0.7 point, 1.87 pixels, and the failures above are those. The gap is
 * what sets the least: a bar of one series stands a category gap, a
 * quarter of a bar, from the next, in the next slot; a bar of a group
 * stands BAR_GAP of a bar from the next in its own slot, the same gap
 * while BAR_GAP is BAR_CATEGORY_GAP over its complement (held in
 * `chart-draw.test.ts`), and a group's category gap is wider.
 *
 * Other densities, by the same sweep (132 charts to a width, from 0.25 to
 * 10, 20 offsets across a device pixel and the starters' margins, one, two
 * and eight series, two tick sets), the least width at which none failed:
 * 6.25 at 4/3 pixels to the point (100 % on ratio 1), 4.25 at 2 (75 % on
 * ratio 2), 8.25 at 1; each is where the gap's least is two pixels, and
 * one quarter point below it some chart failed. Never under ECharts' own
 * least, 1, at which it widens the bar and drops its neighbours.
 */
export const MIN_BAR_WIDTH = 3.5

/**
 * Points: the narrowest a pie is drawn, its square's side: the least
 * diameter, to the quarter point, at which a pie whose first slice is one
 * percent of it, its seven others sharing the rest in report-spec's
 * palette, shows every slice along its rim as a run of at least one pixel
 * of its own colour (each channel within 8), that slice among them, its
 * neighbours told apart, in the page PDF.js draws at the density of the
 * Studio's Preview at 100 % on a screen of device pixel ratio 2, 8/3
 * device pixels to the point, as `MIN_BAR_WIDTH`: so that a slice whose
 * share prints as 1.0 % or more shows as its own colour. The rim is the
 * band one pixel wide of the outermost pixels wholly inside the pie's
 * circle; taken in turn from noon, clockwise, its pixels of a palette
 * colour make eight runs, each of its own slice's colour and inside that
 * slice's sector, so that no slice is missing, split by another's colour
 * or run into its neighbour's. A pixel of no palette colour, a blend of
 * two slices, breaks no run and makes none.
 *
 * Measured on 2026-11-16 on a Mac (Apple M2), Node 22.23.4, pdfjs-dist
 * 6.4.299 on @napi-rs/canvas 1.0.11, and ECharts 6.1.0, at a load of 2.2
 * to 4.1: pies drawn by `renderPdf` in a box of their diameter, with no
 * title and no legend, of 20 to 50 points in quarter points, each at 22
 * places: twenty across one device pixel from 40 points, its left and its
 * top each at every twentieth of one, and the starters' margins, 56.69
 * and 42.52 points in from the left and 56.69 down. Below 24.75 some
 * diameter failed at up to 10 of the 22, 24.5 at 1; 24.75 and every
 * diameter above it, to 50, at none. At 400 places, every pair of
 * twentieths of a pixel, from 23 to 31 points: 24.5 failed at 33, 24.75
 * to 31 at none. A pie of eight equal slices, measured the same way the
 * day before, told them apart from 3.25 points, which leaves a slice
 * under about an eighth of the pie under a pixel of its rim: Daniel ruled
 * for the slice of one percent. A smaller share is a thinner slice, as a
 * smaller value is a shorter bar, and is held to nothing.
 */
export const MIN_PIE_DIAMETER = 24.75

/** Lines: what the bands keep between the title, or the legend, and the plot's words. Chosen. */
export const BAND_GAP = 0.5

/** A chart drawn: the drawing pdfmake's converter is handed, without its words, and every word in the box pdfmake prints it in. */
export interface DrawnChart {
  readonly svg: string
  readonly words: readonly PlacedWord[]
}

/** The bands a plot is laid out between, in points from the box's top and from its foot. */
type Bands = NonNullable<ChartLayout['bands']>

let registered = false

/**
 * ECharts' components, registered once, at the first draw; and refused
 * where ECharts resolves another zrender than the renderer's, whose
 * platform the measurer replaces (`chart-measure.ts`): through another,
 * ECharts would measure every word in widths nobody chose, unseen. Both
 * copies' `setPlatformAPI` is one function only where they are one copy.
 */
function register(chart: AxisChart | PieChart): void {
  if (setPlatformAPI !== setZrenderPlatform)
    throw new RenderRefusal(
      'unsupported',
      `${named(chart)}cannot be laid out: ECharts measures through another copy of zrender than the one the renderer measures it with`,
      chart.id,
    )
  if (registered) return
  use([BarChart, LineChart, PieSeries, GridComponent, LegendComponent, TitleComponent, SVGRenderer])
  registered = true
}

/**
 * `chart` laid out by ECharts in `layout`, its words measured in `faces`
 * by `widths`; a bar or a line chart's plot read (`plotOf`) and its bars
 * held to `MIN_BAR_WIDTH`, and then its words read back. A pie has no
 * plot to read: its square is the layout's own, and once it has one, its
 * slices' arcs are written again on its circle (`pieArcs`).
 */
function layOut(chart: AxisChart, faces: ChartFaces, widths: FaceWidths, layout: ChartLayout): { readonly drawing: DrawnChart; readonly plot: Plot }
function layOut(chart: AxisChart | PieChart, faces: ChartFaces, widths: FaceWidths, layout: ChartLayout): { readonly drawing: DrawnChart }
function layOut(
  chart: AxisChart | PieChart,
  faces: ChartFaces,
  widths: FaceWidths,
  layout: ChartLayout,
): { readonly drawing: DrawnChart; readonly plot?: Plot } {
  const option = chartOption(chart, faces, layout)
  const { svg, plot } = withMeasurer(faces, widths, (): { readonly svg: string; readonly plot?: Plot } => {
    const laid = init(null, null, { renderer: 'svg', ssr: true, width: chart.width, height: chart.height })
    try {
      laid.setOption(option)
      const written = laid.renderToSVGString()
      if (chart.chart === 'pie') return { svg: layout.plot === undefined ? written : pieArcs(written, pieCircle(layout.plot)) }
      const read = plotOf(chart, laid)
      thickEnough(chart, read)
      return { svg: written, plot: read }
    } finally {
      laid.dispose()
    }
  })
  const drawing = readChartSvg(svg, chart, chartWords(chart, layout), faces, widths)
  return plot === undefined ? { drawing } : { drawing, plot }
}

/**
 * `chart` drawn in `faces` by `widths`: laid out by ECharts as the module
 * says, its words held to the rules, and refused, naming it, where they
 * do not hold. Synchronous, for a chart that is not empty, whose words
 * and title `faces` and `widths` measure.
 */
export function drawChart(chart: AxisChart | PieChart, faces: ChartFaces, widths: FaceWidths): DrawnChart {
  register(chart)
  const { line } = faces.words
  const bands = bandsOf(chart, layOut(chart, faces, widths, { tickEvery: 1 }).drawing.words, line)
  if (chart.chart === 'pie') {
    const square = squareOf(chart, bands)
    const { svg, words } = layOut(chart, faces, widths, { tickEvery: 1, bands, plot: square }).drawing
    return { svg, words: held(chart, words, square) }
  }
  if (bands.top + bands.bottom >= chart.height) tooLarge(chart, 'has no room for its plot: its title and its legend would stand in it')
  const fitted = layOut(chart, faces, widths, { tickEvery: 1, bands })
  const plot = snapped(chart, fitted.plot)
  const tickEvery = tickEveryOf(chart, plot, line)
  fitsAcross(chart, plot, fitted.drawing.words, line)
  const { svg, words } = layOut(chart, faces, widths, { tickEvery, bands, plot }).drawing
  return { svg, words: held(chart, words, plot) }
}

/**
 * The bands `chart` is laid out between, from `words`, those of a layout
 * across the whole box, in faces whose words' line is `line`: the title's
 * box and a gap under it, and the legend's highest row and a gap above
 * it; and where values are labelled, room above the plot for a label of a
 * bar or a point at the highest tick, its line and its distance from its
 * mark. Where a line's are not, room for its marker at the highest tick,
 * `POINT_RADIUS` above its place: ECharts leaves only half a tick label's
 * line above the plot, which in a face of a short line is less, and the
 * marker would stand past the box, where the converter cuts it. The label
 * of a bar below zero at the lowest tick stands between the plot's foot
 * and the category labels, in room the option keeps there; a marker at
 * the lowest tick stands in the category labels' margin, which ECharts
 * keeps with every label empty.
 */
function bandsOf(chart: AxisChart | PieChart, words: readonly PlacedWord[], line: number): Bands {
  const gap = BAND_GAP * line
  const title = words.find(({ key }) => key === 'title')
  const legend = words.filter(({ key }) => key.startsWith('legend/')).map(({ top }) => top)
  const labelled = chart.chart !== 'pie' && chart.valueLabels
  const marked = chart.chart === 'line' ? POINT_RADIUS : 0
  return {
    top: (title === undefined ? 0 : title.top + title.height + gap) + (labelled ? line + VALUE_LABEL_DISTANCE : marked),
    bottom: legend.length === 0 ? 0 : chart.height - Math.min(...legend) + gap,
  }
}

/** A pie's square: the largest centred between `bands`, refused where they leave none, or one narrower than `MIN_PIE_DIAMETER`. */
function squareOf(chart: PieChart, bands: Bands): Plot {
  const room = chart.height - bands.top - bands.bottom
  if (room <= 0) tooLarge(chart, 'has no room for its pie: its title and its legend would stand in it')
  const side = Math.min(chart.width, room)
  if (side < MIN_PIE_DIAMETER)
    tooLarge(chart, `has a pie ${points(side)} points across, narrower than the ${String(MIN_PIE_DIAMETER)} points a pie is drawn at least`)
  return { left: (chart.width - side) / 2, top: bands.top + (room - side) / 2, width: side, height: side }
}

/**
 * The plot ECharts laid `chart` out in: its foot and its top at the
 * lowest tick's place and the highest's, and its sides half a slot past
 * the first and the last categories' middles, a slot being the plot's
 * width over the categories. Of a chart of one category, whose one middle
 * says nothing of its slot, each side is where the plot ends: found, to a
 * billionth of a point, as the last point `containPixel` says the plot
 * holds.
 */
function plotOf(chart: AxisChart, laid: EChartsType): Plot {
  const foot = laid.convertToPixel({ yAxisIndex: 0 }, 0)
  const top = laid.convertToPixel({ yAxisIndex: 0 }, chart.ticks.length - 1)
  const categories = chart.categories.length
  const first = laid.convertToPixel({ xAxisIndex: 0 }, 'c0')
  if (categories > 1) {
    const last = laid.convertToPixel({ xAxisIndex: 0 }, `c${String(categories - 1)}`)
    const slot = (last - first) / (categories - 1)
    return { left: first - slot / 2, top, width: slot * categories, height: foot - top }
  }
  const middle = (foot + top) / 2
  const side = (outside: number): number => {
    let [held, past] = [first, outside]
    while (Math.abs(past - held) > 1e-9) {
      const between = (held + past) / 2
      if (laid.containPixel({ gridIndex: 0 }, [between, middle])) held = between
      else past = between
    }
    return held
  }
  const [left, right] = [side(-1), side(chart.width + 1)]
  return { left, top, width: right - left, height: foot - top }
}

/**
 * `fitted` snapped: its top moved down to the first half point at or
 * below it, and its height cut to the most that fits above its foot with
 * every interval between ticks a whole number of points, so that every
 * tick stands on a half point, where zrender leaves a thin gridline. The
 * plot only shrinks, and stays where ECharts fitted its words. Its sides
 * as ECharts laid them.
 */
function snapped(chart: AxisChart, fitted: Plot): Plot {
  const intervals = chart.ticks.length - 1
  const top = Math.ceil(fitted.top - 0.5) + 0.5
  const room = fitted.top + fitted.height - top
  return { left: fitted.left, top, width: fitted.width, height: Math.max(0, Math.floor(room / intervals)) * intervals }
}

/**
 * Every how many ticks `chart` labels on `plot`, from the lowest: the
 * fewest that set two labels `TICK_CLEARANCE` lines of `line` apart. A
 * plot on which no two can stand that far apart -- the lowest and the
 * highest -- is refused, naming its height.
 */
function tickEveryOf(chart: AxisChart, plot: Plot, line: number): number {
  const intervals = chart.ticks.length - 1
  const pitch = plot.height / intervals
  const tickEvery = Array.from({ length: intervals }, (_, index) => index + 1).find((every) => every * pitch >= TICK_CLEARANCE * line)
  if (tickEvery === undefined)
    tooLarge(
      chart,
      `has a plot ${points(plot.height)} points tall, too short to label two of its ${String(chart.ticks.length)} ticks ${String(TICK_CLEARANCE)} lines apart`,
    )
  return tickEvery
}

/**
 * `chart`'s category labels, as `words` place them, refused where one is
 * wider than its slot on `plot` less half a `line`: each prints across,
 * centred under its slot, and is never turned, so that two that fit stand
 * half a line apart or more. The drawn layout's words are held apart
 * besides, these among them.
 */
function fitsAcross(chart: AxisChart, plot: Plot, words: readonly PlacedWord[], line: number): void {
  const slot = plot.width / chart.categories.length
  if (words.some(({ key, width }) => key.startsWith('category/') && width > slot - line / 2))
    tooLarge(chart, `has category labels too wide for their slots of ${points(slot)} points across, and never turned`)
}

/** `chart`'s bars on `plot`, refused where ECharts would lay them out narrower than `MIN_BAR_WIDTH`, by the width it gives a bar in a slot of it (`barWidth`). */
function thickEnough(chart: AxisChart, plot: Plot): void {
  if (chart.chart !== 'bar') return
  const width = barWidth(plot.width / chart.categories.length, chart.series.length)
  if (width < MIN_BAR_WIDTH) tooLarge(chart, `has bars ${points(width)} points wide, narrower than the ${String(MIN_BAR_WIDTH)} points a bar is drawn at least`)
}
