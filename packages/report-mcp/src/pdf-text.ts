/**
 * A PDF's text, page by page, as the lines a reader sees: the PDF read
 * back with PDF.js at the corpus's pin, its runs joined into lines by the
 * rule the corpus's `pageLines` reads a page by (0089, after 0003).
 *
 * One rule, written twice: the corpus is test support and never
 * published, so the reader an agent's render check reads with is written
 * again here, and `pdf-text.test.ts` holds the two readings equal on every
 * starter's PDF. Runs on one baseline make one line, read left to right, a
 * gap wider than a word's a space; lines are read top to bottom; a run set
 * below or above the line, as the runtime's document states such a run
 * prints, is read into the line it stands beside (0061); and a run turned
 * off the horizontal is a line of its own, after the others. The box a run
 * is given is the corpus's, computed the same way to the last operation,
 * so that two runs a hair apart are ordered here as there.
 *
 * PDF.js is loaded with the defaults that fetch nothing and read no file:
 * no standard font, CMap, ICC profile or decoder by address, since none is
 * given, so the fonts and the profile pdfjs-dist ships are never read; no
 * font face made of the PDF's, no system font. In Node its worker runs in
 * this thread, its own module imported from its package, and
 * `getTextContent` decodes no image and runs no script: the sandbox that
 * would run a PDF's JavaScript is a module of pdfjs-dist this imports
 * nowhere.
 */
import { BASELINE_SHIFTS, SHIFTED_RISE, SHIFTED_SIZE } from '@formancy/report-runtime'
import type { BaselineShift } from '@formancy/report-runtime'
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PageViewport, PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js'

/** One run of text as PDF.js extracts it, with the corpus's box: from a fifth of its size below its baseline to the rest of it above, turned as the run is. */
interface Run {
  readonly text: string
  readonly x: number
  readonly top: number
  readonly bottom: number
  readonly width: number
  readonly height: number
  /** Which way its baseline runs, in degrees counter-clockwise from the page's x-axis, to the hundredth: 0 across the page. */
  readonly angle: number
}

/** How far below the baseline a run's box reaches, as a fraction of its size: the corpus's `DESCENT`. */
const DESCENT = 0.2
/** Two runs are on one line when their baselines are closer than this fraction of the smaller size: the corpus's `SAME_LINE`. */
const SAME_LINE = 0.3
/** A gap between two runs wider than this fraction of the size is a word space: the corpus's `WORD_GAP`. */
const WORD_GAP = 0.15
/** How far a run's size and its baseline's move may stand from what the document states and still be read as set off the line, in points: the corpus's `SHIFT_TOLERANCE`. */
const SHIFT_TOLERANCE = 0.01
/** How far from the run beside it, as a fraction of that run's size, a run set off the line may stand and still be read as its: the corpus's `JOIN_GAP`. */
const JOIN_GAP = 0.3

/**
 * The text of the PDF `bytes` are, as each page's lines, top to bottom;
 * rejects when they are no PDF PDF.js reads. The bytes are copied, since
 * PDF.js takes the buffer it is given.
 */
export async function pdfLines(bytes: Uint8Array): Promise<string[][]> {
  // PDF.js 6 has no `isEvalSupported`: it compiles no PDF function to JavaScript, so there is nothing to switch off.
  const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false, verbosity: VerbosityLevel.ERRORS })
  try {
    const document = await task.promise
    const pages: string[][] = []
    for (let number = 1; number <= document.numPages; number++) pages.push(linesOf(await runsOf(await document.getPage(number))))
    return pages
  } finally {
    await task.destroy()
  }
}

/** A page's runs, in the order its content draws them, without those that are only white space. */
async function runsOf(page: PDFPageProxy): Promise<Run[]> {
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  const runs: Run[] = []
  for (const item of content.items) {
    if (!('str' in item) || item.str.trim() === '') continue
    runs.push(runOf(item, viewport))
  }
  return runs
}

/** A run's box, as the corpus's `textBox` computes it: its corners turned as the run is, and the box on the page that holds them. */
function runOf(item: TextItem, viewport: PageViewport): Run {
  const [a, b, c, d, e, f] = item.transform as [number, number, number, number, number, number]
  const size = Math.hypot(c, d)
  const angle = Math.round((Math.atan2(b, a) * 18000) / Math.PI) / 100
  const [cos, sin] = [Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180)]
  const corners = [0, item.width].flatMap((along) =>
    [-DESCENT * size, (1 - DESCENT) * size].map(
      (up) => viewport.convertToViewportPoint(e + along * cos - up * sin, f + along * sin + up * cos) as [number, number],
    ),
  )
  const [x, top] = [Math.min(...corners.map(([across]) => across)), Math.min(...corners.map(([, down]) => down))]
  const [width, height] = [Math.abs(item.width * cos) + Math.abs(size * sin), Math.abs(item.width * sin) + Math.abs(size * cos)]
  return { text: item.str, x, top, bottom: top + height, width, height, angle }
}

/** The baseline a run sits on, in points from the top of the page. */
const baselineOf = (run: Run): number => run.bottom - DESCENT * run.height

/** A page's lines, top to bottom, and after them each run that does not read across the page, as a line of its own. */
function linesOf(runs: readonly Run[]): string[] {
  const across = runs.filter((run) => run.angle === 0)
  const joined = joins(across)
  const byBaseline = across.filter((run) => !joined.has(run)).sort((a, b) => baselineOf(a) - baselineOf(b) || a.x - b.x)
  const lines: Run[][] = []
  const lineOf = new Map<Run, Run[]>()
  for (const run of byBaseline) {
    const current = lines.at(-1)
    const first = current?.[0]
    if (current !== undefined && first !== undefined && Math.abs(baselineOf(run) - baselineOf(first)) < SAME_LINE * Math.min(run.height, first.height)) {
      current.push(run)
    } else {
      lines.push([run])
    }
    lineOf.set(run, lines.at(-1)!)
  }
  for (const [run, { beside }] of joined) lineOf.get(beside)!.push(run)
  return [...lines, ...runs.filter((run) => run.angle !== 0).map((run) => [run])].map(textOf)
}

/** A run read as set below or above the line: the run beside it on the line, and which way it was set. */
interface Join {
  readonly beside: Run
  readonly shift: BaselineShift
}

/**
 * Each run drawn as a run set below or above the line beside another, as
 * the corpus's `joins` finds it: at `SHIFTED_SIZE` of that run's size, its
 * baseline moved by `SHIFTED_RISE`, no farther from it than `JOIN_GAP`,
 * the nearest if there are two; only a run not itself read so stands on
 * its line for another; then a run beside one read so is read against the
 * run on the line that one was, until no run is added.
 */
function joins(across: readonly Run[]): Map<Run, Join> {
  const sizes = [...new Set(across.map((run) => run.height))]
  const small = across.filter((run) => sizes.some((size) => Math.abs(run.height - SHIFTED_SIZE * size) <= SHIFT_TOLERANCE))
  const found = new Map<Run, Join & { readonly gap: number }>()
  for (const run of small) {
    for (const beside of across) {
      if (beside === run) continue
      const join = joinOf(run, beside, beside)
      const known = found.get(run)
      if (join !== undefined && (known === undefined || join.gap < known.gap)) found.set(run, join)
    }
  }
  const joined = new Map<Run, Join>([...found].filter(([, { beside }]) => !found.has(beside)))
  for (let added = true; added;) {
    added = false
    for (const run of small) {
      if (joined.has(run)) continue
      for (const [neighbour, { beside }] of joined) {
        const join = joinOf(run, neighbour, beside)
        if (join === undefined) continue
        joined.set(run, join)
        added = true
        break
      }
    }
  }
  return joined
}

/** `run` read as set off the line of `beside`, standing within `JOIN_GAP` of `neighbour`; undefined where it is drawn otherwise. */
function joinOf(run: Run, neighbour: Run, beside: Run): (Join & { readonly gap: number }) | undefined {
  if (Math.abs(run.height - SHIFTED_SIZE * beside.height) > SHIFT_TOLERANCE) return undefined
  const gap = Math.abs(Math.max(run.x - (neighbour.x + neighbour.width), neighbour.x - (run.x + run.width)))
  if (gap > JOIN_GAP * beside.height) return undefined
  const rise = baselineOf(beside) - baselineOf(run)
  const shift = BASELINE_SHIFTS.find((each) => Math.abs(rise - SHIFTED_RISE[each] * beside.height) <= SHIFT_TOLERANCE)
  return shift === undefined ? undefined : { beside, shift, gap }
}

/** A line's text: its runs left to right, a space where the gap between two is wider than a word's, white space as one space. */
function textOf(runs: Run[]): string {
  const ordered = runs.sort((a, b) => a.x - b.x)
  let text = ''
  ordered.forEach((run, index) => {
    const before = ordered[index - 1]
    const gap = before === undefined ? 0 : run.x - (before.x + before.width)
    text += (before !== undefined && gap > WORD_GAP * Math.min(run.height, before.height) ? ' ' : '') + run.text
  })
  return text.replace(/\s+/g, ' ').trim()
}
