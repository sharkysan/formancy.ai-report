/**
 * The draft slice's routes (0049): a tenant's templates, a template's draft
 * read and saved, and the images a draft declares kept and read. Each is an
 * adapter over report-server-core's use case of the same name, which
 * decides who may, what a draft and an image must be, and the status of
 * every answer; a route parses its request into the use case's arguments
 * and sends what it answers, its revision as the `ETag`. Nothing here
 * judges a draft or an image, so that a route and a use case cannot
 * disagree about one.
 *
 * What only a route can decide is how a body is read: the draft's route
 * reads JSON and nothing else, up to report-spec's `MAX_REPORT_BYTES`; the
 * asset's reads the three kinds of image report-spec admits, as bytes, up to
 * `MAX_ASSET_BYTES`. A body past the limit is refused by the length it
 * declares before a byte is read, or once it is read past the limit where
 * it declares none, and one of any other media type is not read at all;
 * app.ts answers either with the route's refusal. And no
 * body is read before the request's origin and its token are: those hooks
 * run before parsing (app.ts, cors.ts).
 */
import { isRevision, keepImage, listTemplates, readDraft, readImage, REFUSALS, saveDraft } from '@formancy/report-server-core'
import type { Answer, Asking, Precondition, RefusalAnswer, ReportIdentity, RolePolicy, TemplateStore } from '@formancy/report-server-core'
import { ASSET_MEDIA_TYPES, MAX_ASSET_BYTES, MAX_REPORT_BYTES } from '@formancy/report-spec'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

declare module 'fastify' {
  interface FastifyContextConfig {
    /** The refusal a body past the route's `bodyLimit` is answered with: a route that reads a body names its own. */
    tooLarge?: 'report-too-large' | 'image-too-large'
  }
}

/** A strong ETag of a revision, as a draft's read and a save answer one: the digits, no leading zero, in quotes. */
const STRONG_REVISION = /^"([1-9][0-9]*)"$/

/**
 * What a save's headers say it stands on: `If-None-Match: *` alone, a
 * template not yet saved; `If-Match` alone holding exactly one strong ETag
 * of a revision, that revision; neither, nothing. Anything else -- a weak
 * tag, a list, a number without its quotes, revision 0 or one past the safe
 * integers, `If-Match: *`, both headers at once -- is `malformed`, which the
 * route answers 400 before the use case is asked: read as some revision or
 * none, it would save over what its author never named. A revision is
 * `isRevision`'s, as the use case judges one.
 */
export function parsePrecondition(headers: { readonly 'if-match'?: string | undefined; readonly 'if-none-match'?: string | undefined }): Precondition | 'malformed' {
  const match = headers['if-match']
  const noneMatch = headers['if-none-match']
  if (match === undefined) {
    if (noneMatch === undefined) return { kind: 'none' }
    return noneMatch === '*' ? { kind: 'create' } : 'malformed'
  }
  if (noneMatch !== undefined) return 'malformed'
  const revision = Number(STRONG_REVISION.exec(match)?.[1])
  return isRevision(revision) ? { kind: 'replace', revision } : 'malformed'
}

/** Sends what a use case answered, under its status, with its revision as the `ETag` where it has one. */
function send(reply: FastifyReply, answered: Answer<unknown> | RefusalAnswer): FastifyReply {
  if (answered.revision !== undefined) reply.header('etag', `"${String(answered.revision)}"`)
  return reply.code(answered.status).send(answered.body)
}

/**
 * Registers the five routes in `api`, whose hooks have verified the token
 * before any of them runs, each in a context of its own parsers. Every
 * route is one `ROUTES` names, with its audit name.
 */
export function registerDraftRoutes(api: FastifyInstance, options: { store: TemplateStore; roles: RolePolicy }): void {
  /** Who asks, under the operator's policy, of the store: the identity is the one api's hook verified. */
  const asking = (request: FastifyRequest): Asking => ({ identity: request.identity as ReportIdentity, roles: options.roles, store: options.store })

  void api.register(async (drafts) => {
    // JSON alone, by Fastify's own parser, which refuses a prototype key.
    drafts.removeContentTypeParser('text/plain')

    drafts.get('/v1/templates', async (request, reply) => send(reply, await listTemplates(asking(request))))

    drafts.get<{ Params: { template: string } }>('/v1/templates/:template/draft', async (request, reply) => send(reply, await readDraft(asking(request), request.params.template)))

    drafts.put<{ Params: { template: string } }>('/v1/templates/:template/draft', { bodyLimit: MAX_REPORT_BYTES, config: { tooLarge: 'report-too-large' } }, async (request, reply) => {
      const precondition = parsePrecondition(request.headers)
      if (precondition === 'malformed') return reply.code(400).send(REFUSALS['bad-request'])
      return send(reply, await saveDraft(asking(request), request.params.template, request.body, precondition))
    })
  })

  void api.register(async (assets) => {
    // The image kinds report-spec admits, each as the bytes that came; no other type is read.
    assets.removeAllContentTypeParsers()
    assets.addContentTypeParser([...ASSET_MEDIA_TYPES], { parseAs: 'buffer' }, (_request, body, done) => {
      done(null, body)
    })

    assets.put<{ Params: { digest: string }; Body: Buffer | undefined }>('/v1/assets/:digest', { bodyLimit: MAX_ASSET_BYTES, config: { tooLarge: 'image-too-large' } }, async (request, reply) =>
      // A keep with no body has no media type and no bytes, which the use case refuses as no image.
      send(reply, await keepImage(asking(request), request.params.digest, request.headers['content-type'] ?? '', request.body ?? new Uint8Array())),
    )

    assets.get<{ Params: { digest: string } }>('/v1/assets/:digest', async (request, reply) => {
      const answered = await readImage(asking(request), request.params.digest)
      if (!answered.ok) return send(reply, answered)
      // The bytes themselves, as they were kept, under the kind they were sniffed as.
      return reply.code(answered.status).header('content-type', answered.body.mediaType).send(answered.body.bytes)
    })
  })
}
