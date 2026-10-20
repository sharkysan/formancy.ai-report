/**
 * The table over the report's one detail dataset: its columns, the keys it
 * sorts by, its one level of grouping and the rows under a group or the
 * table that total them.
 */
import type { ComponentBase, Width } from './components.js'
import type { FieldRef } from './data.js'
import type { Alignment, StyleRule } from './styles.js'
import type { Expression, Inline } from './values.js'

export const SORT_DIRECTIONS = ['asc', 'desc'] as const
export type SortDirection = (typeof SORT_DIRECTIONS)[number]

export interface SortKey {
  /** A detail field. */
  readonly field: FieldRef
  readonly direction: SortDirection
}

export interface TableColumn {
  /** Unique within its table. */
  readonly id: string
  readonly header: string
  readonly width: Width
  readonly align: Alignment
  /** Read once per detail row. */
  readonly value: Inline
  /** Read once per report: a hidden column gives its width to the fill columns, and its footer cells hide with it. */
  readonly visibleWhen?: Expression
  readonly style?: string
  /** Read once per detail row. */
  readonly styleWhen?: readonly StyleRule[]
}

export interface TableFooterCell {
  /** A column id of the same table. */
  readonly column: string
  readonly value: Inline
}

/** A row under a group or under the table: a subtotal, a tax line, a total. */
export interface TableFooterRow {
  readonly cells: readonly TableFooterCell[]
  readonly style?: string
}

/**
 * One grouping level, the only one version 0 has. Rows are ordered by the
 * group's key first, then by the table's sort keys; rows whose keys are all
 * equal keep the order the provider gave them.
 */
export interface TableGroup {
  /** A detail field. */
  readonly by: FieldRef
  readonly direction: SortDirection
  /** One line across the table, read once per group. */
  readonly header: readonly Inline[]
  readonly headerStyle?: string
  readonly footer: readonly TableFooterRow[]
}

/** The table over the report's one detail dataset. Its header repeats on every page; version 0 has no other choice. */
export interface TableComponent extends ComponentBase {
  readonly kind: 'table'
  readonly dataset: 'detail'
  readonly columns: readonly TableColumn[]
  readonly headerStyle?: string
  readonly sort?: readonly SortKey[]
  readonly group?: TableGroup
  readonly totals?: readonly TableFooterRow[]
  readonly emptyText: string
  readonly repeatHeader: true
}
