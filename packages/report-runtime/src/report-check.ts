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
 * never renders what the editor refuses. A report written in several
 * languages is checked for the one a render names, and what the render
 * reads is the report written in it (0063, `languages.ts`).
 */
import type { ReportDefinition } from '@formancy/report-spec'
import { validateReport } from '@formancy/report-spec'
import { prepareExpressions } from './evaluate.js'
import type { ReportExpressions } from './evaluate.js'
import { printLocale } from './languages.js'
import { fromDiagnostic, fromReport } from './resolve-errors.js'
import type { RuntimeError } from './resolve-errors.js'

export type ReportCheck =
  | {
      readonly ok: true
      /** The copy validation read, translations and all: what the manifest's hash names. */
      readonly report: ReportDefinition
      /** That copy written in the render's locale, with no translations (0063): what the render prints, the copy itself less its translations in its own locale. */
      readonly printed: ReportDefinition
      readonly expressions: ReportExpressions
    }
  | { readonly ok: false; readonly errors: readonly RuntimeError[] }

/**
 * `report` validated and its expressions compiled for one render in
 * `locale`, the report's own where absent, or every reason it is refused:
 * each structural error; a locale the report is not written in
 * (`undeclared-locale`); or, for a report that is structurally valid,
 * each diagnostic of severity error that names no language or that
 * locale (0063).
 */
export function checkReport(report: unknown, locale?: string): ReportCheck {
  const validation = validateReport(report)
  if (!validation.valid) return { ok: false, errors: validation.errors.map(fromReport) }
  const chosen = printLocale(validation.report, locale)
  if (!chosen.ok) return { ok: false, errors: [chosen.error] }
  const prepared = prepareExpressions(validation.report, chosen.locale)
  if (!prepared.ok) return { ok: false, errors: prepared.diagnostics.map(fromDiagnostic) }
  return { ok: true, report: validation.report, printed: prepared.report, expressions: prepared.expressions }
}
