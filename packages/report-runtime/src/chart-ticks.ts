/**
 * A chart's value axis: ticks a reader takes in at a glance, found exactly.
 *
 * The step is 1, 2 or 5 times a power of ten, the finest that covers every
 * value in at most `MAX_TICK_INTERVALS` intervals and no finer than one unit
 * of the value format's last place. Everything is BigInt division on a
 * decimal's units, never a double, so a 40-digit total ticks exactly (0010).
 */
import { Decimal } from '@formancy/expressions'

/** Intervals an axis may hold: six labels down it, chosen as what a reader takes in at a glance. */
export const MAX_TICK_INTERVALS = 5

/** `numerator / denominator` rounded down, denominator more than 0. */
function floorDiv(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator
  return numerator % denominator < 0n ? quotient - 1n : quotient
}

/**
 * The decimal of `units` at `scale`, without trailing zeros: a tick is
 * written as its value needs, and printed at the value format's scale, to
 * which the formatter pads it back -- 11 prints as 11.00 at two places.
 */
function tick(units: bigint, scale: number): Decimal {
  let kept = units
  let places = scale
  while (places > 0 && kept % 10n === 0n) {
    kept /= 10n
    places--
  }
  return new Decimal(kept, places)
}

/**
 * The ticks of an axis over `values` (non-empty, not null) at the value
 * format's `scale`, ascending, evenly spaced and holding every value; a bar
 * chart's axis, and a flat line's, hold zero as well. Zero is a tick whenever
 * the axis holds it.
 */
export function chartTicks(values: readonly Decimal[], chart: 'bar' | 'line', scale: number): Decimal[] {
  const common = values.reduce((most, value) => Math.max(most, value.scale), scale)
  const units = values.map((value) => value.units * 10n ** BigInt(common - value.scale))
  let lo = units.reduce((least, value) => (value < least ? value : least))
  let hi = units.reduce((most, value) => (value > most ? value : most))
  if (chart === 'bar' || lo === hi) {
    if (lo > 0n) lo = 0n
    if (hi < 0n) hi = 0n
  }
  if (lo === hi) hi = 10n ** BigInt(common)
  // floor(log10(span)), exactly.
  const e = (hi - lo).toString().length - 1 - common
  for (let k = Math.max(-scale, e - 1); ; k++) {
    for (const m of [1n, 2n, 5n]) {
      const step = m * 10n ** BigInt(k + common)
      const first = floorDiv(lo, step)
      const intervals = -floorDiv(-hi, step) - first
      if (intervals > BigInt(MAX_TICK_INTERVALS)) continue
      return Array.from({ length: Number(intervals) + 1 }, (_, i) => tick((first + BigInt(i)) * step, common))
    }
  }
}
