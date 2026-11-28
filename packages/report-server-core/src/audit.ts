import type { Operation, RefusalCode } from './wire.js'

/**
 * One operational audit event per request a route of the API answered
 * (0046, after formancy.ai-data 0023): what was asked, how it ended, and by
 * whom -- the whom by a keyed hash, or not at all.
 *
 * **Never a value.** No token, no claim, no body, no path as it was sent:
 * the trail is written where the server's log goes, and read by whoever
 * runs the collector. A tenant and a subject are claims' values, a person's
 * identifier at the host among them, so the event names each by
 * HMAC-SHA-256 under the operator's audit key, which lets two events about
 * one person be told to be one person's, and lets whoever holds the key
 * check whether an event is a given person's. Without a key both are
 * `null`: nothing, rather than a reference that only looks redacted.
 *
 * It is operational, not evidence: written after the answer, by the same
 * process, to a sink that may lose it (formancy.ai-data 0023's limits).
 */
export interface AuditEvent {
  /** When the answer was decided, as an ISO instant. */
  readonly at: string
  /** The route that answered, by the name `ROUTES` gives it. */
  readonly operation: Operation
  readonly status: number
  /** `ok` below 400; otherwise the refusal's code: every answer at 400 or above is one of `REFUSALS`. */
  readonly outcome: 'ok' | RefusalCode
  /** Whether the request carried a token the server verified, with its tenant. */
  readonly identified: boolean
  /** The tenant, by keyed hash: `null` without an audit key, or for a request with no verified identity. */
  readonly tenant: string | null
  /** The subject within its tenant, by keyed hash: `null` likewise. */
  readonly actor: string | null
  /**
   * For a request to the model that passed every check, so one the
   * operator's key was spent on or would have been but for its asker
   * leaving first: how much was asked and how it ended (0084). Absent for
   * every other request, a model's refused before it was asked among them.
   */
  readonly model?: ModelAsked
}

/**
 * How a request to the model ended: an answer, the provider's decline, an
 * answer cut off at its output limit, a provider that could not be asked
 * -- a completer that broke its contract among them -- the asker gone, or
 * the server's time for an answer up.
 */
export type ModelOutcome = 'answered' | 'declined' | 'truncated' | 'unavailable' | 'cancelled' | 'timed-out'

/**
 * What the trail says of a request to the model, and all it says (0084,
 * after formancy.ai 0165's `model.asked`): never the text that was sent,
 * the model's answer, or what the provider said of an error, which can
 * name the operator's account (formancy's SAFETY-ANALYSIS C3).
 */
export interface ModelAsked {
  /** The kind, as the server's briefing table names it: one of the server's own words, not the request's. */
  readonly kind: string
  /** The user part's length in UTF-16 code units, as JavaScript counts a string: how much was asked at the operator's cost. */
  readonly characters: number
  readonly outcome: ModelOutcome
  /** The provider's HTTP status, where it could not be asked and gave one: what an operator has to go on. */
  readonly status?: number
}

/**
 * Where events go: a port. The server's own sink writes one structured log
 * line per event; a deployment that needs a durable trail supplies its own.
 * A sink that throws or rejects does not fail the request, whose answer has
 * been decided by then; the server logs that it could not write the event.
 */
export type AuditSink = (event: AuditEvent) => void | Promise<void>
