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
        runtime: [{ name: 'pdfmake', loaded: '0.3.11' }],
        upstream: [
          { name: '@formancy/spec', version: '0.5.0', direct: true },
          { name: '@formancy/expressions', version: '0.5.0', direct: false },
        ],
      },
    },
    tarballs,
    sbom: { components: ['pkg:npm/pdfmake@0.3.11', 'pkg:npm/%40formancy/spec@0.5.0', 'pkg:npm/%40formancy/report-spec@0.1.0', 'pkg:npm/tslib@2.8.1'].map((purl) => ({ purl })) },
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
  // PDF, or an upstream package the packages depend on, omits what a
  // customer installs.
  test('is refused with another version than the suites loaded, or without a runtime dependency or an upstream package', () => {
    const { report, sbom } = green()
    expect(sbomReportProblems(report, sbom)).toEqual([])
    const replaced = (index, purl) => ({ components: sbom.components.map((component, at) => (at === index ? { purl } : component)) })
    expect(sbomReportProblems(report, replaced(0, 'pkg:npm/pdfmake@0.3.10'))).toEqual(['the SBOM names pdfmake 0.3.10, where the suites loaded 0.3.11'])
    expect(sbomReportProblems(report, replaced(1, 'pkg:npm/%40formancy/spec@0.4.0'))).toEqual(['the SBOM names @formancy/spec 0.4.0, where the suites loaded 0.5.0'])
    expect(sbomReportProblems(report, { components: sbom.components.slice(1) })).toEqual(['the SBOM names no pdfmake, which a published package depends on'])
    expect(sbomReportProblems(report, { components: sbom.components.filter((component) => !component.purl.includes('spec@0.5.0')) })).toEqual(['the SBOM names no @formancy/spec, which a published package depends on'])
  })

  // Both spellings a package URL gives a scoped name.
  test('reads a scoped package URL, encoded or not', () => {
    expect(npmPurl('pkg:npm/%40formancy/spec@0.5.0?type=module')).toEqual({ name: '@formancy/spec', version: '0.5.0' })
    expect(npmPurl('pkg:npm/@formancy/spec@0.5.0')).toEqual({ name: '@formancy/spec', version: '0.5.0' })
    expect(npmPurl('pkg:pypi/x@1')).toBeUndefined()
  })
})
