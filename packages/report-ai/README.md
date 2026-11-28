# @formancy/report-ai

Formancy Report's requests of a model, and the turn they run on. A model
is asked for one thing: **the words a report's language lacks**, and its
answer becomes one batch of report-core commands, every entry of which the
format and the compiler have accepted before a person sees it
([0085](../../docs/decisions/0085-a-model-is-asked-only-for-the-words-a-language-lacks-and-its-answer-is-one-batch-held-to-the-format-and-the-compiler-before-a-person-sees-it.md)).
report-builder-core holds it for a person to review word by word and
apply as one undo step
([0086](../../docs/decisions/0086-a-person-reviews-a-models-translation-word-by-word-in-either-builder-and-applies-what-they-accepted-as-one-undo-step.md)),
which no builder draws yet. The turn underneath -- ask, read the JSON object
the answer holds, ask again with the latest complaint, let a person stop
the run, let the model decline, and let a person carry the turn by hand --
is formancy's own, which `@formancy/builder-core` does not export and types
with formancy's three requests, held here in formancy's shapes and names
until formancy releases one other products may brief
([0083](../../docs/decisions/0083-the-models-turn-is-held-in-report-ai-in-formancys-shapes-until-formancy-releases-one-other-products-may-brief.md)).
No framework, no Node, no DOM and no network: ES2023's library and no
`@types/node`.

## Translate a language's missing words

The model is the host's, asked through the host's server, here
`myServer`: `askThrough` sends it the request's kind, its user part and
the digest of the briefing the page reads the answer against, never the
briefing itself, which the server writes from `modelBriefing` by the kind.

```ts
import { askThrough, proposeTranslation, translateMissing } from '@formancy/report-ai'
import type { TranslationProposal, TranslationResult } from '@formancy/report-ai'

const ask = askThrough(myServer) // complete sends { kind, user, briefing } to the host's server
const run: TranslationResult = await translateMissing(ask, session.document(), 'fr-CH')
if (!run.ok) throw new Error(`the run ended ${run.ended}`)
const proposal: TranslationProposal = proposeTranslation(session.document(), run.answer)
const batch = { command: 'batch', args: [proposal.rows.map((row) => row.step)] } as const
const applied = session.apply(batch, { expectedHash: proposal.expectedHash, label: 'Translate into French' })
```

- **Only what the language lacks is asked**: exactly what report-core's
  `languageDiagnostics` names `word-missing`, each under a key of the
  request's own (`w1`, `e1`), with up to three places it stands in, and an
  expression with the type it gives and the members it reads; beside them
  the language's words so far that the report still holds. At most
  `MAX_BATCH_COMMANDS` entries a turn, and no more than the language has
  room for under `MAX_WORDS`; the rest is `later`, and a list with no room
  left is named in `noRoom`, in the request and in the answer. `translationRequest` takes a report and a locale, so no data,
  parameter value, asset or font can reach it.
- **The payment part is never sent.** A word or an expression standing in
  it anywhere is `forPerson`, for a person to write, and none of the
  language's words so far that stand in it is sent either. That is this
  request's rule: report-mcp's translate prompt to an agent's own model
  lists the payment part's words with the rest, until it is changed to
  leave them for a person. Nor is any
  string report-spec's `NOT_WORDS` names but the ids and kinds a place is
  told by: no condition, no parameter's value, no dataset's label, no QR
  code's content, no e-invoice.
- **The answer is `{ into, words: { key: text }, expressions: { key:
  source } }`**, read back by key to the source the request held. Asked
  again, with that problem alone, are an answer that holds no object, one
  for another language or that names none, a member that is no object of
  strings, and a decline with no reason. A key nobody asked is dropped and
  listed; a text left blank is still missing.
- **`proposeTranslation` holds the answer before anything is shown**,
  against the report as it stands: an entry is kept only where its word is
  still missing, so a word a person translated meanwhile is never
  overwritten and a word whose text changed is dropped, and what the
  language has no room for is dropped too; each text is held to report-spec's
  `refusedCharacter`, an expression's escapes as CEL decodes them, and a
  word to its source's white space at either end, then the batch's report
  to the validator through `tryEdit`, then to `languageDiagnostics`, and an
  entry an error or a new diagnostic stands at is refused with that
  sentence, the rest kept. Its `rows` are one batch, and so is any subset of them,
  applied with `expectedHash`, which the session refuses as
  `stale-document` once the report moved; read again on the report as it
  stands, the same answer is a proposal again, with no new turn.
- **Bounds.** `MAX_MODEL_REQUEST_BYTES` bounds a turn's body,
  `{ kind, user, briefing }` as JSON, as `askThrough` hands it to
  `complete`: a request whose longest turn is past it is refused before
  anything is asked, and `askThrough` refuses a body past it, a prompt not
  briefed as report-ai briefs its kind, and a kind `REQUEST_KINDS` does
  not hold, before `complete` is called. A host that sends the object as
  JSON, as it is, sends a body no longer than the bound.
- **What a host's server owes.** It writes the system part from
  `modelBriefing` by the kind, reads none a page sent, and refuses a
  digest that is not `briefingDigest` of its own briefing. Nothing in this
  package holds a server to that.

The install gate runs the example's lines from the packed package
(`scripts/install-fixture/translation.ts`).

## Ask a model

A request can be the host's own too: what it is called, the briefing, the
request, and the check its answer is held to. The model is the host's: its
backend and its key, here `myBackend`.

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
  ending, a host's error included, and never rejects for anything the
  host's model does; a `build` or a `check` that throws rejects it.
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

Every name and shape of the turn is formancy 0.14.0's, its
`AuthoringPrompt` named `ModelPrompt` and generic over the kind, and
`src/turn/against-formancy.test.ts` holds them to that release. The install
gate runs the example's lines from the packed package
(`scripts/install-fixture/model-turn.ts`). It depends on `@formancy/spec`
at exactly 0.14.0, on report-spec and report-core, and on `@noble/hashes`
at exactly 2.4.0, for a briefing's digest and a request's bytes. The
package declares the source-available licence, in `LICENSE.md`.
