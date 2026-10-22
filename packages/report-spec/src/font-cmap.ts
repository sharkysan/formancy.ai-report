/**
 * Which characters a font draws: the code points its character map maps
 * to a glyph other than glyph 0, read as fontkit, through which PDFKit lays
 * out every run, reads them (0040, extending 0011).
 *
 * pdfmake draws a character its font has no glyph for as glyph 0 and writes
 * U+0000 to the text layer, and the render succeeds (0011). So the renderer
 * holds every character a document prints to this map before anything is
 * laid out, and a character it does not hold is refused. That holds only
 * where this map is the one fontkit reads, so:
 *
 * - **The subtable is fontkit's.** fontkit 2.0.4 takes the first record of
 *   Windows full repertoire (3, 10), then Unicode (0, 6), (0, 4), Windows
 *   BMP (3, 1) and Unicode (0, 3), (0, 2), (0, 1), (0, 0), in that order,
 *   whatever their formats (`CmapProcessor`, `findSubtable`); a font with
 *   none it re-encodes from a legacy subtable, which this refuses.
 * - **Formats 4 and 12 alone**, the two the specification recommends for
 *   Unicode; the subtable fontkit takes in any other format is refused.
 * - **The search is fontkit's**, a binary search of segments or groups, so
 *   a subtable whose segments are not sorted and apart -- where a binary
 *   search and a walk would find different glyphs -- is refused, as is an
 *   idRangeOffset fontkit would read between two glyph indices.
 * - **A glyph index outside the glyph array** is glyph 0, as fontkit's
 *   bounded array reads it.
 * - **The variation sequences are fontkit's too.** fontkit decodes the
 *   first Unicode Variation Sequences record, (0, 5), when it first lays
 *   text out, and throws on a format it does not know; it decodes every
 *   sequence for a character followed by a variation selector. So that
 *   subtable is held to format 14, its records and the arrays they point
 *   to inside the file, and every glyph a sequence names to the glyph
 *   count (`readFont`); a sequence maps no character of its own, since
 *   the renderer holds text to the base character's glyph.
 *
 * Every array is held inside the subtable's own length, and the subtable
 * inside the file; segments and groups are counted from what those lengths
 * hold, never allocated from a count first. A format 4 subtable maps at
 * most the 65,536 code points of the BMP; a format 12 subtable's code
 * points are summed from its groups, which are apart, and refused past
 * `MAX_FONT_CHARACTERS` before one is added. The variation sequences'
 * arrays, which records may point to many times, may add up to no more
 * than the font's own size.
 */
import { FontFile, type TableRecord } from './font-file.js'
import { caught, refuse, type FontRefusal } from './font-refusal.js'
import { MAX_FONT_CHARACTERS } from './limits.js'

/** The code points a font maps to a glyph, as `characterMap` reads them. */
export interface FontCharacters {
  readonly ok: true
  readonly characters: ReadonlySet<number>
}

/** What the character map holds: the characters, and the largest glyph index it, or a variation sequence, maps one to, which `readFont` holds to the glyph count. */
export interface CharacterMap {
  readonly characters: Set<number>
  readonly largestGlyph: number
}

/** fontkit's order of the Unicode subtables it looks for, as (platform, encoding). */
const PREFERENCE: readonly (readonly [number, number])[] = [
  [3, 10],
  [0, 6],
  [0, 4],
  [3, 1],
  [0, 3],
  [0, 2],
  [0, 1],
  [0, 0],
]

/** The largest code point Unicode has. */
const LAST_CODE_POINT = 0x10ffff

/**
 * The code points a font maps to a glyph other than glyph 0, from the
 * character map alone: the table directory and the 'cmap' table, of any
 * sfnt, and nothing else of the font. `readFont` reads the same map and
 * holds the rest of the font besides; this is what the renderer reads of
 * the faces it ships, whose embedding nothing needs to judge again. It
 * holds no glyph index to the glyph count, which it does not read, and
 * reads the character map whatever length the directory records for it,
 * which fontkit does not: a font a host brings is held to `readFont`'s
 * characters, which hold both.
 */
export function characterMap(bytes: Uint8Array): FontCharacters | FontRefusal {
  return caught(() => ({ ok: true, characters: readCharacterMap(new FontFile(bytes)).characters }))
}

/** The character map of an opened font file, or the refusal thrown from inside it. */
export function readCharacterMap(file: FontFile): CharacterMap {
  const table = file.table('cmap')
  if (file.u16(table.offset, table) !== 0) refuse('malformed', 'has a character map of a version the specification does not define')
  const count = file.u16(table.offset + 2, table)
  file.need(table.offset + 4, 8 * count, table)
  const records: { platform: number; encoding: number; at: number }[] = []
  for (let index = 0; index < count; index++) {
    const record = table.offset + 4 + 8 * index
    records.push({ platform: file.u16(record, table), encoding: file.u16(record + 2, table), at: table.offset + file.u32(record + 4, table) })
  }
  const chosen = PREFERENCE.map(([platform, encoding]) => records.find((record) => record.platform === platform && record.encoding === encoding)).find((record) => record !== undefined)
  if (chosen === undefined) refuse('character-map', 'has no Unicode character map in format 4 or 12')
  const format = file.u16(chosen.at, table)
  const read = format === 4 ? format4(file, table, chosen.at) : format === 12 ? format12(file, table, chosen.at) : refuse('character-map', `maps Unicode in a subtable of format ${format}, where formats 4 and 12 are read`)
  if (read.characters.size === 0) refuse('character-map', 'maps no character to a glyph')
  const sequences = records.find((record) => record.platform === 0 && record.encoding === 5)
  if (sequences === undefined) return read
  return { characters: read.characters, largestGlyph: Math.max(read.largestGlyph, variationSequences(file, table, sequences.at)) }
}

/**
 * A Unicode Variation Sequences subtable, format 14: its records inside its
 * own length, each record's default and non-default arrays inside the file
 * and their sizes summed, refused past the font's size before a mapping is
 * walked; the largest glyph a non-default sequence maps to, returned.
 */
function variationSequences(file: FontFile, table: TableRecord, at: number): number {
  if (file.u16(at, table) !== 14) refuse('malformed', 'has a variation sequences subtable in a format other than 14')
  const length = file.u32(at + 2, table)
  const count = file.u32(at + 6, table)
  if (10 + 11 * count > length) refuse('malformed', 'has a variation sequences subtable shorter than its records')
  file.need(at, length, table)
  let bytes = 0
  let largestGlyph = 0
  for (let index = 0; index < count; index++) {
    // A record: the selector, three bytes, then the offsets of its default and non-default arrays from the subtable's start, 0 for none.
    const record = at + 10 + 11 * index
    const defaults = file.u32(record + 3, table)
    const others = file.u32(record + 7, table)
    // Ranges of four bytes, and mappings of five -- a code point and a glyph -- each array after its count.
    const ranges = defaults === 0 ? 0 : file.u32(at + defaults, table)
    const mappings = others === 0 ? 0 : file.u32(at + others, table)
    if (defaults !== 0) file.need(at + defaults + 4, 4 * ranges, table)
    if (others !== 0) file.need(at + others + 4, 5 * mappings, table)
    bytes += (defaults === 0 ? 0 : 4 + 4 * ranges) + (others === 0 ? 0 : 4 + 5 * mappings)
    if (bytes > file.length) refuse('malformed', 'has variation sequences that add up to more bytes than the font holds')
    for (let mapping = 0; mapping < mappings; mapping++) largestGlyph = Math.max(largestGlyph, file.u16(at + others + 7 + 5 * mapping, table))
  }
  return largestGlyph
}

/**
 * A format 4 subtable: four arrays of segments and the glyph array after
 * them, each code point mapped by its segment's delta or, where its
 * idRangeOffset is not 0, through the glyph array, all modulo 65,536.
 */
function format4(file: FontFile, table: TableRecord, at: number): CharacterMap {
  const length = file.u16(at + 2, table)
  const doubled = file.u16(at + 6, table)
  if (length % 2 !== 0 || doubled % 2 !== 0) refuse('malformed', 'has a character map subtable of format 4 of an odd length')
  const segments = doubled / 2
  // The header's 14 bytes, the four arrays and the pad between the first two.
  const arrays = 16 + 8 * segments
  if (length < arrays) refuse('malformed', 'has a character map subtable of format 4 shorter than its segments')
  file.need(at, length, table)
  const ends = at + 14
  const starts = ends + 2 * segments + 2
  const deltas = starts + 2 * segments
  const offsets = deltas + 2 * segments
  const glyphArray = offsets + 2 * segments
  const entries = (length - arrays) / 2
  const characters = new Set<number>()
  let largestGlyph = 0
  for (let segment = 0, previous = -1; segment < segments; segment++) {
    const end = file.u16(ends + 2 * segment, table)
    const start = file.u16(starts + 2 * segment, table)
    const delta = file.u16(deltas + 2 * segment, table)
    const rangeOffset = file.u16(offsets + 2 * segment, table)
    if (start > end || start <= previous) refuse('malformed', 'has a character map subtable of format 4 whose segments are out of order or overlap')
    if (rangeOffset % 2 !== 0) refuse('malformed', 'has a character map subtable of format 4 with an odd idRangeOffset')
    previous = end
    for (let point = start; point <= end; point++) {
      let glyph: number
      if (rangeOffset === 0) glyph = (point + delta) & 0xffff
      else {
        // The specification's address of the entry, from idRangeOffset[segment], as an index into the glyph array.
        const entry = rangeOffset / 2 + (point - start) - (segments - segment)
        const indexed = entry >= 0 && entry < entries ? file.u16(glyphArray + 2 * entry, table) : 0
        glyph = indexed === 0 ? 0 : (indexed + delta) & 0xffff
      }
      if (glyph === 0) continue
      characters.add(point)
      if (glyph > largestGlyph) largestGlyph = glyph
    }
  }
  return { characters, largestGlyph }
}

/** A format 12 subtable: groups of consecutive code points, each mapped to consecutive glyphs from its first. */
function format12(file: FontFile, table: TableRecord, at: number): CharacterMap {
  const length = file.u32(at + 4, table)
  const groups = file.u32(at + 12, table)
  if (16 + 12 * groups > length) refuse('malformed', 'has a character map subtable of format 12 shorter than its groups')
  file.need(at, length, table)
  let total = 0
  for (let group = 0, previous = -1; group < groups; group++) {
    const record = at + 16 + 12 * group
    const start = file.u32(record, table)
    const end = file.u32(record + 4, table)
    if (start > end || start <= previous) refuse('malformed', 'has a character map subtable of format 12 whose groups are out of order or overlap')
    if (end > LAST_CODE_POINT) refuse('malformed', 'has a character map subtable of format 12 that maps past the last Unicode code point')
    previous = end
    total += end - start + 1
  }
  if (total > MAX_FONT_CHARACTERS) refuse('too-large', `maps ${total} characters, where the most a font may map is ${MAX_FONT_CHARACTERS}`)
  const characters = new Set<number>()
  let largestGlyph = 0
  for (let group = 0; group < groups; group++) {
    const record = at + 16 + 12 * group
    const start = file.u32(record, table)
    const end = file.u32(record + 4, table)
    const first = file.u32(record + 8, table)
    for (let point = start; point <= end; point++) if (first + (point - start) !== 0) characters.add(point)
    if (first + (end - start) > largestGlyph) largestGlyph = first + (end - start)
  }
  return { characters, largestGlyph }
}
