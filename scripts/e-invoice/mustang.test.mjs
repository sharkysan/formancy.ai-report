import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { corpus } from './corpus.mjs'
import { JVM_OPTIONS } from './java.mjs'
import { judgeMustang, mustangArguments, mustangOutputs, readMustang, readMustangLog } from './mustang.mjs'
import { pdfPlan } from './pdf-corpus.mjs'
import { readRegisters } from './registers.mjs'

/**
 * Mustang's verdict on every file of the corpus (0027, 0031), the XML and
 * the PDFs, judged from what Mustang 2.26.0 wrote in a recorded gate run
 * (scripts/e-invoice/recorded/, whose run.json says when and on what): its
 * report on stdout, its log on stderr and its exit status. Each defect
 * below is that recorded run with one thing changed, so a rule is seen to
 * fire on its defect and on nothing else.
 */
const here = dirname(fileURLToPath(import.meta.url))
const recorded = (...path) => readFileSync(join(here, 'recorded', ...path), 'utf8')
const run = JSON.parse(recorded('run.json'))
const xml = corpus({ samples: run.samples.map((id) => ({ id })), xmlOf: (sample) => recorded('corpus', `${sample.id}.xml`), kindOf: (sample) => run.kinds[sample.id].kind, guidelineOf: (sample) => run.kinds[sample.id].guideline })
const entries = [...xml, ...pdfPlan(xml)]
const { accepted } = readRegisters()
const PROFILE = 'urn:cen.eu:en16931:2017'

/** The recorded run of every file: its status, its report and its log. */
const runs = () => new Map(entries.map((entry) => [entry.file, { status: run.mustang[entry.file], stdout: recorded('mustang', mustangOutputs(entry.file).report), stderr: recorded('mustang', mustangOutputs(entry.file).log) }]))
/** The recorded run on `file`, its report naming `as` as the file it judged. */
const runOf = (file, as) => {
  const ran = runs().get(file)
  return { ...ran, stdout: ran.stdout.replace(`filename="${file}"`, `filename="${as}"`) }
}
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

  // A sample's XML and its PDF share a name but for the extension; the
  // outputs of one must not overwrite the other's.
  test('writes its report and log on a PDF apart from those on the XML of the same name', () => {
    expect([mustangOutputs('e-invoice.xml'), mustangOutputs('e-invoice.pdf')]).toEqual([
      { report: 'e-invoice.report.xml', log: 'e-invoice.log' },
      { report: 'e-invoice.pdf.report.xml', log: 'e-invoice.pdf.log' },
    ])
  })
})

describe('reading Mustang', () => {
  // The XML part's info and messages, and the outer summary, each read by
  // its element, and a message's rule id out of its text, where Mustang
  // writes it and nowhere else.
  test('reads its report: the profile, the version, the rules fired, each message and both summaries', () => {
    const report = readMustang(recorded('mustang', 'control-br-27.report.xml'))
    expect(report).toMatchObject({ filename: 'control-br-27.xml', pdf: null, status: 'invalid', messages: [] })
    expect(report.xml).toMatchObject({ profile: PROFILE, validator: '2.26.0', status: 'invalid' })
    expect(report.xml.fired).toBeGreaterThan(0)
    expect(report.xml.messages.map((message) => message.key)).toEqual(['error 4 BR-27', 'warning 10'])
    // A report on a PDF has a part of its own; the recorded run of FeRD's sample EN16931_Einfach.pdf (recorded/research/) is one, with notices.
    const pdf = readMustang(recorded('research', 'EN16931_Einfach.report.xml'))
    expect([pdf.pdf.status, pdf.xml.messages.length, pdf.xml.messages.every((message) => message.severity === 'notice')]).toEqual(['valid', 7, true])
  })

  // The PDF part is the veraPDF result Mustang bundles, written as text --
  // its flavour, whether the file complies, each failed assertion's clause
  // and test number -- and Mustang's own XMP checks as messages, each keyed
  // as the PDF part's, apart from the XML part's of the same type.
  test('reads a PDF’s part: the flavour, compliance and failed rules of its veraPDF result, and its messages', () => {
    const sample = readMustang(recorded('mustang', 'e-invoice.pdf.report.xml'))
    expect(sample.pdf).toEqual({ result: { flavour: '3b', compliant: true, failed: [] }, messages: [], status: 'valid' })
    const trap = readMustang(recorded('mustang', 'control-pdfa.pdf.report.xml'))
    // The #1293 trap: the PDF part invalid, with no message, and the report valid.
    expect([trap.pdf.result, trap.pdf.messages, trap.pdf.status, trap.xml.status, trap.status]).toEqual([{ flavour: '3b', compliant: false, failed: ['pdfa 3b 6.2.4.3-2'] }, [], 'invalid', 'valid', 'valid'])
    const plain = readMustang(recorded('mustang', 'control-plain.pdf.report.xml'))
    expect(plain.pdf.result.flavour).toBe('1b')
    expect(plain.pdf.messages.map((message) => message.key)).toEqual(['pdf error 17', 'pdf error 23'])
    expect([plain.xml, plain.messages.map((message) => message.key)]).toEqual([null, ['exception 17']])
    expect(readMustang(recorded('mustang', 'control-xmp.pdf.report.xml')).pdf.messages.map((message) => message.key)).toEqual(['pdf error 12'])
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
    const { rows, problems, compiled } = judged()
    expect(problems).toEqual([])
    expect(rows.map((row) => [row.file, row.verdict])).toEqual(entries.map((entry) => [entry.file, 'as expected']))
    expect(rows.find((row) => row.file === 'e-invoice-reverse-charge.xml').accepted).toEqual(['warning 4 PEPPOL-EN16931-R008'])
    // The schematrons Mustang compiled, by the profile it read each sample as: FeRD's for a Factur-X invoice, which the oracle reads; CEN's and XRechnung's own for an XRechnung (0038), neither of them FeRD's.
    expect(compiled).toEqual({
      'urn:cen.eu:en16931:2017': ['/xslt/ZF_250/FACTUR-X_EN16931.xslt'],
      'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0': ['/xslt/en16931schematron/EN16931-CII-validation.xslt', '/xslt/XR_30/XRechnung-CII-validation.xslt'],
    })
    expect(rows.find((row) => row.file === 'e-invoice-xrechnung.xml')).toMatchObject({ verdict: 'as expected', status: 0, refusals: [], accepted: [] })
    // How many fewer rules check an XRechnung, as 0038's limitation quotes the recorded run: a record whose counts moved fails here until the sentence is read again.
    expect(['e-invoice-xrechnung.xml', 'e-invoice.xml'].map((file) => rows.find((row) => row.file === file)?.fired)).toEqual([25, 179])
  })

  // A warning is a refusal unless the register accepts it in that file:
  // without the entry, the reverse-charge sample's empty delivery is
  // refused; an entry nothing raised accepts nothing, and goes.
  test('refuses a warning the register does not accept, and an accepted one nothing raised', () => {
    // The sample's PDF embeds its XML, and raises the warning again.
    const warning = 'warning 4 PEPPOL-EN16931-R008: [PEPPOL-EN16931-R008]-Document MUST not contain empty elements. (still status warning) [ID PEPPOL-EN16931-R008] from /xslt/ZF_250/FACTUR-X_EN16931.xslt)'
    expect(judged((given) => (given.accepted = [])).problems).toEqual([`e-invoice-reverse-charge.xml is refused by Mustang: ${warning}`, `e-invoice-reverse-charge.pdf is refused by Mustang: ${warning}`])
    expect(judged((given) => (given.accepted[0].files = ['e-invoice-reverse-charge.xml'])).problems).toEqual([`e-invoice-reverse-charge.pdf is refused by Mustang: ${warning}`])
    expect(judged((given) => given.accepted.push({ tool: 'mustang', message: 'notice 27 BR-DE-15', files: ['e-invoice.xml'], reason: 'r' })).problems).toEqual(['the accepted message mustang notice 27 BR-DE-15 was raised in none of its files: remove it from scripts/e-invoice/accepted.json'])
  })

  // Every notice is a refusal too, as a warning is: the recorded run of
  // FeRD's sample EN16931_Einfach.pdf without --no-notices raised seven,
  // of XRechnung's rules.
  test('refuses a notice, and a report on a PDF where the corpus gave XML', () => {
    const { problems } = judged((given) => given.runs.set('e-invoice.xml', { status: 0, stdout: recorded('research', 'EN16931_Einfach.report.xml'), stderr: '' }))
    expect(problems).toContain('Mustang’s report on e-invoice.xml names EN16931_Einfach.pdf as the file it judged')
    expect(problems).toContain('Mustang judged e-invoice.xml as a PDF: its report has a <pdf> part, and the file is XML')
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
    // Each sample is read as its own kind's guideline (0038), and one that names none as the profile the judge is given.
    expect(judged((given) => (given.entries.find((entry) => entry.file === 'e-invoice.xml').guideline = 'urn:factur-x.eu:1p0:en16931')).problems).toEqual(['Mustang read e-invoice.xml as the profile urn:cen.eu:en16931:2017, not as urn:factur-x.eu:1p0:en16931'])
    const xrechnung = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'
    expect(judged((given) => (given.entries.find((entry) => entry.file === 'e-invoice-xrechnung.xml').guideline = 'urn:cen.eu:en16931:2017')).problems).toEqual([`Mustang read e-invoice-xrechnung.xml as the profile ${xrechnung}, not as urn:cen.eu:en16931:2017`])
    expect(judged((given) => given.entries.forEach((entry) => delete entry.guideline), { profile: 'urn:factur-x.eu:1p0:en16931' }).problems).toContain('Mustang read e-invoice.xml as the profile urn:cen.eu:en16931:2017, not as urn:factur-x.eu:1p0:en16931')
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

describe('Mustang’s verdict on a PDF', () => {
  // The recorded PDFs as they are: every sample accepted, PDF part and XML
  // part alike, the reverse-charge sample's accepted warning raised in its
  // PDF too, and every control as it expects -- control-checksum.pdf
  // accepted, since Mustang 2.26.0 compares no declared checksum.
  test('passes the recorded run of every PDF', () => {
    const { rows, problems } = judged()
    expect(problems).toEqual([])
    expect(rows.filter((row) => row.file.endsWith('.pdf')).map((row) => [row.file, row.verdict, row.status])).toEqual([
      ['e-invoice.pdf', 'as expected', 0],
      ['e-invoice-reverse-charge.pdf', 'as expected', 0],
      ['e-invoice-exempt-paid.pdf', 'as expected', 0],
      ['e-invoice-addressed.pdf', 'as expected', 0],
      ['variant-blocks.pdf', 'as expected', 0],
      ['variant-svg.pdf', 'as expected', 0],
      ['variant-svg-bound.pdf', 'as expected', 0],
      ['variant-fonts.pdf', 'as expected', 0],
      ['variant-service-inspection.pdf', 'as expected', 0],
      ['variant-quotation.pdf', 'as expected', 0],
      ['variant-grouped-equipment.pdf', 'as expected', 0],
      ['variant-invoice.pdf', 'as expected', 0],
      ['variant-euro-invoice.pdf', 'as expected', 0],
      ['variant-site-visit.pdf', 'as expected', 0],
      ['control-plain.pdf', 'as expected', run.mustang['control-plain.pdf']],
      ['control-pdfa.pdf', 'as expected', 0],
      ['control-xmp.pdf', 'as expected', 0],
      // What Mustang 2.26.0 does not compare: a file's declared /CheckSum and /Size with its bytes, and its relationship with the profile's.
      ['control-checksum.pdf', 'as expected', 0],
      ['control-size.pdf', 'as expected', 0],
      ['control-relationship.pdf', 'as expected', 0],
      ['control-xml.pdf', 'as expected', run.mustang['control-xml.pdf']],
    ])
    expect(rows.find((row) => row.file === 'e-invoice-reverse-charge.pdf').accepted).toEqual(['warning 4 PEPPOL-EN16931-R008'])
  })

  // The #1293 trap: Mustang 2.26.0 exits 0 and its report says valid on a
  // PDF whose PDF part failed, since its verdict is the XML's. Judged by
  // its exit status or its last summary, the PDF/A break would pass; the
  // judge reads the PDF part, and refuses it twice over.
  test('refuses a sample whose PDF part failed, though Mustang exited 0 and its report says valid', () => {
    const { problems } = judged((given) => given.runs.set('e-invoice.pdf', runOf('control-pdfa.pdf', 'e-invoice.pdf')))
    expect(problems).toEqual([
      'Mustang’s veraPDF finds e-invoice.pdf not compliant, where it must be',
      'Mustang’s report on e-invoice.pdf says its PDF part is invalid, where the file must be accepted',
      'e-invoice.pdf is refused by Mustang: pdfa 3b 6.2.4.3-2: its PDF part failed it',
    ])
  })

  // A PDF part found invalid with no message and no failed rule -- one
  // that a later Mustang words otherwise -- is still a refusal, never a
  // pass for saying nothing; and a sample is PDF/A-3b, not what it declares.
  test('refuses a PDF part invalid for nothing it says, of another flavour, or without a veraPDF result', () => {
    const changed = (change) => judged((given) => given.runs.set('e-invoice.pdf', { ...runOf('e-invoice.pdf', 'e-invoice.pdf'), stdout: change(runOf('e-invoice.pdf', 'e-invoice.pdf').stdout) })).problems
    expect(changed((text) => text.replace('<summary status="valid"/>\n  </pdf>', '<summary status="invalid"/>\n  </pdf>'))).toEqual([
      'Mustang’s report on e-invoice.pdf says its PDF part is invalid, where the file must be accepted',
      'e-invoice.pdf is refused by Mustang: pdf invalid: its PDF part failed it',
    ])
    expect(changed((text) => text.replace('flavour=3b', 'flavour=2b'))).toEqual(['Mustang validated e-invoice.pdf as PDF/A-2b, not as the PDF/A-3b it must declare itself'])
    expect(changed((text) => text.replace(/ValidationResult \[[^\n]*\]/, ''))).toEqual(['Mustang’s report on e-invoice.pdf has no veraPDF result in its <pdf> part'])
    // A report with no PDF part is a PDF read as XML.
    expect(judged((given) => given.runs.set('e-invoice.pdf', runOf('e-invoice.xml', 'e-invoice.pdf'))).problems).toEqual(['Mustang’s report on e-invoice.pdf has no <pdf> part, where e-invoice.pdf is a PDF'])
  })

  // A control broken in its PDF part alone exits 0 on Mustang 2.26.0, and
  // must: a release that exits otherwise has fixed #1293, and is a new pin
  // that drops the rule. A control whose XML is broken exits otherwise, PDF
  // or not.
  test('holds a control broken in its PDF part alone to the 0 Mustang 2.26.0 exits, and every other to another', () => {
    expect(judged((given) => (given.runs.get('control-pdfa.pdf').status = 255)).problems).toEqual(['Mustang exited 255 on control-pdfa.pdf, which is broken in its PDF part alone, where Mustang 2.26.0 exits 0 (its issue #1293): a release that fixed it is a new pin, and this rule goes with it'])
    const xmlControl = entries.find((entry) => entry.file === 'control-xml.pdf')
    expect(judged((given) => (given.runs.get('control-xml.pdf').status = 0)).problems).toEqual([`Mustang exited 0 on control-xml.pdf, which is broken for ${xmlControl.why}`])
  })

  // Each control's refusals are exactly what it breaks: the plain PDF, read
  // as PDF/A-1b for want of any declaration, fails seven rules of part 1 as
  // well as the two XMP checks, and nothing else.
  test('refuses a PDF control refused for anything but exactly what it breaks', () => {
    expect(judged((given) => given.entries.find((entry) => entry.file === 'control-plain.pdf').expect.mustang.splice(2, 1)).problems).toEqual(['control-plain.pdf was refused by Mustang for pdfa 1b 6.2.3.3-1 as well, which it is not broken for'])
    expect(judged((given) => given.entries.find((entry) => entry.file === 'control-xmp.pdf').expect.mustang.push('pdf error 16')).problems).toEqual(['control-xmp.pdf was not refused by Mustang for pdf error 16, which it is broken for'])
  })
})
