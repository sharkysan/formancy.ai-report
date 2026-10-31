/**
 * The site as the build writes it, rendered once for the suite: the inputs
 * read from this checkout by scripts/inputs.mjs, as the prerender reads
 * them, and the checks' view of it.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readInputs } from '../scripts/inputs.mjs'
import type { Built } from './checks/index.js'
import type { SiteInputs } from './inputs.js'
import { PICTURES, renderSite } from './site.js'
import type { Site } from './site.js'

export const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

export const inputs: SiteInputs = readInputs(repo, { pictures: PICTURES })

export const site: Site = renderSite(inputs)

/** `site` as the checks see it, with this checkout's files. */
export const builtOf = (each: Site, using: SiteInputs = inputs): Built => ({
  site: each,
  inputs: using,
  exists: (path) => existsSync(join(repo, path)),
  text: (path) => readFileSync(join(repo, path), 'utf8'),
})

/**
 * `site` with the file at `path` -- a page or another text file -- edited
 * by `edit`, which must change it: an edit that matched nothing would test
 * the unbroken site and pass for the wrong reason.
 */
export function editing(path: string, edit: (text: string) => string, from: Site = site): Site {
  const file = from.files.find((each) => each.path === path)
  if (file === undefined || !('text' in file)) throw new Error(`the site has no text file ${path}`)
  const text = edit(file.text)
  if (text === file.text) throw new Error(`the edit of ${path} changed nothing`)
  return {
    pages: from.pages.map((page) => (page.file === path ? { ...page, html: text } : page)),
    files: from.files.map((each) => (each.path === path ? { path, text } : each)),
  }
}
