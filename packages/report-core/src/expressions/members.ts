/**
 * What an expression in a report can read: the names the format binds and
 * the members each holds, each with the type it is checked and bound as.
 *
 * The names are the format's: `EXPRESSION_NAMES` lists, for each scope, the
 * names the runtime binds (0007) -- `params`, `header` and `totals`
 * everywhere, `row` in a table's cells and in what an aggregate reads from
 * each row, `group` in a group's header and footer. Each holds members --
 * a parameter, a field, an aggregate -- read as `<name>.<id>`, and every
 * member is a single value, never a map.
 */
import type { DeclaredType } from '@formancy/expressions'
import type { AggregateFunction, DatasetContract, FieldType, ReportDefinition } from '@formancy/report-spec'

/**
 * The type an expression reads each readable field and parameter type as.
 *
 * - Exact numbers keep their exactness: an integer is `int`, a decimal
 *   `decimal`, never a double.
 * - A `date` and a `datetime` are read as their ISO strings. Neither has a
 *   zone, and a CEL timestamp is an instant: making one from a date would
 *   need a zone the report does not have, and `@formancy/expressions`
 *   refuses to guess one. Their ISO forms compare in calendar order.
 * - An `instant` has a zone, so it is a `timestamp`.
 * - An `image` is not readable: its value is an asset id, which is drawn,
 *   never printed or computed with (0007).
 */
export const EXPRESSION_TYPES: { readonly [T in Exclude<FieldType, 'image'>]: DeclaredType } = {
  string: 'string',
  integer: 'int',
  decimal: 'decimal',
  boolean: 'bool',
  date: 'string',
  datetime: 'string',
  instant: 'timestamp',
}

/**
 * A value an expression reads as `<name>.<member>`. `type` is the CEL type
 * it is bound as: `expressionValues` makes a value of it from what the data
 * holds. It is checked as that type too, unless it may be null: CEL has no
 * nullable scalars, so a member that may be null is checked as `dyn`, and
 * compared with null before it is used as anything else.
 */
export interface ExpressionMember {
  readonly type: DeclaredType
  readonly nullable: boolean
}

/** Every name the format binds, in some scope. A test holds this to the union of `EXPRESSION_NAMES`. */
export const SCOPE_NAMES = ['params', 'header', 'row', 'totals', 'group'] as const

export type ScopeName = (typeof SCOPE_NAMES)[number]

/** What each name holds in one report, member by member, in declaration order. */
export type Members = { readonly [N in ScopeName]: ReadonlyMap<string, ExpressionMember> }

/** The type a field of `type` is read as; undefined for an image, which is not read. */
export function readAs(type: FieldType | undefined): DeclaredType | undefined {
  return type === undefined || type === 'image' ? undefined : EXPRESSION_TYPES[type]
}

export function fieldsOf(dataset: DatasetContract | undefined): ReadonlyMap<string, ExpressionMember> {
  const members = new Map<string, ExpressionMember>()
  for (const field of dataset?.fields ?? []) {
    const type = readAs(field.type)
    if (type !== undefined) members.set(field.id, { type, nullable: field.nullable })
  }
  return members
}

export function parametersOf(report: ReportDefinition): ReadonlyMap<string, ExpressionMember> {
  return new Map(
    report.parameters.map((parameter) => [parameter.id, { type: EXPRESSION_TYPES[parameter.type], nullable: !parameter.required && parameter.default === undefined }]),
  )
}

/** The image fields of a dataset: drawn, and never read as a value. */
export function imagesOf(dataset: DatasetContract | undefined): ReadonlySet<string> {
  return new Set((dataset?.fields ?? []).filter(({ type }) => type === 'image').map(({ id }) => id))
}

/**
 * The types each function totals (0007), for an aggregate over an
 * expression; one over a field the validator has already checked. A sum and
 * an average take integers and decimals; a minimum and a maximum those,
 * instants, and dates and date-times as the ISO strings they are read as; a
 * count counts what is not null, whatever it is. `dyn` -- a value that may
 * be null -- is taken by all of them: what it holds is known only at render.
 */
export const TOTALS: { readonly [F in AggregateFunction]: ReadonlySet<string> | 'any' } = {
  count: 'any',
  sum: new Set(['int', 'decimal', 'dyn']),
  avg: new Set(['int', 'decimal', 'dyn']),
  min: new Set(['int', 'decimal', 'timestamp', 'string', 'dyn']),
  max: new Set(['int', 'decimal', 'timestamp', 'string', 'dyn']),
}

/**
 * What each function computes from what it reads (0007): a count is an
 * integer and an average a decimal; a sum, minimum or maximum is the type it
 * read, `dyn` when that is not known. Over no rows, a count and a sum are 0
 * and the others null.
 */
export const COMPUTES: { readonly [F in AggregateFunction]: (read: DeclaredType | undefined) => ExpressionMember } = {
  count: () => ({ type: 'int', nullable: false }),
  sum: (read) => ({ type: read ?? 'dyn', nullable: false }),
  avg: () => ({ type: 'decimal', nullable: true }),
  min: (read) => ({ type: read ?? 'dyn', nullable: true }),
  max: (read) => ({ type: read ?? 'dyn', nullable: true }),
}
