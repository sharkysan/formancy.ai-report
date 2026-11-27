import { readFileSync } from 'node:fs'
import { SALES_REPORT } from '@formancy/report-corpus'
import { describe, expect, test } from 'vitest'
import { askThrough } from './ask-through.js'
import type { Complete, ModelCompletion, ModelRequest } from './ask-through.js'
import { briefingDigest, modelBriefing } from './kinds.js'
import { MAX_MODEL_REQUEST_BYTES } from './limits.js'
import { translateMissing } from './translation/reader.js'
import { withLanguage } from './translation/test-support.js'
import { createStop } from './turn/ask.js'
import type { AskTurn, ModelPrompt } from './turn/ask.js'

/**
 * A model asked through a host's server, by the host's own `complete`
 * (0085): what leaves for the server, what is refused before anything
 * does, and how the server's answer ends a run. No server and no network:
 * a recording `complete` answers.
 */

const { report, locale } = withLanguage(SALES_REPORT.report)

/** A `complete` that records each request and answers `completion` to it. */
function recording(completion: (request: ModelRequest, turn: AskTurn) => Promise<ModelCompletion>): {
  readonly complete: Complete
  readonly sent: ModelRequest[]
} {
  const sent: ModelRequest[] = []
  return {
    sent,
    complete: (request, turn) => {
      sent.push(request)
      return completion(request, turn)
    },
  }
}

const idle: AskTurn = { onCancel: () => undefined }

/** A prompt as a run builds one, with what a case changes in it. */
const prompt = (overrides: Partial<ModelPrompt<'translation'>> = {}): ModelPrompt<'translation'> => ({
  kind: 'translation',
  system: modelBriefing('translation'),
  user: '{}',
  attempt: 1,
  limit: 3,
  ...overrides,
})

const whole = readFileSync(new URL('../fixtures/answers/whole.txt', import.meta.url), 'utf8')

describe("what leaves for a host's server", () => {
  // A briefing sent by the page is one a server would have to trust, and a
  // server that read it would be a way to ask its operator's model
  // anything at all (formancy.ai 0165): the page names the briefing by its
  // kind and its digest, and the server writes it.
  test("sends the kind, the user part and the briefing's digest, and never the briefing", async () => {
    const { complete, sent } = recording(() => Promise.resolve({ text: 'answered' }))
    expect(await askThrough(complete)(prompt({ user: 'the request' }), idle)).toBe('answered')
    expect(sent).toEqual([{ kind: 'translation', user: 'the request', briefing: briefingDigest('translation') }])
  })

  // A prompt briefed otherwise -- built by hand, or by another version of
  // the page -- would be answered under the server's briefing and read by
  // a reader written for another: refused before anything is sent.
  test.each([
    [
      "a briefing that is not its kind's",
      prompt({ system: `${modelBriefing('translation')} ` }),
      /^this prompt is not briefed as report-ai briefs a translation request/,
    ],
    [
      'a kind Report does not ask',
      { ...prompt(), kind: 'constructor' } as unknown as ModelPrompt<'translation'>,
      /^this prompt names no request Formancy Report makes/,
    ],
    [
      'a user part past the bound',
      prompt({ user: 'a'.repeat(MAX_MODEL_REQUEST_BYTES + 1) }),
      /^this request is 262145 bytes, past the 262144 a request may have/,
    ],
  ])('refuses %s before complete is called', async (_name, refused, why) => {
    const { complete, sent } = recording(() => Promise.resolve({ text: 'answered' }))
    await expect(askThrough(complete)(refused, idle)).rejects.toThrow(why)
    expect(sent).toEqual([])
  })

  // The bound is a request's like any other, and a server bounded by it
  // takes a body at it.
  test('sends a user part at the bound', async () => {
    const { complete, sent } = recording(() => Promise.resolve({ text: 'answered' }))
    await askThrough(complete)(prompt({ user: 'é'.repeat(MAX_MODEL_REQUEST_BYTES / 2) }), idle)
    expect(sent).toHaveLength(1)
  })
})

describe("how a host's server's answer ends a run", () => {
  // The model's text is read as any host's is.
  test('reads a text as the answer', async () => {
    const run = await translateMissing(askThrough(recording(() => Promise.resolve({ text: whole })).complete), report, locale)
    expect(run.ok && run.answer.written).toHaveLength(29)
  })

  // A model's service that refused the request itself has said what a
  // decline says; asked again, it would refuse again, each turn paid for
  // (formancy.ai 0158).
  test("ends the run on the server's decline, on its turn, with its reason", async () => {
    const { complete, sent } = recording(() => Promise.resolve({ declined: 'the provider refused this request' }))
    const run = await translateMissing(askThrough(complete), report, locale)
    expect(run).toMatchObject({ ok: false, ended: 'declined', attempts: 1, reason: 'the provider refused this request' })
    expect(sent).toHaveLength(1)
  })

  // A server that could not ask its model is not a model that answered
  // wrongly: the run ends unreachable with the host's words, and asks
  // nothing again (formancy.ai 0157).
  test("ends the run unreachable on the host's error, and on a completion of neither shape", async () => {
    const failing = await translateMissing(askThrough(recording(() => Promise.reject(new Error('the model is not configured'))).complete), report, locale)
    expect(failing).toMatchObject({ ok: false, ended: 'unreachable', attempts: 1, reason: 'the model is not configured' })
    const shapeless = await translateMissing(askThrough(recording(() => Promise.resolve({} as ModelCompletion)).complete), report, locale)
    expect(shapeless).toMatchObject({ ok: false, ended: 'unreachable', attempts: 1, reason: "the host's complete answered neither a text nor a decline" })
  })

  // A person who pressed Stop has walked away from the request; the host
  // is told, so that it abandons the request it sent rather than pay for
  // an answer nobody reads.
  test('tells the host of a stop, so that it abandons the request', async () => {
    const stop = createStop()
    let abandoned = false
    const { complete } = recording(
      (_request, turn) =>
        new Promise<ModelCompletion>(() => {
          turn.onCancel(() => {
            abandoned = true
          })
          stop.stop()
        }),
    )
    const run = await translateMissing(askThrough(complete), report, locale, { stop })
    expect(run).toMatchObject({ ok: false, ended: 'stopped', attempts: 1 })
    expect(abandoned).toBe(true)
  })
})
