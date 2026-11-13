import { axisProblems, AXIS_PAINT, categoryProblems, described, GRID_PAINT, pieProblems, times, within, type ChartRead } from './check-chart-marks.js'
import { EDGE, OVERLAP, points, quoted, type Page } from './check-page.js'
import { SUBSET_PREFIX } from './check-text.js'
import { normalise, type ExpectedChart, type ExpectedFontName } from './fixture.js'
import type { PdfBox, PdfPage, PdfTextItem, ReadPdf } from './read-pdf.js'

/**
 * Each chart proved on the PDF it produced (0003, 0058): a chart ECharts
 * laid out is drawn by pdfmake's SVG converter inside a clip of its box,
 * which is where it is found, and its words are pdfmake's text, which is
 * how they are read.
 *
 * 1. **Its clip.** A rectangular clip of its size holding painted paths,
 *    after the SVG images have taken theirs (`drawings.ts`), each chart
 *    after the one before it in document order; with every clip set
 *    inside it, since ECharts clips a series to its plot and a path's
 *    clip is the innermost (`PdfPath.clip`). No path in them reaches past
 *    the clip it is painted in: nothing of a chart is clipped.
 * 2. **Its words.** The runs that meet its box are its own: every word one
 *    run's text, inside the box, as many times as its words hold it, in
 *    its face, across the page, no two meeting. A word is sought as PDF.js
 *    extracts it, which is as the corpus compares extracted text
 *    (`normalise`): it reads a no-break space back as a space, and two
 *    spaces as one (measured on the renderer's legend entries). A label
 *    that prints nothing -- empty once trimmed -- is no word, and is not
 *    proved.
 * 3-6. **Its marks** (`check-chart-marks.ts`): the axes, the bars, the
 *    lines and the slices.
 * 7. **Nothing to draw.** A chart with nothing to draw is no drawing (R7,
 *    R8): it has no clip, so its box is not proved, which 0058 says. Its
 *    empty text is found, with its title above it no farther than the
 *    box's size, each once there, and nothing painted between them in a
 *    chart's colour.
 *
 * What it does not see: a chart beside an SVG image or a QR code of its
 * very size is told apart from it by order alone; a word the reader
 * splits into several runs -- PDF.js splits one at a change of script --
 * is not one run's text, and is said to be missing.
 */

/** Points two words' boxes may share both ways before they meet: PDF.js reads where a run stands to far less, and the renderer refuses any two that meet (`chart-held.ts`). */
const MEET = 0.01

/** A rectangular clip on a page, and whether an SVG image took it. */
interface Clip {
  readonly page: PdfPage
  readonly index: number
  readonly box: PdfBox
  readonly taken: boolean
}

const same = (a: PdfBox, b: PdfBox): boolean => a.x === b.x && a.top === b.top && a.width === b.width && a.height === b.height

/** Whether `a` and `b` share more than `by` both across and down. */
const meet = (a: PdfBox, b: PdfBox, by: number): boolean =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > by && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > by

/** Whether `a` crosses into `b`, a box of no height or width among them: a gridline through it. */
const crosses = (a: PdfBox, b: PdfBox): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.top < b.bottom && b.top < a.bottom

/**
 * What is wrong with each chart `expected` holds, in document order, as
 * `pdf` draws it on `pages`, whose drawings are the SVG images' boxes;
 * none when every chart passes. Each problem names its page and its chart.
 */
export function chartProblems(pdf: ReadPdf, pages: readonly Page[], expected: readonly ExpectedChart[]): string[] {
  const clips: Clip[] = pdf.pages.flatMap((page, at) =>
    page.clips.map((box, index) => ({ page, index, box, taken: pages[at]!.drawings.some((drawing) => same(drawing, box)) })),
  )
  const used = new Set<PdfTextItem>()
  const problems: string[] = []
  let next = 0
  for (const chart of expected.map(normalised)) {
    if (chart.empty) {
      problems.push(...emptyProblems(pdf, chart, used))
      continue
    }
    const found = placed(clips, next, chart)
    if (found === undefined) {
      problems.push(`the chart ${chart.id}, ${points(chart.width)} × ${points(chart.height)} pt, is not drawn: no clip of its size holds a painted path`)
      continue
    }
    next = found.next
    problems.push(...drawnProblems(chart, found.clip, found.inside))
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

/** The first clip from `from` that `chart` is drawn in -- no image's, of its size, painted in it or in a clip set inside it -- the clips set inside it, and where the next chart is sought from. */
function placed(clips: readonly Clip[], from: number, chart: ExpectedChart): { clip: Clip; inside: ReadonlySet<number>; next: number } | undefined {
  for (let at = from; at < clips.length; at++) {
    const clip = clips[at]!
    if (clip.taken || Math.abs(clip.box.width - chart.width) > EDGE || Math.abs(clip.box.height - chart.height) > EDGE) continue
    let next = at + 1
    while (clips[next]?.page === clip.page && within(clips[next]!.box, clip.box)) next++
    const inside = new Set(clips.slice(at, next).map(({ index }) => index))
    if (clip.page.paths.some((path) => path.clip !== undefined && inside.has(path.clip))) return { clip, inside, next }
  }
  return undefined
}

/** A drawn chart's clip, its marks and its words. */
function drawnProblems(chart: ExpectedChart, { page, box }: Clip, inside: ReadonlySet<number>): string[] {
  const say = (what: string): string => `page ${String(page.number)}: the chart ${chart.id} ${what}`
  const read: ChartRead = {
    expected: chart,
    page,
    box,
    paths: page.paths.filter((path) => path.clip !== undefined && inside.has(path.clip)),
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
 * empty chart before took; its title, where it prints one, the nearest
 * run of it above, no farther from the empty text than the box's size;
 * each printed once where they stand, nothing painted between them in a
 * chart's colour, and both held as a drawn chart's words are.
 */
function emptyProblems(pdf: ReadPdf, chart: ExpectedChart, used: Set<PdfTextItem>): string[] {
  const text = chart.words.at(-1)
  if (text === undefined) return []
  const title = chart.words.length > 1 ? chart.words[0] : undefined
  const free = (page: PdfPage, sought: string): PdfTextItem[] => page.items.filter((item) => item.text === sought && !used.has(item))
  const candidates = pdf.pages.flatMap((page) => free(page, text).map((item) => ({ page, item })))
  const [first] = candidates
  if (first === undefined) return [`the chart ${chart.id} does not print its empty text ${quoted(text)}`]
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
