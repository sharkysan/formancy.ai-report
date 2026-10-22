/**
 * A host face's layout tables, removed before the renderer embeds it
 * (0043), closing the risk 0040 left open.
 *
 * report-spec's `readFont` says whether a font may be embedded and which
 * characters it draws, but it does not read the layout tables fontkit runs
 * at print: GSUB, GPOS, kern and the AAT `morx` state machine. PDFKit lays
 * every run out with fontkit before it subsets, and a crafted one can make
 * that run never end -- a `morx` table of one state whose one entry does not
 * advance held a render's thread past twenty seconds on 22 October 2026
 * (0040), and a render pass cannot be interrupted (0011). So before a host
 * face is embedded, the records for the tables fontkit's layout reads are
 * removed from the font's table directory, by setting each one's recorded
 * length to zero: fontkit sees a table only where its recorded length is
 * not zero (`TTFFont`), so with them zeroed it builds no advanced layout
 * engine and runs no kern processor, and `font.layout` falls back to the
 * one-glyph-per-code-point mapping and unicode positioning, which is
 * bounded by the text's length.
 *
 * What it loses: ligatures, kerning, and the contextual and complex shaping
 * those tables drive -- exactly what the scripts this release refuses
 * (right-to-left, Indic, Thai, CJK) would need, and nothing the Latin,
 * Greek and Cyrillic text a host face prints does. PDFKit always subsets
 * from the outlines and never embeds a layout table, so the embedded font
 * is unchanged by the removal; only what fontkit does while measuring is.
 *
 * Nothing else is touched: the table data stays where it is, every other
 * record keeps its offset and length, and the count of tables is unchanged,
 * so the glyph outlines, the character map and the metrics the renderer and
 * fontkit read are exactly the font's own. A host face of the very bytes of
 * one of the renderer's own faces is not stripped: it is that face, which
 * fontkit lays out with its tables in every render, and PDFKit draws the two
 * as one (`face-identity.ts`).
 */

/** The tables fontkit's layout engine reads, each the reason it would run: an advanced engine (OpenType or AAT), its mark and class data, or the kern processor. */
export const LAYOUT_TABLES: readonly string[] = ['GSUB', 'GPOS', 'GDEF', 'kern', 'morx']

/** A table tag's four bytes, as the directory holds them. */
function tagAt(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!)
}

/**
 * `bytes` with the layout tables' directory records' lengths zeroed, so
 * fontkit sees none of them; a copy, leaving the font the report pinned
 * untouched. Returns the bytes unchanged when the file is too short to hold
 * a table directory -- `readFont` has already accepted it, so this only
 * guards the read, never judges the font.
 */
export function withoutLayoutTables(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 12) return bytes
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tables = view.getUint16(4)
  if (bytes.length < 12 + 16 * tables) return bytes
  const stripped = Uint8Array.from(bytes)
  const out = new DataView(stripped.buffer)
  for (let index = 0; index < tables; index += 1) {
    const record = 12 + 16 * index
    if (LAYOUT_TABLES.includes(tagAt(stripped, record))) out.setUint32(record + 12, 0)
  }
  return stripped
}
