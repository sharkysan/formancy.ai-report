import * as formancy from '@formancy/builder-core'
import type {
  AskModel as FormancyAskModel,
  AskTurn as FormancyAskTurn,
  AuthoringProblem,
  AuthoringPrompt,
  AuthoringResult,
  ModelRequestKind,
  Relay as FormancyRelay,
  RelayAnswer as FormancyRelayAnswer,
  RelayTurn as FormancyRelayTurn,
  Stop as FormancyStop,
} from '@formancy/builder-core'
import { DECLINE_KEY } from '@formancy/spec'
import type { FormSchema } from '@formancy/spec'
import { describe, expect, expectTypeOf, test, vi } from 'vitest'
import { askChecked, createStop, declinedAnswer, ModelBusyError, readAnswer } from './ask.js'
import type { AskModel, Asked, AskTurn, Checkable, ModelPrompt, Stop, Verdict } from './ask.js'
import { createRelay, relayMessage } from './relay.js'
import type { Relay, RelayAnswer, RelayTurn } from './relay.js'

/**
 * Report's turn held to formancy's released one, `@formancy/builder-core`
 * at exactly 0.14.0, a devDependency of this suite alone (0083). Report
 * holds the turn in formancy's shapes until formancy releases one other
 * products may brief, and this is what says when the two stop agreeing:
 *
 * - **the types**, each of Report's instantiated for formancy's kinds and
 *   held equal to formancy's own -- the prompt, the ask, the turn, the stop,
 *   the relay, its turn and its answers, and a run's failure -- by
 *   `expectTypeOf`, which `pnpm typecheck` checks through tsconfig.test.json
 *   (vitest runs it as nothing);
 * - **a run**, through both turns' public doors: the same scripted host
 *   asked by Report's `askChecked` and by formancy's `authorForm`, the one
 *   run formancy exports, ending the same way, after the same turns, with the
 *   same reason, problems of the same kinds and the same last answer;
 * - **the reader**, which formancy does not export: every paste handed to
 *   both relays answers the same, `'no-object'` exactly where Report's
 *   `readAnswer` finds no object, and every answer read through both runs
 *   ends alike -- the same document, the same decline and its reason;
 * - **each other**: formancy's run asks Report's relay and is stopped by
 *   Report's stop, and Report's run asks formancy's relay and is stopped by
 *   formancy's, so the two speak one protocol and not two alike;
 * - and `declinedAnswer`, `relayMessage` and `ModelBusyError`, byte for byte.
 *
 * What it cannot see is a path of `askChecked` that `authorForm` never
 * takes, a check that is no form's (0083's cost).
 */

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

describe("Report's types are formancy's", () => {
  // A shape that drifted -- a member renamed, one made optional, a union
  // grown -- would leave a host's code written against formancy's turn
  // unable to move to Report's or back, and the folder no longer the
  // deletion 0083 promises.
  test('instantiated for formancy’s kinds, each type is formancy’s own', () => {
    expectTypeOf<ModelPrompt<ModelRequestKind>>().toEqualTypeOf<AuthoringPrompt>()
    expectTypeOf<AskModel<ModelRequestKind>>().toEqualTypeOf<FormancyAskModel>()
    expectTypeOf<AskTurn>().toEqualTypeOf<FormancyAskTurn>()
    expectTypeOf<Stop>().toEqualTypeOf<FormancyStop>()
    expectTypeOf<Relay<ModelRequestKind>>().toEqualTypeOf<FormancyRelay>()
    expectTypeOf<RelayTurn<ModelRequestKind>>().toEqualTypeOf<FormancyRelayTurn>()
    expectTypeOf<RelayAnswer>().toEqualTypeOf<FormancyRelayAnswer>()
    expectTypeOf<Extract<Asked<FormSchema, AuthoringProblem>, { ok: false }>>().toEqualTypeOf<Extract<AuthoringResult, { ok: false }>>()
    expectTypeOf<ModelBusyError>().toEqualTypeOf<formancy.ModelBusyError>()
    expectTypeOf<ConstructorParameters<typeof ModelBusyError>>().toEqualTypeOf<ConstructorParameters<typeof formancy.ModelBusyError>>()
    expectTypeOf<typeof createStop>().toEqualTypeOf<typeof formancy.createStop>()
    expectTypeOf<typeof declinedAnswer>().toEqualTypeOf<typeof formancy.declinedAnswer>()
    expectTypeOf<typeof relayMessage<ModelRequestKind>>().toEqualTypeOf<typeof formancy.relayMessage>()
    expectTypeOf<typeof createRelay<ModelRequestKind>>().toEqualTypeOf<typeof formancy.createRelay>()
    // A guard on the guard: the equality the cases rest on tells two shapes apart.
    expectTypeOf<Equal<{ readonly a?: string }, { readonly a: string }>>().toEqualTypeOf<false>()
  })

  // A stop or a relay of another shape at run time -- a member added, a
  // getter made a field -- would pass the types where a host's own code
  // reads them otherwise.
  test('each object is made with formancy’s members, and the busy error is formancy’s', () => {
    const shape = (value: object) =>
      Object.entries(Object.getOwnPropertyDescriptors(value))
        .map(([key, descriptor]) => `${key}:${descriptor.get === undefined ? typeof descriptor.value : 'getter'}`)
        .sort()
    expect(shape(createStop())).toEqual(shape(formancy.createStop()))
    expect(shape(createRelay())).toEqual(shape(formancy.createRelay()))
    for (const message of [undefined, 'for the logs']) {
      const [ours, theirs] = [new ModelBusyError(message), new formancy.ModelBusyError(message)]
      expect([ours.name, ours.message, ours instanceof Error, Object.keys(ours)]).toEqual([
        theirs.name,
        theirs.message,
        theirs instanceof Error,
        Object.keys(theirs),
      ])
    }
  })
})

/** A form formancy 0.14.0's checks pass, so its run ends with it, as Report's run below does. */
const FORM: FormSchema = {
  specVersion: '2',
  id: 'contact',
  title: 'Contact',
  model: { fields: [{ key: 'email', type: 'text', label: 'Email' }] },
}
const FORM_TEXT = JSON.stringify(FORM)

/** One turn of a scripted host: an answer, a rejection, a throw before any promise, or none until it is stopped. */
type Step = { readonly answer: string } | { readonly reject: unknown } | { readonly throws: unknown } | { readonly waits: true }

/** What a host saw of each turn, the part the two runs share: which turn, of how many, and whether a follow-up came. */
interface Seen {
  readonly attempt: number
  readonly limit: number
  readonly followUp: boolean
}

/**
 * A host that answers turn by turn from `steps`, recording what it saw. Its
 * `ask` serves either run: a prompt is read by the members both turns send.
 */
function host(steps: readonly Step[]) {
  const seen: Seen[] = []
  const cancelled: number[] = []
  const ask = (prompt: ModelPrompt, turn: AskTurn): Promise<string> => {
    seen.push({ attempt: prompt.attempt, limit: prompt.limit, followUp: prompt.followUp !== undefined })
    const index = seen.length
    turn.onCancel(() => cancelled.push(index))
    const step = steps[index - 1] ?? { waits: true }
    if ('throws' in step) throw step.throws
    if ('reject' in step) return Promise.reject(step.reject)
    if ('answer' in step) return Promise.resolve(step.answer)
    return new Promise<string>(() => undefined)
  }
  return { ask, seen, cancelled }
}

/** What formancy's checks make of an answer, said in the kinds Report's run below can say too. */
const kindOf = (problem: AuthoringProblem): string => (problem.kind === 'not-json' || problem.kind === 'unexplained-decline' ? problem.kind : 'not-the-form')

/** Report's check standing in for formancy's: the form passes, no object and a reasonless decline are said as formancy says them, any other object is not the form. */
const checkLikeFormancy = (answer: Checkable): Verdict<object, string> => {
  if (answer === undefined) return { ok: false, problem: 'not-json' }
  if (answer.kind === 'unexplained-decline') return { ok: false, problem: 'unexplained-decline' }
  return JSON.stringify(answer.value) === FORM_TEXT ? { ok: true, value: answer.value } : { ok: false, problem: 'not-the-form' }
}

/** A run's ending, as both runs can state it. */
const ending = (result: AuthoringResult | Asked<object, string>, kinds: readonly string[]) =>
  result.ok
    ? { ok: true, attempts: result.attempts, value: 'document' in result ? result.document : result.value }
    : {
        ok: false,
        keys: Object.keys(result).sort(),
        attempts: result.attempts,
        ended: result.ended,
        reason: result.reason,
        lastAnswer: result.lastAnswer,
        problems: kinds,
      }

interface Run {
  readonly steps: readonly Step[]
  readonly attempts?: number
  /** Press the stop before the run, or once the host has seen this many turns. */
  readonly stopAt?: number
}

/** The same host run by formancy's `authorForm` and by Report's `askChecked`, each with its own stop, and what each ended as and saw. */
async function both({ steps, attempts, stopAt }: Run) {
  const theirs = host(steps)
  const ours = host(steps)
  const stops = [formancy.createStop(), createStop()] as const
  const options = (stop: Stop) => ({ ...(attempts === undefined ? {} : { attempts }), stop })
  if (stopAt === 0) for (const stop of stops) stop.stop()
  const runs = [
    formancy.authorForm(theirs.ask, 'a contact form', options(stops[0])),
    askChecked(
      ours.ask,
      (latest: string | undefined) => ({ kind: 'test', system: 'the briefing', user: 'the request', ...(latest === undefined ? {} : { followUp: latest }) }),
      checkLikeFormancy,
      options(stops[1]),
    ),
  ] as const
  if (stopAt !== undefined && stopAt > 0) {
    await vi.waitFor(() => expect([theirs.seen.length, ours.seen.length]).toEqual([stopAt, stopAt]))
    for (const stop of stops) stop.stop()
  }
  const [formancyEnded, reportEnded] = await Promise.all(runs)
  return {
    formancy: { ending: ending(formancyEnded, formancyEnded.ok ? [] : formancyEnded.problems.map(kindOf)), seen: theirs.seen, cancelled: theirs.cancelled },
    report: { ending: ending(reportEnded, reportEnded.ok ? [] : reportEnded.problems), seen: ours.seen, cancelled: ours.cancelled },
  }
}

const decline = (reason: unknown) => JSON.stringify({ [DECLINE_KEY]: reason })

/** Every paste and answer the reader is compared on: what models write, what a bad copy holds, and what only looks like an answer. */
const TEXTS = [
  FORM_TEXT,
  `  ${FORM_TEXT}\n`,
  `\`\`\`json\n${FORM_TEXT}\n\`\`\``,
  `Here is the form:\n\`\`\`\n${FORM_TEXT}\n\`\`\`\nLet me know.`,
  `\`\`\`json${FORM_TEXT}\`\`\``,
  `Sure: ${FORM_TEXT} -- hope that helps.`,
  `\`\`\`\nnot json\n\`\`\`\nthen ${FORM_TEXT}`,
  `${FORM_TEXT} and ${FORM_TEXT}`,
  '{}',
  '{"a": 1}',
  '',
  'I would rather not.',
  'Here is the JSON you asked for:',
  '"a string"',
  '42',
  '[1, 2]',
  'null',
  '{ broken',
  '} backwards {',
  '```',
  '```json\n',
  '```' + '\t'.repeat(5_000),
  decline('the format cannot say that'),
  decline('  padded  '),
  `I cannot.\n\`\`\`json\n${decline('no')}\n\`\`\``,
  decline(''),
  decline('   '),
  decline(3),
  decline(null),
  JSON.stringify({ [DECLINE_KEY]: 'no', also: 1 }),
  `{"${DECLINE_KEY}": "ünïcödé, \\"quoted\\", and a\\nnewline"}`,
]

describe('a run of each ends alike', () => {
  // Each ending is a different sentence to a person (formancy.ai 0157,
  // 0158): a run that ended otherwise here than in formancy would tell a
  // Report author to reword a request when the network was down, or the
  // reverse, and nothing else would notice.
  test.each<[string, Run]>([
    ['an answer that passes at once', { steps: [{ answer: FORM_TEXT }] }],
    ['an answer that passes after two that do not', { steps: [{ answer: 'no' }, { answer: '{}' }, { answer: `\`\`\`json\n${FORM_TEXT}\n\`\`\`` }] }],
    ['every attempt answered and none passing', { steps: [{ answer: 'one' }, { answer: '{}' }, { answer: 'three' }] }],
    ['a decline on the first turn', { steps: [{ answer: decline('  the format cannot say that ') }] }],
    ['a decline after an answer that failed', { steps: [{ answer: '{"a": 1}' }, { answer: `I cannot.\n\`\`\`\n${decline('no')}\n\`\`\`` }] }],
    ['a decline with no reason, asked again', { steps: [{ answer: decline('') }, { answer: decline(3) }, { answer: FORM_TEXT }] }],
    ['no object at all', { steps: [{ answer: 'prose' }, { answer: '[]' }, { answer: '"x"' }] }],
    ['a host that rejects', { steps: [{ reject: new Error('the network is down') }] }],
    ['a host that rejects after an answer', { steps: [{ answer: '{}' }, { reject: new Error('quota spent') }] }],
    ['a host that throws before it returns a promise', { steps: [{ throws: new Error('no key is set') }] }],
    ['an error with no message, named', { steps: [{ reject: Object.assign(new Error(''), { name: 'TimeoutError' }) }] }],
    ['an error whose message is blank', { steps: [{ reject: new TypeError('  ') }] }],
    ['a rejection with a string', { steps: [{ reject: 'offline' }] }],
    ['a rejection with a blank string', { steps: [{ reject: ' ' }] }],
    ['a rejection with nothing', { steps: [{ reject: undefined }] }],
    ['a rejection with an object of another realm', { steps: [{ reject: { message: 'elsewhere' } }] }],
    ['a rejection with an object with no prototype', { steps: [{ reject: Object.create(null) }] }],
    ["a host busy by formancy's error", { steps: [{ reject: new formancy.ModelBusyError('for the logs') }] }],
    ["a host busy by Report's error", { steps: [{ reject: new ModelBusyError() }] }],
    ['a host busy by an error that only has the name', { steps: [{ reject: { name: 'ModelBusyError' } }] }],
    ['a stop before the run', { steps: [{ answer: FORM_TEXT }], stopAt: 0 }],
    ['a stop while the first turn waits', { steps: [], stopAt: 1 }],
    ['a stop in the second turn', { steps: [{ answer: '{}' }], stopAt: 2 }],
    ['one attempt', { steps: [{ answer: 'no' }, { answer: FORM_TEXT }], attempts: 1 }],
    ['no attempts asked for', { steps: [{ answer: 'no' }, { answer: FORM_TEXT }], attempts: 0 }],
    ['five attempts', { steps: [{ answer: '1' }, { answer: '2' }, { answer: '3' }, { answer: '4' }, { answer: FORM_TEXT }], attempts: 5 }],
  ])('%s', async (_name, run) => {
    const { formancy: theirs, report: ours } = await both(run)
    expect(ours.ending).toStrictEqual(theirs.ending)
    expect(ours.seen).toEqual(theirs.seen)
    expect(ours.cancelled).toEqual(theirs.cancelled)
  })

  // The reader is not exported by formancy, so it is reached through the
  // run: each text, as one answer, ends both runs alike -- the same
  // document where there is one, the same decline and reason, the same
  // kind of problem otherwise.
  test.each(TEXTS.map((text) => [JSON.stringify(text.slice(0, 60)), text] as const))('reading the answer %s', async (_name, text) => {
    const { formancy: theirs, report: ours } = await both({ steps: [{ answer: text }], attempts: 1 })
    expect(ours.ending).toStrictEqual(theirs.ending)
  })
})

describe("each relay answers a paste alike, and each turn asks the other's", () => {
  /** A turn handed to a relay by the test, keeping what the relay asks to be told on a stop. */
  const handed = () => {
    const cancels: Array<() => void> = []
    return { turn: { onCancel: (cancel: () => void) => cancels.push(cancel) }, cancel: () => cancels.splice(0).forEach((cancel) => cancel()) }
  }
  const prompt: AuthoringPrompt = { kind: 'authoring', system: 'the briefing', user: 'the request', attempt: 1, limit: 3 }

  // A paste one relay sends and the other holds back would cost a Report
  // author an attempt -- a round trip by hand -- where a formancy author's
  // would wait, or the reverse; formancy's relay pre-checks with its own
  // readAnswer, so this is where Report's reader meets formancy's.
  test.each(TEXTS.map((text) => [JSON.stringify(text.slice(0, 60)), text] as const))('the paste %s', async (_name, text) => {
    const relays = [formancy.createRelay(), createRelay<ModelRequestKind>()] as const
    const turns = relays.map(() => handed())
    const answers = relays.map((relay, index) => relay.ask(prompt, turns[index]?.turn ?? handed().turn))

    const pasted = relays.map((relay) => relay.answer(text))
    expect(pasted[1]).toBe(pasted[0])
    expect(pasted[1] === 'no-object').toBe(readAnswer(text) === undefined)
    if (pasted[0] === 'no-object') expect(relays.map((relay) => relay.answer(text, { anyway: true }))).toEqual(['accepted', 'accepted'])
    expect(await Promise.all(answers)).toEqual([text, text])
    expect(relays.map((relay) => relay.answer(text))).toEqual(['nothing-waiting', 'nothing-waiting'])
  })

  // The turn on screen is what a host's model would have been sent: the
  // same prompt, the same text to copy and the same follow-up in both.
  test('a turn waiting is the prompt, its message and its follow-up alike, and a stop clears both', async () => {
    const relays = [formancy.createRelay(), createRelay<ModelRequestKind>()] as const
    const turns = relays.map(() => handed())
    const followed: AuthoringPrompt = { ...prompt, system: ' rules \n', user: '\nthe form\n', attempt: 2, followUp: 'fix this' }
    // Never answered: the stop below clears both turns, and their promises are left to nobody.
    for (const [index, relay] of relays.entries()) void relay.ask(followed, turns[index]?.turn ?? handed().turn)

    const [theirs, ours] = relays.map((relay) => relay.waiting())
    expect(ours).toEqual(theirs)
    expect(ours?.prompt).toBe(followed)
    expect(ours?.message).toBe(formancy.relayMessage(followed))

    const refused = relays.map((relay) => relay.ask(prompt, handed().turn).then(String, (error: unknown) => (error as Error).name))
    expect(await Promise.all(refused)).toEqual(['ModelBusyError', 'ModelBusyError'])
    for (const turn of turns) turn.cancel()
    expect(relays.map((relay) => relay.waiting())).toEqual([undefined, undefined])
    expect(relays.map((relay) => relay.answer('{}'))).toEqual(['nothing-waiting', 'nothing-waiting'])
  })

  // One protocol, not two alike: formancy's run, carried through Report's
  // relay and stopped by Report's stop, and Report's run carried through
  // formancy's relay and stopped by formancy's, each end as the other's
  // would.
  test("formancy's run asks Report's relay and Report's run asks formancy's, each answered and each stopped", async () => {
    const ours = createRelay<ModelRequestKind>()
    const theirs = formancy.createRelay()
    const authored = formancy.authorForm(ours.ask, 'a contact form')
    const asked = askChecked(theirs.ask, () => ({ kind: 'authoring', system: 'the briefing', user: 'the request' }), checkLikeFormancy)
    await vi.waitFor(() => expect([ours.waiting(), theirs.waiting()]).toEqual([expect.anything(), expect.anything()]))

    expect(ours.answer(`\`\`\`json\n${FORM_TEXT}\n\`\`\``)).toBe('accepted')
    expect(theirs.answer(FORM_TEXT)).toBe('accepted')
    expect(await authored).toEqual({ ok: true, document: FORM, attempts: 1 })
    expect(await asked).toEqual({ ok: true, value: FORM, attempts: 1 })

    const [reportStop, formancyStop] = [createStop(), formancy.createStop()]
    const stoppedThere = formancy.authorForm(ours.ask, 'a contact form', { stop: reportStop })
    const stoppedHere = askChecked(theirs.ask, () => ({ kind: 'authoring', system: 's', user: 'u' }), checkLikeFormancy, { stop: formancyStop })
    await vi.waitFor(() => expect([ours.waiting(), theirs.waiting()]).toEqual([expect.anything(), expect.anything()]))
    reportStop.stop()
    formancyStop.stop()

    expect([(await stoppedThere).ok, (await stoppedHere).ok]).toEqual([false, false])
    expect([await stoppedThere, await stoppedHere].map((result) => (result.ok ? 'answered' : result.ended))).toEqual(['stopped', 'stopped'])
    expect([ours.waiting(), theirs.waiting()]).toEqual([undefined, undefined])
  })
})

describe('the texts a host writes are the same bytes', () => {
  // A decline written otherwise by Report's host helper than by formancy's
  // would be read by one run as a decline and by the other as an answer.
  test('declinedAnswer gives the same text, and refuses a blank reason in the same words', () => {
    for (const reason of ['why', '  padded  ', 'with "quotes" and a\nnewline', 'ünïcödé', '{"declined": "nested"}'])
      expect([reason, declinedAnswer(reason)]).toEqual([reason, formancy.declinedAnswer(reason)])
    for (const blank of ['', ' ', '\n\t']) {
      const refusal = (write: (reason: string) => string): unknown => {
        try {
          return write(blank)
        } catch (error) {
          return (error as Error).message
        }
      }
      expect([blank, refusal(declinedAnswer)]).toEqual([blank, refusal(formancy.declinedAnswer)])
      expect(() => declinedAnswer(blank)).toThrow()
    }
  })

  // What a person copies into a chat is formancy's text exactly, so a
  // request carried for Report reads as one carried for formancy does.
  test('relayMessage gives the same text', () => {
    for (const [system, user] of [
      ['rules', 'the request'],
      [' rules \n', '\nthe form\n'],
      ['', ''],
      ['a\r\nb', 'c\td'],
    ] as const) {
      const prompt: AuthoringPrompt = { kind: 'translation', system, user, attempt: 1, limit: 3 }
      expect(relayMessage(prompt)).toBe(formancy.relayMessage(prompt))
    }
  })
})
