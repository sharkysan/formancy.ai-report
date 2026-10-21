/**
 * What a font's bytes are, read once by report-spec for every reader (0040):
 * today the renderer, which reads the character maps of the faces it ships
 * through it, and, once they take a font, a builder, where a person adds
 * one, and a host's approval. A font is untrusted input, even when an
 * administrator approved it: every table's offset and length is held to the
 * bytes, every loop is bounded by them, nothing recurses on what a font
 * holds, nothing is allocated from a count before the bytes it counts are
 * known to be there, and a refusal repeats nothing a font chose but a
 * number the reader decoded (`font-refusal.ts`).
 *
 * Accepted: one static TrueType font -- an sfnt of version 0x00010000 or
 * Apple's 'true' -- with TrueType outlines, the eight tables every OpenType
 * font needs, a Unicode character map fontkit reads in format 4 or 12, and
 * an OS/2 fsType that allows embedding a subset of its outlines. Refused,
 * each with what to do: a collection, WOFF, WOFF2, EOT and Type 1; CFF and
 * CFF2 outlines, until the e-invoice gate has proved a CFF face in a
 * PDF/A-3b; a variable font; colour glyphs, which PDFKit prints as their
 * outlines alone, where a colour font may leave them empty; a font of
 * bitmaps alone; and Restricted License, No subsetting and Bitmap only
 * fonts, with no override on a host's word.
 *
 * The reader says what a font is and which characters it draws. Which
 * scripts a report may print in it, and whether a face is mapped, are the
 * renderer's and the format's, once a report can name a host's font.
 */
import { readCharacterMap } from './font-cmap.js'
import { FontFile, refuseSniffed, sniffFont } from './font-file.js'
import { readNames, type FontNames } from './font-names.js'
import { readOutlines } from './font-outlines.js'
import { caught, refuse, type FontRefusal } from './font-refusal.js'
import { readGlyphCount, readHead, readHorizontal, readOs2, readPost, readVertical, type FontEmbedding } from './font-tables.js'
import { MAX_FONT_BYTES } from './limits.js'

/** The metrics PDFKit lays a line out by, in font units: `unitsPerEm`, and the horizontal header's ascender, descender and line gap. A line is `ascender - descender` units, as `style.ts` says of Roboto's. */
export interface FontMetrics {
  readonly unitsPerEm: number
  readonly ascender: number
  readonly descender: number
  readonly lineGap: number
}

/** What the OS/2 table says of the face, for a person to choose which face it is: a builder proposes, and the person decides, since Roboto Medium, which pdfmake prints as bold, says it is regular. */
export interface FontStyle {
  readonly weight: number
  readonly italic: boolean
  readonly bold: boolean
  readonly regular: boolean
}

/** A font this reader accepts. */
export interface Font {
  readonly ok: true
  readonly names: FontNames
  /** What its fsType allows: installable, preview and print, or editable embedding. */
  readonly embedding: FontEmbedding
  /** The OS/2 fsType as the font states it, for a record of what was read. */
  readonly fsType: number
  readonly metrics: FontMetrics
  readonly style: FontStyle
  /** The glyph count, glyph 0 among them. */
  readonly glyphs: number
  /** The code points it maps to a glyph other than glyph 0, as fontkit maps them (`characterMap`). */
  readonly characters: ReadonlySet<number>
}

/** The tables whose presence makes a font one this does not read, in the order they are looked for, each with its refusal. */
const REFUSED_TABLES: readonly (readonly [string, () => never])[] = [
  ['CFF ', () => refuse('cff', 'has CFF outlines')],
  ['CFF2', () => refuse('cff', 'has CFF2 outlines')],
  ['fvar', () => refuse('variable', 'is a variable font')],
  ['COLR', () => refuse('colour', 'has colour glyphs (COLR)')],
  ['SVG ', () => refuse('colour', 'has colour glyphs (SVG)')],
  ['CBDT', () => refuse('colour', 'has colour bitmap glyphs (CBDT)')],
  ['sbix', () => refuse('colour', 'has colour bitmap glyphs (sbix)')],
]

/** The tables every OpenType font needs, and the two its TrueType outlines are, each of which the reader reads. */
const READ_TABLES = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'glyf', 'loca'] as const

/** A font's bytes, read whole, or the first thing that is wrong with them. */
export function readFont(bytes: Uint8Array): Font | FontRefusal {
  return caught(() => read(bytes))
}

function read(bytes: Uint8Array): Font {
  // What the file is comes first: a collection past the size is told what to export, not only that it is large.
  const sniffed = sniffFont(bytes)
  if (sniffed === undefined) refuse('not-a-font', 'is not a font')
  if (sniffed === 'cff') refuse('cff', 'is an OpenType font with CFF outlines')
  if (sniffed !== 'truetype') refuseSniffed(sniffed)
  if (bytes.length > MAX_FONT_BYTES) refuse('too-large', `is ${bytes.length} bytes, where the most a font may have is ${MAX_FONT_BYTES}`)
  const file = new FontFile(bytes)
  for (const [tag, refused] of REFUSED_TABLES) if (file.has(tag)) refused()
  if (!file.has('glyf') || !file.has('loca')) refuse('no-outlines', 'has no TrueType outlines (glyf and loca)')
  // Each as fontkit sees it: one recorded as empty fontkit does not see at all, and PDFKit then reads a property of nothing.
  for (const tag of READ_TABLES) file.seenTable(tag)
  // A restricted font is refused for its restriction, whatever else is wrong with it.
  const os2 = readOs2(file)
  const header = readHead(file)
  const glyphs = readGlyphCount(file)
  const line = readHorizontal(file, glyphs)
  readVertical(file, glyphs)
  readOutlines(file, glyphs, header.locFormat)
  readPost(file)
  const map = readCharacterMap(file)
  if (map.largestGlyph >= glyphs) refuse('malformed', 'maps a character to a glyph the font does not have')
  return {
    ok: true,
    names: readNames(file),
    embedding: os2.embedding,
    fsType: os2.fsType,
    metrics: { unitsPerEm: header.unitsPerEm, ...line },
    style: { weight: os2.weight, italic: os2.italic, bold: os2.bold, regular: os2.regular },
    glyphs,
    characters: map.characters,
  }
}
