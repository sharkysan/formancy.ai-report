// The report as Markdown (0014; formancy.ai-data 0035), from the built
// report, and the summary a release body carries.
//
// Every value is the report's; the only text written here is the fixed
// sentences of the derived limitations, each with only facts inserted, so a
// limitation the run shows cannot be left out by somebody forgetting it, and
// the line per section saying where it comes from.

import { browserName } from '../browsers.mjs'
import { JUDGES } from '../e-invoice/registers.mjs'
import { unwalked } from './results.mjs'

const code = (text) => `\`${text}\``
const cell = (text) => String(text ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')
const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)].join('\n')
const prose = (items) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
const seconds = (ms) => (ms === null || ms === undefined || Number.isNaN(ms) ? '' : `${(ms / 1000).toFixed(1)} s`)
const distinct = (values) => [...new Set(values)]

/** `19.3.1 (newest)`: a version an install host ran, with the end of the peer range it was installed at. */
const hostVersion = (entry) => (entry.at === null ? entry.version : `${entry.version} (${entry.at})`)

/**
 * One sentence per builder: the peers each install host installed it
 * beside, at the ends of its peer ranges, and what its own suites ran -- the
 * versions installed in the workspace, said only when its suites ran in
 * this run. A range admits more than the gate installs, and only these
 * were run.
 */
function peerSentences({ testedOn, results }) {
  const builders = distinct(testedOn.peers.map((peer) => peer.package))
  return builders.map((name) => {
    const peers = testedOn.peers.filter((peer) => peer.package === name)
    const ranSuites = results.packages.some((row) => row.package === name && row.present)
    const suites = ranSuites ? `its suites ran ${prose(peers.map((peer) => `${code(peer.name)} ${peer.loaded}`))}` : 'its own suites did not run in this run'
    if (peers.every((peer) => peer.installed.length === 0)) return `No install host installed ${code(name)} in this run; ${suites}.`
    const ran = prose(peers.map((peer) => `${code(peer.name)} ${prose(distinct(peer.installed.map(hostVersion)))}`))
    return `The install gate ran ${code(name)} beside ${ran} only, of what its peer ranges admit; ${suites}.`
  })
}

/** Every version a clean install resolved for a package, each with the hosts that resolved it when there is more than one: `0.3.11 (node); 0.3.12 (react-floor)`. */
const freshCell = (fresh) => (fresh.length === 1 ? fresh[0].version : fresh.map((entry) => (entry.hosts.length === 0 ? entry.version : `${entry.version} (${entry.hosts.join(', ')})`)).join('; '))

/** The limitations this run shows, each a fixed sentence with only its facts inserted. */
export function derivedLimitations(report) {
  const { testedOn, results } = report
  const sentences = []

  const declared = testedOn.node.declared.length === 0 ? 'no published package declares the Node versions it supports' : prose(testedOn.node.declared.map((entry) => `${code(entry.package)} declares Node ${code(entry.node)}`))
  sentences.push(`The suites ran on Node ${prose(testedOn.node.ran) || 'that no job recorded'}${testedOn.node.install === null ? '' : `; the install gate ran on ${testedOn.node.install}`}; ${declared}.`)

  const ranged = testedOn.runtime.filter((entry) => !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(String(entry.range)))
  sentences.push(
    ranged.length === 0
      ? 'Every runtime dependency is published at an exact version, the one the suites ran.'
      : `${prose(ranged.map((entry) => code(entry.name)))} ${ranged.length === 1 ? 'is' : 'are'} published as a range; the suites ran the version${ranged.length === 1 ? '' : 's'} *Tested on* names, and an install may resolve another.`,
  )
  // Every version a clean install resolved that the suites did not load, each
  // on its own: one host's tree can move while another's does not.
  const moved = [...testedOn.runtime, ...testedOn.upstream].flatMap((entry) =>
    entry.fresh.filter((fresh) => fresh.version !== (entry.loaded ?? entry.version)).map((fresh) => `${code(entry.name)} ${fresh.version}${fresh.hosts.length === 0 ? '' : ` in ${prose(fresh.hosts)}`} (the suites ran ${entry.loaded ?? entry.version})`),
  )
  if (moved.length > 0) sentences.push(`A clean npm install on ${String(testedOn.installedAt).slice(0, 10)} resolved ${prose(moved)}, which no suite ran.`)
  sentences.push(...peerSentences(report))

  // Which browsers the browser job launched, from what the gate and the
  // pictures recorded; without the job, that none ran at all.
  if (!report.gateJobs.includes('browser')) sentences.push('No browser ran in this run: the builders’ suites ran in jsdom, and the install gate drew them on a server.')
  else if (testedOn.browsers.length === 0) sentences.push('No browser was launched in this run: the builders’ suites ran in jsdom, and nothing measured what jsdom cannot see.')
  else {
    const launched = testedOn.browsers.map((entry) => `${browserName(entry.name)} ${entry.version}`)
    const by = distinct(testedOn.browsers.flatMap((entry) => entry.by))
    sentences.push(`${prose(launched)} ${launched.length === 1 ? 'was the only browser' : 'were the only browsers'} launched in this run, by ${prose(by)}; what jsdom cannot see was measured in no other.`)
  }

  const identity = results.buildIdentity
  if (results.install === null) sentences.push("Each package's own suites ran its source; no install gate ran the packed dist/ in this run.")
  else if (identity.length > 0 && identity.every((entry) => entry.identical && entry.tarball !== null && entry.builds.length > 0)) {
    // Only the jobs that built every published package are named: a test
    // job builds what its package depends on, not the rest, and the table
    // says which built what.
    const everywhere = identity.map((entry) => new Set(entry.builds.map((build) => build.job))).reduce((all, jobs) => new Set([...all].filter((job) => jobs.has(job))))
    const named = [...everywhere].sort()
    sentences.push(
      `Each package's own suites ran its source; the published dist/ was run by the install gate, and each package's is byte-identical to ${named.length === 0 ? 'the dist/ every job that built it built' : `its dist/ built in ${prose(named)}, and in every other job that built it`} (*Build identity* names them).`,
    )
  } else sentences.push("Each package's own suites ran its source; the published dist/ was run by the install gate, and is not shown byte-identical to every job's build (see *Build identity*).")

  for (const gate of report.gates ?? []) {
    if (gate.state === 'open') sentences.push(`Release gate ${code(gate.gate)} is open: ${gate.open}${gate.evidence.some((item) => item.kind !== 'document') ? ' The evidence it has passed in this run.' : ''}`)
    if (gate.state === 'stated') sentences.push(`Release gate ${code(gate.gate)} is ${prose(gate.evidence.map(stated))}; not exercised by this run.`)
  }
  return sentences
}

/** A document as evidence: where it is stated and when it last changed. */
function stated(item) {
  const history = item.history
  if (history === null || history === undefined) return `stated in ${code(item.value)}, whose history this checkout does not have`
  return `stated in ${code(item.value)}, last changed ${history.date.slice(0, 10)} at ${code(history.sha.slice(0, 7))}, ${String(history.behind)} commit(s) before this one`
}

/** How one evidence item stood in the run. */
function evidenceCell(item) {
  if (item.kind === 'document') return stated(item)
  const what = item.kind === 'job' ? `the ${code(item.value)} job` : item.kind === 'browserGate' ? `the browser gate of ${code(item.value)}` : code(item.value)
  if (item.local === true) return `${what}: no result outside a gates run`
  const where = item.missing === undefined ? '' : ` in ${prose(item.missing.map(browserName))}`
  return `${what}: ${item.outcome === 'absent' ? `did not run${where}` : item.kind === 'job' && item.outcome === 'failed' ? `ended ${String(item.result)}` : item.outcome}`
}

const GATE_STATE = { passed: 'evidence passed in this run', failed: 'evidence did not pass in this run', stated: 'stated, not exercised by this run', open: 'open' }

/** Each release gate, as this run leaves it; never "met". */
function gatesSection({ gates }) {
  return [
    '## Release gates',
    '',
    'The delivery plan’s gates by id (`docs/release/gates.json`). A document is stated evidence, never passed in a run; a gate with a reason is open, whatever its evidence; and no gate is called met.',
    '',
    table(['Gate', 'State', 'Evidence', 'Open because'], (gates ?? []).map((gate) => [gate.gate, GATE_STATE[gate.state], gate.evidence.map(evidenceCell).join('; ') || 'none', gate.open ?? ''])),
  ].join('\n')
}

/** Where each section comes from, one line each. */
const METHOD = [
  ['Subject', 'the GitHub run’s environment (`GITHUB_SHA`, `GITHUB_RUN_ID`), the report job’s `needs`, the root `package.json`’s version, and each job’s results file'],
  [
    'Tested on',
    '`scripts/release-report/tested-on.mjs` over the checkout -- the published manifests, what is installed, `pnpm-workspace.yaml`’s catalog, every workflow’s `setup-node`, and playwright-core’s `browsers.json` for the build Playwright pins -- the install gate’s `test-results/install.json` for what a clean install resolved and what each host installed, and each browser gate’s and pictures’ check’s own record of the browser it launched',
  ],
  ['Results', 'each package’s `test-results/vitest.json` and `coverage/coverage-summary.json`, turbo’s run summary (`--summarize`), the repository guards’ `test-results/vitest.json`, and the install gate’s `test-results/install.json`'],
  ['E-invoice gate', '`test-results/e-invoice.json`, which `scripts/e-invoice.mjs` writes however its run ends, held to the tools `docs/release/e-invoice-tools.json` pins'],
  ['Browser', 'each app’s `test-results/browser-<browser>.json`, which its browser gate writes however it ends, for every browser of `scripts/browsers.mjs`, and its `test-results/pictures.json`, which its pictures’ check writes however it ends, held to the scenes `scripts/pictures/scenes.json` gives the app'],
  ['Build identity', '`scripts/release/dist-hash.mjs` over every published package’s `dist/` in every job, and over each tarball’s built files'],
  ['Release gates', '`docs/release/gates.json`, the report job’s `needs`, and `git log` for a document’s last change'],
  ['Known limitations', 'the fixed sentences of `scripts/release-report/render.mjs` with this run’s facts, then `docs/release/limitations.json`, held to the decision records by hash'],
  ['Problems', '`scripts/release-report/problems.mjs`, `artefacts.mjs`, `gates.mjs` and `limitations.mjs`, and the release body from `scripts/release-notes.mjs`'],
]

const versionsOf = (tool) => tool.versions.map((entry) => (tool.versions.length === 1 ? entry.version : `${entry.version} (${entry.from.join(', ')})`)).join('; ')

/** What the run was tested on: dependencies, peers, upstream, Node, pnpm and the tools. */
function testedOnSection({ testedOn }) {
  const ci = distinct(testedOn.node.ci.map((entry) => entry.version))
  return [
    '## Tested on',
    '',
    table(
      ['Dependency', 'Declared by', 'Published as', 'Loaded by the suites', 'A clean install'],
      testedOn.runtime.map((entry) => [code(entry.name), entry.package, entry.range, entry.loaded, entry.fresh.length === 0 ? 'not reported' : freshCell(entry.fresh)]),
    ),
    '',
    table(
      ['Peer', 'Of', 'Declared as', 'Loaded by the suites', 'Installed by the install gate'],
      testedOn.peers.map((entry) => [code(entry.name), entry.package, entry.range, entry.loaded, entry.installed.map((host) => `${host.version} (${host.project})`).join(', ') || 'no host installed it']),
    ),
    '',
    table(['Upstream', 'Declared as', 'Loaded', 'A clean install'], testedOn.upstream.map((entry) => [`${code(entry.name)}${entry.direct ? '' : ' (transitive)'}`, entry.declared ?? '', entry.version, entry.fresh.length === 0 ? 'not installed by a consumer' : freshCell(entry.fresh)])),
    '',
    `Node: the workspace declares ${testedOn.node.engines === null ? 'nothing' : code(testedOn.node.engines)}; CI sets up ${prose(ci) || 'nothing'}; this run's jobs ran ${prose(testedOn.node.ran) || 'nothing recorded'}${testedOn.node.install === null ? '' : `, and the install gate ran on ${testedOn.node.install} with npm ${String(testedOn.npm)}`}.`,
    '',
    `${testedOn.packageManager.name} ${testedOn.packageManager.version}, through corepack (${code(testedOn.packageManager.declared)}). Tools, as the workspace loads them: ${testedOn.tooling
      .map((tool) => `${tool.name} ${versionsOf(tool)}${tool.declared === null ? '' : ` (${code(tool.declared)})`}`)
      .join(', ')}.${testedOn.hostTools.length === 0 ? '' : ` The install hosts checked their consumers with ${prose(testedOn.hostTools)}, \`skipLibCheck\` off.`}`,
    '',
    browsersLine(testedOn),
  ].join('\n')
}

/** Which browser builds Playwright pins for the gates, and which this run launched, each held to its pin. */
function browsersLine({ browser, browsers, axe }) {
  const pins = prose(browser.pins.map((pin) => `${pin.name} ${pin.browserVersion} (revision ${pin.revision}) for ${browserName(pin.browser)}`))
  const launched = browsers.map((entry) => `${browserName(entry.name)} ${entry.version}${entry.headless === false ? ' headed' : ''}${entry.pin === null ? ' (which no gate here runs)' : entry.version === entry.pin ? '' : ` (not the ${entry.pin} it pins)`}`)
  return `Browsers: Playwright ${browser.playwright} pins ${pins}; this run launched ${prose(launched) || 'none'}${axe.length === 0 ? '' : `, with axe-core ${prose(axe)} in the page`}.`
}

/** A launched browser as a cell: its name, version and how it was launched. */
const launchedCell = (launched) => (launched === null ? 'none' : `${launched.name} ${launched.version}${launched.headless === undefined ? '' : launched.headless ? ', headless' : ', headed'}`)

/**
 * What jsdom cannot see, measured in a browser: each browser gate in each
 * browser, with its checks and the passes it planned and made, and each
 * pictures' check with the scenes it walked.
 */
function browserSection({ results }) {
  const gates = results.browserGates
  const pictures = results.pictures
  return [
    '## Browser',
    '',
    "Each app's browser gate, in every browser the gates run in (`scripts/browsers.mjs`), and its README pictures' check, held to every scene `scripts/pictures/scenes.json` gives the app. A check failed, a pass the gate planned and did not make or made with no check in it, a browser launched otherwise than Playwright's pin, a scene not walked or a picture whose page now says something else fails the run.",
    '',
    gates.length === 0
      ? 'No browser gate left results in this run.'
      : table(
          ['Browser gate', 'Browser', 'Launched', 'Playwright', 'Checks passed', 'Checks failed', 'Passes made of planned', 'Widths', 'axe-core', 'Wall time'],
          gates.map((gate) => [
            gate.gate,
            browserName(gate.asked),
            launchedCell(gate.browser),
            gate.playwright ?? 'not recorded',
            gate.ok,
            gate.failed.length + (gate.error === null ? 0 : 1),
            `${String(gate.passes)} of ${String(gate.planned.length)}`,
            gate.widths.join(', '),
            gate.axe ?? 'not recorded',
            seconds(gate.wallMs),
          ]),
        ),
    '',
    pictures.length === 0
      ? "No pictures' check left results in this run."
      : table(
          ["Pictures' check", 'Launched', 'Playwright', 'Scenes walked of scenes.json’s', 'Not walked', 'Pictures no longer showing the page', 'Wall time'],
          pictures.map((check) => [check.app, launchedCell(check.browser), check.playwright ?? 'not recorded', `${String(check.walked.length)} of ${String(check.planned.length)}`, unwalked(check).join(', ') || 'none', check.problems.length, seconds(check.wallMs)]),
        ),
  ].join('\n')
}

/** What the corpus expects of a file, as the e-invoice section says it: a control a tool accepts says so in that tool's column. */
const expected = (file) => (file.kind === 'control' ? 'a control, to refuse' : file.kind === 'variant' ? 'a variant, to accept' : 'a sample, to accept')

/** The e-invoice gate's tools, as its section's columns name them. */
const E_INVOICE_COLUMNS = [
  ['mustang', 'Mustang'],
  ['kosit', 'KoSIT'],
  ['verapdf', 'veraPDF'],
]

/** A tool's cell for a file: its verdict, `not judged` where the gate recorded none, and empty where the tool reads no file of that format. */
const verdictCell = (file, tool) => (JUDGES[file.format]?.includes(tool) ? (file[tool] ?? 'not judged') : '')

/**
 * The e-invoice gate: the Java and the tools it ran, and every file of its
 * corpus, XML and PDF, with each tool's verdict on it.
 */
function eInvoiceSection({ results }) {
  const gate = results.eInvoice
  const tools = gate === null ? [] : gate.tools.map((tool) => `${tool.id} ${String(tool.version)}`)
  const took = (tool) => String(gate.seconds?.[tool] ?? '?')
  return [
    '## E-invoice gate',
    '',
    'Mustang and KoSIT’s validator over the CII XML the runtime writes of each e-invoice sample of the corpus, and veraPDF and Mustang over the PDF/A-3b the renderer draws of it, at the releases `docs/release/e-invoice-tools.json` pins, and over controls broken one named way each, with Java’s HTTP and HTTPS proxies at a dead port; and report-spec’s code lists and rule ids held to the schematrons they run (`scripts/e-invoice.mjs`). A file a tool judged otherwise than the corpus expects, a tool other than the pin, or a list or a rule the schematrons do not hold fails the run.',
    '',
    gate === null
      ? 'The e-invoice gate left no results in this run.'
      : `The e-invoice gate ${gate.passed ? 'passed' : 'failed'} on Java ${String(gate.java?.version ?? 'that it did not record')}, with ${prose(tools) || 'no tool recorded'}, Mustang in ${took('mustang')} s, KoSIT in ${took('kosit')} s and veraPDF in ${took('verapdf')} s:`,
    ...(gate === null
      ? []
      : [
          '',
          table(
            ['File', 'Is', ...E_INVOICE_COLUMNS.map(([, name]) => name)],
            gate.files.map((file) => [file.file, expected(file), ...E_INVOICE_COLUMNS.map(([tool]) => verdictCell(file, tool))]),
          ),
        ]),
  ].join('\n')
}

const pct = (coverage) => (coverage === null ? '' : ['lines', 'branches', 'functions', 'statements'].map((metric) => (coverage[metric] === null ? '-' : String(coverage[metric]))).join(' / '))
const yesNo = (value) => (value ? 'yes' : 'no')

/** Results per package, the repository's guards and the install gate with its hosts. */
function resultsSection({ results }) {
  const rows = results.packages.map((row) =>
    row.present
      ? [row.package, yesNo(row.published), row.files, row.tests, row.passed, row.failed, row.skipped + row.todo, row.failedFiles.length, seconds(row.wallMs) || 'not measured', seconds(row.spanMs), pct(row.coverage) || 'not measured']
      : [row.package, yesNo(row.published), 'no results', '', '', '', '', '', '', '', ''],
  )
  const { repository, install } = results
  return [
    '## Results',
    '',
    table(['Package', 'Published', 'Files', 'Tests', 'Passed', 'Failed', 'Skipped or todo', 'Failed files', "Task's wall time (turbo)", 'First test start to last test end (vitest)', 'Coverage, lines / branches / functions / statements (reported, never gated)'], rows),
    '',
    repository.present ? `The repository's guards (\`pnpm test:repo\`): ${String(repository.passed)} of ${String(repository.tests)} passed in ${String(repository.files)} files.` : "The repository's guards left no results.",
    '',
    install === null ? 'The install gate left no results.' : `The install gate ${install.passed ? 'passed' : 'failed'} with npm ${String(install.npm)} on Node ${String(install.node)}, in a project per host:`,
    ...(install === null
      ? []
      : ['', table(['Install host', 'At', 'Installed beside', 'Every step passed'], install.hosts.map((host) => [host.project, host.at ?? '', Object.entries(host.installed).map(([name, version]) => `${name} ${String(version)}`).join(', ') || 'no framework', yesNo(host.passed)]))]),
  ].join('\n')
}

/** Build identity: each tarball and the jobs whose dist/ it holds. */
function identitySection({ results }) {
  return [
    '## Build identity',
    '',
    table(
      ['Package', 'Tarball', 'Tarball sha256', 'Its dist/', 'Jobs that built the same dist/'],
      results.buildIdentity.map((entry) => [entry.package, entry.tarball?.file ?? 'none', entry.tarball?.sha256 ?? '', entry.tarball?.distHash ?? '', entry.builds.filter((build) => build.distHash === entry.tarball?.distHash).map((build) => build.job).join(', ')]),
    ),
  ].join('\n')
}

/** Limitations, the method and the problems. */
function closingSection(report) {
  const statedLines = report.limitations.stated.flatMap((group) => [
    '',
    `### ${group.area}`,
    '',
    ...group.lines.map((line) => `- ${line.says} — stated by [${line.number} ${line.title}](${line.link}) (${line.status})${line.heldBy === undefined ? '' : `; held by ${code(line.heldBy)}, ${line.held === 'passed' ? 'passed in this run' : line.held === 'absent' ? 'which did not run' : 'which did not pass'}`}`),
  ])
  return [
    '## Known limitations',
    '',
    'Shown by this run:',
    '',
    ...derivedLimitations(report).map((sentence) => `- ${sentence}`),
    '',
    'Stated in the decision records, as each record states it:',
    ...statedLines,
    '',
    '## How this report was made',
    '',
    ...METHOD.map(([section, source]) => `- **${section}:** ${source}.`),
    '',
    '## Problems',
    '',
    report.problems.length === 0 ? 'None: nothing here fails the run.' : report.problems.map((problem) => `- ${problem}`).join('\n'),
  ].join('\n')
}

/** Every section after the subject. */
export function renderContent(report) {
  return [testedOnSection(report), resultsSection(report), browserSection(report), eInvoiceSection(report), identitySection(report), gatesSection(report), closingSection(report)].join('\n\n')
}

/** What is being released, as the subject's first line says it. */
function releaseName(subject) {
  if (subject.release === null) return subject.run === null ? 'a local run' : 'a CI run; nothing is released from it'
  return subject.release === 'dry-run' ? 'a rehearsal (`dry-run`); nothing is published from it' : `the release ${code(subject.release)}`
}

/** Which version, release, commit and run this is, and each job's machine. */
function subjectSection({ subject }) {
  const run = subject.run === null ? '' : ` Run [${String(subject.run.id)}](${subject.run.url}) of ${subject.run.workflow ?? 'the gates workflow'}, attempt ${String(subject.run.attempt ?? '?')}.`
  return [
    `Formancy Report ${subject.version}, ${releaseName(subject)}. Commit ${code(subject.commit)}${subject.dirty === true ? ', with uncommitted changes' : ''}.${run} Generated ${subject.generatedAt}.`,
    '',
    table(
      ['Job', 'Attempt', 'Runner image', 'Node', 'Platform'],
      subject.jobs.map((entry) => [entry.key, entry.attempt ?? '', [entry.runner?.image, entry.runner?.imageVersion].filter((value) => value != null).join(' '), entry.runner?.node ?? '', entry.runner ? `${entry.runner.platform} ${entry.runner.arch}` : '']),
    ),
  ].join('\n')
}

/** The whole report as Markdown: the title, a local run's banner, the subject and every section. */
export function renderReport(report, { local = false, partial = [] } = {}) {
  const banner = local ? [`local: no NEEDS, no artefacts${partial.length === 0 ? '' : `; partial: ${partial.join(', ')} allowed missing`}.`, ''] : []
  return `${['# Release report', '', ...banner, subjectSection(report), '', renderContent(report)].join('\n')}\n`
}

/**
 * What a release body carries of the report, after the changelog's
 * `section`: where the full report is (`link`), the counts and the derived
 * limitations.
 */
export function renderSummary(report, { section = null, link = null } = {}) {
  const packages = report.results.packages.filter((row) => row.present)
  const passed = packages.reduce((total, row) => total + row.passed, 0)
  const tests = packages.reduce((total, row) => total + row.tests, 0)
  const { install, eInvoice } = report.results
  return [
    ...(link === null ? [] : [`The full report of the run that gated this: ${link}`, '']),
    ...(section === null ? [] : [`The notes above are CHANGELOG.md’s ${code(section)} section.`, '']),
    `${String(passed)} of ${String(tests)} tests passed across ${String(packages.length)} packages; the install gate ${install === null ? 'left no results' : install.passed ? 'passed' : 'failed'}; the e-invoice gate ${eInvoice === null ? 'left no results' : eInvoice.passed ? 'passed' : 'failed'}.`,
    '',
    ...derivedLimitations(report).map((sentence) => `- ${sentence}`),
  ].join('\n')
}
