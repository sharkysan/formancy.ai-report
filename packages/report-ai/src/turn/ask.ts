import { DECLINE_KEY } from '@formancy/spec'

/**
 * Asking a model for something checkable, and reading what it says.
 *
 * formancy's turn, held here in formancy's shapes and names until formancy
 * releases one other products may brief
 * ([0083](../../../../docs/decisions/0083-the-models-turn-is-held-in-report-ai-in-formancys-shapes-until-formancy-releases-one-other-products-may-brief.md)):
 * formancy's own is `@formancy/builder-core`'s `answers.ts`, which does not
 * export it and types its prompt with formancy's three requests. This is
 * the same loop, generic over the kind a product asks, and
 * `against-formancy.test.ts` holds it to formancy 0.14.0's released one,
 * but for one departure, 0083's: a host's answer that is no text ends the
 * turn as one the host could not make, where formancy's reader throws on it
 * and rejects the run.
 * Nothing in this folder imports a Report package, so it can be deleted for
 * formancy's the day there is one (`generic.test.ts`).
 *
 * Two halves every request to a model has, whatever it asks for: getting a
 * JSON object out of text a model wrote, and asking again -- told what was
 * wrong -- until an answer passes or the run ends (formancy.ai 0056). The
 * caller says what to ask and how to check the answer; neither half knows
 * what a report is.
 *
 * **A run ends one of six ways**, and only the first is a success: an
 * answer passed; every attempt was used and none did; the person stopped
 * it; the host could not ask its model at all; the model was answering
 * another request; or the model said it cannot be done. The last four are
 * not an answer that failed, and saying so sends somebody to reword a
 * request when the network was down (formancy.ai 0157), or when no wording
 * would have helped (formancy.ai 0158).
 *
 * **No sentences here.** What a model is told -- the briefing, the request,
 * the complaint -- is worded by whoever asks, because that wording is about
 * the thing asked for. This file decides how many times, and what comes back.
 */

/**
 * One turn with whatever model the host has. Text in, text out.
 *
 * A function written with one parameter is still one of these: the second is
 * there for a host that can abandon a request, and one that cannot is stopped
 * all the same. One that takes any kind, `AskModel<string>`, serves every
 * request a product makes.
 */
export type AskModel<K extends string = string> = (prompt: ModelPrompt<K>, turn: AskTurn) => Promise<string>

/** What one turn sends: formancy's `AuthoringPrompt`, its kind a product's own. */
export interface ModelPrompt<K extends string = string> {
  /**
   * Which of a product's requests this is, set by the run that builds it on
   * every turn. What a request carries depends on it, and a relay says so by
   * it (formancy.ai 0167); a server that holds the key briefs a request by it
   * and never by a system part the browser sent (formancy.ai 0165). Required,
   * so a prompt built by hand has to say what it is.
   */
  readonly kind: K
  /** What the model is, and the rules of the format. Stable across turns. */
  readonly system: string
  /**
   * The request, plus whatever went wrong last time -- everything, every
   * turn, for a host that keeps no conversation. Only the latest complaint
   * (formancy.ai 0056).
   */
  readonly user: string
  /** Which turn this is, from 1. */
  readonly attempt: number
  /** How many turns the run will take at most. */
  readonly limit: number
  /** From attempt 2: the complaint alone, for a conversation that still holds the last answer. */
  readonly followUp?: string
}

/**
 * What an `AskModel` rejects with when it is answering another request and
 * will not take this one: a relay while a person carries another turn, or any
 * host whose model takes one request at a time.
 *
 * Not a model that could not be reached. Nothing was asked and nothing is
 * wrong with the model, so the run ends `busy` rather than `unreachable`, with
 * no reason: a builder says so from its catalogue, in the person's language,
 * where a host's sentence would be shown as written.
 *
 * Recognised by its `name`, as `reasonOf` reads an error by shape: one made in
 * another realm, or by formancy's copy of this class, fails `instanceof`. Its
 * message, if a host gives one, is for the host's own logs.
 */
export class ModelBusyError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'ModelBusyError'
  }
}

function isBusy(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'ModelBusyError'
}

/** What a turn is told while it waits. */
export interface AskTurn {
  /**
   * Called at most once, if the person stops the run while this turn waits --
   * at once, if they already have. Never for a turn that has answered.
   *
   * A callback rather than an `AbortSignal`, which this package's types do not
   * have: `const c = new AbortController(); turn.onCancel(() => c.abort())`.
   */
  onCancel(stop: () => void): void
}

/**
 * The person's stop button, as a run sees it.
 *
 * Made by whoever draws the button, handed to the run, and pressed from outside
 * it -- which is why it is an object and not a flag the run owns.
 */
export interface Stop {
  /** End the run. The turn waiting is abandoned and its host told; pressing again does nothing. */
  stop(): void
  /** Whether it has been pressed. */
  readonly stopped: boolean
  /**
   * Hear about it once: when it is pressed, or at once if it already has been.
   * Returns what stops listening, which a turn that answered calls.
   */
  onStop(listener: () => void): () => void
}

export function createStop(): Stop {
  let stopped = false
  const listeners = new Set<() => void>()
  return {
    stop() {
      if (stopped) return
      stopped = true
      const heard = [...listeners]
      listeners.clear()
      for (const listener of heard) listener()
    },
    get stopped() {
      return stopped
    },
    onStop(listener) {
      if (stopped) {
        listener()
        return () => undefined
      }
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** What one answer came to: the thing asked for, or what was wrong with it. */
export type Verdict<T, P> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problem: P }

/** How a run of turns ended. */
export type Asked<T, P> =
  | { readonly ok: true; readonly value: T; readonly attempts: number }
  | {
      readonly ok: false
      /** Turns asked, counting one that was stopped or could not be made. */
      readonly attempts: number
      /** What was wrong with each answer that came, in order. */
      readonly problems: readonly P[]
      /** The last answer that was checked, so a person can see what went wrong. */
      readonly lastAnswer: string
      readonly ended: 'gave-up' | 'stopped' | 'unreachable' | 'busy' | 'declined'
      /**
       * When unreachable: why, in the words of whatever the host's model threw --
       * absent when it had none. When declined: why, in the model's. Never when busy.
       */
      readonly reason?: string
    }

export interface AskOptions {
  /**
   * How many times to ask. Three by default: the answer, one correction, and
   * one more for the mistake the correction introduced (formancy.ai 0056).
   */
  readonly attempts?: number
  /** Pressed by the person to end the run while a turn waits. */
  readonly stop?: Stop
}

const DEFAULT_ATTEMPTS = 3

/** What one turn came to, before anything checks the answer. */
type Turn =
  | { readonly kind: 'answered'; readonly answer: string }
  | { readonly kind: 'stopped' }
  | { readonly kind: 'unreachable'; readonly reason: string | undefined }
  | { readonly kind: 'busy' }

/**
 * Ask, check, and ask again with the complaint, until an answer passes or the run ends.
 *
 * `build` is given only the **latest** problem, never the list: a model handed
 * three rounds of accumulated complaints starts fixing the first one again, and
 * a loop that passes one cannot be called in a way that repeats them all.
 *
 * `check` is given what the answer held, and never a decline: that ends the run
 * here, whatever was asked for, so a caller cannot check one as an answer that
 * failed and ask again. A decline with no reason in it does reach `check`,
 * because it is an answer that failed -- the run asks again -- and only the
 * caller can word what the model is told about it.
 *
 * It resolves on every ending, a host's error included, and a host's answer
 * that is no text, so a caller reads what happened from the result rather
 * than from whether it threw.
 */
export async function askChecked<T, P, K extends string = string>(
  ask: AskModel<K>,
  build: (latest: P | undefined) => Omit<ModelPrompt<K>, 'attempt' | 'limit'>,
  check: (answer: Checkable) => Verdict<T, P>,
  options: AskOptions = {},
): Promise<Asked<T, P>> {
  const limit = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS)
  const problems: P[] = []
  let lastAnswer = ''
  const ended = (how: 'gave-up' | 'stopped' | 'unreachable' | 'busy' | 'declined', attempts: number, reason?: string): Asked<T, P> => ({
    ok: false,
    attempts,
    problems,
    lastAnswer,
    ended: how,
    ...(reason === undefined ? {} : { reason }),
  })

  for (let attempt = 1; attempt <= limit; attempt += 1) {
    if (options.stop?.stopped === true) return ended('stopped', attempt - 1)

    const turn = await take(ask, { ...build(problems.at(-1)), attempt, limit }, options.stop)
    if (turn.kind === 'stopped') return ended('stopped', attempt)
    if (turn.kind === 'unreachable') return ended('unreachable', attempt, turn.reason)
    if (turn.kind === 'busy') return ended('busy', attempt)

    lastAnswer = turn.answer
    const read = readAnswer(turn.answer)
    // Not asked again: another turn would be a call paid for -- through a
    // relay, two pastes by hand -- to hear the same answer, or to talk the
    // model out of it (formancy.ai 0158).
    if (read?.kind === 'declined') return ended('declined', attempt, read.reason)
    const verdict = check(read)
    if (verdict.ok) return { ok: true, value: verdict.value, attempts: attempt }
    problems.push(verdict.problem)
  }

  return ended('gave-up', limit)
}

/**
 * One turn, raced against the stop.
 *
 * Raced rather than left to the host: a host that never registers `onCancel`
 * -- every `AskModel` written with one parameter -- would otherwise hold the
 * run for as long as its request took, and its answer would arrive after the
 * person had walked away and become a proposal for a request they abandoned
 * (formancy.ai 0157). So the turn ends the moment the stop is pressed, and
 * whatever the host says later settles a promise nobody is waiting on.
 */
function take<K extends string>(ask: AskModel<K>, prompt: ModelPrompt<K>, stop: Stop | undefined): Promise<Turn> {
  return new Promise<Turn>((resolve) => {
    let over = false
    let cancelled = false
    const cancels: Array<() => void> = []
    let forget = (): void => undefined

    const settle = (turn: Turn): void => {
      if (over) return
      over = true
      forget()
      resolve(turn)
    }

    if (stop !== undefined) {
      forget = stop.onStop(() => {
        cancelled = true
        settle({ kind: 'stopped' })
        for (const cancel of cancels.splice(0)) cancel()
      })
    }

    const turn: AskTurn = {
      onCancel(cancel) {
        // Registered after the stop, as a host does after an await of its own:
        // told now, or its request runs on for an answer nobody reads.
        if (cancelled) cancel()
        else if (!over) cancels.push(cancel)
      },
    }

    // What the host resolves with is read as unknown: a host in plain JavaScript may hand on anything.
    let answer: Promise<unknown>
    try {
      answer = Promise.resolve(ask(prompt, turn))
    } catch (error) {
      // Thrown before it returned a promise -- a configuration read up front --
      // and still the host's failure to ask, not the run's to rethrow.
      settle(refused(error))
      return
    }
    answer.then(
      // A text is an answer; anything else is the host's wiring, not the
      // model's answer, and the turn one the host could not make, with no
      // reason of its own. formancy 0.14.0 reads it as an answer and rejects
      // the run in the reader, which this departs from (0083).
      (text) => settle(typeof text === 'string' ? { kind: 'answered', answer: text } : { kind: 'unreachable', reason: undefined }),
      (error: unknown) => settle(refused(error)),
    )
  })
}

/** A turn the host's model would not take: busy with another request, or not reached at all. */
function refused(error: unknown): Turn {
  return isBusy(error) ? { kind: 'busy' } : { kind: 'unreachable', reason: reasonOf(error) }
}

/**
 * What the host's error says, if it says anything: its message, its name when
 * the message is empty, or the string it was rejected with.
 *
 * Read by shape rather than by `instanceof Error`, which an error from another
 * realm fails. Anything else has no words of its own, so it has no reason:
 * `String()` of it reads "undefined" or "[object ProgressEvent]" to a person,
 * and of an object with no prototype it throws -- here, inside the handler
 * that ends the run (formancy.ai 0157).
 */
function reasonOf(error: unknown): string | undefined {
  if (typeof error === 'string') return saysSomething(error)
  if (typeof error !== 'object' || error === null) return undefined
  const { message, name } = error as { message?: unknown; name?: unknown }
  if (typeof message !== 'string') return undefined
  return saysSomething(message) ?? (typeof name === 'string' ? saysSomething(name) : undefined)
}

function saysSomething(text: string): string | undefined {
  return text.trim() === '' ? undefined : text
}

/**
 * What a model's text held: an object to check, a decline and its reason, or a
 * decline with no reason in it.
 */
export type Reading =
  { readonly kind: 'object'; readonly value: object } | { readonly kind: 'declined'; readonly reason: string } | { readonly kind: 'unexplained-decline' }

/** What `check` is given: a reading that is not a decline, or `undefined` when there was no object. */
export type Checkable = Exclude<Reading, { readonly kind: 'declined' }> | undefined

/**
 * The JSON object in whatever the model said, or `undefined` when there is none.
 *
 * Models put JSON in code fences and add a sentence in front of it however
 * firmly they are told not to, and refusing those answers would spend a turn
 * on formatting rather than on the content. So a fence is stripped and,
 * failing that, the outermost braces are taken. Anything looser would start
 * accepting prose that happens to contain a bracket.
 *
 * **An object whose only key is `DECLINE_KEY`, holding a reason, is a
 * decline** (formancy.ai 0158), recognised by its whole shape, never by the
 * word. Whatever is asked for this way must not itself be such an object.
 * That shape with no reason in it is an `unexplained-decline`.
 */
export function readAnswer(text: string): Reading | undefined {
  const candidates = [insideFence(text), text, betweenBraces(text)]

  for (const candidate of candidates) {
    if (candidate === undefined) continue
    try {
      const parsed: unknown = JSON.parse(candidate.trim())
      // A bare string or number is valid JSON and is not an object; letting
      // one through would report it as the wrong object rather than as an
      // answer that was not one.
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return declineIn(parsed) ?? { kind: 'object', value: parsed }
      }
    } catch {
      // Try the next reading.
    }
  }
  return undefined
}

/**
 * The decline an object is, if it has a decline's shape.
 *
 * **One with no reason -- blank, or not a string -- does not end the run**:
 * "the model declined" and then nothing gives a person nothing to act on, and
 * asked again the model can say why, or answer after all. Nor is it the thing
 * asked for, whose checks would answer it with complaints that tell a model to
 * write what it judged could not be written. So it is a reading of its own,
 * and the caller's complaint asks for the reason.
 */
function declineIn(parsed: object): Reading | undefined {
  const keys = Object.keys(parsed)
  if (keys.length !== 1 || keys[0] !== DECLINE_KEY) return undefined
  const reason: unknown = (parsed as Record<string, unknown>)[DECLINE_KEY]
  return typeof reason === 'string' && reason.trim() !== '' ? { kind: 'declined', reason: reason.trim() } : { kind: 'unexplained-decline' }
}

/**
 * A decline, as a model writes one, for a host to answer with.
 *
 * For a model service that refuses a request itself -- a refusal in the
 * response rather than in its text -- so the run ends after that turn with the
 * host's sentence, as it would had the model said so, rather than spending
 * every remaining attempt on answers that were not JSON.
 *
 * Throws on a reason with nothing in it: written out, that is not a decline,
 * and the run would ask again -- the waste a decline exists to end. A host
 * doing that is wired wrongly, and hears so at once, in formancy's words.
 */
export function declinedAnswer(reason: string): string {
  if (reason.trim() === '') {
    throw new Error('declinedAnswer needs a reason to show the person who asked; a blank one is not a decline.')
  }
  return JSON.stringify({ [DECLINE_KEY]: reason })
}

/**
 * What the first code fence holds, without a leading `json` label.
 *
 * Found with `indexOf` rather than a pattern: a paste reaches this reader
 * straight from the relay, and `/```(?:json)?\s*([\s\S]*?)```/` backtracks
 * quadratically on a fence opened and never closed -- a long one hung the tab
 * (formancy's CodeQL js/polynomial-redos). Whitespace around the object is
 * the caller's `trim()`.
 */
function insideFence(text: string): string | undefined {
  const open = text.indexOf('```')
  if (open === -1) return undefined
  const close = text.indexOf('```', open + 3)
  if (close === -1) return undefined
  const inside = text.slice(open + 3, close)
  return inside.startsWith('json') ? inside.slice('json'.length) : inside
}

function betweenBraces(text: string): string | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start === -1 || end <= start ? undefined : text.slice(start, end + 1)
}
