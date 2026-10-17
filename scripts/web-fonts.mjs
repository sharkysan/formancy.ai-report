// The faces a built app serves from its own origin (0023): the families its
// stylesheets declare, which the Studio's browser gate and its README
// pictures wait for; the requests a pass refuses when it measures the
// fallback stack; and the Fontsource packages that ship the faces, whose
// font versions a picture's record names.
//
// When the faces came from Google Fonts, each of those was read from the
// page's Google Fonts link and the fonts.gstatic.com addresses it led to.
// Served from the build, a face is an @font-face in a built stylesheet and a
// file beside it whose name says no version, so the version is read from the
// package the file came from.
//
// Node's built-ins only: the gate imports it from the app, the pictures'
// session from the repository's root.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')

/** A request for a font file, by its extension, with any query or fragment after it. */
export const FONT_FILE = /\.(?:woff2?|[ot]tf)(?:[?#]|$)/i

/** Fontsource's packages: a face in its static weights, and the variable one. */
const FONTSOURCE = /^@fontsource(?:-variable)?\//

/** The family each `@font-face` of `css` declares, unquoted, each once, in order of first appearance. */
export function familiesOf(css) {
  const found = []
  for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const family = /font-family\s*:\s*([^;]+)/.exec(body)?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2')
    if (family !== undefined && !found.includes(family)) found.push(family)
  }
  return found
}

/**
 * The families the stylesheets of the build at `dist` declare, sorted: what
 * its page asks for. Every `.css` file under it is read, so a face in a
 * lazily loaded chunk's stylesheet counts too. Empty when none declares a
 * face, which each caller refuses in its own words.
 */
export function declaredFamilies(dist) {
  const sheets = readdirSync(dist, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
  return [...new Set(sheets.flatMap((entry) => familiesOf(readFileSync(join(entry.parentPath, entry.name), 'utf8'))))].sort()
}

/**
 * The Fontsource packages the app at `app` depends on, as its node_modules
 * holds them: each one's name and directory, the licence its manifest
 * declares, the family its stylesheets declare (`Archivo Variable`), and,
 * from its metadata.json, the font's own family (`Archivo`) and the Google
 * Fonts release its files were made from (`v25`).
 */
export function fontsourceFaces(app) {
  const manifest = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
  return Object.keys(manifest.dependencies ?? {})
    .filter((name) => FONTSOURCE.test(name))
    .sort()
    .map((name) => {
      const directory = join(app, 'node_modules', name)
      if (!existsSync(join(directory, 'metadata.json'))) throw new Error(`${relative(REPO, app).replaceAll('\\', '/')} depends on ${name}, and its node_modules holds no metadata.json for it: run pnpm install`)
      const own = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
      const metadata = JSON.parse(readFileSync(join(directory, 'metadata.json'), 'utf8'))
      const [declares] = familiesOf(readFileSync(join(directory, own.main ?? 'index.css'), 'utf8'))
      return { name, directory, licence: own.license, declares, family: metadata.family, version: metadata.version }
    })
}

/**
 * Each of `families` -- families a built stylesheet declares -- as the
 * version of its font, keyed by the font's own family, from the Fontsource
 * package of the app at `app` that declares it. Refuses a family no such
 * package declares.
 */
export function faceVersions(app, families) {
  const faces = fontsourceFaces(app)
  const versions = {}
  for (const family of families) {
    const face = faces.find((each) => each.declares === family)
    if (face === undefined) throw new Error(`no Fontsource package of ${relative(REPO, app).replaceAll('\\', '/')} declares the family ${family}, so its version cannot be recorded`)
    versions[face.family] = face.version
  }
  return Object.fromEntries(Object.keys(versions).sort().map((family) => [family, versions[family]]))
}
