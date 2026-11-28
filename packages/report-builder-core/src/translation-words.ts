/**
 * What the editor says of a model's translation (0086): the sentence a run
 * that ended without an answer says, the one an answer says, the notes
 * under the table, and each row as the state shows it, where it stands in
 * the editor's own words. Words alone: what a run holds, and what may be
 * pressed, are translation-review.ts's.
 */
import type { DropReason, TranslationAnswer, TranslationProposal, TranslationResult } from '@formancy/report-ai'
import { MAX_WORDS, reportWords, wordExpressionSites } from '@formancy/report-spec'
import { columnKey } from './labels.js'
import type { TranslationReviewRow } from './model-translation.js'
import type { Derived } from './state.js'
import type { EditorLocale, EditorText, MessageId } from './text.js'

/** The editor's words, numbers and lists, in one language. */
export interface TranslationWords {
  readonly t: EditorText
  readonly locale: EditorLocale
  readonly number: Intl.NumberFormat
  readonly list: Intl.ListFormat
}

export function translationWords(t: EditorText, locale: EditorLocale): TranslationWords {
  return { t, locale, number: new Intl.NumberFormat(locale), list: new Intl.ListFormat(locale, { type: 'conjunction' }) }
}

/**
 * What a run that ended without an answer says, `language` the one it was
 * for. A switch over every ending, so that one `askChecked` gains, and is
 * given no sentence here, does not compile (formancy.ai 0161).
 */
export function endedSentence(result: Extract<TranslationResult, { readonly ok: false }>, language: string, { t, number }: TranslationWords): string {
  switch (result.ended) {
    case 'gave-up':
      return t('translation.status.gaveUp', { count: result.attempts, language })
    case 'stopped':
      return t('translation.status.stopped')
    case 'unreachable':
      return result.reason === undefined ? t('translation.status.unreachableNoReason') : t('translation.status.unreachable', { reason: result.reason })
    case 'busy':
      return t('translation.status.busy')
    case 'declined':
      // askChecked ends a decline with the reason the model gave, never without.
      return t('translation.status.declined', { reason: result.reason as string })
    case 'too-large':
      return t('translation.status.tooLarge', { bytes: number.format(result.bytes), max: number.format(result.max) })
  }
}

/**
 * What an answer says: how many rows are ready and what would still be
 * missing with all of them applied; or, with no row, whether nothing was
 * asked, the model wrote nothing, or what it wrote cannot be applied --
 * three things a person does three things about.
 */
export function answerSentence(proposal: TranslationProposal, answer: TranslationAnswer, language: string, { t }: TranslationWords): string {
  if (proposal.rows.length > 0) {
    const ready = t('translation.status.ready', { count: proposal.rows.length })
    const left = proposal.stillMissing.length
    return left === 0 ? ready : `${ready} ${t('translation.status.stillMissing', { count: left })}`
  }
  if (answer.asked.length === 0) return t('translation.status.nothingAsked', { language })
  return answer.written.length === 0 ? t('translation.status.none') : t('translation.status.noneHeld')
}

/**
 * Why an entry was dropped, in the editor's words: a language removed
 * meanwhile is a word the report no longer prints in it. A word a person
 * put into the payment part meanwhile is said with the payment part's
 * words, once (`forPerson`), and never as a word dropped.
 */
const DROPPED: { readonly [R in Exclude<DropReason, 'for-person'>]: MessageId } = {
  'not-asked': 'translation.dropped.notAsked',
  'written-meanwhile': 'translation.dropped.writtenMeanwhile',
  'no-longer-in-report': 'translation.dropped.gone',
  'prints-no-words': 'translation.dropped.printsNoWords',
  'no-room': 'translation.dropped.noRoom',
  'language-removed': 'translation.dropped.gone',
}

/**
 * The notes under the table, a sentence each: every entry refused, with
 * the sentence that refused it, as report-ai gives it, in English in every
 * editor language; the entries dropped, a sentence a reason, each by its
 * source, but a key nobody asked, which is quoted as the key it is: a key
 * written under the other member names no source of its own; what stands
 * in the payment part, for a person, a word put there meanwhile among it; how many entries the
 * model left untranslated; how many were left for another run, or, where
 * a list has no room left, not asked; and each list that has no room left
 * for more, so that a language with no room is never said as one that
 * lacks nothing (0085's `later` and `noRoom`).
 */
export function notesOf(proposal: TranslationProposal, answer: TranslationAnswer, language: string, { t, number, list }: TranslationWords): string[] {
  const quoted = (text: string): string => t('translation.quoted', { text })
  const sources = new Map(answer.written.map(({ key, source }) => [key, source]))
  const notes = proposal.refused.map(({ text, source, message }) => t('translation.refused', { text, source, reason: message }))
  for (const why of Object.keys(DROPPED) as (keyof typeof DROPPED)[]) {
    // A drop for any other reason is of an entry written for a key asked, whose source the answer holds.
    const dropped = proposal.dropped.filter((entry) => entry.why === why).map(({ key }) => quoted(why === 'not-asked' ? key : (sources.get(key) as string)))
    if (dropped.length > 0) notes.push(t(DROPPED[why], { list: list.format(dropped), language }))
  }
  if (proposal.forPerson.length > 0) notes.push(t('translation.forPerson', { list: list.format(proposal.forPerson.map(({ source }) => quoted(source))) }))
  if (answer.leftEmpty.length > 0) notes.push(t('translation.leftEmpty', { count: answer.leftEmpty.length }))
  // A list with no room left is asked for by no other run until a person makes room: then what was left is said as unasked, and why.
  if (answer.later > 0) notes.push(t(answer.noRoom.length === 0 ? 'translation.later' : 'translation.unasked', { count: answer.later }))
  for (const kind of answer.noRoom) notes.push(t(`translation.noRoom.${kind}`, { language, max: number.format(MAX_WORDS) }))
  return notes
}

/**
 * Each row as the state shows it: where its source stands, by the outline
 * label of each component and column it stands in, or the title, and the
 * first component or column, which the focus moving into the row selects;
 * whether it is accepted; and its toggle's name, which says the text and
 * its source. A row never stands in the payment part, whose words are a
 * person's, so a place outside every component is the title.
 */
export function rowsOf(proposal: TranslationProposal, accepted: ReadonlySet<string>, derived: Derived, { t, list }: TranslationWords): TranslationReviewRow[] {
  const places = new Map<string, { readonly path: string; readonly componentId?: string; readonly columnId?: string }[]>()
  const at = (key: string, place: { readonly path: string; readonly componentId?: string; readonly columnId?: string }): void => {
    const known = places.get(key)
    if (known === undefined) places.set(key, [place])
    else known.push(place)
  }
  for (const place of reportWords(derived.report)) at(`word ${place.text}`, place)
  for (const place of wordExpressionSites(derived.report)) at(`expression ${place.cel}`, place)
  return proposal.rows.map(({ key, kind, source, text }): TranslationReviewRow => {
    const standing = places.get(`${kind} ${source}`) ?? []
    const labels = standing.map(({ componentId, columnId }) =>
      componentId === undefined
        ? t('field.title')
        : (derived.labels.get(columnId === undefined ? componentId : columnKey(componentId, columnId)) ?? componentId),
    )
    const first = standing.find((place) => place.componentId !== undefined)
    const target =
      first?.componentId === undefined ? null : first.columnId === undefined ? { id: first.componentId } : { id: first.componentId, column: first.columnId }
    return {
      key,
      kind,
      source,
      text,
      where: list.format([...new Set(labels)]),
      target,
      accepted: accepted.has(key),
      toggle: t('translation.acceptOne', { text, source }),
    }
  })
}
