/**
 * Values: an expression, the scopes it is read in and the names it reads in
 * each; how a value is displayed; and the runs of text a paragraph, a table
 * cell, a footer cell and a group header are made of.
 */
import type { FieldRef } from './data.js'

/** A CEL expression, compiled and bounded by the runtime, not here. */
export interface Expression {
  readonly cel: string
}

/**
 * Where a value is read, which decides what it can name (plan 15's "current
 * row, group or report"): `row` in a table cell, once per detail row;
 * `group` in a group header or footer, once per group; `report` everywhere
 * else, the table's total rows included.
 */
export const VALUE_SCOPES = ['report', 'group', 'row'] as const
export type ValueScope = (typeof VALUE_SCOPES)[number]

/**
 * The names an expression reads in each scope, and nothing else: the
 * runtime binds exactly these. `params` maps parameter ids to values,
 * `header` the header dataset's fields, `row` the current detail row's,
 * `totals` each aggregate over every detail row, and `group` each aggregate
 * over the current group's rows and, as `GROUP_KEY`, the value the group
 * is keyed by.
 *
 * Whether an expression names only these is checked when the runtime
 * compiles it (plan 15's second level), not here: a second, partial CEL
 * parser would be a second place to disagree with the real one.
 */
export const EXPRESSION_NAMES: { readonly [S in ValueScope]: readonly string[] } = {
  report: ['params', 'header', 'totals'],
  group: ['params', 'header', 'totals', 'group'],
  row: ['params', 'header', 'totals', 'row'],
}

/**
 * The member of `group` that is the value the group is keyed by: in a group
 * header, `group.key` is the site a group of rows by site is for, of the
 * type of the field grouped by, and null for the group of rows without one.
 * An aggregate may not take the name (`reserved-id`), so `group.key` never
 * reads one.
 */
export const GROUP_KEY = 'key'

export const FORMAT_KINDS = ['number', 'currency', 'date', 'text'] as const
export type FormatKind = (typeof FORMAT_KINDS)[number]

export const DATE_STYLES = ['short', 'medium', 'long'] as const
export type DateStyle = (typeof DATE_STYLES)[number]

export const TEXT_TRANSFORMS = ['upper', 'lower'] as const
export type TextTransform = (typeof TEXT_TRANSFORMS)[number]

export interface NumberFormat {
  readonly kind: 'number'
  readonly scale: number
  readonly grouping: boolean
}

export const CURRENCY_SOURCE_KINDS = ['code', 'field', 'parameter'] as const
export type CurrencySourceKind = (typeof CURRENCY_SOURCE_KINDS)[number]

/** Which currency an amount is in: a code the template fixes, or a string field or parameter that supplies one per report or per row. */
export type CurrencySource =
  | { readonly kind: 'code'; /** ISO 4217, upper case. */ readonly code: string }
  | { readonly kind: 'field'; readonly field: FieldRef }
  | { readonly kind: 'parameter'; readonly parameter: string }

export interface CurrencyFormat {
  readonly kind: 'currency'
  readonly currency: CurrencySource
  readonly scale: number
}
export interface DateFormat {
  readonly kind: 'date'
  readonly style: DateStyle
}
export interface TextFormat {
  readonly kind: 'text'
  readonly transform?: TextTransform
}
/** How a value is displayed. Display only: calculation precision is the runtime's, with its declared rounding. */
export type Format = NumberFormat | CurrencyFormat | DateFormat | TextFormat

export interface TextInline {
  readonly kind: 'text'
  readonly text: string
}
export interface FieldInline {
  readonly kind: 'field'
  readonly field: FieldRef
  readonly format?: Format
}
export interface ParameterInline {
  readonly kind: 'parameter'
  readonly parameter: string
  readonly format?: Format
}
export interface ExpressionInline {
  readonly kind: 'expression'
  readonly expression: Expression
  readonly format?: Format
}

/** Whose rows an aggregate is taken over where it is printed: the current group's, or every detail row. */
export const AGGREGATE_SCOPES = ['group', 'report'] as const
export type AggregateScope = (typeof AGGREGATE_SCOPES)[number]

export interface AggregateInline {
  readonly kind: 'aggregate'
  /** An `AggregateDef` id. */
  readonly aggregate: string
  readonly over: AggregateScope
  readonly format?: Format
}
export interface PageNumberInline {
  readonly kind: 'pageNumber'
}
export interface PageCountInline {
  readonly kind: 'pageCount'
}

export const INLINE_KINDS = ['text', 'field', 'parameter', 'expression', 'aggregate', 'pageNumber', 'pageCount'] as const
export type InlineKind = (typeof INLINE_KINDS)[number]

/**
 * A run of text: literal, bound, computed, totalled or a page counter. The
 * one shape for a paragraph's runs, a table cell, a footer cell and a group
 * header. Null prints as nothing.
 */
export type Inline = TextInline | FieldInline | ParameterInline | ExpressionInline | AggregateInline | PageNumberInline | PageCountInline
