/**
 * A report written in one of its languages (0063): the locale a render
 * may name, and the report with its words and its word expressions
 * replaced by that language's.
 *
 * One function decides it, so that the validator, the core's diagnostics
 * and the runtime write a report in a language one way: every word place
 * of `translation.ts`'s walk whose word, or whose expression's source,
 * the language translates, replaced whole; `locale` the language's; the
 * QR-bill's headings in that language where SIX has them; and no
 * translations left, so that what reads the result reads a report in one
 * language, as every report was before.
 */
import { quote } from './check.js'
import type { ReportDefinition } from './definition.js'
import { QR_BILL_LANGUAGES } from './payment-part.js'
import { at } from './pointer.js'
import { isWord, wordPlaces } from './translation.js'
import type { Translation } from './translation.js'

/** The locales `report` is written in: its own first, then each translation's, in the order declared. */
export function declaredLocales(report: ReportDefinition): readonly string[] {
  return [report.locale, ...(report.translations ?? []).map(({ locale }) => locale)]
}

export type LocaleChoice = { readonly ok: true; readonly locale: string } | { readonly ok: false; readonly message: string }

/**
 * The locale a render of `report` prints in: `requested` where the report
 * is written in it, the report's own where nothing is requested. A locale
 * the report does not declare is refused, never matched to a near one:
 * de-DE is not de-CH, and de is neither.
 */
export function renderLocale(report: ReportDefinition, requested?: string): LocaleChoice {
  if (requested === undefined) return { ok: true, locale: report.locale }
  const declared = declaredLocales(report)
  if (declared.includes(requested)) return { ok: true, locale: requested }
  return { ok: false, message: `${quote(requested)} is not a locale this report is written in; it is written in ${declared.join(', ')}` }
}

/** A string a translation replaces: where it stands, what prints there, and the translation's entry it comes from, as JSON Pointers. */
export interface Substitution {
  readonly path: string
  readonly text: string
  /** The entry's `text`, for a word, or its expression's `cel`, for an expression. */
  readonly entry: string
}

/** What the translation at `index` replaces in `report`: each word it translates, at every place it stands, then each word expression, each in document order. */
export function substitutions(report: ReportDefinition, index: number): readonly Substitution[] {
  const translation = report.translations?.[index] as Translation
  const base = at('/translations', index)
  const words = new Map(translation.words.map(({ word, text }, entry) => [word, { text, entry: `${base}/words/${entry}/text` }]))
  const expressions = new Map(
    translation.expressions.map(({ cel, expression }, entry) => [cel, { text: expression.cel, entry: `${base}/expressions/${entry}/expression/cel` }]),
  )
  const places = wordPlaces(report)
  return [
    // A translated word holds a letter, which the validator holds, so a literal with none finds no translation.
    ...places.literals.flatMap(({ path, text }) => {
      const found = words.get(text)
      return found === undefined ? [] : [{ path, ...found }]
    }),
    ...places.expressions.flatMap(({ path, cel }) => {
      const found = expressions.get(cel)
      return found === undefined ? [] : [{ path, ...found }]
    }),
  ]
}

/** `value` copied, each string at a path `replace` names replaced, and `translations` left out at the top. */
function copied(value: unknown, path: string, replace: ReadonlyMap<string, string>): unknown {
  const replacement = replace.get(path)
  if (replacement !== undefined) return replacement
  if (Array.isArray(value)) return value.map((item, index) => copied(item, at(path, index), replace))
  if (typeof value !== 'object' || value === null) return value
  const entries = Object.entries(value).filter(([key]) => path !== '' || key !== 'translations')
  return Object.fromEntries(entries.map(([key, child]) => [key, copied(child, at(path, key), replace)]))
}

/** The QR-bill's language in a translation's locale: the locale's own where SIX has headings in it, the bill's otherwise. */
function slipLanguage(locale: string): string | undefined {
  const language = locale.split('-')[0] as string
  return (QR_BILL_LANGUAGES as readonly string[]).includes(language) ? language : undefined
}

/**
 * `report` -- one the validator accepts -- written in `locale` as far as
 * its translations go: each word and each word expression the language
 * translates replaced, every other left in the report's own; what the
 * validator checks each language by, and what the core diagnoses it by.
 * In the report's own locale, the report without its translations.
 * `locale` is one `renderLocale` accepted; another is a caller's mistake,
 * and throws a RangeError.
 */
export function writtenIn(report: ReportDefinition, locale: string): ReportDefinition {
  const index = (report.translations ?? []).findIndex((translation) => translation.locale === locale)
  if (locale === report.locale) {
    const { translations: _translations, ...own } = report
    return own
  }
  if (index === -1) throw new RangeError(`${quote(locale)} is not a locale this report is written in`)
  const replace = new Map(substitutions(report, index).map(({ path, text }) => [path, text]))
  replace.set('/locale', locale)
  const language = report.paymentPart === undefined ? undefined : slipLanguage(locale)
  if (language !== undefined) replace.set('/paymentPart/language', language)
  return copied(report, '', replace) as ReportDefinition
}

/**
 * `report` -- one the validator accepts -- written in `locale`, whole:
 * what a render in that locale prints. A word the language does not
 * translate is never printed in another, so one missing throws a
 * RangeError, as an undeclared locale does: a caller asks `renderLocale`
 * first, and report-core's `languageDiagnostics`, which says each word
 * missing, and each expression that prints words, before anything is
 * written. Neither throw is reached from a check that was made.
 */
export function reportIn(report: ReportDefinition, locale: string): ReportDefinition {
  const written = writtenIn(report, locale)
  if (locale === report.locale) return written
  const translated = new Set(substitutions(report, declaredLocales(report).indexOf(locale) - 1).map(({ path }) => path))
  const missing = wordPlaces(report).literals.filter(({ path, text }) => isWord(text) && !translated.has(path))
  if (missing.length > 0)
    throw new RangeError(`${missing.length} of this report's words are not written in ${quote(locale)}, and are never printed in another language`)
  return written
}
