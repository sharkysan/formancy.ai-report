import { resolveReport, type Block, type QrBill, type ReportDefinition, type ResolvedDocument } from '@formancy/report-runtime'
import { bareDocument, documentOf } from './documents.js'

/**
 * QR-bills for the renderer's tests, resolved by the runtime from a report
 * that carries one: the payload and every printed text are the runtime's,
 * as a render is handed them. "IG" is SIX's Swiss Implementation Guidelines
 * for the QR-bill, version 2.4; its Annex A's examples are the golden
 * cases, each with a literal amount where the example has one.
 */

type SwissQrBill = NonNullable<ReportDefinition['paymentPart']>
type Text = SwissQrBill['account']
type Address = SwissQrBill['creditor']

const text = (value: string): Text => [{ kind: 'text', text: value }]

function address(name: string, street: string | undefined, buildingNumber: string | undefined, postalCode: string, town: string, country: string): Address {
  return {
    name: text(name),
    ...(street === undefined ? {} : { street: text(street) }),
    ...(buildingNumber === undefined ? {} : { buildingNumber: text(buildingNumber) }),
    postalCode: text(postalCode),
    town: text(town),
    country: text(country),
  }
}

const SAMPLE_COMPANY = address('Max Muster & Söhne', 'Musterstrasse', '123', '8000', 'Seldwyla', 'CH')
const SIMON = address('Simon Muster', 'Musterstrasse', '1', '8000', 'Seldwyla', 'CH')
const amount = (value: string): NonNullable<SwissQrBill['amount']> => ({ cel: `dec('${value}')` })

/** SIX's examples (IG Annex A, Tables 17 to 22), but example 4, whose creditor reference has wrong check digits. */
export const SIX_EXAMPLES = {
  /** A QR-IBAN and a QR reference. */
  one: {
    kind: 'swissQrBill',
    language: 'en',
    account: text('CH6431961000004421557'),
    creditor: SAMPLE_COMPANY,
    currency: 'CHF',
    amount: amount('50.00'),
    debtor: SIMON,
    reference: text('000008207791225857421286694'),
    message: text('Payment of travel'),
  },
  /** A QR reference with billing information, in Swico's syntax. */
  two: {
    kind: 'swissQrBill',
    language: 'en',
    account: text('CH4431999123000889012'),
    creditor: SAMPLE_COMPANY,
    currency: 'CHF',
    amount: amount('1949.75'),
    debtor: SIMON,
    reference: text('210000000003139471430009017'),
    message: text('Order from 15.10.2020'),
    billingInformation: text('//S1/10/1234/11/201021/30/102673386/32/7.7/40/0:30'),
  },
  /** No amount, no debtor and no reference: a donation slip, its blank fields for the payer's hand. */
  three: {
    kind: 'swissQrBill',
    language: 'en',
    account: text('CH5204835012345671000'),
    creditor: address('Muster Stiftung', 'P.O. box', undefined, '3001', 'Bern', 'CH'),
    currency: 'CHF',
  },
  /** A creditor in Liechtenstein, and a creditor reference. */
  five: {
    kind: 'swissQrBill',
    language: 'en',
    account: text('CH5800791123000889012'),
    creditor: address('Max Muster & Söhne', 'Musterstrasse', '123', '9490', 'Vaduz', 'LI'),
    currency: 'CHF',
    amount: amount('199.95'),
    debtor: address('Sarah Beispiel', 'Musterstrasse', '1', '8000', 'Seldwyla', 'CH'),
    reference: text('RF18539007547034'),
  },
  /** A debtor in Germany. */
  six: {
    kind: 'swissQrBill',
    language: 'en',
    account: text('CH5800791123000889012'),
    creditor: SAMPLE_COMPANY,
    currency: 'CHF',
    amount: amount('199.95'),
    debtor: address('Sarah Beispiel', 'Musterstrasse', '1', '78462', 'Konstanz', 'DE'),
    reference: text('RF18539007547034'),
  },
} as const satisfies Record<string, SwissQrBill>

/** Example 2 in German, whose headings hold umlauts: "Währung", "Zusätzliche Informationen". */
export const GERMAN: SwissQrBill = { ...SIX_EXAMPLES.two, language: 'de' }

/** A report of nothing but `bill`, on A4 upright with 10 mm margins, as the runtime validates one. */
function invoice(bill: SwissQrBill): ReportDefinition {
  return {
    reportSpecVersion: '0',
    id: 'invoice',
    title: 'Invoice',
    locale: 'de-CH',
    page: { size: 'A4', orientation: 'portrait', margins: { top: 28.35, right: 28.35, bottom: 28.35, left: 28.35 } },
    styles: [],
    datasets: {},
    parameters: [],
    assets: [],
    aggregates: [],
    regions: { reportHeader: [], pageHeader: [], body: [], pageFooter: [], summary: [] },
    provenance: { kind: 'blank' },
    paymentPart: bill,
  }
}

/** `bill` as the runtime resolves it for a final render. */
export function resolvedBill(bill: SwissQrBill): QrBill {
  const outcome = resolveReport(
    invoice(bill),
    { completeness: { complete: true, captured: 0 }, consistency: 'host-captured' },
    { mode: 'final', creationDate: '2026-10-17T08:00:00Z' },
  )
  if (!outcome.ok) throw new Error(`the bill was refused: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  if (outcome.document.paymentPart === undefined) throw new Error('the runtime resolved no payment part')
  return outcome.document.paymentPart
}

/** The corpus's page with its page header and footer, `body`, and `bill` at the foot of its last page. */
export function billDocument(bill: QrBill, body: readonly Block[] = []): ResolvedDocument {
  return { ...documentOf('Invoice', body), paymentPart: bill }
}

/** The same without page regions, so that every run on a page is the body's or the slip's. */
export function bareBillDocument(bill: QrBill, body: readonly Block[] = []): ResolvedDocument {
  return { ...bareDocument('Invoice', body), paymentPart: bill }
}
