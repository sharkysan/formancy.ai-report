import type { MissingWord } from '@formancy/report-core'
import type { ReportDefinition } from '@formancy/report-spec'
import { askChecked } from '../turn/ask.js'
import type { AskModel, Asked, AskOptions, Checkable, Verdict } from '../turn/ask.js'
import { TRANSLATION_COMPLAINTS, translationTurn } from './briefing.js'
import type { TranslationProblem } from './briefing.js'
import { translationRequest } from './request.js'
import type { AskedEntry, EntryKind, TranslationRequest } from './request.js'

/**
 * Asking a model for the words a language lacks, and reading what it
 * answers (0085), on the turn every request runs on: `askChecked` asks,
 * checks, and asks again with the latest problem alone; a decline ends the
 * run on its turn; a stop ends it at once (formancy.ai 0056, 0157, 0158).
 *
 * **An answer is read by the request's keys**, and each key back to the
 * source the request held, never to anything the model wrote: a model's
 * echo of a source differs by a space or a quote, and formancy.ai 0161
 * found judging by the echo wrong both ways. So the answer is
 * `{ "into": …, "words": { key: text }, "expressions": { key: source } }`,
 * and holds no source at all.
 *
 * **What is odd about an answer is noted, not refused**, because a partial
 * answer is still work done: a key the request did not ask is dropped and
 * listed, and a key left out or given only white space is still missing.
 * Asked again, with that problem alone, are only an answer that is no
 * object, one for another language, one whose words or expressions are not
 * an object of strings, and a decline with no reason.
 */

/** A text the model wrote for a key the request asked, with the source the request held for it and where the request said it stands. */
export interface WrittenEntry {
  readonly key: string
  readonly kind: EntryKind
  readonly source: string
  readonly text: string
  readonly places: readonly string[]
}

/** A key an answer wrote that was not asked in that member: never written, and listed. */
export interface NotAsked {
  readonly member: 'words' | 'expressions'
  readonly key: string
}

/** What a model answered, kept, beside what it was asked. */
export interface TranslationAnswer {
  readonly locale: string
  /** What the request asked, in its order. */
  readonly asked: readonly AskedEntry[]
  /** What the request listed for a person and never asked: the payment part's. */
  readonly forPerson: readonly MissingWord[]
  /** What the answer wrote for asked keys, in the order they were asked; never a blank text. */
  readonly written: readonly WrittenEntry[]
  /** Keys the answer wrote that the request did not ask. */
  readonly dropped: readonly NotAsked[]
  /** Keys asked that came back with no text, or with nothing but white space: left for a person, or another turn. */
  readonly leftEmpty: readonly string[]
  /** How many entries the language lacked past the request's bounds, never asked: what another turn asks once these land. */
  readonly later: number
  /** The lists the language had no room left in for what it lacks: a run asks nothing of them until a person makes room, and says so here rather than as a language that lacks nothing. */
  readonly noRoom: readonly EntryKind[]
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The member `name` of an answer as an object of strings: absent is empty, anything else that is not one is a problem. */
function stringsOf(answer: Readonly<Record<string, unknown>>, name: 'words' | 'expressions'): ReadonlyMap<string, string> | undefined {
  if (!Object.hasOwn(answer, name)) return new Map()
  const member = answer[name]
  if (!isObject(member)) return undefined
  const entries = Object.entries(member)
  return entries.every((entry): entry is [string, string] => typeof entry[1] === 'string') ? new Map(entries) : undefined
}

const problem = (kind: TranslationProblem['kind'], detail: string) => ({ ok: false, problem: { kind, detail } }) as const

/**
 * Whether `answer` -- what `readAnswer` found in a model's text -- is an
 * answer to `request`, and what it holds if it is: each asked key's text,
 * by the request's own source for it.
 */
export function checkTranslation(answer: Checkable, request: TranslationRequest): Verdict<TranslationAnswer, TranslationProblem> {
  if (answer === undefined) return problem('not-json', TRANSLATION_COMPLAINTS.notJson)
  if (answer.kind === 'unexplained-decline') return problem('unexplained-decline', TRANSLATION_COMPLAINTS.unexplainedDecline)
  const value = answer.value as Readonly<Record<string, unknown>>
  if (typeof value.into !== 'string') return problem('no-locale', TRANSLATION_COMPLAINTS.noLocale(request.locale))
  if (value.into !== request.locale) return problem('wrong-locale', TRANSLATION_COMPLAINTS.wrongLocale(request.locale))
  const words = stringsOf(value, 'words')
  if (words === undefined) return problem('not-strings', TRANSLATION_COMPLAINTS.notStrings('words'))
  const expressions = stringsOf(value, 'expressions')
  if (expressions === undefined) return problem('not-strings', TRANSLATION_COMPLAINTS.notStrings('expressions'))

  const members = { word: words, expression: expressions }
  const written = request.asked.flatMap(({ key, kind, source, places }): WrittenEntry[] => {
    const text = members[kind].get(key)
    return text === undefined || text.trim() === '' ? [] : [{ key, kind, source, text, places }]
  })
  const asked = new Set(request.asked.map(({ kind, key }) => `${kind} ${key}`))
  const answered = new Set(written.map(({ key }) => key))
  const dropped = (['word', 'expression'] as const).flatMap((kind) =>
    [...members[kind].entries()].flatMap(([key, text]): NotAsked[] =>
      asked.has(`${kind} ${key}`) || text.trim() === '' ? [] : [{ member: kind === 'word' ? 'words' : 'expressions', key }],
    ),
  )
  return {
    ok: true,
    value: {
      locale: request.locale,
      asked: request.asked,
      forPerson: request.forPerson,
      written,
      dropped,
      leftEmpty: request.asked.flatMap(({ key }) => (answered.has(key) ? [] : [key])),
      later: request.later,
      noRoom: request.noRoom,
    },
  }
}

/** How a translation's run ended: an answer kept, the ways a run of turns ends without one, or a request past its bound, never asked. */
export type TranslationResult =
  | { readonly ok: true; readonly answer: TranslationAnswer; readonly attempts: number }
  | Extract<Asked<TranslationAnswer, TranslationProblem>, { readonly ok: false }>
  | { readonly ok: false; readonly ended: 'too-large'; readonly attempts: 0; readonly bytes: number; readonly max: number }

/**
 * Ask `ask` for every word `locale` lacks in `report`, up to a turn's
 * bound, and keep what it answers. With nothing to ask, nothing is asked:
 * a turn is paid for -- through a relay, two pastes by hand -- and would
 * translate nothing; the answer's `later` and `noRoom` tell a language
 * that lacks nothing from one with no room left for what it lacks. A request past `MAX_MODEL_REQUEST_BYTES` ends the run
 * before any turn. Resolves however the run ends, as `askChecked` does.
 */
export async function translateMissing(
  ask: AskModel<'translation'>,
  report: ReportDefinition,
  locale: string,
  options: AskOptions = {},
): Promise<TranslationResult> {
  const made = translationRequest(report, locale)
  if (!made.ok) return { ok: false, ended: 'too-large', attempts: 0, bytes: made.bytes, max: made.max }
  const { request } = made
  if (request.asked.length === 0) {
    const answer = { locale, asked: [], forPerson: request.forPerson, written: [], dropped: [], leftEmpty: [], later: request.later, noRoom: request.noRoom }
    return { ok: true, attempts: 0, answer }
  }
  const asked = await askChecked(
    ask,
    (latest: TranslationProblem | undefined) => ({ kind: 'translation' as const, system: request.system, ...translationTurn(request.user, latest) }),
    (answer) => checkTranslation(answer, request),
    options,
  )
  return asked.ok ? { ok: true, answer: asked.value, attempts: asked.attempts } : asked
}
