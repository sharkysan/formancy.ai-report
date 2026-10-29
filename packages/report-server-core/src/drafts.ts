import { isFontMediaType, isIdentifier, validateReport } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { can } from './actions.js'
import type { RolePolicy } from './actions.js'
import { answer, refuse } from './answer.js'
import type { Answer, RefusalAnswer } from './answer.js'
import type { ReportIdentity } from './identity.js'
import type { TemplateStore } from './store.js'
import { DRAFT_FORMAT, isRevision, REFUSALS } from './wire.js'
import type { Draft, DraftSaved, TemplateList } from './wire.js'

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
 * the revision it replaces.
 */
export type Precondition = { readonly kind: 'none' } | { readonly kind: 'create' } | { readonly kind: 'replace'; readonly revision: number }

/** The tenant's templates, by id. */
export async function listTemplates(asking: Asking): Promise<Answer<TemplateList> | RefusalAnswer> {
  const { identity, roles, store } = asking
  if (!can(identity, 'template.list', roles)) return refuse(403, REFUSALS.forbidden)
  const templates = await store.list(identity.tenant)
  // A store lists in its medium's order; the wire says by id, so the order is decided here, once. An id is lower-case ASCII, so code units compare it.
  return answer(200, { templates: templates.toSorted(({ template: a }, { template: b }) => Number(a > b) - Number(a < b)) })
}

/** The template's newest draft, with its revision beside the body for the route's `ETag`. */
export async function readDraft(asking: Asking, template: string): Promise<Answer<Draft> | RefusalAnswer> {
  const { identity, roles, store } = asking
  if (!can(identity, 'draft.read', roles)) return refuse(403, REFUSALS.forbidden)
  if (!isIdentifier(template)) return refuse(400, REFUSALS['template-id-invalid'])
  const draft = await store.newest(identity.tenant, template)
  if (draft === undefined) return refuse(404, REFUSALS['no-draft'])
  return answer(200, { format: DRAFT_FORMAT, template, revision: draft.revision, savedBy: draft.savedBy, report: draft.report }, draft.revision)
}

/**
 * Saves `body` as the template's next draft, if it stands where the
 * precondition says. The checks run in this order, each refusing what the
 * ones before it let through, and nothing is written unless all pass:
 * the capacity; the template id; a precondition; the format; the report's
 * id being the template's; every image kept, as the kind it declares, and
 * no font declared; and last, the store's swap, which only one of any saves
 * from one revision wins.
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
  const saved = await store.save(identity.tenant, template, from, { savedBy: identity.subject, report })
  // The revision that stands, in the body and beside it for the ETag; none where the template has no draft.
  if (!saved.saved) return refuse(412, { ...REFUSALS['draft-changed'], revision: saved.revision }, saved.revision ?? undefined)
  return answer(from === null ? 201 : 200, { template, revision: saved.revision }, saved.revision)
}

/**
 * The revision a save replaces: `null` for a template not yet saved, a
 * revision, or undefined where the request named none. A revision is
 * `isRevision`'s, which the route parses a header by too; a number that is
 * none is no precondition, for it would reach a store that names a file by
 * it.
 */
function replaces(precondition: Precondition): number | null | undefined {
  switch (precondition.kind) {
    case 'create':
      return null
    case 'replace':
      return isRevision(precondition.revision) ? precondition.revision : undefined
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
