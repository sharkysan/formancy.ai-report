import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { decimalDigits, integerDigits, MAX_EXACT_DIGITS } from './numbers.js'

/**
 * The number rule (0042): a formancy `number` answer is a double, and a
 * report prints exact digits. The rule turns a double into digits and never
 * digits into a double: a safe integer is its digits; any other number
 * nearer zero than 2^53 is the shortest decimal that is that double, when
 * it has at most 15 significant digits, which every decimal of at most 15
 * significant digits typed into a double comes back as; anything else is
 * refused, never rounded.
 *
 * The 15 is written here, never read from the module under test: a test
 * that took its bound from `MAX_EXACT_DIGITS` would pass whatever the bound
 * was, and a bound of 10 would refuse every typed decimal of 11 digits.
 */

/** IEEE 754's 15 decimal digits, written out. */
const FIFTEEN = 15

/** Past it, a double has lost an integer's last digits, and every double is a whole number. */
const SAFE = 2 ** 53

/** The smallest normal double: below it a double holds fewer than 15 decimal digits. */
const MIN_NORMAL = 2 ** -1022

/** `digits` times ten to `exponent`, written without an exponent, no leading or trailing zero, "-" for a negative one: the reference the rule is held to. */
function plain(negative: boolean, digits: bigint, exponent: number): string {
  let mantissa = digits
  let power = exponent
  while (mantissa % 10n === 0n && mantissa !== 0n) {
    mantissa /= 10n
    power += 1
  }
  const text = mantissa.toString()
  const body =
    power >= 0
      ? `${text}${'0'.repeat(power)}`
      : text.length > -power
        ? `${text.slice(0, power)}.${text.slice(power)}`
        : `0.${'0'.repeat(-power - text.length)}${text}`
  return negative && mantissa !== 0n ? `-${body}` : body
}

/**
 * A decimal of 1 to `digits` significant digits, from 10^-300 to below
 * 10^`digits`: a normal double, nowhere near the subnormals, and, for 15
 * digits, below 10^15 and so below 2^53.
 */
const decimals = (digits: number) =>
  fc
    .record({ negative: fc.boolean(), digits: fc.bigInt({ min: 1n, max: 10n ** BigInt(digits) - 1n }) })
    .chain((decimal) => fc.integer({ min: -300, max: digits - decimal.digits.toString().length }).map((exponent) => ({ ...decimal, exponent })))

/** Whether a double is a number a decimal field prints, by `toPrecision`, which is not how the rule finds its digits. */
const exact = (value: number): boolean =>
  Number.isSafeInteger(value) || (Math.abs(value) < SAFE && Math.abs(value) >= MIN_NORMAL && Number(value.toPrecision(FIFTEEN)) === value)

describe('the number rule', () => {
  // The bound is the one the property below proves, and no other: a bound
  // of 14 would refuse a typed 1234.56789012345, and one of 17 print a
  // computed 0.1 + 0.2 as 0.30000000000000004.
  test('keeps fifteen significant digits', () => {
    expect(MAX_EXACT_DIGITS).toBe(FIFTEEN)
  })

  // The property the rule rests on, proved here rather than cited: any
  // decimal of at most 15 significant digits, typed into a double, comes
  // back as exactly its digits. Were it not so, a typed 0.1 or 1234.56
  // could print as something nobody wrote.
  test('every decimal of at most 15 significant digits comes back through a double as its own digits', () => {
    fc.assert(
      fc.property(decimals(FIFTEEN), ({ negative, digits, exponent }) => {
        const typed = Number(`${negative ? '-' : ''}${digits}e${exponent}`)
        expect(decimalDigits(typed)).toEqual({ ok: true, digits: plain(negative, digits, exponent) })
      }),
      { numRuns: 20_000 },
    )
  })

  // One past it, and the double no longer says which decimal was typed: it
  // is refused, never rounded to fifteen digits, which would print a number
  // the form never held. Past 2^53 a double has lost an integer's last
  // digits, as it has for an integer field, however short its shortest
  // decimal: a typed 10000000000000001 is stored as 1e16. Accepted exactly
  // when `exact` says so, and what is accepted is exactly the double.
  test('any other double is refused, and what is accepted is exactly the double', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (value) => {
        const read = decimalDigits(value)
        expect(read.ok, String(value)).toBe(exact(value))
        if (read.ok) {
          expect(Number(read.digits)).toBe(value + 0)
          expect(read.digits).toMatch(/^(?:0|-?[1-9]\d*(?:\.\d*[1-9])?|-?0\.\d*[1-9])$/)
        }
      }),
      { numRuns: 20_000 },
    )
    fc.assert(
      fc.property(decimals(17), ({ negative, digits, exponent }) => {
        const value = Number(`${negative ? '-' : ''}${digits}e${exponent}`)
        expect(decimalDigits(value).ok, String(value)).toBe(exact(value))
      }),
      { numRuns: 20_000 },
    )
  })

  // The cases a reader of a form meets, by name: fifteen digits typed come
  // back, sixteen do not; a computed 0.1 + 0.2 is binary arithmetic's 17
  // digits, and printed it would be a number nobody typed; trailing zeros
  // are gone in a double, and the field's scale is what prints them; a
  // small number is written out, with no exponent the runtime would refuse;
  // and a number past 2^53 has lost its last digits, as an integer field
  // says of the same double.
  test('reads a typed decimal, refuses a computed one, and writes no exponent', () => {
    expect(decimalDigits(123456789.012345)).toEqual({ ok: true, digits: '123456789.012345' })
    expect(decimalDigits(-0.000123456789012345)).toEqual({ ok: true, digits: '-0.000123456789012345' })
    expect(decimalDigits(1234567890.123456).ok).toBe(false)
    expect(decimalDigits(0.1 + 0.2).ok).toBe(false)
    expect(decimalDigits(1.5)).toEqual({ ok: true, digits: '1.5' })
    expect(decimalDigits(1.5)).toEqual(decimalDigits(1.5))
    expect(decimalDigits(-0.05)).toEqual({ ok: true, digits: '-0.05' })
    expect(decimalDigits(1e-7)).toEqual({ ok: true, digits: '0.0000001' })
    expect(decimalDigits(-0)).toEqual({ ok: true, digits: '0' })
    expect(decimalDigits(SAFE - 1)).toEqual({ ok: true, digits: '9007199254740991' })
    // eslint-disable-next-line no-loss-of-precision -- the literal is the subject: 10^16 + 1 is a number JavaScript has already rounded
    for (const past of [SAFE, 10000000000000001, 1e21, -(2 ** 60), 1e300]) expect(decimalDigits(past).ok, String(past)).toBe(false)
    expect(decimalDigits(123456789012345.6).ok).toBe(false)
    // What the rule cannot see, said here so that nobody reads more into it: formancy stored the 17 digits typed as the double 0.1.
    expect(decimalDigits(0.10000000000000001)).toEqual({ ok: true, digits: '0.1' })
    expect(decimalDigits(5e-324).ok).toBe(false)
    expect(decimalDigits(Number.NaN).ok).toBe(false)
    expect(decimalDigits(Number.POSITIVE_INFINITY).ok).toBe(false)
  })

  // An integer field prints whole numbers. A double holds every integer up
  // to 2^53 exactly, and past it has lost its last digits; a fraction is
  // not an integer, and rounded it would print another count than the form
  // holds.
  test('an integer is a safe integer, as its digits, and nothing else', () => {
    fc.assert(
      fc.property(fc.maxSafeInteger(), (value) => {
        expect(integerDigits(value)).toEqual({ ok: true, digits: BigInt(value).toString() })
      }),
    )
    fc.assert(
      fc.property(fc.double({ noNaN: true }), (value) => {
        expect(integerDigits(value).ok).toBe(Number.isSafeInteger(value))
      }),
    )
    expect(integerDigits(-0)).toEqual({ ok: true, digits: '0' })
    expect(integerDigits(SAFE).ok).toBe(false)
    expect(integerDigits(2.5).ok).toBe(false)
  })

  // A refusal says why without the number: an answer is the customer's,
  // and a message ends up in a log.
  test('a refusal says why, and never the number', () => {
    for (const read of [decimalDigits(0.1 + 0.2), decimalDigits(1e16), integerDigits(2.5), integerDigits(2 ** 60), decimalDigits(5e-324)]) {
      expect(read.ok).toBe(false)
      if (!read.ok) expect(read.message).not.toMatch(/0\.3|2\.5|1152921504606846976|10000000000000000|1e\+?16|5e-324|4\.94/)
    }
  })
})
