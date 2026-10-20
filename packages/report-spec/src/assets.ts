/**
 * The assets a report shows, each named by its id and pinned by its
 * digest; the bytes are the deployment's. What a PNG's or a JPEG's bytes
 * may be, `image-header.ts` reads, and an SVG's, `svg.ts`.
 */

/** An asset's bytes are a PNG, a JPEG, or an SVG in the form report-spec's `cleanSvg` writes (0030). */
export const ASSET_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'] as const
export type AssetMediaType = (typeof ASSET_MEDIA_TYPES)[number]

/**
 * An approved asset, named by id and pinned by digest. The bytes never live
 * in the definition, and rendering never follows a mutable "latest" asset
 * (plan 17): a new logo is a new digest and a new template release.
 */
export interface AssetRef {
  readonly id: string
  readonly mediaType: AssetMediaType
  /** `sha256:` and 64 lower-case hex digits. */
  readonly digest: string
}
