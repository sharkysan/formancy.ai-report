import { DECLINE_KEY } from '@formancy/spec'
import { describe, expect, test, vi } from 'vitest'
import { askChecked, createStop } from './ask.js'
import type { AskModel, AskTurn, Checkable, ModelPrompt, Verdict } from './ask.js'
import { createRelay, relayMessage } from './relay.js'
import type { Relay, RelayTurn } from './relay.js'

/**
 * A person carrying the model's turn: the page shows the request, somebody
 * copies it into a chat of their own and pastes the answer back
 * (formancy.ai 0160). A relay is an `AskModel` like any host's, so the run
 * after the paste is the run any model gets; what is pinned here is that
 * the relay changes nothing but who answers, and that a bad paste costs a
 * person a paste rather than one of the run's attempts.
 */

const build = (latest: string | undefined): Omit<ModelPrompt<'test'>, 'attempt' | 'limit'> => ({
  kind: 'test',
  system: 'the briefing',
  user: 'the request',
  ...(latest === undefined ? {} : { followUp: latest }),
})

const check = (answer: Checkable): Verdict<object, string> => {
  if (answer === undefined) return { ok: false, problem: 'no object' }
  if (answer.kind === 'unexplained-decline') return { ok: false, problem: 'a decline with no reason' }
  return (answer.value as { ok?: unknown }).ok === true ? { ok: true, value: answer.value } : { ok: false, problem: 'not ok' }
}

/** The turn after `previous`, once the run has asked it. */
const nextTurn = (relay: Relay<'test'>, previous: RelayTurn<'test'> | undefined): Promise<RelayTurn<'test'>> =>
  vi.waitFor(() => {
    const turn = relay.waiting()
    if (turn === undefined || turn === previous) throw new Error('no new turn yet')
    return turn
  })

/** A turn a test hands the relay itself, keeping what it is told to call on a stop. */
const handTurn = () => {
  const cancels: Array<() => void> = []
  const turn: AskTurn = { onCancel: (cancel) => cancels.push(cancel) }
  return { turn, cancel: () => cancels.splice(0).forEach((cancel) => cancel()) }
}

const PROMPT: ModelPrompt<'test'> = { kind: 'test', system: 'the briefing', user: 'the request', attempt: 1, limit: 3 }

describe('the turn a person carries', () => {
  test('is exactly the prompt the run asked, and a follow-up from its second turn', async () => {
    // Otherwise the relay is a second request nobody checks against the
    // first: what a visitor carries and what a host's model is sent would
    // drift apart.
    const relay = createRelay<'test'>()
    const asked: ModelPrompt<'test'>[] = []
    const ask: AskModel<'test'> = (prompt, turn) => {
      asked.push(prompt)
      return relay.ask(prompt, turn)
    }
    void askChecked(ask, build, check)

    const first = await nextTurn(relay, undefined)
    expect(first.prompt).toBe(asked[0])
    expect(first.message).toBe(relayMessage(first.prompt))
    expect(first.followUp).toBeUndefined()

    expect(relay.answer('{"ok": false}')).toBe('accepted')
    const second = await nextTurn(relay, first)
    expect(second.prompt).toBe(asked[1])
    expect([second.prompt.attempt, second.followUp]).toEqual([2, 'not ok'])
  })

  test('is written out as the briefing, a blank line, and the request, verbatim', () => {
    // A chat has one box, so the briefing travels with the request; trimmed
    // or re-wrapped, it would be a request the checks were not written for.
    expect(relayMessage({ ...PROMPT, system: ' rules \n', user: '\nthe report\n' })).toBe(' rules \n\n\n\nthe report\n')
  })

  test('is the same object until it changes, and each listener hears each change until it stops listening', async () => {
    // React's useSyncExternalStore compares snapshots by identity, so a
    // fresh object each read would draw the pane for ever; and a pane not
    // told would show a turn already answered.
    const relay = createRelay<'test'>()
    const heard = vi.fn()
    const forget = relay.subscribe(heard)
    expect(relay.waiting()).toBeUndefined()

    const run = askChecked(relay.ask, build, check)
    const turn = await nextTurn(relay, undefined)
    expect(relay.waiting()).toBe(turn)
    expect(relay.waiting()).toBe(turn)
    expect(heard).toHaveBeenCalledTimes(1)

    relay.answer('{"ok": true}')
    expect(relay.waiting()).toBeUndefined()
    expect(heard).toHaveBeenCalledTimes(2)
    expect(await run).toEqual({ ok: true, value: { ok: true }, attempts: 1 })

    forget()
    void askChecked(relay.ask, build, check)
    await nextTurn(relay, undefined)
    expect(heard).toHaveBeenCalledTimes(2)
  })
})

describe('an answer pasted back', () => {
  test('with no object in it keeps the turn waiting and costs the run no attempt', async () => {
    // A copy that caught the chat's sentence and not its code block is the
    // paste's mistake: sent on, it would spend an attempt, and a round trip
    // by hand, telling the model it wrote no JSON when it did.
    const relay = createRelay<'test'>()
    const run = askChecked(relay.ask, build, check)
    const turn = await nextTurn(relay, undefined)

    expect(relay.answer('Here is the JSON you asked for:')).toBe('no-object')
    expect(relay.waiting()).toBe(turn)
    expect(relay.answer('```json\n{"ok": true}\n```')).toBe('accepted')
    expect(await run).toEqual({ ok: true, value: { ok: true }, attempts: 1 })
  })

  test('sent anyway is the run’s answer as it is, and the run says what was wrong', async () => {
    // A person who knows the model wrote no JSON can say so: the run then
    // answers it as any model's non-answer, and asks again.
    const relay = createRelay<'test'>()
    const run = askChecked(relay.ask, build, check)
    const first = await nextTurn(relay, undefined)

    expect(relay.answer('no JSON here', { anyway: true })).toBe('accepted')
    const second = await nextTurn(relay, first)
    expect(second.followUp).toBe('no object')
    relay.answer('{"ok": true}')
    expect(await run).toEqual({ ok: true, value: { ok: true }, attempts: 2 })
  })

  test('that declines is an answer, and ends the run on its turn', async () => {
    // A decline holds an object; held back as no answer, a person could not
    // hand on a model's refusal at all.
    const relay = createRelay<'test'>()
    const run = askChecked(relay.ask, build, check)
    await nextTurn(relay, undefined)

    expect(relay.answer(`{"${DECLINE_KEY}": "a report cannot do that"}`)).toBe('accepted')
    expect(await run).toEqual(expect.objectContaining({ ended: 'declined', reason: 'a report cannot do that', attempts: 1 }))
  })

  test('with no turn waiting finds nothing to answer', () => {
    // Kept, a paste with nothing waiting would be taken as the answer to
    // whatever is asked next.
    expect(createRelay<'test'>().answer('{"ok": true}')).toBe('nothing-waiting')
  })
})

describe('one turn at a time', () => {
  test('a second request while one waits ends its run busy at once, and the first still waits', async () => {
    // Queued, a second request would wait behind a turn a person may never
    // carry, and a paste meant for one could be taken as the other's.
    const relay = createRelay<'test'>()
    const first = askChecked(relay.ask, build, check)
    const waiting = await nextTurn(relay, undefined)

    expect(await askChecked(relay.ask, build, check)).toStrictEqual({ ok: false, attempts: 1, problems: [], lastAnswer: '', ended: 'busy' })
    expect(relay.waiting()).toBe(waiting)

    relay.answer('{"ok": true}')
    expect(await first).toEqual({ ok: true, value: { ok: true }, attempts: 1 })
  })

  test('a stop clears the turn, so a paste after it finds nothing waiting', async () => {
    // Kept after a stop, the turn would take a late paste as the answer to
    // whatever is asked next -- the race a stop makes, with a person in the
    // middle.
    const relay = createRelay<'test'>()
    const stop = createStop()
    const heard = vi.fn()
    relay.subscribe(heard)
    const run = askChecked(relay.ask, build, check, { stop })
    await nextTurn(relay, undefined)

    stop.stop()

    expect(relay.waiting()).toBeUndefined()
    expect(heard).toHaveBeenCalledTimes(2)
    expect(relay.answer('{"ok": true}')).toBe('nothing-waiting')
    expect(await run).toEqual(expect.objectContaining({ ended: 'stopped', attempts: 1 }))
  })

  test('a stop told late to a turn already answered leaves the next turn waiting', async () => {
    // A host handing the relay a turn of its own may call its cancel after
    // the paste; clearing whatever waits then would drop another request.
    const relay = createRelay<'test'>()
    const earlier = handTurn()
    const answered = relay.ask(PROMPT, earlier.turn)
    relay.answer('{"ok": true}')
    await expect(answered).resolves.toBe('{"ok": true}')
    void relay.ask({ ...PROMPT, user: 'the next request' }, handTurn().turn)
    const next = relay.waiting()

    earlier.cancel()

    expect(relay.waiting()).toBe(next)
    expect(next?.prompt.user).toBe('the next request')
  })
})
