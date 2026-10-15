import { decimalFromString } from '@formancy/expressions'
import type { Format } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { CheckedRecord } from './data.js'
import { createFormatter, plainText, supportedLocale } from './format.js'
import type { Formatted, Formatter, TypedValue } from './format.js'

/** A formatter for `locale` and `timeZone`, failing the test when either is refused. */
function formatter(locale: string, timeZone = 'UTC'): Formatter {
  const created = createFormatter({ locale, timeZone })
  if (!created.ok) throw new Error(`refused: ${created.code} ${created.message}`)
  return created.formatter
}

/** The text, failing the test with the refusal when there is one. */
function text(outcome: Formatted): string {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
  return outcome.text
}

const decimal = (value: string): TypedValue => ({ type: 'decimal', value: decimalFromString(value) })
const integer = (value: bigint): TypedValue => ({ type: 'integer', value })
const number = (scale: number, grouping = true): Format => ({ kind: 'number', scale, grouping })
const currency = (code: string, scale = 2): Format => ({ kind: 'currency', currency: { kind: 'code', code }, scale })
const date = (style: 'short' | 'medium' | 'long'): Format => ({ kind: 'date', style })

/**
 * The mark Swiss German groups digits with is the engine's ICU's, and ICUs
 * differ: on 15 October 2026, Node 24.21 with ICU 78.3 printed U+0027, the
 * apostrophe, here. The task this was written for expected U+2019, the
 * right single quotation mark; CI runs Node 22, whose ICU is older and was
 * not measured. So the mark is read from the engine, held to one of those
 * two, and every other character of the output is asserted exactly.
 */
const SWISS_GROUP = new Intl.NumberFormat('de-CH').formatToParts(1234).find((part) => part.type === 'group')?.value as string

describe('numbers', () => {
  // Intl formats a decimal string exactly in an ES2023 engine; were it to
  // read it as a double, the last places of this value would be lost.
  test('keep every digit of an exact decimal', () => {
    expect(text(formatter('en').format(decimal('99999999999999.9999'), number(4)))).toBe('99,999,999,999,999.9999')
    const long = '123456789012345678901234567890.12345678901234567890'
    expect(text(formatter('en').format(decimal(long), number(20, false)))).toBe(long)
    expect(text(formatter('en').format(integer(123456789012345678901234567890n), number(0, false)))).toBe('123456789012345678901234567890')
  })

  // ECMA-402 reads a numeric string whose double would be infinite as
  // infinity: a total of two 309-digit amounts printed as '∞', and a
  // negative one as '-∞'. A number with more integer digits than a double
  // holds is refused instead; 308 digits still print, every one.
  test('refuse a number too long for Intl to keep, rather than print ∞', () => {
    const huge = `2${'0'.repeat(308)}`
    expect(formatter('en').format(integer(BigInt(huge)), number(0, false))).toMatchObject({ ok: false, code: 'number-too-large' })
    expect(formatter('de-CH').format(decimal(`-${huge}.05`), { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 })).toMatchObject({ ok: false, code: 'number-too-large' })
    const most = '9'.repeat(308)
    expect(text(formatter('en').format(integer(BigInt(most)), number(0, false)))).toBe(most)
    expect(text(formatter('en').format(integer(BigInt(huge)), undefined))).toBe(huge)
  })

  // Display rounding is the runtime's, half away from zero as a person
  // rounds by hand, done on the exact value before Intl sees it; Intl is
  // handed exactly the places it prints, and never rounds.
  test.each([
    ['2.345', 2, '2.35'],
    ['-2.345', 2, '-2.35'],
    ['0.125', 2, '0.13'],
    ['2.5', 0, '3'],
    ['1.5', 3, '1.500'],
    ['-0.004', 2, '0.00'],
  ])('show %s to %d places as %s', (value, scale, shown) => {
    expect(text(formatter('en').format(decimal(value), number(scale)))).toBe(shown)
  })

  // An integer is shown as a number too, with the places the format asks.
  test('show an integer with places', () => {
    expect(text(formatter('en').format(integer(-1234n), number(2)))).toBe('-1,234.00')
  })

  // Grouping is the locale's: Swiss German groups with a mark of its own,
  // and without grouping the digits stand alone.
  test('group digits as the locale does, or not at all', () => {
    expect([`'`, '’']).toContain(SWISS_GROUP)
    expect(text(formatter('de-CH').format(decimal('1234567.89'), number(2)))).toBe(`1${SWISS_GROUP}234${SWISS_GROUP}567.89`)
    expect(text(formatter('de-CH').format(decimal('1234567.89'), number(2, false)))).toBe('1234567.89')
    expect(text(formatter('de-DE').format(decimal('1234567.89'), number(2)))).toBe('1.234.567,89')
  })
})

describe('currencies', () => {
  // A currency comes from the format, or from a field or a parameter that
  // holds an ISO 4217 code, per report-spec.
  test('take the code from the format', () => {
    expect(text(formatter('de-CH').format(decimal('1234.5'), currency('CHF')))).toBe(`CHF 1${SWISS_GROUP}234.50`)
    expect(text(formatter('de-CH').format(decimal('-1234.5'), currency('CHF')))).toBe(`CHF-1${SWISS_GROUP}234.50`)
    expect(text(formatter('de-DE').format(decimal('1234.5'), currency('EUR')))).toBe('1.234,50 €')
  })

  // The format's scale decides the places, not the currency's minor unit:
  // a unit price in yen may well have places.
  test('show the places the format asks for', () => {
    expect(text(formatter('en').format(decimal('1234.5'), currency('JPY', 2)))).toBe('¥1,234.50')
    expect(text(formatter('en').format(decimal('1234.5'), currency('JPY', 0)))).toBe('¥1,235')
  })

  // A field's code is read from the header or the current row, as its
  // dataset says, and a parameter's from the parameters.
  test('take the code from a field or a parameter', () => {
    const header = { currency: 'EUR' } as unknown as CheckedRecord
    const row = { code: 'USD' } as unknown as CheckedRecord
    const fromHeader: Format = { kind: 'currency', currency: { kind: 'field', field: { dataset: 'header', field: 'currency' } }, scale: 2 }
    const fromRow: Format = { kind: 'currency', currency: { kind: 'field', field: { dataset: 'detail', field: 'code' } }, scale: 2 }
    const fromParameter: Format = { kind: 'currency', currency: { kind: 'parameter', parameter: 'currency' }, scale: 2 }
    const en = formatter('en')
    expect(text(en.format(decimal('1'), fromHeader, { header }))).toBe('€1.00')
    expect(text(en.format(decimal('1'), fromRow, { row }))).toBe('$1.00')
    expect(text(en.format(decimal('1'), fromParameter, { params: { currency: 'CHF' } }))).toBe('CHF 1.00')
  })

  // An amount whose currency has no value would print as a bare number that
  // reads as some other currency; a code that is not ISO 4217 in capitals
  // is not one a reader can trust.
  test('refuse an amount whose currency is null, missing or not a code', () => {
    const fromParameter: Format = { kind: 'currency', currency: { kind: 'parameter', parameter: 'currency' }, scale: 2 }
    const en = formatter('en')
    expect(en.format(decimal('1'), fromParameter, { params: { currency: null } })).toMatchObject({ ok: false, code: 'no-currency' })
    expect(en.format(decimal('1'), fromParameter, {})).toMatchObject({ ok: false, code: 'no-currency' })
    expect(en.format(decimal('1'), fromParameter, { params: { currency: 'chf' } })).toMatchObject({ ok: false, code: 'invalid-currency' })
    expect(en.format(decimal('1'), fromParameter, { params: { currency: 7n } })).toMatchObject({ ok: false, code: 'invalid-currency' })
  })
})

describe('dates', () => {
  // A date has no zone: 2026-01-01 is the first of January wherever the
  // report is rendered, so it is formatted in UTC whatever zone the
  // formatter has for instants. The two zones here are fourteen hours ahead
  // of UTC and eleven behind it, where a local midnight would fall on
  // another day.
  test.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'UTC'])('show a date as the same day in %s', (zone) => {
    expect(text(formatter('de-CH', zone).format({ type: 'date', value: '2026-01-01' }, date('long')))).toBe('1. Januar 2026')
    expect(text(formatter('en-US', zone).format({ type: 'date', value: '2026-01-01' }, date('short')))).toBe('1/1/26')
    expect(text(formatter('fr-CH', zone).format({ type: 'date', value: '2026-01-01' }, date('long')))).toBe('1 janvier 2026')
  })

  // A local date and time has no zone either, and shows as written.
  test('show a local date and time as written, in any zone', () => {
    const value: TypedValue = { type: 'datetime', value: '2026-01-01T09:30:00' }
    expect(text(formatter('de-CH', 'Pacific/Kiritimati').format(value, date('medium')))).toBe('01.01.2026, 09:30:00')
    expect(text(formatter('de-CH', 'Pacific/Pago_Pago').format(value, date('short')))).toBe('01.01.26, 09:30')
    expect(text(formatter('de-CH').format(value, date('long')))).toBe('1. Januar 2026 um 09:30:00')
  })

  // An instant is a moment, shown in the zone the render is for, which the
  // host names: never the zone of the machine it happens to run on.
  test('show an instant in the zone the formatter is for', () => {
    const value: TypedValue = { type: 'instant', value: '2025-12-31T23:30:00Z' }
    expect(text(formatter('de-CH', 'Europe/Zurich').format(value, date('medium')))).toBe('01.01.2026, 00:30:00')
    expect(text(formatter('de-CH', 'America/New_York').format(value, date('medium')))).toBe('31.12.2025, 18:30:00')
  })

  // Years before 100 are not read as 19xx, as Date.UTC would read them.
  test('show early years as written', () => {
    expect(text(formatter('de-CH').format({ type: 'date', value: '0005-01-01' }, date('long')))).toBe('1. Januar 5')
    expect(text(formatter('en').format({ type: 'date', value: '0001-01-01' }, date('long')))).toBe('January 1, 1')
  })

  // An expression reads a date as its ISO string (0009), so a date format
  // over an expression's string shows it as the date, date and time, or
  // instant it spells.
  test('show a string that spells a date, a date and time, or an instant', () => {
    const de = formatter('de-CH', 'Europe/Zurich')
    expect(text(de.format({ type: 'string', value: '2026-01-01' }, date('medium')))).toBe('01.01.2026')
    expect(text(de.format({ type: 'string', value: '2026-01-01T09:30:00' }, date('medium')))).toBe('01.01.2026, 09:30:00')
    expect(text(de.format({ type: 'string', value: '2026-01-01T08:00:00Z' }, date('medium')))).toBe('01.01.2026, 09:00:00')
  })
})

describe('text', () => {
  // Case follows the report's language: German has no capital sharp s, and
  // Turkish dots its capital i.
  test('transform case as the locale does', () => {
    expect(text(formatter('de-CH').format({ type: 'string', value: 'Straße' }, { kind: 'text', transform: 'upper' }))).toBe('STRASSE')
    expect(text(formatter('tr').format({ type: 'string', value: 'istanbul' }, { kind: 'text', transform: 'upper' }))).toBe('İSTANBUL')
    expect(text(formatter('en').format({ type: 'string', value: 'MiXeD' }, { kind: 'text', transform: 'lower' }))).toBe('mixed')
    expect(text(formatter('en').format({ type: 'string', value: 'as is' }, { kind: 'text' }))).toBe('as is')
  })

  // A text format displays anything that prints, as it prints plainly.
  test('transform what any value prints as', () => {
    expect(text(formatter('en').format({ type: 'boolean', value: true }, { kind: 'text', transform: 'upper' }))).toBe('TRUE')
    expect(text(formatter('en').format(decimal('12.50'), { kind: 'text' }))).toBe('12.50')
  })
})

describe('without a format', () => {
  // With no format a value prints as the format writes it: exact digits with
  // their scale, ISO dates, the instant in UTC. Nothing is interpreted.
  test.each<[string, TypedValue, string]>([
    ['string', { type: 'string', value: 'Grüezi' }, 'Grüezi'],
    ['integer', integer(-12n), '-12'],
    ['decimal', decimal('12.50'), '12.50'],
    ['boolean', { type: 'boolean', value: false }, 'false'],
    ['date', { type: 'date', value: '2026-01-01' }, '2026-01-01'],
    ['datetime', { type: 'datetime', value: '2026-01-01T09:30:00' }, '2026-01-01T09:30:00'],
    ['instant', { type: 'instant', value: '2026-01-01T08:00:00Z' }, '2026-01-01T08:00:00Z'],
  ])('prints a %s plainly', (_type, value, shown) => {
    expect(plainText(value)).toBe(shown)
    expect(text(formatter('de-CH').format(value, undefined))).toBe(shown)
  })

  // Null prints as nothing (0007), never as "null".
  test('prints null as nothing', () => {
    expect(plainText(null)).toBe('')
  })
})

describe('a column of values', () => {
  // A table formats every row of a column with one format: one formatter
  // does it, with each Intl formatter built once and used for every row.
  test('formats each value of a column alike', () => {
    const de = formatter('de-CH', 'Europe/Zurich')
    expect(['1', '22.5', '333.333'].map((value) => text(de.format(decimal(value), number(2, false))))).toEqual(['1.00', '22.50', '333.33'])
    const dates = ['2026-01-01', '2026-02-28'].map((value) => text(de.format({ type: 'date', value }, date('medium'))))
    expect(dates).toEqual(['01.01.2026', '28.02.2026'])
  })
})

describe('null', () => {
  // Null prints as nothing (0007), whatever the format, and an absent
  // currency does not matter when there is no amount.
  test.each<[string, Format | undefined]>([
    ['no format', undefined],
    ['a number', number(2)],
    ['a currency from a parameter', { kind: 'currency', currency: { kind: 'parameter', parameter: 'currency' }, scale: 2 }],
    ['a date', date('long')],
    ['text', { kind: 'text', transform: 'upper' }],
  ])('prints as nothing under %s', (_name, format) => {
    expect(text(formatter('en').format(null, format))).toBe('')
  })
})

describe('mismatches', () => {
  // report-spec checks a format against a field's type, but an expression's
  // type is known only when it runs; a format that cannot show the value
  // is an error, never a blank or a guess.
  test.each<[string, TypedValue, Format]>([
    ['a number format over a string', { type: 'string', value: '12' }, number(2)],
    ['a currency format over a date', { type: 'date', value: '2026-01-01' }, currency('CHF')],
    ['a date format over a decimal', decimal('1'), date('short')],
    ['a date format over a boolean', { type: 'boolean', value: true }, date('short')],
    ['a date format over a string that spells no date', { type: 'string', value: '2026-02-30' }, date('short')],
  ])('refuse %s', (_name, value, format) => {
    expect(formatter('en').format(value, format)).toMatchObject({ ok: false, code: 'format-type-mismatch' })
  })
})

describe('createFormatter', () => {
  // A locale Intl does not have would silently fall back to the host's
  // default, so the same report would print differently on another
  // machine; it is refused instead. A language Intl has with a region it
  // lacks falls back to the language, which reads the same everywhere.
  test('refuses a locale the engine does not have, and a malformed one', () => {
    expect(createFormatter({ locale: 'xx', timeZone: 'UTC' })).toMatchObject({ ok: false, code: 'unsupported-locale' })
    expect(createFormatter({ locale: 'en_US', timeZone: 'UTC' })).toMatchObject({ ok: false, code: 'unsupported-locale' })
    expect(supportedLocale('de-CH')).toBe(true)
    expect(supportedLocale('de-XX')).toBe(true)
    expect(supportedLocale('xx')).toBe(false)
  })

  // An instant is shown in a zone the host names; one Intl does not know is
  // refused rather than replaced by the machine's.
  test('refuses a time zone the engine does not know', () => {
    expect(createFormatter({ locale: 'en', timeZone: 'Mars/Olympus' })).toMatchObject({ ok: false, code: 'unsupported-time-zone' })
  })

  // A caller can tell which locale and zone a formatter prints for, as a
  // render records them (plan 14).
  test('keeps the locale and the zone it was made for', () => {
    expect(formatter('fr-CH', 'Europe/Zurich')).toMatchObject({ locale: 'fr-CH', timeZone: 'Europe/Zurich' })
  })
})
