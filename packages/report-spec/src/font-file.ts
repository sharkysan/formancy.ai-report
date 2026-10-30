/**
 * A font's bytes as the reader reads them (0040): what format the first
 * bytes say they are, the table directory, and reads that are each checked
 * against the bytes, so that a read past the end is a refusal and never a
 * `RangeError`.
 *
 * A table is read where the directory says it starts, and every read is
 * held inside the file, as fontkit -- the reader PDFKit draws with --
 * reads each table from its offset in the whole file. fontkit reads a
 * table's recorded length for two things, and so does this:
 *
 * - **A table recorded as empty is no table.** fontkit sees a table only
 *   where its length is not 0, and PDFKit then reads a property of
 *   nothing and throws inside pdfmake; `readFont` refuses every table it
 *   reads empty (`seenTable`), the OS/2 table too, whose embedding
 *   permissions would otherwise be read from a table that says it holds
 *   no byte. `characterMap`, which reads the faces the renderer ships,
 *   reads their character map whatever length is recorded for it.
 * - **An array no field counts ends where the length says.** fontkit reads
 *   the index to location's offsets and version 2.0's PostScript names to
 *   the table's recorded end; `readOutlines` and `readPost` hold them there.
 *
 * Otherwise the length does not cut a read short: fontkit reads a table's
 * fields past a length that understates them, and refusing it would refuse
 * a font PDFKit prints. Where a structure states its own length -- a
 * character map's subtable -- its arrays are held inside that length,
 * which fontkit reads them by.
 */
import { refuse, refuseFormat, type FontFormat } from './font-refusal.js'

/** The tables the reader reads, by tag, each with the words a refusal calls it by. A tag the reader does not know is never repeated back. */
const TABLE_NAMES = {
  cmap: 'character map',
  head: 'font header',
  hhea: 'horizontal header',
  hmtx: 'horizontal metrics',
  maxp: 'maximum profile',
  name: 'naming',
  'OS/2': 'OS/2 and Windows metrics',
  post: 'PostScript',
  glyf: 'glyph data',
  loca: 'index to location',
  vhea: 'vertical header',
  vmtx: 'vertical metrics',
} as const

/** A table the reader reads. */
export type TableTag = keyof typeof TABLE_NAMES

/** A table's record: where it starts, how long its record says it is, and what a refusal calls it. */
export interface TableRecord {
  readonly offset: number
  readonly length: number
  /** `character map table (cmap)`, or `a table` for one the reader does not know. */
  readonly called: string
}

/** What the first bytes say a file is: one TrueType font, one CFF font, or a format this does not read. */
export type Sniffed = 'truetype' | 'cff' | FontFormat

/** The sfnt versions and signatures, as the four bytes read as one big-endian number. */
const SIGNATURES: ReadonlyMap<number, Sniffed> = new Map([
  [0x00010000, 'truetype'],
  // Apple's 'true', which its TrueType Reference Manual allows and fontkit reads as TrueType.
  [0x74727565, 'truetype'],
  [0x4f54544f, 'cff'],
  [0x74746366, 'collection'],
  [0x774f4646, 'woff'],
  [0x774f4632, 'woff2'],
  // Apple's 'typ1', a Type 1 font in an sfnt.
  [0x74797031, 'type-1'],
])

/** '%!PS-AdobeFont' and '%!FontType1', how a PFA begins. */
const PFA = ['%!PS-AdobeFont', '%!FontType1'].map((text) => [...text].map((character) => character.charCodeAt(0)))

/**
 * What a font's bytes are, from their first bytes alone, never a file's
 * name or a type a browser guessed: an sfnt by its version, a collection or
 * a web font by its signature, a Type 1 font as a PFB's segment marker or a
 * PFA's comment, and an EOT by its magic number 0x504C at byte 34 in a
 * header whose first field is the file's own size. Undefined for anything
 * else.
 */
export function sniffFont(bytes: Uint8Array): Sniffed | undefined {
  if (bytes.length >= 4) {
    const signature = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0
    const found = SIGNATURES.get(signature)
    if (found !== undefined) return found
  }
  if (bytes[0] === 0x80 && bytes[1] === 0x01) return 'type-1'
  if (PFA.some((prefix) => prefix.every((byte, index) => bytes[index] === byte))) return 'type-1'
  if (bytes.length >= 36 && bytes[34] === 0x4c && bytes[35] === 0x50) {
    const size = (bytes[0]! | (bytes[1]! << 8) | (bytes[2]! << 16) | (bytes[3]! << 24)) >>> 0
    if (size === bytes.length) return 'eot'
  }
  return undefined
}

/** The words a `format` refusal says each format in. */
const FORMAT_WORDS: { readonly [F in FontFormat]: string } = {
  collection: 'is a font collection, which holds several fonts in one file',
  woff: 'is a WOFF web font, whose tables are compressed',
  woff2: 'is a WOFF2 web font, whose tables are compressed and transformed',
  eot: 'is an Embedded OpenType web font',
  'type-1': 'is a PostScript Type 1 font',
}

/** Refused as the format `sniffFont` found, which is not one font in an sfnt. */
export function refuseSniffed(format: FontFormat): never {
  refuseFormat(format, FORMAT_WORDS[format])
}

/**
 * A font file: its bytes and its table directory, read once. The
 * directory's records are each held inside the file, and a tag twice is
 * refused, since the specification leaves unsaid which of the two a reader
 * takes and fontkit takes the last. Nothing here reads the sfnt version:
 * `readFont` judges it from `sniffFont` before it opens a file, and
 * `characterMap` reads the character map of any sfnt.
 */
export class FontFile {
  readonly bytes: Uint8Array
  readonly length: number
  private readonly view: DataView
  private readonly tables = new Map<string, TableRecord>()

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
    this.length = bytes.length
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    if (this.length < 12) refuse('malformed', 'is cut off in its table directory')
    const count = this.view.getUint16(4)
    if (12 + 16 * count > this.length) refuse('malformed', 'is cut off in its table directory')
    for (let index = 0; index < count; index++) {
      const record = 12 + 16 * index
      const tag = String.fromCharCode(bytes[record]!, bytes[record + 1]!, bytes[record + 2]!, bytes[record + 3]!)
      const offset = this.view.getUint32(record + 8)
      const length = this.view.getUint32(record + 12)
      const known = Object.hasOwn(TABLE_NAMES, tag) ? TABLE_NAMES[tag as TableTag] : undefined
      const called = known === undefined ? 'a table' : `${known} table (${tag})`
      if (offset + length > this.length) refuse('malformed', `has ${called} that runs past the end of the file`)
      if (this.tables.has(tag)) refuse('malformed', known === undefined ? 'has two tables of one tag' : `has two ${known} tables (${tag})`)
      this.tables.set(tag, { offset, length, called })
    }
  }

  /** Whether the directory holds `tag`. */
  has(tag: string): boolean {
    return this.tables.has(tag)
  }

  /** Whether fontkit sees `tag`: the directory holds it, recorded as more than no byte. */
  seen(tag: TableTag): boolean {
    return (this.tables.get(tag)?.length ?? 0) > 0
  }

  /** The table `tag`, refused as missing when the directory has none. */
  table(tag: TableTag): TableRecord {
    const found = this.tables.get(tag)
    if (found === undefined) refuse('malformed', `has no ${TABLE_NAMES[tag]} table (${tag})`)
    return found
  }

  /** The table `tag` as fontkit sees it: refused as missing, and as empty where its recorded length is 0, since fontkit then sees no table at all. */
  seenTable(tag: TableTag): TableRecord {
    const found = this.table(tag)
    if (found.length === 0) refuse('malformed', `has an empty ${TABLE_NAMES[tag]} table (${tag})`)
    return found
  }

  /** Refused unless `size` bytes at `at` lie inside the file; `table` names where the read was. */
  need(at: number, size: number, table: TableRecord): void {
    if (at < 0 || size < 0 || at + size > this.length) refuse('malformed', `has its ${table.called} cut off at byte ${Math.min(at, this.length)}`)
  }

  u8(at: number, table: TableRecord): number {
    this.need(at, 1, table)
    return this.view.getUint8(at)
  }

  u16(at: number, table: TableRecord): number {
    this.need(at, 2, table)
    return this.view.getUint16(at)
  }

  i16(at: number, table: TableRecord): number {
    this.need(at, 2, table)
    return this.view.getInt16(at)
  }

  u32(at: number, table: TableRecord): number {
    this.need(at, 4, table)
    return this.view.getUint32(at)
  }
}
