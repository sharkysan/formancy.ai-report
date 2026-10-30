import { Decimal, decimalToString } from '@formancy/expressions'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { DataError } from './data-errors.js'
import { checkParameters } from './parameters.js'
import type { CheckedParameters, ParameterCheck } from './parameters.js'
import { sampleReport } from './test-support.js'

function checked(outcome: ParameterCheck): CheckedParameters {
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return outcome.values
}

function errors(outcome: ParameterCheck): readonly DataError[] {
  if (outcome.ok) throw new Error('accepted, and a refusal was expected')
  return outcome.errors
}

const where = (list: readonly DataError[]): string[] => list.map((error) => `${error.code} ${error.path}`)

describe('checkParameters', () => {
  // A parameter is read by the same rules as a field of its type, so that
  // `params.copies` is an integer however it reached the report.
  test('reads each value as its parameter type', () => {
    const values = checked(
      checkParameters(sampleReport(), { from: '2026-01-01', draft: true, threshold: '100.00', currency: 'EUR', copies: '2', heading: 'Lieferungen' }),
    )
    expect(values.from).toBe('2026-01-01')
    expect(values.draft).toBe(true)
    expect(decimalToString(values.threshold as Decimal)).toBe('100.00')
    expect(values.currency).toBe('EUR')
    expect(values.copies).toBe(2n)
    expect(values.heading).toBe('Lieferungen')
  })

  // A parameter left out takes its default, read by its type's rules as a
  // value would be; one with no default and not required is null.
  test('applies defaults, and holds an optional parameter with none as null', () => {
    const values = checked(checkParameters(sampleReport(), { from: '2026-01-01' }))
    expect(values.draft).toBe(false)
    expect(values.currency).toBe('CHF')
    expect(values.copies).toBe(1n)
    expect(values.heading).toBe('Deliveries')
    expect(values.threshold).toBeNull()
  })

  // A required parameter needs a value from the person rendering, unless
  // its default supplies one; without either the report is not rendered.
  test('refuses a required parameter with no value and no default', () => {
    expect(where(errors(checkParameters(sampleReport(), {})))).toEqual(['missing-parameter /from'])
  })

  // Null is a value only for a parameter that may have none: one with a
  // default or a requirement never is null when an expression reads it
  // (0009), so null is refused rather than read as the default.
  test('accepts null only for an optional parameter without a default', () => {
    expect(checked(checkParameters(sampleReport(), { from: '2026-01-01', threshold: null })).threshold).toBeNull()
    const refused = errors(checkParameters(sampleReport(), { from: null, draft: null }))
    expect(where(refused)).toEqual(['unexpected-null /from', 'unexpected-null /draft'])
    expect(refused[1]?.message).toContain('leave it out')
  })

  // A value for a parameter the report does not declare is refused: the
  // report reads nothing it was not written to read.
  test('refuses a value for an undeclared parameter', () => {
    expect(where(errors(checkParameters(sampleReport(), { from: '2026-01-01', tenant: 'other' })))).toEqual(['undeclared-parameter /tenant'])
  })

  // The same type rules as data: exact numbers as strings, a safe integer
  // as a number, never a decimal as a float.
  test.each([
    ['copies', 2.5, 'invalid-integer'],
    ['copies', 2 ** 53, 'unsafe-integer'],
    ['threshold', 1.5, 'decimal-as-number'],
    ['threshold', '1,5', 'invalid-decimal'],
    ['threshold', `0.${'1'.repeat(21)}`, 'decimal-scale'],
    ['from', '2026-02-30', 'invalid-date'],
    ['currency', 5, 'wrong-type'],
    ['draft', 'true', 'wrong-type'],
  ])('refuses %s as %j with %s', (id, value, code) => {
    expect(where(errors(checkParameters(sampleReport(), { from: '2026-01-01', [id]: value })))).toEqual([`${code} /${id}`])
  })

  // A parameter form may send an integer as a JSON number; below 2^53 it is
  // still exact, and is taken.
  test('accepts a safe integer as a number', () => {
    expect(checked(checkParameters(sampleReport(), { from: '2026-01-01', copies: 3 })).copies).toBe(3n)
  })

  // What is not data is refused, and a getter is never run.
  test('refuses anything but an object of values, and a getter unrun', () => {
    expect(where(errors(checkParameters(sampleReport(), [] as unknown as Record<string, unknown>)))).toEqual(['wrong-type '])
    let ran = false
    const values = {
      get from(): string {
        ran = true
        return '2026-01-01'
      },
    }
    expect(where(errors(checkParameters(sampleReport(), values)))).toEqual(['not-data /from'])
    expect(ran).toBe(false)
  })

  // A key longer than any parameter id never goes into a path, and a symbol
  // key has none to go into: each is refused at the values themselves.
  test('refuses a long key and a symbol key without building a path from them', () => {
    const long = 'p'.repeat(65)
    const refused = errors(checkParameters(sampleReport(), { from: '2026-01-01', [long]: 1, [Symbol('hidden')]: 1 }))
    expect(where(refused)).toEqual(['not-data ', 'undeclared-parameter '])
    for (const error of refused) expect(error.message).not.toContain(long)
  })

  // The values are held as a frozen copy that inherits nothing, so a
  // parameter named like a property of Object.prototype is its own value.
  test('holds a frozen copy that inherits nothing', () => {
    const values = checked(checkParameters(sampleReport(), { from: '2026-01-01' }))
    expect(Object.isFrozen(values)).toBe(true)
    expect(values.toString).toBeUndefined()
  })

  // A default the parameter's own type would refuse is never used as a
  // value: report-spec refuses such a report, and one that reached the
  // runtime anyway is refused here too.
  test('refuses a default its own type refuses', () => {
    const report: ReportDefinition = { ...sampleReport(), parameters: [{ id: 'copies', type: 'integer', label: 'Copies', required: false, default: 'many' }] }
    const refused = errors(checkParameters(report, {}))
    expect(where(refused)).toEqual(['invalid-integer /copies'])
    expect(refused[0]?.message).toContain('default')
  })

  // A parameter's value is the person's input: no message repeats it.
  test('never repeats a value in a message', () => {
    const refused = errors(checkParameters(sampleReport(), { from: 'SECRET', copies: 'SECRET', threshold: 'SECRET', SECRET: 1 }))
    expect(refused).toHaveLength(4)
    for (const error of refused) expect(error.message).not.toContain('SECRET')
  })
})
