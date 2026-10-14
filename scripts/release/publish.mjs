// npm receives exactly the tarballs the install gate installed and ran, and
// release.yml's `check` job pinned -- formancy.ai-data's publish step (its
// 0035), holding the tarballs to `check`'s pins rather than to a release
// report, which arrives here with packaging:
//
//   node scripts/release/publish.mjs --tarballs release-tarballs
//
// with NODE_AUTH_TOKEN, NPM_CONFIG_PROVENANCE and CHECKED -- what `check`
// pinned -- set. Before the first `npm publish` it refuses, all at once, a
// downloaded tarball `check` did not pin or pinned otherwise: the artefact
// store is written by every job of the run, and the step that holds the npm
// token takes nobody's word for what it was handed. Then, per tarball, in the
// order their own manifests' dependencies give -- report-spec before what
// depends on it -- it asks the registry for that version:
//
//   - not there: `npm publish <file.tgz> --provenance --access public`;
//   - there with this tarball's sha512 as its `dist.integrity`: skipped, which
//     is what lets a failed publish job be run again after some versions
//     reached npm;
//   - there with any other integrity: refused. A version number is published
//     once, and those bytes are not these.
//
// Nothing is rebuilt and nothing is packed here: a tarball built in this job
// would be bytes no gate installed. `--access public` is the registry's
// visibility of a scoped package; LICENSE.md says what may be done with it.

import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { basename, join, resolve } from 'node:path'
import { filesIn, pinProblems } from './pins.mjs'
import { readTarball } from './tarball.mjs'

const FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies']

/** What npm records as a tarball's integrity, and the registry as its `dist.integrity`. */
export const integrityOf = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`

/**
 * The names of `packages` (`[{ name, manifest }]`), each after every other
 * one of them it depends on, ties in name order. Throws on a cycle, which
 * would be a release nobody can install in any order.
 */
export function publishOrder(packages) {
  const names = new Set(packages.map((entry) => entry.name))
  const needs = new Map(packages.map(({ name, manifest }) => [name, new Set(FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {})).filter((dependency) => names.has(dependency) && dependency !== name))]))
  const order = []
  while (order.length < packages.length) {
    const ready = [...needs].filter(([name, deps]) => !order.includes(name) && [...deps].every((dependency) => order.includes(dependency))).map(([name]) => name).sort()
    if (ready.length === 0) throw new Error(`the tarballs depend on one another in a cycle: ${[...names].filter((name) => !order.includes(name)).join(', ')}`)
    order.push(ready[0])
  }
  return order
}

/**
 * What to do with a tarball, given the integrity the registry holds for its
 * version (`undefined` when it has none): `publish` or `skip`. Throws when
 * the registry holds other bytes under that version.
 */
export function decide({ name, version, integrity }, registered) {
  if (registered === undefined) return 'publish'
  if (registered === integrity) return 'skip'
  throw new Error(`${name}@${version} is on npm as ${registered}, not as this tarball's ${integrity}: a version is published once, and these are not its bytes`)
}

/**
 * The tarballs to publish, in the order they go in: `files` are what this job
 * downloaded, `[{ path, bytes }]`, and `checked` what `check` pinned of them.
 * Throws, naming every problem, unless each file is what `check` pinned.
 */
export function toPublish({ files, checked }) {
  const problems = pinProblems(checked, files)
  if (problems.length > 0) throw new Error(`publish.mjs publishes nothing:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
  const tarballs = files
    .filter(({ path }) => path.endsWith('.tgz'))
    .map(({ path, bytes }) => {
      const manifest = JSON.parse(readTarball(bytes).get('package/package.json')?.toString('utf8') ?? '{}')
      return { file: basename(path), name: manifest.name, version: manifest.version, manifest, integrity: integrityOf(bytes) }
    })
  return publishOrder(tarballs).map((name) => tarballs.find((entry) => entry.name === name))
}

/** The integrity npm holds for `name@version`, or undefined when the registry has no such version. */
function registered(name, version) {
  const answer = spawnSync('npm', ['view', `${name}@${version}`, 'dist.integrity', '--json'], { encoding: 'utf8' })
  if (answer.status !== 0) {
    if (/E404|404 Not Found/.test(`${answer.stdout}${answer.stderr}`)) return undefined
    throw new Error(`npm view ${name}@${version} failed: ${answer.stderr.trim()}`)
  }
  return answer.stdout.trim() === '' ? undefined : JSON.parse(answer.stdout)
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/release/publish.mjs')) {
  const argv = process.argv.slice(2)
  const at = argv.indexOf('--tarballs')
  const value = at === -1 ? undefined : argv[at + 1]
  if (value === undefined || value === '') throw new Error('publish.mjs needs --tarballs <dir>')
  const dir = resolve(value)
  const order = toPublish({ files: filesIn(dir), checked: process.env.CHECKED })
  for (const tarball of order) {
    if (decide(tarball, registered(tarball.name, tarball.version)) === 'skip') {
      console.log(`${tarball.name}@${tarball.version}: already on npm with these bytes, skipped`)
      continue
    }
    execFileSync('npm', ['publish', join(dir, tarball.file), '--provenance', '--access', 'public'], { stdio: 'inherit' })
    console.log(`${tarball.name}@${tarball.version}: published from ${tarball.file}`)
  }
}
