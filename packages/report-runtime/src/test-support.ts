/**
 * What the runtime's tests build reports and data from. Only test files
 * import this; the published entry never reaches it.
 *
 * `sampleReport` is one valid report whose detail dataset has a field of
 * every type and whose parameters have every type, with an expression that
 * can fail at render time -- a quantity divided by a parameter -- so a test
 * can show where a failure is reported. `sampleData` is data it accepts.
 */
import { validateReport } from '@formancy/report-spec'
import type { FieldRef, ReportDefinition } from '@formancy/report-spec'
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
