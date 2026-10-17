// The pages' build, after `vite build --ssr src/render.tsx --outDir dist-ssr`
// (package.json's `build`): the renderer Vite compiled for Node, run once
// over what scripts/inputs.mjs reads from the repository, and the site it
// makes written by scripts/write-site.mjs into dist/: every page as static
// HTML at dist/<lang>/…/index.html, dist/sitemap.xml, the stylesheet and
// the pictures, copied from docs/images (0021). Then the compiled renderer
// is removed: it is a step of the build, never served, and outside dist/
// it would be read by the repository's guards as source.
//
// scripts/demo.mjs stages dist/ beside the built Studio, under /report/.
//
// Node's built-ins, the inputs reader, the writer and the renderer it built.

import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readInputs } from './inputs.mjs'
import { writeSite } from './write-site.mjs'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = join(app, '..', '..')
const compiled = join(app, 'dist-ssr')

try {
  const { PICTURES, renderSite } = await import(pathToFileURL(join(compiled, 'render.js')).href)
  const site = renderSite(readInputs(repo, { pictures: PICTURES }))
  writeSite(site, { repo, dist: join(app, 'dist') })
  console.log(`apps/pages/dist: ${String(site.pages.length)} pages and ${String(site.files.length - site.pages.length)} files beside them`)
} finally {
  rmSync(compiled, { recursive: true, force: true })
}
