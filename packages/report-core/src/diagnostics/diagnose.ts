/**
 * What an editor shows about a valid report: the errors the runtime would
 * refuse it for, and the warnings an author probably wants to see, in its
 * own language and in each language its translations declare.
 */
import type { ReportDefinition } from '@formancy/report-spec'
import type { Diagnostic } from './codes.js'
import { diagnosis } from './diagnosis.js'
import { inLanguage } from './words.js'

/**
 * Every diagnostic for `report`, a report the validator accepts -- a
 * session's document is one: its own language's first, in `diagnosis`'s
 * order, then each translation's, in the order the report declares them,
 * each naming its `language` (0063). An error that names none refuses
 * every render; one that names a language refuses a render in that
 * language alone.
 */
export function diagnose(report: ReportDefinition): Diagnostic[] {
  const own = diagnosis(report)
  return [...own.diagnostics, ...(report.translations ?? []).flatMap(({ locale }) => inLanguage(report, locale, own))]
}
