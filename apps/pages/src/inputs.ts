/**
 * What the site is rendered from: what scripts/inputs.mjs reads from the
 * repository (0021). The renderer reads no file itself, so the suite and the
 * prerender render the same site from the same reading.
 */
export interface SiteInputs {
  /** The address the pages are served under, with its slash: the demo's, read from the Worker's route. */
  readonly site: string
  /** The repository on GitHub, the homepage every published package names. */
  readonly repository: string
  /** The names of the packages published from packages/. */
  readonly packages: readonly string[]
  /** The newest release CHANGELOG.md records. */
  readonly release: { readonly version: string; readonly date: string; readonly anchor: string }
  /** LICENSE.md's version line, the address its production section names, and its table of terms, row by row. */
  readonly licence: { readonly version: string; readonly date: string; readonly address: string; readonly terms: readonly (readonly [string, string])[] }
  /** The Google Fonts stylesheet the Studio's page loads. */
  readonly fonts: string
  /** The room's ground colour, for the browser's own chrome. */
  readonly ground: string
  /** src/pages.css with the Studio's stylesheets it imports inlined. */
  readonly stylesheet: string
  /** The pictures the site names, each with its size and, for a starter's page, the lines it prints. */
  readonly pictures: readonly Picture[]
  /** Every file read, as a path from the repository's root. */
  readonly read: readonly string[]
}

export interface Picture {
  /** Its path under docs/images. */
  readonly name: string
  /** Its path from the repository's root, which the prerender copies. */
  readonly from: string
  readonly width: number
  readonly height: number
  /** The lines docs/images/pictures.json says its page prints; none for a picture of the Studio. */
  readonly lines: readonly string[]
}
