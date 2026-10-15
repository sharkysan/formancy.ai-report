import { compile } from '@formancy/expressions'
import { describe, expect, test } from 'vitest'
import { inexactOperations, unboundedCalls } from './exactness.js'

const VARIABLES = { row_amount: 'decimal', row_quantity: 'int', params_copies: 'int', header_name: 'string' } as const

/** Each finding, as its kind and the text its span covers. */
function inexact(source: string): string[] {
  return inexactOperations(source, 'computed', VARIABLES).map(({ kind, span }) => `${kind}:${source.slice(span.start, span.end)}`)
}

function unbounded(source: string): string[] {
  return unboundedCalls(source, 'computed', VARIABLES).map(({ name, span }) => `${name}:${source.slice(span.start, span.end)}`)
}

describe('inexactOperations', () => {
  // A double reached a printed number through int(): 4.35 * 100.0 is
  // 434.99999999999994, and int() of it printed 434 as though it were
  // exact. Every double comes in through a literal or double(), so each is
  // found where it is written.
  test('finds a double literal and a call to double(), in order', () => {
    expect(inexact('int(double(string(row_amount)) * 100.0)')).toEqual(['double-call:double(string(row_amount))', 'double-literal:100.0'])
    expect(inexact('row_quantity > 1e3')).toEqual(['double-literal:1e3'])
    expect(inexact('string(1.5E-2)')).toEqual(['double-literal:1.5E-2'])
  })

  // 3 / 2 is 1 in CEL, and -3 / 2 is -1: the remainder is dropped with no
  // rounding anybody declared. A report has no doubles and no decimal
  // division by operator, so every / divides integers.
  test('finds every division, which on integers drops the remainder', () => {
    expect(inexact('row_quantity / params_copies')).toEqual(['integer-division:/'])
    expect(inexact('[1, 2].map(x, x / 2)[0] + dyn(row_quantity) / dyn(2)')).toEqual(['integer-division:/', 'integer-division:/'])
  })

  // The probe asks the real parser, so what only looks like a double or a
  // division is not one: text in a string, an integer, a hex literal, a
  // comment, the type named double, a remainder, which is exact.
  test.each([
    ['a string', 'header_name + "1.5 / 2" + r"3.0" + """4/5"""'],
    ['integers and a hex literal', 'row_quantity + 15 + 0x1e5'],
    ['a comment', 'row_quantity + 1 // half of 3.0 / 2'],
    ['the type named double', 'type(dyn(row_quantity)) == double'],
    ['a remainder', 'row_quantity % 2 == 0'],
    ['exact decimal division', 'divide(row_amount, dec("3"), 2)'],
    ['a member named like a function', 'header_name == "double"'],
  ])('finds nothing in %s', (_name, source) => {
    expect(compile(source, { kind: 'computed', variables: VARIABLES }).ok).toBe(true)
    expect(inexact(source)).toEqual([])
  })
})

describe('unboundedCalls', () => {
  // matches() runs the pattern on JavaScript's backtracking engine, and
  // one call is a few budget steps however long it runs: "^(a+)+$" over 29
  // letters and a b took 39 seconds in one render.
  test('finds a call to matches, written as a method', () => {
    expect(unbounded('header_name.matches("^(a+)+$")')).toEqual(['matches:header_name.matches("^(a+)+$")'])
  })

  test.each([
    ['a string', 'header_name + ".matches(x)" == "y"'],
    ['a longer name', 'header_name.startsWith("matches")'],
  ])('finds nothing in %s', (_name, source) => {
    expect(unbounded(source)).toEqual([])
  })

  // The probes recognise each thing by the error upstream gives once it is
  // spelled differently. If upstream changed those errors, the probes would
  // find nothing; these fail first.
  test('relies on the errors upstream gives', () => {
    const syntax = compile('1 @ 2', { kind: 'computed', variables: {} })
    expect(syntax.ok === false && [syntax.error.kind, syntax.error.position]).toEqual(['syntax', { start: 2, end: 3 }])
    const call = compile('header_name._atches("x")', { kind: 'computed', variables: VARIABLES })
    expect(call.ok === false && [call.error.code, call.error.position]).toEqual(['no_matching_overload', { start: 0, end: 24 }])
  })
})
