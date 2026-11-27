import { compileReport, languageDiagnostics, MAX_BATCH_COMMANDS } from '@formancy/report-core'
import type { CompiledExpression } from '@formancy/report-core'
import { MAX_WORDS, reportWords, wordExpressionSites } from '@formancy/report-spec'
import type { ReportDefinition, Translation, WordExpressionSite, WordPlace } from '@formancy/report-spec'
import { MAX_MODEL_REQUEST_BYTES, requestBytes } from '../limits.js'
import { translationBriefing, translationProblems, translationTurn } from './briefing.js'
import { placesOf } from './places.js'

/**
 * What a model is asked for a language: the words it lacks, and nothing
 * else
 * ([0085](../../../../docs/decisions/0085-a-model-is-asked-only-for-the-words-a-language-lacks-and-its-answer-is-one-batch-held-to-the-format-and-the-compiler-before-a-person-sees-it.md)).
 *
 * `translationRequest` takes a report and a locale and nothing else, so no
 * data, no parameter's value, no asset and no font can reach it by type
 * (formancy.ai 0161's `translationPrompt(document, locale)`). What it asks
 * for is exactly what report-core's `languageDiagnostics` says the
 * language lacks, `word-missing`, the count a builder shows, read back to
 * its source through report-spec's one walk of a report's words, and never
 * a second list of them.
 *
 * **The payment part is never sent.** Its message is a word (0063), and it
 * is printed on the slip and encoded in the code a bank reads; no proposal
 * changes what the payment part prints (0039, 0048). So a word or an
 * expression that stands in it anywhere -- the same word elsewhere among
 * them, since a word is translated once, wherever it stands -- is listed
 * for a person to write and never asked, and the language's words so far
 * are sent without any of the payment part's.
 */

/** Which of a language's two lists an entry belongs to. */
export type EntryKind = 'word' | 'expression'

/** A word or an expression a language lacks, by its source, and every place it stands. */
export interface Lacking {
  readonly kind: EntryKind
  /** A word's exact text in the report's own language, or an expression's exact source: what a translation keys it by (0063). */
  readonly source: string
  /** The JSON Pointer to each place it stands, in document order; the first is where `word-missing` stands. */
  readonly paths: readonly [string, ...string[]]
}

/** One entry a request asks for, under the key the answer writes back. */
export interface AskedEntry {
  /** The request's own key, `w1` or `e1`: what the answer names it by, so that no source is ever read back from what a model wrote. */
  readonly key: string
  readonly kind: EntryKind
  readonly source: string
  /** Where it stands, at most `MAX_PLACES` of them, each told once. */
  readonly places: readonly string[]
  /** How many places beyond those it stands in. */
  readonly otherPlaces: number
}

/** A request for the words a language lacks, ready to ask. */
export interface TranslationRequest {
  /** The report's own language, every source's. */
  readonly from: string
  /** The language asked for. */
  readonly locale: string
  /** What is asked, in document order: words first, then expressions, each keyed in its own list. */
  readonly asked: readonly AskedEntry[]
  /** What the language lacks past this turn's bound, asked for in a turn of its own once these land. */
  readonly later: number
  /** What the language lacks that stands in the payment part, for a person to write and never asked. */
  readonly forPerson: readonly Lacking[]
  /** The briefing. */
  readonly system: string
  /** The request itself, as JSON. */
  readonly user: string
  /** The UTF-8 length of the longest user part any turn of a run sends: the request, and the longest complaint after it. */
  readonly bytes: number
}

/** A request, or the bound it is past, refused before anything is asked. */
export type TranslationRequesting =
  | { readonly ok: true; readonly request: TranslationRequest }
  | { readonly ok: false; readonly code: 'request-too-large'; readonly bytes: number; readonly max: number }

/** Places told of a word, at most: enough to tell a header from a sentence, without a word in every row of a table told every time. */
export const MAX_PLACES = 3

const inPaymentPart = (path: string): boolean => path.startsWith('/paymentPart/')

/** The translation into `locale`, or a RangeError for a locale the report does not declare one in: a caller asks for a language the report holds. */
function translationOf(report: ReportDefinition, locale: string): Translation {
  const translation = report.translations?.find((held) => held.locale === locale)
  if (translation === undefined) throw new RangeError(`the report declares no translation into ${JSON.stringify(locale)} to ask a model for`)
  return translation
}

/** Each source in `places`, with every place it stands, in the order of its first. */
function bySource(places: readonly { readonly path: string; readonly source: string }[], kind: EntryKind): Map<string, Lacking> {
  const found = new Map<string, Lacking>()
  for (const { path, source } of places) {
    const known = found.get(source)
    found.set(source, { kind, source, paths: known === undefined ? [path] : [...known.paths, path] })
  }
  return found
}

/**
 * Every word and expression `locale` lacks in `report`: those `word-missing`
 * names, at the place it stands at, each by its source and with every place
 * it stands; and of them, those standing anywhere in the payment part,
 * which are a person's.
 */
export function lacking(report: ReportDefinition, locale: string): { readonly ask: readonly Lacking[]; readonly forPerson: readonly Lacking[] } {
  translationOf(report, locale)
  const missingAt = new Set(languageDiagnostics(report, locale).flatMap(({ code, path }) => (code === 'word-missing' ? [path] : [])))
  const words = bySource(
    reportWords(report).map(({ path, text }) => ({ path, source: text })),
    'word',
  )
  const expressions = bySource(
    wordExpressionSites(report).map(({ path, cel }) => ({ path, source: cel })),
    'expression',
  )
  const all = [...words.values(), ...expressions.values()].filter((entry) => missingAt.has(entry.paths[0]))
  return { ask: all.filter((entry) => !entry.paths.some(inPaymentPart)), forPerson: all.filter((entry) => entry.paths.some(inPaymentPart)) }
}

/** The language's words and expressions so far that stand nowhere in the payment part, as its register: each source beside its text. */
function translatedSoFar(report: ReportDefinition, translation: Translation): readonly { readonly source: string; readonly text: string }[] {
  const touching = new Set([
    ...reportWords(report).flatMap(({ path, text }) => (inPaymentPart(path) ? [text] : [])),
    ...wordExpressionSites(report).flatMap(({ path, cel }) => (inPaymentPart(path) ? [cel] : [])),
  ])
  return [
    ...translation.words.flatMap(({ word, text }) => (touching.has(word) ? [] : [{ source: word, text }])),
    ...translation.expressions.flatMap(({ cel, expression }) => (touching.has(cel) ? [] : [{ source: cel, text: expression.cel }])),
  ]
}

/**
 * What one turn may ask: at most `MAX_BATCH_COMMANDS` entries, so that one
 * answer is one batch, and no more of each list than the language still has
 * room for under `MAX_WORDS`, which a translation past would be refused
 * whole by the format for. Words first, then expressions, each in document
 * order.
 */
function thisTurn(ask: readonly Lacking[], translation: Translation): readonly Lacking[] {
  const room = { word: MAX_WORDS - translation.words.length, expression: MAX_WORDS - translation.expressions.length }
  const taken: Lacking[] = []
  for (const entry of ask) {
    if (taken.length === MAX_BATCH_COMMANDS) break
    if (room[entry.kind] <= 0) continue
    room[entry.kind] -= 1
    taken.push(entry)
  }
  return taken
}

/**
 * The request for the words `locale` lacks in `report`, a report the
 * validator accepts, or the refusal of one whose longest turn is past
 * `MAX_MODEL_REQUEST_BYTES`, before anything is asked. A RangeError for a
 * locale the report declares no translation into.
 *
 * Each entry carries its source, under a key of the request's own, where
 * it stands, and, for an expression, the type it gives and the members it
 * reads as report-core's compiler says, which its translation must give
 * and read too (0063). Beside them, the language's words so far, for the
 * register to match. Nothing else of the report.
 */
export function translationRequest(report: ReportDefinition, locale: string): TranslationRequesting {
  const translation = translationOf(report, locale)
  const { ask, forPerson } = lacking(report, locale)
  const taken = thisTurn(ask, translation)
  const phrase = placesOf(report)
  // Every path of an entry is one of the walk's, so each has its owner here.
  const owners = new Map([...reportWords(report), ...wordExpressionSites(report)].map((place) => [place.path, place]))
  const compiled = taken.some(({ kind }) => kind === 'expression') ? compileReport(report).expressions : new Map<string, CompiledExpression>()
  const counts = { word: 0, expression: 0 }

  const entries = taken.map((entry) => {
    counts[entry.kind] += 1
    const places = [...new Set(entry.paths.map((path) => phrase(owners.get(path) as WordPlace | WordExpressionSite)))]
    const asked: AskedEntry = {
      key: `${entry.kind === 'word' ? 'w' : 'e'}${String(counts[entry.kind])}`,
      kind: entry.kind,
      source: entry.source,
      places: places.slice(0, MAX_PLACES),
      otherPlaces: Math.max(0, places.length - MAX_PLACES),
    }
    const told = { key: asked.key, source: asked.source, places: asked.places, ...(asked.otherPlaces === 0 ? {} : { otherPlaces: asked.otherPlaces }) }
    if (entry.kind === 'word') return { asked, told }
    // An expression word-missing names is one that compiled where it first stands: that it prints words is the compiler's verdict.
    const program = compiled.get(entry.paths[0]) as CompiledExpression
    return { asked, told: { ...told, gives: program.program.resultType, reads: program.reads.map(({ name, member }) => `${name}.${member}`).sort() } }
  })
  const asked = entries.map((each) => each.asked)
  const payload = {
    from: report.locale,
    into: locale,
    words: entries.flatMap(({ asked: { kind }, told }) => (kind === 'word' ? [told] : [])),
    expressions: entries.flatMap(({ asked: { kind }, told }) => (kind === 'expression' ? [told] : [])),
    translated: translatedSoFar(report, translation),
  }
  const user = JSON.stringify(payload, null, 2)
  const bytes = Math.max(...[undefined, ...translationProblems(locale)].map((problem) => requestBytes(translationTurn(user, problem).user)))
  if (bytes > MAX_MODEL_REQUEST_BYTES) return { ok: false, code: 'request-too-large', bytes, max: MAX_MODEL_REQUEST_BYTES }
  return {
    ok: true,
    request: { from: report.locale, locale, asked, later: ask.length - taken.length, forPerson, system: translationBriefing(), user, bytes },
  }
}
