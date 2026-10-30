// Everything a published package needs in production, and every font one
// ships, is under a licence that allows public source and licensed production
// use.
//
// 0006, from 0001's costs: this repository's source is public and its
// production use is licensed, so a dependency under GPL or AGPL cannot ship
// inside it, nor one under a non-commercial or source-available licence. A
// package with no licence grants nothing. The policy is an allow-list of
// permissive identifiers, and an SPDX expression passes when every AND term is
// allowed and every OR has an allowed branch.
//
// What is walked is what is installed: from each publishable workspace package
// through its dependencies, optionalDependencies and peerDependencies, each
// resolved as Node resolves it from the package's real directory, which is
// where pnpm's isolated layout links what that package depends on. A workspace
// sibling that declares this repository's terms (verify-licenses.mjs's
// LICENSE_FIELD) is this repository's own, and is walked through rather than
// judged; one that declares anything else is judged like any package.
// devDependencies are never followed: no customer installs them, and a test
// holds every publishable build to inlining none of them.
//
// A package's `license` field says nothing about the fonts it ships, and fonts
// are what a PDF engine embeds in a customer's documents. So every font file
// in a walked package is read too: an OpenType font's name table says its
// licence, and a font this cannot read is refused until somebody has.
//
// The same holds for ICC profiles, which a PDF/A embeds as its output intent
// in every e-invoice a customer sends (0031): every .icc or .icm file, and
// every file whose header is a profile's, is refused unless a review has
// read its licence and recorded, by the digest of its bytes, the sentence
// that grants it (`ICC_PROFILES`). A profile carries no licence to read.
//
// Where a manifest or a font is silent or wrong, a reviewed exception records
// what the evidence says the licence is, at one exact version; the policy
// still applies to what it records. An exception nothing installs is refused,
// so the list holds only what the tree needs.
//
// Run as `node scripts/dependency-licences.mjs [repository root]`, by the
// `verify` job in gates.yml, and by `scripts/dependency-licences.test.mjs`
// against fixtures and the real tree.

import { createHash } from 'node:crypto'
import { closeSync, openSync, readdirSync, readFileSync, readSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LICENSE_FIELD } from './verify-licenses.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The SPDX identifiers a dependency may be under: permissive licences that
 * allow both public source and licensed production use, and OFL-1.1 for fonts,
 * which allows embedding. Nothing else, so a licence nobody has read is refused
 * by not being here.
 */
export const ALLOWED = Object.freeze([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'BlueOak-1.0.0',
  'Zlib',
  'CC0-1.0',
  'Unlicense',
  'OFL-1.1',
])
const allowed = new Set(ALLOWED.map((id) => id.toUpperCase()))

/**
 * The SPDX exceptions a WITH may name: each only adds permissions to the
 * licence it qualifies, so the expression is that licence. LLVM-exception
 * qualifies Apache-2.0; the other three qualify GPL, which stays refused
 * with them or without. Anything else after WITH -- the Commons Clause, a
 * LicenseRef -- is a condition nobody here has read, and is refused.
 */
export const ALLOWED_EXCEPTIONS = Object.freeze(['LLVM-exception', 'Classpath-exception-2.0', 'GCC-exception-3.1', 'Font-exception-2.0'])
const allowedExceptions = new Set(ALLOWED_EXCEPTIONS.map((id) => id.toUpperCase()))

/**
 * Reviewed exceptions: `name@version`, or `name@version/path` for one font file,
 * to the licence the evidence shows and where that evidence is. `problems`
 * refuses an entry nothing installs, so one outlives its package by no more
 * than the release that drops it.
 *
 * - `png-js@1.1.0` reaches `@formancy/report-render-pdf` through pdfmake and
 *   PDFKit, and its package.json has no `license` field, as decision 0005
 *   predicted. The LICENSE file it ships is the MIT License, read on
 *   2026-10-15.
 */
export const EXCEPTIONS = Object.freeze({
  'png-js@1.1.0': { licence: 'MIT', evidence: 'LICENSE in the tarball: MIT License, Copyright (c) 2017 Devon Govett' },
})

/**
 * Formancy Data's packages, each admitted for the one package allowed to
 * depend on it (0006, extended 2026-10-16 by 0016 and 2026-10-22 by 0047):
 * `name@version` to the sha256 of the `LICENSE.md` their `SEE LICENSE IN`
 * pointer names, as the review read it, and the package whose dependency
 * it may be -- the provider for Data's client, the server for Data's
 * identity verifier, and neither for the other's. Data is on this
 * repository's terms under its own name, from the same rightsholder, so a
 * customer licenses the two together; it is still a source-available
 * licence, which the policy refuses from anybody else. Not a correction of
 * metadata, as an exception is: a second set of terms, read, at one
 * version. `problems` refuses an admission nothing installs.
 *
 * - Data 0.1.0, published 2026-10-16: `data-client` and the `data-core` it
 *   depends on ship the same `LICENSE.md`, the Formancy Data Source-Available
 *   Licence Version 1.1, in force from 11 October 2026 -- byte for byte the
 *   file at Data's tag v0.1.0, read that day.
 * - Data 0.3.0's `data-identity`, published 2026-10-21, the host identity
 *   verifier `@formancy/report-server` verifies tokens with (0047): its
 *   `LICENSE.md` is the same Version 1.1, byte for byte the file 0.1.0
 *   shipped, read on 2026-10-22. It depends on jose alone, which the policy
 *   judges like anybody's.
 */
export const FORMANCY_DATA = Object.freeze({
  '@formancy/data-client@0.1.0': {
    licenceFile: 'sha256:329ae16264e73a3f429611267bfa3263c99eda5d6e2b419f223b2cc64536b8d4',
    for: '@formancy/report-data-provider',
    evidence: 'LICENSE.md in the tarball: Formancy Data Source-Available Licence, Version 1.1, in force from 11 October 2026',
  },
  '@formancy/data-core@0.1.0': {
    licenceFile: 'sha256:329ae16264e73a3f429611267bfa3263c99eda5d6e2b419f223b2cc64536b8d4',
    for: '@formancy/report-data-provider',
    evidence: 'LICENSE.md in the tarball: Formancy Data Source-Available Licence, Version 1.1, in force from 11 October 2026',
  },
  '@formancy/data-identity@0.3.0': {
    licenceFile: 'sha256:329ae16264e73a3f429611267bfa3263c99eda5d6e2b419f223b2cc64536b8d4',
    for: '@formancy/report-server',
    evidence: 'LICENSE.md in the tarball: Formancy Data Source-Available Licence, Version 1.1, in force from 11 October 2026, the same bytes as 0.1.0 shipped',
  },
})

/**
 * Reviewed ICC profiles, by the SHA-256 of their bytes, each with what it
 * is, the licence sentence that grants it as the review read it, and where.
 * A profile states its copyright holder in its header and its `cprt` tag,
 * not its terms, so nothing here reads a licence from the file: a review
 * does, once, and the digest holds the bytes it read. Keyed by digest and
 * not by package, since the licence is the profile's whoever ships it, and
 * a profile one byte off is another profile nobody has read. `problems`
 * refuses an entry nothing installs, and one that records no sentence.
 *
 * - The ICC's sRGB2014.icc, which PDFKit 0.19.1 ships as
 *   `js/data/sRGB_IEC61966_2_1.icc` and embeds as the output intent of every
 *   PDF/A (pdfkit.js 5265), which an e-invoice is: its header and tags read
 *   an ICC v2 `mntr` RGB profile, `desc` "sRGB2014", `cprt` "Copyright
 *   International Color Consortium, 2015". Byte for byte the ICC's own file
 *   at https://registry.color.org/rgb-registry/profiles/sRGB2014.icc,
 *   compared on 2026-10-17. Its licence is the ICC's for every profile the
 *   ICC owns, on its profile library page, read that day. pdfmake's browser
 *   build carries the same 3,024 bytes as base64 inside a script, where
 *   this walk does not look; the renderer's browser test holds that copy to
 *   this digest.
 */
export const ICC_PROFILES = Object.freeze({
  'sha256:384b832de3412066743b52a75ee906b6fb9fb8d9e09e936fc2c43223815c6e0a': {
    profile: 'sRGB2014.icc, the International Color Consortium\'s ICC v2 sRGB profile (desc "sRGB2014", cprt "Copyright International Color Consortium, 2015")',
    licence:
      'This profile is made available by the International Color Consortium, and may be copied, distributed, embedded, made, used, and sold without restriction. Altered versions of this profile shall have the original identification and copyright information removed and shall not be misrepresented as the original profile.',
    evidence:
      'https://registry.color.org/profile-library/#license, read 2026-10-17, where "ICC is the copyright owner"; the file compared byte for byte with https://registry.color.org/rgb-registry/profiles/sRGB2014.icc that day',
  },
})

/** Whether `expression`, an SPDX licence expression, is one the policy allows. Unreadable is refused. */
export function spdxAllows(expression) {
  try {
    const tokens = String(expression).match(/\(|\)|[^\s()]+/g) ?? []
    let at = 0
    const peek = () => tokens[at]
    const operator = (word) => peek() === word || peek() === word.toLowerCase()
    const identifier = () => {
      const token = tokens[at++]
      if (token === undefined || !/^[A-Za-z0-9.+-]+$/.test(token) || ['AND', 'OR', 'WITH'].includes(token.toUpperCase())) throw new SyntaxError(String(token))
      return token
    }
    // A reviewed exception only adds permissions to the licence it qualifies.
    const term = () => {
      if (peek() === '(') {
        at += 1
        const inner = or()
        if (tokens[at++] !== ')') throw new SyntaxError('unclosed bracket')
        return inner
      }
      const licence = allowed.has(identifier().toUpperCase())
      if (!operator('WITH')) return licence
      at += 1
      return allowedExceptions.has(identifier().toUpperCase()) && licence
    }
    const and = () => {
      let result = term()
      while (operator('AND')) {
        at += 1
        result = term() && result
      }
      return result
    }
    const or = () => {
      let result = and()
      while (operator('OR')) {
        at += 1
        result = and() || result
      }
      return result
    }
    const result = or()
    if (at !== tokens.length) throw new SyntaxError('trailing tokens')
    return result
  } catch {
    return false
  }
}

/**
 * The licence a manifest declares, as one SPDX expression, or undefined. npm's
 * legacy `{ type }` object and `licenses` array are read too; the array never
 * said whether it meant AND or OR, so it is read as AND, the stricter, and a
 * manifest with both fields is read as both, AND again. A field present but
 * unusable makes the whole unknown, never the other field alone.
 */
export function declaredLicence(manifest) {
  const { license, licenses } = manifest
  const declared = []
  if (license !== undefined) declared.push(typeof license === 'string' ? license : license?.type)
  if (licenses !== undefined) {
    if (!Array.isArray(licenses) || licenses.length === 0) return undefined
    declared.push(...licenses.map((item) => (typeof item === 'string' ? item : item?.type)))
  }
  if (declared.length === 0 || !declared.every((type) => typeof type === 'string' && type.trim() !== '')) return undefined
  return declared.length === 1 ? declared[0].trim() : declared.map((type) => `(${type.trim()})`).join(' AND ')
}

/** sfnt versions: TrueType, CFF-flavoured OpenType, and Apple's TrueType tag. */
const OPEN_TYPE = new Set([0x00010000, 0x4f54544f, 0x74727565])

/**
 * The sentences a font's licence description (name ID 13) begins with, as the
 * OFL's FAQ, Liberation Sans 2 and Apache-licensed font projects write them,
 * and what each means. Anything else is a licence this does not recognise,
 * refused until reviewed: Liberation Sans 1, under GPL-2.0 with a font
 * exception, says "Licensed under the Liberation Fonts license".
 */
const FONT_LICENCES = [
  [/^This Font Software is licensed under the SIL Open Font License, Version 1\.1\b/, 'OFL-1.1'],
  [/^Licensed under the SIL Open Font License, Version 1\.1\b/, 'OFL-1.1'],
  [/^Licensed under the Apache License, Version 2\.0\b/, 'Apache-2.0'],
]

/**
 * What an OpenType font's name table says of its version and licence. A font
 * is untrusted input: anything that is not an OpenType font, or whose tables
 * run past its end, is `{ readable: false }`, never a crash and never a pass.
 */
export function fontLicence(bytes) {
  try {
    if (!OPEN_TYPE.has(bytes.readUInt32BE(0))) return { readable: false }
    const names = new Map()
    for (let table = 0; table < bytes.readUInt16BE(4); table += 1) {
      const record = 12 + 16 * table
      if (bytes.toString('latin1', record, record + 4) !== 'name') continue
      const at = bytes.readUInt32BE(record + 8)
      const storage = at + bytes.readUInt16BE(at + 4)
      for (let index = 0; index < bytes.readUInt16BE(at + 2); index += 1) {
        const name = at + 6 + 12 * index
        const platform = bytes.readUInt16BE(name)
        const id = bytes.readUInt16BE(name + 6)
        // Unicode and Windows names are UTF-16BE; a Mac Roman one is not read.
        if ((platform !== 0 && platform !== 3) || names.has(id)) continue
        const start = storage + bytes.readUInt16BE(name + 10)
        const end = start + bytes.readUInt16BE(name + 8)
        if (end > bytes.length) return { readable: false }
        names.set(id, Buffer.from(bytes.subarray(start, end)).swap16().toString('utf16le'))
      }
    }
    const description = names.get(13)
    return {
      readable: true,
      version: names.get(5),
      description,
      licence: FONT_LICENCES.find(([sentence]) => sentence.test(description ?? ''))?.[1],
    }
  } catch {
    return { readable: false }
  }
}

/** Files that are fonts, by extension: OpenType and TrueType, collections, web fonts and Type 1. */
const FONT_FILE = /\.(ttf|otf|ttc|otc|woff2?|eot|pfb|pfa)$/i

/** Files that are ICC profiles, by extension. */
const PROFILE_FILE = /\.ic[cm]$/i

/** Whether a file's first bytes are an ICC profile's, whatever it is called: the profile file signature `acsp` at byte 36 of its header (ICC.1, 7.2). */
function looksLikeProfile(head) {
  return head.length >= 40 && head.toString('latin1', 36, 40) === 'acsp'
}

/**
 * Whether a file's first bytes are a font's, whatever it is called: an sfnt
 * whose table directory fits the file, a collection, a web font, or Type 1
 * as text or in its binary segments. Text that merely begins `true` or
 * `OTTO` is not an sfnt: its table directory does not fit.
 */
function looksLikeFont(head, size) {
  const tag = head.toString('latin1', 0, 4)
  if (['ttcf', 'wOFF', 'wOF2'].includes(tag) || head.toString('latin1', 0, 14) === '%!PS-AdobeFont') return true
  if (head[0] === 0x80 && head[1] === 0x01 && head.toString('latin1', 6, 20) === '%!PS-AdobeFont') return true
  if (head.length < 12 || !OPEN_TYPE.has(head.readUInt32BE(0))) return false
  const tables = head.readUInt16BE(4)
  return tables > 0 && 12 + 16 * tables <= size
}

/** The first bytes of a file, enough to tell a font or an ICC profile by. */
function headOf(path) {
  const handle = openSync(path, 'r')
  try {
    const head = Buffer.alloc(40)
    return head.subarray(0, readSync(handle, head, 0, head.length, 0))
  } finally {
    closeSync(handle)
  }
}

/**
 * Files named as code, text or an image, which are not opened to look for a
 * font or an ICC profile: a package holds thousands of them, and opening
 * each one made the first walk of pdfmake's closure take 18.7 s instead of
 * 0.67 s (one Windows machine, 2026-10-15). A font or a profile under one of
 * these names is not found -- one inside a script, as pdfmake's browser
 * build carries both, or inside an image -- which 0006 says.
 */
const NOT_OPENED = /\.(c?js|mjs|d\.[cm]?ts|[cm]?ts|map|json|md|markdown|txt|html?|css|ya?ml|png|jpe?g|gif|svg|wasm|node)$/i

const byPath = (a, b) => (a.path < b.path ? -1 : 1)

/**
 * Every font file and every ICC profile in a package's directory, outside
 * its own node_modules, by path: each by its extension, or by its first
 * bytes. A font is read for its licence; a profile is known by its digest.
 */
function filesIn(directory) {
  const fonts = []
  const profiles = []
  const walk = (at) => {
    for (const item of readdirSync(at, { withFileTypes: true })) {
      if (item.name === 'node_modules') continue
      const path = join(at, item.name)
      if (item.isDirectory()) {
        walk(path)
        continue
      }
      if (!item.isFile()) continue
      const named = FONT_FILE.test(item.name) || PROFILE_FILE.test(item.name)
      const head = named || NOT_OPENED.test(item.name) ? undefined : headOf(path)
      const file = relative(directory, path).replaceAll('\\', '/')
      if (FONT_FILE.test(item.name) || (head !== undefined && looksLikeFont(head, statSync(path).size)))
        fonts.push({ path: file, ...fontLicence(readFileSync(path)) })
      else if (PROFILE_FILE.test(item.name) || (head !== undefined && looksLikeProfile(head)))
        profiles.push({ path: file, digest: `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}` })
    }
  }
  walk(directory)
  return { fonts: fonts.sort(byPath), profiles: profiles.sort(byPath) }
}

/** The real directory `name` resolves to from `directory`, as Node looks for it, or undefined. */
function resolveFrom(directory, name) {
  for (let at = directory; ; at = dirname(at)) {
    if (basename(at) !== 'node_modules') {
      try {
        const found = realpathSync(join(at, 'node_modules', name))
        readFileSync(join(found, 'package.json'))
        return found
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
      }
    }
    if (dirname(at) === at) return undefined
  }
}

/**
 * The `sha256:` digest of the file a `SEE LICENSE IN <file>` licence points
 * at in `directory`, null when there is no such file in the package itself,
 * and undefined for any other licence. Only a file name is read: a pointer
 * into another directory points at nothing this package ships.
 */
function pointedFile(directory, licence) {
  const pointer = /^SEE LICEN[CS]E IN (.+)$/i.exec(licence ?? '')
  if (pointer === null) return undefined
  const file = pointer[1].trim()
  if (file === '.' || file === '..' || /[\\/]/.test(file)) return null
  try {
    return `sha256:${createHash('sha256')
      .update(readFileSync(join(directory, file)))
      .digest('hex')}`
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return null
    throw error
  }
}

/**
 * Every package `start` needs in production, itself first: `{ name, version,
 * licence, licenceFile, dir, via, sibling, fonts, profiles }`, `via` naming the
 * packages between the start and it, and `licenceFile` what `pointedFile`
 * says of its licence. A required dependency that is not installed is `{ name,
 * missing: true, via }`, and so is a peer not marked optional in
 * `peerDependenciesMeta`, with `peer: true`: npm 7 and later installs such a
 * peer for a customer, though this workspace, with `auto-install-peers`
 * off, does not. An optional dependency or an optional peer that is not
 * installed is simply not there. A directory in `siblings`, a workspace
 * package's real path, is marked as one.
 */
export function closure(start, siblings = new Set()) {
  const found = []
  const seen = new Set()
  const visit = (directory, via) => {
    if (seen.has(directory)) return
    seen.add(directory)
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    const licence = declaredLicence(manifest)
    found.push({
      name: manifest.name,
      version: manifest.version,
      licence,
      licenceFile: pointedFile(directory, licence),
      dir: directory,
      via,
      sibling: siblings.has(directory),
      ...filesIn(directory),
    })
    const path = [...via, manifest.name]
    const required = Object.keys(manifest.dependencies ?? {}).filter((name) => !manifest.optionalDependencies?.[name])
    const others = new Map([
      ...Object.keys(manifest.optionalDependencies ?? {}).map((name) => [name, 'optional']),
      ...Object.keys(manifest.peerDependencies ?? {}).map((name) => [name, manifest.peerDependenciesMeta?.[name]?.optional === true ? 'optional' : 'peer']),
    ])
    for (const name of required) others.delete(name)
    for (const name of required) {
      const at = resolveFrom(directory, name)
      if (at === undefined) found.push({ name, missing: true, via: path })
      else visit(at, path)
    }
    for (const [name, kind] of others) {
      const at = resolveFrom(directory, name)
      if (at !== undefined) visit(at, path)
      else if (kind === 'peer') found.push({ name, missing: true, peer: true, via: path })
    }
  }
  visit(realpathSync(start), [])
  return found
}

/**
 * Whether `item` is a Formancy Data package `data` admits: at that exact
 * version, pointing at its licence file, a string naming what is wrong when
 * the file or the route is not the one admitted, and false when no
 * admission names it, so the policy judges it.
 */
function admission(item, id, route, data) {
  if (!Object.hasOwn(data, id) || item.licence !== LICENSE_FIELD) return false
  const admitted = data[id]
  if (item.licenceFile !== admitted.licenceFile) {
    return `${id}'s LICENSE.md is ${item.licenceFile ?? 'missing'}, not the Formancy Data licence the review read (${admitted.licenceFile}) (${route})`
  }
  // The package that depends on Data: the last on the route before the
  // first Data package, so Data's own dependencies on each other are
  // allowed and a package reaching Data past the provider is not.
  const names = new Set(Object.keys(data).map((key) => key.slice(0, key.lastIndexOf('@'))))
  const path = [...item.via, item.name]
  const dependent = path[path.findIndex((name) => names.has(name)) - 1]
  return dependent === admitted.for || `${id} is admitted for ${admitted.for} alone, and ${String(dependent)} depends on it (${route})`
}

/**
 * What is wrong with these closures under the policy, each named once with the
 * route to it. `exceptions` replace what a package or a font file says with
 * what a review found, at that exact version, and are refused when nothing
 * here installs them. `data` admits Formancy Data's packages, and `profiles`
 * the ICC profiles a review read, and each is refused the same way.
 */
export function problems(entries, exceptions = EXCEPTIONS, data = FORMANCY_DATA, profiles = ICC_PROFILES) {
  const found = new Set()
  const used = new Set()
  const admitted = new Set()
  const shipped = new Set()
  const judge = (key, declared, source, route, refusal) => {
    const exception = Object.hasOwn(exceptions, key) ? exceptions[key] : undefined
    if (exception !== undefined) used.add(key)
    const licence = exception?.licence ?? declared
    if (licence === undefined) found.add(refusal)
    else if (!spdxAllows(licence)) found.add(`${key} is ${licence} by ${exception ? 'its reviewed exception' : source}, which the policy refuses (${route})`)
  }
  for (const item of entries) {
    const route = [...item.via, item.name].join(' > ')
    if (item.missing) {
      found.add(
        `${item.name} is a ${item.peer ? 'peer dependency' : 'dependency'} of ${item.via.at(-1)} and is not installed, so its licence cannot be read (${route})`,
      )
      continue
    }
    const id = `${item.name}@${item.version}`
    const verdict = item.sibling ? false : admission(item, id, route, data)
    if (verdict !== false) admitted.add(id)
    if (typeof verdict === 'string') found.add(verdict)
    // A workspace package is passed over only when it declares this repository's terms; one that says otherwise is judged like anyone's.
    else if (verdict === false && !(item.sibling && item.licence === LICENSE_FIELD))
      judge(id, item.licence, 'its package.json', route, `${id} declares no licence (${route})`)
    for (const font of item.fonts) {
      const refusal = font.readable
        ? `${id}/${font.path} is a font whose name table names no licence the policy allows: "${font.description ?? ''}" (${route})`
        : `${id}/${font.path} is a font this guard cannot read a licence from; review it and record an exception (${route})`
      judge(`${id}/${font.path}`, font.licence, 'its name table', route, refusal)
    }
    for (const profile of item.profiles) {
      shipped.add(profile.digest)
      if (!Object.hasOwn(profiles, profile.digest)) {
        found.add(
          `${id}/${profile.path} is an ICC profile nobody has reviewed (${profile.digest}); read its licence and record it in ICC_PROFILES with the sentence that grants it (${route})`,
        )
      }
    }
  }
  for (const key of Object.keys(exceptions)) {
    if (!used.has(key)) found.add(`exception ${key} names nothing a published package installs; remove it`)
  }
  for (const key of Object.keys(data)) {
    if (!admitted.has(key)) found.add(`Formancy Data admission ${key} names nothing a published package installs; remove it`)
  }
  for (const [digest, review] of Object.entries(profiles)) {
    if (!shipped.has(digest)) found.add(`reviewed ICC profile ${digest} names nothing a published package installs; remove it`)
    else if (typeof review.licence !== 'string' || review.licence.trim() === '')
      found.add(`reviewed ICC profile ${digest} records no licence sentence; a review quotes the sentence that grants the profile`)
  }
  return [...found]
}

/** Every workspace package, `{ name, dir, private }`, by its real directory. */
function workspacePackages(repoRoot) {
  const found = []
  for (const group of ['packages', 'apps']) {
    let names = []
    try {
      names = readdirSync(join(repoRoot, group)).sort()
    } catch {
      continue
    }
    for (const name of names) {
      try {
        const dir = realpathSync(join(repoRoot, group, name))
        const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
        found.push({ name: manifest.name, dir, private: manifest.private === true })
      } catch {
        // A directory without a manifest is not a package.
      }
    }
  }
  return found
}

/** The publishable packages' names, and every entry of their production closures. */
export function workspaceClosure(repoRoot = root) {
  const packages = workspacePackages(repoRoot)
  const siblings = new Set(packages.map(({ dir }) => dir))
  const published = packages.filter((item) => !item.private)
  return { published: published.map(({ name }) => name), entries: published.flatMap(({ dir }) => closure(dir, siblings)) }
}

// `node scripts/dependency-licences.mjs [repository root]`
if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/dependency-licences.mjs')) {
  const { published, entries } = workspaceClosure(process.argv[2] ? resolve(process.argv[2]) : root)
  const found = problems(entries)
  if (found.length > 0) {
    console.error('Dependency licence check failed:')
    for (const problem of found) console.error(`  - ${problem}`)
    process.exit(1)
  }
  const thirdParty = new Set(entries.filter((item) => !item.sibling).map((item) => `${item.name}@${item.version}`))
  const fonts = entries.reduce((sum, item) => sum + item.fonts.length, 0)
  const profiles = new Set(entries.flatMap((item) => item.profiles.map((profile) => `${item.name}@${item.version}/${profile.path}`)))
  console.log(`dependency licences: walked the production dependencies of ${published.join(', ')}`)
  console.log(
    `dependency licences: ${String(thirdParty.size)} third-party packages, ${String(fonts)} fonts and ${String(profiles.size)} ICC profile${profiles.size === 1 ? '' : 's'}, each under a licence the policy allows or a review read`,
  )
}
