import { emptyReport } from '@formancy/report-spec'
import type { FieldRef, ReportDefinition, TableComponent, TableFooterRow } from '@formancy/report-spec'
import { describe, expect, test, vi } from 'vitest'
import { MAX_DATA_ERRORS } from './data-errors.js'
import type { Table, TableRow } from './document.js'
import { prepareExpressions, RENDER_STEP_BUDGET } from './evaluate.js'
import type { ReportExpressions } from './evaluate.js'
import { resolveReport } from './resolve.js'

// Counts the conditions a render reads, by path, to show where reading
// stops; every reading is the real one, passed through.
const conditions = vi.hoisted(() => new Map<string, number>())
vi.mock('./evaluate.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./evaluate.js')>()
  return {
    ...original,
    prepareExpressions: (definition: ReportDefinition, locale?: string) => {
      const prepared = original.prepareExpressions(definition, locale)
      if (!prepared.ok) return prepared
      const real = prepared.expressions
      const counted: ReportExpressions = {
        compilation: real.compilation,
        get spent() {
          return real.spent
        },
        evaluate: (path, values, row) => real.evaluate(path, values, row),
        condition: (path, values, row) => {
          conditions.set(path, (conditions.get(path) ?? 0) + 1)
          return real.condition(path, values, row)
        },
      }
      return { ...prepared, expressions: counted }
    },
  }
})

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

describe("a group header's kept rows", () => {
  const GROUP = TABLE.group as NonNullable<TableComponent['group']>
  /** The report with its group stating `keepWithRows`, or nothing. */
  const keeping = (keepWithRows?: number): ReportDefinition =>
    report({ ...TABLE, group: { ...GROUP, ...(keepWithRows === undefined ? {} : { keepWithRows }) } })
  /** Five rows in Bern, two in Thun, one in Zug. */
  const SITES = [
    ...['A-1', 'A-2', 'A-3', 'A-4', 'A-5'].map((tag) => row('Bern', tag, '1.00')),
    row('Thun', 'B-1', '2.00'),
    row('Thun', 'B-2', '2.00'),
    row('Zug', 'C-1', '3.00'),
  ]
  /** Each row's kind, with what it keeps where it keeps anything. */
  const kept = (lowered: Table | undefined): string[] =>
    (lowered?.rows ?? []).map((each) => `${each.kind}${'keepWithRows' in each ? ` ${each.keepWithRows}` : ''}`)

  // How many rows a group has is the runtime's grouping, decided here once
  // (0059): a renderer handed the stated number would have to count the
  // group from the order of its rows' kinds, a second time, and keep a
  // header of two rows with three -- the next group's header among them.
  test('keeps each group header with as many of its first rows as the group states, or with all of them where it has fewer', () => {
    expect(kept(table(SITES, {}, keeping(3)))).toEqual([
      'groupHeader 3',
      ...Array.from({ length: 5 }, () => 'detail'),
      'groupFooter',
      'groupHeader 2',
      'detail',
      'detail',
      'groupFooter',
      'groupHeader',
      'detail',
      'groupFooter',
      'total',
    ])
  })

  // A table that selects its rows (0062) groups those alone, so the rows a
  // header keeps are counted among them: Bern's five rows, of which the
  // condition keeps two, keep two with their header, not the three the
  // group states. A count of every row of the key would have the renderer
  // keep a header of two rows with three, the next group's header among
  // them, which it refuses (0059).
  test('counts the rows a table’s condition selects in each group, never every row of its key', () => {
    const selecting = report({ ...TABLE, rowsWhen: { cel: 'row.tag != "A-3" && row.tag != "A-4" && row.tag != "A-5"' }, group: { ...GROUP, keepWithRows: 3 } })
    expect(kept(table(SITES, {}, selecting))).toEqual([
      'groupHeader 2',
      'detail',
      'detail',
      'groupFooter',
      'groupHeader 2',
      'detail',
      'detail',
      'groupFooter',
      'groupHeader',
      'detail',
      'groupFooter',
      'total',
    ])
  })

  // One row kept is the rule every group header has had, and the old
  // documents carry no member for it: a header of one row, a count of
  // one, and a report that states nothing each resolve to the row that
  // was resolved before 0059, so a renderer that predates the member
  // prints them as it did and the bytes of every existing report stay.
  test('writes no count where a header is kept with one row, or the report states none', () => {
    const stated = table(SITES)
    expect(stated?.rows.filter((each) => Object.keys(each).includes('keepWithRows'))).toEqual([])
    expect(table(SITES, {}, keeping(1))).toEqual(stated)
    expect(Object.keys(table(SITES, {}, keeping(1))?.rows[0] ?? {})).toEqual(Object.keys(stated?.rows[0] ?? {}))
    expect(kept(table([row('Zug', 'C-1', '3.00')], {}, keeping(3)))).toEqual(['groupHeader', 'detail', 'groupFooter', 'total'])
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

const FRANCS = { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } as const

/** A footer cell of `column` printing the aggregate `aggregate` over `scope`, in francs in the value column. */
const over = (aggregate: string, scope: 'report' | 'table' | 'group', column: string): TableFooterRow['cells'][number] => ({
  column,
  value: { kind: 'aggregate', aggregate, over: scope, ...(column === 'value' ? { format: FRANCS } : {}) },
})

/** A footer cell of `column` printing what `cel` gives. */
const said = (column: string, cel: string): TableFooterRow['cells'][number] => ({ column, value: { kind: 'expression', expression: { cel } } })

const text = (column: string, words: string): TableFooterRow['cells'][number] => ({ column, value: { kind: 'text', text: words } })

const GROUP = TABLE.group as NonNullable<TableComponent['group']>
const { group: _group, ...UNGROUPED } = TABLE

/** Every table `definition` prints over `rows`, in a final render; the test fails with the errors where it is refused. */
function tables(definition: ReportDefinition, rows: readonly Record<string, unknown>[] = ROWS): Table[] {
  const outcome = resolveReport(
    definition,
    { detail: rows, completeness: { complete: true, captured: rows.length }, consistency: 'host-captured' },
    { mode: 'final', creationDate: '2026-10-15T08:00:00Z' },
  )
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document.body.filter((block): block is Table => block.kind === 'table')
}

/** `report()` whose body holds `body`, and whose detail contract holds `fields` besides its own. */
function holding(body: readonly TableComponent[], fields: NonNullable<ReportDefinition['datasets']['detail']>['fields'] = []): ReportDefinition {
  const base = report()
  const contract = base.datasets.detail as NonNullable<ReportDefinition['datasets']['detail']>
  return { ...base, datasets: { detail: { ...contract, fields: [...contract.fields, ...fields] } }, regions: { ...base.regions, body } }
}

/** The rows tagged other than B-2, grouped by site as TABLE groups them, each group's header and footer saying how many rows the table holds. */
const A_TAGS: TableComponent = {
  ...TABLE,
  id: 'a-tags',
  rowsWhen: { cel: 'row.tag != "B-2"' },
  group: {
    ...GROUP,
    header: [{ kind: 'expression', expression: { cel: '"Site " + group.key + ": " + string(group.items) + " of " + string(table.items)' } }],
    footer: GROUP.footer.map((footer) => ({ ...footer, cells: [...footer.cells, over('items', 'table', 'count')] })),
  },
  totals: [{ cells: [text('tag', 'Total'), over('total', 'table', 'value'), over('items', 'table', 'count')] }],
}

/** The rows worth more than 2.00, largest first and ungrouped, with their own total and every row's. */
const LARGE: TableComponent = {
  ...UNGROUPED,
  id: 'large',
  rowsWhen: { cel: 'row.value > dec("2")' },
  columns: TABLE.columns.slice(0, 3),
  sort: [{ field: detail('value'), direction: 'desc' }],
  totals: [
    { cells: [text('tag', 'Large'), over('total', 'table', 'value'), over('items', 'table', 'count')] },
    { cells: [text('tag', 'All'), over('total', 'report', 'value'), said('count', 'string(table.items) + " of " + string(totals.items)')] },
  ],
  emptyText: 'No large items.',
}

describe('a table that selects its rows (0062)', () => {
  // The order's goods apart from its services: a table prints the rows its
  // condition selects and no other, ordered and grouped among themselves,
  // its subtotals over its groups and its total over its rows. A table
  // that printed every row, or totalled every row under some of them,
  // would print a total of rows it does not show.
  test('prints, orders and groups the rows it selects, and totals them as its own', () => {
    expect(cells(tables(holding([A_TAGS]))[0]?.rows)).toEqual([
      ['groupHeader', 'Site Bern: 3 of 4'],
      ['detail', 'A-1', CHF('1.10'), '1', '-'],
      ['detail', 'A-1', CHF('2.20'), '1', '-'],
      ['detail', 'A-2', CHF('0.05'), '1', '-'],
      ['groupFooter', 'Subtotal Bern', CHF('3.35'), '4', 'n'],
      ['groupHeader', 'Site Thun: 1 of 4'],
      ['detail', 'A-1', CHF('5.50'), '1', '-'],
      ['groupFooter', 'Subtotal Thun', CHF('5.50'), '4', 'n'],
      ['total', 'Total', CHF('8.85'), '4', ''],
    ])
  })

  // Two tables over the same rows: each in its own order and groups, each
  // total its own, and `totals` every row's under either. The table that
  // selects none prints what it printed as a report's one table.
  test("prints beside another table over the same rows, with its own total and every row's", () => {
    const [all, large] = tables(holding([TABLE, LARGE]))
    expect(cells(all?.rows)).toEqual(cells(table()?.rows))
    expect(cells(large?.rows)).toEqual([
      ['detail', 'B-2', CHF('10.00'), '1'],
      ['detail', 'A-1', CHF('5.50'), '1'],
      ['detail', 'A-1', CHF('2.20'), '1'],
      ['total', 'Large', CHF('17.70'), '3'],
      ['total', 'All', CHF('18.85'), '3 of 5'],
    ])
  })

  // A table without a condition is over every row, and its `table` is the
  // report's totals: an existing table's total moved to `over: 'table'`,
  // or read as `table.<id>`, prints what it printed as `totals`, in its
  // total rows and its group's footer alike.
  test("binds the report's totals as its own when it has no condition", () => {
    const every: TableComponent = {
      ...TABLE,
      group: { ...GROUP, footer: [{ cells: [said('tag', 'string(group.items) + " of " + string(table.items)')] }] },
      totals: [
        {
          cells: [
            said('tag', 'string(table.items) + "/" + string(totals.items)'),
            over('total', 'table', 'value'),
            said('count', 'table.total == totals.total ? "one" : "two"'),
          ],
        },
      ],
    }
    expect(cells(tables(holding([every]))[0]?.rows.filter((row) => row.kind !== 'detail' && row.kind !== 'groupHeader'))).toEqual([
      ['groupFooter', '3 of 5', '', '', ''],
      ['groupFooter', '2 of 5', '', '', ''],
      ['total', '5/5', CHF('18.85'), 'one', ''],
    ])
  })

  // A table whose condition selects no row prints its empty text, and its
  // totals of nothing: a count and a sum 0, a greatest nothing (0007),
  // while every row's total is still every row's.
  test('prints its empty text and totals of nothing when it selects no row', () => {
    const none: TableComponent = {
      ...LARGE,
      rowsWhen: { cel: 'row.value > dec("100")' },
      totals: [...(LARGE.totals ?? []), { cells: [text('tag', 'Largest'), over('largest', 'table', 'value')] }],
    }
    const definition: ReportDefinition = {
      ...holding([none]),
      aggregates: [...report().aggregates, { id: 'largest', fn: 'max', of: { kind: 'field', field: detail('value') } }],
    }
    const [lowered] = tables(definition)
    expect(lowered?.emptyText).toBe('No large items.')
    expect(cells(lowered?.rows)).toEqual([
      ['total', 'Large', CHF('0.00'), '0'],
      ['total', 'All', CHF('18.85'), '0 of 5'],
      ['total', 'Largest', '', ''],
    ])
  })

  // A condition that fails for a row refuses the render, naming the row by
  // its index in the data, never read as false and the row quietly left
  // out. It is read before the table orders its rows, so the errors come
  // in the data's order, though row 3 prints before row 1.
  test("refuses a condition that fails for a row, naming each row by its index, in the data's order", () => {
    const failing = 'divide(dec("1"), (row.value - dec("1.10")) * (row.value - dec("0.05")), 2) > dec("0")'
    const outcome = resolveReport(
      holding([{ ...TABLE, rowsWhen: { cel: failing } }]),
      { detail: ROWS, completeness: { complete: true, captured: ROWS.length }, consistency: 'host-captured' },
      { mode: 'final', creationDate: '2026-10-15T08:00:00Z' },
    )
    if (outcome.ok) throw new Error('resolved')
    expect(outcome.errors.map((error) => ({ stage: error.stage, code: error.code, path: error.path, row: 'row' in error ? error.row : undefined }))).toEqual([
      { stage: 'evaluation', code: 'expression-failed', path: '/regions/body/0/rowsWhen/cel', row: 1 },
      { stage: 'evaluation', code: 'expression-failed', path: '/regions/body/0/rowsWhen/cel', row: 3 },
    ])
    expect(outcome.errors[0]?.message).toContain('component equipment, detail row 1:')
  })

  // A render whose error list is full is refused, and reads its condition
  // no further: one that fails on every row stops at the row that fills
  // the list, rather than spending the budget on every row there is.
  test('reads its condition no further once the error list is full', () => {
    const rows = Array.from({ length: 3 * MAX_DATA_ERRORS }, (_, index) => row('Bern', `T-${index}`, '1.10'))
    conditions.clear()
    const outcome = resolveReport(
      holding([{ ...LARGE, rowsWhen: { cel: 'divide(dec("1"), row.value - dec("1.10"), 2) > dec("0")' } }]),
      { detail: rows, completeness: { complete: true, captured: rows.length }, consistency: 'host-captured' },
      { mode: 'final', creationDate: '2026-10-15T08:00:00Z' },
    )
    if (outcome.ok) throw new Error('resolved')
    expect(outcome.errors.at(-1)?.code).toBe('too-many-errors')
    expect(conditions.get('/regions/body/0/rowsWhen/cel')).toBe(MAX_DATA_ERRORS + 1)
  })

  // A table every column of which is hidden prints nothing, and selects
  // nothing either: its condition is not read for any row, so one that
  // would fail for a row refuses no render that prints no such table. A
  // runtime that selected the rows first would refuse a report over a
  // table nobody sees.
  test('reads no condition, and refuses nothing for it, when every column is hidden', () => {
    const failing = 'divide(dec("1"), (row.value - dec("1.10")) * (row.value - dec("0.05")), 2) > dec("0")'
    const hidden: TableComponent = {
      ...TABLE,
      rowsWhen: { cel: failing },
      columns: TABLE.columns.map((column) => ({ ...column, visibleWhen: { cel: 'params.notes' } })),
    }
    conditions.clear()
    expect(table(ROWS, { notes: false }, holding([hidden]))).toBeUndefined()
    expect(conditions.get('/regions/body/0/rowsWhen/cel')).toBeUndefined()
    expect(conditions.get('/regions/body/0/columns/0/visibleWhen/cel')).toBe(1)
  })

  // A preview whose data lacks a field the condition reads leaves those
  // rows out of that table, as a component's condition over it does not
  // hold, and says so once for the condition, not once a row; the rows
  // that hold it print.
  test('leaves out, in a preview, the rows that lack what its condition reads, and says so once', () => {
    const definition = holding([{ ...LARGE, rowsWhen: { cel: 'row.checked' } }], [{ id: 'checked', type: 'boolean', label: 'Checked', nullable: false }])
    const rows = ROWS.map((each, index) => (index === 0 || index === 3 ? { ...each, checked: true } : each))
    const outcome = resolveReport(
      definition,
      { detail: rows, completeness: { complete: true, captured: rows.length }, consistency: 'host-captured' },
      { mode: 'preview', creationDate: '2026-10-15T08:00:00Z' },
    )
    if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
    const lowered = outcome.document.body.find((block): block is Table => block.kind === 'table')
    expect(cells(lowered?.rows.filter((each) => each.kind === 'detail'))).toEqual([
      ['detail', 'B-2', CHF('10.00'), '1'],
      ['detail', 'A-1', CHF('1.10'), '1'],
    ])
    expect(outcome.warnings.map((warning) => `${warning.stage} ${warning.code} ${warning.path}`)).toEqual([
      'data missing-field /detail/1/checked',
      'evaluation missing-value /regions/body/0/rowsWhen/cel',
    ])
  })

  // Each table reads its condition once a row, and every reading counts
  // against the render's budget: a condition that spends over half the
  // budget across the rows resolves in one table and is refused in two,
  // rather than costing time nothing bounds. The two renders spend the
  // real budget and half of it again: about two seconds here, over five
  // under coverage, hence its own timeout.
  test("counts each table's condition, once a row, against the render's budget", { timeout: 60_000 }, () => {
    const list = (length: number): string => `[${Array.from({ length }, (_, index) => index).join(',')}]`
    const heavy = `size(${list(64)}.filter(x, ${list(24)}.exists(y, y == x))) > 0 && row.count > 0`
    const one = holding([{ ...LARGE, rowsWhen: { cel: heavy } }])
    const expressions = (prepareExpressions(one) as { readonly expressions: ReportExpressions }).expressions
    expect(expressions.condition('/regions/body/0/rowsWhen/cel', { row: { count: 1n } }, 0)).toEqual({ ok: true, value: true })
    // Each evaluation is charged its steps and one more.
    const each = expressions.spent
    const count = Math.floor(RENDER_STEP_BUDGET / each / 2) + 10
    expect(count * each).toBeLessThan(RENDER_STEP_BUDGET)
    expect(2 * count * each).toBeGreaterThan(RENDER_STEP_BUDGET)
    const rows = Array.from({ length: count }, (_, index) => row('Bern', `T-${index}`, '1.00'))
    expect(tables(one, rows)[0]?.rows.filter((printed) => printed.kind === 'detail')).toHaveLength(count)
    const two = holding([
      { ...LARGE, rowsWhen: { cel: heavy } },
      { ...LARGE, id: 'again', rowsWhen: { cel: heavy } },
    ])
    const outcome = resolveReport(
      two,
      { detail: rows, completeness: { complete: true, captured: rows.length }, consistency: 'host-captured' },
      { mode: 'final', creationDate: '2026-10-15T08:00:00Z' },
    )
    expect(outcome.ok ? [] : outcome.errors.map((error) => `${error.code} ${error.path}`)).toContain('render-budget /regions/body/1/rowsWhen/cel')
  })
})
