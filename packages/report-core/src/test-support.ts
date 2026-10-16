/**
 * What the tests build reports from. Only test files import this; the
 * published entry never reaches it.
 *
 * `sampleReport` is one valid report that holds every component kind, every
 * expression site, every declaration kind and every table feature, and uses
 * each thing it declares, so that diagnosing it finds nothing; that it holds
 * every kind, `reportParts`' test holds. A test breaks one thing in it and
 * shows that exactly that is reported, and a command test edits it and shows
 * what changed and what did not.
 */
import { validateReport } from '@formancy/report-spec'
import type { FieldRef, ReportDefinition } from '@formancy/report-spec'
import type { CommandOutcome, Refusal } from './outcome.js'

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const detail = (field: string): FieldRef => ({ dataset: 'detail', field })

const REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'orders',
  title: 'Orders by site',
  locale: 'de-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 } },
  styles: [
    { id: 'title', font: 'serif', size: 18, bold: true, color: '#1a1a2e' },
    { id: 'body', font: 'sans', size: 10.5 },
    { id: 'small', size: 8, italic: true, align: 'right' },
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
        { id: 'shippedAt', type: 'datetime', label: 'Shipped at', nullable: true },
        { id: 'recordedAt', type: 'instant', label: 'Recorded', nullable: false },
        { id: 'shipped', type: 'boolean', label: 'Shipped', nullable: true },
      ],
    },
  },
  parameters: [
    { id: 'from', type: 'date', label: 'From', required: true },
    { id: 'draft', type: 'boolean', label: 'Draft', required: false, default: false },
    { id: 'threshold', type: 'decimal', label: 'Threshold', required: false },
    { id: 'currency', type: 'string', label: 'Currency', required: false, default: 'CHF' },
    { id: 'copies', type: 'integer', label: 'Copies', required: false, default: '1' },
  ],
  assets: [
    { id: 'logo', mediaType: 'image/png', digest: `sha256:${'ab'.repeat(32)}` },
    { id: 'seal', mediaType: 'image/jpeg', digest: `sha256:${'0f'.repeat(32)}` },
  ],
  aggregates: [
    { id: 'subtotal', fn: 'sum', of: { kind: 'field', field: detail('amount') }, rounding: { scale: 2, mode: 'half-even' } },
    { id: 'lines', fn: 'count' },
    { id: 'gross', fn: 'sum', of: { kind: 'expression', expression: { cel: 'row.amount * dec("1.081")' } } },
    { id: 'average', fn: 'avg', of: { kind: 'field', field: detail('quantity') }, rounding: { scale: 1, mode: 'half-even' } },
    { id: 'latest', fn: 'max', of: { kind: 'field', field: detail('recordedAt') } },
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
    pageHeader: [{ id: 'running-title', kind: 'text', style: 'small', content: [{ kind: 'parameter', parameter: 'from', format: { kind: 'date', style: 'medium' } }] }],
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
          { kind: 'expression', expression: { cel: 'header.customer + " x" + string(params.copies)' } },
        ],
      },
      { id: 'gap', kind: 'spacer', height: 12 },
      {
        id: 'lines',
        kind: 'table',
        dataset: 'detail',
        headerStyle: 'strong',
        columns: [
          { id: 'sku', header: 'SKU', width: 80, align: 'left', value: { kind: 'field', field: detail('sku') } },
          { id: 'qty', header: 'Qty', width: 50, align: 'right', value: { kind: 'field', field: detail('quantity'), format: { kind: 'number', scale: 0, grouping: true } } },
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
            value: { kind: 'expression', expression: { cel: 'round(dec(row.quantity) * row.unit_price, 2)' } },
            styleWhen: [{ when: { cel: 'row.amount < dec("0")' }, style: 'negative' }],
          },
          {
            id: 'shipped-at',
            header: 'Shipped',
            width: 70,
            align: 'center',
            value: { kind: 'field', field: detail('shippedAt'), format: { kind: 'date', style: 'short' } },
            visibleWhen: { cel: 'params.draft == false' },
            style: 'small',
            styleWhen: [{ when: { cel: 'row.shipped == true' }, style: 'strong' }],
          },
        ],
        sort: [{ field: detail('sku'), direction: 'desc' }],
        group: {
          by: detail('site'),
          direction: 'asc',
          header: [
            { kind: 'text', text: 'Site ' },
            { kind: 'field', field: detail('site') },
            { kind: 'expression', expression: { cel: '" (" + string(group.lines) + ")"' } },
          ],
          headerStyle: 'strong',
          footer: [
            {
              cells: [
                { column: 'sku', value: { kind: 'text', text: 'Subtotal' } },
                { column: 'qty', value: { kind: 'expression', expression: { cel: 'group.lines' } } },
                { column: 'amount', value: { kind: 'aggregate', aggregate: 'subtotal', over: 'group', format: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } } },
              ],
            },
          ],
        },
        totals: [
          {
            cells: [
              { column: 'sku', value: { kind: 'text', text: 'Total' } },
              { column: 'qty', value: { kind: 'aggregate', aggregate: 'lines', over: 'report' } },
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
          { id: 'note', kind: 'text', content: [{ kind: 'text', text: 'Thank you.' }] },
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
        padding: 6,
        components: [
          {
            id: 'threshold',
            kind: 'text',
            content: [{ kind: 'parameter', parameter: 'threshold', format: { kind: 'currency', currency: { kind: 'parameter', parameter: 'currency' }, scale: 2 } }],
          },
          {
            id: 'statistics',
            kind: 'text',
            content: [
              { kind: 'aggregate', aggregate: 'average', over: 'report', format: { kind: 'number', scale: 1, grouping: false } },
              { kind: 'text', text: ' per line, last recorded ' },
              { kind: 'aggregate', aggregate: 'latest', over: 'report' },
              { kind: 'expression', expression: { cel: 'params.from' } },
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
          { kind: 'expression', expression: { cel: '" from " + params.from' } },
        ],
        size: 85.04,
        errorCorrection: 'Q',
      },
    ],
  },
  provenance: { kind: 'dataset', dataset: 'order-lines' },
}

/** A fresh, mutable copy of the sample report, checked valid. */
export function sampleReport(): ReportDefinition {
  const copy = JSON.parse(JSON.stringify(REPORT)) as ReportDefinition
  const outcome = validateReport(copy)
  if (!outcome.valid) throw new Error(`the sample report is not valid: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return copy
}

/** `value`, every object and array in it frozen: a command that writes to its input throws on it. */
export function frozen<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) frozen(child)
    Object.freeze(value)
  }
  return value
}

/** The sample report, deeply frozen. */
export function frozenSample(): ReportDefinition {
  return frozen(sampleReport())
}

/** The report an accepted outcome carries; fails the test with the refusal otherwise. */
export function accepted(outcome: CommandOutcome): ReportDefinition {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.path ?? ''} ${outcome.message}`)
  return outcome.report
}

/** The refusal an outcome carries; fails the test when it was accepted. */
export function refused(outcome: CommandOutcome): Refusal {
  if (outcome.ok) throw new Error('accepted, and a refusal was expected')
  return outcome
}

/** Every component id in a report, in document order: a component is the one shape with both an `id` and a `kind`. */
export function idsIn(value: unknown, into: string[] = []): string[] {
  if (typeof value !== 'object' || value === null) return into
  const record = value as Record<string, unknown>
  if (typeof record.id === 'string' && typeof record.kind === 'string') into.push(record.id)
  for (const child of Object.values(record)) idsIn(child, into)
  return into
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

/** The segments of a JSON Pointer, unescaped (RFC 6901). */
function segments(pointer: string): string[] {
  return pointer === ''
    ? []
    : pointer
        .slice(1)
        .split('/')
        .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
}

/** Sets the value at a JSON Pointer in a document a test owns. A pointer through a value that is not an object throws, as a mistake in a test should. */
export function setAt(document: unknown, pointer: string, value: unknown): void {
  const parts = segments(pointer)
  const parent = parts.slice(0, -1).reduce<unknown>((current, segment) => (current as Record<string, unknown>)[segment], document) as Record<string, unknown>
  parent[parts.at(-1) as string] = value
}
