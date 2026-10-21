/**
 * What the tests build reports from. Only test files import this; nothing
 * exports it, so the published entry never reaches it.
 *
 * `richReport` is one valid report that uses every component kind, every
 * inline, every format, every currency and image source, every aggregate
 * function, every table feature and a payment part, so that a refusal
 * test can break exactly one rule by editing it at one JSON Pointer and
 * show that the rule refuses that edit and nothing around it.
 * `eInvoiceReport` is that report as an e-invoice, for the same use, and
 * `xrechnungReport` that e-invoice as an XRechnung.
 */
import type { DatasetContract, FieldRef } from './data.js'
import type { ReportDefinition } from './definition.js'
import type { FacturXInvoice, XRechnungInvoice } from './e-invoice.js'
import type { ReportError } from './errors.js'
import { validateReport } from './validate.js'
import type { Inline } from './values.js'

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const detail = (field: string): FieldRef => ({ dataset: 'detail', field })

/** A fresh copy of a valid report that exercises the whole model. */
export function richReport(): ReportDefinition {
  return {
    reportSpecVersion: '0',
    id: 'orders',
    title: 'Orders by site',
    locale: 'de-CH',
    page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 } },
    styles: [
      { id: 'title', font: 'serif', size: 18, bold: true, color: '#1a1a2e' },
      { id: 'body', font: 'sans', size: 10.5 },
      { id: 'small', size: 8, italic: true, align: 'right' },
      { id: 'code', font: 'mono' },
      { id: 'strong', bold: true },
      { id: 'negative', color: '#b00020' },
    ],
    datasets: {
      header: {
        id: 'order-header',
        fields: [
          { id: 'customer', type: 'string', label: 'Customer', nullable: false },
          { id: 'orderedOn', type: 'date', label: 'Ordered on', nullable: false },
          { id: 'currency', type: 'string', label: 'Currency', nullable: false },
          { id: 'signature', type: 'image', label: 'Signature', nullable: true },
        ],
      },
      detail: {
        id: 'order-lines',
        fields: [
          { id: 'site', type: 'string', label: 'Site', nullable: false },
          { id: 'sku', type: 'string', label: 'SKU', nullable: false },
          { id: 'quantity', type: 'integer', label: 'Quantity', nullable: false },
          { id: 'unit_price', type: 'decimal', label: 'Unit price', nullable: false, scale: 4 },
          { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
          { id: 'shipped', type: 'boolean', label: 'Shipped', nullable: true },
          { id: 'shippedAt', type: 'datetime', label: 'Shipped at', nullable: true },
          { id: 'recordedAt', type: 'instant', label: 'Recorded', nullable: false },
          { id: 'dueOn', type: 'date', label: 'Due', nullable: false },
          { id: 'photo', type: 'image', label: 'Photo', nullable: true },
        ],
      },
    },
    parameters: [
      { id: 'from', type: 'date', label: 'From', required: true, default: '2026-01-01' },
      { id: 'region', type: 'string', label: 'Region', required: false, default: 'Zürich' },
      { id: 'min_quantity', type: 'integer', label: 'Minimum quantity', required: false, default: '1' },
      { id: 'threshold', type: 'decimal', label: 'Threshold', required: false, default: '99999999999999.9999' },
      { id: 'draft', type: 'boolean', label: 'Draft', required: false, default: false },
      { id: 'currency', type: 'string', label: 'Currency', required: false, default: 'CHF' },
    ],
    assets: [
      { id: 'logo', mediaType: 'image/png', digest: `sha256:${'ab'.repeat(32)}` },
      { id: 'seal', mediaType: 'image/jpeg', digest: `sha256:${'0f'.repeat(32)}` },
    ],
    aggregates: [
      { id: 'subtotal', fn: 'sum', of: { kind: 'field', field: detail('amount') }, rounding: { scale: 2, mode: 'half-even' } },
      { id: 'lines', fn: 'count' },
      {
        id: 'gross',
        fn: 'sum',
        of: { kind: 'expression', expression: { cel: 'dec(row.amount) * dec("1.081")' } },
        rounding: { scale: 2, mode: 'half-away-from-zero', increment: '0.05' },
      },
      { id: 'average', fn: 'avg', of: { kind: 'field', field: detail('quantity') }, rounding: { scale: 1, mode: 'half-even' } },
      { id: 'latest', fn: 'max', of: { kind: 'field', field: detail('shippedAt') } },
      { id: 'earliest', fn: 'min', of: { kind: 'field', field: detail('dueOn') } },
    ],
    regions: {
      reportHeader: [
        {
          id: 'heading',
          kind: 'columns',
          columns: [
            { width: 120, components: [{ id: 'logo-image', kind: 'image', source: { kind: 'asset', asset: 'logo' }, width: 100, height: 40, fit: 'contain' }] },
            {
              width: 'fill',
              components: [
                {
                  id: 'title',
                  kind: 'text',
                  style: 'title',
                  keepWithNext: true,
                  content: [
                    { kind: 'text', text: 'Orders for ' },
                    { kind: 'field', field: header('customer'), format: { kind: 'text', transform: 'upper' } },
                  ],
                },
              ],
            },
          ],
        },
        { id: 'rule', kind: 'line', thickness: 0.5, color: '#999999' },
      ],
      pageHeader: [
        { id: 'running-title', kind: 'text', style: 'small', content: [{ kind: 'parameter', parameter: 'from', format: { kind: 'date', style: 'medium' } }] },
      ],
      body: [
        {
          id: 'intro',
          kind: 'text',
          style: 'body',
          visibleWhen: { cel: 'params.draft == false' },
          styleWhen: [{ when: { cel: 'totals.lines > 100' }, style: 'small' }],
          content: [
            { kind: 'text', text: 'Ordered on ' },
            { kind: 'field', field: header('orderedOn'), format: { kind: 'date', style: 'long' } },
            { kind: 'expression', expression: { cel: 'header.customer' }, format: { kind: 'text' } },
          ],
        },
        { id: 'gap', kind: 'spacer', height: 12 },
        {
          id: 'lines',
          kind: 'table',
          dataset: 'detail',
          headerStyle: 'strong',
          columns: [
            { id: 'sku', header: 'SKU', width: 80, align: 'left', value: { kind: 'field', field: detail('sku'), format: { kind: 'text' } } },
            {
              id: 'qty',
              header: 'Qty',
              width: 50,
              align: 'right',
              value: { kind: 'field', field: detail('quantity'), format: { kind: 'number', scale: 0, grouping: true } },
            },
            {
              id: 'price',
              header: 'Price',
              width: 'fill',
              align: 'right',
              value: { kind: 'field', field: detail('unit_price'), format: { kind: 'currency', currency: { kind: 'field', field: header('currency') }, scale: 2 } },
            },
            {
              id: 'amount',
              header: 'Amount',
              width: 80,
              align: 'right',
              value: { kind: 'expression', expression: { cel: 'round(dec(row.quantity) * dec(row.unit_price), 2)' } },
              styleWhen: [{ when: { cel: 'dec(row.amount) < dec("0")' }, style: 'negative' }],
            },
            {
              id: 'shipped-at',
              header: 'Shipped',
              width: 70,
              align: 'center',
              value: { kind: 'field', field: detail('shippedAt'), format: { kind: 'date', style: 'short' } },
              visibleWhen: { cel: 'params.draft == false' },
              style: 'small',
            },
          ],
          sort: [{ field: detail('sku'), direction: 'desc' }],
          group: {
            by: detail('site'),
            direction: 'asc',
            header: [
              { kind: 'text', text: 'Site ' },
              { kind: 'field', field: detail('site') },
            ],
            headerStyle: 'strong',
            footer: [
              {
                cells: [
                  { column: 'sku', value: { kind: 'text', text: 'Subtotal' } },
                  {
                    column: 'amount',
                    value: { kind: 'aggregate', aggregate: 'subtotal', over: 'group', format: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } },
                  },
                ],
              },
            ],
          },
          totals: [
            {
              cells: [
                { column: 'sku', value: { kind: 'text', text: 'Total' } },
                { column: 'qty', value: { kind: 'aggregate', aggregate: 'lines', over: 'report', format: { kind: 'number', scale: 0, grouping: false } } },
                { column: 'amount', value: { kind: 'aggregate', aggregate: 'subtotal', over: 'report' } },
              ],
            },
            {
              cells: [
                { column: 'sku', value: { kind: 'text', text: 'Total incl. VAT' } },
                { column: 'amount', value: { kind: 'expression', expression: { cel: 'totals.gross' } } },
              ],
              style: 'strong',
            },
          ],
          emptyText: 'No order lines.',
          repeatHeader: true,
        },
        {
          id: 'keep',
          kind: 'keepTogether',
          components: [
            { id: 'box', kind: 'rectangle', width: 200, height: 40, fill: '#f0f0f0', stroke: '#333333' },
            { id: 'note', kind: 'text', style: 'code', content: [{ kind: 'text', text: 'Thank you.' }] },
          ],
        },
        { id: 'break', kind: 'pageBreak' },
      ],
      pageFooter: [
        {
          id: 'page-of',
          kind: 'text',
          style: 'small',
          content: [{ kind: 'text', text: 'Page ' }, { kind: 'pageNumber' }, { kind: 'text', text: ' of ' }, { kind: 'pageCount' }],
        },
      ],
      summary: [
        {
          id: 'closing',
          kind: 'section',
          visibleWhen: { cel: 'totals.lines > 0' },
          border: { thickness: 0.5, color: '#333333' },
          fill: '#fafafa',
          padding: 6,
          components: [
            {
              id: 'threshold',
              kind: 'text',
              content: [
                { kind: 'parameter', parameter: 'threshold', format: { kind: 'currency', currency: { kind: 'parameter', parameter: 'currency' }, scale: 2 } },
              ],
            },
            {
              id: 'statistics',
              kind: 'text',
              content: [
                { kind: 'aggregate', aggregate: 'average', over: 'report', format: { kind: 'number', scale: 1, grouping: false } },
                { kind: 'text', text: ' per line, due from ' },
                { kind: 'aggregate', aggregate: 'earliest', over: 'report', format: { kind: 'date', style: 'short' } },
                { kind: 'text', text: ', last shipped ' },
                { kind: 'aggregate', aggregate: 'latest', over: 'report' },
              ],
            },
            { id: 'signature-image', kind: 'image', source: { kind: 'field', field: header('signature') }, width: 150, height: 50, fit: 'contain' },
          ],
        },
        { id: 'seal-image', kind: 'image', source: { kind: 'asset', asset: 'seal' }, width: 200, height: 150, fit: 'cover' },
        {
          id: 'order-code',
          kind: 'qrCode',
          content: [
            { kind: 'text', text: 'Orders for ' },
            { kind: 'field', field: header('customer') },
          ],
          size: 85.04,
          errorCorrection: 'Q',
        },
        // The EPC's first sample (EPC069-12 2.3), literal where its account
        // is, its amount a total and its information computed, in Austria's
        // frame.
        {
          id: 'payment-code',
          kind: 'epcQrCode',
          size: 85.04,
          beneficiary: [{ kind: 'text', text: 'Franz Mustermänn' }],
          iban: [{ kind: 'text', text: 'DE71 1102 2033 0123 4567 89' }],
          bic: [{ kind: 'text', text: 'BHBLDEHHXXX' }],
          amount: { cel: 'totals.subtotal' },
          purpose: 'GDDS',
          reference: [{ kind: 'text', text: 'RF18 5390 0754 7034' }],
          information: [
            { kind: 'text', text: 'Orders from ' },
            { kind: 'expression', expression: { cel: 'params.region' } },
          ],
          caption: 'zahlenMitCode',
        },
      ],
    },
    // SIX's second example (IG 2.4, Annex A): a QR-IBAN and a QR reference,
    // its texts literal where the creditor's are and read from the data
    // where the debtor's and the message are.
    paymentPart: {
      kind: 'swissQrBill',
      language: 'de',
      account: [{ kind: 'text', text: 'CH44 3199 9123 0008 8901 2' }],
      creditor: {
        name: [{ kind: 'text', text: 'Max Muster & Söhne' }],
        street: [{ kind: 'text', text: 'Musterstrasse' }],
        buildingNumber: [{ kind: 'text', text: '123' }],
        postalCode: [{ kind: 'text', text: '8000' }],
        town: [{ kind: 'text', text: 'Seldwyla' }],
        country: [{ kind: 'text', text: 'CH' }],
      },
      currency: 'CHF',
      amount: { cel: 'totals.subtotal' },
      debtor: {
        name: [{ kind: 'field', field: header('customer') }],
        postalCode: [{ kind: 'text', text: '8000' }],
        town: [{ kind: 'text', text: 'Seldwyla' }],
        country: [{ kind: 'text', text: 'CH' }],
      },
      reference: [{ kind: 'text', text: '21 00000 00003 13947 14300 09017' }],
      message: [
        { kind: 'text', text: 'Order from ' },
        { kind: 'field', field: header('orderedOn'), format: { kind: 'date', style: 'short' } },
      ],
      billingInformation: [{ kind: 'text', text: '//S1/10/1234/11/201021/30/102673386/32/7.7/40/0:30' }],
    },
    provenance: { kind: 'dataset', dataset: 'order-lines' },
  }
}

/** Runs of one literal text. */
const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]

/**
 * An e-invoice over `richReport`'s table, using every term the format has:
 * the seller's literal, its contact and its electronic address among them,
 * the buyer's read from the data where it can be, its electronic address
 * among them, the business process, four categories of three codes, a
 * delivery date and a period, and payment to the account the report's EPC
 * QR code pays.
 */
export function facturXInvoice(): FacturXInvoice {
  return {
    kind: 'facturX',
    profile: 'en16931',
    type: '380',
    currency: 'EUR',
    number: [{ kind: 'text', text: 'RE-' }, { kind: 'expression', expression: { cel: 'header.customer' } }],
    issued: { cel: 'header.orderedOn' },
    businessProcess: said('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'),
    seller: {
      name: said('Muster & Söhne GmbH'),
      vatId: said('DE 123 456 789'),
      taxNumber: said('201/113/40209'),
      legalId: { id: said('HRB 12345') },
      electronicAddress: { id: said('rechnung@muster-soehne.example'), scheme: 'EM' },
      contact: { name: said('Erika Mustermann'), telephone: said('+49 221 4710 123'), email: said('erika.mustermann@muster-soehne.example') },
      address: { line1: said('Industriestraße 7'), line2: said('Hof 2'), postalCode: said('50735'), city: said('Köln'), country: said('DE') },
    },
    buyer: {
      name: [{ kind: 'field', field: header('customer') }],
      vatId: [{ kind: 'parameter', parameter: 'region' }],
      legalId: { id: said('4012345000009'), scheme: '0088' },
      electronicAddress: { id: [{ kind: 'parameter', parameter: 'region' }], scheme: '0088' },
      address: { line1: [{ kind: 'parameter', parameter: 'region' }], postalCode: said('1010'), city: said('Wien'), country: said('AT') },
    },
    buyerReference: said('PO-4711'),
    delivered: { cel: 'params.from' },
    period: { start: { cel: 'params.from' }, end: { cel: 'header.orderedOn' } },
    vat: [
      { id: 'standard', code: 'S', rate: '19' },
      { id: 'reduced', code: 'S', rate: '7.00' },
      { id: 'exempt', code: 'E', rate: '0', reason: said('Steuerfrei nach § 4 Nr. 14 UStG') },
      { id: 'reverse', code: 'AE', rate: '0', reason: said('Steuerschuldnerschaft des Leistungsempfängers') },
    ],
    lines: {
      table: 'lines',
      name: 'sku',
      quantity: 'qty',
      netPrice: 'price',
      netAmount: 'amount',
      id: { kind: 'field', field: detail('sku') },
      unit: { kind: 'field', field: detail('unit') },
      vat: { kind: 'expression', expression: { cel: 'row.vat' } },
    },
    payment: {
      means: '58',
      iban: said('DE71 1102 2033 0123 4567 89'),
      bic: said('BHBLDEHHXXX'),
      accountName: said('Franz Mustermänn'),
      remittance: [{ kind: 'text', text: 'Rechnung ' }, { kind: 'expression', expression: { cel: 'header.customer' } }],
    },
    due: { cel: 'header.orderedOn' },
    terms: said('Zahlbar innerhalb von 14 Tagen ohne Abzug'),
    paid: { cel: 'params.threshold' },
  }
}

/**
 * `richReport` as an e-invoice: without its QR-bill, which is in francs and
 * paid to a QR-IBAN, and with each detail row's unit and VAT category, the
 * fields appended so that every pointer into the rest is `richReport`'s.
 */
export function eInvoiceReport(): ReportDefinition {
  const { paymentPart: _bill, ...report } = richReport()
  // richReport declares its detail dataset, which its table reads.
  const lines = report.datasets.detail as DatasetContract
  const fields = [...lines.fields, { id: 'unit', type: 'string', label: 'Unit', nullable: false } as const, { id: 'vat', type: 'string', label: 'VAT', nullable: false } as const]
  return { ...report, datasets: { ...report.datasets, detail: { ...lines, fields } }, eInvoice: facturXInvoice() }
}

/**
 * The fixture's e-invoice as an XRechnung 3.0 (0038): every term the
 * Factur-X fixture has, which already holds each that XRechnung needs past
 * EN 16931 -- the business process, the buyer's reference, the payment
 * instructions, the seller's contact and both electronic addresses -- with
 * its version in place of the profile.
 */
export function xrechnungInvoice(): XRechnungInvoice {
  const { profile: _profile, kind: _kind, ...terms } = facturXInvoice()
  const { businessProcess, buyerReference, payment, seller, buyer } = terms
  if (businessProcess === undefined || buyerReference === undefined || payment === undefined || seller.contact === undefined || seller.electronicAddress === undefined || buyer.electronicAddress === undefined) {
    throw new Error('the Factur-X fixture lacks a term an XRechnung needs')
  }
  return {
    kind: 'xrechnung',
    version: '3.0',
    ...terms,
    businessProcess,
    buyerReference,
    payment,
    seller: { ...seller, contact: seller.contact, electronicAddress: seller.electronicAddress },
    buyer: { ...buyer, electronicAddress: buyer.electronicAddress },
  }
}

/** `eInvoiceReport` with its e-invoice an XRechnung. */
export function xrechnungReport(): ReportDefinition {
  return { ...eInvoiceReport(), eInvoice: xrechnungInvoice() }
}

/** A deep copy of JSON data, as something the tests may edit freely. */
export function editable(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

/** The fixture, edited. */
export function edited(edit: (report: Record<string, unknown>) => void): Record<string, unknown> {
  const report = editable(richReport())
  edit(report)
  return report
}

/** The code and path of each error a document is refused with; none when it is valid. */
export function refusals(document: unknown): string[] {
  const outcome = validateReport(document)
  return outcome.valid ? [] : outcome.errors.map((error: ReportError) => `${error.code} ${error.path}`)
}

/** The segments of a JSON Pointer, unescaped (RFC 6901). */
function segments(pointer: string): string[] {
  if (pointer === '') return []
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
}

/** The value at a JSON Pointer. A pointer through a value that is not an object throws, as a mistake in a test should. */
export function getAt(document: unknown, pointer: string): unknown {
  return segments(pointer).reduce<unknown>((current, segment) => (current as Record<string, unknown>)[segment], document)
}

/** The container a pointer's last segment names a slot in, and that slot. */
function parentOf(document: unknown, pointer: string): [Record<string, unknown> | unknown[], string] {
  const parts = segments(pointer)
  const parent = getAt(document, parts.slice(0, -1).map((part) => `/${part.replaceAll('~', '~0').replaceAll('/', '~1')}`).join(''))
  return [parent as Record<string, unknown> | unknown[], parts.at(-1) as string]
}

/** Sets the value at a pointer, creating the slot. Writes as a data property, so `__proto__` is a key like any other. */
export function setAt(document: unknown, pointer: string, value: unknown): void {
  const [parent, key] = parentOf(document, pointer)
  Object.defineProperty(parent, key, { value, enumerable: true, writable: true, configurable: true })
}

/** Removes the value at a pointer: a property is deleted, an array element spliced out. */
export function removeAt(document: unknown, pointer: string): void {
  const [parent, key] = parentOf(document, pointer)
  if (Array.isArray(parent)) parent.splice(Number(key), 1)
  else delete parent[key]
}

/** Appends a value to the array at a pointer, and says where it went. */
export function append(document: unknown, pointer: string, value: unknown): string {
  const at = `${pointer}/${(getAt(document, pointer) as unknown[]).length}`
  setAt(document, at, value)
  return at
}

/** Every JSON Pointer in a JSON document, the root first, in document order. */
export function pointers(document: unknown, base = ''): string[] {
  const found = [base]
  if (typeof document === 'object' && document !== null) {
    for (const [key, value] of Object.entries(document)) {
      found.push(...pointers(value, `${base}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`))
    }
  }
  return found
}

/** Every object and array in a value, by identity. */
export function objectsIn(value: unknown, into = new Set<object>()): Set<object> {
  if (typeof value === 'object' && value !== null && !into.has(value)) {
    into.add(value)
    for (const child of Object.values(value)) objectsIn(child, into)
  }
  return into
}
