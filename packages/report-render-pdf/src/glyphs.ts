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
 * fonts. Roboto 3.014 maps the Basic Multilingual Plane only, in a format 4
 * subtable; a character past it, an emoji among them, has no glyph here.
 */

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
 * The code points a TrueType font maps to a glyph other than glyph 0, from
 * its Unicode BMP character map: the Windows (3, 1) or Unicode (0, 3)
 * subtable, in format 4. A font without one is not one this renderer
 * embeds, and is an error, not a document's refusal.
 */
export function characterMap(font: Uint8Array): ReadonlySet<number> {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength)
  const tables = view.getUint16(4)
  let cmap: number | undefined
  for (let index = 0; index < tables; index++) {
    const record = 12 + 16 * index
    if (String.fromCharCode(...font.subarray(record, record + 4)) === 'cmap') cmap = view.getUint32(record + 8)
  }
  if (cmap === undefined) throw new Error('the font has no character map')
  const encodings = view.getUint16(cmap + 2)
  for (let index = 0; index < encodings; index++) {
    const record = cmap + 4 + 8 * index
    const [platform, encoding] = [view.getUint16(record), view.getUint16(record + 2)]
    const subtable = cmap + view.getUint32(record + 4)
    const unicode = (platform === 3 && encoding === 1) || (platform === 0 && encoding === 3)
    if (unicode && view.getUint16(subtable) === 4) return format4(view, subtable)
  }
  throw new Error('the font has no Unicode character map in format 4')
}

/** A format 4 subtable's segments, each mapping a range of code points by a delta or through the glyph array; glyph 0 is no glyph. */
function format4(view: DataView, table: number): ReadonlySet<number> {
  const segments = view.getUint16(table + 6) / 2
  const ends = table + 14
  const starts = ends + 2 * segments + 2
  const deltas = starts + 2 * segments
  const offsets = deltas + 2 * segments
  const mapped = new Set<number>()
  for (let segment = 0; segment < segments; segment++) {
    const end = view.getUint16(ends + 2 * segment)
    const start = view.getUint16(starts + 2 * segment)
    const delta = view.getUint16(deltas + 2 * segment)
    const offsetAt = offsets + 2 * segment
    const offset = view.getUint16(offsetAt)
    for (let point = start; point <= end; point++) {
      const indexed = offset === 0 ? point : view.getUint16(offsetAt + offset + 2 * (point - start))
      const glyph = offset !== 0 && indexed === 0 ? 0 : (indexed + delta) & 0xffff
      if (glyph !== 0) mapped.add(point)
    }
  }
  return mapped
}
