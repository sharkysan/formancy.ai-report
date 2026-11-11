import { COMPONENT_KINDS, refusedCharacter } from '@formancy/report-spec'
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
 * table and one level of grouping, and no render jobs on a server, have no
 * predicate here: review holds them.
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

  // "Latin, Greek and Cyrillic only" is true while report-spec prints a
  // letter of each and refuses a letter of each other script the sentence
  // names: a script report-spec comes to print fails here until the
  // sentence is read again.
  test('says only Latin, Greek and Cyrillic print while report-spec refuses the other scripts it is asked about', () => {
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

  // A limit the copy words and LIMIT_ORDER leaves out would never print,
  // and one it lists twice would print twice.
  test('orders every limit the copy words, each once', () => {
    for (const language of LANGUAGES) expect([language, [...LIMIT_ORDER].sort()]).toEqual([language, Object.keys(LIMITS_COPY[language].items).sort()])
  })

  // A limit said in one language and not in another tells two readers two
  // things; and the absences, said without the roadmap, leave a reader to
  // guess whether one of them is meant to come.
  test('lists every limit in LIMIT_ORDER, in every language, and links the roadmap', () => {
    expect(productPages).toHaveLength(LANGUAGES.length)
    for (const page of productPages) {
      const section = page.document.querySelector('section[aria-labelledby="limits"]')
      const items = [...(section?.querySelectorAll('li') ?? [])].map((item) => collapsed(item.textContent))
      expect([page.language, items]).toEqual([page.language, LIMIT_ORDER.map((key) => collapsed(LIMITS_COPY[page.language].items[key]))])
      const roadmap = section?.querySelectorAll(`a[href="${inputs.repository}/blob/main/docs/roadmap.md"]`)
      expect([page.language, roadmap?.length]).toEqual([page.language, 1])
    }
  })
})
