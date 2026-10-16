// The report's results (0014; formancy.ai-data 0035): each package's suite,
// the repository's guards, the install gate and its hosts, and the build
// identity of every published package.
//
// Pure over the run's results. Two times are shown for a suite, each named
// for what it is: the task's wall time from turbo's run summary, and vitest's
// span from the first test's start to the last test's end, which leaves out
// collection, hooks and teardown.

const distinct = (values) => [...new Set(values)]

/** A test's status, as the report counts it: anything but passed or failed is skipped, as vitest's pending and todo are. */
const kind = (status) => (status === 'passed' || status === 'failed' ? status : status === 'todo' ? 'todo' : 'skipped')

/** One row per package with a `test:coverage` script, or for the repository's guards. */
function suiteRow(suites, { name, path, published }) {
  if (suites.length === 0) return { package: name, path, published, present: false }
  const files = suites.flatMap((suite) => suite.files)
  const tests = files.flatMap((file) => file.tests.map((test) => ({ ...test, file: file.file })))
  const count = (wanted) => tests.filter((test) => kind(test.status) === wanted).length
  const tasks = suites.map((suite) => suite.task).filter((task) => task != null && task.endTime != null)
  const starts = files.map((file) => file.startTime).filter(Number.isFinite)
  const ends = files.map((file) => file.endTime).filter(Number.isFinite)
  const coverage = suites.find((suite) => suite.coverage != null)?.coverage ?? null
  const pct = (metric) => (coverage?.[metric]?.pct === undefined ? null : coverage[metric].pct)
  const ran = new Set(files.map((file) => file.file))
  return {
    package: name,
    path,
    published,
    present: true,
    jobs: distinct(suites.map((suite) => suite.job)),
    files: files.length,
    tests: tests.length,
    passed: count('passed'),
    failed: count('failed'),
    skipped: count('skipped'),
    todo: count('todo'),
    notPassed: tests.filter((test) => test.status !== 'passed').map((test) => ({ file: test.file, name: test.name, status: test.status })),
    failedFiles: files.filter((file) => file.status === 'failed').map((file) => ({ file: file.file, testsPassed: file.tests.every((test) => test.status === 'passed') })),
    // Whether every results file listed the test files the checkout holds,
    // and those its suite did not run: the include's misses, or a subset run.
    listsTestFiles: suites.every((suite) => Array.isArray(suite.testFiles)),
    notRun: distinct(suites.flatMap((suite) => suite.testFiles ?? []))
      .filter((file) => !ran.has(file))
      .sort(),
    success: suites.every((suite) => suite.success === true),
    numFailedTestSuites: suites.reduce((total, suite) => total + (suite.numFailedTestSuites ?? 0), 0),
    wallMs: tasks.length === 0 ? null : tasks.reduce((total, task) => total + (task.endTime - task.startTime), 0),
    spanMs: starts.length === 0 || ends.length === 0 ? null : Math.max(...ends) - Math.min(...starts),
    coverage: coverage === null ? null : { lines: pct('lines'), branches: pct('branches'), functions: pct('functions'), statements: pct('statements') },
  }
}

/** The suites of the run, each with the key of the results file it came in. */
const suitesOf = (results) => results.flatMap((result) => (result.suites ?? []).map((suite) => ({ ...suite, job: result.key })))

/** The install gate's record in the run: the first results file that holds one, or null. */
export const installOf = (results) => results.map((result) => result.install).find((entry) => entry != null) ?? null

/**
 * One install host as the report shows it: the project, which end of its
 * builder's peer range it was installed at (null for the Node host), the
 * framework it resolved, the tools it was checked with, what it did not
 * finish -- its install, or each step not done -- and whether it finished
 * everything.
 */
function hostOf(consumer) {
  const unfinished = consumer.npmInstalled === true ? (consumer.steps ?? []).filter((step) => step.done !== true).map((step) => step.step) : ['npm install']
  return {
    project: consumer.project,
    consumer: consumer.consumer,
    at: consumer.at ?? null,
    installed: consumer.installed ?? {},
    tools: consumer.tools ?? {},
    unfinished,
    passed: unfinished.length === 0,
  }
}

/** Every package's row, the repository's guards, the install gate, what collect missed, and build identity. */
export function resultsInRun({ results, covered, published }) {
  const suites = suitesOf(results)
  const install = installOf(results)
  return {
    packages: covered.map((entry) => suiteRow(suites.filter((suite) => suite.package === entry.name), { ...entry, published: published.includes(entry.name) })),
    repository: suiteRow(suites.filter((suite) => suite.package === null), { name: null, path: '.', published: false }),
    install:
      install === null
        ? null
        : { passed: install.passed === true, error: install.error ?? null, node: install.node, npm: install.npm, resolved: install.resolved ?? [], tarballs: install.tarballs ?? [], hosts: (install.consumers ?? []).map(hostOf) },
    missing: results.flatMap((result) => (result.missing ?? []).map((what) => ({ job: result.key, what }))),
    buildIdentity: published.map((name) => {
      const builds = results.flatMap((result) => (result.dist ?? []).filter((entry) => entry.package === name).map((entry) => ({ job: result.key, distHash: entry.distHash })))
      const tarball = (install?.tarballs ?? []).find((entry) => entry.name === name) ?? null
      const hashes = distinct([...builds.map((build) => build.distHash), ...(tarball === null ? [] : [tarball.distHash])])
      return { package: name, tarball: tarball === null ? null : { file: tarball.file, sha256: tarball.sha256, distHash: tarball.distHash }, builds, identical: hashes.length <= 1 }
    }),
  }
}

/**
 * What the run says of one test file: `passed` when it appears with at least
 * one test, every test passed and the file passed; `absent` when it does not
 * appear; `failed` otherwise. How a gate's file evidence and a limitation's
 * `heldBy` are judged.
 */
export function fileOutcome(results, file) {
  const found = results.flatMap((result) => (result.suites ?? []).flatMap((suite) => suite.files.filter((entry) => entry.file === file)))
  if (found.length === 0) return 'absent'
  const passed = found.every((entry) => entry.status === 'passed' && entry.tests.length > 0 && entry.tests.every((test) => test.status === 'passed'))
  return passed ? 'passed' : 'failed'
}

/**
 * A test file, by its name, as vitest's default include names one. Not any
 * suite's own include, which is what this is held against: a file this
 * names that its suite did not run is a problem of the run, whether the
 * include missed it or the run was a subset.
 */
export const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/

/** The suite that runs `file`: the path of the package with a suite it is in (`covered` holds their paths), or '.', the repository's guards. */
export const suiteOwning = (file, covered) => covered.find((path) => file.startsWith(`${path}/`)) ?? '.'

/** The test files among `files` -- repository paths, as git lists them -- that the suite at `path` must run, sorted. */
export const testFilesOf = (files, path, covered) => files.filter((file) => TEST_FILE.test(file) && suiteOwning(file, covered) === path).sort()

/**
 * Whether `file` is a test a run can report on: a test file of a package
 * with a suite, or of the repository's guards, which live in `scripts/`
 * (vitest.repo.config.mts), and a file this checkout has (`exists`). What a
 * gate's file evidence and a limitation's `heldBy` may name. That its
 * suite's include matches it is held by every run, which fails on a test
 * file its suite did not run.
 */
export const isRunTest = (file, { covered, exists }) => TEST_FILE.test(file) && (suiteOwning(file, covered) !== '.' || file.startsWith('scripts/')) && exists(file)
