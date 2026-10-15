/**
 * The order of a table's rows and its groups, decided once, here (0007).
 *
 * Rows are ordered by the group's key first, in its direction, then by each
 * sort key, each compared as its type: decimals by value, integers as
 * BigInt, dates and times in calendar order, text as the report's language
 * sorts it, false before true. Nulls -- and a field a preview lacks -- go
 * last whichever way a key runs, so an empty cell never lands among the
 * values. Rows whose keys are all equal keep the provider's order: the
 * row's index is the last key, so the comparator is a total order and the
 * result rests on it alone. `Array.prototype.sort` has been stable since
 * ES2019, which by itself keeps that order too, so no test can tell the two
 * apart; the index is there so that nothing depends on the algorithm.
 *
 * Text the collator holds equal but spelled differently -- é composed and
 * decomposed -- is ordered by code unit after the collator, so that rows
 * with identical keys always stand together and a group never splits around
 * another spelling. Collation is the engine's ICU's, and differs between
 * ICU versions as formatting does.
 */
import { compareDecimal } from '@formancy/expressions'
import type { Decimal } from '@formancy/expressions'
import type { ReportDefinition, SortDirection, TableComponent } from '@formancy/report-spec'
import type { CheckedRecord } from './data.js'
import type { PrintableType } from './format.js'
import type { CheckedValue } from './values.js'

/** One key rows are ordered by: a detail field, its type, and its direction. */
export interface OrderKey {
  readonly field: string
  readonly type: PrintableType
  readonly direction: SortDirection
}

/** A detail row in its place: the record, and its index in the order the provider gave the rows. */
export interface OrderedRow {
  readonly index: number
  readonly record: CheckedRecord
}

/** One group: its key, as its first row spells it, or null; then its rows, in order. */
export interface RowGroup {
  readonly key: CheckedValue | null
  readonly rows: readonly OrderedRow[]
}

/** A table's rows in order and, when it groups, its groups in order. */
export interface OrderedTable {
  readonly rows: readonly OrderedRow[]
  readonly groups?: readonly RowGroup[]
}

/** A value made comparable with `<` -- or, for text, with the collator -- for one key column. */
type Comparable = string | bigint | boolean

/**
 * A date and time with its fraction of a second at nine digits, without a
 * zone: held without trailing zeros, '10:00:00.5' and '10:00:00' differ in
 * length, and as they stand '10:00:00.5Z' sorts before '10:00:00Z'.
 */
export function fixedWidth(value: string): string {
  const local = value.endsWith('Z') ? value.slice(0, -1) : value
  return `${local.slice(0, 19)}.${local.slice(20).padEnd(9, '0')}`
}

/** The values of `key` in every row, made comparable once; null for a null or missing one. */
function column(rows: readonly CheckedRecord[], key: OrderKey): (Comparable | null)[] {
  const values = rows.map((record) => record[key.field] ?? null)
  switch (key.type) {
    case 'decimal': {
      // Every decimal of the column at one scale, so each comparison is one of integers.
      const decimals = values as (Decimal | null)[]
      const scale = Math.max(0, ...decimals.map((value) => value?.scale ?? 0))
      return decimals.map((value) => (value === null ? null : value.units * 10n ** BigInt(scale - value.scale)))
    }
    case 'datetime':
    case 'instant':
      return (values as (string | null)[]).map((value) => (value === null ? null : fixedWidth(value)))
    default:
      return values as (Comparable | null)[]
  }
}

/** -1, 0 or 1 for two values of one comparable column. */
function compared(type: PrintableType, a: Comparable, b: Comparable, collator: Intl.Collator): number {
  if (type === 'string') {
    const order = collator.compare(a as string, b as string)
    if (order !== 0) return order
  }
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * `rows` in the order `keys` give, each key applied only among rows the keys
 * before it hold equal, with text compared as `locale` sorts it -- a locale
 * `supportedLocale` accepts. Ties keep the provider's order.
 */
export function orderRows(rows: readonly CheckedRecord[], keys: readonly OrderKey[], locale: string): OrderedRow[] {
  const collator = new Intl.Collator(locale, { usage: 'sort' })
  const columns = keys.map((key) => column(rows, key))
  const order = rows.map((_, index) => index)
  order.sort((left, right) => {
    for (const [at, key] of keys.entries()) {
      const values = columns[at] as (Comparable | null)[]
      const [a, b] = [values[left] as Comparable | null, values[right] as Comparable | null]
      if (a === null || b === null) {
        if (a !== b) return a === null ? 1 : -1
        continue
      }
      const found = compared(key.type, a, b, collator)
      if (found !== 0) return key.direction === 'asc' ? found : -found
    }
    return left - right
  })
  return order.map((index) => Object.freeze({ index, record: rows[index] as CheckedRecord }))
}

/** Whether two group keys are one: decimals by value, everything else as held, and null with null. */
function sameKey(type: PrintableType, a: CheckedValue | null, b: CheckedValue | null): boolean {
  if (a === null || b === null) return a === b
  return type === 'decimal' ? compareDecimal(a as Decimal, b as Decimal) === 0 : a === b
}

/**
 * Rows already in order, as consecutive groups of equal keys: the groups in
 * the order of their rows, each keyed by its first row's value. A missing
 * value groups with null.
 */
export function groupRows(rows: readonly OrderedRow[], by: { readonly field: string; readonly type: PrintableType }): RowGroup[] {
  const groups: { key: CheckedValue | null; rows: OrderedRow[] }[] = []
  for (const row of rows) {
    const value = row.record[by.field] ?? null
    const last = groups.at(-1)
    if (last !== undefined && sameKey(by.type, last.key, value)) last.rows.push(row)
    else groups.push({ key: value, rows: [row] })
  }
  return groups.map((group) => Object.freeze({ key: group.key, rows: Object.freeze(group.rows) }))
}

/**
 * The keys `table` orders its rows by: its group's key first, then its sort
 * keys (0007), each typed by the report's detail contract. Throws a
 * RangeError for a key on a field that has no order -- an image, or one the
 * contract lacks -- which report-spec refuses.
 */
export function orderKeys(report: ReportDefinition, table: TableComponent): OrderKey[] {
  const types = new Map((report.datasets.detail?.fields ?? []).map(({ id, type }) => [id, type]))
  const typed = (field: string, direction: SortDirection): OrderKey => {
    const type = types.get(field)
    if (type === undefined || type === 'image') throw new RangeError(`detail field ${field} has no order to sort or group by`)
    return { field, type, direction }
  }
  const group = table.group === undefined ? [] : [typed(table.group.by.field, table.group.direction)]
  return [...group, ...(table.sort ?? []).map(({ field, direction }) => typed(field.field, direction))]
}

/** `detail` -- the report's checked detail rows -- in `table`'s order, and in its groups when it has one. */
export function orderTable(report: ReportDefinition, table: TableComponent, detail: readonly CheckedRecord[]): OrderedTable {
  const keys = orderKeys(report, table)
  const rows = orderRows(detail, keys, report.locale)
  if (table.group === undefined) return { rows }
  return { rows, groups: groupRows(rows, keys[0] as OrderKey) }
}
