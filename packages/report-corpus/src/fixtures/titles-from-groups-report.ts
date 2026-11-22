import type { ReportData, ReportDefinition } from '@formancy/report-runtime'

/**
 * The report `titles-from-groups` is the document of, as a person writes
 * it (0078): one table over sections of different kinds, every column
 * titled with nothing, and a group header that names the section and the
 * columns under it, which the runtime writes as one line across the table.
 * Resolved, its table has no header row; drawn and written, it prints no
 * band of nothing over its rows on any page. The data is made up: sections
 * of numbered items and amounts, long enough to run onto a third page.
 */

const detail = (field: string) => ({ dataset: 'detail', field }) as const
const CHF = { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } as const

/** The sections, each with as many items. */
const SECTIONS: readonly (readonly [string, number])[] = [
  ['Parts', 34],
  ['Labour', 27],
  ['Travel', 9],
  ['Materials', 41],
]

export const TITLES_FROM_GROUPS_REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'titles-from-groups',
  title: 'Titles from groups',
  locale: 'en-GB',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 } },
  styles: [
    { id: 'title', size: 16, bold: true },
    { id: 'footer', size: 8, align: 'center' },
  ],
  datasets: {
    detail: {
      id: 'items',
      fields: [
        { id: 'section', type: 'string', label: 'Section', nullable: false },
        { id: 'number', type: 'integer', label: 'Number', nullable: false },
        { id: 'item', type: 'string', label: 'Item', nullable: false },
        { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
      ],
    },
  },
  parameters: [],
  assets: [],
  aggregates: [{ id: 'amount', fn: 'sum', of: { kind: 'field', field: detail('amount') } }],
  regions: {
    pageHeader: [],
    reportHeader: [{ id: 'title', kind: 'text', style: 'title', content: [{ kind: 'text', text: 'Titles from groups' }] }],
    body: [
      {
        id: 'items',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'number', header: '', width: 110, align: 'left', value: { kind: 'field', field: detail('number') } },
          { id: 'item', header: '', width: 'fill', align: 'left', value: { kind: 'field', field: detail('item') } },
          { id: 'amount', header: ' ', width: 90, align: 'right', value: { kind: 'field', field: detail('amount'), format: CHF } },
        ],
        sort: [{ field: detail('number'), direction: 'asc' }],
        group: {
          by: detail('section'),
          direction: 'asc',
          header: [{ kind: 'expression', expression: { cel: 'group.key + ": number, item and amount"' } }],
          footer: [
            {
              cells: [
                { column: 'number', value: { kind: 'expression', expression: { cel: '"Subtotal " + group.key' } } },
                { column: 'amount', value: { kind: 'aggregate', aggregate: 'amount', over: 'group', format: CHF } },
              ],
            },
          ],
        },
        totals: [
          {
            cells: [
              { column: 'number', value: { kind: 'text', text: 'Total' } },
              { column: 'amount', value: { kind: 'aggregate', aggregate: 'amount', over: 'report', format: CHF } },
            ],
          },
        ],
        emptyText: 'No items.',
        repeatHeader: true,
      },
    ],
    summary: [],
    pageFooter: [
      {
        id: 'page-of',
        kind: 'text',
        style: 'footer',
        content: [{ kind: 'text', text: 'Page ' }, { kind: 'pageNumber' }, { kind: 'text', text: ' of ' }, { kind: 'pageCount' }],
      },
    ],
  },
  provenance: { kind: 'blank' },
}

/** The items of every section, numbered across them, each amount from its number: no one's data. A row is found by its number, from 1001, which no other word of the report prints: not a page's number nor their count. */
function items(): Record<string, unknown>[] {
  let number = 0
  return SECTIONS.flatMap(([section, count]) =>
    Array.from({ length: count }, () => {
      number++
      const cents = ((number * 7919) % 99999) + 1
      return { section, number: String(1000 + number), item: `${section} work`, amount: `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}` }
    }),
  )
}

const ROWS = items()

export const TITLES_FROM_GROUPS_DATA: ReportData = {
  detail: ROWS,
  completeness: { complete: true, captured: ROWS.length },
  consistency: 'host-captured',
}
