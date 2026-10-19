import { createHash } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { packageTarball } from '../release/test-archive.mjs'
import { installedTarballProblems, notesProblems, npmPurl, reportFilesProblems, reportProblems, sbomReportProblems } from './verify-publish.mjs'

/**
 * What a release refuses of the report before anything permanent happens
 * (0014; formancy.ai-data 0035): the report itself, the tarballs against the
 * install gate's record in it, the body it built and the SBOM against what
 * it says the suites loaded. Over a release made by hand -- two packages,
 * tarballs packed here -- with one defect introduced at a time.
 */
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const NAMES = ['@formancy/report-spec', '@formancy/report-render-pdf']
const fileOf = (name) => `${name.slice(1).replace('/', '-')}-0.1.0.tgz`
const RUN = { release: 'v0.1.0', version: '0.1.0', commit: 'c0ffee', runId: '42' }

/** An SBOM's dependency graph as cdxgen writes it, each reference a package URL: `{ 'a@1': ['b@2'] }`. */
const graph = (edges) => Object.entries(edges).map(([from, to]) => ({ ref: `pkg:npm/${from}`, dependsOn: to.map((target) => `pkg:npm/${target}`) }))

/** A release in which everything holds: the report, the tarballs as `describe` gives them, and the SBOM. */
function green() {
  const tarballs = NAMES.map((name) => {
    const bytes = packageTarball({ name, version: '0.1.0' })
    return { file: fileOf(name), name, sha256: sha256(bytes) }
  })
  return {
    report: {
      problems: [],
      subject: { version: '0.1.0', release: 'v0.1.0', commit: 'c0ffee', run: { id: '42' } },
      results: {
        buildIdentity: NAMES.map((name) => ({ package: name })),
        install: { tarballs: tarballs.map(({ file, name, sha256: hash }) => ({ name, file, sha256: hash })) },
      },
      testedOn: {
        runtime: [{ package: '@formancy/report-render-pdf', name: 'pdfmake', loaded: '0.3.11' }],
        upstream: [
          { name: '@formancy/spec', version: '0.5.0', direct: true, shipped: true },
          { name: '@formancy/expressions', version: '0.5.0', direct: false, shipped: true },
          { name: '@formancy/themes', version: '0.5.0', direct: true, shipped: false },
        ],
      },
    },
    tarballs,
    sbom: {
      components: ['pkg:npm/pdfmake@0.3.11', 'pkg:npm/%40formancy/spec@0.5.0', 'pkg:npm/%40formancy/report-spec@0.1.0', 'pkg:npm/%40formancy/report-render-pdf@0.1.0', 'pkg:npm/%40formancy/expressions@0.5.0', 'pkg:npm/tslib@2.8.1'].map((purl) => ({ purl })),
      dependencies: graph({
        '@formancy/report-spec@0.1.0': ['@formancy/spec@0.5.0'],
        '@formancy/report-render-pdf@0.1.0': ['@formancy/report-spec@0.1.0', 'pdfmake@0.3.11'],
        '@formancy/spec@0.5.0': ['@formancy/expressions@0.5.0'],
      }),
    },
  }
}

describe('the report', () => {
  // A refusal on good input is a release nobody can cut.
  test('is refused nothing when it is this run’s, green and whole', () => {
    expect(reportProblems(green().report, RUN)).toEqual([])
  })

  // A report of another commit, run, release or version is evidence about
  // something else, however green.
  test('is refused when it is of another commit, run, release or version', () => {
    const { report } = green()
    expect(reportProblems(report, { ...RUN, commit: 'decaf' })).toEqual(['the report is of commit c0ffee, not decaf'])
    expect(reportProblems(report, { ...RUN, runId: '43' })).toEqual(['the report is of run 42, not this run, 43'])
    expect(reportProblems(report, { ...RUN, release: 'dry-run' })).toEqual(['the report is of the release v0.1.0, not dry-run'])
    expect(reportProblems(report, { ...RUN, version: '0.2.0' })).toEqual(['the report is of version 0.1.0, not 0.2.0'])
  })

  // A report that failed, or one made on a machine with parts allowed
  // missing, did not gate this release; one with no list of problems at all
  // is no report this repository wrote.
  test('is refused when it has problems, is partial or local, or lists none at all', () => {
    const with_ = (change) => reportProblems({ ...green().report, ...change }, RUN)
    expect(with_({ problems: ['@formancy/report-spec: 1 test(s) failed'] })).toEqual(['the report has 1 problem(s), the first: @formancy/report-spec: 1 test(s) failed'])
    expect(with_({ partial: ['install'] })).toEqual(['the report is partial: install allowed missing'])
    expect(with_({ local: true })).toEqual(['the report is a local one, and a release reads only the report its own gates built'])
    expect(with_({ problems: undefined })).toEqual(['the report lists no problems at all, not even none'])
  })

  // The report's directory is pinned whole and handed to publish; a file
  // in it the report job never writes -- a tarball, say -- would be pinned
  // without any check of what it is.
  test('is refused when its directory holds anything but the report and the body', () => {
    expect(reportFilesProblems(['RELEASE_NOTES.md', 'release-report.json', 'release-report.md'])).toEqual([])
    expect(reportFilesProblems(['RELEASE_NOTES.md', 'release-report.json', 'release-report.md', 'formancy-report-spec-0.1.0.tgz'])).toEqual([
      'release-report/formancy-report-spec-0.1.0.tgz is no file the report job writes',
    ])
    // The body's absence is notesProblems' to say, once.
    expect(reportFilesProblems(['release-report.md'])).toEqual(['release-report/release-report.json is missing'])
  })
})

describe('the tarballs against the report', () => {
  // One byte different is a tarball no gate installed or ran.
  test('are refused when one is not, byte for byte, the install gate’s', () => {
    const { report, tarballs } = green()
    expect(installedTarballProblems(report, tarballs)).toEqual([])
    tarballs[1] = { ...tarballs[1], sha256: 'f'.repeat(64) }
    expect(installedTarballProblems(report, tarballs)).toEqual([`formancy-report-render-pdf-0.1.0.tgz has sha256 ${'f'.repeat(64)}, not that of the formancy-report-render-pdf-0.1.0.tgz the install gate installed and ran, ${green().tarballs[1].sha256}`])
  })

  // A package without a tarball is a release that leaves it behind; a
  // tarball of something else is one that publishes what no gate meant to.
  test('are refused when one is missing, or one is no published package’s', () => {
    const { report, tarballs } = green()
    expect(installedTarballProblems(report, tarballs.slice(0, 1))).toEqual(['@formancy/report-render-pdf: 0 tarballs, where a release publishes exactly one'])
    expect(installedTarballProblems(report, [...tarballs, { file: 'formancy-report-corpus-0.1.0.tgz', name: '@formancy/report-corpus', sha256: 'a'.repeat(64) }])).toEqual([
      'formancy-report-corpus-0.1.0.tgz is @formancy/report-corpus, which is no published package',
    ])
  })
})

describe('the release body', () => {
  // The GitHub release is the last step, after npm; a body it would refuse
  // must be found before.
  test('is refused when missing or longer than GitHub accepts', () => {
    expect(notesProblems('## 0.1.0\n\nThe first.\n')).toEqual([])
    expect(notesProblems(null)).toEqual(['the report job wrote no release body'])
    expect(notesProblems('x'.repeat(125_001))).toEqual(['the release body is 125001 characters, over the 125000 GitHub accepts'])
  })
})

describe('the SBOM', () => {
  // An inventory naming another pdfmake than the suites ran describes a
  // release nobody tested; one that leaves out the engine that draws every
  // PDF, or an upstream package the packages depend on -- declared, or
  // brought by another upstream package -- omits what a customer installs.
  test('is refused with another version than the suites loaded, or without a runtime dependency or an upstream package', () => {
    const { report, sbom } = green()
    expect(sbomReportProblems(report, sbom)).toEqual([])
    const replaced = (index, purl) => ({ ...sbom, components: sbom.components.map((component, at) => (at === index ? { purl } : component)) })
    const without = (part) => ({ ...sbom, components: sbom.components.filter((component) => !component.purl.includes(part)) })
    const older = {
      components: [...sbom.components.slice(1), { purl: 'pkg:npm/pdfmake@0.3.10' }],
      dependencies: sbom.dependencies.map((entry) => ({ ...entry, dependsOn: entry.dependsOn.map((ref) => ref.replace('pdfmake@0.3.11', 'pdfmake@0.3.10')) })),
    }
    expect(sbomReportProblems(report, older)).toEqual(['the SBOM gives @formancy/report-render-pdf pdfmake 0.3.10, where its suites loaded 0.3.11'])
    expect(sbomReportProblems(report, replaced(1, 'pkg:npm/%40formancy/spec@0.4.0'))).toEqual(['the SBOM names @formancy/spec 0.4.0, where the suites loaded 0.5.0'])
    expect(sbomReportProblems(report, without('pdfmake'))).toEqual(['the SBOM names no pdfmake 0.3.11, which @formancy/report-render-pdf depends on'])
    expect(sbomReportProblems(report, without('spec@0.5.0'))).toEqual(['the SBOM names no @formancy/spec, which a published package depends on'])
    expect(sbomReportProblems(report, without('expressions'))).toEqual(['the SBOM names no @formancy/expressions, which a published package depends on'])
  })

  // The v0.2.0 rehearsal was refused for pdfkit's @noble/hashes 1.8.0,
  // which pdfmake brings, beside report-spec's 2.4.0: a consumer installs
  // both, and only the second is a dependency a published package declares
  // and its suites loaded. A check by name alone refuses every SBOM that is
  // right once two packages want one name at two versions; by the edge from
  // the package that declares it, it still refuses report-spec given 1.8.0.
  test('reads each runtime dependency as the package that declares it is given it, another at another version beside it', () => {
    const { report, sbom } = green()
    report.testedOn.runtime.push({ package: '@formancy/report-spec', name: '@noble/hashes', loaded: '2.4.0' })
    const both = (specGets) => ({
      components: [...sbom.components, ...['pkg:npm/pdfkit@0.19.1', 'pkg:npm/%40noble/hashes@1.8.0', 'pkg:npm/%40noble/hashes@2.4.0'].map((purl) => ({ purl }))],
      dependencies: [
        ...sbom.dependencies.map((entry) => (entry.ref.includes('report-spec@') ? { ...entry, dependsOn: [...entry.dependsOn, `pkg:npm/@noble/hashes@${specGets}`] } : entry)),
        ...graph({ 'pdfmake@0.3.11': ['pdfkit@0.19.1'], 'pdfkit@0.19.1': ['@noble/hashes@1.8.0'] }),
      ],
    })
    expect(sbomReportProblems(report, both('2.4.0'))).toEqual([])
    expect(sbomReportProblems(report, both('1.8.0'))).toEqual(['the SBOM gives @formancy/report-spec @noble/hashes 1.8.0, where its suites loaded 2.4.0'])
  })

  // An SBOM without its dependency graph cannot say what a published
  // package is given, so it says nothing that passes.
  test('is refused when it records no dependency of a published package on its runtime dependency', () => {
    const { report, sbom } = green()
    expect(sbomReportProblems(report, { components: sbom.components })).toEqual(['the SBOM records no dependency of @formancy/report-render-pdf on pdfmake'])
  })

  // The v0.1.0 tag's run was refused for asking an SBOM of what ships for
  // @formancy/themes, which only the private Studio declares: a check that
  // asks for what no consumer installs fails every SBOM that is right.
  test('is not asked for an upstream package no published package installs', () => {
    const { report, sbom } = green()
    expect(sbom.components.some((component) => component.purl.includes('themes'))).toBe(false)
    expect(sbomReportProblems(report, sbom)).toEqual([])
  })

  // The v0.1.0 tag's first SBOM was cdxgen's reading of the workspace: it
  // named vitest and Playwright as required, left out tslib, and named none
  // of the packages being published, which an SBOM of a release describes
  // first.
  test('is refused without each published package, at the version this release publishes', () => {
    const { report, sbom } = green()
    expect(sbomReportProblems(report, { ...sbom, components: sbom.components.filter((component) => !component.purl.includes('report-render-pdf')) })).toEqual(['the SBOM names no @formancy/report-render-pdf 0.1.0, which this release publishes'])
    const older = { ...sbom, components: sbom.components.map((component) => (component.purl.includes('report-spec') ? { purl: 'pkg:npm/%40formancy/report-spec@0.0.9' } : component)) }
    expect(sbomReportProblems(report, older)).toEqual(['the SBOM names no @formancy/report-spec 0.1.0, which this release publishes'])
  })

  // Both spellings a package URL gives a scoped name.
  test('reads a scoped package URL, encoded or not', () => {
    expect(npmPurl('pkg:npm/%40formancy/spec@0.5.0?type=module')).toEqual({ name: '@formancy/spec', version: '0.5.0' })
    expect(npmPurl('pkg:npm/@formancy/spec@0.5.0')).toEqual({ name: '@formancy/spec', version: '0.5.0' })
    expect(npmPurl('pkg:pypi/x@1')).toBeUndefined()
  })
})
