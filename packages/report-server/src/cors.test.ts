import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TemplateStore } from '@formancy/report-server-core'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createReportServer } from './app.js'
import type { ReportServerOptions } from './app.js'
import { corsOriginsSetting, originsProblem, PREFLIGHT_MAX_AGE_SECONDS, varyWith } from './cors.js'
import { openFileTemplateStore } from './file-store.js'
import type { ReportVerifier } from './identity.js'

/**
 * Across origins, by formancy.ai-data 0060's rule: the API answers a page
 * on another origin when the operator lists that origin exactly, and
 * nothing else does. A builder in the host's page reads the server with
 * the person's token; a page nobody listed is refused before its token is
 * read.
 */
describe('corsOriginsSetting', () => {
  // Unset, Compose's "", or nothing but commas: no origin.
  test('lists no origin unset or empty', () => {
    for (const text of [undefined, '', ' , ']) expect(corsOriginsSetting(text)).toEqual({ ok: true, origins: [] })
  })

  // An origin is matched against Origin byte for byte, so each is kept as
  // written and once; the space around an entry is the list's, never the
  // origin's, and a port or loopback's plain HTTP is part of the origin.
  test('reads origins exactly as a browser sends Origin, each once', () => {
    expect(corsOriginsSetting(' https://app.example ,https://b.example:8443, http://localhost:5173,http://127.0.0.1:3000,http://[::1]:8080,https://app.example')).toEqual({
      ok: true,
      origins: ['https://app.example', 'https://b.example:8443', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://[::1]:8080'],
    })
  })

  // Each is a list nobody could have meant as written: a wildcard grants
  // every page, the opaque origin every sandboxed one, a spelling no
  // browser sends is never matched, and plain HTTP across a network is a
  // token anyone on the path reads.
  test('refuses wildcards, patterns, the opaque origin, a spelling no browser sends and plain HTTP off loopback', () => {
    const cases = {
      '*': 'is a wildcard or the opaque origin',
      null: 'is a wildcard or the opaque origin',
      'https://*.example': 'names a pattern or a host that is no DNS name or IP address',
      'app.example': 'is not an origin',
      'https://app.example/': 'is not written as a browser sends Origin',
      'https://App.example': 'is not written as a browser sends Origin',
      'https://app.example:443': 'is not written as a browser sends Origin',
      'https://user@app.example': 'is not written as a browser sends Origin',
      'ftp://app.example': 'is not an https: origin',
      'http://app.example': 'is plain HTTP on a host other than localhost',
    }
    for (const [text, says] of Object.entries(cases)) {
      const read = corsOriginsSetting(text)
      expect(read.ok, text).toBe(false)
      if (!read.ok) expect(read.problem.startsWith(`FORMANCY_REPORT_CORS_ORIGINS: entry 1 ${says}`), `${text}: ${read.problem}`).toBe(true)
    }
  })

  // An embedder's list reaches the same grant as the setting's, so it is
  // held to the same rule: a list that is no list, or a wildcard among good
  // entries, does not start a server, and is named by its place.
  test('holds an embedder’s list to the same rule, by place', () => {
    expect(originsProblem(['https://app.example'])).toBeUndefined()
    expect(originsProblem('https://app.example')).toBe('origins is not a list of origins.')
    expect(originsProblem(['https://app.example', '*'])).toMatch(/^origins\[1\] is a wildcard/)
  })

  // An embedder that hands over URL objects, or a number, is told that the
  // entry is no string. Read as one, a URL object is written exactly as a
  // browser sends Origin and still never equal to the header, so it was
  // refused as "not written as a browser sends Origin", sending the
  // embedder to respell an origin it had spelt right.
  test('names an entry that is no string as no string', () => {
    expect(originsProblem([new URL('https://app.example')])).toBe('origins[0] is not a string.')
    expect(originsProblem(['https://app.example', 443])).toBe('origins[1] is not a string.')
  })
})

/** Accepts the literal token `good`, of tenant acme. */
const verifyIdentity: ReportVerifier = async (token) => (token === 'good' ? { ok: true, identity: { subject: 'u-1', tenant: 'acme', roles: ['report-authors'] } } : { ok: false, reason: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' })
const roles = { author: ['report-authors'], publisher: [], admin: [] }

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
  storeDirectory = await mkdtemp(join(tmpdir(), 'formancy-report-cors-'))
  const opened = await openFileTemplateStore(storeDirectory)
  if (!opened.ok) throw new Error(opened.problem)
  store = opened.store
})
afterEach(async () => {
  await rm(storeDirectory, { recursive: true, force: true })
})
const server = async (overrides: Partial<ReportServerOptions> = {}) => (app = await createReportServer({ verifyIdentity, roles, store, ...overrides }))

const preflight = (origin: string, method = 'GET', headers = 'authorization') => ({
  method: 'OPTIONS' as const,
  url: '/v1/whoami',
  headers: { origin, 'access-control-request-method': method, 'access-control-request-headers': headers },
})

describe('the server across origins', () => {
  // A listed origin's page may send the token to the API: the preflight
  // grants that method on that route, with the token's header and no
  // other, for as long as every engine keeps it.
  test('grants a preflight from a listed origin for a route the API answers', async () => {
    const answer = await (await server({ origins: ['https://app.example'] })).inject(preflight('https://app.example'))
    expect(answer.statusCode).toBe(204)
    expect(answer.headers['access-control-allow-origin']).toBe('https://app.example')
    expect(answer.headers['access-control-allow-methods']).toBe('GET')
    expect(answer.headers['access-control-allow-headers']).toBe('authorization')
    expect(answer.headers['access-control-max-age']).toBe(String(PREFLIGHT_MAX_AGE_SECONDS))
    expect(answer.headers['access-control-allow-credentials']).toBeUndefined()
    expect(PREFLIGHT_MAX_AGE_SECONDS).toBe(600)
  })

  // Another origin, a method the route does not answer, or a header the
  // server never reads: refused, with the reason in the log and not the
  // answer, so a page cannot probe the list.
  test('refuses a preflight from an unlisted origin, for another method, or asking another header', async () => {
    const listed = await server({ origins: ['https://app.example'] })
    for (const asked of [preflight('https://evil.example'), preflight('https://app.example', 'DELETE'), preflight('https://app.example', 'GET', 'authorization, x-tenant')]) {
      const answer = await listed.inject(asked)
      expect(answer.statusCode).toBe(403)
      expect(answer.json()).toEqual({ code: 'cross-origin-refused', message: expect.any(String) })
      expect(answer.headers['access-control-allow-origin']).toBeUndefined()
    }
  })

  // With no origin listed there is nothing to grant, so there is no
  // preflight route at all: the router's 404, as for anything else.
  test('has no preflight route with no origin listed', async () => {
    const answer = await (await server()).inject(preflight('https://app.example'))
    expect(answer.statusCode).toBe(404)
    expect(answer.json()).toEqual({ code: 'not-found', message: 'Nothing answers this request.' })
  })

  // A page on a listed origin reads the API's answers, refusals included,
  // and a cache keeps one origin's answer apart from another's.
  test('carries the listed origin back on every answer of the API, with Vary', async () => {
    const listed = await server({ origins: ['https://app.example'] })
    for (const authorization of ['Bearer good', 'Bearer bad']) {
      const answer = await listed.inject({ method: 'GET', url: '/v1/whoami', headers: { origin: 'https://app.example', 'sec-fetch-site': 'cross-site', authorization } })
      expect(answer.headers['access-control-allow-origin']).toBe('https://app.example')
      expect(answer.headers.vary).toContain('Origin')
    }
    const health = await listed.inject({ method: 'GET', url: '/health', headers: { origin: 'https://app.example' } })
    expect(health.headers['access-control-allow-origin']).toBeUndefined()
  })

  // A browser that cached a grant keeps sending without asking again for
  // up to Max-Age after its origin leaves the list. A token-bearing request
  // the browser marks cross-site, from an origin not listed, is refused
  // before the token is read, so no work is done for it.
  test('refuses a token-bearing request a browser marks cross-site from an unlisted origin, before reading its token', async () => {
    const asked: string[] = []
    const counting: ReportVerifier = async (token) => {
      asked.push(token)
      return verifyIdentity(token)
    }
    for (const origins of [[], ['https://app.example']]) {
      const refusing = await server({ origins, verifyIdentity: counting })
      for (const site of ['cross-site', 'same-site']) {
        const answer = await refusing.inject({ method: 'GET', url: '/v1/whoami', headers: { origin: 'https://evil.example', 'sec-fetch-site': site, authorization: 'Bearer good' } })
        expect(answer.statusCode).toBe(403)
        expect(answer.json().code).toBe('cross-origin-refused')
      }
      await refusing.close()
      app = undefined
    }
    expect(asked).toEqual([])
    // The same request from the page's own origin, or with no Sec-Fetch-Site, is the server's to answer.
    const answering = await server({ verifyIdentity: counting })
    expect((await answering.inject({ method: 'GET', url: '/v1/whoami', headers: { 'sec-fetch-site': 'same-origin', authorization: 'Bearer good' } })).statusCode).toBe(200)
    expect((await answering.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: 'Bearer good' } })).statusCode).toBe(200)
  })

  // A list nobody could have meant does not start a server that grants it.
  test('does not start with an origin it would refuse as a setting', async () => {
    await expect(server({ origins: ['*'] })).rejects.toThrow(/^origins\[0\] is a wildcard/)
  })

  // /health is no route the API offers across origins. A token-bearing
  // request to it that a browser marks cross-site is refused even from a
  // listed origin, before any work, and the log says that it was the route
  // and not the origin, so an operator is not sent to fix the list.
  test('refuses a token-bearing cross-site request from a listed origin to a route the API does not offer', async () => {
    const lines: string[] = []
    const listed = await server({ origins: ['https://app.example'], logger: { stream: { write: (line) => void lines.push(line) } } })
    const answer = await listed.inject({ method: 'GET', url: '/health', headers: { origin: 'https://app.example', 'sec-fetch-site': 'cross-site', authorization: 'Bearer good' } })
    expect(answer.statusCode).toBe(403)
    expect(answer.json().code).toBe('cross-origin-refused')
    const refused = lines.map((line) => JSON.parse(line) as { msg: string; reason?: string }).filter((line) => line.msg === 'cross-origin request refused')
    expect(refused.map((line) => line.reason)).toEqual(['route not offered across origins'])
  })
})

describe('varyWith', () => {
  // The API's answers vary by Origin. A route that sets Vary of its own --
  // Accept-Encoding, once one compresses -- keeps it; Origin is added once,
  // whatever case it was set in; and `*`, which varies by everything
  // already, stays `*`.
  test('adds Origin once to what a route set, and leaves * alone', () => {
    expect(varyWith(undefined, 'Origin')).toBe('Origin')
    expect(varyWith('Accept-Encoding', 'Origin')).toBe('Accept-Encoding, Origin')
    expect(varyWith(['Accept-Encoding', 'origin'], 'Origin')).toBe('Accept-Encoding, origin')
    expect(varyWith('Accept-Encoding, *', 'Origin')).toBe('*')
    expect(varyWith(' , ', 'Origin')).toBe('Origin')
  })
})

describe('the log of a refusal across origins', () => {
  // A refused origin is logged only when it is one a browser could send
  // and the operator could list: anything else -- a path, user
  // information, text that is no URL -- rides into the log with nothing.
  test('names an origin a browser sends, and nothing that is not one', async () => {
    const lines: string[] = []
    const logged = await server({ origins: ['https://app.example'], logger: { stream: { write: (line) => void lines.push(line) } } })
    for (const origin of ['https://evil.example', 'not a url, but a secret', 'https://user:password@evil.example', `https://${'a'.repeat(300)}.example`]) await logged.inject(preflight(origin))
    const refused = lines.map((line) => JSON.parse(line) as { msg: string; origin?: string }).filter((line) => line.msg === 'preflight refused')
    expect(refused.map((line) => line.origin ?? null)).toEqual(['https://evil.example', null, null, null])
    expect(lines.join('')).not.toContain('secret')
    expect(lines.join('')).not.toContain('password')
  })

  // An OPTIONS that is no browser's preflight -- a monitor's probe, a client
  // asking what a route allows -- names no origin or no method. It is
  // refused as a preflight the server will not grant, and the log says it
  // was none: read as one, it was logged as an origin not listed, or a
  // method the route does not answer, and the operator was sent to the
  // list or the route for a request that asked neither.
  test('says an OPTIONS without an origin or a method was no preflight', async () => {
    const lines: string[] = []
    const logged = await server({ origins: ['https://app.example'], logger: { stream: { write: (line) => void lines.push(line) } } })
    for (const headers of [{ 'access-control-request-method': 'GET' }, { origin: 'https://app.example' }, {}]) {
      const answer = await logged.inject({ method: 'OPTIONS', url: '/v1/whoami', headers })
      expect(answer.statusCode).toBe(403)
      expect(answer.json().code).toBe('cross-origin-refused')
      expect(answer.headers['access-control-allow-origin']).toBeUndefined()
    }
    const refused = lines.map((line) => JSON.parse(line) as { msg: string; reason?: string; origin?: string }).filter((line) => line.msg === 'preflight refused')
    expect(refused.map(({ reason, origin }) => ({ reason, origin: origin ?? null }))).toEqual([
      { reason: 'not a preflight', origin: null },
      { reason: 'not a preflight', origin: 'https://app.example' },
      { reason: 'not a preflight', origin: null },
    ])
  })
})
