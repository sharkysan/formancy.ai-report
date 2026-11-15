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
 * point of a line chart of 8 series and 200 categories costs a render.
 * Each chart costs its kind's weight (`CHART_WEIGHT`), a unit for each
 * series at each category or each slice of a pie, and its word's weight
 * for each word it places (`WORD_WEIGHT`), as `MAX_SVG_DRAWING` weighs an
 * SVG (`chartUnits`). ECharts lays out every chart of a render three
 * times, a pie twice, before the body is paginated, and a reader draws
 * every one. Beyond its points and its words, a chart costs the render
 * its layouts and a reader its paint. Each weight is the larger of what it
 * costs the render and a reader, in the one unit, rounded up: a kind's to
 * ten, a word's to a whole unit.
 *
 * It holds one layout pass. pdfmake lays the document out again for each
 * page where a kept heading moves to the next, as often as where the
 * pages break decides, which no bound before the layout can count: 17 bar
 * charts of 123 one-letter categories, which the bound admits, each 290
 * points tall behind a keep-with-next heading, took a median of 1,475 ms
 * where with plain headings they took 574, two and a half times as long,
 * at a load of 3.2 to 3.7 (seven interleaved runs); 20 of them, past the
 * bound, 1,887 against 637 at a load of 3.9 to 4.3, three times as long.
 *
 * Measured on 2026-11-15 on a Mac (Apple M2, 8 cores) under Node 22.23.4,
 * ECharts 6.1.0, pdfmake 0.3.11 and pdfjs-dist 6.4.299. The weights came
 * from one run at a load average of 12 to 20: every document rendered and
 * its page drawn by PDF.js at scale 1 in the same seven rounds, each
 * difference read against its own round's unit, 0.15 to 0.50 ms as the
 * load fell, and the median of the seven taken. A word's is the
 * difference between one-page documents of the same charts with and
 * without words of its kind: a value label 0.85 units on a bar and 0.67
 * on a line, a category label 0.48, a legend entry 2.36 on a pie and 4.02
 * on an axis chart, a title 2.74, each the render's, and a tick 0.35, a
 * reader's. A kind's is its barest chart of one category, N against 2N,
 * less its points and its words: a bar of 8 series 34 to the render, and
 * a pie of one slice 8.
 *
 * A line's was measured again once the drawing took ECharts' clip of
 * its series out (`chart-svg.ts`), by the same run at a load of 3.0 to
 * 3.2, its unit 0.092 ms: a line of 8 series costs 59 to the render, and
 * a reader no more than its points and its words, where its eight
 * soft-masked groups had cost a reader 482; a line of one series 27 to
 * the render. A reader's cost no longer goes by series, and the render's
 * by about 4.5 units a series, which the one weight, the eight series',
 * holds. In that run a title cost 5.3 units and a tick 1.6, above their
 * weights, and a bar of 8 series 36, a pie of one slice 7, within theirs;
 * the bound's run below is what holds the render's time to 2 s.
 *
 * The bound is set by the slowest of seven interleaved runs of the
 * costliest of the forms tried, and it keeps 2 s only at a quiet load: at
 * a load of 10 to 18.6 the documents it admitted, a line still weighing
 * 490, ran far slower at their slowest, a page of nine line charts of 8
 * series and one category 5.5 s, and a page of one 8 × 200 line beside
 * five 8 × 1 lines 9.45 s. The forms were packed as many to a render as
 * the bound holds, in the densest grid each draws in on A4 landscape pages
 * without margins, across pages, and as many as one page holds: charts of
 * one category of each kind, of 1 and 8 series, bare, dressed and
 * value-labelled; the largest the earlier cost run tried, lines of
 * 8 × 200, of 8 × 123 one-letter categories and of 1 × 200, bars of
 * 1 × 186, 2 × 83, 8 × 19 and 1 × 123, and a dressed pie of eight slices;
 * bars of 120 and 186 categories and lines of 8 × 200, every value
 * labelled at 4 points, report-spec's least size; pies of eight slices,
 * bare and with every slice in the legend; and a page of one 8 × 200 line
 * beside lines of 8 series and one category.
 *
 * The bound was set at 5,000 when a line weighed 490, at a load of 3.3 to
 * 5.6: the slowest render, 263 dressed pies of one slice on 3 pages, took
 * 878 ms at its slowest, and the slowest page, one 8 × 200 line beside
 * five 8 × 1 lines, cost PDF.js 1,614 ms at its slowest and 723 at its
 * median, a spike: the page's other six stood at 0.66 to 1.10 times the
 * reference render's in their rounds. At 0.332 ms a unit it reaches 2 s
 * at about 6,017 units, and 6,000 would leave about 10 ms, so the bound is
 * 5,000. A review's run at a load of 4.2 to 5.5 put 17 value-labelled bars
 * of 120 categories (1,258 ms) ahead of the pies (1,235). With a line at
 * 60 and a pie of eight slices at most, the forms were run again at a
 * load of 3.0 to 3.9, among them pies of eight slices in place of 200, 53
 * line charts of twelve months and one series, titled, a review's, and
 * three 8 × 200 lines on one page, which the bound now admits at 4,998
 * units: the slowest render, the 53 lines, took 1,202 ms at its slowest,
 * one round's spike against a median of 338, the next 18 dressed bar
 * charts of 8 × 19 at 551; the slowest page, the three 8 × 200 lines, cost
 * PDF.js 142 ms. None measured the slowest the bound admits.
 */
export const MAX_CHART_DRAWING = 5000

/** What each kind of chart costs beyond its points and its words, in `MAX_CHART_DRAWING`'s units: the larger of what its layouts cost the render and what its drawing costs a reader, rounded up to ten. */
export const CHART_WEIGHT = { bar: 40, line: 60, pie: 10 } as const satisfies Readonly<Record<Chart['chart'], number>>

/** What each word a chart places costs, by what it is, in `MAX_CHART_DRAWING`'s units: the larger of what it costs the render and a reader, rounded up. A title is the chart's or an axis's. */
export const WORD_WEIGHT = { title: 3, legend: 5, tick: 1, category: 1, value: 1 } as const

/**
 * What drawing `chart` costs, in `MAX_CHART_DRAWING`'s units: its kind's
 * weight, a unit for each series at each category, null or not, or for
 * each of a pie's slices, one of no share among them, and each word it
 * places, as `chartWords` lists them, its word's weight. A chart with
 * nothing to draw costs none: ECharts never lays it out (`drawEmpty`),
 * and it paints no mark.
 */
export function chartUnits(chart: Chart): number {
  if (chart.empty !== undefined) return 0
  const points = chart.chart === 'pie' ? chart.slices.length : chart.series.length * chart.categories.length
  return chartWords(chart).reduce((units, { key }) => units + wordWeight(key, chart.id), CHART_WEIGHT[chart.chart] + points)
}

/** The weight of the word `key` (`ChartWord.key`) of the chart `id`, by what the word is. */
function wordWeight(key: string, id: string): number {
  const [role] = key.split('/')
  switch (role) {
    case 'title':
    case 'categoryTitle':
    case 'valueTitle':
      return WORD_WEIGHT.title
    case 'legend':
      return WORD_WEIGHT.legend
    case 'tick':
      return WORD_WEIGHT.tick
    case 'category':
      return WORD_WEIGHT.category
    case 'value':
      return WORD_WEIGHT.value
    default:
      // An empty text, which only a chart with nothing to draw prints, or a word chartWords never lists.
      throw new Error(`the chart ${id} has a word ${key} that a chart with something to draw never places`)
  }
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
        `the charts up to ${block.id} cost ${String(total)} units to draw, each its kind's weight, one for each series at each category or each slice of a pie, and its words' weights; a render may draw ${String(MAX_CHART_DRAWING)}`,
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
 * read from where it is decided: a bar or a line chart's categories to the
 * runtime's `MAX_CHART_CATEGORIES`, a bound on the work a chart costs, as
 * `content-too-large`; a pie's slices, and a chart's series, to
 * report-spec's `MAX_CHART_SERIES`, the most colours a palette holds, one
 * for each, as the runtime holds a pie's categories to its palette
 * (`lower-chart.ts`); and its ticks to the `MAX_TICK_INTERVALS` intervals
 * `chartTicks` writes at most; each of the last three as `unsupported`, a
 * chart of a form no runtime resolves. Held before its words are read, so
 * that a chart built by hand past them costs the check nothing more, and
 * ECharts never lays it out.
 */
function checkBounds(chart: Chart): void {
  const named = `the chart ${chart.id}`
  if (chart.chart === 'pie') {
    if (chart.slices.length > MAX_CHART_SERIES)
      throw refusal(
        chart,
        `${named} has ${String(chart.slices.length)} slices; a pie has at most ${String(MAX_CHART_SERIES)}, one colour each from its palette`,
      )
    return
  }
  if (chart.categories.length > MAX_CHART_CATEGORIES) {
    throw new RenderRefusal(
      'content-too-large',
      `${named} has ${String(chart.categories.length)} categories; a chart has at most ${String(MAX_CHART_CATEGORIES)}`,
      chart.id,
    )
  }
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
