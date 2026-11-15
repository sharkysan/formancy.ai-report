import { MAX_CHART_CATEGORIES, MAX_CHART_SERIES, MAX_TICK_INTERVALS, RenderRefusal, type AxisChart, type Chart, type PieChart } from '@formancy/report-runtime'
import { chartFace } from './chart-faces.js'
import { belowZero, chartWords, exactOf, placesOf, sharesOf } from './chart-option.js'
import { checkColor, checkStyle, checkText } from './check-faces.js'
import { tall, type Place, type Walk } from './check-walk.js'

/**
 * A chart, held to what the renderer draws before anything is laid out
 * (0058), so that ECharts is handed only a chart it can lay out whole and
 * the option's own guards are invariants: each refusal names the chart by
 * its id, and the sizes or the counts that do not hold, and quotes none
 * of its words or values, each of which may be the data's. In order:
 *
 * - **Where it stands.** In the body, in a column, a section or a
 *   keep-together block; never in a page region, which is drawn on every
 *   page and measured before the body, and where the runtime never puts a
 *   chart.
 * - **What it is.** A kind the renderer knows, a box of a size, within the
 *   bounds no chart the runtime resolves passes (`checkBounds`), every
 *   colour it paints and its words' style as a paragraph's are held
 *   (`checkColor`, `checkStyle`): its words take the style's font token,
 *   size, weight, slant and colour, and its title is bold in the same
 *   token. The style's alignment is held to the values a paragraph's is,
 *   and is not read: ECharts places each word, and an alignment means
 *   nothing for a word placed.
 * - **Its parts, matched.** Each series a value or null at every category
 *   and none past them; a legend naming every series, or a pie's every
 *   slice, in its colour, or none; a chart with nothing to draw holding
 *   its title and its empty text alone, and any other a value to draw. The
 *   runtime resolves no other (`chart-document.ts`); the renderer would
 *   draw one with some of it left out, or a legend that names a series by
 *   another's colour.
 * - **Its words**, every one it may print, every tick among them before
 *   the layout thins them (`chartWords`): each text, with no control
 *   character, trimmed of the whitespace pdfmake cuts, and held as a
 *   paragraph's is to the scripts the renderer prints and to the face it
 *   prints in (`checkText`, `chartFace`). A word blank once trimmed prints
 *   nothing, and asks for no face: a title of whitespace asks for no bold
 *   one.
 * - **Its numbers**, as the runtime writes them: every value a decimal;
 *   the ticks two or more, ascending in equal steps (`placesOf`), holding
 *   every value, and a bar chart's holding zero, which its bars stand on;
 *   a pie's slices none below zero, and more than nothing together
 *   (`sharesOf`). The option reads them through the same functions and
 *   holds each as an invariant, which this refuses first. Two of them are
 *   the runtime's decisions, re-held as what the drawing needs:
 *   `chartTicks`' axis, which holds every value and a bar's zero
 *   (`chart-ticks.ts`), and `chart-negative-share`, its refusal of a pie
 *   of a negative value (`lower-chart.ts`); a change to either is a
 *   change here.
 * - **Its size**: no wider than where it stands, as `content-too-large`,
 *   and its height judged against the body's once the page regions are
 *   measured (`tall`).
 *
 * What passes is collected, where it stands, for the drawing. Whether its
 * words fit the box ECharts lays them out in is the drawing's to say
 * (`chart-draw.ts`).
 */
export function checkChart(chart: Chart, at: string, place: Place, walk: Walk): void {
  const named = `the chart ${chart.id}`
  if (place.region) throw refusal(chart, `${named} stands in a page region, which is drawn on every page: a chart is drawn in the body`)
  const kind: string = chart.chart
  if (kind !== 'bar' && kind !== 'line' && kind !== 'pie') throw refusal(chart, `${named} is of a kind the renderer does not know`)
  const { width, height } = chart
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) throw refusal(chart, `${named} is drawn ${width} × ${height} pt`)
  checkBounds(chart)
  checkStyle(chart.style, named, walk.fonts, chart.id)
  for (const color of marks(chart)) checkColor(color, named, chart.id)
  for (const { color } of chart.legend) checkColor(color, named, chart.id)
  checkParts(chart)
  for (const { key, text, title } of chartWords(chart)) checkText(text, chartFace(chart, title), walk, wordAt(key, named), chart.id)
  if (chart.empty === undefined) {
    if (chart.chart === 'pie') checkSlices(chart)
    else checkAxis(chart)
  }
  if (width > place.width) throw new RenderRefusal('content-too-large', `${named} is ${width} pt wide; it stands ${place.width.toFixed(2)} pt wide`, chart.id)
  tall(walk, place, height, named, chart.id)
  walk.charts.push({ block: chart, at })
}

/**
 * What drawing one render's charts may cost, in units of what one more
 * point of a line chart of 8 series and 200 categories costs a render:
 * each chart its kind's weight (`CHART_WEIGHT`), and a unit for each
 * series at each category, or for each slice of a pie (`chartUnits`), as
 * `MAX_SVG_DRAWING` weighs an SVG. ECharts lays out every chart of a
 * render three times, a pie twice, before the body is paginated, and a
 * reader draws every one. What a chart costs beyond its points is the
 * render's layouts of its frame -- its axes, gridlines and words -- and,
 * for a line chart, a reader's drawing of the clip ECharts gives each of
 * its series, which svg-to-pdfkit draws as a page-sized group under a
 * luminosity soft mask (`useMask`). A kind's weight is the larger of what
 * its costliest chart of one category costs the render and a reader
 * beyond its points, both in the one unit, rounded up to ten.
 *
 * Measured on 2026-11-15 on a Mac (Apple M2, 8 cores) under Node 22.23.4,
 * ECharts 6.1.0, pdfmake 0.3.11 and pdfjs-dist 6.4.299. Other work held
 * the machine at a load average of 9.6 to 24 throughout, so no time here
 * is a quiet machine's: the weights are ratios of times taken together,
 * and the bound is set from the times under that load, which a quiet
 * machine beats. Charts stood on A4 landscape pages with no margins, each
 * form in the densest grid it draws in -- 11 by 8, report-spec's least
 * side, where it draws there -- and `renderPdf`, and PDF.js at scale 1 on
 * a page, were timed seven times each over N charts and 2N, interleaved.
 * One more point of an 8 × 200 line, against an 8 × 1 line in the same
 * box, cost the render 0.203 ms, the unit, and a reader 0.030 ms. Beyond
 * its points, a line of 8 series and one category cost a reader 1,250
 * units, 32 ms for each series' group, and the render 95 to 203; a bar
 * of 8 series and one category, dressed and its values labelled, the
 * render 161 and a reader 49; a dressed pie of 8 slices the render 96 and
 * a reader 8. No chart of one category, of 1 or 8 series, bare or
 * dressed, cost either side more than its kind's weight.
 *
 * The bound was tried on twenty-one forms: charts of one value of each
 * kind, the 8 × 1 forms, and the largest of each kind Task 25 tried, bare
 * and dressed. Each was packed as many to a render as the bound's units
 * hold, across pages, and as many to one page as the page holds of them.
 * At 6000, at a load of 15 to 24, the costliest render, 20 bar charts of
 * 123 one-letter categories on 3 pages, took a median of 1,547 ms, and 35
 * bar charts of one value, dressed, 960 ms; the costliest page, 4 lines
 * of 8 series and one category, cost PDF.js 1,000 ms, and a page of one
 * 8 × 200 line and two 8 × 1 lines 825 ms. At 7000 the costliest render
 * took 1,782 ms at a load of 10 to 16 and 2,278 ms at 14 to 19, past the
 * 2 s a render may cost.
 */
export const MAX_CHART_DRAWING = 6000

/** What each kind of chart costs beyond its points, in `MAX_CHART_DRAWING`'s units: the larger of what its layouts cost the render and what its drawing costs a reader, rounded up to ten. */
export const CHART_WEIGHT = { bar: 170, line: 1260, pie: 100 } as const satisfies Readonly<Record<Chart['chart'], number>>

/**
 * What drawing `chart` costs, in `MAX_CHART_DRAWING`'s units: its kind's
 * weight, and a unit for each series at each category, null or not, or
 * for each of a pie's slices, one of no share among them. A chart with
 * nothing to draw costs none: ECharts never lays it out (`drawEmpty`),
 * and it paints no mark.
 */
export function chartUnits(chart: Chart): number {
  if (chart.empty !== undefined) return 0
  return CHART_WEIGHT[chart.chart] + (chart.chart === 'pie' ? chart.slices.length : chart.series.length * chart.categories.length)
}

/**
 * A render's charts, as the walk listed them, held to what drawing all of
 * them costs together, before any of them is laid out: past
 * `MAX_CHART_DRAWING`, refused as `content-too-large` at the chart that
 * crossed it, naming the count and the bound and quoting none of its
 * words, as `MAX_SVG_DRAWING` holds a render's SVGs (`check.ts`).
 */
export function checkChartDrawing(charts: Walk['charts']): void {
  let total = 0
  for (const { block } of charts) {
    total += chartUnits(block)
    if (total > MAX_CHART_DRAWING) {
      throw new RenderRefusal(
        'content-too-large',
        `the charts up to ${block.id} cost ${String(total)} units to draw, each its kind's weight and one for each series at each category or each slice of a pie; a render may draw ${String(MAX_CHART_DRAWING)}`,
        block.id,
      )
    }
  }
}

/** An `unsupported` refusal of `chart`, saying `message`. */
const refusal = (chart: Chart, message: string): RenderRefusal => new RenderRefusal('unsupported', message, chart.id)

/** `count` of a thing, in the words for one of it and for more. */
const counted = (count: number, one: string, more: string): string => `${String(count)} ${count === 1 ? one : more}`

/**
 * `chart` held to the bounds no chart the runtime resolves passes, each
 * read from where it is decided: its categories, a pie's slices among
 * them, to the runtime's `MAX_CHART_CATEGORIES`, a bound on the work a
 * chart costs, as `content-too-large`; its series to report-spec's
 * `MAX_CHART_SERIES`, one colour each from the palette, and its ticks to
 * the `MAX_TICK_INTERVALS` intervals `chartTicks` writes at most, each as
 * `unsupported`, a chart of a form no runtime resolves. Held before its
 * words are read, so that a chart built by hand past them costs the check
 * nothing more, and ECharts never lays it out.
 */
function checkBounds(chart: Chart): void {
  const named = `the chart ${chart.id}`
  const categories = chart.chart === 'pie' ? chart.slices.length : chart.categories.length
  if (categories > MAX_CHART_CATEGORIES) {
    throw new RenderRefusal('content-too-large', `${named} has ${String(categories)} categories; a chart has at most ${String(MAX_CHART_CATEGORIES)}`, chart.id)
  }
  if (chart.chart === 'pie') return
  if (chart.series.length > MAX_CHART_SERIES)
    throw refusal(
      chart,
      `${named} has ${String(chart.series.length)} series; a chart has at most ${String(MAX_CHART_SERIES)}, one colour each from its palette`,
    )
  if (chart.ticks.length > MAX_TICK_INTERVALS + 1)
    throw refusal(chart, `the value axis of ${named} has ${String(chart.ticks.length)} ticks; an axis has at most ${String(MAX_TICK_INTERVALS + 1)}`)
}

/** The colours `chart` paints its marks in: its series' (bar, line), or its slices' (pie). */
const marks = (chart: Chart): readonly string[] => (chart.chart === 'pie' ? chart.slices : chart.series).map(({ color }) => color)

/**
 * `chart`'s parts, matched as the runtime resolves them: a series' values
 * one to each category, a legend's entries one to each series or slice in
 * its colour or none, and an empty chart nothing but its title and its
 * empty text, any other something to draw.
 */
function checkParts(chart: Chart): void {
  const named = `the chart ${chart.id}`
  const axis = chart.chart !== 'pie'
  if (axis) {
    chart.series.forEach(({ values }, index) => {
      if (values.length !== chart.categories.length)
        throw refusal(
          chart,
          `series ${String(index)} of ${named} has ${counted(values.length, 'value', 'values')} for ${counted(chart.categories.length, 'category', 'categories')}`,
        )
    })
  }
  const mark = axis ? 'series' : 'slice'
  const marked = marks(chart)
  if (chart.legend.length !== 0 && chart.legend.length !== marked.length) {
    const what = axis ? counted(marked.length, 'series', 'series') : counted(marked.length, 'slice', 'slices')
    throw refusal(
      chart,
      `${named} has ${counted(chart.legend.length, 'legend entry', 'legend entries')} for ${what}, and names every ${mark} in its legend or none`,
    )
  }
  chart.legend.forEach(({ color }, index) => {
    if (color !== marked[index]) throw refusal(chart, `legend entry ${String(index)} of ${named} is not in the colour of the ${mark} it names`)
  })
  if (chart.empty !== undefined) {
    const more = axis
      ? chart.categoryTitle !== undefined || chart.valueTitle !== undefined || chart.categories.length + chart.series.length + chart.ticks.length > 0
      : chart.slices.length > 0
    // A legend names a series or a slice, which such a chart has none of, and is refused above.
    if (more) throw refusal(chart, `${named} has nothing to draw, and holds more than its title and its empty text, which is all such a chart prints`)
  } else if (axis && !chart.series.some(({ values }) => values.some((value) => value !== null))) {
    throw refusal(chart, `${named} has no value to draw, and no empty text to print in its place`)
  }
}

/**
 * A bar or a line chart's numbers: every one a decimal, its ticks an axis
 * (`placesOf`) that holds every value, and a bar chart's zero, as
 * `chartTicks` writes one (`chart-ticks.ts`): the plot's clip would cut a
 * value its ticks do not hold, and a bar stands on zero's place.
 */
function checkAxis(chart: AxisChart): void {
  const named = `the chart ${chart.id}`
  const values = chart.series.flatMap(({ values: each }) => each.flatMap((value) => (value === null ? [] : [value.exact])))
  if ([...chart.ticks.map(({ exact }) => exact), ...values].some((exact) => exactOf(exact) === undefined))
    throw refusal(chart, `${named} holds a value that is not a decimal`)
  const place = placesOf(chart)
  if (place === undefined)
    throw refusal(chart, `the value axis of ${named} is ${counted(chart.ticks.length, 'tick', 'ticks')}, and not two or more ascending in equal steps`)
  const highest = chart.ticks.length - 1
  const held = (exact: string): boolean => {
    const at = place(exact)
    return at >= 0 && at <= highest
  }
  if (!values.every(held)) throw refusal(chart, `${named} has a value its ticks do not hold, which would be drawn past its plot`)
  if (chart.chart === 'bar' && !held('0')) throw refusal(chart, `${named} is a bar chart whose ticks do not hold zero, which its bars stand on`)
}

/** A pie's numbers: every slice a decimal; none below zero (`belowZero`), which the runtime refuses as `chart-negative-share` (`lower-chart.ts`) and a share of which would be no slice; and together more than nothing (`sharesOf`). */
function checkSlices(chart: PieChart): void {
  const named = `the chart ${chart.id}`
  if (chart.slices.some(({ value }) => exactOf(value.exact) === undefined)) throw refusal(chart, `${named} holds a value that is not a decimal`)
  if (chart.slices.some(({ value }) => belowZero(value))) throw refusal(chart, `${named} is a pie with a slice below zero, which is no share of a whole`)
  if (sharesOf(chart) === undefined) throw refusal(chart, `${named} is a pie whose slices sum to nothing, and holds no empty text to print in their place`)
}

/**
 * Where the word `key` (`ChartWord.key`) of the chart `named` stands, for
 * a refusal: by what it is and its index in the block, as a table's row
 * is, and never by its text.
 */
function wordAt(key: string, named: string): string {
  const [role, first = '', second = ''] = key.split('/')
  switch (role) {
    case 'title':
      return `the title of ${named}`
    case 'categoryTitle':
      return `the category axis's title of ${named}`
    case 'valueTitle':
      return `the value axis's title of ${named}`
    case 'category':
      return `category ${first} of ${named}`
    case 'tick':
      return `tick ${first} of ${named}`
    case 'value':
      return `the value of series ${first} at category ${second} of ${named}`
    case 'legend':
      return `legend entry ${first} of ${named}`
    case 'empty':
      return `the empty text of ${named}`
    default:
      throw new Error(`${named} has a word ${key}, which chartWords never lists`)
  }
}
