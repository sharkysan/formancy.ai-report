import { Decimal, decimalFromString, decimalToString } from '@formancy/expressions'
import type { ExpressionValues } from '@formancy/report-core'
import { emptyReport } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { checkData } from './data.js'
import type { CheckedData } from './data.js'
import { CAPABILITIES, EXPRESSION_STEP_BUDGET, prepareExpressions, RENDER_STEP_BUDGET, typed } from './evaluate.js'
import type { Evaluation, ReportExpressions } from './evaluate.js'
import type { TypedValue } from './format.js'
import { checkParameters } from './parameters.js'
import type { CheckedParameters } from './parameters.js'
import { sampleData, sampleReport, sampleRow } from './test-support.js'

/** The sample report's expressions, failing the test when the report is refused. */
function prepared(report: ReportDefinition = sampleReport()): ReportExpressions {
  const outcome = prepareExpressions(report)
  if (!outcome.ok) throw new Error(`refused: ${outcome.diagnostics.map((d) => `${d.code} ${d.path}`).join(', ')}`)
  return outcome.expressions
}

function data(rows = [sampleRow()]): CheckedData {
  const outcome = checkData(sampleReport(), sampleData(rows), { mode: 'final' })
  if (!outcome.ok) throw new Error('refused')
  return outcome.data
}

function params(values: Record<string, unknown> = {}): CheckedParameters {
  const outcome = checkParameters(sampleReport(), { from: '2026-01-01', ...values })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => error.code).join(', ')}`)
  return outcome.values
}

/** The value of an evaluation, failing the test with the error when it failed. */
function value(outcome: Evaluation): TypedValue | null {
  if (!outcome.ok) throw new Error(`failed: ${outcome.error.code} ${outcome.error.message}`)
  return outcome.value
}

/** Where the sample report's expressions stand. */
const TABLE = '/regions/body/1'
const PER_COPY = `${TABLE}/columns/2/value/expression/cel`
const URGENT = `${TABLE}/columns/3/styleWhen/0/when/cel`
const TOTAL_GROSS = `${TABLE}/totals/0/cells/1/value/expression/cel`
const INTRO = '/regions/body/0/content/0/expression/cel'
const INTRO_WHEN = '/regions/body/0/visibleWhen/cel'
const GROSS = '/aggregates/2/of/expression/cel'

/** A report with one text whose runs are `expressions`, reading string parameters x, y and z; at `/regions/body/0/content/<i>/expression/cel`. */
function reportOf(...expressions: string[]): ReportDefinition {
  return {
    ...emptyReport('probe', 'Probe', 'en'),
    parameters: ['x', 'y', 'z'].map((id) => ({ id, type: 'string' as const, label: id, required: true })),
    regions: {
      reportHeader: [],
      pageHeader: [],
      body: [{ id: 'probe-text', kind: 'text', content: expressions.map((cel) => ({ kind: 'expression' as const, expression: { cel } })) }],
      pageFooter: [],
      summary: [],
    },
  }
}

const at = (index: number): string => `/regions/body/0/content/${index}/expression/cel`
const STRINGS: ExpressionValues = { params: { x: 'a', y: 'b', z: 'c' } }
const LIST = `[${Array.from({ length: 64 }, (_, index) => index).join(',')}]`

describe('prepareExpressions', () => {
  // The runtime refuses what the editor's diagnostics call an error, before
  // anything is evaluated: a report that calls the clock would print
  // differently tomorrow, and one that reads a member nothing declares has
  // nothing to bind it to.
  test('refuses a report its diagnostics give an error for', () => {
    const outcome = prepareExpressions(reportOf('string(today())', 'params.missing'))
    expect(outcome.ok).toBe(false)
    expect(!outcome.ok && outcome.diagnostics.map(({ code }) => code)).toEqual(['expression-not-reproducible', 'expression-unknown-name'])
  })

  // A warning -- a parameter nothing reads -- renders as written.
  test('accepts a report with warnings only', () => {
    expect(prepareExpressions(reportOf('params.x + params.y')).ok).toBe(true)
  })

  // Every expression compiled once, where it stands: the sample report's
  // cells, conditions and aggregates alike.
  test('compiles every expression of the report once', () => {
    const expressions = prepared()
    expect([...expressions.compilation.expressions.keys()]).toContain(PER_COPY)
    expect([...expressions.compilation.expressions.keys()]).toContain(GROSS)
    expect(expressions.compilation.aggregateOrder).toEqual(['subtotal', 'lines', 'gross'])
  })

  // Should a clock or a random draw ever be reached, it gives the same
  // answer in every render: the diagnostics refuse calls to them (0009).
  test('fixes the clock and the random draw', () => {
    expect(CAPABILITIES).toEqual({ nowMs: 0, today: '1970-01-01', random: 0 })
  })
})

describe('evaluate', () => {
  // Each member is bound as the type it was checked as (0009), so a decimal
  // multiplies exactly and an integer divides as an integer.
  test('binds checked data and gives typed values', () => {
    const expressions = prepared()
    const checked = data([sampleRow({ amount: '99999999999999999999.99', quantity: '7' })])
    const row = checked.detail[0]
    const gross = value(expressions.evaluate(GROSS, { row }))
    expect(gross?.type).toBe('decimal')
    expect(decimalToString(gross?.value as Decimal)).toBe('108099999999999999999.98919')
    const perCopy = value(expressions.evaluate(PER_COPY, { row, params: params({ copies: '2' }) }))
    expect(perCopy?.type === 'decimal' && decimalToString(perCopy.value)).toBe('3.50')
    expect(value(expressions.evaluate(INTRO, { header: checked.header, params: params({ copies: '2' }) }))).toEqual({ type: 'string', value: 'Muster AG x2' })
    expect(value(expressions.evaluate(URGENT, { row }))).toEqual({ type: 'boolean', value: false })
  })

  // A timestamp comes back in UTC, held as the data check holds an instant,
  // so it compares and formats like one; a date comes back as its ISO
  // string, as it was read.
  test('gives an instant as the data check holds one, and a date as its string', () => {
    const report = reportOf('timestamp("2026-01-01T10:00:00.500+01:00")', 'params.x')
    const expressions = prepared(report)
    expect(value(expressions.evaluate(at(0), {}))).toEqual({ type: 'instant', value: '2026-01-01T09:00:00.5Z' })
  })

  // An aggregate's total is read by the expressions that print it, as the
  // runtime computed it.
  test('reads totals', () => {
    const total = value(prepared().evaluate(TOTAL_GROSS, { totals: { gross: decimalFromString('13.51') } }))
    expect(total?.type === 'decimal' && decimalToString(total.value)).toBe('13.51')
  })

  // A failure at render time is an error that says where -- the component,
  // the column, the detail row -- and why, never a blank cell; and it never
  // quotes a value, which is the customer's.
  test('reports a runtime failure with its component, column and row', () => {
    const expressions = prepared()
    const rows = [sampleRow(), sampleRow(), sampleRow(), sampleRow({ quantity: '4711' })]
    const outcome = expressions.evaluate(PER_COPY, { row: data(rows).detail[3], params: params({ copies: '0' }) }, 3)
    expect(outcome).toEqual({
      ok: false,
      error: {
        code: 'expression-failed',
        message: expect.stringContaining('invalid_value'),
        path: PER_COPY,
        componentId: 'lines',
        columnId: 'per-copy',
        row: 3,
      },
    })
    expect(!outcome.ok && outcome.error.message).toContain('detail row 3')
    expect(!outcome.ok && outcome.error.message).not.toContain('4711')
  })

  // An aggregate's expression has no component; its error names the
  // aggregate instead.
  test('names the aggregate whose expression failed', () => {
    const outcome = prepared().evaluate(GROSS, { row: { amount: 12.5 } }, 0)
    expect(!outcome.ok && outcome.error).toMatchObject({ code: 'unbound-value', path: GROSS, aggregateId: 'gross', row: 0 })
    expect(!outcome.ok && outcome.error.message).toContain('aggregate gross')
  })

  // Integers past 2^53 bind exactly as BigInt: a comparison reads them
  // whole. Upstream refuses to give one back as a value, since it hands
  // integers back as numbers; that is an error naming the row, not a
  // rounded number.
  test('compares integers past 2^53, and refuses to give one back', () => {
    const report: ReportDefinition = { ...reportOf('params.n > 1152921504606846975'), parameters: [{ id: 'n', type: 'integer', label: 'N', required: true }] }
    expect(value(prepared(report).evaluate(at(0), { params: { n: 2n ** 60n } }))).toEqual({ type: 'boolean', value: true })
    expect(value(prepared(report).evaluate(at(0), { params: { n: 2n ** 60n - 1n } }))).toEqual({ type: 'boolean', value: false })
    const added = prepared({
      ...reportOf('params.n + 1', 'params.x'),
      parameters: [...report.parameters, { id: 'x', type: 'string', label: 'X', required: true }],
    })
    const outcome = added.evaluate(at(0), { params: { n: 2n ** 60n } }, 0)
    expect(!outcome.ok && outcome.error.code).toBe('expression-failed')
    expect(!outcome.ok && outcome.error.message).toContain('int_out_of_range')
    expect(!outcome.ok && outcome.error.message).not.toContain(String(2n ** 60n))
  })

  // A field a preview's data lacks is missing, not null: an expression that
  // reads it fails, naming it, and never reads it as empty.
  test('fails, naming the member, when a value is missing', () => {
    const outcome = prepared().evaluate(GROSS, { row: {} }, 5)
    expect(!outcome.ok && outcome.error).toMatchObject({ code: 'missing-value', row: 5 })
    expect(!outcome.ok && outcome.error.message).toContain('row.amount')
  })

  // A value of another type than its member's is a defect -- the data
  // check admits none -- and is said as one, naming the member.
  test('fails, naming the member, when a value cannot be bound', () => {
    const outcome = prepared().evaluate(GROSS, { row: { amount: 'twelve' } })
    expect(!outcome.ok && outcome.error.code).toBe('unbound-value')
    expect(!outcome.ok && outcome.error.message).toContain('row.amount')
    expect(!outcome.ok && outcome.error.message).not.toContain('twelve')
  })

  // A double is not exact, and a list or a map has no text; neither is
  // printed as though it were a value.
  test('refuses a value that is not one', () => {
    const expressions = prepared(reportOf('[1, 2]', '{"a": 1}', 'params.x'))
    expect(expressions.evaluate(at(0), {})).toMatchObject({ ok: false, error: { code: 'unprintable-value' } })
    expect(expressions.evaluate(at(1), {})).toMatchObject({ ok: false, error: { code: 'unprintable-value' } })
  })

  // int() of a double printed 4.35 as 434 cents, as though it were exact:
  // upstream hands an integer and a double back alike, so a double is
  // refused before anything is evaluated, wherever it is written.
  test('never evaluates a double', () => {
    const outcome = prepareExpressions(reportOf('string(int(double(params.x) * 100.0))', 'string(1.5 * 2.0)'))
    expect(!outcome.ok && outcome.diagnostics.map(({ code }) => code)).toEqual([
      'expression-inexact',
      'expression-inexact',
      'expression-inexact',
      'expression-inexact',
    ])
  })

  // Should a number that is not a whole one ever come back, it is refused,
  // never printed as an integer it is not.
  test('refuses a number that is not a safe integer', () => {
    expect(typed(4.5, 'dyn')).toMatchObject({ code: 'inexact-value' })
    expect(typed(2 ** 53, 'int')).toMatchObject({ code: 'inexact-value' })
    expect(typed(3, 'int')).toEqual({ type: 'integer', value: 3n })
  })

  // A value that may be null is checked as dyn; what it holds at render
  // decides its type, and null stays null.
  test('types a value that may be null by what it holds', () => {
    const report: ReportDefinition = {
      ...reportOf('params.n', 'params.d', 'params.s', 'params.x'),
      parameters: [
        { id: 'n', type: 'integer', label: 'N', required: false },
        { id: 'd', type: 'decimal', label: 'D', required: false },
        { id: 's', type: 'string', label: 'S', required: false },
        { id: 'x', type: 'string', label: 'X', required: true },
      ],
    }
    const expressions = prepared(report)
    expect(value(expressions.evaluate(at(0), { params: { n: 5n } }))).toEqual({ type: 'integer', value: 5n })
    expect(value(expressions.evaluate(at(0), { params: { n: null } }))).toBeNull()
    expect(value(expressions.evaluate(at(1), { params: { d: new Decimal(5n, 1) } }))?.type).toBe('decimal')
    expect(value(expressions.evaluate(at(2), { params: { s: 'text' } }))).toEqual({ type: 'string', value: 'text' })
  })

  // A path that is not an expression of the report is the caller's defect.
  test('refuses a path that holds no compiled expression', () => {
    expect(prepared().evaluate('/regions/body/9/content/0/expression/cel', {})).toMatchObject({ ok: false, error: { code: 'unknown-expression' } })
  })
})

describe('condition', () => {
  // A condition is a boolean: it shows or hides a component, or applies a
  // style.
  test('gives a boolean', () => {
    const expressions = prepared()
    expect(expressions.condition(INTRO_WHEN, { params: params({ draft: false }) })).toEqual({ ok: true, value: true })
    expect(expressions.condition(INTRO_WHEN, { params: params({ draft: true }) })).toEqual({ ok: true, value: false })
  })

  // A value read where a condition was meant is a defect: the diagnostics
  // refuse a condition that may give anything but a boolean.
  test('refuses an expression that gives anything but a boolean', () => {
    expect(prepared().condition(INTRO, { header: data().header, params: params() })).toMatchObject({ ok: false, error: { code: 'not-a-condition' } })
  })

  // A condition that fails is an error too, with its place.
  test('passes a failure on with its place', () => {
    expect(prepared().condition(URGENT, { row: {} }, 2)).toMatchObject({ ok: false, error: { code: 'missing-value', row: 2 } })
  })
})

describe('budgets', () => {
  // The deepest comprehension the structural limits allow, 64 by 64 over a
  // literal list, fits the budget of one evaluation...
  test('lets the largest nested comprehension run', () => {
    const outcome = prepared(reportOf(`${LIST}.all(a, ${LIST}.all(b, a * b >= 0))`, 'params.x + params.y + params.z')).evaluate(at(0), {})
    expect(value(outcome)).toEqual({ type: 'boolean', value: true })
  })

  // ...and one that reads three values in each of its 4096 turns does not:
  // it is stopped, with its place, rather than allowed to run on.
  test('stops an expression past its own budget', () => {
    const expressions = prepared(reportOf(`${LIST}.all(a, ${LIST}.all(b, params.x + params.y + params.z != "q"))`))
    const outcome = expressions.evaluate(at(0), STRINGS)
    expect(outcome).toMatchObject({ ok: false, error: { code: 'expression-budget', componentId: 'probe-text' } })
    expect(expressions.spent).toBe(EXPRESSION_STEP_BUDGET + 1)
  })

  // Every evaluation is charged its steps and one more for itself, so many
  // cheap evaluations count as well as one dear one.
  test('charges each evaluation its steps and one', () => {
    const expressions = prepared(reportOf('params.x', 'params.x + params.y + params.z'))
    value(expressions.evaluate(at(0), STRINGS))
    expect(expressions.spent).toBe(2)
  })

  // A render as a whole is bounded too: once its budget is spent, every
  // later evaluation is refused, and says the render's budget stopped it.
  // This spends the real budget, five million steps of one comprehension:
  // under a second here, and a few under coverage, hence its own timeout.
  test('refuses every evaluation once the render budget is spent', { timeout: 60_000 }, () => {
    const expressions = prepared(reportOf(`${LIST}.all(a, ${LIST}.all(b, a * b >= 0))`, 'params.x', 'params.y + params.z'))
    let evaluations = 0
    while (expressions.evaluate(at(0), {}).ok) evaluations++
    expect(expressions.spent).toBeLessThanOrEqual(RENDER_STEP_BUDGET + 1)
    expect(evaluations).toBe(Math.floor(RENDER_STEP_BUDGET / 8386))
    expect(expressions.evaluate(at(1), STRINGS)).toMatchObject({ ok: false, error: { code: 'render-budget' } })
  })
})
