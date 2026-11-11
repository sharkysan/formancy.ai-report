import { Decimal, decimalFromString, decimalToString } from '@formancy/expressions'
import { describe, expect, test } from 'vitest'
import { chartTicks, MAX_TICK_INTERVALS } from './chart-ticks.js'
import { below, seeded } from './test-support.js'

const shown = (values: readonly string[], chart: 'bar' | 'line', scale: number): string[] =>
  chartTicks(values.map(decimalFromString), chart, scale).map(decimalToString)

describe('chartTicks', () => {
  // An axis that stopped short of the largest bar would cut it off at the box;
  // one that did not start at zero for a bar, or measured a flat line from its
  // own value, would draw a length that lies; one finer than the format's last
  // place would print ticks no value can sit on.
  test.each([
    ['bar', ['0', '3'], 0, ['0', '1', '2', '3']],
    ['bar', ['120.50', '480.00', '231.00'], 2, ['0', '100', '200', '300', '400', '500']],
    ['bar', ['-30', '70'], 0, ['-50', '0', '50', '100']], // negatives go below the zero line
    ['bar', ['0', '0'], 2, ['0', '0.2', '0.4', '0.6', '0.8', '1']], // all zero
    ['bar', ['500', '900'], 0, ['0', '200', '400', '600', '800', '1000']], // a bar of values far from zero still starts at it
    ['line', ['1234', '1234'], 0, ['0', '500', '1000', '1500']], // a flat line
    ['line', ['10.5', '12.25'], 2, ['10.5', '11', '11.5', '12', '12.5']],
    ['bar', ['0', '1'], 0, ['0', '1']], // counts are never cut into fractions
    ['line', ['12.345', '12.346'], 0, ['12', '13']], // values finer than the format: no step below a unit of what it prints
    ['line', ['10000', '12000'], 0, ['10000', '10500', '11000', '11500', '12000']], // a line's rise is its own range, not a seventh of the box
    ['bar', ['10000', '12000'], 0, ['0', '5000', '10000', '15000']], // the same values as bars, from zero
  ] as const)('%s of %j at scale %i ticks %j', (chart, values, scale, ticks) => {
    expect(shown(values, chart, scale)).toEqual(ticks)
  })

  // A 40-digit total through a double would lose its last 24 digits.
  test('ticks a 40-digit total exactly', () => {
    const total = '1234567890123456789012345678901234567890'
    const ticks = chartTicks([decimalFromString(total)], 'bar', 0)
    const step = ticks[1]!.units - ticks[0]!.units
    expect(ticks[0]!.units).toBe(0n)
    expect(ticks.every((tick, i) => tick.units === BigInt(i) * step)).toBe(true)
    expect(ticks.at(-1)!.units).toBeGreaterThanOrEqual(BigInt(total))
    expect(decimalToString(ticks.at(-1)!)).toBe('1500000000000000000000000000000000000000')
  })

  // Whatever the data, the axis holds every value, in at most six ticks no
  // finer than the format prints, steps of 1, 2 or 5 times a power of ten, and
  // is found at once: a loop that guessed its way would time out here.
  test('covers every value of seeded ranges from 10^-20 to 10^30', () => {
    const next = seeded(11112026)
    for (let run = 0; run < 1000; run++) {
      const scale = below(next, 21)
      const digits = 1 + below(next, 30 + scale)
      const draw = (): Decimal => {
        let units = 0n
        for (let d = 0; d < digits; d++) units = units * 10n + BigInt(below(next, 10))
        return new Decimal(below(next, 3) === 0 ? -units : units, scale)
      }
      const values = Array.from({ length: 1 + below(next, 6) }, draw)
      const chart = below(next, 2) === 0 ? 'bar' : 'line'
      const ticks = chartTicks(values, chart, scale)
      const at = (value: Decimal): bigint => value.units * 10n ** BigInt(scale - value.scale)
      const units = ticks.map(at)
      const where = `run ${run}: ${chart} ${values.map(decimalToString).join(' ')} at scale ${scale}`
      expect(ticks.length, where).toBeGreaterThanOrEqual(2)
      expect(ticks.length, where).toBeLessThanOrEqual(MAX_TICK_INTERVALS + 1)
      expect(
        ticks.every((tick) => tick.scale <= scale),
        where,
      ).toBe(true)
      const all = values.map(at)
      expect(units[0]!, where).toBeLessThanOrEqual(all.reduce((a, b) => (b < a ? b : a)))
      expect(units.at(-1)!, where).toBeGreaterThanOrEqual(all.reduce((a, b) => (b > a ? b : a)))
      const step = units[1]! - units[0]!
      expect(step, where).toBeGreaterThan(0n)
      expect(
        units.every((tick, i) => tick === units[0]! + BigInt(i) * step),
        where,
      ).toBe(true)
      expect(
        units.every((tick) => tick % step === 0n),
        where,
      ).toBe(true)
      expect(['1', '2', '5'], where).toContain(step.toString().replace(/0+$/, ''))
      if (chart === 'bar') {
        expect(units[0]!, where).toBeLessThanOrEqual(0n)
        expect(units.at(-1)!, where).toBeGreaterThanOrEqual(0n)
      }
    }
  })
})
