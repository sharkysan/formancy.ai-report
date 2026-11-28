import { can } from './actions.js'
import type { RolePolicy } from './actions.js'
import { answer, refuse } from './answer.js'
import type { Answer, RefusalAnswer } from './answer.js'
import type { ModelAsked, ModelOutcome } from './audit.js'
import type { ReportIdentity } from './identity.js'
import { REFUSALS } from './wire.js'
import type { ModelCompletion, ServerModel } from './wire.js'

/**
 * The model an embedder gives Report's server, asked on an author's behalf
 * (0084).
 *
 * A builder asks a model through an `AskModel` its host gives it, and a key
 * in a browser is a key anybody who opens the page reads (formancy.ai
 * 0165). So a host that runs Report's server keeps its model here, and the
 * page's `AskModel` is report-ai's `askThrough` over report-client's
 * `completeModel`, a request to this server.
 *
 * **The server writes the briefing.** The page names the kind of request,
 * one of report-ai's, and sends the user part and the digest of the
 * briefing it reads the answer against (0085). The system part is the one
 * the table the server was handed holds for that kind; one in the request
 * is never read; a digest that is not the table's for the kind is refused
 * before anything is asked. So every request the operator's key pays for is
 * asked under one of Report's briefings, by a page of the server's own
 * release. That narrows the endpoint; it does not close it: the user part
 * is still the author's, and nothing here stops it asking the model for
 * something else under Report's briefing. The capacity, the limit, the
 * size, the time and the trail bound and record what that costs.
 *
 * The port's shapes -- the prompt, the cancellation, the completion and the
 * completer -- are formancy's server-core's (formancy.ai 0165), member for
 * member, so that a completer formancy's adapters make is one this server
 * takes. No Node and no timer here: what ends a request early is the
 * route's to hear and say, through `ModelEnding`.
 */

/** Everything a completion is asked: one system part and one user part, no conversation. */
export interface CompletionPrompt {
  readonly system: string
  readonly user: string
}

/**
 * Told when the request is abandoned -- its asker gone, or the server's time
 * for an answer up -- so that it is abandoned at the provider rather than
 * paid for to the end. A callback rather than an `AbortSignal`, which this
 * package's types do not have; an adapter wires it in one line:
 * `const c = new AbortController(); cancellation.onCancel(() => c.abort())`.
 */
export interface Cancellation {
  /** Called at most once: when the request is abandoned, or at once if it already has been. */
  onCancel(listener: () => void): void
}

/**
 * What one completion came to; only the first is an answer.
 *
 * - `refused`: the provider declined in its response rather than in its
 *   text. `reason` is for the person, and ends their run as a decline
 *   (formancy.ai 0158).
 * - `truncated`: the answer reached the output limit. Cut off, it is not an
 *   answer, and is never handed over as half a batch.
 * - `unavailable`: not reached, or it answered with an error. `status` is
 *   the provider's HTTP status when it gave one. `cause` is formancy's, for
 *   an adapter's own use: this server writes it nowhere, neither in an
 *   answer nor in its log, since a provider's words can name the account.
 * - `cancelled`: the request was abandoned after its cancellation was told.
 */
export type Completion =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly failure: 'refused'; readonly reason: string }
  | { readonly ok: false; readonly failure: 'truncated' }
  | { readonly ok: false; readonly failure: 'unavailable'; readonly status?: number; readonly cause: string }
  | { readonly ok: false; readonly failure: 'cancelled' }

/**
 * A model, asked to complete one prompt: the embedder's, over its
 * provider's SDK. **It does not throw for a provider's failure**; it says
 * which failure. One that throws all the same, or answers what is no
 * completion, is a model that could not be asked.
 */
export interface Completer {
  complete(prompt: CompletionPrompt, cancellation: Cancellation): Promise<Completion>
}

/** The model an embedder gave the server: its provider and its model, by the names `GET /v1/model` says to an author, and the completer that asks it. */
export interface DeploymentModel {
  readonly provider: string
  readonly model: string
  readonly completer: Completer
}

/** One kind's briefing: the system part it is asked under, and the digest of that part a page names it by. */
export interface ModelBriefing {
  readonly system: string
  readonly digest: string
}

/**
 * The briefings the server asks under, by kind: report-server builds it
 * once, at start, from report-ai's `modelBriefing` and `briefingDigest` over
 * its `REQUEST_KINDS`, and hands it to every request. Handed in, rather
 * than imported, so that this package depends on report-spec alone. A kind
 * is one the table holds as its own.
 */
export type ModelBriefings = { readonly [kind: string]: ModelBriefing }

/** Who asks, under which role policy, of which model -- or none -- under which briefings: what both use cases are given. */
export interface ModelAsking {
  readonly identity: ReportIdentity
  readonly roles: RolePolicy
  readonly model: DeploymentModel | undefined
  readonly briefings: ModelBriefings
}

/** Why a request ended before its completer answered: its asker gone, or the server's time for an answer up. */
export type ModelEnd = 'gone' | 'timed-out'

/**
 * How the route says a request ended early: it calls a listener at most
 * once, with why, and at once where the request has already ended -- a
 * browser gone while its token was checked.
 */
export interface ModelEnding {
  onEnd(listener: (end: ModelEnd) => void): void
}

/** What `askModel` answers: the answer, with its status, and what the trail says of it, for a request that passed every check. */
export interface ModelAnswered {
  readonly answered: Answer<ModelCompletion> | RefusalAnswer
  readonly asked?: ModelAsked
}

/** `GET /v1/model`: whether there is a model, which, and the digest of each kind's briefing. */
export function readModel(asking: ModelAsking): Answer<ServerModel> | RefusalAnswer {
  const { identity, roles, model, briefings } = asking
  if (!can(identity, 'model.read', roles)) return refuse(403, REFUSALS.forbidden)
  const digests = Object.fromEntries(Object.entries(briefings).map(([kind, briefing]) => [kind, briefing.digest]))
  return answer(
    200,
    model === undefined ? { provider: null, model: null, briefings: digests } : { provider: model.provider, model: model.model, briefings: digests },
  )
}

/** A member of `body` read as its own, or undefined: an inherited one is no member a request sent. */
function memberOf(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null && !Array.isArray(body) && Object.hasOwn(body, name) ? (body as Record<string, unknown>)[name] : undefined
}

/**
 * `POST /v1/model/complete`: asks the model `body`'s request under the
 * briefing the table holds for its kind. The checks run in this order,
 * each refusing what the ones before it let through, and nothing is asked
 * unless all pass: the capacity; a model to ask; the kind, one the table
 * holds as its own; a user part with something in it; and the digest of
 * the briefing the page reads against, the table's for the kind. Of the
 * body nothing else is read, a `system` above all.
 *
 * Then the completer, until it answers or `ending` ends the request. An
 * ending tells the completer to cancel and is answered at once, whether
 * or not the completer listens: the asker gone, 499 `model-cancelled`,
 * which nobody reads and the trail records; the time up, 504
 * `model-timed-out`. Where the request had already ended, nothing is
 * asked. What the completer answers is answered: its text, a provider's
 * refusal as a decline, a truncated answer and a provider that could not
 * be asked as 502 each. Resolves on every ending: a completer that throws,
 * answers what is no completion or says it was cancelled when nothing
 * cancelled it broke its contract, and is still a model that could not be
 * asked.
 */
export async function askModel(asking: ModelAsking, body: unknown, ending: ModelEnding): Promise<ModelAnswered> {
  const { identity, roles, model, briefings } = asking
  if (!can(identity, 'model.ask', roles)) return { answered: refuse(403, REFUSALS.forbidden) }
  if (model === undefined) return { answered: refuse(404, REFUSALS['model-not-configured']) }
  const kind = memberOf(body, 'kind')
  // By Object.hasOwn: `constructor`, `toString` and `__proto__` are on every object, and no kind of the table's.
  if (typeof kind !== 'string' || !Object.hasOwn(briefings, kind)) return { answered: refuse(400, REFUSALS['unknown-request-kind']) }
  const user = memberOf(body, 'user')
  if (typeof user !== 'string' || user.trim() === '') return { answered: refuse(400, REFUSALS['request-empty']) }
  const briefing = briefings[kind] as ModelBriefing
  if (memberOf(body, 'briefing') !== briefing.digest) return { answered: refuse(409, REFUSALS['briefing-differs']) }

  const ended = await completed(model.completer, { system: briefing.system, user }, ending)
  const outcome: ModelOutcome = ended.ok ? 'answered' : ended.failure
  const asked: ModelAsked = {
    kind,
    characters: user.length,
    outcome,
    ...(!ended.ok && ended.failure === 'unavailable' && ended.status !== undefined ? { status: ended.status } : {}),
  }
  return { answered: answeredWith(ended), asked }
}

/** What a request came to once the server stopped waiting: an answer, a failure the completer said, or an ending the route said. */
type Ended =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly failure: 'declined'; readonly reason: string }
  | { readonly ok: false; readonly failure: 'truncated' | 'cancelled' | 'timed-out' }
  | { readonly ok: false; readonly failure: 'unavailable'; readonly status?: number }

const ENDED: { readonly [end in ModelEnd]: Ended } = {
  gone: { ok: false, failure: 'cancelled' },
  'timed-out': { ok: false, failure: 'timed-out' },
}

/**
 * `prompt` asked of `completer` until it answers or `ending` ends it. An
 * ending heard first is the outcome, whatever the completer answers to the
 * cancellation it is then told of: the wait for it is stopped before the
 * completer is told, so no answer the cancellation brings can come first.
 * An answer that came first is the outcome, and the completer is told of
 * no ending after it.
 */
async function completed(completer: Completer, prompt: CompletionPrompt, ending: ModelEnding): Promise<Ended> {
  // A holder, not a variable, so that what the listener writes is read
  // again after each wait.
  const state: { end?: ModelEnd; answered?: true } = {}
  const cancelled: (() => void)[] = []
  // Assigned by the executor, which runs before the constructor returns.
  let stop!: (end: ModelEnd) => void
  const stopped = new Promise<{ readonly end: ModelEnd }>((resolve) => {
    stop = (end) => resolve({ end })
  })
  ending.onEnd((end) => {
    if (state.end !== undefined || state.answered !== undefined) return
    state.end = end
    stop(end)
    for (const listener of cancelled.splice(0)) listener()
  })
  // Ended before it was asked -- a browser gone while its token was checked: nothing leaves.
  if (state.end !== undefined) return ENDED[state.end]
  const cancellation: Cancellation = {
    onCancel(listener) {
      if (state.end === undefined) cancelled.push(listener)
      else listener()
    },
  }
  const first = await Promise.race([asked(completer, prompt, cancellation).then((completion) => ({ completion })), stopped])
  if ('end' in first) return ENDED[first.end]
  state.answered = true
  return completionOf(first.completion)
}

/** The completer's answer, or undefined where it threw: never a rejection. */
async function asked(completer: Completer, prompt: CompletionPrompt, cancellation: Cancellation): Promise<unknown> {
  try {
    return await completer.complete(prompt, cancellation)
  } catch {
    // Its words are the provider's or the adapter's, and go nowhere.
    return undefined
  }
}

const UNAVAILABLE: Ended = { ok: false, failure: 'unavailable' }

/** A completer's answer, read by its shape rather than trusted to it: anything that is no completion, an uncancelled `cancelled` among it, is unavailable. */
function completionOf(completion: unknown): Ended {
  if (typeof completion !== 'object' || completion === null) return UNAVAILABLE
  const { ok, text, failure, reason, status } = completion as Record<string, unknown>
  if (ok === true) return typeof text === 'string' ? { ok: true, text } : UNAVAILABLE
  if (failure === 'refused') return typeof reason === 'string' ? { ok: false, failure: 'declined', reason } : UNAVAILABLE
  if (failure === 'truncated') return { ok: false, failure: 'truncated' }
  if (failure === 'unavailable') return Number.isSafeInteger(status) ? { ok: false, failure: 'unavailable', status: status as number } : UNAVAILABLE
  return UNAVAILABLE
}

/** An ending as the answer the route sends: a status and a body, each a refusal of `REFUSALS` but for an answer and a decline. */
function answeredWith(ended: Ended): Answer<ModelCompletion> | RefusalAnswer {
  if (ended.ok) return answer(200, { text: ended.text })
  switch (ended.failure) {
    case 'declined':
      return answer(200, { declined: ended.reason })
    case 'truncated':
      return refuse(502, REFUSALS['model-truncated'])
    case 'unavailable':
      return refuse(502, REFUSALS['model-unavailable'])
    case 'cancelled':
      // Nobody is there to read it; the trail records it under this code.
      return refuse(499, REFUSALS['model-cancelled'])
    case 'timed-out':
      return refuse(504, REFUSALS['model-timed-out'])
  }
}
