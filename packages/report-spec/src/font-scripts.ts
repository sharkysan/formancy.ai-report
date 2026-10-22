/**
 * The characters a report prints, by code point (0043, FT-Q16).
 *
 * pdfmake lays text out left to right and reorders nothing, and the
 * renderer removes a host face's layout tables before it embeds it
 * (report-render-pdf's `strip-layout.ts`), so fontkit substitutes and
 * positions nothing at print either: each character prints as the glyph
 * its face maps it to. That prints Latin, Greek and Cyrillic, and the
 * punctuation, symbols and combining marks written with them, which the
 * corpus proves on the PDF. It does not print a right-to-left script, a
 * script whose letters join or reorder, or CJK, and nothing here has proved
 * any other. So the list is of what prints, not of what is refused: a
 * character prints only where it lies in one of `PRINTED_BLOCKS` and is not
 * one of `BIDI_CONTROLS`, and every other is refused, in any face, Roboto's
 * included, until a fixture proves its script.
 *
 * The bounds are Unicode's blocks, read from `Blocks.txt` 18.0.0, and the
 * controls are its `PropList.txt`'s Bidi_Control; 0043 gives both files'
 * addresses and digests. Seven entries take part of a block and say so in
 * their names: Spacing Modifier Letters and Greek and Coptic each in two,
 * around the Bopomofo tone marks and the Coptic letters they hold; the
 * Latin ligatures of Alphabetic Presentation Forms, whose rest is Armenian
 * and Hebrew; the byte-order mark alone of Arabic Presentation Forms-B; and
 * the two replacement characters of Specials.
 * `font-scripts.test.ts` holds each entry's bounds and order, and
 * report-render-pdf's `scripts.test.ts` every character of every entry to
 * the script fontkit's own Unicode data gives it; that the bounds are
 * Blocks.txt's is review-held.
 */

/** The Unicode version the blocks and the controls were read from. */
export const UNICODE_VERSION = '18.0.0'

/** A run of code points that prints: a block, or the named part of one, with its inclusive bounds. */
export interface PrintedBlock {
  readonly block: string
  readonly from: number
  readonly to: number
}

/** What prints, in code-point order, every entry in the Basic Multilingual Plane. */
export const PRINTED_BLOCKS: readonly PrintedBlock[] = [
  // Latin, Greek and Cyrillic, and the marks and modifiers written with them.
  { block: 'Basic Latin', from: 0x0000, to: 0x007f },
  { block: 'Latin-1 Supplement', from: 0x0080, to: 0x00ff },
  { block: 'Latin Extended-A', from: 0x0100, to: 0x017f },
  { block: 'Latin Extended-B', from: 0x0180, to: 0x024f },
  { block: 'IPA Extensions', from: 0x0250, to: 0x02af },
  { block: 'Spacing Modifier Letters (before the Bopomofo tone marks)', from: 0x02b0, to: 0x02e9 },
  { block: 'Spacing Modifier Letters (after the Bopomofo tone marks)', from: 0x02ec, to: 0x02ff },
  { block: 'Combining Diacritical Marks', from: 0x0300, to: 0x036f },
  { block: 'Greek and Coptic (before the Coptic letters)', from: 0x0370, to: 0x03e1 },
  { block: 'Greek and Coptic (after the Coptic letters)', from: 0x03f0, to: 0x03ff },
  { block: 'Cyrillic', from: 0x0400, to: 0x04ff },
  { block: 'Cyrillic Supplement', from: 0x0500, to: 0x052f },
  { block: 'Combining Diacritical Marks Extended', from: 0x1ab0, to: 0x1aff },
  { block: 'Cyrillic Extended-C', from: 0x1c80, to: 0x1c8f },
  { block: 'Phonetic Extensions', from: 0x1d00, to: 0x1d7f },
  { block: 'Phonetic Extensions Supplement', from: 0x1d80, to: 0x1dbf },
  { block: 'Combining Diacritical Marks Supplement', from: 0x1dc0, to: 0x1dff },
  { block: 'Latin Extended Additional', from: 0x1e00, to: 0x1eff },
  { block: 'Greek Extended', from: 0x1f00, to: 0x1fff },
  // Punctuation and symbols, none of a script of its own.
  { block: 'General Punctuation', from: 0x2000, to: 0x206f },
  { block: 'Superscripts and Subscripts', from: 0x2070, to: 0x209f },
  { block: 'Currency Symbols', from: 0x20a0, to: 0x20cf },
  { block: 'Combining Diacritical Marks for Symbols', from: 0x20d0, to: 0x20ff },
  { block: 'Letterlike Symbols', from: 0x2100, to: 0x214f },
  { block: 'Number Forms', from: 0x2150, to: 0x218f },
  { block: 'Arrows', from: 0x2190, to: 0x21ff },
  { block: 'Mathematical Operators', from: 0x2200, to: 0x22ff },
  { block: 'Miscellaneous Technical', from: 0x2300, to: 0x23ff },
  { block: 'Control Pictures', from: 0x2400, to: 0x243f },
  { block: 'Optical Character Recognition', from: 0x2440, to: 0x245f },
  { block: 'Enclosed Alphanumerics', from: 0x2460, to: 0x24ff },
  { block: 'Box Drawing', from: 0x2500, to: 0x257f },
  { block: 'Block Elements', from: 0x2580, to: 0x259f },
  { block: 'Geometric Shapes', from: 0x25a0, to: 0x25ff },
  { block: 'Miscellaneous Symbols', from: 0x2600, to: 0x26ff },
  { block: 'Dingbats', from: 0x2700, to: 0x27bf },
  { block: 'Miscellaneous Mathematical Symbols-A', from: 0x27c0, to: 0x27ef },
  { block: 'Supplemental Arrows-A', from: 0x27f0, to: 0x27ff },
  { block: 'Supplemental Arrows-B', from: 0x2900, to: 0x297f },
  { block: 'Miscellaneous Mathematical Symbols-B', from: 0x2980, to: 0x29ff },
  { block: 'Supplemental Mathematical Operators', from: 0x2a00, to: 0x2aff },
  { block: 'Miscellaneous Symbols and Arrows', from: 0x2b00, to: 0x2bff },
  // Latin and Cyrillic past the symbols, and the punctuation beside them.
  { block: 'Latin Extended-C', from: 0x2c60, to: 0x2c7f },
  { block: 'Cyrillic Extended-A', from: 0x2de0, to: 0x2dff },
  { block: 'Supplemental Punctuation', from: 0x2e00, to: 0x2e7f },
  { block: 'Cyrillic Extended-B', from: 0xa640, to: 0xa69f },
  { block: 'Modifier Tone Letters', from: 0xa700, to: 0xa71f },
  { block: 'Latin Extended-D', from: 0xa720, to: 0xa7ff },
  { block: 'Latin Extended-E', from: 0xab30, to: 0xab6f },
  // A face's own glyphs, and the parts of three blocks that print alone.
  { block: 'Private Use Area', from: 0xe000, to: 0xf8ff },
  { block: 'Alphabetic Presentation Forms (the Latin ligatures)', from: 0xfb00, to: 0xfb06 },
  { block: 'Combining Half Marks', from: 0xfe20, to: 0xfe2f },
  { block: 'Arabic Presentation Forms-B (the byte-order mark)', from: 0xfeff, to: 0xfeff },
  { block: 'Specials (the object replacement and replacement characters)', from: 0xfffc, to: 0xfffd },
]

/**
 * The bidirectional controls in the blocks that print, PropList.txt's
 * Bidi_Control but for U+061C, the Arabic letter mark, which is in no
 * printed block. pdfmake reorders nothing and fontkit draws a control as a
 * space, so each is refused rather than printed as one.
 */
export const BIDI_CONTROLS: ReadonlySet<number> = new Set([0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069])

/** Why a report does not print a character: its script is one nothing here prints, or it is a bidirectional control. */
export type CharacterRefusal = 'script' | 'bidi-control'

/** Why `point` does not print, or undefined where it does; a binary search of `PRINTED_BLOCKS`. */
export function refusedCharacter(point: number): CharacterRefusal | undefined {
  let low = 0
  let high = PRINTED_BLOCKS.length - 1
  while (low <= high) {
    const middle = (low + high) >>> 1
    const entry = PRINTED_BLOCKS[middle]!
    if (point < entry.from) high = middle - 1
    else if (point > entry.to) low = middle + 1
    else return BIDI_CONTROLS.has(point) ? 'bidi-control' : undefined
  }
  return 'script'
}
