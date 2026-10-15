import { RenderRefusal } from '@formancy/report-runtime'

/**
 * Words wider than where they stand, refused before pdfmake breaks them.
 *
 * pdfmake measures every word of a document before it lays out a line --
 * the widest unbreakable run of each text node is its `_minWidth` -- and
 * only then breaks the lines. A word wider than its line it breaks one line
 * at a time, measuring all that is left of the word for each: 16,384 W in a
 * 20pt table column took 42 seconds (measured on 2026-10-15, on an Intel
 * i9-10900K under Node 24.21). And a word broken anywhere can print as
 * something else: 'CHF 10,612,357.00' in an 85pt column printed
 * 'CHF 10,612,357.0' on one line and '0' on the next.
 *
 * So once pdfmake has measured the words and before it lays out the first
 * line -- from the function it calls for the first page's background --
 * every recorded text node's widest word is held to its room:
 * - **a table cell** to its column, less its padding: a word wider than
 *   that is refused, naming the table, the row and the column. A cell's
 *   value is often a number or an identifier, which no break may split.
 * - **a paragraph** to `MAX_WORD_LINES` lines of its width: a longer word,
 *   such as an identifier with no space in it, breaks across lines, as the
 *   corpus's `long-paragraph` fixture asks; one longer than that is
 *   refused, naming the block, before pdfmake breaks a line of it.
 *
 * `_minWidth` is pdfmake's own, not part of its API; `pdfmake.test.ts`
 * holds that 0.3.11 still writes it where the renderer reads it.
 */

/**
 * The most lines one word of a paragraph may be broken across. Chosen: the
 * corpus's 300-character identifier takes four lines of the page; sixteen
 * lines of the narrowest column a document can have stay a moment's work.
 */
export const MAX_WORD_LINES = 16

/** A text node pdfmake measures, and the room its widest word has. */
export interface WordRoom {
  /** The node as handed to pdfmake, which writes `_minWidth` onto it. */
  readonly node: object
  /** The width of one line, in points. */
  readonly width: number
  /** The lines its widest word may take: 1 for a table cell. */
  readonly lines: number
  /** Where it is, for a person: "row 3 of table lines, column 2". */
  readonly what: string
  readonly subject: string
}

/** How much wider than its room a word may measure and still be laid out unbroken: rounding, not layout. */
const SLACK = 0.001

/** Refuses the first text node whose widest word, as pdfmake measured it, is wider than its room. Nodes pdfmake has not measured are passed over. */
export function checkWords(rooms: readonly WordRoom[]): void {
  for (const { node, width, lines, what, subject } of rooms) {
    const widest = (node as { readonly _minWidth?: unknown })._minWidth
    if (typeof widest !== 'number' || widest <= width * lines + SLACK) continue
    const room = lines === 1 ? `its column holds ${width.toFixed(2)} pt` : `${lines} lines of its width are ${(width * lines).toFixed(2)} pt`
    throw new RenderRefusal('content-too-large', `a word of ${what} is ${widest.toFixed(2)} pt wide, and ${room}; a word is broken only in a paragraph, and across no more than ${MAX_WORD_LINES} lines`, subject)
  }
}
