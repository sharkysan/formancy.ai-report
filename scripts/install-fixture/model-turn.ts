/*
 * The model's turn (report-ai, 0083), from the packed package under Node: a
 * scripted model asked through askChecked, answering with prose first and
 * the object in a fence next, so the run asks again with the latest
 * complaint and ends with the object on its second turn; a model that
 * declines, by declinedAnswer, ending its run on that turn; a stop pressed
 * while a turn waits; a turn carried through a relay by hand, a paste with
 * no object kept waiting and the fenced answer taken, and a second request
 * while it waits ended busy. REQUEST_KINDS is empty: Report asks a model for
 * nothing yet. The README's example is lines of this file
 * (scripts/readme-example.test.mjs). consume.ts runs it and prints what it
 * returns.
 */
import { askChecked, createStop } from '@formancy/report-ai'
import type { AskModel, Checkable, Verdict } from '@formancy/report-ai'
import { createRelay, declinedAnswer, ModelBusyError, readAnswer, relayMessage, REQUEST_KINDS } from '@formancy/report-ai'
import type { Asked, ModelPrompt, Relay, RelayAnswer, RequestKind } from '@formancy/report-ai'

/** The host's backend, scripted: what it was asked, and its replies in turn -- prose first, then the object in a fence. */
const backendAsked: string[] = []
const replies = ['Here is the object you asked for.', '```json\n{"title": "Rechnung"}\n```']
const myBackend = (system: string, user: string, signal: AbortSignal): Promise<string> => {
  backendAsked.push(`${system}\n\n${user}`)
  if (signal.aborted) return Promise.reject(new Error('aborted'))
  return Promise.resolve(replies[backendAsked.length - 1] ?? '')
}

export async function modelAsked(): Promise<string> {
  const kinds: readonly RequestKind[] = REQUEST_KINDS
  if (kinds.length !== 0) throw new Error(`report-ai asks a model for ${kinds.join(', ')}, and the start page says it asks for nothing`)

  const ask: AskModel = (prompt, turn) => {
    const controller = new AbortController()
    turn.onCancel(() => controller.abort())
    return myBackend(prompt.system, prompt.user, controller.signal)
  }
  const check = (answer: Checkable): Verdict<object, string> =>
    answer?.kind === 'object' ? { ok: true, value: answer.value } : { ok: false, problem: 'Answer with one JSON object.' }
  const build = (latest: string | undefined) => ({
    kind: 'example',
    system: 'the briefing',
    user: latest === undefined ? 'the request' : `the request\n\n${latest}`,
  })

  const stop = createStop() // a Stop button calls stop.stop()
  const asked = await askChecked(ask, build, check, { stop })
  if (!asked.ok) throw new Error(`the run ended ${asked.ended}: ${asked.reason ?? 'no reason'}`)
  if (asked.attempts !== 2 || JSON.stringify(asked.value) !== '{"title":"Rechnung"}') throw new Error(`the run ended with ${JSON.stringify(asked)}`)
  if (backendAsked[1] !== 'the briefing\n\nthe request\n\nAnswer with one JSON object.') throw new Error('the second turn did not carry the latest complaint')

  const declining: AskModel = () => Promise.resolve(declinedAnswer('the service refused it'))
  const declined: Asked<object, string> = await askChecked(declining, build, check)
  if (declined.ok || declined.ended !== 'declined' || declined.reason !== 'the service refused it') throw new Error('a decline did not end the run as one')
  if (readAnswer(declinedAnswer('why'))?.kind !== 'declined') throw new Error('declinedAnswer is not read as a decline')

  const pressed = createStop()
  const waiting = askChecked(() => new Promise<string>(() => undefined), build, check, { stop: pressed })
  pressed.stop()
  const stopped = await waiting
  if (stopped.ok || stopped.ended !== 'stopped') throw new Error('a stop did not end the run that waited')

  const relay: Relay = createRelay()
  const carried = askChecked(relay.ask, build, check)
  const prompt: ModelPrompt | undefined = relay.waiting()?.prompt
  if (prompt === undefined || relay.waiting()?.message !== relayMessage(prompt)) throw new Error('the relay holds no turn to carry')
  const busy = await askChecked(relay.ask, build, check)
  if (busy.ok || busy.ended !== 'busy') throw new Error('a second request while one waits was not refused busy')
  const pasted: RelayAnswer[] = [relay.answer('Here you are.'), relay.answer('```json\n{"title": "Facture"}\n```'), relay.answer('{}')]
  if (pasted.join() !== 'no-object,accepted,nothing-waiting') throw new Error(`the relay answered the pastes ${pasted.join()}`)
  const relayed = await carried
  if (!relayed.ok || relayed.attempts !== 1) throw new Error('the relayed answer did not end the run')

  const refusing: AskModel = () => Promise.reject(new ModelBusyError())
  const refused = await askChecked(refusing, build, check)
  if (refused.ok || refused.ended !== 'busy' || 'reason' in refused) throw new Error('a ModelBusyError did not end the run busy')

  return 'report-ai asked a scripted model through askChecked, which asked again with the latest complaint and took the fenced object on its second turn, ended a declined run on its turn and a stopped one at once, carried a turn through a relay, a paste with no object kept waiting and a second request refused busy, and asks for no kind yet'
}
