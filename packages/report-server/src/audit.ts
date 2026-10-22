/**
 * The audit trail's hooks (0046, after formancy.ai-data 0023 and 0033): one
 * event per request a route of the API answered, built from the answer once
 * it is decided, so every ending -- an identity, a refusal, the limiter's
 * 429, an error -- is recorded without a branch remembering to say so. The
 * event is report-server-core's `AuditEvent`; where it goes is the port.
 */
import { createHmac } from 'node:crypto'
import { ROUTES } from '@formancy/report-server-core'
import type { AuditEvent, AuditSink, Refusal, RefusalCode, Route } from '@formancy/report-server-core'
import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export interface AuditOptions {
  sink: AuditSink
  /** Names who asked by keyed hash; absent, nobody is named (formancy.ai-data 0023's rule for a record, here for a person). */
  key?: string
  /** The clock an event is stamped by. */
  now?: () => string
}

/**
 * The reference an event names a tenant or an actor by: the first 32 hex
 * characters of HMAC-SHA-256 under the audit key, over `kind` and `values`
 * as a JSON array -- `["actor","<tenant>","<subject>"]` -- so that no two
 * pairs run together into the same text, whatever a host signed into them,
 * a NUL or a quote among it. Keyed, because a tenant or a subject is often
 * short enough to guess, and a plain hash of one is reversed by trying them.
 * An operator holding the key recomputes it to ask whether an event is a
 * given person's. Without a key, `null`.
 */
export function auditReference(key: string | undefined, kind: 'tenant' | 'actor', ...values: string[]): string | null {
  if (key === undefined) return null
  return createHmac('sha256', key)
    .update(JSON.stringify([kind, ...values]), 'utf8')
    .digest('hex')
    .slice(0, 32)
}

/**
 * The fewest bytes an audit key holds: 32, the floor data-identity holds a
 * shared secret to, RFC 7518's key of at least the hash's size for
 * HMAC-SHA-256. Derived, not measured. The key is all that keeps the trail's
 * references from being reversed by trying keys against one known tenant,
 * so `FORMANCY_REPORT_AUDIT_KEY` and an embedder's `audit.key` are each
 * refused under it.
 */
export const AUDIT_KEY_MIN_BYTES = 32

/** Whether `key` is too short to name who asked by. */
export const shortAuditKey = (key: string): boolean => Buffer.byteLength(key, 'utf8') < AUDIT_KEY_MIN_BYTES

/** Events as structured log lines, one per event, under `audit`: the server's own sink. */
export function logAuditSink(log: FastifyBaseLogger): AuditSink {
  return (event) => {
    log.info({ audit: event }, 'audit')
  }
}

/** `METHOD url`, as ROUTES keys a route. */
const routeKey = (method: string, url: string) => `${method.toUpperCase()} ${url}`

/**
 * Called in the API's context before any of its routes: from then on, a
 * route there that ROUTES does not name stops the registration, so no route
 * ever answers unaudited, whether or not a sink is given.
 *
 * Exactly one event for a request that reaches a route, whichever way it
 * ends. `onResponse` runs only when a response finishes; one whose client
 * left while the route ran never finishes, and gets neither `onResponse`
 * nor `onRequestAbort` (formancy.ai-data 0033's measurement, against
 * Fastify 5.12.5). So the event is also written from `onSend` when the
 * response or its connection is already gone, and otherwise from the
 * connection's `close` if that comes first; whichever comes first writes
 * it, and the others find it written.
 *
 * These hooks are the API context's, so they run only for a request one of
 * its routes answered, a route the check below has found in ROUTES: a 404's
 * and a preflight's hooks are the root's. And every answer such a route
 * gives at 400 or above is one of REFUSALS, which Fastify has serialised to
 * its JSON before onSend, so a refusal's code is read off the answer.
 */
export function auditRequests(app: FastifyInstance, options: AuditOptions | undefined): void {
  app.addHook('onRoute', (route) => {
    for (const method of [route.method].flat()) {
      const key = routeKey(method, route.url)
      if (!Object.hasOwn(ROUTES, key)) throw new Error(`${key} has no audit name in ROUTES (0046)`)
    }
  })
  if (options === undefined) return

  const { sink, key } = options
  const now = options.now ?? (() => new Date().toISOString())
  const codes = new WeakMap<FastifyRequest, RefusalCode>()
  const written = new WeakSet<FastifyRequest>()
  /** Per connection, the requests whose answers wait on it, and its one `close` listener for all of them. */
  const waiting = new WeakMap<object, { requests: Map<FastifyRequest, FastifyReply>; close: () => void }>()

  const settle = (request: FastifyRequest): void => {
    const connection = request.raw.socket
    const entry = waiting.get(connection)
    if (entry === undefined || !entry.requests.delete(request) || entry.requests.size > 0) return
    connection.off('close', entry.close)
    waiting.delete(connection)
  }

  const emit = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (written.has(request)) return
    written.add(request)
    settle(request)
    const status = reply.statusCode
    const identity = request.identity
    const event: AuditEvent = {
      at: now(),
      // A route of the API's, so one ROUTES names (above).
      operation: ROUTES[routeKey(request.method, request.routeOptions.url as string) as Route],
      status,
      // Every ending comes after onSend, which read a refusal's code.
      outcome: status < 400 ? 'ok' : (codes.get(request) as RefusalCode),
      identified: identity !== undefined,
      tenant: identity === undefined ? null : auditReference(key, 'tenant', identity.tenant),
      actor: identity === undefined ? null : auditReference(key, 'actor', identity.tenant, identity.subject),
    }
    try {
      await sink(event)
    } catch (error) {
      request.log.error({ error: (error as Error).message }, 'an audit event could not be written')
    }
  }

  const wait = (request: FastifyRequest, reply: FastifyReply): void => {
    const connection = request.raw.socket
    let entry = waiting.get(connection)
    if (entry === undefined) {
      const requests = new Map<FastifyRequest, FastifyReply>()
      entry = { requests, close: () => void Promise.all([...requests].map(([each, answer]) => emit(each, answer))) }
      waiting.set(connection, entry)
      connection.once('close', entry.close)
    }
    entry.requests.set(request, reply)
  }

  app.addHook('onSend', async (request, reply, payload) => {
    // The stable code of a refusal, read from the answer itself: one of REFUSALS, as JSON (above).
    if (reply.statusCode >= 400) codes.set(request, (JSON.parse(payload as string) as Refusal).code)
    if (reply.raw.destroyed || request.raw.socket.destroyed) await emit(request, reply)
    else wait(request, reply)
    return payload
  })

  app.addHook('onResponse', async (request, reply) => {
    await emit(request, reply)
  })
}
