import { compile } from '@formancy/expressions'
import { describe, expect, test } from 'vitest'
import { unreproducibleCalls, UNKNOWN_FUNCTION } from './reproducible.js'

const VARIABLES = { params: 'map', header: 'map', totals: 'map' } as const

/** Each call found, as the name and the text its span covers. */
function calls(source: string, kind: 'visible' | 'computed' = 'computed'): string[] {
  return unreproducibleCalls(source, kind, VARIABLES).map(({ name, span }) => `${name}:${source.slice(span.start, span.end)}`)
}

describe('unreproducibleCalls', () => {
  // A report rendered twice from the same data must print the same thing
  // (plan 15); the clock and a random draw differ between renders.
  test('finds calls to now, today and random, in order, with their spans', () => {
    expect(calls('now() > today() || random() > 0.5')).toEqual(['now:now()', 'today:today()', 'random:random()'])
    expect(calls('timestamp(params.from) < now ()', 'visible')).toEqual(['now:now ()'])
  })

  // The probe asks the real parser, so what only looks like a call is not
  // one: text in a string, a member that happens to be called now, a
  // longer name, a comprehension's local.
  test.each([
    ['inside a string', '"now()" == params.x'],
    ['a member named like a function', 'params.now == params.today'],
    ['a longer name', 'params.nowhere == params.random_id'],
    ['a comprehension local', '[1, 2].map(now, now + 1)'],
  ])('finds nothing in %s', (_name, source) => {
    expect(calls(source)).toEqual([])
  })

  // A local named now does not shadow the function in CEL: now() inside
  // its comprehension is still the clock.
  test('finds the clock called inside a comprehension whose local is named now', () => {
    expect(calls('[1].map(now, now())')).toEqual(['now:now()'])
  })

  // The probe recognises a call by the error upstream gives a call to a
  // function that does not exist. If upstream renamed that code, the probe
  // would find nothing; this fails first.
  test('relies on the code upstream gives an unknown function', () => {
    const outcome = compile('_ow()', { kind: 'computed', variables: VARIABLES })
    expect(outcome.ok === false && outcome.error.code).toBe(UNKNOWN_FUNCTION)
    expect(outcome.ok === false && outcome.error.position).toEqual({ start: 0, end: 5 })
  })
})
