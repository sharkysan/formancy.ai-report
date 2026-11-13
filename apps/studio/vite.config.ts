import { fileURLToPath } from 'node:url'
import angular from '@analogjs/vite-plugin-angular'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { headersFor } from '../../scripts/demo-headers.mjs'
import { thirdPartyNotices } from '../../scripts/third-party-notices.mjs'
import { EMBEDDED_NOTICES } from './src/embedded-notices.ts'
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
  // Relative, so one build is right wherever it is served: at the root of
  // `vite preview` for `pnpm demo`, and under formancy.ai's /report/, where
  // the demo is and where the browser gate serves it (0018). Vite's default
  // writes /assets/…, which under /report/ is formancy.ai's own directory:
  // the page loads and its script does not. The dev server takes it as /.
  base: './',
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
    // repository's own; the fonts inside scripts, and the d3 code in
    // echarts that its package keeps no licence beside, are src/embedded-notices.ts'.
    thirdPartyNotices({ ownModules: [STARTERS_MODULE], embedded: EMBEDDED_NOTICES }),
  ],
  // The Angular builder is linked from the workspace, and Vite optimises
  // only what comes from node_modules unless told: optimised, the Angular
  // plugin's linker reaches it in the dev server too, which otherwise falls
  // back to compiling it just in time and fails without @angular/compiler.
  optimizeDeps: { include: ['@formancy/report-builder-angular'] },
  // Fail rather than wander to the next free port: an address nobody was
  // told about is worse than an error. 4390 to 4393 are formancy.ai-data's
  // server and apps, on a machine that runs both repositories. `pnpm demo`
  // is served with the headers the deploy writes for formancy.ai/report/,
  // for its own address (scripts/demo-headers.mjs, 0051): its policy names
  // that address alone, so the page opened at another name of the same
  // machine -- 127.0.0.1 -- runs no script. The dev server gets none: its
  // client is an inline script that opens a WebSocket, which the policy
  // refuses.
  server: { port: 4394, strictPort: true },
  preview: { port: 4394, strictPort: true, headers: headersFor('http://localhost:4394/') },
  // Measured with `vite build` (Vite 8.3.4) on 2026-11-13, each chunk's size
  // as the build prints it: the renderer's chunk is 1,986.7 kB minified,
  // 870.2 kB gzipped -- pdfmake's browser build, and Roboto's four fonts in
  // it as base64 -- and loads with the first preview, as PDF.js's 430.1 kB
  // and the Angular builder's 171.5 kB load when first needed, and Liberation
  // Sans's chunk, 1,100.3 kB and 518.7 kB gzipped, with the first preview of
  // a report with a QR-bill, and ECharts' and zrender's chunk, 549.6 kB and
  // 188.6 kB gzipped, with the first preview of a report with a chart that
  // has marks to draw (the Studio's palette offers no chart yet, so it loads
  // for none of its starters); the page's own chunk, React and the React
  // builder with the editor model, is 891.5 kB. The limit is the renderer's
  // chunk with 13 kB of room: that chunk growing past it warns, and no other
  // chunk is near it, so a growth of theirs is not warned of; nothing fails
  // on the warning either, and main's build at c4d1a6a already printed it at
  // the old limit of 1950 (1,965.6 kB). The renderer's chunk was 1,922.2 kB
  // on 2026-10-17; of the 64.5 kB since, measured with each commit's build
  // and its source map, 43.4 kB was main's before the charts, 5.7 kB the
  // runtime's charts and 15.0 kB the renderer's chart code. A budget for
  // each chunk, which fails, is Task 25's to add.
  build: { chunkSizeWarningLimit: 2000 },
})
