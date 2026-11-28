/**
 * A model asked for the words the language edited lacks, and its answer
 * reviewed word by word
 * ([0086](../../../docs/decisions/0086-a-person-reviews-a-models-translation-word-by-word-in-either-builder-and-applies-what-they-accepted-as-one-undo-step.md)):
 * the run, held by the editor for the language it was asked for, the rows
 * of report-ai's proposal and which a person accepted, and the actions that
 * ask, stop, accept, apply, discard and review again. Decided here once, so
 * that both builders draw the same review and neither decides when a row
 * may be applied (0012).
 *
 * **Held for its language**, as formancy.ai 0164 holds a translation: the
 * editor outlives a builder drawn again or switched, so the run does too,
 * and under another language the state says only where it waits or is
 * held. Asking, applying or discarding there is refused, so that nothing of
 * one language's review is drawn or applied under another. A language
 * removed while its run waits stops the run, and one removed while its
 * review is held forgets the review, said under every language until it is
 * discarded or another run is asked; one whose run came to nothing says
 * nothing of it. The editor sees the session's edits, which formancy's
 * holder does not.
 *
 * **The state first, the host after.** A run is ended by changing what the
 * editor holds and only then stopping the run, whose stop tells the host:
 * a host's `onCancel`, or a relay's subscriber, that throws is thrown once
 * the state no longer holds the run, never in place of the change (0008).
 *
 * **One run at a time, and only it lands.** A run gets a stop of its own,
 * and what it comes to is taken only while it is still the run in flight,
 * so that an answer to a run discarded, removed or stopped and asked again
 * is never held as the next one's (formancy.ai 0164's run holder).
 *
 * **Apply is one undo step** of the accepted rows' steps, one report-core
 * `batch` against the proposal's `expectedHash`, labelled with the
 * language and the count. A report that moved since refuses it as
 * `stale-document` and changes nothing; Review again then reads the held
 * answer against the report as it stands, with no new turn, and leaves out
 * what a person wrote meanwhile (0085).
 *
 * Lent what it needs of the editor, as `images.ts` is, and run through the
 * editor's one `dispatch`, but for `askTranslation`, which takes time and
 * is no action, as `addImage` is not (0008).
 */
import { createStop, proposeTranslation, translateMissing } from '@formancy/report-ai'
import type { AskModel, RequestKind, Stop, TranslationAnswer, TranslationProposal, TranslationResult } from '@formancy/report-ai'
import { batch } from '@formancy/report-core'
import type { Command, CommandOutcome, Refusal } from '@formancy/report-core'
import { stepLabel } from './history.js'
import { languageName, missingIn } from './languages.js'
import { DONE } from './model-actions.js'
import type { EditorOutcome, EditorRefusalCode } from './model-actions.js'
import type { TranslationReviewRow, TranslationState } from './model-translation.js'
import { refusalMessage } from './properties.js'
import type { Derived, Local } from './state.js'
import { answerSentence, endedSentence, notesOf, rowsOf } from './translation-words.js'
import type { TranslationWords } from './translation-words.js'
import type { MessageId } from './text.js'

/** A model the editor may ask for the words a language lacks (0086). */
export interface EditorModel {
  /** The host's model: report-ai's `askThrough` over the host's server, or a relay's `ask`, which a person carries. */
  readonly ask: AskModel<RequestKind>
}

/** The model a host gave, checked when the editor is made: one with no `ask` is the host's mistake, refused rather than met by a person later. */
export function modelOf(model: EditorModel | undefined): EditorModel | undefined {
  if (model === undefined) return undefined
  if (typeof model?.ask !== 'function') throw new RangeError('A model needs an ask function: the editor asks it for the words a language lacks.')
  return { ask: model.ask }
}

/** A run that ended without an answer, as report-ai ends one. */
type Ended = Extract<TranslationResult, { readonly ok: false }>

/** An answer held, its proposal against one version of the report, and the rows a person accepted, by key. */
export interface AnsweredTranslation {
  readonly locale: string
  readonly state: 'answered'
  readonly answer: TranslationAnswer
  readonly proposal: TranslationProposal
  readonly accepted: ReadonlySet<string>
  /** Why Apply was refused, in the editor's words: Review again is offered beside it. */
  readonly refusal?: string
}

/**
 * What the editor holds of a model's translation, for the language it was
 * asked for: a run waiting; how one ended without an answer, until another
 * is asked; an answer and its proposal; or a language removed with its run
 * or its review, said until it is discarded or another is asked.
 */
export type HeldTranslation =
  | { readonly locale: string; readonly state: 'asking' }
  | { readonly locale: string; readonly state: 'ended'; readonly result: Ended }
  | AnsweredTranslation
  | { readonly locale: string; readonly state: 'removed' }

/** Whether `held` holds rows to review: an answer that writes nothing has nothing to apply, and Ask is offered in its place (formancy.ai 0161). */
function reviewable(held: HeldTranslation | null): held is AnsweredTranslation {
  return held?.state === 'answered' && held.proposal.rows.length > 0
}

/** Whether `held` is for another language than the one edited, the report's own among them. */
function elsewhere(held: HeldTranslation, derived: Derived): boolean {
  return derived.edited.translation === undefined || held.locale !== derived.edited.locale
}

/**
 * Why Ask takes no run now, or undefined where it does: no model; the
 * report's own language; a language that lacks nothing; a run waiting, for
 * any language; or a review held, for any language. One rule, read by the
 * state's `ask` and by the action.
 */
function askRefusal(
  model: EditorModel | undefined,
  derived: Derived,
  held: HeldTranslation | null,
  { t, locale }: TranslationWords,
): { readonly code: Extract<EditorRefusalCode, 'unavailable' | 'busy'>; readonly message: string } | undefined {
  const { edited } = derived
  if (model === undefined) return { code: 'unavailable', message: t('translation.noModel') }
  if (edited.translation === undefined) return { code: 'unavailable', message: t('translation.ownLanguage') }
  if (missingIn(derived.diagnostics, edited.locale) === 0) return { code: 'unavailable', message: t('translation.lacksNothing', { language: edited.name }) }
  if (held?.state === 'asking') return { code: 'busy', message: t('translation.waiting', { language: languageName(held.locale, locale) }) }
  if (reviewable(held)) return { code: 'busy', message: t('translation.held', { language: languageName(held.locale, locale) }) }
  return undefined
}

/**
 * What the state shows of a model's translation under the language
 * edited, or null for an editor given no model: the run as it is under
 * its own language, and elsewhere only where it waits or is held. `rows`
 * gives a proposal's rows as the state shows them, which the editor keeps
 * while the report, the language and the review are the same.
 */
function translationState(
  model: EditorModel | undefined,
  derived: Derived,
  held: HeldTranslation | null,
  words: TranslationWords,
  rows: (proposal: TranslationProposal, accepted: ReadonlySet<string>) => readonly TranslationReviewRow[],
): TranslationState | null {
  if (model === undefined) return null
  const { t, locale } = words
  const { edited } = derived
  const missing = edited.translation === undefined ? 0 : missingIn(derived.diagnostics, edited.locale)
  const ask = missing === 0 ? null : { label: t('translation.ask', { count: missing }), available: askRefusal(model, derived, held, words) === undefined }
  const idle: TranslationState = { ask, busy: false, stop: t('translation.stop'), discard: null, status: '', review: null, notes: [] }
  if (held === null) return idle
  const language = languageName(held.locale, locale)
  const discard = { label: t('translation.discard'), available: true }
  if (held.state === 'removed') return { ...idle, discard, status: t('translation.status.removed', { language }) }
  if (elsewhere(held, derived)) {
    // A run that came to nothing to review is over, and drawn elsewhere as though there were none.
    if (held.state === 'asking') return { ...idle, status: t('translation.status.elsewhereAsking', { language }) }
    return reviewable(held) ? { ...idle, status: t('translation.status.elsewhereHeld', { language }) } : idle
  }
  if (held.state === 'asking') return { ...idle, busy: true, status: t('translation.status.asking', { language }) }
  if (held.state === 'ended') return { ...idle, status: endedSentence(held.result, language, words) }
  const { proposal, answer, accepted, refusal } = held
  const notes = notesOf(proposal, answer, language, words)
  const status = refusal ?? answerSentence(proposal, answer, language, words)
  if (proposal.rows.length === 0) return { ...idle, status, notes }
  const shown = rows(proposal, accepted)
  const count = shown.filter((row) => row.accepted).length
  const review = {
    heading: t('translation.heading', { language, count: shown.length }),
    columns: { source: languageName(derived.report.locale, locale), where: t('translation.where'), text: language, accepted: t('translation.accepted') },
    rows: shown,
    acceptAll: { label: t('translation.acceptAll'), available: count < shown.length },
    apply: { label: t('translation.apply', { count }), available: count > 0 },
    reviewAgain: refusal === undefined ? null : { label: t('translation.reviewAgain'), available: true },
  }
  return { ...idle, discard, status, review, notes }
}

/** What the editor lends its translation's actions: its document and its own state, and its one way each of acting, committing and refusing. */
export interface TranslationLent {
  current(): Derived
  local(): Local
  setLocal(next: Partial<Local>): void
  announce(text: string): Partial<Local>
  refuse(code: EditorRefusalCode, text: string, refusal?: Refusal): EditorOutcome
  /** Applies `command` as one step labelled `label`, refused as `stale-document` where the report's hash is not `expectedHash`. */
  commit(command: Command<object>, label: string, expectedHash: string): CommandOutcome
  /** Runs `run` as one action, listeners told once when it is done; what was thrown on the way is added to `errors`. */
  act<T>(run: () => T, errors: unknown[]): T | undefined
  raise(errors: readonly unknown[]): void
  disposed(): boolean
}

const NONE: ReadonlySet<string> = new Set()

/** Why a run was forgotten before it answered: what `askTranslation` says of it. */
type Forgotten = 'discarded' | 'removed' | 'disposed'

/** The editor's translation actions over `lent`, asking `model`. */
export function translationActions(model: EditorModel | undefined, lent: TranslationLent, words: TranslationWords) {
  const { t, locale } = words
  /** The stop of the run in flight: a run that finds another here, or none, was forgotten, and lands nothing. */
  let running: Stop | undefined
  /** Why each run no longer in flight was forgotten, by its stop. */
  const forgotten = new WeakMap<Stop, Forgotten>()
  /** The rows last shown, kept while the derivations, the review and what is accepted are the same. */
  let shown:
    | {
        readonly derived: Derived
        readonly proposal: TranslationProposal
        readonly accepted: ReadonlySet<string>
        readonly rows: readonly TranslationReviewRow[]
      }
    | undefined
  const named = (tag: string): string => languageName(tag, locale)

  /**
   * Forgets the run in flight, and tells its model: whatever it answers
   * later lands nowhere. Called once the state no longer holds the run,
   * since the stop runs the host's callbacks, which may throw.
   */
  function forget(why: Forgotten): void {
    const stop = running
    running = undefined
    if (stop === undefined) return
    forgotten.set(stop, why)
    stop.stop()
  }

  /** What `askTranslation` says of a run forgotten before it answered: discarded, its language removed, or its editor disposed. */
  function forgottenOutcome(stop: Stop, tag: string): EditorOutcome {
    // Every run no longer in flight was forgotten, and why kept.
    const why = forgotten.get(stop) as Forgotten
    if (why === 'disposed') return { ok: false, code: 'disposed', message: t('status.disposed') }
    return {
      ok: false,
      code: 'not-answered',
      message: why === 'removed' ? t('translation.forgottenRemoved', { language: named(tag) }) : t('translation.forgotten'),
    }
  }

  /**
   * What is held under the language edited, for an action that needs it in
   * one of the states `want`, or the refusal: under another language, where
   * it waits or is held, in the sentence the state says there; or, with
   * nothing so held here, `absent`.
   */
  function heldHere<S extends HeldTranslation['state']>(
    want: readonly S[],
    absent: MessageId,
  ): Extract<HeldTranslation, { readonly state: S }> | EditorOutcome {
    const held = lent.local().translation
    const derived = lent.current()
    if (held !== null && held.state !== 'removed' && elsewhere(held, derived)) {
      if (held.state === 'asking') return lent.refuse('unavailable', t('translation.status.elsewhereAsking', { language: named(held.locale) }))
      if (reviewable(held)) return lent.refuse('unavailable', t('translation.status.elsewhereHeld', { language: named(held.locale) }))
    }
    const here = held !== null && !elsewhere(held, derived) && (want as readonly string[]).includes(held.state)
    return here ? (held as Extract<HeldTranslation, { readonly state: S }>) : lent.refuse('unavailable', t(absent))
  }

  /** Starts a run for the language edited, or refuses: what it asks over, and its stop. */
  function start(): { readonly stop: Stop; readonly locale: string; readonly derived: Derived } | EditorOutcome {
    const derived = lent.current()
    const why = askRefusal(model, derived, lent.local().translation, words)
    if (why !== undefined) return lent.refuse(why.code, why.message)
    const stop = createStop()
    running = stop
    lent.setLocal({ translation: { locale: derived.edited.locale, state: 'asking' } })
    return { stop, locale: derived.edited.locale, derived }
  }

  /**
   * What the run of `stop` came to, held while it is still the run in
   * flight; an answer proposed against the report as it stands now, the run
   * in flight until the proposal is made. A proposal that throws lets go of
   * the run, and of the state that said it waits, before the throw is
   * handed on.
   */
  function land(stop: Stop, tag: string, result: TranslationResult): EditorOutcome {
    if (running !== stop) return forgottenOutcome(stop, tag)
    if (!result.ok) {
      running = undefined
      lent.setLocal({ translation: { locale: tag, state: 'ended', result } })
      return { ok: false, code: 'not-answered', message: endedSentence(result, named(tag), words) }
    }
    let proposal: TranslationProposal
    try {
      proposal = proposeTranslation(lent.current().report, result.answer)
    } catch (error) {
      running = undefined
      lent.setLocal({ translation: null })
      throw error
    }
    running = undefined
    lent.setLocal({ translation: { locale: tag, state: 'answered', answer: result.answer, proposal, accepted: NONE } })
    return DONE
  }

  return {
    /** The editor disposed: the run in flight forgotten, its model told. */
    dispose: () => forget('disposed'),

    /** What the state shows of what is held, under the language `derived` edits, the rows kept while nothing they are made of changed. */
    view(derived: Derived, held: HeldTranslation | null): TranslationState | null {
      return translationState(model, derived, held, words, (proposal, accepted) => {
        if (shown?.derived !== derived || shown.proposal !== proposal || shown.accepted !== accepted)
          shown = { derived, proposal, accepted, rows: rowsOf(proposal, accepted, derived, words) }
        return shown.rows
      })
    },

    /** `ReportEditor.askTranslation`. */
    async ask(): Promise<EditorOutcome> {
      if (lent.disposed()) return { ok: false, code: 'disposed', message: t('status.disposed') }
      const errors: unknown[] = []
      const started = lent.act(start, errors)
      if (started === undefined || 'ok' in started) {
        lent.raise(errors)
        return started as EditorOutcome
      }
      const { stop, locale: tag, derived } = started
      // The model, the report and the language as they were when Ask was
      // pressed, whatever a listener did since; translateMissing resolves on
      // every ending, a host's error and a stop among them.
      const result = await translateMissing((model as EditorModel).ask, derived.report, tag, { stop })
      const outcome = lent.act(() => land(stop, tag, result), errors)
      lent.raise(errors)
      return outcome as EditorOutcome
    },

    stop(): EditorOutcome {
      const held = heldHere(['asking'], 'translation.notWaiting')
      if ('ok' in held) return held
      // The run ends as stopped, and lands as one, once its turn has heard.
      running?.stop()
      return DONE
    },

    accept(key: string, accepted: boolean): EditorOutcome {
      const held = heldHere(['answered'], 'translation.nothingHeld')
      if ('ok' in held) return held
      // A key a caller tsc never saw sends may be none at all.
      if (!held.proposal.rows.some((row) => row.key === key)) return lent.refuse('not-found', t('status.notFound', { name: String(key) }))
      if (held.accepted.has(key) === (accepted === true)) return DONE
      const next = new Set(held.accepted)
      if (accepted === true) next.add(key)
      else next.delete(key)
      lent.setLocal({ translation: { ...held, accepted: next } })
      return DONE
    },

    acceptAll(): EditorOutcome {
      const held = heldHere(['answered'], 'translation.nothingHeld')
      if ('ok' in held) return held
      if (held.proposal.rows.every((row) => held.accepted.has(row.key))) return DONE
      lent.setLocal({ translation: { ...held, accepted: new Set(held.proposal.rows.map((row) => row.key)) } })
      return DONE
    },

    apply(): EditorOutcome {
      const held = heldHere(['answered'], 'translation.nothingHeld')
      if ('ok' in held) return held
      const steps = held.proposal.rows.filter((row) => held.accepted.has(row.key)).map((row) => row.step)
      if (steps.length === 0) return lent.refuse('unavailable', t('translation.nothingAccepted'))
      const label = stepLabel({ do: 'translate', locale: held.locale, count: steps.length })
      const outcome = lent.commit((report) => batch(report, steps), label, held.proposal.expectedHash)
      if (!outcome.ok) {
        // Said by the part's own status, beside Review again, and not again by the editor's.
        const message =
          outcome.code === 'stale-document' ? t('translation.status.stale') : t('translation.status.notApplied', { reason: refusalMessage(outcome, '') })
        lent.setLocal({ translation: { ...held, refusal: message } })
        return { ok: false, code: 'refused', message, refusal: outcome }
      }
      const language = named(held.locale)
      const missing = missingIn(lent.current().diagnostics, held.locale)
      const said =
        missing === 0 ? t('translation.appliedAll', { language, count: steps.length }) : t('translation.applied', { language, count: steps.length, missing })
      lent.setLocal({ translation: null, ...lent.announce(said) })
      return DONE
    },

    discard(): EditorOutcome {
      // A removal said is dismissed from any language: its language is in none the switch offers.
      if (lent.local().translation?.state === 'removed') {
        lent.setLocal({ translation: null })
        return DONE
      }
      const held = heldHere(['asking', 'ended', 'answered'], 'translation.nothingHeld')
      if ('ok' in held) return held
      lent.setLocal({ translation: null, ...lent.announce(t('translation.discarded', { language: named(held.locale) })) })
      forget('discarded')
      return DONE
    },

    reviewAgain(): EditorOutcome {
      const held = heldHere(['answered'], 'translation.nothingHeld')
      if ('ok' in held) return held
      const proposal = proposeTranslation(lent.current().report, held.answer)
      const accepted = new Set(proposal.rows.flatMap(({ key }) => (held.accepted.has(key) ? [key] : [])))
      lent.setLocal({ translation: { locale: held.locale, state: 'answered', answer: held.answer, proposal, accepted } })
      return DONE
    },

    /**
     * What `held` comes to once the session changed, and nothing else: a
     * language removed takes a run waiting and a review held with it, said
     * under every language, and anything else held for it, a run that came
     * to nothing, goes unsaid. The editor forgets the run once it holds
     * what this returns (`forget`).
     */
    followed(held: HeldTranslation | null, declared: (tag: string) => boolean): HeldTranslation | null {
      if (held === null || held.state === 'removed' || declared(held.locale)) return held
      return held.state === 'asking' || reviewable(held) ? { locale: held.locale, state: 'removed' } : null
    },

    /** The run in flight forgotten for a language removed, once the state no longer holds it. */
    removed: () => forget('removed'),
  }
}
