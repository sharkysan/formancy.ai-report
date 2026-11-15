/**
 * The site as the build writes it, rendered once for the suite: the inputs
 * read from this checkout by scripts/inputs.mjs, as the prerender reads
 * them, and the checks' view of it.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readInputs, releaseOf } from '../scripts/inputs.mjs'
import type { Built } from './checks/index.js'
import type { SiteInputs } from './inputs.js'
import { PICTURES, renderSite } from './site.js'
import type { Site } from './site.js'

export const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

export const inputs: SiteInputs = readInputs(repo, { pictures: PICTURES })

export const site: Site = renderSite(inputs)

/**
 * The release after the newest one CHANGELOG.md names, as the changelog's
 * heading for it would be read: the next minor, its anchor made as the
 * build makes one. A test of what a release commit meets names no version,
 * so the commit that writes each page's status again for the release it
 * names edits no test: the suite fails on that commit only until the
 * statuses are written.
 */
export const nextRelease: SiteInputs['release'] = (() => {
  const [major, minor] = inputs.release.version.split('.').map(Number)
  if (major === undefined || minor === undefined) throw new Error(`${inputs.release.version} is no version`)
  const read = releaseOf(`## ${String(major)}.${String(minor + 1)}.0 — ${inputs.release.date}`)
  const anchor: unknown = read.anchor
  if (read.version === undefined || read.date === undefined || typeof anchor !== 'string')
    throw new Error('the next release has no heading the changelog would read')
  return { version: read.version, date: read.date, anchor }
})()

/** `inputs` as they would be read once CHANGELOG.md names `nextRelease`. */
export const atNextRelease: SiteInputs = { ...inputs, release: nextRelease }

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
