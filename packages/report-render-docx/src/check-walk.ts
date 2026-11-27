import { RenderRefusal, type Image, type QrSymbol, type TextStyle } from '@formancy/report-runtime'
import type { Code } from './codes.js'
import type { DocxFonts } from './fonts.js'
import { MAX_DOCX_CHARACTERS, MAX_DOCX_FAMILY_LENGTH, MAX_DOCX_PARAGRAPHS, MAX_DOCX_RUNS } from './limits.js'
import type { Page } from './page.js'

/**
 * What the walk of a document's blocks (`check.ts`) carries from one
 * block to the next, and the writer's own bounds it holds the file to as
 * it counts (0068). It carries the fonts and the page every block is
 * held to; the images it met, whose assets are read once every block has
 * been walked (`check-pictures.ts`); and every code's symbol, the codes
 * met and their modules, and the charts met and their points, which
 * `codes.ts` and `chart-check.ts` hold to the file's bounds on them. It
 * counts the paragraphs, the characters and the runs the file would
 * hold, each refused as `content-too-large` where the count crosses its
 * bound (`limits.ts`), naming the block it crossed at, before a byte of
 * the file is written; and it holds a block of a fixed height to the
 * printable area, since no page of a Word file holds a taller one.
 *
 * It changes when the writer counts something more of a file, or states
 * a bound otherwise. What a block is refused by, and how much of the file
 * it is, is the check of that block (`check.ts`, `check-table.ts`).
 */

export interface Walk {
  readonly fonts: DocxFonts
  readonly page: Page
  /** Every image, in the order the walk met it: its asset is read once every block has been walked (`readPictures`). */
  readonly images: Image[]
  /**
   * Every code's symbol, by its block; how often a code was met, which
   * is as often as a block of one stands, the same block among them;
   * and the modules their symbols have between them.
   */
  readonly codes: Map<Code, QrSymbol>
  met: number
  modules: number
  /** The charts met that are parts of the file, and the points they hold between them. */
  charts: number
  points: number
  paragraphs: number
  characters: number
  runs: number
  /** Of the characters, those that are no text: what the fonts' families are written longer than the bounds allow for (`family`). */
  families: number
}

/**
 * So many paragraphs, characters and runs of text more, refused past any
 * bound, naming where the count crossed it. A block that writes no run
 * of text, a spacer or a picture, counts none. A line ending in a text
 * is a run more: it is written as a break and what follows it as a `w:t`
 * of its own (`wml.ts`), far more than the character it is. Every one a
 * text holds is counted, the one that ends a paragraph's or a cell's text
 * among them, which is written as nothing, as an empty run is counted.
 */
export function count(walk: Walk, paragraphs: number, characters: number, subject: string, runs = 0): void {
  walk.paragraphs += paragraphs
  walk.characters += characters
  walk.runs += runs
  if (walk.paragraphs > MAX_DOCX_PARAGRAPHS)
    throw new RenderRefusal(
      'content-too-large',
      `the report holds more than ${MAX_DOCX_PARAGRAPHS} paragraphs, a table's cell being one and a rectangle or a section's frame two; a Word file holds no more`,
      subject,
    )
  if (walk.characters > MAX_DOCX_CHARACTERS) {
    const families =
      walk.families === 0
        ? ''
        : `, ${walk.families} of them what a font's family is written past ${MAX_DOCX_FAMILY_LENGTH} characters in every run and paragraph that names it`
    throw new RenderRefusal(
      'content-too-large',
      `the report's text is more than ${MAX_DOCX_CHARACTERS} characters long${families}; a Word file holds no more`,
      subject,
    )
  }
  if (walk.runs > MAX_DOCX_RUNS)
    throw new RenderRefusal(
      'content-too-large',
      `the report's text is held in more than ${MAX_DOCX_RUNS} runs, a page field being three, a table's cell one and each line ending in a text one more; a Word file holds no more`,
      subject,
    )
}

/**
 * The characters `times` runs and paragraph marks of `token` are written
 * longer than the bounds allow for: each states its family in four font
 * slots, and one whose name is written longer than it may be named
 * (`DocxFonts.longer`) is that much more of the file each time. Counted
 * with the text's characters, by whoever counts those.
 */
export function family(walk: Walk, token: TextStyle['font'], times: number): number {
  const more = walk.fonts.longer(token) * times
  walk.families += more
  return more
}

/** Something of a fixed height: taller than the printable area, no page of a Word file holds it. */
export function tall(height: number, what: string, subject: string, walk: Walk): void {
  if (height > walk.page.height)
    throw new RenderRefusal('content-too-large', `${what} is ${height} pt tall; the printable area is ${walk.page.height.toFixed(2)} pt`, subject)
}
