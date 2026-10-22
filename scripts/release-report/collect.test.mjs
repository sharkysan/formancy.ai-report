import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'
import { collect, keyFor } from './collect.mjs'

/**
 * collect.mjs over a workspace this file writes in a temporary directory:
 * two packages, one of them packed from its dist/ as the Angular builder is,
 * and the files each suite and the install gate leave. git is a function that
 * answers what a machine would -- collect asks it for the commit, nothing a
 * test here is about.
 */
let roots = []
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
  roots = []
})

const T0 = Date.parse('2026-10-16T10:00:00Z')
const at = (minutes) => new Date(T0 + minutes * 60_000).toISOString()

function put(root, path, value) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value))
}

/** A vitest JSON report of one passing test in `file`, started at T0. */
const vitest = (root, file) => ({
  success: true,
  numTotalTests: 1,
  numPassedTests: 1,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  numFailedTestSuites: 0,
  startTime: T0,
  testResults: [
    {
      name: join(root, file),
      status: 'passed',
      startTime: T0 + 1000,
      endTime: T0 + 2000,
      assertionResults: [{ fullName: 'reads a report', status: 'passed', duration: 1000, meta: { anything: 'a test chose' } }],
    },
  ],
  coverageMap: { 'packages/report-spec/src/version.ts': { s: { 0: 1 } } },
})

/** A workspace: report-spec (published), report-builder-angular (published from dist/) and report-corpus (private), with what a run of each left. */
function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'formancy-report-collect-'))
  roots.push(root)
  put(root, 'packages/report-spec/package.json', { name: '@formancy/report-spec', scripts: { 'test:coverage': 'vitest run --coverage' } })
  put(root, 'packages/report-spec/dist/index.mjs', 'export {}\n')
  put(root, 'packages/report-spec/test-results/vitest.json', vitest(root, 'packages/report-spec/src/version.test.ts'))
  put(root, 'packages/report-spec/coverage/coverage-summary.json', { total: { lines: { pct: 100 } }, 'src/version.ts': {} })
  // Written as the suite ends, whatever this machine's clock says today.
  utimesSync(join(root, 'packages/report-spec/coverage/coverage-summary.json'), new Date(T0 + 3000), new Date(T0 + 3000))
  put(root, 'packages/report-builder-angular/package.json', { name: '@formancy/report-builder-angular', publishConfig: { directory: 'dist' }, scripts: { 'test:coverage': 'vitest run --coverage' } })
  put(root, 'packages/report-builder-angular/dist/fesm2022/a.mjs', 'export const a = 1\n')
  put(root, 'packages/report-builder-angular/dist/package.json', '{"name":"@formancy/report-builder-angular"}')
  put(root, 'packages/report-corpus/package.json', { name: '@formancy/report-corpus', private: true, scripts: { 'test:coverage': 'vitest run --coverage' } })
  put(root, 'packages/report-corpus/dist/index.mjs', 'export {}\n')
  put(root, 'test-results/vitest.json', vitest(root, 'scripts/check-cla.test.mjs'))
  put(root, 'test-results/install.json', { startedAt: at(20), finishedAt: at(25), passed: true, node: 'v22.20.0', npm: '10.9.0', resolved: [], tarballs: [], consumers: [] })
  put(root, 'test-results/e-invoice.json', { gate: 'e-invoice', startedAt: at(40), finishedAt: at(41), java: { version: '17.0.20.1', major: 17 }, tools: [], corpus: [], mustang: [], kosit: [], problems: [], passed: true })
  put(root, 'test-results/container.json', { gate: 'container', startedAt: at(50), finishedAt: at(52), passed: true, error: null, docker: '28.3.3 linux/amd64', image: { tag: 'formancy/report-server:gate', id: 'sha256:e0', size: 192204806, node: 'v26.12.1', user: 'node' }, measured: {}, planned: ['it runs as node'], checks: [{ name: 'it runs as node', passed: true, said: null }] })
  put(root, '.turbo/runs/one.json', { execution: { startTime: T0 - 5000 }, tasks: [{ taskId: '@formancy/report-spec#test:coverage', execution: { startTime: T0 - 4000, endTime: T0 + 9000 }, cache: { status: 'MISS' } }] })
  return root
}

const machine = {
  env: { GITHUB_SHA: 'abc123', GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1', ImageOS: 'ubuntu24', ImageVersion: '20261012.1' },
  git: () => 'abc123\n',
  now: () => new Date(T0 + 50 * 60_000),
}

describe('a job’s key', () => {
  // The artefact is named release-results-<key>, and the report expects one
  // per package with a suite, keyed as codecov-config.mjs keys it. A name
  // the report cannot match is a missing package to it; a matrix value is
  // how a job run more than once -- the Studio's browser legs -- keeps one
  // key each.
  test('is test-<id> for a package’s suite, and carries a matrix value', () => {
    const covered = [{ path: 'packages/report-spec', id: 'report-spec', name: '@formancy/report-spec' }]
    expect(keyFor({ job: 'test', pkg: '@formancy/report-spec' }, covered)).toBe('test-report-spec')
    expect(keyFor({ job: 'browser', variant: 'chromium' }, covered)).toBe('browser-chromium')
    expect(keyFor({ job: 'verify' }, covered)).toBe('verify')
    expect(() => keyFor({ job: 'test', pkg: '@formancy/nothing' }, covered)).toThrow(/no workspace package/)
  })
})

describe('a test job’s results', () => {
  // The report counts what the suite ran. The coverage map is megabytes
  // nobody reads, and a test's meta is whatever a test chose to put there:
  // neither belongs in an artefact the report reads.
  test('keep the suite, its task and its coverage, and drop the coverage map and the meta', () => {
    const root = workspace()
    const result = collect({ root, job: 'test', pkg: '@formancy/report-spec', ...machine })
    expect(result).toMatchObject({ schema: 1, job: 'test', key: 'test-report-spec', package: '@formancy/report-spec', commit: 'abc123', run: { id: '42', attempt: '1' }, missing: [] })
    expect(result.runner).toMatchObject({ image: 'ubuntu24', imageVersion: '20261012.1' })
    const [suite] = result.suites
    expect(suite).not.toHaveProperty('coverageMap')
    expect(suite.files).toEqual([{ file: 'packages/report-spec/src/version.test.ts', status: 'passed', startTime: T0 + 1000, endTime: T0 + 2000, tests: [{ name: 'reads a report', status: 'passed', durationMs: 1000 }] }])
    expect(suite.task).toEqual({ startTime: T0 - 4000, endTime: T0 + 9000, cache: 'MISS' })
    expect(suite.coverage).toEqual({ lines: { pct: 100 } })
  })

  // Every published package's dist/ the job built, so the report can hold
  // the tarball npm receives to every build; a private package is nobody's
  // tarball. The Angular builder is packed from its dist/, whose manifest
  // pnpm rewrites on the way: hashed whole, its dist/ would never equal its
  // tarball's.
  test('record the dist/ of every published package, as its tarball carries it', () => {
    const result = collect({ root: workspace(), job: 'test', pkg: '@formancy/report-spec', ...machine })
    expect(result.dist.map((entry) => entry.package)).toEqual(['@formancy/report-builder-angular', '@formancy/report-spec'])
    const angular = collect({ root: workspace(), job: 'verify', ...machine }).dist[0].distHash
    const root = workspace()
    put(root, 'packages/report-builder-angular/dist/package.json', '{"name":"@formancy/report-builder-angular","version":"0.1.0"}')
    expect(collect({ root, job: 'verify', ...machine }).dist[0].distHash).toBe(angular)
    put(root, 'packages/report-builder-angular/dist/fesm2022/a.mjs', 'export const a = 2\n')
    expect(collect({ root, job: 'verify', ...machine }).dist[0].distHash).not.toBe(angular)
  })

  // A suite replayed from turbo's cache ran on another commit, or nowhere;
  // one without a summary has no wall time.
  test('list a task turbo replayed, and a run summary that is not there', () => {
    const root = workspace()
    put(root, '.turbo/runs/one.json', { execution: { startTime: T0 }, tasks: [{ taskId: '@formancy/report-spec#test:coverage', execution: { startTime: T0, endTime: T0 + 10 }, cache: { status: 'HIT' } }] })
    expect(collect({ root, job: 'test', pkg: '@formancy/report-spec', ...machine }).missing).toEqual(['a fresh run of @formancy/report-spec#test:coverage: turbo replayed it from its cache'])
    rmSync(join(root, '.turbo'), { recursive: true })
    expect(collect({ root, job: 'test', pkg: '@formancy/report-spec', ...machine }).missing).toEqual(["turbo's run summary for @formancy/report-spec#test:coverage (run it with --summarize)"])
  })

  // The report can only say a file did not run if it knows the file is
  // there. A file renamed past its package's vitest include, an include
  // narrowed, or one file run after the whole suite would otherwise leave a
  // suite that ran part of its tests reported as whole. So each suite
  // carries the test files the checkout holds for it, by name and not by
  // its include, which is what is on trial: everything git has, committed
  // or new, under the package -- the rest belongs to the guards.
  test('carry every test file the checkout holds for the suite, whatever its include matches', () => {
    const root = workspace()
    const files = [
      'packages/report-spec/src/version.test.ts',
      'packages/report-spec/src/page.test.tsx',
      'packages/report-spec/src/page.ts',
      'packages/report-corpus/src/checks.test.ts',
      'scripts/check-cla.test.mjs',
      'docs/stray.test.mjs',
      'packages/report-spec/src/deleted.test.ts',
    ]
    for (const file of files.filter((entry) => !entry.includes('deleted'))) put(root, file, '')
    const git = (args) => (args[0] === 'ls-files' ? `${files.join('\0')}\0` : 'abc123\n')
    expect(collect({ root, job: 'test', pkg: '@formancy/report-spec', ...machine, git }).suites[0].testFiles).toEqual(['packages/report-spec/src/page.test.tsx', 'packages/report-spec/src/version.test.ts'])
    expect(collect({ root, job: 'verify', ...machine, git }).suites[0].testFiles).toEqual(['docs/stray.test.mjs', 'scripts/check-cla.test.mjs'])
  })

  // In CI as on a machine, a suite's row is one run's: coverage written
  // before its vitest.json started, or a turbo task that ended before it or
  // began after it, is another run's -- yesterday's full suite beside
  // today's one file -- and its numbers would be printed as this run's.
  test('refuse a coverage summary or a turbo task from another run than its vitest.json', () => {
    const root = workspace()
    utimesSync(join(root, 'packages/report-spec/coverage/coverage-summary.json'), new Date(T0 - 1000), new Date(T0 - 1000))
    put(root, '.turbo/runs/one.json', { execution: { startTime: T0 + 500 }, tasks: [{ taskId: '@formancy/report-spec#test:coverage', execution: { startTime: T0 + 500, endTime: T0 + 9000 }, cache: { status: 'MISS' } }] })
    const result = collect({ root, job: 'test', pkg: '@formancy/report-spec', ...machine })
    expect(result.suites.map((suite) => [suite.task, suite.coverage])).toEqual([[null, null]])
    expect(result.missing).toEqual([
      `another run's: turbo's run summary for @formancy/report-spec#test:coverage ran from ${new Date(T0 + 500).toISOString()} to ${new Date(T0 + 9000).toISOString()}, which does not hold its vitest.json's start, ${at(0)}`,
      `another run's: packages/report-spec/coverage/coverage-summary.json written ${new Date(T0 - 1000).toISOString()}, before its vitest.json started, ${at(0)}`,
    ])
    // A task that had ended before vitest started ran some other vitest.
    put(root, '.turbo/runs/one.json', { execution: { startTime: T0 - 9000 }, tasks: [{ taskId: '@formancy/report-spec#test:coverage', execution: { startTime: T0 - 9000, endTime: T0 - 1000 }, cache: { status: 'MISS' } }] })
    expect(collect({ root, job: 'test', pkg: '@formancy/report-spec', ...machine }).suites[0].task).toBeNull()
  })

  // A suite that never wrote its file -- the install failed, the suite
  // crashed -- is listed, so the report says what is missing rather than
  // that the package has no tests.
  test('list a suite that left no results', () => {
    const root = workspace()
    rmSync(join(root, 'packages/report-spec/test-results'), { recursive: true })
    expect(collect({ root, job: 'test', pkg: '@formancy/report-spec', ...machine })).toMatchObject({ suites: [], absent: [{ reader: 'test', file: 'packages/report-spec/test-results/vitest.json' }], missing: [] })
  })
})

describe('the verify and install jobs’ results', () => {
  // verify runs the repository's guards, whose suite is the root's; the
  // install gate leaves its record and the tarballs it packed.
  test('keep the repository guards’ suite, and the install gate’s record', () => {
    const root = workspace()
    expect(collect({ root, job: 'verify', ...machine }).suites.map((suite) => [suite.package, suite.path, suite.files[0].file])).toEqual([[null, '.', 'scripts/check-cla.test.mjs']])
    const install = collect({ root, job: 'install', ...machine })
    expect(install).toMatchObject({ key: 'install', suites: [], install: { passed: true, npm: '10.9.0' }, tarballs: [], absent: [], missing: [] })
    rmSync(join(root, 'test-results/install.json'))
    expect(collect({ root, job: 'install', ...machine })).toMatchObject({ install: null, absent: [{ reader: 'install', file: 'test-results/install.json' }], missing: [] })
  })

  // A job gates.yml gains -- the getting-started guide's, one day -- needs a
  // reader here before it can say anything; collecting nothing for it would
  // upload results that look like a job with nothing to report.
  test('refuse a job it has no reader for', () => {
    expect(() => collect({ root: workspace(), job: 'getting-started', ...machine })).toThrow(
      'collect.mjs reads the verify, test, browser, install, e-invoice and container jobs, and has no reader for getting-started: a job the report expects results from needs one here',
    )
  })
})

describe('the e-invoice job’s results', () => {
  // The e-invoice gate writes its own results file however its run ends,
  // and the report judges the gate from it; the job's results carry it
  // under the job's own key. A gate that never wrote it -- the build failed
  // before it ran -- is listed, so the report says what is missing rather
  // than that there was nothing to judge.
  test('keep the gate’s record, and list it when it left none', () => {
    const root = workspace()
    expect(collect({ root, job: 'e-invoice', ...machine })).toMatchObject({ key: 'e-invoice', job: 'e-invoice', suites: [], install: null, eInvoice: { passed: true, java: { major: 17 } }, absent: [], missing: [] })
    rmSync(join(root, 'test-results/e-invoice.json'))
    expect(collect({ root, job: 'e-invoice', ...machine })).toMatchObject({ eInvoice: null, absent: [{ reader: 'e-invoice', file: 'test-results/e-invoice.json' }], missing: [] })
  })

  // On a machine the file is whatever the gate's last run left.
  test('are read on a machine too, and refused from before --since', () => {
    expect(collect({ root: workspace(), local: true, since: at(-1), ...machine, env: {} }).eInvoice).toMatchObject({ passed: true })
    const stale = collect({ root: workspace(), local: true, since: at(45), ...machine, env: {} })
    expect(stale.eInvoice).toBeNull()
    expect(stale.missing).toContain(`stale: test-results/e-invoice.json started ${at(40)}, before --since`)
  })
})

describe('the container job’s results', () => {
  // The container gate writes its own record however its run ends, and the
  // report judges the gate and the image it built from it; the job's
  // results carry it under the job's own key. A gate that never wrote it --
  // the runner had no Docker -- is listed, so the report says what is
  // missing rather than that there was nothing to judge (0046).
  test('keep the gate’s record, and list it when it left none', () => {
    const root = workspace()
    expect(collect({ root, job: 'container', ...machine })).toMatchObject({ key: 'container', job: 'container', suites: [], install: null, eInvoice: null, container: { passed: true, image: { node: 'v26.12.1', user: 'node' } }, absent: [], missing: [] })
    rmSync(join(root, 'test-results/container.json'))
    expect(collect({ root, job: 'container', ...machine })).toMatchObject({ container: null, absent: [{ reader: 'container', file: 'test-results/container.json' }], missing: [] })
  })

  // On a machine the file is whatever the gate's last run left.
  test('are read on a machine too, and refused from before --since', () => {
    expect(collect({ root: workspace(), local: true, since: at(-1), ...machine, env: {} }).container).toMatchObject({ passed: true })
    const stale = collect({ root: workspace(), local: true, since: at(51), ...machine, env: {} })
    expect(stale.container).toBeNull()
    expect(stale.missing).toContain(`stale: test-results/container.json started ${at(50)}, before --since`)
  })
})

/** The Studio, with a browser gate and pictures, and the file each wrote: its gate in Chromium, and its pictures' check. */
function withStudio(root) {
  put(root, 'apps/studio/package.json', { name: '@formancy/report-studio', private: true, scripts: { 'test:browser': 'node scripts/browser-test.mjs', 'test:pictures': 'node scripts/pictures.mjs --check' } })
  const gate = { gate: 'apps/studio', asked: 'chromium', startedAt: at(30), finishedAt: at(33), browser: { name: 'chromium', version: '156.0.8078.4', headless: true }, playwright: '1.64.1', planned: ['phone, 360'], passes: 1, made: [], checks: { ok: 3, failed: [] } }
  put(root, 'apps/studio/test-results/browser-chromium.json', gate)
  put(root, 'apps/studio/test-results/pictures.json', { check: 'pictures', app: 'apps/studio', startedAt: at(34), finishedAt: at(35), planned: ['studio-react'], walked: ['studio-react'], problems: [] })
  return root
}

describe('the browser job’s results', () => {
  // The browser job runs every app's gate and pictures' check; the report
  // judges each from the file it wrote, so the job's results carry them,
  // under one key, `browser`, which gates.yml's collect step gives.
  test('keep each app’s gate in every browser the gates run in, and its pictures’ check', () => {
    const result = collect({ root: withStudio(workspace()), job: 'browser', ...machine })
    expect(result).toMatchObject({ key: 'browser', job: 'browser', suites: [], install: null, absent: [], missing: [] })
    expect(result.browserGates.map((gate) => [gate.gate, gate.asked, gate.browser.version, gate.planned])).toEqual([['apps/studio', 'chromium', '156.0.8078.4', ['phone, 360']]])
    expect(result.pictures.map((check) => [check.app, check.walked])).toEqual([['apps/studio', ['studio-react']]])
    // The job builds what the Studio imports, so its dist/ is held to every other job's.
    expect(result.dist.map((entry) => entry.package)).toEqual(['@formancy/report-builder-angular', '@formancy/report-spec'])
  })

  // A gate that left nothing -- the build failed before it wrote, or a
  // browser was added to scripts/browsers.mjs that the gate does not run --
  // and a pictures' check that left nothing are listed, so the report says
  // what is missing rather than that the app has no gate.
  test('list a gate in a browser, or a pictures’ check, that left no results', () => {
    const root = withStudio(workspace())
    rmSync(join(root, 'apps/studio/test-results/pictures.json'))
    expect(collect({ root, job: 'browser', browsers: ['chromium', 'firefox'], ...machine }).absent).toEqual([
      { reader: 'browser', file: 'apps/studio/test-results/browser-firefox.json' },
      { reader: 'browser', file: 'apps/studio/test-results/pictures.json' },
    ])
  })

  // A file filed under one browser and written by another browser's run, or
  // by a run that launched another, would be that browser's checks reported
  // as this one's.
  test('refuse a gate’s file whose browser, asked for or launched, is not the one it is filed under', () => {
    const root = withStudio(workspace())
    const file = 'apps/studio/test-results/browser-chromium.json'
    put(root, file, { gate: 'apps/studio', asked: 'firefox', startedAt: at(30), browser: null })
    expect(collect({ root, job: 'browser', ...machine })).toMatchObject({ browserGates: [], missing: [`apps/studio’s gate asked for firefox in its chromium file: ${file}`] })
    put(root, file, { gate: 'apps/studio', asked: 'chromium', startedAt: at(30), browser: { name: 'webkit', version: '27.2' } })
    expect(collect({ root, job: 'browser', ...machine })).toMatchObject({ browserGates: [], missing: [`apps/studio’s gate launched webkit in its chromium file: ${file}`] })
  })

  // On a machine, the gate's file is whatever its last run left: yesterday's
  // green gate read as today's would report checks nobody made.
  test('are read on a machine too, and refused from before --since', () => {
    const fresh = collect({ root: withStudio(workspace()), local: true, since: at(-1), ...machine, env: {} })
    expect([fresh.browserGates.length, fresh.pictures.length]).toEqual([1, 1])
    const stale = collect({ root: withStudio(workspace()), local: true, since: at(34), ...machine, env: {} })
    expect([stale.browserGates.length, stale.pictures.length]).toEqual([0, 1])
    expect(stale.missing).toEqual(expect.arrayContaining([`stale: apps/studio/test-results/browser-chromium.json started ${at(30)}, before --since`]))
  })
})

describe('local results', () => {
  // On one machine every file is whatever the last run left. A suite from
  // yesterday read as today's would report tests nobody ran.
  test('refuse a file that started before --since, and say so', () => {
    const root = workspace()
    const result = collect({ root, local: true, since: at(10), ...machine, env: {} })
    expect(result.suites).toEqual([])
    expect(result.install).toMatchObject({ passed: true })
    expect(result.missing).toEqual(expect.arrayContaining([`stale: packages/report-spec/test-results/vitest.json started ${at(0)}, before --since`, `stale: test-results/vitest.json started ${at(0)}, before --since`]))
    expect(collect({ root, local: true, since: at(21), ...machine, env: {} }).missing).toEqual(expect.arrayContaining([`stale: test-results/install.json started ${at(20)}, before --since`]))
  })

  // Every package with a suite is expected, so a suite not run is named.
  test('expect every package with a suite, the repository’s guards and the install gate', () => {
    const result = collect({ root: workspace(), local: true, since: at(-1), ...machine, env: {} })
    expect(result.suites.map((suite) => suite.path)).toEqual(['packages/report-spec', '.'])
    expect(result.absent).toEqual([
      { reader: 'test', file: 'packages/report-builder-angular/test-results/vitest.json' },
      { reader: 'test', file: 'packages/report-corpus/test-results/vitest.json' },
    ])
  })

  // A local report may allow verify, browser or install missing, as its
  // banner says; it can only tell which file is whose when each is filed
  // under the reader that expected it. Without that, a gate not run on the
  // machine fails the report that says it allowed it -- and with the reader
  // taken from the file's path, a file renamed would fall to another reader.
  // A file of an allowed reader that is there but stale is still refused.
  test('file each file not found under the reader that expected it, and refuse a stale one however it is allowed', () => {
    const root = withStudio(workspace())
    for (const file of ['test-results/vitest.json', 'test-results/install.json', 'test-results/container.json', 'apps/studio/test-results/browser-chromium.json', 'apps/studio/test-results/pictures.json']) rmSync(join(root, file))
    const result = collect({ root, local: true, since: at(-1), ...machine, env: {} })
    expect(result.absent).toEqual([
      { reader: 'test', file: 'packages/report-builder-angular/test-results/vitest.json' },
      { reader: 'test', file: 'packages/report-corpus/test-results/vitest.json' },
      { reader: 'verify', file: 'test-results/vitest.json' },
      { reader: 'browser', file: 'apps/studio/test-results/browser-chromium.json' },
      { reader: 'browser', file: 'apps/studio/test-results/pictures.json' },
      { reader: 'install', file: 'test-results/install.json' },
      { reader: 'container', file: 'test-results/container.json' },
    ])
    expect(result.missing).toEqual([])
    // The gate's file is there, from before --since: refused, not absent.
    const stale = collect({ root: withStudio(workspace()), local: true, since: at(31), ...machine, env: {} })
    expect(stale.absent.map((entry) => entry.reader)).toEqual(['test', 'test'])
    expect(stale.browserGates).toEqual([])
    expect(stale.missing).toContain(`stale: apps/studio/test-results/browser-chromium.json started ${at(30)}, before --since`)
  })

  // A fresh vitest.json beside yesterday's turbo summary and coverage would
  // print yesterday's wall time and coverage as this run's: every file a
  // suite's row is built from is held to --since, not only the first.
  test('refuse a turbo summary or a coverage summary from before --since, and say so', () => {
    const root = workspace()
    const yesterday = T0 - 86_400_000
    put(root, '.turbo/runs/one.json', { execution: { startTime: yesterday }, tasks: [{ taskId: '@formancy/report-spec#test:coverage', execution: { startTime: yesterday, endTime: yesterday + 600_000 }, cache: { status: 'MISS' } }] })
    utimesSync(join(root, 'packages/report-spec/coverage/coverage-summary.json'), new Date(yesterday), new Date(yesterday))
    const result = collect({ root, local: true, since: at(-1), ...machine, env: {} })
    expect(result.suites.filter((suite) => suite.path === 'packages/report-spec').map((suite) => [suite.task, suite.coverage])).toEqual([[null, null]])
    expect(result.missing).toEqual(
      expect.arrayContaining([
        `stale: turbo's run summary for @formancy/report-spec#test:coverage started ${new Date(yesterday).toISOString()}, before --since`,
        `stale: packages/report-spec/coverage/coverage-summary.json written ${new Date(yesterday).toISOString()}, before --since`,
      ]),
    )
  })

  // A local run tests whatever the tree holds, committed or not; naming
  // HEAD alone would name code that did not run.
  test('record whether the tree had uncommitted changes', () => {
    const git = (status) => (args) => (args[0] === 'status' ? status : 'abc123\n')
    expect(collect({ root: workspace(), local: true, since: at(-1), ...machine, env: {}, git: git(' M README.md\n') })).toMatchObject({ commit: 'abc123', dirty: true })
    expect(collect({ root: workspace(), local: true, since: at(-1), ...machine, env: {}, git: git('') })).toMatchObject({ commit: 'abc123', dirty: false })
  })

  // Without a time, local mode would have no way to tell a stale file from a fresh one.
  test('need --since', () => {
    expect(() => collect({ root: workspace(), local: true, ...machine })).toThrow(/needs --since/)
  })
})

describe('the command line', () => {
  // `--out` names where the results go. Joined to the checkout rather than
  // resolved against it, an absolute directory would become a directory of
  // that name inside the checkout, a stray tree no ignore rule covers. Run
  // as the jobs run it, on this checkout; the install job reads a file a run
  // may or may not have left, so it writes either way.
  test('writes into an absolute --out, and names the file it wrote', () => {
    const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    const out = mkdtempSync(join(tmpdir(), 'formancy-report-collect-out-'))
    roots.push(out)
    // A step's outputs are the workflow's; this run is not a step of one.
    const { GITHUB_OUTPUT: _, ...env } = process.env
    const printed = execFileSync(process.execPath, [join(repo, 'scripts', 'release-report', 'collect.mjs'), '--job', 'install', '--out', out], { cwd: repo, encoding: 'utf8', env })
    expect(existsSync(join(out, 'install.json'))).toBe(true)
    expect(existsSync(join(repo, out))).toBe(false)
    expect(printed.startsWith(`${relative(repo, join(out, 'install.json')).replaceAll('\\', '/')}: `)).toBe(true)
  })
})
