/**
 * What the site is rendered from: what scripts/inputs.mjs reads from the
 * repository (0021). The renderer reads no file itself, so the suite and the
 * prerender render the same site from the same reading.
 */
export interface SiteInputs {
  /** The address the pages are served under, with its slash: the demo's, read from the Worker's route. */
  readonly site: string
  /** The repository on GitHub, the one every published package names by its `repository.url`. */
  readonly repository: string
  /** The homepage every published package names: since 0081, the English start page, which site.test.ts holds to the page the site builds. */
  readonly homepage: string
  /** The names of the packages published from packages/. */
  readonly packages: readonly string[]
  /** The newest release CHANGELOG.md records. */
  readonly release: { readonly version: string; readonly date: string; readonly anchor: string }
  /** LICENSE.md's version line, the address its production section names, and its table of terms, row by row. */
  readonly licence: { readonly version: string; readonly date: string; readonly address: string; readonly terms: readonly (readonly [string, string])[] }
  /** The files of the faces the stylesheet names, the Studio's faces: each by its url() beside the stylesheet, and the file it is copied from (0023). */
  readonly fonts: readonly Font[]
  /** The notices of the packages the stylesheet inlines: the faces', with the copyright and the licence the OFL asks each copy to carry, and formancy's room's, whose licence asks its notice to travel with its text (0034). */
  readonly notices: string
  /** The room's ground colour, for the browser's own chrome. */
  readonly ground: string
  /** src/pages.css with formancy's room and the Studio's stylesheets it imports inlined, the faces' among them, each url() naming its copy. */
  readonly stylesheet: string
  /** The pictures the site names, each with its size and the lines it shows: a starter's or an invoice sample's page's, or the Studio's text in a scene. */
  readonly pictures: readonly Picture[]
  /** Every file read, as a path from the repository's root: of an installed package, the stylesheets inlined. */
  readonly read: readonly string[]
}

export interface Font {
  /** What the stylesheet's url() says: a path relative to the stylesheet, under fonts/. */
  readonly href: string
  /** Its path from the repository's root, in the pages' node_modules, which the prerender copies. */
  readonly from: string
}

export interface Picture {
  /** Its path under docs/images. */
  readonly name: string
  /** Its path from the repository's root, which the prerender copies. */
  readonly from: string
  readonly width: number
  readonly height: number
  /**
   * The lines docs/images/pictures.json, or samples.json for an invoice
   * sample, says its page prints; for a picture of the Studio, the lines of
   * the text docs/images/readme/captured.json records its scene's parts
   * holding (0081).
   */
  readonly lines: readonly string[]
}
