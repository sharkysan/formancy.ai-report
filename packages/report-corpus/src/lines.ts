import { BASELINE_SHIFTS, SHIFTED_RISE, SHIFTED_SIZE, type BaselineShift } from '@formancy/report-runtime'
import { normalise } from './fixture.js'
import { baselineOf, type PdfPage, type PdfTextItem } from './read-pdf.js'

/**
 * A page's text as lines a reader sees, rebuilt from PDF.js's runs: runs on
 * one baseline make one line, read left to right, and lines are read top to
 * bottom. An engine is free to draw a line as one run or as one per word, and
 * the checks must not depend on which.
 *
 * A run set below or above the line (0061) is drawn smaller and off its
 * line's baseline, so by its baseline alone it is a line of its own. A run
 * drawn exactly as the document says such a run prints -- at `SHIFTED_SIZE`
 * of a run beside it, its baseline that run's moved by `SHIFTED_RISE` of
 * that run's size -- is read into that run's line, and recorded there.
 */
export interface Line {
  /** Whitespace as `normalise` leaves it: one space between words. */
  readonly text: string
  readonly words: readonly string[]
  readonly top: number
  readonly bottom: number
  /** The runs read into the line as set below or above it, left to right: none on a line that holds none. */
  readonly shifted: readonly ShiftedRun[]
}

/** A run read into its line as set below or above it. */
export interface ShiftedRun {
  readonly text: string
  readonly shift: BaselineShift
  /** Its own size, as drawn, in points. */
  readonly size: number
  /** How far its baseline stands above its line's, in points: negative below it. */
  readonly rise: number
}

/**
 * Two runs are on one line when their baselines are closer than this
 * fraction of the smaller font size. Two lines of one column are at least a
 * font size apart, so they never merge; runs of different sizes on one
 * baseline differ by nothing.
 */
const SAME_LINE = 0.3

/**
 * A gap between two runs wider than this fraction of the font size is a word
 * space. A space is about a quarter of an em in Roboto and Helvetica, and a
 * kerning adjustment at a join between runs is under a tenth.
 */
const WORD_GAP = 0.15

/**
 * How far, in points, a run's size and its baseline's move may stand from
 * what the document states and still be read as set below or above the
 * line. PDF.js read both back within a millionth of a point of what pdfmake
 * drew, in Roboto and Liberation Serif at 9, 10 and 13 points (15 November
 * 2026); the nearest other geometry, the least move a report sets at the
 * least size it prints (0.203 of `MIN_FONT_SIZE`'s 4 points), is 0.81
 * points away.
 */
export const SHIFT_TOLERANCE = 0.01

/**
 * How far from the run beside it, as a fraction of that run's size, a run
 * set below or above the line may start or end and still be read as its:
 * one no-break space, which a footnote's mark is written with, is 0.248 em
 * in Roboto and 0.25 in Liberation Serif, read from their PDFs on 15
 * November 2026. The renderer prints such a run only inside a word that
 * holds text on the line (`shifted.ts`), so none stands farther from the
 * nearest run of its word: the run on the line, or another run set off it
 * that is read against that one, as a charge's after its count, SO₄²⁻.
 */
const JOIN_GAP = 0.3

/**
 * The page's lines, top to bottom, and after them each run that does not
 * read across the page as a line of its own: a caption up the side of a
 * code shares no baseline with the text beside it.
 */
export function pageLines(page: PdfPage): Line[] {
  const across = page.items.filter((item) => item.angle === 0)
  const joined = joins(across)
  const byBaseline = across.filter((item) => !joined.has(item)).sort((a, b) => baselineOf(a) - baselineOf(b) || a.x - b.x)
  const lines: PdfTextItem[][] = []
  const lineOf = new Map<PdfTextItem, PdfTextItem[]>()
  for (const item of byBaseline) {
    const current = lines.at(-1)
    const first = current?.[0]
    if (current !== undefined && first !== undefined && Math.abs(baselineOf(item) - baselineOf(first)) < SAME_LINE * Math.min(item.height, first.height)) {
      current.push(item)
    } else {
      lines.push([item])
    }
    lineOf.set(item, lines.at(-1)!)
  }
  for (const [item, { beside }] of joined) lineOf.get(beside)!.push(item)
  return [...lines, ...page.items.filter((item) => item.angle !== 0).map((item) => [item])].map((items) => line(items, joined))
}

/** A run read as set below or above the line: the run beside it on the line, and which way it was set. */
interface Join {
  readonly beside: PdfTextItem
  readonly shift: BaselineShift
}

/**
 * Each run drawn as a run set below or above the line beside another: at
 * `SHIFTED_SIZE` of that run's size, its baseline moved by `SHIFTED_RISE`,
 * and no farther from it than `JOIN_GAP`, the nearest such run if there are
 * two, as a lowered digit has between two letters. Only a run that is not
 * itself read so stands on its line for another. Then a run beside one read
 * so -- a charge after its count, SO₄²⁻ -- is read against the run on the
 * line that one was, at its size and its move, and no farther from its
 * neighbour than `JOIN_GAP` of it, until no run is added. Only a run of a
 * size that `SHIFTED_SIZE` of another on the page makes is looked at, so a
 * page of one size is read as it was, at no cost.
 */
function joins(across: readonly PdfTextItem[]): Map<PdfTextItem, Join> {
  const sizes = [...new Set(across.map((item) => item.height))]
  const small = across.filter((item) => sizes.some((size) => Math.abs(item.height - SHIFTED_SIZE * size) <= SHIFT_TOLERANCE))
  const found = new Map<PdfTextItem, Join & { readonly gap: number }>()
  for (const item of small) {
    for (const beside of across) {
      if (beside === item) continue
      const join = joinOf(item, beside, beside)
      const known = found.get(item)
      if (join !== undefined && (known === undefined || join.gap < known.gap)) found.set(item, join)
    }
  }
  const joined = new Map<PdfTextItem, Join>([...found].filter(([, { beside }]) => !found.has(beside)))
  for (let added = true; added;) {
    added = false
    for (const item of small) {
      if (joined.has(item)) continue
      for (const [neighbour, { beside }] of joined) {
        const join = joinOf(item, neighbour, beside)
        if (join === undefined) continue
        joined.set(item, join)
        added = true
        break
      }
    }
  }
  return joined
}

/**
 * `item` read as set below or above the line of `beside`, standing within
 * `JOIN_GAP` of `neighbour` -- `beside` itself, or a run already read
 * against it: at `SHIFTED_SIZE` of `beside`'s size and its baseline moved
 * by `SHIFTED_RISE` of it. Undefined where it is drawn otherwise.
 */
function joinOf(item: PdfTextItem, neighbour: PdfTextItem, beside: PdfTextItem): (Join & { readonly gap: number }) | undefined {
  if (Math.abs(item.height - SHIFTED_SIZE * beside.height) > SHIFT_TOLERANCE) return undefined
  const gap = Math.abs(Math.max(item.x - (neighbour.x + neighbour.width), neighbour.x - (item.x + item.width)))
  if (gap > JOIN_GAP * beside.height) return undefined
  const rise = baselineOf(beside) - baselineOf(item)
  const shift = BASELINE_SHIFTS.find((each) => Math.abs(rise - SHIFTED_RISE[each] * beside.height) <= SHIFT_TOLERANCE)
  return shift === undefined ? undefined : { beside, shift, gap }
}

function line(items: PdfTextItem[], joined: ReadonlyMap<PdfTextItem, Join>): Line {
  const ordered = items.sort((a, b) => a.x - b.x)
  let joinedText = ''
  ordered.forEach((item, index) => {
    const before = ordered[index - 1]
    const gap = before === undefined ? 0 : item.x - (before.x + before.width)
    joinedText += (before !== undefined && gap > WORD_GAP * Math.min(item.height, before.height) ? ' ' : '') + item.text
  })
  const text = normalise(joinedText)
  const shifted = ordered.flatMap((item): ShiftedRun[] => {
    const join = joined.get(item)
    return join === undefined ? [] : [{ text: item.text, shift: join.shift, size: item.height, rise: baselineOf(join.beside) - baselineOf(item) }]
  })
  return {
    text,
    words: text === '' ? [] : text.split(' '),
    top: Math.min(...ordered.map((item) => item.top)),
    bottom: Math.max(...ordered.map((item) => item.bottom)),
    shifted,
  }
}

/** Whether `text` is on the line as whole words: `0.00` is not found in `10.00`. */
export function lineHas(line: Line, text: string): boolean {
  return ` ${line.text} `.includes(` ${normalise(text)} `)
}
