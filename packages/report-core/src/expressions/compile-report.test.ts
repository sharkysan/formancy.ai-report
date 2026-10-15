import { Decimal, decimalFromString, decimalToString, evaluate, fixedCapabilities } from '@formancy/expressions'
import type { ExpressionValue } from '@formancy/expressions'
import type { AggregateDef, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { expressionSites } from '../diagnostics/parts.js'
import { frozenSample, sampleReport } from '../test-support.js'
import { compileReport } from './compile-report.js'
import { expressionValues } from './values.js'
import type { ExpressionValues } from './values.js'

const AMOUNT_VALUE = '/regions/body/2/columns/3/value/expression/cel'
const AMOUNT_WHEN = '/regions/body/2/columns/3/styleWhen/0/when/cel'
const INTRO_VALUE = '/regions/body/0/content/2/expression/cel'
const GROSS = '/aggregates/2/of/expression/cel'
const TOTAL_VALUE = '/regions/body/2/totals/1/cells/1/value/expression/cel'

/** The sample with `aggregates` in place of its own. */
const withAggregates = (aggregates: readonly AggregateDef[]): ReportDefinition => ({ ...sampleReport(), aggregates })

/**
 * One row of the sample's data, as a dataset delivers it and the format
 * writes it (0007): an integer and a decimal as their exact strings, an
 * instant with its zone, a date as its ISO string, a missing value as null.
 */
const DATA: ExpressionValues = {
  params: { from: '2026-01-01', draft: false, threshold: null, currency: 'CHF', copies: '2' },
  header: { customer: 'ACME', orderedOn: '2026-01-05', currency: 'CHF' },
  row: { site: 'Zürich', sku: 'A-1', quantity: '3', unit_price: '4.1250', amount: '12.38', shippedAt: null, recordedAt: '2026-01-05T10:00:00+01:00', shipped: true },
  totals: { subtotal: '12.38', lines: '1', gross: '13.38278', average: '3.0', latest: '2026-01-05T09:00:00Z' },
  group: { subtotal: '12.38', lines: '1', gross: '13.38278', average: '3.0', latest: '2026-01-05T09:00:00Z', key: 'Zürich' },
}

/** The report never calls the clock or a random draw; these are what evaluate requires to be handed. */
const capabilities = fixedCapabilities({ nowMs: 0, today: '2026-01-01', random: 0 })

/** What `pointer`'s expression evaluates to over DATA, a decimal as its string. */
function valueAt(report: ReportDefinition, pointer: string): ExpressionValue | string {
  const compiled = compileReport(report).expressions.get(pointer)
  if (compiled === undefined) throw new Error(`nothing compiled at ${pointer}`)
  const outcome = evaluate(compiled.program, expressionValues(compiled, DATA), { capabilities })
  if (!outcome.ok) throw new Error(`${pointer}: ${outcome.error.message}`)
  const { value } = outcome
  return value instanceof Decimal ? decimalToString(value) : value
}

describe('compileReport', () => {
  // The runtime evaluates what the editor checked, with the same compiler
  // and the same declarations: every expression of a sound report compiles,
  // once, keyed by the pointer to it, and nothing is said against it.
  test('compiles every expression of a sound report, keyed by where it stands', () => {
    const report = frozenSample()
    const { expressions, diagnostics } = compileReport(report)
    expect(diagnostics).toEqual([])
    expect([...expressions.keys()].sort()).toEqual(expressionSites(report).map(({ path }) => path).sort())
  })

  // What a program reads is what the runtime binds: each member under the
  // name it was compiled with, typed as the member is.
  test('says what each program reads, the variable it reads it as and the type it is bound as', () => {
    const compiled = compileReport(frozenSample()).expressions.get(AMOUNT_VALUE)
    expect(compiled?.reads).toEqual([
      { name: 'row', member: 'quantity', variable: 'row_quantity', type: 'int', nullable: false },
      { name: 'row', member: 'unit_price', variable: 'row_unit_price', type: 'decimal', nullable: false },
    ])
    expect(compiled?.program.resultType).toBe('decimal')
  })

  // An expression an error was diagnosed for has no program: the runtime
  // refuses a report with an error, and has nothing to run in its place.
  test('gives no program for an expression with an error', () => {
    // The first of the two places the sample writes this condition: the intro's.
    const broken = JSON.parse(JSON.stringify(sampleReport()).replace('params.draft == false', 'params.draft ==')) as ReportDefinition
    const { expressions, diagnostics } = compileReport(broken)
    expect(diagnostics.map(({ code, path }) => `${code} ${path}`)).toEqual(['expression-syntax /regions/body/0/visibleWhen/cel'])
    expect(expressions.has('/regions/body/0/visibleWhen/cel')).toBe(false)
  })
})

describe('aggregateOrder', () => {
  // An aggregate whose expression reads a total needs that total computed
  // first, over every row. The order the runtime computes them in is the
  // one the editor checked: each after every aggregate it reads, otherwise
  // as declared.
  test('puts each aggregate after the aggregates its expression reads', () => {
    const share: AggregateDef = { id: 'share', fn: 'sum', of: { kind: 'expression', expression: { cel: 'divide(row.amount * dec("100"), totals.subtotal, 2)' } } }
    const report = withAggregates([share, ...sampleReport().aggregates])
    expect(compileReport(report).aggregateOrder).toEqual(['subtotal', 'share', 'lines', 'gross', 'average', 'latest'])
    expect(compileReport(frozenSample()).aggregateOrder).toEqual(['subtotal', 'lines', 'gross', 'average', 'latest'])
  })

  // An aggregate that reads itself, directly or through another, has no
  // place in any order; nor has one that reads such an aggregate. Each is
  // left out, and diagnosed where its expression reads the total that
  // closes the circle.
  test('leaves out the aggregates that read themselves, and those that read them', () => {
    const circular = (id: string, cel: string): AggregateDef => ({ id, fn: 'sum', of: { kind: 'expression', expression: { cel } } })
    const report = withAggregates([...sampleReport().aggregates, circular('net', 'row.amount + totals.tax'), circular('tax', 'totals.net * dec("0.081")'), circular('after', 'totals.net')])
    const { aggregateOrder, diagnostics, expressions } = compileReport(report)
    expect(aggregateOrder).toEqual(['subtotal', 'lines', 'gross', 'average', 'latest'])
    expect(diagnostics.map(({ code, path, position }) => `${code} ${path} ${position?.start}-${position?.end}`)).toEqual([
      'aggregate-cycle /aggregates/5/of/expression/cel 13-23',
      'aggregate-cycle /aggregates/6/of/expression/cel 0-10',
      'aggregate-cycle /aggregates/7/of/expression/cel 0-10',
    ])
    expect(['/aggregates/5/of/expression/cel', '/aggregates/6/of/expression/cel', '/aggregates/7/of/expression/cel'].some((path) => expressions.has(path))).toBe(false)
  })
})

describe('expressionValues', () => {
  // The binding is one function the runtime imports. Evaluated by
  // upstream's evaluate over data written as the format writes it, every
  // expression of the sample runs -- a decimal compared with a decimal, an
  // integer turned into one, a timestamp -- where binding members as raw
  // JSON or as maps would fail some of them at render.
  test('binds the data so that every expression of the sample evaluates', () => {
    const report = frozenSample()
    const { expressions } = compileReport(report)
    for (const [pointer, compiled] of expressions) {
      const outcome = evaluate(compiled.program, expressionValues(compiled, DATA), { capabilities })
      expect(outcome.ok, `${pointer}: ${outcome.ok ? '' : outcome.error.message}`).toBe(true)
    }
  })

  // And each gives what the data says: exact decimal arithmetic, rounded as
  // written, an integer printed as one, a comparison of two decimals.
  test.each([
    [AMOUNT_VALUE, '12.38'],
    [AMOUNT_WHEN, false],
    [INTRO_VALUE, 'ACME x2'],
    [GROSS, '13.38278'],
    [TOTAL_VALUE, '13.38278'],
  ])('evaluates %s to %s', (pointer, expected) => {
    expect(valueAt(frozenSample(), pointer)).toEqual(expected)
  })

  // A group header's key is bound as the value of the field grouped by, so
  // the header computes with the site its rows are for.
  test('binds the group key in a group header', () => {
    const report = JSON.parse(JSON.stringify(sampleReport()).replace('\\" (\\" + string(group.lines)', '\\" \\" + group.key + \\" (\\" + string(group.lines)')) as ReportDefinition
    expect(valueAt(report, '/regions/body/2/group/header/2/expression/cel')).toBe(' Zürich (1)')
  })

  // The decimal the binding makes is upstream's own, at the scale written.
  test('binds a decimal at the scale the data writes it', () => {
    const compiled = compileReport(frozenSample()).expressions.get(GROSS)
    expect(compiled && expressionValues(compiled, DATA)).toEqual({ row_amount: decimalFromString('12.38') })
  })
})
