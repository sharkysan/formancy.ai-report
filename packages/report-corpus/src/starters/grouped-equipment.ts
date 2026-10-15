import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import type { Starter } from './starter.js'

/**
 * The grouped equipment register (plan 7): operational records grouped by
 * site. It proves a stable order, one grouping level whose header reads the
 * group's own key (`group.key`), a count and a sum per group, a grand
 * total, and an empty state.
 */

const header = (field: string) => ({ dataset: 'header', field }) as const
const detail = (field: string) => ({ dataset: 'detail', field }) as const
const CHF = { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } as const

const REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'grouped-equipment',
  title: 'Equipment register',
  locale: 'en-GB',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 } },
  styles: [
    { id: 'title', size: 16, bold: true },
    { id: 'small', size: 8, color: '#555555' },
    { id: 'footer', size: 8, align: 'center' },
    { id: 'group', bold: true, color: '#1a1a2e' },
  ],
  datasets: {
    header: { id: 'register', fields: [{ id: 'company', type: 'string', label: 'Company', nullable: false }] },
    detail: {
      id: 'equipment',
      fields: [
        { id: 'site', type: 'string', label: 'Site', nullable: false },
        { id: 'tag', type: 'string', label: 'Tag', nullable: false },
        { id: 'description', type: 'string', label: 'Description', nullable: false },
        { id: 'category', type: 'string', label: 'Category', nullable: false },
        { id: 'commissionedOn', type: 'date', label: 'Commissioned', nullable: false },
        { id: 'value', type: 'decimal', label: 'Book value', nullable: false, scale: 2 },
      ],
    },
  },
  parameters: [{ id: 'asOf', type: 'date', label: 'As of', required: true }],
  assets: [],
  aggregates: [
    { id: 'items', fn: 'count' },
    { id: 'value', fn: 'sum', of: { kind: 'field', field: detail('value') } },
  ],
  regions: {
    pageHeader: [{ id: 'running-head', kind: 'text', style: 'small', content: [{ kind: 'text', text: 'Equipment register · ' }, { kind: 'field', field: header('company') }] }],
    reportHeader: [
      { id: 'title', kind: 'text', style: 'title', content: [{ kind: 'text', text: 'Equipment register' }] },
      {
        id: 'as-of',
        kind: 'text',
        content: [{ kind: 'field', field: header('company') }, { kind: 'text', text: ', as of ' }, { kind: 'parameter', parameter: 'asOf', format: { kind: 'date', style: 'long' } }],
      },
      { id: 'head-gap', kind: 'spacer', height: 12 },
    ],
    body: [
      {
        id: 'equipment',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'tag', header: 'Tag', width: 95, align: 'left', value: { kind: 'field', field: detail('tag') } },
          { id: 'description', header: 'Description', width: 'fill', align: 'left', value: { kind: 'field', field: detail('description') } },
          { id: 'category', header: 'Category', width: 70, align: 'left', value: { kind: 'field', field: detail('category') } },
          { id: 'commissioned', header: 'Commissioned', width: 80, align: 'left', value: { kind: 'field', field: detail('commissionedOn'), format: { kind: 'date', style: 'medium' } } },
          { id: 'value', header: 'Book value', width: 105, align: 'right', value: { kind: 'field', field: detail('value'), format: CHF } },
        ],
        sort: [{ field: detail('tag'), direction: 'asc' }],
        group: {
          by: detail('site'),
          direction: 'asc',
          header: [{ kind: 'expression', expression: { cel: 'group.key + " (" + string(group.items) + (group.items == 1 ? " item)" : " items)")' } }],
          headerStyle: 'group',
          footer: [
            {
              cells: [
                { column: 'tag', value: { kind: 'expression', expression: { cel: '"Subtotal " + group.key' } } },
                { column: 'category', value: { kind: 'aggregate', aggregate: 'items', over: 'group' } },
                { column: 'value', value: { kind: 'aggregate', aggregate: 'value', over: 'group', format: CHF } },
              ],
            },
          ],
        },
        totals: [
          {
            cells: [
              { column: 'tag', value: { kind: 'text', text: 'Grand total' } },
              { column: 'category', value: { kind: 'aggregate', aggregate: 'items', over: 'report' } },
              { column: 'value', value: { kind: 'aggregate', aggregate: 'value', over: 'report', format: CHF } },
            ],
          },
        ],
        emptyText: 'No equipment recorded.',
        repeatHeader: true,
      },
    ],
    summary: [],
    pageFooter: [
      { id: 'page-of', kind: 'text', style: 'footer', content: [{ kind: 'text', text: 'Page ' }, { kind: 'pageNumber' }, { kind: 'text', text: ' of ' }, { kind: 'pageCount' }] },
    ],
  },
  provenance: { kind: 'blank' },
}

/** Each site's share of every ten items, by the last digit of seven times the item's number: Zürich one, Bern two, Basel three, Thun four. */
const SITES = ['Zürich', 'Bern', 'Bern', 'Basel', 'Basel', 'Basel', 'Thun', 'Thun', 'Thun', 'Thun'] as const
const KINDS: readonly (readonly [string, string])[] = [
  ['Air handling unit', 'HVAC'],
  ['Heat pump', 'HVAC'],
  ['Fire alarm panel', 'Safety'],
  ['Emergency lighting', 'Safety'],
  ['Passenger lift', 'Transport'],
  ['Backup generator', 'Power'],
  ['Uninterruptible power supply', 'Power'],
]

/**
 * `count` items over four sites, unevenly -- Zürich, Bern, Basel and Thun
 * one, two, three and four of every ten, so that 40 items are 4, 8, 12 and
 * 16 and no two groups count alike -- given in the order a provider might
 * keep them, by when they were recorded, sites mixed, so that only the
 * report's order puts them in groups. Tags `EQ-0001` up, each found once;
 * values to the centime, from 0.05 to under 120,000.
 */
export function equipmentRows(count: number): Record<string, string>[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1
    const [description, category] = KINDS[(n * 3) % KINDS.length] as readonly [string, string]
    const centimes = BigInt((n * 7919 * 13) % 12_000_000) + 5n
    return {
      site: SITES[(n * 7) % SITES.length] as string,
      tag: `EQ-${String(count + 1 - n).padStart(4, '0')}`,
      description,
      category,
      commissionedOn: `20${String(10 + (n % 15)).padStart(2, '0')}-${String(1 + (n % 12)).padStart(2, '0')}-${String(1 + (n % 28)).padStart(2, '0')}`,
      value: `${centimes / 100n}.${String(centimes % 100n).padStart(2, '0')}`,
    }
  })
}

/** The register's data with `count` items; none for the empty state. */
export function equipmentData(count = 40): ReportData {
  const detail = equipmentRows(count)
  return {
    header: { company: 'Formancy Facility Services AG' },
    detail,
    completeness: { complete: true, captured: detail.length },
    consistency: 'transaction-snapshot',
  }
}

export const GROUPED_EQUIPMENT: Starter = {
  id: 'grouped-equipment',
  title: 'Equipment register',
  proves: 'a stable order, one grouping level headed by its key, a count and sum per group, a grand total and an empty state',
  report: REPORT,
  data: equipmentData(),
  parameters: { asOf: '2026-10-15' },
}
