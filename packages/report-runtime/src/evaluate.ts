/**
 * A report's expressions, compiled once and evaluated against checked data,
 * within a budget, each failure an error that says where.
 *
 * - **One compilation.** `@formancy/report-core`'s `compileReport` compiles
 *   every expression where it stands, and the editor's diagnostics come
 *   from the same function (0009). A report its diagnostics give an error
 *   for is refused before anything is evaluated, so the runtime never runs
 *   what the editor refuses. Each expression is compiled once per render,
 *   never once per row -- twice, in fact, since `diagnose` does not hand
 *   back the compilation it made.
 * - **One binding.** Each program's values are made by report-core's
 *   `expressionValues`: an integer as a BigInt, a decimal as a `Decimal`,
 *   an instant as a moment, a date as its ISO string. A value missing, or of
 *   another type, fails the evaluation, naming the member and never quoting
 *   the value.
 * - **Nothing differs between renders.** The diagnostics refuse `now()`,
 *   `today()` and `random()`; the capabilities an evaluation is handed are
 *   fixed besides, so that one reached anyway would answer the same in every
 *   render.
 * - **Bounded.** Each evaluation has a budget of steps, and a render has one
 *   for all its evaluations together. Past either, the evaluation is refused.
 * - **A failure is an error, never a blank.** It names the component, the
 *   table column or the aggregate, and the detail row, and gives upstream's
 *   code for what went wrong, never upstream's message, which can quote the
 *   values it was computing with.
 *
 * What an expression gives is handed back typed as the runtime holds values:
 * an integer as a BigInt, an instant in UTC. A list or a map, which has no
 * text, is refused. A double never arrives: the diagnostics refuse every
 * double literal, every `double()` and every `/` before anything is
 * evaluated (report-core's `exactness.ts`), since upstream hands an integer
 * and a double back alike, as a JavaScript number, and `int()` of a double
 * would otherwise print as an exact integer. A number that is not a safe
 * integer is still refused here, rather than printed.
 */
import { DEFAULT_BUDGET, Decimal, evaluate, fixedCapabilities } from '@formancy/expressions'
import type { Capabilities, ExpressionValue } from '@formancy/expressions'
import { compileReport, diagnose, expressionValues } from '@formancy/report-core'
import type { CompiledExpression, Diagnostic, ExpressionValues, ReportCompilation } from '@formancy/report-core'
import type { ReportDefinition } from '@formancy/report-spec'
import type { TypedValue } from './format.js'
import { canonicalInstant } from './values.js'

/**
 * Steps one evaluation may take: upstream's default for a formancy form's
 * expression (`DEFAULT_BUDGET`). A report expression reads single values, so
 * the only way to spend many steps is a comprehension over a list literal;
 * the deepest the structural limits allow, 64 by 64, measured 8,385 steps,
 * and `evaluate.test.ts` holds that it fits while one reading three values
 * in each turn (28,865 steps) does not.
 */
export const EXPRESSION_STEP_BUDGET = DEFAULT_BUDGET.maxSteps

/**
 * Steps every evaluation of one render may take together, each charged its
 * steps and one more for itself. Measured as a render spends them, through
 * `condition()` with each evaluation's binding included, on 15 October
 * 2026, on an Intel i9-10900K under Node 24.21 with `@formancy/expressions`
 * 0.5.0: ten million steps of `row.urgent` took 10.0 seconds (1.00
 * microseconds a step) and of `row.amount * dec("1.081") > dec("10")` 13.0
 * (1.30). An earlier measurement, of upstream's `evaluate` alone, had put
 * that budget at 8.5 seconds and missed the binding. So the budget is five
 * million: about 5 to 6.5 seconds of evaluation on that machine, against
 * the plan's investigation target of ten seconds in all for a hundred-page
 * report. A report of `MAX_DETAIL_ROWS` rows evaluating ten one-read
 * expressions per row spends 2,000,000.
 */
export const RENDER_STEP_BUDGET = 5_000_000

/**
 * What `now()`, `today()` and `random()` would give: nothing a report may
 * read (0009), fixed so that one reached anyway gives the same answer in
 * every render.
 */
export const CAPABILITIES: Capabilities = fixedCapabilities({ nowMs: 0, today: '1970-01-01', random: 0 })

export const EVALUATION_ERROR_CODES = [
  /** A path at which the report has no compiled expression: the caller's defect. */
  'unknown-expression',
  /** A member the expression reads has no value: a field a preview's data lacks, or a total not yet computed. */
  'missing-value',
  /** A value of another type than its member's, which the data check admits none of. */
  'unbound-value',
  /** Upstream refused the evaluation: a division by zero, an overflow, a result too large to hand back. */
  'expression-failed',
  /** The evaluation took more than `EXPRESSION_STEP_BUDGET` steps. */
  'expression-budget',
  /** The render has spent `RENDER_STEP_BUDGET` steps. */
  'render-budget',
  /** A number that is not a safe integer: a double, which the diagnostics refuse before anything is evaluated. */
  'inexact-value',
  /** A list, a map or anything else without text. */
  'unprintable-value',
  /** A condition that gave something other than a boolean. */
  'not-a-condition',
] as const
export type EvaluationErrorCode = (typeof EVALUATION_ERROR_CODES)[number]

/** Why an evaluation gave no value, and where. */
export interface EvaluationError {
  readonly code: EvaluationErrorCode
  /** For a person: where and what, never a value. */
  readonly message: string
  /** The JSON Pointer to the expression's `cel` in the report. */
  readonly path: string
  readonly componentId?: string
  readonly columnId?: string
  /** The aggregate whose expression this is, for one read from each row. */
  readonly aggregateId?: string
  /** The detail row's index in the data, when the expression read one. */
  readonly row?: number
}

export type Evaluation = { readonly ok: true; readonly value: TypedValue | null } | { readonly ok: false; readonly error: EvaluationError }

export type ConditionEvaluation = { readonly ok: true; readonly value: boolean } | { readonly ok: false; readonly error: EvaluationError }

export interface ReportExpressions {
  /** What compiled: the programs by path, the members, and the order aggregates are computed in. */
  readonly compilation: ReportCompilation
  /** Steps this render has spent, each evaluation charged its steps and one more. */
  readonly spent: number
  /** The expression at `path` evaluated over `values`; `row` is the detail row's index, for an error to name. */
  evaluate(path: string, values: ExpressionValues, row?: number): Evaluation
  /** The condition at `path` -- a `visibleWhen` or a style rule's `when` -- evaluated over `values`. */
  condition(path: string, values: ExpressionValues, row?: number): ConditionEvaluation
}

export type ExpressionsPreparation = { readonly ok: true; readonly expressions: ReportExpressions } | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }

/** The typed value an expression's result is, or why it is not one. Exported for its test alone. */
export function typed(result: ExpressionValue, resultType: string): TypedValue | null | { readonly code: EvaluationErrorCode; readonly what: string } {
  if (result === null) return null
  if (result instanceof Decimal) return { type: 'decimal', value: result }
  switch (typeof result) {
    case 'boolean':
      return { type: 'boolean', value: result }
    case 'string': {
      const instant = resultType === 'timestamp' ? canonicalInstant(result) : undefined
      return instant === undefined ? { type: 'string', value: result } : { type: 'instant', value: instant }
    }
    case 'number':
      // Upstream hands an integer back as a number, and refuses one it cannot hold exactly.
      if (Number.isSafeInteger(result)) return { type: 'integer', value: BigInt(result) }
      return { code: 'inexact-value', what: 'the expression gives a double, which is not exact; dec() keeps a number exact' }
    default:
      return { code: 'unprintable-value', what: 'the expression gives a list or a map, which has no text' }
  }
}

/** One render's evaluations of a report's expressions. */
class Evaluator implements ReportExpressions {
  readonly compilation: ReportCompilation
  readonly #aggregates: readonly string[]
  #spent = 0

  constructor(report: ReportDefinition, compilation: ReportCompilation) {
    this.compilation = compilation
    this.#aggregates = report.aggregates.map(({ id }) => id)
  }

  get spent(): number {
    return this.#spent
  }

  evaluate(path: string, values: ExpressionValues, row?: number): Evaluation {
    const compiled = this.compilation.expressions.get(path)
    if (compiled === undefined) return { ok: false, error: { code: 'unknown-expression', message: `the report has no expression at ${path}`, path } }
    const fail = (code: EvaluationErrorCode, what: string): Evaluation => ({ ok: false, error: this.#error(compiled, code, what, row) })
    for (const read of compiled.reads) {
      const scope = values[read.name]
      if (scope === undefined || !Object.hasOwn(scope, read.member)) return fail('missing-value', `${read.name}.${read.member} has no value: it is missing, which is not null`)
    }
    let bound: Record<string, unknown>
    try {
      bound = expressionValues(compiled, values)
    } catch (error) {
      // report-core's refusal names the member and its type, and never quotes the value.
      return fail('unbound-value', (error as TypeError).message)
    }
    if (this.#spent >= RENDER_STEP_BUDGET) return fail('render-budget', `the render has spent its budget of ${RENDER_STEP_BUDGET} steps`)
    const maxSteps = Math.min(EXPRESSION_STEP_BUDGET, RENDER_STEP_BUDGET - this.#spent - 1)
    const outcome = evaluate(compiled.program, bound, { capabilities: CAPABILITIES, budget: { maxSteps } })
    if (!outcome.ok) {
      const exhausted = outcome.error.kind === 'budget'
      this.#spent += (exhausted ? maxSteps : 0) + 1
      if (!exhausted) return fail('expression-failed', `the expression failed (${outcome.error.code})`)
      if (maxSteps < EXPRESSION_STEP_BUDGET) return fail('render-budget', `the render has spent its budget of ${RENDER_STEP_BUDGET} steps`)
      return fail('expression-budget', `the expression took more than its budget of ${EXPRESSION_STEP_BUDGET} steps`)
    }
    this.#spent += outcome.steps + 1
    const value = typed(outcome.value, compiled.program.resultType)
    return value !== null && 'code' in value ? fail(value.code, value.what) : { ok: true, value }
  }

  condition(path: string, values: ExpressionValues, row?: number): ConditionEvaluation {
    const outcome = this.evaluate(path, values, row)
    if (!outcome.ok) return outcome
    if (outcome.value?.type === 'boolean') return { ok: true, value: outcome.value.value }
    const compiled = this.compilation.expressions.get(path) as CompiledExpression
    return { ok: false, error: this.#error(compiled, 'not-a-condition', 'a condition gives true or false, and this expression gives something else', row) }
  }

  /** An error about `compiled`, naming where it stands and the row it read. */
  #error(compiled: CompiledExpression, code: EvaluationErrorCode, what: string, row: number | undefined): EvaluationError {
    const { site } = compiled
    const aggregateId = site.path.startsWith('/aggregates/') ? this.#aggregates[Number(site.path.split('/')[2])] : undefined
    const place = [
      // The payment part stands in no component, and is named as one would be.
      site.path.startsWith('/paymentPart/') ? 'the payment part' : undefined,
      site.componentId === undefined ? undefined : `component ${site.componentId}`,
      site.columnId === undefined ? undefined : `column ${site.columnId}`,
      aggregateId === undefined ? undefined : `aggregate ${aggregateId}`,
      row === undefined ? undefined : `detail row ${row}`,
    ].filter((part) => part !== undefined)
    return {
      code,
      message: `${place.join(', ')}: ${what}`,
      path: site.path,
      ...(site.componentId === undefined ? {} : { componentId: site.componentId }),
      ...(site.columnId === undefined ? {} : { columnId: site.columnId }),
      ...(aggregateId === undefined ? {} : { aggregateId }),
      ...(row === undefined ? {} : { row }),
    }
  }
}

/**
 * `report`'s expressions compiled for one render, or the diagnostics that
 * refuse it: every error `diagnose` gives, which the editor shows too.
 * `report` is one the validator accepts. The evaluations of one render
 * share one budget, so a render prepares its own.
 */
export function prepareExpressions(report: ReportDefinition): ExpressionsPreparation {
  const errors = diagnose(report).filter(({ severity }) => severity === 'error')
  if (errors.length > 0) return { ok: false, diagnostics: errors }
  return { ok: true, expressions: new Evaluator(report, compileReport(report)) }
}
