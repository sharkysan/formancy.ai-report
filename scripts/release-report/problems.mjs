// What fails the report (0014; formancy.ai-data 0035), for what it shows of
// results, the browser gate and the pictures' check, the install gate, the
// e-invoice gate, the container gate, build
// identity, the release gates and the limitations: one sentence each, written
// into the report's `problems` and making the job exit 1. Both files are
// still written, so a red run says why.
//
// Pure over a built report. `allowMissing` names what a local, partial
// report may lack (verify, browser, install, e-invoice, container), each a reader of collect.mjs:
// a file that reader did not find, what rests on its job and, for browser,
// a gate or a pictures' check that left nothing are not problems. A file it
// found and refused still is. CI allows none.

import { browserName } from '../browsers.mjs'
import { atLeast, JUDGES } from '../e-invoice/registers.mjs'
import { unmeasured, unwalked } from './results.mjs'

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

/** The versions a tool reported of itself, as the gate records them: a list of Mustang's reports', KoSIT's one from its console, or none. */
const reportedVersions = (reported) => (Array.isArray(reported) ? reported : typeof reported === 'string' ? [reported] : [])

/**
 * The e-invoice gate passed; ran exactly the tools `register.tools`
 * (docs/release/e-invoice-tools.json, which the report reads itself) by
 * version, by the SHA-256 the gate measured of the bytes it ran and, for
 * each JAR, by the version the tool reported of itself; in CI, on the Java
 * `register.runtime` names; ran no veraPDF below `register.veraPdfFloor`,
 * its own or Mustang's; judged, as XML and as PDF, at least one sample
 * every tool of that format must accept and one control each must refuse;
 * and has the verdict of every tool that judges a file's format
 * (scripts/e-invoice/registers.mjs's JUDGES) on every file, as its corpus
 * expects. Its own `passed` is one flag its writer sets, and the rest does
 * not rest on it.
 */
function eInvoiceProblems(report, register, allowMissing, ci) {
  const gate = report.results.eInvoice
  if (gate === null) return allowMissing.includes('e-invoice') ? [] : ['the e-invoice gate left no results']
  const problems = []
  if (!gate.passed) problems.push(`the e-invoice gate did not pass: ${gate.problems.length === 0 ? 'no problem was recorded' : list(gate.problems)}`)
  for (const pin of register.tools ?? []) {
    const ran = gate.tools.find((tool) => tool.id === pin.id)
    const reported = reportedVersions(ran?.reported)
    if (ran === undefined) problems.push(`the e-invoice gate recorded no ${pin.id}, which docs/release/e-invoice-tools.json pins`)
    else if (ran.version !== pin.version) problems.push(`the e-invoice gate ran ${pin.id} ${String(ran.version)}, where docs/release/e-invoice-tools.json pins ${pin.version}`)
    else if (ran.sha256 !== pin.sha256) problems.push(`the e-invoice gate ran ${pin.id} ${pin.version} of other bytes than docs/release/e-invoice-tools.json pins`)
    // A JAR runs, and says what it is; the configuration is read, and is held by its bytes.
    else if (pin.java !== null && reported.length === 0) problems.push(`the e-invoice gate recorded no version ${pin.id} reported of itself, which docs/release/e-invoice-tools.json pins as ${pin.version}`)
    else if (pin.java !== null && reported.some((version) => version !== pin.version)) problems.push(`the e-invoice gate’s ${pin.id} reported itself as ${reported.join(', ')}, where docs/release/e-invoice-tools.json pins ${pin.version}`)
  }
  const runtime = register.runtime
  if (ci && runtime !== undefined && gate.java?.major !== runtime.java) problems.push(`the e-invoice gate ran on Java ${String(gate.java?.major)}, where docs/release/e-invoice-tools.json has CI run it on ${runtime.name} ${String(runtime.java)}`)
  problems.push(...floorProblems(gate, register))
  for (const [format, judges] of Object.entries(JUDGES)) {
    const ofFormat = gate.files.filter((file) => file.format === format)
    const as = format.toUpperCase()
    if (!ofFormat.some((file) => file.kind === 'sample' && judges.every((judge) => file.expect[judge] === 'accepted'))) problems.push(`the e-invoice gate judged no ${as} sample every tool must accept`)
    for (const judge of judges) if (!ofFormat.some((file) => file.kind === 'control' && Array.isArray(file.expect[judge]))) problems.push(`the e-invoice gate made no ${as} control ${judge} must refuse`)
  }
  for (const file of gate.files) {
    const judges = JUDGES[file.format]
    if (judges === undefined) {
      problems.push(`the e-invoice gate recorded ${file.file} as ${String(file.format)}, a format none of its tools judges`)
      continue
    }
    for (const judge of judges) {
      if (file[judge] === null) problems.push(`the e-invoice gate has no ${judge} verdict on ${file.file}`)
      else if (file[judge] !== 'as expected') problems.push(`the e-invoice gate’s ${judge} judged ${file.file} otherwise than its corpus expects`)
    }
  }
  return problems
}

/**
 * The veraPDF floor (`register.veraPdfFloor`), held to what the gate ran:
 * its own veraPDF pin and every veraPDF Mustang bundles, as the gate
 * recorded them, each at the floor or later. The gate refuses to run below
 * it, and a gate changed to run anyway, or one that recorded no bundled
 * version, fails the run here.
 */
function floorProblems(gate, register) {
  const pinsVeraPdf = (register.tools ?? []).some((pin) => pin.id === 'verapdf')
  const floor = register.veraPdfFloor?.version
  if (floor === undefined) return pinsVeraPdf ? ['docs/release/e-invoice-tools.json pins veraPDF and gives no floor for it'] : []
  const problems = []
  const ran = (id) => gate.tools.find((tool) => tool.id === id)
  const own = ran('verapdf')
  if (own !== undefined && !atLeast(own.version, floor)) problems.push(`the e-invoice gate ran veraPDF ${String(own.version)}, below the floor of ${floor} docs/release/e-invoice-tools.json gives`)
  const mustang = ran('mustang')
  if (mustang !== undefined) {
    const bundled = mustang.bundles?.verapdf ?? []
    if (bundled.length === 0) problems.push(`the e-invoice gate recorded no veraPDF that Mustang bundles, so the floor of ${floor} is not held for it`)
    for (const version of bundled.filter((each) => !atLeast(each, floor))) problems.push(`the e-invoice gate ran a Mustang that bundles veraPDF ${String(version)}, below the floor of ${floor} docs/release/e-invoice-tools.json gives`)
  }
  return problems
}

/**
 * The container gate passed; made every check `checks` names
 * (scripts/container.mjs's CHECKS, which the report reads itself) and no
 * other, each passed; and its image, asked itself, runs the Node of `base`,
 * the image packages/report-server/Dockerfile names, as `node` (0046).
 * Which base it was built on is the Dockerfile's digest, which Docker
 * verifies and dockerfile.test.ts pins; a record repeating it would be
 * compared with itself.
 */
function containerProblems(report, { checks, base }, allowMissing) {
  const gate = report.results.container
  if (gate === null) return allowMissing.includes('container') ? [] : ['the container gate left no results']
  const problems = []
  if (!gate.passed) problems.push(`the container gate did not pass: ${gate.error ?? 'no error was recorded'}`)
  const failed = gate.checks.filter((check) => !check.passed)
  if (failed.length > 0) problems.push(`the container gate failed ${String(failed.length)} check(s): ${list(failed.map((check) => `${check.name}: ${String(check.said)}`))}`)
  const made = new Set(gate.checks.map((check) => check.name))
  for (const name of checks) if (!made.has(name)) problems.push(`the container gate did not make ${name}, which scripts/container.mjs plans`)
  for (const name of made) if (!checks.includes(name)) problems.push(`the container gate made ${name}, which scripts/container.mjs does not plan: another checkout’s gate`)
  if (gate.image === null) return [...problems, 'the container gate recorded no image']
  const node = /^node:(\d+\.\d+\.\d+)-/.exec(String(base))?.[1]
  if (node === undefined) problems.push(`packages/report-server/Dockerfile names no node:<version> base the report can read, so the Node the container gate’s image runs is held to nothing`)
  else if (gate.image.node !== `v${node}`) problems.push(`the container gate’s image runs Node ${String(gate.image.node)}, where packages/report-server/Dockerfile builds on Node ${node}`)
  if (gate.image.user !== 'node') problems.push(`the container gate’s image runs as ${String(gate.image.user)}, where packages/report-server/Dockerfile runs it as node`)
  return problems
}

const mode = (headless) => (headless ? 'headless' : 'headed')

/**
 * What `which` launched, against the build Playwright pins for that browser
 * (testedOn's `browser`): one Playwright does not pin, another version,
 * launched otherwise than scripts/browsers.mjs launches it -- Chromium's
 * headless shell and its full browser are pinned at one version, so only
 * how it was launched says which build ran -- or another Playwright than the
 * checkout installs.
 */
function launchProblems(which, launched, ranPlaywright, { playwright, pins }, browsers) {
  const problems = []
  const pin = pins.find((entry) => entry.browser === launched.name)
  if (pin === undefined) problems.push(`${which} launched ${launched.name} ${launched.version}, which no gate here runs: the gates run ${browsers.map(browserName).join(', ')}`)
  else {
    if (launched.version !== pin.browserVersion) problems.push(`${which} launched ${launched.name} ${launched.version}, not the ${pin.name} ${pin.browserVersion} Playwright ${playwright} pins`)
    if (typeof launched.headless !== 'boolean') problems.push(`${which} did not record whether it launched ${launched.name} headless, so whether it ran the ${pin.name} Playwright ${playwright} pins is unknown`)
    else if (launched.headless !== pin.headless) problems.push(`${which} launched ${launched.name} ${mode(launched.headless)}, where scripts/browsers.mjs launches it ${mode(pin.headless)}: another build than the ${pin.name} Playwright ${playwright} pins`)
  }
  if (ranPlaywright !== null && ranPlaywright !== playwright) problems.push(`${which} ran Playwright ${ranPlaywright}, where the checkout installs ${playwright}`)
  return problems
}


/**
 * Every app with a `test:browser` script has its gate in every browser the
 * gates run in (`browsers`): present, no error, no failed check, every pass
 * it planned made with a check in it, and the browser it launched the build
 * Playwright pins for that browser. A check that never ran is skipped, and
 * skipped is not passed, as in a suite.
 */
function gateProblems(report, { browserApps, browsers, allowMissing }) {
  const problems = []
  const gates = report.results.browserGates
  for (const app of browserApps) {
    for (const browser of browsers) {
      if (!allowMissing.includes('browser') && !gates.some((gate) => gate.gate === app && gate.asked === browser)) problems.push(`the browser gate of ${app} left no results in ${browserName(browser)}`)
    }
  }
  for (const gate of gates) {
    const which = `the browser gate of ${gate.gate} in ${browserName(gate.asked)}`
    if (gate.error !== null) problems.push(`${which} ended with an error: ${gate.error}`)
    if (gate.failed.length > 0) problems.push(`${which} failed ${String(gate.failed.length)} check(s): ${list(gate.failed)}`)
    // One that ended in an error stopped where it stopped, for the reason it gives.
    if (gate.error === null) for (const what of unmeasured(gate)) problems.push(`${which} ${what}`)
    if (gate.browser === null) {
      if (gate.error === null) problems.push(`${which} says no browser was launched`)
      continue
    }
    problems.push(...launchProblems(which, gate.browser, gate.playwright, report.testedOn.browser, browsers))
  }
  return problems
}

/**
 * Every app with a `test:pictures` script has its pictures' check: present,
 * no error, every scene scenes.json gives the app walked and no other,
 * nothing found -- a part that says something else than its picture, or a
 * caption that quotes what its parts do not say -- and the browser it walked
 * in the build Playwright pins. The scenes are scenes.json's, read by the
 * report (results.mjs's `planned`), not the check's word for them.
 */
function picturesProblems(report, { pictureApps, browsers, allowMissing }) {
  const problems = []
  const checks = report.results.pictures
  for (const app of pictureApps) {
    if (!allowMissing.includes('browser') && !checks.some((check) => check.app === app)) problems.push(`the pictures’ check of ${app} left no results`)
  }
  for (const check of checks) {
    const which = `the pictures’ check of ${check.app}`
    if (check.error !== null) problems.push(`${which} ended with an error: ${check.error}`)
    if (check.problems.length > 0) problems.push(`${which} found ${String(check.problems.length)} picture(s) no longer showing what the page shows: ${list(check.problems)}`)
    const skipped = unwalked(check)
    if (check.error === null && skipped.length > 0) problems.push(`${which} did not walk ${skipped.join(', ')}, which scripts/pictures/scenes.json pictures, so nothing held ${skipped.length === 1 ? 'that picture' : 'those pictures'}`)
    const strays = check.walked.filter((id) => !check.planned.includes(id))
    if (strays.length > 0) problems.push(`${which} walked ${strays.join(', ')}, which scripts/pictures/scenes.json does not give ${check.app}: it walked another checkout’s scenes`)
    if (check.planned.length === 0) problems.push(`${which} had no scene to walk: scripts/pictures/scenes.json gives ${check.app} none`)
    if (check.browser !== null) problems.push(...launchProblems(which, check.browser, check.playwright, report.testedOn.browser, browsers))
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

/** How an evidence item that did not pass is said; a browser gate that did not run in a browser names it. */
const unpassed = (item) => {
  const what = item.kind === 'job' ? `the ${item.value} job` : item.kind === 'browserGate' ? `the browser gate of ${item.value}` : item.value
  if (item.local === true) return `${what} has no result outside a gates run`
  const where = item.missing === undefined ? '' : ` in ${item.missing.map(browserName).join(', ')}`
  return `${what} ${item.outcome === 'absent' ? `did not run${where}` : item.kind === 'job' ? `ended ${String(item.result)}` : 'did not pass'}`
}

/**
 * Each gate whose evidence did not pass in this run. Locally, where there is
 * no `needs`, a job's evidence cannot pass, and a browser gate may not have
 * run: what `allowMissing` names is left out, as the partial banner says.
 */
export function releaseGateProblems(gates, allowMissing = []) {
  return gates
    .filter((gate) => gate.state === 'failed')
    .flatMap((gate) => {
      const allowed = (item) => item.outcome === 'absent' && ((item.kind === 'job' && allowMissing.includes(item.value)) || (item.kind === 'browserGate' && allowMissing.includes('browser')))
      const items = gate.evidence.filter((item) => item.kind !== 'document' && item.outcome !== 'passed' && !allowed(item))
      return items.length === 0 ? [] : [`gate ${String(gate.gate)}: its evidence did not pass in this run: ${list(items.map(unpassed))}`]
    })
}

/**
 * Every problem of what the run shows: what collect did not find or
 * refused, the suites, the browser gate of each of `browserApps` in each of
 * `browsers` and the pictures' check of each of `pictureApps`, the install
 * gate and its hosts against `installPlan`, the e-invoice gate against the
 * tools `eInvoiceTools` pins and, where `ci`, the Java it names, the
 * container gate against the checks and the base `container` names, build
 * identity and the limitations.
 */
export function contentProblems(report, { published, installPlan, eInvoiceTools = { tools: [] }, container = { checks: [], base: null }, browserApps = [], pictureApps = [], browsers = [], allowMissing = [], ci = false }) {
  return [
    // A file its reader expected and did not find; on a machine, not a
    // problem for a reader the report allows missing, as its banner says.
    // What was found and refused -- stale, another run's, another browser's
    // -- stays one whatever is allowed: it is a file this run did not write.
    ...report.results.absent.filter(({ reader }) => !allowMissing.includes(reader)).map(({ job, file }) => `${job}: expected and not found: ${file}`),
    ...report.results.missing.map(({ job, what }) => `${job}: expected and not found: ${what}`),
    // A published package with no test:coverage script has no row at all.
    ...published.filter((name) => !report.results.packages.some((row) => row.package === name)).map((name) => `${name} is published and has no suite: it has no test:coverage script, so no job runs its tests`),
    ...report.results.packages.flatMap(suiteProblems),
    ...(report.results.repository.present || !allowMissing.includes('verify') ? suiteProblems(report.results.repository) : []),
    ...gateProblems(report, { browserApps, browsers, allowMissing }),
    ...picturesProblems(report, { pictureApps, browsers, allowMissing }),
    ...installProblems(report, published, allowMissing, installPlan),
    ...eInvoiceProblems(report, eInvoiceTools, allowMissing, ci),
    ...containerProblems(report, container, allowMissing),
    ...identityProblems(report),
    ...limitationProblems(report),
  ]
}
