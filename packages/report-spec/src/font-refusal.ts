/**
 * How a font is refused: the codes, what a person can do about each, and
 * the refusal the reader throws where it finds a fault and catches once, at
 * its edge (0040).
 *
 * A refusal names what was found and where, by the name of a table this
 * reader knows, never a byte of the font: no name string, no tag a font
 * invented, no text of its licence. Numbers the reader decoded -- a
 * version, a format, the offset where a table runs out -- are said in the
 * reader's own digits, so a message holds nothing a font chose but a
 * number.
 */

/** Why a font is refused, each the first thing found that is wrong with it. */
export const FONT_REFUSAL_CODES = [
  /** Not a font in any format this recognises. */
  'not-a-font',
  /** A font in a format other than one TrueType font file: a collection, WOFF, WOFF2, EOT or Type 1 (`FONT_FORMATS`). */
  'format',
  /** CFF or CFF2 outlines: an OpenType font of `OTTO`, or a 'CFF ' or CFF2 table. */
  'cff',
  /** A variable font: an fvar table. */
  'variable',
  /** Colour glyphs, which PDFKit does not draw: a COLR, 'SVG ', CBDT or sbix table. */
  'colour',
  /** No TrueType outlines: no glyf or loca table, or not one glyph with a contour. */
  'no-outlines',
  /** An OS/2 fsType that does not allow embedding a subset of the outlines (`FONT_EMBEDDING_REFUSALS`). */
  'embedding',
  /** No Unicode character map in format 4 or 12 where PDFKit's fontkit looks for one, one that maps nothing, or a last-resort font's. */
  'character-map',
  /** A table, a record or a field the specification does not allow, or one that runs past the end of the file. */
  'malformed',
  /** Past `MAX_FONT_BYTES`, mapping more characters than `MAX_FONT_CHARACTERS`, or a glyph whose points times contours are past `MAX_FONT_GLYPH_WORK`. */
  'too-large',
] as const
export type FontRefusalCode = (typeof FONT_REFUSAL_CODES)[number]

/** The font formats a `format` refusal names. */
export const FONT_FORMATS = [
  /** A TrueType or OpenType collection, `ttcf`: several fonts in one file. */
  'collection',
  /** WOFF 1.0. */
  'woff',
  /** WOFF 2.0. */
  'woff2',
  /** Embedded OpenType, Microsoft's web font. */
  'eot',
  /** A PostScript Type 1 font, as a PFB, a PFA or an sfnt of `typ1`. */
  'type-1',
] as const
export type FontFormat = (typeof FONT_FORMATS)[number]

/** Why an fsType refuses embedding, each the first found, in this order. */
export const FONT_EMBEDDING_REFUSALS = [
  /** A value or an OS/2 version the specification does not define: bit 0, several usage bits in version 3 or later, a version past 5. */
  'invalid',
  /** Restricted License embedding: the usage bits read as 2. */
  'restricted',
  /** Bitmap embedding only (bit 9), from version 2: PDFKit embeds outlines. */
  'bitmap-only',
  /** No subsetting (bit 8), from version 2: PDFKit always embeds a subset. */
  'no-subsetting',
] as const
export type FontEmbeddingRefusal = (typeof FONT_EMBEDDING_REFUSALS)[number]

/** A refusal, said in English after the font's name -- the renderer says `the font ${message}` -- with, for a format or an embedding, which one, for a person's own language. */
export type FontRefusal =
  | { readonly ok: false; readonly code: Exclude<FontRefusalCode, 'format' | 'embedding'>; readonly message: string }
  | { readonly ok: false; readonly code: 'format'; readonly message: string; readonly format: FontFormat }
  | { readonly ok: false; readonly code: 'embedding'; readonly message: string; readonly embedding: FontEmbeddingRefusal }

/**
 * What a person can do about each kind of refusal, said after what was
 * found. A font is what a person who brought their brand's typeface is
 * shown refused, so each one says what to ask for or export instead.
 */
export const FONT_ADVICE: { readonly [C in FontRefusalCode]: string } = {
  'not-a-font': 'add the font as a TrueType file (.ttf)',
  format: 'export the face to use as a TrueType font file (.ttf)',
  cff: 'use the TrueType edition of the font (.ttf), which most foundries ship beside the OpenType CFF one (.otf)',
  variable: 'use a static instance of the font, one .ttf file for each weight and style',
  colour: 'use a font whose glyphs are outlines alone',
  'no-outlines': 'use a font with TrueType outlines',
  embedding: "ask the font's vendor for a licence and a file that allow embedding a subset in a PDF",
  'character-map': 'use a font that maps Unicode characters to its glyphs',
  malformed: 'save the font again from the program it was made in, or ask its vendor for a sound file',
  'too-large': 'use a font file that holds fewer scripts',
}

/**
 * A refusal on its way out of the reader. It is thrown where the fault is
 * found, deep in a table, and caught once, at `readFont`'s or
 * `characterMap`'s edge, so that nothing partly read is ever returned; any
 * other error is the reader's own fault, and is let through for a test to
 * find.
 */
export class FontRefused extends Error {
  readonly refusal: FontRefusal

  constructor(refusal: FontRefusal) {
    super(refusal.message)
    this.refusal = refusal
  }
}

/** Refused, with what was found (`what`) and what to do, the code's own advice unless the refusal knows something more particular. */
export function refuse(code: Exclude<FontRefusalCode, 'format' | 'embedding'>, what: string, advice: string = FONT_ADVICE[code]): never {
  throw new FontRefused({ ok: false, code, message: `${what}; ${advice}` })
}

/** Refused as a format this does not read. */
export function refuseFormat(format: FontFormat, what: string): never {
  throw new FontRefused({ ok: false, code: 'format', format, message: `${what}; ${FONT_ADVICE.format}` })
}

/** Refused for what its fsType says of embedding. */
export function refuseEmbedding(embedding: FontEmbeddingRefusal, what: string): never {
  throw new FontRefused({ ok: false, code: 'embedding', embedding, message: `${what}; ${FONT_ADVICE.embedding}` })
}

/** The refusal `read` throws, or what it returns. */
export function caught<T>(read: () => T): T | FontRefusal {
  try {
    return read()
  } catch (error) {
    if (error instanceof FontRefused) return error.refusal
    throw error
  }
}
