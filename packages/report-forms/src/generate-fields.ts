/**
 * The fields a report generated from a form declares (0045), one formancy
 * field at a time: what the mapping (`kinds.ts`, 0042) reads its kind as,
 * where the binding finds its answer, what it is labelled, how it prints,
 * whether the version proves it always answered, and what was assumed to
 * say so. A kind the mapping reads nothing of is listed, never printed as
 * something else.
 *
 * What the format cannot hold is refused, by the field's place, never cut
 * to fit: a path of more keys than a binding names, a label longer than
 * where it prints holds, and two fields that would share an id, which no
 * likeness of their names renames apart. A line's label longer than a
 * field's label holds prints whole on its line, which holds it, and the
 * field is labelled shorter, said.
 */
import { MAX_FORM_PATH_KEYS, MAX_LABEL_LENGTH, MAX_SCALE, MAX_TEXT_LENGTH, isFieldKey } from '@formancy/report-spec'
import type { FieldContract, FieldFormBinding, FieldType } from '@formancy/report-spec'
import type { FieldDef, FieldOption, Text } from '@formancy/spec'
import type { Findings } from './errors.js'
import { at, named } from './errors.js'
import { labelOf, printable } from './generate-labels.js'
import type { Label } from './generate-labels.js'
import { KINDS } from './kinds.js'
import type { GenerateNote, NoteCode } from './notes.js'
import { decimalDigits } from './numbers.js'
import type { Version } from './version.js'

/** How a field's value prints on its line or in its cell. */
export type Prints = 'plain' | 'date' | 'box' | { readonly scale: number }

/** A field the report declares, and how it prints. */
export interface Planned {
  readonly field: FieldContract
  /** Its label on its own line: the field's, or a matrix row's or an option's under its field's heading. */
  readonly line: string
  readonly prints: Prints
}

/** A field id taken in a dataset: the data path of the field that took it, and the member, by its place, where a row or an option took it. */
interface Taken {
  readonly path: string
  readonly member?: { readonly what: 'row' | 'option'; readonly place: number }
}

/** What generating one report reads and writes as it walks the form. */
export interface Draft {
  readonly f: Findings
  readonly notes: GenerateNote[]
  readonly version: Version
  readonly locale: string
  /** The data paths the version's visible rules target: what such a rule hides, it hides with what it holds (formancy.ai 0184). */
  readonly hidden: ReadonlySet<string>
  /** The pages the version's skip rules target, by key. */
  readonly skipped: ReadonlySet<string>
  /** Each dataset's field ids, and what took each: the header's and the table's are read in scopes of their own, `header.x` and `row.x`. */
  readonly ids: { readonly header: Map<string, Taken>; readonly detail: Map<string, Taken> }
}

/** Where a field stands: its keys in its dataset's scope, how formancy's rules name it, and whether a rule can hide what holds it. */
export interface Place {
  readonly keys: readonly string[]
  /** Its data path as formancy's rules write one, up to the field: `''`, `inspector.`, `findings[].`. */
  readonly target: string
  readonly hideable: boolean
}

/** The place of what `def` holds: a group's fields, by its key, hidden with it. */
export function within(draft: Draft, place: Place, def: FieldDef): Place {
  const target = `${place.target}${def.key}`
  return { keys: [...place.keys, def.key], target: `${target}.`, hideable: place.hideable || draft.hidden.has(target) }
}

/**
 * The place of what page `def` holds: the page scopes nothing, and what
 * it holds is skipped with it. A page stands at the top of the model
 * alone -- formancy refuses one in anything -- so `top` is the model's,
 * which nothing hides.
 */
export function onPage(draft: Draft, top: Place, def: FieldDef): Place {
  return { ...top, hideable: draft.skipped.has(def.key) }
}

/** Says `code` of the field at `path`. */
export function note(draft: Draft, code: NoteCode, path: string, message: string): void {
  draft.notes.push({ code, path, message })
}

/** The places after the point of `value`'s shortest decimal, or undefined where it has none the rule writes. */
function places(value: number): number | undefined {
  const digits = decimalDigits(value)
  return digits.ok ? (digits.digits.split('.')[1]?.length ?? 0) : undefined
}

/**
 * A number field's type: an integer where it steps by whole numbers from a
 * whole number, as `planField` reads one; otherwise a decimal, of the
 * places its step and least value have where the format holds that many,
 * since formancy holds an answer to the step from the least value.
 */
function numberType(def: FieldDef): { readonly type: 'integer' } | { readonly type: 'decimal'; readonly scale: number | undefined } {
  const whole = (value: number | undefined): boolean => value === undefined || Number.isInteger(value)
  if (def.step !== undefined && Number.isInteger(def.step) && whole(def.min)) return { type: 'integer' }
  if (def.step === undefined) return { type: 'decimal', scale: undefined }
  const [step, min] = [places(def.step), places(def.min ?? 0)]
  const scale = step === undefined || min === undefined ? undefined : Math.max(step, min)
  return { type: 'decimal', scale: scale !== undefined && scale <= MAX_SCALE ? scale : undefined }
}

/** How a choice prints: its option's label where the version lists options or a deployment resolves them, its stored value where it offers neither. */
function choiceOf(def: FieldDef): { readonly read?: 'value'; readonly note?: NoteCode } {
  if ((def.options ?? []).length > 0) return {}
  return typeof def.optionsSource === 'string' ? { note: 'choice-host-labels' } : { read: 'value', note: 'choice-value' }
}

/** A row or an option a field reads one at a time, with its place in the form's list of them. */
interface Member {
  readonly value: string
  readonly label: Text | undefined
  readonly place: number
}

/** How a field's answer is read and prints: as one field, or one field a matrix's row or a ticked box's option. */
interface Reading {
  readonly type: FieldType
  readonly prints: Prints
  readonly read?: 'value'
  readonly scale?: number
  readonly notes: readonly NoteCode[]
  readonly members?: { readonly what: 'row' | 'option'; readonly list: 'rows' | 'options'; readonly of: readonly Member[] }
}

/** `members` by value, the first of two that share one, as the reader takes them (`kinds.ts`'s `optionsOf`): two options of one value are one tick. */
function distinct(members: readonly FieldOption[]): Member[] {
  const seen = new Set<string>()
  return members.flatMap((member, place) => (seen.has(member.value) ? [] : (seen.add(member.value), [{ value: member.value, label: member.label, place }])))
}

/**
 * Each member's field id: the field's key and the member's value where
 * every member's gives a field key, and otherwise each member's place, so
 * that an id of a value and an id of a place never meet in one field.
 */
function memberIds(key: string, members: readonly Member[]): string[] {
  const joined = members.map((member) => `${key}_${member.value}`)
  return joined.every(isFieldKey) ? joined : members.map((member) => `${key}_${member.place + 1}`)
}

const NOTED: { readonly [K in NoteCode]?: string } = {
  'number-integer': 'is read as an integer: it steps by whole numbers from a whole number',
  'yes-no-box': 'prints as a box, [x] ticked and [ ] not: the format has no word for yes or no in the report’s language, and the generator invents none',
  'time-as-text': 'is a time of day, which a report has no type for: it prints as formancy stores it, HH:MM',
  'rich-text-plain': 'prints as its plain text: its formatting is lost',
  'hidden-printed': 'is a hidden field, which the person filling in the form never saw: it prints as an answer',
  'choice-host-labels': 'is a choice whose options a deployment resolves: it prints the labels the host gives when it reads a submission',
  'choice-value': 'offers no option and names no source, so its answer has no label: it prints its stored value',
}

/** How `def` is read, or undefined after listing why it prints nothing. */
function readingOf(draft: Draft, def: FieldDef, path: string, where: string): Reading | undefined {
  const rule = KINDS[def.type]
  const leftOut = (code: 'static-excluded' | 'unsupported-excluded', why: string): undefined => {
    note(draft, code, where, `${named(path)} is left out: ${why}`)
    return undefined
  }
  if ('none' in rule) return leftOut('static-excluded', rule.none)
  if ('unsupported' in rule) return leftOut('unsupported-excluded', `a ${def.type} field: ${rule.unsupported}`)
  switch (rule.as) {
    case 'text':
      return { type: 'string', prints: 'plain', notes: def.type === 'hidden' ? ['hidden-printed'] : [] }
    case 'time':
      return { type: 'string', prints: 'plain', notes: ['time-as-text'] }
    case 'rich':
      return { type: 'string', prints: 'plain', notes: ['rich-text-plain'] }
    case 'number': {
      const number = numberType(def)
      if (number.type === 'integer') return { type: 'integer', prints: 'plain', notes: ['number-integer'] }
      return {
        type: 'decimal',
        prints: number.scale === undefined ? 'plain' : { scale: number.scale },
        ...(number.scale === undefined ? {} : { scale: number.scale }),
        notes: ['number-decimal'],
      }
    }
    case 'checkbox':
      return { type: 'boolean', prints: 'box', notes: ['yes-no-box'] }
    case 'choice': {
      const choice = choiceOf(def)
      return {
        type: 'string',
        prints: 'plain',
        ...(choice.read === undefined ? {} : { read: choice.read }),
        notes: choice.note === undefined ? [] : [choice.note],
      }
    }
    case 'date':
    case 'instant':
      return { type: rule.as === 'date' ? 'date' : 'instant', prints: 'date', notes: [] }
    case 'matrix':
      // formancy's validator requires a matrix's rows, one at least, and its columns, two at least, so a row prints its column's label.
      return { type: 'string', prints: 'plain', notes: [], members: { what: 'row', list: 'rows', of: distinct(def.rows ?? []) } }
    case 'ticked':
      if (typeof def.optionsSource === 'string')
        return leftOut('unsupported-excluded', 'ticked boxes whose options a deployment resolves, which are not in the document, so no field could name one')
      if ((def.options ?? []).length === 0) return leftOut('unsupported-excluded', 'ticked boxes that offer no option, so there is no box to print')
      return { type: 'boolean', prints: 'box', notes: ['yes-no-box'], members: { what: 'option', list: 'options', of: distinct(def.options ?? []) } }
  }
}

/** One field to declare: its id, its member, its label on its line, and its place in the form. */
interface Line {
  readonly id: string
  readonly member?: Member
  readonly line: string
  readonly where: string
}

/** What `label`, had for `what` at `where`, says of how it was had: by its `by` where it had none, or in the default locale's words. */
function saidOf(label: Label, where: string, what: string, by: string): GenerateNote[] {
  if (label.said === 'unlabelled')
    return [{ code: 'unlabelled', path: where, message: `${what} has no label in the form version, so it is labelled by its ${by}` }]
  if (label.said === 'label-default-locale')
    return [
      {
        code: 'label-default-locale',
        path: where,
        message: `${what} has no label in the form version's catalogue in the report's locale, so it is labelled in its default locale's`,
      },
    ]
  return []
}

/**
 * Each line `def` prints, labelled `label` -- one, or one a member, each
 * at its place in the form -- and what is said of how each label was had;
 * or undefined after refusing one no font draws.
 */
function linesOf(
  draft: Draft,
  def: FieldDef,
  reading: Reading,
  label: Label,
  path: string,
  where: string,
): { readonly lines: readonly Line[]; readonly said: GenerateNote[] } | undefined {
  if (!printable(draft, label.text, where, named(path))) return undefined
  const said = saidOf(label, where, named(path), 'key')
  if (reading.members === undefined) return { lines: [{ id: def.key, line: label.text, where }], said }
  const { what, list, of } = reading.members
  const ids = memberIds(def.key, of)
  const lines: Line[] = []
  for (const [index, member] of of.entries()) {
    const place = at(at(where, list), member.place)
    const which = `${named(path)}, its ${what} ${member.place + 1},`
    const own = labelOf(draft, member.label, member.value)
    // A value that is white space alone labels nothing: the member's id does.
    const line = own.text === '' ? (ids[index] as string) : own.text
    if (!printable(draft, line, place, which)) return undefined
    said.push(...saidOf(own, place, which, own.text === '' ? 'id' : 'value'))
    lines.push({ id: ids[index] as string, member, line, where: place })
  }
  return { lines, said }
}

/** The characters a line's label holds: a text's, less the colon and the space before its value. */
const MAX_LINE_LABEL = MAX_TEXT_LENGTH - 2

/**
 * The parts `def` declares -- each line, and its label as a field -- and
 * what is said of their labels; or undefined after refusing a label no
 * font draws, or longer than where it prints holds. In the header a line
 * holds `MAX_LINE_LABEL`, and a label longer than a field's holds prints
 * whole on its line, the field labelled by its member's label or its id,
 * said; in the table the label is the column's heading, which a field's
 * label's length bounds.
 */
function partsOf(
  draft: Draft,
  def: FieldDef,
  reading: Reading,
  label: Label,
  path: string,
  where: string,
  role: 'header' | 'detail',
): { readonly parts: readonly (Line & { readonly label: string })[]; readonly said: readonly GenerateNote[] } | undefined {
  const printed = linesOf(draft, def, reading, label, path, where)
  if (printed === undefined) return undefined
  const parts: (Line & { readonly label: string })[] = []
  let shortened = false
  for (const each of printed.lines) {
    const whole = each.member === undefined ? each.line : `${label.text}: ${each.line}`
    if (role === 'detail' && whole.length > MAX_LABEL_LENGTH) {
      draft.f.report(
        where,
        'label-too-long',
        `${named(path)} heads a column with a label longer than the ${MAX_LABEL_LENGTH} characters a column's heading holds; it is refused, never cut short`,
      )
      return undefined
    }
    if (each.line.length > MAX_LINE_LABEL) {
      draft.f.report(
        each.where,
        'label-too-long',
        `${named(path)} is labelled longer than the ${MAX_LINE_LABEL} characters a line holds before its value; it is refused, never cut short`,
      )
      return undefined
    }
    const fitted = whole.length <= MAX_LABEL_LENGTH ? whole : each.member !== undefined && each.line.length <= MAX_LABEL_LENGTH ? each.line : each.id
    shortened ||= fitted !== whole
    parts.push({ ...each, label: fitted })
  }
  if (!shortened) return { parts, said: printed.said }
  const by = reading.members === undefined ? 'its key' : `its ${reading.members.what}'s label, or its id`
  const long: GenerateNote = {
    code: 'long-label',
    path: where,
    message: `${named(path)} is labelled longer than the ${MAX_LABEL_LENGTH} characters a field's label holds: its line prints the label whole, and the field is labelled by ${by}`,
  }
  return { parts, said: [...printed.said, long] }
}

/**
 * The fields `def`, a field that holds an answer, declares at `place` in a
 * dataset of `role`, what is said of it noted at `where`, its place in the
 * form; none after listing it as left out or refusing it. `heading` is the
 * label a grid gives its column, where it gives one; one that resolves
 * nowhere gives way to the field's own label.
 */
export function leaf(draft: Draft, def: FieldDef, place: Place, where: string, role: 'header' | 'detail', heading?: Text): readonly Planned[] {
  const keys = [...place.keys, def.key]
  const path = `${place.target}${def.key}`
  const reading = readingOf(draft, def, path, where)
  if (reading === undefined) return []
  if (keys.length > MAX_FORM_PATH_KEYS) {
    draft.f.report(
      where,
      'path-too-long',
      `${named(path)} stands ${keys.length} keys deep in its dataset's scope, and a binding names at most ${MAX_FORM_PATH_KEYS}`,
    )
    return []
  }
  const grid = heading === undefined ? undefined : labelOf(draft, heading, '')
  const label = grid !== undefined && grid.said !== 'unlabelled' ? grid : labelOf(draft, def.label, def.key)
  const planned = partsOf(draft, def, reading, label, path, where, role)
  if (planned === undefined) return []
  if (planned.parts.some((part) => !isFieldKey(part.id))) {
    draft.f.report(
      where,
      'id-too-long',
      `${named(path)}'s key leaves no room in a field key's 64 characters for its rows' or its options' values or places, so they have no id a report takes; it is refused, never cut short`,
    )
    return []
  }
  const nullable = def.required !== true || place.hideable || draft.hidden.has(path)
  for (const code of reading.notes) note(draft, code, where, `${named(path)} ${code === 'number-decimal' ? decimalWhy(reading.scale) : NOTED[code]}`)
  draft.notes.push(...planned.said)
  if (!nullable)
    note(draft, 'present-always', where, `${named(path)} is declared never null: the version requires it, and no rule hides it, what holds it or its page`)
  const fields: Planned[] = []
  for (const part of planned.parts) {
    const taker: Taken = {
      path,
      ...(part.member === undefined || reading.members === undefined ? {} : { member: { what: reading.members.what, place: part.member.place + 1 } }),
    }
    const taken = draft.ids[role].get(part.id)
    if (taken !== undefined) {
      draft.f.report(
        where,
        'colliding-ids',
        `${described(taker)} and ${described(taken)} would both be one field of the report; a report's field ids are unique, and neither is renamed by likeness to tell them apart`,
      )
      return []
    }
    draft.ids[role].set(part.id, taker)
    const binding: FieldFormBinding = {
      path: keys.join('.'),
      ...(part.member === undefined ? {} : { member: part.member.value }),
      ...(reading.read === undefined ? {} : { read: reading.read }),
    }
    const field: FieldContract = {
      id: part.id,
      type: reading.type,
      label: part.label,
      nullable,
      ...(reading.scale === undefined ? {} : { scale: reading.scale }),
      form: binding,
    }
    fields.push({ field, line: part.line, prints: reading.prints })
  }
  return fields
}

/** What took a field id, as a message names it: its path, and its member's place, never the member's value. */
function described(taken: Taken): string {
  return taken.member === undefined ? named(taken.path) : `${named(taken.path)}, its ${taken.member.what} ${taken.member.place},`
}

/** Why a number reads as a decimal, and to how many places. */
function decimalWhy(scale: number | undefined): string {
  return scale === undefined
    ? 'is read as a decimal by the number rule and printed as its digits: no step says how many places it has that a report’s scale holds'
    : `is read as a decimal by the number rule, to the ${scale} places its step and its least value have`
}
