/**
 * The host's side of the container gate (0046, 0049): the tokens a host
 * signs with nothing but its secret, and the requests an author's host
 * sends, each held to what the server must answer. It changes with the
 * server's routes and its tokens, where container.mjs changes with the
 * image and how Docker runs it; the waits it keeps are the choices
 * container.mjs's header gives. Node's built-ins only.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

export const expect = (truth, otherwise) => {
  if (!truth) throw new Error(otherwise)
}

/** `fetch(url, init)`, failed by its own deadline, `ms`, naming the request, where no answer ever comes. */
export async function request(url, init = {}, ms = 10_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`${init.method ?? 'GET'} ${url} had no answer within ${String(ms / 1000)} s`)), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export const secret = randomBytes(32).toString('base64url')
export const ISSUER = 'https://host.example'
export const AUDIENCE = 'formancy-report'
const base64url = (text) => Buffer.from(text).toString('base64url')
/** An HS256 token, as a host signs one with nothing but its secret, or a key set's key under its `kid`. */
export function sign(claims, key = secret, kid = undefined) {
  const body = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', ...(kid === undefined ? {} : { kid }) }))}.${base64url(JSON.stringify(claims))}`
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`
}
/**
 * An author's claims, issued now and expiring 600 s later. Asked for where
 * the checks that present them start, never when the script loads: the
 * image's build comes first, and the draft checks come late, so a lifetime
 * that started at load could end before them.
 */
export function authorClaims() {
  const now = Math.floor(Date.now() / 1000)
  return { iss: ISSUER, aud: AUDIENCE, sub: 'u-1', tid: 'acme', roles: ['report-authors'], iat: now, exp: now + 600 }
}
/** What whoami's checks present, and the audit line's check looks for in the log: a token the host signed, one without its tenant, and a forgery. */
export function whoamiTokens() {
  const claims = authorClaims()
  const { tid: _tenant, ...tenantless } = claims
  return { good: sign(claims), tenantless: sign(tenantless), forged: sign(claims, randomBytes(32).toString('base64url')) }
}

/**
 * The draft slice's requests (0049), each as an author's host sends it to
 * the server at `base`, so that one function is what a check runs against
 * a container and what a person can run against a server of their own.
 * `bearer` is the author's token.
 */
const AUTHOR_HEADERS = (bearer) => ({ authorization: `Bearer ${bearer}` })

/** The report a draft check saves: report-spec's blank A4 report, written out, so that the gate needs no package. */
export const DRAFT_REPORT = {
  reportSpecVersion: '0',
  id: 'gate',
  title: 'Gate report',
  locale: 'en',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [],
  datasets: {},
  parameters: [],
  assets: [],
  aggregates: [],
  regions: { reportHeader: [], pageHeader: [], body: [], pageFooter: [], summary: [] },
  provenance: { kind: 'blank' },
}

/**
 * The 64 hexadecimal digits of the SHA-256 of `DRAFT_REPORT`'s text as the
 * server stores it, which a draft's tag and digest carry (0049): the store
 * writes the report the validator returns, which is this one, in this order.
 */
const DRAFT_HEX = createHash('sha256').update(JSON.stringify(DRAFT_REPORT)).digest('hex')

/** Saves `DRAFT_REPORT` as the template `gate`, a create (`If-None-Match: *`); throws unless the server answers 201, revision 1 and its report's digest, in the body and in the ETag. */
export async function saveFirstDraft(base, bearer) {
  const answer = await request(`${base}/v1/templates/gate/draft`, {
    method: 'PUT',
    headers: { ...AUTHOR_HEADERS(bearer), 'content-type': 'application/json', 'if-none-match': '*' },
    body: JSON.stringify(DRAFT_REPORT),
  })
  const body = await answer.text()
  expect(
    answer.status === 201 &&
      answer.headers.get('etag') === `"1-${DRAFT_HEX}"` &&
      body === JSON.stringify({ template: 'gate', revision: 1, digest: `sha256:${DRAFT_HEX}` }),
    `a first save answered ${String(answer.status)} ${answer.headers.get('etag')} ${body}`,
  )
}

/** Reads the template `gate`'s draft; throws unless it is revision 1 under its report's digest, in the body and in the ETag, and its report is `DRAFT_REPORT`, as saved. */
export async function expectFirstDraft(base, bearer) {
  const answer = await request(`${base}/v1/templates/gate/draft`, { headers: AUTHOR_HEADERS(bearer) })
  const text = await answer.text()
  expect(
    answer.status === 200 && answer.headers.get('etag') === `"1-${DRAFT_HEX}"`,
    `reading the draft answered ${String(answer.status)} ${answer.headers.get('etag')} ${text.slice(0, 200)}`,
  )
  const draft = JSON.parse(text)
  expect(
    draft.template === 'gate' && draft.revision === 1 && draft.digest === `sha256:${DRAFT_HEX}`,
    `the draft read back was ${draft.template} at revision ${String(draft.revision)} under ${String(draft.digest)}`,
  )
  expect(isDeepStrictEqual(draft.report, DRAFT_REPORT), 'the report read back is not the report saved')
}

/** Keeps `bytes` as a PNG under the digest of its own bytes, then reads it back; throws unless the answer is those bytes, byte for byte, as `image/png`. */
export async function keepAndReadImage(base, bearer, bytes) {
  const hex = createHash('sha256').update(bytes).digest('hex')
  const kept = await request(`${base}/v1/assets/${hex}`, { method: 'PUT', headers: { ...AUTHOR_HEADERS(bearer), 'content-type': 'image/png' }, body: bytes })
  const keptBody = await kept.text()
  expect(kept.status === 200 && keptBody === JSON.stringify({ digest: `sha256:${hex}` }), `keeping an image answered ${String(kept.status)} ${keptBody}`)
  const answer = await request(`${base}/v1/assets/${hex}`, { headers: AUTHOR_HEADERS(bearer) })
  const back = Buffer.from(await answer.arrayBuffer())
  expect(
    answer.status === 200 && answer.headers.get('content-type') === 'image/png',
    `reading the image answered ${String(answer.status)} ${answer.headers.get('content-type')}`,
  )
  expect(back.equals(Buffer.from(bytes)), `the image read back is ${String(back.length)} bytes that are not the ${String(bytes.length)} kept`)
}
