/**
 * The totals a report declares over its detail dataset: what each reads
 * from a row, its function and its declared rounding. The runtime computes
 * each exactly, once.
 */
import type { FieldRef } from './data.js'
import type { Expression } from './values.js'

/** What an aggregate reads from each detail row: a detail field, or an expression over the row. */
export type RowValue = { readonly kind: 'field'; readonly field: FieldRef } | { readonly kind: 'expression'; readonly expression: Expression }

export const AGGREGATE_FUNCTIONS = ['sum', 'count', 'min', 'max', 'avg'] as const
export type AggregateFunction = (typeof AGGREGATE_FUNCTIONS)[number]

export const ROUNDING_MODES = ['half-away-from-zero', 'half-even'] as const
export type RoundingMode = (typeof ROUNDING_MODES)[number]

/**
 * Declared rounding: an exact decimal is rounded once, by a named rule,
 * never by a float. To a multiple of `increment` when it is given -- '0.05'
 * for Swiss cash rounding -- and otherwise to `scale` places; ties go by
 * `mode` either way.
 */
export interface Rounding {
  readonly scale: number
  readonly mode: RoundingMode
  /** An exact decimal more than 0, with no more than `scale` places. */
  readonly increment?: string
}

/**
 * A total the report computes over the detail dataset, exactly, once, in
 * the runtime. Declared once and printed by id, over the current group in a
 * group header or footer and over every detail row anywhere else.
 *
 * - `count` without `of` counts rows; with it, the rows where it is not null.
 * - `sum` and `avg` take integers and decimals; `min` and `max` those and
 *   the three temporal types. Each skips nulls.
 * - Over no values, `count` and `sum` are 0, and `min`, `max` and `avg` are
 *   null, which prints as nothing.
 * - `avg` is rarely exact, so it declares its rounding.
 */
export interface AggregateDef {
  /** A field key: what an expression reads it as, `totals.<id>` or `group.<id>`. Never `GROUP_KEY`, which `group` holds already. */
  readonly id: string
  readonly fn: AggregateFunction
  /** Absent only for count. */
  readonly of?: RowValue
  readonly rounding?: Rounding
}
