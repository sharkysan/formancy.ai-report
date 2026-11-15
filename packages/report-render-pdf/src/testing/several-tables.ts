import type { ReportData, ReportDefinition } from '@formancy/report-runtime'

/**
 * An order printed as three tables over its one list of lines (0062), for
 * the renderer's proof that each table prints the rows its condition
 * selects and totals them as its own. Invented, and no starter: the
 * Studio never offers it.
 *
 * - **Goods**, the lines of kind `goods`, grouped by category and sorted by
 *   item, each group closed by its subtotal, and the table by its own
 *   total and count.
 * - **Services**, the lines of kind `service`, ungrouped and largest first,
 *   closed by its own total and by how many of every line it holds,
 *   `table` beside `totals`.
 * - **Returns**, the lines of kind `return`, of which the order has none:
 *   its empty text, and its totals of nothing.
 *
 * The summary prints the order's total, over every line whatever the
 * tables select. The lines come in no order any table prints them in.
 */

const detail = (field: string) => ({ dataset: 'detail', field }) as const
const CHF = { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } as const
const text = (words: string) => ({ kind: 'text', text: words }) as const
const expression = (cel: string) => ({ kind: 'expression', expression: { cel } }) as const
const net = (over: 'report' | 'table' | 'group') => ({ kind: 'aggregate', aggregate: 'net', over, format: CHF }) as const
const lines = (over: 'report' | 'table') => ({ kind: 'aggregate', aggregate: 'lines', over }) as const

/** The three columns every table prints: what the line is, how many, and its amount; the first two headed as the table names them. */
function columns(item: string, quantity: string) {
  return [
    { id: 'item', header: item, width: 'fill', align: 'left', value: { kind: 'field', field: detail('item') } },
    { id: 'quantity', header: quantity, width: 60, align: 'right', value: { kind: 'field', field: detail('quantity') } },
    { id: 'amount', header: 'Amount', width: 90, align: 'right', value: { kind: 'field', field: detail('amount'), format: CHF } },
  ] as const
}

export const SEVERAL_TABLES: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'order-lines',
  title: 'Order lines',
  locale: 'en',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [
    { id: 'title', size: 16, bold: true },
    { id: 'heading', size: 11, bold: true },
    { id: 'strong', bold: true },
  ],
  datasets: {
    detail: {
      id: 'order-lines',
      fields: [
        { id: 'item', type: 'string', label: 'Item', nullable: false },
        { id: 'kind', type: 'string', label: 'Kind', nullable: false },
        { id: 'category', type: 'string', label: 'Category', nullable: false },
        { id: 'quantity', type: 'integer', label: 'Quantity', nullable: false },
        { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
      ],
    },
  },
  parameters: [],
  assets: [],
  aggregates: [
    { id: 'net', fn: 'sum', of: { kind: 'field', field: detail('amount') } },
    { id: 'lines', fn: 'count' },
  ],
  regions: {
    reportHeader: [{ id: 'title', kind: 'text', style: 'title', content: [text('Order 4711')] }],
    pageHeader: [],
    body: [
      { id: 'goods-heading', kind: 'text', style: 'heading', content: [text('Goods delivered')], keepWithNext: true },
      {
        id: 'goods',
        kind: 'table',
        dataset: 'detail',
        rowsWhen: { cel: 'row.kind == "goods"' },
        columns: columns('Item', 'Qty'),
        sort: [{ field: detail('item'), direction: 'asc' }],
        group: {
          by: detail('category'),
          direction: 'asc',
          header: [expression('"Category " + group.key')],
          headerStyle: 'strong',
          footer: [
            {
              cells: [
                { column: 'item', value: expression('"Subtotal " + group.key') },
                { column: 'amount', value: net('group') },
              ],
            },
          ],
        },
        totals: [
          {
            cells: [
              { column: 'item', value: text('Goods total') },
              { column: 'amount', value: net('table') },
            ],
            style: 'strong',
          },
          {
            cells: [
              { column: 'item', value: text('Goods lines') },
              { column: 'quantity', value: lines('table') },
            ],
          },
        ],
        emptyText: 'No goods on this order.',
        repeatHeader: true,
      },
      { id: 'services-heading', kind: 'text', style: 'heading', content: [text('Services rendered')], keepWithNext: true },
      {
        id: 'services',
        kind: 'table',
        dataset: 'detail',
        rowsWhen: { cel: 'row.kind == "service"' },
        columns: columns('Service', 'Hours'),
        sort: [{ field: detail('amount'), direction: 'desc' }],
        totals: [
          {
            cells: [
              { column: 'item', value: text('Services total') },
              { column: 'amount', value: net('table') },
            ],
            style: 'strong',
          },
          {
            cells: [
              { column: 'item', value: text('Service lines') },
              { column: 'quantity', value: expression('string(table.lines) + " of " + string(totals.lines)') },
            ],
          },
        ],
        emptyText: 'No services on this order.',
        repeatHeader: true,
      },
      { id: 'returns-heading', kind: 'text', style: 'heading', content: [text('Returns')], keepWithNext: true },
      {
        id: 'returns',
        kind: 'table',
        dataset: 'detail',
        rowsWhen: { cel: 'row.kind == "return"' },
        columns: columns('Returned item', 'Qty'),
        totals: [
          {
            cells: [
              { column: 'item', value: text('Returns total') },
              { column: 'amount', value: net('table') },
            ],
            style: 'strong',
          },
          {
            cells: [
              { column: 'item', value: text('Return lines') },
              { column: 'quantity', value: lines('table') },
            ],
          },
        ],
        emptyText: 'No returns on this order.',
        repeatHeader: true,
      },
    ],
    pageFooter: [],
    summary: [
      { id: 'order-total', kind: 'text', style: 'strong', content: [text('Order total '), net('report'), text(' for '), lines('report'), text(' lines')] },
    ],
  },
}

/** One line of the order, as the provider gives it. */
export interface OrderLine {
  readonly item: string
  readonly kind: 'goods' | 'service' | 'return'
  readonly category: string
  readonly quantity: string
  readonly amount: string
}

/** The order's lines, goods and services mixed, in no order any table prints them in, and no return. */
export const ORDER_LINES: readonly OrderLine[] = [
  { item: 'Bracket B-20', kind: 'goods', category: 'Hardware', quantity: '4', amount: '18.40' },
  { item: 'Setup visit', kind: 'service', category: 'Installation', quantity: '3', amount: '270.00' },
  { item: 'Cable C-05', kind: 'goods', category: 'Cables', quantity: '10', amount: '25.00' },
  { item: 'Bolt A-10', kind: 'goods', category: 'Hardware', quantity: '50', amount: '12.50' },
  { item: 'Operator course', kind: 'service', category: 'Training', quantity: '4', amount: '520.00' },
  { item: 'Cable C-12', kind: 'goods', category: 'Cables', quantity: '2', amount: '9.80' },
  { item: 'Remote check', kind: 'service', category: 'Support', quantity: '1', amount: '95.00' },
  { item: 'Hinge H-03', kind: 'goods', category: 'Hardware', quantity: '6', amount: '31.20' },
  { item: 'Travel', kind: 'service', category: 'Installation', quantity: '1', amount: '60.00' },
]

/** `rows` as the data a render is handed, captured whole by the host. */
export function orderData(rows: readonly OrderLine[] = ORDER_LINES): ReportData {
  return { detail: rows.map((row) => ({ ...row })), completeness: { complete: true, captured: rows.length }, consistency: 'host-captured' }
}
