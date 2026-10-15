/**
 * A selection as the report has it: the component and where it stands, or
 * the table column and its position -- found once, so the edits and the
 * properties pane act on one reading of it.
 */
import { locationOf } from '@formancy/report-core'
import type { Location } from '@formancy/report-core'
import { componentAt } from '@formancy/report-spec'
import type { Component, ReportDefinition, TableColumn, TableComponent } from '@formancy/report-spec'
import type { Selection } from './model.js'

/** A selection found in the report: a component and where it stands, or a table's column and its position. */
export type Selected =
  | { readonly kind: 'component'; readonly component: Component; readonly path: string; readonly location: Location }
  | { readonly kind: 'column'; readonly table: TableComponent; readonly column: TableColumn; readonly index: number; readonly path: string }

/** `selection` as the report has it, or undefined when the report has no such thing. */
export function selected(report: ReportDefinition, selection: Selection): Selected | undefined {
  const found = componentAt(report, selection.id)
  if (found === undefined) return undefined
  // Found above, so it stands somewhere.
  if (selection.column === undefined) return { kind: 'component', component: found.component, path: found.path, location: locationOf(report, selection.id) as Location }
  if (found.component.kind !== 'table') return undefined
  const index = found.component.columns.findIndex((column) => column.id === selection.column)
  const column = found.component.columns[index]
  return column === undefined ? undefined : { kind: 'column', table: found.component, column, index, path: `${found.path}/columns/${index}` }
}
