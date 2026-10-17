/**
 * What one resolution knows while it lowers a report, and the three scopes
 * a value is read in (0007): the report, a group of rows, one detail row.
 *
 * A scope is the values an expression is handed -- `params`, `header`,
 * `totals`, and `group` or `row` where there is one -- and where a currency
 * format finds a currency. Every expression is evaluated through `valueOf`
 * or `holds`, so an evaluation that fails is an error in one place, and a
 * preview that lacks a field degrades in one place: what reads it prints
 * nothing, and a condition over it does not hold, each said once as a
 * warning. In a final render a missing field never gets this far: the data
 * check refuses it.
 *
 * A code is the one place a value that prints as nothing is refused: in a
 * final render, a run whose value is null in a QR code's content or a
 * QR-bill's or an EPC QR code's text (`joinedText` in `inlines.ts`), and a
 * QR code's content that prints nothing at all. A preview encodes them as they resolve, as a
 * paragraph prints them.
 *
 * A report that is an e-invoice reads three more names wherever `totals`
 * is read -- `invoice`, `vatBasis` and `vatAmount` -- once its totals are
 * computed (`lower-e-invoice.ts`), before anything is lowered.
 */
import type { Decimal } from '@formancy/expressions'
import type { ExpressionValues } from '@formancy/report-core'
import type { FieldRef, FieldType, ParameterType, ReportDefinition } from '@formancy/report-spec'
import type { CheckedData, CheckedRecord } from './data.js'
import type { TextStyle } from './document.js'
import type { ReportExpressions } from './evaluate.js'
import type { CurrencyScope, Formatter, TypedValue } from './format.js'
import type { CheckedParameters } from './parameters.js'
import { fromEvaluation } from './resolve-errors.js'
import type { Problems } from './resolve-errors.js'
import type { OrderedRow, RowGroup } from './sort-group.js'
import type { ImageValue } from './values.js'

/** An approved asset, named as report-spec names one: by id, pinned by digest. */
export interface ImageRef {
  readonly asset: string
  readonly digest: string
}

/** What the host holds for an approved asset: its bytes, already fetched, and their media type. */
export interface ImageBytes {
  readonly mediaType: string
  readonly bytes: Uint8Array
}

/**
 * The host's lookup of an approved asset's bytes by its id and digest, or
 * undefined when it has none. Never an address: the runtime fetches nothing.
 */
export type ImageResolver = (ref: ImageRef) => ImageBytes | undefined

/** Each aggregate's value over some rows, by id: a typed value, or null where it has none. */
export type AggregateValues = ReadonlyMap<string, TypedValue | null>

/** The totals of one render: each aggregate over every row, and the same over any group of them. */
export interface Totals {
  readonly report: AggregateValues
  over(rows: readonly OrderedRow[]): AggregateValues
}

/**
 * What a render that is an e-invoice computed before it lowered anything
 * (`lower-e-invoice.ts`), for lowering to read.
 */
export interface InvoiceReads {
  /** What `invoice`, `vatBasis` and `vatAmount` hold. */
  readonly names: ExpressionValues
  /**
   * Each value a column that prints a term of each line gave, by the path
   * of the column's value, one for each detail row by its index in the
   * data: what the table prints, so that it prints what the XML holds.
   */
  readonly columns: ReadonlyMap<string, readonly (TypedValue | null)[]>
  /** What a payment code printed with the e-invoice may ask for: the amount due (BT-115), and the payment account (BT-84) once its rule took it, undefined where none did. */
  readonly payable: { readonly amount: Decimal; readonly account: string | undefined }
}

/** One resolution's inputs, checked, and what it collects. */
export interface Render {
  /** The copy validation read. */
  readonly report: ReportDefinition
  readonly expressions: ReportExpressions
  readonly formatter: Formatter
  readonly params: CheckedParameters
  readonly data: CheckedData
  readonly problems: Problems
  readonly preview: boolean
  readonly images: ImageResolver | undefined
  /** Each print style, by id, as the document's style. */
  readonly styles: ReadonlyMap<string, TextStyle>
  readonly totals: Totals
  /** What the e-invoice computed before lowering, where the report is one. */
  readonly invoice?: InvoiceReads
}

/** Where a value is read: what its expressions are handed, where its currency comes from, and what an error there names. */
export interface Scope {
  readonly values: ExpressionValues
  readonly currency: CurrencyScope
  /** The current group's aggregates, in a group's header and footer. */
  readonly group?: AggregateValues
  /** The record a detail field is read from: the current row, or a group's first row, whose key every row of the group shares. */
  readonly record?: CheckedRecord
  /** The current row's index in the data as the provider gave it, for an error to name. */
  readonly row?: number
}

/** Each aggregate's value as an expression is handed it: the typed value's own, or null. */
function raw(values: AggregateValues): Record<string, unknown> {
  return Object.fromEntries([...values].map(([id, value]) => [id, value === null ? null : value.value]))
}

/** The header record, or none when the report declares no header dataset. */
function headerOf(render: Pick<Render, 'data'>): CheckedRecord {
  return render.data.header ?? {}
}

/** The e-invoice's names, read wherever `totals` is, once they are computed; none in a report that is no e-invoice. */
function invoiceNames(render: Pick<Render, 'invoice'>): ExpressionValues {
  return render.invoice?.names ?? {}
}

export function reportScope(render: Pick<Render, 'params' | 'data' | 'invoice'>, totals: AggregateValues): Scope {
  const header = headerOf(render)
  return { values: { params: render.params, header, totals: raw(totals), ...invoiceNames(render) }, currency: { params: render.params, header } }
}

/**
 * A group's header and footer: the report's values, and the group's
 * aggregates and key as `group`. `by` is the field grouped by; where a
 * preview's rows lack it the key is missing, as the field is, not null.
 */
export function groupScope(render: Render, group: RowGroup, aggregates: AggregateValues, by: string): Scope {
  const record = (group.rows[0] as OrderedRow).record
  const header = headerOf(render)
  const key = Object.hasOwn(record, by) ? { key: group.key } : {}
  return {
    values: { params: render.params, header, totals: raw(render.totals.report), group: { ...raw(aggregates), ...key }, ...invoiceNames(render) },
    currency: { params: render.params, header, row: record },
    group: aggregates,
    record,
  }
}

/** One detail row: the report's values, and the row's as `row`. */
export function rowScope(render: Pick<Render, 'params' | 'data' | 'invoice'>, totals: AggregateValues, row: OrderedRow): Scope {
  const header = headerOf(render)
  return {
    values: { params: render.params, header, totals: raw(totals), row: row.record, ...invoiceNames(render) },
    currency: { params: render.params, header, row: row.record },
    record: row.record,
    row: row.index,
  }
}

/** A failed evaluation: an error, or in a preview a value the data lacks, which is a warning. Returns whether it was only a warning. */
function failed(render: Pick<Render, 'problems' | 'preview'>, outcome: { readonly error: Parameters<typeof fromEvaluation>[0] }): boolean {
  if (render.preview && outcome.error.code === 'missing-value') {
    // Said once for the expression, naming the first row, not once per row: the data check has already said which field is missing.
    const error = fromEvaluation(outcome.error)
    render.problems.warn({ ...error, message: `${error.message}; this preview prints nothing for it` })
    return true
  }
  render.problems.error(fromEvaluation(outcome.error))
  return false
}

/** The value of the expression whose `cel` is at `path`, read in `scope`; null for none, undefined when it failed and the failure is recorded. */
export function valueOf(render: Pick<Render, 'expressions' | 'problems' | 'preview'>, scope: Scope, path: string): TypedValue | null | undefined {
  const outcome = render.expressions.evaluate(path, scope.values, scope.row)
  if (outcome.ok) return outcome.value
  return failed(render, outcome) ? null : undefined
}

/** Whether the condition whose `cel` is at `path` holds in `scope`; undefined when it failed and the failure is recorded as an error. */
export function holds(render: Pick<Render, 'expressions' | 'problems' | 'preview'>, scope: Scope, path: string): boolean | undefined {
  const outcome = render.expressions.condition(path, scope.values, scope.row)
  if (outcome.ok) return outcome.value
  return failed(render, outcome) ? false : undefined
}

/** The type the report's contract gives `ref`'s field; the validator has checked that it declares one. */
export function fieldType(report: ReportDefinition, ref: FieldRef): FieldType {
  return report.datasets[ref.dataset]?.fields.find(({ id }) => id === ref.field)?.type as FieldType
}

export function parameterType(report: ReportDefinition, parameter: string): ParameterType {
  return report.parameters.find(({ id }) => id === parameter)?.type as ParameterType
}

/**
 * The value of `ref`, typed by its contract: a header field's from the
 * header, a detail field's from `record`. Null where it is null, and where
 * a preview's data lacks it, which the data check has already warned of. An
 * image field is drawn, never printed (0007), and reads as null here.
 */
export function fieldValue(render: Pick<Render, 'report' | 'data'>, record: CheckedRecord | undefined, ref: FieldRef): TypedValue | null {
  const value = (ref.dataset === 'header' ? render.data.header : record)?.[ref.field] ?? null
  const type = fieldType(render.report, ref)
  if (value === null || type === 'image') return null
  return { type, value } as TypedValue
}

/** An image field's value in the header: an approved asset, or null when there is none to draw. */
export function imageValue(render: Pick<Render, 'data'>, ref: FieldRef): ImageValue | null {
  return (render.data.header?.[ref.field] as ImageValue | null | undefined) ?? null
}
