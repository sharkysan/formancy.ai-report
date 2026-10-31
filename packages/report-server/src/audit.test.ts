import { createHmac } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { request as httpRequest } from 'node:http'
import { connect } from 'node:net'
import type { AddressInfo, Socket } from 'node:net'
import type { AuditEvent } from '@formancy/report-server-core'
import Fastify from 'fastify'
import { describe, expect, test } from 'vitest'
import type { ReportServerOptions } from './app.js'
import { auditReference, auditRequests, logAuditSink } from './audit.js'
import type { ReportVerifier } from './identity.js'
import { eachCase } from './test-support.js'

/**
 * The audit trail (0046, after formancy.ai-data 0023): one event per
 * request an API route answered, written from the answer once it is
 * decided, never a value, and who asked named by a keyed hash or not at
 * all. The key is this test's own.
 */
const KEY = 'a-throwaway-audit-key-for-this-test-only'
const roles = { author: ['report-authors'], publisher: [], admin: [] }

/** `good` is u-1 of acme, `other` u-1 of globex: one subject, two tenants. */
const verifyIdentity: ReportVerifier = async (token) => {
  if (token === 'good') return { ok: true, identity: { subject: 'u-1', tenant: 'acme', roles: ['report-authors'] } }
  if (token === 'other') return { ok: true, identity: { subject: 'u-1', tenant: 'globex', roles: [] } }
  return { ok: false, reason: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' }
}

let events: AuditEvent[]

/** The server is given a store whatever the case asks of it (0049): each case its own (test-support.ts). */
const cases = eachCase('formancy-report-audit-')

const at = '2026-10-22T08:00:00.000Z'
/** Audited into `events`, under `key`, or with no key for `null`. */
async function server(overrides: Partial<ReportServerOptions> = {}, key: string | null = KEY) {
  events = []
  return cases.serve({
    verifyIdentity,
    roles,
    audit: { sink: (event) => void events.push(event), now: () => at, ...(key === null ? {} : { key }) },
    ...overrides,
  })
}

describe('auditReference', () => {
  // The formula is the operator's to recompute, to ask whether an event is
  // a given person's: the first 32 hex characters of HMAC-SHA-256 under
  // the audit key, over the kind and the values as a JSON array.
  test('is HMAC-SHA-256 under the key, over the kind and the values as a JSON array, cut to 32 hex characters', () => {
    const expected = createHmac('sha256', KEY).update('["actor","acme","u-1"]', 'utf8').digest('hex').slice(0, 32)
    expect(auditReference(KEY, 'actor', 'acme', 'u-1')).toBe(expected)
    expect(auditReference(KEY, 'tenant', 'acme')).toBe(createHmac('sha256', KEY).update('["tenant","acme"]', 'utf8').digest('hex').slice(0, 32))
    expect(auditReference(KEY, 'actor', 'acm', 'eu-1')).not.toBe(expected)
    expect(auditReference(undefined, 'tenant', 'acme')).toBeNull()
  })

  // A host may sign any JSON string, a NUL or a quote among it. Values
  // ended by a NUL ran together, so tenant "a\0b" with subject "c" and
  // tenant "a" with subject "b\0c" were one actor: two people, one
  // reference. A JSON array keeps every pair apart.
  test('names two pairs as two actors however their text runs together', () => {
    const pairs = [
      ['a\0b', 'c'],
      ['a', 'b\0c'],
      ['a"', 'b'],
      ['a', '"b'],
      ['a\\', 'b'],
      ['a', '\\b'],
      ['a,b', 'c'],
      ['a', 'b,c'],
    ] as const
    const references = pairs.map(([tenant, subject]) => auditReference(KEY, 'actor', tenant, subject))
    expect(new Set(references).size).toBe(pairs.length)
  })
})

describe('the audit trail', () => {
  // Who did what, how it ended: an operator can count a tenant's requests
  // and follow one person's, by reference, without the trail holding
  // either's identifier.
  test('writes one event for an answered request, naming who by keyed hash', async () => {
    await (await server()).inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer good' } })
    expect(events).toEqual([
      {
        at,
        operation: 'whoami',
        status: 200,
        outcome: 'ok',
        identified: true,
        tenant: auditReference(KEY, 'tenant', 'acme'),
        actor: auditReference(KEY, 'actor', 'acme', 'u-1'),
      },
    ])
  })

  // Each route of the draft slice is an operation of its own in the trail,
  // answered or refused, a refusal Fastify gives before the route's
  // handler among them: under one name, or none, an operator could not
  // count saves apart from reads, nor see the refusals a client met.
  test('writes one event for each request of the draft slice, under its operation', async () => {
    const audited = await server()
    const hex = 'ab'.repeat(32)
    const good = { authorization: 'Bearer good' }
    await audited.inject({ method: 'GET', url: '/v1/templates', headers: good })
    await audited.inject({ method: 'PUT', url: '/v1/templates/invoice/draft', headers: good })
    await audited.inject({
      method: 'PUT',
      url: '/v1/templates/invoice/draft',
      headers: { ...good, 'if-none-match': '*', 'content-type': 'text/plain' },
      payload: 'x',
    })
    await audited.inject({ method: 'GET', url: '/v1/templates/invoice/draft', headers: good })
    await audited.inject({ method: 'PUT', url: `/v1/assets/${hex}`, headers: { ...good, 'content-type': 'image/png' }, payload: Buffer.from('no image') })
    await audited.inject({ method: 'GET', url: `/v1/assets/${hex}`, headers: good })
    expect(events.map(({ operation, status, outcome, identified }) => ({ operation, status, outcome, identified }))).toEqual([
      { operation: 'template.list', status: 200, outcome: 'ok', identified: true },
      { operation: 'draft.save', status: 428, outcome: 'precondition-required', identified: true },
      { operation: 'draft.save', status: 415, outcome: 'unsupported-media-type', identified: true },
      { operation: 'draft.read', status: 404, outcome: 'no-draft', identified: true },
      { operation: 'asset.keep', status: 422, outcome: 'image-refused', identified: true },
      { operation: 'asset.read', status: 404, outcome: 'no-asset', identified: true },
    ])
  })

  // A subject is unique within its tenant, not across tenants: u-1 of
  // acme and u-1 of globex are two people, and two references.
  test('names one subject in two tenants as two actors', async () => {
    const audited = await server()
    await audited.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer good' } })
    await audited.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer other' } })
    await audited.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer good' } })
    const [first, second, third] = events
    expect(first?.actor).not.toBe(second?.actor)
    expect(first?.tenant).not.toBe(second?.tenant)
    expect(third?.actor).toBe(first?.actor)
  })

  // An embedder's key is held to the setting's floor: one of a few bytes is
  // found by trying keys against one tenant the reader of the trail knows.
  test('does not start with an audit key under 32 bytes', async () => {
    await expect(server({}, 'k'.repeat(31))).rejects.toThrow('audit.key is at least 32 bytes, as FORMANCY_REPORT_AUDIT_KEY is.')
    await expect(server({}, 'k'.repeat(32))).resolves.toBeDefined()
  })

  // Without a key nothing names who: a plain hash of a tenant or a subject
  // is reversed by trying the names a host uses.
  test('names nobody without an audit key', async () => {
    await (await server({}, null)).inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer good' } })
    expect(events).toEqual([{ at, operation: 'whoami', status: 200, outcome: 'ok', identified: true, tenant: null, actor: null }])
  })

  // Every ending, refusals included, by the code the answer carried:
  // the trail sees the forgery attempts too.
  test('writes a refusal as its code, with nobody named', async () => {
    const audited = await server({ rateLimit: { max: 2, timeWindowMs: 60_000 }, origins: ['https://app.example'] })
    await audited.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer bad' } })
    await audited.inject({
      method: 'GET',
      url: '/v1/whoami',
      headers: { authorization: 'Bearer good', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
    })
    await audited.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer good' } })
    expect(events.map(({ status, outcome, identified, tenant, actor }) => ({ status, outcome, identified, tenant, actor }))).toEqual([
      { status: 401, outcome: 'unauthenticated', identified: false, tenant: null, actor: null },
      { status: 403, outcome: 'cross-origin-refused', identified: false, tenant: null, actor: null },
      { status: 429, outcome: 'rate-limited', identified: false, tenant: null, actor: null },
    ])
  })

  // A path that is not plain is refused before any route's work; when the
  // router matched a route for it, that route's request happened, refused,
  // and the trail says so under the route's name.
  test('writes a path that is not plain under the route the router matched, as its refusal', async () => {
    await (await server()).inject({ method: 'GET', url: '/v1/%77hoami', headers: { authorization: 'Bearer good' } })
    expect(events).toEqual([{ at, operation: 'whoami', status: 400, outcome: 'path-not-plain', identified: false, tenant: null, actor: null }])
  })

  // An orchestrator's probe is nobody's request, and a path nothing
  // answers is no operation; neither floods the trail.
  test('writes nothing for health, a 404, a path no route matched, or a preflight', async () => {
    const audited = await server({ origins: ['https://app.example'] })
    await audited.inject({ method: 'GET', url: '/health' })
    await audited.inject({ method: 'HEAD', url: '/health' })
    await audited.inject({ method: 'GET', url: '/v1/nothing', headers: { authorization: 'Bearer good' } })
    await audited.inject({ method: 'POST', url: '/v1/nothing', headers: { authorization: 'Bearer good', 'content-type': 'application/json' }, payload: '{' })
    await audited.inject({ method: 'GET', url: '/v1/%E0%A4%A', headers: { authorization: 'Bearer good' } })
    await audited.inject({ method: 'GET', url: '/v2/%77hoami', headers: { authorization: 'Bearer good' } })
    await audited.inject({ method: 'OPTIONS', url: '/v1/whoami', headers: { origin: 'https://app.example', 'access-control-request-method': 'GET' } })
    expect(events).toEqual([])
  })

  // Never a value: not the token, not the tenant or the subject, not the
  // path or the query as they were sent.
  test('holds no token, no claim’s value and nothing of the request as sent', async () => {
    const audited = await server()
    await audited.inject({ method: 'GET', url: '/v1/whoami?secret=hunter2', headers: { authorization: 'Bearer good' } })
    await audited.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer badtoken' } })
    const written = JSON.stringify(events)
    for (const part of ['good', 'badtoken', 'acme', 'u-1', 'hunter2', 'secret', '?']) expect(written, part).not.toContain(part)
  })

  // By the time the event exists the answer has been decided; a sink that
  // fails cannot change it, and refusing to answer would only hide it. The
  // failure is the log's.
  test('answers as it would when the sink throws or rejects, and logs that it could not write', async () => {
    for (const sink of [
      () => {
        throw new Error('disk full')
      },
      async () => Promise.reject(new Error('disk full')),
    ]) {
      const lines: string[] = []
      const failing = await cases.serve({ verifyIdentity, roles, audit: { sink }, logger: { stream: { write: (line) => void lines.push(line) } } })
      const answer = await failing.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer good' } })
      await failing.close()
      expect(answer.statusCode).toBe(200)
      expect(lines.join('')).toContain('an audit event could not be written')
    }
  })

  // The default sink: one structured line per event, `audit` its key, so
  // a collector reads the trail out of the server's own log.
  test('writes one log line per event with the server’s own sink', async () => {
    const lines: string[] = []
    const logged = await cases.serve({ verifyIdentity, roles, logger: { stream: { write: (line) => void lines.push(line) } } })
    const sink = logAuditSink(logged.log)
    await sink({ at, operation: 'whoami', status: 200, outcome: 'ok', identified: true, tenant: null, actor: null })
    await logged.close()
    const audited = lines.map((line) => JSON.parse(line) as { msg: string; audit?: unknown }).filter((line) => line.msg === 'audit')
    expect(audited).toEqual([
      expect.objectContaining({ audit: { at, operation: 'whoami', status: 200, outcome: 'ok', identified: true, tenant: null, actor: null } }),
    ])
  })
})

describe('a client that leaves', () => {
  // A client whose connection closes while its route still runs gets no
  // answer, and Fastify runs no onResponse for it (formancy.ai-data
  // 0033's measurement); the request happened all the same, and the trail
  // says so once.
  test('is still one event, written when its answer goes nowhere', async () => {
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    let arrived: () => void = () => {}
    const asked = new Promise<void>((resolve) => (arrived = resolve))
    const slow: ReportVerifier = async (token) => {
      arrived()
      await held
      return verifyIdentity(token)
    }
    const audited = await server({ verifyIdentity: slow })
    await audited.listen({ host: '127.0.0.1', port: 0 })
    const { port } = audited.server.address() as AddressInfo
    const request = httpRequest({ host: '127.0.0.1', port, path: '/v1/whoami', headers: { authorization: 'Bearer good' } })
    request.on('error', () => {})
    request.end()
    await asked
    request.destroy()
    await new Promise((resolve) => setTimeout(resolve, 50))
    release()
    for (let wait = 0; wait < 40 && events.length === 0; wait += 1) await new Promise((resolve) => setTimeout(resolve, 25))
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ operation: 'whoami', identified: true })
  })
})

describe('two requests waiting on one connection', () => {
  // Two requests pipelined on one connection are both answered before
  // either finishes, so both wait on it at once. Each writes its one event
  // when it finishes, and the connection's one close listener goes with
  // the last: a listener left behind on a kept-alive connection would be
  // one more for every request it ever carried, and its close would write
  // their events again.
  test('write an event each, and leave no listener on the connection', async () => {
    const audited = await server()
    // The server's side of the connection, awaited rather than read when the
    // client connects: on macOS the client's connect comes before the
    // server's connection event, and the connection was not there yet.
    const accepted = new Promise<Socket>((resolve) => audited.server.once('connection', resolve))
    await audited.listen({ host: '127.0.0.1', port: 0 })
    const { port } = audited.server.address() as AddressInfo
    const socket = connect(port, '127.0.0.1')
    socket.on('error', () => {})
    await new Promise((resolve) => socket.once('connect', resolve))
    const connection = await accepted
    const before = connection.listenerCount('close')
    let answered = ''
    socket.on('data', (chunk: Buffer) => void (answered += chunk.toString('utf8')))
    const ask = (token: string) => `GET /v1/whoami HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer ${token}\r\n\r\n`
    socket.write(`${ask('good')}${ask('other')}`)
    for (let wait = 0; wait < 40 && (answered.match(/HTTP\/1\.1 200/g) ?? []).length < 2; wait += 1) await new Promise((resolve) => setTimeout(resolve, 25))
    for (let wait = 0; wait < 40 && events.length < 2; wait += 1) await new Promise((resolve) => setTimeout(resolve, 25))
    expect(events.map((event) => event.status)).toEqual([200, 200])
    expect(connection.listenerCount('close')).toBe(before)
    socket.destroy()
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(events).toHaveLength(2)
  })
})

describe('the order the endings come in', () => {
  // Which of onSend, the connection's close and onResponse comes first is
  // Node's and Fastify's to decide, release by release (formancy.ai-data
  // 0033 measured it once), and a socket cannot be made to choose. So the
  // hooks are called here in the orders that matter, on a connection that
  // is an EventEmitter.
  const hooked = () => {
    const hooks: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
    const api = { addHook: (name: string, hook: (...args: unknown[]) => Promise<unknown>) => void (hooks[name] = hook) }
    const written: AuditEvent[] = []
    auditRequests(api as never, { sink: (event) => void written.push(event), now: () => at })
    const connection = Object.assign(new EventEmitter(), { destroyed: false })
    const close = () => {
      connection.destroyed = true
      connection.emit('close')
    }
    const request = () => ({ method: 'GET', routeOptions: { url: '/v1/whoami' }, raw: { socket: connection }, identity: undefined, log: { error: () => {} } })
    const reply = { statusCode: 401, raw: { destroyed: false } }
    const refusal = '{"code":"unauthenticated","message":"A valid host token is required."}'
    return { hooks, written, connection, close, request, reply, refusal }
  }
  const event = { at, operation: 'whoami', status: 401, outcome: 'unauthenticated', identified: false, tenant: null, actor: null }

  // Whichever writes the event, the others find it written: the connection
  // closes after the answer was handed to it, and then the response
  // finishes too, and the request is one event.
  test('is one event when the connection closes and the response finishes after it', async () => {
    const { hooks, written, connection, close, request, reply, refusal } = hooked()
    const asked = request()
    await hooks['onSend']?.(asked, reply, refusal)
    close()
    await hooks['onResponse']?.(asked, reply)
    expect(written).toEqual([event])
    expect(connection.listenerCount('close')).toBe(0)
  })

  // Two requests wait on one connection; the first finishes, and the
  // connection closes before the second does. The one listener stays for
  // the second, whose event the close writes: removed with the first, the
  // second request would never be in the trail.
  test('writes the event of a request still waiting when another on its connection finished', async () => {
    const { hooks, written, connection, close, request, reply, refusal } = hooked()
    const [first, second] = [request(), request()]
    await hooks['onSend']?.(first, reply, refusal)
    await hooks['onSend']?.(second, reply, refusal)
    expect(connection.listenerCount('close')).toBe(1)
    await hooks['onResponse']?.(first, reply)
    close()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(written).toEqual([event, event])
    expect(connection.listenerCount('close')).toBe(0)
  })
})

describe('a route nobody named', () => {
  // A route that answered without an audit name would be the one request
  // the trail never records; registered in the API's context, it stops the
  // server at ready, whether or not a sink is given.
  test('stops the server it is registered in', async () => {
    for (const options of [undefined, { sink: () => {} }]) {
      const app = Fastify()
      const starting = async () => {
        await app.register(async (api) => {
          auditRequests(api, options)
          api.get('/v1/other', async () => 'x')
        })
        await app.ready()
      }
      await expect(starting()).rejects.toThrow('GET /v1/other has no audit name in ROUTES (0046)')
    }
  })
})

describe('a pipelined request whose connection goes', () => {
  // A request pipelined behind a slow one is answered while the first
  // waits, and has no socket of its own until the first is written; when
  // the client goes meanwhile, neither request finishes, and Fastify runs
  // no onResponse for either. The connection's close writes the second's
  // event, and the first's is written when its answer goes nowhere: two
  // requests, two events (formancy.ai-data 0033's case).
  test('is still one event each, written when the connection closes', async () => {
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    const asked: string[] = []
    const pipelined: ReportVerifier = async (token) => {
      asked.push(token)
      if (token === 'good') await held
      return verifyIdentity(token === 'good' ? 'good' : 'other')
    }
    const audited = await server({ verifyIdentity: pipelined })
    await audited.listen({ host: '127.0.0.1', port: 0 })
    const { port } = audited.server.address() as AddressInfo
    const socket = connect(port, '127.0.0.1')
    socket.on('error', () => {})
    await new Promise((resolve) => socket.once('connect', resolve))
    const ask = (token: string) => `GET /v1/whoami HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer ${token}\r\n\r\n`
    socket.write(`${ask('good')}${ask('second')}`)
    for (let wait = 0; wait < 40 && asked.length < 2; wait += 1) await new Promise((resolve) => setTimeout(resolve, 25))
    await new Promise((resolve) => setTimeout(resolve, 100))
    socket.destroy()
    await new Promise((resolve) => setTimeout(resolve, 50))
    release()
    for (let wait = 0; wait < 40 && events.length < 2; wait += 1) await new Promise((resolve) => setTimeout(resolve, 25))
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(asked).toEqual(['good', 'second'])
    expect(events).toHaveLength(2)
    expect(events.map((event) => event.operation)).toEqual(['whoami', 'whoami'])
  })
})
