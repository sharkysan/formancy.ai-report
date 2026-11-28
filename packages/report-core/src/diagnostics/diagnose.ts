/**
 * What an editor shows about a valid report: the errors the runtime would
 * refuse it for, and the warnings an author probably wants to see, in its
 * own language and in each language its translations declare.
 */
import { wordExpressionSites } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import type { Diagnostic } from './codes.js'
import { diagnosis } from './diagnosis.js'
import { inLanguage, lackedIn } from './words.js'
import type { MissingWords } from './words.js'

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

/** A language a report declares, as `diagnoseByLanguage` gives it: its diagnostics, as `languageDiagnostics` gives them, and what it lacks, as `missingWords` does. */
export interface LanguageDiagnosis {
  readonly locale: string
  readonly diagnostics: readonly Diagnostic[]
  readonly missing: MissingWords
}

/** A report's diagnostics split by language, as `diagnoseByLanguage` gives them. */
export interface DiagnosisByLanguage {
  /** The report's own, which name no language: an error here refuses every render. */
  readonly diagnostics: readonly Diagnostic[]
  /** Each language its translations declare, in their order: an error here refuses a render in that language alone. */
  readonly languages: readonly LanguageDiagnosis[]
}

/**
 * `diagnose`'s diagnostics of `report`, a report the validator accepts,
 * split by the language each names, with what each declared language
 * lacks -- `languageDiagnostics` and `missingWords` for every language --
 * from one diagnosis of the report: each of those diagnoses the report
 * again, so a verdict that asked both of every language diagnosed a
 * report in twenty-three languages twenty-four times more than it needed
 * (0088). Each language's written report is diagnosed once, as
 * `diagnose` diagnoses it.
 */
export function diagnoseByLanguage(report: ReportDefinition): DiagnosisByLanguage {
  const own = diagnosis(report)
  const sites = wordExpressionSites(report)
  const languages = (report.translations ?? []).map((translation) => ({
    locale: translation.locale,
    diagnostics: inLanguage(report, translation.locale, own),
    missing: lackedIn(report, translation, sites, own),
  }))
  return { diagnostics: own.diagnostics, languages }
}
