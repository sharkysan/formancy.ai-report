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
  // Measured with `vite build` (Vite 8.3.5) on 2026-11-15 on an Apple M2
  // under macOS 26.5.2 and Node 22.23.4, each chunk's size as the build
  // prints it, minified and gzipped: the renderer's chunk is 1,989.2 kB and
  // 871.1 kB gzipped -- pdfmake's browser build, and Roboto's four fonts in
  // it as base64 -- and loads with the first preview, as PDF.js's 430.1 kB
  // and the Angular builder's 171.5 kB load when first needed, and Liberation
  // Sans's chunk, 1,100.3 kB and 518.7 kB gzipped, with the first preview of
  // a report with a QR-bill, and ECharts' and zrender's chunk, 550.7 kB and
  // 189.0 kB gzipped (the spike measured 540.5 and 184.9 on 2026-11-11), with
  // the first preview of a report with a chart that has marks to draw (the
  // Studio's palette offers no chart yet, so it loads for none of its
  // starters); the page's own chunk, React and the React builder with the
  // editor model, is 891.5 kB and 287.8 kB gzipped. The limit is the
  // renderer's chunk with 10.9 kB of room: that chunk growing past it warns,
  // and no other chunk is near it, so a growth of theirs is not warned of;
  // nothing fails on the warning either, and main's build at c4d1a6a already
  // printed it at the old limit of 1950 (1,965.6 kB), before any chart. The
  // chart chunk is 550.7 kB, well under the limit, so the limit stays.
  // The renderer's chunk was 1,922.2 kB on 2026-10-17; of the 67.0 kB since,
  // read from a build's source map on 2026-11-15, 14.8 kB are the renderer's
  // chart modules and 4.2 kB the runtime's chart lowering, and the other
  // 48.0 kB are main's growth before the charts, which the earlier measure
  // put at 43.4 kB, and the charts' hooks in modules that are not named for
  // them, which no source map here separates. Of the renderer's 14.8 kB,
  // 4.3 kB (`chartOption`, its series builders, `barWidth`) only the chart
  // chunk uses and the renderer's chunk carries all the same. Installed,
  // `du -sk` on 2026-11-15: echarts 6.1.0 is 62,176 KiB and zrender 6.1.0
  // 5,168 KiB, with every renderer.
  // What holds the chunks is this warning and a test that counts the chart
  // chunk's loads and one zrender and one echarts in it; what does not is
  // a budget for each chunk that fails, which a test reading each chunk's
  // size would be, and nothing is that today.
  build: { chunkSizeWarningLimit: 2000 },
})
