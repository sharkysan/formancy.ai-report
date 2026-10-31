/**
 * One value read as the type a dataset field or a parameter declares, and
 * held as the runtime computes with it.
 *
 * Exact values travel as strings with their type and are never converted
 * through a JavaScript number (0007; formancy.ai-data 0008). So:
 * - an integer is a string of its digits, or a JSON number only where a
 *   number is still exact, below 2^53; it is held as a `bigint`;
 * - a decimal is only ever the string of its exact digits, held as
 *   `@formancy/expressions`' `Decimal` with its scale;
 * - a date and a local date-time have no zone and are held as their ISO
 *   strings, which sort in calendar order;
 * - an instant has a zone, and is held in UTC, so that two spellings of one
 *   moment are one value;
 * - an image is an approved asset's id and digest, never an address.
 *
 * Each type has one spelling of each value, the one report-spec writes a
 * parameter default in. Its patterns are restated here because report-spec
 * does not export them; `values.test.ts` puts candidates to both, so the two
 * cannot drift apart unnoticed. A refusal says what was expected and never
 * repeats what was found: the data is the customer's.
 */
import { DEFAULT_VALUE_LIMITS, Decimal, decimalFromString } from '@formancy/expressions'
import { isIdentifier, MAX_SCALE } from '@formancy/report-spec'
import type { FieldType } from '@formancy/report-spec'
import { readRecord } from './input.js'

/**
 * The longest string a value may be, in UTF-16 code units. Not chosen: it is
 * the longest string `@formancy/expressions` lets an expression be handed
 * (`DEFAULT_VALUE_LIMITS.maxStringLength`), so every string the data check
 * accepts is one an expression can read, and a longer one is refused where
 * the check can name its field rather than when an expression first reads
 * it.
 */
export const MAX_STRING_LENGTH = DEFAULT_VALUE_LIMITS.maxStringLength

export const VALUE_ERROR_CODES = [
  /** A value of another JavaScript type than the field's: a number for a string, a bigint, a Date. */
  'wrong-type',
  'string-too-long',
  /** A string with half a surrogate pair, which is not text and would print as something nobody wrote. */
  'ill-formed-string',
  /** Not an integer's one spelling, or a number with a fraction. */
  'invalid-integer',
  /** A JSON number past 2^53, which has already lost digits. */
  'unsafe-integer',
  /** A decimal as a JSON number, which has already lost digits. */
  'decimal-as-number',
  'invalid-decimal',
  /** A decimal with more places than its field declares, or than a decimal holds. */
  'decimal-scale',
  'invalid-date',
  'invalid-datetime',
  'invalid-instant',
  'invalid-image',
] as const
export type ValueErrorCode = (typeof VALUE_ERROR_CODES)[number]

/** An image field's value: an approved asset the host resolves to bytes by its id, pinned by its digest. */
export interface ImageValue {
  /** An identifier, as report-spec writes an asset's id. */
  readonly asset: string
  /** `sha256:` and 64 lower-case hex digits. */
  readonly digest: string
}

/** What a value of each field type is held as once read. */
export interface FieldValues {
  readonly string: string
  readonly integer: bigint
  readonly decimal: Decimal
  readonly boolean: boolean
  /** `YYYY-MM-DD`. */
  readonly date: string
  /** `YYYY-MM-DDTHH:mm:ss`, and a fraction of a second without trailing zeros when it has one. */
  readonly datetime: string
  /** As a date-time, in UTC, with a final `Z`. */
  readonly instant: string
  readonly image: ImageValue
}

/** A value of any field type, read. Null is not one: whether a field may be null is its contract's, and checked before its type. */
export type CheckedValue = FieldValues[FieldType]

export type ValueRead<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: ValueErrorCode; readonly message: string }

function refused(code: ValueErrorCode, message: string): { readonly ok: false; readonly code: ValueErrorCode; readonly message: string } {
  return { ok: false, code, message }
}

/** What `raw` is, for a message: its JavaScript type, never its content. */
function kindOf(raw: unknown): string {
  if (raw === null) return 'null'
  if (Array.isArray(raw)) return 'a list'
  if (raw instanceof Date) return 'a Date'
  if (raw instanceof Decimal) return 'a Decimal'
  const type = typeof raw
  return type === 'object' ? 'an object' : `a ${type}`
}

function wrongType(expected: string, raw: unknown): { readonly ok: false; readonly code: ValueErrorCode; readonly message: string } {
  return refused('wrong-type', `expected ${expected}, found ${kindOf(raw)}`)
}

/** An exact integer: no sign but '-', no leading zero, no '-0' (report-spec's `INTEGER`). */
const INTEGER = /^(?:0|-?[1-9]\d*)$/

/** An exact decimal: an integer, optionally a point and at least one digit; no negative zero (report-spec's `DECIMAL`). */
const DECIMAL = /^(?:-?[1-9]\d*(?:\.\d+)?|0(?:\.\d+)?|-0\.0*[1-9]\d*)$/

/** An asset's content digest: SHA-256, lower-case hex (report-spec's `DIGEST`). */
const DIGEST = /^sha256:[0-9a-f]{64}$/

/** Half a surrogate pair: a high one not followed by a low one, or a low one not preceded by a high one. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/
/** An ISO 8601 date-time with its zone, as `@formancy/expressions` binds a timestamp: seconds optional, a fraction to the nanosecond. */
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(?:Z|([+-])(\d{2}):(\d{2}))$/

/**
 * Whether year, month and day name a day on the proleptic Gregorian
 * calendar from the year 1: 2024-02-29 does, 2026-02-29 does not, and no day
 * of the year 0000 does, which Intl shows as the year 1 without its era
 * (report-spec's `isCalendarDate`).
 */
function isCalendarDay(year: number, month: number, day: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const days = month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31
  return day <= days
}

/** Whether hours, minutes and seconds name a time on a clock that has no leap second, as Date has none. */
function isClockTime(hour: number, minute: number, second: number): boolean {
  return hour <= 23 && minute <= 59 && second <= 59
}

/**
 * `fraction` without trailing zeros, with its point, or nothing when nothing
 * is left. A loop rather than /0+$/: the instant pattern bounds the fraction
 * to nine digits, but an anchored repetition is quadratic on many zeros
 * before a non-zero (CodeQL's js/polynomial-redos), and this needs no bound
 * to stay linear.
 */
function fractionOf(fraction: string | undefined): string {
  if (fraction === undefined) return ''
  let end = fraction.length
  while (end > 0 && fraction[end - 1] === '0') end -= 1
  return end === 0 ? '' : `.${fraction.slice(0, end)}`
}

function readString(raw: unknown): ValueRead<string> {
  if (typeof raw !== 'string') return wrongType('a string', raw)
  if (raw.length > MAX_STRING_LENGTH)
    return refused('string-too-long', `a string of ${raw.length} characters, more than the ${MAX_STRING_LENGTH} a value may have`)
  if (LONE_SURROGATE.test(raw)) return refused('ill-formed-string', 'a string with half a surrogate pair is not text, and would print a character nobody wrote')
  return { ok: true, value: raw }
}

function readInteger(raw: unknown): ValueRead<bigint> {
  if (typeof raw === 'string') {
    if (raw.length <= MAX_STRING_LENGTH && INTEGER.test(raw)) return { ok: true, value: BigInt(raw) }
    return refused('invalid-integer', 'an integer is written as its digits, with "-" for a negative one, no leading zero and no "-0"')
  }
  if (typeof raw === 'number') {
    if (Number.isSafeInteger(raw)) return { ok: true, value: BigInt(raw) }
    if (Number.isInteger(raw)) return refused('unsafe-integer', 'a number past 2^53 has already lost digits; send the integer as a string of its digits')
    return refused('invalid-integer', 'expected a whole number')
  }
  return wrongType('an integer, written as a string of its digits', raw)
}

function readDecimal(raw: unknown, scale: number | undefined): ValueRead<Decimal> {
  if (typeof raw === 'number') return refused('decimal-as-number', 'a decimal is sent as a string of its exact digits, never as a number: floats lose digits')
  if (typeof raw !== 'string') return wrongType('a decimal, written as a string of its exact digits', raw)
  if (raw.length > MAX_STRING_LENGTH || !DECIMAL.test(raw)) {
    return refused('invalid-decimal', 'a decimal is written as its digits, with "." before any places, "-" for a negative one, no leading zero and no "-0"')
  }
  const places = raw.length - raw.indexOf('.') - 1
  const allowed = scale ?? MAX_SCALE
  if (raw.includes('.') && places > allowed) {
    const whose = scale === undefined ? 'a decimal holds' : 'the field declares'
    return refused(
      'decimal-scale',
      `a decimal with ${places} places, more than the ${allowed} ${whose}; rounding it here would print another number than the source holds`,
    )
  }
  return { ok: true, value: decimalFromString(raw) }
}

function readBoolean(raw: unknown): ValueRead<boolean> {
  return typeof raw === 'boolean' ? { ok: true, value: raw } : wrongType('true or false', raw)
}

function readDate(raw: unknown): ValueRead<string> {
  if (typeof raw !== 'string') return wrongType('a date, written YYYY-MM-DD', raw)
  const match = DATE.exec(raw)
  if (match !== null && isCalendarDay(Number(match[1]), Number(match[2]), Number(match[3]))) return { ok: true, value: raw }
  return refused('invalid-date', 'a date is a day on the calendar, written YYYY-MM-DD')
}

function readDatetime(raw: unknown): ValueRead<string> {
  if (typeof raw !== 'string') return wrongType('a date and time, written YYYY-MM-DDTHH:mm:ss', raw)
  const match = DATETIME.exec(raw)
  const [year, month, day, hour, minute, second] = match === null ? [] : match.slice(1, 7).map(Number)
  if (match === null || !isCalendarDay(year as number, month as number, day as number) || !isClockTime(hour as number, minute as number, second as number)) {
    return refused(
      'invalid-datetime',
      'a date and time without a zone is written YYYY-MM-DDTHH:mm:ss, with a fraction of a second of up to nine digits if it has one',
    )
  }
  return { ok: true, value: `${raw.slice(0, 19)}${fractionOf(match[7])}` }
}

const pad = (value: number, width: number): string => String(value).padStart(width, '0')

/**
 * `text`, an ISO 8601 date-time with its zone, as the moment it names in
 * UTC: `YYYY-MM-DDTHH:mm:ssZ`, with the fraction of a second it has, less
 * trailing zeros. Undefined when it is not one, or the moment falls outside
 * the years 0001 to 9999 in UTC: past them a year has no four-digit
 * spelling, and Intl shows the year 0 as the year 1.
 *
 * What an expression gives back for a timestamp is RFC 3339 in UTC, so this
 * also makes an expression's instant comparable with the data's.
 */
export function canonicalInstant(text: string): string | undefined {
  const match = INSTANT.exec(text)
  if (match === null) return undefined
  const [year, month, day, hour, minute, second = 0] = match.slice(1, 7).map((part) => (part === undefined ? undefined : Number(part))) as [
    number,
    number,
    number,
    number,
    number,
    number | undefined,
  ]
  const offsetHours = match[9] === undefined ? 0 : Number(match[9])
  const offsetMinutes = match[10] === undefined ? 0 : Number(match[10])
  if (!isCalendarDay(year, month, day) || !isClockTime(hour, minute, second) || offsetHours > 23 || offsetMinutes > 59) return undefined
  // Date.UTC reads the years 0 to 99 as 1900 to 1999; setUTCFullYear does not.
  const moment = new Date(0)
  moment.setUTCFullYear(year, month - 1, day)
  moment.setUTCHours(hour, minute, second, 0)
  const offset = (match[8] === '-' ? -1 : 1) * (offsetHours * 60 + offsetMinutes)
  moment.setTime(moment.getTime() - offset * 60_000)
  const utcYear = moment.getUTCFullYear()
  if (utcYear < 1 || utcYear > 9999) return undefined
  const date = `${pad(utcYear, 4)}-${pad(moment.getUTCMonth() + 1, 2)}-${pad(moment.getUTCDate(), 2)}`
  const time = `${pad(moment.getUTCHours(), 2)}:${pad(moment.getUTCMinutes(), 2)}:${pad(moment.getUTCSeconds(), 2)}`
  return `${date}T${time}${fractionOf(match[7])}Z`
}

function readInstant(raw: unknown): ValueRead<string> {
  if (typeof raw !== 'string') return wrongType('an instant, written as an ISO 8601 date-time with its zone', raw)
  const value = canonicalInstant(raw)
  if (value !== undefined) return { ok: true, value }
  return refused('invalid-instant', 'an instant is an ISO 8601 date-time with its zone, Z or an offset such as +01:00, between the years 0001 and 9999 in UTC')
}

const IMAGE_SHAPE = 'an image is an approved asset, { "asset": its id, "digest": "sha256:" and 64 lower-case hex digits }, never an address'

function readImage(raw: unknown): ValueRead<ImageValue> {
  const read = readRecord(raw)
  if (!read.ok || read.problems.length > 0) return refused('invalid-image', IMAGE_SHAPE)
  const { entries } = read
  const asset = entries.get('asset')
  const digest = entries.get('digest')
  if (entries.size !== 2 || !isIdentifier(asset) || typeof digest !== 'string' || !DIGEST.test(digest)) return refused('invalid-image', IMAGE_SHAPE)
  return { ok: true, value: Object.freeze({ asset, digest }) }
}

/**
 * `raw` read as a value of `type`, or why it is not one. `scale` is a
 * decimal field's declared scale: a decimal with more places is refused.
 * Null is refused as every type's wrong type; the caller decides first
 * whether the field may hold it.
 */
export function readValue<T extends FieldType>(type: T, raw: unknown, scale?: number): ValueRead<FieldValues[T]> {
  const read = READERS[type] as (raw: unknown, scale: number | undefined) => ValueRead<FieldValues[T]>
  return read(raw, scale)
}

const READERS: { readonly [T in FieldType]: (raw: unknown, scale: number | undefined) => ValueRead<FieldValues[T]> } = {
  string: readString,
  integer: readInteger,
  decimal: readDecimal,
  boolean: readBoolean,
  date: readDate,
  datetime: readDatetime,
  instant: readInstant,
  image: readImage,
}
