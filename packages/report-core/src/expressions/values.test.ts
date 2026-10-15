import { decimalFromString } from '@formancy/expressions'
import type { DeclaredType, Program } from '@formancy/expressions'
import { describe, expect, test } from 'vitest'
import type { CompiledExpression, ExpressionRead } from './compile-site.js'
import { expressionValues } from './values.js'

/** A compiled expression that reads `row.value` as `type`; only its reads matter to the binding. */
function reading(type: DeclaredType, nullable = false): CompiledExpression {
  const read: ExpressionRead = { name: 'row', member: 'value', variable: 'row_value', type, nullable }
  return { site: { cel: 'row.value', scope: 'row', kind: 'computed', path: '/x/cel' }, program: {} as Program, reads: [read] }
}

/** The value `raw` is bound as, read as `type`. */
const bound = (type: DeclaredType, raw: unknown, nullable = false): unknown => expressionValues(reading(type, nullable), { row: { value: raw } }).row_value

describe('expressionValues', () => {
  // Exact values travel as strings (0007; formancy.ai-data 0008), and CEL
  // wants an int as a bigint, a decimal as upstream's Decimal and a
  // timestamp as an instant. Upstream converts only what is declared at the
  // top level and not null; a member that may be null is declared dyn, so
  // the conversion is made here, the same for every member.
  test.each([
    ['an integer from its exact string', 'int', '9007199254740993', 9007199254740993n],
    ['an integer from a safe whole number', 'int', 42, 42n],
    ['an integer already a bigint', 'int', 7n, 7n],
    ['a decimal from its exact string, at its scale', 'decimal', '12.50', decimalFromString('12.50')],
    ['a decimal already one', 'decimal', decimalFromString('1.5'), decimalFromString('1.5')],
    ['an instant written with its zone', 'timestamp', '2026-01-05T10:00:00+01:00', new Date('2026-01-05T09:00:00Z')],
    ['an instant already a Date', 'timestamp', new Date('2026-01-05T09:00:00Z'), new Date('2026-01-05T09:00:00Z')],
    ['a date, which is read as its ISO string', 'string', '2026-01-05', '2026-01-05'],
    ['a boolean', 'bool', true, true],
    ['an aggregate of unknown type, as it is', 'dyn', decimalFromString('3'), decimalFromString('3')],
  ] as const)('binds %s', (_name, type, raw, expected) => {
    expect(bound(type, raw)).toEqual(expected)
  })

  // A value that may be null is bound as null, whatever its type.
  test('binds null for a member that may be null', () => {
    expect(bound('decimal', null, true)).toBeNull()
  })

  // A value the data lacks, or one of another type, would make the
  // expression fail at render or, worse, compute with a guess -- an amount
  // as a double, an instant in the host's zone. The runtime validates a
  // dataset against its contract first, so this is a defect, and it is
  // said as one: naming the member and its type, never quoting the value,
  // which is customer data.
  test.each([
    ['a value the data lacks', 'string', undefined, false],
    ['null for a member that is never null', 'string', null, false],
    ['an amount as a JavaScript number', 'decimal', 12.5, false],
    ['a string that is no decimal', 'decimal', 'twelve', false],
    ['an integer past what a number holds exactly', 'int', 2 ** 53, false],
    ['a string that is no integer', 'int', '1.5', false],
    ['an instant without its zone', 'timestamp', '2026-01-05T10:00:00', false],
    ['an instant that is no date', 'timestamp', '2026-13-45T10:00:00Z', false],
    ['a number for a string', 'string', 5, false],
    ['a string for a boolean', 'bool', 'true', false],
    ['no value for an aggregate of unknown type', 'dyn', undefined, false],
  ] as const)('throws a TypeError for %s, naming the member and not the value', (_name, type, raw, nullable) => {
    let thrown: unknown
    try {
      bound(type, raw, nullable)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(TypeError)
    expect((thrown as Error).message).toContain('row.value')
    if (typeof raw === 'string' || typeof raw === 'number') expect((thrown as Error).message).not.toContain(String(raw))
  })

  // A scope the data does not give at all is the same defect as a value it lacks.
  test('throws for a name the data does not hold', () => {
    expect(() => expressionValues(reading('string'), {})).toThrow(TypeError)
  })
})
