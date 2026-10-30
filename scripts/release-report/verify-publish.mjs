// What a release checks of the report before anything permanent happens
// (0014; formancy.ai-data 0035's verify-publish), in release.yml's `check`
// job, which holds `contents: read` and no secret, and again in its
// `publish` job, before anything is signed or sent. scripts/release/pins.mjs
// runs these beside its own checks of the tarballs and the SBOM, and pins
// what passed; scripts/release/publish.mjs runs reportProblems again in the
// step that holds the npm token.
//
// Refused, a sentence each: a report with problems, a partial or local one,
// or one of another commit, run, release or version; a report directory
// holding a file the report job never writes; tarballs that are not exactly
// one per published package, or not byte for byte the ones the install gate
// installed and ran; a release body that is missing or longer than GitHub
// accepts; and an SBOM that leaves out an upstream package a published
// package depends on or names one at another version than the suites
// loaded, or whose dependency graph does not give a published package each
// runtime dependency it declares at the version its suites loaded.
//
// Pure, and Node's built-ins only: the publish job installs nothing.

import { BODY_LIMIT } from '../release-notes.mjs'

/** The files the report job writes into its directory, the first two always. */
export const REPORT_FILES = ['release-report.json', 'release-report.md', 'RELEASE_NOTES.md']

/** A package URL's npm name and version: `pkg:npm/%40formancy/spec@0.5.0?x` is `@formancy/spec`, `0.5.0`. */
export function npmPurl(purl) {
  const match = /^pkg:npm\/((?:%40|@)?[^@?#]+)@([^?#]+)/.exec(String(purl ?? ''))
  return match === null ? undefined : { name: decodeURIComponent(match[1]), version: decodeURIComponent(match[2]) }
}

/** The report itself: green, whole, and of this commit, run, release and version. */
export function reportProblems(report, { release, version, commit, runId }) {
  const problems = []
  if (report.local === true) problems.push('the report is a local one, and a release reads only the report its own gates built')
  if (Array.isArray(report.partial) && report.partial.length > 0) problems.push(`the report is partial: ${report.partial.join(', ')} allowed missing`)
  if (!Array.isArray(report.problems)) problems.push('the report lists no problems at all, not even none')
  else if (report.problems.length > 0) problems.push(`the report has ${String(report.problems.length)} problem(s), the first: ${report.problems[0]}`)
  const subject = report.subject ?? {}
  if (subject.commit !== commit) problems.push(`the report is of commit ${String(subject.commit)}, not ${commit}`)
  if (String(subject.run?.id) !== String(runId)) problems.push(`the report is of run ${String(subject.run?.id)}, not this run, ${String(runId)}`)
  if (subject.release !== release) problems.push(`the report is of the release ${String(subject.release)}, not ${release}`)
  if (subject.version !== version) problems.push(`the report is of version ${String(subject.version)}, not ${version}`)
  return problems
}

/** The report's directory, by the names of the files in it: the report's two files, the body, and nothing else. */
export function reportFilesProblems(names) {
  return [
    ...names.filter((name) => !REPORT_FILES.includes(name)).map((name) => `release-report/${name} is no file the report job writes`),
    ...REPORT_FILES.slice(0, 2)
      .filter((name) => !names.includes(name))
      .map((name) => `release-report/${name} is missing`),
  ]
}

/**
 * The tarballs (`[{ file, name, sha256 }]`) against the report: one per
 * published package, each, by name and sha256, the one the install gate
 * installed and ran.
 */
export function installedTarballProblems(report, tarballs) {
  const problems = []
  const published = (report.results?.buildIdentity ?? []).map((entry) => entry.package).sort()
  const installed = new Map((report.results?.install?.tarballs ?? []).map((entry) => [entry.name, entry]))
  for (const name of published) {
    const count = tarballs.filter((tarball) => tarball.name === name).length
    if (count !== 1) problems.push(`${name}: ${String(count)} tarballs, where a release publishes exactly one`)
  }
  for (const tarball of tarballs) {
    if (!published.includes(tarball.name)) {
      problems.push(`${tarball.file} is ${String(tarball.name)}, which is no published package`)
      continue
    }
    const gate = installed.get(tarball.name)
    if (gate === undefined) problems.push(`${tarball.file}: the install gate recorded no tarball of ${tarball.name}`)
    else if (gate.sha256 !== tarball.sha256 || gate.file !== tarball.file)
      problems.push(`${tarball.file} has sha256 ${tarball.sha256}, not that of the ${gate.file} the install gate installed and ran, ${gate.sha256}`)
  }
  return problems
}

/** The release body the report job built: there, and within what GitHub accepts. */
export function notesProblems(notes) {
  if (notes === null) return ['the report job wrote no release body']
  return notes.length > BODY_LIMIT ? [`the release body is ${String(notes.length)} characters, over the ${String(BODY_LIMIT)} GitHub accepts`] : []
}

/**
 * The SBOM's dependency graph: each package's `name@version` to the
 * packages, `{ name, version }`, it depends on. cdxgen writes each
 * reference as the package's URL.
 */
function dependencyGraph(sbom) {
  const graph = new Map()
  for (const { ref, dependsOn } of sbom?.dependencies ?? []) {
    const from = npmPurl(ref)
    if (from !== undefined)
      graph.set(
        `${from.name}@${from.version}`,
        (dependsOn ?? []).map(npmPurl).filter((to) => to !== undefined),
      )
  }
  return graph
}

/**
 * The SBOM against the report: every package this release publishes is
 * named at its version; every upstream package a consumer's install of them
 * brings is named, and every one the report names, transitive ones
 * included, at a version the suites loaded; and each published package is
 * given each runtime dependency it declares at the version its suites
 * loaded, read from the SBOM's dependency graph.
 */
export function sbomReportProblems(report, sbom) {
  const problems = []
  const components = (sbom?.components ?? []).map((component) => npmPurl(component.purl)).filter((entry) => entry !== undefined)
  const runtime = report.testedOn?.runtime ?? []
  const upstream = report.testedOn?.upstream ?? []
  const loaded = new Map()
  for (const entry of upstream) loaded.set(entry.name, new Set([...(loaded.get(entry.name) ?? []), entry.version]))
  // What a consumer's install of the published packages brings: every
  // upstream package it installs -- not one only the private Studio or a
  // test declares -- and, below, their runtime dependencies.
  for (const name of new Set(upstream.filter((entry) => entry.shipped).map((entry) => entry.name))) {
    if (!components.some((component) => component.name === name)) problems.push(`the SBOM names no ${name}, which a published package depends on`)
  }
  // And, first of all, what this release publishes, at its version.
  const version = report.subject?.version
  for (const { package: name } of report.results?.buildIdentity ?? []) {
    if (!components.some((component) => component.name === name && component.version === version))
      problems.push(`the SBOM names no ${name} ${String(version)}, which this release publishes`)
  }
  // Each runtime dependency as the package that declares it is given it:
  // a consumer's tree can hold one name at two versions, the other a
  // dependency of a dependency that no suite's record names -- pdfkit's
  // @noble/hashes 1.8.0 beside report-spec's 2.4.0.
  const graph = dependencyGraph(sbom)
  for (const entry of runtime) {
    const given = (graph.get(`${entry.package}@${String(version)}`) ?? []).filter((to) => to.name === entry.name)
    if (given.length === 0) problems.push(`the SBOM records no dependency of ${entry.package} on ${entry.name}`)
    for (const to of given) {
      if (to.version !== entry.loaded) problems.push(`the SBOM gives ${entry.package} ${entry.name} ${to.version}, where its suites loaded ${entry.loaded}`)
      else if (!components.some((component) => component.name === to.name && component.version === to.version))
        problems.push(`the SBOM names no ${to.name} ${to.version}, which ${entry.package} depends on`)
    }
  }
  for (const component of components) {
    const versions = loaded.get(component.name)
    if (versions !== undefined && !versions.has(component.version))
      problems.push(`the SBOM names ${component.name} ${component.version}, where the suites loaded ${[...versions].join(', ')}`)
  }
  return problems
}
