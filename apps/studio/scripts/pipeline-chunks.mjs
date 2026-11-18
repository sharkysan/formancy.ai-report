// A build of the preview's pipeline alone, src/preview/pipeline.ts: the
// chunks the bundler makes of it, each with the modules it holds and what
// it imports, printed to standard output as JSON.
//
// src/preview/chunks.test.ts runs it in a process of its own, as
// src/notices.test.ts runs renderer-notices.mjs, and for its reasons: the
// bundler is not run from inside Vitest's module runner, and the build the
// suite would otherwise wait for (`pnpm build`) is not one it may assume.
// It is the Studio's own module over the Studio's own resolver, without
// the page, the builders or the starters: what the pipeline imports, and
// how, is what the Studio's build bundles of it.
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const app = fileURLToPath(new URL('..', import.meta.url))
const ENTRY = fileURLToPath(new URL('../src/preview/pipeline.ts', import.meta.url))

const result = await build({
  root: app,
  configFile: false,
  logLevel: 'silent',
  // An entry's exports are kept: a page's build keeps none, and the pipeline, which nothing here calls, would be shaken out whole.
  build: { write: false, rolldownOptions: { input: ENTRY, preserveEntrySignatures: 'strict' } },
})
const outputs = (Array.isArray(result) ? result : [result]).flatMap((each) => ('output' in each ? each.output : []))
const chunks = outputs
  .filter((each) => each.type === 'chunk')
  .map(({ fileName, isEntry, imports, dynamicImports, moduleIds }) => ({ fileName, isEntry, imports, dynamicImports, moduleIds }))
process.stdout.write(JSON.stringify({ chunks }))
