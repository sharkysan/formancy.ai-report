import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { corpus } from './corpus.mjs'
import { JVM_OPTIONS } from './java.mjs'
import { judgeKosit, kositArguments, readKositConsole, readKositReport, reportName } from './kosit.mjs'
import { readRegisters } from './registers.mjs'

/**
 * KoSIT's verdict on the corpus (0027), judged from what KoSIT 1.6.3 with
 * its XRechnung configuration of 2026-08-31 wrote in a recorded gate run
 * (scripts/e-invoice/recorded/, whose run.json says when and on what): a
 * report per file, its console, and its exit status, the number of files
 * it rejected. Each defect is that run with one thing changed.
 */
const here = dirname(fileURLToPath(import.meta.url))
const recorded = (...path) => readFileSync(join(here, 'recorded', ...path), 'utf8')
const run = JSON.parse(recorded('run.json'))
const entries = corpus({ samples: run.samples.map((id) => ({ id })), xmlOf: (sample) => recorded('corpus', `${sample.id}.xml`) })
const { accepted } = readRegisters()
const hash = (text) => createHash('sha256').update(text).digest('base64')

const judged = (change = () => {}, inputs = {}) => {
  const given = {
    entries: structuredClone(entries),
    reports: new Map(entries.map((entry) => [entry.file, recorded('kosit', reportName(entry.file))])),
    others: [],
    status: run.kosit.status,
    console: recorded('kosit', 'console.log'),
    accepted: structuredClone(accepted.accepted),
    pinned: '1.6.3',
    hashes: new Map(entries.map((entry) => [entry.file, hash(entry.xml)])),
    scenario: 'EN16931 (CII)',
    ...inputs,
  }
  change(given)
  return judgeKosit(given)
}

describe('KoSIT’s command line', () => {
  // One call over every file, with the configuration's scenarios and its
  // repository given as absolute paths: given relative, KoSIT 1.6.3
  // refuses a scenario's schema as "not within the configured repository"
  // (measured on 17 October 2026). Java 24 began to warn of the native
  // library KoSIT's console loads; the flag that silences it is passed only
  // where there is a warning to silence.
  test('validates every file at once, and silences Java 24’s native-access warning only from Java 24', () => {
    const given = { jar: '/c/K.jar', scenarios: '/c/cfg/scenarios.xml', repository: '/c/cfg', out: '/c/out', files: ['/c/a.xml', '/c/b.xml'] }
    expect(kositArguments({ ...given, java: 17 })).toEqual([...JVM_OPTIONS, '-jar', '/c/K.jar', '-s', '/c/cfg/scenarios.xml', '-r', '/c/cfg', '-o', '/c/out', '/c/a.xml', '/c/b.xml'])
    expect(kositArguments({ ...given, java: 25 })).toEqual([...JVM_OPTIONS, '--enable-native-access=ALL-UNNAMED', '-jar', '/c/K.jar', '-s', '/c/cfg/scenarios.xml', '-r', '/c/cfg', '-o', '/c/out', '/c/a.xml', '/c/b.xml'])
    expect(reportName('control-br-27.xml')).toBe('control-br-27-report.xml')
  })
})

describe('reading KoSIT', () => {
  // A report says which scenario matched, what each step found and the
  // assessment, and which bytes it judged, by their hash.
  test('reads a report: its engine, the bytes it judged, its scenario, every step’s messages and its assessment', () => {
    const report = readKositReport(recorded('kosit', 'control-br-co-14-report.xml'))
    expect(report).toMatchObject({ valid: false, engine: 'KoSIT Validator 1.6.3', scenario: 'EN16931 (CII)', assessment: 'reject', schematrons: ['resources/cii/16b/xsl/EN16931-CII-validation.xsl'] })
    expect(report.hash).toEqual({ algorithm: 'SHA-256', value: hash(entries.find((entry) => entry.file === 'control-br-co-14.xml').xml) })
    expect(report.steps.flatMap((step) => step.messages.map((message) => message.key))).toEqual(['error val-sch.1 BR-CO-14'])
    // A file it could not parse matches no scenario, and says so in its own step.
    expect(readKositReport(recorded('kosit', 'control-malformed-report.xml'))).toMatchObject({ scenario: null, assessment: 'reject', steps: [{ id: 'val-xml', valid: false }] })
  })

  // What only the console says: which validator and which configuration ran.
  test('reads the console: the version, the configuration and the counts', () => {
    expect(readKositConsole(recorded('kosit', 'console.log'))).toMatchObject({ version: '1.6.3', configuration: 'Validator Configuration XRechnung 3.0.2', acceptable: 4, rejected: 7 })
    expect(() => readKositReport('<?xml version="1.0"?><report/>')).toThrow('KoSIT wrote a report whose root is report, not rep:report')
  })
})

describe('KoSIT’s verdict', () => {
  test('passes the recorded run', () => {
    const { rows, problems, schematrons } = judged()
    expect(problems).toEqual([])
    expect(rows.map((row) => [row.file, row.verdict])).toEqual(entries.map((entry) => [entry.file, 'as expected']))
    expect(schematrons).toEqual(['resources/cii/16b/xsl/EN16931-CII-validation.xsl'])
  })

  // A report is tied to the corpus by the hash of the bytes KoSIT read: a
  // report on another file under this one's name -- a corpus written since,
  // a stale output directory -- is refused, as is one missing.
  test('refuses a report on other bytes, a report missing, and a report on a file the corpus does not have', () => {
    expect(judged((given) => given.hashes.set('e-invoice.xml', hash('other'))).problems).toEqual(['KoSIT’s report on e-invoice.xml is of other bytes than the corpus wrote'])
    expect(judged((given) => given.reports.set('e-invoice.xml', undefined)).problems).toEqual(['KoSIT wrote no report on e-invoice.xml'])
    expect(judged((given) => given.others.push('invoice-report.xml')).problems).toEqual(['KoSIT wrote invoice-report.xml, which is the report of no file of the corpus'])
  })

  // KoSIT's exit status is the number of files it rejected, so it must be
  // the number of controls exactly: one fewer is a control it accepted,
  // whatever its reports say.
  test('refuses an exit status that is not the number of controls, and another KoSIT', () => {
    expect(judged(undefined, { status: 4 }).problems).toEqual(['KoSIT exited 4, where it rejects one file per control and the corpus has 7'])
    expect(judged(undefined, { pinned: '1.6.4' }).problems).toEqual(expect.arrayContaining(['KoSIT says it is 1.6.3, not 1.6.4, which docs/release/e-invoice-tools.json pins', 'KoSIT’s report on e-invoice.xml is by KoSIT Validator 1.6.3, not by KoSIT Validator 1.6.4']))
    expect(judged(undefined, { error: new Error('spawn java ENOENT') }).problems).toEqual(['KoSIT did not run: spawn java ENOENT'])
  })

  // The EN 16931 scenario runs CEN's schematron alone; a sample matched to
  // another -- XRechnung's, were BT-24 another -- was judged by other rules.
  test('refuses a sample matched to another scenario, or rejected', () => {
    expect(judged(undefined, { scenario: 'EN16931 XRechnung (CII)' }).problems.filter((problem) => problem.startsWith('KoSIT matched'))).toEqual(['e-invoice.xml', 'e-invoice-reverse-charge.xml', 'e-invoice-exempt-paid.xml', 'e-invoice-addressed.xml'].map((file) => `KoSIT matched ${file} to EN16931 (CII), not to EN16931 XRechnung (CII)`))
    const rejected = (given) => given.reports.set('e-invoice.xml', given.reports.get('e-invoice.xml').replace('<rep:accept>', '<rep:reject>').replace('</rep:accept>', '</rep:reject>'))
    expect(judged(rejected).problems).toEqual(['KoSIT rejected e-invoice.xml, which it must accept'])
  })

  // A warning or an information message refuses a sample as an error does,
  // unless the register accepts it there; the recorded run raised none, so
  // its report is given one, as KoSIT writes a message.
  test('refuses a warning the register does not accept, and accepts one it does', () => {
    const warned = (given) => given.reports.set('e-invoice.xml', given.reports.get('e-invoice.xml').replace('<rep:validationStepResult id="val-sch.1" valid="true">', '<rep:validationStepResult id="val-sch.1" valid="true"><rep:message id="val-sch.1.1" level="warning" code="CII-SR-005">[CII-SR-005] - should not be present</rep:message>'))
    expect(judged(warned).problems).toEqual(['e-invoice.xml is refused by KoSIT: warning val-sch.1 CII-SR-005: [CII-SR-005] - should not be present'])
    expect(judged((given) => {
      warned(given)
      given.accepted.push({ tool: 'kosit', message: 'warning val-sch.1 CII-SR-005', files: ['e-invoice.xml'], reason: 'r' })
    }).problems).toEqual([])
    expect(judged((given) => given.accepted.push({ tool: 'kosit', message: 'warning val-sch.1 CII-SR-005', files: ['e-invoice.xml'], reason: 'r' })).problems).toEqual(['the accepted message kosit warning val-sch.1 CII-SR-005 was raised in none of its files: remove it from scripts/e-invoice/accepted.json'])
  })

  // A control KoSIT accepted is nothing watching what it breaks; one
  // refused for another rule is not the file its name says.
  test('refuses a control it accepted, or refused for anything but exactly what it breaks', () => {
    const swapped = (given) => given.reports.set('control-br-27.xml', given.reports.get('e-invoice.xml'))
    expect(judged(swapped, { hashes: new Map(entries.map((entry) => [entry.file, hash(entry.file === 'control-br-27.xml' ? entries[0].xml : entry.xml)])) }).problems).toEqual([
      'KoSIT accepted control-br-27.xml, which is broken for the first line’s net price (BT-146) made negative, which BR-27 refuses; Mustang’s own sums, which multiply each quantity by its price, disagree as well',
      'control-br-27.xml is broken for the first line’s net price (BT-146) made negative, which BR-27 refuses; Mustang’s own sums, which multiply each quantity by its price, disagree as well, and KoSIT accepted it: nothing is watching that',
    ])
    expect(judged((given) => (given.entries.find((entry) => entry.file === 'control-br-27.xml').expect.kosit = ['error val-sch.1 BR-26'])).problems).toEqual([
      'control-br-27.xml was not refused by KoSIT for error val-sch.1 BR-26, which it is broken for',
      'control-br-27.xml was refused by KoSIT for error val-sch.1 BR-27 as well, which it is not broken for',
    ])
  })
})
