// The report's results (0014; formancy.ai-data 0035): each package's suite,
// the repository's guards, each app's browser gate in each browser and its
// pictures' check, the install gate and its hosts, the e-invoice gate, and
// the build identity of every published package.
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

/** The e-invoice gate's record in the run: the first results file that holds one, or null. */
export const eInvoiceOf = (results) => results.map((result) => result.eInvoice).find((entry) => entry != null) ?? null

/** The container gate's record in the run: the first results file that holds one, or null. */
export const containerOf = (results) => results.map((result) => result.container).find((entry) => entry != null) ?? null

/** The container gate as the report shows it (0046): whether it passed, the image it built -- the gate's, never a published one -- and each check it made. */
function containerRow(gate) {
  return {
    passed: gate.passed === true,
    error: gate.error ?? null,
    docker: gate.docker ?? null,
    image: gate.image ?? null,
    measured: gate.measured ?? {},
    checks: (gate.checks ?? []).map((check) => ({ name: String(check.name), passed: check.passed === true, said: check.said ?? null })),
  }
}

/**
 * The e-invoice gate as the report shows and judges it: the Java and the
 * tools it ran, and each file of its corpus, a sample, a variant or a
 * control, XML or PDF, with what the corpus expects of it and each tool's
 * verdict on it, null where the gate recorded none.
 */
function eInvoiceRow(gate) {
  const verdict = (rows, file) => (rows ?? []).find((row) => row.file === file)?.verdict ?? null
  return {
    passed: gate.passed === true,
    problems: gate.problems ?? [],
    java: gate.java ?? null,
    tools: gate.tools ?? [],
    files: (gate.corpus ?? []).map((entry) => ({
      file: entry.file,
      kind: entry.from !== undefined ? 'control' : entry.variant !== undefined ? 'variant' : 'sample',
      format: entry.format ?? null,
      expect: entry.expect ?? {},
      mustang: verdict(gate.mustang, entry.file),
      kosit: verdict(gate.kosit, entry.file),
      verapdf: verdict(gate.verapdf, entry.file),
    })),
    seconds: gate.seconds ?? null,
  }
}

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

const wall = (entry) => Date.parse(entry.finishedAt) - Date.parse(entry.startedAt)

/** One browser gate's run in one browser, as the report shows and judges it. */
function gateRow(gate, job) {
  return {
    gate: gate.gate,
    asked: gate.asked ?? null,
    job,
    ok: gate.checks?.ok ?? 0,
    failed: gate.checks?.failed ?? [],
    error: gate.error ?? null,
    widths: gate.widths ?? [],
    planned: gate.planned ?? [],
    passes: gate.passes ?? 0,
    made: (gate.made ?? []).map((entry) => ({ label: entry.label, width: entry.width, checks: entry.checks ?? [] })),
    browser: gate.browser ?? null,
    playwright: gate.playwright ?? null,
    axe: gate.axe ?? null,
    wallMs: wall(gate),
  }
}

/**
 * One app's pictures' check, as the report shows and judges it: `planned`
 * is every scene scripts/pictures/scenes.json gives the app, which the
 * report reads itself rather than take the check's word for.
 */
function picturesRow(check, job, planned) {
  return {
    app: check.app,
    job,
    planned: [...planned],
    walked: check.walked ?? [],
    problems: check.problems ?? [],
    error: check.error ?? null,
    browser: check.browser ?? null,
    playwright: check.playwright ?? null,
    wallMs: wall(check),
  }
}

/**
 * What a browser gate's row says it did not do, which a gate that measured
 * everything it set out to does: make a check, make one in a pass at a
 * viewport width, make every pass it planned, and make a check in each pass
 * it made. The gate walks one journey at every width, so a planned pass not
 * made, or made with nothing checked in it, is every check of that width
 * skipped. Each a phrase; none for a gate that did all four. problems.mjs
 * fails a run on each and gates.mjs a gate's evidence, so the two cannot
 * disagree. What the gate planned is its own word: its passes come from the
 * app's stylesheets, read by the app's gate, and only it can say them.
 */
export function unmeasured(row) {
  const made = new Set(row.made.map((entry) => entry.label))
  const skipped = row.planned.filter((label) => !made.has(label))
  const empty = row.made.filter((entry) => entry.width !== null && entry.checks.length === 0).map((entry) => `"${String(entry.label)}"`)
  return [
    ...(row.ok + row.failed.length === 0 ? ['made no check'] : []),
    ...(row.passes === 0 ? ['made no pass at a viewport width'] : []),
    ...(row.planned.length === 0 ? ['planned no pass'] : []),
    ...(skipped.length === 0 ? [] : [`did not make ${String(skipped.length)} of the ${String(row.planned.length)} passes it planned: ${skipped.map((label) => `"${label}"`).join(', ')}`]),
    ...(empty.length === 0 ? [] : [`made no check in ${empty.length === 1 ? 'the pass' : 'the passes'} ${empty.join(', ')}`]),
  ]
}

/** The scenes of scenes.json a pictures' check was to walk and did not: each a picture held by nobody in this run. */
export const unwalked = (row) => row.planned.filter((id) => !row.walked.includes(id))

/**
 * Every package's row, the repository's guards, the browser gates, the
 * pictures' checks -- each held to `scenes`, scenes.json's scene ids by app
 * path -- the install gate, the e-invoice gate, the container gate, what collect did not find (`absent`, by the
 * reader that expected it) or found and refused (`missing`), and build
 * identity.
 */
export function resultsInRun({ results, covered, published, scenes = {} }) {
  const suites = suitesOf(results)
  const install = installOf(results)
  const eInvoice = eInvoiceOf(results)
  const container = containerOf(results)
  return {
    packages: covered.map((entry) => suiteRow(suites.filter((suite) => suite.package === entry.name), { ...entry, published: published.includes(entry.name) })),
    repository: suiteRow(suites.filter((suite) => suite.package === null), { name: null, path: '.', published: false }),
    browserGates: results.flatMap((result) => (result.browserGates ?? []).map((gate) => gateRow(gate, result.key))),
    pictures: results.flatMap((result) => (result.pictures ?? []).map((check) => picturesRow(check, result.key, scenes[check.app] ?? []))),
    install:
      install === null
        ? null
        : { passed: install.passed === true, error: install.error ?? null, node: install.node, npm: install.npm, resolved: install.resolved ?? [], tarballs: install.tarballs ?? [], hosts: (install.consumers ?? []).map(hostOf) },
    eInvoice: eInvoice === null ? null : eInvoiceRow(eInvoice),
    container: container === null ? null : containerRow(container),
    absent: results.flatMap((result) => (result.absent ?? []).map(({ reader, file }) => ({ job: result.key, reader, file }))),
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
 * What the run says of `app`'s browser gate, as gate evidence: `failed` when
 * it failed a check, ended in an error or did not do what unmeasured() asks
 * in any browser it ran in; `passed` when it ran in every one of `browsers`
 * and did not; `absent`, with the browsers it is `missing` in, otherwise.
 */
export function gateOutcome(rows, app, browsers) {
  const ran = rows.filter((row) => row.gate === app)
  if (ran.some((row) => row.error !== null || row.failed.length > 0 || unmeasured(row).length > 0)) return { outcome: 'failed' }
  const missing = browsers.filter((browser) => !ran.some((row) => row.asked === browser))
  return missing.length === 0 ? { outcome: 'passed' } : { outcome: 'absent', missing }
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
