/**
 * An e-invoice's totals and VAT breakdown, computed once, here, from its
 * lines (0027): the page prints them through `invoice`, `vatBasis` and
 * `vatAmount`, and the XML is written from the very same values, so the
 * two cannot part. The rules are CEN/TC 434's CII artefacts 1.3.17's, by
 * number.
 *
 * | Value | Computed as | Rule |
 * |---|---|---|
 * | BT-131 | BT-129 × BT-146, rounded once to two places: held, not written from it | EN 16931's definition; PEPPOL-EN16931-R120 |
 * | BT-106 | Σ BT-131, each a whole number of cents | BR-CO-10 |
 * | BT-109 | BT-106: there are no allowances or charges | BR-CO-13 |
 * | BT-116 | Σ BT-131 of the category's lines | BR-S-08, BR-E-08, BR-AE-08 |
 * | BT-117 | BT-116 × BT-119 / 100, rounded once to two places, half away from zero | BR-CO-17, BR-E-09, BR-AE-09 |
 * | BT-110 | Σ BT-117 | BR-CO-14 |
 * | BT-112 | BT-109 + BT-110 | BR-CO-15 |
 * | BT-115 | BT-112 − BT-113; there is no BT-114 | BR-CO-16 |
 *
 * - **Exact.** In `@formancy/expressions`' `Decimal`, a value as an integer
 *   of units at a scale; nothing passes through a JavaScript number.
 *   Dividing by 100 moves the point and loses nothing, so a category's tax
 *   is the exact product rounded once. CEN tests BR-CO-17 and BR-S-09
 *   within one unit of the currency either way, a euro, and the exact
 *   product rounded once lies inside.
 * - **Per category, once.** VAT is rounded per category, never per line:
 *   an ERP that rounds each line can differ by up to half a cent a line,
 *   which is said where the costs are.
 * - **Half away from zero**, as upstream's `roundDecimal` rounds and as a
 *   person rounds by hand. CEN's tests round the absolute value, where half
 *   away from zero and XPath's `round` agree.
 * - **A breakdown for each category a line is in**, in the order the
 *   invoice declares them: BR-E-01 and BR-AE-01 refuse one for a category
 *   no line has, and one invoice is one XML.
 */
import { addDecimal, Decimal, decimalFromString, multiplyDecimal, roundDecimal, subtractDecimal } from '@formancy/expressions'
import type { ExpressionValues } from '@formancy/report-core'
import { checkVatRate } from '@formancy/report-spec'
import type { FacturXInvoice, VatCategory } from '@formancy/report-spec'

/** A line as its totals read it: its net amount (BT-131) at exactly two places, and the category it is in (BT-151). */
export interface TotalledLine {
  readonly netAmount: Decimal
  readonly category: VatCategory
}

/** One VAT breakdown (BG-23): a category a line is in, its rate as the XML writes it, its taxable amount and its tax. */
export interface VatBreakdown {
  readonly category: VatCategory
  /** BT-119 by value, as report-spec's `checkVatRate` gives it: `19`, `7`, `0`. */
  readonly rate: string
  /** BT-116. */
  readonly basis: Decimal
  /** BT-117. */
  readonly amount: Decimal
}

/** The document's totals (BG-22) and its VAT breakdown (BG-23), every amount at exactly two places. */
export interface InvoiceTotals {
  /** BT-106. */
  readonly lineTotal: Decimal
  /** BT-109. */
  readonly taxBasisTotal: Decimal
  /** BT-110. */
  readonly taxTotal: Decimal
  /** BT-112. */
  readonly grandTotal: Decimal
  /** BT-113, or null where none was paid. */
  readonly paid: Decimal | null
  /** BT-115. */
  readonly duePayable: Decimal
  /** Each category a line is in, in the order the invoice declares them. */
  readonly breakdown: readonly VatBreakdown[]
}

const ZERO = new Decimal(0n, 2)

/** `amount`, which a defect of the caller's would have written at another scale than the two places the XML writes. */
function cents(amount: Decimal, what: string): Decimal {
  if (amount.scale !== 2) throw new RangeError(`${what} is at ${amount.scale} places, and the e-invoice's lines are read at two`)
  return amount
}

const sum = (amounts: Iterable<Decimal>): Decimal => {
  let total = ZERO
  for (const amount of amounts) total = addDecimal(total, amount)
  return total
}

/**
 * A line's net amount (BT-131) as EN 16931 makes it, which the lines'
 * reader holds each line's to: its quantity (BT-129) times its net price
 * (BT-146), each as the XML writes it, rounded once to two places, half
 * away from zero, as BT-117 is. This version writes no line allowance or
 * charge and no base quantity (BT-149), which would enter it.
 */
export function lineNetAmount(quantity: string, netPrice: string): Decimal {
  return roundDecimal(multiplyDecimal(decimalFromString(quantity), decimalFromString(netPrice)), 2)
}

/** BT-117 of a category of `rate` over `basis`: the exact product over 100, rounded once to two places, half away from zero. */
function tax(basis: Decimal, rate: string): Decimal {
  const product = multiplyDecimal(basis, decimalFromString(rate))
  return roundDecimal(new Decimal(product.units, product.scale + 2), 2)
}

/**
 * The totals of `lines`, each in one of `categories`, as declared; `paid`
 * the amount already paid (BT-113), or null. Every amount it is handed is
 * at exactly two places, as the lines' reader writes it, and a RangeError
 * says a caller handed one that is not.
 */
export function invoiceTotals(categories: readonly VatCategory[], lines: readonly TotalledLine[], paid: Decimal | null): InvoiceTotals {
  const amounts = lines.map((line, index) => cents(line.netAmount, `line ${index}'s net amount`))
  const breakdown = categories.flatMap((category): VatBreakdown[] => {
    const own = lines.flatMap((line, index) => (line.category === category ? [amounts[index] as Decimal] : []))
    if (own.length === 0) return []
    const basis = sum(own)
    // report-spec's validator took the rate by this very check, so it takes it again.
    const rate = (checkVatRate(category.code, category.rate) as { readonly value: string }).value
    return [{ category, rate, basis, amount: tax(basis, category.rate) }]
  })
  const lineTotal = sum(amounts)
  const taxTotal = sum(breakdown.map(({ amount }) => amount))
  const grandTotal = addDecimal(lineTotal, taxTotal)
  const prepaid = paid === null ? null : cents(paid, 'the paid amount')
  return {
    lineTotal,
    taxBasisTotal: lineTotal,
    taxTotal,
    grandTotal,
    paid: prepaid,
    duePayable: prepaid === null ? grandTotal : subtractDecimal(grandTotal, prepaid),
    breakdown,
  }
}

/**
 * What the e-invoice's names hold, as an expression is handed them (0027,
 * beside 0009): `invoice` each document total, `paid` only where the
 * invoice declares a paid amount, as report-core binds it; `vatBasis` and
 * `vatAmount` each declared category's basis and tax by its id, null where
 * no line is in it, which prints as nothing (0007). The very values the
 * XML is written from.
 */
export function invoiceNames(invoice: Pick<FacturXInvoice, 'vat' | 'paid'>, totals: InvoiceTotals): ExpressionValues {
  const of = (category: VatCategory): VatBreakdown | undefined => totals.breakdown.find((each) => each.category.id === category.id)
  return {
    invoice: {
      lineTotal: totals.lineTotal,
      taxBasisTotal: totals.taxBasisTotal,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      ...(invoice.paid === undefined ? {} : { paid: totals.paid }),
      duePayable: totals.duePayable,
    },
    vatBasis: Object.fromEntries(invoice.vat.map((category) => [category.id, of(category)?.basis ?? null])),
    vatAmount: Object.fromEntries(invoice.vat.map((category) => [category.id, of(category)?.amount ?? null])),
  }
}
