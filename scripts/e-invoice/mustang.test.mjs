import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { corpus } from './corpus.mjs'
import { JVM_OPTIONS } from './java.mjs'
import { judgeMustang, mustangArguments, readMustang, readMustangLog } from './mustang.mjs'
import { readRegisters } from './registers.mjs'

/**
 * Mustang's verdict on every file of the corpus (0027), judged from what
 * Mustang 2.26.0 wrote in a recorded gate run (scripts/e-invoice/recorded/,
 * whose run.json says when and on what): its report on stdout, its log on
 * stderr and its exit status. Each defect below is that recorded run with
 * one thing changed, so a rule is seen to fire on its defect and on
 * nothing else.
 */
const here = dirname(fileURLToPath(import.meta.url))
const recorded = (...path) => readFileSync(join(here, 'recorded', ...path), 'utf8')
const run = JSON.parse(recorded('run.json'))
const entries = corpus({ samples: run.samples.map((id) => ({ id })), xmlOf: (sample) => recorded('corpus', `${sample.id}.xml`) })
const { accepted } = readRegisters()
const PROFILE = 'urn:cen.eu:en16931:2017'

/** The recorded run of every file: its status, its report and its log. */
const runs = () => new Map(entries.map((entry) => [entry.file, { status: run.mustang[entry.file], stdout: recorded('mustang', entry.file.replace(/\.xml$/, '.report.xml')), stderr: recorded('mustang', entry.file.replace(/\.xml$/, '.log')) }]))
const judged = (change = () => {}, inputs = {}) => {
  const given = { entries: structuredClone(entries), runs: runs(), accepted: structuredClone(accepted.accepted), pinned: '2.26.0', profile: PROFILE, ...inputs }
  change(given)
  return judgeMustang(given)
}

describe('Mustang’s command line', () => {
  // `--no-notices` leaves out the XRechnung rules Mustang otherwise runs on
  // every EN 16931 file, which an invoice that is not an XRechnung breaks
  // by design; `--disable-file-logging` keeps it from writing a log
  // directory into the working directory; the source is always given, or
  // Mustang asks for it on stdin.
  test('validates the one file, its proxies at a dead port, with no notices and no log directory', () => {
    expect(mustangArguments({ jar: 'M.jar', file: 'e-invoice.xml' })).toEqual([...JVM_OPTIONS, '-Xmx1G', '-jar', 'M.jar', '--action', 'validate', '--no-notices', '--disable-file-logging', '--source', 'e-invoice.xml'])
  })
})

describe('reading Mustang', () => {
  // The XML part's info and messages, and the outer summary, each read by
  // its element, and a message's rule id out of its text, where Mustang
  // writes it and nowhere else.
  test('reads its report: the profile, the version, the rules fired, each message and both summaries', () => {
    const report = readMustang(recorded('mustang', 'control-br-27.report.xml'))
    expect(report).toMatchObject({ filename: 'control-br-27.xml', pdf: false, status: 'invalid', messages: [] })
    expect(report.xml).toMatchObject({ profile: PROFILE, validator: '2.26.0', status: 'invalid' })
    expect(report.xml.fired).toBeGreaterThan(0)
    expect(report.xml.messages.map((message) => message.key)).toEqual(['error 4 BR-27', 'warning 10'])
    // A report on a PDF has a part of its own; the recorded run of FeRD's sample EN16931_Einfach.pdf (recorded/research/) is one, with notices.
    const pdf = readMustang(recorded('research', 'EN16931_Einfach.report.xml'))
    expect([pdf.pdf, pdf.xml.messages.length, pdf.xml.messages.every((message) => message.severity === 'notice')]).toEqual([true, 7, true])
  })

  // Mustang logs an error item twice, as an item and as a line on stderr;
  // the line is the item's echo. An ERROR from anywhere else is an error
  // that made no item -- its arithmetic check swallows a ParseException
  // that way -- and a SAX parser's own line is a file it could not read.
  test('reads its log: the schematron it compiled, and every error line that is not an item’s echo', () => {
    expect(readMustangLog(recorded('mustang', 'e-invoice.log'))).toEqual({ compiled: ['/xslt/ZF_250/FACTUR-X_EN16931.xslt'], refusals: [] })
    expect(readMustangLog(recorded('mustang', 'control-br-27.log')).refusals).toEqual([])
    expect(readMustangLog(recorded('mustang', 'control-malformed.log')).refusals).toEqual(['log [Fatal Error]'])
    expect(readMustangLog('[main] ERROR org.mustangproject.validator.XMLValidator - Unparseable number: "x"\nException in thread "main" java.lang.OutOfMemoryError\n').refusals).toEqual(['log ERROR org.mustangproject.validator.XMLValidator', 'log uncaught exception'])
  })

  // A run that crashed mid-write leaves no report; read as an empty one it
  // would be a pass.
  test('refuses a report that is not one', () => {
    expect(() => readMustang('<validation><xml>')).toThrow()
    expect(() => readMustang('<?xml version="1.0"?><report/>')).toThrow('Mustang wrote a report whose root is report, not validation')
  })
})

describe('Mustang’s verdict', () => {
  // The recorded run as it is: every sample accepted, the one warning the
  // register accepts raised where it is accepted, and every control refused
  // for exactly what it breaks.
  test('passes the recorded run', () => {
    const { rows, problems } = judged()
    expect(problems).toEqual([])
    expect(rows.map((row) => [row.file, row.verdict])).toEqual(entries.map((entry) => [entry.file, 'as expected']))
    expect(rows.find((row) => row.file === 'e-invoice-reverse-charge.xml').accepted).toEqual(['warning 4 PEPPOL-EN16931-R008'])
  })

  // A warning is a refusal unless the register accepts it in that file:
  // without the entry, the reverse-charge sample's empty delivery is
  // refused; an entry nothing raised accepts nothing, and goes.
  test('refuses a warning the register does not accept, and an accepted one nothing raised', () => {
    expect(judged((given) => (given.accepted = [])).problems).toEqual(['e-invoice-reverse-charge.xml is refused by Mustang: warning 4 PEPPOL-EN16931-R008: [PEPPOL-EN16931-R008]-Document MUST not contain empty elements. (still status warning) [ID PEPPOL-EN16931-R008] from /xslt/ZF_250/FACTUR-X_EN16931.xslt)'])
    expect(judged((given) => given.accepted.push({ tool: 'mustang', message: 'notice 27 BR-DE-15', files: ['e-invoice.xml'], reason: 'r' })).problems).toEqual(['the accepted message mustang notice 27 BR-DE-15 was raised in none of its files: remove it from scripts/e-invoice/accepted.json'])
  })

  // Every notice is a refusal too, as a warning is: the recorded run of
  // FeRD's sample EN16931_Einfach.pdf without --no-notices raised seven,
  // of XRechnung's rules.
  test('refuses a notice, and a report on a PDF where the corpus gave XML', () => {
    const { problems } = judged((given) => given.runs.set('e-invoice.xml', { status: 0, stdout: recorded('research', 'EN16931_Einfach.report.xml'), stderr: '' }))
    expect(problems).toContain('Mustang’s report on e-invoice.xml names EN16931_Einfach.pdf as the file it judged')
    expect(problems).toContain('Mustang judged e-invoice.xml as a PDF: its report has a <pdf> part, and the corpus is XML')
    expect(problems.filter((problem) => problem.startsWith('e-invoice.xml is refused by Mustang: notice 27 '))).toHaveLength(7)
  })

  // The exit status says less than the report: Mustang exits 0 on a file
  // whose PDF part failed (its issue #1293), so the gate reads every part,
  // and a sample's status is held as well, since a non-zero one is a run
  // that did not end as its report says.
  test('refuses a sample whose run failed, by its status, its summaries, its version, its profile or the rules it fired', () => {
    expect(judged((given) => (given.runs.get('e-invoice.xml').status = 255)).problems).toEqual(['Mustang exited 255 on e-invoice.xml, which it must accept'])
    expect(judged((given) => (given.runs.get('e-invoice.xml').stdout = given.runs.get('e-invoice.xml').stdout.replaceAll('status="valid"', 'status="invalid"'))).problems).toEqual(['Mustang’s report on e-invoice.xml says invalid, where the file must be accepted'])
    expect(judged(undefined, { pinned: '2.25.0' }).problems).toContain('Mustang’s report on e-invoice.xml is by Mustang 2.26.0, not by 2.25.0, which docs/release/e-invoice-tools.json pins')
    expect(judged(undefined, { profile: 'urn:factur-x.eu:1p0:en16931' }).problems).toContain('Mustang read e-invoice.xml as the profile urn:cen.eu:en16931:2017, not as urn:factur-x.eu:1p0:en16931')
    expect(judged((given) => (given.runs.get('e-invoice.xml').stdout = given.runs.get('e-invoice.xml').stdout.replace(/<fired>\d+<\/fired>/, '<fired>0</fired>'))).problems).toEqual(['Mustang fired no rule on e-invoice.xml, so it checked nothing'])
    expect(judged((given) => (given.runs.get('e-invoice.xml').stdout = '<validation><xml>')).problems[0]).toMatch(/^Mustang wrote no report it can read on e-invoice.xml: /)
    expect(judged((given) => given.runs.delete('e-invoice.xml')).problems).toEqual(['Mustang did not run on e-invoice.xml'])
  })

  // Mustang's arithmetic check (`XMLValidator.checkArithmetics`, core
  // 2.26.0) logs and swallows a parse exception, leaving no item, so the
  // report says valid; the log says otherwise.
  test('refuses a sample whose log has an error its report has no item for', () => {
    const swallowed = '[main] ERROR org.mustangproject.validator.XMLValidator - Unparseable number: "x"\n'
    expect(judged((given) => (given.runs.get('e-invoice.xml').stderr += swallowed)).problems).toEqual(['e-invoice.xml is refused by Mustang: log ERROR org.mustangproject.validator.XMLValidator: Mustang logged it on stderr, and its report has no item for it'])
  })

  // A control Mustang accepted is a broken file nothing is watching; one
  // refused for something else as well, or not for all it expects, is not
  // the file its name says.
  test('refuses a control it accepted, or refused for anything but exactly what it breaks', () => {
    const sample = runs().get('e-invoice.xml')
    expect(judged((given) => given.runs.set('control-br-27.xml', { ...sample, stdout: sample.stdout.replace('filename="e-invoice.xml"', 'filename="control-br-27.xml"') })).problems).toEqual([
      'Mustang exited 0 on control-br-27.xml, which is broken for the first line’s net price (BT-146) made negative, which BR-27 refuses; Mustang’s own sums, which multiply each quantity by its price, disagree as well',
      'control-br-27.xml is broken for the first line’s net price (BT-146) made negative, which BR-27 refuses; Mustang’s own sums, which multiply each quantity by its price, disagree as well, and Mustang accepted it: nothing is watching that',
    ])
    expect(judged((given) => given.entries.find((entry) => entry.file === 'control-br-27.xml').expect.mustang.pop()).problems).toEqual(['control-br-27.xml was refused by Mustang for warning 10 as well, which it is not broken for'])
    expect(judged((given) => given.entries.find((entry) => entry.file === 'control-br-27.xml').expect.mustang.push('error 4 BR-26')).problems).toEqual(['control-br-27.xml was not refused by Mustang for error 4 BR-26, which it is broken for'])
  })
})
