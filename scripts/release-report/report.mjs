// The release report (0014; formancy.ai-data 0035): which run it describes,
// what that run was tested on, what it found, the build identity of every
// published package, the release gates, and the limitations -- derived from
// the run, then the ones the decision records state -- built from the
// results every job collected.
//
// In the gates workflow's last job, from what every other job uploaded:
//
//   NEEDS='${{ toJSON(needs) }}' RELEASE='${{ inputs.release }}' \
//     node scripts/release-report/report.mjs --results release-results --out release-report
//
// and on one machine, after collect.mjs --local --since <ISO instant>:
//
//   node scripts/release-report/report.mjs --local [--allow-missing verify,browser,install]
//
// It writes release-report/release-report.json and release-report.md and
// exits 1 when anything in `problems` fails the run; both files are written
// either way, so a red run says why. For a release or a rehearsal
// (RELEASE is a tag or `dry-run`) it also writes release-report/RELEASE_NOTES.md,
// the body release.yml gives the GitHub release; in CI it builds that body
// only to print its size. `buildReport` is pure over its inputs and
// report.test.mjs holds it; `loadInputs` reads them from the checkout.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BROWSERS } from '../browsers.mjs'
import { HOSTS, planProjects } from '../install-hosts.mjs'
import { readScenes } from '../pictures/record.mjs'
import { bodySection, releaseBody } from '../release-notes.mjs'
import { expectedKeys, gateJobs, readWorkflow } from '../workflows.mjs'
import { artefactProblems, readArtefacts, resultsOf } from './artefacts.mjs'
import { appsWith, namedPackages } from './collect.mjs'
import { evaluateGates, evidenceKind, gatesProblems, readGates } from './gates.mjs'
import { readRecords, readRegister, registerProblems, statedLimitations } from './limitations.mjs'
import { contentProblems, localResultsProblems, needsProblems, releaseGateProblems } from './problems.mjs'
import { renderReport, renderSummary } from './render.mjs'
import { fileOutcome, resultsInRun } from './results.mjs'
import { published, testedOn } from './tested-on.mjs'
import { testedOnInRun } from './versions.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Which run the report describes: version, release, commit, run, and each job's attempt and machine. */
function subjectOf(inputs, results) {
  return {
    version: inputs.version,
    release: inputs.release === '' || inputs.release === undefined ? null : inputs.release,
    commit: inputs.commit,
    // Locally, whether the tree held uncommitted changes when it was collected; null when nothing said.
    dirty: inputs.mode === 'ci' ? false : (results.find((result) => typeof result.dirty === 'boolean')?.dirty ?? null),
    run: inputs.mode === 'ci' ? { ...inputs.run } : null,
    generatedAt: inputs.generatedAt,
    jobs: results.map((result) => ({ key: result.key, job: result.job, attempt: result.run?.attempt ?? null, runner: result.runner ?? null })),
  }
}

/**
 * The install hosts scripts/install-hosts.mjs plans for the published
 * `manifests` (name to manifest), as the install gate plans them from the
 * packed ones: `{ hosts: [{ project, at, peers }], error }`, each host's
 * peers as it installs them -- a range at the newest, the floor's exact
 * version at the floor -- or, when no plan can be made, why.
 */
export function installPlanOf(manifests) {
  try {
    const hosts = planProjects(manifests).map((project) => ({
      project: project.name,
      at: project.at,
      peers: Object.fromEntries((HOSTS[project.host].peers ?? []).map((peer) => [peer, project.framework[peer]])),
    }))
    return { hosts, error: null }
  } catch (error) {
    return { hosts: [], error: error.message }
  }
}

/**
 * The scenes each of `apps` (repository paths, `apps/studio`) must walk in
 * its pictures' check: every scene `scenes` (scripts/pictures/scenes.json)
 * gives it, by id, in the file's order. A check is held to these, as the
 * install gate to installPlanOf(), and not to its own list.
 */
export const scenesOf = (scenes, apps) => Object.fromEntries(apps.map((app) => [app, scenes.filter((scene) => `apps/${scene.app}` === app).map((scene) => scene.id)]))

/**
 * The release body, and what is wrong with it: on a tag, the tag must be the
 * version every package is at and the changelog must have its section; on a
 * rehearsal, that version's section or Unreleased; and the body must fit
 * GitHub's limit. In CI (no release) the body is built only to be measured,
 * and nothing about it fails the run.
 */
function releaseOf(report, { release = '', version, changelog, run, repository }) {
  const problems = []
  const tag = release !== '' && release !== 'dry-run'
  if (tag && release !== `v${version}`) problems.push(`the release ${release} is not v${version}, the version every package is at`)
  const section = bodySection(changelog, { release, version })
  const link = tag ? `${repository}/releases/download/${release}/formancy-report-${release}-release-report.md` : (run?.url ?? null)
  const summary = renderSummary(report, { section, link })
  try {
    const body = releaseBody(changelog, section, summary)
    return { release: release === '' ? null : release, section, characters: body.length, body, problems }
  } catch (error) {
    if (release !== '') problems.push(error.message)
    return { release: release === '' ? null : release, section, characters: null, body: null, error: error.message, problems }
  }
}

/**
 * The report, from `inputs`. Locally (`mode` absent or `local`): `results`,
 * the one machine's collected results, and `allowMissing`. In CI (`mode:
 * 'ci'`): `artefacts` as the report job downloaded them, `expected`
 * (workflows.mjs's expectedKeys), the report job's `needs`, and the `run`.
 * Both: `jobs` (gates.yml's jobs that leave results), `facts` (testedOn()),
 * `covered` (packages with a suite, `{ path, id, name }`), `published`
 * (names), `browserApps` and `pictureApps` (the paths of the apps with a
 * `test:browser` and a `test:pictures` script), `browsers` (the browsers
 * the gates run in), `scenes` (scenesOf() for the picture apps),
 * `installPlan` (installPlanOf()), the limitations
 * `register` and decision `records`,
 * `gatesRegister` and each document's history in `documents`, `exists` for a
 * repository path, the `repository` URL, the `commit` its links name,
 * `version` (the root manifest's), `release`, `changelog` and `generatedAt`.
 */
export function buildReport(inputs) {
  const ci = inputs.mode === 'ci'
  const allowMissing = ci ? [] : (inputs.allowMissing ?? [])
  const results = ci ? resultsOf(inputs.artefacts) : inputs.results
  const { facts, covered, register, records, exists, repository, commit } = inputs
  const outcome = (file) => fileOutcome(results, file)
  const report = {
    schema: 1,
    subject: subjectOf(inputs, results),
    gateJobs: [...inputs.jobs],
    testedOn: testedOnInRun({ results, facts }),
    results: resultsInRun({ results, covered, published: inputs.published, scenes: inputs.scenes }),
    limitations: {
      registerProblems: registerProblems(register, records, { covered: covered.map((entry) => entry.path), exists }),
      stated: statedLimitations({ register, records, outcome, repository, commit }),
    },
  }
  const { browserApps, pictureApps, browsers } = inputs
  report.gates = evaluateGates(inputs.gatesRegister, { fileOutcome: outcome, browserGates: report.results.browserGates, browsers, needs: ci ? inputs.needs : null, documents: inputs.documents ?? {} })
  const { problems: releaseProblems, ...release } = releaseOf(report, inputs)
  report.release = release
  report.problems = [
    ...(ci ? needsProblems(inputs.needs, inputs.jobs) : []),
    ...(ci ? artefactProblems(inputs.artefacts, { expected: inputs.expected, commit, runId: inputs.run.id }) : localResultsProblems(results)),
    ...contentProblems(report, { published: inputs.published, installPlan: inputs.installPlan, browserApps, pictureApps, browsers, allowMissing }),
    ...gatesProblems(inputs.gatesRegister, { covered: covered.map((entry) => entry.path), browserApps, jobs: inputs.jobs, exists }).map((problem) => `docs/release/gates.json: ${problem}`),
    ...releaseGateProblems(report.gates, allowMissing),
    ...releaseProblems,
  ]
  return report
}

/** Every results file under `dir`, at any depth: what collect.mjs --local wrote. */
export function readResults(dir) {
  if (!existsSync(dir)) return []
  const found = []
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.json')) {
        const value = JSON.parse(readFileSync(full, 'utf8'))
        if (value?.schema === 1 && typeof value.key === 'string') found.push(value)
      }
    }
  }
  walk(dir)
  return found.sort((a, b) => a.key.localeCompare(b.key))
}

/** `git+https://github.com/x/y.git` as the URL a link opens. */
const browsable = (url) => String(url).replace(/^git\+/, '').replace(/\.git$/, '')

/** A document's last change and how many commits it is behind HEAD: what "stated" evidence is shown with. */
function documentHistory(root, path) {
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  const [sha, date] = git(['log', '-1', '--format=%H %cI', '--', path]).split(' ')
  if (sha === undefined || sha === '') return null
  return { sha, date, behind: Number(git(['rev-list', '--count', `${sha}..HEAD`])) }
}

/** Everything `buildReport` needs, read from the checkout at `root`, the results under `resultsDir` and, in CI, the environment. */
export function loadInputs(root, resultsDir, { ci = false, allowMissing = [], env = process.env } = {}) {
  const packages = published(root)
  const pictureApps = appsWith(root, 'test:pictures')
  const workflow = readWorkflow(root)
  const gatesRegister = readGates(root)
  const documents = Object.fromEntries(
    (gatesRegister.gates ?? [])
      .flatMap((entry) => entry.evidence ?? [])
      .map(evidenceKind)
      .filter((item) => item?.kind === 'document' && existsSync(join(root, item.value)))
      .map((item) => [item.value, documentHistory(root, item.value)]),
  )
  const common = {
    jobs: gateJobs(workflow),
    facts: testedOn(root),
    covered: namedPackages(root),
    published: packages.map(({ manifest }) => manifest.name),
    browserApps: appsWith(root, 'test:browser'),
    pictureApps,
    browsers: [...BROWSERS],
    scenes: scenesOf(readScenes(), pictureApps),
    installPlan: installPlanOf(new Map(packages.map(({ manifest }) => [manifest.name, manifest]))),
    register: readRegister(root),
    records: readRecords(root),
    gatesRegister,
    documents,
    exists: (path) => existsSync(join(root, path)),
    // Every published package names the one repository; the first is asked.
    repository: browsable(packages[0]?.manifest.repository?.url ?? ''),
    version: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
    changelog: readFileSync(join(root, 'CHANGELOG.md'), 'utf8'),
    generatedAt: new Date().toISOString(),
  }
  if (!ci) {
    const results = readResults(resultsDir)
    const commit = results[0]?.commit ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    return { ...common, mode: 'local', results, commit, release: '', allowMissing }
  }
  for (const name of ['NEEDS', 'GITHUB_SHA', 'GITHUB_RUN_ID']) {
    if (env[name] === undefined || env[name] === '') throw new Error(`report.mjs reads a gates run, and ${name} is not set: in the report job NEEDS is toJSON(needs); on a machine, run collect.mjs --local and report.mjs --local`)
  }
  return {
    ...common,
    mode: 'ci',
    artefacts: readArtefacts(resultsDir),
    expected: expectedKeys(workflow, common.covered),
    needs: JSON.parse(env.NEEDS),
    commit: env.GITHUB_SHA,
    run: {
      id: env.GITHUB_RUN_ID,
      attempt: env.GITHUB_RUN_ATTEMPT ?? null,
      workflow: env.GITHUB_WORKFLOW ?? null,
      url: `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${env.GITHUB_REPOSITORY ?? ''}/actions/runs/${env.GITHUB_RUN_ID}`,
    },
    release: env.RELEASE ?? '',
  }
}

/** Writes the report's JSON and Markdown, and a release's body, into `out`; answers what it wrote. */
export function writeReport(report, out, { local = false, partial = [] } = {}) {
  mkdirSync(out, { recursive: true })
  const { body, ...release } = report.release
  const written = { ...report, release, ...(local ? { local: true, partial } : {}) }
  writeFileSync(join(out, 'release-report.json'), `${JSON.stringify(written, null, 2)}\n`, 'utf8')
  writeFileSync(join(out, 'release-report.md'), renderReport(report, { local, partial }), 'utf8')
  if (body !== null && release.release !== null) writeFileSync(join(out, 'RELEASE_NOTES.md'), body, 'utf8')
  return release
}

// `node scripts/release-report/report.mjs [--local] [--results <dir>] [--out <dir>] [--allow-missing a,b]`
if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/release-report/report.mjs')) {
  const argv = process.argv.slice(2)
  const option = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback)
  const local = argv.includes('--local')
  const allowMissing = local ? option('--allow-missing', '').split(',').filter((entry) => entry !== '') : []
  const report = buildReport(loadInputs(repo, resolve(repo, option('--results', 'release-results')), { ci: !local, allowMissing }))
  const out = resolve(repo, option('--out', 'release-report'))
  const release = writeReport(report, out, { local, partial: allowMissing })
  console.log(`${out}/release-report.md: ${String(report.problems.length)} problem(s)`)
  console.log(
    release.characters === null
      ? `release body: not built (${String(release.error)})`
      : `release body: ${String(release.characters)} characters, from CHANGELOG.md's ${release.section} section${release.release === null ? ', built to be measured only' : ''}`,
  )
  for (const problem of report.problems) console.error(`  - ${problem}`)
  process.exitCode = report.problems.length === 0 ? 0 : 1
}
