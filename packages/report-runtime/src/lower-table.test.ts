import { emptyReport } from '@formancy/report-spec'
import type { FieldRef, ReportDefinition, TableComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { Table, TableRow } from './document.js'
import { resolveReport } from './resolve.js'

const detail = (field: string): FieldRef => ({ dataset: 'detail', field })
const CHF = (amount: string): string =>
  new Intl.NumberFormat('en', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    amount as Intl.StringNumericLiteral,
  )

const TABLE: TableComponent = {
  id: 'equipment',
  kind: 'table',
  dataset: 'detail',
  style: 'small',
  headerStyle: 'strong',
  columns: [
    { id: 'tag', header: 'Tag', width: 80, align: 'left', value: { kind: 'field', field: detail('tag') } },
    {
      id: 'value',
      header: 'Value',
      width: 'fill',
      align: 'right',
      value: { kind: 'field', field: detail('value'), format: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } },
      styleWhen: [{ when: { cel: 'row.critical' }, style: 'red' }],
    },
    { id: 'count', header: 'Count', width: 60, align: 'right', value: { kind: 'field', field: detail('count') } },
    { id: 'note', header: 'Note', width: 60, align: 'left', value: { kind: 'text', text: '-' }, visibleWhen: { cel: 'params.notes' }, style: 'strong' },
  ],
  sort: [{ field: detail('tag'), direction: 'asc' }],
  group: {
    by: detail('site'),
    direction: 'asc',
    header: [{ kind: 'expression', expression: { cel: '"Site " + group.key + ": " + string(group.items)' } }],
    headerStyle: 'strong',
    footer: [
      {
        cells: [
          { column: 'tag', value: { kind: 'expression', expression: { cel: '"Subtotal " + group.key' } } },
          {
            column: 'value',
            value: { kind: 'aggregate', aggregate: 'total', over: 'group', format: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } },
          },
          { column: 'note', value: { kind: 'text', text: 'n' } },
        ],
        style: 'red',
      },
    ],
  },
  totals: [
    {
      cells: [
        { column: 'tag', value: { kind: 'text', text: 'Total' } },
        {
          column: 'value',
          value: { kind: 'aggregate', aggregate: 'total', over: 'report', format: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } },
        },
        { column: 'count', value: { kind: 'aggregate', aggregate: 'items', over: 'report' } },
      ],
    },
  ],
  emptyText: 'No equipment.',
  repeatHeader: true,
}

function report(table: TableComponent = TABLE): ReportDefinition {
  return {
    ...emptyReport('equipment', 'Equipment', 'en'),
    styles: [
      { id: 'small', size: 8 },
      { id: 'strong', bold: true },
      { id: 'red', color: '#b00020' },
    ],
    datasets: {
      detail: {
        id: 'equipment',
        fields: [
          { id: 'site', type: 'string', label: 'Site', nullable: false },
          { id: 'tag', type: 'string', label: 'Tag', nullable: false },
          { id: 'value', type: 'decimal', label: 'Value', nullable: false, scale: 2 },
          { id: 'count', type: 'integer', label: 'Count', nullable: false },
          { id: 'critical', type: 'boolean', label: 'Critical', nullable: false },
        ],
      },
    },
    parameters: [{ id: 'notes', type: 'boolean', label: 'Notes', required: false, default: true }],
    aggregates: [
      { id: 'items', fn: 'count' },
      { id: 'total', fn: 'sum', of: { kind: 'field', field: detail('value') } },
    ],
    regions: { reportHeader: [], pageHeader: [], body: [table], pageFooter: [], summary: [] },
  }
}

const row = (site: string, tag: string, value: string, critical = false): Record<string, unknown> => ({ site, tag, value, count: '1', critical })

/** The provider's order, which the table must not keep: Thun before Bern, B before A, and two rows with equal keys. */
const ROWS = [row('Thun', 'B-2', '10.00'), row('Bern', 'A-2', '0.05'), row('Thun', 'A-1', '5.50', true), row('Bern', 'A-1', '1.10'), row('Bern', 'A-1', '2.20')]

function table(
  rows: readonly Record<string, unknown>[] = ROWS,
  parameters: Record<string, unknown> = {},
  definition: ReportDefinition = report(),
): Table | undefined {
  const outcome = resolveReport(
    definition,
    { detail: rows, completeness: { complete: true, captured: rows.length }, consistency: 'host-captured' },
    { mode: 'final', parameters, creationDate: '2026-10-15T08:00:00Z' },
  )
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document.body.find((block): block is Table => block.kind === 'table')
}

const cells = (rows: readonly TableRow[] | undefined): string[][] => (rows ?? []).map((each) => [each.kind, ...each.cells])

describe('a grouped table', () => {
  // The quotation's and the equipment list's core: rows in the order the
  // definition decides, never the provider's; each group headed across the
  // table by its key, read as a value; its subtotal over its own rows; the
  // total over all of them -- exact, and adding up.
  test('orders rows by the group key and then the sort keys, heads and totals each group, and totals the table', () => {
    expect(cells(table()?.rows)).toEqual([
      ['groupHeader', 'Site Bern: 3'],
      ['detail', 'A-1', CHF('1.10'), '1', '-'],
      ['detail', 'A-1', CHF('2.20'), '1', '-'],
      ['detail', 'A-2', CHF('0.05'), '1', '-'],
      ['groupFooter', 'Subtotal Bern', CHF('3.35'), '', 'n'],
      ['groupHeader', 'Site Thun: 2'],
      ['detail', 'A-1', CHF('5.50'), '1', '-'],
      ['detail', 'B-2', CHF('10.00'), '1', '-'],
      ['groupFooter', 'Subtotal Thun', CHF('15.50'), '', 'n'],
      ['total', 'Total', CHF('18.85'), '5', ''],
    ])
  })

  // Two rows whose keys are all equal keep the provider's order: 1.10 came
  // before 2.20, and still does when the provider sends them the other way.
  test('keeps rows with equal keys in the order the provider gave them', () => {
    const swapped = [ROWS[0], ROWS[1], ROWS[2], ROWS[4], ROWS[3]] as Record<string, unknown>[]
    expect(cells(table(swapped)?.rows).slice(1, 3)).toEqual([
      ['detail', 'A-1', CHF('2.20'), '1', '-'],
      ['detail', 'A-1', CHF('1.10'), '1', '-'],
    ])
  })

  // A group header is one line across the table, which a renderer keeps
  // with the row it heads.
  test('prints a group header as one cell across the table', () => {
    const [first] = table()?.rows ?? []
    expect(first).toMatchObject({ kind: 'groupHeader', across: true })
  })

  // Rows with no value to group by are a group of their own, after every
  // other, keyed by null, which prints as nothing.
  test('groups the rows without a key together, last', () => {
    const nullable = report({
      ...TABLE,
      group: { ...(TABLE.group as NonNullable<TableComponent['group']>), header: [{ kind: 'field', field: detail('site') }], footer: [] },
    })
    const site = nullable.datasets.detail?.fields[0]
    const definition: ReportDefinition = {
      ...nullable,
      datasets: {
        detail: { id: 'equipment', fields: [{ ...(site as NonNullable<typeof site>), nullable: true }, ...(nullable.datasets.detail?.fields.slice(1) ?? [])] },
      },
    }
    const rows = [row('Thun', 'B-2', '1.00'), { ...row('', 'A-1', '2.00'), site: null }, row('Bern', 'C-3', '3.00')]
    expect(cells(table(rows, {}, definition)?.rows.filter((each) => each.kind === 'groupHeader'))).toEqual([
      ['groupHeader', 'Bern'],
      ['groupHeader', 'Thun'],
      ['groupHeader', ''],
    ])
  })
})

describe('columns', () => {
  // A column the author hides prints nothing at all: not its header, not
  // its cells, not its footer cells; the fill column takes its width.
  test('leaves out a column whose condition does not hold, with its cells and footer cells', () => {
    const lowered = table(ROWS, { notes: false })
    expect(lowered?.header).toEqual(['Tag', 'Value', 'Count'])
    expect(lowered?.columns).toEqual([
      { width: 80, align: 'left' },
      { width: 'fill', align: 'right' },
      { width: 60, align: 'right' },
    ])
    expect(cells(lowered?.rows).slice(3, 5)).toEqual([
      ['detail', 'A-2', CHF('0.05'), '1'],
      ['groupFooter', 'Subtotal Bern', CHF('3.35'), ''],
    ])
  })

  // A table every column of which is hidden has nothing to print.
  test('prints no table when every column is hidden', () => {
    const hidden = { ...TABLE, columns: TABLE.columns.map((column) => ({ ...column, visibleWhen: { cel: 'params.notes' } })) }
    expect(table(ROWS, { notes: false }, report(hidden))).toBeUndefined()
  })
})

describe('an empty table', () => {
  // No rows: the empty text stands in their place, no group is headed, and
  // the totals still print -- a count and a sum of nothing are 0 (0007).
  test('prints its empty text and its totals of nothing', () => {
    const lowered = table([])
    expect(lowered?.emptyText).toBe('No equipment.')
    expect(cells(lowered?.rows)).toEqual([['total', 'Total', CHF('0.00'), '0', '']])
  })
})

describe('styles in a table', () => {
  // The table's style is under every row's; a column's style and the rules
  // that hold for a row are a detail cell's own, and a cell with neither
  // has the row's. An engine merging styles itself could print a critical
  // value in black.
  test('lays the table style under each row and a column style and rules under each detail cell', () => {
    const lowered = table()
    expect(lowered?.headerStyle).toEqual({ size: 8, bold: true })
    const [header, firstDetail] = lowered?.rows ?? []
    expect(header?.style).toEqual({ size: 8, bold: true })
    expect(firstDetail?.style).toEqual({ size: 8 })
    expect(firstDetail?.cellStyles).toEqual([null, null, null, { size: 8, bold: true }])
    const critical = lowered?.rows.find((each) => each.kind === 'detail' && each.cells[1] === CHF('5.50'))
    expect(critical?.cellStyles).toEqual([null, { size: 8, color: '#b00020' }, null, { size: 8, bold: true }])
    expect(lowered?.rows.find((each) => each.kind === 'groupFooter')?.style).toEqual({ size: 8, color: '#b00020' })
    expect(lowered?.rows.at(-1)?.style).toEqual({ size: 8 })
  })

  // A detail row whose cells have no style of their own carries none.
  test('gives a detail row no cell styles when no cell has its own', () => {
    const { group: _group, totals: _totals, ...ungrouped } = TABLE
    const plain = report({ ...ungrouped, columns: TABLE.columns.slice(0, 1) })
    expect(table(ROWS, {}, plain)?.rows.find((each) => each.kind === 'detail')).toEqual({ kind: 'detail', cells: ['A-1'], style: { size: 8 } })
  })
})

describe('a preview that lacks the field grouped by', () => {
  // Its rows are one group keyed by nothing. An expression reading the key
  // prints nothing and is said once, as for any field a preview lacks,
  // rather than refusing the preview: the key is missing, which is not
  // null, and the field grouped by is never null.
  test('prints nothing for the key, and says so', () => {
    const rows = ROWS.map(({ site: _site, ...rest }) => rest)
    const outcome = resolveReport(
      report(),
      { detail: rows, completeness: { complete: true, captured: rows.length }, consistency: 'host-captured' },
      { mode: 'preview', creationDate: '2026-10-15T08:00:00Z' },
    )
    if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
    const lowered = outcome.document.body.find((block): block is Table => block.kind === 'table')
    expect(cells(lowered?.rows.filter((each) => each.kind !== 'detail'))).toEqual([
      ['groupHeader', ''],
      ['groupFooter', '', CHF('18.85'), '', 'n'],
      ['total', 'Total', CHF('18.85'), '5', ''],
    ])
    expect(outcome.warnings.map((warning) => `${warning.stage} ${warning.code} ${warning.path}`)).toEqual([
      'data missing-field /detail/0/site',
      'evaluation missing-value /regions/body/0/group/header/0/expression/cel',
      'evaluation missing-value /regions/body/0/group/footer/0/cells/0/value/expression/cel',
    ])
  })
})
