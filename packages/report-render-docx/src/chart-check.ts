import { MAX_CHART_CATEGORIES, MAX_CHART_SERIES, MAX_TICK_INTERVALS, RenderRefusal, type AxisChart, type Chart, type PieChart } from '@formancy/report-runtime'
import { exactOf, minus, sign, stepOf, sum, type Exact } from './chart-exact.js'
import { chartWords } from './charts.js'
import { checkColor, checkStyle, checkText } from './check-text.js'
import type { DocxFonts } from './fonts.js'
import { MAX_DOCX_CHART_DIGITS, MAX_DOCX_CHART_POINTS, MAX_DOCX_CHARTS } from './limits.js'

/**
 * A chart, held to what a Word file states of one before anything is
 * written (0076). The writer decides nothing of a chart: every number
 * and every word of it is the runtime's (0055). What is here is what no
 * engine prints of a chart's block -- the PDF renderer's contract with
 * it (`check-chart.ts` there), stated again, by its codes and with the
 * chart's id as its subject, since no package below both engines holds
 * it; the corpus's `MALFORMED` list holds the two statements to each
 * other, a chart of each kind of wrong among it (`against-pdf.test.ts`).
 * Each refusal names the chart by its id, and counts, and quotes none of
 * its words or values, each of which may be the data's. In order:
 *
 * - **Where it stands**: in the body, never in a page region.
 * - **The file's own bound on its charts**, before anything of this one
 *   is read (`limits.ts`).
 * - **What it is**: a kind a report knows, a box of a size, within the
 *   bounds no chart the runtime resolves passes; then the file's own
 *   bound on the points its charts hold between them, before a word or a
 *   number of this one is read.
 * - **Its style and its colours**, as a paragraph's are held.
 * - **Its parts, matched**: a value or none at every category, a legend
 *   that names every series or slice in its colour, or none, and a chart
 *   with nothing to draw holding its title and its empty text alone.
 * - **Its words**, every one the block holds that a chart prints, a
 *   tick's among them, which a Word file does not state and the PDF
 *   prints: text, with no control character, a line break among those,
 *   and held as a paragraph's is to the scripts a report prints and the
 *   face it prints in.
 * - **Its numbers**: none written longer than any number the runtime
 *   resolves, the file's own bound, held before one is read as a number
 *   (`limits.ts`); every value a decimal; the ticks two or more,
 *   ascending in equal steps, holding every value and a bar chart's
 *   zero; a pie's slices none below zero and more than nothing together.
 * - **Its width**, no wider than where it stands. Its height against the
 *   page is the walk's to say (`check.ts`).
 *
 * What the PDF renderer refuses of what it laid out -- words that would
 * meet, labels too wide for their slots, bars too thin, a plot too short
 * -- is not here: the writer lays nothing out, and what Word does with a
 * chart too full for its box is Word's.
 */

/** What the charts a walk met before one hold together: how many of them are parts of the file, and their points. */
export interface HeldCharts {
  readonly count: number
  readonly points: number
}

/** Where a chart stands. */
export interface ChartPlace {
  readonly region: boolean
  readonly everyPage: boolean
  readonly width: number
}

const unsupported = (chart: Chart, message: string): RenderRefusal => new RenderRefusal('unsupported', message, chart.id)

/** `count` of a thing, in the words for one of it and for more. */
const counted = (count: number, one: string, more: string): string => `${count} ${count === 1 ? one : more}`

/**
 * A control character -- Unicode's general category Cc, a tab and every
 * line break among it -- or a line or paragraph separator: none stands
 * in a chart's word. A line feed in a paragraph is a break the file
 * states; in a chart's label it is a character Word shows as it likes.
 */
const CONTROL = /[\p{Cc}\u2028\u2029]/u

/**
 * `chart` held to all of the above, `held` what the charts before it
 * hold; the points it adds to them, none for a chart with nothing to
 * draw, which is no part of the file.
 */
export function checkChart(chart: Chart, place: ChartPlace, fonts: DocxFonts, held: HeldCharts): number {
  const named = `the chart ${chart.id}`
  if (place.region)
    throw unsupported(
      chart,
      `${named} stands in ${place.everyPage ? 'a page region, which every page prints' : "page 1's own header, a page region"}: a chart stands in the body`,
    )
  const drawn = chart.empty === undefined
  if (drawn && held.count === MAX_DOCX_CHARTS)
    throw new RenderRefusal(
      'content-too-large',
      `the report holds more than ${MAX_DOCX_CHARTS} charts, ${chart.id} the first past them; a Word file holds no more`,
      chart.id,
    )
  const kind: string = chart.chart
  if (kind !== 'bar' && kind !== 'line' && kind !== 'pie') throw unsupported(chart, `${named} is of a kind a report does not know`)
  const { width, height } = chart
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) throw unsupported(chart, `${named} is drawn ${width} × ${height} pt`)
  checkBounds(chart)
  const points = !drawn ? 0 : chart.chart === 'pie' ? chart.slices.length : chart.series.length * chart.categories.length
  if (held.points + points > MAX_DOCX_CHART_POINTS)
    throw new RenderRefusal(
      'content-too-large',
      `the report's charts up to ${chart.id} hold ${held.points + points} points between them, one for each series at each category or each slice of a pie; a Word file may hold ${MAX_DOCX_CHART_POINTS}`,
      chart.id,
    )
  checkStyle(chart.style, named, fonts, chart.id)
  for (const { color } of [...(chart.chart === 'pie' ? chart.slices : chart.series), ...chart.legend]) checkColor(color, named, chart.id)
  checkParts(chart)
  const style = chart.style ?? {}
  for (const { where, text, title } of chartWords(chart)) {
    if (typeof text !== 'string') throw unsupported(chart, `${named} has a word that is not text`)
    if (CONTROL.test(text))
      throw unsupported(chart, `${named} has a word with a tab, a line break or another control character in it, which a chart never prints`)
    // A word blank once trimmed prints nothing, and asks for no face.
    if (text.trim() === '') continue
    checkText(text.trim(), { token: style.font, bold: title || (style.bold ?? false), italic: style.italic ?? false }, fonts, where, chart.id)
  }
  if (drawn) {
    if (chart.chart === 'pie') checkSlices(chart)
    else checkAxis(chart)
  }
  if (width > place.width) throw new RenderRefusal('content-too-large', `${named} is ${width} pt wide; it stands ${place.width.toFixed(2)} pt wide`, chart.id)
  return points
}

/** `chart` held to the bounds no chart the runtime resolves passes, each read from where it is decided, before its words are read. */
function checkBounds(chart: Chart): void {
  const named = `the chart ${chart.id}`
  if (chart.chart === 'pie') {
    if (chart.slices.length > MAX_CHART_SERIES)
      throw unsupported(chart, `${named} has ${chart.slices.length} slices; a pie has at most ${MAX_CHART_SERIES}, one colour each from its palette`)
    return
  }
  if (chart.categories.length > MAX_CHART_CATEGORIES)
    throw new RenderRefusal('content-too-large', `${named} has ${chart.categories.length} categories; a chart has at most ${MAX_CHART_CATEGORIES}`, chart.id)
  if (chart.series.length > MAX_CHART_SERIES)
    throw unsupported(chart, `${named} has ${chart.series.length} series; a chart has at most ${MAX_CHART_SERIES}, one colour each from its palette`)
  if (chart.ticks.length > MAX_TICK_INTERVALS + 1)
    throw unsupported(chart, `the value axis of ${named} has ${chart.ticks.length} ticks; an axis has at most ${MAX_TICK_INTERVALS + 1}`)
}

/** `chart`'s parts, matched as the runtime resolves them. */
function checkParts(chart: Chart): void {
  const named = `the chart ${chart.id}`
  const axis = chart.chart !== 'pie'
  if (axis) {
    chart.series.forEach(({ values }, index) => {
      if (values.length !== chart.categories.length)
        throw unsupported(
          chart,
          `series ${index} of ${named} has ${counted(values.length, 'value', 'values')} for ${counted(chart.categories.length, 'category', 'categories')}`,
        )
    })
  }
  const mark = axis ? 'series' : 'slice'
  const marked = (axis ? chart.series : chart.slices).map(({ color }) => color)
  if (chart.legend.length !== 0 && chart.legend.length !== marked.length)
    throw unsupported(
      chart,
      `${named} has ${counted(chart.legend.length, 'legend entry', 'legend entries')} for ${counted(marked.length, mark, axis ? 'series' : 'slices')}, and names every ${mark} in its legend or none`,
    )
  chart.legend.forEach(({ color }, index) => {
    if (color !== marked[index]) throw unsupported(chart, `legend entry ${index} of ${named} is not in the colour of the ${mark} it names`)
  })
  if (chart.empty !== undefined) {
    const more = axis
      ? chart.categoryTitle !== undefined || chart.valueTitle !== undefined || chart.categories.length + chart.series.length + chart.ticks.length > 0
      : chart.slices.length > 0
    // A legend names a series or a slice, which such a chart has none of, and is refused above.
    if (more) throw unsupported(chart, `${named} has nothing to draw, and holds more than its title and its empty text, which is all such a chart prints`)
  } else if (axis && !chart.series.some(({ values }) => values.some((value) => value !== null))) {
    throw unsupported(chart, `${named} has no value to draw, and no empty text to print in its place`)
  }
}

/** A bar or a line chart's numbers: every one a decimal, its ticks an axis that holds every value, and a bar chart's zero, which its bars stand on. */
function checkAxis(chart: AxisChart): void {
  const named = `the chart ${chart.id}`
  const read = (exact: unknown): Exact => exactOf(short(chart, exact)) ?? refuse(chart, `${named} holds a value that is not a decimal`)
  const ticks = chart.ticks.map(({ exact }) => read(exact))
  const values = chart.series.flatMap(({ values: each }) => each.flatMap((value) => (value === null ? [] : [read(value.exact)])))
  if (stepOf(ticks) === undefined)
    throw unsupported(chart, `the value axis of ${named} is ${counted(chart.ticks.length, 'tick', 'ticks')}, and not two or more ascending in equal steps`)
  const [lowest, highest] = [ticks[0]!, ticks.at(-1)!]
  const held = (value: Exact): boolean => sign(minus(value, lowest)) >= 0 && sign(minus(highest, value)) >= 0
  if (!values.every(held)) throw unsupported(chart, `${named} has a value its ticks do not hold, which would be drawn past its plot`)
  if (chart.chart === 'bar' && !held({ units: 0n, scale: 0 }))
    throw unsupported(chart, `${named} is a bar chart whose ticks do not hold zero, which its bars stand on`)
}

/** A pie's numbers: every slice a decimal, none below zero, and together more than nothing. */
function checkSlices(chart: PieChart): void {
  const named = `the chart ${chart.id}`
  const slices = chart.slices.map(({ value }) => exactOf(short(chart, value.exact)) ?? refuse(chart, `${named} holds a value that is not a decimal`))
  if (slices.some((slice) => sign(slice) < 0)) throw unsupported(chart, `${named} is a pie with a slice below zero, which is no share of a whole`)
  if (sign(sum(slices)) <= 0) throw unsupported(chart, `${named} is a pie whose slices sum to nothing, and holds no empty text to print in their place`)
}

/**
 * `exact`, where it is written no longer than any number the runtime
 * resolves: a longer one is refused before it is read as a number, so
 * that what the checks work out of a chart's numbers costs what the
 * points' bound takes it for.
 */
function short(chart: Chart, exact: unknown): unknown {
  if (typeof exact === 'string' && exact.length > MAX_DOCX_CHART_DIGITS)
    throw new RenderRefusal(
      'content-too-large',
      `the chart ${chart.id} holds a number written in ${exact.length} characters; a report's number is at most ${MAX_DOCX_CHART_DIGITS}, and a Word file's chart holds no longer one`,
      chart.id,
    )
  return exact
}

function refuse(chart: Chart, message: string): never {
  throw unsupported(chart, message)
}
