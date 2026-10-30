import { createHash } from 'node:crypto'
import { diagnose } from '@formancy/report-core'
import { checkReport, resolveReport } from '@formancy/report-runtime'
import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { INVOICE, INVOICE_SAMPLES, starterImages, STARTERS } from './index.js'
import type { Starter } from './index.js'

/**
 * The invoice samples: the invoice starter's report in German, French,
 * Italian and English, each with its slip in its language. The words, the
 * parties and the reference are each sample's; the arithmetic is the
 * starter's, which these tests recompute in BigInt from each sample's own
 * lines. The PDFs they print are proved in report-render-pdf's
 * `samples.test.ts`.
 */

const CREATED = '2026-10-15T08:00:00Z'

/** `numerator / denominator`, both positive, rounded half away from zero to a whole number. */
const halfAway = (numerator: bigint, denominator: bigint): bigint => (2n * numerator + denominator) / (2n * denominator)
const cents = (amount: string): bigint => BigInt(amount.replace('.', ''))
const francs = (centimes: bigint): string => `${centimes / 100n}.${String(centimes % 100n).padStart(2, '0')}`

/** The sample's total as the reference computes it: its lines' sum, and the VAT on it to the centime. */
function totalOf(sample: Starter): bigint {
  const subtotal = (sample.data.detail as Record<string, string>[]).reduce((sum, line) => sum + cents(line['amount'] as string), 0n)
  return subtotal + halfAway(subtotal * 81n, 1000n)
}

function resolved(sample: Starter) {
  const outcome = resolveReport(sample.report, sample.data, { mode: 'final', parameters: sample.parameters, images: starterImages, creationDate: CREATED })
  if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path}`).join('; '))
  return outcome
}

/**
 * Every text the sample prints but the slip's: the definition's runs, column
 * headers, field labels, empty text and title, and its lines' descriptions
 * and units. What the slip prints is the runtime's, in SIX's words.
 */
function printed(report: ReportDefinition, data: ReportData): Set<string> {
  const found = new Set<string>()
  const walk = (value: unknown, key?: string): void => {
    if (typeof value === 'string') {
      if (key !== undefined && ['text', 'header', 'label', 'emptyText', 'title'].includes(key) && /\p{L}/u.test(value)) found.add(value)
    } else if (Array.isArray(value)) {
      for (const each of value) walk(each)
    } else if (typeof value === 'object' && value !== null) {
      for (const [name, each] of Object.entries(value)) walk(each, name)
    }
  }
  walk(report)
  for (const line of data.detail as Record<string, string>[])
    for (const name of ['description', 'unit']) if (/\p{L}/u.test(line[name] as string)) found.add(line[name] as string)
  return found
}

const samples = INVOICE_SAMPLES.map((sample) => [sample.id, sample] as const)

describe('the invoice samples', () => {
  // One invoice in each of the languages SIX prints a slip in but Romansh,
  // the German the Studio's starter itself: a sample whose slip spoke
  // another language than its invoice, or two samples of one language,
  // would show the pages something the samples do not hold; and a German
  // sample apart from the starter could drift from it, nobody noticing.
  test('are the invoice in German, French, Italian and English, the German the starter itself', () => {
    expect(INVOICE_SAMPLES.map((sample) => [sample.id, sample.report.locale, sample.report.paymentPart?.language])).toEqual([
      ['invoice', 'de-CH', 'de'],
      ['invoice-fr', 'fr-CH', 'fr'],
      ['invoice-it', 'it-CH', 'it'],
      ['invoice-en', 'en-CH', 'en'],
    ])
    expect(INVOICE_SAMPLES[0]).toBe(INVOICE)
    // The samples are not starters: the Studio's picker keeps its four.
    expect(STARTERS.filter((starter) => INVOICE_SAMPLES.includes(starter)).map((starter) => starter.id)).toEqual(['invoice'])
  })

  // Four documents, each with its own id: four samples sharing the
  // starter's would be one report to a host or a cache that keys reports
  // by their id, and opening one would show another. The German keeps the
  // starter's, which the digest below pins.
  test('each have a report id of their own, the sample id', () => {
    expect(INVOICE_SAMPLES.map((sample) => [sample.id, sample.report.id])).toEqual([
      ['invoice', 'invoice'],
      ['invoice-fr', 'invoice-fr'],
      ['invoice-it', 'invoice-it'],
      ['invoice-en', 'invoice-en'],
    ])
  })

  // The starter, as the Studio encodes it into its page with
  // JSON.stringify, is what it was before the samples were made from it.
  // A generalisation that moved one word or one key of it would move its
  // README picture, the Studio's pictures and what the browser gate reads,
  // with nobody having retaken them. The digest is of the starter with the
  // firm's mark at the head of its first page (0032, 18 October 2026), whose
  // pictures were retaken with it; 0fe4b36f, at 5495089, was the starter
  // before it. A change to the starter retakes those pictures and states
  // the new digest here.
  test('leave the starter as it was, byte for byte', () => {
    expect(createHash('sha256').update(JSON.stringify(INVOICE)).digest('hex')).toBe('b0d3cf77fbd2828ba6bc42285e9e5fe61614831bb70cc9a5fe208cf5dfa4e619')
  })

  // A sample the validator refuses, or whose expressions the editor marks,
  // is a broken invoice shown as an example; a warning is one an author
  // would see the moment they opened it. The one each has is the one it is
  // meant to: its bill pays SIX's example QR-IBAN, which no creditor holds,
  // and the editor says so, of its bill (0039).
  test.each(samples)('%s validates, with no diagnostic but that its bill pays SIX’s example', (_id, sample) => {
    const outcome = checkReport(sample.report)
    expect(outcome.ok ? [] : outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`)).toEqual([])
    expect(diagnose(sample.report).map((diagnostic) => `${diagnostic.severity} ${diagnostic.code} ${diagnostic.path}`)).toEqual([
      'warning example-payment-part /paymentPart',
    ])
  })

  // Its own data in a final render, with nothing a preview would warn of.
  test.each(samples)('%s resolves its own data in a final render', (_id, sample) => {
    expect(resolved(sample).warnings).toEqual([])
  })

  // The bill's amount is the report's own total, computed here in BigInt
  // from the sample's own lines; its creditor is the sample's firm, its
  // debtor and reference read from the sample's data, and its message in
  // the sample's language. A sample that paid another sample's firm, or
  // asked for an amount its table does not print, would be paid wrongly;
  // the code's text is compared whole, line by line, in SIX's order.
  test.each([
    [
      'invoice',
      ['Formancy Haustechnik AG', 'Industriestrasse', '7', '3052', 'Zollikofen'],
      ['Bäckerei Müller AG', 'Hauptstrasse', '12', '3011', 'Bern'],
      '210000000003139471430009017',
      'Rechnung R-2026-0731',
    ],
    [
      'invoice-fr',
      ['Formancy Technique du Bâtiment SA', 'Chemin des Artisans', '7', '1004', 'Lausanne'],
      ['Boulangerie Favre SA', 'Rue du Marché', '18', '1204', 'Genève'],
      '000000000000000000202604127',
      'Facture F-2026-0412',
    ],
    [
      'invoice-it',
      ['Formancy Impianti Tecnici SA', 'Via Industria', '7', '6500', 'Bellinzona'],
      ['Panetteria Bernasconi SA', 'Via Cantonale', '12', '6900', 'Lugano'],
      '000000000000000000202605875',
      'Fattura F-2026-0587',
    ],
    [
      'invoice-en',
      ['Formancy Building Services AG', 'Gewerbestrasse', '14', '4053', 'Basel'],
      ['Riverside Coffee Roasters AG', 'Rheingasse', '21', '4058', 'Basel'],
      '000000000000000000202603184',
      'Invoice INV-2026-0318',
    ],
  ] as const)('%s is paid by a QR-bill for its exact total, to its firm, by its reference', (id, creditor, debtor, reference, message) => {
    const sample = INVOICE_SAMPLES.find((each) => each.id === id) as Starter
    const bill = resolved(sample).document.paymentPart
    expect(bill?.payload.split('\n')).toEqual([
      ...['SPC', '0200', '1', 'CH4431999123000889012'],
      ...['S', ...creditor, 'CH'],
      ...['', '', '', '', '', '', ''],
      ...[francs(totalOf(sample)), 'CHF'],
      ...['S', ...debtor, 'CH'],
      ...['QRR', reference, message, 'EPD'],
    ])
  })

  // A translation that left a word of the German behind prints it on a
  // French, Italian or English invoice. Each sample prints no German text
  // but those its language writes alike: the account and the country are
  // codes, and the units of time and length are symbols.
  test.each([
    ['invoice-fr', ['CH', 'CH44 3199 9123 0008 8901 2', 'Total', 'h', 'm']],
    ['invoice-it', ['CH', 'CH44 3199 9123 0008 8901 2', 'h', 'm']],
    ['invoice-en', ['CH', 'CH44 3199 9123 0008 8901 2', 'Total', 'h', 'm']],
  ] as const)('%s prints no German but what its language writes alike', (id, alike) => {
    const sample = INVOICE_SAMPLES.find((each) => each.id === id) as Starter
    const german = printed(INVOICE.report, INVOICE.data)
    expect([...printed(sample.report, sample.data)].filter((text) => german.has(text)).sort()).toEqual([...alike].sort())
  })

  // The samples are one invoice: the same work, quantities and prices,
  // so that their pictures side by side show one total printed four ways.
  // A sample whose lines drifted would print another total, and the pages'
  // captions would compare what is not alike.
  test('bill the same lines and the same total', () => {
    const work = (sample: Starter) => (sample.data.detail as Record<string, string>[]).map(({ quantity, unitPrice, amount }) => [quantity, unitPrice, amount])
    expect(INVOICE_SAMPLES.map(work)).toEqual(INVOICE_SAMPLES.map(() => work(INVOICE)))
    expect(INVOICE_SAMPLES.map(totalOf)).toEqual(INVOICE_SAMPLES.map(() => totalOf(INVOICE)))
  })
})
