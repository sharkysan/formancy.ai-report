// What release.yml's `check` job checked, pinned by sha256, and the `publish`
// job's refusal of anything else -- formancy.ai-data's shape (its 0035),
// without its release report, which arrives here with packaging.
//
// Every job of a run can write to its artefacts. So `check`, which holds
// `contents: read` and no secret, checks the tarballs and the SBOM and writes
// their sha256 as its outputs, and `publish`, which holds the npm token and
// an identity that signs, refuses before it signs anything any downloaded
// file that is not, byte for byte, one `check` pinned:
//
//   node scripts/release/pins.mjs check --version <x.y.z> <tarball dir>   >> "$GITHUB_OUTPUT"
//   node scripts/release/pins.mjs sbom <sbom file>                         >> "$GITHUB_OUTPUT"
//   node scripts/release/pins.mjs downloads <tarball dir> <sbom file>      (CHECKED, CHECKED_SBOM set)
//
// Node's built-ins only: neither job installs anything for this.

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { LICENSE_FIELD, LICENSE_FILES } from '../verify-licenses.mjs'
import { readTarball } from './tarball.mjs'

/** The hex sha256 of `bytes`. */
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/**
 * What is wrong with a tarball a release would publish (`{ path, bytes }`):
 * not at `version`, declaring other terms than LICENSE_FIELD, or carrying no
 * LICENSE.md or NOTICE. Empty when nothing is.
 */
export function tarballProblems({ path, bytes }, version) {
  const entries = readTarball(bytes)
  const manifest = JSON.parse(entries.get('package/package.json')?.toString('utf8') ?? '{}')
  const problems = []
  if (manifest.version !== version) problems.push(`${path} is ${String(manifest.name)}@${String(manifest.version)}, not at the release version ${version}`)
  if (manifest.license !== LICENSE_FIELD) problems.push(`${path} declares the licence ${String(manifest.license)}, not "${LICENSE_FIELD}"`)
  for (const file of LICENSE_FILES) if (!entries.has(`package/${file}`)) problems.push(`${path} carries no ${file}`)
  return problems
}

/** What the SBOM's bytes are not: JSON, and a CycloneDX document. Empty when they are both. */
export function sbomProblems(bytes) {
  let document
  try {
    document = JSON.parse(bytes.toString('utf8'))
  } catch {
    return ['the SBOM is not JSON']
  }
  return document?.bomFormat === 'CycloneDX' ? [] : ['the SBOM is not a CycloneDX document']
}

/** The pins of `files` (`[{ path, bytes }]`): each file's name and the sha256 of its bytes, in name order. */
export function pinsOf(files) {
  return Object.fromEntries(files.map(({ path, bytes }) => [basename(path), sha256(bytes)]).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

/**
 * What differs between `checked` -- the JSON `pinsOf` wrote, as a job output
 * carries it -- and `files`: changed bytes, a file nobody pinned, and a pinned
 * file that did not arrive. Pinning nothing is a problem too: an output that
 * never arrived is '', which must not read as "nothing to check".
 */
export function pinProblems(checked, files) {
  let pinned
  try {
    pinned = JSON.parse(checked ?? '')
  } catch {
    pinned = {}
  }
  if (typeof pinned !== 'object' || pinned === null || Object.keys(pinned).length === 0) return ['the check job pinned no file']
  const arrived = pinsOf(files)
  const problems = []
  for (const [file, digest] of Object.entries(arrived)) {
    if (!(file in pinned)) problems.push(`${file} was not checked by the check job`)
    else if (pinned[file] !== digest) problems.push(`${file} is not the file the check job checked`)
  }
  for (const file of Object.keys(pinned)) if (!(file in arrived)) problems.push(`${file} was checked but did not arrive`)
  return problems
}

/** Every regular file directly in `dir`, as `{ path, bytes }`. */
export function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({ path: join(dir, entry.name).replaceAll('\\', '/'), bytes: readFileSync(join(dir, entry.name)) }))
}

/** Exit naming every problem, or say nothing was wrong. */
function settle(problems, what) {
  if (problems.length > 0) {
    console.error(`${what}:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
    process.exit(1)
  }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/release/pins.mjs')) {
  const [stage, ...rest] = process.argv.slice(2)
  if (stage === 'check') {
    const at = rest.indexOf('--version')
    const version = at === -1 ? undefined : rest[at + 1]
    const dir = rest.find((arg, index) => index !== at && index !== at + 1)
    if (version === undefined || version === '' || dir === undefined) throw new Error('usage: pins.mjs check --version <x.y.z> <tarball dir>')
    const files = filesIn(dir)
    const tarballs = files.filter(({ path }) => path.endsWith('.tgz'))
    settle(
      [
        ...(tarballs.length === 0 ? [`${dir} holds no tarball`] : []),
        ...files.filter(({ path }) => !path.endsWith('.tgz')).map(({ path }) => `${path} is not a tarball`),
        ...tarballs.flatMap((file) => tarballProblems(file, version)),
      ],
      'The tarballs are not the release',
    )
    console.log(`checked=${JSON.stringify(pinsOf(tarballs))}`)
  } else if (stage === 'sbom') {
    const [file] = rest
    if (file === undefined) throw new Error('usage: pins.mjs sbom <sbom file>')
    const bytes = readFileSync(file)
    settle(sbomProblems(bytes), 'The SBOM is not one')
    console.log(`checked=${JSON.stringify(pinsOf([{ path: file, bytes }]))}`)
  } else if (stage === 'downloads') {
    const [dir, sbom] = rest
    if (dir === undefined || sbom === undefined) throw new Error('usage: pins.mjs downloads <tarball dir> <sbom file>')
    settle(
      [...pinProblems(process.env.CHECKED, filesIn(dir)), ...pinProblems(process.env.CHECKED_SBOM, [{ path: sbom, bytes: readFileSync(sbom) }])],
      'What was downloaded is not what the check job checked; nothing is signed or published',
    )
    console.log('downloads: every file is the one the check job checked')
  } else {
    throw new Error('usage: pins.mjs check|sbom|downloads ...')
  }
}
