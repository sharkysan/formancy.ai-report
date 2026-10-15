/**
 * The table over the detail dataset, lowered to the rows it prints.
 *
 * Its rows are ordered and grouped by `sort-group.ts` (0007): the group's
 * key first, then the sort keys, ties in the provider's order. Then, in
 * that order:
 *
 * - for each group, one line across the table read in the group's scope,
 *   its rows, and its footer rows, whose aggregates are the group's;
 * - the totals rows, whose aggregates are over every row;
 * - with no detail rows, the table's empty text in their place, and its
 *   totals still printed: a count and a sum of nothing are 0.
 *
 * A column whose condition does not hold is left out, read once per report:
 * its header, every cell under it and its footer cells, and the fill columns
 * share its width. A table every column of which is hidden prints nothing.
 * Each detail cell is read in its row's scope, its column's style rules too;
 * every other row has one style.
 */
import type { TableColumn as ReportColumn, TableComponent, TableFooterRow } from '@formancy/report-spec'
import type { Table, TableRow, TextStyle } from './document.js'
import { runOf, textOfRuns } from './inlines.js'
import { groupScope, holds, reportScope, rowScope } from './render-context.js'
import type { Render, Scope } from './render-context.js'
import { orderTable } from './sort-group.js'
import type { OrderedRow } from './sort-group.js'
import { layered, styled } from './styles.js'

/** A column that prints, and where it stands in the report's list of the table's columns. */
interface Shown {
  readonly column: ReportColumn
  readonly index: number
}

/** What every row of one table is read with. */
interface Lowering {
  readonly render: Render
  readonly table: TableComponent
  readonly path: string
  readonly shown: readonly Shown[]
  /** The table's own style, laid under every row's. */
  readonly base: TextStyle | undefined
}

/** `style` as a row's: the table's under the named print style; absent when neither sets anything. */
function rowStyle(lowering: Lowering, style: string | undefined): { readonly style?: TextStyle } {
  const resolved = layered(lowering.base, style === undefined ? undefined : lowering.render.styles.get(style))
  return resolved === undefined ? {} : { style: resolved }
}

/** One detail row: each shown column's value and own style, read in the row's scope. */
function detailRow(lowering: Lowering, row: OrderedRow): TableRow {
  const { render, table, path } = lowering
  const scope = rowScope(render, render.totals.report, row)
  const cells = lowering.shown.map(({ column, index }) => {
    const run = runOf(render, scope, column.value, `${path}/columns/${index}/value`, { componentId: table.id, columnId: column.id })
    return run === undefined ? '' : textOfRuns([run])
  })
  const own = lowering.shown.map(({ column, index }) => styled(render, scope, undefined, column.style, column.styleWhen, `${path}/columns/${index}/styleWhen`))
  const cellStyles = own.some((style) => style !== undefined) ? { cellStyles: own.map((style) => (style === undefined ? null : (layered(lowering.base, style) as TextStyle))) } : {}
  return { kind: 'detail', cells, ...(lowering.base === undefined ? {} : { style: lowering.base }), ...cellStyles }
}

/** Footer rows read in `scope`: under a group, or under the table. A shown column without a cell in a row prints nothing there. */
function footerRows(lowering: Lowering, rows: readonly TableFooterRow[] | undefined, at: string, kind: 'groupFooter' | 'total', scope: Scope): TableRow[] {
  const { render, table } = lowering
  return (rows ?? []).map((row, rowIndex) => {
    const cells = lowering.shown.map(({ column }) => {
      const cellIndex = row.cells.findIndex((cell) => cell.column === column.id)
      const cell = row.cells[cellIndex]
      if (cell === undefined) return ''
      const run = runOf(render, scope, cell.value, `${at}/${rowIndex}/cells/${cellIndex}/value`, { componentId: table.id, columnId: column.id })
      return run === undefined ? '' : textOfRuns([run])
    })
    return { kind, cells, ...rowStyle(lowering, row.style) }
  })
}

/** The rows of a table that groups: per group, its header line, its rows and its footer. */
function groupedRows(lowering: Lowering, groups: NonNullable<ReturnType<typeof orderTable>['groups']>): TableRow[] {
  const { render, table, path } = lowering
  const group = table.group as NonNullable<TableComponent['group']>
  const rows: TableRow[] = []
  for (const each of groups) {
    if (render.problems.full) break
    const scope = groupScope(render, each, render.totals.over(each.rows), group.by.field)
    const runs = group.header.map((inline, index) => runOf(render, scope, inline, `${path}/group/header/${index}`, { componentId: table.id }))
    rows.push({ kind: 'groupHeader', cells: [textOfRuns(runs.filter((run) => run !== undefined))], across: true, ...rowStyle(lowering, group.headerStyle) })
    for (const row of each.rows) rows.push(detailRow(lowering, row))
    rows.push(...footerRows(lowering, group.footer, `${path}/group/footer`, 'groupFooter', scope))
  }
  return rows
}

/**
 * `table`, at `path`, as the document's table, `base` its own resolved
 * style; undefined when every column is hidden. A value that could not be
 * read prints nothing here, and is recorded as an error, so the report is
 * refused.
 */
export function tableBlock(render: Render, table: TableComponent, path: string, base: TextStyle | undefined): Table | undefined {
  const scope = reportScope(render, render.totals.report)
  const shown = table.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column, index }) => column.visibleWhen === undefined || holds(render, scope, `${path}/columns/${index}/visibleWhen/cel`) === true)
  if (shown.length === 0) return undefined
  const lowering: Lowering = { render, table, path, shown, base }
  const ordered = orderTable(render.report, table, render.data.detail)
  const rows: TableRow[] = []
  if (ordered.groups !== undefined) rows.push(...groupedRows(lowering, ordered.groups))
  else {
    for (const row of ordered.rows) {
      if (render.problems.full) break
      rows.push(detailRow(lowering, row))
    }
  }
  rows.push(...footerRows(lowering, table.totals, `${path}/totals`, 'total', scope))
  const headerStyle = layered(base, table.headerStyle === undefined ? undefined : render.styles.get(table.headerStyle))
  return {
    kind: 'table',
    id: table.id,
    columns: shown.map(({ column }) => ({ width: column.width, align: column.align })),
    header: shown.map(({ column }) => column.header),
    ...(headerStyle === undefined ? {} : { headerStyle }),
    rows,
    emptyText: table.emptyText,
  }
}
