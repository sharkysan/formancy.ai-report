/**
 * The data a report is rendered from, and the check that admits it.
 *
 * A host hands over one envelope (plan 13.2): one header record and one
 * primary detail list for version 0, with what the provider says about
 * them -- how many rows it captured against what cap, and how consistent
 * the capture is. `checkData` holds every value to the report's dataset
 * contracts before anything reads it, and refuses rather than repairs:
 *
 * - **Types are the contract's.** Each value is read as its field's type
 *   (`values.ts`), exact numbers as strings and never through a JavaScript
 *   number, and held as the runtime computes with it.
 * - **Null is not missing.** Null is a value where the contract allows it,
 *   and prints as nothing. A field the data lacks altogether is an error in
 *   a final render, never an empty cell (0007); a preview, which may run on
 *   a sample, warns once per field and leaves it missing.
 * - **Data minimisation.** A field, or a dataset, the report does not
 *   declare is refused: a report never carries what it does not print, so
 *   nothing it was not written to read rides along into a render, a cache
 *   or a log.
 * - **No silent truncation.** A final render prints every row or none: data
 *   the provider calls incomplete is refused, and so is a captured count
 *   that disagrees with the rows given.
 * - **Bounded.** The rows and every string are bounded before they are
 *   read, and so is the error list; once it is full, nothing more is read.
 *
 * What is held afterwards is a frozen copy, read once from the host's
 * objects, which no later change to them reaches.
 */
import { MAX_KEY_LENGTH } from '@formancy/report-spec'
import type { DatasetContract, DatasetRole, ReportDefinition } from '@formancy/report-spec'
import { at, DataFindings, isLongKey, keyAt } from './data-errors.js'
import type { DataError, DataErrorCode } from './data-errors.js'
import { readList, readRecord, UNREADABLE } from './input.js'
import type { ContainerCode } from './input.js'
import { readValue } from './values.js'
import type { CheckedValue } from './values.js'

/**
 * How consistent the provider's capture is (plan 13.2): captured by the
 * host, read in one database snapshot, or explicitly neither -- the label
 * Formancy Data 0.1.0's records carry, read at different moments.
 */
export const CONSISTENCY_MODES = ['host-captured', 'transaction-snapshot', 'best-effort'] as const
export type Consistency = (typeof CONSISTENCY_MODES)[number]

/** A final render prints the report; a preview shows an author a sample while they work, and says what it lacks. */
export const DATA_MODES = ['final', 'preview'] as const
export type DataMode = (typeof DATA_MODES)[number]

/**
 * Detail rows in one render. Chosen, not derived: a report is read by a
 * person, and at the renderer trial's 48 rows a page (`docs/renderer-trial.md`,
 * 15 October 2026) this is over 2,000 pages, which pdfmake took more than 35
 * seconds to lay out at the 1,829 ms per hundred pages measured there. The
 * PDF's page bound refuses most such reports first; this bounds the
 * runtime's own work -- checking, sorting, totalling -- before a page is
 * laid out. At the bound, checking rows of the test sample report's nine
 * fields took a median of 1.5 seconds, and ordering them by site and SKU 0.5
 * (five warm runs under vitest, Node 24.21, an Intel i9-10900K, 15 October
 * 2026).
 */
export const MAX_DETAIL_ROWS = 100_000

/** What the provider says about the rows it handed over. */
export interface Completeness {
  /** False when the provider stopped before the end: at its cap, or sampling. */
  readonly complete: boolean
  /** How many detail rows it captured: exactly the rows given. */
  readonly captured: number
  /** The most rows it would capture, when it has a cap. */
  readonly cap?: number
}

/** The envelope a host renders a report from. Untrusted: `checkData` reads it as data, whatever its type says. */
export interface ReportData {
  /** The header dataset's one record, by field id. */
  readonly header?: Readonly<Record<string, unknown>>
  /** The detail dataset's rows, in the provider's order. */
  readonly detail?: readonly Readonly<Record<string, unknown>>[]
  readonly completeness: Completeness
  readonly consistency: Consistency
}

/**
 * One record, checked: each declared field's value as its type holds it, or
 * null. A field a preview's data lacks is absent, not null. The record has
 * no prototype, so a field named `constructor` is the record's own or
 * absent, never inherited.
 */
export type CheckedRecord = { readonly [field: string]: CheckedValue | null }

export interface CheckedData {
  readonly mode: DataMode
  /** The header record; absent when the report declares no header dataset. */
  readonly header?: CheckedRecord
  /** The detail rows, in the provider's order; empty when the report declares no detail dataset. */
  readonly detail: readonly CheckedRecord[]
  readonly completeness: Completeness
  readonly consistency: Consistency
}

export type DataCheck =
  | { readonly ok: true; readonly data: CheckedData; /** What a preview lacks; always empty in a final render, which refuses it. */ readonly warnings: readonly DataError[] }
  | { readonly ok: false; readonly errors: readonly DataError[] }

export interface DataCheckOptions {
  readonly mode: DataMode
}

const ENVELOPE: readonly string[] = ['header', 'detail', 'completeness', 'consistency']
const COMPLETENESS: readonly string[] = ['complete', 'captured', 'cap']

const MINIMISATION = 'a report never carries what it does not print, so data it does not read is refused rather than carried along'

/** What one check carries through: its errors, its warnings, and its mode. */
interface Check {
  readonly errors: DataFindings
  readonly warnings: DataError[]
  readonly final: boolean
}

/** A container's code as a data error's: a list too long is a dataset with too many rows. */
const CONTAINER: { readonly [C in ContainerCode]: DataErrorCode } = { 'wrong-type': 'wrong-type', 'not-data': 'not-data', 'too-many': 'too-many-rows' }

/** Reports what a record holds that is not data, by key; returns those keys. */
function reportProblems(c: Check, path: string, problems: readonly { readonly key?: string; readonly message: string }[]): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const problem of problems) {
    if (problem.key !== undefined) keys.add(problem.key)
    c.errors.report(problem.key === undefined ? path : keyAt(path, problem.key), 'not-data', problem.message)
  }
  return keys
}

/** How many records lacked a field, and where it was first missed. */
interface Missing {
  first: string
  count: number
}

/** One record held to `contract`, or undefined when it cannot be read at all. Fields it lacks are tallied in `missing`. */
function checkRecord(c: Check, contract: DatasetContract, declared: ReadonlySet<string>, raw: unknown, path: string, missing: Map<string, Missing>): CheckedRecord | undefined {
  const read = readRecord(raw)
  if (!read.ok) {
    c.errors.report(path, read.code, read.message)
    return undefined
  }
  const unreadable = reportProblems(c, path, read.problems)
  const record = Object.create(null) as Record<string, CheckedValue | null>
  for (const field of contract.fields) {
    const where = at(path, field.id)
    if (unreadable.has(field.id)) continue
    if (!read.entries.has(field.id)) {
      const tally = missing.get(field.id)
      if (c.final) c.errors.report(where, 'missing-field', `${field.id}: the contract declares this field and the data lacks it; a missing field is not null, and a final render refuses it`)
      else if (tally === undefined) missing.set(field.id, { first: where, count: 1 })
      else tally.count++
      continue
    }
    const value = read.entries.get(field.id)
    if (value === null) {
      if (field.nullable) record[field.id] = null
      else c.errors.report(where, 'unexpected-null', `${field.id}: the contract says this field is never null`)
      continue
    }
    const checked = readValue(field.type, value, field.scale)
    if (checked.ok) record[field.id] = checked.value
    else c.errors.report(where, checked.code, `${field.id}: ${checked.message}`)
  }
  for (const key of read.entries.keys()) {
    if (declared.has(key)) continue
    const what = isLongKey(key) ? `a property name longer than ${MAX_KEY_LENGTH} characters, which no field has` : 'the contract declares no such field'
    c.errors.report(keyAt(path, key), 'undeclared-field', `${what}; ${MINIMISATION}`)
  }
  return Object.freeze(record)
}

/** A warning for each field a preview's records lacked, once per field. */
function warnMissing(c: Check, missing: ReadonlyMap<string, Missing>, records: number, role: DatasetRole): void {
  for (const [field, { first, count }] of missing) {
    const where = role === 'header' ? 'the header record' : `${count} of ${records} rows`
    c.warnings.push({ path: first, code: 'missing-field', message: `${field}: missing from ${where}; a final render refuses data without it` })
  }
}

/** The report does not declare `role`, and the data holds it. */
function undeclaredDataset(c: Check, role: DatasetRole): void {
  c.errors.report(`/${role}`, 'undeclared-dataset', `the report declares no ${role} dataset; ${MINIMISATION}`)
}

/** The report declares `role`, and the data lacks it: an error in a final render, a warning in a preview. */
function missingDataset(c: Check, role: DatasetRole): void {
  const message = `the report declares a ${role} dataset and the data has none`
  if (c.final) c.errors.report(`/${role}`, 'missing-dataset', message)
  else c.warnings.push({ path: `/${role}`, code: 'missing-dataset', message: `${message}; every field of it is missing` })
}

const EMPTY: CheckedRecord = Object.freeze(Object.create(null) as CheckedRecord)

function checkHeader(c: Check, contract: DatasetContract | undefined, entries: ReadonlyMap<string, unknown>): CheckedRecord | undefined {
  const present = entries.has('header')
  if (contract === undefined) {
    if (present) undeclaredDataset(c, 'header')
    return undefined
  }
  if (!present) {
    missingDataset(c, 'header')
    return EMPTY
  }
  const missing = new Map<string, Missing>()
  const record = checkRecord(c, contract, new Set(contract.fields.map(({ id }) => id)), entries.get('header'), '/header', missing)
  warnMissing(c, missing, 1, 'header')
  return record
}

/** The detail rows checked, and how many were given when that could be counted. */
function checkDetail(c: Check, contract: DatasetContract | undefined, entries: ReadonlyMap<string, unknown>): { readonly rows: CheckedRecord[]; readonly given: number | undefined } {
  const present = entries.has('detail')
  if (contract === undefined || !present) {
    if (contract === undefined && present) undeclaredDataset(c, 'detail')
    if (contract !== undefined) missingDataset(c, 'detail')
    return { rows: [], given: contract === undefined && !present ? 0 : undefined }
  }
  const list = readList(entries.get('detail'), MAX_DETAIL_ROWS)
  if (!list.ok) {
    const message = list.code === 'too-many' ? `${list.message}: a render reads at most ${MAX_DETAIL_ROWS} detail rows` : list.message
    c.errors.report('/detail', CONTAINER[list.code], message)
    return { rows: [], given: undefined }
  }
  const unreadable = new Map(list.problems.map(({ index, message }) => [index, message]))
  const declared = new Set(contract.fields.map(({ id }) => id))
  const missing = new Map<string, Missing>()
  const rows: CheckedRecord[] = []
  for (const [index, item] of list.items.entries()) {
    if (c.errors.full) break
    if (item === UNREADABLE) {
      c.errors.report(at('/detail', index), 'not-data', unreadable.get(index) as string)
      continue
    }
    const record = checkRecord(c, contract, declared, item, at('/detail', index), missing)
    if (record !== undefined) rows.push(record)
  }
  warnMissing(c, missing, list.items.length, 'detail')
  return { rows, given: list.items.length }
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

function checkCompleteness(c: Check, raw: unknown, given: number | undefined): Completeness | undefined {
  const read = readRecord(raw)
  const shape = 'completeness is { "complete": true or false, "captured": the rows given, "cap": the most rows the provider would capture, if it has a cap }'
  if (!read.ok) {
    c.errors.report('/completeness', 'invalid-completeness', shape)
    return undefined
  }
  reportProblems(c, '/completeness', read.problems)
  for (const key of read.entries.keys()) {
    if (!COMPLETENESS.includes(key)) c.errors.report(keyAt('/completeness', key), 'invalid-completeness', `${shape}; nothing else`)
  }
  const { complete, captured, cap } = Object.fromEntries(COMPLETENESS.map((key) => [key, read.entries.get(key)]))
  const valid = typeof complete === 'boolean' && isCount(captured) && (cap === undefined || isCount(cap))
  if (typeof complete !== 'boolean') c.errors.report('/completeness/complete', 'invalid-completeness', 'complete is true or false')
  if (!isCount(captured)) c.errors.report('/completeness/captured', 'invalid-completeness', 'captured is a count of rows: a whole number, 0 or more')
  if (cap !== undefined && !isCount(cap)) c.errors.report('/completeness/cap', 'invalid-completeness', 'cap is a count of rows: a whole number, 0 or more')
  if (!valid) return undefined
  if (given !== undefined && captured !== given) {
    c.errors.report('/completeness/captured', 'completeness-mismatch', `the provider says it captured ${captured} rows and gave ${given}; rows lost or added on the way are never papered over`)
  }
  if (cap !== undefined && captured > cap) c.errors.report('/completeness/cap', 'completeness-mismatch', `the provider says it captured ${captured} rows, more than its cap of ${cap}`)
  if (!complete) {
    const message = 'the provider says the data is incomplete'
    if (c.final) c.errors.report('/completeness/complete', 'incomplete', `${message}; a final render prints every row or none, and never a silently truncated report`)
    else c.warnings.push({ path: '/completeness/complete', code: 'incomplete', message: `${message}; this preview shows only what was captured` })
  }
  return Object.freeze({ complete, captured, ...(cap === undefined ? {} : { cap }) })
}

function checkConsistency(c: Check, raw: unknown): Consistency | undefined {
  if (CONSISTENCY_MODES.includes(raw as Consistency)) return raw as Consistency
  c.errors.report('/consistency', 'invalid-consistency', `consistency is one of ${CONSISTENCY_MODES.map((mode) => `"${mode}"`).join(', ')}`)
  return undefined
}

/**
 * `data` held to `report`'s dataset contracts, or every reason it is
 * refused, up to `MAX_DATA_ERRORS`. `report` is one the validator accepts.
 * Any mode but `preview` is held as final: the stricter of the two.
 */
export function checkData(report: ReportDefinition, data: ReportData, options: DataCheckOptions): DataCheck {
  const c: Check = { errors: new DataFindings(), warnings: [], final: options.mode !== 'preview' }
  const top = readRecord(data)
  if (!top.ok) return { ok: false, errors: [{ path: '', code: top.code, message: top.message }] }
  reportProblems(c, '', top.problems)
  for (const key of top.entries.keys()) {
    if (!ENVELOPE.includes(key)) c.errors.report(keyAt('', key), 'unknown-property', `the data holds ${ENVELOPE.join(', ')}, and nothing the runtime does not know`)
  }
  const header = checkHeader(c, report.datasets.header, top.entries)
  const detail = checkDetail(c, report.datasets.detail, top.entries)
  const completeness = checkCompleteness(c, top.entries.get('completeness'), detail.given)
  const consistency = checkConsistency(c, top.entries.get('consistency'))
  if (!c.errors.empty || completeness === undefined || consistency === undefined) return { ok: false, errors: c.errors.errors() }
  const checked: CheckedData = {
    mode: c.final ? 'final' : 'preview',
    ...(header === undefined ? {} : { header }),
    detail: Object.freeze(detail.rows),
    completeness,
    consistency,
  }
  return { ok: true, data: Object.freeze(checked), warnings: c.warnings }
}
