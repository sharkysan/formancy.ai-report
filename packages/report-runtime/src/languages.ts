/**
 * The language a render prints in (0063): the locale it names, held to
 * those the report is written in, the errors that refuse a render in it,
 * and a formancy form's labels held to it.
 *
 * - **A declared locale, exactly.** A render names the report's own
 *   locale or one its translations declare, and nothing near either:
 *   fr-FR is not fr-CH, and fr is neither. A render that names none
 *   prints in the report's own, as every render did before. report-spec's
 *   `renderLocale` decides it, the rule report-forms holds a read to.
 * - **An error refuses its own language.** Of the editor's diagnostics,
 *   an error that names no language refuses every render, and one that
 *   names a language a render in it alone: a report whose French lacks a
 *   word prints in its own language, and in every other that is whole.
 * - **The report in that language.** What a render prints is report-spec's
 *   `reportIn`: its words, the expressions that print words, its locale
 *   and its slip's language the render's, and no translations, so that
 *   every stage after this one reads a report in one language, as every
 *   report was before, with no language step of its own.
 * - **Labels read in it.** Form data names the locale its labels were read
 *   in where it is not the report's own; data that names none was read in
 *   the report's own. Labels read in another locale than the render's are
 *   refused, never printed in a language it does not name.
 */
import type { Diagnostic } from '@formancy/report-core'
import { declaredLocales, renderLocale } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import type { DataFindings } from './data-errors.js'
import type { RuntimeError } from './resolve-errors.js'
import type { DataSource } from './source.js'

export type LocaleChoice = { readonly ok: true; readonly locale: string } | { readonly ok: false; readonly error: RuntimeError }

/**
 * The locale a render of `report` prints in -- `requested`, or the
 * report's own where nothing is requested -- or the error that refuses
 * it: `undeclared-locale`, at the options, naming the locales the report
 * is written in. `requested` is the host's, whatever its type says.
 */
export function printLocale(report: ReportDefinition, requested: unknown): LocaleChoice {
  const choice =
    requested === undefined || typeof requested === 'string'
      ? renderLocale(report, requested)
      : { ok: false as const, message: `a render names its locale as a tag; this report is written in ${declaredLocales(report).join(', ')}` }
  return choice.ok ? choice : { ok: false, error: { stage: 'resolve', code: 'undeclared-locale', path: '', message: choice.message } }
}

/** Whether `diagnostic` refuses a render in `locale`: an error that names no language refuses every render, one that names a language a render in it alone. */
export const refuses = (diagnostic: Diagnostic, locale: string): boolean =>
  diagnostic.severity === 'error' && (diagnostic.language === undefined || diagnostic.language === locale)

/** Where `locale`, one `report` is written in, stands in it: the report's own at `/locale`, a translation's at the translation that declares it. */
export function localePath(report: ReportDefinition, locale: string): string {
  const index = (report.translations ?? []).findIndex((translation) => translation.locale === locale)
  return index === -1 ? '/locale' : `/translations/${index}/locale`
}

/**
 * Reports form data whose labels were read in another locale than
 * `printed`, the one the render prints in: a source that names none was
 * read in `own`, the report's own. Data of no form, or of Formancy Data,
 * holds no label of a form's.
 */
export function checkLabels(errors: DataFindings, source: DataSource | undefined, own: string, printed: string): void {
  if (source?.provider !== 'formancy-form' || (source.locale ?? own) === printed) return
  const read = source.locale === undefined ? "the report's own locale" : 'another locale'
  errors.report(
    source.locale === undefined ? '/source' : '/source/locale',
    'labels-locale-differs',
    `the form's labels were read in ${read}, and this render prints in ${printed}: read them again in ${printed}, or render in the locale they were read in, since labels are never printed in a language the render does not name`,
  )
}
