import { Decimal, decimalFromString, decimalToString, roundDecimal } from '@formancy/expressions'
import type { Rounding, RoundingMode } from '@formancy/report-spec'
import { ROUNDING_MODES } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { averageDecimals, maxDecimal, minDecimal, roundDecimalAs, sumDecimals } from './decimal.js'
import { below, seeded } from './test-support.js'

const dec = (text: string): Decimal => decimalFromString(text)
const text = (value: Decimal | null): string | null => (value === null ? null : decimalToString(value))
const round = (value: string, rounding: Rounding): string => decimalToString(roundDecimalAs(dec(value), rounding))

/*
 * The reference: the same rules worked another way, on BigInt alone and on
 * strings it takes apart itself, sharing no code with decimal.ts or with
 * @formancy/expressions. decimal.ts truncates and steps away from zero;
 * this floors and steps up. If the two ever disagree, a generated case below
 * names the value, the rounding and both answers.
 */

/** A decimal string as units over a power of ten, taken apart by hand. */
function parts(value: string): { units: bigint; scale: number } {
  const [whole, fraction = ''] = value.split('.')
  return { units: BigInt(`${whole}${fraction}`.replace(/^(-?)0+(?=\d)/, '$1')), scale: fraction.length }
}

/** `units` at `scale` written out, by hand. */
function written(units: bigint, scale: number): string {
  const negative = units < 0n
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0')
  const point = digits.length - scale
  return `${negative ? '-' : ''}${digits.slice(0, point)}${scale === 0 ? '' : `.${digits.slice(point)}`}`
}

/** numerator / denominator (denominator > 0) rounded as `rounding` says, by flooring. */
function reference(numerator: bigint, denominator: bigint, { scale, mode, increment }: Rounding): string {
  const step = increment === undefined ? { units: 1n, scale } : parts(increment)
  const t = numerator * 10n ** BigInt(step.scale)
  const u = denominator * step.units
  let floor = t / u
  if (t % u !== 0n && t < 0n) floor -= 1n
  const twice = 2n * (t - floor * u)
  let k: bigint
  if (twice < u) k = floor
  else if (twice > u) k = floor + 1n
  else if (mode === 'half-even') k = floor % 2n === 0n ? floor : floor + 1n
  else k = t < 0n ? floor : floor + 1n
  return written(k * step.units * 10n ** BigInt(scale - step.scale), scale)
}

/** A decimal string from `next`: up to 24 whole digits, up to 10 places, either sign; often an exact tie for `rounding`. */
function generated(next: () => number, rounding: Rounding): string {
  const sign = next() < 0.5 ? '-' : ''
  if (next() < 0.5) {
    // A tie: an odd number of half steps.
    const step = rounding.increment === undefined ? { units: 1n, scale: rounding.scale } : parts(rounding.increment)
    const halves = BigInt(below(next, 100_000)) * 2n + 1n
    const units = halves * step.units * 5n
    const value = written(units, step.scale + 1)
    return value === '0' ? value : `${sign}${value}`
  }
  const whole = String(below(next, 10 ** 9)) + (next() < 0.3 ? String(below(next, 10 ** 15)).padStart(15, '0') : '')
  const places = below(next, 11)
  const fraction = Array.from({ length: places }, () => below(next, 10)).join('')
  const value = written(parts(`${whole}${places === 0 ? '' : `.${fraction}`}`).units, places)
  return /^0(\.0*)?$/.test(value) ? value : `${sign}${value}`
}

const INCREMENTS = [undefined, '0.05', '0.25', '0.5', '5', '0.002', '0.01'] as const

/** A declared rounding from `next`: every mode, scales 0 to 6, and increments with no more places than the scale. */
function rounding(next: () => number): Rounding {
  const mode = ROUNDING_MODES[below(next, ROUNDING_MODES.length)] as RoundingMode
  const increment = INCREMENTS[below(next, INCREMENTS.length)]
  const places = increment === undefined ? 0 : (increment.split('.')[1]?.length ?? 0)
  const scale = places + below(next, 4)
  return increment === undefined ? { scale, mode } : { scale, mode, increment }
}

describe('roundDecimalAs', () => {
  // The two modes differ only on a tie, and there exactly as named: half
  // away from zero is commercial rounding, half to even is banker's.
  test.each([
    ['2.5', 0, '3', '2'],
    ['3.5', 0, '4', '4'],
    ['-2.5', 0, '-3', '-2'],
    ['-0.5', 0, '-1', '0'],
    ['0.125', 2, '0.13', '0.12'],
    ['0.135', 2, '0.14', '0.14'],
    ['2.4999999999999999999', 0, '2', '2'],
    ['-2.5000000000000000001', 0, '-3', '-3'],
  ])('rounds %s to %d places as %s half away from zero and %s half to even', (value, scale, away, even) => {
    expect(round(value, { scale, mode: 'half-away-from-zero' })).toBe(away)
    expect(round(value, { scale, mode: 'half-even' })).toBe(even)
  })

  // Swiss cash rounding: to a multiple of 0.05, ties by the declared mode.
  test.each([
    ['1.024', '1.00', '1.00'],
    ['1.025', '1.05', '1.00'],
    ['1.026', '1.05', '1.05'],
    ['1.075', '1.10', '1.10'],
    ['-1.025', '-1.05', '-1.00'],
    ['19.97', '19.95', '19.95'],
    ['19.98', '20.00', '20.00'],
  ])('rounds %s to a multiple of 0.05 as %s half away and %s half even', (value, away, even) => {
    expect(round(value, { scale: 2, mode: 'half-away-from-zero', increment: '0.05' })).toBe(away)
    expect(round(value, { scale: 2, mode: 'half-even', increment: '0.05' })).toBe(even)
  })

  // The result has exactly the declared scale, so a total prints with the
  // places the author declared even when the value has fewer.
  test('gives exactly the declared scale', () => {
    expect(round('1.5', { scale: 3, mode: 'half-even' })).toBe('1.500')
    expect(round('7', { scale: 2, mode: 'half-even', increment: '0.25' })).toBe('7.00')
  })

  // A negative value that rounds to nothing is zero, not minus zero: a
  // printed "-0.00" is a different number to anyone reading it.
  test('never gives a negative zero', () => {
    expect(round('-0.004', { scale: 2, mode: 'half-away-from-zero' })).toBe('0.00')
  })

  // An increment with more places than the scale cannot be kept at that
  // scale, and one of zero or less rounds to nothing; report-spec refuses
  // both, and a report that reached here anyway is a defect, not a total.
  test.each([
    [{ scale: 1, mode: 'half-even', increment: '0.05' }],
    [{ scale: 2, mode: 'half-even', increment: '0' }],
    [{ scale: 2, mode: 'half-even', increment: '-0.05' }],
  ] as [Rounding][])('throws for %j', (declared) => {
    expect(() => roundDecimalAs(dec('1.00'), declared)).toThrow(RangeError)
  })

  // Generated: 4000 values, half of them exact ties, under every mode and a
  // range of scales and increments, each against the reference.
  test('agrees with the BigInt reference on generated values', () => {
    const next = seeded(20261015)
    for (let index = 0; index < 4000; index++) {
      const declared = rounding(next)
      const value = generated(next, declared)
      const { units, scale } = parts(value)
      expect({ value, declared, rounded: round(value, declared) }).toEqual({ value, declared, rounded: reference(units, 10n ** BigInt(scale), declared) })
    }
  })

  // A third witness: without an increment, half away from zero is exactly
  // upstream's own roundDecimal.
  test('agrees with upstream roundDecimal half away from zero', () => {
    const next = seeded(7)
    for (let index = 0; index < 2000; index++) {
      const declared: Rounding = { scale: below(next, 8), mode: 'half-away-from-zero' }
      const value = generated(next, declared)
      expect({ value, rounded: round(value, declared) }).toEqual({ value, rounded: decimalToString(roundDecimal(dec(value), declared.scale)) })
    }
  })
})

describe('sumDecimals', () => {
  // A sum is exact: 0.1 + 0.2 is 0.3, which a float never gives.
  test('adds exactly, at the largest scale it meets', () => {
    expect(text(sumDecimals([dec('0.1'), dec('0.2')]))).toBe('0.3')
    expect(text(sumDecimals([dec('1.50'), dec('2'), dec('-0.125')]))).toBe('3.375')
    expect(text(sumDecimals([dec('99999999999999999999.99'), dec('0.01')]))).toBe('100000000000000000000.00')
  })

  // Over no values a sum is 0 (0007).
  test('is 0 over no values', () => {
    expect(text(sumDecimals([]))).toBe('0')
  })

  // Generated: 500 lists of up to 40 values at mixed scales, each sum
  // against the reference's.
  test('agrees with the BigInt reference on generated lists', () => {
    const next = seeded(42)
    for (let index = 0; index < 500; index++) {
      const values = Array.from({ length: below(next, 40) }, () => generated(next, { scale: 2, mode: 'half-even' }))
      const scale = Math.max(0, ...values.map((value) => parts(value).scale))
      const units = values.reduce((total, value) => total + parts(value).units * 10n ** BigInt(scale - parts(value).scale), 0n)
      expect({ values, sum: text(sumDecimals(values.map(dec))) }).toEqual({ values, sum: written(units, scale) })
    }
  })
})

describe('minDecimal and maxDecimal', () => {
  // Compared by value, not by spelling: 1.50 and 1.5 are equal, 10 is more
  // than 9.99, and of equal values the first is kept.
  test('compare by value and keep the first of equals', () => {
    expect(text(minDecimal([dec('10'), dec('9.99'), dec('-0.5'), dec('-0.50')]))).toBe('-0.5')
    expect(text(maxDecimal([dec('1.5'), dec('1.50'), dec('-3')]))).toBe('1.5')
    expect(text(maxDecimal([dec('1.50'), dec('1.5')]))).toBe('1.50')
  })

  // Over no values neither has one, and null prints as nothing (0007).
  test('are null over no values', () => {
    expect(minDecimal([])).toBeNull()
    expect(maxDecimal([])).toBeNull()
  })

  // Generated: 500 lists, each extreme against the reference's, which
  // compares every value at one scale by hand.
  test('agree with the BigInt reference on generated lists', () => {
    const next = seeded(99)
    for (let index = 0; index < 500; index++) {
      const values = Array.from({ length: 1 + below(next, 30) }, () => generated(next, { scale: 3, mode: 'half-even' }))
      const scaled = values.map((value) => parts(value).units * 10n ** BigInt(20 - parts(value).scale))
      const least = values[scaled.indexOf(scaled.reduce((a, b) => (b < a ? b : a)))] as string
      const most = values[scaled.indexOf(scaled.reduce((a, b) => (b > a ? b : a)))] as string
      expect({ values, min: text(minDecimal(values.map(dec))), max: text(maxDecimal(values.map(dec))) }).toEqual({ values, min: least, max: most })
    }
  })
})

describe('averageDecimals', () => {
  // An average is the exact sum over the count, rounded once, by the
  // declared rule: 1, 1 and 2 average 1.333..., never a float's 1.3333333.
  test('rounds the exact quotient once, as declared', () => {
    expect(text(averageDecimals([dec('1'), dec('1'), dec('2')], { scale: 2, mode: 'half-even' }))).toBe('1.33')
    expect(text(averageDecimals([dec('0.01'), dec('0.02')], { scale: 2, mode: 'half-even' }))).toBe('0.02')
    expect(text(averageDecimals([dec('0.01'), dec('0.02')], { scale: 2, mode: 'half-away-from-zero' }))).toBe('0.02')
    expect(text(averageDecimals([dec('0.01'), dec('0.04')], { scale: 2, mode: 'half-even' }))).toBe('0.02')
    expect(text(averageDecimals([dec('0.01'), dec('0.04')], { scale: 2, mode: 'half-away-from-zero' }))).toBe('0.03')
    expect(text(averageDecimals([dec('10.00'), dec('10.10')], { scale: 2, mode: 'half-even', increment: '0.05' }))).toBe('10.05')
  })

  // Over no values an average has none (0007), rather than dividing by zero.
  test('is null over no values', () => {
    expect(averageDecimals([], { scale: 2, mode: 'half-even' })).toBeNull()
  })

  // Generated: 1000 lists under every mode and increment, each average
  // against the reference's rounding of the exact quotient.
  test('agrees with the BigInt reference on generated lists', () => {
    const next = seeded(1234)
    for (let index = 0; index < 1000; index++) {
      const declared = rounding(next)
      const values = Array.from({ length: 1 + below(next, 12) }, () => generated(next, declared))
      const scale = Math.max(...values.map((value) => parts(value).scale))
      const units = values.reduce((total, value) => total + parts(value).units * 10n ** BigInt(scale - parts(value).scale), 0n)
      const expected = reference(units, BigInt(values.length) * 10n ** BigInt(scale), declared)
      expect({ values, declared, average: text(averageDecimals(values.map(dec), declared)) }).toEqual({ values, declared, average: expected })
    }
  })
})
