import { normalise } from './fixture.js'
import { baselineOf, type PdfPage, type PdfTextItem } from './read-pdf.js'

/**
 * A page's text as lines a reader sees, rebuilt from PDF.js's runs: runs on
 * one baseline make one line, read left to right, and lines are read top to
 * bottom. An engine is free to draw a line as one run or as one per word, and
 * the checks must not depend on which.
 */
export interface Line {
  /** Whitespace as `normalise` leaves it: one space between words. */
  readonly text: string
  readonly words: readonly string[]
  readonly top: number
  readonly bottom: number
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
 * The page's lines, top to bottom, and after them each run that does not
 * read across the page as a line of its own: a caption up the side of a
 * code shares no baseline with the text beside it.
 */
export function pageLines(page: PdfPage): Line[] {
  const across = page.items.filter((item) => item.angle === 0)
  const byBaseline = across.sort((a, b) => baselineOf(a) - baselineOf(b) || a.x - b.x)
  const lines: PdfTextItem[][] = []
  for (const item of byBaseline) {
    const current = lines.at(-1)
    const first = current?.[0]
    if (current !== undefined && first !== undefined && Math.abs(baselineOf(item) - baselineOf(first)) < SAME_LINE * Math.min(item.height, first.height)) {
      current.push(item)
    } else {
      lines.push([item])
    }
  }
  return [...lines, ...page.items.filter((item) => item.angle !== 0).map((item) => [item])].map(line)
}

function line(items: PdfTextItem[]): Line {
  const ordered = items.sort((a, b) => a.x - b.x)
  let joined = ''
  ordered.forEach((item, index) => {
    const before = ordered[index - 1]
    const gap = before === undefined ? 0 : item.x - (before.x + before.width)
    joined += (before !== undefined && gap > WORD_GAP * Math.min(item.height, before.height) ? ' ' : '') + item.text
  })
  const text = normalise(joined)
  return {
    text,
    words: text === '' ? [] : text.split(' '),
    top: Math.min(...ordered.map((item) => item.top)),
    bottom: Math.max(...ordered.map((item) => item.bottom)),
  }
}

/** Whether `text` is on the line as whole words: `0.00` is not found in `10.00`. */
export function lineHas(line: Line, text: string): boolean {
  return ` ${line.text} `.includes(` ${normalise(text)} `)
}
