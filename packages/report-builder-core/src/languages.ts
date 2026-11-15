/**
 * The languages a report is written in, as the editor shows and edits them
 * ([0063](../../../docs/decisions/0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md)):
 * which one a person edits -- the report's own until another is chosen,
 * kept as the zoom is, the editor's own and never the report's -- each
 * language's name and how many of its words are missing, every place a
 * word stands that the language edited has not written, and the actions
 * that choose the language edited and remove one.
 *
 * What a word is, is report-spec's walk; which expressions print words,
 * report-core's `wordExpressions`; and how many words a language lacks,
 * report-core's `word-missing`, counted as the problems list them. This
 * decides only what the editor shows of them: the report as report-spec's
 * `writtenIn` writes it in the language edited, a word it lacks shown in
 * the report's own and marked missing.
 *
 * Lent what it needs of the editor, as `part-actions.ts` is, and run
 * through the editor's one `dispatch`.
 */
import { removeLanguage, wordExpressions } from '@formancy/report-core'
import type { CommandOutcome, Diagnostic } from '@formancy/report-core'
import { declaredLocales, reportWords } from '@formancy/report-spec'
import type { ReportDefinition, Translation, WordPlace } from '@formancy/report-spec'
import type { Edit } from './edits.js'
import { columnKey } from './labels.js'
import { DONE } from './model-actions.js'
import type { EditorOutcome, EditorRefusalCode } from './model-actions.js'
import type { EditorLanguages } from './model.js'
import { selectionKey } from './outline.js'
import type { Derived, Local } from './state.js'
import type { EditorLocale, EditorText } from './text.js'

/**
 * A language's name in the editor's language, by Intl: "French
 * (Switzerland)", "Französisch (Schweiz)". A tag Intl cannot name -- one
 * a person is typing, which the validator will refuse -- is said as typed.
 */
export function languageName(locale: string, editorLocale: EditorLocale): string {
  try {
    return new Intl.DisplayNames(editorLocale, { type: 'language', languageDisplay: 'standard' }).of(locale) ?? locale
  } catch {
    return locale
  }
}

/** The language edited, as the editor's derivations read it. */
export interface Edited {
  /** What the person chose: a locale a translation declares, or null for the report's own. */
  readonly chosen: string | null
  /** The locale edited: the report's own, or the chosen one. */
  readonly locale: string
  /** Its name, in the editor's language. */
  readonly name: string
  /** The translation into it; none in the report's own language, whose words are edited where they stand. */
  readonly translation: Translation | undefined
  /** Where that translation stands in the report, as a pointer: what report-core points a translated expression's diagnostics into. */
  readonly at: string | undefined
  /** Every place a word stands that the language edited does not translate, a literal's or an expression's, in document order. */
  readonly missing: readonly Pick<WordPlace, 'path' | 'componentId' | 'columnId'>[]
  /** The sources of the expressions where words stand that print words: those a language translates. */
  readonly expressions: ReadonlySet<string>
  /** How many places each word stands in, by its text. */
  readonly words: ReadonlyMap<string, number>
  /** How many places each expression that prints words stands in, by its source. */
  readonly sources: ReadonlyMap<string, number>
}

function counted(texts: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const text of texts) counts.set(text, (counts.get(text) ?? 0) + 1)
  return counts
}

/** The language `chosen` -- a locale `report` declares, or null for its own -- as the derivations read it. One the report no longer declares is its own. */
export function editedLanguage(report: ReportDefinition, chosen: string | null, editorLocale: EditorLocale): Edited {
  const translations = report.translations ?? []
  const index = translations.findIndex((candidate) => candidate.locale === chosen)
  const translation = translations[index]
  if (translation === undefined) {
    const own = { locale: report.locale, name: languageName(report.locale, editorLocale) }
    return { chosen, ...own, translation, at: undefined, missing: [], expressions: new Set(), words: new Map(), sources: new Map() }
  }
  const words = reportWords(report)
  const sites = wordExpressions(report)
  const written = new Set(translation.words.map(({ word }) => word))
  const translated = new Set(translation.expressions.map(({ cel }) => cel))
  return {
    chosen,
    locale: translation.locale,
    name: languageName(translation.locale, editorLocale),
    translation,
    at: `/translations/${String(index)}`,
    missing: [...words.filter(({ text }) => !written.has(text)), ...sites.filter(({ cel }) => !translated.has(cel))],
    expressions: new Set(sites.map(({ cel }) => cel)),
    words: counted(words.map(({ text }) => text)),
    sources: counted(sites.map(({ cel }) => cel)),
  }
}

/**
 * The keys of what holds a word the language edited lacks: a component, a
 * table's column for its header and its value, the payment part for its
 * message. The title stands in the bar, which says nothing of it but the
 * word shown.
 */
export function missingKeys(edited: Edited): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const { path, componentId, columnId } of edited.missing) {
    if (componentId !== undefined) keys.add(columnId === undefined ? componentId : columnKey(componentId, columnId))
    else if (path.startsWith('/paymentPart/')) keys.add(selectionKey({ part: 'paymentPart' }))
  }
  return keys
}

/**
 * The languages the state shows: each the report is written in, its own
 * first, named in the editor's language, with how many words it lacks --
 * report-core's `word-missing`, once a word, as the problems list it.
 */
export function languagesOf(
  report: ReportDefinition,
  edited: Edited,
  diagnostics: readonly Diagnostic[],
  t: EditorText,
  locale: EditorLocale,
): EditorLanguages {
  return {
    edited: edited.locale,
    declared: declaredLocales(report).map((tag, index) => {
      const own = index === 0
      const name = languageName(tag, locale)
      const missing = own ? 0 : diagnostics.filter(({ code, language }) => code === 'word-missing' && language === tag).length
      const label = own ? t('language.own', { name }) : missing === 0 ? name : t('language.missing', { name, count: missing })
      return { locale: tag, name, label, own, missing }
    }),
  }
}

/** What the language actions are lent of the editor. */
export interface LanguageLent {
  readonly current: () => Derived
  readonly local: () => Local
  readonly setLocal: (next: Partial<Local>) => void
  readonly announce: (text: string) => Partial<Local>
  readonly refuse: (code: EditorRefusalCode, text: string, refusal?: Extract<CommandOutcome, { ok: false }>) => EditorOutcome
  readonly applyEdit: (edit: Edit, name: () => string) => EditorOutcome
}

export interface LanguageActions {
  setLanguage(locale: string): EditorOutcome
  removeLanguage(locale: string): EditorOutcome
}

export function languageActions(lent: LanguageLent, t: EditorText, locale: EditorLocale): LanguageActions {
  /** A locale as a person reads it, one a caller tsc never saw sent among them. */
  const named = (tag: unknown): string => (typeof tag === 'string' ? languageName(tag, locale) : String(tag))
  return {
    setLanguage(tag) {
      const { report } = lent.current()
      if (typeof tag !== 'string' || !declaredLocales(report).includes(tag)) return lent.refuse('not-found', t('status.notWrittenIn', { name: named(tag) }))
      const chosen = tag === report.locale ? null : tag
      if (chosen === lent.local().language) return DONE
      // A refused value kept on a field was typed in the other language's words.
      lent.setLocal({ language: chosen, errors: new Map(), ...lent.announce(t('status.languageShown', { name: named(tag) })) })
      return DONE
    },
    removeLanguage(tag) {
      const { report } = lent.current()
      if (typeof tag !== 'string' || !(report.translations ?? []).some((translation) => translation.locale === tag))
        return lent.refuse('not-found', t('status.notWrittenIn', { name: named(tag) }))
      const selection = lent.local().selection
      const edit: Edit = {
        command: (r) => removeLanguage(r, tag),
        step: { do: 'said', id: 'history.removeLanguage' },
        announce: 'status.languageRemoved',
        then: () => selection,
      }
      return lent.applyEdit(edit, () => named(tag))
    },
  }
}
