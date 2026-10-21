/**
 * What the runtime's tests build reports and data from. Only test files
 * import this; the published entry never reaches it.
 *
 * `sampleReport` is one valid report whose detail dataset has a field of
 * every type and whose parameters have every type, with an expression that
 * can fail at render time -- a quantity divided by a parameter -- so a test
 * can show where a failure is reported. `sampleData` is data it accepts.
 *
 * `invoiceReport` is a German invoice that is an e-invoice, whose buyer,
 * dates and lines are read from the data, every field nullable, so that a
 * test can hand it a null; `invoiceData` is data it accepts.
 */
import { validateReport } from '@formancy/report-spec'
import type { Component, DatasetContract, FacturXInvoice, FieldRef, Inline, ReportDefinition, XRechnungInvoice } from '@formancy/report-spec'
import type { ReportData } from './data.js'

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const detail = (field: string): FieldRef => ({ dataset: 'detail', field })

const REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'deliveries',
  title: 'Deliveries by site',
  locale: 'de-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 } },
  styles: [{ id: 'strong', bold: true }],
  datasets: {
    header: {
      id: 'delivery-header',
      fields: [
        { id: 'customer', type: 'string', label: 'Customer', nullable: false },
        { id: 'orderedOn', type: 'date', label: 'Ordered on', nullable: false },
        { id: 'currency', type: 'string', label: 'Currency', nullable: true },
        { id: 'reference', type: 'integer', label: 'Reference', nullable: false },
        { id: 'signature', type: 'image', label: 'Signature', nullable: true },
      ],
    },
    detail: {
      id: 'delivery-lines',
      fields: [
        { id: 'site', type: 'string', label: 'Site', nullable: true },
        { id: 'sku', type: 'string', label: 'SKU', nullable: false },
        { id: 'quantity', type: 'integer', label: 'Quantity', nullable: false },
        { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
        { id: 'rate', type: 'decimal', label: 'Rate', nullable: true },
        { id: 'shippedAt', type: 'datetime', label: 'Shipped at', nullable: true },
        { id: 'recordedAt', type: 'instant', label: 'Recorded', nullable: false },
        { id: 'dueOn', type: 'date', label: 'Due on', nullable: true },
        { id: 'urgent', type: 'boolean', label: 'Urgent', nullable: false },
      ],
    },
  },
  parameters: [
    { id: 'from', type: 'date', label: 'From', required: true },
    { id: 'draft', type: 'boolean', label: 'Draft', required: false, default: false },
    { id: 'threshold', type: 'decimal', label: 'Threshold', required: false },
    { id: 'currency', type: 'string', label: 'Currency', required: false, default: 'CHF' },
    { id: 'copies', type: 'integer', label: 'Copies', required: false, default: '1' },
    { id: 'heading', type: 'string', label: 'Heading', required: true, default: 'Deliveries' },
  ],
  assets: [],
  aggregates: [
    { id: 'subtotal', fn: 'sum', of: { kind: 'field', field: detail('amount') }, rounding: { scale: 2, mode: 'half-even' } },
    { id: 'lines', fn: 'count' },
    { id: 'gross', fn: 'sum', of: { kind: 'expression', expression: { cel: 'row.amount * dec("1.081")' } } },
  ],
  regions: {
    reportHeader: [
      {
        id: 'title',
        kind: 'text',
        style: 'strong',
        content: [
          { kind: 'parameter', parameter: 'heading' },
          { kind: 'text', text: ' for ' },
          { kind: 'field', field: header('customer') },
          { kind: 'field', field: header('orderedOn'), format: { kind: 'date', style: 'long' } },
          { kind: 'field', field: header('reference') },
          { kind: 'parameter', parameter: 'from' },
        ],
      },
      { id: 'signature-image', kind: 'image', source: { kind: 'field', field: header('signature') }, width: 150, height: 50, fit: 'contain' },
    ],
    pageHeader: [],
    body: [
      {
        id: 'intro',
        kind: 'text',
        visibleWhen: { cel: 'params.draft == false' },
        content: [
          { kind: 'expression', expression: { cel: 'header.customer + " x" + string(params.copies)' } },
          { kind: 'parameter', parameter: 'threshold', format: { kind: 'currency', currency: { kind: 'parameter', parameter: 'currency' }, scale: 2 } },
        ],
      },
      {
        id: 'lines',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'sku', header: 'SKU', width: 80, align: 'left', value: { kind: 'field', field: detail('sku') } },
          { id: 'qty', header: 'Qty', width: 50, align: 'right', value: { kind: 'field', field: detail('quantity') } },
          {
            id: 'per-copy',
            header: 'Per copy',
            width: 60,
            align: 'right',
            value: { kind: 'expression', expression: { cel: 'divide(dec(row.quantity), dec(params.copies), 2)' } },
          },
          {
            id: 'amount',
            header: 'Amount',
            width: 'fill',
            align: 'right',
            value: { kind: 'field', field: detail('amount'), format: { kind: 'currency', currency: { kind: 'field', field: header('currency') }, scale: 2 } },
            styleWhen: [{ when: { cel: 'row.urgent' }, style: 'strong' }],
          },
          { id: 'rate', header: 'Rate', width: 50, align: 'right', value: { kind: 'field', field: detail('rate') } },
          { id: 'shipped', header: 'Shipped', width: 70, align: 'left', value: { kind: 'field', field: detail('shippedAt'), format: { kind: 'date', style: 'short' } } },
          { id: 'recorded', header: 'Recorded', width: 70, align: 'left', value: { kind: 'field', field: detail('recordedAt'), format: { kind: 'date', style: 'medium' } } },
          { id: 'due', header: 'Due', width: 60, align: 'left', value: { kind: 'field', field: detail('dueOn') } },
        ],
        sort: [{ field: detail('sku'), direction: 'asc' }],
        group: {
          by: detail('site'),
          direction: 'asc',
          header: [{ kind: 'field', field: detail('site') }],
          footer: [{ cells: [{ column: 'amount', value: { kind: 'aggregate', aggregate: 'subtotal', over: 'group' } }] }],
        },
        totals: [
          {
            cells: [
              { column: 'qty', value: { kind: 'aggregate', aggregate: 'lines', over: 'report' } },
              { column: 'amount', value: { kind: 'expression', expression: { cel: 'totals.gross' } } },
            ],
          },
        ],
        emptyText: 'No deliveries.',
        repeatHeader: true,
      },
    ],
    pageFooter: [],
    summary: [],
  },
}

/** A fresh, mutable copy of the sample report, checked valid. */
export function sampleReport(): ReportDefinition {
  const copy = JSON.parse(JSON.stringify(REPORT)) as ReportDefinition
  const outcome = validateReport(copy)
  if (!outcome.valid) throw new Error(`the sample report is not valid: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return copy
}

/** One detail row the sample report accepts, every field present; `overrides` replace or add fields. */
export function sampleRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    site: 'Bern',
    sku: 'A-1',
    quantity: '3',
    amount: '12.50',
    rate: '0.081',
    shippedAt: '2026-01-01T09:30:00',
    recordedAt: '2026-01-01T08:00:00Z',
    dueOn: '2026-01-31',
    urgent: false,
    ...overrides,
  }
}

/** Data the sample report accepts in a final render: a header and `rows`, complete. */
export function sampleData(rows: readonly Record<string, unknown>[] = [sampleRow()]): ReportData {
  return {
    header: { customer: 'Muster AG', orderedOn: '2026-01-01', currency: 'CHF', reference: '42', signature: null },
    detail: rows,
    completeness: { complete: true, captured: rows.length },
    consistency: 'host-captured',
  }
}

/** Runs of one literal text. */
const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]

/** A run that prints what `cel` gives, in euro. */
const euro = (cel: string): Inline => ({ kind: 'expression', expression: { cel }, format: { kind: 'currency', currency: { kind: 'code', code: 'EUR' }, scale: 2 } })

/** What prints every total the e-invoice's XML holds: the total without VAT, each category's basis and tax where a line is in it, the VAT and the total with it. */
const PRINTED_TOTALS: readonly Component[] = [
  { id: 'net', kind: 'text', content: [{ kind: 'text', text: 'Netto ' }, euro('invoice.taxBasisTotal')] },
  ...(['standard', 'reduced', 'exempt'] as const).map(
    (id): Component => ({
      id: `vat-${id}`,
      kind: 'text',
      visibleWhen: { cel: `vatAmount.${id} != null` },
      content: [{ kind: 'text', text: `${id} ` }, euro(`vatBasis.${id}`), { kind: 'text', text: ': ' }, euro(`vatAmount.${id}`)],
    }),
  ),
  { id: 'vat', kind: 'text', content: [{ kind: 'text', text: 'MwSt. ' }, euro('invoice.taxTotal')] },
  { id: 'gross', kind: 'text', content: [{ kind: 'text', text: 'Brutto ' }, euro('invoice.grandTotal')] },
]

const EUR = { kind: 'currency', currency: { kind: 'code', code: 'EUR' }, scale: 2 } as const

const INVOICE: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'rechnung',
  title: 'Rechnung',
  locale: 'de-DE',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 } },
  styles: [],
  datasets: {
    header: {
      id: 'invoice-header',
      fields: [
        { id: 'number', type: 'string', label: 'Number', nullable: true },
        { id: 'issuedOn', type: 'date', label: 'Issued on', nullable: true },
        { id: 'deliveredOn', type: 'date', label: 'Delivered on', nullable: true },
        { id: 'buyer', type: 'string', label: 'Buyer', nullable: true },
        { id: 'street', type: 'string', label: 'Street', nullable: true },
        { id: 'postalCode', type: 'string', label: 'Post code', nullable: true },
        { id: 'city', type: 'string', label: 'City', nullable: true },
        { id: 'country', type: 'string', label: 'Country', nullable: true },
        { id: 'buyerVatId', type: 'string', label: 'Buyer VAT ID', nullable: true },
        { id: 'dueOn', type: 'date', label: 'Due on', nullable: true },
      ],
    },
    detail: {
      id: 'invoice-lines',
      fields: [
        { id: 'position', type: 'integer', label: 'Position', nullable: true },
        { id: 'item', type: 'string', label: 'Item', nullable: true },
        { id: 'quantity', type: 'decimal', label: 'Quantity', nullable: true },
        { id: 'unit', type: 'string', label: 'Unit', nullable: true },
        { id: 'price', type: 'decimal', label: 'Price', nullable: true },
        { id: 'amount', type: 'decimal', label: 'Amount', nullable: true },
        { id: 'vat', type: 'string', label: 'VAT', nullable: true },
      ],
    },
  },
  parameters: [],
  assets: [],
  aggregates: [],
  regions: {
    reportHeader: [{ id: 'heading', kind: 'text', content: [{ kind: 'text', text: 'Rechnung ' }, { kind: 'field', field: header('number') }] }],
    pageHeader: [],
    body: [
      {
        id: 'lines',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'pos', header: 'Pos.', width: 30, align: 'right', value: { kind: 'field', field: detail('position') } },
          { id: 'item', header: 'Artikel', width: 'fill', align: 'left', value: { kind: 'field', field: detail('item') } },
          { id: 'qty', header: 'Menge', width: 50, align: 'right', value: { kind: 'field', field: detail('quantity') } },
          { id: 'price', header: 'Preis', width: 70, align: 'right', value: { kind: 'field', field: detail('price'), format: EUR } },
          { id: 'amount', header: 'Betrag', width: 80, align: 'right', value: { kind: 'field', field: detail('amount'), format: EUR } },
        ],
        sort: [{ field: detail('position'), direction: 'asc' }],
        emptyText: 'Keine Positionen.',
        repeatHeader: true,
      },
    ],
    pageFooter: [],
    summary: PRINTED_TOTALS,
  },
  eInvoice: {
    kind: 'facturX',
    profile: 'en16931',
    type: '380',
    currency: 'EUR',
    number: [{ kind: 'field', field: header('number') }],
    issued: { cel: 'header.issuedOn' },
    seller: {
      name: said('Muster & Söhne GmbH'),
      vatId: said('DE 123 456 789'),
      address: { line1: said('Industriestraße 7'), postalCode: said('50735'), city: said('Köln'), country: said('DE') },
    },
    buyer: {
      name: [{ kind: 'field', field: header('buyer') }],
      vatId: [{ kind: 'field', field: header('buyerVatId') }],
      address: {
        line1: [{ kind: 'field', field: header('street') }],
        postalCode: [{ kind: 'field', field: header('postalCode') }],
        city: [{ kind: 'field', field: header('city') }],
        country: [{ kind: 'field', field: header('country') }],
      },
    },
    delivered: { cel: 'header.deliveredOn' },
    vat: [
      { id: 'standard', code: 'S', rate: '19' },
      { id: 'reduced', code: 'S', rate: '7.00' },
      { id: 'exempt', code: 'E', rate: '0', reason: said('Steuerfrei nach § 4 Nr. 14 UStG') },
    ],
    lines: {
      table: 'lines',
      name: 'item',
      quantity: 'qty',
      netPrice: 'price',
      netAmount: 'amount',
      id: { kind: 'field', field: detail('position') },
      unit: { kind: 'field', field: detail('unit') },
      vat: { kind: 'field', field: detail('vat') },
    },
    payment: { means: '58', iban: said('DE83 0123 4567 0012 3456 78'), remittance: [{ kind: 'text', text: 'Rechnung ' }, { kind: 'field', field: header('number') }] },
    due: { cel: 'header.dueOn' },
  },
}

/** A fresh, mutable copy of the invoice report, checked valid. */
export function invoiceReport(): ReportDefinition {
  const copy = JSON.parse(JSON.stringify(INVOICE)) as ReportDefinition
  const outcome = validateReport(copy)
  if (!outcome.valid) throw new Error(`the invoice report is not valid: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join(', ')}`)
  return copy
}

/** One line the invoice report accepts, every term present; `overrides` replace or add terms. */
export function invoiceRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { position: '1', item: 'Schrauben M6', quantity: '100', unit: 'H87', price: '0.25', amount: '25.00', vat: 'standard', ...overrides }
}

/** Data the invoice report accepts in a final render: a buyer in Vienna and `rows`, complete; `header` replaces or adds header fields. */
export function invoiceData(rows: readonly Record<string, unknown>[] = [invoiceRow()], header: Record<string, unknown> = {}): ReportData {
  return {
    header: {
      number: 'RE-2026-0042',
      issuedOn: '2026-10-17',
      deliveredOn: '2026-10-15',
      buyer: 'Bäckerei Huber GmbH',
      street: 'Ring 1',
      postalCode: '1010',
      city: 'Wien',
      country: 'AT',
      buyerVatId: 'ATU12345678',
      dueOn: '2026-10-31',
      ...header,
    },
    detail: rows,
    completeness: { complete: true, captured: rows.length },
    consistency: 'host-captured',
  }
}

/** The firm's contact (BG-6) the XRechnung fixture names: at one of the Bundesnetzagentur's numbers for Köln, at an address under `.example`. */
const CONTACT = { name: said('Erika Mustermann'), telephone: said('+49 221 4710 820'), email: said('e.mustermann@muster-soehne.example') }

/**
 * The invoice report as an XRechnung (0038), checked valid: its e-invoice
 * of the kind `xrechnung`, with Peppol's business process, the firm's
 * contact and its invoice inbox by email, and the buyer's reference and its
 * electronic address the Leitweg-ID the data gives (`leitwegId`), under
 * 0204; everything else the invoice report's.
 */
export function xrechnungReport(): ReportDefinition {
  const report = invoiceReport()
  const { kind: _kind, profile: _profile, ...terms } = report.eInvoice as FacturXInvoice
  const leitwegId = [{ kind: 'field', field: header('leitwegId') }] as const
  const invoice: XRechnungInvoice = {
    ...terms,
    kind: 'xrechnung',
    version: '3.0',
    businessProcess: said('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'),
    seller: { ...terms.seller, electronicAddress: { id: said('rechnung@muster-soehne.example'), scheme: 'EM' }, contact: CONTACT },
    buyer: { ...terms.buyer, electronicAddress: { id: leitwegId, scheme: '0204' } },
    buyerReference: leitwegId,
    payment: terms.payment as NonNullable<FacturXInvoice['payment']>,
  }
  const headerSet = report.datasets.header as DatasetContract
  const copy: ReportDefinition = { ...report, id: 'xrechnung', datasets: { ...report.datasets, header: { ...headerSet, fields: [...headerSet.fields, { id: 'leitwegId', type: 'string', label: 'Leitweg-ID', nullable: true }] } }, eInvoice: invoice }
  const outcome = validateReport(copy)
  if (!outcome.valid) throw new Error(`the XRechnung report is not valid: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join(', ')}`)
  return copy
}

/** Data the XRechnung report accepts in a final render: the invoice report's, and KoSIT's test Leitweg-ID for the federal test portal, `991-33333TEST-33`. */
export function xrechnungData(rows: readonly Record<string, unknown>[] = [invoiceRow()], header: Record<string, unknown> = {}): ReportData {
  return invoiceData(rows, { leitwegId: '991-33333TEST-33', ...header })
}

/**
 * A seeded linear congruential generator (Numerical Recipes' constants), so a
 * "random" sequence is the same on every run and every machine, and a failure
 * names a sequence that can be replayed.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

/** A whole number in [0, below), drawn from `next`. */
export function below(next: () => number, below: number): number {
  return Math.floor(next() * below)
}
