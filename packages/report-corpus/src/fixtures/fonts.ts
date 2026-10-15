import type { TableRow } from '../document.js'
import { expectation, flatten, plainText, type Fixture } from '../fixture.js'
import { documentOf, heading, ledger, paragraph } from './build.js'

/**
 * Text outside ASCII, in paragraphs, in bold and in table cells: it must come
 * back out of the PDF exactly, which needs the font embedded with the glyphs
 * and a ToUnicode map that names them. A font substituted for a missing glyph,
 * or a glyph drawn without its mapping, extracts as something else. Every
 * paragraph is expected whole, as a line -- the bare samples alone would be
 * found in the regular paragraphs and the table while the bold line lost its
 * glyphs -- and each table row is read cell by cell like any other.
 */
const SAMPLES = [
  ['German', 'äöüÄÖÜß'],
  ['French', 'éèçàœÉ'],
  ['Swiss', 'CHF 1’234.50'],
  ['Euro', '€ 12,00'],
  ['Polish', 'Zażółć gęślą jaźń'],
] as const

const rows: TableRow[] = SAMPLES.map(([, sample], index) => ({ kind: 'detail', cells: [`FNT-0${index + 1}`, sample, ''] }))
const document = documentOf('Fonts', [
  heading('Text outside ASCII'),
  ...SAMPLES.map(([language, sample]) => paragraph(`${language}: ${sample}`)),
  paragraph(SAMPLES.map(([, sample]) => sample).join(' · '), { bold: true }),
  ledger('samples', rows),
])

export const fonts: Fixture = {
  id: 'fonts',
  title: 'Fonts: German, French, Swiss, euro and Polish text, embedded and extracted verbatim',
  document,
  maxPages: 5,
  expect: expectation(document, {
    maxPagesExpected: 1,
    exactText: flatten(document.body).flatMap((block) => (block.kind === 'paragraph' ? [plainText(block.runs) ?? ''] : [])),
  }),
}
