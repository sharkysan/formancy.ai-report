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

  // What jsdom cannot see is measured in the browsers the gate launched and
  // in no other: the sentence names each, and what launched it, from what
  // the gate and the pictures recorded. Without the browser job, or with a
  // job that launched nothing, it says that instead.
  test('name every browser the run launched, and say so when none was', () => {
    expect(derivedLimitations(report())).toContain(
      'Chromium 156.0.8078.4 was the only browser launched in this run, by the browser gate of apps/studio and the pictures’ check of apps/studio; what jsdom cannot see was measured in no other.',
    )
    const none = 'No browser was launched in this run: the builders’ suites ran in jsdom, and nothing measured what jsdom cannot see.'
    expect(derivedLimitations(report((inputs) => (job(inputs, 'browser').browserGates = job(inputs, 'browser').pictures = [])))).toContain(none)
    const without = 'No browser ran in this run: the builders’ suites ran in jsdom, and the install gate drew them on a server.'
    expect(derivedLimitations(report((inputs) => (inputs.jobs = inputs.jobs.filter((name) => name !== 'browser'))))).toContain(without)
    expect(derivedLimitations(report())).not.toContain(without)
  })

  // Neither the suites' source-not-dist nor which jobs built what npm
  // receives may go unsaid.
  test('say the suites ran the source, and which jobs built the dist/ npm receives', () => {
    // The jobs named are the ones that built every published package: a
    // test job builds what its package depends on, not the rest.
    const identity = derivedLimitations(report()).find((sentence) => sentence.includes('published dist/'))
    expect(identity).toBe("Each package's own suites ran its source; the published dist/ was run by the install gate, and each package's is byte-identical to its dist/ built in browser, install and verify, and in every other job that built it (*Build identity* names them).")
    expect(derivedLimitations(report((inputs) => (job(inputs, 'install').install = null)))).toContain("Each package's own suites ran its source; no install gate ran the packed dist/ in this run.")
  })
})

describe('the release gates, as a report shows them', () => {
  // A gate with a reason is open whatever its evidence, and the reason is a
  // limitation of every release until the register changes.
  test('say every open gate as a limitation, with its reason, and whether the evidence it has passed', () => {
    const sentences = derivedLimitations(report())
    expect(sentences).toContain('Release gate `G5` is open: Nothing to test yet.')
    expect(sentences).toContain('Release gate `G3` is open: Nothing compares the two builders’ accessible trees. The evidence it has passed in this run.')
    expect(renderContent(report())).toContain('| G3 | open | `packages/report-builder-react/src/scenarios.test.tsx`: passed; the browser gate of `apps/studio`: passed | Nothing compares the two builders’ accessible trees. |')
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
    for (const section of ['Subject', 'Tested on', 'Results', 'Browser', 'E-invoice gate', 'Build identity', 'Release gates', 'Known limitations', 'Problems']) expect(method).toContain(`- **${section}:**`)
  })

  // The browser a gate measured in, and the Playwright that pins it, are
  // part of what the run was tested on; a launch other than the pin is said
  // beside it, not hidden behind the version Playwright names.
  test('names the browser builds Playwright pins, and each one the run launched', () => {
    expect(renderContent(report())).toContain('Browsers: Playwright 1.64.1 pins chromium-headless-shell 156.0.8078.4 (revision 1248) for Chromium; this run launched Chromium 156.0.8078.4, with axe-core 4.14.0 in the page.')
    const other = renderContent(report((inputs) => (job(inputs, 'browser').browserGates[0].browser.version = '155.0.7999.2')))
    expect(other).toContain('this run launched Chromium 155.0.7999.2 (not the 156.0.8078.4 it pins) and Chromium 156.0.8078.4, with axe-core')
    // The full browser and the headless shell share a version: a headed launch is said, not folded into the shell's.
    const headed = renderContent(report((inputs) => (job(inputs, 'browser').browserGates[0].browser.headless = false)))
    expect(headed).toContain('this run launched Chromium 156.0.8078.4 headed and Chromium 156.0.8078.4, with axe-core')
  })

  // The Browser section is the gate's and the pictures' own record: every
  // check passed, every pass made of those planned, every scene walked.
  // A gate that stopped part way shows it in the row, not only in Problems.
  test('shows each browser gate with its checks and passes, and each pictures’ check with its scenes', () => {
    const browser = (markdown) => markdown.slice(markdown.indexOf('## Browser'), markdown.indexOf('## Build identity'))
    const green = browser(renderContent(report()))
    expect(green).toContain('| apps/studio | Chromium | chromium 156.0.8078.4, headless | 1.64.1 | 4 | 0 | 2 of 2 | 320, 360 | 4.14.0 | 180.0 s |')
    expect(green).toContain('| apps/studio | chromium 156.0.8078.4, headless | 1.64.1 | 2 of 2 | none | 0 | 30.0 s |')
    const stopped = browser(
      renderContent(
        report((inputs) => {
          const gate = job(inputs, 'browser').browserGates[0]
          Object.assign(gate, { error: 'the paper never settled', passes: 1, made: gate.made.slice(0, 1) })
          job(inputs, 'browser').pictures[0].walked = ['studio-react']
        }),
      ),
    )
    expect(stopped).toContain('| 4 | 1 | 1 of 2 |')
    expect(stopped).toContain('| 1 of 2 | studio-angular | 0 |')
    expect(browser(renderContent(report((inputs) => (job(inputs, 'browser').browserGates = job(inputs, 'browser').pictures = []))))).toContain("No browser gate left results in this run.\n\nNo pictures' check left results in this run.")
  })
})

describe('the e-invoice gate', () => {
  // The section is the gate's own record: the Java and the tools it ran,
  // and each file with what the corpus expects of it and what each tool's
  // judge said, so a red run shows which file and which tool in the row.
  test('shows the Java, the tools, and every file with each tool’s verdict', () => {
    const section = (markdown) => markdown.slice(markdown.indexOf('## E-invoice gate'), markdown.indexOf('## Build identity'))
    const green = section(renderContent(report()))
    expect(green).toContain('The e-invoice gate passed on Java 17.0.20.1, with mustang 2.26.0, kosit 1.6.3 and xrechnung-configuration 2026-08-31, Mustang in 20.8 s and KoSIT in 6.3 s:')
    expect(green).toContain('| e-invoice.xml | a sample, to accept | as expected | as expected |')
    expect(green).toContain('| control-br-27.xml | a control, to refuse | as expected | as expected |')
    const red = section(renderContent(report((inputs) => (job(inputs, 'e-invoice').eInvoice.kosit[1].verdict = 'not as expected'))))
    expect(red).toContain('| control-br-27.xml | a control, to refuse | as expected | not as expected |')
    expect(section(renderContent(report((inputs) => (job(inputs, 'e-invoice').eInvoice = null))))).toContain('The e-invoice gate left no results in this run.')
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
    expect(summary).toContain('6 of 6 tests passed across 4 packages; the install gate passed; the e-invoice gate passed.')
  })
})
