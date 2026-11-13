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
