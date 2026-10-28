import type { AssetMediaType, ReportDefinition } from '@formancy/report-spec'
import type { TemplateSummary } from './wire.js'

/**
 * The port a server's use cases keep a tenant's drafts and images behind
 * (0049). It holds records and answers questions about them and decides
 * nothing: who may ask, what a draft must be and what an image must be are
 * the use cases', made before the store is called, so that every store a
 * deployment runs behind the port is held to the same rules by the same
 * code.
 *
 * Every method takes the tenant first, from the verified identity and from
 * nothing else a request carries; a store never reads across tenants. A
 * `digest` is the full `sha256:` form, as a report names an asset.
 */

/** A template's draft as a store holds it: the revision it was written at, the subject that wrote it, and the report as the validator returned it. */
export interface StoredDraft {
  /** A positive safe integer; the first save of a template is 1 and each save after it the next. */
  readonly revision: number
  readonly savedBy: string
  readonly report: ReportDefinition
}

/**
 * What a save came to: written at `revision`, or not written because the
 * newest draft was not the one the save started from. `revision` is then
 * the newest draft's, or `null` where the template has none.
 */
export type SaveOutcome = { readonly saved: true; readonly revision: number } | { readonly saved: false; readonly revision: number | null }

/** An image as a store holds it: the bytes and the kind they were sniffed as. */
export interface StoredImage {
  readonly mediaType: AssetMediaType
  readonly bytes: Uint8Array
}

export interface TemplateStore {
  /** The tenant's templates with their newest drafts' revisions and titles, in any order. */
  list(tenant: string): Promise<readonly TemplateSummary[]>
  /** The template's newest draft; undefined where it has none. */
  newest(tenant: string, template: string): Promise<StoredDraft | undefined>
  /** `from` null creates the template; a number replaces that revision. Exactly one of any concurrent saves from one `from` wins. */
  save(tenant: string, template: string, from: number | null, draft: { readonly savedBy: string; readonly report: ReportDefinition }): Promise<SaveOutcome>
  /** Keeps `image` under `digest`; a second keep of the same digest leaves it as it is. */
  keepImage(tenant: string, digest: string, image: StoredImage): Promise<void>
  readImage(tenant: string, digest: string): Promise<StoredImage | undefined>
  hasImage(tenant: string, digest: string): Promise<boolean>
}
