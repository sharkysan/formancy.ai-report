// Mustang over the corpus's XML (0027) and its PDFs (0031): its command
// line, what it writes, and the gate's verdict on it, pure over what one run
// of every file left so that every rule below is held by a test on a
// recorded run (scripts/e-invoice/mustang.test.mjs) and the command only
// gathers inputs.
//
// What Mustang 2.26.0 writes, measured on 17 and 18 October 2026 (Java 17
// and 25, the same): a report on stdout, `<validation filename>` holding,
// for an XML file, an `<xml>` part -- `<info>` with the profile it read,
// its own version and the rules it fired, its `<messages>`, and a `<summary
// status>` -- then messages and a summary of its own; for a PDF, a `<pdf>`
// part before it, whose text is the result of the veraPDF Mustang bundles,
// `ValidationResult [flavour=3b, totalAssertions=…, assertions=[…],
// isCompliant=…]`, every failed assertion in it with its clause and test
// number (up to a hundred of each rule), and which holds the messages of
// Mustang's own XMP checks and a summary. The flavour is the one the file
// declares, PDF/A-1b where it declares none. A message is an element named
// for its severity (error, warning, notice, exception) with a `type` (the
// error types of Mustang's command-line page), and, for a schematron rule,
// `[ID <rule>]` in its text. On stderr, its log: one line per item it
// reports, and the schematron it compiled.
//
// The rules:
//
// - **A refusal** is an error or an exception, a warning or a notice that
//   scripts/e-invoice/accepted.json does not accept in that file, a PDF/A
//   rule the PDF part failed, a PDF part found invalid for nothing else it
//   says, or an error line on stderr that is not the echo of an item:
//   Mustang's arithmetic check logs and swallows a parse failure, leaving
//   no item (`XMLValidator.checkArithmetics` in Mustang core-2.26.0's
//   sources, which catches a ParseException and only logs it), and a SAX
//   parser prints its own line for a file it could not read. Each is keyed
//   `<severity> <type> <rule id>`, the PDF part's prefixed `pdf`, a PDF/A
//   rule `pdfa <flavour> <clause>-<test>`, `pdf invalid`, or `log ...`.
// - **A sample** exits 0 and has no refusal, and its report is on the file
//   given, has an XML part, a PDF part where the file is a PDF and none
//   where it is XML, every summary valid, the version the register pins,
//   the profile the corpus writes, and at least one rule fired; a PDF's
//   part says PDF/A-3b and compliant. The exit status alone is never
//   trusted: Mustang 2.26.0 exits 0 on a file whose XML part is valid,
//   whatever its PDF part says (its issue #1293, open on 18 October 2026).
// - **A control** is refused for exactly what it expects, and exits other
//   than 0 -- but for one broken in its PDF part alone, on which Mustang
//   2.26.0 exits 0 (#1293), and so must, until a release that fixes it is
//   pinned and this rule with it.
// - **Every accepted message** names files of the corpus and was raised in
//   one of them; one that was not accepts nothing, and goes.

import { JVM_OPTIONS } from './java.mjs'
import { attribute, childOf, readXml, textOf } from './xml.mjs'

/**
 * Mustang's command line for one file, all of it but `java` itself.
 * `-Xmx1G`, the heap every measured run had; the file is given relative to the
 * directory Mustang runs in, the corpus's.
 */
export function mustangArguments({ jar, file }) {
  return [...JVM_OPTIONS, '-Xmx1G', '-jar', jar, '--action', 'validate', '--no-notices', '--disable-file-logging', '--source', file]
}

/** Where the gate writes Mustang's report and log on `file`: beside each other, an XML file's under its name, a PDF's under its name with the extension kept. */
export function mustangOutputs(file) {
  const stem = file.endsWith('.pdf') ? file : file.replace(/\.xml$/, '')
  return { report: `${stem}.report.xml`, log: `${stem}.log` }
}

/** One message as the judge keys it: `error 4 BR-27`, `warning 10`; one of the PDF part's prefixed, `pdf error 12`. */
function messageOf(element, prefix = '') {
  const text = textOf(element).trim()
  const type = attribute(element, 'type')
  const id = /\[ID ([^\]\s]+)\]/.exec(text)?.[1]
  return { severity: element.local, type, id, key: [...(prefix === '' ? [] : [prefix]), element.local, type ?? '-', ...(id === undefined ? [] : [id])].join(' '), text }
}

const messagesOf = (element, prefix) => (childOf(element, '', 'messages')?.children ?? []).map((child) => messageOf(child, prefix))
const number = (element) => (element === undefined ? undefined : Number.parseInt(textOf(element), 10))

/** A failed assertion of the veraPDF result Mustang writes into its PDF part, as `toString` writes it: the rule's clause and test number. */
const FAILED = /RuleId \[specification=[^,\]]*, clause=([0-9.]+), testNumber=(\d+)\], status=failed/g

/**
 * The veraPDF result in a PDF part's text: `{ flavour, compliant, failed }`,
 * `failed` the key of every rule an assertion failed, or null where the
 * text holds none.
 */
function veraPdfResultOf(text) {
  const result = /ValidationResult \[flavour=(\w+), totalAssertions=\d+, assertions=\[([\s\S]*)\], isCompliant=(true|false)\]/.exec(String(text))
  if (result === null) return null
  const [, flavour, assertions, compliant] = result
  return { flavour, compliant: compliant === 'true', failed: [...new Set([...assertions.matchAll(FAILED)].map(([, clause, test]) => `pdfa ${flavour} ${clause}-${test}`))] }
}

/**
 * Mustang's report: `{ filename, pdf, xml, messages, status }`, `pdf` the
 * PDF part's `{ result, messages, status }` (`result` its veraPDF result)
 * or null, `xml` the XML part's `{ version, profile, validator, fired,
 * failed, messages, status }` or null. Anything that is not such a report
 * throws.
 */
export function readMustang(stdout) {
  const root = readXml(stdout)
  if (root.uri !== '' || root.local !== 'validation') throw new Error(`Mustang wrote a report whose root is ${root.local}, not validation`)
  const pdf = childOf(root, '', 'pdf')
  const part = childOf(root, '', 'xml')
  const info = childOf(part, '', 'info')
  const rules = childOf(info, '', 'rules')
  return {
    filename: attribute(root, 'filename'),
    pdf: pdf === undefined ? null : { result: veraPdfResultOf(textOf(pdf)), messages: messagesOf(pdf, 'pdf'), status: attribute(childOf(pdf, '', 'summary'), 'status') },
    xml:
      part === undefined
        ? null
        : {
            version: textOf(childOf(info, '', 'version')),
            profile: textOf(childOf(info, '', 'profile')),
            validator: attribute(childOf(info, '', 'validator'), 'version'),
            fired: number(childOf(rules, '', 'fired')),
            failed: number(childOf(rules, '', 'failed')),
            messages: messagesOf(part),
            status: attribute(childOf(part, '', 'summary'), 'status'),
          },
    messages: messagesOf(root),
    status: attribute(childOf(root, '', 'summary'), 'status'),
  }
}

/** The logger Mustang echoes each of its error items with, and how. */
const ECHO = { logger: 'org.mustangproject.validator.ZUGFeRDValidator', line: /^(Fatal )?Error \d+:/ }

/**
 * Mustang's log: `compiled`, every schematron it says it compiled, and
 * `refusals`, the key of every error line that is not the echo of an item:
 * an ERROR from another logger, a SAX parser's `[Fatal Error]` or `[Error]`,
 * and an exception nothing caught.
 */
export function readMustangLog(stderr) {
  const compiled = []
  const refusals = []
  for (const line of String(stderr).split(/\r?\n/)) {
    for (const [, path] of line.matchAll(/Compiling XSLT instance \[cpPath=([^;\]]+)/g)) compiled.push(path)
    const logged = /^\[[^\]]*\] (ERROR|WARN|INFO|DEBUG|TRACE) (\S+) - (.*)$/.exec(line)
    if (logged !== null) {
      if (logged[1] === 'ERROR' && !(logged[2] === ECHO.logger && ECHO.line.test(logged[3]))) refusals.push(`log ERROR ${logged[2]}`)
      continue
    }
    const sax = /^\[(Fatal Error|Error)\]/.exec(line)
    if (sax !== null) refusals.push(`log [${sax[1]}]`)
    else if (/^Exception in thread /.test(line)) refusals.push('log uncaught exception')
  }
  return { compiled: [...new Set(compiled)], refusals: [...new Set(refusals)] }
}

/** Whether a message refuses its file, under `accepted`, the keys accepted there. */
const refuses = (message, accepted) => !((message.severity === 'warning' || message.severity === 'notice') && accepted.has(message.key))

/**
 * What a PDF part refuses beyond its messages: every PDF/A rule its veraPDF
 * result failed, and `pdf invalid` where its summary says invalid and the
 * part says nothing else, so that a PDF part found invalid is never read
 * as valid for having no message.
 */
function pdfRefusals(pdf) {
  if (pdf === null) return []
  const failed = pdf.result?.failed ?? []
  return [...failed, ...(pdf.status !== 'valid' && failed.length === 0 && pdf.messages.length === 0 ? ['pdf invalid'] : [])]
}

/** What is wrong with one sample's report, as sentences naming the file. */
function sampleProblems(entry, report, { pinned, profile }) {
  const { file } = entry
  const problems = []
  if (entry.format === 'pdf') {
    if (report.pdf === null) problems.push(`Mustang’s report on ${file} has no <pdf> part, where ${file} is a PDF`)
    else if (report.pdf.result === null) problems.push(`Mustang’s report on ${file} has no veraPDF result in its <pdf> part`)
    else {
      if (report.pdf.result.flavour !== '3b') problems.push(`Mustang validated ${file} as PDF/A-${report.pdf.result.flavour}, not as the PDF/A-3b it must declare itself`)
      if (report.pdf.result.compliant !== true) problems.push(`Mustang’s veraPDF finds ${file} not compliant, where it must be`)
    }
  }
  if (report.xml === null) return [...problems, `Mustang’s report on ${file} has no <xml> part`]
  if (report.xml.validator !== pinned) problems.push(`Mustang’s report on ${file} is by Mustang ${String(report.xml.validator)}, not by ${pinned}, which docs/release/e-invoice-tools.json pins`)
  if (report.xml.profile !== profile) problems.push(`Mustang read ${file} as the profile ${String(report.xml.profile)}, not as ${profile}`)
  if (!(report.xml.fired > 0)) problems.push(`Mustang fired no rule on ${file}, so it checked nothing`)
  // The outer summary first: in Mustang 2.26.0 it is the XML part's, whatever the PDF part says (#1293).
  const status = [
    ['', report.status],
    ['its PDF part is ', report.pdf?.status ?? 'valid'],
    ['its XML part is ', report.xml.status],
  ].find(([, said]) => said !== 'valid')
  if (status !== undefined) problems.push(`Mustang’s report on ${file} says ${status[0]}${String(status[1])}, where the file must be accepted`)
  return problems
}

/** Whether a control's expected refusals are all of its PDF part, on which Mustang 2.26.0 exits 0 (#1293). */
const brokenInPdfPartAlone = (expected) => expected.every((key) => key.startsWith('pdf'))

/**
 * The verdict: `{ rows, problems, compiled }`. `rows` is one per corpus
 * entry, for the results file; `problems` every sentence that fails the
 * gate; `compiled` every schematron Mustang logged compiling for a sample,
 * by the profile it read the sample as -- FeRD's for a Factur-X invoice,
 * CEN's and XRechnung's for an XRechnung (0038) -- which the oracle reads.
 *
 * - `entries`: the corpus (scripts/e-invoice/corpus.mjs and pdf-corpus.mjs),
 *   XML and PDF alike;
 * - `runs`: file to `{ status, stdout, stderr, error? }`, one per entry run;
 * - `accepted`: scripts/e-invoice/accepted.json's entries;
 * - `pinned`: the Mustang version the register pins;
 * - `profile`: BT-24, as report-spec's FACTUR_X_PROFILES gives it, for a sample that names none of its own (`entry.guideline`).
 */
export function judgeMustang({ entries, runs, accepted, pinned, profile }) {
  const mine = accepted.filter((entry) => entry.tool === 'mustang')
  const raised = new Set()
  const compiled = new Map()
  const problems = []
  const rows = entries.map((entry) => {
    const { file, expect } = entry
    const row = { file, expect: expect.mustang, verdict: 'not as expected', status: null, validator: null, refusals: [], accepted: [], fired: null }
    const ran = runs.get(file)
    if (ran === undefined || ran.error !== undefined) {
      problems.push(`Mustang did not run on ${file}${ran?.error === undefined ? '' : `: ${ran.error.message}`}`)
      return row
    }
    row.status = ran.status
    let report
    try {
      report = readMustang(ran.stdout)
    } catch (error) {
      problems.push(`Mustang wrote no report it can read on ${file}: ${error.message}`)
      return row
    }
    const log = readMustangLog(ran.stderr)
    const acceptedHere = new Set(mine.filter((each) => each.files.includes(file)).map((each) => each.message))
    const messages = [...(report.pdf?.messages ?? []), ...(report.xml?.messages ?? []), ...report.messages]
    // A key carries its severity, and the register accepts no error, so an accepted key is a warning's or a notice's.
    for (const message of messages) if (acceptedHere.has(message.key)) raised.add(`${message.key}\0${file}`)
    const refusing = messages.filter((message) => refuses(message, acceptedHere))
    const ruled = pdfRefusals(report.pdf)
    row.refusals = [...new Set([...ruled, ...refusing.map((message) => message.key), ...log.refusals])]
    row.accepted = [...new Set(messages.filter((message) => !refuses(message, acceptedHere)).map((message) => message.key))]
    row.fired = report.xml?.fired ?? null
    row.validator = report.xml?.validator ?? null
    const wrong = []
    if (report.filename !== file) wrong.push(`Mustang’s report on ${file} names ${String(report.filename)} as the file it judged`)
    if (entry.format !== 'pdf' && report.pdf !== null) wrong.push(`Mustang judged ${file} as a PDF: its report has a <pdf> part, and the file is XML`)
    if (expect.mustang === 'accepted') {
      const guideline = entry.guideline ?? profile
      compiled.set(guideline, [...new Set([...(compiled.get(guideline) ?? []), ...log.compiled])])
      if (ran.status !== 0) wrong.push(`Mustang exited ${String(ran.status)} on ${file}, which it must accept`)
      wrong.push(...sampleProblems(entry, report, { pinned, profile: guideline }))
      for (const key of ruled) wrong.push(`${file} is refused by Mustang: ${key}: its PDF part failed it`)
      for (const message of refusing) wrong.push(`${file} is refused by Mustang: ${message.key}: ${message.text}`)
      for (const key of log.refusals) wrong.push(`${file} is refused by Mustang: ${key}: Mustang logged it on stderr, and its report has no item for it`)
    } else {
      const pdfAlone = brokenInPdfPartAlone(expect.mustang)
      if (!pdfAlone && ran.status === 0) wrong.push(`Mustang exited 0 on ${file}, which is broken for ${entry.why}`)
      if (pdfAlone && ran.status !== 0) wrong.push(`Mustang exited ${String(ran.status)} on ${file}, which is broken in its PDF part alone, where Mustang 2.26.0 exits 0 (its issue #1293): a release that fixed it is a new pin, and this rule goes with it`)
      const wanted = new Set(expect.mustang)
      if (row.refusals.length === 0) wrong.push(`${file} is broken for ${entry.why}, and Mustang accepted it: nothing is watching that`)
      else {
        for (const key of wanted) if (!row.refusals.includes(key)) wrong.push(`${file} was not refused by Mustang for ${key}, which it is broken for`)
        for (const key of row.refusals) if (!wanted.has(key)) wrong.push(`${file} was refused by Mustang for ${key} as well, which it is not broken for`)
      }
    }
    problems.push(...wrong)
    row.verdict = wrong.length === 0 ? 'as expected' : 'not as expected'
    return row
  })
  for (const entry of mine) {
    if (!entry.files.some((file) => raised.has(`${entry.message}\0${file}`))) problems.push(`the accepted message mustang ${entry.message} was raised in none of its files: remove it from scripts/e-invoice/accepted.json`)
  }
  return { rows, problems, compiled: Object.fromEntries(compiled) }
}
