import { MAX_FONT_SIZE, MIN_FONT_SIZE, refusedCharacter, RenderRefusal, type TextStyle } from '@formancy/report-runtime'
import { codePoint, missingGlyph } from './glyphs.js'
import type { FaceWanted, RenderFonts } from './host-fonts.js'
import { COLOR } from './style.js'
import type { Walk } from './check-walk.js'

/**
 * Text, held to being a string -- an array would reach pdfmake as inlines
 * carrying any property of its own, a link among them -- to the characters
 * a report prints (report-spec's `refusedCharacter`), and to the face it
 * prints in, which must have a glyph for each of them. The characters come
 * first: one outside Latin, Greek and Cyrillic and what is written with
 * them is refused even where the face maps it, since pdfmake reorders
 * nothing and the renderer shapes nothing (0043, FT-Q16).
 */
export function checkText(text: unknown, wanted: FaceWanted, walk: Walk, at: string, subject = at): void {
  if (typeof text !== 'string') throw new RenderRefusal('unsupported', `${at} prints something that is not text`, subject)
  for (const character of text) {
    const point = character.codePointAt(0) as number
    const refused = refusedCharacter(point)
    if (refused === 'script')
      throw new RenderRefusal(
        'unsupported',
        `${at} prints ${codePoint(point)}, which is in no script the renderer prints: it prints Latin, Greek and Cyrillic, with the punctuation, symbols and marks written with them, and lays out no right-to-left text, no shaped script and no CJK`,
        subject,
      )
    if (refused === 'bidi-control')
      throw new RenderRefusal(
        'unsupported',
        `${at} prints ${codePoint(point)}, a bidirectional control: pdfmake lays text out left to right alone, and would print it as a space`,
        subject,
      )
  }
  const face = walk.fonts.face(wanted.token, wanted.bold, wanted.italic, subject)
  const missing = missingGlyph(text, face.glyphs)
  if (missing !== undefined) {
    throw new RenderRefusal(
      'unsupported',
      `${at} prints ${codePoint(missing)}, which ${face.name} has no glyph for: it would print as an empty box, and as nothing in the PDF's text, and no other font is embedded`,
      subject,
    )
  }
}

/** `style`, which the text `at` prints in, held to what the renderer prints: refused naming `subject`, the block or the table it is. */
export function checkStyle(style: TextStyle | undefined, at: string, fonts: RenderFonts, subject = at): void {
  if (style === undefined) return
  // A font token the report maps, or sans, which is Roboto; serif and mono the report does not map are refused, as before a report could name a host font.
  if (style.font !== undefined && !((style.font === 'sans' || style.font === 'serif' || style.font === 'mono') && fonts.usable(style.font))) {
    throw new RenderRefusal(
      'unsupported',
      `${at} is set in the ${String(style.font)} font, which the report maps to no host font; the renderer embeds Roboto alone, as the sans font, and prints no other in its place`,
      subject,
    )
  }
  // The format's sizes, which a document the runtime resolved holds to: the page bound counts a line as its size, and 0.001 pt put 20,000 lines on one page.
  if (style.size !== undefined && !(style.size >= MIN_FONT_SIZE && style.size <= MAX_FONT_SIZE))
    throw new RenderRefusal('unsupported', `${at} is set at ${style.size} pt; a report's text is ${MIN_FONT_SIZE} to ${MAX_FONT_SIZE} pt`, subject)
  if (style.align !== undefined && style.align !== 'left' && style.align !== 'center' && style.align !== 'right')
    throw new RenderRefusal('unsupported', `${at} is aligned '${String(style.align)}'`, subject)
  checkColor(style.color, at, subject)
}

export function checkColor(color: string | undefined, at: string, subject = at): void {
  // pdfmake prints a colour it cannot read as black, without a word.
  if (color !== undefined && !COLOR.test(color))
    throw new RenderRefusal('unsupported', `${at} names the colour '${color}', which is not #rrggbb in lower case`, subject)
}
