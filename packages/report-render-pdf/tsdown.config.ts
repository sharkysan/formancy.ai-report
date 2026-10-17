import { defineConfig } from 'tsdown'
import { fontAsBase64 } from './font-plugin.ts'

export default defineConfig({
  // Two entries over one renderer: Node's, which reads pdfmake's font files,
  // and the browser's, which uses pdfmake's browser build and its virtual
  // file system (README, "Node and the browser").
  entry: ['src/index.ts', 'src/browser.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // Nothing from node_modules is inlined (formancy.ai-data 0046): tsdown
  // inlines a package this one imports at run time without declaring it, and
  // the dist -- and an app's bundle or a tarball made from it -- would carry
  // that code as this repository's own, under its licence. With this list
  // empty, such a build fails instead, naming the package.
  deps: { onlyBundle: [] },
  // The slip's font files as base64, for the browser entry, in the chunk
  // `src/bill-fonts.ts` becomes, which only a document with a bill imports.
  plugins: [fontAsBase64],
})
