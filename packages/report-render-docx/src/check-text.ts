import { MAX_FONT_SIZE, MIN_FONT_SIZE, refusedCharacter, RenderRefusal, type TextStyle } from '@formancy/report-runtime'
import type { DocxFonts, FaceWanted } from './fonts.js'
import { xmlCharacter } from './xml.js'

/**
 * Text and its style, held to what a Word file prints before anything is
 * written (0068).
 *
 * Text is held to being a string; to the characters a report prints,
 * report-spec's `refusedCharacter`, the rule its PDF is held to; to what
 * an XML document holds and Word prints as text -- a control character
 * other than a line feed and a carriage return, which end a line, the
 * line and paragraph separators U+2028 and U+2029, U+FFFE, U+FFFF and
 * half a surrogate pair are refused, naming the block and the code
 * point; and to the face it prints in, where the report maps it and its
 * characters are known. A control character is one of Unicode's
 * General_Category Cc, U+0000 to U+001F and U+007F to U+009F: a tab among
 * them, which the PDF's own face has no glyph for.
 *
 * A style is held to the contract every engine holds a document to: a
 * font token the report maps or sans, the format's sizes, an alignment
 * and a colour of the document's kinds.
 */

/** A code point as Unicode writes it: U+5C71. */
export const codePoint = (point: number): string => `U+${point.toString(16).toUpperCase().padStart(4, '0')}`

/** A line break: Word's `w:br`, and the end of a line in the PDF. */
const LINE_BREAKS: ReadonlySet<number> = new Set([0x0a, 0x0d])

/** Why a Word file does not print `point` as text, or undefined where it does. */
function unwritable(point: number): string | undefined {
  if (LINE_BREAKS.has(point)) return undefined
  if (point <= 0x1f || (point >= 0x7f && point <= 0x9f)) return 'a control character, which no line of a Word file prints'
  if (point === 0x2028 || point === 0x2029) return 'a line or paragraph separator, which Word may break at where the PDF does not'
  if (!xmlCharacter(point)) return 'which no XML document holds'
  return undefined
}

export function checkText(text: unknown, wanted: FaceWanted, fonts: DocxFonts, at: string, subject = at): void {
  if (typeof text !== 'string') throw new RenderRefusal('unsupported', `${at} prints something that is not text`, subject)
  const face = fonts.glyphs(wanted, subject)
  for (const character of text) {
    const point = character.codePointAt(0)!
    const refused = refusedCharacter(point)
    if (refused === 'script')
      throw new RenderRefusal(
        'unsupported',
        `${at} prints ${codePoint(point)}, which is in no script a report prints: it prints Latin, Greek and Cyrillic, with the punctuation, symbols and marks written with them`,
        subject,
      )
    if (refused === 'bidi-control')
      throw new RenderRefusal('unsupported', `${at} prints ${codePoint(point)}, a bidirectional control, which a report does not print`, subject)
    const why = unwritable(point)
    if (why !== undefined) throw new RenderRefusal('unsupported', `${at} prints ${codePoint(point)}, ${why}`, subject)
    if (face.characters !== undefined && !face.characters.has(point) && !LINE_BREAKS.has(point))
      throw new RenderRefusal(
        'unsupported',
        `${at} prints ${codePoint(point)}, which ${face.name} has no glyph for: Word would draw it in a face of its own choosing, and the PDF prints none`,
        subject,
      )
  }
}

/** A string that is written and never printed in a face -- the title -- held to being text an XML document holds, naming `subject` and never quoting it. */
export function checkWritten(text: unknown, what: string, subject: string): asserts text is string {
  if (typeof text !== 'string') throw new RenderRefusal('unsupported', `${what} is not text`, subject)
  for (const character of text) {
    const point = character.codePointAt(0)!
    if (!xmlCharacter(point)) throw new RenderRefusal('unsupported', `${what} holds ${codePoint(point)}, which no XML document holds`, subject)
  }
}

/** A colour as the document writes one: `#` and six lower-case hex digits. */
const COLOR = /^#[0-9a-f]{6}$/

export function checkColor(color: unknown, at: string, subject = at): void {
  if (color !== undefined && !(typeof color === 'string' && COLOR.test(color)))
    throw new RenderRefusal(
      'unsupported',
      `${at} names the colour '${typeof color === 'string' ? color : typeof color}', which is not #rrggbb in lower case`,
      subject,
    )
}

/** `style`, which the text `at` prints in, held to what a document's style may be: refused naming `subject`, the block or the table it is. */
export function checkStyle(style: TextStyle | undefined, at: string, fonts: DocxFonts, subject = at): void {
  if (style === undefined) return
  if (style.font !== undefined && !((style.font === 'sans' || style.font === 'serif' || style.font === 'mono') && fonts.usable(style.font))) {
    throw new RenderRefusal(
      'unsupported',
      `${at} is set in the ${String(style.font)} font, which the report maps to no host font; a Word file names Roboto alone, as the sans font, and no other in its place`,
      subject,
    )
  }
  if (style.size !== undefined && !(style.size >= MIN_FONT_SIZE && style.size <= MAX_FONT_SIZE))
    throw new RenderRefusal('unsupported', `${at} is set at ${style.size} pt; a report's text is ${MIN_FONT_SIZE} to ${MAX_FONT_SIZE} pt`, subject)
  if (style.align !== undefined && style.align !== 'left' && style.align !== 'center' && style.align !== 'right')
    throw new RenderRefusal('unsupported', `${at} is aligned '${String(style.align)}'`, subject)
  checkColor(style.color, at, subject)
}
