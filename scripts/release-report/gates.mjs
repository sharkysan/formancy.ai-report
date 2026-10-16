// The release gates (0014; formancy.ai-data 0035): docs/release/gates.json,
// the delivery plan's G1 to G7 and its legal review, each with the evidence a
// run must pass, the reason it is open, or both. The plan is a working
// document kept out of the repository, so the register carries no gate's
// wording: the report prints the gate's id with its evidence, and a key other
// than `gate`, `evidence` and `open` fails here.
//
// Evidence comes in four kinds:
//
//   { "file": "<repo-relative test file>" }   every test in it passed in this run
//   { "browserGate": "<app dir>" }             that app's browser gate in every browser the gates run in: no failed check, no error, every planned pass made with a check in it
//   { "job": "<gates.yml job id>" }            that job's result in the report's needs is success
//   { "document": "<committed file>" }         stated: shown with its last change, never as passed
//
// A gate with evidence and no reason is "passed" in a run when everything but
// its documents passed, and "stated" when its only evidence is documents. A
// gate with a reason is "open": with evidence too, it is partly evidenced --
// as G3 was while its switch across the frameworks and its scenarios ran
// here and nothing compared the builders' accessible trees (0012) -- and
// that evidence must pass all the same. A gate whose evidence did not
// pass is "failed", which fails the run. The report never says a gate is
// met.
//
// A browser gate is judged as formancy.ai-data's `browserGate` is, from the
// gate's own results file (results.mjs's gateOutcome), so on a machine it is
// judged from that machine's run of the gate, unlike a job.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gateOutcome, isRunTest } from './results.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const GATES_REGISTER = 'docs/release/gates.json'
export const KINDS = ['file', 'browserGate', 'job', 'document']
/** The plan's gates, in its order: G1 to G7 (plan 25.1), then the legal review it keeps open until done (plan 25.2). */
export const GATES = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'legal']

const KEYS = new Set(['gate', 'evidence', 'open'])
const prose = (items) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

/** The register, parsed. */
export function readGates(root = repo) {
  return JSON.parse(readFileSync(join(root, GATES_REGISTER), 'utf8'))
}

/** An evidence item's kind and value, or undefined when it is not exactly one known kind. */
export function evidenceKind(item) {
  const keys = Object.keys(item ?? {})
  if (keys.length !== 1 || !KINDS.includes(keys[0])) return undefined
  return { kind: keys[0], value: item[keys[0]] }
}

/** Why one evidence item cannot be judged, or undefined when it can. */
function itemProblem({ kind, value }, { covered, browserApps = [], jobs, exists }) {
  if (kind === 'file') {
    if (!isRunTest(String(value), { covered, exists })) return `${String(value)} is not a test file of a package with a suite or of the repository's guards`
  } else if (kind === 'browserGate') {
    if (!browserApps.includes(value)) return `${String(value)} is not an app with a test:browser script`
  } else if (kind === 'job') {
    if (!jobs.includes(value)) return `${String(value)} is not a job of .github/workflows/gates.yml that leaves results`
  } else if (typeof value !== 'string' || !exists(value)) {
    return `${String(value)} is not a committed file`
  }
  return undefined
}

/**
 * What is wrong with `register`, as sentences. Pure: `covered` is the paths
 * of the packages with a test:coverage script, `browserApps` the paths of
 * the apps with a test:browser script, `jobs` the gates workflow's jobs that
 * leave results, and `exists(path)` whether a repository path is a file.
 */
export function gatesProblems(register, context) {
  const problems = []
  const gates = Array.isArray(register?.gates) ? register.gates : []
  const ids = gates.map((entry) => entry?.gate)
  if (ids.join() !== GATES.join()) problems.push(`the gates are ${ids.join(', ') || 'none'}, where the plan has ${prose(GATES)}, each once and in order`)
  for (const entry of gates) {
    const at = `gate ${String(entry?.gate)}`
    for (const key of Object.keys(entry ?? {}).filter((name) => !KEYS.has(name))) {
      problems.push(`${at} carries "${key}", and a gate carries only its id, its evidence and why it is open: the plan's wording stays out of the repository`)
    }
    const evidence = Array.isArray(entry?.evidence) && entry.evidence.length > 0
    const open = typeof entry?.open === 'string' && entry.open.trim() !== ''
    if (!evidence && !open) problems.push(`${at} has neither evidence nor a reason it is open; it needs one or both`)
    if (entry?.evidence !== undefined && !evidence) problems.push(`${at} has an empty list of evidence; leave it out instead`)
    for (const item of evidence ? entry.evidence : []) {
      const known = evidenceKind(item)
      const problem = known === undefined ? `${JSON.stringify(item)} is not exactly one of ${KINDS.join(', ')}` : itemProblem(known, context)
      if (problem !== undefined) problems.push(`${at}'s evidence: ${problem}`)
    }
  }
  return problems
}

/** What a run says of one evidence item: passed, failed or absent; a document is stated, with its history. */
function outcomeOf({ kind, value }, run) {
  if (kind === 'file') return { outcome: run.fileOutcome(value) }
  // Failed in any browser is failed, and so is a run that skipped a pass;
  // passed is passed in every browser the gates run in, and absent, naming
  // them, while one has not run.
  if (kind === 'browserGate') return gateOutcome(run.browserGates ?? [], value, run.browsers ?? [])
  if (kind === 'job') {
    // A job's result is what the report job's `needs` say; a machine has none.
    if (run.needs === null) return { outcome: 'absent', local: true }
    const result = run.needs?.[value]?.result
    return { outcome: result === undefined ? 'absent' : result === 'success' ? 'passed' : 'failed', ...(result === undefined ? {} : { result }) }
  }
  return { outcome: 'stated', history: run.documents?.[value] ?? null }
}

/**
 * Each gate as this run leaves it: `{ gate, state, evidence, open? }`, with
 * state `passed`, `failed`, `stated` or `open`. Pure. `run` gives
 * `fileOutcome(file)`, the run's `browserGates` (results.mjs's rows), the
 * `browsers` the gates run in, its `needs` (null locally), and `documents`:
 * each document's last change, `{ sha, date, behind }`, or null when git
 * has none.
 */
export function evaluateGates(register, run) {
  return (register?.gates ?? []).map((entry) => {
    const evidence = (entry.evidence ?? []).map((item) => {
      const known = evidenceKind(item) ?? { kind: 'unknown', value: JSON.stringify(item) }
      return { ...known, ...(known.kind === 'unknown' ? { outcome: 'failed' } : outcomeOf(known, run)) }
    })
    const exercised = evidence.filter((item) => item.kind !== 'document')
    const open = typeof entry.open === 'string' ? { open: entry.open } : {}
    const failed = exercised.some((item) => item.outcome !== 'passed')
    const state = failed ? 'failed' : open.open !== undefined ? 'open' : exercised.length === 0 ? 'stated' : 'passed'
    return { gate: entry.gate, state, evidence, ...open }
  })
}
