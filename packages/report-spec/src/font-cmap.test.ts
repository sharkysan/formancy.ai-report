import { describe, expect, test, vi } from 'vitest'
import { readFont } from './font.js'
import { characterMap } from './font-cmap.js'
import type { FontRefusal } from './font-refusal.js'
import { AB, cmap, font, format12, format14, format4, hhea, hmtx, maxp, otherFormat, outlines, sfnt, square, u16, u32 } from './font-test-support.js'
import { MAX_FONT_CHARACTERS } from './limits.js'

/**
 * The character map, read as fontkit reads it (0040, extending 0011). The
 * renderer holds every character a report prints to it before pdfmake
 * runs, because pdfmake prints a character its face has no glyph for as
 * nothing and the render succeeds; a map that said a character was there
 * when fontkit, which PDFKit lays text out with, finds glyph 0 would let
 * that loss through, and one that left a mapped character out would refuse
 * text the face prints.
 */

/** The characters a font of this character map is read to map, by `readFont` and by `characterMap`, which must agree. */
function mapped(table: Uint8Array, glyphs = 3): number[] {
  const parts = glyphs === 3 ? { cmap: table } : { cmap: table, glyphs: Array.from({ length: glyphs }, () => square()), maxp: maxp({ glyphs }), hhea: hhea({ metrics: glyphs }), hmtx: hmtx(glyphs, glyphs) }
  const bytes = font(parts)
  const read = readFont(bytes)
  const map = characterMap(bytes)
  if (!read.ok || !map.ok) throw new Error(`refused: ${read.ok ? '' : read.message} ${map.ok ? '' : map.message}`)
  expect([...map.characters]).toEqual([...read.characters])
  return [...read.characters].sort((a, b) => a - b)
}

function refused(table: Uint8Array): FontRefusal {
  const read = readFont(font({ cmap: table }))
  if (read.ok) throw new Error('read')
  return read
}

describe('the subtable read is the one fontkit reads', () => {
  // fontkit 2.0.4 takes (3, 10), (0, 6), (0, 4), (3, 1), (0, 3), (0, 2),
  // (0, 1), (0, 0), in that order, whatever the order of the records. A
  // font whose BMP and full-repertoire subtables disagree prints what the
  // full one maps: reading the other would hold text to a map PDFKit
  // never uses.
  const bmp = format4([{ start: 0x41, end: 0x41, delta: 1 - 0x41 }])
  const full = format12([[0x42, 0x42, 2]])
  test.each([
    ['Windows full repertoire before Windows BMP', [[3, 1, bmp], [3, 10, full]], [0x42]],
    ['Unicode full repertoire before Windows BMP', [[3, 1, bmp], [0, 4, full]], [0x42]],
    ['Windows BMP before Unicode BMP', [[0, 3, full], [3, 1, bmp]], [0x41]],
    ['Unicode 2.0 BMP before the deprecated Unicode 1.1', [[0, 1, full], [0, 3, bmp]], [0x41]],
    ['a deprecated Unicode encoding when it is all there is', [[0, 0, bmp]], [0x41]],
    ['the first of two records of one encoding', [[3, 1, bmp], [3, 1, format4([{ start: 0x42, end: 0x42, delta: 2 - 0x42 }])]], [0x41]],
  ] as const)('%s', (_, subtables, characters) => {
    expect(mapped(cmap(subtables))).toEqual(characters)
  })

  // fontkit's order, read from its CmapProcessor and written out here
  // rather than taken from the reader's own list, pair by pair: each pair's
  // later record listed first, so that a reader that took records in table
  // order, dropped one or swapped two would read the other map.
  const FONTKIT = [[3, 10], [0, 6], [0, 4], [3, 1], [0, 3], [0, 2], [0, 1], [0, 0]] as const
  test.each(FONTKIT.slice(1).map((later, index) => [FONTKIT[index]!, later] as const))('(%j) before (%j)', (earlier, later) => {
    const listed = cmap([[later[0], later[1], format4([{ start: 0x42, end: 0x42, delta: 2 - 0x42 }])], [earlier[0], earlier[1], format4([{ start: 0x41, end: 0x41, delta: 1 - 0x41 }])]])
    expect(mapped(listed)).toEqual([0x41])
  })

  // A symbol font's (3, 0) map, a Macintosh Roman one or a custom one are
  // encodings fontkit re-encodes text into; the renderer holds Unicode.
  test.each([
    ['Windows symbol', 3, 0],
    ['Macintosh Roman', 1, 0],
    ['Unicode variation sequences alone', 0, 5],
    ['custom', 4, 0],
  ])('a %s map alone is no Unicode map', (_, platform, encoding) => {
    expect(refused(cmap([[platform, encoding, format4(AB)]]))).toEqual({ ok: false, code: 'character-map', message: 'has no Unicode character map in format 4 or 12; use a font that maps Unicode characters to its glyphs' })
  })

  // Formats 4 and 12 are the two the specification recommends for Unicode;
  // a font whose chosen subtable is in another is refused, not read past.
  test.each([0, 2, 6, 8, 10, 13, 14])('the chosen subtable in format %i is refused', (format) => {
    expect(refused(cmap([[3, 1, otherFormat(format)]]))).toMatchObject({ code: 'character-map', message: `maps Unicode in a subtable of format ${format}, where formats 4 and 12 are read; use a font that maps Unicode characters to its glyphs` })
  })

  // A version the specification does not define may lay its records out otherwise; they are not read as version 0's.
  test('a character map of a version other than 0 is refused', () => {
    expect(refused(cmap([[3, 1, format4(AB)]], { version: 1 }))).toMatchObject({ code: 'malformed', message: expect.stringContaining('has a character map of a version the specification does not define') as string })
  })

  // A face that maps nothing would refuse every character a report prints, after a host had kept it as a font.
  test('a map that maps nothing is refused', () => {
    expect(refused(cmap([[3, 1, format4([])]]))).toMatchObject({ code: 'character-map', message: expect.stringContaining('maps no character to a glyph') as string })
  })
})

describe('format 4', () => {
  // A segment maps by its delta, modulo 65,536, or through the glyph array,
  // where an index of 0 is no glyph and a non-zero one takes the delta too.
  test('maps by delta, modulo 65,536', () => {
    expect(mapped(cmap([[3, 1, format4([{ start: 0x41, end: 0x42, delta: 0xffc0 }, { start: 0xfffe, end: 0xfffe, delta: 3 }])]]))).toEqual([0x41, 0x42, 0xfffe])
  })

  test('maps through the glyph array, an index of 0 mapping nothing and every other taking the delta, modulo 65,536', () => {
    expect(mapped(cmap([[3, 1, format4([{ start: 0x30, end: 0x32, glyphs: [1, 0, 2], delta: 0 }, { start: 0x40, end: 0x41, glyphs: [0xffff, 0xfffe], delta: 2 }])]]))).toEqual([0x30, 0x32, 0x40])
  })

  // The final segment, 0xFFFF to glyph 0, maps nothing; a font may map U+FFFF otherwise.
  test('the final 0xFFFF segment maps nothing by its delta of 1', () => {
    expect(mapped(cmap([[3, 1, format4(AB)]]))).toEqual([0x41, 0x42])
  })

  // fontkit's glyph array ends where the subtable's length says, and an
  // index outside it is glyph 0: what the specification's pointer would
  // read past the array, fontkit reads as no glyph, and so does this.
  test('an index past the glyph array is no glyph, as fontkit reads it', () => {
    expect(mapped(cmap([[3, 1, format4([{ start: 0x41, end: 0x41, delta: 1 - 0x41 }, { start: 0x50, end: 0x52, rangeOffset: 2 }])]]))).toEqual([0x41])
  })

  // An idRangeOffset smaller than the arrays after it points the
  // specification's pointer back into the idRangeOffset array, where
  // fontkit's bounded array finds no index and reads glyph 0. Here U+0050's
  // pointer lands on the next segment's idRangeOffset, 2, not 0: read as a
  // glyph index, it would map U+0050 to glyph 2, which PDFKit never draws.
  test('an index before the glyph array is no glyph, as fontkit reads it', () => {
    const segments = [{ start: 0x41, end: 0x41, delta: 1 - 0x41 }, { start: 0x50, end: 0x50, rangeOffset: 2 }, { start: 0x60, end: 0x60, rangeOffset: 2 }]
    expect(mapped(cmap([[3, 1, format4(segments)]]))).toEqual([0x41])
  })

  // fontkit binary-searches the segments. Out of order, overlapping or
  // reversed, a search and a walk find different glyphs, and the map would
  // say what PDFKit does not draw.
  test.each([
    ['out of order', [{ start: 0x50, end: 0x50, delta: 1 }, { start: 0x41, end: 0x41, delta: 1 }]],
    ['overlapping', [{ start: 0x41, end: 0x45, delta: 1 }, { start: 0x45, end: 0x46, delta: 1 }]],
    ['reversed', [{ start: 0x45, end: 0x41, delta: 1 }]],
  ])('segments %s are refused', (_, segments) => {
    expect(refused(cmap([[3, 1, format4(segments)]]))).toMatchObject({ code: 'malformed', message: expect.stringContaining('whose segments are out of order or overlap') as string })
  })

  test.each([
    ['an odd idRangeOffset, which fontkit reads between two indices', format4([{ start: 0x41, end: 0x41, rangeOffset: 3 }]), 'with an odd idRangeOffset'],
    ['an odd segCountX2', format4(AB, { segCountX2: 3 }), 'of an odd length'],
    ['an odd length', format4(AB, { length: 39 }), 'of an odd length'],
    ['a length shorter than its segments', format4(AB, { length: 24 }), 'shorter than its segments'],
  ])('%s is refused', (_, table, said) => {
    expect(refused(cmap([[3, 1, table]]))).toMatchObject({ code: 'malformed', message: expect.stringContaining(said) as string })
  })

  // fontkit reads the glyph array to the length the subtable states: one past the file throws inside pdfmake.
  test('a subtable whose length runs past the file is refused', () => {
    expect(refused(cmap([[3, 1, format4(AB, { length: 0xfff0 })]]))).toMatchObject({ code: 'malformed', message: expect.stringContaining('has its character map table (cmap) cut off') as string })
  })
})

describe('format 12', () => {
  // Beyond the BMP: an emoji, a CJK extension, a historic script, each a
  // character a format 4 map cannot hold and PDFKit lays out from this one.
  test('maps groups beyond the BMP, each code point to the glyph after the last', () => {
    expect(mapped(cmap([[3, 10, format12([[0x41, 0x42, 1], [0x1f600, 0x1f601, 3]])]]), 5)).toEqual([0x41, 0x42, 0x1f600, 0x1f601])
  })

  // Glyph 0 is no glyph: a group that starts at it maps its first code point to nothing.
  test('a group from glyph 0 maps its first code point to nothing', () => {
    expect(mapped(cmap([[3, 10, format12([[0x40, 0x42, 0]])]]))).toEqual([0x41, 0x42])
  })

  // fontkit binary-searches the groups, as it does format 4's segments: out
  // of order, overlapping or reversed, a search and a walk find different
  // glyphs.
  test.each([
    ['out of order', [[0x50, 0x50, 1], [0x41, 0x41, 1]]],
    ['overlapping', [[0x41, 0x45, 1], [0x45, 0x46, 1]]],
    ['reversed', [[0x45, 0x41, 1]]],
  ] as const)('groups %s are refused', (_, groups) => {
    expect(refused(cmap([[3, 10, format12(groups)]]))).toMatchObject({ code: 'malformed', message: expect.stringContaining('whose groups are out of order or overlap') as string })
  })

  // A code point past U+10FFFF is no character a report can print; a map that counted one would count past what text can hold.
  test('a group past the last code point Unicode has is refused', () => {
    expect(refused(cmap([[3, 10, format12([[0x10ffff, 0x110000, 1]])]]))).toMatchObject({ code: 'malformed', message: expect.stringContaining('maps past the last Unicode code point') as string })
  })

  // A count of groups is checked against the bytes it counts before a group is read by it.
  test('groups past the subtable length are refused before one is read', () => {
    expect(refused(cmap([[3, 10, format12([[0x41, 0x42, 1]], { length: 20 })]]))).toMatchObject({ code: 'malformed', message: expect.stringContaining('shorter than its groups') as string })
  })

  // A kilobyte of format 12 can map every code point there is, a Set of a
  // million entries -- 150 ms and 60 to 80 MiB in Node, measured -- from a
  // font a server was handed. The groups are summed first, and refused
  // past the bound before a code point is added.
  test(`maps ${MAX_FONT_CHARACTERS} characters, and refuses one more before adding one`, () => {
    const at = (count: number): Uint8Array => cmap([[3, 10, format12([[0x20, 0x20 + count - 1, 1]])]])
    // Glyph indices run past the glyph count here; characterMap reads the map alone and does not hold them to it.
    const largest = characterMap(sfnt([['cmap', at(MAX_FONT_CHARACTERS)]]))
    expect(largest.ok && largest.characters.size).toBe(MAX_FONT_CHARACTERS)
    // Every code point the reader maps is added to a Set: none is, before the refusal.
    const added = vi.spyOn(Set.prototype, 'add')
    const refused = characterMap(sfnt([['cmap', at(MAX_FONT_CHARACTERS + 1)]]))
    const adds = added.mock.calls.length
    added.mockRestore()
    expect(adds).toBe(0)
    expect(refused).toEqual({ ok: false, code: 'too-large', message: `maps ${MAX_FONT_CHARACTERS + 1} characters, where the most a font may map is ${MAX_FONT_CHARACTERS}; use a font file that holds fewer scripts` })
  })
})

describe('the variation sequences', () => {
  // fontkit decodes the first (0, 5) subtable's header when it first lays
  // text out, and every sequence it holds for a character followed by a
  // variation selector. A subtable it cannot decode throws inside pdfmake,
  // and a sequence to a glyph the font lacks prints nothing.
  const sequences = (subtable: Uint8Array): Uint8Array => cmap([[3, 1, format4(AB)], [0, 5, subtable]])

  // Myanmar Text and Phags-pa carry one; they map what their main map maps.
  test('in format 14, with default and non-default sequences, are read and map no character of their own', () => {
    expect(mapped(sequences(format14([{ selector: 0xfe00, defaults: [[0x41, 1]], mappings: [[0x41, 2], [0x50, 1]] }, { selector: 0xfe01 }])))).toEqual([0x41, 0x42])
  })

  // The specification gives (0, 5) format 14 alone; fontkit throws on a format it does not know.
  test('in another format are refused', () => {
    expect(refused(sequences(format4(AB)))).toMatchObject({ code: 'malformed', message: expect.stringContaining('has a variation sequences subtable in a format other than 14') as string })
  })

  // fontkit reads the first record of (0, 5) alone; refusing a font for a second it never reads would refuse a font PDFKit prints.
  test('after the first are not read', () => {
    expect(mapped(cmap([[0, 5, format14([{ selector: 0xfe00 }])], [0, 5, otherFormat(99)], [3, 1, format4(AB)]]))).toEqual([0x41, 0x42])
  })

  test.each([
    ['records past its length', format14([{ selector: 0xfe00 }], { length: 20 }), 'has a variation sequences subtable shorter than its records'],
    // The subtable says it ends after its one record; the array the record points to begins there and runs past the file.
    ['a default array past the end of the file', format14([{ selector: 0xfe00, defaults: [[0x41, 0]] }], { length: 21 }).subarray(0, 25), 'has its character map table (cmap) cut off'],
    ['a non-default array past the end of the file', format14([{ selector: 0xfe00, mappings: [[0x41, 1]] }], { length: 21 }).subarray(0, 25), 'has its character map table (cmap) cut off'],
  ])('%s are refused', (_, subtable, said) => {
    expect(refusalOf(font({ cmap: sequences(subtable), last: 'cmap' }))).toMatchObject({ code: 'malformed', message: expect.stringContaining(said) as string })
  })

  // A sequence to a glyph past the font's count would print nothing for text the renderer held to the map.
  test('to a glyph the font does not have are refused', () => {
    expect(refused(sequences(format14([{ selector: 0xfe00, mappings: [[0x41, 3]] }])))).toMatchObject({ code: 'malformed', message: expect.stringContaining('maps a character to a glyph the font does not have') as string })
  })

  // fontkit decodes every record's arrays whenever it looks a sequence up:
  // 400 records at one array of 800 mappings are 1.6 MB decoded from a
  // font of a few kilobytes. Their sizes may add up to no more than the font.
  test("whose arrays add up to more than the font's bytes are refused", () => {
    const records = 400
    const mappings = 800
    const array = 10 + 11 * records
    const bytes = [...u16(14), ...u32(array + 4 + 5 * mappings), ...u32(records)]
    for (let index = 0; index < records; index++) bytes.push(0x00, 0xfe, index & 0xff, ...u32(0), ...u32(array))
    bytes.push(...u32(mappings))
    for (let index = 0; index < mappings; index++) bytes.push(0x00, 0x01, index & 0xff, ...u16(1))
    const many = Uint8Array.from(bytes)
    expect(refused(sequences(many))).toMatchObject({ code: 'malformed', message: expect.stringContaining('has variation sequences that add up to more bytes than the font holds') as string })
  })
})

function refusalOf(bytes: Uint8Array): FontRefusal {
  const read = readFont(bytes)
  if (read.ok) throw new Error('read')
  return read
}

describe('characterMap', () => {
  // The renderer reads its own faces' maps with this alone (`glyphs.ts`):
  // the directory and the character map of any sfnt, the version unread.
  test('reads the character map of an sfnt of no other table', () => {
    expect(characterMap(sfnt([['cmap', cmap([[3, 1, format4(AB)]])]], 0))).toEqual({ ok: true, characters: new Set([0x41, 0x42]) })
  })

  // The renderer reads its own faces with this alone: a face of its that the map could not be read from throws in a test, never at print.
  test('refuses an sfnt without a character map, and never throws on one cut short', () => {
    expect(characterMap(new Uint8Array(12))).toEqual({ ok: false, code: 'malformed', message: 'has no character map table (cmap); save the font again from the program it was made in, or ask its vendor for a sound file' })
    const whole = sfnt([['cmap', cmap([[3, 1, format4(AB)], [3, 10, format12([[0x1f600, 0x1f600, 1]])]])]])
    for (let length = 0; length < whole.length; length++) expect(characterMap(whole.subarray(0, length)).ok, `${length} bytes`).toBe(false)
  })

  // The renderer's own test faces record their character map's length as
  // 0, and the renderer reads the faces it ships with this: a length it
  // held them to would refuse them. `readFont`, which judges a font fontkit
  // must print, refuses a table recorded as empty (`font.test.ts`).
  test('reads a character map whatever length the directory records for it', () => {
    const bytes = sfnt([['cmap', cmap([[3, 1, format4(AB)]])]])
    new DataView(bytes.buffer).setUint32(12 + 12, 0)
    expect(characterMap(bytes)).toEqual({ ok: true, characters: new Set([0x41, 0x42]) })
  })

  // The glyph count is the font's, which `readFont` holds the map to; the map alone cannot.
  test('does not hold glyph indices to a glyph count it does not read', () => {
    const { glyf } = outlines([square()])
    expect(characterMap(sfnt([['cmap', cmap([[3, 1, format4([{ start: 0x41, end: 0x41, delta: 0x1000 - 0x41 }])]])], ['glyf', glyf]]))).toMatchObject({ ok: true })
  })
})
