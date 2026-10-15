import type { TextStyle } from '@formancy/report-runtime'

/**
 * A document's text styles as pdfmake's: the one place a font token becomes
 * a font, and a style becomes pdfmake's properties.
 *
 * **Fonts.** pdfmake ships one family, Roboto 3.014, under the SIL Open Font
 * License 1.1, which allows embedding in documents
 * ([0006](../../../docs/decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
 * `sans` is Roboto. `serif` and `mono` have no font here, and a report that
 * asks for one is refused as `unsupported` before anything is laid out
 * (`check.ts`): printing it in Roboto would be a substitution nobody sees
 * until the PDF is read, which plan section 20 rules out. Bold is Roboto
 * Medium, the heaviest face pdfmake ships, and italic its italic.
 */

/** pdfmake's name for the one family the renderer embeds. */
export const ROBOTO = 'Roboto'

/** The font each token prints in; a token without one is refused. */
export const FONTS: Readonly<Partial<Record<NonNullable<TextStyle['font']>, string>>> = { sans: ROBOTO }

/**
 * Roboto's line, as a multiple of the font size: its ascender less its
 * descender, 2400 of its 2048 units per em. pdfmake lays out a line exactly
 * this tall.
 */
export const LINE_FACTOR = 2400 / 2048

/** Text when a paragraph names no size. */
export const DEFAULT_SIZE = 10

/** A colour as the document writes one, and as pdfmake reads one: `#` and six lower-case hex digits. */
export const COLOR = /^#[0-9a-f]{6}$/

/** pdfmake's text properties for a style, the renderer's own defaults under it. Only what is set is written. */
export function textProperties(style: TextStyle, defaults: { readonly size: number; readonly bold?: boolean; readonly italic?: boolean }): Record<string, unknown> {
  const bold = style.bold ?? defaults.bold
  const italic = style.italic ?? defaults.italic
  return {
    fontSize: style.size ?? defaults.size,
    ...(style.font === undefined ? {} : { font: FONTS[style.font] }),
    ...(bold === undefined ? {} : { bold }),
    ...(italic === undefined ? {} : { italics: italic }),
    ...(style.color === undefined ? {} : { color: style.color }),
  }
}
