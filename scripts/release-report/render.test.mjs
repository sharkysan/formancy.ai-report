import { describe, expect, test } from 'vitest'
import { derivedLimitations, renderContent, renderReport, renderSummary } from './render.mjs'
import { buildReport } from './report.mjs'
import { copy, greenCiRun, greenRun, job } from './synthetic-run.mjs'

/**
 * The report's derived limitations and its Markdown (0014; formancy.ai-data
 * 0035), over a run made by hand. A limitation the run shows is a fixed
 * sentence with the run's facts in it; each test here fails when its
 * sentence's template is gone, which is how a limitation stops being said
 * without anybody deciding so.
 */
const report = (change = () => {}) => {
  const inputs = copy(greenRun())
  change(inputs)
  return buildReport(inputs)
}

describe('the limitations a run shows', () => {
  // Node is what the jobs ran and what the install gate ran on; no
  // published package says which Node it supports, and the reader is told.
  test('name the Node every job ran, the install gate’s, and that no package declares one', () => {
    expect(derivedLimitations(report())).toContain('The suites ran on Node v22.20.0; the install gate ran on v22.20.0; no published package declares the Node versions it supports.')
  })

  // An exact dependency is the version the suites ran; a range admits
  // versions no suite ran, and a clean install on the day is the evidence
  // of one.
  test('say whether runtime dependencies are exact, and name one a clean install resolved past the suites', () => {
    expect(derivedLimitations(report())).toContain('Every runtime dependency is published at an exact version, the one the suites ran.')
    const ranged = derivedLimitations(
      report((inputs) => {
        inputs.facts.runtime.push({ package: '@formancy/report-builder-angular', name: 'tslib', range: '^2.8.0', loaded: '2.8.1' })
        job(inputs, 'install').install.resolved.push({ name: 'tslib', version: '2.8.2' })
      }),
    )
    expect(ranged).toContain('`tslib` is published as a range; the suites ran the version *Tested on* names, and an install may resolve another.')
    expect(ranged).toContain('A clean npm install on 2026-10-16 resolved `tslib` 2.8.2 (the suites ran 2.8.1), which no suite ran.')
    expect(derivedLimitations(report()).some((sentence) => sentence.startsWith('A clean npm install'))).toBe(false)
  })

  // A builder's peer range admits every React 19; the install gate ran two
  // of them. Said by the run, a host added or a floor moved changes the
  // sentence without an edit here.
  test('name the peers each builder was installed beside, and what its suites ran', () => {
    expect(derivedLimitations(report())).toContain('The install gate ran `@formancy/report-builder-react` beside `react` 19.3.1 (newest) and 19.0.0 (floor) and `react-dom` 19.3.1 (newest) and 19.0.0 (floor) only, of what its peer ranges admit; its suites ran `react` 19.3.1 and `react-dom` 19.3.1.')
    expect(derivedLimitations(report((inputs) => (job(inputs, 'install').install.consumers = [])))).toContain('No install host installed `@formancy/report-builder-react` in this run; its suites ran `react` 19.3.1 and `react-dom` 19.3.1.')
    // What a builder's suites ran is the installed tree's version, said
    // only when its suites ran: a builder whose suite left nothing ran none.
    const unrun = (inputs) => (inputs.results = inputs.results.filter((result) => result.key !== 'test-report-builder-react'))
    expect(derivedLimitations(report(unrun))).toContain(
      'The install gate ran `@formancy/report-builder-react` beside `react` 19.3.1 (newest) and 19.0.0 (floor) and `react-dom` 19.3.1 (newest) and 19.0.0 (floor) only, of what its peer ranges admit; its own suites did not run in this run.',
    )
  })

  // Each host resolves its own tree, so a clean install can resolve two
  // versions of one package; the one no suite ran must not hide behind the
  // first one listed.
  test('name every version a clean install resolved, with the hosts that resolved it', () => {
    const two = report((inputs) => {
      const install = job(inputs, 'install').install
      install.resolved.push({ name: 'pdfmake', version: '0.3.12' })
      install.consumers.find((entry) => entry.project === 'react-floor').resolved.push({ name: 'pdfmake', version: '0.3.12' })
    })
    expect(derivedLimitations(two)).toContain('A clean npm install on 2026-10-16 resolved `pdfmake` 0.3.12 in react-floor (the suites ran 0.3.11), which no suite ran.')
    expect(renderContent(two)).toContain('| `pdfmake` | @formancy/report-render-pdf | 0.3.11 | 0.3.11 | 0.3.11 (node); 0.3.12 (react-floor) |')
    expect(renderContent(report())).toContain('| `pdfmake` | @formancy/report-render-pdf | 0.3.11 | 0.3.11 | 0.3.11 |')
  })

  // The gates run no browser until the Studio's job lands; until then every
  // report says so, and the job's arrival in gates.yml ends the sentence.
  test('say no browser ran while the gates have no browser job', () => {
    const sentence = 'No browser ran in this run: the builders’ suites ran in jsdom, and the install gate drew them on a server.'
    expect(derivedLimitations(report())).toContain(sentence)
    expect(derivedLimitations(report((inputs) => inputs.jobs.push('browser')))).not.toContain(sentence)
  })

  // Neither the suites' source-not-dist nor which jobs built what npm
  // receives may go unsaid.
  test('say the suites ran the source, and which jobs built the dist/ npm receives', () => {
    // The jobs named are the ones that built every published package: a
    // test job builds what its package depends on, not the rest.
    const identity = derivedLimitations(report()).find((sentence) => sentence.includes('published dist/'))
    expect(identity).toBe("Each package's own suites ran its source; the published dist/ was run by the install gate, and each package's is byte-identical to its dist/ built in install and verify, and in every other job that built it (*Build identity* names them).")
    expect(derivedLimitations(report((inputs) => (job(inputs, 'install').install = null)))).toContain("Each package's own suites ran its source; no install gate ran the packed dist/ in this run.")
  })
})

describe('the release gates, as a report shows them', () => {
  // A gate with a reason is open whatever its evidence, and the reason is a
  // limitation of every release until the register changes.
  test('say every open gate as a limitation, with its reason, and whether the evidence it has passed', () => {
    const sentences = derivedLimitations(report())
    expect(sentences).toContain('Release gate `G5` is open: Nothing to test yet.')
    expect(sentences).toContain('Release gate `G3` is open: The cross-framework test is the Studio’s, and has not landed. The evidence it has passed in this run.')
    expect(renderContent(report())).toContain('| G3 | open | `packages/report-builder-react/src/scenarios.test.tsx`: passed | The cross-framework test is the Studio’s, and has not landed. |')
  })

  // A document from another commit is stated, with when it last changed and
  // how far behind this commit it is, and never "passed".
  test('show a gate whose only evidence is a document as stated, with its last change, and none as met', () => {
    const built = report()
    const gates = renderContent(built).slice(renderContent(built).indexOf('## Release gates'), renderContent(built).indexOf('## Known limitations'))
    expect(gates).toContain('| G4 | stated, not exercised by this run | stated in `docs/renderer-trial.md`, last changed 2026-10-14 at `1234567`, 3 commit(s) before this one |  |')
    expect(gates).toContain('| G2 | evidence passed in this run | `packages/report-render-pdf/src/corpus.test.ts`: passed |  |')
    expect(gates).not.toMatch(/\| [^|]+ \| [^|]*\bmet\b/)
    expect(derivedLimitations(built)).toContain('Release gate `G4` is stated in `docs/renderer-trial.md`, last changed 2026-10-14 at `1234567`, 3 commit(s) before this one; not exercised by this run.')
  })

  // On a machine there is no `needs`: a job's evidence is said to have no
  // result there, not to have failed or not run, and in CI it is the job's.
  test('say a job’s evidence has no result outside a gates run, and in CI how the job ended', () => {
    const local = renderContent(report((inputs) => inputs.gatesRegister.gates[0].evidence.push({ job: 'install' })))
    expect(local).toContain('| G1 | evidence did not pass in this run | `scripts/upstream-deps.test.mjs`: passed; the `install` job: no result outside a gates run |  |')
    expect(renderContent(buildReport(greenCiRun()))).toContain('| G1 | evidence passed in this run | `scripts/upstream-deps.test.mjs`: passed; the `install` job: passed |  |')
  })
})

describe('the Markdown', () => {
  // A blank cell reads as nothing to report; a wall time or a coverage no
  // file of this run gave is said to be not measured.
  test('says a wall time or a coverage this run has no file for is not measured', () => {
    const markdown = renderContent(
      report((inputs) => {
        const suite = job(inputs, 'test-report-spec').suites[0]
        suite.task = null
        suite.coverage = null
      }),
    )
    const row = markdown.split('\n').find((line) => line.startsWith('| @formancy/report-spec |'))
    expect(row).toMatch(/\| not measured \| [\d.]+ s \| not measured \|$/)
  })

  // Tested on names what each install host installed, beside the range the
  // builder declares, and what the hosts checked their consumers with.
  test('shows each peer as declared, as the suites loaded it and as each host installed it', () => {
    const markdown = renderContent(report())
    expect(markdown).toContain('| `react` | @formancy/report-builder-react | ^19.0.0 | 19.3.1 | 19.3.1 (react), 19.0.0 (react-floor) |')
    expect(markdown).toContain('| react-floor | floor | react 19.0.0, react-dom 19.0.0 | yes |')
    expect(markdown).toContain('The install hosts checked their consumers with typescript 6.0.3, `skipLibCheck` off.')
    expect(markdown).toContain('pnpm 12.4.2, through corepack (`pnpm@12.4.2`). Tools, as the workspace loads them: typescript 6.0.3 (`~6.0.3`), pdfjs-dist 6.4.299 (`6.4.299`).')
  })

  // Every register line names the record that states it, and a held line
  // says its test passed in this run.
  test('prints a stated limitation with its record, its status and its test', () => {
    // A Status line's relative link to a later record is made absolute: from a report, a relative one goes nowhere.
    const narrowed = renderContent(report((inputs) => (inputs.records[0].status = 'accepted; extended by [0014](0014-a-release-report.md)')))
    expect(narrowed).toContain('(accepted; extended by [0014](https://github.com/sharkysan/formancy.ai-report/blob/c0ffee/docs/decisions/0014-a-release-report.md))')
    expect(renderContent(report())).toContain(
      '- One font: a character Roboto has no glyph for is refused. — stated by [0011 report-render-pdf draws the document](https://github.com/sharkysan/formancy.ai-report/blob/c0ffee/docs/decisions/0011-report-render-pdf-draws.md#consequences) (accepted); held by `packages/report-render-pdf/src/glyphs.test.ts`, passed in this run',
    )
    expect(renderContent(report())).toContain('None: nothing here fails the run.')
  })

  // Every section names where it comes from, so a reader can check one.
  test('says how each section was made', () => {
    const markdown = renderContent(report())
    const method = markdown.slice(markdown.indexOf('## How this report was made'), markdown.indexOf('## Problems'))
    for (const section of ['Subject', 'Tested on', 'Results', 'Build identity', 'Release gates', 'Known limitations', 'Problems']) expect(method).toContain(`- **${section}:**`)
  })
})

describe('the subject and the summary', () => {
  // A report that does not say which run, commit and release it is of
  // cannot be told apart from another one.
  test('name the version, the release, the commit and the run', () => {
    const inputs = copy(greenCiRun())
    inputs.release = 'dry-run'
    const markdown = renderReport(buildReport(inputs))
    expect(markdown).toContain('Formancy Report 0.1.0, a rehearsal (`dry-run`); nothing is published from it. Commit `c0ffee`. Run [42](https://github.com/sharkysan/formancy.ai-report/actions/runs/42) of CI, attempt 1.')
    expect(markdown).toContain('| install | 1 | ubuntu24 20261012.1 | v22.20.0 | linux x64 |')
    expect(renderReport(report(), { local: true, partial: ['install'] })).toContain('local: no NEEDS, no artefacts; partial: install allowed missing.')
    // A local run of a tree with uncommitted changes did not run that commit.
    expect(renderReport(report((inputs) => (inputs.results[0].dirty = true)), { local: true })).toContain('Commit `c0ffee`, with uncommitted changes.')
    expect(renderReport(report(), { local: true })).toContain('Commit `c0ffee`. Generated')
  })

  // The body says where the whole report is and which changelog section it
  // opens with; a release reader otherwise cannot find either.
  test('carries the link to the full report, the section the notes are from, and the counts', () => {
    const summary = renderSummary(report(), { section: 'Unreleased', link: 'https://example.invalid/report.md' })
    expect(summary).toContain('The full report of the run that gated this: https://example.invalid/report.md')
    expect(summary).toContain('The notes above are CHANGELOG.md’s `Unreleased` section.')
    expect(summary).toContain('6 of 6 tests passed across 4 packages; the install gate passed.')
  })
})
