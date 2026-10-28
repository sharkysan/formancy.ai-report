import { generateKeyPairSync } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { connect } from 'node:net'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { SignJWT, UnsecuredJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { ACTIONS, ROUTES } from '@formancy/report-server-core'
import type { TemplateStore } from '@formancy/report-server-core'
import { createReportServer, REQUEST_TIMEOUT_MS } from './app.js'
import type { ReportServerOptions } from './app.js'
import { openFileTemplateStore } from './file-store.js'
import { createReportVerifier } from './identity.js'
import type { ReportVerifier } from './identity.js'

/**
 * The HTTP surface of S1 (0046): `GET /health`, `GET /v1/whoami`, and
 * nothing else. Through Fastify's `inject`; what only a socket shows -- the
 * forwarded address, a client that leaves -- is in proxies' and audit's
 * suites over a real one.
 *
 * The secret is this test's own, throwaway.
 */
const SECRET = 'a-throwaway-test-secret-of-at-least-32-bytes'
const ISSUER = 'https://host.example'
const AUDIENCE = 'formancy-report'
const roles = { author: ['report-authors'], publisher: ['report-publishers'], admin: ['report-admins'] }

/** Accepts the literal token `good`, of tenant acme; everything else is a bad signature. The real verifier has its own suite, and the cases below. */
const verifyIdentity: ReportVerifier = async (token) => (token === 'good' ? { ok: true, identity: { subject: 'u-1', tenant: 'acme', roles: ['report-authors', 'report-publishers'] } } : { ok: false, reason: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' })

let app: FastifyInstance | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

/**
 * The server is given a store whatever the case asks of it (0049), so each
 * case has one of its own: the file store on a directory made for it and
 * removed after it, as the server runs on one, and never one shared
 * between cases.
 */
let store: TemplateStore
let storeDirectory: string
beforeEach(async () => {
  storeDirectory = await mkdtemp(join(tmpdir(), 'formancy-report-app-'))
  const opened = await openFileTemplateStore(storeDirectory)
  if (!opened.ok) throw new Error(opened.problem)
  store = opened.store
})
afterEach(async () => {
  await rm(storeDirectory, { recursive: true, force: true })
})
const server = async (overrides: Partial<ReportServerOptions> = {}) => (app = await createReportServer({ verifyIdentity, roles, store, ...overrides }))

/**
 * Writes `text` to a server listening on `port`, as a client that may never
 * finish its request, and reads for up to `ms`: what came back, whether the
 * server closed the connection meanwhile, and the port the client sent from.
 */
async function exchange(port: number, text: string, ms = 1000): Promise<{ answer: string; closed: boolean; from: number | undefined }> {
  const socket = connect(port, '127.0.0.1')
  socket.on('error', () => {})
  let answer = ''
  let closed = false
  socket.on('data', (chunk: Buffer) => void (answer += chunk.toString('utf8')))
  const ended = new Promise<void>((resolve) => socket.once('close', () => resolve(void (closed = true))))
  await new Promise((resolve) => socket.once('connect', resolve))
  const from = socket.localPort
  socket.write(text)
  await Promise.race([ended, new Promise((resolve) => setTimeout(resolve, ms))])
  socket.destroy()
  return { answer, closed, from }
}

const key = new TextEncoder().encode(SECRET)
const signed = (claims: Record<string, unknown>, change: (jwt: SignJWT) => SignJWT = (jwt) => jwt) =>
  change(new SignJWT({ tid: 'acme', roles: ['report-authors'], ...claims }).setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience(AUDIENCE).setSubject('u-1').setExpirationTime('5m')).sign(key)

describe('health', () => {
  // An orchestrator needs a route that answers without credentials, and
  // says nothing about anybody.
  test('answers without a token, and says only that the process answers', async () => {
    const answer = await (await server()).inject({ method: 'GET', url: '/health' })
    expect(answer.statusCode).toBe(200)
    expect(answer.json()).toEqual({ status: 'ok' })
  })

  // A monitor that probes with HEAD would otherwise mark a healthy server
  // dead, and spend its own address's quota on 404s. HEAD is answered here
  // alone: the API answers the methods ROUTES names.
  test('answers HEAD as GET, without a body, uncounted, and HEAD nowhere else', async () => {
    const limited = await server({ rateLimit: { max: 1, timeWindowMs: 60_000 } })
    for (let n = 0; n < 3; n += 1) {
      const answer = await limited.inject({ method: 'HEAD', url: '/health' })
      expect(answer.statusCode).toBe(200)
      expect(answer.body).toBe('')
      expect(answer.headers['cache-control']).toBe('no-store')
    }
    expect((await limited.inject({ method: 'HEAD', url: '/v1/whoami', headers: { authorization: 'Bearer good' } })).statusCode).toBe(404)
  })
})

describe('whoami', () => {
  // The person wiring a host in sees exactly who the server takes the
  // token's holder to be, and what the actions table gives them -- so a
  // wrong tenant claim or role mapping shows before anything depends on it.
  test('answers the verified identity, its capacities and the actions they give', async () => {
    const answer = await (await server()).inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer good' } })
    expect(answer.statusCode).toBe(200)
    expect(answer.json()).toEqual({
      subject: 'u-1',
      tenant: 'acme',
      roles: ['report-authors', 'report-publishers'],
      capacities: ['author', 'publisher'],
      actions: Object.keys(ACTIONS).filter((action) => action !== 'policy.set'),
    })
  })

  // The operator's policy is the one createReportServer was given: the
  // same token under another policy is another person's capacities.
  test('reads the capacities from the policy the server was given', async () => {
    const answer = await (await server({ roles: { author: [], publisher: [], admin: ['report-authors'] } })).inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer good' } })
    expect(answer.json()).toMatchObject({ capacities: ['admin'], actions: ['template.list', 'policy.read', 'policy.set'] })
  })

  // ROUTES is what a client compiles against and what the cross-origin
  // grant offers; an entry no route answers would be granted across
  // origins and answered 404, and nothing else would notice.
  test('answers every route ROUTES names', async () => {
    const listening = await server()
    for (const route of Object.keys(ROUTES)) {
      const [method = '', url = ''] = route.split(' ')
      expect(listening.hasRoute({ method: method as 'GET', url }), route).toBe(true)
    }
  })

  // A policy is the operator's settings; one that is not lists of roles
  // would grant by accident, and does not start a server.
  test('does not start with a role policy that is not lists of roles', async () => {
    await expect(server({ roles: { author: 'report-authors' } as unknown as ReportServerOptions['roles'] })).rejects.toThrow('roles is { author, publisher, admin }, each a list of the host’s roles.')
  })
})

describe('every bad token is the same 401', () => {
  // formancy.ai-data 0014's cases, through the real verifier, and Report's
  // own: a token without its tenant. Which check failed is the log's to
  // say; an answer that differed by case would tell a forger which part of
  // a forgery to fix.
  test('answers no token, a malformed header and each of 0014’s refusals, and no tenant, alike', async () => {
    const real = await createReportVerifier({ key: { kind: 'secret', secret: SECRET }, issuer: ISSUER, audience: AUDIENCE, tenantClaim: 'tid' })
    const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const confusedVerifier = await createReportVerifier({ key: { kind: 'public-key', pem, algorithm: 'ES256' }, issuer: ISSUER, audience: AUDIENCE, tenantClaim: 'tid' })
    const tokens = {
      'a wrong signature': await new SignJWT({ tid: 'acme' }).setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience(AUDIENCE).setSubject('u-1').setExpirationTime('5m').sign(new TextEncoder().encode('another-secret-of-at-least-thirty-two-bytes')),
      'another issuer': await signed({}, (jwt) => jwt.setIssuer('https://other.example')),
      'another audience': await signed({}, (jwt) => jwt.setAudience('formancy-data')),
      expired: await signed({}, (jwt) => jwt.setExpirationTime(Math.floor(Date.now() / 1000) - 3600)),
      'no exp': await new SignJWT({ tid: 'acme' }).setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience(AUDIENCE).setSubject('u-1').sign(key),
      'no sub': await new SignJWT({ tid: 'acme' }).setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience(AUDIENCE).setExpirationTime('5m').sign(key),
      'alg none': new UnsecuredJWT({ tid: 'acme' }).setIssuer(ISSUER).setAudience(AUDIENCE).setSubject('u-1').setExpirationTime('5m').encode(),
      'no tenant': await signed({ tid: undefined }),
    }
    const answers = []
    const plain = await createReportServer({ verifyIdentity: real, roles, store })
    const confused = await createReportServer({ verifyIdentity: confusedVerifier, roles, store })
    try {
      for (const headers of [{}, { authorization: 'Basic dTpw' }, { authorization: 'Bearer a b' }, { authorization: 'bearer good' }]) answers.push(await plain.inject({ method: 'GET', url: '/v1/whoami', headers }))
      for (const token of Object.values(tokens)) answers.push(await plain.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: `Bearer ${token}` } }))
      // HS256 over the PEM's text, against the server that verifies with that public key.
      const forgery = await new SignJWT({ tid: 'acme' }).setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience(AUDIENCE).setSubject('u-1').setExpirationTime('5m').sign(new TextEncoder().encode(pem))
      answers.push(await confused.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: `Bearer ${forgery}` } }))
      // And the honest token, so a server that refused everything would fail here.
      expect((await plain.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: `Bearer ${await signed({})}` } })).statusCode).toBe(200)
    } finally {
      await plain.close()
      await confused.close()
    }
    expect(answers).toHaveLength(13)
    for (const answer of answers) {
      expect(answer.statusCode).toBe(401)
      expect(answer.headers['www-authenticate']).toBe('Bearer')
      expect(answer.body).toBe('{"code":"unauthenticated","message":"A valid host token is required."}')
    }
  })
})

describe('the Authorization header', () => {
  // The scheme and the token are read exactly. The stub here accepts
  // `good` from whatever hands it over, so a parser that took another
  // case, a second space or a second word would answer 200; and none of
  // these reaches the verifier at all.
  test('is read only as `Bearer <token>`, and asks the verifier nothing otherwise', async () => {
    const asked: string[] = []
    const counting: ReportVerifier = async (token) => {
      asked.push(token)
      return verifyIdentity(token)
    }
    const listening = await server({ verifyIdentity: counting })
    for (const authorization of ['bearer good', 'BEARER good', 'Bearer  good', 'Bearer good x', 'Bearer good,', 'Basic good', 'good', 'Bearer']) {
      const answer = await listening.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization } })
      expect(answer.statusCode, authorization).toBe(401)
    }
    expect(asked).toEqual([])
    expect((await listening.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer good' } })).statusCode).toBe(200)
    expect(asked).toEqual(['good'])
  })
})

describe('nothing else is answered', () => {
  // A route that answered before the operations behind it existed would be
  // documented and inert; and a 404 that named what was asked for would
  // echo whatever a caller typed into a path, a token pasted there among
  // it. One fixed answer, for every method and path the API does not hold.
  test('answers every other method and path 404, with one body that echoes nothing', async () => {
    const listening = await server()
    const asked = [
      ['GET', '/v1'],
      ['GET', '/v1/templates'],
      ['PUT', '/v1/templates/a/draft'],
      ['POST', '/v1/whoami'],
      ['DELETE', '/v1/whoami'],
      ['HEAD', '/v1/whoami'],
      ['GET', '/v2/whoami'],
      ['GET', '/v1/whoami/extra'],
      ['GET', '/v1/eyJhbGciOiJIUzI1NiJ9.secret'],
    ] as const
    for (const [method, url] of asked) {
      const answer = await listening.inject({ method, url, headers: { authorization: 'Bearer good' } })
      expect(answer.statusCode, `${method} ${url}`).toBe(404)
      if (method !== 'HEAD') expect(answer.body, `${method} ${url}`).toBe('{"code":"not-found","message":"Nothing answers this request."}')
    }
  })

  // Nothing would read the body of a request no route answers, and it was
  // read and parsed all the same before the 404: broken JSON was a 400 and
  // a body past Fastify's limit a 413, neither counted by the limit, so a
  // client sent as many as it liked. Answered before the body, and counted.
  test('counts and answers a request no route answers before reading its body', async () => {
    const limited = await server({ rateLimit: { max: 3, timeWindowMs: 60_000 } })
    const statuses = []
    for (const payload of ['{', '{', `"${'x'.repeat(1_100_000)}"`, '{']) {
      const answer = await limited.inject({ method: 'POST', url: '/anything', headers: { 'content-type': 'application/json' }, payload })
      statuses.push(answer.statusCode)
      if (answer.statusCode === 404) expect(answer.headers.connection).toBe('close')
    }
    expect(statuses).toEqual([404, 404, 404, 429])
  })

  // A route that hands its request to the not-found handler gets the one
  // 404 too, never Fastify's own, whose sentence and log line name the path.
  test('answers a request handed to the not-found handler with the one 404', async () => {
    const listening = await server()
    listening.get('/handed-on', async (_request, reply) => reply.callNotFound())
    const answer = await listening.inject({ method: 'GET', url: '/handed-on' })
    expect(answer.statusCode).toBe(404)
    expect(answer.body).toBe('{"code":"not-found","message":"Nothing answers this request."}')
  })

  // An error a request caused -- once a route reads a body, one that does
  // not parse -- is answered with its status and the fixed sentence, never
  // Fastify's message, which quotes what the request sent.
  test('answers an error the request caused with its status and the fixed 400 sentence', async () => {
    const listening = await server()
    listening.get('/refusing', async () => {
      throw Object.assign(new Error('Unsupported Media Type: text/a-pasted-secret'), { statusCode: 415 })
    })
    const answer = await listening.inject({ method: 'GET', url: '/refusing' })
    expect(answer.statusCode).toBe(415)
    expect(answer.body).toBe('{"code":"bad-request","message":"The request could not be read."}')
  })

  // A verifier that throws is the server's fault, not the caller's: 500,
  // with a sentence that says nothing of why.
  test('answers an error of its own 500, with nothing of the error in it', async () => {
    const throwing: ReportVerifier = async () => {
      throw new Error('the key store at /run/secret/x could not be read')
    }
    const answer = await (await server({ verifyIdentity: throwing })).inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer good' } })
    expect(answer.statusCode).toBe(500)
    expect(answer.body).toBe('{"code":"internal","message":"The server could not answer this request."}')
  })
})

describe('a path that is not plain', () => {
  // A proxy in front may decode a path, resolve its dot segments or
  // collapse its slashes before it chooses where to forward it, while the
  // router matches the path as sent: /v1/%77hoami reached whoami, and a
  // proxy filtering by path would not have seen it as whoami. A path with
  // anything to normalise is refused before any route's work, by
  // formancy.ai-data 0037's rule, and a path whose escape does not decode,
  // which Fastify's router refuses quoting it, the same.
  test('is the one 400, quoting nothing, before any route', async () => {
    const listening = await server()
    const refusal = '{"code":"path-not-plain","message":"This path holds an escape, an empty or a dot segment, or a character a path does not carry as itself. No route here is written that way, and a proxy in front of this server may read such a path otherwise, so it was not routed."}'
    for (const url of ['/v1/%77hoami', '/%76%31/whoami', '/h%65alth', '/v1//whoami', '/v1/whoami/', '/', '/v1/who%2Fami', '/v1/%E0%A4%A', '/v1/a-pasted%20secret']) {
      const answer = await listening.inject({ method: 'GET', url, headers: { authorization: 'Bearer good' } })
      expect(answer.statusCode, url).toBe(400)
      expect(answer.body, url).toBe(refusal)
      expect(answer.headers['cache-control'], url).toBe('no-store')
    }
    // The query is not routed by, and is left alone.
    expect((await listening.inject({ method: 'GET', url: '/v1/whoami?q=%41', headers: { authorization: 'Bearer good' } })).statusCode).toBe(200)
  })

  // A dot segment is resolved by inject's URL parser before the server
  // sees it, so it is sent over a socket, as a client sends it.
  test('is the one 400 for a dot segment, as sent', async () => {
    const listening = await server()
    await listening.listen({ host: '127.0.0.1', port: 0 })
    const { port } = listening.server.address() as AddressInfo
    for (const path of ['/v1/./whoami', '/v1/../v1/whoami', '/v1/whoami/..']) {
      const { answer } = await exchange(port, `GET ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer good\r\n\r\n`, 300)
      expect(answer, path).toMatch(/^HTTP\/1\.1 400 /)
      expect(answer, path).toContain('"code":"path-not-plain"')
    }
  })

  // A scanner trying spellings is a client like any other, /health spelt
  // otherwise among them.
  test('is counted by the limit', async () => {
    const limited = await server({ rateLimit: { max: 2, timeWindowMs: 60_000 } })
    const statuses = []
    for (let n = 0; n < 3; n += 1) statuses.push((await limited.inject({ method: 'GET', url: '/h%65alth' })).statusCode)
    expect(statuses).toEqual([400, 400, 429])
  })
})

describe('a request that holds its connection', () => {
  let port = 0
  const listening = async (overrides: Partial<ReportServerOptions> = {}) => {
    const made = await server(overrides)
    await made.listen({ host: '127.0.0.1', port: 0 })
    port = (made.server.address() as AddressInfo).port
  }

  // A body sent a byte at a time to a path nothing answers held its
  // connection open for as long as the client liked: the 404 waited for a
  // body nothing would read. Answered at once, and the connection closed.
  test('is answered at once, and closed, when no route answers it', async () => {
    await listening()
    const { answer, closed } = await exchange(port, 'POST /nope HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{')
    expect(answer).toMatch(/^HTTP\/1\.1 404 /)
    expect(closed).toBe(true)
  })

  // A preflight carries no body; one that does was parsed, uncounted,
  // whatever it held, and a slow one held its connection like the 404's.
  test('is refused at once, and closed, when it is a preflight with a body', async () => {
    await listening({ origins: ['https://app.example'] })
    const { answer, closed } = await exchange(port, 'OPTIONS /v1/whoami HTTP/1.1\r\nHost: 127.0.0.1\r\nOrigin: https://app.example\r\nAccess-Control-Request-Method: GET\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{')
    expect(answer).toMatch(/^HTTP\/1\.1 400 /)
    expect(answer).toContain('{"code":"bad-request","message":"The request could not be read."}')
    expect(closed).toBe(true)
  })

  // Fastify sets no limit on how long a request may take to arrive, so a
  // body sent slowly to a route that reads none -- whoami's, health's --
  // held its connection for good. Node's own default bounds it.
  test('is bounded by Node’s own request timeout', async () => {
    await listening()
    expect(REQUEST_TIMEOUT_MS).toBe(300_000)
    expect(app?.server.requestTimeout).toBe(REQUEST_TIMEOUT_MS)
  })
})

describe('a request Node cannot read', () => {
  const bodyOf = (answer: string) => answer.slice(answer.indexOf('\r\n\r\n') + 4)

  // Node's parser answers these before any hook, and Fastify wrote its own
  // body without Cache-Control; each is the fixed refusal, no-store, and
  // quotes nothing of what was sent.
  test('is the fixed refusal, no-store, for a malformed header and a header block past the limit', async () => {
    const made = await server()
    await made.listen({ host: '127.0.0.1', port: 0 })
    const { port } = made.server.address() as AddressInfo
    const malformed = await exchange(port, 'GET /v1/whoami HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization Bearer a-pasted-secret\r\n\r\n')
    const overflowing = await exchange(port, `GET /v1/whoami HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Pasted: a-pasted-secret${'x'.repeat(20_000)}\r\n\r\n`)
    for (const [{ answer, closed }, status] of [
      [malformed, '400 Bad Request'],
      [overflowing, '431 Request Header Fields Too Large'],
    ] as const) {
      expect(answer.startsWith(`HTTP/1.1 ${status}\r\n`), answer).toBe(true)
      expect(answer.toLowerCase()).toContain('\r\ncache-control: no-store\r\n')
      expect(bodyOf(answer)).toBe('{"code":"bad-request","message":"The request could not be read."}')
      expect(answer).not.toContain('a-pasted-secret')
      expect(closed).toBe(true)
    }
  })
})

describe('what every answer says', () => {
  // Nothing this server answers may be kept by a cache (formancy.ai-data
  // 0037): whoami is a person's identity, and a cache that did not treat
  // Authorization as private would hand it to the next caller.
  test('says Cache-Control no-store on health, an identity, a refusal, a 404 and a 429', async () => {
    const limited = await server({ rateLimit: { max: 1, timeWindowMs: 60_000 } })
    const answers = [
      await limited.inject({ method: 'GET', url: '/health' }),
      await limited.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer good' } }),
      await limited.inject({ method: 'GET', url: '/v1/whoami' }),
      await limited.inject({ method: 'GET', url: '/nothing' }),
    ]
    expect(answers.map((answer) => answer.statusCode)).toEqual([200, 200, 429, 429])
    for (const answer of answers) expect(answer.headers['cache-control']).toBe('no-store')
  })
})

describe('the rate limit', () => {
  // Every token presented is a signature check; without a limit a client
  // replays forgeries as fast as the network allows. /health is exempt,
  // because an orchestrator polling it must not see a busy server as dead.
  // A path that answers 404 is counted too: a scanner walking paths is a
  // client like any other.
  test('limits requests per client address, 404s included, but not health', async () => {
    const limited = await server({ rateLimit: { max: 2, timeWindowMs: 60_000 } })
    const statuses = []
    for (const url of ['/v1/whoami', '/nothing', '/v1/whoami']) statuses.push((await limited.inject({ method: 'GET', url, headers: { authorization: 'Bearer bad' } })).statusCode)
    expect(statuses).toEqual([401, 404, 429])
    const refused = await limited.inject({ method: 'GET', url: '/v1/whoami' })
    expect(refused.json()).toEqual({ code: 'rate-limited', message: 'Too many requests came from this address; wait a minute and ask again.' })
    expect(refused.headers['retry-after']).toBeDefined()
    for (let n = 0; n < 5; n += 1) expect((await limited.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200)
  })

  // A limit nobody could have chosen does not start a server.
  test('does not start with a limit the setting could not say', async () => {
    await expect(server({ rateLimit: { max: 0, timeWindowMs: 60_000 } })).rejects.toThrow('rateLimit is { max, timeWindowMs }')
    await expect(server({ trustedProxies: ['*'] })).rejects.toThrow(/^trustedProxies\[0\] trusts every peer/)
  })
})

describe('the log', () => {
  // Fastify reads `logger: false` as no log, and a JavaScript embedder
  // writes it so; here the log is off only when `logger` is absent, and
  // anything else that is not a stream to write to -- false, {}, a stream
  // with no write -- would turn it on, every line to standard output, which
  // the embedder had asked to keep quiet. Each is refused before anything
  // is built, as every other option is.
  test('does not start with a logger that is not a stream to write each line to', async () => {
    for (const logger of [false, true, null, {}, { stream: {} }, { stream: { write: 'stdout' } }, { stream: null }]) {
      const outcome = await server({ logger: logger as never }).then(
        async (started) => (await started.close(), 'started'),
        (error: Error) => error.message,
      )
      expect(outcome, JSON.stringify(logger)).toBe('logger is { stream } whose write(line) takes each log line; leave it out for no log.')
    }
  })

  // The log is where the audit trail goes and whoever runs the collector
  // reads it. A request is named by its method and the route that answered
  // it, never the path, query or Host as sent; a refused token by the
  // verifier's reason, never the token; and no line holds a claim's value.
  test('names a request by its method and route, and never holds the token, the path as sent or a claim’s value', async () => {
    const lines: string[] = []
    const real = await createReportVerifier({ key: { kind: 'secret', secret: SECRET }, issuer: ISSUER, audience: AUDIENCE, tenantClaim: 'tid' })
    const logged = await server({ verifyIdentity: real, logger: { stream: { write: (line) => void lines.push(line) } } })
    const good = await signed({ tid: 'tenant-of-acme', sub: undefined }, (jwt) => jwt.setSubject('person-at-acme'))
    const bad = await signed({}, (jwt) => jwt.setIssuer('https://other.example'))
    await logged.inject({ method: 'GET', url: '/v1/whoami?password=hunter2', headers: { authorization: `Bearer ${good}`, host: 'secret-host.example' } })
    await logged.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: `Bearer ${bad}` } })
    await logged.inject({ method: 'GET', url: '/v1/a-pasted-token-in-a-path', headers: { authorization: `Bearer ${good}` } })
    // A path that is not plain, matched to a route or not, and one whose escape does not decode: each the one 400.
    for (const url of ['/v1/%77hoami/a-pasted-plain', '/v1/who%61mi?pasted-query=1', '/v1/%E0%A4%A-pasted-escape']) expect((await logged.inject({ method: 'GET', url })).statusCode, url).toBe(400)
    const log = lines.join('')
    expect(log).toContain('"route":"/v1/whoami"')
    expect(log).toContain('host identity refused')
    expect(log).toContain('ERR_JWT_CLAIM_VALIDATION_FAILED')
    for (const part of [good, bad, ...good.split('.'), ...bad.split('.'), 'hunter2', 'password', 'secret-host', 'a-pasted-token', 'a-pasted-plain', 'pasted-query', 'pasted-escape', '%E0', '%77', '%61', 'tenant-of-acme', 'person-at-acme']) expect(log, part).not.toContain(part)
  })

  // A line names the connection a request came on by the address the
  // limiter counts and, where that is the peer's, the peer's port, which
  // tells apart two clients behind one address. Behind a trusted proxy the
  // address is the one it forwarded, and the port is the proxy's own
  // connection's: paired with the client's address, the line would send
  // whoever traces it to a connection that client never made. Over a
  // socket, since inject's has no port.
  test('names the peer’s port beside its own address, and none beside an address a proxy forwarded', async () => {
    const lines: string[] = []
    const logged = await server({ trustedProxies: ['127.0.0.1'], logger: { stream: { write: (line) => void lines.push(line) } } })
    await logged.listen({ host: '127.0.0.1', port: 0 })
    const { port } = logged.server.address() as AddressInfo
    const ask = (headers: string) => exchange(port, `GET /v1/whoami HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer good\r\n${headers}Connection: close\r\n\r\n`)
    const direct = await ask('')
    const forwarded = await ask('X-Forwarded-For: 198.51.100.7\r\n')
    expect([direct.answer, forwarded.answer].map((answer) => answer.slice(0, 15))).toEqual(['HTTP/1.1 200 OK', 'HTTP/1.1 200 OK'])
    const requests = lines.map((line) => JSON.parse(line) as { msg: string; req?: unknown }).filter((line) => line.msg === 'incoming request')
    expect(requests.map((line) => line.req)).toEqual([
      { method: 'GET', route: '/v1/whoami', remoteAddress: '127.0.0.1', remotePort: direct.from },
      { method: 'GET', route: '/v1/whoami', remoteAddress: '198.51.100.7' },
    ])
  })
})
