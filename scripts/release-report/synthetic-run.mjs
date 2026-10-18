// A whole green run, made by hand, for report.test.mjs and render.test.mjs:
// the inputs buildReport takes, as small as they can be and still hold every
// part of the report. Test support only, as formancy.ai-data's is. Each test
// copies it and introduces one defect, so a check is seen to fire on that
// defect and on nothing else.
//
// Pure logic over hand-made results; no engine is mocked, because none is
// involved -- what the report reads are files the suites and the install
// gate wrote.

const T0 = Date.parse('2026-10-16T10:00:00Z')

export const DIST = 'sha256:aaaa111122223333444455556666777788889999aaaabbbbccccddddeeeeffff'

const runner = { node: 'v22.20.0', platform: 'linux', arch: 'x64', image: 'ubuntu24', imageVersion: '20261012.1' }
const base = (key, job) => ({ schema: 1, job, key, runner, commit: 'c0ffee', run: { id: '42', attempt: '1' }, collectedAt: new Date(T0 + 3_600_000).toISOString(), suites: [], browserGates: [], pictures: [], install: null, eInvoice: null, dist: [], tarballs: [], absent: [], missing: [] })

/** The Chromium Playwright pins, and the one the gate launched. */
export const CHROMIUM = '156.0.8078.4'
const launched = { name: 'chromium', version: CHROMIUM, headless: true, platform: 'linux', arch: 'x64' }
/** Two passes of the gate, each making the same checks, as apps/studio/scripts/gate-results.mjs records them. */
const pass = (label, width) => ({ label, width, height: 900, checks: ['the first Tab reaches the skip link', 'the switch: the builder shown is Angular’s'], failed: [] })

/** The Studio's browser gate in Chromium and its pictures' check, as each writes its file, every check passed and every scene walked. */
const browserJob = () => ({
  ...base('browser', 'browser'),
  browserGates: [
    {
      gate: 'apps/studio',
      asked: 'chromium',
      startedAt: new Date(T0 + 200_000).toISOString(),
      finishedAt: new Date(T0 + 380_000).toISOString(),
      browser: { ...launched },
      playwright: '1.64.1',
      axe: '4.14.0',
      widths: [320, 360],
      planned: ['reflow, 320', 'phone, 360'],
      passes: 2,
      made: [pass('reflow, 320', 320), pass('phone, 360', 360)],
      checks: { ok: 4, failed: [] },
      measurements: [],
    },
  ],
  pictures: [
    {
      check: 'pictures',
      app: 'apps/studio',
      startedAt: new Date(T0 + 400_000).toISOString(),
      finishedAt: new Date(T0 + 430_000).toISOString(),
      playwright: '1.64.1',
      browser: { name: 'chromium', version: CHROMIUM, headless: true },
      walked: ['studio-react', 'studio-angular'],
      problems: [],
    },
  ],
  // turbo builds every package the Studio imports before the gate.
  dist: dist(),
})

/** The e-invoice gate's tools, as docs/release/e-invoice-tools.json pins them: each JAR with the oldest Java it runs on, the configuration with none. */
const E_INVOICE_TOOLS = [
  { id: 'mustang', version: '2.26.0', sha256: 'aa'.repeat(32), java: 11 },
  { id: 'kosit', version: '1.6.3', sha256: 'bb'.repeat(32), java: 11 },
  { id: 'xrechnung-configuration', version: '2026-08-31', sha256: 'cc'.repeat(32), java: null },
  { id: 'verapdf', version: '1.30.3', sha256: 'dd'.repeat(32), java: 8 },
]

/** What the gate records it ran: each tool's bytes as it hashed them, and the version each JAR reported of itself. */
const E_INVOICE_RAN = [
  { id: 'mustang', version: '2.26.0', sha256: 'aa'.repeat(32), reported: ['2.26.0'], bundles: { verapdf: ['1.30.2'] } },
  { id: 'kosit', version: '1.6.3', sha256: 'bb'.repeat(32), reported: '1.6.3' },
  { id: 'xrechnung-configuration', version: '2026-08-31', sha256: 'cc'.repeat(32) },
  { id: 'verapdf', version: '1.30.3', sha256: 'dd'.repeat(32), reported: ['1.30.3'] },
]

/**
 * The e-invoice gate's record, as scripts/e-invoice.mjs writes it: an XML
 * sample Mustang and KoSIT accepted and a control both refused, and a PDF
 * sample and a variant veraPDF and Mustang accepted and a control both
 * refused, each as its corpus expects.
 */
const eInvoiceJob = () => ({
  ...base('e-invoice', 'e-invoice'),
  eInvoice: {
    gate: 'e-invoice',
    startedAt: new Date(T0 + 500_000).toISOString(),
    finishedAt: new Date(T0 + 545_000).toISOString(),
    java: { version: '17.0.20.1', major: 17 },
    tools: E_INVOICE_RAN.map((tool) => structuredClone(tool)),
    corpus: [
      { file: 'e-invoice.xml', format: 'xml', sample: 'e-invoice', expect: { mustang: 'accepted', kosit: 'accepted' } },
      { file: 'control-br-27.xml', format: 'xml', from: 'e-invoice.xml', why: 'a negative net price', expect: { mustang: ['error 4 BR-27', 'warning 10'], kosit: ['error val-sch.1 BR-27'] } },
      { file: 'e-invoice.pdf', format: 'pdf', sample: 'e-invoice', expect: { verapdf: 'accepted', mustang: 'accepted' } },
      { file: 'control-pdfa.pdf', format: 'pdf', from: 'e-invoice.pdf', why: 'no output intent', expect: { verapdf: ['6.2.4.3-2'], mustang: ['pdfa 3b 6.2.4.3-2'] } },
      { file: 'variant-blocks.pdf', format: 'pdf', variant: { blocks: true }, why: 'an image of every kind', expect: { verapdf: 'accepted', mustang: 'accepted' } },
    ],
    mustang: [
      { file: 'e-invoice.xml', verdict: 'as expected' },
      { file: 'control-br-27.xml', verdict: 'as expected' },
      { file: 'e-invoice.pdf', verdict: 'as expected' },
      { file: 'control-pdfa.pdf', verdict: 'as expected' },
      { file: 'variant-blocks.pdf', verdict: 'as expected' },
    ],
    kosit: [
      { file: 'e-invoice.xml', verdict: 'as expected' },
      { file: 'control-br-27.xml', verdict: 'as expected' },
    ],
    verapdf: [
      { file: 'e-invoice.pdf', verdict: 'as expected' },
      { file: 'control-pdfa.pdf', verdict: 'as expected' },
      { file: 'variant-blocks.pdf', verdict: 'as expected' },
    ],
    seconds: { draw: 0.9, mustang: 47.5, kosit: 6.5, verapdf: 2.4, total: 59.2 },
    problems: [],
    passed: true,
  },
  // Its job builds every package as verify does; left out here, as the
  // corpus suite's is, so no build-identity case names one job more.
  dist: [],
})

const test = (name) => ({ name, status: 'passed', durationMs: 5 })
const file = (path, tests) => ({ file: path, status: 'passed', startTime: T0 + 1000, endTime: T0 + 2000, tests })
const suite = (name, path, files) => ({
  package: name,
  path,
  success: true,
  numTotalTests: files.reduce((total, entry) => total + entry.tests.length, 0),
  numFailedTestSuites: 0,
  startTime: T0,
  files,
  // Every test file the checkout holds for the suite: the ones it ran.
  testFiles: files.map((entry) => entry.file),
  task: { startTime: T0 - 5000, endTime: T0 + 9000, cache: 'MISS' },
  coverage: { lines: { pct: 91.2 }, branches: { pct: 80 }, functions: { pct: 95 }, statements: { pct: 90.1 } },
})

const PUBLISHED = ['@formancy/report-builder-react', '@formancy/report-render-pdf', '@formancy/report-spec']
/** Each job's own record of what it built: new objects every time, so a test that changes one job's changes no other's. */
const dist = (names = PUBLISHED) => names.map((name) => ({ package: name, distHash: DIST }))
/** A suite test job, which builds what its package depends on: report-spec, here. */
const testJob = (id, name, path, files) => ({ ...base(`test-${id}`, 'test'), package: name, suites: [suite(name, path, files)], dist: dist(['@formancy/report-spec']) })

/** One install host's record, as scripts/install-test.mjs writes it: the framework it installed, the tools, what it resolved, and every step done. */
const host = (project, at, installed, resolved = [{ name: '@formancy/spec', version: '0.5.0' }]) => ({
  project,
  consumer: project.startsWith('react') ? 'react.tsx' : 'consume.ts',
  at,
  npmInstalled: true,
  installed,
  tools: { typescript: '6.0.3' },
  resolved,
  steps: [
    { step: 'type-check', done: true, said: '' },
    { step: 'run', done: true, said: 'ok' },
  ],
})

/** The inputs of a run in which everything passed. */
export function greenRun() {
  const verify = { ...base('verify', 'verify'), suites: [suite(null, '.', [file('scripts/upstream-deps.test.mjs', [test('depends on upstream only at exact released versions')])])], dist: dist() }
  const spec = testJob('report-spec', '@formancy/report-spec', 'packages/report-spec', [
    file('packages/report-spec/src/hash.test.ts', [test('pins the hash of a fixed report')]),
    file('packages/report-spec/src/validate.test.ts', [test('refuses an unknown property')]),
  ])
  const pdf = testJob('report-render-pdf', '@formancy/report-render-pdf', 'packages/report-render-pdf', [
    file('packages/report-render-pdf/src/corpus.test.ts', [test('renders every fixture of the corpus')]),
    file('packages/report-render-pdf/src/glyphs.test.ts', [test('refuses a character the face has no glyph for')]),
  ])
  const react = testJob('report-builder-react', '@formancy/report-builder-react', 'packages/report-builder-react', [file('packages/report-builder-react/src/scenarios.test.tsx', [test('en: inserts a text block')])])
  const corpus = { ...testJob('report-corpus', '@formancy/report-corpus', 'packages/report-corpus', [file('packages/report-corpus/src/checks.test.ts', [test('finds a lost row')])]), dist: [] }
  const install = {
    ...base('install', 'install'),
    install: {
      startedAt: new Date(T0).toISOString(),
      finishedAt: new Date(T0 + 120_000).toISOString(),
      passed: true,
      node: 'v22.20.0',
      npm: '10.9.0',
      resolved: [
        { name: '@formancy/spec', version: '0.5.0' },
        { name: 'pdfmake', version: '0.3.11' },
      ],
      tarballs: PUBLISHED.map((name) => ({ name, version: '0.1.0', file: `${name.slice(1).replace('/', '-')}-0.1.0.tgz`, sha256: 'ab'.repeat(32), integrity: 'sha512-x', distHash: DIST })),
      consumers: [
        // The renderer is the Node host's alone, so pdfmake is resolved there.
        host('node', null, {}, [
          { name: '@formancy/spec', version: '0.5.0' },
          { name: 'pdfmake', version: '0.3.11' },
        ]),
        host('react', 'newest', { react: '19.3.1', 'react-dom': '19.3.1' }),
        host('react-floor', 'floor', { react: '19.0.0', 'react-dom': '19.0.0' }),
      ],
    },
    dist: dist(),
  }
  return {
    results: [verify, spec, pdf, react, corpus, browserJob(), install, eInvoiceJob()],
    facts: {
      runtime: [{ package: '@formancy/report-render-pdf', name: 'pdfmake', range: '0.3.11', loaded: '0.3.11' }],
      peers: [
        { package: '@formancy/report-builder-react', name: 'react', range: '^19.0.0', loaded: '19.3.1' },
        { package: '@formancy/report-builder-react', name: 'react-dom', range: '^19.0.0', loaded: '19.3.1' },
      ],
      upstream: [{ name: '@formancy/spec', version: '0.5.0', declared: '0.5.0', direct: true }],
      node: { engines: '>=22.13.0', ci: [{ workflow: 'gates.yml', job: 'verify', version: '22' }], declared: [] },
      packageManager: { name: 'pnpm', version: '12.4.2', declared: 'pnpm@12.4.2' },
      browser: { playwright: '1.64.1', pins: [{ browser: 'chromium', name: 'chromium-headless-shell', revision: '1248', browserVersion: CHROMIUM, headless: true }] },
      tooling: [
        { name: 'typescript', declared: '~6.0.3', versions: [{ version: '6.0.3', from: ['.'] }] },
        { name: 'pdfjs-dist', declared: '6.4.299', versions: [{ version: '6.4.299', from: ['packages/report-corpus'] }] },
      ],
    },
    // What scripts/install-hosts.mjs plans for these packages: the Node host,
    // and the one builder at the newest and the floor of its peer ranges.
    installPlan: {
      hosts: [
        { project: 'node', at: null, peers: {} },
        { project: 'react', at: 'newest', peers: { react: '^19.0.0', 'react-dom': '^19.0.0' } },
        { project: 'react-floor', at: 'floor', peers: { react: '19.0.0', 'react-dom': '19.0.0' } },
      ],
      error: null,
    },
    covered: [
      { path: 'packages/report-builder-react', id: 'report-builder-react', name: '@formancy/report-builder-react' },
      { path: 'packages/report-corpus', id: 'report-corpus', name: '@formancy/report-corpus' },
      { path: 'packages/report-render-pdf', id: 'report-render-pdf', name: '@formancy/report-render-pdf' },
      { path: 'packages/report-spec', id: 'report-spec', name: '@formancy/report-spec' },
    ],
    published: [...PUBLISHED],
    browserApps: ['apps/studio'],
    pictureApps: ['apps/studio'],
    browsers: ['chromium'],
    // What docs/release/e-invoice-tools.json pins: the tools the e-invoice gate must have run.
    eInvoiceTools: { tools: E_INVOICE_TOOLS.map((tool) => ({ ...tool })), runtime: { name: 'Eclipse Temurin', distribution: 'temurin', java: 17 }, veraPdfFloor: { version: '1.30.2', advisories: ['GHSA-3jh7-wm29-q568', 'GHSA-36mm-w85j-3q2j'], why: 'two XML external entity flaws' } },
    // What scripts/pictures/scenes.json gives the Studio: the scenes its check must walk.
    scenes: { 'apps/studio': ['studio-react', 'studio-angular'] },
    register: {
      records: {
        '0011': {
          reviewed: 'sha256:11',
          limitations: [{ area: 'rendering', says: 'One font: a character Roboto has no glyph for is refused.', heldBy: 'packages/report-render-pdf/src/glyphs.test.ts' }],
        },
      },
    },
    records: [{ number: '0011', file: '0011-report-render-pdf-draws.md', title: 'report-render-pdf draws the document', status: 'accepted', hash: 'sha256:11' }],
    jobs: [...JOBS],
    // Evidence no other test's defect touches, so each defect still gives
    // exactly its own sentence; gates.test.mjs and the gate tests here change it.
    gatesRegister: { gates: GATE_IDS.map((gate) => ({ gate, ...structuredClone(EVIDENCE[gate]) })) },
    documents: { [DOCUMENT]: { sha: '1234567890abcdef1234567890abcdef12345678', date: '2026-10-14T12:00:00+02:00', behind: 3 } },
    exists: () => true,
    repository: 'https://github.com/sharkysan/formancy.ai-report',
    commit: 'c0ffee',
    version: '0.1.0',
    release: '',
    changelog: ['# Changelog', '', '## Unreleased', '', 'Something changed.', '', '## 0.2.0', '', 'Ahead of the manifests.', '', '## 0.1.0', '', 'The first.', ''].join('\n'),
    generatedAt: new Date(T0 + 3_700_000).toISOString(),
  }
}

/** The gates workflow's jobs that leave results, as greenCiRun() runs them. */
const JOBS = ['verify', 'test', 'browser', 'install', 'e-invoice']
/** The register's gates, in its order. */
const GATE_IDS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'legal']
/** A committed document, as a gate's stated evidence would be. */
export const DOCUMENT = 'docs/renderer-trial.md'
export const OPEN = 'Nothing to test yet.'
const EVIDENCE = {
  G1: { evidence: [{ file: 'scripts/upstream-deps.test.mjs' }] },
  G2: { evidence: [{ file: 'packages/report-render-pdf/src/corpus.test.ts' }] },
  G3: { evidence: [{ file: 'packages/report-builder-react/src/scenarios.test.tsx' }, { browserGate: 'apps/studio' }], open: 'Nothing compares the two builders’ accessible trees.' },
  G4: { evidence: [{ document: DOCUMENT }] },
  G5: { open: OPEN },
  G6: { open: OPEN },
  G7: { open: OPEN },
  legal: { open: 'Needs a lawyer.' },
}

/**
 * greenRun() as the report job sees it in CI: every job's results in an
 * artefact of its own name, every job's result in `needs` a success, this
 * run's id, and G1 resting on the install job as well.
 */
export function greenCiRun() {
  const { results, ...inputs } = greenRun()
  inputs.gatesRegister.gates[0].evidence.push({ job: 'install' })
  return {
    ...inputs,
    mode: 'ci',
    artefacts: results.map((result) => ({ name: `release-results-${result.key}`, files: [{ file: `${result.key}.json`, result }] })),
    expected: results.map(({ key, job }) => ({ key, job })),
    needs: Object.fromEntries(JOBS.map((name) => [name, { result: 'success', outputs: {} }])),
    run: { id: '42', attempt: '1', workflow: 'CI', url: 'https://github.com/sharkysan/formancy.ai-report/actions/runs/42' },
  }
}

/** The results file of `key` in a CI run's artefacts. */
export const ciJob = (inputs, key) => inputs.artefacts.flatMap((artefact) => artefact.files).find((entry) => entry.result?.key === key)?.result

/** A deep copy of a run's inputs, for a test to change one thing in; `exists` is a function, and kept. */
export const copy = ({ exists, ...rest }) => ({ ...structuredClone(rest), exists })

/** The results file of `key` in `inputs`. */
export const job = (inputs, key) => inputs.results.find((result) => result.key === key)
