// What fails the report (0014; formancy.ai-data 0035), for what it shows of
// results, the install gate, build identity, the release gates and the
// limitations: one sentence each, written into the report's `problems` and
// making the job exit 1. Both files are still written, so a red run says why.
//
// Pure over a built report. `allowMissing` names what a local, partial
// report may lack (verify, install); CI allows none.

const list = (items, most = 5) => (items.length <= most ? items.join('; ') : `${items.slice(0, most).join('; ')}; and ${String(items.length - most)} more`)

/** Each package's suite: present, ran something and every test file the checkout holds for it, every test passed, every file passed, vitest said success. */
function suiteProblems(row) {
  const name = row.package ?? 'the repository guards'
  if (!row.present) return [`${name}: no results from its suite`]
  const problems = []
  if (row.tests === 0) problems.push(`${name}: its suite ran no tests`)
  if (!row.listsTestFiles) problems.push(`${name}: its results do not list the test files the checkout holds, so a file its suite did not run would go unseen`)
  if (row.notRun.length > 0) problems.push(`${name}: ${String(row.notRun.length)} test file(s) the checkout holds did not run in its suite: ${list(row.notRun)}`)
  const failed = row.notPassed.filter((test) => test.status === 'failed')
  const skipped = row.notPassed.filter((test) => test.status !== 'failed')
  if (failed.length > 0) problems.push(`${name}: ${String(failed.length)} test(s) failed: ${list(failed.map((test) => `${test.file} › ${test.name}`))}`)
  if (skipped.length > 0) {
    problems.push(`${name}: ${String(skipped.length)} test(s) did not run (${[...new Set(skipped.map((test) => test.status))].join(', ')}), and a suite that can be skipped is a suite that is skipped: ${list(skipped.map((test) => `${test.file} › ${test.name}`))}`)
  }
  for (const file of row.failedFiles) {
    problems.push(file.testsPassed ? `${name}: ${file.file} failed though every test in it passed: a collection error, or a hook that threw` : `${name}: ${file.file} failed`)
  }
  if (!row.success) problems.push(`${name}: vitest reported the run unsuccessful`)
  if (row.numFailedTestSuites > 0) problems.push(`${name}: vitest counted ${String(row.numFailedTestSuites)} failed suite(s)`)
  return problems
}

/**
 * Every host scripts/install-hosts.mjs plans (`plan`, report.mjs's
 * installPlanOf) has a record and no other host does; each finished every
 * step; and each builder's host resolved every peer, at the floor of its
 * range when it was installed at the floor. The gate's own `passed` is
 * one flag its writer sets, and this does not rest on it.
 */
function hostProblems(hosts, plan) {
  if (plan.error !== null) return [`scripts/install-hosts.mjs plans no install hosts for the published packages: ${plan.error}`]
  const planned = new Map(plan.hosts.map((host) => [host.project, host]))
  const recorded = new Set(hosts.map((host) => host.project))
  const problems = plan.hosts.filter((host) => !recorded.has(host.project)).map((host) => `the install gate has no record of the ${host.project} host, which scripts/install-hosts.mjs plans`)
  for (const host of hosts) {
    const meant = planned.get(host.project)
    if (meant === undefined) {
      problems.push(`the install gate recorded a ${host.project} host, which scripts/install-hosts.mjs does not plan`)
      continue
    }
    if (host.unfinished.length > 0) problems.push(`the install host ${host.project} did not finish: ${host.unfinished.join(', ')}`)
    if (host.at !== meant.at) problems.push(`the install host ${host.project} was installed at ${String(host.at)}, where scripts/install-hosts.mjs plans it at ${String(meant.at)}`)
    for (const [peer, spec] of Object.entries(meant.peers)) {
      const version = host.installed[peer] ?? null
      if (version === null) problems.push(`the install host ${host.project} resolved no ${peer}`)
      else if (meant.at === 'floor' && version !== spec) problems.push(`the install host ${host.project} installed ${peer} ${version}, where the floor of its builder’s peer range is ${spec}`)
    }
  }
  return problems
}

/** The install gate passed, checked every host it plans, and packed one tarball per published package, each at the version every package is at. */
function installProblems(report, published, allowMissing, plan) {
  const { install } = report.results
  if (install === null) return allowMissing.includes('install') ? [] : ['the install gate left no results']
  const problems = []
  if (!install.passed) problems.push(`the install gate did not pass: ${install.error ?? 'no error was recorded'}`)
  problems.push(...hostProblems(install.hosts, plan))
  const packed = install.tarballs.map((tarball) => tarball.name).sort()
  if (packed.join() !== [...published].sort().join()) problems.push(`the install gate packed ${packed.join(', ') || 'nothing'}, where every published package needs exactly one tarball: ${[...published].sort().join(', ')}`)
  // One number for every package, the root manifest's (bump.mjs), so a
  // tarball at another is found on the pull request rather than at the tag.
  for (const tarball of install.tarballs) {
    if (tarball.version !== report.subject.version) problems.push(`the install gate packed ${tarball.name} ${String(tarball.version)}, where every published package is at the root manifest’s version, ${report.subject.version}`)
  }
  return problems
}

/** One `dist/` per published package, whichever job built it and in the tarball npm receives. */
function identityProblems(report) {
  const problems = []
  for (const entry of report.results.buildIdentity) {
    // One hash among none is identical to itself: a tarball no job's build
    // is recorded beside is compared with nothing, and says nothing of it.
    if (entry.tarball !== null && entry.builds.length === 0) problems.push(`${entry.package}: no job recorded its dist/, so the dist/ in its tarball is compared with nothing`)
    if (entry.identical) continue
    const byHash = new Map()
    for (const build of entry.builds) byHash.set(build.distHash, [...(byHash.get(build.distHash) ?? []), build.job])
    const tarball = entry.tarball?.distHash
    if (tarball !== undefined && !byHash.has(tarball)) {
      problems.push(`${entry.package}: the dist/ in its tarball differs from the dist/ built in ${entry.builds.map((build) => build.job).join(', ')}`)
    }
    if (byHash.size > 1) problems.push(`${entry.package}: two jobs built different dist/ bytes: ${[...byHash].map(([hash, jobs]) => `${jobs.join(', ')} built ${hash.slice(0, 19)}`).join('; ')}`)
  }
  return problems
}

/** A limitation held by a test that did not pass, and a register that does not hold. */
function limitationProblems(report) {
  const problems = report.limitations.registerProblems.map((problem) => `docs/release/limitations.json: ${problem}`)
  for (const group of report.limitations.stated) {
    for (const line of group.lines) {
      if (line.heldBy !== undefined && line.held !== 'passed') problems.push(`${line.number}'s "${line.says}" is held by ${line.heldBy}, which ${line.held === 'absent' ? 'did not run' : 'did not pass'} in this run`)
    }
  }
  return problems
}

/**
 * A local report's results are of one commit and one run, each key once.
 * On a machine the results directory holds whatever was put there -- a
 * collect of another commit, a CI run's artefacts beside this machine's --
 * and nothing else holds them together; in CI, artefacts.mjs holds every
 * artefact to the run.
 */
export function localResultsProblems(results) {
  const by = (value) => {
    const groups = new Map()
    for (const result of results) groups.set(value(result), [...(groups.get(value(result)) ?? []), result.key])
    return groups
  }
  const problems = []
  const commits = by((result) => String(result.commit))
  if (commits.size > 1) problems.push(`the results are of ${String(commits.size)} commits, where a report is of one: ${[...commits].map(([commit, keys]) => `${commit} (${keys.join(', ')})`).join('; ')}`)
  const runs = by((result) => result.run?.id ?? null)
  if (runs.size > 1) problems.push(`the results are of ${String(runs.size)} runs, where a report is of one: ${[...runs].map(([id, keys]) => `${id === null ? 'a machine' : `run ${String(id)}`} (${keys.join(', ')})`).join('; ')}`)
  for (const [key, keys] of by((result) => result.key)) if (keys.length > 1) problems.push(`the results hold ${key} ${String(keys.length)} times, where a run leaves each key once`)
  return problems
}

/** Every job of the gates workflow that leaves results, as the report's `needs` say it ended: anything but success fails the run. */
export function needsProblems(needs, jobs) {
  return jobs.flatMap((job) => {
    const result = needs?.[job]?.result
    if (result === undefined) return [`the report's needs do not name the ${job} job, so how it ended is unknown`]
    return result === 'success' ? [] : [`the ${job} job ended ${String(result)}`]
  })
}

/** How an evidence item that did not pass is said. */
const unpassed = (item) => {
  const what = item.kind === 'job' ? `the ${item.value} job` : item.value
  if (item.local === true) return `${what} has no result outside a gates run`
  return `${what} ${item.outcome === 'absent' ? 'did not run' : item.kind === 'job' ? `ended ${String(item.result)}` : 'did not pass'}`
}

/**
 * Each gate whose evidence did not pass in this run. Locally, where there is
 * no `needs`, a job's evidence cannot pass: what `allowMissing` names is
 * left out, as the partial banner says.
 */
export function releaseGateProblems(gates, allowMissing = []) {
  return gates
    .filter((gate) => gate.state === 'failed')
    .flatMap((gate) => {
      const allowed = (item) => item.outcome === 'absent' && item.kind === 'job' && allowMissing.includes(item.value)
      const items = gate.evidence.filter((item) => item.kind !== 'document' && item.outcome !== 'passed' && !allowed(item))
      return items.length === 0 ? [] : [`gate ${String(gate.gate)}: its evidence did not pass in this run: ${list(items.map(unpassed))}`]
    })
}

/**
 * Every problem of what the run shows: what collect missed, the suites, the
 * install gate and its hosts against `installPlan`, build identity and the
 * limitations.
 */
export function contentProblems(report, { published, installPlan, allowMissing = [] }) {
  return [
    ...report.results.missing.map(({ job, what }) => `${job}: expected and not found: ${what}`),
    // A published package with no test:coverage script has no row at all.
    ...published.filter((name) => !report.results.packages.some((row) => row.package === name)).map((name) => `${name} is published and has no suite: it has no test:coverage script, so no job runs its tests`),
    ...report.results.packages.flatMap(suiteProblems),
    ...(report.results.repository.present || !allowMissing.includes('verify') ? suiteProblems(report.results.repository) : []),
    ...installProblems(report, published, allowMissing, installPlan),
    ...identityProblems(report),
    ...limitationProblems(report),
  ]
}
