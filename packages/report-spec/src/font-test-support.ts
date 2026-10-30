/**
 * Test support for the font reader (0040): TrueType fonts made in code from
 * their tables, so that no test of the reader carries a binary file a
 * reviewer cannot read. Every table is written field by field from the
 * OpenType specification's layout (OpenType 1.9.1, read 21 October 2026),
 * never with the reader's own code, so that a fixture framed by the reader
 * would not agree with it whatever it read. Never published: nothing in
 * `index.ts` exports it.
 *
 * The font `font()` makes is the least a reader must accept: three glyphs
 * (a .notdef and two squares), 'A' and 'B' mapped to the squares in a
 * Windows Unicode format 4 character map, a version 4 OS/2 table that
 * allows installable embedding, and the names a builder shows. Each part is
 * a builder of its own, so that a test changes one field and no other.
 */

export const u16 = (value: number): number[] => [(value >>> 8) & 0xff, value & 0xff]
export const u32 = (value: number): number[] => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
const ascii = (text: string): number[] => [...text].map((character) => character.charCodeAt(0) & 0xff)

/** A table: its tag and its bytes. */
export type Table = readonly [string, Uint8Array]

/** The four bytes of an sfnt version or a signature, from its tag. */
export const tagged = (tag: string): number => ((tag.charCodeAt(0) << 24) | (tag.charCodeAt(1) << 16) | (tag.charCodeAt(2) << 8) | tag.charCodeAt(3)) >>> 0

/**
 * An sfnt of these tables, in the order given, each at a four-byte boundary
 * and padded with zeros up to the next, its record holding its exact
 * length; the last unpadded, so that every byte of the file is a table's;
 * the search fields derived from the count, as the specification defines
 * them.
 */
export function sfnt(tables: readonly Table[], version: number = 0x00010000): Uint8Array {
  const count = tables.length
  let size = 12 + 16 * count
  const offsets = tables.map(([, data], index) => {
    const at = size
    size += index === count - 1 ? data.length : (data.length + 3) & ~3
    return at
  })
  const bytes = new Uint8Array(size)
  const power = count === 0 ? 0 : 2 ** Math.floor(Math.log2(count))
  bytes.set([...u32(version), ...u16(count), ...u16(power * 16), ...u16(count === 0 ? 0 : Math.log2(power)), ...u16(count * 16 - power * 16)], 0)
  tables.forEach(([tag, data], index) => {
    bytes.set([...ascii(tag), ...u32(0), ...u32(offsets[index]!), ...u32(data.length)], 12 + 16 * index)
    bytes.set(data, offsets[index])
  })
  return bytes
}

/** The font header, 54 bytes. */
export function head({ major = 1, magic = 0x5f0f3cf5, flags = 0, unitsPerEm = 1000, macStyle = 0, locFormat = 0, glyphDataFormat = 0 } = {}): Uint8Array {
  return Uint8Array.from([
    ...u16(major),
    ...u16(0),
    ...u32(0x00010000),
    ...u32(0),
    ...u32(magic),
    ...u16(flags),
    ...u16(unitsPerEm),
    ...new Array<number>(16).fill(0),
    ...u16(-100),
    ...u16(-200),
    ...u16(600),
    ...u16(800),
    ...u16(macStyle),
    ...u16(8),
    ...u16(2),
    ...u16(locFormat),
    ...u16(glyphDataFormat),
  ])
}

/** The horizontal header, 36 bytes. */
export function hhea({ major = 1, ascender = 800, descender = -200, lineGap = 90, metricDataFormat = 0, metrics = 3 } = {}): Uint8Array {
  return Uint8Array.from([
    ...u16(major),
    ...u16(0),
    ...u16(ascender),
    ...u16(descender),
    ...u16(lineGap),
    ...new Array<number>(22).fill(0),
    ...u16(metricDataFormat),
    ...u16(metrics),
  ])
}

/**
 * The vertical header, 36 bytes, version 1.1: `metricDataFormat` at byte
 * 32, which fontkit reads as its count of metrics, and the specification's
 * count, numOfLongVerMetrics, at byte 34.
 */
export function vhea({ metricDataFormat = 0, metrics = 3 } = {}): Uint8Array {
  return Uint8Array.from([
    ...u32(0x00011000),
    ...u16(500),
    ...u16(-500),
    ...u16(0),
    ...new Array<number>(22).fill(0),
    ...u16(metricDataFormat),
    ...u16(metrics),
  ])
}

/** The maximum profile: version 1.0's 32 bytes, or 0.5's six, which a CFF font carries. */
export function maxp({ version = 0x00010000, glyphs = 3 } = {}): Uint8Array {
  return Uint8Array.from([...u32(version), ...u16(glyphs), ...(version === 0x00005000 ? [] : new Array<number>(26).fill(0))])
}

/** The OS/2 table at the length its version defines: 78 bytes for 0, 86 for 1, 96 for 2 to 4 and 100 for 5. */
export function os2({
  version = 4,
  fsType = 0,
  weight = 400,
  fsSelection = 0x40,
  length,
}: { version?: number; fsType?: number; weight?: number; fsSelection?: number; length?: number } = {}): Uint8Array {
  const bytes = new Uint8Array(length ?? (version === 0 ? 78 : version === 1 ? 86 : version >= 5 ? 100 : 96))
  const view = new DataView(bytes.buffer)
  view.setUint16(0, version)
  if (bytes.length >= 6) view.setUint16(4, weight)
  if (bytes.length >= 10) view.setUint16(8, fsType)
  if (bytes.length >= 64) view.setUint16(62, fsSelection)
  return bytes
}

/** The PostScript table: 32 bytes for versions 1.0 and 3.0; version 2.0's glyph name indices and Pascal strings after them. */
export function post({
  version = 0x00030000,
  italicAngle = 0,
  fixedPitch = 0,
  indices = [] as readonly number[],
  names = [] as readonly string[],
  strings,
}: {
  version?: number
  italicAngle?: number
  fixedPitch?: number
  indices?: readonly number[]
  names?: readonly string[]
  strings?: readonly number[]
} = {}): Uint8Array {
  const header = [...u32(version), ...u32(italicAngle * 65536), ...u16(-100), ...u16(50), ...u32(fixedPitch), ...new Array<number>(16).fill(0)]
  if (version !== 0x00020000) return Uint8Array.from(header)
  const pascal = strings ?? names.flatMap((name) => [name.length, ...ascii(name)])
  return Uint8Array.from([...header, ...u16(indices.length), ...indices.flatMap(u16), ...pascal])
}

/** A name record's string: UTF-16BE for the Unicode and Windows platforms, one byte a character for the Macintosh. */
export interface NameEntry {
  readonly platform: number
  readonly encoding: number
  readonly language: number
  readonly id: number
  readonly text: string
}

const utf16 = (text: string): number[] =>
  [...text].flatMap((character) => {
    const point = character.codePointAt(0)!
    if (point < 0x10000) return u16(point)
    return [...u16(0xd800 + ((point - 0x10000) >> 10)), ...u16(0xdc00 + ((point - 0x10000) & 0x3ff))]
  })

/** The bytes a name record of this platform holds for `text`. */
export const nameBytes = (entry: Pick<NameEntry, 'platform' | 'text'>): number[] => (entry.platform === 1 ? ascii(entry.text) : utf16(entry.text))

/**
 * A naming table of these records, in the order given, each string stored
 * once after the records: version 0, or version 1 where `tags` are given,
 * each language tag a UTF-16 string stored after the names, the record
 * that names it holding 0x8000 and its index as its language.
 */
export function name(entries: readonly NameEntry[], { storage, tags }: { storage?: readonly number[]; tags?: readonly string[] } = {}): Uint8Array {
  const strings = entries.map(nameBytes)
  const tagged = (tags ?? []).map((tag) => utf16(tag))
  const records: number[] = []
  let offset = 0
  entries.forEach((entry, index) => {
    records.push(...u16(entry.platform), ...u16(entry.encoding), ...u16(entry.language), ...u16(entry.id), ...u16(strings[index]!.length), ...u16(offset))
    offset += strings[index]!.length
  })
  const tagRecords = tagged.flatMap((bytes) => {
    const record = [...u16(bytes.length), ...u16(offset)]
    offset += bytes.length
    return record
  })
  const languageTags = tags === undefined ? [] : [...u16(tags.length), ...tagRecords]
  const header = [...u16(tags === undefined ? 0 : 1), ...u16(entries.length), ...u16(6 + 12 * entries.length + languageTags.length)]
  return Uint8Array.from([...header, ...records, ...languageTags, ...(storage ?? [...strings.flat(), ...tagged.flat()])])
}

/** Windows, Unicode BMP, English (United States): the record a reader prefers. */
export const windows = (id: number, text: string): NameEntry => ({ platform: 3, encoding: 1, language: 0x409, id, text })
/** Macintosh, Roman, English. */
export const macintosh = (id: number, text: string): NameEntry => ({ platform: 1, encoding: 0, language: 0, id, text })

/** The names of the font `font()` makes: copyright, family, subfamily, full name, version, PostScript name and licence, on Windows, with the PostScript name on the Macintosh too. */
export const NAMES: readonly NameEntry[] = [
  windows(0, 'Copyright 2026 an invented foundry'),
  windows(1, 'Probe Sans'),
  windows(2, 'Regular'),
  windows(4, 'Probe Sans Regular'),
  windows(5, 'Version 1.000'),
  windows(6, 'ProbeSans-Regular'),
  windows(13, 'Licensed under an invented licence for tests alone'),
  windows(14, 'https://example.invalid/licence'),
  macintosh(6, 'ProbeSans-Regular'),
]

/** A segment of a format 4 subtable: its code points, and either a delta or, through the glyph array, a glyph for each. */
export interface Segment {
  readonly start: number
  readonly end: number
  readonly delta?: number
  readonly glyphs?: readonly number[]
  /** An idRangeOffset written as given, for a segment the reader must refuse or read past its array. */
  readonly rangeOffset?: number
}

/**
 * A format 4 subtable of these segments, the final 0xFFFF segment added
 * unless `final` is false; a segment with glyphs indexes the glyph array
 * through its idRangeOffset, as the specification's formula reads it.
 */
export function format4(
  segments: readonly Segment[],
  { final = true, length, segCountX2 }: { final?: boolean; length?: number; segCountX2?: number } = {},
): Uint8Array {
  const all = final ? [...segments, { start: 0xffff, end: 0xffff, delta: 1 }] : [...segments]
  const count = all.length
  const glyphArray: number[] = []
  const rangeOffsets = all.map((segment, index) => {
    if (segment.rangeOffset !== undefined) return segment.rangeOffset
    if (segment.glyphs === undefined) return 0
    // From idRangeOffset[index] to the segment's first entry in the glyph array.
    const offset = 2 * (count - index) + 2 * glyphArray.length
    glyphArray.push(...segment.glyphs)
    return offset
  })
  const body = [
    ...u16(count * 2 === 0 ? 0 : (segCountX2 ?? count * 2)),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...all.flatMap((segment) => u16(segment.end)),
    ...u16(0),
    ...all.flatMap((segment) => u16(segment.start)),
    ...all.flatMap((segment) => u16(segment.delta ?? 0)),
    ...rangeOffsets.flatMap(u16),
    ...glyphArray.flatMap(u16),
  ]
  return Uint8Array.from([...u16(4), ...u16(length ?? 6 + body.length), ...u16(0), ...body])
}

/** A format 12 subtable of these groups: the first and last code point and the glyph of the first. */
export function format12(groups: readonly (readonly [number, number, number])[], { length }: { length?: number } = {}): Uint8Array {
  return Uint8Array.from([
    ...u16(12),
    ...u16(0),
    ...u32(length ?? 16 + 12 * groups.length),
    ...u32(0),
    ...u32(groups.length),
    ...groups.flatMap(([start, end, glyph]) => [...u32(start), ...u32(end), ...u32(glyph)]),
  ])
}

/** A record of a format 14 subtable: its selector, its default ranges as a first code point and how many follow it, and its non-default mappings of a code point to a glyph. */
export interface VariationRecord {
  readonly selector: number
  readonly defaults?: readonly (readonly [number, number])[]
  readonly mappings?: readonly (readonly [number, number])[]
}

/**
 * A Unicode Variation Sequences subtable, format 14, of these records,
 * each array stored after them in order, its offset from the subtable's
 * start, 0 where a record has none; `length` written as given.
 */
export function format14(records: readonly VariationRecord[], { length }: { length?: number } = {}): Uint8Array {
  const u24 = (value: number): number[] => [(value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
  let offset = 10 + 11 * records.length
  const arrays: number[] = []
  const place = (bytes: readonly number[] | undefined): number => {
    if (bytes === undefined) return 0
    const at = offset
    arrays.push(...bytes)
    offset += bytes.length
    return at
  }
  const written = records.flatMap((record) => {
    const defaults = place(record.defaults && [...u32(record.defaults.length), ...record.defaults.flatMap(([start, more]) => [...u24(start), more])])
    const mappings = place(record.mappings && [...u32(record.mappings.length), ...record.mappings.flatMap(([point, glyph]) => [...u24(point), ...u16(glyph)])])
    return [...u24(record.selector), ...u32(defaults), ...u32(mappings)]
  })
  return Uint8Array.from([...u16(14), ...u32(length ?? offset), ...u32(records.length), ...written, ...arrays])
}

/** A subtable of another format: its format number and a few bytes, enough for a reader that must refuse it by its format alone. */
export const otherFormat = (format: number): Uint8Array => Uint8Array.from([...u16(format), ...u16(6), ...u16(0)])

/** A character map of these subtables, each with its platform and encoding, in the order given, each stored once. */
export function cmap(subtables: readonly (readonly [number, number, Uint8Array])[], { version = 0 } = {}): Uint8Array {
  let offset = 4 + 8 * subtables.length
  const records = subtables.flatMap(([platform, encoding, table]) => {
    const record = [...u16(platform), ...u16(encoding), ...u32(offset)]
    offset += table.length
    return record
  })
  return Uint8Array.from([...u16(version), ...u16(subtables.length), ...records, ...subtables.flatMap(([, , table]) => [...table])])
}

/** 'A' and 'B' mapped to glyphs 1 and 2, by a delta. */
export const AB: readonly Segment[] = [{ start: 0x41, end: 0x42, delta: 1 - 0x41 }]

/** A square of four on-curve points, 34 bytes: a glyph with an outline, as a simple glyph description writes it. */
export function square(size = 500): Uint8Array {
  const flags = [1, 1, 1, 1]
  return Uint8Array.from([
    ...u16(1),
    ...u16(0),
    ...u16(0),
    ...u16(size),
    ...u16(size),
    ...u16(3),
    ...u16(0),
    ...flags,
    ...[0, size, 0, -size].flatMap(u16),
    ...[0, 0, size, 0].flatMap(u16),
  ])
}

/**
 * A simple glyph of `contours` contours and `points` points, the points
 * shared out among the contours, each on the curve and where the last
 * one was, its flags written as repeats: the most work for the fewest
 * bytes, as a font made to stall a reader would write it.
 */
export function crowded(contours: number, points: number): Uint8Array {
  const ends = Array.from({ length: contours }, (_, index) => Math.floor(((index + 1) * points) / contours) - 1)
  const flags: number[] = []
  for (let left = points; left > 0; left -= 256) flags.push(0x31 | 0x08, Math.min(left, 256) - 1)
  return Uint8Array.from([...u16(contours), ...u16(0), ...u16(0), ...u16(500), ...u16(500), ...ends.flatMap(u16), ...u16(0), ...flags])
}

/** An outline of no points: a glyph header and nothing a rasteriser draws. */
export const NO_CONTOURS = Uint8Array.from([...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0)])

/**
 * A composite glyph of these components, the last without MORE_COMPONENTS,
 * each placed by word offsets unless `bytes`, and transformed by a scale,
 * an x and a y scale or a two by two matrix of F2DOT14s as `transform` says.
 */
export function composite(
  components: readonly number[],
  { bytes = false, transform = 'none' }: { bytes?: boolean; transform?: 'none' | 'scale' | 'xy' | 'matrix' } = {},
): Uint8Array {
  const flag = { none: 0, scale: 0x0008, xy: 0x0040, matrix: 0x0080 }[transform]
  const scales = { none: 0, scale: 1, xy: 2, matrix: 4 }[transform]
  return Uint8Array.from([
    ...u16(0xffff),
    ...u16(0),
    ...u16(0),
    ...u16(500),
    ...u16(500),
    ...components.flatMap((glyph, index) => [
      ...u16((bytes ? 0 : 0x0001) | flag | (index < components.length - 1 ? 0x0020 : 0)),
      ...u16(glyph),
      ...(bytes ? [0, 0] : [...u16(0), ...u16(0)]),
      ...Array.from({ length: scales }, () => u16(0x4000)).flat(),
    ]),
  ])
}

/** The glyph data of these glyphs and the offsets loca holds for them, in its short or long format. */
export function outlines(glyphs: readonly Uint8Array[], locFormat = 0): { glyf: Uint8Array; loca: Uint8Array } {
  const offsets: number[] = [0]
  for (const glyph of glyphs) offsets.push(offsets.at(-1)! + ((glyph.length + 1) & ~1))
  const glyf = new Uint8Array(offsets.at(-1)!)
  glyphs.forEach((glyph, index) => glyf.set(glyph, offsets[index]))
  const loca = Uint8Array.from(offsets.flatMap((offset) => (locFormat === 0 ? u16(offset / 2) : u32(offset))))
  return { glyf, loca }
}

/** Horizontal metrics: an advance and a side bearing for each of `metrics` glyphs, and a side bearing alone for the rest. */
export function hmtx(glyphs = 3, metrics = 3): Uint8Array {
  return Uint8Array.from([...Array.from({ length: metrics }, () => [...u16(600), ...u16(0)]).flat(), ...new Array<number>(2 * (glyphs - metrics)).fill(0)])
}

/** What `font()` is made of, each part replaceable. */
export interface FontParts {
  readonly version?: number
  readonly glyphs?: readonly Uint8Array[]
  readonly locFormat?: number
  readonly head?: Uint8Array
  readonly hhea?: Uint8Array
  readonly maxp?: Uint8Array
  readonly os2?: Uint8Array
  readonly post?: Uint8Array
  readonly name?: Uint8Array
  readonly cmap?: Uint8Array
  readonly hmtx?: Uint8Array
  readonly loca?: Uint8Array
  readonly glyf?: Uint8Array
  /** Tables to leave out, by tag. */
  readonly without?: readonly string[]
  /** Tables to add, each sorted into place by its tag. */
  readonly with?: readonly Table[]
  /** A table to put at the end of the file rather than in its place, so that a read past it is a read past the file. */
  readonly last?: string
}

/** A TrueType font a reader must accept, but for the parts given; its tables sorted by tag, as the specification asks. */
export function font(parts: FontParts = {}): Uint8Array {
  const glyphs = parts.glyphs ?? [square(), square(400), square(300)]
  const locFormat = parts.locFormat ?? 0
  const drawn = outlines(glyphs, locFormat)
  const tables: Table[] = [
    ['OS/2', parts.os2 ?? os2()],
    ['cmap', parts.cmap ?? cmap([[3, 1, format4(AB)]])],
    ['glyf', parts.glyf ?? drawn.glyf],
    ['head', parts.head ?? head({ locFormat })],
    ['hhea', parts.hhea ?? hhea({ metrics: glyphs.length })],
    ['hmtx', parts.hmtx ?? hmtx(glyphs.length, glyphs.length)],
    ['loca', parts.loca ?? drawn.loca],
    ['maxp', parts.maxp ?? maxp({ glyphs: glyphs.length })],
    ['name', parts.name ?? name(NAMES)],
    ['post', parts.post ?? post()],
  ]
  const kept = tables.filter(([tag]) => !(parts.without ?? []).includes(tag))
  const all = [...kept, ...(parts.with ?? [])].sort(([a], [b]) => (a === parts.last ? 1 : b === parts.last ? -1 : a < b ? -1 : a > b ? 1 : 0))
  return sfnt(all, parts.version)
}

/** A copy of `bytes` with these bytes written at `at`. */
export function patched(bytes: Uint8Array, at: number, values: readonly number[]): Uint8Array {
  const copy = Uint8Array.from(bytes)
  copy.set(values, at)
  return copy
}

/** Where the table `tag` starts in `bytes`, and how long its record says it is, read from the directory as `sfnt` wrote it. */
export function tableAt(bytes: Uint8Array, tag: string): { readonly record: number; readonly offset: number; readonly length: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let index = 0; index < view.getUint16(4); index++) {
    const record = 12 + 16 * index
    if (String.fromCharCode(...bytes.subarray(record, record + 4)) === tag)
      return { record, offset: view.getUint32(record + 8), length: view.getUint32(record + 12) }
  }
  throw new Error(`no ${tag} table`)
}

/** A deterministic stream of numbers below one, so that a sweep of mutations is the same every run. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}
