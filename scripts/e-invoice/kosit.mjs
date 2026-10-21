// KoSIT's validator over the corpus's XML (0027), with KoSIT's XRechnung
// configuration, whose `EN16931 (CII)` scenario runs the CII D16B schema
// and CEN/TC 434's schematron and nothing of XRechnung's, and whose
// `EN16931 XRechnung (CII)` runs XRechnung's schematron beside them, which
// an XRechnung's XML matches (0038): its command line,
// what it writes, and the gate's verdict on it, pure over what one run left
// so every rule is held by a test on a recorded run
// (scripts/e-invoice/kosit.test.mjs).
//
// What KoSIT 1.6.3 writes, measured on 17 October 2026 (Java 17 and 25, the
// same but for their times): one report per file, `<name>-report.xml`, in
// VARL (`rep:`), naming the engine, the SHA-256 of the bytes it read, the
// scenario it matched (with the schema and the schematron it ran) or that
// none did, each step's result with its messages (`level`, `code`), and an
// assessment, accept or reject; on its console, its version and the
// configuration it loaded; and an exit status that is the number of files
// it rejected.
//
// The rules:
//
// - **A refusal** is an error, or a warning or an information message
//   scripts/e-invoice/accepted.json does not accept in that file, keyed
//   `<level> <step> <code>`.
// - **Every report** is by the version the register pins and of the very
//   bytes the corpus wrote, by their hash; and every file has one, and no
//   other file does.
// - **A sample** is matched to its kind's scenario -- `EN16931 (CII)` for
//   a Factur-X invoice's XML, `EN16931 XRechnung (CII)` for an
//   XRechnung's -- valid, accepted, and has no refusal.
// - **A control** is rejected, and refused for exactly what it expects.
// - **The exit status** is the number of controls, since KoSIT rejects
//   each control and no sample.
// - **Every accepted message** was raised in one of its files.

import { JVM_OPTIONS } from './java.mjs'
import { attribute, childOf, descendants, readXml, textOf } from './xml.mjs'

const REP = 'http://www.xoev.de/de/validator/varl/1'
const SCENARIOS = 'http://www.xoev.de/de/validator/framework/1/scenarios'

/** The Java from which the JDK warns of a native library loaded without leave (JEP 472, Java 24). */
const NATIVE_ACCESS_WARNED = 24

/**
 * KoSIT's command line for every file at once, all of it but `java`
 * itself. Every path absolute: KoSIT 1.6.3 refuses a scenario's schema as
 * "not within the configured repository" when the repository is given
 * relative to another directory (measured on 17 October 2026). From Java 24
 * the JDK warns that KoSIT's console library loads native code; Java 17
 * knows the flag that grants it and has nothing to warn of, so it is given
 * only where there is a warning to silence.
 */
export function kositArguments({ jar, scenarios, repository, out, files, java }) {
  return [...JVM_OPTIONS, ...(java >= NATIVE_ACCESS_WARNED ? ['--enable-native-access=ALL-UNNAMED'] : []), '-jar', jar, '-s', scenarios, '-r', repository, '-o', out, ...files]
}

/** The name KoSIT gives the report of `file`. */
export const reportName = (file) => file.replace(/\.xml$/, '-report.xml')

/**
 * One report: `{ valid, engine, hash: { algorithm, value }, scenario,
 * schematrons, steps: [{ id, valid, messages }], assessment }`, `scenario`
 * null where none matched. Anything that is not a VARL report throws.
 */
export function readKositReport(text) {
  const root = readXml(text)
  if (root.uri !== REP || root.local !== 'report') throw new Error(`KoSIT wrote a report whose root is ${root.local}, not rep:report`)
  const identification = childOf(root, REP, 'documentIdentification')
  const hash = childOf(identification, REP, 'documentHash')
  const matched = childOf(root, REP, 'scenarioMatched')
  const scenario = childOf(matched, SCENARIOS, 'scenario')
  const assessment = childOf(root, REP, 'assessment')
  return {
    valid: attribute(root, 'valid') === 'true',
    engine: textOf(childOf(childOf(root, REP, 'engine'), REP, 'name')),
    hash: { algorithm: textOf(childOf(hash, REP, 'hashAlgorithm')), value: textOf(childOf(hash, REP, 'hashValue')) },
    scenario: scenario === undefined ? null : textOf(childOf(scenario, SCENARIOS, 'name')),
    schematrons: descendants(childOf(scenario, SCENARIOS, 'validateWithSchematron') ?? { children: [] }, SCENARIOS, 'location').map(textOf),
    steps: descendants(root, REP, 'validationStepResult').map((step) => ({
      id: attribute(step, 'id'),
      valid: attribute(step, 'valid') === 'true',
      messages: descendants(step, REP, 'message').map((message) => {
        const level = attribute(message, 'level')
        const code = attribute(message, 'code')
        return { level, code, key: `${String(level)} ${String(attribute(step, 'id'))} ${code ?? '-'}`, text: textOf(message).trim() }
      }),
    })),
    assessment: childOf(assessment, REP, 'accept') !== undefined ? 'accept' : childOf(assessment, REP, 'reject') !== undefined ? 'reject' : null,
  }
}

/** What only KoSIT's console says: `{ version, configuration, acceptable, rejected }`. */
export function readKositConsole(text) {
  const source = String(text)
  const count = (label) => {
    const found = new RegExp(`${label}:\\s+(\\d+)`).exec(source)?.[1]
    return found === undefined ? undefined : Number.parseInt(found, 10)
  }
  return { version: /KoSIT Validator version (\S+)/.exec(source)?.[1], configuration: /Loaded "([^"]+)"/.exec(source)?.[1], acceptable: count('Acceptable'), rejected: count('Rejected') }
}

/** What is wrong with one file's report, as sentences naming it. */
function reportProblems(entry, report, { pinned, hashes, scenario }) {
  const { file } = entry
  const problems = []
  if (report.engine !== `KoSIT Validator ${pinned}`) problems.push(`KoSIT’s report on ${file} is by ${String(report.engine)}, not by KoSIT Validator ${pinned}`)
  if (report.hash.algorithm !== 'SHA-256' || report.hash.value !== hashes.get(file)) problems.push(`KoSIT’s report on ${file} is of other bytes than the corpus wrote`)
  if (entry.expect.kosit === 'accepted') {
    if (report.scenario !== scenario) problems.push(`KoSIT matched ${file} to ${report.scenario ?? 'no scenario'}, not to ${scenario}`)
    if (report.assessment !== 'accept' || !report.valid) problems.push(`KoSIT rejected ${file}, which it must accept`)
  } else if (report.assessment !== 'reject') problems.push(`KoSIT accepted ${file}, which is broken for ${entry.why}`)
  return problems
}

/**
 * The verdict: `{ rows, problems, schematrons }`, `schematrons` every
 * schematron each scenario the samples matched ran first, by the
 * scenario, as its reports name it, which the oracle reads.
 *
 * - `entries`: the corpus;
 * - `reports`: file to the text of its report, or undefined where there is none;
 * - `others`: the names of reports in the output directory that are no file's;
 * - `status`, `error`: how the one run ended;
 * - `console`: its console, stdout and stderr;
 * - `accepted`: scripts/e-invoice/accepted.json's entries;
 * - `pinned`: the KoSIT version the register pins;
 * - `hashes`: file to the base64 SHA-256 of the bytes the corpus wrote;
 * - `scenario`: the scenario a sample must match that names none of its own (`entry.scenario`).
 */
export function judgeKosit({ entries, reports, others, status, error, console, accepted, pinned, hashes, scenario }) {
  if (error !== undefined) return { rows: [], problems: [`KoSIT did not run: ${error.message}`], schematrons: [] }
  const mine = accepted.filter((entry) => entry.tool === 'kosit')
  const problems = []
  const said = readKositConsole(console)
  if (said.version !== pinned) problems.push(`KoSIT says it is ${String(said.version)}, not ${pinned}, which docs/release/e-invoice-tools.json pins`)
  const controls = entries.filter((entry) => entry.expect.kosit !== 'accepted').length
  if (status !== controls) problems.push(`KoSIT exited ${String(status)}, where it rejects one file per control and the corpus has ${String(controls)}`)
  for (const name of others) problems.push(`KoSIT wrote ${name}, which is the report of no file of the corpus`)
  const raised = new Set()
  const schematrons = new Map()
  const rows = entries.map((entry) => {
    const { file, expect } = entry
    const row = { file, expect: expect.kosit, verdict: 'not as expected', scenario: null, assessment: null, refusals: [], accepted: [] }
    const text = reports.get(file)
    if (text === undefined) {
      problems.push(`KoSIT wrote no report on ${file}`)
      return row
    }
    let report
    try {
      report = readKositReport(text)
    } catch (failure) {
      problems.push(`KoSIT wrote no report it can read on ${file}: ${failure.message}`)
      return row
    }
    Object.assign(row, { scenario: report.scenario, assessment: report.assessment })
    const acceptedHere = new Set(mine.filter((each) => each.files.includes(file)).map((each) => each.message))
    const messages = report.steps.flatMap((step) => step.messages)
    for (const message of messages) if (acceptedHere.has(message.key)) raised.add(`${message.key}\0${file}`)
    const refusing = messages.filter((message) => message.level === 'error' || !acceptedHere.has(message.key))
    row.refusals = [...new Set(refusing.map((message) => message.key))]
    row.accepted = [...new Set(messages.filter((message) => !refusing.includes(message)).map((message) => message.key))]
    const expected = entry.scenario ?? scenario
    const wrong = reportProblems(entry, report, { pinned, hashes, scenario: expected })
    if (expect.kosit === 'accepted') {
      if (report.scenario === expected) for (const location of report.schematrons) schematrons.set(expected, [...new Set([...(schematrons.get(expected) ?? []), location])])
      for (const message of refusing) wrong.push(`${file} is refused by KoSIT: ${message.key}: ${message.text}`)
    } else if (row.refusals.length === 0) wrong.push(`${file} is broken for ${entry.why}, and KoSIT accepted it: nothing is watching that`)
    else {
      for (const key of expect.kosit) if (!row.refusals.includes(key)) wrong.push(`${file} was not refused by KoSIT for ${key}, which it is broken for`)
      for (const key of row.refusals) if (!expect.kosit.includes(key)) wrong.push(`${file} was refused by KoSIT for ${key} as well, which it is not broken for`)
    }
    problems.push(...wrong)
    row.verdict = wrong.length === 0 ? 'as expected' : 'not as expected'
    return row
  })
  for (const entry of mine) {
    if (!entry.files.some((file) => raised.has(`${entry.message}\0${file}`))) problems.push(`the accepted message kosit ${entry.message} was raised in none of its files: remove it from scripts/e-invoice/accepted.json`)
  }
  return { rows, problems, schematrons: Object.fromEntries(schematrons) }
}
