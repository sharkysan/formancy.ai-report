/**
 * A submission's answers, read by the version's model (0042).
 *
 * `readAnswers` walks the submission once, record by record, as the model
 * scopes it -- the submission's answers, a group's, each row of a repeater
 * -- and refuses an answer under a key its scope has no field for: the
 * submission is another version's, or another form's. It reads every
 * record through its descriptors and keeps the values as read; it never
 * follows a key the model does not name, and inspects no answer the report
 * does not read. Every scope is the version's, indexed once.
 *
 * `answerOf` then reads one field's answer as its plan says: absent or
 * null is null; anything else is copied as data, a string held to the
 * runtime's `MAX_STRING_LENGTH` before it is read, read as its kind stores
 * it, turned into what the report's type holds -- a label, a number's
 * digits, a row's column, a tick -- and held to that type by the runtime's
 * own `readValue`, so the bridge and the runtime read a value one way.
 * What an answer holds is the customer's, its keys as much as its values:
 * a refusal of it stands at the field's own path.
 */
import { MAX_DETAIL_ROWS, MAX_STRING_LENGTH, readValue } from '@formancy/report-runtime'
import { resolveText, richTextToPlain, ROW_ID, TEMPORAL_SHAPES } from '@formancy/spec'
import type { FieldDef } from '@formancy/spec'
import type { Findings } from './errors.js'
import { answerAt, at } from './errors.js'
import { copyJson, readList, readRecord } from './json.js'
import type { Read, Unreadable } from './json.js'
import type { FieldPlan, ReadPlan } from './kinds.js'
import { decimalDigits, integerDigits } from './numbers.js'
import type { Scope, Version } from './version.js'

/** One record of a submission, read once: its answers as read, its groups' records and its repeaters' rows. */
export interface AnswerRecord {
  /** Where the record is in what the host handed over. */
  readonly path: string
  readonly entries: ReadonlyMap<string, unknown>
  readonly groups: ReadonlyMap<string, AnswerRecord>
  readonly rows: ReadonlyMap<string, readonly AnswerRecord[]>
  /** Each answer copied once, as a field first read it, so two fields reading one answer read the same copy. */
  readonly copies: Map<string, Read<unknown>>
}

/** A host's labels for the options a deployment resolves (`optionsSource`), in the report's locale; undefined for a value it has no label for. */
export type OptionLabels = (option: { readonly source: string; readonly value: string; readonly locale: string }) => string | undefined

/** What reading answers needs besides the answer: the version, the report's locale and the host's labels. */
export interface AnswerContext {
  readonly version: Version
  readonly locale: string
  readonly labels: OptionLabels | undefined
}

/** Reports a value that could not be read: not of its shape where it is no object or no list, too many rows, or not data. */
function unread(f: Findings, read: Unreadable, what: string): void {
  if (read.tooMany === true) f.report(read.path, 'too-many-rows', `${read.message}: ${what}`)
  else if (read.wrongType === true) f.report(read.path, 'invalid-answer', `${read.message}: ${what}`)
  else f.report(read.path, 'not-data', read.message)
}

/** The rows of `def` at `path`, each read as a record of the row's scope, or undefined after reporting why not. */
function readRows(f: Findings, version: Version, def: FieldDef, raw: unknown, path: string): AnswerRecord[] | undefined {
  const list = readList(raw, path, MAX_DETAIL_ROWS)
  if (!list.ok) {
    unread(f, list, "a repeater's answer is its rows, as many as a render reads")
    return undefined
  }
  const scope = version.within.get(def) as Scope
  const rows: AnswerRecord[] = []
  for (const [index, item] of list.value.entries()) {
    if (f.full) break
    if (item === null) {
      // formancy nulls a row it strips rather than shift its siblings; a
      // row that is null holds nothing to print, and is not dropped unsaid.
      f.report(at(path, index), 'invalid-answer', 'a row that is null, where formancy stripped it: a report prints no row it cannot read, and drops none unsaid')
      continue
    }
    const row = readAnswers(f, version, scope, item, at(path, index), true)
    if (row !== undefined) rows.push(row)
  }
  return rows
}

/**
 * The record of `scope` at `path`, read once, with its groups and rows;
 * an answer under a key `scope` has no field for refused by its path.
 * Undefined after reporting why the record is no record.
 */
export function readAnswers(f: Findings, version: Version, scope: Scope, raw: unknown, path: string, row = false): AnswerRecord | undefined {
  const read = readRecord(raw, path, answerAt)
  if (!read.ok) {
    unread(f, read, 'answers are an object of named values')
    return undefined
  }
  const groups = new Map<string, AnswerRecord>()
  const rows = new Map<string, readonly AnswerRecord[]>()
  for (const [key, value] of read.value) {
    if (f.full) break
    if (row && key === ROW_ID) continue
    const def = scope.get(key)
    if (def === undefined) {
      f.report(answerAt(path, key), 'unknown-answer', `the form version ${version.hash} has no field here: the submission was collected by another version, or another form, and is read against the version that collected it`)
      continue
    }
    if (value === null) continue
    if (def.type === 'group') {
      const inner = readAnswers(f, version, version.within.get(def) as Scope, value, at(path, key))
      if (inner !== undefined) groups.set(key, inner)
    } else if (def.type === 'repeater') {
      const inner = readRows(f, version, def, value, at(path, key))
      if (inner !== undefined) rows.set(key, inner)
    }
  }
  return { path, entries: read.value, groups, rows, copies: new Map() }
}

/** The record holding the answer at `keys` -- through groups -- and that answer's key; undefined where a group is unanswered. */
function holder(record: AnswerRecord, keys: readonly string[]): { readonly record: AnswerRecord; readonly key: string } | undefined {
  let current = record
  for (const key of keys.slice(0, -1)) {
    const inner = current.groups.get(key)
    if (inner === undefined) return undefined
    current = inner
  }
  return { record: current, key: keys.at(-1) as string }
}

/** The rows of the repeater at `keys`; none where it, or a group around it, is unanswered. */
export function rowsAt(record: AnswerRecord, keys: readonly string[]): readonly AnswerRecord[] {
  const found = holder(record, keys)
  return found === undefined ? [] : (found.record.rows.get(found.key) ?? [])
}

const SHAPES = { time: new RegExp(TEMPORAL_SHAPES.time), date: new RegExp(TEMPORAL_SHAPES.date), instant: new RegExp(TEMPORAL_SHAPES.datetime) } as const

/** An answer turned into what the field's type holds, or why not. */
type Turned = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly code: 'invalid-answer' | 'unknown-answer' | 'unknown-option' | 'unresolved-label' | 'inexact-number'; readonly why: string }

const invalid = (why: string): Turned => ({ ok: false, code: 'invalid-answer', why })
const turned = (value: unknown): Turned => ({ ok: true, value })

/** The label the host's resolver gives `value`, or undefined where it gives none: no string, or an exception, whose words may hold the value and are not kept. */
function hostLabel(labels: OptionLabels | undefined, option: { readonly source: string; readonly value: string; readonly locale: string }): string | undefined {
  try {
    const text: unknown = labels?.(option)
    return typeof text === 'string' ? text : undefined
  } catch {
    return undefined
  }
}

/** The text a choice of `plan` prints for `value`: its label in the report's locale, from the version or the host, or the value itself. */
function choice(plan: ReadPlan, value: string, context: AnswerContext): Turned {
  const { def } = plan
  if (plan.options.size > 0) {
    const option = plan.options.get(value)
    if (option === undefined) return { ok: false, code: 'unknown-option', why: 'no option of the form version that collected it has this value' }
    if (!plan.label) return turned(value)
    const text = resolveText(context.version.schema, option.label, context.locale)
    return text === undefined ? { ok: false, code: 'unresolved-label', why: 'the option has no label in the form version' } : turned(text)
  }
  // No options in the document: formancy takes any non-empty value (formancy.ai 0076, 0189), and only a source can label it.
  if (!plan.label) return turned(value)
  if (typeof def.optionsSource !== 'string') return { ok: false, code: 'unresolved-label', why: 'the field offers no options in the form version and names no source, so its answer has no label; read its value' }
  const text = hostLabel(context.labels, { source: def.optionsSource, value, locale: context.locale })
  return text === undefined ? { ok: false, code: 'unresolved-label', why: `the host gives no label for this value of the source "${def.optionsSource}"` } : turned(text)
}

/**
 * The column a matrix's answer chose in the row `plan` reads, after the
 * whole answer is held to the version, as formancy's engine holds it: a
 * row the version has none of, or a column it offers in none, is another
 * version's answer, whichever row the report reads.
 */
function matrixRow(plan: ReadPlan, value: unknown, context: AnswerContext): Turned {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid("a matrix's answer is an object of each row's chosen column")
  const answer = value as Record<string, unknown>
  for (const [row, column] of Object.entries(answer)) {
    if (!plan.rows.has(row)) return { ok: false, code: 'unknown-answer', why: 'the answer holds a row the form version that collected it has none of' }
    if (column === null) continue
    if (typeof column !== 'string') return invalid("a matrix row's answer is the value of a column")
    if (!plan.options.has(column)) return { ok: false, code: 'unknown-option', why: 'no column of the form version that collected it has this value' }
  }
  const column = Object.hasOwn(answer, plan.member as string) ? answer[plan.member as string] : null
  return typeof column === 'string' ? choice(plan, column, context) : turned(null)
}

/** `value`, an answer of `plan`'s kind, as its field's type holds it. */
function turn(plan: ReadPlan, value: unknown, context: AnswerContext): Turned {
  const { def, field } = plan
  switch (plan.as) {
    case 'text':
      return typeof value === 'string' ? turned(value) : invalid(`a ${def.type} field's answer is text`)
    case 'time':
    case 'date':
    case 'instant':
      return typeof value === 'string' && SHAPES[plan.as].test(value) ? turned(value) : invalid(`a ${def.type} field's answer is formancy's fixed shape for it, ${TEMPORAL_SHAPES[plan.as === 'instant' ? 'datetime' : plan.as]}`)
    case 'rich':
      return typeof value === 'string' ? turned(richTextToPlain(value)) : invalid("a rich text field's answer is its text")
    case 'number': {
      if (typeof value !== 'number') return invalid("a number field's answer is a number")
      const digits = field.type === 'integer' ? integerDigits(value) : decimalDigits(value)
      return digits.ok ? turned(digits.digits) : { ok: false, code: 'inexact-number', why: digits.message }
    }
    case 'checkbox':
      return typeof value === 'boolean' ? turned(value) : invalid("a tick box's answer is true or false")
    case 'choice':
      // Never empty: formancy's engine refuses an empty choice from 0.8.0 (formancy.ai 0189), and an unanswered one is null.
      return typeof value === 'string' && value !== '' ? choice(plan, value, context) : invalid("a choice's answer is the value of an option, never empty")
    case 'matrix':
      return matrixRow(plan, value, context)
    case 'ticked': {
      if (!Array.isArray(value) || !value.every((tick) => typeof tick === 'string')) return invalid("ticked boxes' answer is a list of their options' values")
      if (!value.every((tick: string) => plan.options.has(tick))) return { ok: false, code: 'unknown-option', why: 'a tick is no option of the form version that collected it' }
      return turned(value.includes(plan.member as string))
    }
  }
}

/** A key inside an answer is the answer's, and is never named: a refusal of what the answer holds stands at the answer's own path. */
const inside = (path: string): string => path

/**
 * The answer `plan` reads from `record`, as its field's type holds it, or
 * undefined after reporting why not. An answer the submission does not
 * have, or holds as null, is null; and so is every answer of a version a
 * review decided prints nothing of the field (0048).
 */
export function answerOf(f: Findings, plan: FieldPlan, record: AnswerRecord, context: AnswerContext): unknown {
  if ('omitted' in plan) return null
  const found = holder(record, plan.keys)
  if (found === undefined || !found.record.entries.has(found.key)) return null
  const path = answerAt(found.record.path, found.key)
  const copy = found.record.copies.get(found.key) ?? copyJson(found.record.entries.get(found.key), path, inside)
  found.record.copies.set(found.key, copy)
  if (!copy.ok) {
    f.report(path, 'not-data', copy.message)
    return undefined
  }
  if (copy.value === null) return null
  // Before it is read: formancy's rich text parser takes time that grows faster than its input.
  if (typeof copy.value === 'string' && copy.value.length > MAX_STRING_LENGTH) {
    f.report(path, 'invalid-answer', `${plan.field.id}: an answer of more than the ${MAX_STRING_LENGTH} characters a value may have, refused before it is read, never cut short`)
    return undefined
  }
  const value = turn(plan, copy.value, context)
  if (!value.ok) {
    f.report(path, value.code, `${plan.field.id}: ${value.why}`)
    return undefined
  }
  if (value.value === null) return null
  const held = readValue(plan.field.type, value.value, plan.field.scale)
  if (!held.ok) {
    f.report(path, 'invalid-answer', `${plan.field.id}: ${held.message}`)
    return undefined
  }
  return value.value
}
