/**
 * An e-invoice written as UN/CEFACT Cross Industry Invoice XML in the
 * Factur-X 1.09.2 / ZUGFeRD 2.5.2 EN 16931 profile (0027), or as an
 * XRechnung 3.0 (0038): the runtime's, as the QR-bill's payload is, since
 * the XML is the invoice's payload and the renderer decides none of it.
 * One writer for both kinds: the XML of an XRechnung is the XML of a
 * Factur-X invoice of the same terms, but for the specification
 * identifier (BT-24) it opens with, which says whose rules it follows.
 *
 * - **Its shape.** The root `rsm:CrossIndustryInvoice` with the four
 *   namespaces of CEN/TC 434's binding; its context (BT-23, BT-24), its document
 *   (BT-1, BT-3, BT-2) and its transaction: the lines, then the
 *   agreement, the delivery and the settlement, each element in the order
 *   the profile's XSD `xs:sequence` gives it, at the path CEN's binding
 *   gives each business term. Only elements D16B shares with D22B are
 *   written, since the validators run the D16B schema.
 * - **Dates** are `udt:DateTimeString` of format 102, YYYYMMDD.
 * - **The delivery**, which the XSD needs once, is written empty where the
 *   invoice gives an invoicing period and no delivery date: it has nothing
 *   else to hold. Mustang 2.26.0's Factur-X schematron warns of that empty
 *   element (PEPPOL-EN16931-R008, "still status warning"), and KoSIT's
 *   EN 16931 scenario does not, measured by hand on 17 October 2026.
 * - **Amounts** are written from their own digits with exactly two places;
 *   only `TaxTotalAmount` names its currency (CII-DT-031). A quantity and
 *   a net price, which CEN does not hold to two places, are written as the
 *   template's columns resolved them; a rate by value, `19`, `7`, `0`.
 * - **Its order** is the template's and the table's: categories as
 *   declared, lines as the table prints them. The same invoice is the same
 *   bytes (`xml.ts`).
 *
 * Every value is one the rules have already held (`e-invoice-lines.ts`,
 * `e-invoice-terms.ts`) and every total one `e-invoice-totals.ts`
 * computed: nothing here decides, rounds or checks.
 */
import { decimalToString } from '@formancy/expressions'
import type { Decimal } from '@formancy/expressions'
import type { EInvoiceCurrency, InvoiceTypeCode } from '@formancy/report-spec'
import { optional, paymentMeans, tradeParty } from './cii-parties.js'
import type { LineTerms } from './e-invoice-lines.js'
import type { InvoiceTerms } from './e-invoice-terms.js'
import type { InvoiceTotals, VatBreakdown } from './e-invoice-totals.js'
import { element, leaf, xmlDocument } from './xml.js'
import type { XmlAttribute, XmlElement } from './xml.js'

/** What the XML is written from: the specification identifier, the type and the currency, every term, the lines in the table's order, and the totals. */
export interface CiiInvoice {
  /** BT-24: the profile's or the XRechnung version's, as report-spec names it. */
  readonly guideline: string
  readonly type: InvoiceTypeCode
  readonly currency: EInvoiceCurrency
  readonly terms: InvoiceTerms
  readonly lines: readonly LineTerms[]
  readonly totals: InvoiceTotals
}

/** CEN/TC 434's CII namespaces, as its schematron declares them. */
const NAMESPACES: readonly XmlAttribute[] = [
  ['xmlns:rsm', 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100'],
  ['xmlns:qdt', 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100'],
  ['xmlns:ram', 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100'],
  ['xmlns:udt', 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100'],
]

/** A date, YYYY-MM-DD as the runtime holds one, as CII writes it: format 102, YYYYMMDD. */
function dateTime(name: string, date: string): XmlElement {
  return element(name, [leaf('udt:DateTimeString', date.replaceAll('-', ''), [['format', '102']])])
}

/** An amount, from its own digits; a RangeError for one not at the two places every total and line amount is computed at. */
function amount(name: string, value: Decimal, attributes: readonly XmlAttribute[] = []): XmlElement {
  if (value.scale !== 2) throw new RangeError(`${name} is at ${value.scale} places, and an e-invoice's amounts are computed at two`)
  return leaf(name, decimalToString(value), attributes)
}

/** A tax (BT-118, BT-119; at a line BT-151, BT-152): `VAT`, its category and its rate, and its reason, basis and amount where a breakdown has them. */
function tradeTax(breakdown: VatBreakdown, totals?: { readonly reason: string | undefined }): XmlElement {
  return element('ram:ApplicableTradeTax', [
    totals === undefined ? undefined : amount('ram:CalculatedAmount', breakdown.amount),
    leaf('ram:TypeCode', 'VAT'),
    optional(totals?.reason, (reason) => leaf('ram:ExemptionReason', reason)),
    totals === undefined ? undefined : amount('ram:BasisAmount', breakdown.basis),
    leaf('ram:CategoryCode', breakdown.category.code),
    leaf('ram:RateApplicablePercent', breakdown.rate),
  ])
}

/** A line (BG-25): its identifier (BT-126), its item (BT-153), its net price (BT-146), its quantity and unit (BT-129, BT-130), its tax and its net amount (BT-131). */
function line(each: LineTerms, breakdown: VatBreakdown): XmlElement {
  return element('ram:IncludedSupplyChainTradeLineItem', [
    element('ram:AssociatedDocumentLineDocument', [leaf('ram:LineID', each.id)]),
    element('ram:SpecifiedTradeProduct', [leaf('ram:Name', each.name)]),
    element('ram:SpecifiedLineTradeAgreement', [element('ram:NetPriceProductTradePrice', [leaf('ram:ChargeAmount', each.netPrice)])]),
    element('ram:SpecifiedLineTradeDelivery', [leaf('ram:BilledQuantity', each.quantity, [['unitCode', each.unit]])]),
    element('ram:SpecifiedLineTradeSettlement', [tradeTax(breakdown), element('ram:SpecifiedTradeSettlementLineMonetarySummation', [amount('ram:LineTotalAmount', each.netAmount)])]),
  ])
}

/** The settlement: the remittance (BT-83), the currency (BT-5), the payment, the breakdown, the period (BG-14), the terms (BT-20, BT-9) and the totals (BG-22). */
function settlement(invoice: CiiInvoice): XmlElement {
  const { terms, totals, currency } = invoice
  const period = terms.period
  return element('ram:ApplicableHeaderTradeSettlement', [
    optional(terms.payment?.remittance, (remittance) => leaf('ram:PaymentReference', remittance)),
    leaf('ram:InvoiceCurrencyCode', currency),
    terms.payment === undefined ? undefined : paymentMeans(terms.payment),
    ...totals.breakdown.map((breakdown) => tradeTax(breakdown, { reason: terms.reasons.get(breakdown.category.id) })),
    period === undefined ? undefined : element('ram:BillingSpecifiedPeriod', [optional(period.start, (start) => dateTime('ram:StartDateTime', start)), optional(period.end, (end) => dateTime('ram:EndDateTime', end))]),
    terms.terms === undefined && terms.due === undefined
      ? undefined
      : element('ram:SpecifiedTradePaymentTerms', [optional(terms.terms, (text) => leaf('ram:Description', text)), optional(terms.due, (due) => dateTime('ram:DueDateDateTime', due))]),
    element('ram:SpecifiedTradeSettlementHeaderMonetarySummation', [
      amount('ram:LineTotalAmount', totals.lineTotal),
      amount('ram:TaxBasisTotalAmount', totals.taxBasisTotal),
      amount('ram:TaxTotalAmount', totals.taxTotal, [['currencyID', currency]]),
      amount('ram:GrandTotalAmount', totals.grandTotal),
      totals.paid === null ? undefined : amount('ram:TotalPrepaidAmount', totals.paid),
      amount('ram:DuePayableAmount', totals.duePayable),
    ]),
  ])
}

/** `invoice` as CII XML, UTF-8 text with its declaration, the same bytes for the same invoice. */
export function ciiXml(invoice: CiiInvoice): string {
  const { terms, totals } = invoice
  const breakdowns = new Map(totals.breakdown.map((breakdown) => [breakdown.category.id, breakdown]))
  const root = element(
    'rsm:CrossIndustryInvoice',
    [
      element('rsm:ExchangedDocumentContext', [
        optional(terms.businessProcess, (process) => element('ram:BusinessProcessSpecifiedDocumentContextParameter', [leaf('ram:ID', process)])),
        element('ram:GuidelineSpecifiedDocumentContextParameter', [leaf('ram:ID', invoice.guideline)]),
      ]),
      element('rsm:ExchangedDocument', [leaf('ram:ID', terms.number), leaf('ram:TypeCode', invoice.type), dateTime('ram:IssueDateTime', terms.issued)]),
      element('rsm:SupplyChainTradeTransaction', [
        // Every line's category has a breakdown: the totals are computed from these lines.
        ...invoice.lines.map((each) => line(each, breakdowns.get(each.category.id) as VatBreakdown)),
        element('ram:ApplicableHeaderTradeAgreement', [optional(terms.buyerReference, (reference) => leaf('ram:BuyerReference', reference)), tradeParty('ram:SellerTradeParty', terms.seller), tradeParty('ram:BuyerTradeParty', terms.buyer)]),
        element('ram:ApplicableHeaderTradeDelivery', [optional(terms.delivered, (delivered) => element('ram:ActualDeliverySupplyChainEvent', [dateTime('ram:OccurrenceDateTime', delivered)]))]),
        settlement(invoice),
      ]),
    ],
    NAMESPACES,
  )
  return xmlDocument(root)
}
