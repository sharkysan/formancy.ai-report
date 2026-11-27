# @formancy/report-ai

Formancy Report's turn with a model: ask, read the JSON object the answer
holds, ask again with the latest complaint, let a person stop the run, let
the model decline, and let a person carry the turn by hand. It is
formancy's own turn, which `@formancy/builder-core` does not export and
types with formancy's three requests, held here in formancy's shapes and
names until formancy releases one other products may brief
([0083](../../docs/decisions/0083-the-models-turn-is-held-in-report-ai-in-formancys-shapes-until-formancy-releases-one-other-products-may-brief.md)).
**Report asks a model for nothing yet**: `REQUEST_KINDS` is empty. No
framework, no Node, no DOM and no network: ES2023's library and no
`@types/node`.

## Ask a model

The model is the host's: its backend and its key, here `myBackend`. A
request is the host's too: what it is called, the briefing, the request,
and the check its answer is held to.

```ts
import { askChecked, createStop } from '@formancy/report-ai'
import type { AskModel, Checkable, Verdict } from '@formancy/report-ai'

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
```

- **A run ends one of six ways**, and only the first is a success: an
  answer passed; every attempt was used, three by default; the person
  stopped it; the host could not ask its model, its error's words the
  reason; the model was answering another request (`ModelBusyError`); or
  the model declined, `{"declined": "<why>"}` by `@formancy/spec`'s
  `DECLINE_KEY`, which ends the run on its turn. It resolves on every
  ending and never rejects.
- **Only the latest complaint** is handed to `build`; a prompt says which
  turn it is, `attempt`, of how many, `limit`.
- **A stop ends the run at once**, whether or not the host listens to
  `turn.onCancel`, and an answer that arrives after it is never held.
- **`readAnswer`** finds the object in a code fence, in the text, or
  between the outermost braces, and nothing looser; `declinedAnswer(reason)`
  is the text a host answers with when its model's service refuses a
  request.
- **`createRelay()`** is an `AskModel` a person carries: `waiting()` holds
  the turn and `relayMessage(prompt)` the text to copy, and `answer(text)`
  takes the paste, keeping the turn waiting where it holds no object unless
  sent `{ anyway: true }`. One turn at a time; a stop clears it.

Every name and shape is formancy 0.14.0's, its `AuthoringPrompt` named
`ModelPrompt` and generic over the kind, and
`src/turn/against-formancy.test.ts` holds them to that release. The install
gate runs the example's lines from the packed package
(`scripts/install-fixture/model-turn.ts`). It depends on `@formancy/spec`
at exactly 0.14.0. The package declares the source-available licence, in
`LICENSE.md`.
