// The site, written to disk: every file the renderer made (src/site.tsx),
// each page and the sitemap and the stylesheet from their text, each
// picture copied from the repository, into a directory emptied first, so
// nothing of an earlier build stays to be served. scripts/prerender.mjs
// writes the build's dist/ with it; write-site.test.mjs reads back what it
// wrote against the site the suite checks.
//
// Node's built-ins only.

import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Writes `site` into `dist`, removing whatever `dist` held, and copies each
 * picture from the repository at `repo`.
 *
 * @param {import('../src/site.js').Site} site
 * @param {{ readonly repo: string, readonly dist: string }} where
 */
export function writeSite(site, { repo, dist }) {
  rmSync(dist, { recursive: true, force: true })
  for (const file of site.files) {
    const target = join(dist, file.path)
    mkdirSync(dirname(target), { recursive: true })
    if ('text' in file) writeFileSync(target, file.text, 'utf8')
    else copyFileSync(join(repo, file.from), target)
  }
}
