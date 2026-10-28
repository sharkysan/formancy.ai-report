import rateLimit, { normalizeIP } from '@fastify/rate-limit'
import { actionsOf, capacitiesOf, CAPACITIES, REFUSALS } from '@formancy/report-server-core'
import type { ReportIdentity, RolePolicy, TemplateStore, WhoAmI } from '@formancy/report-server-core'
import Fastify from 'fastify'
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { AUDIT_KEY_MIN_BYTES, auditReference, auditRequests, shortAuditKey } from './audit.js'
import type { AuditOptions } from './audit.js'
import { answerClientError } from './client-errors.js'
import { crossOrigin, originsProblem } from './cors.js'
import { registerDraftRoutes } from './drafts.js'
import { StoredRecordError } from './file-store.js'
import type { ReportVerifier } from './identity.js'
import { plainPath } from './paths.js'
import { clientAddress, trustedProxiesProblem } from './proxies.js'
import { DEFAULT_RATE_LIMIT, rateLimitProblem } from './rate-limit.js'
import type { RateLimit } from './rate-limit.js'
import { closingUnread } from './unread.js'

export interface ReportServerOptions {
  /**
   * The host's token to who is asking: `createReportVerifier`'s, which
   * verifies with Formancy Data's verifier and requires the tenant claim
   * (0046, 0047). Nothing else a request carries is read for identity.
   */
  verifyIdentity: ReportVerifier
  /** Which of the host's roles hold each capacity of the actions table: the operator's settings. */
  roles: RolePolicy
  /**
   * Where a tenant's drafts and images are kept (0049): the store
   * `openFileTemplateStore` answers, opened by the caller and never here,
   * so that a root that does not open is found at start, by whoever knows
   * where the root came from.
   */
  store: TemplateStore
  /**
   * The audit trail: one event per request an API route answered, to `sink`,
   * who asked named by keyed hash under `key`, or not at all without one.
   * Absent, no event is written; the composition root always gives one.
   */
  audit?: AuditOptions
  /**
   * Where Fastify's log lines go, one JSON line per `write`. Absent, nowhere;
   * the composition root gives standard output. Anything else that is no
   * such stream, Fastify's own `false` among them, does not start the server.
   */
  logger?: { stream: { write: (line: string) => void } }
  /**
   * Requests per client address per window, on every route but `/health`.
   * Default `DEFAULT_RATE_LIMIT`, Formancy Data's 600 a minute, derived and
   * not measured. An IPv6 client is counted by its /64.
   */
  rateLimit?: RateLimit
  /** The proxies whose X-Forwarded-For is believed, by formancy.ai-data 0071's rule (proxies.ts). Absent, none. */
  trustedProxies?: readonly string[]
  /** The origins whose pages may call the API, by formancy.ai-data 0060's rule (cors.ts). Absent, none. */
  origins?: readonly string[]
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Who is asking, once the API's preParsing hook verified the token; absent before, and for a request that carried none. */
    identity?: ReportIdentity
  }
}

/**
 * How long a request may take to arrive, headers and body, before Node
 * closes its connection: 300 s, Node's own default for `http.Server`'s
 * `requestTimeout`, which Fastify turns off unless it is told. Derived, not
 * measured here; Node checks every 30 s, so a request is cut between 300 and
 * 330 s. It bounds a body sent slowly to a route that reads none, whoami's
 * and health's, which otherwise held its connection for good.
 */
export const REQUEST_TIMEOUT_MS = 300_000

/** What is wrong with a role policy an embedder passes, or `undefined`. */
function rolesProblem(roles: unknown): string | undefined {
  const given = roles as Record<string, unknown> | null
  const lists = given !== null && typeof given === 'object' && CAPACITIES.every((capacity) => Array.isArray(given[capacity]) && (given[capacity] as unknown[]).every((role) => typeof role === 'string' && role !== ''))
  return lists ? undefined : 'roles is { author, publisher, admin }, each a list of the host’s roles.'
}

/**
 * What is wrong with the logger an embedder passes, or `undefined`. Absent
 * is no log; Fastify's own `false` for that, or any other value that is no
 * stream to write to, would turn the log on, to standard output.
 */
function loggerProblem(logger: unknown): string | undefined {
  const stream = (logger as { stream?: { write?: unknown } | null } | null | undefined)?.stream
  return logger === undefined || typeof stream?.write === 'function' ? undefined : 'logger is { stream } whose write(line) takes each log line; leave it out for no log.'
}

/**
 * The port's methods, each a key of `TemplateStore`, and every one of them:
 * a method the port gains fails to compile here until it is checked.
 */
const STORE_METHODS = Object.keys({ list: true, newest: true, save: true, keepImage: true, readImage: true, hasImage: true } satisfies Record<keyof TemplateStore, true>)
const STORE_PROBLEM = `store is a TemplateStore, whose ${STORE_METHODS.join(', ').replace(/, (?=[^,]*$)/, ' and ')} are each a function, as openFileTemplateStore answers one.`

/**
 * What is wrong with the store an embedder passes, or `undefined`: a
 * JavaScript caller that left it out, or passed something that lacks a
 * method of the port, would start a server whose first save failed as its
 * own error.
 */
function storeProblem(store: unknown): string | undefined {
  const given = store as Record<string, unknown> | null | undefined
  const whole = typeof given === 'object' && given !== null && STORE_METHODS.every((method) => typeof given[method] === 'function')
  return whole ? undefined : STORE_PROBLEM
}

/** A copy of an embedder's list, frozen, so a list changed after it was checked is never granted unchecked. */
const frozen = <T>(list: readonly T[] | undefined): readonly T[] => Object.freeze(Array.isArray(list) ? [...list] : (list ?? []))

/**
 * A request as the log names it: its method and the route that answered,
 * never the path, the query or the Host it was sent with, which are
 * whatever a caller typed -- a token pasted into a path among it. The
 * address is the one the limiter counts by.
 */
function requestForLog(request: FastifyRequest) {
  const address = clientAddress(request)
  const port = address === request.socket.remoteAddress ? request.socket.remotePort : undefined
  return { method: request.method, route: request.routeOptions.url ?? null, remoteAddress: address, ...(port === undefined ? {} : { remotePort: port }) }
}

/** A bearer token in the Authorization header, or undefined: one scheme, one token of the characters a JWT is made of. */
function bearer(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization
  return header === undefined ? undefined : /^Bearer ([A-Za-z0-9._~+/=-]+)$/.exec(header)?.[1]
}

/**
 * Report's server (0046): `GET /health`, `GET /v1/whoami`, the draft
 * slice's routes (0049, drafts.ts), and nothing else. Every API route
 * verifies the host's token before its body is read, and a request without
 * a verified identity and its tenant is the one 401.
 */
export async function createReportServer(options: ReportServerOptions): Promise<FastifyInstance> {
  // Each checked before anything is built, by the setting's own rule, and
  // checked as a copy, so an embedder's list changed while the server is
  // built is not granted unchecked.
  const origins = frozen(options.origins)
  const trustedProxies = frozen(options.trustedProxies)
  const limit = options.rateLimit ?? DEFAULT_RATE_LIMIT
  const auditKey = options.audit?.key
  const auditKeyProblem = auditKey !== undefined && (typeof auditKey !== 'string' || shortAuditKey(auditKey)) ? `audit.key is at least ${String(AUDIT_KEY_MIN_BYTES)} bytes, as FORMANCY_REPORT_AUDIT_KEY is.` : undefined
  for (const problem of [rolesProblem(options.roles), storeProblem(options.store), originsProblem(origins), trustedProxiesProblem(trustedProxies), rateLimitProblem(limit), auditKeyProblem, loggerProblem(options.logger)]) {
    if (problem !== undefined) throw new Error(problem)
  }
  const store = options.store
  const roles: RolePolicy = Object.freeze({ author: frozen(options.roles.author), publisher: frozen(options.roles.publisher), admin: frozen(options.roles.admin) })

  const logger = options.logger
  const app = Fastify({
    // Fastify's own 404 line names the path it was sent; the not-found
    // handler below replaces the handler that writes it, so no line does.
    logger: logger === undefined ? false : { serializers: { req: requestForLog }, stream: logger.stream },
    // HEAD is another route: the API answers the methods ROUTES names, and
    // /health, below, HEAD beside GET.
    exposeHeadRoutes: false,
    // Fastify's own answer to a path whose escapes do not decode quotes the
    // path; it is answered before any hook, so here, with the refusal of
    // every path that is not plain.
    frameworkErrors: (_error, _request, reply: FastifyReply) => {
      void reply.code(400).header('cache-control', 'no-store').header('connection', 'close').send(REFUSALS['path-not-plain'])
    },
    // What Node's parser cannot read is answered before Fastify sees a
    // request, with the fixed refusal (client-errors.ts).
    clientErrorHandler: answerClientError,
    requestTimeout: REQUEST_TIMEOUT_MS,
    // Absent unless proxies are named: Fastify then reads no X-Forwarded-* header at all.
    ...(trustedProxies.length === 0 ? {} : { trustProxy: [...trustedProxies] }),
  })

  // Nothing this server answers may be kept by a cache (formancy.ai-data
  // 0037): whoami is a person's identity.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('cache-control', 'no-store')
    return payload
  })

  // Every route but /health is reachable by anybody holding a browser and
  // begins with a signature check. Counted by the address the log names,
  // an IPv6 client by its /64.
  await app.register(rateLimit, { global: true, max: limit.max, timeWindow: limit.timeWindowMs, keyGenerator: (request) => normalizeIP(clientAddress(request)) })

  // Answered here, before any route's work and before a body is read:
  //  - a path a proxy could read otherwise than the router, which is not
  //    routed at all (paths.ts, formancy.ai-data 0037); a route the router
  //    matched for it still writes its one event, by this refusal, since
  //    the API's onSend and onResponse run for any answer its route gives;
  //  - a request no route answers. Its body would be read and parsed before
  //    the not-found handler, uncounted however broken or large, and held
  //    open however slowly it came; nothing reads it, so its connection is
  //    closed with the answer.
  // The limiter puts its own hook on each route, which runs after every
  // hook here and would never see these; it is asked here instead, and a
  // request it has counted is not counted again.
  const counted = app.rateLimit()
  app.addHook('onRequest', async function (request, reply) {
    const refusal = !plainPath(request.url) ? ([400, 'path-not-plain'] as const) : request.is404 ? ([404, 'not-found'] as const) : undefined
    if (refusal === undefined) return undefined
    await counted.call(this, request, reply)
    return reply.code(refusal[0]).header('connection', 'close').send(REFUSALS[refusal[1]])
  })

  crossOrigin(app, { origins })

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    // A file in the store that is not what it wrote: the operator's to
    // find, by why, by its path inside the tenant's directory and by the
    // tenant's keyed reference, as the trail names one. Never the error
    // itself, whose message holds the absolute path, and with it the
    // tenant's directory, the unkeyed hash of its claim (0049). A store is
    // asked only by a route's use case, which runs after the identity hook.
    if (error instanceof StoredRecordError) {
      const tenant = auditReference(auditKey, 'tenant', (request.identity as ReportIdentity).tenant)
      request.log.error({ why: error.why, file: error.withinTenant, tenant }, 'a stored record is not what the store wrote, and was not served')
      return reply.code(500).send(REFUSALS.internal)
    }
    const status = error.statusCode
    if (status === 429) return reply.code(429).send(REFUSALS['rate-limited'])
    // A body past the route's limit, under the refusal the route names
    // (drafts.ts): refused by the length it declares before it is read, or
    // once it is read past the limit where it declares none. A body no
    // parser of the route reads, by its media type, before it is read.
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.code(413).send(REFUSALS[request.routeOptions.config.tooLarge ?? 'bad-request'])
    if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') return closingUnread(request, reply).code(415).send(REFUSALS['unsupported-media-type'])
    if (status !== undefined && status >= 400 && status < 500) return reply.code(status).send(REFUSALS['bad-request'])
    request.log.error({ err: error }, 'the server could not answer a request')
    return reply.code(500).send(REFUSALS.internal)
  })

  // Nothing but what ROUTES names answers. The hook above answers a request
  // the router matched to no route; this answers one a route hands on with
  // `callNotFound`, so Fastify's own 404, which names the path, never does.
  app.setNotFoundHandler(async (_request, reply) => reply.code(404).send(REFUSALS['not-found']))

  // An orchestrator polls this every few seconds; limiting it would mark a
  // healthy server unhealthy exactly when it is busiest. HEAD beside GET, as
  // a monitor may probe either, answered as Fastify's own HEAD routes are:
  // GET's headers and length, and no body.
  const health = async () => ({ status: 'ok' as const })
  app.get('/health', { config: { rateLimit: false } }, health)
  const bodiless = async (_request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    reply.header('content-length', String(Buffer.byteLength(String(payload))))
    return null
  }
  app.head('/health', { config: { rateLimit: false }, onSend: bodiless }, health)

  await app.register(async (api) => {
    auditRequests(api, options.audit)

    // After the cross-origin refusal, which runs at the root, so a request
    // that refusal answers has no token read; both before the body is
    // parsed, so that nobody unidentified has a byte of a body read, and
    // both after the limiter's count, which is the route's onRequest.
    /** The identity the verifier finds in the request's token, or undefined for a request with none or one it refuses. */
    const authenticate = async (request: FastifyRequest): Promise<ReportIdentity | undefined> => {
      const token = bearer(request)
      if (token === undefined) return undefined
      const outcome = await options.verifyIdentity(token)
      if (!outcome.ok) {
        // The verifier's reason, which names a check or a claim and never the token or a claim's value.
        request.log.info({ reason: outcome.reason }, 'host identity refused')
        return undefined
      }
      return outcome.identity
    }

    api.addHook('preParsing', async (request, reply) => {
      const identity = await authenticate(request)
      if (identity === undefined) return closingUnread(request, reply).code(401).header('www-authenticate', 'Bearer').send(REFUSALS.unauthenticated)
      request.identity = identity
      return undefined
    })

    api.get('/v1/whoami', async (request): Promise<WhoAmI> => {
      const identity = request.identity as ReportIdentity
      return { subject: identity.subject, tenant: identity.tenant, roles: identity.roles, capacities: capacitiesOf(identity, roles), actions: actionsOf(identity, roles) }
    })

    registerDraftRoutes(api, { store, roles })
  })

  return app
}
