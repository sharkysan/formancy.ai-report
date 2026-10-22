import type { Action, Capacity } from './actions.js'

/**
 * What a client compiles against, as Data's client compiles against
 * data-core's wire types: the API's version line, the routes the server
 * answers, what each answers and how it refuses.
 */

/**
 * The API's version line (0046, extending 0004): every route a person's
 * token reaches is under it. A shape a client could not read as before is a
 * route under `/v2` beside it, never `/v1` changed. `/health` is outside it:
 * it is no person's request, and an orchestrator's probe outlives versions.
 */
export const API_PREFIX = '/v1'

/**
 * Every route the API answers, `METHOD path`, with the name its audit event
 * gives it. The server stops at start on an API route this table does not
 * hold, and its suite fails on an entry here that no route answers, so the
 * two are one list; nothing else is answered but `/health`.
 */
export const ROUTES = Object.freeze({
  'GET /v1/whoami': 'whoami',
} as const)

export type Route = keyof typeof ROUTES
export type Operation = (typeof ROUTES)[Route]

/** `GET /health`: the process answers. Nothing about who asks, and nothing about any tenant. */
export interface Health {
  readonly status: 'ok'
}

/**
 * `GET /v1/whoami`: who the server takes the token's holder to be, and what
 * the actions table gives them under the operator's role policy -- so a
 * wrong issuer, audience, tenant claim or role mapping shows before anything
 * depends on it.
 */
export interface WhoAmI {
  readonly subject: string
  readonly tenant: string
  readonly roles: readonly string[]
  readonly capacities: readonly Capacity[]
  readonly actions: readonly Action[]
}

const refusal = <Code extends string>(code: Code, message: string) => Object.freeze({ code, message })

/**
 * Every refusal the server gives: a stable code a client branches on, and a
 * fixed sentence. None quotes anything the request carried -- not a path,
 * not a header, not a token or a claim -- so a refusal can be logged and
 * shown as it is. Every bad token is the one `unauthenticated`, whatever was
 * wrong with it: which check failed is the server's log's to say, by the
 * verifier's reason and never the token. A request Node's parser cannot
 * read -- a malformed request line or header, a header block past its
 * limit, headers sent too slowly -- is `bad-request` too, with its own
 * status. The one answer outside this table is Fastify's 503 to a request
 * that arrives while the server closes, which quotes nothing either.
 */
export const REFUSALS = Object.freeze({
  unauthenticated: refusal('unauthenticated', 'A valid host token is required.'),
  'not-found': refusal('not-found', 'Nothing answers this request.'),
  'rate-limited': refusal('rate-limited', 'Too many requests came from this address; wait a minute and ask again.'),
  'cross-origin-refused': refusal('cross-origin-refused', 'Across origins this server answers only its API, from an origin its operator lists, and this request is not one of those, so it was refused before any work.'),
  'bad-request': refusal('bad-request', 'The request could not be read.'),
  'path-not-plain': refusal(
    'path-not-plain',
    'This path holds an escape, an empty or a dot segment, or a character a path does not carry as itself. No route here is written that way, and a proxy in front of this server may read such a path otherwise, so it was not routed.',
  ),
  internal: refusal('internal', 'The server could not answer this request.'),
})

export type RefusalCode = keyof typeof REFUSALS

export interface Refusal {
  readonly code: RefusalCode
  readonly message: string
}

/**
 * The request headers a page on an origin the operator lists may send: the
 * token. Every route reads that and nothing else a page sets.
 */
export const CROSS_ORIGIN_REQUEST_HEADERS = Object.freeze(['authorization'] as const)
