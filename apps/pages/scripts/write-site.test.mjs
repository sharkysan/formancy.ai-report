import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { repo, site } from '../src/test-site.ts'
import { writeSite } from './write-site.mjs'

/**
 * What the build leaves on disk: scripts/prerender.mjs hands writeSite the
 * site the renderer made, as the suite renders it (src/test-site.ts), and
 * writeSite writes it into dist/, which the demo serves. The other tests
 * check the site in memory; this holds the files a reader is served to be
 * that site, byte for byte, and nothing besides.
 */
const made = []
afterAll(() => {
  for (const directory of made) rmSync(directory, { recursive: true, force: true })
})

/** A directory of its own to write the site into, removed after the suite. */
function scratch() {
  const directory = mkdtempSync(join(tmpdir(), 'report-pages-'))
  made.push(directory)
  return join(directory, 'dist')
}

/** Every file under `directory`, as a path from it with forward slashes, sorted. */
const filesUnder = (directory) =>
  readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
    .sort()

describe('the site the build writes to disk (0021)', () => {
  // A page the suite checked and the build did not write, or wrote other
  // HTML for, is a page served unchecked; a sitemap other than the one
  // checked names pages to a search engine that nobody looked at.
  test('is every page of the site the suite checks, with the same HTML, and its sitemap', () => {
    const dist = scratch()
    writeSite(site, { repo, dist })
    for (const page of site.pages) expect({ file: page.file, html: existsSync(join(dist, page.file)) && readFileSync(join(dist, page.file), 'utf8') === page.html }).toEqual({ file: page.file, html: true })
    const sitemap = site.files.find((file) => file.path === 'sitemap.xml')
    expect(sitemap !== undefined && 'text' in sitemap && readFileSync(join(dist, 'sitemap.xml'), 'utf8') === sitemap.text).toBe(true)
  })

  // The stylesheet and the pictures are the site's too: one missing is a
  // page without its room or a picture's 404; and a file on disk that the
  // site does not hold is served without any check having read it.
  test('is every file of the site, byte for byte, and nothing else', () => {
    const dist = scratch()
    writeSite(site, { repo, dist })
    expect(filesUnder(dist)).toEqual(site.files.map((file) => file.path).sort())
    for (const file of site.files) {
      const wanted = 'text' in file ? Buffer.from(file.text, 'utf8') : readFileSync(join(repo, file.from))
      expect({ path: file.path, same: readFileSync(join(dist, file.path)).equals(wanted) }).toEqual({ path: file.path, same: true })
    }
  })

  // A page dropped from the site would otherwise stay served from the
  // last build's dist/, listed nowhere and checked by nothing.
  test('leaves nothing of an earlier build', () => {
    const dist = scratch()
    mkdirSync(join(dist, 'rm'), { recursive: true })
    writeFileSync(join(dist, 'rm', 'index.html'), '<!doctype html>\n')
    writeSite(site, { repo, dist })
    expect(existsSync(join(dist, 'rm'))).toBe(false)
  })
})
