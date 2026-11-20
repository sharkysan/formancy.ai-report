import type { AxisChart, Chart, PieChart } from './document.js'
import { MAX_SCALE } from '@formancy/report-runtime'
import type { DocxChart, DocxChartFace, DocxChartSeries, DocxChartWord, DocxParagraph, DocxTable } from './docx/model.js'

/**
 * A chart held to what a Word file states for it (0076, extending 0068
 * and 0003), by the corpus's own reading of that record and never the
 * writer's code.
 *
 * A chart with something to draw is Word's own chart, a part of the file
 * the body draws inline: held here to the document's block in its kind,
 * its box, every word the block gives it -- the title, the axes' titles,
 * each category's label, each series' name where it has a legend, each
 * value's label where it labels them, a pie's legend entries as its
 * categories, a word that prints nothing stated as nothing and never left
 * for Word to write -- each value's digits exactly as the block holds
 * them, a value the block has none for stated as none; the value axis from its
 * lowest tick to its highest in the ticks' step, worked out here in
 * BigInt; every colour the block paints; what the words are set in, as
 * far as the block's style states it; and a legend exactly where the
 * block has one. That the part leads to no workbook and no address, and
 * holds literal data alone, the reader holds (`docx/chart.ts`).
 *
 * A chart with nothing to draw is no chart of Word's: its box, a cell at
 * least as tall that does not split across pages, and its title and its
 * empty text in the middle of it.
 *
 * What it cannot show is anything Word draws: where a word stands,
 * whether two meet, how long a bar is, or what the value axis's labels
 * say -- those Word writes itself, from the numbers, and the file holds
 * only the format it writes them in. And what the document leaves to an
 * engine -- the gaps between bars, a line's weight, the gridlines'
 * colour, the size where no style states one -- is not the corpus's to
 * know, and is held where the writer's tests hold it.
 */

/** A length in points read back from Word's units is the document's to within half of the coarsest unit, a twentieth of a point. */
const NEAR = 0.026
const near = (read: number, stated: number): boolean => Math.abs(read - stated) <= NEAR

/** What a face is held to: the chart's style as far as it states one, and whether the word is bold. */
export type FaceProblems = (face: DocxChartFace, bold: boolean) => string[]

/** A word as a chart's part states it where it names a slot -- a category, a series -- that stays though the word prints nothing: trimmed, and empty then, so that Word writes no word of its own there. */
const stated = (text: string | undefined): string => text?.trim() ?? ''

/** A word as a chart prints it: trimmed, and no word where nothing is left. */
const printed = (text: string | undefined): string | null => (text === undefined || text.trim() === '' ? null : text.trim())

interface Exact {
  readonly units: bigint
  readonly scale: number
}

/** A decimal's digits as a whole number of its last place. */
function exactOf(written: string): Exact | undefined {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(written)
  if (match === null) return undefined
  const units = BigInt(`${match[2]!}${match[3] ?? ''}`)
  return { units: match[1] === '-' ? -units : units, scale: (match[3] ?? '').length }
}

/** Whether two decimals are one number, however many zeros either is written with. */
function sameNumber(left: string, right: Exact): boolean {
  const read = exactOf(left)
  if (read === undefined) return false
  const scale = Math.max(read.scale, right.scale)
  return read.units * 10n ** BigInt(scale - read.scale) === right.units * 10n ** BigInt(scale - right.scale)
}

/** The step between a chart's first two ticks, and the most places any tick's value needs: what Word's axis is held to, and the fewest places its labels' format may have. */
function axisOf(chart: AxisChart): { readonly step: Exact; readonly places: number } | undefined {
  const ticks = chart.ticks.map(({ exact }) => exactOf(exact))
  const [first, second] = ticks
  if (first === undefined || second === undefined || ticks.includes(undefined)) return undefined
  const scale = Math.max(first.scale, second.scale)
  const step = { units: second.units * 10n ** BigInt(scale - second.scale) - first.units * 10n ** BigInt(scale - first.scale), scale }
  const places = Math.max(...chart.ticks.map(({ exact }) => neededPlaces(exact)))
  return { step, places }
}

/** The places a decimal's digits need: those after its point, without the zeros that end them. Counted in one pass, by no pattern a long run of zeros could make slow. */
function neededPlaces(exact: string): number {
  const point = exact.indexOf('.')
  if (point < 0) return 0
  let end = exact.length
  while (end > point + 1 && exact[end - 1] === '0') end -= 1
  return end - point - 1
}

/** The chart `node` draws, alone in its paragraph in exactly the block's box, or nothing where a problem was said of it. */
function framed(chart: Chart, node: DocxParagraph, say: (problem: string) => void): DocxChart | undefined {
  const [run, more] = node.runs
  if (run?.kind !== 'chart' || more !== undefined) {
    say(`the chart ${chart.id} is not a paragraph of one chart`)
    return undefined
  }
  if (node.indent !== 0 || node.before !== 0 || node.after !== 0 || node.line !== undefined)
    say(`the chart ${chart.id} stands with room around it, or on a line of a stated height`)
  const { frame } = run
  if (!near(frame.width, chart.width) || !near(frame.height, chart.height))
    say(`the chart ${chart.id} is drawn ${frame.width} × ${frame.height} pt where its box is ${chart.width} × ${chart.height}`)
  return frame.chart
}

/** A word the part states, held to the block's: its text, and what it is set in. */
function wordProblems(what: string, read: DocxChartWord | undefined | null, stated: string | null, faced: FaceProblems, bold: boolean): string[] {
  if ((read ?? null) === null || stated === null)
    return (read ?? null) === null && stated === null
      ? []
      : [`${what} is ${read == null ? 'missing' : `'${read.text}'`} where the chart ${stated === null ? 'prints none' : `prints '${stated}'`}`]
  return [
    ...(read!.text === stated ? [] : [`${what} is '${read!.text}' where the chart prints '${stated}'`]),
    ...faced(read!.face, bold).map((problem) => `${what} ${problem}`),
  ]
}

const sameList = (read: readonly (string | null)[], stated: readonly (string | null)[]): boolean =>
  read.length === stated.length && read.every((each, index) => each === stated[index])

/** A list as a problem says it: a value the chart has none for as a dash. */
const listed = (values: readonly (string | null)[]): string => values.map((each) => each ?? '–').join(', ')

function seriesProblems(chart: AxisChart, read: readonly DocxChartSeries[], faced: FaceProblems, bold: boolean): string[] {
  if (read.length !== chart.series.length) return [`holds ${read.length} series where the chart has ${chart.series.length}`]
  const categories = chart.categories.map(stated)
  return chart.series.flatMap(({ color, values }, index) => {
    const series = read[index]!
    const what = `series ${index}`
    const name = chart.legend.length === 0 ? undefined : stated(chart.legend[index]?.text)
    const exact = values.map((value) => value?.exact ?? null)
    return [
      // Digit for digit: a value written through a double would be another string.
      ...(sameList(series.values, exact) ? [] : [`${what} holds the values ${listed(series.values)} where the chart's are ${listed(exact)}`]),
      ...(sameList(series.categories, categories)
        ? []
        : [`${what} names the categories ${listed(series.categories)} where the chart's are ${listed(categories)}`]),
      ...(series.name === name
        ? []
        : [
            `${what} is ${series.name === undefined ? 'named by Word' : `named '${series.name}'`} where the chart's legend ${name === undefined ? 'names none' : `says '${name}'`}`,
          ]),
      ...(series.color === color ? [] : [`${what} is painted ${String(series.color)} where the chart's is ${color}`]),
      ...values.flatMap((value, at) =>
        wordProblems(`${what}'s label at category ${at}`, series.labels[at], chart.valueLabels ? printed(value?.text) : null, faced, bold),
      ),
    ]
  })
}

/** What may stand between the digits of a printed number: a decimal sign, and the characters the formatter groups thousands with. */
const BETWEEN = new Set(['.', ',', "'", '\u2019', '\u00a0', '\u202f', ' '])

/** The number a tick's text prints: from its first digit, through the digits and what may stand between them, to its last such digit. */
function printedNumber(text: string): string {
  const start = text.search(/\d/)
  if (start < 0) return ''
  let end = start
  for (let at = start; at < text.length; at += 1) {
    if (/\d/.test(text[at]!)) end = at + 1
    else if (!BETWEEN.has(text[at]!)) break
  }
  return text.slice(start, end)
}

/**
 * The format `chart`'s value axis is to print in, by the corpus's own
 * reading of 0076: the places its ticks' text prints, and never fewer
 * than a tick's value needs, its thousands grouped where a tick of a
 * thousand or more prints the digits of its whole part apart; undefined
 * for ticks that are no decimals.
 */
export function valueAxisFormat(chart: AxisChart): string | undefined {
  const axis = axisOf(chart)
  if (axis === undefined) return undefined
  let places = axis.places
  let grouped = false
  for (const { exact, text } of chart.ticks) {
    const whole = exact.replace(/^-/, '').split('.')[0]!
    const number = printedNumber(text)
    places = Math.max(places, number.replace(/\D/g, '').length - whole.length)
    if (whole.length >= 4 && !number.includes(whole)) grouped = true
  }
  // No number the runtime resolves has more places than MAX_SCALE, and no format a writer states for one.
  places = Math.min(MAX_SCALE, places)
  return `${grouped ? '#,##' : ''}${places === 0 ? '0' : `0.${'0'.repeat(places)}`}`
}

function axisProblems(chart: AxisChart, read: DocxChart, faced: FaceProblems, bold: boolean): string[] {
  const { categoryAxis, valueAxis } = read
  const axis = axisOf(chart)
  if (categoryAxis === undefined || valueAxis === undefined || axis === undefined) return ['has no axes to hold to its ticks, or ticks that are no decimals']
  const [lowest, highest] = [chart.ticks[0]!.exact, chart.ticks.at(-1)!.exact]
  const format = valueAxisFormat(chart)
  return [
    // The axis is the runtime's ticks, and nothing of it Word's own scaling: its ends digit for digit, and its step the ticks'.
    ...(valueAxis.min === lowest && valueAxis.max === highest
      ? []
      : [`has a value axis from ${valueAxis.min} to ${valueAxis.max} where its ticks run from ${lowest} to ${highest}`]),
    ...(sameNumber(valueAxis.step, axis.step) ? [] : [`has gridlines every ${valueAxis.step}, which is not the step between its ticks`]),
    ...(valueAxis.format === format ? [] : [`prints its value axis as '${valueAxis.format}' where its ticks need '${format}'`]),
    ...(categoryAxis.every === 1 ? [] : [`labels every ${categoryAxis.every}th category, where a chart labels each`]),
    // A bar stands on zero, so the category axis does; a line's stands at the axis's foot, as the PDF draws it.
    ...(categoryAxis.crosses === (chart.chart === 'bar' ? 'autoZero' : 'min') ? [] : [`has its category axis at '${categoryAxis.crosses}' of its value axis`]),
    ...wordProblems("the category axis's title", categoryAxis.title, printed(chart.categoryTitle), faced, bold),
    ...wordProblems("the value axis's title", valueAxis.title, printed(chart.valueTitle), faced, bold),
    ...[categoryAxis.face, valueAxis.face].flatMap((face, index) =>
      faced(face, bold).map((problem) => `the ${index === 0 ? 'category' : 'value'} axis's labels ${problem}`),
    ),
  ]
}

function pieProblems(chart: PieChart, read: readonly DocxChartSeries[]): string[] {
  const series = read[0]
  if (series === undefined || read.length !== 1) return ['is a pie of not one series']
  const exact = chart.slices.map(({ value }) => value.exact)
  // A pie's legend entries are its categories: each the runtime's own words, its value and its share among them where it labels them.
  const categories = chart.slices.map((_, index) => (chart.legend.length === 0 ? null : stated(chart.legend[index]?.text)))
  const paints = chart.slices.map(({ color }) => color)
  return [
    ...(sameList(series.values, exact) ? [] : [`holds the slices ${listed(series.values)} where the chart's are ${listed(exact)}`]),
    ...(sameList(series.categories, categories) ? [] : [`names its slices ${listed(series.categories)} where the chart's legend says ${listed(categories)}`]),
    ...(sameList(series.points, paints) ? [] : [`paints its slices ${listed(series.points)} where the chart's are ${listed(paints)}`]),
  ]
}

/**
 * A chart with something to draw (0076): `node`, the paragraph of its one
 * inline chart, held to `chart`. `faced` holds a word's face to the
 * chart's style as far as that states one.
 */
export function drawnChart(chart: Chart, node: DocxParagraph, faced: FaceProblems, say: (problem: string) => void): void {
  const read = framed(chart, node, say)
  if (read === undefined) return
  const bold = chart.style?.bold ?? false
  const problems = [
    ...(read.kind === chart.chart ? [] : [`is a ${read.kind} chart where the document's is a ${chart.chart} chart`]),
    ...wordProblems('the title', read.title, printed(chart.title), faced, true),
    ...(chart.chart === 'pie'
      ? pieProblems(chart, read.series)
      : read.kind === 'pie'
        ? []
        : [...seriesProblems(chart, read.series, faced, bold), ...axisProblems(chart, read, faced, bold)]),
    ...((read.legend !== undefined) === chart.legend.length > 0
      ? []
      : [`has ${read.legend === undefined ? 'no' : 'a'} legend where the chart ${chart.legend.length > 0 ? 'has one' : 'has none'}`]),
    // At the foot, where the PDF prints it.
    ...(read.legend === undefined || read.legend.position === 'b' ? [] : [`has its legend at '${read.legend.position}', and not at its foot`]),
    ...[read.face, ...(read.legend === undefined ? [] : [read.legend.face])].flatMap((face) =>
      faced(face, bold).map((problem) => `its words' default ${problem}`),
    ),
  ]
  for (const problem of problems) say(`the chart ${chart.id} ${problem}`)
}

/**
 * A chart with nothing to draw (0076): `node`, a table of one cell as
 * wide as the chart's box and at least as tall, with no line, fill or
 * padding, holding the chart's title, bold, and its empty text, each a
 * centred paragraph of one run, in the middle of the cell; a cell that
 * would hold neither ends with a paragraph a point tall.
 */
export function emptyChart(chart: Chart, node: DocxTable, faced: FaceProblems, say: (problem: string) => void): void {
  const what = `the chart ${chart.id}, which has nothing to draw,`
  const [row, ...rows] = node.rows
  const [cell, ...cells] = row?.cells ?? []
  if (row === undefined || cell === undefined || rows.length > 0 || cells.length > 0) return say(`${what} is not a table of one cell`)
  if (!near(node.width, chart.width) || row.height?.rule !== 'atLeast' || !near(row.height.value, chart.height))
    say(`${what} is not a cell ${chart.width} pt wide and at least ${chart.height} pt tall, the box the chart reserves`)
  // The PDF reserves the box whole: a row that may split would break it across two pages.
  if (!row.cantSplit) say(`${what} is a box that may split across two pages`)
  const sides = ['top', 'left', 'bottom', 'right'] as const
  if (
    Object.keys(node.borders).length > 0 ||
    Object.keys(cell.borders).length > 0 ||
    cell.shade !== undefined ||
    sides.some((side) => node.margins?.[side] !== 0)
  )
    say(`${what} is a box with a line, a fill or padding`)
  if (cell.align !== 'center') say(`${what} does not hold its words in the middle of its box`)
  const words = [
    { stated: printed(chart.title), bold: true, what: 'title' },
    { stated: printed(chart.empty), bold: chart.style?.bold ?? false, what: 'empty text' },
  ].filter((each) => each.stated !== null)
  if (words.length === 0) {
    const [only, ...more] = cell.blocks
    if (only?.kind !== 'paragraph' || only.runs.length > 0 || more.length > 0) say(`${what} prints something where it has no title and no empty text`)
    return
  }
  if (cell.blocks.length !== words.length)
    return say(`${what} holds ${cell.blocks.length} paragraphs where it prints ${words.length} of its title and its empty text`)
  words.forEach((word, index) => {
    const paragraph = cell.blocks[index]!
    const [run, more] = paragraph.kind === 'paragraph' ? paragraph.runs : []
    if (paragraph.kind !== 'paragraph' || run?.kind !== 'text' || more !== undefined || run.text !== word.stated)
      return say(`${what} does not print its ${word.what} '${word.stated!}' as a paragraph of one run`)
    if (paragraph.align !== 'center') say(`${what} does not centre its ${word.what}`)
    // A run's properties are a chart word's in all a style states: its family, size, weight, slant and colour.
    const { family, size, color, bold, italic } = run.props
    for (const problem of faced({ family: family ?? '', size: size ?? Number.NaN, bold, italic, color: color ?? '' }, word.bold))
      say(`${what}: its ${word.what} ${problem}`)
  })
}
