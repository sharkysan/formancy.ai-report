// A build of report-render-pdf's browser entry alone with the Studio's
// notices plugin: the THIRD-PARTY-NOTICES.txt it writes and the chunks it
// makes, printed to standard output as JSON.
//
// src/notices.test.ts runs it in a process of its own: the bundler Vite
// uses refuses a plugin handed to it from inside Vitest's module runner, and
// the build it would otherwise wait for (`pnpm build`) is not one the suite
// may assume. It is the same plugin with the same reviewed list
// (src/embedded-notices.ts) as vite.config.ts hands it, over the same
// package, without the Studio's page, builders or starters.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { thirdPartyNotices } from '../../../scripts/third-party-notices.mjs'
import { EMBEDDED_NOTICES } from '../src/embedded-notices.ts'

const app = fileURLToPath(new URL('..', import.meta.url))
/** The renderer's browser entry, as the Studio's build reaches it (its `exports` map's file), the input of this build. */
const ENTRY = createRequire(import.meta.url).resolve('@formancy/report-render-pdf/browser')

const result = await build({
  root: app,
  configFile: false,
  logLevel: 'silent',
  plugins: [thirdPartyNotices({ embedded: EMBEDDED_NOTICES })],
  build: { write: false, rolldownOptions: { input: ENTRY } },
})
const outputs = (Array.isArray(result) ? result : [result]).flatMap((each) => ('output' in each ? each.output : []))
const notices = outputs.find((each) => each.fileName === 'THIRD-PARTY-NOTICES.txt')
if (notices === undefined) throw new Error('the build wrote no THIRD-PARTY-NOTICES.txt')
// What `notices.test.ts` reads: the notices' text, and the chunks as the bundler wrote them, each with the modules it holds and what it imports.
const chunks = outputs
  .filter((each) => each.type === 'chunk')
  .map(({ fileName, isEntry, imports, dynamicImports, moduleIds }) => ({ fileName, isEntry, imports, dynamicImports, moduleIds }))
process.stdout.write(JSON.stringify({ notices: Buffer.from(notices.source).toString('utf8'), chunks }))
