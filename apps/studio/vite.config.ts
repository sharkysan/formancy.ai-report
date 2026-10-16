import { fileURLToPath } from 'node:url'
import angular from '@analogjs/vite-plugin-angular'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { thirdPartyNotices } from '../../scripts/third-party-notices.mjs'
import { starters, STARTERS_MODULE } from './src/starters/plugin.ts'

/**
 * What the Angular compiler is pointed at, and nothing else: the one
 * component file of ours, and the Angular builder, which ng-packagr built in
 * partial compilation and which needs the linker. formancy.ai-data's host
 * page's list, for its reason: the compiler's output for a module that
 * declares no component drops its exports, so the editor's token and the
 * bootstrap are plain files beside the component and are not on this list.
 * The builder is a workspace package, so it is named by its built file's
 * name, which is the path Vite resolves it to.
 */
export const ANGULAR_SOURCES = ['builder/angular-builder', 'formancy-report-builder-angular']

/** Resolved when the plugin asks, as formancy.ai-data's apps do: under Vitest `import.meta.url` is not a file URL. */
const TSCONFIG = (): string => fileURLToPath(new URL('./tsconfig.angular.json', import.meta.url))

/**
 * The Studio, built the way formancy.ai-data's host page is: Vite, React,
 * and Angular through the analog plugin; and the corpus's starters, read in
 * Node and handed to the page as one module (src/starters/plugin.ts).
 */
export default defineConfig({
  plugins: [
    react(),
    angular({
      tsconfig: TSCONFIG,
      transformFilter: (_code: string, id: string) => ANGULAR_SOURCES.some((part) => id.includes(part)),
    }),
    starters(),
    // dist/THIRD-PARTY-NOTICES.txt: every package the build bundles, with
    // the licence and notice files it ships; a package with no licence text,
    // or code the plugin cannot place, stops the build (formancy.ai-data
    // 0046). The starters' module is the corpus's synthetic data, this
    // repository's own. pdfmake's vfs_fonts.js carries Roboto's four fonts
    // as base64, and pdfmake's package ships only its own MIT licence, so
    // the OFL that Roboto asks to travel with it is named here; the Studio's
    // notices.test.ts holds that file to the fonts' own name tables.
    thirdPartyNotices({
      ownModules: [STARTERS_MODULE],
      embedded: [
        {
          package: 'pdfmake',
          file: 'build/vfs_fonts.js',
          name: 'Roboto, under the SIL Open Font License 1.1',
          from: fileURLToPath(new URL('./notices/roboto-ofl.txt', import.meta.url)),
        },
      ],
    }),
  ],
  // The Angular builder is linked from the workspace, and Vite optimises
  // only what comes from node_modules unless told: optimised, the Angular
  // plugin's linker reaches it in the dev server too, which otherwise falls
  // back to compiling it just in time and fails without @angular/compiler.
  optimizeDeps: { include: ['@formancy/report-builder-angular'] },
  // Fail rather than wander to the next free port: an address nobody was
  // told about is worse than an error. 4390 to 4393 are formancy.ai-data's
  // server and apps, on a machine that runs both repositories.
  server: { port: 4394, strictPort: true },
  preview: { port: 4394, strictPort: true },
  // Measured with `vite build` on 2026-10-16: the renderer's chunk is
  // 1,895.0 kB minified, 837.9 kB gzipped -- pdfmake's browser build, and
  // Roboto's four fonts in it as base64 -- and loads with the first
  // preview, as PDF.js's 429.9 kB and the Angular builder's 150.1 kB load
  // when first needed; the page's own chunk, React and the React builder
  // with the editor model, is 577.7 kB. The limit is the largest with a
  // little room, so a dependency that grows any of them still warns.
  build: { chunkSizeWarningLimit: 1950 },
})
