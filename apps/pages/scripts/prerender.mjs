// The pages' build, after `vite build --ssr src/render.tsx --outDir dist-ssr`
// (package.json's `build`): the renderer Vite compiled for Node, run once
// over what scripts/inputs.mjs reads from the repository, writes every page
// as static HTML into dist/<lang>/…/index.html, with dist/sitemap.xml, the
// stylesheet and the pictures, copied from docs/images (0021). Then the
// compiled renderer is removed: it is a step of the build, never served,
// and outside dist/ it would be read by the repository's guards as source.
//
// scripts/demo.mjs stages dist/ beside the built Studio, under /report/.
//
// Node's built-ins, the inputs reader and the renderer it built.

import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readInputs } from './inputs.mjs'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = join(app, '..', '..')
const compiled = join(app, 'dist-ssr')
const dist = join(app, 'dist')

try {
  const { PICTURES, renderSite } = await import(pathToFileURL(join(compiled, 'render.js')).href)
  const site = renderSite(readInputs(repo, { pictures: PICTURES }))
  rmSync(dist, { recursive: true, force: true })
  for (const file of site.files) {
    const target = join(dist, file.path)
    mkdirSync(dirname(target), { recursive: true })
    if ('text' in file) writeFileSync(target, file.text, 'utf8')
    else copyFileSync(join(repo, file.from), target)
  }
  console.log(`apps/pages/dist: ${String(site.pages.length)} pages and ${String(site.files.length - site.pages.length)} files beside them`)
} finally {
  rmSync(compiled, { recursive: true, force: true })
}
