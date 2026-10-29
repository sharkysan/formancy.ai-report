import { isDigest } from '@formancy/report-spec'
import type { ReportDefinition, ReportError } from '@formancy/report-spec'
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
  'GET /v1/templates': 'template.list',
  'GET /v1/templates/:template/draft': 'draft.read',
  'PUT /v1/templates/:template/draft': 'draft.save',
  'PUT /v1/assets/:digest': 'asset.keep',
  'GET /v1/assets/:digest': 'asset.read',
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

/**
 * The stored draft's format number, the fourth version line (0046): written
 * into every record a store keeps and compared when one is read, so a record
 * of another number is refused rather than read as this one. A draft record
 * whose shape changes takes the next number.
 */
export const DRAFT_FORMAT = 1 as const

/** One template of the tenant, as `GET /v1/templates` lists it: the report's own id, its newest draft's revision and its title. */
export interface TemplateSummary {
  readonly template: string
  readonly revision: number
  readonly title: string
}

/** `GET /v1/templates`: the tenant's templates, by id. */
export interface TemplateList {
  readonly templates: readonly TemplateSummary[]
}

/**
 * Whether `value` is a revision: a positive safe integer, the first save of
 * a template 1 and each save after it the next. The one test of one, for a
 * route parsing an `If-Match` and a use case judging what the route parsed
 * alike, so that the two cannot disagree about a number a store names a
 * file by.
 */
export function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

/**
 * Which draft a read or a save answered, and so which one a save from it
 * replaces: its revision, a positive safe integer, and its `digest`,
 * `sha256:` and the 64 lower-case hexadecimal digits of the SHA-256 of the
 * report's text as the store wrote it. The revision alone does not name
 * one draft: it is the number of a template's newest record, so where that
 * record goes -- a backup older than it restored, the file removed by hand,
 * its name lost on power loss -- the next save is given its number again,
 * and the digest is what tells the two apart (0049).
 */
export interface DraftVersion {
  readonly revision: number
  readonly digest: string
}

/**
 * `GET /v1/templates/:template/draft`: a template's newest draft, its
 * version the one the `ETag` names and a save from it sends back as
 * `If-Match`, and `savedBy` the subject of the token that saved it.
 */
export interface Draft extends DraftVersion {
  readonly format: typeof DRAFT_FORMAT
  readonly template: string
  readonly savedBy: string
  readonly report: ReportDefinition
}

/** `PUT /v1/templates/:template/draft`: the version the save wrote. */
export interface DraftSaved extends DraftVersion {
  readonly template: string
}

/** What a report writes before a digest's 64 digits, and a tag leaves out. */
const DIGEST_PREFIX = 'sha256:'

/**
 * A draft's version as a strong `ETag`: `"<revision>-<64 hex>"`, the
 * quotes included and the digest without `sha256:`. The one writer of a
 * tag, for the route that answers one and a client that sends one back;
 * `draftVersionOf` is the one reader.
 */
export function draftTag(version: DraftVersion): string {
  return `"${String(version.revision)}-${version.digest.slice(DIGEST_PREFIX.length)}"`
}

/** A tag as `draftTag` writes one: the revision's digits, no leading zero, then what the digest is judged by. */
const DRAFT_TAG = /^"([1-9][0-9]*)-([^"]*)"$/

/**
 * The version `tag` names, where it is exactly one `draftTag` writes: the
 * revision `isRevision`'s, and the digits a digest report-spec's `isDigest`
 * takes once `sha256:` is put back before them. Anything else is
 * undefined -- a weak tag, a list, a tag without its quotes, the bare
 * revision, a revision 0, past the safe integers or with a leading zero,
 * upper-case or too few digits, `sha256:` inside the quotes -- so that no
 * tag is read as a version no read or save answered.
 */
export function draftVersionOf(tag: string): DraftVersion | undefined {
  const [, digits, hex] = DRAFT_TAG.exec(tag) ?? []
  const revision = Number(digits)
  const digest = `${DIGEST_PREFIX}${String(hex)}`
  return isRevision(revision) && isDigest(digest) ? { revision, digest } : undefined
}

/** `PUT /v1/assets/:digest`: the image now kept, by `sha256:` and the 64 hexadecimal digits of its bytes. */
export interface ImageKept {
  readonly digest: string
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
 * that arrives while the server closes, which quotes nothing either. The
 * draft slice's refusals are the same: a template's content, an id or a
 * digest the request carried is never in a sentence, and the four that
 * answer with a field of their own are `ServerRefusal`'s.
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
  forbidden: refusal('forbidden', 'The roles this token carries do not allow this action.'),
  'no-draft': refusal('no-draft', 'This template has no draft.'),
  'no-asset': refusal('no-asset', 'No image is kept under this digest for this tenant.'),
  'template-id-invalid': refusal('template-id-invalid', 'The template id in this path is not a report id the format allows.'),
  'template-id-mismatch': refusal('template-id-mismatch', 'The id of the report in this body is not the template id in the path.'),
  'digest-invalid': refusal('digest-invalid', 'The digest in this path is not a SHA-256 written as lower-case hexadecimal.'),
  'precondition-required': refusal(
    'precondition-required',
    'A save must carry If-Match, naming the draft it replaces by its ETag, or If-None-Match, for a draft not yet saved.',
  ),
  'draft-changed': refusal('draft-changed', 'The draft is not the one this save expected, so nothing was written; read it again before saving.'),
  'report-too-large': refusal('report-too-large', 'This report is larger than a draft may be.'),
  'image-too-large': refusal('image-too-large', 'This image is larger than a kept image may be.'),
  'unsupported-media-type': refusal('unsupported-media-type', 'This request body is not a media type this route reads.'),
  'report-invalid': refusal('report-invalid', 'This report is not one the format accepts; the errors listed with this refusal say where.'),
  'asset-not-kept': refusal(
    'asset-not-kept',
    'The report declares assets this server cannot give it for this tenant: an image not kept, or kept as another kind than declared, or a font, which this server does not keep. So it was not saved; the assets listed with this refusal are those.',
  ),
  'image-refused': refusal('image-refused', 'This image is not one this server keeps; the reason listed with this refusal says why.'),
  'digest-mismatch': refusal('digest-mismatch', 'The digest in this path is not the SHA-256 of this body.'),
})

export type RefusalCode = keyof typeof REFUSALS

export interface Refusal {
  readonly code: RefusalCode
  readonly message: string
}

/** The refusals that carry a field beside the fixed sentence. */
type FieldedCode = 'report-invalid' | 'draft-changed' | 'asset-not-kept' | 'image-refused'

/**
 * A refusal as the draft slice gives it. Four carry a field beside the
 * fixed sentence, to the requester alone: the `ReportError`s of the report
 * they sent, the revision that stands now (`null` where the draft has none),
 * the ids of the assets the report declares and the server does not hold,
 * and the reason report-spec gave for an image. The field quotes the
 * requester's own document back under their own token, and is never written
 * to a log, an audit event or any other answer.
 *
 * The plain member leaves those four codes out. With a plain `Refusal` in
 * the union, its `code` would still name them, a client that branches on
 * `code` would not be given the field by the type, and a refusal of one of
 * the four without its field would be a `ServerRefusal`.
 */
export type ServerRefusal =
  | (Refusal & { readonly code: Exclude<RefusalCode, FieldedCode> })
  | (Refusal & { readonly code: 'report-invalid'; readonly errors: readonly ReportError[] })
  | (Refusal & { readonly code: 'draft-changed'; readonly revision: number | null })
  | (Refusal & { readonly code: 'asset-not-kept'; readonly assets: readonly string[] })
  | (Refusal & { readonly code: 'image-refused'; readonly reason: string })

/**
 * The request headers a page on an origin the operator lists may send: the
 * token, the body's media type, and the preconditions a save names the
 * version it replaces by. The routes read these and nothing else a page
 * sets; a header granted that no route reads would be surface for nothing
 * (0046, widened to the draft's routes by 0049).
 */
export const CROSS_ORIGIN_REQUEST_HEADERS = Object.freeze(['authorization', 'content-type', 'if-match', 'if-none-match'] as const)

/**
 * The response headers a page on a listed origin may read beyond the ones
 * a browser always shows it: the `ETag` a draft's read and a save answer
 * with, the version the page's next save names in its `If-Match` (0049).
 */
export const CROSS_ORIGIN_RESPONSE_HEADERS = Object.freeze(['etag'] as const)
