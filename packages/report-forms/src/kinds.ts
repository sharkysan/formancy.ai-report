/**
 * The mapping from formancy's field kinds to a report's field types,
 * decided once (0042), and what it says of one field a report reads in
 * one form version: where the version holds it, and how its answer is
 * read, or why the version cannot fill it.
 *
 * Checked per render, against the version that collected the submission:
 * a field the version lacks, holds elsewhere or holds as another kind is
 * refused, naming the field and the version's hash, before any answer is
 * read, so nothing prints wrong until a review lifts it. A path is never
 * guessed from a name. Where a review decided for that version (0048), the
 * binding's override for it says where the version holds the field, or
 * that nothing of it prints from that version; every version it does not
 * name is read at the binding's own path.
 */
import type { DatasetFormBinding, FieldContract, FieldType } from '@formancy/report-spec'
import type { FieldDef, FieldOption, FieldType as FormKind } from '@formancy/spec'
import type { Findings } from './errors.js'
import { named } from './errors.js'
import type { Scope, Version } from './version.js'

/** How an answer of a kind is read: as stored, as a time of day, as rich text's plain text, by the number rule, as a yes or a no, as a choice, as a date, as an instant, a matrix row's column, or one option ticked. */
export type Reading = 'text' | 'time' | 'rich' | 'number' | 'checkbox' | 'choice' | 'date' | 'instant' | 'matrix' | 'ticked'

/** What a kind's answer is read as, or why it is not read. */
export type KindRule =
  | {
      /** The report's types it may be read as. */
      readonly reads: readonly FieldType[]
      readonly as: Reading
      /** What a field names of it: a matrix's row, or an option of ticked boxes. */
      readonly member?: 'row' | 'option'
      /** Whether it is a choice, which prints its label or its stored value. */
      readonly choice?: true
    }
  | { readonly unsupported: string }
  | { readonly none: string }

const AS_IMAGE = 'it would print as an image asset the host approves, which this release does not do yet; it is refused rather than printed as something else'

/**
 * Every formancy kind, and what a report reads of its answer.
 *
 * A text or a hidden value may also be read as an integer or a decimal:
 * its string is handed over and held to the type's one spelling, which is
 * how Formancy Data writes a decimal into a form (formancy.ai-data 0008),
 * and the remedy for a number the number rule refuses. A time of day has
 * no report type and prints as stored. A matrix and ticked boxes are read
 * one row or one option a field.
 */
export const KINDS: { readonly [K in FormKind]: KindRule } = {
  text: { reads: ['string', 'integer', 'decimal'], as: 'text' },
  textarea: { reads: ['string'], as: 'text' },
  hidden: { reads: ['string', 'integer', 'decimal'], as: 'text' },
  time: { reads: ['string'], as: 'time' },
  richtext: { reads: ['string'], as: 'rich' },
  number: { reads: ['integer', 'decimal'], as: 'number' },
  checkbox: { reads: ['boolean'], as: 'checkbox' },
  select: { reads: ['string'], as: 'choice', choice: true },
  radio: { reads: ['string'], as: 'choice', choice: true },
  date: { reads: ['date'], as: 'date' },
  datetime: { reads: ['instant'], as: 'instant' },
  matrix: { reads: ['string'], as: 'matrix', member: 'row', choice: true },
  selectboxes: { reads: ['boolean'], as: 'ticked', member: 'option' },
  ranking: { unsupported: 'a ranking is an order of its options, which this release does not print' },
  file: { unsupported: AS_IMAGE },
  signature: { unsupported: AS_IMAGE },
  static: { none: 'static text shows the person filling in the form something, and holds no answer' },
  group: { none: "a group holds fields and no answer of its own: a field reads one of them, by the group's key and its own" },
  page: { none: 'a page is a step of the form and holds no answer' },
  repeater: { none: 'a repeater holds rows, which a report reads as its detail and no field reads' },
}

/** What lifts a field's refusal for one version: a review of it, which says what the version did and offers what would print, where anything would (0048). */
const LIFTED = 'reviewFormVersion, a review of that version, offers what lifts this, where anything does'

/** What lifts the detail's: a review of it offers to read the rows elsewhere and nothing more, so the refusal says so. */
const LIFTED_ROWS = 'reviewFormVersion, a review of that version, offers nothing but a rename of the repeater: one its author declared, or the repeater a version the report names reads the rows from'

/** How one field a report reads is read in one version: as `ReadPlan` says, or not at all, where a review decided nothing of it prints from that version. */
export type FieldPlan = ReadPlan | { readonly field: FieldContract; readonly omitted: true }

/** How one field a report reads is read from one version's submissions. */
export interface ReadPlan {
  readonly field: FieldContract
  /** Its path's keys, in its dataset's scope. */
  readonly keys: readonly string[]
  /** The field of the version that holds its answer. */
  readonly def: FieldDef
  readonly as: Reading
  /** The matrix row or the option it reads. */
  readonly member?: string
  /** Whether it prints a choice's label, rather than its stored value. */
  readonly label: boolean
  /** The options the version offers it, by value, the first of two that share one: a choice's, a matrix's columns, ticked boxes'. Indexed once, so no answer scans them. */
  readonly options: ReadonlyMap<string, FieldOption>
  /** A matrix's rows, by value. */
  readonly rows: ReadonlySet<string>
}

/** A member as a message quotes it: the report's own text, shortened. */
const quoted = (member: string): string => JSON.stringify(member.length > 40 ? `${member.slice(0, 40)}...` : member)

/** The field at `keys` in `scope` of `version`: through groups, never into a repeater's rows, which are a scope of their own. */
export function fieldAt(version: Version, scope: Scope, keys: readonly string[]): FieldDef | undefined {
  const [first, ...rest] = keys
  const found = first === undefined ? undefined : scope.get(first)
  if (found === undefined || rest.length === 0) return found
  const inner = found.type === 'group' ? version.within.get(found) : undefined
  return inner === undefined ? undefined : fieldAt(version, inner, rest)
}

/** `def`'s options by value; of two that share one, which formancy allows a select, the first. */
function optionsOf(def: FieldDef): ReadonlyMap<string, FieldOption> {
  const options = new Map<string, FieldOption>()
  for (const option of def.options ?? []) if (!options.has(option.value)) options.set(option.value, option)
  return options
}

/** Why a member does not fit, or undefined when it does: what a matrix's rows or an option list hold, and what each field must name. */
function memberRefusal(rule: Extract<KindRule, { reads: unknown }>, def: FieldDef, member: string | undefined): { readonly code: 'version-lacks-field' | 'version-retypes-field' | 'unsupported-field'; readonly why: string } | undefined {
  if (rule.member === undefined) return member === undefined ? undefined : { code: 'version-retypes-field', why: `names a member, and a ${def.type} field has none` }
  const what = rule.member === 'row' ? 'row' : 'option'
  if (member === undefined) return { code: 'version-retypes-field', why: `is a ${def.type} field, which a report reads one ${what} at a time, and the field names no ${what} as its member` }
  if (rule.member === 'option' && typeof def.optionsSource === 'string') {
    return { code: 'unsupported-field', why: 'is ticked boxes whose options a deployment resolves, which are not in the document, so which one the field names cannot be checked' }
  }
  const values = (rule.member === 'row' ? def.rows : def.options) ?? []
  return values.some((each) => each.value === member) ? undefined : { code: 'version-lacks-field', why: `has no ${what} ${quoted(member)}` }
}

/**
 * How `field` is read in `version`, from `scope` -- the submission's, or a
 * repeater's rows' -- or undefined after reporting, at `where` in the
 * report, why the version cannot fill it.
 */
export function planField(f: Findings, version: Version, scope: Scope, field: FieldContract, where: string, inRows: string | undefined): FieldPlan | undefined {
  const binding = field.form
  if (binding === undefined) return undefined
  const override = overrideFor(binding.overrides, version)
  if (override !== undefined && 'omit' in override) return { field, omitted: true }
  const path = override?.path ?? binding.path
  const keys = path.split('.')
  const at = `${named(path)}${inRows === undefined ? '' : ` in the rows of ${named(inRows)}`}`
  const def = fieldAt(version, scope, keys)
  const refuse = (code: 'version-lacks-field' | 'version-retypes-field' | 'unsupported-field', why: string): undefined => {
    // Once for each version: a report of many submissions meets it in every submission of that version.
    f.report(where, code, `${field.id} is read at ${at}, and the form version ${version.hash} ${why}: ${LIFTED}`, `${code} ${where} ${version.hash}`)
    return undefined
  }
  if (def === undefined) return refuse('version-lacks-field', 'has no field there; a path is never guessed from a name')
  const rule = KINDS[def.type]
  if ('unsupported' in rule) return refuse('unsupported-field', `holds a ${def.type} field there: ${rule.unsupported}`)
  if ('none' in rule) return refuse('version-retypes-field', `holds a ${def.type} there: ${rule.none}`)
  if (!rule.reads.includes(field.type)) return refuse('version-retypes-field', `holds a ${def.type} field there, read as ${rule.reads.join(' or ')}, and the report declares a ${field.type}`)
  const fractional = (value: number | undefined): boolean => value !== undefined && !Number.isInteger(value)
  if (rule.as === 'number' && field.type === 'integer' && def.step !== undefined && (fractional(def.step) || fractional(def.min))) {
    return refuse('version-retypes-field', 'steps through fractions there, so it holds numbers an integer field does not print')
  }
  const member = memberRefusal(rule, def, binding.member)
  if (member !== undefined) return refuse(member.code, `${member.why} there`)
  if (binding.read !== undefined && rule.choice !== true) return refuse('version-retypes-field', `holds a ${def.type} field there, which is no choice, and the field says how a choice prints`)
  const rows = new Set((def.rows ?? []).map((row) => row.value))
  return { field, keys, def, as: rule.as, ...(binding.member === undefined ? {} : { member: binding.member }), label: rule.choice === true && binding.read !== 'value', options: optionsOf(def), rows }
}

/** The override a binding's `overrides` hold for `version`, by its hash: its own, never one an object inherits. */
function overrideFor<T>(overrides: Readonly<Record<string, T>> | undefined, version: Version): T | undefined {
  return overrides !== undefined && Object.hasOwn(overrides, version.hash) ? overrides[version.hash] : undefined
}

/** The data path of the repeater a detail of `binding` reads its rows from in `version`: where a review put it for that version, or the binding's own. */
export function repeaterIn(binding: Extract<DatasetFormBinding, { kind: 'repeater' }>, version: Version): string {
  return overrideFor(binding.overrides, version)?.repeater ?? binding.repeater
}

/**
 * The repeater at `repeater` in `version`, and its rows' scope, or
 * undefined after reporting why the version has none there. `review` says
 * whether a review lifts the refusal: a report's detail's, which one does,
 * and not a generator's option.
 */
export function planRepeater(f: Findings, version: Version, repeater: string, where: string, review = true): { readonly def: FieldDef; readonly keys: readonly string[]; readonly rows: Scope } | undefined {
  const keys = repeater.split('.')
  const def = fieldAt(version, version.answers, keys)
  const lifted = review ? `: ${LIFTED_ROWS}` : ''
  if (def === undefined) {
    f.report(where, 'version-lacks-field', `the detail reads the rows of ${named(repeater)}, and the form version ${version.hash} has no repeater there; a path is never guessed from a name${lifted}`)
    return undefined
  }
  if (def.type !== 'repeater') {
    f.report(where, 'version-retypes-field', `the detail reads the rows of ${named(repeater)}, and the form version ${version.hash} holds a ${def.type} there, which has no rows${lifted}`)
    return undefined
  }
  return { def, keys, rows: version.within.get(def) as Scope }
}
