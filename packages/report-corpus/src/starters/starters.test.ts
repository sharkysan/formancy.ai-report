import { createHash } from 'node:crypto'
import { diagnose } from '@formancy/report-core'
import { checkReport, EPC_MAX_VERSION, epcCaptionBreak, epcModule, resolveReport } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { epcCodes } from '../fixture.js'
import { EURO_INVOICE, euroInvoiceData, euroInvoiceLines } from './euro-invoice.js'
import { equipmentRows } from './grouped-equipment.js'
import { STARTER_IMAGES, starterImages, STARTERS } from './index.js'
import { INVOICE, invoiceData, invoiceLines } from './invoice.js'
import { lineAmount, quotationLines } from './quotation.js'

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
  // the list the builders' problems pane draws. The one warning a starter
  // opens with is the one it is meant to: the invoice's QR-bill pays SIX's
  // example QR-IBAN, which no creditor holds, by design (0022), and the
  // editor says so of every bill that pays one of SIX's examples, once,
  // until it pays another (0039).
  test.each(STARTERS.map((starter) => [starter.id, starter] as const))(
    '%s opens with no warning in the problems pane but that its bill pays SIX’s example',
    (_id, starter) => {
      const expected = starter.report.paymentPart === undefined ? [] : ['warning example-payment-part /paymentPart']
      expect(diagnose(starter.report).map((diagnostic) => `${diagnostic.severity} ${diagnostic.code} ${diagnostic.path}`)).toEqual(expected)
    },
  )

  // Each starter's own data renders in a final render, with nothing a
  // preview would have to warn of: the starter and its data agree.
  test.each(STARTERS.map((starter) => [starter.id, starter] as const))('%s resolves its own data in a final render', (_id, starter) => {
    const outcome = resolveReport(starter.report, starter.data, {
      mode: 'final',
      parameters: starter.parameters,
      images: starterImages,
      creationDate: '2026-10-15T08:00:00Z',
    })
    expect(outcome.ok ? outcome.warnings : outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`)).toEqual([])
  })

  // Plan 7's three, the invoice with its QR-bill, the invoice with its
  // EPC code, the e-invoice (0044) and the report generated from a formancy
  // form are seven different proofs; two with one id would be one proof
  // counted twice.
  test('are seven, each with its own id', () => {
    expect(STARTERS.map(({ id }) => id)).toEqual(['service-inspection', 'quotation', 'grouped-equipment', 'invoice', 'euro-invoice', 'e-invoice', 'site-visit'])
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
    for (const [quantity, price] of [
      ['1.00', '-50.00'],
      ['1.00', '-0.25'],
      ['1.5', '2.00'],
      ['1', '2.00'],
    ])
      expect(() => lineAmount(quantity as string, price as string)).toThrow(RangeError)
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
    const outcome = resolveReport(INVOICE.report, invoiceData(), { mode: 'final', parameters: {}, images: starterImages, creationDate: '2026-10-15T08:00:00Z' })
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
    const other = resolveReport(
      INVOICE.report,
      { ...data, header: { ...data.header, reference: '000008207791225857421286694' } },
      { mode: 'final', parameters: {}, images: starterImages, creationDate: '2026-10-15T08:00:00Z' },
    )
    expect(other.ok ? other.document.paymentPart?.reference : other.errors).toBe('00 00082 07791 22585 74212 86694')
  })
})

describe('the euro invoice', () => {
  /** `numerator / denominator`, both positive, rounded half away from zero to a whole number. */
  const halfAway = (numerator: bigint, denominator: bigint): bigint => (2n * numerator + denominator) / (2n * denominator)
  const cents = (amount: string): bigint => BigInt(amount.replace('.', ''))
  /** An amount as the code writes it: EUR, then the euros and as many cents as are not zero (PSA v3.0 5's "as short as possible"). */
  const epcAmount = (amount: bigint): string => {
    const rest = amount % 100n
    return rest === 0n ? `EUR${amount / 100n}` : `EUR${amount / 100n}.${String(rest).padStart(2, '0').replace(/0$/, '')}`
  }
  const resolved = (data = euroInvoiceData()) => {
    const outcome = resolveReport(EURO_INVOICE.report, data, { mode: 'final', parameters: {}, images: starterImages, creationDate: '2026-10-15T08:00:00Z' })
    if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path}`).join('; '))
    return epcCodes(outcome.document.body)
  }

  // The code's amount is the report's own total, never a second sum: the
  // net amount of the lines plus the tax rounded to the cent, computed
  // here in BigInt from the data and not by the runtime. A code that
  // asked for another amount than the table prints would be paid wrongly,
  // and a reference read from the wrong field would be booked to another
  // invoice; the code's text is compared whole, element by element in the
  // EPC's order (EPC069-12 v3.1 2.2), its BIC making it version 001.
  test('is paid by one EPC code for its exact total, by the reference and with the note its data names', () => {
    const net = euroInvoiceLines().reduce((sum, line) => sum + cents(line.amount as string), 0n)
    const total = net + halfAway(net * 19n, 100n)
    expect(resolved().map((code) => code.payload.split('\n'))).toEqual([
      [
        'BCD',
        '001',
        '1',
        'SCT',
        'FMNCDEF0XXX',
        'Formancy Haustechnik GmbH',
        'DE83012345670012345678',
        epcAmount(total),
        '',
        'RF7220260815',
        '',
        'Rechnung RE-2026-0815',
      ],
    ])
    // Another invoice's reference -- the EPC's own sample's -- and number are that invoice's.
    const data = euroInvoiceData()
    const other = resolved({ ...data, header: { ...data.header, reference: 'RF18 5390 0754 7034', number: 'RE-2026-0816' } })
    expect(other.map((code) => code.payload.split('\n').slice(9))).toEqual([['RF18539007547034', '', 'Rechnung RE-2026-0816']])
  })

  // The account and the BIC are invented and must stay so: an account a
  // bank keeps, in a starter anyone may print and scan, would invite a
  // payment to somebody. Its bank code starts with 0, as none in the
  // Bundesbank's Bankleitzahlendatei does, and the BIC's location has a 0
  // for its second character, which marks a test BIC
  // (euro-invoice-countries.ts says where each was read).
  test('pays an account no bank keeps, through a test BIC', () => {
    const [code] = resolved()
    const [bic, , iban] = code?.payload.split('\n').slice(4, 7) ?? []
    expect([iban?.slice(0, 2), iban?.charAt(4), bic?.charAt(7)]).toEqual(['DE', '0', '0'])
  })

  // Its square prints every payload the EPC allows, up to version 13's 331
  // bytes, with Austria's frame or without, as a new code's in the builders
  // does (0025): an invoice made from this one, with a longer name or a
  // note of its own, is never refused by the length of its data alone. In
  // 30 mm a payload past 287 bytes would be, and past 251 with the frame.
  test('prints its code in a square that holds every payload the EPC allows, with the frame or without', () => {
    const [code] = resolved()
    const floor = (0.4 * 72) / 25.4
    expect(code && [epcModule(code.size, EPC_MAX_VERSION, undefined) >= floor, epcCaptionBreak(code.size, EPC_MAX_VERSION)]).toEqual([true, undefined])
  })
})
