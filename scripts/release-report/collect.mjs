// What one job of a run found, in one file the release report reads (0014;
// formancy.ai-data 0035's collect, without its databases, containers and
// getting-started journey, which Report does not have).
//
//   node scripts/release-report/collect.mjs --job verify
//   node scripts/release-report/collect.mjs --job test --package @formancy/report-spec
//   node scripts/release-report/collect.mjs --job install
//   node scripts/release-report/collect.mjs --local --since 2026-10-16T08:00:00Z
//
// It writes `release-results/<key>.json` and, on GitHub, `key=<key>` to the
// step's outputs, so the artefact's name and the file's key have one source.
// The key is the job, `test-<id>` for a package's suite with the id
// codecov-config.mjs gives it, and the job with `--variant` appended for a
// job a matrix runs more than once.
//
// What it reads, each where its writer puts it: the repository guards'
// `test-results/vitest.json` in `verify`; a package's
// `test-results/vitest.json` and `coverage/coverage-summary.json`, and
// turbo's `.turbo/runs/*.json` for the task's own start and end, in `test`;
// the install gate's `test-results/install.json` in `install`; and in every
// job, every published package's `dist/` that job built. Beside each suite
// it lists the test files the checkout holds for it (`git ls-files`), so the
// report can name one the suite did not run. What it expected and did not
// find it lists under `missing`, and the report fails on that.
//
// Those three jobs are what gates.yml runs. A job it gains -- the Studio's
// browser legs -- gets a reader in READERS and a section in the report, as
// formancy.ai-data's browser gates have; until then collect refuses it, so
// the job fails rather than uploading results that look like a job with
// nothing to say.
//
// `--local` reads every package of one machine at once, the guards and the
// install gate. It refuses a results file that started before `--since`,
// which has no default: a file left by an earlier run read as this one's is
// the failure local mode has to rule out, and only the person running it
// knows from when.
//
// Node's built-ins and the repository's own scripts only.

import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { coveredPackages } from '../codecov-config.mjs'
import { distHash, distOfPackage } from '../release/dist-hash.mjs'
import { testFilesOf } from './results.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const slash = (path) => path.replaceAll('\\', '/')
const time = (value) => (typeof value === 'number' ? value : Date.parse(value))

/** A matrix value safe in an artefact's name. */
const safe = (value) => String(value).replaceAll(/[^A-Za-z0-9.]+/g, '-')

/** The key of a job's results: the artefact is `release-results-<key>`. */
export function keyFor({ job, pkg, variant }, covered) {
  let key = job
  if (job === 'test') {
    const entry = covered.find((candidate) => candidate.name === pkg)
    if (entry === undefined) throw new Error(`--package ${String(pkg)} is no workspace package with a test:coverage script`)
    key = `test-${entry.id}`
  }
  return variant === undefined ? key : `${key}-${safe(variant)}`
}

/** coveredPackages() with each package's npm name: what keyFor() keys a package's results by. */
export function namedPackages(root = repo) {
  return coveredPackages(root).map((entry) => ({ ...entry, name: readJson(join(root, entry.path, 'package.json')).name }))
}

/** Every published package -- under packages/, not private -- with its directory and manifest. */
function publishedPackages(root) {
  const folder = join(root, 'packages')
  if (!existsSync(folder)) return []
  return readdirSync(folder)
    .sort()
    .filter((name) => existsSync(join(folder, name, 'package.json')))
    .map((name) => ({ dir: join(folder, name), manifest: readJson(join(folder, name, 'package.json')) }))
    .filter(({ manifest }) => manifest.private !== true)
}

/** A suite's vitest JSON, normalised: totals, and each file with each test's status and duration. A test's `meta` is left out: nothing reads it. */
export function normaliseSuite(json, root) {
  return {
    success: json.success,
    numTotalTests: json.numTotalTests,
    numPassedTests: json.numPassedTests,
    numFailedTests: json.numFailedTests,
    numPendingTests: json.numPendingTests,
    numTodoTests: json.numTodoTests,
    numFailedTestSuites: json.numFailedTestSuites,
    startTime: json.startTime,
    files: json.testResults.map((file) => ({
      file: slash(relative(root, file.name)),
      status: file.status,
      startTime: file.startTime,
      endTime: file.endTime,
      tests: file.assertionResults.map((test) => ({ name: test.fullName, status: test.status, durationMs: test.duration ?? null })),
    })),
  }
}

/** The newest turbo run summary's entry for `taskId`: its own start and end, and whether turbo replayed it. */
function turboTask(root, taskId) {
  const folder = join(root, '.turbo', 'runs')
  if (!existsSync(folder)) return undefined
  const runs = readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson(join(folder, name)))
    .sort((a, b) => (a.execution?.startTime ?? 0) - (b.execution?.startTime ?? 0))
  for (const run of runs.reverse()) {
    const task = run.tasks?.find((candidate) => candidate.taskId === taskId)
    if (task !== undefined) return { startTime: task.execution?.startTime ?? null, endTime: task.execution?.endTime ?? null, cache: task.cache?.status ?? null }
  }
  return undefined
}

/**
 * Every file the checkout holds -- committed, or new and not ignored, which
 * a local run tests as much as a committed one -- and that is on disk, as
 * git lists them: what a suite's test files are found among.
 */
function checkoutFiles(root, git) {
  return git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
    .split('\0')
    .filter((file) => file !== '' && existsSync(join(root, file)))
}

/** Which machine a result file comes from: Node, the platform, and on GitHub the runner image. */
const runner = (env) => ({ node: process.version, platform: process.platform, arch: process.arch, image: env.ImageOS ?? null, imageVersion: env.ImageVersion ?? null })

/**
 * The readers, by job: what each job of gates.yml leaves for the report.
 * `read` reads one suite or the install gate's record into the result.
 */
const READERS = {
  verify: (read) => read.suite('.', null),
  test: (read, { pkg, packages }) => read.suite(packages.find((entry) => entry.name === pkg).path, pkg),
  install: (read) => read.install(),
}

/**
 * Everything one job (or, locally, one machine) found. Pure over the files
 * under `root`, the `git` it is given, `env` and `now`.
 */
export function collect({ root = repo, job, pkg, variant, local = false, since, env = process.env, git = defaultGit, now = () => new Date() }) {
  if (!local && READERS[job] === undefined) {
    throw new Error(`collect.mjs reads the ${Object.keys(READERS).join(', ').replace(/, (?=[^,]*$)/, ' and ')} jobs, and has no reader for ${String(job)}: a job the report expects results from needs one here`)
  }
  const packages = namedPackages(root)
  const key = local ? 'local' : keyFor({ job, pkg, variant }, packages)
  const missing = []
  const after = local ? time(since) : Number.NEGATIVE_INFINITY
  if (local && Number.isNaN(after)) throw new Error('--local needs --since <ISO instant>: results older than it are refused as stale, and nothing else can say from when')
  const fresh = (path, started, verb = 'started') => {
    if (time(started) >= after) return true
    missing.push(`stale: ${path} ${verb} ${new Date(time(started)).toISOString()}, before --since`)
    return false
  }

  // What the checkout holds, asked of git once and only by a job with a suite.
  let held
  const checkout = () => (held ??= checkoutFiles(root, git))
  const iso = (value) => new Date(time(value)).toISOString()

  const suites = []
  let install = null
  const read = {
    suite(path, name) {
      const shown = slash(join(path, 'test-results', 'vitest.json'))
      if (!existsSync(join(root, shown))) return void missing.push(shown)
      const json = readJson(join(root, shown))
      if (!fresh(shown, json.startTime)) return
      // The suite's wall time and coverage come from two more files, each
      // held to --since as vitest's is, and to vitest's own run: a
      // vitest.json of one file run this morning beside the summary of the
      // whole suite run last night would print last night's numbers as this
      // run's.
      const summary = slash(join(path, 'coverage', 'coverage-summary.json'))
      const turbo = `turbo's run summary for ${name}#test:coverage`
      let task = name === null ? undefined : turboTask(root, `${name}#test:coverage`)
      if (task === undefined && name !== null && !local) missing.push(`${turbo} (run it with --summarize)`)
      if (task?.startTime != null && !fresh(turbo, task.startTime)) task = undefined
      if (task?.startTime != null && !(task.startTime <= time(json.startTime) && time(json.startTime) <= task.endTime)) {
        missing.push(`another run's: ${turbo} ran from ${iso(task.startTime)} to ${iso(task.endTime)}, which does not hold its vitest.json's start, ${iso(json.startTime)}`)
        task = undefined
      }
      if (task?.cache === 'HIT') missing.push(`a fresh run of ${name}#test:coverage: turbo replayed it from its cache`)
      let coverage = null
      const written = existsSync(join(root, summary)) ? statSync(join(root, summary)).mtimeMs : undefined
      if (written !== undefined && fresh(summary, written, 'written')) {
        if (written < time(json.startTime)) missing.push(`another run's: ${summary} written ${iso(written)}, before its vitest.json started, ${iso(json.startTime)}`)
        else coverage = readJson(join(root, summary)).total
      }
      const testFiles = testFilesOf(checkout(), path, packages.map((entry) => entry.path))
      suites.push({ package: name, path, ...normaliseSuite(json, root), testFiles, task: task ?? null, coverage })
    },
    install() {
      const file = join(root, 'test-results', 'install.json')
      if (!existsSync(file)) return void missing.push('test-results/install.json')
      const result = readJson(file)
      if (fresh('test-results/install.json', result.startedAt)) install = result
    },
  }

  if (local) {
    for (const entry of packages) read.suite(entry.path, entry.name)
    read.suite('.', null)
    read.install()
  } else {
    READERS[job](read, { pkg, packages })
  }

  const dist = publishedPackages(root).flatMap(({ dir, manifest }) => {
    const files = distOfPackage(dir, manifest)
    return files === undefined || files.size === 0 ? [] : [{ package: manifest.name, distHash: distHash(files) }]
  })

  return {
    schema: 1,
    job: local ? 'local' : job,
    key,
    ...(pkg === undefined ? {} : { package: pkg }),
    ...(variant === undefined ? {} : { variant }),
    runner: runner(env),
    commit: env.GITHUB_SHA ?? git(['rev-parse', 'HEAD']).trim(),
    run: { id: env.GITHUB_RUN_ID ?? null, attempt: env.GITHUB_RUN_ATTEMPT ?? null },
    collectedAt: now().toISOString(),
    // A local run tests the tree as it is, so whether it held uncommitted
    // changes is part of which code ran; a CI checkout is the commit.
    ...(local ? { since: new Date(after).toISOString(), dirty: git(['status', '--porcelain']).trim() !== '' } : {}),
    suites,
    install,
    dist,
    tarballs: install?.tarballs ?? [],
    missing,
  }
}

function defaultGit(args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
}

/** The value after `--name`, or undefined. */
const option = (argv, name) => {
  const at = argv.indexOf(name)
  return at === -1 ? undefined : argv[at + 1]
}

// `node scripts/release-report/collect.mjs ...`
if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/release-report/collect.mjs')) {
  const argv = process.argv.slice(2)
  const local = argv.includes('--local')
  const job = option(argv, '--job')
  if (!local && job === undefined) throw new Error('usage: collect.mjs --job <job> [--package <name>] [--variant <value>], or --local --since <ISO instant>')
  const result = collect({ job, pkg: option(argv, '--package'), variant: option(argv, '--variant'), local, since: option(argv, '--since') })
  const out = resolve(repo, option(argv, '--out') ?? 'release-results')
  const written = join(out, `${result.key}.json`)
  mkdirSync(out, { recursive: true })
  writeFileSync(written, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  if (process.env.GITHUB_OUTPUT !== undefined) appendFileSync(process.env.GITHUB_OUTPUT, `key=${result.key}\n`)
  console.log(`${slash(relative(repo, written))}: ${String(result.suites.length)} suite(s), ${result.install === null ? 'no' : 'the'} install gate's record, ${String(result.dist.length)} dist/${result.missing.length === 0 ? '' : `; missing: ${result.missing.join('; ')}`}`)
}
