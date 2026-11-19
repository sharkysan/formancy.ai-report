/**
 * A chart's numbers, read as the runtime writes them and never as
 * JavaScript's (0076): `ChartValue.exact` is a decimal's digits, and what
 * the writer works out of them -- whether the ticks ascend in equal
 * steps, the step itself, whether a value stands among them -- it works
 * out in BigInt on those digits, so that a total of forty digits is the
 * number it is.
 */

/** A decimal: a whole number of its last place, and how many of its digits are places. */
export interface Exact {
  readonly units: bigint
  readonly scale: number
}

/** `exact` read as the runtime writes a decimal -- a minus or none, digits, and a point and digits or none -- or undefined for anything else. */
export function exactOf(exact: unknown): Exact | undefined {
  const match = typeof exact === 'string' ? /^(-?)(\d+)(?:\.(\d+))?$/.exec(exact) : null
  if (match === null) return undefined
  const units = BigInt(`${match[2]!}${match[3] ?? ''}`)
  return { units: match[1] === '-' ? -units : units, scale: (match[3] ?? '').length }
}

/** `each`'s units at `scale`, as many places as its own or more. */
const unitsAt = (each: Exact, scale: number): bigint => each.units * 10n ** BigInt(scale - each.scale)

/** `left` less `right`, exactly. */
export function minus(left: Exact, right: Exact): Exact {
  const scale = Math.max(left.scale, right.scale)
  return { units: unitsAt(left, scale) - unitsAt(right, scale), scale }
}

/** Whether `value` is below nothing, nothing, or above it: -1, 0 or 1. */
export const sign = (value: Exact): -1 | 0 | 1 => (value.units < 0n ? -1 : value.units > 0n ? 1 : 0)

/** The sum of `values`, exactly. */
export function sum(values: readonly Exact[]): Exact {
  const scale = Math.max(0, ...values.map((each) => each.scale))
  return { units: values.reduce((total, each) => total + unitsAt(each, scale), 0n), scale }
}

/**
 * The step of `ticks`, where they are an axis as the runtime writes one:
 * two or more, ascending, each as far above the one before it as the
 * second is above the first. Undefined for any others.
 */
export function stepOf(ticks: readonly Exact[]): Exact | undefined {
  const [lowest, next] = ticks
  if (lowest === undefined || next === undefined) return undefined
  const step = minus(next, lowest)
  if (sign(step) !== 1) return undefined
  const even = ticks.every((tick, index) => {
    const risen = minus(tick, lowest)
    const scale = Math.max(risen.scale, step.scale)
    return unitsAt(risen, scale) === BigInt(index) * unitsAt(step, scale)
  })
  return even ? step : undefined
}

/** How many places `value` needs: its own, without the zeros it ends in. */
export function placesOf(value: Exact): number {
  let [units, places] = [value.units, value.scale]
  while (places > 0 && units % 10n === 0n) {
    units /= 10n
    places -= 1
  }
  return places
}

/** `value` as the digits of a decimal, at as many places as it needs. */
export function digitsOf(value: Exact): string {
  const places = placesOf(value)
  const units = value.units / 10n ** BigInt(value.scale - places)
  const digits = (units < 0n ? -units : units).toString().padStart(places + 1, '0')
  const whole = digits.slice(0, digits.length - places)
  return `${units < 0n ? '-' : ''}${whole}${places === 0 ? '' : `.${digits.slice(digits.length - places)}`}`
}
