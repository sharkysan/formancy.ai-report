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
// Where a manifest or a font is silent or wrong, a reviewed exception records
// what the evidence says the licence is, at one exact version; the policy
// still applies to what it records. An exception nothing installs is refused,
// so the list holds only what the tree needs.
//
// Run as `node scripts/dependency-licences.mjs [repository root]`, by the
// `verify` job in gates.yml, and by `scripts/dependency-licences.test.mjs`
// against fixtures and the real tree.

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
export const ALLOWED = Object.freeze(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'BlueOak-1.0.0', 'Zlib', 'CC0-1.0', 'Unlicense', 'OFL-1.1'])
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
 * to the licence the evidence shows and where that evidence is. Empty while no
 * published package needs one; `problems` refuses an entry nothing installs.
 */
export const EXCEPTIONS = Object.freeze({})

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
 * OFL's FAQ and Apache-licensed font projects write them, and what each means.
 * Anything else is a licence this does not recognise, refused until reviewed.
 */
const FONT_LICENCES = [
  [/^This Font Software is licensed under the SIL Open Font License, Version 1\.1\b/, 'OFL-1.1'],
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

/** The first bytes of a file, enough to tell a font by. */
function headOf(path) {
  const handle = openSync(path, 'r')
  try {
    const head = Buffer.alloc(20)
    return head.subarray(0, readSync(handle, head, 0, head.length, 0))
  } finally {
    closeSync(handle)
  }
}

/**
 * Files named as code, text or an image, which are not opened to look for a
 * font: a package holds thousands of them, and opening each one made the
 * first walk of pdfmake's closure take 18.7 s instead of 0.67 s (one Windows
 * machine, 2026-10-15). A font under one of these names is not found, which
 * 0006 says.
 */
const NOT_A_FONT = /\.(c?js|mjs|d\.[cm]?ts|[cm]?ts|map|json|md|markdown|txt|html?|css|ya?ml|png|jpe?g|gif|svg|wasm|node)$/i

/** Every font file in a package's directory, outside its own node_modules, by path: by extension, or by its first bytes. */
function fontsIn(directory) {
  const fonts = []
  const walk = (at) => {
    for (const item of readdirSync(at, { withFileTypes: true })) {
      if (item.name === 'node_modules') continue
      const path = join(at, item.name)
      if (item.isDirectory()) walk(path)
      else if (item.isFile() && (FONT_FILE.test(item.name) || (!NOT_A_FONT.test(item.name) && looksLikeFont(headOf(path), statSync(path).size)))) {
        fonts.push({ path: relative(directory, path).replaceAll('\\', '/'), ...fontLicence(readFileSync(path)) })
      }
    }
  }
  walk(directory)
  return fonts.sort((a, b) => (a.path < b.path ? -1 : 1))
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
 * Every package `start` needs in production, itself first: `{ name, version,
 * licence, dir, via, sibling, fonts }`, `via` naming the packages between the
 * start and it. A required dependency that is not installed is `{ name,
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
    found.push({ name: manifest.name, version: manifest.version, licence: declaredLicence(manifest), dir: directory, via, sibling: siblings.has(directory), fonts: fontsIn(directory) })
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
 * What is wrong with these closures under the policy, each named once with the
 * route to it. `exceptions` replace what a package or a font file says with
 * what a review found, at that exact version, and are refused when nothing
 * here installs them.
 */
export function problems(entries, exceptions = EXCEPTIONS) {
  const found = new Set()
  const used = new Set()
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
      found.add(`${item.name} is a ${item.peer ? 'peer dependency' : 'dependency'} of ${item.via.at(-1)} and is not installed, so its licence cannot be read (${route})`)
      continue
    }
    const id = `${item.name}@${item.version}`
    // A workspace package is passed over only when it declares this repository's terms; one that says otherwise is judged like anyone's.
    if (!(item.sibling && item.licence === LICENSE_FIELD)) judge(id, item.licence, 'its package.json', route, `${id} declares no licence (${route})`)
    for (const font of item.fonts) {
      const refusal = font.readable
        ? `${id}/${font.path} is a font whose name table names no licence the policy allows: "${font.description ?? ''}" (${route})`
        : `${id}/${font.path} is a font this guard cannot read a licence from; review it and record an exception (${route})`
      judge(`${id}/${font.path}`, font.licence, 'its name table', route, refusal)
    }
  }
  for (const key of Object.keys(exceptions)) {
    if (!used.has(key)) found.add(`exception ${key} names nothing a published package installs; remove it`)
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
  console.log(`dependency licences: walked the production dependencies of ${published.join(', ')}`)
  console.log(`dependency licences: ${String(thirdParty.size)} third-party packages and ${String(fonts)} fonts, each under a licence the policy allows`)
}
