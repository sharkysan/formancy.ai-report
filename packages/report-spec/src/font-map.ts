/**
 * How a report maps its three font tokens to the fonts a host approved
 * (0043). A print style names a token -- `sans`, `serif` or `mono`
 * ([styles.ts](styles.js)) -- and this says which approved font assets each
 * token prints in, face by face. A token a report leaves unmapped prints in
 * the renderer's own face, as it did before a report could name a host's
 * font: `sans` is the renderer's Roboto, and `serif` and `mono` are refused
 * at print, exactly as today.
 *
 * A face is an approved asset, named by id and pinned by digest in
 * `assets`, whose media type is a font's (`FONT_MEDIA_TYPES`); the host's
 * lookup hands over its bytes, which report-spec's `readFont` reads and the
 * renderer embeds (0040). The mapping is part of the definition, so the
 * report's hash covers which font a token prints in: a firm swaps its
 * typeface as it swaps its logo, with a new digest and a new template
 * version, and "the same report renders the same PDF" survives (0007).
 *
 * Nothing here holds a font's bytes: a face is a reference, resolved by the
 * deployment, as every asset is.
 */
import type { FontFamily } from './styles.js'

/**
 * The faces of one family a report may map, as pdfmake draws text in each
 * weight and slant: `normal` always, and `bold`, `italic` and `boldItalic`
 * where the report prints text in them. A face is never synthesised from
 * another -- pdfmake's own faux bold and oblique are a substitution nobody
 * sees until the PDF is read (plan 20) -- so a report that prints bold text
 * in a mapped family maps that family's bold face, or the renderer refuses
 * it.
 */
export const FONT_FACE_KEYS = ['normal', 'bold', 'italic', 'boldItalic'] as const
export type FontFaceKey = (typeof FONT_FACE_KEYS)[number]

/** The approved font assets a family's faces print in, each named by its asset id; `normal` is required, the rest are mapped where the report prints them. */
export interface FontFaces {
  readonly normal: string
  readonly bold?: string
  readonly italic?: string
  readonly boldItalic?: string
}

/** A report's font map: the token-to-faces mapping for whichever of the three families it maps. Absent, or a token left out, the renderer prints that token in its own face. */
export type FontMap = { readonly [F in FontFamily]?: FontFaces }

/** The face a run of text in this weight and slant prints in. */
export function faceKey(bold: boolean, italic: boolean): FontFaceKey {
  return bold ? (italic ? 'boldItalic' : 'bold') : italic ? 'italic' : 'normal'
}
