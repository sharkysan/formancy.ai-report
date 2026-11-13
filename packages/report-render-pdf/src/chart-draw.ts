import { RenderRefusal, type AxisChart, type PieChart } from '@formancy/report-runtime'
import { BarChart, LineChart, PieChart as PieSeries } from 'echarts/charts'
import { GridComponent, LegendComponent, TitleComponent } from 'echarts/components'
import { init, setPlatformAPI, use, type EChartsType } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { setPlatformAPI as setZrenderPlatform } from 'zrender/lib/core/platform.js'
import type { ChartFaces } from './chart-faces.js'
import { withMeasurer } from './chart-measure.js'
import { barWidth, chartOption, chartWords, VALUE_LABEL_DISTANCE, type ChartLayout } from './chart-option.js'
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
 *    distance from its mark where values are labelled; the band at the
 *    foot is the legend's rows and a gap above them, with the same where
 *    a bar below zero is labelled, under its end.
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
 * Between the second and the third, a plot too short for two tick labels
 * that far apart, a category label wider than its slot less half a line,
 * and a bar under `MIN_BAR_WIDTH` are refused: a label is never turned,
 * and a tick, a category or a bar is never dropped. A pie is laid out
 * twice: the bands, then drawn in the largest square centred between
 * them. Every layout is ECharts' own under the render's measurer
 * (`chart-measure.ts`), disposed after it is read.
 *
 * The drawn layout's words are then held: two that meet, one past the
 * box, or one in the plot that is not a value's label, refuse the chart.
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

/** Points: the narrowest a bar is drawn. Provisional: 2 until the corpus's charts measure what still reads as a bar. */
export const MIN_BAR_WIDTH = 2

/** Lines: what the bands keep between the title, or the legend, and the plot's words. Chosen. */
export const BAND_GAP = 0.5

/** A chart drawn: the drawing pdfmake's converter is handed, without its words, and every word in the box pdfmake prints it in. */
export interface DrawnChart {
  readonly svg: string
  readonly words: readonly PlacedWord[]
}

/** A plot, or a pie's square, in points from the chart's top left. */
type Plot = NonNullable<ChartLayout['plot']>

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

/** What a refusal of `chart` starts with: its id and its box. */
const named = (chart: AxisChart | PieChart): string => `the chart ${chart.id}, ${String(chart.width)} by ${String(chart.height)} points, `

/** A refusal of `chart` whose content does not fit, saying what it `has`. */
function tooLarge(chart: AxisChart | PieChart, has: string): never {
  throw new RenderRefusal('content-too-large', `${named(chart)}${has}`, chart.id)
}

/** `size` points, to the hundredth, as a refusal says it. */
const points = (size: number): string => String(Math.round(size * 100) / 100)

/**
 * `chart` laid out by ECharts in `layout`, its words measured in `faces`
 * by `widths`, and read back; and what `read` reads of the laid chart
 * before it is disposed.
 */
function layOut<T>(chart: AxisChart | PieChart, faces: ChartFaces, widths: FaceWidths, layout: ChartLayout, read: (laid: EChartsType) => T) {
  const option = chartOption(chart, faces, layout)
  const { svg, readings } = withMeasurer(faces, widths, () => {
    const laid = init(null, null, { renderer: 'svg', ssr: true, width: chart.width, height: chart.height })
    try {
      laid.setOption(option)
      return { svg: laid.renderToSVGString(), readings: read(laid) }
    } finally {
      laid.dispose()
    }
  })
  return { drawing: readChartSvg(svg, chart, chartWords(chart, layout), faces, widths), readings }
}

/** What a layout read for its bands alone reads of the laid chart: nothing. */
const nothing = (): undefined => undefined

/**
 * `chart` drawn in `faces` by `widths`: laid out by ECharts as the module
 * says, its words held to the rules, and refused, naming it, where they
 * do not hold. Synchronous, for a chart that is not empty, whose words
 * and title `faces` and `widths` measure.
 */
export function drawChart(chart: AxisChart | PieChart, faces: ChartFaces, widths: FaceWidths): DrawnChart {
  register(chart)
  const { line } = faces.words
  const bands = bandsOf(chart, layOut(chart, faces, widths, { tickEvery: 1 }, nothing).drawing.words, line)
  if (chart.chart === 'pie') {
    const square = squareOf(chart, bands)
    return held(chart, layOut(chart, faces, widths, { tickEvery: 1, bands, plot: square }, nothing).drawing, square)
  }
  if (bands.top + bands.bottom >= chart.height) tooLarge(chart, 'has no room for its plot: its title and its legend would stand in it')
  const fitted = layOut(chart, faces, widths, { tickEvery: 1, bands }, (laid) => plotOf(chart, laid))
  const plot = snapped(chart, fitted.readings)
  const tickEvery = tickEveryOf(chart, plot, line)
  fitsAcross(chart, plot, fitted.drawing.words, line)
  thickEnough(chart, plot)
  return held(chart, layOut(chart, faces, widths, { tickEvery, bands, plot }, nothing).drawing, plot)
}

/**
 * The bands `chart` is laid out between, from `words`, those of a layout
 * across the whole box, in faces whose words' line is `line`: the title's
 * box and a gap under it, and the legend's highest row and a gap above
 * it; and where a value's label stands beyond the plot -- above a bar or
 * a point at the highest tick, under a bar below zero at the lowest --
 * room for its line and its distance from its mark. A line's labels all
 * stand above their points.
 */
function bandsOf(chart: AxisChart | PieChart, words: readonly PlacedWord[], line: number): Bands {
  const gap = BAND_GAP * line
  const label = line + VALUE_LABEL_DISTANCE
  const title = words.find(({ key }) => key === 'title')
  const legend = words.filter(({ key }) => key.startsWith('legend/')).map(({ top }) => top)
  const labelled = chart.chart !== 'pie' && chart.valueLabels
  const under = labelled && chart.chart === 'bar' && chart.series.some(({ values }) => values.some((each) => each?.exact.startsWith('-') === true))
  return {
    top: (title === undefined ? 0 : title.top + title.height + gap) + (labelled ? label : 0),
    bottom: (legend.length === 0 ? 0 : chart.height - Math.min(...legend) + gap) + (under ? label : 0),
  }
}

/** A pie's square: the largest centred between `bands`, refused where they leave none. */
function squareOf(chart: PieChart, bands: Bands): Plot {
  const room = chart.height - bands.top - bands.bottom
  if (room <= 0) tooLarge(chart, 'has no room for its pie: its title and its legend would stand in it')
  const side = Math.min(chart.width, room)
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
      `has a plot ${points(plot.height)} points tall, too short to label two of its ${String(chart.ticks.length)} ticks a line and a quarter apart`,
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

/** `chart`'s bars on `plot`, refused where ECharts would draw them narrower than `MIN_BAR_WIDTH`. */
function thickEnough(chart: AxisChart, plot: Plot): void {
  if (chart.chart !== 'bar') return
  const width = barWidth(plot.width / chart.categories.length, chart.series.length)
  if (width < MIN_BAR_WIDTH) tooLarge(chart, `has bars ${points(width)} points wide, narrower than the ${String(MIN_BAR_WIDTH)} points a bar is drawn at least`)
}

/** What a box is to the rules: a word's, a plot's or a pie's square, from the chart's top left. */
interface Box {
  readonly x: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** Whether `a` and `b` overlap: boxes that share an edge do not meet. */
const meet = (a: Box, b: Box): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.top < b.top + b.height && b.top < a.top + a.height

/**
 * `drawing`, `chart`'s drawn layout on `plot`, refused where a word
 * stands past the box, a word but a value's label stands in the plot, or
 * two words meet; returned as it is otherwise.
 */
function held(chart: AxisChart | PieChart, drawing: DrawnChart, plot: Plot): DrawnChart {
  const { words } = drawing
  const past = ({ x, top, width, height }: PlacedWord): boolean => x < 0 || top < 0 || x + width > chart.width || top + height > chart.height
  if (words.some(past)) tooLarge(chart, 'has a word that would leave its box')
  const area: Box = { x: plot.left, top: plot.top, width: plot.width, height: plot.height }
  if (words.some((word) => !word.key.startsWith('value/') && meet(word, area))) tooLarge(chart, 'has a word that would stand in its plot')
  if (words.some((word, index) => words.slice(index + 1).some((other) => meet(word, other)))) tooLarge(chart, 'has two words that would meet')
  return drawing
}
