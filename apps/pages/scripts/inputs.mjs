// What the pages are built from, read from the repository (0021): every fact
// a page states about the product that a file here already says is read
// from that file, so the page cannot say otherwise. scripts/prerender.mjs
// hands the result to the renderer, and the suite renders the same.
//
// It runs in Node, outside the renderer's bundle, beside the repository's
// scripts it imports: the demo's address is scripts/demo.mjs's reading of
// the Worker's route, and the licence's state is scripts/licence-status.mjs's
// reading of LICENSE.md, the one the README's sentence is generated from.
//
// Node's built-ins and the repository's own scripts only.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { demoUrl, readDemoConfig } from '../../../scripts/demo.mjs'
import { readLicence } from '../../../scripts/licence-status.mjs'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** The changelog's version headings, as the release workflow writes them: `## 0.1.0 — 2026-10-16`. */
const RELEASE = /^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})$/m

/** The anchor GitHub gives a Markdown heading: lower case, punctuation gone, each space a hyphen. */
const anchorOf = (heading) => heading.toLowerCase().replaceAll(/[^\p{L}\p{N}\s-]/gu, '').replaceAll(' ', '-')

/** The newest release CHANGELOG.md records: its version, its date, and the anchor of its heading. */
export function releaseOf(changelog) {
  const match = RELEASE.exec(changelog.replaceAll('\r\n', '\n'))
  if (match === null) throw new Error('CHANGELOG.md has no released version: no heading "## X.Y.Z — YYYY-MM-DD"')
  const [, version, date] = match
  return { version, date, anchor: anchorOf(`${version} — ${date}`) }
}

/**
 * The rows of LICENSE.md's "The terms in one table": each use, and its
 * terms, as the licence words them.
 */
export function licenceTermsOf(licence) {
  const text = licence.replaceAll('\r\n', '\n')
  const start = text.indexOf('\n## The terms in one table\n')
  if (start === -1) throw new Error('LICENSE.md has no section "The terms in one table"')
  const section = text.slice(start + 1).split(/\n## /)[0]
  const rows = section
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
  const body = rows.slice(2)
  if (rows.length < 3 || body.some((row) => row.length !== 2)) throw new Error('LICENSE.md\'s "The terms in one table" is not a table of uses and their terms')
  return body.map(([use, terms]) => [use, terms])
}

/** The day `date`, as LICENSE.md writes it (`14 October 2026`), as an ISO date. */
function isoDay(date) {
  const [day, month, year] = date.split(' ')
  const number = MONTHS.indexOf(month) + 1
  if (number === 0) throw new Error(`${date} is not a day LICENSE.md's version line would write`)
  return `${year}-${String(number).padStart(2, '0')}-${day.padStart(2, '0')}`
}

/** The one Google Fonts stylesheet `html` loads: the Studio's faces, at its weights. */
export function fontsOf(html) {
  const found = [...html.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/g)].map((match) => match[1].replaceAll('&amp;', '&'))
  if (found.length === 0) throw new Error("apps/studio/index.html loads no Google Fonts stylesheet, so the pages have no faces to load")
  if (found.length > 1) throw new Error(`apps/studio/index.html loads ${String(found.length)} Google Fonts stylesheets, and the pages load one`)
  return found[0]
}

/**
 * The pixel size of a PNG, from its IHDR, or of a WebP with an extended
 * header, from its VP8X: the two kinds docs/images holds, as its scripts
 * write them. Anything else is refused rather than read wrong.
 */
export function imageSize(bytes) {
  const data = Buffer.from(bytes)
  if (data.length > 24 && data.readUInt32BE(0) === 0x89504e47 && data.toString('latin1', 12, 16) === 'IHDR') {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
  }
  if (data.length > 30 && data.toString('latin1', 0, 4) === 'RIFF' && data.toString('latin1', 8, 16) === 'WEBPVP8X') {
    return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 }
  }
  throw new Error('the picture is neither a PNG nor a WebP whose size this reads')
}

/**
 * The stylesheet `file`, with each `@import './…';` or `@import '../…';`
 * replaced by the file it names, in order, and every comment removed: what
 * Vite makes of the Studio's. `read` hears every file read. Refuses any
 * other @import: one by URL or by package would be resolved by the
 * browser, under /report/, where it is not.
 */
export function bundleStylesheet(file, read = () => {}) {
  read(file)
  const text = readFileSync(file, 'utf8')
    .replaceAll('\r\n', '\n')
    .replaceAll(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*\n/gm, '')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
  const inlined = text.replaceAll(/^@import\s+(['"])(\.\.?\/[^'"]+\.css)\1;\n?/gm, (_, _quote, path) => bundleStylesheet(resolve(dirname(file), path), read))
  if (/@import/.test(inlined)) throw new Error(`${file} has an @import it does not inline`)
  return inlined.replaceAll(/\n{3,}/g, '\n\n')
}

/** The value `css` gives the custom property `name` in its first `:root`. */
function rootValue(css, name) {
  const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  const value = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(root)?.[1]?.trim()
  if (value === undefined) throw new Error(`the room's :root sets no ${name}`)
  return value
}

/** Every package published from packages/, with the homepage they share: the repository. */
function published(repo, read) {
  const manifests = readdirSync(join(repo, 'packages'))
    .sort()
    .filter((name) => existsSync(join(repo, 'packages', name, 'package.json')))
    .map((name) => {
      read(join(repo, 'packages', name, 'package.json'))
      return JSON.parse(readFileSync(join(repo, 'packages', name, 'package.json'), 'utf8'))
    })
    .filter((manifest) => manifest.private !== true)
  const homepages = [...new Set(manifests.map((manifest) => manifest.homepage))]
  if (homepages.length !== 1 || typeof homepages[0] !== 'string') throw new Error(`the published packages name ${String(homepages.length)} homepages, and the pages link one repository`)
  return { packages: manifests.map((manifest) => manifest.name), repository: homepages[0] }
}

/**
 * Everything the renderer needs from the repository at `repo`, with the
 * pictures `pictures` names (paths under docs/images), and `read`: every
 * file read, as a path from the repository root, for turbo's inputs.
 *
 * @param {string} repo
 * @param {{ readonly pictures?: readonly string[] }} [options]
 * @returns {import('../src/inputs.js').SiteInputs}
 */
export function readInputs(repo, { pictures = [] } = {}) {
  const read = new Set()
  const note = (file) => read.add(relative(repo, file).replaceAll('\\', '/'))
  const text = (path) => {
    note(join(repo, path))
    return readFileSync(join(repo, path), 'utf8')
  }

  note(join(repo, 'apps', 'studio', 'wrangler.json'))
  const site = demoUrl(readDemoConfig())
  if (site === undefined) throw new Error("apps/studio/wrangler.json routes no path of formancy.ai, so the pages have no address")
  const licenceText = text('LICENSE.md')
  const licence = readLicence(licenceText)
  const stylesheet = bundleStylesheet(join(repo, 'apps', 'pages', 'src', 'pages.css'), note)
  const recorded = JSON.parse(text('docs/images/pictures.json'))
  return {
    site,
    ...published(repo, note),
    release: releaseOf(text('CHANGELOG.md')),
    licence: { version: licence.version, date: isoDay(licence.date), address: licence.address, terms: licenceTermsOf(licenceText) },
    fonts: fontsOf(text('apps/studio/index.html')),
    ground: rootValue(stylesheet, '--ground'),
    stylesheet,
    pictures: pictures.map((name) => {
      const from = `docs/images/${name}`
      if (!existsSync(join(repo, from))) throw new Error(`${from} is not there, and the pages show it`)
      note(join(repo, from))
      return { name, from, ...imageSize(readFileSync(join(repo, from))), lines: recorded.find((entry) => entry.file === name)?.lines ?? [] }
    }),
    read: [...read].sort(),
  }
}
