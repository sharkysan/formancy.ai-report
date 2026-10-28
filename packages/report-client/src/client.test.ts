import { createHmac } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createReportServer, createReportVerifier, openFileTemplateStore } from '@formancy/report-server'
import { REFUSALS } from '@formancy/report-server-core'
import { assetDigest, emptyReport } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createReportClient } from './client.js'
import type { Answered, ReportClientOptions } from './client.js'

/**
 * The client against report-server itself (0049): a server made in this
 * process over the file store, on a directory made for each case, listening
 * on a socket and asked through Node's own fetch with tokens this suite
 * signs as a host -- so what the client sends is what the routes read, and
 * what it answers is what they sent, never a stub's idea of either. A stub
 * fetch stands in only where no server of this release answers as a case
 * needs: a gateway's 502, a body that is no JSON, a refusal the API never
 * gives.
 */
const HOST = { secret: 'the-client-suites-own-secret-of-at-least-32-bytes', issuer: 'https://login.example', audience: 'formancy-report' } as const
const SUBJECT = 'author-only-this-suite-names'

const base64url = (text: string) => Buffer.from(text).toString('base64url')
/** An HS256 token as the host signs one, with node:crypto alone: an author of acme for five minutes, unless `claims` say otherwise. */
function signed(claims: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000)
  const body = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ iss: HOST.issuer, aud: HOST.audience, sub: SUBJECT, tid: 'acme', roles: ['report-authors'], iat: now, exp: now + 300, ...claims }))}`
  return `${body}.${createHmac('sha256', HOST.secret).update(body).digest('base64url')}`
}

const report = (id = 'invoice', title = 'Invoice'): ReportDefinition => emptyReport(id, title, 'en')
/** A 1 by 1 PNG, which report-spec's sniffer and header reader take for one; its bytes are not text. */
const PNG = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'))

/** The value of an answer the case expects to be one; a refusal fails the case, naming it. */
function valueOf<T>(answered: Answered<T>): T {
  if (!answered.ok) throw new Error(`refused ${String(answered.status)} ${answered.refusal.code}`)
  return answered.value
}

/** Listens on a port of its own on 127.0.0.1, and answers its base URL. */
async function listening(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
}

describe('against report-server', () => {
  let directory: string
  let server: Awaited<ReturnType<typeof createReportServer>>
  let at: string
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'formancy-report-client-'))
    const opened = await openFileTemplateStore(directory)
    if (!opened.ok) throw new Error(opened.problem)
    const verifyIdentity = await createReportVerifier({ key: { kind: 'secret', secret: HOST.secret }, issuer: HOST.issuer, audience: HOST.audience, tenantClaim: 'tid' })
    server = await createReportServer({ verifyIdentity, roles: { author: ['report-authors'], publisher: ['report-publishers'], admin: ['report-admins'] }, store: opened.store })
    await server.listen({ host: '127.0.0.1', port: 0 })
    at = `http://127.0.0.1:${String((server.server.address() as AddressInfo).port)}`
  })
  // The server is closed before its directory is removed: removed first, a
  // server still answering would write into a directory that is going.
  afterEach(async () => {
    await server.close()
    await rm(directory, { recursive: true, force: true })
  })

  /** A client of this case's server, with the host's token, asked for as a promise, unless `options` say otherwise. */
  const client = (options: Partial<ReportClientOptions> = {}) => createReportClient({ server: at, token: async () => signed(), ...options })

  // A host's Save is a create the first time and a replace from the
  // revision it opened after. A client that sent no precondition would be
  // refused every save, and one that sent the wrong one would overwrite
  // another author's work or never save twice; the revision the next save
  // names is the one the read answered, in its body.
  test('creates a draft, reads it back, and replaces it from the revision it read', async () => {
    const reports = client()
    expect(await reports.listTemplates()).toEqual({ ok: true, value: { templates: [] } })
    expect(await reports.saveDraft('invoice', report(), null)).toEqual({ ok: true, value: { template: 'invoice', revision: 1 } })
    const opened = valueOf(await reports.readDraft('invoice'))
    expect(opened).toEqual({ format: 1, template: 'invoice', revision: 1, savedBy: SUBJECT, report: report() })
    expect(await reports.saveDraft('invoice', report('invoice', 'Changed'), opened.revision)).toEqual({ ok: true, value: { template: 'invoice', revision: 2 } })
    expect(valueOf(await reports.readDraft('invoice')).report).toEqual(report('invoice', 'Changed'))
    expect(await reports.listTemplates()).toEqual({ ok: true, value: { templates: [{ template: 'invoice', revision: 2, title: 'Changed' }] } })
  })

  // Two authors open revision 1 and both save. The second must hear that
  // someone saved since, with the revision that stands, so that its host
  // can offer the newest; a client that threw, or answered without the
  // revision, would leave the host nothing to offer. A create of a
  // template that exists is the same refusal.
  test('answers a save from a revision no longer the newest draft-changed, with the revision that stands, and writes nothing', async () => {
    const reports = client()
    valueOf(await reports.saveDraft('invoice', report(), null))
    valueOf(await reports.saveDraft('invoice', report('invoice', 'Theirs'), 1))
    const changed = { ok: false, status: 412, refusal: { ...REFUSALS['draft-changed'], revision: 2 } }
    expect(await reports.saveDraft('invoice', report('invoice', 'Mine'), 1)).toEqual(changed)
    expect(await reports.saveDraft('invoice', report('invoice', 'Mine'), null)).toEqual(changed)
    expect(valueOf(await reports.readDraft('invoice')).report).toEqual(report('invoice', 'Theirs'))
  })

  // A builder keeps the image a person adds before the draft that declares
  // it can save, and reads it back by the digest the report names it by.
  // Read as text, or sent as anything but its own media type, the bytes
  // would come back other than they went, or never be kept. An image not
  // kept yet is the API's refusal, which a host opening a draft answers
  // for that image alone, and never a throw that fails the whole draft.
  test('keeps an image and reads back its bytes and media type by the digest a report names it by', async () => {
    const reports = client()
    const declaring = { ...report(), assets: [{ id: 'logo', mediaType: 'image/png' as const, digest: assetDigest(PNG) }] }
    expect(await reports.readImage(assetDigest(PNG))).toEqual({ ok: false, status: 404, refusal: REFUSALS['no-asset'] })
    expect(await reports.saveDraft('invoice', declaring, null)).toEqual({ ok: false, status: 422, refusal: { ...REFUSALS['asset-not-kept'], assets: ['logo'] } })
    expect(await reports.keepImage(PNG, assetDigest(PNG), 'image/png')).toEqual({ ok: true, value: { digest: assetDigest(PNG) } })
    expect(await reports.readImage(assetDigest(PNG))).toEqual({ ok: true, value: { mediaType: 'image/png', bytes: PNG } })
    expect(await reports.saveDraft('invoice', declaring, null)).toEqual({ ok: true, value: { template: 'invoice', revision: 1 } })
  })

  // A token expires while a person edits. The host's next token must be
  // the one the next request carries: a client that asked once would send
  // the expired one for good, and every save after it would be refused.
  test('answers an expired token unauthenticated, and asks the host for the token again before the next request', async () => {
    let asked = 0
    let current = signed({ exp: Math.floor(Date.now() / 1000) - 60 })
    const reports = client({ token: () => ((asked += 1), current) })
    expect(await reports.listTemplates()).toEqual({ ok: false, status: 401, refusal: REFUSALS.unauthenticated })
    current = signed()
    expect(await reports.listTemplates()).toEqual({ ok: true, value: { templates: [] } })
    expect(asked).toBe(2)
  })

  // A template id is one segment of the path, whatever a host passes.
  // Written into the path as it is, `invoice/draft#` would end the path at
  // its `#` and read the invoice's draft; escaped, it is a path the server
  // refuses, and no other template is read.
  test('puts a template id into the path as one segment, never as a path of its own', async () => {
    const reports = client()
    valueOf(await reports.saveDraft('invoice', report(), null))
    expect(await reports.readDraft('invoice/draft#')).toEqual({ ok: false, status: 400, refusal: REFUSALS['path-not-plain'] })
  })

  // Nothing the client sends goes anywhere but the server it was given. A
  // redirect followed would carry the request -- a template, an image --
  // to wherever a proxy or a server that was not Report's pointed it.
  // Refused as fetch refuses it, with a network error, and nothing reaches
  // the other address.
  test('follows no redirect, and nothing reaches the address a redirect names', async () => {
    const reached: string[] = []
    const elsewhere = createServer((request, response) => void (reached.push(request.url ?? ''), response.end('{"templates":[]}')))
    const there = await listening(elsewhere)
    const redirecting = createServer((request, response) => void response.writeHead(307, { location: `${there}${request.url ?? ''}` }).end())
    try {
      const reports = createReportClient({ server: await listening(redirecting), token: () => signed() })
      await expect(reports.listTemplates()).rejects.toThrow(TypeError)
      await expect(reports.saveDraft('invoice', report(), null)).rejects.toThrow(TypeError)
      expect(reached).toEqual([])
    } finally {
      await Promise.all([elsewhere, redirecting].map((each) => new Promise((resolve) => each.close(resolve))))
    }
  })
})

describe('against what is not report-server', () => {
  /** A fetch that answers `response` to every request, and records each URL and init it was given. */
  const answering = (response: () => Response) => {
    const asked: { url: string; init: RequestInit | undefined }[] = []
    const fetch = async (url: string | URL | Request, init?: RequestInit) => (asked.push({ url: String(url), init }), response())
    return { fetch, asked }
  }
  const client = (fetch: ReportClientOptions['fetch']) => createReportClient({ server: 'https://reports.example', token: () => 'a-token', ...(fetch === undefined ? {} : { fetch }) })

  // A gateway in front of the server answers when the server cannot: a
  // 502 page, a body cut off. None is the API's answer, and none may be
  // taken for a value or a refusal. Each throws, naming the status and the
  // route by its pattern -- never the id or the digest the request carried,
  // which an error report would otherwise carry off.
  test('throws on an answer that is not the API’s, naming the status and the route, and nothing the request carried', async () => {
    const template = 'ledger-only-this-test-names'
    const cases: [number, string, RegExp][] = [
      [502, '<html>Bad gateway</html>', /502/],
      [200, '{"templates": [', /200/],
      [200, 'null', /200/],
      [200, '[]', /200/],
      [503, '{"code": "unavailable", "message": "Not this API’s."}', /503/],
      [500, '{"code": "toString", "message": "An inherited name is no refusal."}', /500/],
      [404, '{"code": "not-found"}', /404/],
    ]
    for (const [status, body, named] of cases) {
      const { fetch } = answering(() => new Response(body, { status }))
      const thrown = await client(fetch)
        .readDraft(template)
        .then(
          () => undefined,
          (error: unknown) => error,
        )
      expect(thrown, `${String(status)} ${body}`).toBeInstanceOf(Error)
      expect((thrown as Error).message).toMatch(named)
      expect((thrown as Error).message).toContain('GET /v1/templates/:template/draft')
      expect((thrown as Error).message).not.toContain(template)
    }
  })

  // The four refusals that carry a field are typed with it, and a host
  // branching on the code reads it: `draft-changed`'s revision is what its
  // reload offers. A body naming one of the four without its field is not
  // the API's answer, and is thrown rather than answered as one the type
  // says it is.
  test('throws on a refusal that names one of the four fielded codes without its field', async () => {
    const without = [
      { ...REFUSALS['report-invalid'] },
      { ...REFUSALS['report-invalid'], errors: 'not a list' },
      { ...REFUSALS['draft-changed'] },
      { ...REFUSALS['draft-changed'], revision: 0 },
      { ...REFUSALS['asset-not-kept'], assets: [1] },
      { ...REFUSALS['image-refused'] },
      { ...REFUSALS['forbidden'], message: 7 },
    ]
    for (const body of without) {
      const { fetch } = answering(() => Response.json(body, { status: 422 }))
      await expect(client(fetch).saveDraft('invoice', report(), null), JSON.stringify(body)).rejects.toThrow(/422/)
    }
    const { fetch } = answering(() => Response.json({ ...REFUSALS['draft-changed'], revision: null }, { status: 412 }))
    expect(await client(fetch).saveDraft('invoice', report(), 3)).toEqual({ ok: false, status: 412, refusal: { ...REFUSALS['draft-changed'], revision: null } })
  })

  // An image's answer is its bytes under its media type. One under any
  // type an asset may not be -- a gateway's HTML page, a JSON body -- or
  // under none is not an image, and is thrown rather than handed to a
  // renderer as one.
  test('throws on an image answered under a media type no image asset is, or none', async () => {
    for (const type of ['text/html', 'application/json', 'font/ttf']) {
      const { fetch } = answering(() => new Response(PNG, { status: 200, headers: { 'content-type': type } }))
      await expect(client(fetch).readImage(assetDigest(PNG)), type).rejects.toThrow(/200/)
    }
    const { fetch: untyped } = answering(() => new Response(PNG, { status: 200 }))
    await expect(client(untyped).readImage(assetDigest(PNG))).rejects.toThrow(/200/)
    const { fetch } = answering(() => new Response(PNG, { status: 200, headers: { 'content-type': 'Image/SVG+XML; charset=utf-8' } }))
    expect(valueOf(await client(fetch).readImage(assetDigest(PNG))).mediaType).toBe('image/svg+xml')
  })

  // A network that fails is the host's to retry or to report, as fetch
  // gave it; the client neither swallows it nor dresses it as a refusal.
  test('lets a network error through as fetch gave it', async () => {
    const failure = new TypeError('fetch failed')
    await expect(client(() => Promise.reject(failure)).listTemplates()).rejects.toBe(failure)
  })

  // A report names an image by `sha256:` and its hexadecimal digits, and
  // the path carries the digits alone. A digest in any other form is
  // nothing the client can put in the path as the report means it; sent
  // as it is, a bare hexadecimal digest would be kept under a name the
  // host never gave it.
  test('refuses a digest not written as a report names one, before any request', async () => {
    const { fetch, asked } = answering(() => Response.json({}))
    const hex = assetDigest(PNG).slice('sha256:'.length)
    await expect(client(fetch).keepImage(PNG, hex, 'image/png')).rejects.toThrow(/sha256:/)
    await expect(client(fetch).readImage(`SHA256:${hex}`)).rejects.toThrow(/sha256:/)
    expect(asked).toEqual([])
  })

  // What the routes read: the token as a bearer, a save's precondition in
  // the header the server names, a body under its own media type, a
  // digest's digits in the path, and the method the route is answered by.
  test('sends each route its method, its path under the base URL, the token as a bearer and a save’s precondition', async () => {
    const { fetch, asked } = answering(() => Response.json({}))
    const reports = client(fetch)
    await reports.saveDraft('invoice', report(), null)
    await reports.saveDraft('invoice', report(), 12)
    await reports.keepImage(PNG, assetDigest(PNG), 'image/png')
    const sent = asked.map(({ url, init }) => ({ url, method: init?.method, headers: init?.headers, redirect: init?.redirect }))
    const hex = assetDigest(PNG).slice('sha256:'.length)
    expect(sent).toEqual([
      { url: 'https://reports.example/v1/templates/invoice/draft', method: 'PUT', headers: { authorization: 'Bearer a-token', 'content-type': 'application/json', 'if-none-match': '*' }, redirect: 'error' },
      { url: 'https://reports.example/v1/templates/invoice/draft', method: 'PUT', headers: { authorization: 'Bearer a-token', 'content-type': 'application/json', 'if-match': '"12"' }, redirect: 'error' },
      { url: `https://reports.example/v1/assets/${hex}`, method: 'PUT', headers: { authorization: 'Bearer a-token', 'content-type': 'image/png' }, redirect: 'error' },
    ])
    expect(JSON.parse(String(asked[0]?.init?.body))).toEqual(report())
    expect(asked[2]?.init?.body).toEqual(PNG)
  })

  // A browser's own fetch refuses to be called as a method of anything but
  // the window ("Illegal invocation"). Called as a method of the options it
  // came in, every request a page made would throw.
  test('calls the fetch it is given as a function, as a browser’s own fetch must be called', async () => {
    function strict(this: unknown): Promise<Response> {
      if (this !== undefined && this !== globalThis) return Promise.reject(new TypeError('Illegal invocation'))
      return Promise.resolve(Response.json({ templates: [] }))
    }
    expect(await client(strict).listTemplates()).toEqual({ ok: true, value: { templates: [] } })
  })

  // Every path is the base URL followed by the route's own. A base with a
  // query or a fragment would swallow the path into it and send every
  // request to the base itself; one with a trailing slash would double
  // the slash, which the server refuses; credentials in it would travel
  // in every URL. A URL object, which a JavaScript host may pass, is
  // written with a trailing slash. Each is refused when the client is
  // made, naming the rule and never the URL, which may hold a password.
  test('refuses a base URL it could not put a route’s path after', () => {
    const object = new URL('https://reports.example') as unknown as string
    for (const server of ['https://reports.example/', 'https://example.com/reports/', 'https://reports.example?', 'https://reports.example?tenant=a', 'https://reports.example#top', 'https://user:a-password@reports.example', 'ftp://reports.example', 'reports.example', '', object]) {
      expect(() => createReportClient({ server, token: () => 'a-token' }), server).toThrow(/base URL/)
      try {
        createReportClient({ server, token: () => 'a-token' })
      } catch (error) {
        expect((error as Error).message).not.toContain('a-password')
      }
    }
    for (const server of ['https://reports.example', 'https://example.com/reports', 'http://127.0.0.1:4392']) expect(() => createReportClient({ server, token: () => 'a-token' }), server).not.toThrow()
  })
})
