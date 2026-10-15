/**
 * A value as the text a report prints, for the report's locale: report-spec's
 * number, currency, date and text formats, through Intl.
 *
 * - **Exact to the last digit.** A number reaches Intl as the string of its
 *   digits, already rounded here to exactly the places it prints, half away
 *   from zero as a person rounds by hand. An ES2023 engine formats such a
 *   string exactly, and `format.test.ts` holds that it does; Intl is never
 *   handed a double and never rounds. Up to a bound: ECMA-402 reads a
 *   string whose double would be infinite as infinity, and prints '∞'. A
 *   number with more than `MAX_FORMATTED_DIGITS` integer digits is refused
 *   instead; printed without a format, it prints whole.
 * - **The locale's conventions.** Grouping, separators, currency symbols,
 *   month names and case are the locale's, as the engine's ICU has them.
 *   ICU versions can differ -- which mark Swiss German groups digits with is
 *   one such difference, and `format.test.ts` reads it from the engine -- so
 *   the same report can print differently on two engines. That is the cost
 *   of not carrying a locale database here.
 * - **Dates have no zone.** A date, and a date and time without a zone, are
 *   formatted in UTC from their own fields, so 2026-01-01 is the first of
 *   January wherever the report renders. Only an instant is shown in a zone,
 *   and that zone is the host's to name: the machine's is never used.
 * - **Nothing is guessed.** A locale or zone the engine lacks is refused
 *   rather than replaced by a default, and a format that cannot show a value
 *   is an error rather than a blank.
 *
 * Null prints as nothing (0007), under every format.
 */
import { Decimal, decimalToString } from '@formancy/expressions'
import type { CurrencyFormat, CurrencySource, DateStyle, FieldType, Format, NumberFormat, TextTransform } from '@formancy/report-spec'
import type { CheckedRecord } from './data.js'
import { roundDecimalAs } from './decimal.js'
import type { CheckedParameters } from './parameters.js'
import { readValue } from './values.js'
import type { FieldValues } from './values.js'

/** The types a value printed can have: every field type but an image, which is drawn. */
export type PrintableType = Exclude<FieldType, 'image'>

/** A value with its type, as the runtime holds it (`values.ts`). */
export type TypedValue = { readonly [T in PrintableType]: { readonly type: T; readonly value: FieldValues[T] } }[PrintableType]

export const FORMAT_ERROR_CODES = [
  /** A locale the engine's Intl does not have, which it would silently replace with the host's. */
  'unsupported-locale',
  /** A time zone the engine's Intl does not know. */
  'unsupported-time-zone',
  /** A format that cannot show the value it is given: a number format over text, a date format over a number. */
  'format-type-mismatch',
  /** An amount whose currency field or parameter has no value. */
  'no-currency',
  /** A currency that is not an ISO 4217 code in capitals. */
  'invalid-currency',
  /** A number with more integer digits than `MAX_FORMATTED_DIGITS`, which Intl would print as '∞'. */
  'number-too-large',
] as const

/**
 * The most integer digits a number or currency format prints: 308. A double
 * holds up to about 1.8 × 10^308, and ECMA-402's ToIntlMathematicalValue
 * reads a string whose double would be infinite as infinity, so every
 * number of 308 digits or fewer prints exactly and one of 309 may not.
 */
export const MAX_FORMATTED_DIGITS = 308
export type FormatErrorCode = (typeof FORMAT_ERROR_CODES)[number]

export type Formatted = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly code: FormatErrorCode; readonly message: string }

/** What a render is formatted for: the report's locale, and the zone its instants are shown in. */
export interface FormatContext {
  /** A BCP 47 tag, as a report's `locale` is. */
  readonly locale: string
  /** An IANA time zone, such as `Europe/Zurich`, named by the host. */
  readonly timeZone: string
}

/** Where a currency format finds a currency read from a field or a parameter. */
export interface CurrencyScope {
  readonly params?: CheckedParameters
  readonly header?: CheckedRecord
  /** The current detail row, in a table's cells. */
  readonly row?: CheckedRecord
}

export interface Formatter {
  readonly locale: string
  readonly timeZone: string
  /** `value` as `format` shows it, or as it prints plainly without one. */
  format(value: TypedValue | null, format: Format | undefined, scope?: CurrencyScope): Formatted
}

function refused(code: FormatErrorCode, message: string): Formatted {
  return { ok: false, code, message }
}

/**
 * A value printed with no format: as the format writes it. Exact digits
 * with their scale, ISO dates, an instant in UTC; nothing is interpreted.
 */
export function plainText(value: TypedValue | null): string {
  if (value === null) return ''
  if (value.type === 'integer' || value.type === 'boolean') return String(value.value)
  if (value.type === 'decimal') return decimalToString(value.value)
  return value.value
}

/**
 * Whether the engine has `locale`, in its number and date formats and its
 * collation, by the lookup a tag like `de-CH` falls back from region to
 * language with. A tag it cannot read is not one it has.
 */
export function supportedLocale(locale: string): boolean {
  try {
    const options = { localeMatcher: 'lookup' } as const
    return (
      Intl.NumberFormat.supportedLocalesOf([locale], options).length === 1 &&
      Intl.DateTimeFormat.supportedLocalesOf([locale], options).length === 1 &&
      Intl.Collator.supportedLocalesOf([locale], options).length === 1
    )
  } catch {
    return false
  }
}

/** Whether Intl knows `timeZone`. */
function knownTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return true
  } catch {
    return false
  }
}

/** The time a date-and-time format shows with each date style: no seconds for short, seconds otherwise; never the zone's name, which a local time does not have. */
const TIME_STYLE: { readonly [S in DateStyle]: 'short' | 'medium' } = { short: 'short', medium: 'medium', long: 'medium' }

/** A moment to show: when, whether it has a time of day, and whether it is shown in the render's zone or, having none, in UTC. */
interface Moment {
  readonly epochMs: number
  readonly time: boolean
  readonly zoned: boolean
}

/** Epoch milliseconds of a calendar date and time in UTC; Date.UTC would read the years 0 to 99 as 1900 to 1999. */
function utc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  const moment = new Date(0)
  moment.setUTCFullYear(year, month - 1, day)
  moment.setUTCHours(hour, minute, second, 0)
  return moment.getTime()
}

/** The numbers in `text`, a date or a date and time `readValue` accepted, in order. */
const fieldsOf = (text: string): number[] => (text.match(/\d+/g) as RegExpMatchArray).map(Number)

/** `value` as a `type` spells it: a value of that type, or a string an expression gave that spells one, as `readValue` holds it. */
function spelledAs(value: TypedValue, type: 'date' | 'datetime' | 'instant'): string | undefined {
  if (value.type === type) return value.value as string
  if (value.type !== 'string') return undefined
  const read = readValue(type, value.value)
  return read.ok ? read.value : undefined
}

/** The moment a value spells: a date, a date and time, or an instant, by its type or, for a string an expression gave, by its syntax. */
function momentOf(value: TypedValue): Moment | undefined {
  const date = spelledAs(value, 'date')
  if (date !== undefined) {
    const [year, month, day] = fieldsOf(date) as [number, number, number]
    return { epochMs: utc(year, month, day), time: false, zoned: false }
  }
  const local = spelledAs(value, 'datetime')
  if (local !== undefined) {
    const [year, month, day, hour, minute, second] = fieldsOf(local) as [number, number, number, number, number, number]
    return { epochMs: utc(year, month, day, hour, minute, second), time: true, zoned: false }
  }
  const instant = spelledAs(value, 'instant')
  return instant === undefined ? undefined : { epochMs: new Date(instant).getTime(), time: true, zoned: true }
}

/** The exact number a value holds, or undefined when it holds none. */
function exactNumber(value: TypedValue): Decimal | undefined {
  if (value.type === 'integer') return new Decimal(value.value, 0)
  return value.type === 'decimal' ? value.value : undefined
}

/** The currency code an amount is in, from the format, a field or a parameter, or why there is none. */
function currencyOf(source: CurrencySource, scope: CurrencyScope | undefined): string | Formatted {
  if (source.kind === 'code') return source.code
  const [name, raw] =
    source.kind === 'parameter'
      ? [`parameter ${source.parameter}`, scope?.params?.[source.parameter]]
      : [`field ${source.field.field}`, (source.field.dataset === 'header' ? scope?.header : scope?.row)?.[source.field.field]]
  if (raw === null || raw === undefined) return refused('no-currency', `the amount's currency, ${name}, has no value, and an amount without one reads as some other currency`)
  if (typeof raw === 'string' && /^[A-Z]{3}$/.test(raw)) return raw
  return refused('invalid-currency', `the amount's currency, ${name}, is not an ISO 4217 code in capitals, such as CHF`)
}

/** The Intl formatter `cache` keeps for `options`, made by `make` the first time they are asked for: a table formats a column with one. */
function kept<T>(cache: Map<string, T>, options: object, make: () => T): T {
  const key = JSON.stringify(options)
  const found = cache.get(key)
  if (found !== undefined) return found
  const made = make()
  cache.set(key, made)
  return made
}

/** A formatter for one locale and time zone, which builds each Intl formatter it needs once and keeps it. */
class LocaleFormatter implements Formatter {
  readonly locale: string
  readonly timeZone: string
  readonly #numbers = new Map<string, Intl.NumberFormat>()
  readonly #dates = new Map<string, Intl.DateTimeFormat>()

  constructor(context: FormatContext) {
    this.locale = context.locale
    this.timeZone = context.timeZone
  }

  format(value: TypedValue | null, format: Format | undefined, scope?: CurrencyScope): Formatted {
    if (value === null) return { ok: true, text: '' }
    if (format === undefined) return { ok: true, text: plainText(value) }
    switch (format.kind) {
      case 'text':
        return { ok: true, text: this.#transformed(plainText(value), format.transform) }
      case 'date':
        return this.#date(value, format.style)
      default:
        return this.#number(value, format, scope)
    }
  }

  #transformed(text: string, transform: TextTransform | undefined): string {
    if (transform === 'upper') return text.toLocaleUpperCase(this.locale)
    return transform === 'lower' ? text.toLocaleLowerCase(this.locale) : text
  }

  #number(value: TypedValue, format: NumberFormat | CurrencyFormat, scope: CurrencyScope | undefined): Formatted {
    const exact = exactNumber(value)
    if (exact === undefined) return refused('format-type-mismatch', `a ${format.kind} format shows integers and decimals, and this value is a ${value.type}`)
    const currency = format.kind === 'currency' ? currencyOf(format.currency, scope) : undefined
    if (typeof currency === 'object') return currency
    const rounded = decimalToString(roundDecimalAs(exact, { scale: format.scale, mode: 'half-away-from-zero' })) as Intl.StringNumericLiteral
    if (rounded.replace(/^-/, '').split('.')[0]!.length > MAX_FORMATTED_DIGITS) {
      return refused('number-too-large', `a number of more than ${MAX_FORMATTED_DIGITS} digits, which Intl would print as infinity; printed without a format, it prints whole`)
    }
    const options: Intl.NumberFormatOptions = {
      minimumFractionDigits: format.scale,
      maximumFractionDigits: format.scale,
      ...(currency === undefined ? { useGrouping: format.kind === 'number' && !format.grouping ? false : 'auto' } : { style: 'currency', currency }),
    }
    return { ok: true, text: kept(this.#numbers, options, () => new Intl.NumberFormat(this.locale, options)).format(rounded) }
  }

  #date(value: TypedValue, style: DateStyle): Formatted {
    const moment = momentOf(value)
    if (moment === undefined) return refused('format-type-mismatch', `a date format shows dates, dates and times, and instants, and this value is a ${value.type} that spells none`)
    const options: Intl.DateTimeFormatOptions = {
      dateStyle: style,
      ...(moment.time ? { timeStyle: TIME_STYLE[style] } : {}),
      timeZone: moment.zoned ? this.timeZone : 'UTC',
    }
    return { ok: true, text: kept(this.#dates, options, () => new Intl.DateTimeFormat(this.locale, options)).format(moment.epochMs) }
  }
}

/** A formatter for `context`, or why its locale or time zone is refused. */
export function createFormatter(context: FormatContext): { readonly ok: true; readonly formatter: Formatter } | { readonly ok: false; readonly code: FormatErrorCode; readonly message: string } {
  if (!supportedLocale(context.locale)) {
    return { ok: false, code: 'unsupported-locale', message: "the engine's Intl does not have this locale, and would print the host's instead" }
  }
  if (!knownTimeZone(context.timeZone)) return { ok: false, code: 'unsupported-time-zone', message: "the engine's Intl does not know this time zone" }
  return { ok: true, formatter: new LocaleFormatter(context) }
}
