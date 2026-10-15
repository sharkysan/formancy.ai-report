/**
 * Exact totals and declared rounding, over `@formancy/expressions`'
 * `Decimal`: a value as an integer of units at a scale, so that nothing here
 * ever passes through a JavaScript number.
 *
 * Totals are decided once, here (0007): a sum is exact at the largest scale
 * it meets, a minimum or maximum compares by value, and an average is the
 * exact quotient rounded once, by the rule the aggregate declares. Rounding
 * follows report-spec's `Rounding`: to a multiple of `increment` when one is
 * given -- 0.05 for Swiss cash rounding -- and otherwise to `scale` places,
 * ties going by `mode` either way, and the result at exactly `scale` places.
 *
 * Upstream's own `roundDecimal` rounds half away from zero to a number of
 * places and nothing else; a declared rounding also has half to even and an
 * increment, so it is worked here, on integers, once for every case.
 * `decimal.test.ts` holds it against a reference written independently.
 */
import { addDecimal, compareDecimal, Decimal, decimalFromString } from '@formancy/expressions'
import type { Rounding, RoundingMode } from '@formancy/report-spec'

/**
 * `numerator / denominator` (denominator more than 0) rounded to a whole
 * number, ties by `mode`. Division truncates towards zero; what it left
 * decides whether to step away from zero.
 */
function roundQuotient(numerator: bigint, denominator: bigint, mode: RoundingMode): bigint {
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  const twice = 2n * (remainder < 0n ? -remainder : remainder)
  if (twice < denominator) return quotient
  const away = numerator < 0n ? quotient - 1n : quotient + 1n
  if (twice > denominator) return away
  return mode === 'half-away-from-zero' || quotient % 2n !== 0n ? away : quotient
}

/** The step a rounding rounds to: its increment, or one unit at its scale. Throws for a step report-spec refuses. */
function stepOf(rounding: Rounding): Decimal {
  if (rounding.increment === undefined) return new Decimal(1n, rounding.scale)
  const step = decimalFromString(rounding.increment)
  if (step.units <= 0n || step.scale > rounding.scale) {
    throw new RangeError(`an increment is more than 0 and has no more places than the ${rounding.scale} its rounding keeps`)
  }
  return step
}

/** The exact quotient `numerator / denominator` rounded as `rounding` declares. */
function roundRatio(numerator: bigint, denominator: bigint, rounding: Rounding): Decimal {
  const step = stepOf(rounding)
  const steps = roundQuotient(numerator * 10n ** BigInt(step.scale), denominator * step.units, rounding.mode)
  return new Decimal(steps * step.units * 10n ** BigInt(rounding.scale - step.scale), rounding.scale)
}

/**
 * `value` rounded as `rounding` declares, at exactly its scale. A negative
 * value that rounds to nothing is zero, never minus zero. Throws a
 * RangeError for an increment report-spec refuses: of zero or less, or with
 * more places than the scale.
 */
export function roundDecimalAs(value: Decimal, rounding: Rounding): Decimal {
  return roundRatio(value.units, 10n ** BigInt(value.scale), rounding)
}

/** The exact sum, at the largest scale among the values; 0 over none (0007). */
export function sumDecimals(values: Iterable<Decimal>): Decimal {
  let total = new Decimal(0n, 0)
  for (const value of values) total = addDecimal(total, value)
  return total
}

/** The value `keep` prefers over each other, compared by value; the first of equals is kept, as written. */
function extreme(values: Iterable<Decimal>, keep: (order: -1 | 0 | 1) => boolean): Decimal | null {
  let found: Decimal | null = null
  for (const value of values) if (found === null || keep(compareDecimal(value, found))) found = value
  return found
}

/** The least value, as written; null over none (0007). */
export function minDecimal(values: Iterable<Decimal>): Decimal | null {
  return extreme(values, (order) => order < 0)
}

/** The greatest value, as written; null over none (0007). */
export function maxDecimal(values: Iterable<Decimal>): Decimal | null {
  return extreme(values, (order) => order > 0)
}

/**
 * The exact average, rounded once as `rounding` declares: the exact sum
 * over the count, never a quotient rounded and then rounded again. Null
 * over no values (0007).
 */
export function averageDecimals(values: Iterable<Decimal>, rounding: Rounding): Decimal | null {
  let count = 0n
  let total = new Decimal(0n, 0)
  for (const value of values) {
    total = addDecimal(total, value)
    count++
  }
  return count === 0n ? null : roundRatio(total.units, count * 10n ** BigInt(total.scale), rounding)
}
