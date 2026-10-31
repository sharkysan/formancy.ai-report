import { createHash } from 'node:crypto'
import { chmod, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { REFUSALS } from '@formancy/report-server-core'
import type { AuditEvent } from '@formancy/report-server-core'
import { assetDigest, emptyReport, MAX_ASSET_BYTES, MAX_REPORT_BYTES } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { beforeAll, describe, expect, test } from 'vitest'
import type { ReportServerOptions } from './app.js'
import { auditReference } from './audit.js'
import { parsePrecondition } from './drafts.js'
import type { ReportVerifier } from './identity.js'
import { eachCase, exchange, hostVerifier, signed } from './test-support.js'

/**
 * The draft slice's routes (0049): thin adapters over report-server-core's
 * use cases, which decide; what is proved here is what the routes add --
 * the headers parsed and sent, the bodies read and bounded, the status the
 * use case gave -- and that no body is read before the request's identity
 * and origin are. Through `inject` with tokens the host signs and the
 * verifier a deployment runs, on the file store over a directory made for
 * each case; over a socket where only a socket shows it: an answer that
 * does not wait for a body, a connection closed, a client that leaves.
 */
const roles = { author: ['report-authors'], publisher: ['report-publishers'], admin: ['report-admins'] }
const cases = eachCase('formancy-report-drafts-')

let verifyIdentity: ReportVerifier
/** An author, a publisher and an administrator of acme, and an author of globex; the subject is an author's alone. */
let AUTHOR: string
let PUBLISHER: string
let ADMIN: string
let GLOBEX: string
const SUBJECT = 'author-only-this-test-names'
beforeAll(async () => {
  verifyIdentity = await hostVerifier()
  const bearer = async (role: string, tenant = 'acme') => `Bearer ${await signed({ tid: tenant, roles: [role] }, (jwt) => jwt.setSubject(SUBJECT))}`
  ;[AUTHOR, PUBLISHER, ADMIN, GLOBEX] = await Promise.all([
    bearer('report-authors'),
    bearer('report-publishers'),
    bearer('report-admins'),
    bearer('report-authors', 'globex'),
  ])
})

const serve = (overrides: Partial<ReportServerOptions> = {}) => cases.serve({ verifyIdentity, roles, ...overrides })

const TITLE = 'A title only this test writes'
const report = (id = 'invoice', title = TITLE): ReportDefinition => emptyReport(id, title, 'en')
const draftUrl = (template: string) => `/v1/templates/${template}/draft`

/** Saves `body` as `template`'s draft with `headers`, an author's token and a JSON body unless they say otherwise. */
const save = (app: FastifyInstance, template: string, body: unknown, headers: Record<string, string> = {}) =>
  app.inject({
    method: 'PUT',
    url: draftUrl(template),
    headers: { authorization: AUTHOR, 'content-type': 'application/json', ...headers },
    payload: typeof body === 'string' ? body : JSON.stringify(body),
  })
const read = (app: FastifyInstance, url: string, authorization = AUTHOR) => app.inject({ method: 'GET', url, headers: { authorization } })
const keep = (app: FastifyInstance, hex: string, bytes: Uint8Array, contentType = 'image/png', authorization = AUTHOR) =>
  app.inject({ method: 'PUT', url: `/v1/assets/${hex}`, headers: { authorization, 'content-type': contentType }, payload: Buffer.from(bytes) })

/** A refusal as a client branches on it: the status and the code. */
const refusal = (answer: LightMyRequestResponse) => ({ status: answer.statusCode, code: answer.json<{ code: string }>().code })

// Images made in code from their parts, as report-server-core's suite makes
// them: the header reader inflates nothing, so a PNG's image data is any
// bytes.
const u32 = (value: number): number[] => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
function crc32(bytes: readonly number[]): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}
const chunk = (type: string, data: readonly number[]): number[] => {
  const typed = [...[...type].map((character) => character.charCodeAt(0)), ...data]
  return [...u32(data.length), ...typed, ...u32(crc32(typed))]
}
/** A truecolour PNG of this size; two sizes are two images, with two digests. */
const png = (width = 8, height = 8): Uint8Array =>
  Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk('IHDR', [...u32(width), ...u32(height), 8, 2, 0, 0, 0]),
    ...chunk('IDAT', [0x78, 0x9c, 1, 2, 3, 4]),
    ...chunk('IEND', []),
  ])
const segment = (marker: number, body: readonly number[]): number[] => [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body]
/** A greyscale 8 by 8 JPEG, its scan header and its end marker. */
const jpeg = (): Uint8Array =>
  Uint8Array.from([0xff, 0xd8, ...segment(0xc0, [8, 0, 8, 0, 8, 1, 1, 0x11, 0]), ...segment(0xda, [1, 1, 0, 0, 63, 0]), 0xff, 0xd9])
/** The 64 hexadecimal digits a path carries a digest by. */
const hexOf = (bytes: Uint8Array): string => assetDigest(bytes).slice('sha256:'.length)

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex')
/** Every file under the case's store, by its path inside it. */
const filesInStore = async (): Promise<string[]> =>
  (await readdir(cases.directory, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(cases.directory.length + 1))
    .sort()
/** The digest acme's `template` record of `revision` holds on disk, the 64 digits its tag carries: the SHA-256 of the report's text as the store wrote it. */
const recordDigest = async (template: string, revision: number): Promise<string> =>
  (
    JSON.parse(await readFile(join(cases.directory, 'tenants', sha256('acme'), 'templates', template, 'draft', `${String(revision)}.json`), 'utf8')) as {
      digest: string
    }
  ).digest

/** 64 hexadecimal digits, as a tag carries a digest. */
const HEX = 'ab'.repeat(32)

describe('parsePrecondition', () => {
  // A save names what it replaces: nothing yet, or one draft by its
  // version. Read otherwise, a create could replace a draft another author
  // made, or a replace name a draft it never saw; and a revision past 9
  // must be read as its number, not refused.
  test('reads If-None-Match * as a create, one strong tag of a draft as a replace of its version, and neither as none', () => {
    expect(parsePrecondition({})).toEqual({ kind: 'none' })
    expect(parsePrecondition({ 'if-none-match': '*' })).toEqual({ kind: 'create' })
    for (const revision of [3, 10, Number.MAX_SAFE_INTEGER]) {
      expect(parsePrecondition({ 'if-match': `"${String(revision)}-${HEX}"` })).toEqual({ kind: 'replace', version: { revision, digest: `sha256:${HEX}` } })
    }
  })

  // A precondition that is not exactly one of those is the client's
  // mistake, never a guess: a weak tag, a list, a tag without its quotes,
  // the bare revision this API answered before its tag named the digest, a
  // revision 0 or past the safe integers, a digest no store writes, both
  // headers at once, or If-Match * would each have to be read as some
  // version or none, and a save from a draft its author never named would
  // overwrite or be refused for the wrong reason. Each is malformed,
  // answered 400; the tag's own reader is report-server-core's, whose
  // suite reads every shape of one.
  test('takes anything else, the bare revision and both headers included, for malformed', () => {
    const malformed = [
      { 'if-match': `W/"3-${HEX}"` },
      { 'if-match': `"3-${HEX}", "4-${HEX}"` },
      { 'if-match': `3-${HEX}` },
      { 'if-match': '"3"' },
      { 'if-match': `"0-${HEX}"` },
      { 'if-match': `"03-${HEX}"` },
      { 'if-match': `"${String(Number.MAX_SAFE_INTEGER + 1)}-${HEX}"` },
      { 'if-match': `"3-${HEX.toUpperCase()}"` },
      { 'if-match': `"3-sha256:${HEX}"` },
      { 'if-match': '*' },
      { 'if-match': '' },
      { 'if-none-match': `"3-${HEX}"` },
      { 'if-none-match': '*, *' },
      { 'if-none-match': '' },
      { 'if-match': `"3-${HEX}"`, 'if-none-match': '*' },
    ]
    for (const headers of malformed) expect(parsePrecondition(headers), JSON.stringify(headers)).toBe('malformed')
  })
})

describe('a draft', () => {
  // The slice's one path: an author creates a template, replaces its draft
  // from the version it read, reads the newest back and finds it listed.
  // Each answer names its version in ETag, which the next If-Match names:
  // without it a client could not save twice. The tag's digits are the
  // record's own digest, which every read checks, so a tag names the draft
  // the record holds and no other.
  test('is created 201, replaced 200, read and listed, each answer with the version its ETag names', async () => {
    const app = await serve()
    const created = await save(app, 'invoice', report(), { 'if-none-match': '*' })
    expect(created.statusCode).toBe(201)
    const first = await recordDigest('invoice', 1)
    expect(created.headers.etag).toBe(`"1-${first}"`)
    expect(created.json()).toEqual({ template: 'invoice', revision: 1, digest: `sha256:${first}` })
    const replaced = await save(app, 'invoice', report('invoice', 'Changed'), { 'if-match': `"1-${first}"` })
    expect(replaced.statusCode).toBe(200)
    const second = await recordDigest('invoice', 2)
    expect(second).not.toBe(first)
    expect(replaced.headers.etag).toBe(`"2-${second}"`)
    expect(replaced.json()).toEqual({ template: 'invoice', revision: 2, digest: `sha256:${second}` })
    const newest = await read(app, draftUrl('invoice'))
    expect(newest.statusCode).toBe(200)
    expect(newest.headers.etag).toBe(`"2-${second}"`)
    expect(newest.headers['cache-control']).toBe('no-store')
    expect(newest.json()).toEqual({
      format: 1,
      template: 'invoice',
      revision: 2,
      digest: `sha256:${second}`,
      savedBy: SUBJECT,
      report: report('invoice', 'Changed'),
    })
    const listed = await read(app, '/v1/templates')
    expect(listed.statusCode).toBe(200)
    expect(listed.json()).toEqual({ templates: [{ template: 'invoice', revision: 2, title: 'Changed' }] })
  })

  // A client sends JSON with its charset as often as without; refused, a
  // save from such a client would never land (Review Focus 5).
  test('is read from application/json with a charset', async () => {
    const answer = await save(await serve(), 'invoice', report(), { 'if-none-match': '*', 'content-type': 'application/json; charset=utf-8' })
    expect(answer.statusCode).toBe(201)
  })

  // The draft's route reads JSON and nothing else: a body of another type
  // would reach the validator as a string or bytes and be refused as no
  // report, telling the client its report was wrong when its request was.
  // Refused 415 by its type, before it is parsed, and nothing written.
  test('is refused 415 in any other media type, and nothing written', async () => {
    const app = await serve()
    for (const contentType of ['text/plain', 'image/png', 'application/x-www-form-urlencoded']) {
      expect(refusal(await save(app, 'invoice', report(), { 'if-none-match': '*', 'content-type': contentType })), contentType).toEqual({
        status: 415,
        code: 'unsupported-media-type',
      })
    }
    expect(await filesInStore()).toEqual([])
  })

  // The body is bounded by report-spec's MAX_REPORT_BYTES, counted before
  // it is parsed: a body one byte past it is refused by the length it
  // declares, never read, and nothing is written; one at the limit is
  // read and judged. Fastify's own mebibyte would have let four times as
  // much through to be parsed.
  test('is refused 413 report-too-large one byte past MAX_REPORT_BYTES, and read at it', async () => {
    const app = await serve()
    const atLimit = `"${'x'.repeat(MAX_REPORT_BYTES - 2)}"`
    const past = `"${'x'.repeat(MAX_REPORT_BYTES - 1)}"`
    expect(Buffer.byteLength(atLimit)).toBe(MAX_REPORT_BYTES)
    expect(Buffer.byteLength(past)).toBe(MAX_REPORT_BYTES + 1)
    expect(refusal(await save(app, 'invoice', atLimit, { 'if-none-match': '*' }))).toEqual({ status: 422, code: 'report-invalid' })
    const refused = await save(app, 'invoice', past, { 'if-none-match': '*' })
    expect(refusal(refused)).toEqual({ status: 413, code: 'report-too-large' })
    expect(refused.headers.connection).toBe('close')
    expect(await filesInStore()).toEqual([])
  })

  // A malformed precondition is no precondition the use case could read,
  // and is refused before it is asked: a save whose header could not be
  // read must not write (Review Focus 2). The bare revision a page kept from
  // before the tag named the digest is one: read as the revision alone, it
  // would save over a draft issued that number since.
  test('is refused 400 bad-request with a malformed precondition, the bare revision among them, and nothing written', async () => {
    const app = await serve()
    const tag = String((await save(app, 'invoice', report(), { 'if-none-match': '*' })).headers.etag)
    for (const headers of [
      { 'if-match': `W/${tag}` },
      { 'if-match': `${tag}, ${tag}` },
      { 'if-match': tag.slice(1, -1) },
      { 'if-match': '"1"' },
      { 'if-match': tag, 'if-none-match': '*' },
    ]) {
      expect(refusal(await save(app, 'invoice', report('invoice', 'Overwritten'), headers)), JSON.stringify(headers)).toEqual({
        status: 400,
        code: 'bad-request',
      })
    }
    expect(await filesInStore()).toEqual([`tenants/${sha256('acme')}/templates/invoice/draft/1.json`])
  })

  // A revision is the number of a template's newest record file, so where
  // that file goes -- a backup older than it restored, the file removed by
  // hand, its name lost on power loss -- the next save is given the number
  // again. A page still holding the first revision 2 must not save over the
  // second, which its author never saw: its ETag names the first one's
  // digest as well, so its If-Match matches nothing that stands, and it is
  // refused draft-changed, with no ETag, and the second revision 2 stays.
  test('refuses a save from a revision issued again since, by the digest its ETag names, and keeps the draft saved under it', async () => {
    const app = await serve()
    const first = await save(app, 'invoice', report('invoice', 'One'), { 'if-none-match': '*' })
    const two = await save(app, 'invoice', report('invoice', 'Two, open in a page'), { 'if-match': String(first.headers.etag) })
    expect(two.statusCode).toBe(200)
    const stale = String(two.headers.etag)
    await rm(join(cases.directory, 'tenants', sha256('acme'), 'templates', 'invoice', 'draft', '2.json'))
    const again = await save(app, 'invoice', report('invoice', 'Another two'), { 'if-match': String(first.headers.etag) })
    expect(again.statusCode).toBe(200)
    expect(again.json<{ revision: number }>().revision).toBe(2)
    const overwritten = await save(app, 'invoice', report('invoice', 'Over another two'), { 'if-match': stale })
    expect(overwritten.statusCode).toBe(412)
    expect(overwritten.json()).toEqual({ ...REFUSALS['draft-changed'], revision: 2 })
    expect(overwritten.headers.etag).toBeUndefined()
    const newest = await read(app, draftUrl('invoice'))
    expect(newest.headers.etag).toBe(again.headers.etag)
    expect(newest.headers.etag).not.toBe(stale)
    expect(newest.json<{ report: ReportDefinition }>().report).toEqual(report('invoice', 'Another two'))
    expect(await filesInStore()).toEqual([1, 2].map((revision) => `tenants/${sha256('acme')}/templates/invoice/draft/${String(revision)}.json`))
  })
})

describe('an image', () => {
  // An author's builder keeps the image it adds, and the draft that
  // declares it then saves; reading it gives the bytes themselves, under
  // their own media type and no-store, never JSON around them.
  test('is kept, read back as its bytes and media type, and declared by a draft that then saves', async () => {
    const app = await serve()
    const bytes = png()
    const kept = await keep(app, hexOf(bytes), bytes)
    expect(kept.statusCode).toBe(200)
    expect(kept.json()).toEqual({ digest: assetDigest(bytes) })
    expect(kept.headers.etag).toBeUndefined()
    const back = await read(app, `/v1/assets/${hexOf(bytes)}`)
    expect(back.statusCode).toBe(200)
    expect(back.headers['content-type']).toBe('image/png')
    expect(back.headers['cache-control']).toBe('no-store')
    expect(Buffer.compare(back.rawPayload, Buffer.from(bytes))).toBe(0)
    const declaring = { ...report(), assets: [{ id: 'logo', mediaType: 'image/png', digest: assetDigest(bytes) }] }
    expect((await save(app, 'invoice', declaring, { 'if-none-match': '*' })).statusCode).toBe(201)
  })

  // The asset route reads the three kinds an image asset may be and no
  // other: a JSON body would reach the sniffer as a parsed object, and be
  // refused as no image when the request was the wrong one.
  test('is refused 415 in a media type no image is, and nothing written', async () => {
    const app = await serve()
    const bytes = png()
    for (const contentType of ['application/json', 'text/plain', 'application/octet-stream']) {
      expect(
        refusal(await keep(app, hexOf(bytes), contentType === 'application/json' ? new TextEncoder().encode('{}') : bytes, contentType)),
        contentType,
      ).toEqual({ status: 415, code: 'unsupported-media-type' })
    }
    expect(await filesInStore()).toEqual([])
  })
})

describe('the refusals', () => {
  // Each refusal the use cases give reaches the client as they gave it,
  // under its status, once through HTTP: a route that sent another status,
  // or rebuilt the body and lost a field, would leave a client branching
  // on what the wire says it will get with something else.
  test('reach the client with the use case’s status, code and field', async () => {
    const app = await serve()
    const bytes = png()
    const other = png(9, 9)
    const created = await save(app, 'invoice', report(), { 'if-none-match': '*' })
    expect(created.statusCode).toBe(201)
    const tag = String(created.headers.etag)

    // Who may: a publisher reads and cannot save, an administrator lists and cannot read.
    expect(refusal(await save(app, 'invoice', report(), { 'if-match': tag, authorization: PUBLISHER }))).toEqual({ status: 403, code: 'forbidden' })
    expect((await read(app, draftUrl('invoice'), PUBLISHER)).statusCode).toBe(200)
    expect(refusal(await read(app, draftUrl('invoice'), ADMIN))).toEqual({ status: 403, code: 'forbidden' })
    expect((await read(app, '/v1/templates', ADMIN)).statusCode).toBe(200)
    expect(refusal(await keep(app, hexOf(bytes), bytes, 'image/png', PUBLISHER))).toEqual({ status: 403, code: 'forbidden' })

    // Which template: an id the format does not allow, and one with no draft, for this tenant or another's.
    expect(refusal(await read(app, draftUrl('Invoice')))).toEqual({ status: 400, code: 'template-id-invalid' })
    expect(refusal(await read(app, draftUrl('nothing-here')))).toEqual({ status: 404, code: 'no-draft' })
    expect(refusal(await read(app, draftUrl('invoice'), GLOBEX))).toEqual({ status: 404, code: 'no-draft' })

    // What a save stands on: none named, another revision, the revision that stands by another digest, a create of what exists. Each 412 names the revision that stands, and none sends an ETag: a tag comes only with the draft it names.
    expect(refusal(await save(app, 'invoice', report()))).toEqual({ status: 428, code: 'precondition-required' })
    for (const headers of [{ 'if-match': `"7-${tag.slice(3, -1)}"` }, { 'if-match': `"1-${HEX}"` }, { 'if-none-match': '*' }]) {
      const changed = await save(app, 'invoice', report(), headers)
      expect(changed.statusCode, JSON.stringify(headers)).toBe(412)
      expect(changed.json()).toEqual({ ...REFUSALS['draft-changed'], revision: 1 })
      expect(changed.headers.etag).toBeUndefined()
    }
    // A replace of a template with no draft names no revision.
    const nothing = await save(app, 'quote', report('quote'), { 'if-match': tag })
    expect(nothing.json()).toEqual({ ...REFUSALS['draft-changed'], revision: null })
    expect(nothing.headers.etag).toBeUndefined()

    // What a save carries: no report, another template's report, an image not kept.
    const invalid = await save(app, 'quote', { not: 'a report' }, { 'if-none-match': '*' })
    expect(refusal(invalid)).toEqual({ status: 422, code: 'report-invalid' })
    expect(invalid.json<{ errors: unknown[] }>().errors.length).toBeGreaterThan(0)
    expect(refusal(await save(app, 'quote', report('other'), { 'if-none-match': '*' }))).toEqual({ status: 422, code: 'template-id-mismatch' })
    const unkept = await save(
      app,
      'quote',
      { ...report('quote'), assets: [{ id: 'logo', mediaType: 'image/png', digest: assetDigest(other) }] },
      { 'if-none-match': '*' },
    )
    expect(unkept.statusCode).toBe(422)
    expect(unkept.json()).toEqual({ ...REFUSALS['asset-not-kept'], assets: ['logo'] })

    // What an image is: a path that is no digest, one nothing is kept under, bytes of another kind than the type says (Review Focus 5), no image, another image's digest.
    expect(refusal(await read(app, '/v1/assets/ABC'))).toEqual({ status: 400, code: 'digest-invalid' })
    expect(refusal(await read(app, `/v1/assets/${hexOf(other)}`))).toEqual({ status: 404, code: 'no-asset' })
    expect(refusal(await keep(app, hexOf(jpeg()), jpeg(), 'image/png'))).toEqual({ status: 415, code: 'unsupported-media-type' })
    const noImage = await keep(app, hexOf(new TextEncoder().encode('no image')), new TextEncoder().encode('no image'))
    expect(noImage.statusCode).toBe(422)
    expect(noImage.json()).toEqual({ ...REFUSALS['image-refused'], reason: 'not-an-image' })
    expect(refusal(await keep(app, hexOf(other), bytes))).toEqual({ status: 422, code: 'digest-mismatch' })
    // A keep with no body at all has no type and no bytes: no image, as the use case says, and never the server's own error.
    const empty = await app.inject({ method: 'PUT', url: `/v1/assets/${hexOf(bytes)}`, headers: { authorization: AUTHOR } })
    expect(empty.statusCode).toBe(422)
    expect(empty.json()).toEqual({ ...REFUSALS['image-refused'], reason: 'not-an-image' })

    // Nothing but the first save was written.
    expect(await filesInStore()).toEqual([`tenants/${sha256('acme')}/templates/invoice/draft/1.json`])
  })

  // Every route of the slice begins with the token: without one, each is
  // the one 401, before a template, a digest or a body is looked at.
  test('answer every route without a token with the one 401', async () => {
    const app = await serve()
    const hex = hexOf(png())
    for (const [method, url] of [
      ['GET', '/v1/templates'],
      ['GET', draftUrl('invoice')],
      ['PUT', draftUrl('invoice')],
      ['PUT', `/v1/assets/${hex}`],
      ['GET', `/v1/assets/${hex}`],
    ] as const) {
      const answer = await app.inject({ method, url })
      expect(refusal(answer), `${method} ${url}`).toEqual({ status: 401, code: 'unauthenticated' })
    }
  })
})

describe('nothing is read before the identity', () => {
  const listening = async (overrides: Partial<ReportServerOptions> = {}) => {
    const app = await serve(overrides)
    await app.listen({ host: '127.0.0.1', port: 0 })
    return { app, port: (app.server.address() as AddressInfo).port }
  }

  // A keep's body may be 20 MB, inside MAX_ASSET_BYTES. Read before the
  // token, anybody holding a socket could make the server take that much
  // and only then hear it was nobody; and the answer would wait for a body
  // that never comes. Answered at once with no byte of the body sent, so
  // nothing waited for it, and the connection closed, so Node does not read
  // the rest to keep it open.
  test('answers an unauthenticated keep that declares 20,000,000 bytes and sends none 401 at once, and closes', async () => {
    expect(20_000_000).toBeLessThan(MAX_ASSET_BYTES)
    const { port } = await listening()
    const { answer, closed } = await exchange(
      port,
      `PUT /v1/assets/${hexOf(png())} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: image/png\r\nContent-Length: 20000000\r\n\r\n`,
    )
    expect(answer).toMatch(/^HTTP\/1\.1 401 /)
    expect(answer).toContain('{"code":"unauthenticated","message":"A valid host token is required."}')
    expect(answer.toLowerCase()).toContain('\r\nconnection: close\r\n')
    expect(closed).toBe(true)
  })

  // The cross-origin refusal comes before the token, and so before the
  // body: a page no operator listed is refused at once, and its unread
  // body is not left on the connection to be read after the answer.
  test('refuses a token-bearing save a browser marks cross-site from an unlisted origin 403 at once, and closes', async () => {
    const { port } = await listening()
    const { answer, closed } = await exchange(
      port,
      `PUT /v1/templates/invoice/draft HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: ${AUTHOR}\r\nOrigin: https://evil.example\r\nSec-Fetch-Site: cross-site\r\nIf-None-Match: *\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{`,
    )
    expect(answer).toMatch(/^HTTP\/1\.1 403 /)
    expect(answer).toContain('"code":"cross-origin-refused"')
    expect(answer.toLowerCase()).toContain('\r\nconnection: close\r\n')
    expect(closed).toBe(true)
  })

  // A body of a media type the route does not read is refused by its type,
  // and is not read either: its connection is closed with the answer, so
  // Node does not take the rest of it to keep the connection open.
  test('refuses a save in a media type the route does not read 415 at once, and closes', async () => {
    const { port } = await listening()
    const { answer, closed } = await exchange(
      port,
      `PUT /v1/templates/invoice/draft HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: ${AUTHOR}\r\nIf-None-Match: *\r\nContent-Type: text/plain\r\nContent-Length: 100\r\n\r\n{`,
    )
    expect(answer).toMatch(/^HTTP\/1\.1 415 /)
    expect(answer).toContain('"code":"unsupported-media-type"')
    expect(answer.toLowerCase()).toContain('\r\nconnection: close\r\n')
    expect(closed).toBe(true)
  })

  // A refusal of a request that carried no body leaves nothing unread, so
  // its connection stays for the client's next request: a browser whose
  // token expired asks again on it.
  test('keeps the connection of a refused request that carried no body', async () => {
    const answer = await (await serve()).inject({ method: 'GET', url: '/v1/templates' })
    expect(answer.statusCode).toBe(401)
    expect(answer.headers.connection).toBe('keep-alive')
  })

  // An image past MAX_ASSET_BYTES is refused by the length it declares,
  // before a byte of it is read, under the asset route's own code.
  test('refuses a keep that declares more than MAX_ASSET_BYTES 413 image-too-large at once, and closes', async () => {
    const { port } = await listening()
    const { answer, closed } = await exchange(
      port,
      `PUT /v1/assets/${hexOf(png())} HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: ${AUTHOR}\r\nContent-Type: image/png\r\nContent-Length: ${String(MAX_ASSET_BYTES + 1)}\r\n\r\n`,
    )
    expect(answer).toMatch(/^HTTP\/1\.1 413 /)
    expect(answer).toContain('"code":"image-too-large"')
    expect(closed).toBe(true)
  })

  // A chunked body declares no length to refuse it by, and is read only
  // until it passes the limit: refused there, under the draft's own code,
  // and never read whole, however long it goes on.
  test('refuses a chunked save once it is read past MAX_REPORT_BYTES 413 report-too-large, and closes', async () => {
    const { port } = await listening()
    const body = `"${'x'.repeat(MAX_REPORT_BYTES)}"`
    const head = `PUT /v1/templates/invoice/draft HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: ${AUTHOR}\r\nIf-None-Match: *\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n`
    const { answer, closed } = await exchange(port, `${head}${Buffer.byteLength(body).toString(16)}\r\n${body}\r\n`)
    expect(answer).toMatch(/^HTTP\/1\.1 413 /)
    expect(answer).toContain('"code":"report-too-large"')
    expect(closed).toBe(true)
    expect(await filesInStore()).toEqual([])
  })

  // A builder's upload cut off halfway -- a tab closed, a network gone --
  // must leave nothing: no asset under a digest whose bytes never all came,
  // and no temporary file, which a later keep of the same image would
  // otherwise trip over (Review Focus 4).
  test('leaves nothing in the store of an upload the client abandons halfway, and the same keep succeeds after', async () => {
    const { app, port } = await listening()
    const bytes = png()
    const head = `PUT /v1/assets/${hexOf(bytes)} HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: ${AUTHOR}\r\nContent-Type: image/png\r\nContent-Length: ${String(bytes.length)}\r\n\r\n`
    const { answer } = await exchange(port, Buffer.concat([Buffer.from(head), Buffer.from(bytes.subarray(0, bytes.length / 2))]), 300)
    expect(answer).toBe('')
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(await filesInStore()).toEqual([])
    expect((await keep(app, hexOf(bytes), bytes)).statusCode).toBe(200)
    expect(await filesInStore()).toEqual([`tenants/${sha256('acme')}/assets/${hexOf(bytes)}.png`])
  })
})

describe('the log and the trail', () => {
  const KEY = 'a-throwaway-audit-key-for-this-test-only'

  // The log and the trail are read by whoever runs the collector. A draft's
  // title, who saved it, a template's id and an image's digest are the
  // tenant's, and none is written there by an ordinary request, answered or
  // refused: a request is named by its route's pattern, a person by keyed
  // hash.
  test('hold no subject, title, template id or digest', async () => {
    const lines: string[] = []
    const events: AuditEvent[] = []
    const app = await serve({ logger: { stream: { write: (line) => void lines.push(line) } }, audit: { sink: (event) => void events.push(event), key: KEY } })
    const template = 'ledger-only-this-test-names'
    const bytes = png()
    const hex = hexOf(bytes)
    const kept = await keep(app, hex, bytes)
    const readBack = await read(app, `/v1/assets/${hex}`)
    const created = await save(
      app,
      template,
      { ...report(template), assets: [{ id: 'logo', mediaType: 'image/png', digest: assetDigest(bytes) }] },
      { 'if-none-match': '*' },
    )
    const replaced = await save(app, template, report(template), { 'if-match': String(created.headers.etag) })
    const answered = [
      kept,
      readBack,
      created,
      replaced,
      await save(app, template, report(template), { 'if-match': String(created.headers.etag) }),
      await save(app, template, { ...report(template), page: null }, { 'if-match': String(replaced.headers.etag) }),
      await read(app, draftUrl(template)),
      await read(app, '/v1/templates'),
    ]
    expect(answered.map((answer) => answer.statusCode)).toEqual([200, 200, 201, 200, 412, 422, 200, 200])
    expect(events).toHaveLength(answered.length)
    const written = `${lines.join('')}${JSON.stringify(events)}`
    expect(written).toContain('"route":"/v1/templates/:template/draft"')
    // A draft's digest is the tenant's too, the SHA-256 of its report's text, in each tag a request sent and an answer gave.
    const drafts = [created, replaced].map((answer) => answer.json<{ digest: string }>().digest.slice('sha256:'.length))
    for (const part of [SUBJECT, TITLE, template, hex, hex.slice(0, 16), ...drafts, ...drafts.map((digest) => digest.slice(0, 16)), 'acme'])
      expect(written, part).not.toContain(part)
  })

  // A stored record the store did not write is the server's fault, and the
  // operator must find it: the log says why, which file inside the
  // tenant's directory, and whose by the audit key's hash (0046's way of
  // naming a tenant). Not the absolute path: the tenant's directory is the
  // unkeyed SHA-256 of the claim, which anyone holding the log reverses for
  // a tenant they can guess. Without an audit key the tenant is not named.
  // The file's name is a template's id or an image's digest, which the
  // operator needs to find it, and which only this line carries.
  for (const key of [KEY, undefined]) {
    test(`names a record the store did not write by why, its file inside the tenant, and the tenant ${key === undefined ? 'not at all without an audit key' : 'by keyed hash'}, answering 500`, async () => {
      const lines: string[] = []
      const app = await serve({
        logger: { stream: { write: (line) => void lines.push(line) } },
        audit: { sink: () => {}, ...(key === undefined ? {} : { key }) },
      })
      const bytes = png()
      await save(app, 'invoice', report(), { 'if-none-match': '*' })
      await keep(app, hexOf(bytes), bytes)
      const tenant = join(cases.directory, 'tenants', sha256('acme'))
      const record = join(tenant, 'templates', 'invoice', 'draft', '1.json')
      await writeFile(record, (await readFile(record, 'utf8')).replace(TITLE, 'Edited by hand'))
      await writeFile(join(tenant, 'assets', `${hexOf(bytes)}.png`), png(9, 9))
      for (const url of [draftUrl('invoice'), '/v1/templates', `/v1/assets/${hexOf(bytes)}`])
        expect(refusal(await read(app, url)), url).toEqual({ status: 500, code: 'internal' })
      const logged = lines
        .map((line) => JSON.parse(line) as { msg: string; why?: string; file?: string; tenant?: string | null })
        .filter((line) => line.msg === 'a stored record is not what the store wrote, and was not served')
      const reference = auditReference(key, 'tenant', 'acme')
      expect(logged.map(({ why, file, tenant: named }) => ({ why, file, tenant: named }))).toEqual([
        { why: 'digest', file: 'templates/invoice/draft/1.json', tenant: reference },
        { why: 'digest', file: 'templates/invoice/draft/1.json', tenant: reference },
        { why: 'digest', file: `assets/${hexOf(bytes)}.png`, tenant: reference },
      ])
      const all = lines.join('')
      for (const part of [cases.directory, sha256('acme'), 'tenants/', '"acme"', TITLE, 'Edited by hand']) expect(all, part).not.toContain(part)
    })
  }

  // The file system failing the store -- a permission taken away, a full
  // volume, the root gone -- is the server's fault, answered 500. Node's
  // own error names the absolute path, the tenant's directory in it, the
  // unkeyed hash of the claim: logged as it is, as the server's other
  // errors are, the line would say whose drafts a guessable tenant's are.
  // It is logged by Node's code, what the store was doing, the path inside
  // the tenant's directory where there is one, and the tenant by keyed
  // hash; never Node's message or its stack.
  test('names a failure of the file system by its code, the operation, the path inside the tenant and the tenant by keyed hash, answering 500', async () => {
    const lines: string[] = []
    const app = await serve({ logger: { stream: { write: (line) => void lines.push(line) } }, audit: { sink: () => {}, key: KEY } })
    const tag = String((await save(app, 'invoice', report(), { 'if-none-match': '*' })).headers.etag)
    const tenant = join(cases.directory, 'tenants', sha256('acme'))
    const directory = join(tenant, 'templates', 'invoice', 'draft')
    await chmod(directory, 0o000)
    try {
      expect(refusal(await read(app, draftUrl('invoice')))).toEqual({ status: 500, code: 'internal' })
      expect(refusal(await save(app, 'invoice', report(), { 'if-match': tag }))).toEqual({ status: 500, code: 'internal' })
    } finally {
      await chmod(directory, 0o700)
    }
    await rm(cases.directory, { recursive: true })
    expect(refusal(await read(app, '/v1/templates'))).toEqual({ status: 500, code: 'internal' })
    const logged = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((line) => line['msg'] === 'the store’s file system failed it, and nothing was answered from it')
    const reference = auditReference(KEY, 'tenant', 'acme')
    expect(logged.map(({ code, operation, file, tenant: named }) => ({ code, operation, file, tenant: named }))).toEqual([
      { code: 'EACCES', operation: 'list', file: 'templates/invoice/draft', tenant: reference },
      { code: 'EACCES', operation: 'list', file: 'templates/invoice/draft', tenant: reference },
      { code: 'ENOENT', operation: 'list', file: undefined, tenant: reference },
    ])
    const all = lines.join('')
    for (const part of [cases.directory, sha256('acme'), 'tenants/', 'permission denied', 'no such file', '"err"', '"stack"'])
      expect(all, part).not.toContain(part)
  })
})
