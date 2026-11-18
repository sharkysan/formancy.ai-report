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
  // Measured again with `vite build` (Vite 8.3.5) on 2026-11-17 on a
  // Windows 11 workstation (i9-10900K) under Node 24.21.0, once a printed
  // preview wrote its Word file (0068), the same checkout built before and
  // after: the writer and fflate are a chunk of their own, 48.5 kB and
  // 18.5 kB gzipped, asked for with the first PDF that printed; the
  // runtime, which that chunk and the renderer's both read, left the
  // renderer's for a chunk between them, 78.7 kB and 26.5 kB gzipped; so
  // the renderer's chunk went from 1,996.6 kB and 873.6 kB gzipped to
  // 1,918.1 kB and 848.0 kB, and has 81.9 kB of room under the limit where
  // it had 3.4 kB; the page's own chunk is 1,000.3 kB, 0.8 kB more.
  // On 2026-11-18, the same way, once the writer held a PNG's image data
  // to its checksum and its end and a file to the bounds a review added,
  // its chunk was 50.3 kB and 19.1 kB gzipped; the renderer's and the
  // runtime's were what they had been. And later that day, the same way,
  // once the writer inflated a PNG's image data with pako and no longer
  // with fflate, whose inflater the bundler then left out: 79.4 kB and
  // 28.1 kB gzipped, 29.1 kB and 9.0 kB more; the renderer's chunk
  // 1,918.1 kB and 848.0 kB and the runtime's 78.7 kB and 26.5 kB, as
  // they had been.
  // What holds the chunks is this warning, a test that counts the chart
  // chunk's loads and one zrender and one echarts in it, and one that
  // holds the writer, fflate and pako to one chunk the pipeline imports
  // dynamically (src/preview/chunks.test.ts); what does not is a budget
  // for each chunk that fails, which a test reading each chunk's size
  // would be, and nothing is that today.
  build: { chunkSizeWarningLimit: 2000 },
})
