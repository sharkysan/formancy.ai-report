import { Decimal, decimalToString } from '@formancy/expressions'
import { emptyReport, validateReport } from '@formancy/report-spec'
import type { FieldType, ParameterType, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { canonicalInstant, MAX_STRING_LENGTH, readValue } from './values.js'
import type { ValueErrorCode } from './values.js'

/** The value read, failing the test with the refusal when it was refused. */
function accepted(type: FieldType, raw: unknown, scale?: number): unknown {
  const read = readValue(type, raw, scale)
  if (!read.ok) throw new Error(`refused: ${read.code} ${read.message}`)
  return read.value
}

/** The code a refused value was refused with, or 'accepted'. */
function refusal(type: FieldType, raw: unknown, scale?: number): ValueErrorCode | 'accepted' {
  const read = readValue(type, raw, scale)
  return read.ok ? 'accepted' : read.code
}

const DIGEST = `sha256:${'ab'.repeat(32)}`

describe('strings', () => {
  // A string is printed as it is; nothing about its content is the
  // runtime's to change.
  test('are read as they are', () => {
    expect(accepted('string', 'Grüezi ✓ 😀')).toBe('Grüezi ✓ 😀')
  })

  // Every string an expression can be handed, and no longer: past the bound
  // upstream refuses to bind a value, so the data check refuses it first,
  // where it can say which field.
  test('are bounded at what an expression can be handed', () => {
    expect(accepted('string', 'x'.repeat(MAX_STRING_LENGTH))).toHaveLength(MAX_STRING_LENGTH)
    expect(refusal('string', 'x'.repeat(MAX_STRING_LENGTH + 1))).toBe('string-too-long')
  })

  // Half a surrogate pair is not text: a font draws something else for it,
  // so it would print a character nobody wrote.
  test.each([
    ['a high surrogate alone', 'a\uD83Db'],
    ['a low surrogate alone', 'a\uDE00b'],
    ['a high surrogate at the end', 'ab\uD83D'],
  ])('refuse %s', (_name, raw) => {
    expect(refusal('string', raw)).toBe('ill-formed-string')
  })

  // A string field holds text; a number in it would print as whatever
  // JavaScript makes of it.
  test.each([
    ['a number', 1],
    ['a boolean', true],
    ['an object', {}],
  ])('refuse %s', (_name, raw) => {
    expect(refusal('string', raw)).toBe('wrong-type')
  })
})

describe('integers', () => {
  // An integer travels as its exact digits and is held as a bigint, so one
  // past 2^53 keeps every digit.
  test.each([
    ['0', 0n],
    ['-5', -5n],
    ['123456789012345678901234567890', 123456789012345678901234567890n],
  ])('read %s exactly', (raw, value) => {
    expect(accepted('integer', raw)).toBe(value)
  })

  // One integer, one spelling: a sign other than '-', a leading zero, a
  // negative zero, a fraction or an exponent would each be a second way to
  // write a value, or not an integer at all.
  test.each(['', '+1', '01', '-0', '1.0', '1e3', ' 1', '1 ', '0x10', '١', '−1', '--1'])('refuse the string %j', (raw) => {
    expect(refusal('integer', raw)).toBe('invalid-integer')
  })

  // A JSON number is exact up to 2^53, so one in that range is taken and
  // converted; -0 is the integer 0.
  test.each([
    [42, 42n],
    [-0, 0n],
    [Number.MAX_SAFE_INTEGER, 9007199254740991n],
    [Number.MIN_SAFE_INTEGER, -9007199254740991n],
  ])('read the number %d', (raw, value) => {
    expect(accepted('integer', raw)).toBe(value)
  })

  // Past 2^53 a number has already lost digits before the runtime sees it,
  // so it is refused with a code that says so, not read as some other
  // integer.
  test('refuse a number past 2^53, saying it has lost digits', () => {
    const read = readValue('integer', 2 ** 53)
    expect(read).toEqual({ ok: false, code: 'unsafe-integer', message: expect.stringContaining('as a string') })
  })

  // A number that is not a whole one is no integer, and is not rounded into
  // one.
  test.each([
    ['a fraction', 1.5],
    ['NaN', Number.NaN],
    ['infinity', Number.POSITIVE_INFINITY],
  ])('refuse %s', (_name, raw) => {
    expect(refusal('integer', raw)).toBe('invalid-integer')
  })

  // JSON has no bigint, and the data is JSON: what a host cannot store it
  // cannot reproduce.
  test.each([
    ['a bigint', 5n],
    ['a boolean', false],
  ])('refuse %s', (_name, raw) => {
    expect(refusal('integer', raw)).toBe('wrong-type')
  })
})

describe('decimals', () => {
  // A decimal keeps its scale: 12.50 is a price written to the cent.
  test('read a decimal string exactly, keeping its scale', () => {
    const value = accepted('decimal', '12.50') as Decimal
    expect(value).toBeInstanceOf(Decimal)
    expect([value.units, value.scale]).toEqual([1250n, 2])
    expect(decimalToString(accepted('decimal', '99999999999999999999.99') as Decimal)).toBe('99999999999999999999.99')
    expect(decimalToString(accepted('decimal', '-0.5') as Decimal)).toBe('-0.5')
  })

  // A float has already lost digits -- 0.1 is not one tenth -- so a decimal
  // as a JavaScript number is refused with a code that says why.
  test('refuse a number, saying floats lose digits', () => {
    const read = readValue('decimal', 12.5)
    expect(read).toEqual({ ok: false, code: 'decimal-as-number', message: expect.stringContaining('floats lose digits') })
  })

  // Only the canonical spelling: a second spelling of one value -- '+1',
  // '01.5', '-0' -- or a locale's ('1,5') is refused, not guessed at.
  test.each(['-0', '-0.00', '+1', '01.5', '1.', '.5', '1e2', '1,5', ' 1.5', '1.5 ', '', '0x1', '1_000'])('refuse the string %j', (raw) => {
    expect(refusal('decimal', raw)).toBe('invalid-decimal')
  })

  // A value with more places than the contract declares is not the value
  // the contract promised: rounding it here would print a different number
  // than the source holds.
  test('refuse more places than the field declares, and accept fewer', () => {
    expect(refusal('decimal', '1.234', 2)).toBe('decimal-scale')
    expect(decimalToString(accepted('decimal', '1.2', 2) as Decimal)).toBe('1.2')
  })

  // Without a declared scale, a decimal has as many places as upstream's
  // Decimal holds, and no more.
  test('refuse more than 20 places when the field declares none', () => {
    expect(decimalToString(accepted('decimal', `0.${'1'.repeat(20)}`) as Decimal)).toBe(`0.${'1'.repeat(20)}`)
    expect(refusal('decimal', `0.${'1'.repeat(21)}`)).toBe('decimal-scale')
  })

  // A decimal is only ever the string of its digits: data is JSON, and what
  // JSON cannot carry a host could not store, so could not reproduce.
  test.each([
    ['a bigint', 5n],
    ['a Decimal', new Decimal(5n, 0)],
    ['a boolean', true],
  ])('refuse %s', (_name, raw) => {
    expect(refusal('decimal', raw)).toBe('wrong-type')
  })
})

describe('booleans', () => {
  // A boolean field holds exactly true or false.
  test('read true and false', () => {
    expect(accepted('boolean', true)).toBe(true)
    expect(accepted('boolean', false)).toBe(false)
  })

  // 'true', 1 and 0 are other types: a boolean is not guessed from them.
  test.each([['true'], [1], [0]])('refuse %j', (raw) => {
    expect(refusal('boolean', raw)).toBe('wrong-type')
  })
})

describe('dates', () => {
  // A date is a calendar day with no zone; it travels and is held as its
  // ISO string.
  test.each(['2024-02-29', '2026-01-01', '0001-01-01', '9999-12-31'])('read %s', (raw) => {
    expect(accepted('date', raw)).toBe(raw)
  })

  // A day that is not on the calendar, or another syntax, is refused, not
  // rolled over to the next real day as Date would. So is the year 0000:
  // Intl shows the proleptic year 0 as the year 1 -- 1 BC without its era
  // -- so 0000-01-01 printed as 'January 1, 1', a year nobody wrote.
  test.each(['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-1-1', '2026-01-01T00:00:00', '01.01.2026', '', '0000-01-01'])('refuse %j', (raw) => {
    expect(refusal('date', raw)).toBe('invalid-date')
  })

  // A Date is a moment in some zone, not a calendar day: it is not data,
  // and the day it would give depends on the host.
  test('refuse a Date object', () => {
    expect(refusal('date', new Date(0))).toBe('wrong-type')
  })
})

describe('date-times', () => {
  // A local date and time has no zone: it is held as written, its fraction
  // without trailing zeros, so one moment has one spelling.
  test.each([
    ['2026-01-01T09:30:00', '2026-01-01T09:30:00'],
    ['2026-01-01T09:30:00.120', '2026-01-01T09:30:00.12'],
    ['2026-01-01T09:30:00.000', '2026-01-01T09:30:00'],
    ['2026-01-01T09:30:00.123456789', '2026-01-01T09:30:00.123456789'],
    ['2024-02-29T23:59:59', '2024-02-29T23:59:59'],
  ])('read %s as %s', (raw, value) => {
    expect(accepted('datetime', raw)).toBe(value)
  })

  // A zone would make it an instant; anything past the clock -- 24:00, a
  // sixtieth minute, a leap second Date cannot hold -- or a day that does
  // not exist is refused.
  test.each([
    '2026-01-01T09:30:00Z',
    '2026-01-01T09:30:00+01:00',
    '2026-01-01T09:30',
    '2026-01-01T24:00:00',
    '2026-01-01T09:60:00',
    '2026-01-01T09:30:60',
    '2026-02-30T09:30:00',
    '2026-01-01t09:30:00',
    '2026-01-01 09:30:00',
    '2026-01-01T09:30:00.1234567890',
    '0000-06-30T12:00:00',
  ])('refuse %j', (raw) => {
    expect(refusal('datetime', raw)).toBe('invalid-datetime')
  })
})

describe('instants', () => {
  // An instant is a moment: held in UTC, so that two spellings of one
  // moment are one value, and sort and group as one.
  test.each([
    ['2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z'],
    ['2026-01-01T10:00:00+02:00', '2026-01-01T08:00:00Z'],
    ['2026-01-01T00:30:00+01:00', '2025-12-31T23:30:00Z'],
    ['2025-12-31T23:30:00-05:30', '2026-01-01T05:00:00Z'],
    ['2026-01-01T10:00:00-00:00', '2026-01-01T10:00:00Z'],
    ['2026-01-01T10:00Z', '2026-01-01T10:00:00Z'],
    ['2026-01-01T10:00:00.500+01:00', '2026-01-01T09:00:00.5Z'],
    ['2026-01-01T10:00:00.123456789Z', '2026-01-01T10:00:00.123456789Z'],
    ['2024-02-29T00:00:00+14:00', '2024-02-28T10:00:00Z'],
    ['0005-03-01T00:00:00+01:00', '0005-02-28T23:00:00Z'],
  ])('read %s as %s', (raw, value) => {
    expect(accepted('instant', raw)).toBe(value)
  })

  // Without a zone a moment would be read in the host's zone, which a
  // render elsewhere does not share; a year outside 0001-9999 once in UTC
  // has no four-digit spelling, or one Intl does not print as written.
  test.each([
    '2026-01-01T10:00:00',
    '2026-01-01',
    '2026-02-30T10:00:00Z',
    '2026-01-01T10:00:00+24:00',
    '2026-01-01T10:00:00+02:60',
    '2026-01-01T10:00:60Z',
    '2026-01-01T10:00:00z',
    '9999-12-31T23:00:00-05:00',
    '0000-01-01T00:30:00+01:00',
    '0000-06-30T12:00:00Z',
    '0001-01-01T00:30:00+01:00',
  ])('refuse %j', (raw) => {
    expect(refusal('instant', raw)).toBe('invalid-instant')
  })

  // What an expression gives back for a timestamp is RFC 3339 in UTC; the
  // same canonical spelling makes it comparable with the data's.
  test('canonicalInstant gives the spelling the data check holds', () => {
    expect(canonicalInstant('2026-01-01T08:00:00.500Z')).toBe('2026-01-01T08:00:00.5Z')
    // Only trailing zeros go: an inner zero is a digit of the time, and a
    // fraction of zeros alone is no fraction at all.
    expect(canonicalInstant('2026-01-01T08:00:00.050Z')).toBe('2026-01-01T08:00:00.05Z')
    expect(canonicalInstant('2026-01-01T08:00:00.000000000Z')).toBe('2026-01-01T08:00:00Z')
    expect(canonicalInstant('not an instant')).toBeUndefined()
  })
})

describe('images', () => {
  // An image field's value names an approved asset by id and pins its bytes
  // by digest, as report-spec's assets do; the host resolves it, and the
  // runtime never fetches anything.
  test('read an asset id and its digest into a frozen copy', () => {
    const raw = { asset: 'signature-7', digest: DIGEST }
    const value = accepted('image', raw)
    expect(value).toEqual(raw)
    expect(value).not.toBe(raw)
    expect(Object.isFrozen(value)).toBe(true)
  })

  // An address is never a value: an image is named, and its bytes pinned.
  test.each([
    ['a URL', 'https://example.com/logo.png'],
    ['an extra property', { asset: 'logo', digest: DIGEST, url: 'https://example.com' }],
    ['no digest', { asset: 'logo' }],
    ['an upper-case digest', { asset: 'logo', digest: `sha256:${'AB'.repeat(32)}` }],
    ['another algorithm', { asset: 'logo', digest: `md5:${'ab'.repeat(16)}` }],
    ['an id that is not an identifier', { asset: 'Logo', digest: DIGEST }],
    ['an id as a number', { asset: 7, digest: DIGEST }],
    ['an array', [DIGEST]],
  ])('refuse %s', (_name, raw) => {
    expect(refusal('image', raw)).toBe('invalid-image')
  })

  // An image's id or digest behind a getter could answer differently each
  // time it is read; it is refused unrun.
  test('refuse a getter without running it', () => {
    let ran = false
    const raw = {
      asset: 'logo',
      get digest(): string {
        ran = true
        return DIGEST
      },
    }
    expect(refusal('image', raw)).toBe('invalid-image')
    expect(ran).toBe(false)
  })
})

describe('wrong types', () => {
  // A refusal names the type it found, so the author knows what the
  // provider sent without the value being repeated.
  test.each<[FieldType, unknown, string]>([
    ['string', null, 'found null'],
    ['integer', [], 'found a list'],
    ['decimal', new Date(0), 'found a Date'],
    ['decimal', new Decimal(1n, 0), 'found a Decimal'],
    ['date', {}, 'found an object'],
    ['datetime', 5, 'found a number'],
    ['instant', new Date(0), 'found a Date'],
    ['boolean', 'true', 'found a string'],
  ])('a %s refuses what it is not, saying so', (type, raw, found) => {
    expect(readValue(type, raw)).toEqual({ ok: false, code: 'wrong-type', message: expect.stringContaining(found) })
  })
})

describe('messages', () => {
  // The data is the customer's: a refusal says what was expected and never
  // repeats what was found, however short.
  test.each<[FieldType, unknown]>([
    ['string', 'SECRET\uD800'],
    ['integer', 'SECRET'],
    ['integer', 2 ** 60],
    ['decimal', 'SECRET'],
    ['decimal', 12345.678],
    ['date', 'SECRET'],
    ['datetime', 'SECRET'],
    ['instant', 'SECRET'],
    ['image', { asset: 'SECRET', digest: 'SECRET' }],
  ])('a refused %s never quotes the value', (type, raw) => {
    const read = readValue(type, raw)
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect(read.message).not.toContain('SECRET')
    expect(read.message).not.toContain('12345')
    expect(read.message).not.toContain(String(2 ** 60))
  })
})

describe('agreement with report-spec', () => {
  /** Whether report-spec accepts `value` as the default of a parameter of `type`. */
  function specAccepts(type: ParameterType, value: string): boolean {
    const report: ReportDefinition = { ...emptyReport('probe', 'Probe', 'en'), parameters: [{ id: 'probe', type, label: 'Probe', required: false, default: value }] }
    return validateReport(report).valid
  }

  // A parameter's default is written by the format's own syntax, and a value
  // from the data must be read by the same one: if the two ever disagreed, a
  // default the editor accepts could be refused at render, or the reverse.
  // Each candidate is put to both.
  test.each<[ParameterType, string]>([
    ...['0', '-5', '12', '+1', '01', '-0', '1.0', '1e3', ' 1', '', '١'].map((value): [ParameterType, string] => ['integer', value]),
    ...['12.50', '0', '0.00', '-0.5', '-0', '-0.00', '+1', '01.5', '1.', '.5', '1e2', '1,5', ''].map((value): [ParameterType, string] => ['decimal', value]),
    ...['2024-02-29', '2026-02-29', '2026-04-31', '0000-01-01', '0001-01-01', '2026-1-1', '2026-01-01T00:00:00'].map((value): [ParameterType, string] => ['date', value]),
  ])('a %s default %j is accepted by both or refused by both', (type, value) => {
    expect(readValue(type, value).ok).toBe(specAccepts(type, value))
  })

  /** Whether report-spec accepts `digest` and `id` for an asset reference. */
  function specAcceptsAsset(id: string, digest: string): boolean {
    const report: ReportDefinition = { ...emptyReport('probe', 'Probe', 'en'), assets: [{ id, mediaType: 'image/png', digest }] }
    return validateReport(report).valid
  }

  // An image field's value names an asset as a template's asset reference
  // does, so the two syntaxes must agree.
  test.each([
    ['logo', DIGEST],
    ['logo-2', DIGEST],
    ['Logo', DIGEST],
    ['2logo', DIGEST],
    ['logo', `sha256:${'AB'.repeat(32)}`],
    ['logo', `sha256:${'ab'.repeat(31)}`],
    ['logo', `sha512:${'ab'.repeat(32)}`],
  ])('an asset %j with digest %j is accepted by both or refused by both', (asset, digest) => {
    expect(readValue('image', { asset, digest }).ok).toBe(specAcceptsAsset(asset, digest))
  })
})
