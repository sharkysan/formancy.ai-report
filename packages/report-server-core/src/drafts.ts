import { isDigest, isFontMediaType, isIdentifier, validateReport } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { can } from './actions.js'
import type { RolePolicy } from './actions.js'
import { answer, refuse } from './answer.js'
import type { Answer, RefusalAnswer } from './answer.js'
import type { ReportIdentity } from './identity.js'
import type { TemplateStore } from './store.js'
import { DRAFT_FORMAT, isRevision, REFUSALS } from './wire.js'
import type { Draft, DraftSaved, DraftVersion, TemplateList } from './wire.js'

/**
 * The draft use cases (0049): what a server decides about listing, reading
 * and saving a tenant's drafts, as functions of who asks and the store's
 * port, and nothing else. A route parses its request into these arguments
 * and sends the answer under the status it carries; it judges nothing, so
 * two routes cannot disagree about a draft.
 *
 * Every use case asks `can` first, before it reads any part of the request
 * or asks the store, so that a refusal for want of a capacity cannot tell
 * a token whether a template, an id or an image exists.
 */

/** Who asks, under which role policy, of which store: what every use case is given. */
export interface Asking {
  readonly identity: ReportIdentity
  readonly roles: RolePolicy
  readonly store: TemplateStore
}

/**
 * What the request said about the draft it saves over, parsed by the route
 * from `If-Match` and `If-None-Match`: nothing, a template not yet saved, or
 * the version of the draft it replaces.
 */
export type Precondition = { readonly kind: 'none' } | { readonly kind: 'create' } | { readonly kind: 'replace'; readonly version: DraftVersion }

/** The tenant's templates, by id. */
export async function listTemplates(asking: Asking): Promise<Answer<TemplateList> | RefusalAnswer> {
  const { identity, roles, store } = asking
  if (!can(identity, 'template.list', roles)) return refuse(403, REFUSALS.forbidden)
  const templates = await store.list(identity.tenant)
  // A store lists in its medium's order; the wire says by id, so the order is decided here, once. An id is lower-case ASCII, so code units compare it.
  return answer(200, { templates: templates.toSorted(({ template: a }, { template: b }) => Number(a > b) - Number(a < b)) })
}

/** The template's newest draft, with its version beside the body for the route's `ETag`. */
export async function readDraft(asking: Asking, template: string): Promise<Answer<Draft> | RefusalAnswer> {
  const { identity, roles, store } = asking
  if (!can(identity, 'draft.read', roles)) return refuse(403, REFUSALS.forbidden)
  if (!isIdentifier(template)) return refuse(400, REFUSALS['template-id-invalid'])
  const draft = await store.newest(identity.tenant, template)
  if (draft === undefined) return refuse(404, REFUSALS['no-draft'])
  const { revision, digest } = draft
  return answer(200, { format: DRAFT_FORMAT, template, revision, digest, savedBy: draft.savedBy, report: draft.report }, { revision, digest })
}

/**
 * Saves `body` as the template's next draft, if it stands where the
 * precondition says. The checks run in this order, each refusing what the
 * ones before it let through, and nothing is written unless all pass:
 * the capacity; the template id; a precondition; the format; the report's
 * id being the template's; every image kept, as the kind it declares, and
 * no font declared; for a replace, the newest draft being the one the
 * precondition names, by its revision and its digest; and last, the store's
 * swap, which only one of any saves from one revision wins.
 *
 * What is stored is the report the validator returned, which shares no
 * object with `body`, and `savedBy` is the token's subject: a body says
 * nothing of who wrote it.
 */
export async function saveDraft(asking: Asking, template: string, body: unknown, precondition: Precondition): Promise<Answer<DraftSaved> | RefusalAnswer> {
  const { identity, roles, store } = asking
  if (!can(identity, 'draft.save', roles)) return refuse(403, REFUSALS.forbidden)
  if (!isIdentifier(template)) return refuse(400, REFUSALS['template-id-invalid'])
  const from = replaces(precondition)
  if (from === undefined) return refuse(428, REFUSALS['precondition-required'])
  const checked = validateReport(body)
  if (!checked.valid) return refuse(422, { ...REFUSALS['report-invalid'], errors: checked.errors })
  const { report } = checked
  if (report.id !== template) return refuse(422, REFUSALS['template-id-mismatch'])
  const unkept = await notKept(asking, report)
  if (unkept.length > 0) return refuse(422, { ...REFUSALS['asset-not-kept'], assets: unkept })
  if (from !== null) {
    // A revision alone names no one draft: a store gives it again where its
    // newest draft went (0049). So the draft that stands is compared here,
    // once for every store, with the version the save names; the swap after
    // it still decides between saves from the one that stands.
    const newest = await store.newest(identity.tenant, template)
    if (newest === undefined || newest.revision !== from.revision || newest.digest !== from.digest) return refuse(412, { ...REFUSALS['draft-changed'], revision: newest?.revision ?? null })
  }
  const saved = await store.save(identity.tenant, template, from === null ? null : from.revision, { savedBy: identity.subject, report })
  // The revision that stands, or none where the template has no draft.
  if (!saved.saved) return refuse(412, { ...REFUSALS['draft-changed'], revision: saved.revision })
  const { revision, digest } = saved
  return answer(from === null ? 201 : 200, { template, revision, digest }, { revision, digest })
}

/**
 * The version of the draft a save replaces: `null` for a template not yet
 * saved, a version, or undefined where the request named none. A version's
 * revision is `isRevision`'s and its digest report-spec's `isDigest`, which
 * the route parses a header by too; a version short of either is no
 * precondition, for its revision would reach a store that names a file by
 * it, and a digest that is none would match no draft. A replace with no
 * version at all -- a caller of the shape before it, or a cast -- is none
 * too, and not a throw.
 */
function replaces(precondition: Precondition): DraftVersion | null | undefined {
  switch (precondition.kind) {
    case 'create':
      return null
    case 'replace': {
      // The type says a version is there; a caller the type did not hold may have left it out.
      const revision = precondition.version?.revision
      const digest = precondition.version?.digest
      return isRevision(revision) && isDigest(digest) ? { revision, digest } : undefined
    }
    case 'none':
      return undefined
  }
}

/**
 * The ids of the assets the report declares and the store cannot give it,
 * sorted: an image the asking tenant has not kept under its digest as the
 * kind it declares, and every font, since no store here keeps one. An image
 * kept as another kind counts as not kept, as a font does, because each
 * would be saved and never printed: the runtime refuses an image handed
 * over as another kind than it declares, and a face nobody keeps. A font is
 * not asked of the store, so what the store holds under its digest changes
 * nothing.
 */
async function notKept(asking: Asking, report: ReportDefinition): Promise<string[]> {
  const { identity, store } = asking
  const held = await Promise.all(report.assets.map(async (asset) => !isFontMediaType(asset.mediaType) && (await store.imageKind(identity.tenant, asset.digest)) === asset.mediaType))
  return report.assets
    .filter((_, at) => !held[at])
    .map((asset) => asset.id)
    .toSorted()
}
