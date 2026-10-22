import { describe, expect, test } from 'vitest'
import { BIDI_CONTROLS, PRINTED_BLOCKS, refusedCharacter, UNICODE_VERSION } from './font-scripts.js'

/**
 * The characters a report prints (0043, FT-Q16): Latin, Greek and Cyrillic
 * and what is written with them, by the Unicode blocks that hold them, and
 * nothing else, in any face. An allowlist, so a script nobody listed is
 * refused rather than printed unshaped or out of order. The blocks' bounds
 * are Unicode's `Blocks.txt` 18.0.0 and the controls its `PropList.txt`;
 * report-render-pdf's `scripts.test.ts` holds every listed character to the
 * script fontkit's own Unicode data gives it.
 */

describe('refusedCharacter', () => {
  // The version the bounds were read from, which a later Unicode's re-read
  // changes here and in 0043 together.
  test('is read from a stated Unicode version', () => {
    expect(UNICODE_VERSION).toBe('18.0.0')
  })

  // What business text in Latin, Greek and Cyrillic is written with prints:
  // letters, combining marks, punctuation, currency and symbols, the Latin
  // ligatures a face maps, a private-use glyph, and the byte-order mark and
  // replacement character data carries, which 0.2.0 printed in Roboto.
  test.each([
    ['Basic Latin A', 0x41],
    ['Latin-1 ä', 0xe4],
    ['Latin Extended-A ł', 0x142],
    ['a combining acute', 0x301],
    ['Greek alpha', 0x3b1],
    ['Cyrillic De', 0x414],
    ['Vietnamese ạ', 0x1ea1],
    ['a narrow no-break space', 0x202f],
    ['the per-mille sign', 0x2030],
    ['the euro sign', 0x20ac],
    ['the numero sign', 0x2116],
    ['a vulgar fraction', 0x215b],
    ['a right arrow', 0x2192],
    ['a check mark', 0x2713],
    ['a Latin ligature fi', 0xfb01],
    ['a private-use glyph', 0xee01],
    ['the byte-order mark', 0xfeff],
    ['the replacement character', 0xfffd],
  ])('prints %s', (_, point) => {
    expect(refusedCharacter(point)).toBeUndefined()
  })

  // A script nobody here has proved is refused wherever it is, the ones a
  // denylist missed among them: right-to-left scripts in and beyond the
  // BMP, shaping scripts, CJK and Kana, and the simple scripts Latin,
  // Greek and Cyrillic are not.
  test.each([
    ['Hebrew alef', 0x05d0],
    ['Arabic alef', 0x0627],
    ['Thaana', 0x0780],
    ['Adlam', 0x1e900],
    ['Hanifi Rohingya', 0x10d00],
    ['Phoenician', 0x10900],
    ['Devanagari ka', 0x0915],
    ['Tibetan ka', 0x0f40],
    ['Mongolian a', 0x1820],
    ['Thai ko kai', 0x0e01],
    ['Lao ko', 0x0e81],
    ['Myanmar ka', 0x1000],
    ['Khmer ka', 0x1780],
    ['Balinese', 0x1b05],
    ['Javanese', 0xa984],
    ['Brahmi', 0x11005],
    ['Vedic', 0x1cd0],
    ['a Han ideograph', 0x4e00],
    ['Hiragana a', 0x3042],
    ['an ideographic comma', 0x3001],
    ['a Hangul syllable', 0xac00],
    ['Tangut', 0x17000],
    ['Kana Extended-B', 0x1aff0],
    ['a vertical form', 0xfe10],
    ['a fullwidth A', 0xff21],
    ['a Bopomofo tone mark', 0x02ea],
    ['Coptic shei', 0x03e2],
    ['Armenian Ayb', 0x0531],
    ['an Armenian ligature', 0xfb13],
    ['a Hebrew presentation form', 0xfb1d],
    ['an Arabic presentation form', 0xfefb],
    ['Georgian an', 0x10d0],
    ['Ethiopic ha', 0x1200],
    ['Braille', 0x2801],
    ['an emoji', 0x1f600],
    ['a variation selector', 0xfe0f],
  ])('refuses %s', (_, point) => {
    expect(refusedCharacter(point)).toBe('script')
  })

  // A bidirectional control inside General Punctuation, which prints: pdfmake
  // lays text out left to right alone, and fontkit draws a control as a
  // space, so "abc‮def" would print "abc def" where a reader reorders it.
  test.each([...BIDI_CONTROLS].map((point) => [point.toString(16).toUpperCase(), point]))('refuses the bidirectional control U+%s', (_, point) => {
    expect(refusedCharacter(point)).toBe('bidi-control')
  })

  // PropList.txt 18.0.0's Bidi_Control, but for U+061C, which is in the
  // Arabic block and refused with it; their neighbours in General
  // Punctuation print.
  test('names the bidirectional controls PropList.txt does, and none of their neighbours', () => {
    expect([...BIDI_CONTROLS]).toEqual([0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069])
    for (const point of [0x200d, 0x2010, 0x2029, 0x202f, 0x2065, 0x206a]) expect(refusedCharacter(point), point.toString(16)).toBeUndefined()
  })
})

describe('PRINTED_BLOCKS', () => {
  // Blocks.txt starts every block at a multiple of 16 and ends it one short
  // of the next: a whole block that does not is a typo. The parts of blocks
  // taken alone say so in their names, and are these.
  test('takes whole blocks, but for the parts it names', () => {
    const whole = PRINTED_BLOCKS.filter((entry) => !entry.block.includes('('))
    for (const entry of whole) expect([entry.from % 16, entry.to % 16], entry.block).toEqual([0, 15])
    const parts = PRINTED_BLOCKS.filter((entry) => entry.block.includes('(')).map((entry) => entry.block)
    expect(parts).toEqual([
      'Spacing Modifier Letters (before the Bopomofo tone marks)',
      'Spacing Modifier Letters (after the Bopomofo tone marks)',
      'Greek and Coptic (before the Coptic letters)',
      'Greek and Coptic (after the Coptic letters)',
      'Alphabetic Presentation Forms (the Latin ligatures)',
      'Arabic Presentation Forms-B (the byte-order mark)',
      'Specials (the object replacement and replacement characters)',
    ])
  })

  // Low to high and apart: the search halves the list, so an entry out of
  // order or overlapping another would hide a block, or print one that is
  // not listed.
  test('lists its blocks in code-point order, none overlapping another', () => {
    for (const entry of PRINTED_BLOCKS) expect(entry.from, entry.block).toBeLessThanOrEqual(entry.to)
    for (let index = 1; index < PRINTED_BLOCKS.length; index += 1) expect(PRINTED_BLOCKS[index]!.from, PRINTED_BLOCKS[index]!.block).toBeGreaterThan(PRINTED_BLOCKS[index - 1]!.to)
  })

  // Every bound holds: the first and the last code point of each entry
  // print, and the one just outside each is refused unless the next entry
  // starts there. A bound one short, or one past into a script nobody
  // listed, fails here.
  test('prints each entry to its bounds, and nothing just outside them', () => {
    const printed = (point: number): boolean => PRINTED_BLOCKS.some((entry) => point >= entry.from && point <= entry.to)
    for (const entry of PRINTED_BLOCKS) {
      expect(refusedCharacter(entry.from) ?? 'printed', entry.block).not.toBe('script')
      expect(refusedCharacter(entry.to) ?? 'printed', entry.block).not.toBe('script')
      if (entry.from > 0 && !printed(entry.from - 1)) expect(refusedCharacter(entry.from - 1), entry.block).toBe('script')
      if (!printed(entry.to + 1)) expect(refusedCharacter(entry.to + 1), entry.block).toBe('script')
    }
  })

  // Nothing past the Basic Multilingual Plane prints: no block there is
  // listed, so a code point there is refused, the highest among them.
  test('lists nothing beyond the Basic Multilingual Plane', () => {
    expect(PRINTED_BLOCKS.every((entry) => entry.to <= 0xffff)).toBe(true)
    expect(refusedCharacter(0x10ffff)).toBe('script')
  })
})
