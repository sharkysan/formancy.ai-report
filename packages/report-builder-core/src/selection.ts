/**
 * A selection as the report has it: the component and where it stands, the
 * table column and its position, or the part of the report's own level and
 * where it is -- found once, so the edits and the properties pane act on one
 * reading of it.
 */
import { locationOf } from '@formancy/report-core'
import type { Location } from '@formancy/report-core'
import { componentAt } from '@formancy/report-spec'
import type { Component, EInvoice, PaymentPart, ReportDefinition, TableColumn, TableComponent } from '@formancy/report-spec'
import type { ReportLevelPart, Selection } from './model.js'

/** A part of the report's own level found in it: its payment part, a Swiss QR-bill, or its e-invoice, and where it is. */
export type SelectedPart =
  | { readonly kind: 'part'; readonly part: 'paymentPart'; readonly bill: PaymentPart; readonly path: '/paymentPart' }
  | { readonly kind: 'part'; readonly part: 'eInvoice'; readonly invoice: EInvoice; readonly path: '/eInvoice' }

/**
 * What each part of the report's own level is in a report, or undefined
 * where it has none: a table over every part, so that a part added to
 * `REPORT_LEVEL_PARTS` without its reading does not compile, and one that
 * is no part is told by not being in it.
 */
const HELD: { readonly [P in ReportLevelPart]: (report: ReportDefinition) => Extract<SelectedPart, { readonly part: P }> | undefined } = {
  paymentPart: (report) => (report.paymentPart === undefined ? undefined : { kind: 'part', part: 'paymentPart', bill: report.paymentPart, path: '/paymentPart' }),
  eInvoice: (report) => (report.eInvoice === undefined ? undefined : { kind: 'part', part: 'eInvoice', invoice: report.eInvoice, path: '/eInvoice' }),
}

/** Whether `part`, from a caller tsc may never have seen -- a builder in plain JavaScript -- is a part of the report's own level. */
export function isReportLevelPart(part: unknown): part is ReportLevelPart {
  return typeof part === 'string' && Object.hasOwn(HELD, part)
}

/** A selection found in the report: a component and where it stands, a table's column and its position, or a part of the report's own level. */
export type Selected =
  | { readonly kind: 'component'; readonly component: Component; readonly path: string; readonly location: Location }
  | { readonly kind: 'column'; readonly table: TableComponent; readonly column: TableColumn; readonly index: number; readonly path: string }
  | SelectedPart

/** `selection` as the report has it, or undefined when the report has no such thing. */
export function selected(report: ReportDefinition, selection: Selection): Selected | undefined {
  if ('part' in selection) return isReportLevelPart(selection.part) ? HELD[selection.part](report) : undefined
  const found = componentAt(report, selection.id)
  if (found === undefined) return undefined
  // Found above, so it stands somewhere.
  if (selection.column === undefined) return { kind: 'component', component: found.component, path: found.path, location: locationOf(report, selection.id) as Location }
  if (found.component.kind !== 'table') return undefined
  const index = found.component.columns.findIndex((column) => column.id === selection.column)
  const column = found.component.columns[index]
  return column === undefined ? undefined : { kind: 'column', table: found.component, column, index, path: `${found.path}/columns/${index}` }
}
