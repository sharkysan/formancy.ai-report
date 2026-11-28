import { briefingDigest, isRequestKind, modelBriefing } from './kinds.js'
import type { RequestKind } from './kinds.js'
import { MAX_MODEL_REQUEST_BYTES, requestBytes } from './limits.js'
import { declinedAnswer } from './turn/ask.js'
import type { AskModel, AskTurn } from './turn/ask.js'

/**
 * A model asked through a host's server, which holds the key and writes the
 * briefing itself (0085, formancy.ai 0165).
 *
 * The host gives `complete`: it sends one request -- its kind, its user part
 * and the digest of the briefing the page reads the answer against -- to
 * wherever its model is, and resolves with what came back. The briefing
 * itself never travels. What the host's server does with it is the host's
 * to build, and owed: it writes the system part from `modelBriefing` by the
 * kind, reads no system part a page sent, and refuses a digest that is not
 * its own briefing's, so that a page and a server of different versions
 * refuse rather than brief a model one way and read its answer another.
 * Nothing here holds a server to that; Report's own server's route is a
 * later record's (0084, to come). Nothing here reaches the network, reads a
 * setting or knows a provider; the host's `complete` does all three.
 */

/** What a page sends a host's server: never the briefing, only which one, by its kind and its digest. */
export interface ModelRequest {
  readonly kind: RequestKind
  readonly user: string
  /** `briefingDigest(kind)`: the briefing the page reads the answer against. */
  readonly briefing: string
}

/** What a host's server answered: the model's text, or the reason the model's service refused the request itself. */
export type ModelCompletion = { readonly text: string } | { readonly declined: string }

/**
 * The host's way to its model: one request out, its completion back. It
 * rejects for whatever kept the model from answering -- a server's refusal,
 * the network -- and the run ends `unreachable` with the error's words. It
 * is told a turn was stopped through `turn.onCancel`, and abandons its
 * request there.
 */
export type Complete = (request: ModelRequest, turn: AskTurn) => Promise<ModelCompletion>

/**
 * An `AskModel` over `complete`. A prompt is refused before `complete` is
 * called when its kind is none of `REQUEST_KINDS`, when its system part is
 * not report-ai's briefing for that kind -- a prompt built by hand, or by
 * another version of the page -- and when its body, the request as JSON
 * (`requestBytes`), is past `MAX_MODEL_REQUEST_BYTES`, the bound a host's
 * server can read a body under. A server's decline is handed back as a
 * decline, which ends the run on its turn (formancy.ai 0158); one with no
 * reason is no decline, and ends the run as an answer of neither shape.
 */
export function askThrough(complete: Complete): AskModel<RequestKind> {
  return async (prompt, turn) => {
    const { kind, system, user } = prompt
    if (!isRequestKind(kind)) throw new Error('this prompt names no request Formancy Report makes of a model, and is not sent')
    if (system !== modelBriefing(kind)) throw new Error(`this prompt is not briefed as report-ai briefs a ${kind} request, and is not sent`)
    const request: ModelRequest = { kind, user, briefing: briefingDigest(kind) }
    const bytes = requestBytes(request)
    if (bytes > MAX_MODEL_REQUEST_BYTES)
      throw new Error(`this request is ${String(bytes)} bytes as JSON, past the ${String(MAX_MODEL_REQUEST_BYTES)} a request may have, and is not sent`)
    const completion: unknown = await complete(request, turn)
    if (typeof completion === 'object' && completion !== null) {
      const { text, declined } = completion as { readonly text?: unknown; readonly declined?: unknown }
      if (typeof text === 'string') return text
      if (typeof declined === 'string' && declined.trim() !== '') return declinedAnswer(declined)
      if (typeof declined === 'string') throw new Error("the host's server declined the request and gave no reason to show the person who asked")
    }
    throw new Error("the host's complete answered neither a text nor a decline")
  }
}
