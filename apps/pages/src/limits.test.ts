import { COMPONENT_KINDS, PRINTED_BLOCKS, refusedCharacter } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { LIMITS_COPY } from './content/limits-copy.js'
import { LIMIT_ORDER } from './content/product.js'
import { LANGUAGES } from './languages.js'
import { inputs, site } from './test-site.js'

/**
 * What the start page says Formancy Report does not do yet (limits-copy.tsx,
 * in the order `LIMIT_ORDER` gives), held to the code where a predicate can
 * read it: each sentence is true while the code it rests on is as it was
 * when the sentence was read, and a change to that code fails here until
 * somebody reads the sentence again and says what is true then. One detail
 * table and one level of grouping, a best-effort read from Formancy Data,
 * and no render jobs on a server have no predicate here: review holds them.
 */
const productPages = site.pages
  .filter((page) => page.group === 'product')
  .map((page) => ({ ...page, document: new DOMParser().parseFromString(page.html, 'text/html') }))

/** Text with its whitespace collapsed, a no-break space a space, as the French pages set theirs. */
const collapsed = (text: string | null | undefined): string => (text ?? '').replaceAll(/\s+/g, ' ').trim()

/** A code point as the character it is, beside what report-spec says of it. */
const judged = (point: number): readonly [string, string | undefined] => [String.fromCodePoint(point), refusedCharacter(point)]

describe('what the start page says Formancy Report does not do yet', () => {
  // "PDF only" is true while the one renderer published is PDF's: another
  // report-render-* published from packages/ fails here until the
  // sentence is read again. A renderer named otherwise is review's.
  test('says PDF is the only output while report-render-pdf is the only renderer published', () => {
    expect(inputs.packages.filter((name) => name.startsWith('@formancy/report-render-'))).toEqual(['@formancy/report-render-pdf'])
  })

  // "No codes but QR codes" was read against these kinds, the chart among
  // them (0052), which is no code and prints nothing yet: a kind added
  // later, a barcode among them, fails here until the sentence is read
  // again.
  test("says QR codes are the only codes while report-spec's component kinds are those it was read against", () => {
    expect(COMPONENT_KINDS).toEqual([
      'text',
      'image',
      'qrCode',
      'epcQrCode',
      'line',
      'rectangle',
      'spacer',
      'columns',
      'section',
      'table',
      'chart',
      'pageBreak',
      'keepTogether',
    ])
  })

  // "Latin, Greek and Cyrillic only, with their punctuation and symbols"
  // was read against these blocks, the whole of what report-spec prints: a
  // block added later, of any script, fails here until the sentence is
  // read again. A letter of each script the sentence names is judged as it
  // says, printed or refused.
  test('says only Latin, Greek and Cyrillic print while report-spec refuses the other scripts it is asked about', () => {
    expect(PRINTED_BLOCKS.map(({ block, from, to }) => [block, from, to])).toEqual([
      ['Basic Latin', 0x0000, 0x007f],
      ['Latin-1 Supplement', 0x0080, 0x00ff],
      ['Latin Extended-A', 0x0100, 0x017f],
      ['Latin Extended-B', 0x0180, 0x024f],
      ['IPA Extensions', 0x0250, 0x02af],
      ['Spacing Modifier Letters (before the Bopomofo tone marks)', 0x02b0, 0x02e9],
      ['Spacing Modifier Letters (after the Bopomofo tone marks)', 0x02ec, 0x02ff],
      ['Combining Diacritical Marks', 0x0300, 0x036f],
      ['Greek and Coptic (before the Coptic letters)', 0x0370, 0x03e1],
      ['Greek and Coptic (after the Coptic letters)', 0x03f0, 0x03ff],
      ['Cyrillic', 0x0400, 0x04ff],
      ['Cyrillic Supplement', 0x0500, 0x052f],
      ['Combining Diacritical Marks Extended', 0x1ab0, 0x1aff],
      ['Cyrillic Extended-C', 0x1c80, 0x1c8f],
      ['Phonetic Extensions', 0x1d00, 0x1d7f],
      ['Phonetic Extensions Supplement', 0x1d80, 0x1dbf],
      ['Combining Diacritical Marks Supplement', 0x1dc0, 0x1dff],
      ['Latin Extended Additional', 0x1e00, 0x1eff],
      ['Greek Extended', 0x1f00, 0x1fff],
      ['General Punctuation', 0x2000, 0x206f],
      ['Superscripts and Subscripts', 0x2070, 0x209f],
      ['Currency Symbols', 0x20a0, 0x20cf],
      ['Combining Diacritical Marks for Symbols', 0x20d0, 0x20ff],
      ['Letterlike Symbols', 0x2100, 0x214f],
      ['Number Forms', 0x2150, 0x218f],
      ['Arrows', 0x2190, 0x21ff],
      ['Mathematical Operators', 0x2200, 0x22ff],
      ['Miscellaneous Technical', 0x2300, 0x23ff],
      ['Control Pictures', 0x2400, 0x243f],
      ['Optical Character Recognition', 0x2440, 0x245f],
      ['Enclosed Alphanumerics', 0x2460, 0x24ff],
      ['Box Drawing', 0x2500, 0x257f],
      ['Block Elements', 0x2580, 0x259f],
      ['Geometric Shapes', 0x25a0, 0x25ff],
      ['Miscellaneous Symbols', 0x2600, 0x26ff],
      ['Dingbats', 0x2700, 0x27bf],
      ['Miscellaneous Mathematical Symbols-A', 0x27c0, 0x27ef],
      ['Supplemental Arrows-A', 0x27f0, 0x27ff],
      ['Supplemental Arrows-B', 0x2900, 0x297f],
      ['Miscellaneous Mathematical Symbols-B', 0x2980, 0x29ff],
      ['Supplemental Mathematical Operators', 0x2a00, 0x2aff],
      ['Miscellaneous Symbols and Arrows', 0x2b00, 0x2bff],
      ['Latin Extended-C', 0x2c60, 0x2c7f],
      ['Cyrillic Extended-A', 0x2de0, 0x2dff],
      ['Supplemental Punctuation', 0x2e00, 0x2e7f],
      ['Cyrillic Extended-B', 0xa640, 0xa69f],
      ['Modifier Tone Letters', 0xa700, 0xa71f],
      ['Latin Extended-D', 0xa720, 0xa7ff],
      ['Latin Extended-E', 0xab30, 0xab6f],
      ['Private Use Area', 0xe000, 0xf8ff],
      ['Alphabetic Presentation Forms (the Latin ligatures)', 0xfb00, 0xfb06],
      ['Combining Half Marks', 0xfe20, 0xfe2f],
      ['Arabic Presentation Forms-B (the byte-order mark)', 0xfeff, 0xfeff],
      ['Specials (the object replacement and replacement characters)', 0xfffc, 0xfffd],
    ])
    // é, λ and ж.
    const prints = [0x00e9, 0x03bb, 0x0436]
    // Hebrew's alef, Arabic's beh, Devanagari's ka, Thai's ko kai, the Han
    // character 中 and katakana's a.
    const refuses = [0x05d0, 0x0628, 0x0915, 0x0e01, 0x4e2d, 0x30a2]
    expect(prints.map(judged)).toEqual(prints.map((point) => [String.fromCodePoint(point), undefined]))
    expect(refuses.map(judged)).toEqual(refuses.map((point) => [String.fromCodePoint(point), 'script']))
  })

  // "No published PDF viewer" is true while no package published from
  // packages/ is one: a package published with viewer in its name fails
  // here, naming it, until the sentence is read again. A viewer named
  // otherwise is review's.
  test('says no viewer is published while no published package is one', () => {
    expect(inputs.packages.filter((name) => /viewer/.test(name))).toEqual([])
  })

  // "No changes proposed by an AI" is true while no package published from
  // packages/ is one: a package published with report-ai in its name fails
  // here, naming it, until the sentence is read again. One named otherwise
  // is review's.
  test('says no AI proposes changes while no published package is one', () => {
    expect(inputs.packages.filter((name) => /report-ai/.test(name))).toEqual([])
  })

  // A predicate whose sentence the page no longer says would pass while
  // holding nothing.
  test('says each sentence a predicate here holds', () => {
    expect(LIMIT_ORDER).toEqual(expect.arrayContaining(['pdf', 'codes', 'scripts', 'viewer', 'ai']))
  })

  // A limit the copy words and LIMIT_ORDER leaves out would never print,
  // and one it lists twice would print twice.
  test('orders every limit the copy words, each once', () => {
    for (const language of LANGUAGES) expect([language, [...LIMIT_ORDER].sort()]).toEqual([language, Object.keys(LIMITS_COPY[language].items).sort()])
  })

  // A limit said in one language and not in another tells two readers two
  // things, and a limit or a heading with no words prints an empty line; and
  // the absences, said without the roadmap, leave a reader to guess whether
  // one of them is meant to come.
  test('lists every limit in LIMIT_ORDER, in every language, and links the roadmap', () => {
    expect(productPages).toHaveLength(LANGUAGES.length)
    for (const page of productPages) {
      const section = page.document.querySelector('section[aria-labelledby="limits"]')
      const items = [...(section?.querySelectorAll('li') ?? [])].map((item) => collapsed(item.textContent))
      expect([page.language, items]).toEqual([page.language, LIMIT_ORDER.map((key) => collapsed(LIMITS_COPY[page.language].items[key]))])
      expect([page.language, items.filter((text) => text === '')]).toEqual([page.language, []])
      expect([page.language, collapsed(section?.querySelector('h2#limits')?.textContent) === '']).toEqual([page.language, false])
      const roadmap = section?.querySelectorAll(`a[href="${inputs.repository}/blob/main/docs/roadmap.md"]`)
      expect([page.language, roadmap?.length]).toEqual([page.language, 1])
    }
  })
})
