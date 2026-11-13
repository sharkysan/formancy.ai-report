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
 * - echarts' lib/util/number.js says a method of it, `quantile`, is copied
 *   from d3.js, under d3's BSD-3-Clause, whose text echarts ships as
 *   licenses/LICENSE-d3, a directory the plugin does not read: it reads the
 *   licence and notice files at a package's root and in the directories
 *   between that root and a bundled file (lib/util/), so echarts' LICENSE
 *   and NOTICE reach the notices by themselves and this one does not. The
 *   Studio's build drops `quantile` (measured on 2026-11-13 through the
 *   chart chunk's source map: no segment of that method, and none of its
 *   text in the chunk); the notice is kept because the file is bundled and
 *   the file says it, and the build stops should the file stop being.
 *
 * `notices.test.ts` holds the fonts' notices to the fonts' own name tables
 * and the d3 notice to its text in a build of the renderer's browser entry.
 * Only vite.config.ts, that test and `scripts/renderer-notices.mjs`, which
 * it runs, import this file; nothing the page loads does.
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
  {
    package: 'echarts',
    file: 'lib/util/number.js',
    name: "d3.js's BSD-3-Clause licence, for the code echarts copied from it (echarts's licenses/LICENSE-d3)",
    // Through report-render-pdf's own dependency, the only copy there is.
    from: fileURLToPath(new URL('../../../packages/report-render-pdf/node_modules/echarts/licenses/LICENSE-d3', import.meta.url)),
  },
]
