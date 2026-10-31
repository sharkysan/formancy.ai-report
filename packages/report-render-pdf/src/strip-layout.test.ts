import { readFont } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { LAYOUT_TABLES, withoutLayoutTables } from './strip-layout.js'
import { FONTKIT_VERSION, fontkit, LIBERATION_REGULAR, layOutInWorker, NEVER_ADVANCING, THROWING } from './testing/fonts.js'

/**
 * The layout tables stripped from a host face before the renderer embeds it
 * (0043): the risk 0040 left open. fontkit runs GSUB, GPOS, kern and the
 * AAT `morx` state machine on every run PDFKit lays out, report-spec's
 * reader reads none of them, and a pass cannot be interrupted (0011). Here
 * the strip is held on its own, against the fontkit PDFKit loads, on the
 * shipped Liberation Sans and on two faces crafted from it that the reader
 * accepts: one whose `morx` never advances, which held PDFKit past twenty
 * seconds in 0040, and one whose GSUB fontkit throws on. That the render
 * embeds what this returns is `host-fonts.test.ts`'s.
 *
 * A face that may never finish is laid out in a worker that is stopped
 * after two seconds, where the stripped faces answered in about 0.13 s,
 * worker included, on 22 October 2026 (an Intel i9-10900K, shared with
 * two other workflows' builds); one that finishes has ten.
 */

const ids = (run: readonly { readonly id: number }[]): number[] => run.map((glyph) => glyph.id)

/** Long enough for a face that finishes, on a loaded runner. */
const FINISHES = 10_000
/** How long a face that never finishes is given to answer. */
const HANGS = 2_000

describe('withoutLayoutTables', () => {
  // LAYOUT_TABLES was read from fontkit 2.0.4's LayoutEngine and its
  // OpenType and AAT engines: the tables they read are these five, and no
  // other. A fontkit of another version may read another, and this list,
  // and 0043's claim that no host face can hang a render, would no longer
  // be known to hold; this fails first, and the review is read again.
  test('was read from the fontkit PDFKit loads', () => {
    expect(FONTKIT_VERSION).toBe('2.0.4')
    expect(LAYOUT_TABLES).toEqual(['GSUB', 'GPOS', 'GDEF', 'kern', 'morx'])
  })

  // Liberation Sans carries the OpenType tables and kern; fontkit sees each
  // one, and builds an OpenType engine that it runs on every word.
  test('the shipped face carries the OpenType and kern tables fontkit runs', () => {
    const font = fontkit.create(Buffer.from(LIBERATION_REGULAR))
    expect(Boolean(font.GSUB)).toBe(true)
    expect(Boolean(font.GPOS)).toBe(true)
    expect(Boolean(font.GDEF)).toBe(true)
    expect(Boolean(font.kern)).toBe(true)
    expect(font._layoutEngine.engine).not.toBeNull()
  })

  // After the strip fontkit sees none of them, builds no advanced engine,
  // and lays text out by the one-glyph-per-code-point mapping -- bounded by
  // the text's length -- mapping the same glyphs the character map does.
  test('leaves fontkit no layout engine, and the same glyphs', () => {
    const font = fontkit.create(Buffer.from(withoutLayoutTables(LIBERATION_REGULAR)))
    expect(font.GSUB).toBeUndefined()
    expect(font.GPOS).toBeUndefined()
    expect(font.GDEF).toBeUndefined()
    expect(font.kern).toBeUndefined()
    expect(font._layoutEngine.engine).toBeUndefined()
    const text = 'Zürich Genève — 1234'
    expect(ids(font.layout(text).glyphs)).toEqual(ids(font.glyphsForString(text)))
  })

  // The strip keeps the font a font, and leaves the bytes the report pinned
  // as they were: readFont reads the copy, and the original keeps its tables.
  test('reads as a font, and copies rather than changes the bytes it is given', () => {
    const before = Uint8Array.from(LIBERATION_REGULAR)
    expect(readFont(withoutLayoutTables(LIBERATION_REGULAR)).ok).toBe(true)
    expect(Buffer.from(LIBERATION_REGULAR).equals(Buffer.from(before))).toBe(true)
  })

  // The strip reads a directory only where the bytes hold it: bytes too
  // short for a header, or for the records the header counts, come back as
  // they were rather than as a RangeError out of a render. readFont refuses
  // both before the strip ever sees them.
  test('returns bytes too short for their directory as they are', () => {
    const short = Uint8Array.from([0, 1, 0, 0])
    expect(withoutLayoutTables(short)).toBe(short)
    const counted = Uint8Array.from(LIBERATION_REGULAR.subarray(0, 12 + 16))
    expect(withoutLayoutTables(counted)).toBe(counted)
  })

  // The risk 0040 named, as it measured it: the reader accepts the face,
  // fontkit chooses its AAT state machine for it, and laying one 'A' out in
  // it does not end; stripped, fontkit chooses no engine, and fontkit and
  // PDFKit lay the 'A' out and embed it.
  test(
    'a morx that never advances hangs fontkit, and stripped is laid out and embedded',
    async () => {
      expect(readFont(NEVER_ADVANCING).ok).toBe(true)
      expect(fontkit.create(Buffer.from(NEVER_ADVANCING))._layoutEngine.engine?.morxProcessor).toBeDefined()
      expect(await layOutInWorker(NEVER_ADVANCING, 'A', HANGS)).toBe('no answer')
      const stripped = withoutLayoutTables(NEVER_ADVANCING)
      expect(fontkit.create(Buffer.from(stripped))._layoutEngine.engine).toBeUndefined()
      expect(await layOutInWorker(stripped, 'A', FINISHES)).toBe('laid out')
    },
    FINISHES + HANGS + 5_000,
  )

  // A GSUB fontkit cannot read throws out of pdfmake as a plain error, not
  // a refusal; stripped, the same text is laid out, glyph for glyph.
  test(
    'a GSUB fontkit throws on is laid out once stripped',
    async () => {
      expect(readFont(THROWING).ok).toBe(true)
      expect(() => fontkit.create(Buffer.from(THROWING)).layout('Af')).toThrow(/Unknown version 10/)
      const font = fontkit.create(Buffer.from(withoutLayoutTables(THROWING)))
      expect(ids(font.layout('Af').glyphs)).toEqual(ids(font.glyphsForString('Af')))
      expect(await layOutInWorker(withoutLayoutTables(THROWING), 'Af', FINISHES)).toBe('laid out')
    },
    FINISHES + 5_000,
  )
})
