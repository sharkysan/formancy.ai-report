import { axisProblems, AXIS_PAINT, categoryProblems, GRID_PAINT } from './check-chart-marks.js'
import { described, meet, MEET, times, within, type ChartRead } from './check-chart-read.js'
import { pieProblems } from './check-chart-pie.js'
import { EDGE, OVERLAP, points, quoted, type Page } from './check-page.js'
import { SUBSET_PREFIX } from './check-text.js'
import type { PlacedChart } from './drawings.js'
import { normalise, type ExpectedChart, type ExpectedFontName } from './fixture.js'
import type { PdfBox, PdfPage, PdfTextItem, ReadPdf } from './read-pdf.js'

/**
 * Each chart proved on the PDF it produced (0003, 0058): a chart ECharts
 * laid out is drawn by pdfmake's SVG converter inside a clip of its box,
 * which is where it is found, and its words are pdfmake's text, which is
 * how they are read.
 *
 * 1. **Its clip.** Found by `drawings.ts`, in the one walk that places the
 *    SVG images, in document order through every container: a rectangular
 *    clip of its size holding painted paths, with every clip set inside
 *    it. No path in them reaches past the rectangular clip it is painted
 *    in. That is all a clip says: svg-to-pdfkit draws ECharts' clip of a
 *    series to its plot as a soft mask, which the reader skips, so a mark
 *    is held to the plot by its own points (checks 4 and 5), not by a
 *    clip, and what a mask hides is not seen.
 * 2. **Its words.** The runs that meet its box are its own: every word one
 *    run's text, inside the box, as many times as its words hold it, in
 *    its face, across the page, no two meeting. A word is sought as PDF.js
 *    extracts it, which is as the corpus compares extracted text
 *    (`normalise`): it reads a no-break space back as a space, and two
 *    spaces as one (measured on the renderer's legend entries). A label
 *    that prints nothing -- empty once trimmed -- is no word, and is not
 *    proved.
 * 3-6. **Its marks**: the axes, the bars and the lines
 *    (`check-chart-marks.ts`), and the slices (`check-chart-pie.ts`).
 * 7. **Nothing to draw.** A chart with nothing to draw is no drawing (R7,
 *    R8): it has no clip, so its box is not proved, which 0058 says. Its
 *    empty text is sought after the box of the chart drawn before it in
 *    its own flow, the body or its column (`ExpectedChart.after`), and
 *    where there is none on the pages after the page breaks before it,
 *    with its title above it no farther than the box's size, each once
 *    there, and nothing painted between them in a chart's colour.
 *
 * What it rests on, and what it does not see:
 * - **The reader's box is inside the word's line.** A run's box is as tall
 *   as its size (`read-pdf.ts`), a word's line as tall as its face's: 1.17
 *   em in Roboto and about 1.1 in Liberation's faces. That a word stands
 *   inside the chart's box and meets no other is read on the run's box,
 *   which holds for a face whose line is about an em or more; a host face
 *   whose line is shorter, which 0043's least line admits, would be read
 *   as reaching past the box, or meeting the word beside it.
 * - **Document order is the pages' too.** Columns that break across pages
 *   break it: a chart in a column may stand on a later page than the next
 *   column's, and is then sought after it (`drawings.ts`), as an SVG image
 *   is.
 * - **An empty chart is found by its words.** One with no drawn chart
 *   before it in its flow is sought from the page after the page breaks
 *   before it, so a title and a sentence of its words printed as other
 *   text there would pass for it.
 * - **A word is one run.** One the reader splits into several -- PDF.js
 *   splits a run at a change of script -- is said to be missing.
 */

/** Where a drawn chart stands: its page and its box, which an empty chart after it in its flow is sought after. */
interface Standing {
  readonly page: number
  readonly box: PdfBox
}

/** Whether `a` crosses into `b`, a box of no height or width among them: a gridline through it. */
const crosses = (a: PdfBox, b: PdfBox): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.top < b.bottom && b.top < a.bottom

/**
 * What is wrong with each chart `expected` holds, in document order, as
 * `pdf` draws it on `pages`, whose charts `drawings.ts` placed; none when
 * every chart passes. A chart it did not find is its problem to say, and
 * no other is said of it here. Each problem names its page and its chart.
 */
export function chartProblems(pdf: ReadPdf, pages: readonly Page[], expected: readonly ExpectedChart[]): string[] {
  const placed = pages.flatMap(({ page, charts }) => charts.map((chart) => ({ page, chart })))
  const taken = new Set<PlacedChart>()
  const used = new Set<PdfTextItem>()
  const problems: string[] = []
  for (const chart of expected.map(normalised)) {
    if (chart.empty) {
      const anchor = placed.find(({ chart: { id } }) => id === chart.after)
      problems.push(...emptyProblems(pdf, chart, used, anchor === undefined ? undefined : { page: anchor.page.number, box: anchor.chart.box }))
      continue
    }
    const at = placed.find((each) => each.chart.id === chart.id && !taken.has(each.chart))
    if (at === undefined) continue
    taken.add(at.chart)
    problems.push(...drawnProblems(chart, at.page, at.chart))
  }
  return problems
}

/** `chart` with every word it prints as PDF.js extracts it, as extracted text is compared (`normalise`). */
const normalised = (chart: ExpectedChart): ExpectedChart => ({
  ...chart,
  words: chart.words.map(normalise),
  categories: chart.categories.map(normalise),
  ticks: chart.ticks.map(({ exact, text }) => ({ exact, text: normalise(text) })),
  faces: chart.faces.map(({ text, postScriptName }) => ({ text: normalise(text), postScriptName })),
})

/** A drawn chart's clip, its marks and its words. */
function drawnProblems(chart: ExpectedChart, page: PdfPage, { box, clips }: PlacedChart): string[] {
  const say = (what: string): string => `page ${String(page.number)}: the chart ${chart.id} ${what}`
  const read: ChartRead = {
    expected: chart,
    page,
    box,
    paths: page.paths.filter((path) => path.clip !== undefined && clips.has(path.clip)),
    items: page.items.filter((item) => meet(item, box, OVERLAP)),
    say,
  }
  const cut = read.paths.filter((path) => !within(path, page.clips[path.clip!]!)).map((path) => say(`paints a path its clip cuts: ${described(path)}`))
  const runs = itemProblems(say, read.items, chart.faces, box)
  if (chart.chart === 'pie') return [...cut, ...pieProblems(read), ...wordProblems(read, read.items, new Set()), ...runs]
  const axes = axisProblems(read)
  const words = read.items.filter((item) => !axes.ticks.has(item))
  // Without a plot no run is known for a tick's label, and a tick's text printed more often than the words hold it is not said to be.
  const lenient = new Set(axes.plot === undefined ? chart.ticks.map(({ text }) => text) : [])
  return [
    ...cut,
    ...axes.problems,
    ...wordProblems(read, words, lenient),
    ...(axes.plot === undefined ? [] : categoryProblems(read, axes.plot, words)),
    ...runs,
  ]
}

/** Each of the chart's words printed by as many of `items` as its words hold it, and no item printing any other. */
function wordProblems({ expected, say }: ChartRead, items: readonly PdfTextItem[], lenient: ReadonlySet<string>): string[] {
  const counted = (texts: readonly string[]): Map<string, number> =>
    texts.reduce((counts, text) => counts.set(text, (counts.get(text) ?? 0) + 1), new Map<string, number>())
  const [wanted, printed] = [counted(expected.words), counted(items.map(({ text }) => text))]
  return [...new Set([...wanted.keys(), ...printed.keys()])].flatMap((text) => {
    const [want, got] = [wanted.get(text) ?? 0, printed.get(text) ?? 0]
    if (want === got || (got > want && lenient.has(text))) return []
    if (got === 0) return [say(`does not print ${quoted(text)} inside its box`)]
    if (want === 0) return [say(`prints ${quoted(text)}, which is none of its words`)]
    return [say(`prints ${quoted(text)} ${times(got)} inside its box; its words hold it ${times(want)}`)]
  })
}

/** Each run inside `box`, where there is one, across the page and in its face; and no two meeting. */
function itemProblems(say: (what: string) => string, items: readonly PdfTextItem[], faces: readonly ExpectedFontName[], box: PdfBox | undefined): string[] {
  const named = new Map<string, Set<string>>()
  for (const { text, postScriptName } of faces) named.set(text, (named.get(text) ?? new Set()).add(postScriptName))
  const each = items.flatMap((item) => {
    const [face, allowed] = [item.font.replace(SUBSET_PREFIX, ''), named.get(item.text)]
    return [
      ...(box === undefined || within(item, box)
        ? []
        : [
            say(
              `prints ${quoted(item.text)} past its box, from ${points(item.x)}, ${points(item.top)} to ${points(item.x + item.width)}, ${points(item.bottom)} pt`,
            ),
          ]),
      ...(item.angle === 0 ? [] : [say(`prints ${quoted(item.text)} turned ${String(item.angle)}°; its words read across`)]),
      ...(allowed === undefined || allowed.has(face) ? [] : [say(`prints ${quoted(item.text)} in ${face}; its face is ${[...allowed].join(' or ')}`)]),
    ]
  })
  const meeting = items.flatMap((item, index) =>
    items
      .slice(index + 1)
      .filter((other) => meet(item, other, MEET))
      .map((other) => say(`prints ${quoted(item.text)} and ${quoted(other.text)} over each other`)),
  )
  return [...each, ...meeting]
}

/**
 * A chart with nothing to draw: its empty text, the first run of it no
 * empty chart before took, after the box of the chart drawn before it in
 * its flow, `before`, where there is one -- on a later page, or on its
 * page no higher than its top -- and on a page after the page breaks
 * before it where there is none; its title, where it prints one, the
 * nearest run of it above, no
 * farther from the empty text than the box's size; each printed once where
 * they stand, nothing painted between them in a chart's colour, and both
 * held as a drawn chart's words are.
 */
function emptyProblems(pdf: ReadPdf, chart: ExpectedChart, used: Set<PdfTextItem>, before: Standing | undefined): string[] {
  const text = chart.words.at(-1)
  if (text === undefined) return []
  const title = chart.words.length > 1 ? chart.words[0] : undefined
  const breaks = chart.breaks ?? 0
  const after = (page: PdfPage, item: PdfTextItem): boolean =>
    before === undefined ? page.number > breaks : page.number > before.page || (page.number === before.page && item.top >= before.box.top - EDGE)
  const since =
    before !== undefined
      ? ' after the chart drawn before it'
      : breaks === 0
        ? ''
        : ` after the ${breaks === 1 ? 'page break' : `${String(breaks)} page breaks`} before it`
  const free = (page: PdfPage, sought: string): PdfTextItem[] => page.items.filter((item) => item.text === sought && !used.has(item) && after(page, item))
  const candidates = pdf.pages.flatMap((page) => free(page, text).map((item) => ({ page, item })))
  const [first] = candidates
  if (first === undefined) return [`the chart ${chart.id} does not print its empty text ${quoted(text)}${since}`]
  const reach = (a: PdfBox, b: PdfBox): boolean =>
    Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x) <= chart.width + EDGE &&
    Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top) <= chart.height + EDGE
  /** Its words with the empty text `item`: the title's nearest run above it within reach first, where it has a title; none where that title has no such run. */
  const wordsAt = ({ page, item }: (typeof candidates)[number]): PdfTextItem[] | undefined => {
    if (title === undefined) return [item]
    const [nearest] = free(page, title)
      .filter((each) => each.top < item.top && reach(each, item))
      .sort((a, b) => b.top - a.top)
    return nearest === undefined ? undefined : [nearest, item]
  }
  const found = candidates.map((candidate) => ({ page: candidate.page, words: wordsAt(candidate) })).find(({ words }) => words !== undefined)
  const say = (page: PdfPage) => (what: string) => `page ${String(page.number)}: the chart ${chart.id} ${what}`
  if (found?.words === undefined) return [say(first.page)(`prints its title ${quoted(title!)} nowhere above its empty text within its box`)]
  const { words } = found
  for (const word of words) used.add(word)
  const area: PdfBox = {
    x: Math.min(...words.map(({ x }) => x)),
    top: Math.min(...words.map(({ top }) => top)),
    bottom: Math.max(...words.map(({ bottom }) => bottom)),
    width: Math.max(...words.map(({ x, width }) => x + width)) - Math.min(...words.map(({ x }) => x)),
    height: Math.max(...words.map(({ bottom }) => bottom)) - Math.min(...words.map(({ top }) => top)),
  }
  const near = found.page.items.filter((item) => crosses(item, area))
  const twice = words.map(({ text: word }) => [word, near.filter((item) => item.text === word).length] as const).filter(([, count]) => count > 1)
  // An empty chart holds no series and no slice, so a chart's colours here are the axes': a gridline or an axis line drawn for no data.
  const between = found.page.paths.filter(
    (path) => crosses(path, area) && [path.fill, path.stroke].some((paint) => paint === GRID_PAINT || paint === AXIS_PAINT),
  )
  return [
    ...twice.map(([word, count]) => say(found.page)(`prints ${quoted(word)} ${times(count)} where its words stand`)),
    ...between.map((path) => say(found.page)(`paints ${described(path)} between its words`)),
    ...itemProblems(say(found.page), words, chart.faces, undefined),
  ]
}
