/**
 * A TrueType font's fixed tables, read and held to the OpenType
 * specification (OpenType 1.9.1, read 21 October 2026): the font header,
 * the maximum profile, the horizontal header and metrics, the OS/2 table's
 * embedding permissions, weight and style, and the PostScript table
 * (0040). Each read is checked against the file (`FontFile`); each field a
 * reader acts on is held to the values the specification defines, and a
 * version it does not define is refused rather than read as another.
 *
 * What PDFKit reads of these when it embeds a face is read here too, so
 * that a font this accepts is one fontkit decodes: it names the font by
 * its PostScript name, scales by `unitsPerEm`, measures a line by the
 * horizontal header, sets the descriptor's flags from the PostScript
 * table's `isFixedPitch` and the header's `macStyle`, and takes each
 * glyph's advance from the metrics (`EmbeddedFont`, pdfkit.js 2551-2690),
 * and fontkit each glyph's height from the vertical metrics where a font
 * has them (`Glyph._getMetrics`). fontkit decodes each of these tables
 * whole, and finds none where its bytes run past the file.
 */
import type { FontFile } from './font-file.js'
import { refuse, refuseEmbedding } from './font-refusal.js'

/** What the font header says the rest of the font is read by. */
export interface FontHeader {
  readonly unitsPerEm: number
  /** loca's offsets: 0 for 16-bit halves, 1 for 32-bit bytes. */
  readonly locFormat: 0 | 1
}

/** The font header: version 1, the magic number, a unit square of 16 to 16,384, one of loca's two formats, glyph data in its one format, and no last-resort font. */
export function readHead(file: FontFile): FontHeader {
  const table = file.table('head')
  const at = table.offset
  file.need(at, 54, table)
  if (file.u16(at, table) !== 1) refuse('malformed', 'has a font header of a version the specification does not define')
  if (file.u32(at + 12, table) !== 0x5f0f3cf5) refuse('malformed', 'has a font header without its magic number')
  const unitsPerEm = file.u16(at + 18, table)
  if (unitsPerEm < 16 || unitsPerEm > 16384) refuse('malformed', `has ${unitsPerEm} units to the em, where the specification allows 16 to 16384`)
  const locFormat = file.i16(at + 50, table)
  if (locFormat !== 0 && locFormat !== 1) refuse('malformed', 'has an index to location format the specification does not define')
  if (file.i16(at + 52, table) !== 0) refuse('malformed', 'has glyph data in a format the specification does not define')
  // Bit 14: the Last Resort font, whose glyphs stand for ranges of code points rather than drawing them.
  if ((file.u16(at + 16, table) & 0x4000) !== 0) refuse('character-map', 'is a last-resort font, whose glyphs stand for ranges of characters rather than draw them')
  return { unitsPerEm, locFormat }
}

/** The glyph count, from a version 1.0 maximum profile, the version TrueType outlines carry, whose 32 bytes fontkit decodes whole; a font of no glyph has no .notdef. */
export function readGlyphCount(file: FontFile): number {
  const table = file.table('maxp')
  file.need(table.offset, 32, table)
  if (file.u32(table.offset, table) !== 0x00010000) refuse('malformed', 'has a maximum profile of another version than the 1.0 TrueType outlines need')
  const glyphs = file.u16(table.offset + 4, table)
  if (glyphs === 0) refuse('malformed', 'has no glyph, not even the .notdef glyph 0')
  return glyphs
}

/** A line, in font units, as PDFKit measures one: the horizontal header's ascender, descender and line gap. */
export interface FontLine {
  readonly ascender: number
  readonly descender: number
  readonly lineGap: number
}

/** The horizontal header, version 1, and the metrics it counts: between one and `glyphs` advances, and a side bearing for every glyph after them, inside the file. */
export function readHorizontal(file: FontFile, glyphs: number): FontLine {
  const table = file.table('hhea')
  const at = table.offset
  file.need(at, 36, table)
  if (file.u16(at, table) !== 1) refuse('malformed', 'has a horizontal header of a version the specification does not define')
  if (file.i16(at + 32, table) !== 0) refuse('malformed', 'has horizontal metrics in a format the specification does not define')
  const metrics = file.u16(at + 34, table)
  if (metrics === 0 || metrics > glyphs) refuse('malformed', `counts ${metrics} horizontal metrics for ${glyphs} glyphs`)
  const widths = file.table('hmtx')
  file.need(widths.offset, 4 * metrics + 2 * (glyphs - metrics), widths)
  return { ascender: file.i16(at + 4, table), descender: file.i16(at + 6, table), lineGap: file.i16(at + 8, table) }
}

/**
 * The vertical metrics, where fontkit reads them: where it sees both a
 * vertical header and its metrics, it measures every glyph by them, and
 * otherwise by the OS/2 table and the horizontal header. It reads the
 * header's count of metrics two bytes early -- the version as 16 bits,
 * where the specification gives it 32 -- from the field the specification
 * calls metricDataFormat, which is 0 in a sound font, and so takes every
 * glyph's top side bearing from the start of the table. The bytes held
 * inside the file are the ones fontkit reads; the specification's count is
 * not judged, since fontkit never reads by it.
 */
export function readVertical(file: FontFile, glyphs: number): void {
  if (!file.seen('vhea') || !file.seen('vmtx')) return
  const header = file.table('vhea')
  file.need(header.offset, 36, header)
  const counted = file.u16(header.offset + 32, header)
  const metrics = file.table('vmtx')
  file.need(metrics.offset, counted >= glyphs ? 4 * glyphs : 4 * counted + 2 * (glyphs - counted), metrics)
}

/** What a font's fsType allows, where it allows embedding a subset of its outlines. */
export type FontEmbedding = 'installable' | 'preview-print' | 'editable'

/** The OS/2 table's say on embedding, and on the face's weight and style, for a person to choose its face by. */
export interface FontOs2 {
  readonly embedding: FontEmbedding
  readonly fsType: number
  /** usWeightClass, 100 thin to 900 black, as the font states it. */
  readonly weight: number
  /** fsSelection's bits 0, 5 and 6: italic, bold, regular. Roboto Medium, which pdfmake prints bold, says regular. */
  readonly italic: boolean
  readonly bold: boolean
  readonly regular: boolean
}

/** The OS/2 versions the specification defines. */
const LAST_OS2_VERSION = 5

/** The usage bits' values, from Restricted License to Editable. */
const USAGE = { restricted: 0x0002, previewPrint: 0x0004, editable: 0x0008 } as const

/**
 * What an fsType of an OS/2 table of `version` allows, or its refusal
 * (OS/2, fsType, and its version differences):
 *
 * - bit 0 is reserved and must be zero in every version, and is refused;
 * - in versions 0 to 2 several of bits 1 to 3 mean the least restrictive,
 *   as those versions said; from version 3 they are exclusive, and several
 *   are refused;
 * - Restricted License alone (2) is refused: the font "must not be ...
 *   embedded ... without first obtaining explicit permission";
 * - Preview & Print (4) is accepted, since a PDF is opened read-only, and
 *   Editable (8) and Installable (0);
 * - from version 2, Bitmap embedding only (bit 9) and No subsetting (bit 8)
 *   are refused, since PDFKit embeds outlines and always a subset;
 *   versions 0 and 1 assigned no bit past 3, and the specification says to
 *   ignore them there;
 * - every other bit is reserved, which the specification says a reader can
 *   ignore; a version past 5, whose bits nothing here knows, is refused.
 */
export function embeddingOf(version: number, fsType: number): FontEmbedding {
  const hex = `0x${fsType.toString(16).padStart(4, '0')}`
  if (version > LAST_OS2_VERSION) refuseEmbedding('invalid', `states its embedding permissions in an OS/2 table of version ${version}, which the specification does not define`)
  if ((fsType & 0x0001) !== 0) refuseEmbedding('invalid', `sets bit 0 of its embedding permissions (fsType ${hex}), which the specification reserves`)
  const usage = fsType & 0x000e
  const several = usage !== 0 && (usage & (usage - 1)) !== 0
  if (several && version >= 3) refuseEmbedding('invalid', `sets more than one usage permission (fsType ${hex}), which an OS/2 table of version ${version} may not`)
  const permitted = (usage & USAGE.editable) !== 0 ? 'editable' : (usage & USAGE.previewPrint) !== 0 ? 'preview-print' : usage === 0 ? 'installable' : undefined
  if (permitted === undefined) refuseEmbedding('restricted', `allows Restricted License embedding alone (fsType ${hex}), which forbids embedding the font without its owner's permission`)
  if (version >= 2 && (fsType & 0x0200) !== 0) refuseEmbedding('bitmap-only', `allows its bitmaps alone to be embedded (fsType ${hex}), where a PDF embeds outlines`)
  if (version >= 2 && (fsType & 0x0100) !== 0) refuseEmbedding('no-subsetting', `forbids embedding a subset of it (fsType ${hex}), where the PDF embeds only the glyphs it prints`)
  return permitted
}

/** The OS/2 table: its version, the embedding its fsType allows, its weight and its style bits. */
export function readOs2(file: FontFile): FontOs2 {
  const table = file.table('OS/2')
  const at = table.offset
  const version = file.u16(at, table)
  const fsType = file.u16(at + 8, table)
  const embedding = embeddingOf(version, fsType)
  const selection = file.u16(at + 62, table)
  return { embedding, fsType, weight: file.u16(at + 4, table), italic: (selection & 0x01) !== 0, bold: (selection & 0x20) !== 0, regular: (selection & 0x40) !== 0 }
}

/**
 * The PostScript table, in a version the specification defines -- 1.0,
 * 2.0, the deprecated 2.5, or 3.0 -- whose glyph names fontkit decodes in
 * whole when PDFKit reads `isFixedPitch`: version 2.0's name indices and
 * its Pascal strings to the end of the table, version 2.5's offsets, each
 * inside the file. A table fontkit could not decode would leave PDFKit
 * reading a property of nothing.
 */
export function readPost(file: FontFile): void {
  const table = file.table('post')
  const at = table.offset
  file.need(at, 32, table)
  const version = file.u32(at, table)
  if (version === 0x00010000 || version === 0x00030000) return
  if (version === 0x00025000) {
    file.need(at + 34, file.u16(at + 32, table), table)
    return
  }
  if (version !== 0x00020000) refuse('malformed', 'has a PostScript table of a version the specification does not define')
  // fontkit reads the table's own count of name indices, which the specification says should be the glyph count, and never holds it to that.
  const named = file.u16(at + 32, table)
  file.need(at + 34, 2 * named, table)
  // fontkit reads Pascal strings from after the indices to the table's recorded end, each a length and its characters.
  const end = table.offset + table.length
  for (let string = at + 34 + 2 * named; string < end; ) {
    file.need(string, 1 + file.u8(string, table), table)
    string += 1 + file.u8(string, table)
  }
}
