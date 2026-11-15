/**
 * Commands on a report's languages (0063): a language added, with no
 * words yet, or removed with its words; and a word, or an expression that
 * prints words, written in a language, or taken back.
 *
 * A word is named by its exact text in the report's own language, as the
 * translation keys it; an expression by its exact source. A command
 * refuses what names nothing: a language the report has no translation
 * in, a word or a source the report prints nowhere a word stands, a
 * translation taken back that is not there. Whether what it writes is a
 * translation the format holds -- not blank, a locale written as one --
 * the session's validator says, as it says of every command's result.
 * Nothing else changes: the report's own words are edited where they
 * stand, by the commands that edit them.
 */
import { reportWords, wordExpressionSites } from '@formancy/report-spec'
import type { Expression, ReportDefinition, Translation } from '@formancy/report-spec'
import { quote, refuse } from '../outcome.js'
import type { CommandOutcome, Refusal } from '../outcome.js'

/** `report` with `translations`, none left out as no property at all: one report has one spelling. */
function withTranslations(report: ReportDefinition, translations: readonly Translation[]): ReportDefinition {
  const { translations: _translations, ...rest } = report
  return translations.length === 0 ? rest : { ...rest, translations }
}

/** The report's translations, the one into `locale` among them and where it is; or the refusal when the report has none in it. */
interface Found {
  readonly translations: readonly Translation[]
  readonly index: number
  readonly translation: Translation
}

function translationIn(report: ReportDefinition, locale: string): Found | Refusal {
  const translations = report.translations ?? []
  const index = translations.findIndex((translation) => translation.locale === locale)
  if (index !== -1) return { translations, index, translation: translations[index] as Translation }
  const own = locale === report.locale ? ": it is the report's own, whose words are edited where they stand" : ''
  return refuse('not-found', `the report has no translation in ${quote(locale)}${own}`, { path: '/translations' })
}

/** `report` with the translation `found` names replaced by `translation`. */
function replaced(report: ReportDefinition, found: Found, translation: Translation): CommandOutcome {
  return {
    ok: true,
    report: withTranslations(
      report,
      found.translations.map((held, at) => (at === found.index ? translation : held)),
    ),
  }
}

/** `entries` with the entry `matches` names replaced by `entry`, or taken out for null, or `entry` after them; undefined when null takes out nothing. */
function put<T>(entries: readonly T[], matches: (entry: T) => boolean, entry: T | null): readonly T[] | undefined {
  const at = entries.findIndex(matches)
  if (entry === null) return at === -1 ? undefined : entries.filter((_, index) => index !== at)
  return at === -1 ? [...entries, entry] : entries.map((held, index) => (index === at ? entry : held))
}

/** A language added, its words not yet written: every word is then missing in it, which the diagnostics say. Refused for the report's own and for one it has. */
export function addLanguage(report: ReportDefinition, locale: string): CommandOutcome {
  if (locale === report.locale || (report.translations ?? []).some((translation) => translation.locale === locale)) {
    return refuse('already-declared', `the report is written in ${quote(locale)} already`, { path: '/translations' })
  }
  return { ok: true, report: withTranslations(report, [...(report.translations ?? []), { locale, words: [], expressions: [] }]) }
}

/** A language removed with its words; the last leaves the report without translations. */
export function removeLanguage(report: ReportDefinition, locale: string): CommandOutcome {
  const found = translationIn(report, locale)
  if (!('index' in found)) return found
  return {
    ok: true,
    report: withTranslations(
      report,
      found.translations.filter((_, index) => index !== found.index),
    ),
  }
}

/**
 * `word` -- a word of the report's own language -- written as `text` in
 * `locale`, or, for null, its translation there taken back. A word the
 * report prints nowhere is refused, unless its translation is taken back:
 * one kept for a word the report no longer prints is said unused, and
 * removed by this.
 */
export function translateWord(report: ReportDefinition, locale: string, word: string, text: string | null): CommandOutcome {
  const found = translationIn(report, locale)
  if (!('index' in found)) return found
  if (text !== null && !reportWords(report).some((place) => place.text === word)) {
    return refuse('not-found', `the report prints no word ${quote(word)} to translate`)
  }
  const words = put(found.translation.words, (entry) => entry.word === word, text === null ? null : { word, text })
  if (words === undefined) return refuse('not-found', `${quote(word)} has no translation in ${quote(locale)} to take back`)
  return replaced(report, found, { ...found.translation, words })
}

/**
 * The expression whose source is `cel`, standing where a word does,
 * written as `expression` in `locale`, or, for null, its translation
 * there taken back. Whether it prints words, and whether the translation
 * prints what it does, the diagnostics say (0063).
 */
export function translateExpression(report: ReportDefinition, locale: string, cel: string, expression: Expression | null): CommandOutcome {
  const found = translationIn(report, locale)
  if (!('index' in found)) return found
  if (expression !== null && !wordExpressionSites(report).some((site) => site.cel === cel)) {
    return refuse('not-found', 'the report holds this expression nowhere a word stands, and an expression is translated only where it prints words')
  }
  const expressions = put(found.translation.expressions, (entry) => entry.cel === cel, expression === null ? null : { cel, expression })
  if (expressions === undefined) return refuse('not-found', `this expression has no translation in ${quote(locale)} to take back`)
  return replaced(report, found, { ...found.translation, expressions })
}
