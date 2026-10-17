import { componentAt } from '@formancy/report-spec'
import type { ReportDefinition, TableColumn, TableComponent, TableFooterRow } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { openReportSession } from '../session.js'
import { accepted, eInvoiceSample, frozen, frozenSample, refused } from '../test-support.js'
import { updateComponent } from './components.js'
import {
  insertColumn,
  insertFooterRow,
  moveColumn,
  moveFooterRow,
  putFooterCell,
  removeColumn,
  removeFooterCell,
  removeFooterRow,
  setGroup,
  setSort,
  updateColumn,
  updateFooterRow,
} from './table.js'

const TABLE = '/regions/body/2'

function table(report: ReportDefinition): TableComponent {
  const found = componentAt(report, 'lines')?.component
  if (found?.kind !== 'table') throw new Error('the sample has no table "lines"')
  return found
}

const note: TableColumn = { id: 'note', header: 'Note', width: 'fill', align: 'left', value: { kind: 'text', text: '-' } }
const row: TableFooterRow = { cells: [{ column: 'sku', value: { kind: 'text', text: 'Discount' } }] }

/** The columns of each footer row, row by row. */
const cellColumns = (rows: readonly TableFooterRow[] | undefined): string[][] => (rows ?? []).map(({ cells }) => cells.map(({ column }) => column))

describe('columns', () => {
  // Dragging a field onto the table adds a column where it was dropped.
  test('insert a column at an index', () => {
    const next = table(accepted(insertColumn(frozenSample(), 'lines', 1, note)))
    expect(next.columns.map(({ id }) => id)).toEqual(['sku', 'note', 'qty', 'price', 'amount', 'shipped-at'])
  })

  // A column's footer cells belong to it: deleting the column and leaving
  // its cells would give a table the validator refuses (unknown-column).
  test('remove a column with its cells in every footer row', () => {
    const next = table(accepted(removeColumn(frozenSample(), 'lines', 'amount')))
    expect(next.columns.map(({ id }) => id)).toEqual(['sku', 'qty', 'price', 'shipped-at'])
    expect(cellColumns(next.group?.footer)).toEqual([['sku', 'qty']])
    expect(cellColumns(next.totals)).toEqual([['sku', 'qty'], ['sku']])
  })

  // A footer row with no cell for the column is not rebuilt: the builder
  // keeps its rendering.
  test('leave a footer row without a cell for the removed column as it was', () => {
    const report = frozenSample()
    const next = table(accepted(removeColumn(report, 'lines', 'qty')))
    expect(next.totals?.[1]).toBe(table(report).totals?.[1])
    expect(next.totals?.[0]).not.toBe(table(report).totals?.[0])
  })

  // A table without totals or a group has no footer rows to clean; the
  // column goes and nothing else appears.
  test('remove a column from a table with no footer rows', () => {
    const bare = accepted(updateComponent(accepted(setGroup(frozenSample(), 'lines', null)), 'lines', 'table', { totals: null }))
    const next = table(accepted(removeColumn(bare, 'lines', 'qty')))
    expect('group' in next || 'totals' in next).toBe(false)
    expect(next.columns).toHaveLength(4)
  })

  // Moving a column with the keyboard is index plus or minus one, counted
  // without the column, as for components.
  test('move a column to the index it ends at', () => {
    const next = table(accepted(moveColumn(frozenSample(), 'lines', 'sku', 2)))
    expect(next.columns.map(({ id }) => id)).toEqual(['qty', 'price', 'sku', 'amount', 'shipped-at'])
  })

  // The property panel edits a column; its id is what footer cells name.
  test('update a column, and refuse a change to its id', () => {
    const report = frozenSample()
    const next = table(accepted(updateColumn(report, 'lines', 'shipped-at', { header: 'Sent', visibleWhen: null })))
    const { visibleWhen: _gone, ...rest } = table(report).columns[4] as TableColumn
    expect(next.columns[4]).toEqual({ ...rest, header: 'Sent' })
    const sneaky = { id: 'other' } as unknown as Parameters<typeof updateColumn>[3]
    expect(refused(updateColumn(report, 'lines', 'sku', sneaky))).toMatchObject({ code: 'immutable-property', path: `${TABLE}/columns/0/id`, componentId: 'lines' })
  })

  // Each refusal names what was wrong: no such table, a component that is
  // not one, no such column, a place outside the list.
  test.each([
    ['a table the report lacks', (report: ReportDefinition) => insertColumn(report, 'nowhere', 0, note), 'not-found'],
    ['a component that is not a table', (report: ReportDefinition) => insertColumn(report, 'intro', 0, note), 'kind-mismatch'],
    ['an index past the end', (report: ReportDefinition) => insertColumn(report, 'lines', 6, note), 'index-out-of-range'],
    ['removing a column the table lacks', (report: ReportDefinition) => removeColumn(report, 'lines', 'nowhere'), 'not-found'],
    ['moving a column the table lacks', (report: ReportDefinition) => moveColumn(report, 'lines', 'nowhere', 0), 'not-found'],
    ['moving a column past the end', (report: ReportDefinition) => moveColumn(report, 'lines', 'sku', 5), 'index-out-of-range'],
    ['updating a column the table lacks', (report: ReportDefinition) => updateColumn(report, 'lines', 'nowhere', {}), 'not-found'],
  ] as const)('refuse %s', (_name, command, code) => {
    expect(refused(command(frozenSample())).code).toBe(code)
  })
})

describe('grouping and sorting', () => {
  // "Group this report by location" sets the one grouping level; removing
  // it removes the property, not just its rows.
  test('setGroup sets, replaces and removes the group', () => {
    const report = frozenSample()
    const group = { by: { dataset: 'detail', field: 'sku' }, direction: 'desc', header: [], footer: [] } as const
    expect(table(accepted(setGroup(report, 'lines', group))).group).toEqual(group)
    expect('group' in table(accepted(setGroup(report, 'lines', null)))).toBe(false)
  })

  test('setSort sets and removes the sort keys', () => {
    // The sort keys are replaced as a list, which is how a sort editor holds them.
    const report = frozenSample()
    const sort = [{ field: { dataset: 'detail', field: 'quantity' }, direction: 'asc' }] as const
    expect(table(accepted(setSort(report, 'lines', sort))).sort).toEqual(sort)
    expect('sort' in table(accepted(setSort(report, 'lines', null)))).toBe(false)
  })

  // A group or sort on something that is not a table is a stale selection.
  test('refuse a component that is not a table', () => {
    expect(refused(setGroup(frozenSample(), 'gap', null))).toMatchObject({ code: 'kind-mismatch', componentId: 'gap' })
    expect(refused(setSort(frozenSample(), 'nowhere', []))).toMatchObject({ code: 'not-found' })
  })
})

describe('footer rows', () => {
  // A quotation adds a discount line under the subtotal; the totals are a
  // list of rows, and a table without any gets its first.
  test('insert a row into the totals, creating them when the table has none', () => {
    const report = frozenSample()
    expect(cellColumns(table(accepted(insertFooterRow(report, 'lines', 'totals', 1, row))).totals)).toEqual([['sku', 'qty', 'amount'], ['sku'], ['sku', 'amount']])
    const none = accepted(updateComponent(report, 'lines', 'table', { totals: null }))
    expect(table(accepted(insertFooterRow(none, 'lines', 'totals', 0, row))).totals).toEqual([row])
    expect(refused(insertFooterRow(none, 'lines', 'totals', 1, row)).code).toBe('index-out-of-range')
  })

  // A group's footer is edited the same way as the totals.
  test('insert, update, move and remove a row of the group footer', () => {
    const report = frozenSample()
    const two = frozen(accepted(insertFooterRow(report, 'lines', 'groupFooter', 1, row)))
    expect(cellColumns(table(two).group?.footer)).toEqual([['sku', 'qty', 'amount'], ['sku']])
    const styled = frozen(accepted(updateFooterRow(two, 'lines', 'groupFooter', 1, { style: 'strong' })))
    expect(table(styled).group?.footer[1]).toEqual({ ...row, style: 'strong' })
    expect(cellColumns(table(accepted(moveFooterRow(styled, 'lines', 'groupFooter', 1, 0))).group?.footer)).toEqual([['sku'], ['sku', 'qty', 'amount']])
    expect(table(accepted(removeFooterRow(styled, 'lines', 'groupFooter', 0))).group?.footer).toEqual([{ ...row, style: 'strong' }])
  })

  // A cell is put by column: the column's cell is replaced where it is, or
  // added at the end of the row, and removed by column.
  test('put and remove the cell of a column', () => {
    const report = frozenSample()
    const replaced = table(accepted(putFooterCell(report, 'lines', 'totals', 1, { column: 'sku', value: { kind: 'text', text: 'Grand total' } })))
    expect(replaced.totals?.[1]?.cells[0]).toEqual({ column: 'sku', value: { kind: 'text', text: 'Grand total' } })
    const added = table(accepted(putFooterCell(report, 'lines', 'totals', 1, { column: 'qty', value: { kind: 'text', text: '-' } })))
    expect(cellColumns(added.totals)[1]).toEqual(['sku', 'amount', 'qty'])
    expect(cellColumns(table(accepted(removeFooterCell(report, 'lines', 'groupFooter', 0, 'qty'))).group?.footer)).toEqual([['sku', 'amount']])
  })

  // An empty list has no position to name, and the refusal says so rather
  // than offering a range from 0 to -1.
  test('refuse a row of an empty footer, saying it is empty', () => {
    const empty = accepted(updateComponent(frozenSample(), 'lines', 'table', { totals: [] }))
    expect(refused(removeFooterRow(empty, 'lines', 'totals', 0)).message).toContain('nothing to index')
  })

  // Every place a footer edit names is checked: a group footer needs a
  // group, a row index needs a row, a cell needs its column in the row.
  test.each([
    ['a group footer on a table with no group', (report: ReportDefinition) => insertFooterRow(accepted(setGroup(report, 'lines', null)), 'lines', 'groupFooter', 0, row), 'not-found'],
    ['a row past the end', (report: ReportDefinition) => insertFooterRow(report, 'lines', 'totals', 3, row), 'index-out-of-range'],
    ['removing a row the footer lacks', (report: ReportDefinition) => removeFooterRow(report, 'lines', 'totals', 2), 'index-out-of-range'],
    ['moving from a row the footer lacks', (report: ReportDefinition) => moveFooterRow(report, 'lines', 'totals', 2, 0), 'index-out-of-range'],
    ['moving to a row the footer lacks', (report: ReportDefinition) => moveFooterRow(report, 'lines', 'totals', 0, 2), 'index-out-of-range'],
    ['updating a row the footer lacks', (report: ReportDefinition) => updateFooterRow(report, 'lines', 'totals', -1, {}), 'index-out-of-range'],
    ['a cell in a row the footer lacks', (report: ReportDefinition) => putFooterCell(report, 'lines', 'groupFooter', 1, row.cells[0] ?? { column: 'x', value: { kind: 'pageNumber' } }), 'index-out-of-range'],
    ['removing a cell the row lacks', (report: ReportDefinition) => removeFooterCell(report, 'lines', 'totals', 1, 'qty'), 'not-found'],
    ['removing a cell from a row the footer lacks', (report: ReportDefinition) => removeFooterCell(report, 'lines', 'totals', 2, 'sku'), 'index-out-of-range'],
    ['footer rows of a component that is not a table', (report: ReportDefinition) => removeFooterRow(report, 'intro', 'totals', 0), 'kind-mismatch'],
  ] as const)('refuse %s', (_name, command, code) => {
    expect(refused(command(frozenSample())).code).toBe(code)
  })
})

describe('a column that prints an e-invoice line', () => {
  /** The validator's errors for an edit to the e-invoice sample, as code and path; none when the session commits it. */
  function errorsOf(edit: (report: ReportDefinition) => ReturnType<typeof removeColumn>): string[] {
    const opening = openReportSession(eInvoiceSample())
    if (!opening.ok) throw new Error('the e-invoice sample did not open')
    const outcome = opening.session.apply(edit)
    return outcome.ok ? [] : refused(outcome).errors?.map(({ code, path }) => `${code} ${path}`) ?? [refused(outcome).code]
  }

  // The XML is written from what the named columns print. A column
  // removed would leave a line term with nothing to print it; a column
  // that may be hidden would print an invoice whose lines the XML holds
  // and its page does not. The session refuses either, with the
  // validator's reason, and commits nothing.
  test.each([
    ['removed', (report: ReportDefinition) => removeColumn(report, 'lines', 'amount'), ['unknown-column /eInvoice/lines/netAmount']],
    ['hidden', (report: ReportDefinition) => updateColumn(report, 'lines', 'qty', { visibleWhen: { cel: 'params.draft' } }), ['invalid-e-invoice /eInvoice/lines/quantity']],
    ['given a literal text', (report: ReportDefinition) => updateColumn(report, 'lines', 'sku', { value: { kind: 'text', text: 'Item' } }), ['invalid-e-invoice /eInvoice/lines/name']],
  ])('is refused when %s', (_change, edit, errors) => {
    expect(errorsOf(edit)).toEqual(errors)
  })

  // A column the e-invoice does not name is the page's own.
  test('is only one the e-invoice names: another may be hidden or removed', () => {
    expect(errorsOf((report) => updateColumn(report, 'lines', 'shipped-at', { visibleWhen: { cel: 'params.draft' } }))).toEqual([])
    expect(errorsOf((report) => removeColumn(report, 'lines', 'shipped-at'))).toEqual([])
  })
})
