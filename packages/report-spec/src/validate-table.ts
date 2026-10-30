/**
 * The table over the detail dataset: its columns, single grouping level,
 * sort and footer rows, and the references each makes into the detail
 * dataset and into the table's own columns.
 */
import { all, identifier, oneOf, optional, quote, readArray, readList, reference, shape, text, width } from './check.js'
import type { ComponentBase, Width } from './components.js'
import type { RegionName } from './definition.js'
import { MAX_FOOTER_ROWS, MAX_LABEL_LENGTH, MAX_SORT_KEYS, MAX_TABLE_COLUMNS } from './limits.js'
import { at } from './pointer.js'
import { ALIGNMENTS } from './styles.js'
import { SORT_DIRECTIONS } from './table.js'
import type { SortKey, TableColumn, TableComponent, TableFooterCell, TableFooterRow, TableGroup } from './table.js'
import { declare, resolve, withinPage } from './validate-context.js'
import type { Ctx, Declarations } from './validate-context.js'
import { readExpression, readFieldRef, readInline, readInlines, readStyleRef, readStyleRules } from './validate-inline.js'
import type { FieldBinding, InlineScope } from './validate-inline.js'
import { roundPt } from './units.js'

export const TABLE_REQUIRED = ['dataset', 'columns', 'emptyText', 'repeatHeader']
export const TABLE_OPTIONAL = ['headerStyle', 'sort', 'group', 'totals']

/** Reports a sort or group key whose field is an image: an image has no order. */
function orderable(c: Ctx, key: FieldBinding | undefined, path: string): void {
  if (key?.type === 'image') c.f.report(path, 'binding-type-mismatch', 'an image field has no order to sort or group by')
}

/** Reports fixed widths that add up to more than the printable width; fill columns share what is left. */
export function checkFixedWidths(c: Ctx, widths: readonly (Width | undefined)[], path: string): void {
  const fixed = all(widths)?.reduce<number>((total, columnWidth) => total + (columnWidth === 'fill' ? 0 : columnWidth), 0)
  withinPage(c, fixed === undefined ? undefined : roundPt(fixed), path, 'width', 'the fixed widths of these columns')
}

function readTableColumn(
  c: Ctx,
  value: unknown,
  path: string,
  region: RegionName,
): { id: string | undefined; width: Width | undefined; column: TableColumn | undefined } {
  const o = shape(c.f, value, path, ['id', 'header', 'width', 'align', 'value'], ['visibleWhen', 'style', 'styleWhen'])
  const id = identifier(c.f, o?.id, at(path, 'id'))
  const header = text(c.f, o?.header, at(path, 'header'), MAX_LABEL_LENGTH)
  const columnWidth = width(c.f, o?.width, at(path, 'width'))
  const align = oneOf(c.f, o?.align, at(path, 'align'), ALIGNMENTS)
  const cell = readInline(c, o?.value, at(path, 'value'), { region, reads: 'row' })
  const visibleWhen = readExpression(c.f, o?.visibleWhen, at(path, 'visibleWhen'))
  const style = readStyleRef(c, o?.style, at(path, 'style'))
  const styleWhen = readStyleRules(c, o?.styleWhen, at(path, 'styleWhen'))
  if (id === undefined || header === undefined || columnWidth === undefined || align === undefined || cell === undefined)
    return { id, width: columnWidth, column: undefined }
  const column = {
    id,
    header,
    width: columnWidth,
    align,
    value: cell,
    ...optional('visibleWhen', visibleWhen),
    ...optional('style', style),
    ...optional('styleWhen', styleWhen),
  }
  return { id, width: columnWidth, column }
}

/** A footer cell, and the column it names when that could be read. */
function readFooterCell(
  c: Ctx,
  value: unknown,
  path: string,
  scope: InlineScope,
  columns: Declarations<true>,
): { column: string | undefined; cell: TableFooterCell | undefined } {
  const o = shape(c.f, value, path, ['column', 'value'])
  const column = reference(c.f, o?.column, at(path, 'column'))
  if (column !== undefined && columns !== undefined && !columns.has(column)) {
    c.f.report(at(path, 'column'), 'unknown-column', `this table has no column ${quote(column)}`)
  }
  const cellValue = readInline(c, o?.value, at(path, 'value'), scope)
  return { column, cell: column === undefined || cellValue === undefined ? undefined : { column, value: cellValue } }
}

/** A footer row: at most one cell per column, each under a column the table has. */
function readFooterRow(c: Ctx, value: unknown, path: string, scope: InlineScope, columns: Declarations<true>): TableFooterRow | undefined {
  const o = shape(c.f, value, path, ['cells'], ['style'])
  const where = at(path, 'cells')
  const cells = readArray(c.f, o?.cells, where, MAX_TABLE_COLUMNS)?.map((item, index) => readFooterCell(c, item, at(where, index), scope, columns))
  const named = (cells ?? []).map(({ column }, index) => ({ id: column, path: at(at(where, index), 'column'), value: true }))
  declare(c.f, named, 'duplicate-footer-cell', (column) => `column ${column} already has a cell in this row`)
  const style = readStyleRef(c, o?.style, at(path, 'style'))
  const read = cells && all(cells.map(({ cell }) => cell))
  return read && { cells: read, ...optional('style', style) }
}

function readFooterRows(c: Ctx, value: unknown, path: string, scope: InlineScope, columns: Declarations<true>): readonly TableFooterRow[] | undefined {
  const rows = readArray(c.f, value, path, MAX_FOOTER_ROWS)?.map((row, index) => readFooterRow(c, row, at(path, index), scope, columns))
  return rows && all(rows)
}

function readGroup(
  c: Ctx,
  value: unknown,
  path: string,
  region: RegionName,
  columns: Declarations<true>,
): { group: TableGroup | undefined; by: string | undefined } {
  const o = shape(c.f, value, path, ['by', 'direction', 'header', 'footer'], ['headerStyle'])
  const by = readFieldRef(c, o?.by, at(path, 'by'), 'detail')
  orderable(c, by, at(path, 'by'))
  // Only a field the dataset declares can be checked against: with an
  // unknown one, the header's detail fields are not refused for not being it.
  const scope: InlineScope = { region, reads: 'group', groupBy: by?.declared === true ? by.ref.field : undefined }
  const direction = oneOf(c.f, o?.direction, at(path, 'direction'), SORT_DIRECTIONS)
  const header = readInlines(c, o?.header, at(path, 'header'), scope)
  const headerStyle = readStyleRef(c, o?.headerStyle, at(path, 'headerStyle'))
  const footer = readFooterRows(c, o?.footer, at(path, 'footer'), scope, columns)
  if (by === undefined || direction === undefined || header === undefined || footer === undefined) return { group: undefined, by: by?.ref.field }
  return { group: { by: by.ref, direction, header, ...optional('headerStyle', headerStyle), footer }, by: by.ref.field }
}

/** Sort keys, after the group's key: rows are ordered by the group's key first, so a key on that field, or on one already sorted by, orders nothing. */
function readSort(c: Ctx, value: unknown, path: string, groupBy: string | undefined): readonly SortKey[] | undefined {
  const keys = readArray(c.f, value, path, MAX_SORT_KEYS)?.map((item, index) => {
    const where = at(path, index)
    const o = shape(c.f, item, where, ['field', 'direction'])
    const field = readFieldRef(c, o?.field, at(where, 'field'), 'detail')
    orderable(c, field, at(where, 'field'))
    const direction = oneOf(c.f, o?.direction, at(where, 'direction'), SORT_DIRECTIONS)
    return { field, direction, path: at(where, 'field') }
  })
  // The group's key orders first, so it is declared before the sort keys.
  const group = groupBy === undefined ? [] : [{ id: groupBy, path, value: true }]
  const sorted = (keys ?? []).map(({ field, path: fieldPath }) => ({ id: field?.ref.field, path: fieldPath, value: true }))
  declare(
    c.f,
    [...group, ...sorted],
    'duplicate-sort-key',
    (field) => `${field} already orders these rows, as the group's key or an earlier sort key; a second key on it orders nothing`,
  )
  return keys && all(keys.map(({ field, direction }) => (field === undefined || direction === undefined ? undefined : { field: field.ref, direction })))
}

/**
 * The table, after refusing a second one: version 0 has one primary detail
 * dataset (plan 10) and one table over it.
 */
export function readTable(c: Ctx, o: Record<string, unknown>, path: string, region: RegionName, base: ComponentBase | undefined): TableComponent | undefined {
  if (c.detailTable === undefined) c.detailTable = path
  else c.f.report(path, 'second-detail-table', `a report has one table over the detail dataset in version 0, and this one's is at ${c.detailTable}`)
  const dataset = oneOf(c.f, o.dataset, at(path, 'dataset'), ['detail'])
  resolve(c.f, c.declared.datasets, dataset, at(path, 'dataset'), 'unknown-dataset', 'dataset')
  const read = readList(c.f, o.columns, at(path, 'columns'), 1, MAX_TABLE_COLUMNS)?.map((item, index) =>
    readTableColumn(c, item, at(at(path, 'columns'), index), region),
  )
  const columnIds =
    read &&
    declare(
      c.f,
      read.map(({ id }, index) => ({ id, path: at(at(at(path, 'columns'), index), 'id'), value: true as const })),
      'duplicate-column-id',
      (id) => `this table already has a column ${id}`,
    )
  if (read !== undefined)
    checkFixedWidths(
      c,
      read.map(({ width: columnWidth }) => columnWidth),
      at(path, 'columns'),
    )
  const headerStyle = readStyleRef(c, o.headerStyle, at(path, 'headerStyle'))
  const group = readGroup(c, o.group, at(path, 'group'), region, columnIds)
  const sort = readSort(c, o.sort, at(path, 'sort'), group.by)
  const totals = readFooterRows(c, o.totals, at(path, 'totals'), { region, reads: 'report' }, columnIds)
  const emptyText = text(c.f, o.emptyText, at(path, 'emptyText'), MAX_LABEL_LENGTH)
  const repeatHeader = oneOf(c.f, o.repeatHeader, at(path, 'repeatHeader'), [true])
  const columns = read && all(read.map(({ column }) => column))
  if (base === undefined || dataset === undefined || columns === undefined || emptyText === undefined || repeatHeader === undefined) return undefined
  return {
    ...base,
    kind: 'table',
    dataset,
    columns,
    ...optional('headerStyle', headerStyle),
    ...optional('sort', sort),
    ...optional('group', group.group),
    ...optional('totals', totals),
    emptyText,
    repeatHeader,
  }
}
