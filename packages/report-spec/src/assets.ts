/**
 * The assets a report shows or prints in, each named by its id and pinned
 * by its digest; the bytes are the deployment's. What a PNG's or a JPEG's
 * bytes may be, `image-header.ts` reads, an SVG's, `svg.ts`, and a font's,
 * `font.ts` (0040, 0043).
 */

/** An image asset's bytes are a PNG, a JPEG, or an SVG in the form report-spec's `cleanSvg` writes (0030). */
export const ASSET_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'] as const
export type AssetMediaType = (typeof ASSET_MEDIA_TYPES)[number]

/**
 * A font asset's bytes are a TrueType font (`font/ttf`, RFC 8081), read by
 * `readFont` (0040). An OpenType CFF font (`font/otf`) is not admitted:
 * `readFont` reads no CFF outlines and refuses `OTTO` bytes, and the
 * e-invoice gate has not proved a CFF face embeds in a PDF/A-3b (FT-Q15,
 * 0043).
 */
export const FONT_MEDIA_TYPES = ['font/ttf'] as const
export type FontMediaType = (typeof FONT_MEDIA_TYPES)[number]

/** Every media type an asset may declare: an image's, or a font's. */
export const ASSET_AND_FONT_MEDIA_TYPES = [...ASSET_MEDIA_TYPES, ...FONT_MEDIA_TYPES] as const
export type AnyAssetMediaType = AssetMediaType | FontMediaType

/** Whether `mediaType` is a font's, not an image's. */
export function isFontMediaType(mediaType: string): mediaType is FontMediaType {
  return (FONT_MEDIA_TYPES as readonly string[]).includes(mediaType)
}

/**
 * An approved asset, named by id and pinned by digest. The bytes never live
 * in the definition, and rendering never follows a mutable "latest" asset
 * (plan 17): a new logo, or a new typeface, is a new digest and a new
 * template release.
 */
export interface AssetRef {
  readonly id: string
  readonly mediaType: AnyAssetMediaType
  /** `sha256:` and 64 lower-case hex digits. */
  readonly digest: string
}
