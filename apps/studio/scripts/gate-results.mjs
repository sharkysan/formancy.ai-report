// What the Studio's browser gate found, kept as formancy.ai-data keeps its
// gates' findings (scripts/release-report/gate-results.mjs there, its 0035):
// `test-results/browser-<browser>.json`, written however the run ends, with
// every check by name under the pass it was made in and those that failed
// there, the failed sentences led by their pass, the axe it ran, what it
// measured on the way and the error that ended it. A gate that left nothing
// would look like a gate that was never run, which is a different problem.
//
// One browser here, Chromium, the one installed for this repository's
// gates; Data's recorder runs each of three in turn.
//
// Beside Data's record, the passes the gate planned, by label, before it
// made any: the gate walks the same journey at every width, so a pass it
// planned and did not make is a width measured by nobody, which the release
// report fails as a check that did not run; and the Playwright that
// launched the browser, whose pin the report holds the browser's version to.
//
// A measurement is an observation on whatever machine ran the gate, never a
// performance figure.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launchedAs } from '../../../scripts/browsers.mjs'

/** A recorder for the gate of `gate`, the app's directory (`apps/studio`), in `browser` (`chromium`), launched by `playwright` (its version). */
export function gateRecorder(gate, { browser: asked, playwright = null, log = console.log, now = () => new Date() }) {
  const startedAt = now().toISOString()
  const failed = []
  const measurements = []
  const made = []
  let planned = []
  let ok = 0
  let browser = null
  let axe = null
  let error = null

  return {
    /** One check: `problem` null when it holds, a sentence when it does not. Printed, and kept by name under the current pass. */
    check(name, problem) {
      if (made.length === 0) made.push({ label: null, width: null, height: null, checks: [], failed: [] })
      made.at(-1).checks.push(name)
      if (problem === null) {
        ok += 1
        log(`  ok    ${name}`)
        return
      }
      log(`  FAIL  ${name}\n          ${problem}`)
      made.at(-1).failed.push(name)
      failed.push(`${made.at(-1).label ?? 'before any pass'}: ${name}: ${problem}`)
    },
    /** A number observed on this machine, kept with its unit. */
    measure({ name, value, unit }) {
      measurements.push({ name, value, unit })
    },
    /** The browser launched, as it names itself, and how. */
    launched(instance, options) {
      browser = { ...launchedAs(instance, options), platform: process.platform, arch: process.arch }
      if (browser.name !== asked) throw new Error(`${gate} asked for ${asked}, and the launch gave ${browser.name} ${browser.version}`)
    },
    /** The axe-core version injected into the page, as the page reports it. */
    axe(version) {
      axe = version ?? null
    },
    /** The passes the gate means to make, before it makes one: what a pass not made is held against. */
    plan(passes) {
      planned = passes.map((entry) => entry.label)
    },
    /** One pass of the gate, at a viewport: the checks after it are kept under it. */
    pass({ label, width, height }) {
      made.push({ label, width, height, checks: [], failed: [] })
      log(`\n${label} -- ${String(width)}x${String(height)}`)
    },
    /** The failed checks so far, as sentences. */
    failures() {
      return [...failed]
    },
    /** What ended the gate early, if anything did. */
    error(thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    },
    /** Writes `<dir>/test-results/browser-<browser>.json` and returns what it wrote. */
    write(dir) {
      const passes = made.filter((entry) => entry.width !== null)
      const result = {
        gate,
        asked,
        startedAt,
        finishedAt: now().toISOString(),
        browser,
        playwright,
        axe,
        widths: [...new Set(passes.map((entry) => entry.width))],
        planned: [...planned],
        passes: passes.length,
        made: made.map((entry) => ({ ...entry, checks: [...entry.checks], failed: [...entry.failed] })),
        checks: { ok, failed: [...failed] },
        measurements,
        ...(error === null ? {} : { error }),
      }
      mkdirSync(join(dir, 'test-results'), { recursive: true })
      writeFileSync(join(dir, 'test-results', `browser-${asked}.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
      return result
    },
  }
}
