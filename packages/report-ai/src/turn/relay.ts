import { ModelBusyError, readAnswer } from './ask.js'
import type { AskModel, ModelPrompt } from './ask.js'

/**
 * A model whose turn a person carries: the page shows the request, somebody
 * copies it into a chat with a model of their own, and pastes the answer back
 * (formancy.ai 0160).
 *
 * formancy's relay, held here in its shapes until formancy releases one other
 * products may brief (0083). A relay is an `AskModel` like any host's --
 * `askChecked` asks it, races it against the stop and checks what comes back
 * -- and the only part that is not code is the carrying, so a page that may
 * ask no other site for anything still has a real model's answer read by the
 * same checks a host's model gets.
 *
 * **Decided here rather than in a builder**, because both builders draw it,
 * and two builders deciding when a paste counts would be two answers to one
 * question (0012). A builder subscribes, shows `waiting()`, and hands `answer`
 * what was pasted. No sentence is written here: what a builder says about a
 * turn, and what leaves with it, is the builder's catalogue's.
 *
 * Framework-neutral, the shape a report session has: `subscribe` and a
 * snapshot whose identity changes only when the turn does, which is what
 * React's `useSyncExternalStore` needs and what an Angular signal is set from.
 */
export interface Relay<K extends string = string> {
  /** Hand this to a run as its `ask`. */
  readonly ask: AskModel<K>
  /** The turn waiting for a person to carry it, or nothing. The same object until it changes. */
  waiting(this: void): RelayTurn<K> | undefined
  /** Hear each change of the turn waiting. Returns what stops listening. */
  subscribe(this: void, listener: () => void): () => void
  /**
   * What the person pasted back, for the turn waiting.
   *
   * `'no-object'` when there is no JSON object in it, and the turn is still
   * waiting -- unless `anyway`, which sends it as it is. `'nothing-waiting'`
   * when no turn is.
   */
  answer(text: string, options?: { readonly anyway?: boolean }): RelayAnswer
}

/** What came of a paste. */
export type RelayAnswer = 'accepted' | 'no-object' | 'nothing-waiting'

/** One turn, as a person carries it. */
export interface RelayTurn<K extends string = string> {
  /** Exactly what the run asked: the prompt a host's model would have been sent. */
  readonly prompt: ModelPrompt<K>
  /** The whole request as one text to copy -- `relayMessage(prompt)`. */
  readonly message: string
  /**
   * From the second turn: what was wrong with the last answer, alone, for a
   * chat that still holds that answer. Absent on the first.
   */
  readonly followUp: string | undefined
}

/**
 * The whole request as one text: the system briefing, a blank line, the user message.
 *
 * Verbatim. A chat has one box, so the briefing travels with the request
 * rather than as a system prompt -- and a briefing trimmed or re-wrapped on the
 * way would be a request the checks were not written against.
 */
export function relayMessage<K extends string>(prompt: ModelPrompt<K>): string {
  return `${prompt.system}\n\n${prompt.user}`
}

export function createRelay<K extends string = string>(): Relay<K> {
  /** The turn waiting, and how to answer it. One at most. */
  let current: { readonly turn: RelayTurn<K>; readonly settle: (text: string) => void } | undefined
  const listeners = new Set<() => void>()

  const changed = (): void => {
    for (const listener of [...listeners]) listener()
  }

  const ask: AskModel<K> = (prompt, turn) => {
    // **One turn at a time.** Queued, a second request would wait behind a
    // turn the person may never carry, and a paste meant for one could be
    // taken as the other's. Refused as busy, its run ends at once, and its
    // builder says so in the person's language.
    if (current !== undefined) {
      return Promise.reject(new ModelBusyError())
    }
    return new Promise<string>((resolve) => {
      const waiting = {
        turn: { prompt, message: relayMessage(prompt), followUp: prompt.followUp },
        settle: resolve,
      }
      current = waiting
      // A stop clears the turn, so an answer pasted afterwards finds nothing
      // to answer rather than being kept for whatever is asked next. Only
      // this turn: a cancel told late, after the paste, leaves the next one.
      turn.onCancel(() => {
        if (current !== waiting) return
        current = undefined
        changed()
      })
      changed()
    })
  }

  return {
    ask,
    waiting: () => current?.turn,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    answer(text, options = {}) {
      const waiting = current
      if (waiting === undefined) return 'nothing-waiting'
      // A copy that caught the chat's sentence and not its code block is a
      // mistake of the paste, not the model's. Sent on, it would spend an
      // attempt -- and a round trip by hand -- on telling the model it wrote
      // no JSON when it did. `readAnswer` is what the run will read it with,
      // so the two cannot disagree about what holds an object; a decline
      // holds one, and is an answer.
      if (options.anyway !== true && readAnswer(text) === undefined) return 'no-object'
      current = undefined
      changed()
      waiting.settle(text)
      return 'accepted'
    },
  }
}
