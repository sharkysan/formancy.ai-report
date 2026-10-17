import { Decimal, decimalFromString, decimalToString } from '@formancy/expressions'
import type { FacturXInvoice, VatCategory } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { invoiceNames, invoiceTotals } from './e-invoice-totals.js'
import type { InvoiceTotals, TotalledLine } from './e-invoice-totals.js'
import { below, seeded } from './test-support.js'

/**
 * EN 16931's totals and VAT breakdown, computed once from an e-invoice's
 * lines (CEN/TC 434's CII artefacts 1.3.17, the rules by number): the sum
 * of the lines (BT-106, BR-CO-10), the total without VAT (BT-109, BR-CO-13,
 * the same with no allowances or charges), each category's basis (BT-116,
 * BR-S-08, BR-E-08, BR-AE-08) and amount (BT-117, BR-CO-17), the VAT total
 * (BT-110, BR-CO-14), the total with VAT (BT-112, BR-CO-15) and the amount
 * due (BT-115, BR-CO-16).
 *
 * Every expected value is computed here a second way, in BigInt cents and
 * a rate in hundredths of a per cent, with its own rounding: a reading of
 * the rules that does not go through `Decimal` at all.
 */

const standard: VatCategory = { id: 'standard', code: 'S', rate: '19' }
const reduced: VatCategory = { id: 'reduced', code: 'S', rate: '7.00' }
const exempt: VatCategory = { id: 'exempt', code: 'E', rate: '0', reason: [{ kind: 'text', text: 'Steuerfrei' }] }
const reverse: VatCategory = { id: 'reverse', code: 'AE', rate: '0', reason: [{ kind: 'text', text: 'Reverse charge' }] }

const line = (amount: string, category: VatCategory): TotalledLine => ({ netAmount: decimalFromString(amount), category })

/** Cents as BigInt, from an amount of two places. */
const cents = (amount: string): bigint => BigInt(amount.replace('.', ''))

/** Cents written as an amount of two places, as the XML writes one. */
function written(value: bigint): string {
  const negative = value < 0n
  const digits = (negative ? -value : value).toString().padStart(3, '0')
  return `${negative ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`
}

/** A rate in hundredths of a per cent: 19 is 1900, 7.5 is 750. */
function hundredths(rate: string): bigint {
  const [whole = '0', fraction = ''] = rate.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

/** basis × rate / 100 in cents, rounded once, half away from zero: the cents and the hundredths of a per cent make 10,000 parts of a cent. */
function vatCents(basis: bigint, rate: bigint): bigint {
  const parts = basis * rate
  const quotient = parts / 10_000n
  const remainder = parts % 10_000n
  const twice = 2n * (remainder < 0n ? -remainder : remainder)
  if (twice < 10_000n) return quotient
  return parts < 0n ? quotient - 1n : quotient + 1n
}

/** The totals of `lines`, each `[amount, category]`, recomputed in BigInt, as the XML writes them. */
function reference(lines: readonly (readonly [string, VatCategory])[], declared: readonly VatCategory[], paid: string | null) {
  const breakdown = declared
    .filter((category) => lines.some(([, of]) => of === category))
    .map((category) => {
      const basis = lines.filter(([, of]) => of === category).reduce((sum, [amount]) => sum + cents(amount), 0n)
      return { id: category.id, basis, amount: vatCents(basis, hundredths(category.rate)) }
    })
  const lineTotal = lines.reduce((sum, [amount]) => sum + cents(amount), 0n)
  const taxTotal = breakdown.reduce((sum, { amount }) => sum + amount, 0n)
  const grandTotal = lineTotal + taxTotal
  return {
    lineTotal: written(lineTotal),
    taxBasisTotal: written(lineTotal),
    taxTotal: written(taxTotal),
    grandTotal: written(grandTotal),
    paid: paid,
    duePayable: written(grandTotal - (paid === null ? 0n : cents(paid))),
    breakdown: breakdown.map(({ id, basis, amount }) => ({ id, basis: written(basis), amount: written(amount) })),
  }
}

/** The totals as text, each as the XML writes it. */
function asWritten(totals: InvoiceTotals) {
  const text = (value: Decimal): string => decimalToString(value)
  return {
    lineTotal: text(totals.lineTotal),
    taxBasisTotal: text(totals.taxBasisTotal),
    taxTotal: text(totals.taxTotal),
    grandTotal: text(totals.grandTotal),
    paid: totals.paid === null ? null : text(totals.paid),
    duePayable: text(totals.duePayable),
    breakdown: totals.breakdown.map(({ category, basis, amount }) => ({ id: category.id, basis: text(basis), amount: text(amount) })),
  }
}

const DECLARED = [standard, reduced, exempt, reverse]

describe('the totals of an e-invoice', () => {
  // Germany's two rates and an exempt line, with a paid amount: every
  // formula once, against the BigInt reading of the rules. A total off by
  // a cent here is an invoice every validator refuses after the render
  // was called final.
  test('are each formula of EN 16931, as the BigInt reading of its rules computes it', () => {
    const lines = [
      ['1250.00', standard],
      ['89.90', reduced],
      ['19.99', standard],
      ['250.00', exempt],
      ['-10.00', standard],
    ] as const
    const totals = invoiceTotals(DECLARED, lines.map(([amount, category]) => line(amount, category)), decimalFromString('500.00'))
    expect(asWritten(totals)).toEqual(reference(lines, DECLARED, '500.00'))
    // By hand: 1,259.99 at 19 % is 239.3981, so 239.40; 89.90 at 7 % is 6.293, so 6.29.
    expect(asWritten(totals)).toMatchObject({ lineTotal: '1599.89', taxTotal: '245.69', grandTotal: '1845.58', duePayable: '1345.58' })
  })

  // BR-CO-17 rounds a category's amount, not each line's: three lines of
  // 0.03 at 19 % are 0.0171, so 0.02, where rounding each line first would
  // make 0.03. An ERP that rounds per line can differ by a cent, and the
  // limitation says so.
  test("round each category's VAT once, never each line's", () => {
    const totals = invoiceTotals([standard], [line('0.03', standard), line('0.03', standard), line('0.03', standard)], null)
    expect(asWritten(totals).breakdown).toEqual([{ id: 'standard', basis: '0.09', amount: '0.02' }])
  })

  // Half away from zero, the mode 0027 names: 1.50 at 19 % is 0.285, so
  // 0.29; and a basis below zero, a credit larger than the charges, rounds
  // away from zero too, to -0.29. CEN's test rounds the absolute value,
  // where the two modes agree; half to even would give 0.28.
  test('round a half away from zero, on either side of it', () => {
    expect(asWritten(invoiceTotals([standard], [line('1.50', standard)], null)).breakdown).toEqual([{ id: 'standard', basis: '1.50', amount: '0.29' }])
    expect(asWritten(invoiceTotals([standard], [line('-1.50', standard)], null)).breakdown).toEqual([{ id: 'standard', basis: '-1.50', amount: '-0.29' }])
    expect(asWritten(invoiceTotals([standard], [line('1.49', standard)], null)).breakdown).toEqual([{ id: 'standard', basis: '1.49', amount: '0.28' }])
  })

  // A breakdown for each category a line is in, and none for one no line
  // is in: BR-E-01 and BR-AE-01 refuse a breakdown of a category no line
  // has. In the order the invoice declares them, whatever order the lines
  // name them in, so one invoice is one XML. Exempt and reverse-charged
  // categories have no tax (BR-E-09, BR-AE-09); a category whose lines
  // cancel out is still one a line is in.
  test('break VAT down by each category a line is in, in the order declared', () => {
    const lines = [line('40.00', reverse), line('10.00', reduced), line('-10.00', reduced), line('5.00', reverse)]
    const totals = invoiceTotals(DECLARED, lines, null)
    expect(asWritten(totals).breakdown).toEqual([
      { id: 'reduced', basis: '0.00', amount: '0.00' },
      { id: 'reverse', basis: '45.00', amount: '0.00' },
    ])
    expect(totals.breakdown.map(({ rate }) => rate)).toEqual(['7', '0'])
  })

  // A preview may have no rows; a final render refuses one (BR-16) before
  // it gets here. Over no lines every total is 0.00, at two places, and
  // there is no breakdown, so nothing reads a category's basis as 0.
  test('are 0.00 over no lines, at two places, with no breakdown', () => {
    const totals = invoiceTotals(DECLARED, [], null)
    expect(asWritten(totals)).toEqual({ lineTotal: '0.00', taxBasisTotal: '0.00', taxTotal: '0.00', grandTotal: '0.00', paid: null, duePayable: '0.00', breakdown: [] })
  })

  // Rates of every kind a category may have -- whole, of one place and of
  // two -- over amounts drawn from a seeded sequence, so a failure names a
  // sequence that replays. Each set is held to the BigInt reading.
  test('agree with the BigInt reading over many lines at many rates', () => {
    const next = seeded(16931)
    const rates = ['19', '7', '5.5', '16', '20', '8.1', '2.6', '21', '13.75']
    for (let round = 0; round < 200; round++) {
      const declared: VatCategory[] = rates.slice(0, 1 + below(next, rates.length)).map((rate, index) => ({ id: `rate${index}`, code: 'S', rate }))
      const lines = Array.from({ length: below(next, 40) }, () => {
        const amount = written(BigInt(below(next, 2_000_000)) - 400_000n)
        return [amount, declared[below(next, declared.length)] as VatCategory] as const
      })
      const paid = below(next, 2) === 0 ? null : written(BigInt(below(next, 100_000)))
      const totals = invoiceTotals(declared, lines.map(([amount, category]) => line(amount, category)), paid === null ? null : decimalFromString(paid))
      expect(asWritten(totals), `round ${round}`).toEqual(reference(lines, declared, paid))
    }
  })

  // The writer writes every amount with exactly two places, from its own
  // digits. A line amount at another scale is a defect of the lines'
  // reader, which writes each at two (BR-DEC-23): taken as it is, it would
  // make totals of three places the XML could not write.
  test('refuse a line amount or a paid amount not written at two places, as a defect', () => {
    expect(() => invoiceTotals([standard], [{ netAmount: new Decimal(1050n, 3), category: standard }], null)).toThrow(RangeError)
    expect(() => invoiceTotals([standard], [line('10.00', standard)], new Decimal(5n, 0))).toThrow(RangeError)
  })
})

describe('the names an e-invoice binds', () => {
  const invoice = { vat: DECLARED } as Pick<FacturXInvoice, 'vat' | 'paid'>

  // What the page prints is what the XML holds: the very Decimals the
  // totals computed, member by member (0009). A category no line is in is
  // null, which prints as nothing (0007), so its breakdown row's condition
  // can hide it; `paid` is a member only where the invoice declares a paid
  // amount, as report-core binds it.
  test('hold the very totals the XML is written from, null for a category no line is in', () => {
    const totals = invoiceTotals(DECLARED, [line('100.00', standard), line('50.00', exempt)], null)
    const names = invoiceNames(invoice, totals)
    expect(names.invoice).toEqual({
      lineTotal: totals.lineTotal,
      taxBasisTotal: totals.taxBasisTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      duePayable: totals.duePayable,
    })
    expect(names.invoice?.taxTotal).toBe(totals.taxTotal)
    expect(names.vatBasis).toEqual({ standard: totals.breakdown[0]?.basis, reduced: null, exempt: totals.breakdown[1]?.basis, reverse: null })
    expect(names.vatAmount).toEqual({ standard: totals.breakdown[0]?.amount, reduced: null, exempt: totals.breakdown[1]?.amount, reverse: null })
  })

  // A paid amount the expression gave as null is no paid amount: BT-113
  // is left out and the amount due is the total with VAT, and the member
  // the page reads is null, which prints as nothing.
  test('hold the paid amount where the invoice declares one, null where it gave none', () => {
    const declared = { ...invoice, paid: { cel: 'params.paid' } }
    const paid = invoiceTotals(DECLARED, [line('100.00', standard)], decimalFromString('19.00'))
    expect(invoiceNames(declared, paid).invoice).toMatchObject({ paid: paid.paid, duePayable: paid.duePayable })
    expect(decimalToString(paid.duePayable)).toBe('100.00')
    const none = invoiceTotals(DECLARED, [line('100.00', standard)], null)
    expect(invoiceNames(declared, none).invoice).toMatchObject({ paid: null })
    expect(decimalToString(none.duePayable)).toBe('119.00')
  })
})
