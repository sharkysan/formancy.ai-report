import { languageDiagnostics, tryEdit } from '@formancy/report-core'
import type { Diagnostic, StepDescriptor } from '@formancy/report-core'
import { reportHash, reportWords, wordExpressionSites } from '@formancy/report-spec'
import type { ReportDefinition, Translation } from '@formancy/report-spec'
import type { TranslationAnswer, WrittenEntry } from './reader.js'
import { lacking, withinRoom } from './request.js'
import type { EntryKind, Lacking } from './request.js'
import { textRefusal } from './texts.js'

/**
 * A model's translation, held to the format and the compiler before a
 * person sees any of it (0085).
 *
 * `proposeTranslation` runs on the report **as it stands when it runs**,
 * so the same answer can be read again against a report a person has
 * edited since, with no new turn. What it gives is one batch of
 * report-core's `translateWord` and `translateExpression`, every entry of
 * which the format and the compiler have accepted: a row a person reviews
 * is one the report would print in that language, compiled, of its
 * source's type, reading what its source reads, in characters a report
 * prints. One bad entry costs its own row, never the answer.
 *
 * **Only what is asked and still lacking.** An entry is kept only where
 * its source is still one the language lacks in the report as it stands:
 * a word a person translated while the model answered is never
 * overwritten (formancy.ai 0161), and a word whose text changed meanwhile
 * is, under 0063, another word, and dropped. What is kept is sized to the
 * room the language has as it stands, by the rule the request sized its
 * turn by (`withinRoom`), so that a list past `MAX_WORDS`, which the format
 * refuses at no entry of it, is never what a batch makes.
 *
 * **Held before it is shown**, in the order a report is held: each text
 * by `texts.ts` -- its characters, an expression's escapes, a word's spaces
 * at either end; then the report the batch leaves by the validator,
 * through `tryEdit`, which reports a translation's error at the entry that
 * broke it; then by report-core's `languageDiagnostics`, a diagnostic the
 * language did not give before -- `translation-differs`, a compile error
 * -- refusing the entry it stands at. Each refused entry is taken out with
 * the sentence that refused it, and the rest held again, until what is
 * left stands or nothing is.
 */

/** A row a person reviews: one entry, as the batch writes it. */
export interface TranslationRow {
  readonly key: string
  readonly kind: EntryKind
  readonly source: string
  /** The model's text for a word, or its source for an expression. */
  readonly text: string
  /** Where it stands, as the request told it. */
  readonly places: readonly string[]
  /** The command that writes it: one step of the batch. */
  readonly step: StepDescriptor
}

/** Why an entry the model wrote is no row: a character a report does not print, its spaces at either end, the validator, or a diagnostic. */
export type RefusalReason = 'character' | 'spaces' | 'invalid' | 'diagnostic'

/** An entry the format, the compiler or the characters a report prints refused, with the sentence that refused it. */
export interface RefusedEntry {
  readonly key: string
  readonly kind: EntryKind
  readonly source: string
  readonly text: string
  readonly reason: RefusalReason
  /** The validator's, the diagnostic's or `texts.ts`'s words, for a person. */
  readonly message: string
}

/**
 * Why an entry the model wrote was never held at all: not asked; the
 * language has it now; its source is no longer the report's; an expression
 * that no longer prints words; a person's, in the payment part; no room
 * left in its list; or a language removed.
 */
export type DropReason = 'not-asked' | 'written-meanwhile' | 'no-longer-in-report' | 'prints-no-words' | 'for-person' | 'no-room' | 'language-removed'

export interface DroppedEntry {
  readonly key: string
  readonly why: DropReason
}

/** A model's translation, held still against one version of the report. */
export interface TranslationProposal {
  readonly locale: string
  /** `reportHash` of the report the proposal was made on: a batch of its rows applied with it is refused `stale-document` once the report moved. */
  readonly expectedHash: string
  /** Every entry that stands, in the order the request asked them: a valid batch, and so is any subset of it. */
  readonly rows: readonly TranslationRow[]
  readonly refused: readonly RefusedEntry[]
  readonly dropped: readonly DroppedEntry[]
  /** What the language would still lack with every row applied, as report-core says it. */
  readonly stillMissing: readonly Diagnostic[]
  /** What the language lacks in the payment part: a person's to write, and never asked. */
  readonly forPerson: readonly Lacking[]
  /** The report as every row would leave it: what a preview of the proposal renders. */
  readonly candidate: ReportDefinition
}

/** An entry being held: what the model wrote, every place its source stands, and the command that writes it. */
export interface Held {
  readonly entry: WrittenEntry
  readonly paths: readonly string[]
  readonly step: StepDescriptor
}

/** An entry as a refusal names it: what was written for what, without where it stands. */
const withoutPlaces = ({ key, kind, source, text }: WrittenEntry): Omit<WrittenEntry, 'places'> => ({ key, kind, source, text })

/** The step that writes `entry` into `locale`. */
function stepOf(locale: string, { kind, source, text }: WrittenEntry): StepDescriptor {
  return kind === 'word'
    ? { command: 'translateWord', args: [locale, source, text] }
    : { command: 'translateExpression', args: [locale, source, { cel: text }] }
}

/** An error or a diagnostic the batch gives, where it stands, and in whose words. */
interface Finding {
  readonly path: string
  readonly reason: RefusalReason
  readonly message: string
}

/** A diagnostic's identity: to tell one the batch gave from one the language gave already. */
const identity = ({ code, path, message }: Diagnostic): string => `${code} ${path} ${message}`

/** The entry of a translation a pointer stands at or under: `/translations/0/words/3`. */
const ENTRY = /^\/translations\/\d+\/(?:words|expressions)\/\d+(?=\/|$)/

/**
 * Where each held entry can be blamed: the entry each step adds to the
 * translation at `index` -- which held `words` and `expressions` entries
 * before, each step adding one after them, in order -- and each place its
 * source stands, where a diagnostic of the report written in the language
 * stands for a word.
 */
function blameable(held: readonly Held[], index: number, words: number, expressions: number): ReadonlyMap<string, Held> {
  const counts = { word: words, expression: expressions }
  const at = new Map<string, Held>()
  for (const each of held) {
    const { kind } = each.entry
    at.set(`/translations/${String(index)}/${kind === 'word' ? 'words' : 'expressions'}/${String(counts[kind])}`, each)
    counts[kind] += 1
    for (const path of each.paths) at.set(path, each)
  }
  return at
}

/** What the report `held` leaves comes to: the candidate, or what the validator says of it, or else what the diagnostics say of it in `locale` that they did not `before`. */
function judged(
  report: ReportDefinition,
  locale: string,
  held: readonly Held[],
  before: ReadonlySet<string>,
): { readonly candidate: ReportDefinition; readonly findings: readonly Finding[]; readonly diagnostics: readonly Diagnostic[] } {
  const outcome = tryEdit(report, (draft) => {
    for (const { step } of held) draft.apply(step)
  })
  if (!outcome.ok) {
    // A command's refusal carries no errors and stands at no entry, so it refuses every step left.
    const errors = outcome.errors ?? [{ path: outcome.path ?? '', message: outcome.message }]
    return { candidate: report, findings: errors.map(({ path, message }) => ({ path, reason: 'invalid', message })), diagnostics: [] }
  }
  const diagnostics = languageDiagnostics(outcome.report, locale)
  const findings = diagnostics
    .filter((found) => found.severity === 'error' && found.code !== 'word-missing' && !before.has(identity(found)))
    .map(({ path, message }): Finding => ({ path, reason: 'diagnostic', message }))
  return { candidate: outcome.report, findings, diagnostics }
}

/**
 * `held` taken through the validator and the diagnostics until what is left
 * stands, with the candidate's diagnostics in the language: each round
 * refuses what an error or a new diagnostic stands at, and holds the rest
 * again. A finding standing at no step left refuses every one of them,
 * with its sentence: none of them can be shown to leave a report the
 * format and the compiler accept. That is the guard, not the rule: the
 * validator reports a translation's error at its entry, and an error near
 * no replaced string at the translation, or over the whole report at its
 * first, which may be a person's; a step its command refuses stands at
 * none. Exported for its suite, which forces it; the package exports
 * `proposeTranslation` alone.
 */
export function hold(
  report: ReportDefinition,
  { locale, index, translation }: { readonly locale: string; readonly index: number; readonly translation: Translation },
  held: readonly Held[],
): {
  readonly standing: readonly Held[]
  readonly refused: readonly RefusedEntry[]
  readonly candidate: ReportDefinition
  readonly diagnostics: readonly Diagnostic[]
} {
  const own = languageDiagnostics(report, locale)
  const before = new Set(own.map(identity))
  const refused: RefusedEntry[] = []
  let left = held
  while (left.length > 0) {
    const { candidate, findings, diagnostics } = judged(report, locale, left, before)
    if (findings.length === 0) return { standing: left, refused, candidate, diagnostics }
    const at = blameable(left, index, translation.words.length, translation.expressions.length)
    const blamed = new Map<Held, Finding>()
    for (const finding of findings) {
      const each = at.get(ENTRY.exec(finding.path)?.[0] ?? finding.path)
      if (each !== undefined && !blamed.has(each)) blamed.set(each, finding)
    }
    const first = findings[0] as Finding
    const out = blamed.size === 0 ? new Map(left.map((each) => [each, first])) : blamed
    for (const [each, { reason, message }] of out) refused.push({ ...withoutPlaces(each.entry), reason, message })
    left = left.filter((each) => !out.has(each))
  }
  return { standing: [], refused, candidate: report, diagnostics: own }
}

/**
 * The proposal `answer` makes for `report` as it stands: what it wrote for
 * entries the language still lacks, held to the format and the compiler,
 * as rows of one batch against the report's hash; and what was refused,
 * dropped or left, and why.
 */
export function proposeTranslation(report: ReportDefinition, answer: TranslationAnswer): TranslationProposal {
  const expectedHash = reportHash(report)
  const notAsked = answer.dropped.map(({ key }): DroppedEntry => ({ key, why: 'not-asked' }))
  const index = (report.translations ?? []).findIndex((held) => held.locale === answer.locale)
  const translation = report.translations?.[index]
  if (translation === undefined) {
    const gone = answer.written.map(({ key }): DroppedEntry => ({ key, why: 'language-removed' }))
    return { locale: answer.locale, expectedHash, rows: [], refused: [], dropped: [...notAsked, ...gone], stillMissing: [], forPerson: [], candidate: report }
  }

  const now = lacking(report, answer.locale)
  const askable = new Map(now.ask.map((entry) => [`${entry.kind} ${entry.source}`, entry]))
  const personal = new Set(now.forPerson.map(({ kind, source }) => `${kind} ${source}`))
  const translated = new Set([...translation.words.map(({ word }) => `word ${word}`), ...translation.expressions.map(({ cel }) => `expression ${cel}`)])
  const sited = new Set([...reportWords(report).map(({ text }) => `word ${text}`), ...wordExpressionSites(report).map(({ cel }) => `expression ${cel}`)])
  const dropped: DroppedEntry[] = [...notAsked]
  const texts: RefusedEntry[] = []
  const kept: Held[] = []
  for (const entry of answer.written) {
    const id = `${entry.kind} ${entry.source}`
    const lacks = askable.get(id)
    const refusal = textRefusal(entry)
    if (personal.has(id)) dropped.push({ key: entry.key, why: 'for-person' })
    else if (lacks === undefined) {
      const why = translated.has(id) ? 'written-meanwhile' : entry.kind === 'expression' && sited.has(id) ? 'prints-no-words' : 'no-longer-in-report'
      dropped.push({ key: entry.key, why })
    } else if (refusal === undefined) kept.push({ entry, paths: lacks.paths, step: stepOf(answer.locale, entry) })
    else texts.push({ ...withoutPlaces(entry), ...refusal })
  }
  const room = withinRoom(
    kept.map((held) => ({ kind: held.entry.kind, held })),
    translation,
  )
  for (const { held } of room.left) dropped.push({ key: held.entry.key, why: 'no-room' })

  const { standing, refused, candidate, diagnostics } = hold(
    report,
    { locale: answer.locale, index, translation },
    room.taken.map(({ held }) => held),
  )
  const rows = standing.map(({ entry, step }): TranslationRow => ({ ...entry, step }))
  return {
    locale: answer.locale,
    expectedHash,
    rows,
    refused: [...texts, ...refused],
    dropped,
    stillMissing: diagnostics.filter(({ code }) => code === 'word-missing'),
    forPerson: now.forPerson,
    candidate,
  }
}
