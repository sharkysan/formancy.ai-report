/**
 * Whether a report can be rendered at all, before any data is read: the
 * first two levels of plan 15, structure and bindings.
 *
 * A report reaches the runtime as untrusted input, whatever its type says --
 * parsed from storage, posted by a browser. So it is validated again here,
 * with report-spec's `validateReport`, and what the runtime goes on to read
 * is the copy validation made, which no later change to the caller's object
 * reaches. Then its expressions are compiled with report-core, and a report
 * the editor's diagnostics give an error for is refused (0009): the runtime
 * never renders what the editor refuses.
 */
import type { ReportDefinition } from '@formancy/report-spec'
import { validateReport } from '@formancy/report-spec'
import { prepareExpressions } from './evaluate.js'
import type { ReportExpressions } from './evaluate.js'
import { fromDiagnostic, fromReport } from './resolve-errors.js'
import type { RuntimeError } from './resolve-errors.js'

export type ReportCheck =
  | { readonly ok: true; /** The copy validation read. */ readonly report: ReportDefinition; readonly expressions: ReportExpressions }
  | { readonly ok: false; readonly errors: readonly RuntimeError[] }

/**
 * `report` validated and its expressions compiled for one render, or every
 * reason it is refused: each structural error, or, for a report that is
 * structurally valid, each diagnostic of severity error.
 */
export function checkReport(report: unknown): ReportCheck {
  const validation = validateReport(report)
  if (!validation.valid) return { ok: false, errors: validation.errors.map(fromReport) }
  const prepared = prepareExpressions(validation.report)
  if (!prepared.ok) return { ok: false, errors: prepared.diagnostics.map(fromDiagnostic) }
  return { ok: true, report: validation.report, expressions: prepared.expressions }
}
