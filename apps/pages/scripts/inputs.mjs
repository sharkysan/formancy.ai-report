// What the pages are built from, read from the repository (0021): every fact
// a page states about the product that a file here already says is read
// from that file, so the page cannot say otherwise. scripts/prerender.mjs
// hands the result to the renderer, and the suite renders the same.
//
// It runs in Node, outside the renderer's bundle, beside the repository's
// scripts it imports: the demo's address is scripts/demo.mjs's reading of
// the Worker's route, and the licence's state is scripts/licence-status.mjs's
// reading of LICENSE.md, the one the README's sentence is generated from.
// The faces are the Studio's fonts.css's, served from the pages' own copies
// of the Fontsource packages (0023), with the notices
// scripts/third-party-notices.mjs writes for copied files.
//
// Node's built-ins and the repository's own scripts only.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { demoUrl, readDemoConfig } from '../../../scripts/demo.mjs'
import { readLicence } from '../../../scripts/licence-status.mjs'
import { copiedNotices } from '../../../scripts/third-party-notices.mjs'

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

/** Where the pages' stylesheet names the copy of a face's file: beside it, in this directory. */
const FONTS = 'fonts/'

/** An import of an installed package's stylesheet: the package, then the file in it. */
const PACKAGE_IMPORT = /^((?:@[\w.-]+\/)?[\w.-]+)\/([\w./-]+\.css)$/

/**
 * The stylesheet `file`, with each `@import` replaced by the file it names,
 * in order, and every comment removed: what Vite makes of the Studio's.
 *
 * - `@import './…';` or `'../…'` is a file beside the one importing it.
 * - `@import '<package>/<file>.css';` is a stylesheet of an installed
 *   package -- a face's, Fontsource's (0023) -- found in `packages`, the
 *   pages' own node_modules, never beside the importing file, so what the
 *   pages serve is what their package.json names. Each url() in it names a
 *   file the package ships, a font; it is rewritten to name the font's copy
 *   beside the pages' stylesheet, under fonts/, and the copy is said in
 *   `fonts`: its url(), and the file and package it is copied from.
 *
 * `read` hears every file read. Refuses any other @import -- one by URL
 * would be fetched by the browser from wherever it names -- a package the
 * pages do not depend on, a url() naming a file its package does not ship,
 * and two packages shipping one file name, which would be copied over each
 * other.
 *
 * @param {string} file
 * @param {{ readonly read?: (file: string) => void, readonly packages?: string }} [options]
 * @returns {{ css: string, fonts: { href: string, from: string, directory: string }[] }}
 */
export function bundleStylesheet(file, { read = () => {}, packages } = {}) {
  const fonts = new Map()
  const css = inline(file, { read, packages, fonts }, undefined)
  return { css: css.replaceAll(/\n{3,}/g, '\n\n'), fonts: [...fonts.values()].map(({ href, from, directory }) => ({ href, from, directory })) }
}

/** `file` inlined for bundleStylesheet; `owner` is the package it belongs to, when it is a package's. */
function inline(file, context, owner) {
  context.read(file)
  const text = readFileSync(file, 'utf8')
    .replaceAll('\r\n', '\n')
    .replaceAll(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*\n/gm, '')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
  const own = owner === undefined ? text : copiedFonts(text, file, owner, context.fonts)
  const inlined = own.replaceAll(/^@import\s+(['"])([^'"]+)\1;\n?/gm, (whole, _quote, path) => {
    if (/^\.\.?\//.test(path)) return inline(resolve(dirname(file), path), context, owner)
    const found = PACKAGE_IMPORT.exec(path)
    if (found === null) return whole
    const [, name, inside] = found
    const directory = context.packages === undefined ? undefined : join(context.packages, name)
    if (directory === undefined || !existsSync(join(directory, 'package.json'))) throw new Error(`${file} imports ${path}, and ${name} is not a package the pages depend on`)
    return inline(join(directory, inside), context, { name, directory })
  })
  if (/@import/.test(inlined)) throw new Error(`${file} has an @import it does not inline`)
  return inlined
}

/** `text`, the package `owner`'s stylesheet at `file`, with each url() naming its copy under FONTS, each copy added to `fonts`. */
function copiedFonts(text, file, owner, fonts) {
  return text.replaceAll(/url\((['"]?)([^'")]+)\1\)/g, (_, quote, href) => {
    const from = resolve(dirname(file), href)
    if (!from.startsWith(`${owner.directory}${sep}`) || !existsSync(from) || !statSync(from).isFile()) throw new Error(`${file} names ${href}, which ${owner.name} does not ship`)
    const name = basename(from)
    const known = fonts.get(name)
    if (known !== undefined && known.from !== from) throw new Error(`${name} is shipped by ${known.package} and by ${owner.name}, and the pages would copy one over the other`)
    fonts.set(name, { href: `${FONTS}${name}`, from, directory: owner.directory, package: owner.name })
    return `url(${quote}${FONTS}${name}${quote})`
  })
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
 * file read, as a path from the repository root, for turbo's inputs -- of
 * an installed package, the stylesheets inlined, and not the manifest and
 * licence the notices read, which turbo hashes with the package through
 * the lockfile all the same.
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
  const { css: stylesheet, fonts } = bundleStylesheet(join(repo, 'apps', 'pages', 'src', 'pages.css'), { read: note, packages: join(repo, 'apps', 'pages', 'node_modules') })
  const recorded = JSON.parse(text('docs/images/pictures.json'))
  return {
    site,
    ...published(repo, note),
    release: releaseOf(text('CHANGELOG.md')),
    licence: { version: licence.version, date: isoDay(licence.date), address: licence.address, terms: licenceTermsOf(licenceText) },
    fonts: fonts.map((font) => ({ href: font.href, from: relative(repo, font.from).replaceAll('\\', '/') })),
    notices: copiedNotices(fonts.map((font) => font.directory)),
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
