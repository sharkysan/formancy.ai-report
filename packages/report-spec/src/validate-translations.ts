/**
 * A report's translations (0063): their shape and bounds, and then the
 * report written in each of its languages, held to the rules every
 * report is held to.
 *
 * A word that stands in several places is translated once, and the
 * translation must hold wherever it stands: a column header's bound, a
 * QR-bill message's characters, a Factur-X title's metadata. Rather than
 * a second copy of each place's rule, the report is written in each
 * language -- missing words left in its own, as `writtenIn` writes it --
 * and read again by the reader that read the report, and each error that
 * reading finds is the translation's: the report in its own language was
 * valid. It is reported at the translation's entry that broke it, the
 * message naming the place and the language.
 */
import { all, matches, quote, readList, shape, text } from './check.js'
import type { ReportDefinition } from './definition.js'
import { MAX_EXPRESSION_LENGTH, MAX_LANGUAGES, MAX_TEXT_LENGTH, MAX_WORDS } from './limits.js'
import { at } from './pointer.js'
import { substitutions, writtenIn } from './report-in.js'
import type { Substitution } from './report-in.js'
import { LOCALE } from './syntax.js'
import { isWord } from './translation.js'
import type { TranslatedExpression, TranslatedWord, Translation } from './translation.js'
import { newContext } from './validate-context.js'
import type { Ctx } from './validate-context.js'
import { readExpression } from './validate-inline.js'

/** One entry of a translation that a language holds once: a word by its text, an expression by its source. */
function once(c: Ctx, key: string | undefined, path: string, seen: Set<string>, what: string): void {
  if (key === undefined) return
  if (seen.has(key)) c.f.report(path, 'duplicate-word', `${what} ${quote(key)} is translated twice in this language; a word has one translation in each`)
  seen.add(key)
}

function readWord(c: Ctx, value: unknown, path: string, seen: Set<string>): TranslatedWord | undefined {
  const o = shape(c.f, value, path, ['word', 'text'])
  const word = text(c.f, o?.word, at(path, 'word'), MAX_TEXT_LENGTH)
  const translation = text(c.f, o?.text, at(path, 'text'), MAX_TEXT_LENGTH)
  if (word !== undefined && !isWord(word)) {
    c.f.report(at(path, 'word'), 'not-a-word', `${quote(word)} holds no letter, so it prints as written in every language and is never translated`)
  } else once(c, word, at(path, 'word'), seen, 'the word')
  if (translation !== undefined && translation.trim() === '') {
    c.f.report(at(path, 'text'), 'blank-translation', "a translation prints in its word's place, and a blank one prints nothing there")
    return undefined
  }
  return word === undefined || translation === undefined ? undefined : { word, text: translation }
}

function readTranslatedExpression(c: Ctx, value: unknown, path: string, seen: Set<string>): TranslatedExpression | undefined {
  const o = shape(c.f, value, path, ['cel', 'expression'])
  const where = at(path, 'cel')
  const cel = text(c.f, o?.cel, where, MAX_EXPRESSION_LENGTH)
  if (cel !== undefined && cel.trim() === '') c.f.report(where, 'empty-expression', 'an expression translated is one the report prints, and this one is empty')
  else once(c, cel, where, seen, 'the expression')
  const expression = readExpression(c.f, o?.expression, at(path, 'expression'))
  return cel === undefined || cel.trim() === '' || expression === undefined ? undefined : { cel, expression }
}

function readTranslation(c: Ctx, value: unknown, path: string, languages: Set<string>): Translation | undefined {
  const o = shape(c.f, value, path, ['locale', 'words', 'expressions'])
  const where = at(path, 'locale')
  const locale = matches(c.f, o?.locale, where, LOCALE, 'invalid-locale', 'a BCP 47 language tag such as en, de-CH or zh-Hans-CN')
  if (locale !== undefined && languages.has(locale)) {
    c.f.report(where, 'duplicate-language', `the report is written in ${quote(locale)} already: its own words, or another translation's`)
  }
  if (locale !== undefined) languages.add(locale)
  const words = new Set<string>()
  const wordList = readList(c.f, o?.words, at(path, 'words'), 0, MAX_WORDS)?.map((item, index) => readWord(c, item, at(at(path, 'words'), index), words))
  const sources = new Set<string>()
  const expressionList = readList(c.f, o?.expressions, at(path, 'expressions'), 0, MAX_WORDS)?.map((item, index) =>
    readTranslatedExpression(c, item, at(at(path, 'expressions'), index), sources),
  )
  const read = { words: wordList && all(wordList), expressions: expressionList && all(expressionList) }
  return locale === undefined || read.words === undefined || read.expressions === undefined
    ? undefined
    : { locale, words: read.words, expressions: read.expressions }
}

/**
 * The translations at `path`, one at least where they are present: each
 * language once, never the report's own (`own`, when it could be read),
 * and with it at most `MAX_LANGUAGES`. Absent, the report has none.
 */
export function readTranslations(c: Ctx, value: unknown, path: string, own: string | undefined): readonly Translation[] | undefined {
  const items = readList(c.f, value, path, 1, MAX_LANGUAGES - 1)
  const languages = new Set<string>(own === undefined ? [] : [own])
  const translations = items?.map((item, index) => readTranslation(c, item, at(path, index), languages))
  return translations && all(translations)
}

/**
 * The translation's entry an error the report written in a language finds
 * is reported at: the one whose string the error is at -- a column header
 * too long -- or else the first whose string it stands over -- a QR-bill's
 * message, judged whole, or the whole report. A translated string is a
 * leaf, so no error stands under one.
 */
function entryOf(path: string, replaced: readonly Substitution[]): Substitution | undefined {
  return replaced.find((substitution) => substitution.path === path) ?? replaced.find((substitution) => substitution.path.startsWith(`${path}/`))
}

/** A reader of a report's top level, as validate.ts's: what each language is read again by. */
export type ReportReader = (c: Ctx, o: Record<string, unknown>) => ReportDefinition | undefined

/**
 * `report` -- read without an error by `read` -- written in each of
 * `translations`, its own, and read again by `read`, each error reported
 * into `c` at the translation that broke it, naming the place and the
 * language. A written report differs from the report only at the strings
 * a translation replaced, its locale and its slip's language, so every
 * error stands at or over a replaced string; one that stands near none is
 * reported at the translation as a whole.
 */
export function checkLanguages(c: Ctx, report: ReportDefinition, translations: readonly Translation[], read: ReportReader): void {
  for (const [index, translation] of translations.entries()) {
    const replaced = substitutions(report, index)
    const again = newContext()
    read(again, writtenIn(report, translation.locale) as unknown as Record<string, unknown>)
    for (const error of again.f.errors()) {
      const place = error.path === '' ? 'the report as a whole' : error.path
      const said = `written in ${translation.locale}, where it stands at ${place}, ${error.message}`
      c.f.report(entryOf(error.path, replaced)?.entry ?? at('/translations', index), error.code, said)
    }
  }
}
