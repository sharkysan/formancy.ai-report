import { isRevision, REFUSALS } from '@formancy/report-server-core'
import type { Draft, DraftSaved, ImageKept, RefusalCode, Route, ServerRefusal, StoredImage, TemplateList } from '@formancy/report-server-core'
import { ASSET_MEDIA_TYPES } from '@formancy/report-spec'
import type { AssetMediaType, ReportDefinition } from '@formancy/report-spec'

/**
 * Report's client (0049): what a host's page, or its own server, calls to
 * keep a template's draft and the images it declares on report-server. It
 * asks the routes `ROUTES` names, by their own keys, so a route renamed
 * there fails to compile here; it sends the token the host answers with
 * before every request, and nothing else of the host's. It reaches the
 * network through the `fetch` it is given, at the `server` it is given, and
 * nowhere else: it follows no redirect.
 *
 * A refusal the API gives is an answer, `ok: false` with its status, never
 * thrown: a stale save, an expired token and a report the format refuses
 * are each a host's to show. What is no answer of the API's -- a gateway's
 * page, a body that is no JSON where JSON is due, an image under no image's
 * media type -- is thrown, naming the route by its pattern and the status,
 * and nothing the request carried; a network error propagates as fetch
 * gave it. What the host gave that no request could carry as it means it
 * -- a token no bearer header carries, a save from what is no revision, a
 * digest that does not begin with `sha256:` -- is thrown before anything is
 * sent, by a fixed sentence that quotes none of it.
 */

export interface ReportClientOptions {
  /** The server's base URL, e.g. https://reports.example; no trailing slash. */
  readonly server: string
  /** The current token; asked before every request. */
  readonly token: () => string | Promise<string>
  readonly fetch?: typeof globalThis.fetch
}

/** What a route answered: its value, or the refusal the API gave, with the status it came under. */
export type Answered<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly status: number; readonly refusal: ServerRefusal }

export interface ReportClient {
  /** The tenant's templates, by id, each with its newest draft's revision and title. */
  listTemplates(): Promise<Answered<TemplateList>>
  /** The template's newest draft, with the revision a save from it names. */
  readDraft(template: string): Promise<Answered<Draft>>
  /**
   * Saves `report` as the template's next draft: from `null`, a template not
   * yet saved; from a revision, the draft that revision is. A save from a
   * revision no longer the newest is refused `draft-changed`, with the
   * revision that stands, and writes nothing.
   */
  saveDraft(template: string, report: ReportDefinition, from: number | null): Promise<Answered<DraftSaved>>
  /** Keeps an image under `digest`, `sha256:` and the hexadecimal digits of its bytes, as a report names it. */
  keepImage(bytes: Uint8Array, digest: string, mediaType: AssetMediaType): Promise<Answered<ImageKept>>
  /** The image kept under `digest`, written as `keepImage` takes it: its bytes and the media type they were kept as. */
  readImage(digest: string): Promise<Answered<StoredImage>>
}

/** The `:name` parameters of a route's path. */
type ParametersOf<Path extends string> = Path extends `${string}:${infer Name}/${infer Rest}` ? Name | ParametersOf<Rest> : Path extends `${string}:${infer Name}` ? Name : never

/** What a request sends beside its method, its path and its token. */
interface Sent {
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: BodyInit
}

const SERVER_RULE = 'server is the report server’s base URL: http: or https:, with no credentials, query, fragment or trailing slash, so that a route’s path can follow it.'

/** Whether a route's path can follow `server` as written and reach it: the whole of the rule SERVER_RULE says. */
function isBaseUrl(server: unknown): server is string {
  if (typeof server !== 'string') return false
  let url: URL
  try {
    url = new URL(server)
  } catch {
    return false
  }
  return (url.protocol === 'https:' || url.protocol === 'http:') && url.username === '' && url.password === '' && !/[?#]/.test(server) && !server.endsWith('/')
}

/**
 * A bearer token as RFC 6750 writes one (b64token): the only characters it
 * lets a bearer credential hold. A token with a newline would make fetch
 * reject with an error that quotes the header, and the token with it; one
 * with a space is no one credential.
 */
const BEARER = /^[A-Za-z0-9\-._~+/]+=*$/

const TOKEN_RULE = 'The token the host answered is no bearer token: letters, digits and - . _ ~ + /, with = only at its end, and nothing else.'

/** The headers a save from `from` sends, or thrown, before anything is asked or sent, where `from` is neither null nor a revision. */
function preconditionOf(from: number | null): Readonly<Record<string, string>> {
  if (from === null) return { 'if-none-match': '*' }
  if (!isRevision(from)) throw new Error('A save is from null, for a template not yet saved, or from the revision it replaces, a positive safe integer.')
  return { 'if-match': `"${String(from)}"` }
}

/** How a report names an image's bytes; a path carries the digits after it. */
const DIGEST_PREFIX = 'sha256:'

/** The part of `digest` a path carries, or thrown where `digest` does not begin with `sha256:`; the digits after it are the server's to judge. */
function digitsOf(digest: string): string {
  if (!digest.startsWith(DIGEST_PREFIX)) throw new Error(`A digest is given as a report names an image by one: ${DIGEST_PREFIX} and the hexadecimal digits of its bytes.`)
  return digest.slice(DIGEST_PREFIX.length)
}

/**
 * The field each of the four refusals that carry one must hold, as
 * `ServerRefusal` types it; every other code carries none.
 */
const FIELDS = {
  'report-invalid': ({ errors }) => Array.isArray(errors),
  'draft-changed': ({ revision }) => revision === null || isRevision(revision),
  'asset-not-kept': ({ assets }) => Array.isArray(assets) && assets.every((asset) => typeof asset === 'string'),
  'image-refused': ({ reason }) => typeof reason === 'string',
} satisfies Partial<Record<RefusalCode, (refusal: Readonly<Record<string, unknown>>) => boolean>>

/** The JSON object `text` holds, or undefined where it holds none. */
function objectIn(text: string): Readonly<Record<string, unknown>> | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

/**
 * `body` as a refusal the API gives: a code `REFUSALS` holds as its own --
 * an inherited name such as `toString` is none -- its sentence, and the
 * field one of the four carries; undefined for anything else.
 */
function refusalIn(body: Readonly<Record<string, unknown>> | undefined): ServerRefusal | undefined {
  const code = body?.['code']
  if (body === undefined || typeof code !== 'string' || !Object.hasOwn(REFUSALS, code) || typeof body['message'] !== 'string') return undefined
  const field = Object.hasOwn(FIELDS, code) ? FIELDS[code as keyof typeof FIELDS] : undefined
  return field === undefined || field(body) ? (body as unknown as ServerRefusal) : undefined
}

/** An answer that is no answer of the API's: named by the route's pattern and the status, never by a path that holds an id or a digest. */
const unanswered = (route: Route, status: number, how: string) => new Error(`${route} was answered ${String(status)} ${how}, which is no answer of report-server’s API.`)

/** A refusal the API gave, answered; anything else not 2xx, thrown. */
function refused(route: Route, response: Response, body: Readonly<Record<string, unknown>> | undefined): Answered<never> {
  const refusal = refusalIn(body)
  if (refusal === undefined) throw unanswered(route, response.status, 'with no refusal of its own')
  return { ok: false, status: response.status, refusal }
}

/** A route whose answer is JSON: a 2xx's object is its value. */
async function json<T>(route: Route, response: Response): Promise<Answered<T>> {
  const body = objectIn(await response.text())
  if (!response.ok) return refused(route, response, body)
  if (body === undefined) throw unanswered(route, response.status, 'with a body that is no JSON object')
  return { ok: true, value: body as T }
}

const isImageMediaType = (type: string): type is AssetMediaType => (ASSET_MEDIA_TYPES as readonly string[]).includes(type)

/** An image's route: a 2xx's bytes are the image, under the media type its `Content-Type` names. */
async function image(route: Route, response: Response): Promise<Answered<StoredImage>> {
  if (!response.ok) return refused(route, response, objectIn(await response.text()))
  const bytes = new Uint8Array(await response.arrayBuffer())
  // The type's essence, without its parameters, as the server's keep compares one.
  const mediaType = (response.headers.get('content-type') ?? '').replace(/;[^]*$/, '').trim().toLowerCase()
  if (!isImageMediaType(mediaType)) throw unanswered(route, response.status, 'under a media type no image asset is')
  return { ok: true, value: { mediaType, bytes } }
}

/**
 * A client of the report server at `options.server`, which a host makes
 * once and calls for each request. A `server` it could not put a route's
 * path after is refused here, naming the rule and never the URL.
 */
export function createReportClient(options: ReportClientOptions): ReportClient {
  const { server, token } = options
  if (!isBaseUrl(server)) throw new Error(SERVER_RULE)
  // Called as a function, never as a method of `options`: a browser's own
  // fetch throws when called on anything but the window.
  const fetching = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init))

  /** Asks `route`, each of its parameters one segment of the path, with the host's current token, and reads what it answered with `read`. */
  async function ask<R extends Route, T>(route: R, parameters: Record<ParametersOf<R>, string>, read: (route: Route, response: Response) => Promise<Answered<T>>, sent: Sent = {}): Promise<Answered<T>> {
    const [method, pattern] = route.split(' ') as [string, string]
    // ParametersOf makes every `:name` of the route a key of `parameters`.
    const path = pattern.replace(/:([a-z]+)/g, (_, name: string) => encodeURIComponent((parameters as Record<string, string>)[name] as string))
    const bearer: unknown = await token()
    if (typeof bearer !== 'string' || !BEARER.test(bearer)) throw new Error(TOKEN_RULE)
    const response = await fetching(`${server}${path}`, { method, redirect: 'error', ...sent, headers: { authorization: `Bearer ${bearer}`, ...sent.headers } })
    return read(route, response)
  }

  return {
    listTemplates: async () => ask('GET /v1/templates', {}, json<TemplateList>),
    readDraft: async (template) => ask('GET /v1/templates/:template/draft', { template }, json<Draft>),
    saveDraft: async (template, report, from) =>
      ask('PUT /v1/templates/:template/draft', { template }, json<DraftSaved>, { headers: { 'content-type': 'application/json', ...preconditionOf(from) }, body: JSON.stringify(report) }),
    // A copy of the bytes is sent: fetch takes a view of an ArrayBuffer alone, and `bytes` may be a view of a shared one.
    keepImage: async (bytes, digest, mediaType) => ask('PUT /v1/assets/:digest', { digest: digitsOf(digest) }, json<ImageKept>, { headers: { 'content-type': mediaType }, body: new Uint8Array(bytes) }),
    readImage: async (digest) => ask('GET /v1/assets/:digest', { digest: digitsOf(digest) }, image),
  }
}
