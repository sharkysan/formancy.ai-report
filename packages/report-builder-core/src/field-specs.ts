/**
 * A field: how one property is shown, and how what a person types becomes
 * a value in the report, one constructor for each kind of value. Which
 * fields each thing has is `property-fields.ts`'s.
 *
 * A field turns text into a value and nothing more: whether the value is
 * valid is the validator's question, asked when the edit is applied, so
 * the message a refused value shows is the validator's (0008). Only what
 * cannot become a value at all -- "tall" for a number -- is refused here.
 */
import { mmToPt, ptToMm } from '@formancy/report-spec'
import type { Inline, PrintStyle } from '@formancy/report-spec'
import type { PropertyKind, PropertyOption } from './model-properties.js'
import type { EditorText, MessageId } from './text.js'

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

/** What a write gives where the input is what the field shows: no edit. */
export const UNCHANGED: Written = { ok: true, unchanged: true }
/** What a write gives for a value, at the field's key or at `at`. */
export const value = (next: unknown, at?: string): Written => ({ ok: true, value: next, ...(at === undefined ? {} : { at }) })
/** What a write gives for what cannot become a value at all. */
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

/**
 * A count edited as stored, whose absence means one: how many of a group's
 * first rows its header is kept with (0059). It reads one where nothing is
 * stated; one, or nothing, is written as the member's absence, as a
 * boolean's default is, and a count given back as it reads is left alone.
 * Whether a count is whole and in range is the validator's to say.
 */
export function countField(key: string, words: FieldWords, stored: number | undefined): FieldSpec {
  const shown = String(stored ?? 1)
  return {
    key,
    words,
    kind: 'number',
    required: false,
    read: () => shown,
    write: (input) => {
      if (typeof input !== 'string') return refused('input.number')
      if (input.trim() === shown) return UNCHANGED
      const count = input.trim() === '' ? 1 : parsed(input)
      if (Number.isNaN(count)) return refused('input.number')
      const next = count === 1 ? undefined : count
      return next === stored ? UNCHANGED : value(next ?? null)
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

export function styleField(key: string, words: FieldWords, styles: readonly PrintStyle[], current: string | undefined, t: EditorText): FieldSpec {
  const options = [{ value: '', label: t('option.none'), stored: null }, ...styles.map((style) => ({ value: style.id, label: style.id, stored: style.id }))]
  return choiceField(key, words, 'style', options, current ?? '')
}
