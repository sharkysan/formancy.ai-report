import { createHash } from 'node:crypto'
import { diagnose } from '@formancy/report-core'
import { checkReport, resolveReport } from '@formancy/report-runtime'
import type { ImageResolver } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { equipmentRows } from './grouped-equipment.js'
import { STARTER_IMAGES, STARTERS } from './index.js'
import { INVOICE, invoiceData, invoiceLines } from './invoice.js'
import { lineAmount, quotationLines } from './quotation.js'

/** The host's approved assets: the starters' images, by digest. */
const images: ImageResolver = (ref) => STARTER_IMAGES.find((image) => image.asset === ref.asset && image.digest === ref.digest)

describe('the starters', () => {
  // An author starts from these. One the validator refuses, or whose
  // expressions the editor marks as errors, would greet a new author with a
  // broken report; runtime's checkReport is validateReport and report-core's
  // diagnose, as the editor and the runtime both run them.
  test.each(STARTERS.map((starter) => [starter.id, starter] as const))('%s validates and has no diagnostic errors', (_id, starter) => {
    const outcome = checkReport(starter.report)
    expect(outcome.ok ? [] : outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`)).toEqual([])
  })

  // Nor with a warning: a starter is what the Studio opens first, and a
  // warning there -- a style no component uses, say -- is the first thing a
  // new author sees and the README's pictures show. report-core's diagnose is
  // the list the builders' problems pane draws.
  test.each(STARTERS.map((starter) => [starter.id, starter] as const))('%s opens with no warning in the problems pane', (_id, starter) => {
    expect(diagnose(starter.report).map((diagnostic) => `${diagnostic.severity} ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`)).toEqual([])
  })

  // Each starter's own data renders in a final render, with nothing a
  // preview would have to warn of: the starter and its data agree.
  test.each(STARTERS.map((starter) => [starter.id, starter] as const))('%s resolves its own data in a final render', (_id, starter) => {
    const outcome = resolveReport(starter.report, starter.data, { mode: 'final', parameters: starter.parameters, images, creationDate: '2026-10-15T08:00:00Z' })
    expect(outcome.ok ? outcome.warnings : outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`)).toEqual([])
  })

  // Plan 7's three and the invoice with its QR-bill are four different
  // proofs; two with one id would be one proof counted twice.
  test('are four, each with its own id', () => {
    expect(STARTERS.map(({ id }) => id)).toEqual(['service-inspection', 'quotation', 'grouped-equipment', 'invoice'])
  })
})

describe("the starters' data", () => {
  // A digest pins the bytes (0007); one that is not theirs would let a
  // host's check of the digest pass for other bytes, or fail for these.
  test('names each image by the SHA-256 of its bytes', () => {
    for (const image of STARTER_IMAGES) expect(image.digest).toBe(`sha256:${createHash('sha256').update(image.bytes).digest('hex')}`)
  })

  // Ordering is only proved by rows that arrive out of order: data already
  // in the report's order would pass a report that never sorted.
  test('arrives out of the order the reports print it in', () => {
    const articles = quotationLines(12).map(({ article }) => article)
    expect(articles).not.toEqual([...articles].sort())
    const rows = equipmentRows(40)
    expect(new Set(rows.map(({ site }) => site)).size).toBe(4)
    const sites = rows.map(({ site }) => site)
    expect(sites).not.toEqual([...sites].sort())
  })

  // A register whose groups all count alike cannot show that a group's
  // header and footer count its own rows rather than another's: 40 items
  // over the four sites are 4, 8, 12 and 16.
  test('spreads the equipment over its sites unevenly', () => {
    const counts = new Map<string, number>()
    for (const { site } of equipmentRows(40)) counts.set(site as string, (counts.get(site as string) ?? 0) + 1)
    expect(Object.fromEntries(counts)).toEqual({ Zürich: 4, Bern: 8, Basel: 12, Thun: 16 })
  })

  // A line amount is quantity times unit price to the centime, rounded half
  // away from zero; written with other places, or negative, the arithmetic
  // would make '-49.-99' of it, so it is refused instead.
  test('computes a line amount, and refuses input it would get wrong', () => {
    expect([lineAmount('3.75', '128.00'), lineAmount('12.50', '4.35'), lineAmount('7.25', '1.85')]).toEqual(['480.00', '54.38', '13.41'])
    for (const [quantity, price] of [['1.00', '-50.00'], ['1.00', '-0.25'], ['1.5', '2.00'], ['1', '2.00']]) expect(() => lineAmount(quantity as string, price as string)).toThrow(RangeError)
  })
})

describe('the invoice', () => {
  /** `numerator / denominator`, both positive, rounded half away from zero to a whole number. */
  const halfAway = (numerator: bigint, denominator: bigint): bigint => (2n * numerator + denominator) / (2n * denominator)
  const cents = (amount: string): bigint => BigInt(amount.replace('.', ''))
  const francs = (centimes: bigint): string => `${centimes / 100n}.${String(centimes % 100n).padStart(2, '0')}`

  // The bill's amount is the report's own total, never a second sum: the
  // subtotal of the lines plus the VAT rounded to the centime, computed
  // here in BigInt from the data and not by the runtime. A code that asked
  // for another amount than the table prints would be paid wrongly, and a
  // reference or a debtor read from the wrong field would be booked to
  // somebody else; the code's text is compared whole, line by line, in
  // SIX's order.
  test('is paid by a QR-bill for its exact total, by the reference and to the customer its data names', () => {
    const outcome = resolveReport(INVOICE.report, invoiceData(), { mode: 'final', parameters: {}, creationDate: '2026-10-15T08:00:00Z' })
    if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path}`).join('; '))
    const subtotal = invoiceLines().reduce((sum, line) => sum + cents(line.amount as string), 0n)
    const total = subtotal + halfAway(subtotal * 81n, 1000n)
    const bill = outcome.document.paymentPart
    expect(bill?.payload.split('\n')).toEqual([
      ...['SPC', '0200', '1', 'CH4431999123000889012'],
      ...['S', 'Formancy Haustechnik AG', 'Industriestrasse', '7', '3052', 'Zollikofen', 'CH'],
      ...['', '', '', '', '', '', ''],
      ...[francs(total), 'CHF'],
      ...['S', 'Bäckerei Müller AG', 'Hauptstrasse', '12', '3011', 'Bern', 'CH'],
      ...['QRR', '210000000003139471430009017', 'Rechnung R-2026-0731', 'EPD'],
    ])
    expect(bill?.reference).toBe('21 00000 00003 13947 14300 09017')
    // Another invoice's reference -- SIX's fifth example's -- is that invoice's.
    const data = invoiceData()
    const other = resolveReport(INVOICE.report, { ...data, header: { ...data.header, reference: '000008207791225857421286694' } }, { mode: 'final', parameters: {}, creationDate: '2026-10-15T08:00:00Z' })
    expect(other.ok ? other.document.paymentPart?.reference : other.errors).toBe('00 00082 07791 22585 74212 86694')
  })
})

