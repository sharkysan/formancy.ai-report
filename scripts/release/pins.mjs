// What release.yml's `check` job checked, pinned by sha256, and the `publish`
// job's refusal of anything else (0014; formancy.ai-data 0035's shape).
//
// Every job of a run can write to its artefacts. So `check`, which holds
// `contents: read` and no secret, checks the release report the gates built,
// the tarballs and the SBOM, and writes their sha256 as its outputs; and
// `publish`, which holds the npm token and an identity that signs, refuses
// before it signs anything any downloaded file that is not, byte for byte,
// one `check` pinned, and a report that is not this run's, green and whole:
//
//   node scripts/release/pins.mjs check --release <r> --version <x.y.z> --report <dir> <tarball dir>   >> "$GITHUB_OUTPUT"
//   node scripts/release/pins.mjs sbom --report <dir> <sbom file>                                      >> "$GITHUB_OUTPUT"
//   node scripts/release/pins.mjs downloads --release <r> --version <x.y.z> --report <dir> <tarball dir> <sbom file>
//
// with GITHUB_SHA and GITHUB_RUN_ID, which every step has, and, for
// `downloads`, CHECKED and CHECKED_SBOM, what `check` pinned. `check` runs
// before cdxgen, whose dependencies nothing locks, so what it pins is what
// the gates uploaded. A pin is a file's path as both jobs download it.
//
// Node's built-ins and the repository's own scripts only: the publish job
// installs nothing.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { installedTarballProblems, notesProblems, reportFilesProblems, reportProblems, sbomReportProblems } from '../release-report/verify-publish.mjs'
import { LICENSE_FIELD, LICENSE_FILES } from '../verify-licenses.mjs'
import { readTarball } from './tarball.mjs'

/** The hex sha256 of `bytes`. */
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** What a release reads of a tarball (`{ path, bytes }`): its file name and sha256, and its manifest's name, version and licence, and the licence files it carries. */
export function describe({ path, bytes }) {
  const entries = readTarball(bytes)
  const manifest = JSON.parse(entries.get('package/package.json')?.toString('utf8') ?? '{}')
  return {
    file: basename(path),
    sha256: sha256(bytes),
    name: manifest.name,
    version: manifest.version,
    license: manifest.license,
    carries: LICENSE_FILES.filter((file) => entries.has(`package/${file}`)),
  }
}

/**
 * What is wrong with a tarball a release would publish (`{ path, bytes }`):
 * not at `version`, declaring other terms than LICENSE_FIELD, or carrying no
 * LICENSE.md or NOTICE. Empty when nothing is.
 */
export function tarballProblems({ path, bytes }, version) {
  const { name, version: packed, license, carries } = describe({ path, bytes })
  const problems = []
  if (packed !== version) problems.push(`${path} is ${String(name)}@${String(packed)}, not at the release version ${version}`)
  if (license !== LICENSE_FIELD) problems.push(`${path} declares the licence ${String(license)}, not "${LICENSE_FIELD}"`)
  for (const file of LICENSE_FILES) if (!carries.includes(file)) problems.push(`${path} carries no ${file}`)
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

/** The pins of `files` (`[{ path, bytes }]`): each file's path, '/'-separated, and the sha256 of its bytes, in path order. */
export function pinsOf(files) {
  return Object.fromEntries(files.map(({ path, bytes }) => [path.replaceAll('\\', '/'), sha256(bytes)]).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
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

/** Every regular file directly in `dir`, as `{ path, bytes }`, its path as the workflow names it: relative to where the job runs, '/'-separated. */
export function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({ path: relative(process.cwd(), join(dir, name)).replaceAll('\\', '/'), bytes: readFileSync(join(dir, name)) }))
}

/** The release report in `dir`, parsed. */
export const readReport = (dir) => JSON.parse(readFileSync(join(dir, 'release-report.json'), 'utf8'))

/** This run, as the report is held to it: the release and version given, and the commit and run GitHub says. */
function thisRun(release, version, env = process.env) {
  for (const name of ['GITHUB_SHA', 'GITHUB_RUN_ID']) if (!env[name]) throw new Error(`pins.mjs holds the report to this run, and ${name} is not set`)
  return { release, version, commit: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID }
}

/**
 * Everything `check` refuses before it pins: the report, the files beside
 * it, the body, and the tarballs -- each at the version, under its licence,
 * and the install gate's.
 */
export function checkProblems({ reportDir, tarballDir, release, version, env = process.env }) {
  const files = filesIn(tarballDir)
  const tarballs = files.filter(({ path }) => path.endsWith('.tgz'))
  const notes = join(reportDir, 'RELEASE_NOTES.md')
  return [
    ...reportFilesProblems(readdirSync(reportDir)),
    ...(existsSync(join(reportDir, 'release-report.json')) ? reportProblems(readReport(reportDir), thisRun(release, version, env)) : []),
    ...notesProblems(existsSync(notes) ? readFileSync(notes, 'utf8') : null),
    ...(tarballs.length === 0 ? [`${tarballDir} holds no tarball`] : []),
    ...files.filter(({ path }) => !path.endsWith('.tgz')).map(({ path }) => `${path} is not a tarball`),
    ...tarballs.flatMap((file) => tarballProblems(file, version)),
    ...(existsSync(join(reportDir, 'release-report.json')) ? installedTarballProblems(readReport(reportDir), tarballs.map(describe)) : []),
  ]
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
  const options = {}
  const positional = []
  for (let at = 0; at < rest.length; at += 1) {
    if (rest[at].startsWith('--')) options[rest[at].slice(2)] = rest[(at += 1)]
    else positional.push(rest[at])
  }
  const need = (name) => {
    if (options[name] === undefined || options[name] === '') throw new Error(`pins.mjs ${String(stage)} needs --${name}`)
    return options[name]
  }
  if (stage === 'check') {
    const [tarballDir] = positional
    if (tarballDir === undefined) throw new Error('usage: pins.mjs check --release <r> --version <x.y.z> --report <dir> <tarball dir>')
    const reportDir = need('report')
    settle(checkProblems({ reportDir, tarballDir, release: need('release'), version: need('version') }), 'The report and the tarballs are not this release')
    console.log(`checked=${JSON.stringify(pinsOf([...filesIn(reportDir), ...filesIn(tarballDir)]))}`)
  } else if (stage === 'sbom') {
    const [file] = positional
    if (file === undefined) throw new Error('usage: pins.mjs sbom --report <dir> <sbom file>')
    const bytes = readFileSync(file)
    const problems = sbomProblems(bytes)
    settle(
      problems.length > 0 ? problems : sbomReportProblems(readReport(need('report')), JSON.parse(bytes.toString('utf8'))),
      'The SBOM is not this release’s',
    )
    console.log(`checked=${JSON.stringify(pinsOf([{ path: relative(process.cwd(), file), bytes }]))}`)
  } else if (stage === 'downloads') {
    const [tarballDir, sbom] = positional
    if (tarballDir === undefined || sbom === undefined)
      throw new Error('usage: pins.mjs downloads --release <r> --version <x.y.z> --report <dir> <tarball dir> <sbom file>')
    const reportDir = need('report')
    settle(
      [
        ...pinProblems(process.env.CHECKED, [...filesIn(reportDir), ...filesIn(tarballDir)]),
        ...pinProblems(process.env.CHECKED_SBOM, [{ path: relative(process.cwd(), sbom), bytes: readFileSync(sbom) }]),
        ...reportProblems(readReport(reportDir), thisRun(need('release'), need('version'))),
      ],
      'What was downloaded is not what the check job checked, or not this run’s; nothing is signed or published',
    )
    console.log('downloads: every file is the one the check job checked, and the report is this run’s')
  } else {
    throw new Error('usage: pins.mjs check|sbom|downloads ...')
  }
}
