/**
 * The fields properties are edited in: how each kind of field is shown,
 * and how what a person types becomes a value in the report.
 *
 * A field turns text into a value and nothing more: whether the value is
 * valid is the validator's question, asked when the edit is applied, so
 * the message a refused value shows is the validator's (0008). Only what
 * cannot become a value at all -- "tall" for a number -- is refused here.
 * Which fields each thing has is `component-fields.ts`'s, a component's
 * runs of text `run-fields.ts`'s, the report's own `report-fields.ts`'s,
 * and a word written in another language `word-fields.ts`'s (0063).
 */
import { mmToPt, ptToMm } from '@formancy/report-spec'
import type { Inline, PrintStyle, ReportDefinition } from '@formancy/report-spec'
import type { Edited } from './languages.js'
import type { EditorAction } from './model-actions.js'
import type { PropertyKind, PropertyOption } from './model-properties.js'
import type { PropertyChange } from './properties.js'
import type { EditorLocale, EditorText, MessageId } from './text.js'

/** What a field makes of what was typed: a value at `at` (its key unless it says), nothing changed, or why it cannot be one. */
export type Written =
  | { readonly ok: true; readonly value: unknown; readonly at?: string }
  | { readonly ok: true; readonly unchanged: true }
  | { readonly ok: false; readonly message: MessageId }

/** Which words name a field: a message and its values, so a history label is translated when it is shown. */
export interface FieldWords {
  readonly id: MessageId
  /** For "Column {n} width" and "Part {n}: {kind}". */
  readonly n?: number
  /** The run kind, for "Part {n}: {kind}". */
  readonly run?: Inline['kind']
  /** The text a run is part of, for "{name}, part {n}: {kind}": an EPC payment code's remittance text, say. */
  readonly of?: MessageId
  /** The number of the list's item the field is of, from 1, for "VAT category {item}: rate" and in the name of the text a run is part of (0044). */
  readonly item?: number
}

/** What a text is named by: its words, or its words and the number of the list's item it is of. */
export type TextName = MessageId | { readonly id: MessageId; readonly item: number }

/** What a field at a word says in a language besides the report's own (0063): the language, the report's own word, whether it is missing, and how many places it stands in. */
export interface FieldTranslation {
  /** The language's name, in the editor's language. */
  readonly language: string
  /** The report's own word, or the expression's own source: what the field shows while it is empty. */
  readonly word: string
  readonly missing: boolean
  readonly places: number
}

export interface FieldSpec {
  readonly key: string
  readonly words: FieldWords
  readonly kind: PropertyKind
  readonly unit?: 'mm' | 'pt'
  readonly required: boolean
  readonly placeholder?: MessageId
  readonly options?: readonly PropertyOption[]
  readonly read: () => string | boolean
  readonly write: (input: string | boolean) => Written
  /** Where the field writes a word in a language besides the report's own (0063). */
  readonly translation?: FieldTranslation
  /** The change a value written makes where it is none of the target's own properties: a word's translation, a language added (0063). */
  readonly change?: (written: unknown) => PropertyChange
}

/** A group's button: its words -- with the item's number, for an item of a list -- the action it sends, whether it has somewhere to go, and where the keyboard goes once it is done (`PropertyAction`'s `then`). */
export interface GroupButton {
  readonly words: MessageId
  readonly item?: number
  /** What the words name, where they name something: the language a Remove takes away (0063). */
  readonly name?: string
  readonly action: EditorAction
  readonly available: boolean
  readonly then?: { readonly group: string; readonly button?: number }
}

/**
 * A list of groups the properties edit item by item -- an e-invoice's VAT
 * categories (0044) -- as its own group says it: where it is, the items
 * it holds, what Add puts at its end, the words each item is named by, and
 * how the history names adding, removing and moving one. Where the list
 * could take nothing more, `full` says why, and its Add is unavailable.
 */
export interface ListSpec {
  readonly key: string
  readonly items: readonly unknown[]
  readonly value: unknown
  readonly full?: MessageId
  readonly item: MessageId
  readonly added: MessageId
  readonly removed: MessageId
  readonly moved: MessageId
}

/**
 * Fields drawn together under one name, and the buttons the group has. An
 * optional group -- a bill's debtor -- also says what adding it puts at
 * its key and how the history names adding and removing it; its button is
 * Add while it is absent, when it has no fields, and Remove while it is
 * there. A list's own group has no fields and its Add, and says what its
 * list is (`list`); each item of it is a group of its own, numbered `n`
 * from 1, with Move up, Move down and Remove.
 */
export interface GroupSpec {
  readonly key: string
  readonly words: MessageId
  readonly item?: number
  readonly fields: readonly FieldSpec[]
  readonly buttons: readonly GroupButton[]
  readonly optional?: {
    readonly present: boolean
    readonly value: unknown
    readonly added: MessageId
    readonly removed: MessageId
    readonly announced?: { readonly added: MessageId; readonly removed: MessageId }
  }
  readonly list?: ListSpec
}

/** What a panel shows, in order: a field by itself, or a group of fields. */
export type PanelSpec = FieldSpec | GroupSpec

export function isGroup(spec: PanelSpec): spec is GroupSpec {
  return 'fields' in spec
}

/** Every field of `specs`, those in a group among them, in the order shown. */
export function flatFields(specs: readonly PanelSpec[]): FieldSpec[] {
  return specs.flatMap((spec) => (isGroup(spec) ? spec.fields : [spec]))
}

/** The words an optional group's button and its history steps say, and, where "Added {name}." would not agree with its name, what the live region says. */
export interface OptionalWords {
  readonly add: MessageId
  readonly remove: MessageId
  readonly added: MessageId
  readonly removed: MessageId
  readonly announced?: { readonly added: MessageId; readonly removed: MessageId }
}

/**
 * The optional group at `key`: its fields and a Remove while it is there,
 * `fields` given; an Add and no fields while it is not, which puts `value`
 * at its key.
 */
export function optionalGroup(key: string, words: MessageId, fields: readonly FieldSpec[] | undefined, value: unknown, said: OptionalWords): GroupSpec {
  const present = fields !== undefined
  return {
    key,
    words,
    fields: fields ?? [],
    buttons: [
      present
        ? { words: said.remove, action: { type: 'removeGroup', key }, available: true }
        : { words: said.add, action: { type: 'addGroup', key }, available: true },
    ],
    optional: { present, value, added: said.added, removed: said.removed, ...(said.announced === undefined ? {} : { announced: said.announced }) },
  }
}

/** The words of a field, filled in a language: "Part 2: Field". */
export function fieldWords(words: FieldWords, t: EditorText): string {
  const item = words.item === undefined ? {} : { item: words.item }
  return t(words.id, {
    ...(words.n === undefined ? {} : { n: words.n }),
    ...(words.run === undefined ? {} : { kind: t(`run.${words.run}`) }),
    ...(words.of === undefined ? {} : { name: t(words.of, item) }),
    ...item,
  })
}

export const UNCHANGED: Written = { ok: true, unchanged: true }
export const value = (next: unknown, at?: string): Written => ({ ok: true, value: next, ...(at === undefined ? {} : { at }) })
export const refused = (message: MessageId): Written => ({ ok: false, message })

/** A number as typed: a decimal comma read as a point, as Swiss French types it; NaN when it is not one. */
function parsed(input: string): number {
  const text = input.trim().replace(',', '.')
  return /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : Number.NaN
}

/**
 * A field of plain text, stored as typed. An optional one emptied is
 * removed, and one given back as it was shown is left alone, so that
 * leaving an absent one empty is no edit and is not announced as one.
 */
export function textField(
  key: string,
  words: FieldWords,
  kind: 'text' | 'multiline',
  read: () => string,
  use: 'required' | 'optional' = 'required',
): FieldSpec {
  return {
    key,
    words,
    kind,
    required: use === 'required',
    read,
    write: (input) => {
      if (typeof input !== 'string') return refused('input.option')
      if (use === 'required') return value(input)
      return input === read() ? UNCHANGED : value(input === '' ? null : input)
    },
  }
}

/**
 * A length, stored in points and edited in millimetres. Empty means fill
 * where a width may fill, removal where the length is optional, and is
 * refused where it is neither. Given back as it was shown, it is left alone,
 * so leaving a field never moves a length by the conversion's hundredth.
 */
export function lengthField(key: string, words: FieldWords, stored: number | 'fill' | undefined, use: 'required' | 'optional' | 'fill'): FieldSpec {
  const shown = typeof stored === 'number' ? String(ptToMm(stored)) : ''
  return {
    key,
    words,
    kind: 'length',
    unit: 'mm',
    required: use === 'required',
    ...(use === 'fill' ? { placeholder: 'option.fill' as const } : {}),
    read: () => shown,
    write: (input) => {
      if (typeof input !== 'string') return refused('input.number')
      if (input.trim() === shown) return UNCHANGED
      if (input.trim() === '') return use === 'fill' ? value('fill') : use === 'optional' ? value(null) : refused('input.required')
      const millimetres = parsed(input)
      return Number.isNaN(millimetres) ? refused('input.number') : value(mmToPt(millimetres))
    },
  }
}

/** A number edited as stored: a thickness in points. */
export function pointsField(
  key: string,
  words: FieldWords,
  stored: number | undefined,
  required: boolean,
  write?: (points: number | null) => Written,
): FieldSpec {
  const shown = stored === undefined ? '' : String(stored)
  return {
    key,
    words,
    kind: 'number',
    unit: 'pt',
    required,
    read: () => shown,
    write: (input) => {
      if (typeof input !== 'string') return refused('input.number')
      if (input.trim() === shown) return UNCHANGED
      if (input.trim() === '') return required ? refused('input.required') : (write?.(null) ?? value(null))
      const points = parsed(input)
      return Number.isNaN(points) ? refused('input.number') : (write?.(points) ?? value(points))
    },
  }
}

/** An optional colour, written in lower case as the format stores it; empty removes it. */
export function colorField(key: string, words: FieldWords, stored: string | undefined, write?: (color: string | null) => Written): FieldSpec {
  return {
    key,
    words,
    kind: 'color',
    required: false,
    read: () => stored ?? '',
    write: (input) => {
      if (typeof input !== 'string') return refused('input.option')
      const color = input.trim() === '' ? null : input.trim().toLowerCase()
      return write?.(color) ?? value(color)
    },
  }
}

/** An expression's source. An optional one emptied is removed; a required one is the validator's to refuse. */
export function expressionField(key: string, words: FieldWords, stored: string | undefined, required: boolean): FieldSpec {
  return {
    key,
    words,
    kind: 'expression',
    required,
    read: () => stored ?? '',
    write: (input) => {
      if (typeof input !== 'string') return refused('input.option')
      return input.trim() === '' && !required ? value(null) : value({ cel: input })
    },
  }
}

/** One choice among `options`, each option's value mapped to what the report stores. */
export function choiceField(
  key: string,
  words: FieldWords,
  kind: 'select' | 'style' | 'binding',
  options: readonly (PropertyOption & { readonly stored: unknown })[],
  current: string,
): FieldSpec {
  return {
    key,
    words,
    kind,
    // A choice that offers none -- no style, no frame -- is optional.
    required: options.every((option) => option.stored !== null),
    options: options.map(({ value: token, label }) => ({ value: token, label })),
    read: () => current,
    write: (input) => {
      const chosen = options.find((option) => option.value === input)
      return chosen === undefined ? refused('input.option') : value(chosen.stored)
    },
  }
}

export function booleanField(key: string, words: FieldWords, stored: boolean | undefined): FieldSpec {
  return {
    key,
    words,
    kind: 'boolean',
    required: false,
    read: () => stored === true,
    // False is the format's default, so it is written as the property's absence.
    write: (input) => (typeof input === 'boolean' ? value(input ? true : null) : refused('input.option')),
  }
}

/** What fields are built from: the report, the editor's words and language, and what each name reads where the thing stands. */
export interface FieldContext {
  readonly report: ReportDefinition
  readonly t: EditorText
  /** For a number an option's words hold, written as the language writes it. */
  readonly locale: EditorLocale
  /** Whether a detail field has a value where the thing stands: a table's cell. */
  readonly row: boolean
  /** The language whose words the fields at a word write, where it is not the report's own (0063). */
  readonly edited?: Edited
}

export function styleField(key: string, words: FieldWords, styles: readonly PrintStyle[], current: string | undefined, t: EditorText): FieldSpec {
  const options = [{ value: '', label: t('option.none'), stored: null }, ...styles.map((style) => ({ value: style.id, label: style.id, stored: style.id }))]
  return choiceField(key, words, 'style', options, current ?? '')
}
