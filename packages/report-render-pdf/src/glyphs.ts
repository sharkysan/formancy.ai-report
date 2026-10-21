/**
 * Which characters the renderer can draw: those the faces it embeds map to
 * a glyph, read from each face's own character map.
 *
 * pdfmake, through fontkit, draws a character its font has no glyph for as
 * glyph 0 -- an empty box, or nothing -- and writes U+0000 to the text
 * layer, so the text is lost on the page and in a search alike, and the
 * render still succeeds: 'Customer: 山田太郎 様' printed as 'Customer: '
 * and a run of empty boxes. So every character a document prints is held to
 * the face it prints in before anything is laid out, and one the face has
 * no glyph for is refused as `unsupported`, naming the block and the
 * character. Fallback fonts, which would draw it, are plan section 19's,
 * and not built.
 *
 * The maps are read from the very bytes pdfmake embeds -- the font files in
 * Node, the virtual files in a browser -- so they cannot drift from the
 * fonts, and by report-spec's reader, through the runtime, which reads the
 * subtable fontkit lays text out with, in format 4 or 12 (0040): the one
 * reader of a font's glyphs, which a host's font will be read by too.
 * Roboto 3.014 maps the Basic Multilingual Plane only, in a format 4
 * subtable; a character past it, an emoji among them, has no glyph here.
 */
import { characterMap as readCharacterMap } from '@formancy/report-runtime'

/** pdfmake's names for a family's four faces. */
export type Face = 'normal' | 'bold' | 'italics' | 'bolditalics'

/** The characters each face has a glyph for, by code point. */
export type Glyphs = Readonly<Record<Face, ReadonlySet<number>>>

/** The two faces of Liberation Sans a QR-bill's slip prints in (`style.ts`): its values, and its titles and headings. */
export type BillFace = 'normal' | 'bold'

/** The characters each of them has a glyph for. */
export type BillGlyphs = Readonly<Record<BillFace, ReadonlySet<number>>>

/** The face text in this weight and slant prints in. */
export function faceOf(bold: boolean, italic: boolean): Face {
  return bold ? (italic ? 'bolditalics' : 'bold') : italic ? 'italics' : 'normal'
}

/** A line break: pdfmake breaks the line there and draws nothing for it. */
const LINE_BREAKS: ReadonlySet<number> = new Set([0x0a, 0x0d])

/** The first character of `text` that `face` has no glyph for, as its code point; undefined when it has a glyph for every one. */
export function missingGlyph(text: string, face: ReadonlySet<number>): number | undefined {
  for (const character of text) {
    const point = character.codePointAt(0) as number
    if (!face.has(point) && !LINE_BREAKS.has(point)) return point
  }
  return undefined
}

/** A code point as Unicode writes it: U+5C71. */
export function codePoint(point: number): string {
  return `U+${point.toString(16).toUpperCase().padStart(4, '0')}`
}

/**
 * The code points a font this renderer embeds maps to a glyph other than
 * glyph 0, as report-spec's `characterMap` reads them. A face the reader
 * refuses -- no character map, none in Unicode in format 4 or 12, one
 * broken -- is not one this renderer embeds, and is an error, not a
 * document's refusal.
 */
export function characterMap(font: Uint8Array): ReadonlySet<number> {
  const read = readCharacterMap(font)
  if (!read.ok) throw new Error(`the font ${read.message}`)
  return read.characters
}
