import { describe, expect, test } from 'vitest'
import { floorOf } from '../install-hosts.mjs'
import { buildReport, installPlanOf } from './report.mjs'
import { ciJob, copy, DIST, greenCiRun, greenRun, job } from './synthetic-run.mjs'
import { published } from './tested-on.mjs'

/**
 * What fails a run (0014; formancy.ai-data 0035), for what the report shows
 * of versions, results, the install gate, build identity, the release gates
 * and the limitations: a run made by hand in which everything passed, and
 * each defect introduced into a copy of it once, giving exactly its
 * sentence. Pure logic over hand-made results files.
 */
const problemsOf = (inputs) => buildReport(inputs).problems

/** `greenRun()` with `change` applied to a copy. */
function withDefect(change) {
  const inputs = copy(greenRun())
  change(inputs)
  return problemsOf(inputs)
}

describe('a green run', () => {
  // A check that is red on good input is noise, and gets switched off.
  test('has no problems', () => {
    expect(problemsOf(greenRun())).toEqual([])
  })
})

describe('a package’s suite', () => {
  // A package whose job left nothing would be a package nobody tested, in a
  // report that said nothing about it.
  test('with no results fails the run', () => {
    expect(withDefect((inputs) => (inputs.results = inputs.results.filter((result) => result.key !== 'test-report-corpus')))).toEqual(['@formancy/report-corpus: no results from its suite'])
  })

  // CLAUDE.md: a suite that can be skipped is a suite that is skipped.
  test('with a skipped test fails the run', () => {
    expect(
      withDefect((inputs) => {
        job(inputs, 'test-report-spec').suites[0].files[0].tests[0].status = 'skipped'
      }),
    ).toEqual(['@formancy/report-spec: 1 test(s) did not run (skipped), and a suite that can be skipped is a suite that is skipped: packages/report-spec/src/hash.test.ts › pins the hash of a fixed report'])
  })

  test('with a failed test fails the run', () => {
    expect(
      withDefect((inputs) => {
        const file = job(inputs, 'test-report-spec').suites[0].files[0]
        file.tests[0].status = 'failed'
        file.status = 'failed'
        job(inputs, 'test-report-spec').suites[0].success = false
      }),
    ).toEqual([
      '@formancy/report-spec: 1 test(s) failed: packages/report-spec/src/hash.test.ts › pins the hash of a fixed report',
      '@formancy/report-spec: packages/report-spec/src/hash.test.ts failed',
      '@formancy/report-spec: vitest reported the run unsuccessful',
    ])
  })

  // An afterAll that threw, or a file that failed to collect, leaves every
  // test it reached passed and the file failed: green counts over a red file.
  test('with a failed file whose tests all passed fails the run', () => {
    expect(
      withDefect((inputs) => {
        job(inputs, 'test-report-spec').suites[0].files[0].status = 'failed'
      }),
    ).toEqual(['@formancy/report-spec: packages/report-spec/src/hash.test.ts failed though every test in it passed: a collection error, or a hook that threw'])
  })

  test('that vitest called unsuccessful, or that ran nothing, fails the run', () => {
    expect(withDefect((inputs) => (job(inputs, 'test-report-spec').suites[0].success = false))).toEqual(['@formancy/report-spec: vitest reported the run unsuccessful'])
    // A package with no test file at all, whose suite passes empty.
    expect(withDefect((inputs) => Object.assign(job(inputs, 'test-report-corpus').suites[0], { files: [], testFiles: [] }))).toEqual(['@formancy/report-corpus: its suite ran no tests'])
  })

  // A suite that ran part of its files passes every test it ran: a file
  // renamed past its package's vitest include, an include narrowed, or one
  // file run after the whole suite. What it is held to is every test file
  // the checkout holds for it, the include's misses among them.
  test('that did not run a test file the checkout holds fails the run', () => {
    expect(
      withDefect((inputs) => {
        const suite = job(inputs, 'test-report-spec').suites[0]
        suite.files = suite.files.filter((entry) => !entry.file.endsWith('validate.test.ts'))
      }),
    ).toEqual(['@formancy/report-spec: 1 test file(s) the checkout holds did not run in its suite: packages/report-spec/src/validate.test.ts'])
    expect(withDefect((inputs) => job(inputs, 'verify').suites[0].testFiles.push('scripts/release-report/stray.test.ts'))).toEqual([
      'the repository guards: 1 test file(s) the checkout holds did not run in its suite: scripts/release-report/stray.test.ts',
    ])
  })

  // Results that do not say what the checkout holds -- written by a collect
  // from before it listed them -- cannot show a file missing.
  test('whose results do not list the checkout’s test files fails the run', () => {
    expect(withDefect((inputs) => delete job(inputs, 'test-report-spec').suites[0].testFiles)).toEqual([
      '@formancy/report-spec: its results do not list the test files the checkout holds, so a file its suite did not run would go unseen',
    ])
  })

  // What collect expected and did not find -- a turbo summary, a stale
  // result in local mode -- is not results at all.
  test('whose job missed a file fails the run', () => {
    expect(withDefect((inputs) => job(inputs, 'test-report-spec').missing.push('packages/report-spec/test-results/vitest.json'))).toEqual([
      'test-report-spec: expected and not found: packages/report-spec/test-results/vitest.json',
    ])
  })
})

describe('a published package', () => {
  // One with no test:coverage script has no suite, so no row, no job and no
  // artefact the report expects -- and it ships all the same.
  test('with no suite fails the run', () => {
    expect(
      withDefect((inputs) => {
        inputs.covered = inputs.covered.filter((entry) => entry.name !== '@formancy/report-builder-react')
        inputs.results = inputs.results.filter((result) => result.key !== 'test-report-builder-react')
        delete inputs.gatesRegister.gates[2].evidence
      }),
    ).toEqual(['@formancy/report-builder-react is published and has no suite: it has no test:coverage script, so no job runs its tests'])
  })
})

describe('the repository’s guards', () => {
  // The verify job's suite is the repository's guards; one that left
  // nothing is a run whose guards nobody ran -- unless a local report says
  // it allowed verify missing.
  test('fail the run when they left no results, unless verify is allowed missing', () => {
    const without = (allowMissing) =>
      withDefect((inputs) => {
        job(inputs, 'verify').suites = []
        inputs.gatesRegister.gates[0].evidence = [{ file: 'packages/report-spec/src/validate.test.ts' }]
        inputs.allowMissing = allowMissing
      })
    expect(without([])).toEqual(['the repository guards: no results from its suite'])
    expect(without(['verify'])).toEqual([])
  })
})

describe('the install gate', () => {
  // The install gate is the only gate that runs the packed packages; a run
  // without its record has not shown that anything published works.
  test('fails the run when it left no results, or did not pass', () => {
    expect(withDefect((inputs) => (job(inputs, 'install').install = null))).toEqual(['the install gate left no results'])
    expect(
      withDefect((inputs) => {
        Object.assign(job(inputs, 'install').install, { passed: false, error: 'react-floor: tsc failed' })
      }),
    ).toEqual(['the install gate did not pass: react-floor: tsc failed'])
  })

  // The gate's `passed` is one flag its writer sets. What it was meant to
  // check is every host scripts/install-hosts.mjs plans: the Node host, and
  // each builder at the newest and the oldest release its peer range admits.
  // A host left out, or one nobody planned, is a claim the report would
  // otherwise print as checked.
  test('fails the run when a planned host has no record, or a recorded host was not planned', () => {
    const consumers = (inputs) => job(inputs, 'install').install.consumers
    expect(withDefect((inputs) => (job(inputs, 'install').install.consumers = consumers(inputs).filter((entry) => entry.project !== 'react-floor')))).toEqual([
      'the install gate has no record of the react-floor host, which scripts/install-hosts.mjs plans',
    ])
    expect(withDefect((inputs) => (job(inputs, 'install').install.consumers = []))).toEqual([
      'the install gate has no record of the node host, which scripts/install-hosts.mjs plans',
      'the install gate has no record of the react host, which scripts/install-hosts.mjs plans',
      'the install gate has no record of the react-floor host, which scripts/install-hosts.mjs plans',
    ])
    expect(withDefect((inputs) => consumers(inputs).push({ ...structuredClone(consumers(inputs)[0]), project: 'vue' }))).toEqual(['the install gate recorded a vue host, which scripts/install-hosts.mjs does not plan'])
  })

  // Each host's steps are what it checked; a step not done is a host that
  // did not check its consumer, whatever the gate's flag says.
  test('fails the run when a host did not finish every step, though the gate says it passed', () => {
    const floor = (inputs) => job(inputs, 'install').install.consumers.find((entry) => entry.project === 'react-floor')
    expect(withDefect((inputs) => (floor(inputs).steps[1].done = false))).toEqual(['the install host react-floor did not finish: run'])
    expect(withDefect((inputs) => (floor(inputs).npmInstalled = false))).toEqual(['the install host react-floor did not finish: npm install'])
  })

  // A builder's host is where the framework it was drawn beside is named. One
  // that resolved none drew nothing; one whose floor is not the range's floor
  // did not test the oldest release the builder says it supports.
  test('fails the run when a builder’s host resolved no framework, or not the floor of its range', () => {
    const host = (inputs, project) => job(inputs, 'install').install.consumers.find((entry) => entry.project === project)
    expect(withDefect((inputs) => (host(inputs, 'react-floor').installed = { react: null }))).toEqual([
      'the install host react-floor resolved no react',
      'the install host react-floor resolved no react-dom',
    ])
    expect(withDefect((inputs) => (host(inputs, 'react').installed.react = null))).toEqual(['the install host react resolved no react'])
    expect(withDefect((inputs) => (host(inputs, 'react-floor').installed.react = '19.0.1'))).toEqual(['the install host react-floor installed react 19.0.1, where the floor of its builder’s peer range is 19.0.0'])
    expect(withDefect((inputs) => (host(inputs, 'react-floor').at = 'newest'))).toEqual(['the install host react-floor was installed at newest, where scripts/install-hosts.mjs plans it at floor'])
  })

  // The plan is install-hosts.mjs's own, from the published manifests; when
  // it cannot be made, no host can be held to it, and the run says so.
  test('fails the run when install-hosts.mjs cannot plan the hosts', () => {
    expect(withDefect((inputs) => (inputs.installPlan = { hosts: [], error: '@formancy/report-builder-react was not packed, so its host has nothing to check' }))).toEqual([
      'scripts/install-hosts.mjs plans no install hosts for the published packages: @formancy/report-builder-react was not packed, so its host has nothing to check',
    ])
  })

  // A local report may say it did not run the install gate; it says so in
  // its banner, and a release refuses a partial report.
  test('is allowed missing locally, and only when the report says so', () => {
    expect(
      withDefect((inputs) => {
        job(inputs, 'install').install = null
        inputs.allowMissing = ['install']
      }),
    ).toEqual([])
  })

  // One tarball per published package is what a release publishes; one
  // missing is a package left behind, one too many a package nobody meant to.
  test('fails the run when it packed other than one tarball per published package', () => {
    expect(withDefect((inputs) => job(inputs, 'install').install.tarballs.pop())).toEqual([
      'the install gate packed @formancy/report-builder-react, @formancy/report-render-pdf, where every published package needs exactly one tarball: @formancy/report-builder-react, @formancy/report-render-pdf, @formancy/report-spec',
    ])
  })
})

describe('build identity', () => {
  // Two jobs with different bytes for one package mean the dist/ a
  // dependent's suite ran is not the one npm receives.
  test('fails the run when two jobs built different dist/ bytes', () => {
    const other = `sha256:${'b'.repeat(64)}`
    expect(
      withDefect((inputs) => {
        job(inputs, 'test-report-render-pdf').dist[0].distHash = other
      }),
    ).toEqual([`@formancy/report-spec: two jobs built different dist/ bytes: verify, test-report-spec, test-report-builder-react, install built ${DIST.slice(0, 19)}; test-report-render-pdf built ${other.slice(0, 19)}`])
  })

  // One number for every package is what a release publishes (bump.mjs); a
  // tarball at another is found on the pull request, not at the tag.
  test('fails the run when a tarball’s version is not the version every package is at', () => {
    expect(
      withDefect((inputs) => {
        job(inputs, 'install').install.tarballs[1].version = '0.2.0'
      }),
    ).toEqual(['the install gate packed @formancy/report-render-pdf 0.2.0, where every published package is at the root manifest’s version, 0.1.0'])
  })

  // A tarball whose package no job recorded building is compared with
  // nothing, and an identity rule that passes on nothing says the published
  // dist/ is a build no job made.
  test('fails the run when no job recorded a published package’s dist/', () => {
    expect(
      withDefect((inputs) => {
        for (const result of inputs.results) result.dist = result.dist.filter((entry) => entry.package !== '@formancy/report-builder-react')
      }),
    ).toEqual(['@formancy/report-builder-react: no job recorded its dist/, so the dist/ in its tarball is compared with nothing'])
  })

  // The tarball is what npm receives; its dist/ must be every job's.
  test('fails the run when a tarball’s dist/ differs from the jobs’', () => {
    expect(
      withDefect((inputs) => {
        job(inputs, 'install').install.tarballs[1].distHash = `sha256:${'c'.repeat(64)}`
      }),
    ).toEqual(['@formancy/report-render-pdf: the dist/ in its tarball differs from the dist/ built in verify, install'])
  })
})

describe('the limitations', () => {
  // A line held by a test is printed with "passed in this run"; when that
  // test failed, the line may no longer hold, and the run says so.
  test('fail the run when the test a line is held by did not pass', () => {
    expect(
      withDefect((inputs) => {
        const held = job(inputs, 'test-report-render-pdf').suites[0].files[1]
        held.tests[0].status = 'failed'
        held.status = 'failed'
      }),
    ).toContain('0011\'s "One font: a character Roboto has no glyph for is refused." is held by packages/report-render-pdf/src/glyphs.test.ts, which did not pass in this run')
  })

  // The register is read every run; one that does not hold is a report of
  // limitations nobody can trust.
  test('fail the run when the register does not hold', () => {
    expect(withDefect((inputs) => (inputs.records[0].hash = 'sha256:12'))).toEqual([
      'docs/release/limitations.json: 0011 changed since it was read: read it again, then run node scripts/release-report/limitations.mjs --stamp 0011',
    ])
  })
})

describe('the install plan', () => {
  // The hosts a run is held to are the ones the install gate plans, from the
  // same manifests: a second list of them here would drift from it.
  test('is install-hosts.mjs’s, each builder at the newest and the floor of its peer ranges', () => {
    const manifests = new Map(published().map(({ manifest }) => [manifest.name, manifest]))
    const plan = installPlanOf(manifests)
    expect(plan.error).toBeNull()
    expect(plan.hosts.map((host) => [host.project, host.at])).toEqual([
      ['node', null],
      ['react', 'newest'],
      ['react-floor', 'floor'],
      ['angular', 'newest'],
      ['angular-floor', 'floor'],
    ])
    const react = manifests.get('@formancy/report-builder-react').peerDependencies
    expect(plan.hosts.find((host) => host.project === 'react').peers).toEqual(react)
    expect(plan.hosts.find((host) => host.project === 'react-floor').peers).toEqual(Object.fromEntries(Object.entries(react).map(([name, range]) => [name, floorOf(range)])))
    expect(installPlanOf(new Map())).toEqual({ hosts: [], error: '@formancy/report-builder-react was not packed, so its host has nothing to check' })
  })
})

describe('a local report', () => {
  // On a machine the results directory holds whatever was put there: a
  // collect of another commit, or a CI run's artefacts left beside this
  // machine's. Results of two commits or two runs describe neither, and the
  // subject would name the first one's commit alone. CI holds its artefacts
  // to the run (artefacts.mjs); this holds a local report to one.
  test('fails when its results are of more than one commit or run, or hold one key twice', () => {
    expect(withDefect((inputs) => (job(inputs, 'install').commit = 'decaf'))).toEqual([
      'the results are of 2 commits, where a report is of one: c0ffee (verify, test-report-spec, test-report-render-pdf, test-report-builder-react, test-report-corpus); decaf (install)',
    ])
    expect(withDefect((inputs) => (job(inputs, 'install').run.id = null))).toEqual([
      'the results are of 2 runs, where a report is of one: run 42 (verify, test-report-spec, test-report-render-pdf, test-report-builder-react, test-report-corpus); a machine (install)',
    ])
    expect(withDefect((inputs) => inputs.results.push(structuredClone(job(inputs, 'verify'))))).toEqual(['the results hold verify 2 times, where a run leaves each key once'])
  })
})

/** A CI run's problems after `change` to a copy of greenCiRun(). */
function ciDefect(change) {
  const inputs = copy(greenCiRun())
  change(inputs)
  return problemsOf(inputs)
}

describe('a green CI run', () => {
  // Every job's artefact, every need a success: a check red here is noise.
  test('has no problems, and its subject is that run', () => {
    const report = buildReport(greenCiRun())
    expect(report.problems).toEqual([])
    expect(report.subject).toMatchObject({ version: '0.1.0', release: null, commit: 'c0ffee', run: { id: '42' } })
    expect(report.subject.jobs.map((entry) => entry.key)).toEqual(['verify', 'test-report-spec', 'test-report-render-pdf', 'test-report-builder-react', 'test-report-corpus', 'install'])
  })
})

describe('the run', () => {
  // A job that failed or was cancelled may still have uploaded results that
  // look green; the job's own result is the last word.
  test('fails when a job of the gates ended other than success', () => {
    expect(ciDefect((inputs) => (inputs.needs.verify.result = 'failure'))).toEqual(['the verify job ended failure'])
  })

  // A job missing from the report's needs is one whose end it never waited for.
  test('fails when the report’s needs do not name a job', () => {
    expect(ciDefect((inputs) => delete inputs.needs.test)).toEqual(["the report's needs do not name the test job, so how it ended is unknown"])
  })

  // An artefact uploaded twice under one name -- a job re-run that kept both
  // -- would be two answers for one job, one of them read.
  test('fails an artefact that appears twice', () => {
    expect(ciDefect((inputs) => inputs.artefacts.push(structuredClone(inputs.artefacts.find((entry) => entry.name === 'release-results-verify'))))).toEqual([
      'release-results-verify appears 2 times, where one job leaves it once',
    ])
  })

  // A name the workflow does not give is results the report would read as
  // nobody's, and the job it should have been is then missing.
  test('fails an artefact no job leaves, and names the job whose artefact is then missing', () => {
    expect(ciDefect((inputs) => (inputs.artefacts.find((entry) => entry.name === 'release-results-test-report-corpus').name = 'release-results-test-report-corpse'))).toEqual([
      'test-report-corpus: its job left no artefact release-results-test-report-corpus',
      'release-results-test-report-corpse is no artefact a job of .github/workflows/gates.yml leaves',
    ])
  })

  // A directory holding another key's file is a job reported under the
  // wrong name.
  test('fails an artefact whose results are another job’s', () => {
    expect(
      ciDefect((inputs) => {
        inputs.artefacts.find((entry) => entry.name === 'release-results-verify').files[0].result.job = 'install'
      }),
    ).toEqual(['release-results-verify holds verify.json, the results of key verify from job install, where it holds verify.json from job verify'])
  })

  // Results from another run -- a re-run's leftovers, or another commit's --
  // describe a run that is not this one.
  test('fails results from another run or another commit', () => {
    expect(ciDefect((inputs) => (ciJob(inputs, 'test-report-spec').run.id = '41'))).toEqual(["release-results-test-report-spec is from run 41, not this run's 42"])
    expect(ciDefect((inputs) => (ciJob(inputs, 'install').commit = 'decaf'))).toEqual(["release-results-install is from commit decaf, not this run's c0ffee"])
  })
})

describe('the release gates', () => {
  // Evidence that did not run is not evidence that passed.
  test('fail the run when a gate’s evidence file did not run', () => {
    expect(
      ciDefect((inputs) => {
        const suite = ciJob(inputs, 'test-report-render-pdf').suites[0]
        suite.files = suite.files.filter((entry) => !entry.file.endsWith('corpus.test.ts'))
      }),
    ).toEqual([
      '@formancy/report-render-pdf: 1 test file(s) the checkout holds did not run in its suite: packages/report-render-pdf/src/corpus.test.ts',
      'gate G2: its evidence did not pass in this run: packages/report-render-pdf/src/corpus.test.ts did not run',
    ])
  })

  // G1 rests on the install job as well; a red job is a gate not passed.
  test('fail the run when a gate’s job did not succeed', () => {
    expect(ciDefect((inputs) => (inputs.needs.install.result = 'failure'))).toEqual(['the install job ended failure', 'gate G1: its evidence did not pass in this run: the install job ended failure'])
  })

  // Locally there is no `needs`, so a job's evidence did not run: a local
  // report says so, unless it allowed that job missing, as its banner says.
  test('fail a local run whose gate rests on a job, unless that job is allowed missing', () => {
    const local = (allowMissing) =>
      withDefect((inputs) => {
        inputs.gatesRegister.gates[0].evidence.push({ job: 'install' })
        inputs.allowMissing = allowMissing
      })
    expect(local([])).toEqual(['gate G1: its evidence did not pass in this run: the install job has no result outside a gates run'])
    expect(local(['install'])).toEqual([])
  })

  // A gate partly evidenced -- G3, whose cross-framework test is the
  // Studio's -- stays open; its evidence still has to pass.
  test('keep a gate with a reason open, and fail it when the evidence it has did not pass', () => {
    const report = buildReport(greenCiRun())
    expect(report.gates.find((entry) => entry.gate === 'G3')).toMatchObject({ state: 'open', evidence: [{ kind: 'file', outcome: 'passed' }] })
    expect(
      ciDefect((inputs) => {
        const file = ciJob(inputs, 'test-report-builder-react').suites[0].files[0]
        file.status = 'failed'
        file.tests[0].status = 'failed'
      }),
    ).toEqual([
      '@formancy/report-builder-react: 1 test(s) failed: packages/report-builder-react/src/scenarios.test.tsx › en: inserts a text block',
      '@formancy/report-builder-react: packages/report-builder-react/src/scenarios.test.tsx failed',
      'gate G3: its evidence did not pass in this run: packages/report-builder-react/src/scenarios.test.tsx did not pass',
    ])
  })

  // The register is read every run; one that does not hold is a report of
  // gates nobody can judge.
  test('fail the run when the register does not hold', () => {
    expect(ciDefect((inputs) => inputs.gatesRegister.gates.splice(4, 1))).toEqual(['docs/release/gates.json: the gates are G1, G2, G3, G4, G6, G7, legal, where the plan has G1, G2, G3, G4, G5, G6, G7 and legal, each once and in order'])
  })

  // A document is stated, and a stated gate is a limitation, not a failure.
  test('show a gate whose evidence is a document as stated, without failing the run', () => {
    const report = buildReport(greenCiRun())
    expect(report.gates.find((entry) => entry.gate === 'G4').state).toBe('stated')
    expect(report.problems).toEqual([])
  })
})

describe('a release', () => {
  // A tag that disagrees with the manifests would publish the wrong version
  // under the right name; found here, before anything is published.
  test('fails when its tag is not the version every package is at', () => {
    expect(ciDefect((inputs) => (inputs.release = 'v0.2.0'))).toEqual(['the release v0.2.0 is not v0.1.0, the version every package is at'])
  })

  // A tag whose version has no section would be released with no notes.
  test('fails when the changelog has no section for its version', () => {
    expect(
      ciDefect((inputs) => {
        inputs.release = 'v0.1.0'
        inputs.changelog = inputs.changelog.replace('## 0.1.0', '## 0.0.9')
      }),
    ).toEqual(['CHANGELOG.md has no section for 0.1.0'])
  })

  // A rehearsal renders the body that would be released: the version's
  // section when it has one, Unreleased otherwise, and with neither it fails.
  test('rehearses with the version’s section, then Unreleased, and fails with neither', () => {
    const rehearsal = (change = () => {}) => {
      const inputs = copy(greenCiRun())
      inputs.release = 'dry-run'
      change(inputs)
      return buildReport(inputs)
    }
    expect(rehearsal().release).toMatchObject({ release: 'dry-run', section: '0.1.0' })
    expect(rehearsal((inputs) => (inputs.changelog = inputs.changelog.replace('## 0.1.0', '## 0.0.9'))).release.section).toBe('Unreleased')
    expect(rehearsal((inputs) => (inputs.changelog = '# Changelog\n\n## 0.0.9\n\nOld.\n')).problems).toEqual(['CHANGELOG.md has no section for Unreleased'])
  })

  // GitHub refuses a body over 125,000 characters, after npm already holds
  // the version; the report refuses it first.
  test('fails a body longer than GitHub accepts, and CI only measures it', () => {
    const long = (release) =>
      ciDefect((inputs) => {
        inputs.release = release
        inputs.changelog = inputs.changelog.replace('The first.', 'x'.repeat(125_000))
      })
    expect(long('v0.1.0')).toEqual([expect.stringMatching(/^the release body is \d+ characters, over the 125000 GitHub accepts$/)])
    expect(long('')).toEqual([])
  })
})
