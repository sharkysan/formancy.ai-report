/**
 * Commands on the table over the detail dataset: its columns, its one
 * grouping level, its sort keys, and the rows under its groups and under
 * the table -- subtotals, tax lines, totals -- cell by cell.
 *
 * Each names the table by its component id. A column is named by its id,
 * which footer cells refer to, so a column's id never changes in place; a
 * footer row has no id and is named by its position.
 */
import { componentAt } from '@formancy/report-spec'
import type { ReportDefinition, SortKey, TableColumn, TableComponent, TableFooterCell, TableFooterRow, TableGroup } from '@formancy/report-spec'
import { checkIndex, insertedAt, movedTo, patched, removedAt, replacedAt } from '../lists.js'
import type { Patch } from '../lists.js'
import { isRefusal, quote, refuse } from '../outcome.js'
import type { CommandOutcome, Place, Refusal } from '../outcome.js'
import { updateAt } from '../tree.js'

/** Where a table is: its JSON Pointer and its id. */
interface TablePlace {
  readonly path: string
  readonly componentId: string
}

/** Which footer rows: those under the whole table, or those under each group. */
export type FooterRows = 'totals' | 'groupFooter'

/** The table `tableId` changed by `change`, which is told where the table is. */
function withTable(report: ReportDefinition, tableId: string, change: (table: TableComponent, place: TablePlace) => TableComponent | Refusal): CommandOutcome {
  const found = componentAt(report, tableId)
  if (found === undefined) return refuse('not-found', `no component is ${quote(tableId)}`, { componentId: tableId })
  const place = { path: found.path, componentId: tableId }
  if (found.component.kind !== 'table') return refuse('kind-mismatch', `${quote(tableId)} is a ${found.component.kind}, not a table`, place)
  const next = change(found.component, place)
  return isRefusal(next) ? next : { ok: true, report: updateAt(report, found.path, () => next) }
}

/** The position of the column `columnId`, or a refusal. */
function columnIndex(table: TableComponent, columnId: string, place: TablePlace): number | Refusal {
  const index = table.columns.findIndex((column) => column.id === columnId)
  return index === -1 ? refuse('not-found', `the table has no column ${quote(columnId)}`, { ...place, path: `${place.path}/columns` }) : index
}

export function insertColumn(report: ReportDefinition, tableId: string, index: number, column: TableColumn): CommandOutcome {
  return withTable(report, tableId, (table, place) => {
    const outside = checkIndex(index, table.columns.length, `the table's ${table.columns.length} columns`, { ...place, path: `${place.path}/columns` })
    return outside ?? { ...table, columns: insertedAt(table.columns, index, column) }
  })
}

/** Removes a column, and its cell from every footer row: a cell belongs to its column. */
export function removeColumn(report: ReportDefinition, tableId: string, columnId: string): CommandOutcome {
  return withTable(report, tableId, (table, place) => {
    const index = columnIndex(table, columnId, place)
    if (isRefusal(index)) return index
    const uncelled = (rows: readonly TableFooterRow[]): TableFooterRow[] =>
      rows.map((row) => (row.cells.some((cell) => cell.column === columnId) ? { ...row, cells: row.cells.filter((cell) => cell.column !== columnId) } : row))
    return {
      ...table,
      columns: removedAt(table.columns, index),
      ...(table.group === undefined ? {} : { group: { ...table.group, footer: uncelled(table.group.footer) } }),
      ...(table.totals === undefined ? {} : { totals: uncelled(table.totals) }),
    }
  })
}

/** Moves a column so that it ends at `index`, counted without it. */
export function moveColumn(report: ReportDefinition, tableId: string, columnId: string, index: number): CommandOutcome {
  return withTable(report, tableId, (table, place) => {
    const from = columnIndex(table, columnId, place)
    if (isRefusal(from)) return from
    const outside = checkIndex(index, table.columns.length - 1, `the table's ${table.columns.length} columns`, { ...place, path: `${place.path}/columns` })
    return outside ?? { ...table, columns: movedTo(table.columns, from, index) }
  })
}

/** Changes a column's properties; its id, which footer cells name, never changes in place. */
export function updateColumn(report: ReportDefinition, tableId: string, columnId: string, patch: Patch<Omit<TableColumn, 'id'>>): CommandOutcome {
  return withTable(report, tableId, (table, place) => {
    const index = columnIndex(table, columnId, place)
    if (isRefusal(index)) return index
    if (Object.hasOwn(patch, 'id')) {
      return refuse('immutable-property', "a column's id is what its footer cells name, and never changes in place", { ...place, path: `${place.path}/columns/${index}/id` })
    }
    return { ...table, columns: replacedAt(table.columns, index, patched<TableColumn>(table.columns[index] as TableColumn, patch)) }
  })
}

/** Sets the table's one grouping level, or removes it with `null` -- as a patch removes, so a removal survives JSON. */
export function setGroup(report: ReportDefinition, tableId: string, group: TableGroup | null): CommandOutcome {
  return withTable(report, tableId, (table) => {
    const { group: _old, ...rest } = table
    return group === null ? rest : { ...rest, group }
  })
}

/** Sets the table's sort keys, or removes them with `null`. */
export function setSort(report: ReportDefinition, tableId: string, sort: readonly SortKey[] | null): CommandOutcome {
  return withTable(report, tableId, (table) => {
    const { sort: _old, ...rest } = table
    return sort === null ? rest : { ...rest, sort }
  })
}

/** The footer rows a table has in `which`, where they are, and how to give it others; or a refusal. */
function footerOf(table: TableComponent, which: FooterRows, place: TablePlace) {
  if (which === 'totals') {
    return { rows: table.totals ?? [], at: { ...place, path: `${place.path}/totals` }, set: (totals: readonly TableFooterRow[]): TableComponent => ({ ...table, totals }) }
  }
  const group = table.group
  if (group === undefined) return refuse('not-found', `${quote(place.componentId)} has no group, so it has no group footer`, { ...place, path: `${place.path}/group` })
  return {
    rows: group.footer,
    at: { ...place, path: `${place.path}/group/footer` },
    set: (footer: readonly TableFooterRow[]): TableComponent => ({ ...table, group: { ...group, footer } }),
  }
}

/** The footer rows in `which` changed by `change`, which is told where they are. */
function withFooter(
  report: ReportDefinition,
  tableId: string,
  which: FooterRows,
  change: (rows: readonly TableFooterRow[], at: TablePlace) => readonly TableFooterRow[] | Refusal,
): CommandOutcome {
  return withTable(report, tableId, (table, place) => {
    const footer = footerOf(table, which, place)
    if (isRefusal(footer)) return footer
    const rows = change(footer.rows, footer.at)
    return isRefusal(rows) ? rows : footer.set(rows)
  })
}

/** A refusal unless `index` is a row of `rows`. */
const checkRow = (rows: readonly TableFooterRow[], index: number, at: Place): Refusal | undefined => checkIndex(index, rows.length - 1, `${rows.length} footer rows`, at)

export function insertFooterRow(report: ReportDefinition, tableId: string, which: FooterRows, index: number, row: TableFooterRow): CommandOutcome {
  return withFooter(report, tableId, which, (rows, at) => checkIndex(index, rows.length, `${rows.length} footer rows`, at) ?? insertedAt(rows, index, row))
}

export function removeFooterRow(report: ReportDefinition, tableId: string, which: FooterRows, index: number): CommandOutcome {
  return withFooter(report, tableId, which, (rows, at) => checkRow(rows, index, at) ?? removedAt(rows, index))
}

/** Moves the footer row at `from` so that it ends at `to`. */
export function moveFooterRow(report: ReportDefinition, tableId: string, which: FooterRows, from: number, to: number): CommandOutcome {
  return withFooter(report, tableId, which, (rows, at) => checkRow(rows, from, at) ?? checkRow(rows, to, at) ?? movedTo(rows, from, to))
}

/** Changes a footer row: its cells as a whole, or its style. */
export function updateFooterRow(report: ReportDefinition, tableId: string, which: FooterRows, index: number, patch: Patch<TableFooterRow>): CommandOutcome {
  return withFooter(report, tableId, which, (rows, at) => checkRow(rows, index, at) ?? replacedAt(rows, index, patched(rows[index] as TableFooterRow, patch)))
}

/** Puts the cell of `cell.column` into a footer row: replacing that column's cell where it is, or appending it. */
export function putFooterCell(report: ReportDefinition, tableId: string, which: FooterRows, rowIndex: number, cell: TableFooterCell): CommandOutcome {
  return withFooter(report, tableId, which, (rows, at) => {
    const outside = checkRow(rows, rowIndex, at)
    if (outside !== undefined) return outside
    const row = rows[rowIndex] as TableFooterRow
    const index = row.cells.findIndex(({ column }) => column === cell.column)
    return replacedAt(rows, rowIndex, { ...row, cells: index === -1 ? [...row.cells, cell] : replacedAt(row.cells, index, cell) })
  })
}

export function removeFooterCell(report: ReportDefinition, tableId: string, which: FooterRows, rowIndex: number, columnId: string): CommandOutcome {
  return withFooter(report, tableId, which, (rows, at) => {
    const outside = checkRow(rows, rowIndex, at)
    if (outside !== undefined) return outside
    const row = rows[rowIndex] as TableFooterRow
    const index = row.cells.findIndex(({ column }) => column === columnId)
    if (index === -1) return refuse('not-found', `this footer row has no cell for column ${quote(columnId)}`, { ...at, path: `${at.path}/${rowIndex}/cells` })
    return replacedAt(rows, rowIndex, { ...row, cells: removedAt(row.cells, index) })
  })
}
