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

/**
 * A template's draft as a store holds it: the revision it was written at,
 * the digest of the report as it was written, the subject that wrote it,
 * and the report as the validator returned it.
 */
export interface StoredDraft {
  /** A positive safe integer; the first save of a template is 1 and each save after it the next. */
  readonly revision: number
  /**
   * `sha256:` and the SHA-256 of the report's text as the store wrote it,
   * which tells two drafts written under one revision apart: the use case
   * compares it with the one a save names before the store's swap (0049).
   */
  readonly digest: string
  readonly savedBy: string
  readonly report: ReportDefinition
}

/**
 * What a save came to: written at `revision`, its report's `digest` as
 * `StoredDraft` holds it, or not written because the newest draft was not
 * the one the save started from. `revision` is then the newest draft's, or
 * `null` where the template has none.
 */
export type SaveOutcome = { readonly saved: true; readonly revision: number; readonly digest: string } | { readonly saved: false; readonly revision: number | null }

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
  /**
   * `from` null creates the template; a number replaces that revision.
   * Exactly one of any concurrent saves from one `from` wins. The swap is
   * by revision alone: that the draft at `from` is the one the save names
   * by its digest too is the use case's to have checked.
   */
  save(tenant: string, template: string, from: number | null, draft: { readonly savedBy: string; readonly report: ReportDefinition }): Promise<SaveOutcome>
  /** Keeps `image` under `digest`; a second keep of the same digest leaves it as it is. */
  keepImage(tenant: string, digest: string, image: StoredImage): Promise<void>
  readImage(tenant: string, digest: string): Promise<StoredImage | undefined>
  /**
   * The kind the tenant's image under `digest` was kept as; undefined where
   * the tenant keeps none. A fact the store holds, not a judgement: whether
   * a draft may declare the image as the kind it declares is the use case's
   * to decide, by comparing the two.
   */
  imageKind(tenant: string, digest: string): Promise<AssetMediaType | undefined>
}
