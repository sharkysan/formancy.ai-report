import { DECLINE_KEY } from '@formancy/spec'
import { describe, expect, test, vi } from 'vitest'
import { askChecked, createStop, declinedAnswer, ModelBusyError, readAnswer } from './ask.js'
import type { AskModel, AskTurn, Checkable, ModelPrompt, Verdict } from './ask.js'

/**
 * A model's turn, as Report holds it until formancy releases one other
 * products may brief (0083): ask, read the JSON object in what came back,
 * ask again with the latest complaint, and end one of six ways. What a run
 * asks for is the caller's -- here a test's own kind and a check that wants
 * `{"ok": true}` -- so these cases hold the loop and nothing a kind adds.
 */

/** The prompt every case's run builds, the latest problem said as its follow-up. */
const build = (latest: string | undefined): Omit<ModelPrompt<'test'>, 'attempt' | 'limit'> => ({
  kind: 'test',
  system: 'the briefing',
  user: latest === undefined ? 'the request' : `the request\n\n${latest}`,
  ...(latest === undefined ? {} : { followUp: latest }),
})

/** Passes `{"ok": true}` and nothing else, saying what it was handed otherwise. */
const check = (answer: Checkable): Verdict<object, string> => {
  if (answer === undefined) return { ok: false, problem: 'no object' }
  if (answer.kind === 'unexplained-decline') return { ok: false, problem: 'a decline with no reason' }
  return (answer.value as { ok?: unknown }).ok === true ? { ok: true, value: answer.value } : { ok: false, problem: `not ok: ${JSON.stringify(answer.value)}` }
}

/** A host's model that answers turn by turn from `answers`, records each prompt and turn, and never answers past the list. */
const scripted = (...answers: string[]) => {
  const prompts: ModelPrompt<'test'>[] = []
  const turns: AskTurn[] = []
  const ask: AskModel<'test'> = (prompt, turn) => {
    prompts.push(prompt)
    turns.push(turn)
    const answer = answers[prompts.length - 1]
    return answer === undefined ? new Promise<string>(() => undefined) : Promise.resolve(answer)
  }
  return { ask, prompts, turns }
}

const OK = '{"ok": true}'

describe('a run of turns', () => {
  test('ends with the first answer that passes, and how many turns it took', async () => {
    // The one success: a run that reported the answer before it, or no
    // count, would show a person a value the check refused, or a run that
    // seemed to cost nothing.
    const { ask } = scripted('{"ok": false}', OK)

    expect(await askChecked(ask, build, check)).toEqual({ ok: true, value: { ok: true }, attempts: 2 })
  })

  test('gives up after its attempts, with what was wrong with each answer, in order, and the last answer', async () => {
    // "Gave up" is the one ending in which the answers were the trouble, so
    // a person reads what was wrong with each and the last one whole.
    const { ask, prompts } = scripted('one', '{"ok": 2}', 'three')

    expect(await askChecked(ask, build, check)).toEqual({
      ok: false,
      attempts: 3,
      problems: ['no object', 'not ok: {"ok":2}', 'no object'],
      lastAnswer: 'three',
      ended: 'gave-up',
    })
    expect(prompts).toHaveLength(3)
  })

  test('asks three times by default, as many as it is told, and never fewer than once', async () => {
    // Three is formancy.ai 0056's: the answer, a correction, and one for the
    // correction's mistake. A run told to ask no times would end having asked
    // nothing and report it as answers that failed.
    for (const [attempts, asked] of [
      [undefined, 3],
      [5, 5],
      [1, 1],
      [0, 1],
      [-2, 1],
    ] as const) {
      const { ask, prompts } = scripted('a', 'b', 'c', 'd', 'e')
      const result = await askChecked(ask, build, check, attempts === undefined ? {} : { attempts })
      expect([attempts, prompts.length, result.attempts]).toEqual([attempts, asked, asked])
    }
  })

  test('hands build the latest problem alone, never the list', async () => {
    // A model handed three rounds of complaints starts fixing the first one
    // again (formancy.ai 0056): each turn after the first carries what was
    // wrong with the answer just before it, and nothing older.
    const { ask } = scripted('one', 'two', 'three')
    const latest: unknown[] = []

    await askChecked(
      ask,
      (problem: string | undefined) => {
        latest.push(problem)
        return build(problem)
      },
      check,
    )

    expect(latest).toEqual([undefined, 'no object', 'no object'])
  })

  test('tells each turn which it is and of how many, and sends what build gave it verbatim', async () => {
    // A host that keeps a conversation tells a correction from a fresh
    // request by these (formancy.ai 0157); a prompt rewritten on the way
    // would be one the caller's checks were not written against.
    const { ask, prompts } = scripted('one', 'two', OK)

    await askChecked(ask, build, check)

    expect(prompts).toEqual([
      { ...build(undefined), attempt: 1, limit: 3 },
      { ...build('no object'), attempt: 2, limit: 3 },
      { ...build('no object'), attempt: 3, limit: 3 },
    ])
    expect(prompts[0]).not.toHaveProperty('followUp')
  })
})

describe('a model that declines', () => {
  test('ends the run on its turn, with its reason trimmed, and what was wrong before kept', async () => {
    // Asked again, a model that judged a request impossible is a call paid
    // for to hear the same answer (formancy.ai 0158); and a decline checked
    // as an answer would draw complaints about a thing nobody wanted.
    const { ask, prompts } = scripted('not yet', `{"${DECLINE_KEY}": "  the format cannot say that  "}`, OK)
    const checked = vi.fn(check)

    expect(await askChecked(ask, build, checked)).toEqual({
      ok: false,
      attempts: 2,
      problems: ['no object'],
      lastAnswer: `{"${DECLINE_KEY}": "  the format cannot say that  "}`,
      ended: 'declined',
      reason: 'the format cannot say that',
    })
    expect(prompts).toHaveLength(2)
    expect(checked).toHaveBeenCalledTimes(1)
  })

  test("is read by formancy's own key, in a fence after a sentence as well as bare", async () => {
    // The decline is formancy's shape to the byte (0083): built from
    // @formancy/spec's DECLINE_KEY, so a model briefed as formancy briefs
    // one is read the same here, wherever it puts the object.
    const decline = JSON.stringify({ [DECLINE_KEY]: 'no' })
    for (const answer of [decline, `I cannot.\n\`\`\`json\n${decline}\n\`\`\``, declinedAnswer('no')]) {
      const result = await askChecked(scripted(answer).ask, build, check)
      expect([answer, result]).toEqual([answer, expect.objectContaining({ ended: 'declined', reason: 'no', attempts: 1 })])
    }
  })

  test('with no reason, is handed to check as a decline with none, and the run asks again', async () => {
    // "The model declined" and then nothing gives a person nothing to act
    // on; asked again, the model can say why, or answer after all. Only the
    // caller can word what it is told, so check hears of it.
    const { ask, prompts } = scripted(`{"${DECLINE_KEY}": "  "}`, `{"${DECLINE_KEY}": 3}`, OK)
    const handed: Checkable[] = []

    const result = await askChecked(ask, build, (answer) => {
      handed.push(answer)
      return check(answer)
    })

    expect(handed.slice(0, 2)).toEqual([{ kind: 'unexplained-decline' }, { kind: 'unexplained-decline' }])
    expect(result).toEqual({ ok: true, value: { ok: true }, attempts: 3 })
    expect(prompts[1]?.followUp).toBe('a decline with no reason')
  })

  test('is known by its whole shape: an object holding the key beside anything else is an answer', async () => {
    // Read by the word, a document that happens to have a `declined` member
    // would end the run as the model's refusal.
    const handed: Checkable[] = []
    await askChecked(
      scripted(`{"${DECLINE_KEY}": "no", "ok": false}`).ask,
      build,
      (answer) => {
        handed.push(answer)
        return check(answer)
      },
      { attempts: 1 },
    )

    expect(handed).toEqual([{ kind: 'object', value: { [DECLINE_KEY]: 'no', ok: false } }])
  })
})

describe('a host that cannot ask its model', () => {
  test('ends the run unreachable with its error, counting the turn, rather than rejecting', async () => {
    // A rejection let through made a caller build the failure by hand, and
    // a network down read as a request that did not work (formancy.ai 0157).
    const ask: AskModel<'test'> = () => Promise.reject(new Error('the network is down'))

    expect(await askChecked(ask, build, check)).toEqual({
      ok: false,
      attempts: 1,
      problems: [],
      lastAnswer: '',
      ended: 'unreachable',
      reason: 'the network is down',
    })
  })

  test('ends it the same way when it throws before it returns a promise', async () => {
    // A host that reads its configuration up front throws rather than
    // rejects; left to escape, that error would leave the run neither
    // resolved nor ended.
    const ask: AskModel<'test'> = () => {
      throw new Error('no key is set')
    }

    expect(await askChecked(ask, build, check)).toEqual(expect.objectContaining({ ended: 'unreachable', reason: 'no key is set', attempts: 1 }))
  })

  test('says why in its words where it has any, read by shape, and has no reason where it has none', async () => {
    // `String()` of what was thrown read "undefined" or "[object
    // ProgressEvent]" to a person, ended an empty string on a colon, and
    // threw on an object with no prototype inside the handler that ends the
    // run; `instanceof Error` fails an error from another realm.
    const unnamed = new Error('')
    unnamed.name = 'TimeoutError'
    const blank = new TypeError('   ')
    const cases: ReadonlyArray<readonly [unknown, string | undefined]> = [
      [new Error('refused'), 'refused'],
      [unnamed, 'TimeoutError'],
      [blank, 'TypeError'],
      [{ message: 'from another realm' }, 'from another realm'],
      [{ message: 3, name: 'Odd' }, undefined],
      [{ message: '', name: 3 }, undefined],
      ['offline', 'offline'],
      ['  ', undefined],
      [undefined, undefined],
      [null, undefined],
      [42, undefined],
      [Object.create(null), undefined],
    ]
    for (const [thrown, reason] of cases) {
      const result = await askChecked(() => Promise.reject(thrown as Error), build, check)
      expect([String(reason), result.ok ? 'answered' : result.ended, Object.hasOwn(result, 'reason'), result.ok ? undefined : result.reason]).toEqual([
        String(reason),
        'unreachable',
        reason !== undefined,
        reason,
      ])
    }
  })

  test('busy with another request ends the run busy, with no reason, whoever made the error', async () => {
    // Nothing is wrong with a model answering another request, so the run
    // is not unreachable; and a host's message for its own logs is no
    // reason a pane should show. Read by its name, so a ModelBusyError of
    // another copy of the package, or another realm, is busy too.
    for (const error of [new ModelBusyError(), new ModelBusyError('for the logs'), { name: 'ModelBusyError', message: 'elsewhere' }]) {
      const result = await askChecked(() => Promise.reject(error), build, check)
      expect(result).toStrictEqual({ ok: false, attempts: 1, problems: [], lastAnswer: '', ended: 'busy' })
    }
  })

  test('is told it is busy by an error that says so, named for it', () => {
    // A host's own `instanceof` and a run's reading by name both find it.
    const error = new ModelBusyError('taken')
    expect([error instanceof Error, error.name, error.message]).toEqual([true, 'ModelBusyError', 'taken'])
  })
})

describe('stopping a run', () => {
  test('before it starts asks nothing', async () => {
    // A stop pressed before the first turn spent a call nobody wanted.
    const stop = createStop()
    stop.stop()
    const { ask, prompts } = scripted(OK)

    expect(await askChecked(ask, build, check, { stop })).toEqual({ ok: false, attempts: 0, problems: [], lastAnswer: '', ended: 'stopped' })
    expect(prompts).toHaveLength(0)
  })

  test('while a turn waits ends the run at once, though the host never listens', async () => {
    // Every host written with one parameter ignores the stop; without the
    // race the run would wait for as long as its request took, and its
    // answer would become a proposal for something abandoned (formancy.ai 0157).
    const stop = createStop()
    const { ask } = scripted()
    const run = askChecked(ask, build, check, { stop })
    await Promise.resolve()

    stop.stop()

    expect(await run).toEqual({ ok: false, attempts: 1, problems: [], lastAnswer: '', ended: 'stopped' })
  }, 1_000)

  test('tells a host that listens, once, and never holds the answer that arrives after', async () => {
    // A host that can abandon its request is told; the answer it sends
    // anyway is the one a person walked away from.
    const stop = createStop()
    let answer: (text: string) => void = () => undefined
    const cancelled = vi.fn()
    const ask: AskModel<'test'> = (_prompt, turn) => {
      turn.onCancel(cancelled)
      return new Promise<string>((resolve) => {
        answer = resolve
      })
    }
    const run = askChecked(ask, build, check, { stop })
    await Promise.resolve()

    stop.stop()
    stop.stop()
    answer(OK)

    expect(await run).toEqual({ ok: false, attempts: 1, problems: [], lastAnswer: '', ended: 'stopped' })
    expect(cancelled).toHaveBeenCalledTimes(1)
  })

  test('tells a host that asks to be told only after the stop at once', async () => {
    // A host registers after an await of its own; told nothing, its request
    // runs on for an answer nobody reads.
    const stop = createStop()
    const cancelled = vi.fn()
    let registered: Promise<void> = Promise.resolve()
    const ask: AskModel<'test'> = (_prompt, turn) => {
      registered = (async () => {
        await Promise.resolve()
        await Promise.resolve()
        turn.onCancel(cancelled)
      })()
      return new Promise<string>(() => undefined)
    }
    const run = askChecked(ask, build, check, { stop })
    await Promise.resolve()

    stop.stop()
    await run
    await registered

    expect(cancelled).toHaveBeenCalledTimes(1)
  })

  test('in its second turn counts both turns, and the first turn is not told', async () => {
    // A stopped run counts the turn it abandoned (formancy.ai 0157); and a
    // first turn's listener left on the stop would cancel a request that had
    // already answered.
    const stop = createStop()
    const { ask, turns } = scripted('not yet')
    const told = [vi.fn(), vi.fn()]
    const listening: AskModel<'test'> = (prompt, turn) => {
      turn.onCancel(told[turns.length] ?? (() => undefined))
      return ask(prompt, turn)
    }
    const run = askChecked(listening, build, check, { stop })
    await vi.waitFor(() => expect(turns).toHaveLength(2))

    stop.stop()

    expect(await run).toEqual({ ok: false, attempts: 2, problems: ['no object'], lastAnswer: 'not yet', ended: 'stopped' })
    expect([told[0]?.mock.calls.length, told[1]?.mock.calls.length]).toEqual([0, 1])
  })

  test('after the run has ended tells no host', async () => {
    // A turn that answered stops listening, so a stop pressed later does not
    // cancel a request that finished, nor reach a run that is over.
    const stop = createStop()
    const cancelled = vi.fn()
    const ask: AskModel<'test'> = (_prompt, turn) => {
      turn.onCancel(cancelled)
      return Promise.resolve(OK)
    }
    const result = await askChecked(ask, build, check, { stop })

    stop.stop()

    expect(result.ok).toBe(true)
    expect(cancelled).not.toHaveBeenCalled()
  })

  test('is never told to a turn that answered, however late the host registers', async () => {
    // Told after it answered, a host would abort a request that is over.
    const cancelled = vi.fn()
    const stop = createStop()
    let later: AskTurn | undefined
    const ask: AskModel<'test'> = (_prompt, turn) => {
      later = turn
      return Promise.resolve(OK)
    }
    await askChecked(ask, build, check, { stop })

    later?.onCancel(cancelled)
    stop.stop()

    expect(cancelled).not.toHaveBeenCalled()
  })
})

describe('a stop', () => {
  test('tells each listener once, however often it is pressed', () => {
    // A double click on Stop would otherwise abort a host's request twice, and a
    // host's cleanup is rarely written to run twice.
    const stop = createStop()
    const heard = vi.fn()
    stop.onStop(heard)

    stop.stop()
    stop.stop()

    expect(stop.stopped).toBe(true)
    expect(heard).toHaveBeenCalledTimes(1)
  })

  test('tells a listener added after it was pressed at once, and hands back a forget that has nothing to forget', () => {
    // Otherwise a turn begun a moment after the stop would wait for ever;
    // and a turn that answers calls what it was handed, which must not throw.
    const stop = createStop()
    stop.stop()
    const heard = vi.fn()

    const forget = stop.onStop(heard)
    forget()
    stop.stop()

    expect(heard).toHaveBeenCalledTimes(1)
  })

  test('tells a listener that has gone nothing', () => {
    // A turn that answered stops listening, so a stop pressed later does not
    // cancel a request that has already finished.
    const stop = createStop()
    const heard = vi.fn()
    const forget = stop.onStop(heard)

    forget()
    stop.stop()

    expect(stop.stopped).toBe(true)
    expect(heard).not.toHaveBeenCalled()
  })
})

describe('reading an answer', () => {
  test('finds the object in a fence, with or without its label, after a sentence, or between other words', () => {
    // Models fence their JSON and talk around it however they are told not
    // to, and refusing that would spend a turn on formatting.
    for (const text of [
      '{"a": 1}',
      '  {"a": 1}\n',
      '```json\n{"a": 1}\n```',
      'Here:\n```\n{"a": 1}\n```\nDone.',
      '```json{"a": 1}```',
      'Sure, here it is: {"a": 1} -- hope that helps.',
      '```\nnot json\n```\nthen {"a": 1}',
    ]) {
      expect([text, readAnswer(text)]).toEqual([text, { kind: 'object', value: { a: 1 } }])
    }
  })

  test('finds none in prose, in a value that is not an object, or in two objects side by side', () => {
    // A bare string, a number or a list is JSON and no object: let through,
    // it would be reported as the wrong object rather than as no answer; and
    // anything looser than the outermost braces accepts prose that happens
    // to hold a bracket.
    for (const text of ['', 'I would rather not.', '"a string"', '42', '[1, 2]', 'null', '{ broken', '} backwards {', '{"a": 1} and {"b": 2}', '```']) {
      expect([text, readAnswer(text)]).toEqual([text, undefined])
    }
  })

  test('reads a fence that is opened and never closed in linear time', () => {
    // A paste reaches this reader straight from the relay; a pattern that
    // backtracks hung the tab on one (formancy's CodeQL js/polynomial-redos).
    expect(readAnswer('```' + '\t'.repeat(200_000))).toBeUndefined()
  }, 2_000)

  test('reads a decline by its whole shape, its reason trimmed, and one with no reason as that', () => {
    // A blank or non-string reason is no decline to end a run on; and a
    // second key makes the object an answer.
    expect(readAnswer(`{"${DECLINE_KEY}": " why "}`)).toEqual({ kind: 'declined', reason: 'why' })
    for (const reason of ['""', '"  "', '3', 'null', '{}']) {
      expect([reason, readAnswer(`{"${DECLINE_KEY}": ${reason}}`)]).toEqual([reason, { kind: 'unexplained-decline' }])
    }
    expect(readAnswer(`{"${DECLINE_KEY}": "why", "also": 1}`)).toEqual({ kind: 'object', value: { [DECLINE_KEY]: 'why', also: 1 } })
  })
})

describe('a decline a host answers with', () => {
  test('is the text a model would have written, by the key formancy declares', () => {
    // A host whose service refuses a request ends the run as a decline,
    // with its sentence, rather than as answers that were not JSON.
    expect(declinedAnswer('the service refused it')).toBe(JSON.stringify({ [DECLINE_KEY]: 'the service refused it' }))
    expect(readAnswer(declinedAnswer('the service refused it'))).toEqual({ kind: 'declined', reason: 'the service refused it' })
  })

  test('is refused at once for a reason with nothing in it', () => {
    // Written out, a blank reason is not a decline, and the run would ask
    // again -- the waste a decline exists to end; a host wired so hears so.
    for (const reason of ['', ' ', '\n\t']) expect(() => declinedAnswer(reason)).toThrow(/needs a reason/)
  })
})
