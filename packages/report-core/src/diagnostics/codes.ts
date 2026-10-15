/**
 * What the diagnostics can say about a valid report, as stable codes, each
 * with the severity it always has.
 *
 * A diagnostic is not a validation error. The report it is about is valid:
 * the session holds nothing else. An error here is one the runtime will
 * refuse to render -- an expression that does not compile, or reads
 * something that is not there -- which plan 15 puts at its second level, the
 * bindings; a warning is something an author probably did not mean, and
 * renders as written.
 */
import type { SourceSpan } from '@formancy/expressions'

export const DIAGNOSTIC_SEVERITIES = {
  /** An expression that does not parse. */
  'expression-syntax': 'error',
  /** An expression past a structural limit of `@formancy/expressions`: too deep, too many nodes, too long a list. */
  'expression-limit': 'error',
  /** An expression whose types do not meet, each member read as the type it is declared: an integer parameter added to a string, a decimal field compared with an integer, a decimal converted with dec() again. */
  'expression-type': 'error',
  /** An expression its place does not allow: a condition that is not a boolean, a function its kind forbids. */
  'expression-policy': 'error',
  /** An expression that reads a name, or a member of one, that nothing declares, or a member of a single value. */
  'expression-unknown-name': 'error',
  /** An expression that reads `row` or `group` where there is no row or group. */
  'expression-out-of-scope': 'error',
  /** An expression that reads an image field, which is drawn and never read. */
  'expression-unreadable-field': 'error',
  /** An expression that calls the clock or a random draw, so two renders of the same data could differ. */
  'expression-not-reproducible': 'error',
  /** An expression that computes with a double, which is not exact, or divides with `/`, which on integers drops the remainder: `dec("…")` and `divide(dec(a), dec(b), places)` keep a number exact. */
  'expression-inexact': 'error',
  /** An expression that calls `matches()`, whose backtracking pattern can run for as long as it likes inside one step of the budget. */
  'expression-unbounded': 'error',
  /** An expression that reads a name whole -- `size(params)`, `row[key]` -- rather than a member by its id: what it reads cannot be checked, and is never bound. */
  'expression-dynamic-read': 'error',
  /** An aggregate's expression that gives a value its function cannot total: a sum of strings, an average of instants. */
  'expression-aggregate-type': 'error',
  /** An aggregate whose expression reads its own total, directly or through other aggregates, or reads one that does: none of them can be computed. */
  'aggregate-cycle': 'error',
  /** A number or currency format that prints a total at fewer places than its declared rounding keeps, so the total is rounded twice and the second rounding ignores the declared mode. */
  'format-rounds-again': 'error',
  /** A rounding declared on an aggregate that computes an integer, a date or an instant, which have no places to round: the runtime refuses it. */
  'rounding-not-decimal': 'error',
  /** A print style nothing uses. */
  'unused-style': 'warning',
  /** An asset nothing draws. */
  'unused-asset': 'warning',
  /** A parameter nothing prints or reads: the person rendering is asked for it for nothing. */
  'unused-parameter': 'warning',
  /** A dataset field nothing prints, draws, orders by, totals or reads: the provider fetches it for nothing. */
  'unused-field': 'warning',
  /** An aggregate nothing prints or reads: computed over every row for nothing. */
  'unused-aggregate': 'warning',
  /** A report whose body holds nothing. */
  'empty-body': 'warning',
  /** A text that prints nothing: no runs, or only empty literal ones. */
  'empty-text': 'warning',
} as const satisfies Readonly<Record<string, 'error' | 'warning'>>

export type DiagnosticCode = keyof typeof DIAGNOSTIC_SEVERITIES

export type DiagnosticSeverity = (typeof DIAGNOSTIC_SEVERITIES)[DiagnosticCode]

export const DIAGNOSTIC_CODES = Object.keys(DIAGNOSTIC_SEVERITIES) as readonly DiagnosticCode[]

export interface Diagnostic {
  readonly severity: DiagnosticSeverity
  readonly code: DiagnosticCode
  /** For a person: what is wrong, in the author's terms. */
  readonly message: string
  /** A JSON Pointer to what it is about: an expression's `cel`, a declaration, a list. */
  readonly path: string
  /** The innermost component it is about, when it is about one. */
  readonly componentId?: string
  /** For an expression in a table's column, the column's id: its value, its condition or a style rule of it. */
  readonly columnId?: string
  /** For an expression, the characters of its source it is about, half-open. */
  readonly position?: SourceSpan
  /** For an expression, what `@formancy/expressions` suggests writing instead, when it suggests something. */
  readonly hint?: string
}

/** Where a diagnostic points, besides its path. */
export interface Where {
  readonly path: string
  readonly componentId?: string | undefined
  readonly columnId?: string | undefined
  readonly position?: SourceSpan | undefined
  readonly hint?: string | undefined
}

export function diagnostic(code: DiagnosticCode, message: string, where: Where): Diagnostic {
  return {
    severity: DIAGNOSTIC_SEVERITIES[code],
    code,
    message,
    path: where.path,
    ...(where.componentId === undefined ? {} : { componentId: where.componentId }),
    ...(where.columnId === undefined ? {} : { columnId: where.columnId }),
    ...(where.position === undefined ? {} : { position: where.position }),
    ...(where.hint === undefined ? {} : { hint: where.hint }),
  }
}
