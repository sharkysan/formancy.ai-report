// The THIRD-PARTY-NOTICES.txt the Studio's plugin writes for a build of
// report-render-pdf's browser entry alone, printed to standard output.
//
// src/notices.test.ts runs it in a process of its own: the bundler Vite
// uses refuses a plugin handed to it from inside Vitest's module runner, and
// the build it would otherwise wait for (`pnpm build`) is not one the suite
// may assume. It is the same plugin with the same reviewed list
// (src/embedded-notices.ts) as vite.config.ts hands it, over the same
// package, without the Studio's page, builders or starters.
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { thirdPartyNotices } from '../../../scripts/third-party-notices.mjs'
import { EMBEDDED_NOTICES } from '../src/embedded-notices.ts'

const app = fileURLToPath(new URL('..', import.meta.url))
/** The entry of the Studio's that imports the renderer's browser entry and nothing else. */
const ENTRY = join(app, 'src', 'renderer-entry.ts')

const result = await build({
  root: app,
  configFile: false,
  logLevel: 'silent',
  plugins: [thirdPartyNotices({ embedded: EMBEDDED_NOTICES })],
  build: { write: false, rollupOptions: { input: ENTRY } },
})
const outputs = (Array.isArray(result) ? result : [result]).flatMap((each) => ('output' in each ? each.output : []))
const notices = outputs.find((each) => each.fileName === 'THIRD-PARTY-NOTICES.txt')
process.stdout.write(Buffer.from(notices.source))
