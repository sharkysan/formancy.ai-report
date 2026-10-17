/**
 * The bundled files that carry somebody else's work with no licence text of
 * their own beside them, and the notice that work's licence asks to travel
 * with it, reviewed: what vite.config.ts hands scripts/third-party-notices.mjs
 * as `embedded`.
 *
 * - pdfmake's vfs_fonts.js carries Roboto's four fonts as base64, and
 *   pdfmake's package ships only its own MIT licence, so the OFL that
 *   Roboto asks for is a file of the Studio's, written by hand.
 * - report-render-pdf's bill-fonts chunk carries Liberation Sans's two
 *   faces, for a QR-bill's slip. The package is this repository's own, so
 *   without this the fonts would ship under its terms. The notice is the
 *   licence file the fonts' release ships, which the package keeps beside
 *   them in fonts/, and the chunk is named by a pattern, as its build
 *   hashes the name.
 *
 * `notices.test.ts` holds each notice to the fonts' own name tables. Only
 * vite.config.ts and that test import this file; nothing the page loads
 * does.
 */
import { fileURLToPath } from 'node:url'

export interface EmbeddedNotice {
  /** The package the file is bundled from, by its manifest's name. */
  readonly package: string
  /** The file, by its path in the package, or a pattern of that path. */
  readonly file: string | RegExp
  /** What the notice is, as the notices file names it. */
  readonly name: string
  /** The notice's text, as a file. */
  readonly from: string
}

export const EMBEDDED_NOTICES: readonly EmbeddedNotice[] = [
  {
    package: 'pdfmake',
    file: 'build/vfs_fonts.js',
    name: 'Roboto, under the SIL Open Font License 1.1',
    from: fileURLToPath(new URL('../notices/roboto-ofl.txt', import.meta.url)),
  },
  {
    package: '@formancy/report-render-pdf',
    file: /^dist\/bill-fonts-[\w-]+\.mjs$/,
    name: 'Liberation Sans 2.1.5, under the SIL Open Font License 1.1',
    from: fileURLToPath(new URL('../../../packages/report-render-pdf/fonts/LICENSE-LiberationSans.txt', import.meta.url)),
  },
]
