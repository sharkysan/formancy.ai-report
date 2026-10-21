import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { BUSINESS_PROCESS, CONTACT, data, E_INVOICE, FIRM_INBOX, INVOICE as FACTUR_X_INVOICE, lines, PAYMENT } from './e-invoice.js'
import type { Starter } from './starter.js'

/**
 * The XRechnung, "Rechnung (XRechnung)" (0038): the e-invoice's template
 * as an XRechnung 3.0, KoSIT's CIUS of EN 16931 a German public buyer asks
 * for, from the euro invoice's heating firm to an invented federal buyer,
 * the "Bundesamt für Beispielwesen" in Bonn, for servicing its heating. Its
 * XML is the invoice, which a host takes from the resolved document and
 * sends; its PDF, drawn from the same document, is a copy, labelled so on
 * every page. The e-invoice gate judges its XML in KoSIT's scenario
 * `EN16931 XRechnung (CII)` and with Mustang.
 *
 * It is the Factur-X sample's report made an XRechnung, apart in nothing
 * else, so that what the gate passes is the template an author has: its
 * kind and version where the profile was; what XRechnung needs past EN
 * 16931 -- the addressed sample's business process, the firm's invoice
 * inbox by email and its contact (0037), and the buyer's reference and its
 * electronic address under 0204, both the Leitweg-ID the data gives -- the
 * header field that gives it, and a line at the foot of the head that
 * prints it, as a public buyer asks an invoice to.
 *
 * Its identifiers are the standard-setters' own (Q11), read on 21 October
 * 2026: the Leitweg-ID `991-33333TEST-33`, from KoSIT's XRechnung 3.0.2
 * test suite of 2026-08-31 (`instances/standard/03.06a-INVOICE_uncefact.xml`),
 * whose check digits MOD 97-10 gives, and whose fine address says it is a
 * test's; the others the addressed sample's, as `e-invoice.ts` cites them.
 * The buyer is invented, as every party of the corpus is; the creditor
 * reference is ISO 11649's of the invoice's number, as the other samples'.
 */

type Invoice = NonNullable<ReportDefinition['eInvoice']>
type Component = ReportDefinition['regions']['body'][number]

const header = (field: string) => ({ dataset: 'header', field }) as const
/** The Leitweg-ID the data gives, as runs: the buyer's reference and its electronic address read it alike. */
const LEITWEG_ID = [{ kind: 'field', field: header('leitwegId') }] as const

/** The e-invoice as an XRechnung 3.0: the Factur-X sample's terms, and what XRechnung needs past them, the addressed sample's (0037) and the Leitweg-ID. */
const { kind: _kind, profile: _profile, ...TERMS } = FACTUR_X_INVOICE
const INVOICE: Extract<Invoice, { kind: 'xrechnung' }> = {
  ...TERMS,
  kind: 'xrechnung',
  version: '3.0',
  businessProcess: BUSINESS_PROCESS,
  seller: { ...TERMS.seller, electronicAddress: FIRM_INBOX, contact: CONTACT },
  buyer: { ...TERMS.buyer, electronicAddress: { id: LEITWEG_ID, scheme: '0204' } },
  buyerReference: LEITWEG_ID,
  payment: PAYMENT,
}

/** The head's right column with the Leitweg-ID printed at its foot. */
function withLeitwegId(components: readonly Component[]): Component[] {
  return [...components, { id: 'leitweg-id', kind: 'text', content: [{ kind: 'text', text: 'Leitweg-ID: ' }, ...LEITWEG_ID] }]
}

const BASE = E_INVOICE.report
const HEADER = BASE.datasets.header as NonNullable<ReportDefinition['datasets']['header']>

const REPORT: ReportDefinition = {
  ...BASE,
  id: 'e-invoice-xrechnung',
  title: 'Rechnung (XRechnung)',
  datasets: { ...BASE.datasets, header: { ...HEADER, fields: [...HEADER.fields, { id: 'leitwegId', type: 'string', label: 'Leitweg-ID', nullable: false }] } },
  regions: {
    ...BASE.regions,
    reportHeader: BASE.regions.reportHeader.map((component) =>
      component.kind === 'columns' && component.id === 'addresses' ? { ...component, columns: component.columns.map((column, index) => (index === 1 ? { ...column, components: withLeitwegId(column.components) } : column)) } : component,
    ),
  },
  eInvoice: INVOICE,
}

/** The federal buyer's heating serviced in its office in Bonn, all at 19 %, on a delivery date, to its Leitweg-ID. */
export function xrechnungData(): ReportData {
  return data(
    { number: 'RE-2026-0824', issuedOn: '2026-10-20', servedOn: '2026-10-14', dueOn: '2026-11-19', customer: 'Bundesamt für Beispielwesen', street: 'Beispielweg', buildingNumber: '12', postcode: '53113', city: 'Bonn', leitwegId: '991-33333TEST-33', reference: 'RF23 2026 0824' },
    lines(3501, [
      ['Wartung Gas-Brennwertkessel', 'Pausch.', '1.00', '245.00', 'standard'],
      ['Arbeitszeit Techniker', 'h', '2.50', '76.00', 'standard'],
      ['Abgasmessung', 'Pausch.', '1.00', '48.00', 'standard'],
      ['Anfahrt Bonn', 'Pausch.', '1.00', '52.00', 'standard'],
    ]),
  )
}

export const XRECHNUNG_SAMPLE: Starter = {
  id: 'e-invoice-xrechnung',
  title: 'Rechnung (XRechnung)',
  proves: 'an XRechnung 3.0 for a German public buyer: its XML the invoice a host takes, its Leitweg-ID the buyer’s reference and its electronic address, and its PDF a copy labelled so on every page',
  report: REPORT,
  data: xrechnungData(),
  parameters: {},
}

/** The XRechnung sample: one, a sample and no starter, judged by the gate as XML alone. */
export const XRECHNUNG_SAMPLES: readonly Starter[] = [XRECHNUNG_SAMPLE]
