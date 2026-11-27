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
// A package a review read for one dependent alone is `CONFINED`: at one
// version, by the digest of its licence files, depended on by that package
// and no other published one.
//
// A font a package ships that the one published package admitted for
// never loads is `NEVER_LOADED`: at one version, by the digest of its
// bytes, its package depended on by that published package and no other,
// and a test named that shows it is never read, `file#test name`, which
// the guard holds to a case of that name in that file (0089). It is the one
// way a font under a licence the policy refuses passes; the owner granted
// it on 28 November 2026.
//
// A package that ships a native addon, a `.node` file, carries code built
// from sources its own licence may not cover. It is refused unless
// `BUILDS_READ` names its family and its build, at one version, by the
// SHA-256 of the SBOM the build ships, and the components of that SBOM
// whose licence the policy refuses are the ones the review recorded; it is
// reached through the published package admitted for and no other. The
// lockfile names every platform's build, which no machine installs all of,
// so each build and version of the family it names must be one the review
// read too (0089).
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
import { readdirSync, readFileSync, realpathSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { filesIn, fontLicence, licenceTextsIn, sbomIn } from './dependency-licences/files.mjs'
import { BUILDS_READ, CONFINED, EXCEPTIONS, FORMANCY_DATA, ICC_PROFILES, NEVER_LOADED } from './dependency-licences/reviews.mjs'
import { LICENSE_FIELD } from './verify-licenses.mjs'

export { BUILDS_READ, CONFINED, EXCEPTIONS, FORMANCY_DATA, fontLicence, ICC_PROFILES, NEVER_LOADED }

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
  const dependents = new Map()
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
      licenceTexts: licenceTextsIn(directory),
      sbom: sbomIn(directory),
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
      if (at !== undefined) dependents.set(at, new Set([...(dependents.get(at) ?? []), manifest.name]))
    }
    for (const [name, kind] of others) {
      const at = resolveFrom(directory, name)
      if (at !== undefined) {
        visit(at, path)
        dependents.set(at, new Set([...(dependents.get(at) ?? []), manifest.name]))
      } else if (kind === 'peer') found.push({ name, missing: true, peer: true, via: path })
    }
  }
  visit(realpathSync(start), [])
  for (const item of found) if (!item.missing) item.dependents = [...(dependents.get(item.dir) ?? [])].sort()
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
  const dependent = dependentOf(item, Object.keys(data))
  return dependent === admitted.for || `${id} is admitted for ${admitted.for} alone, and ${String(dependent)} depends on it (${route})`
}

/**
 * The package that depends on the first of `ids` on `item`'s route: the last
 * before it, so one admitted package's dependencies on another are allowed
 * and a package reaching one past its dependent is not.
 */
function dependentOf(item, ids) {
  const names = new Set(ids.map((key) => key.slice(0, key.lastIndexOf('@'))))
  const path = [...item.via, item.name]
  return path[path.findIndex((name) => names.has(name)) - 1]
}

/**
 * What is wrong with a confined package (`CONFINED`): the policy judges it
 * as any other, and it is further refused at a version no review read, with
 * a licence file, or a file beside it the review read, whose digest is not the
 * review's, and depended on by any package other than the one it is for or
 * another confined package. A package that depends on the one it is for
 * reaches it through that package, which is allowed: what is held is that
 * no other published package depends on it itself.
 */
function confinement(item, id, route, confined) {
  const ids = Object.keys(confined)
  const versions = ids.filter((key) => key.slice(0, key.lastIndexOf('@')) === item.name)
  if (versions.length === 0) return []
  if (!Object.hasOwn(confined, id)) {
    return [
      `${id} is a version of ${item.name}, which a review read at ${versions.map((key) => key.slice(key.lastIndexOf('@') + 1)).join(' and ')} alone, for ${confined[versions[0]].for} (${route})`,
    ]
  }
  const admitted = confined[id]
  const names = new Set(ids.map((key) => key.slice(0, key.lastIndexOf('@'))))
  // Every package that depends on it, not the first route the walk found: a
  // direct dependency hides behind the route through the renderer.
  const dependents = item.dependents ?? [item.via.at(-1)]
  return [
    ...[admitted.licenceFile, ...(admitted.alsoRead ?? [])].flatMap(({ path, sha256 }) =>
      item.licenceTexts?.[path] === sha256
        ? []
        : [`${id}'s ${path} is ${item.licenceTexts?.[path] ?? 'missing'}, not the file the review read (${sha256}) (${route})`],
    ),
    ...dependents
      .filter((dependent) => dependent !== admitted.for && !names.has(dependent))
      .map((dependent) => `${id} is admitted for ${admitted.for} alone, and ${String(dependent)} depends on it (${route})`),
  ]
}

/**
 * Whether `font`, of the package `item` is, is one `unloaded` admits as
 * never loaded: false where no admission names it, so the policy judges
 * it; true at the digest the review read, its package depended on by the
 * package admitted for alone; and what is wrong otherwise.
 */
function neverLoaded(item, id, font, route, unloaded) {
  if (!Object.hasOwn(unloaded, id) || !Object.hasOwn(unloaded[id].fonts, font.path)) return false
  const admitted = unloaded[id]
  const read = admitted.fonts[font.path]
  if (font.digest !== read) return `${id}/${font.path} is ${font.digest ?? 'of no digest'}, not the font the review read (${read}) (${route})`
  const others = (item.dependents ?? [item.via.at(-1)]).filter((dependent) => dependent !== admitted.for)
  if (others.length > 0)
    return `${id}/${font.path} is admitted as never loaded by ${admitted.for} alone, and ${others.join(', ')} depends on ${item.name} (${route})`
  return true
}

/** The admission in `builds` whose family `name` is one of, the family itself or one of its builds, `family-…`: [family, admission], or undefined. */
function familyOf(name, builds) {
  return Object.entries(builds).find(([family]) => name === family || name.startsWith(`${family}-`))
}

/** A component's place and licence as a review records it: `name@version`, and its licence or null. */
const componentKey = ({ name, version }) => (version === undefined ? name : `${name}@${version}`)

/**
 * The components of `sbom`, a build's of `name@version`, whose licence the
 * policy refuses or that state none, by `componentKey`, sorted: what a
 * review records of the build. The build's own file, which the SBOM lists
 * under the build's own purl, is the package's, judged by its manifest.
 */
export function beyondPolicy(sbom, name, version) {
  const own = `pkg:npm/${name.replace(/^@/, '%40')}@${version}`
  return Object.fromEntries(
    (sbom.components ?? [])
      .filter((component) => !String(component.purl ?? '').startsWith(own))
      .filter((component) => component.licence === undefined || !spdxAllows(component.licence))
      .map((component) => [componentKey(component), component.licence ?? null])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  )
}

/**
 * What is wrong with a package of a family `builds` admits, or with one
 * that ships a native addon no admission names: [] where neither, or where
 * it is the family's version, reached through the package admitted for, and
 * -- for a build -- one the review read, by its SBOM's digest and the
 * components beyond the policy that SBOM lists.
 */
function buildProblems(item, id, route, builds) {
  const family = familyOf(item.name, builds)
  if (family === undefined) {
    return (item.natives ?? []).length === 0
      ? []
      : [`${id} ships a native addon, ${item.natives.join(', ')}, whose build no review read: read its SBOM and record it in BUILDS_READ (${route})`]
  }
  const [name, admitted] = family
  if (item.version !== admitted.version) return [`${id} is a version of ${name}, which a review read at ${admitted.version} alone (${route})`]
  const found = []
  if (!item.via.includes(admitted.for)) found.push(`${id} is admitted for ${admitted.for} alone, and is reached otherwise (${route})`)
  if (item.name === name) return found
  const read = admitted.builds[item.name]
  if (read === undefined) return [...found, `${id} is a build of ${name} no review read (${route})`]
  if (item.sbom?.sha256 !== read)
    return [...found, `${id}'s sbom.cdx.json is ${item.sbom?.sha256 ?? 'missing'}, not the SBOM the review read (${read}) (${route})`]
  const beyond = beyondPolicy(item.sbom, item.name, item.version)
  if (JSON.stringify(beyond) !== JSON.stringify(admitted.beyondPolicy))
    found.push(`${id}'s SBOM lists ${JSON.stringify(beyond)} beyond the policy, not what the review recorded (${route})`)
  return found
}

/**
 * What is wrong with `lockfile`, pnpm-lock.yaml's text, against `builds`:
 * every package of an admitted family it names, at any version and on any
 * platform, must be one the review read -- the family's version, and a
 * build it names -- and every build a review read must be one the lockfile
 * names, so the table holds no more than it installs. A machine installs
 * its own platform's build alone, so the lockfile is what says the rest.
 */
export function lockfileProblems(lockfile, builds = BUILDS_READ) {
  const named = new Set()
  for (const [, name, version] of lockfile.matchAll(/^ {2}'?((?:@[^@\s'/]+\/)?[^@\s'/]+)@([^'\s:(]+)/gm)) named.add(`${name}@${version}`)
  const found = []
  for (const [family, admitted] of Object.entries(builds)) {
    const members = [...named].filter((key) => {
      const name = key.slice(0, key.lastIndexOf('@'))
      return name === family || name.startsWith(`${family}-`)
    })
    for (const key of members.sort()) {
      const name = key.slice(0, key.lastIndexOf('@'))
      const version = key.slice(key.lastIndexOf('@') + 1)
      if (version !== admitted.version) found.push(`pnpm-lock.yaml names ${key}, a version of ${family} no review read, at ${admitted.version} alone`)
      else if (name !== family && !Object.hasOwn(admitted.builds, name)) found.push(`pnpm-lock.yaml names ${key}, a build of ${family} no review read`)
    }
    for (const name of Object.keys(admitted.builds)) {
      if (!named.has(`${name}@${admitted.version}`)) found.push(`build ${name}@${admitted.version} names nothing pnpm-lock.yaml installs; remove it`)
    }
  }
  return found
}

/**
 * What is wrong with the `heldBy` of each admission in `unloaded`: it
 * names `file#test name`, a file of the repository at `root`, and a case
 * of that name in it, `test('…'` or `it('…'`. A guard that is not a gate
 * is a comment: the admission holds only while that case runs.
 */
export function heldByProblems(unloaded = NEVER_LOADED, repoRoot = root) {
  const found = []
  for (const [id, admitted] of Object.entries(unloaded)) {
    const [, file, name] = /^([^#]+)#(.+)$/.exec(String(admitted.heldBy ?? '')) ?? []
    if (file === undefined || name === undefined) {
      found.push(`never-loaded admission ${id} names no test as file#test name: ${String(admitted.heldBy)}`)
      continue
    }
    let text
    try {
      text = readFileSync(join(repoRoot, file), 'utf8')
    } catch {
      found.push(`never-loaded admission ${id} is held by ${file}, which the repository does not hold`)
      continue
    }
    // The name as a literal of any quote, standing first in a call of test or it, on no line that is a comment's.
    text = text
      .split('\n')
      .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
      .join('\n')
    const cased = ["'", '"', '`'].some((quote) => {
      for (let at = text.indexOf(`${quote}${name}${quote}`); at >= 0; at = text.indexOf(`${quote}${name}${quote}`, at + 1)) {
        if (/\b(?:test|it)\($/.test(text.slice(0, at).trimEnd())) return true
      }
      return false
    })
    if (!cased) found.push(`never-loaded admission ${id} is held by ${file}, which has no case named "${name}"`)
  }
  return found
}

/**
 * What is wrong with these closures under the policy, each named once with the
 * route to it. `exceptions` replace what a package or a font file says with
 * what a review found, at that exact version, and are refused when nothing
 * here installs them. `data` admits Formancy Data's packages, `profiles`
 * the ICC profiles a review read, `confined` the packages a review read
 * for one dependent alone, `unloaded` the fonts a review admitted as
 * never loaded by one dependent, and each is refused the same way; and
 * `builds` the native builds a review read by their SBOMs, whose unused
 * entries the lockfile's check refuses (`lockfileProblems`).
 */
export function problems(
  entries,
  exceptions = EXCEPTIONS,
  data = FORMANCY_DATA,
  profiles = ICC_PROFILES,
  confined = CONFINED,
  unloaded = NEVER_LOADED,
  builds = BUILDS_READ,
) {
  const found = new Set()
  const used = new Set()
  const admitted = new Set()
  const confinedSeen = new Set()
  const shipped = new Set()
  const unloadedSeen = new Set()
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
    if (!item.sibling) {
      for (const refusal of buildProblems(item, id, route, builds)) found.add(refusal)
      for (const refusal of confinement(item, id, route, confined)) found.add(refusal)
      if (Object.hasOwn(confined, id)) confinedSeen.add(id)
    }
    for (const font of item.fonts) {
      const unread = item.sibling ? false : neverLoaded(item, id, font, route, unloaded)
      if (unread !== false) unloadedSeen.add(`${id}/${font.path}`)
      if (typeof unread === 'string') found.add(unread)
      if (unread !== false) continue
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
  for (const key of Object.keys(confined)) {
    if (!confinedSeen.has(key)) found.add(`confined package ${key} names nothing a published package installs; remove it`)
  }
  for (const [id, admitted] of Object.entries(unloaded)) {
    for (const path of Object.keys(admitted.fonts)) {
      if (!unloadedSeen.has(`${id}/${path}`)) found.add(`never-loaded font ${id}/${path} names nothing a published package installs; remove it`)
    }
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
    let names
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
  const repoRoot = process.argv[2] ? resolve(process.argv[2]) : root
  const { published, entries } = workspaceClosure(repoRoot)
  let lockfile
  try {
    lockfile = readFileSync(join(repoRoot, 'pnpm-lock.yaml'), 'utf8')
  } catch {
    lockfile = undefined
  }
  const found = [
    ...problems(entries),
    ...(lockfile === undefined ? ['pnpm-lock.yaml is not there to read the builds every platform installs from'] : lockfileProblems(lockfile)),
    ...heldByProblems(NEVER_LOADED, repoRoot),
  ]
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
