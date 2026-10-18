import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { corpus } from './corpus.mjs'
import { JVM_OPTIONS } from './java.mjs'
import { pdfPlan } from './pdf-corpus.mjs'
import { readRegisters } from './registers.mjs'
import { bundledProblems, bundledVeraPdf, judgeVeraPdf, PROFILE, readVeraPdf, veraPdfArguments } from './verapdf.mjs'
import { zipOf } from './zip-of.mjs'

/**
 * veraPDF's verdict on the corpus's PDFs (0031), judged from what veraPDF
 * 1.30.3 wrote in a recorded gate run (scripts/e-invoice/recorded/, whose
 * run.json says when and on what): its JSON report on every PDF at once,
 * what it wrote on stderr, and its exit status. Each defect is that run
 * with one thing changed, so a rule is seen to fire on its defect and on
 * nothing else.
 */
const here = dirname(fileURLToPath(import.meta.url))
const recorded = (...path) => readFileSync(join(here, 'recorded', ...path), 'utf8')
const run = JSON.parse(recorded('run.json'))
const entries = pdfPlan(corpus({ samples: run.samples.map((id) => ({ id })), xmlOf: (sample) => recorded('corpus', `${sample.id}.xml`) }))
const { tools } = readRegisters()
const md5 = (bytes) => createHash('md5').update(bytes).digest('hex')
const FILE = { fileName: 'factur-x.xml', relationship: 'Alternative', mediaType: 'text/xml', md5 }

/** The recorded report, parsed, for a case to change one thing of and write again. */
const report = () => JSON.parse(recorded('verapdf', 'report.json'))
const job = (parsed, file) => parsed.report.jobs.find((each) => each.itemDetails.name.endsWith(`\\${file}`) || each.itemDetails.name.endsWith(`/${file}`))
const judged = (change = () => {}, inputs = {}) => {
  const given = { entries: structuredClone(entries), status: run.verapdf.status, stdout: recorded('verapdf', 'report.json'), stderr: recorded('verapdf', 'verapdf.log'), pinned: '1.30.3', file: FILE, ...inputs }
  change(given)
  return judgeVeraPdf(given)
}
/** The run with its report changed by `change`, which receives it parsed. */
const withReport = (change) =>
  judged((given) => {
    const parsed = report()
    change(parsed)
    given.stdout = JSON.stringify(parsed)
  })

describe('veraPDF’s command line', () => {
  // Every PDF in one JVM, as PDF/A-3b whatever a file declares -- a file
  // that declares PDF/A-2b must fail as a 3b, not pass as what it says --
  // in JSON, which Node reads without a dependency, with the embedded
  // files' features, which tie the PDF to the XML the other tools judged.
  test('validates every PDF as PDF/A-3b in one run, its proxies at a dead port, with the embedded files’ features in JSON', () => {
    expect(veraPdfArguments({ jar: 'cli.jar', files: ['a.pdf', 'b.pdf'] })).toEqual([...JVM_OPTIONS, '-jar', 'cli.jar', '--flavour', '3b', '--format', 'json', '-x', 'embeddedFile', 'a.pdf', 'b.pdf'])
  })
})

describe('reading veraPDF', () => {
  // veraPDF names each file by its absolute path, with the platform's
  // separators, however it was given; the judge knows a job by its name in
  // the corpus.
  test('reads each job by its file, its one result and the file its features show', () => {
    const read = readVeraPdf(recorded('verapdf', 'report.json'))
    expect(read.versions).toEqual([
      { id: 'core', version: '1.30.3' },
      { id: 'validation-model', version: '1.30.3' },
      { id: 'apps', version: '1.30.3' },
    ])
    expect(read.jobs.map((each) => each.file)).toEqual(entries.map((entry) => entry.file))
    const pdfa = read.jobs.find((each) => each.file === 'control-pdfa.pdf')
    expect(pdfa.results).toEqual([{ profile: PROFILE, end: 'normal', compliant: false, passedRules: 145, failedRules: 1, failed: ['6.2.4.3-2'] }])
    expect(pdfa.embedded).toMatchObject({ fileName: 'factur-x.xml', afRelationship: 'Alternative', subtype: 'text/xml' })
    expect(read.jobs.find((each) => each.file === 'control-plain.pdf').embedded).toBeNull()
    const posix = report()
    posix.report.jobs[0].itemDetails.name = '/home/runner/work/r/r/test-results/e-invoice/corpus/e-invoice.pdf'
    expect(readVeraPdf(JSON.stringify(posix)).jobs[0].file).toBe('e-invoice.pdf')
  })

  // A run that crashed mid-write leaves no report; read as an empty one it
  // would be a pass.
  test('refuses a report that is not one', () => {
    expect(() => readVeraPdf('{"report":')).toThrow()
    expect(() => readVeraPdf('{"report":{}}')).toThrow('veraPDF wrote no report with jobs')
  })
})

describe('veraPDF’s verdict', () => {
  // The recorded run as it is: every sample PDF/A-3b with the file it must
  // embed, and every control refused for exactly what it breaks -- or
  // accepted, where what it breaks is nothing veraPDF reads.
  test('passes the recorded run', () => {
    const { rows, problems, reported } = judged()
    expect(problems).toEqual([])
    expect(rows.map((row) => [row.file, row.verdict, row.refusals])).toEqual([
      ['e-invoice.pdf', 'as expected', []],
      ['e-invoice-reverse-charge.pdf', 'as expected', []],
      ['e-invoice-exempt-paid.pdf', 'as expected', []],
      ['variant-blocks.pdf', 'as expected', []],
      ['variant-fonts.pdf', 'as expected', []],
      ['variant-service-inspection.pdf', 'as expected', []],
      ['variant-quotation.pdf', 'as expected', []],
      ['variant-grouped-equipment.pdf', 'as expected', []],
      ['variant-invoice.pdf', 'as expected', []],
      ['variant-euro-invoice.pdf', 'as expected', []],
      ['control-plain.pdf', 'as expected', ['6.2.4.3-2', '6.6.2.1-1']],
      ['control-pdfa.pdf', 'as expected', ['6.2.4.3-2']],
      ['control-xmp.pdf', 'as expected', []],
      ['control-checksum.pdf', 'as expected', ['embedded checkSum']],
      ['control-size.pdf', 'as expected', ['embedded size']],
      ['control-relationship.pdf', 'as expected', ['embedded afRelationship']],
      ['control-xml.pdf', 'as expected', []],
    ])
    expect(reported).toEqual(['1.30.3'])
  })

  // The run as a whole: veraPDF exits 1 when a file does not comply, and
  // the corpus says which must not; a line on stderr is something its
  // report does not say; a part of another version is another oracle.
  test('refuses a run that exited otherwise, wrote on stderr, or is of another version', () => {
    expect(judged((given) => (given.status = 0)).problems).toEqual(['veraPDF exited 0, where a control fails a rule and it exits 1'])
    expect(judged((given) => (given.stderr = 'SEVERE: Exception parsing control-plain.pdf\n')).problems).toEqual(['veraPDF wrote on stderr, which it does not on a run that went as its report says: SEVERE: Exception parsing control-plain.pdf'])
    expect(judged(undefined, { pinned: '1.30.2' }).problems).toEqual([
      'veraPDF’s core is 1.30.3, not 1.30.2, which docs/release/e-invoice-tools.json pins',
      'veraPDF’s validation-model is 1.30.3, not 1.30.2, which docs/release/e-invoice-tools.json pins',
      'veraPDF’s apps is 1.30.3, not 1.30.2, which docs/release/e-invoice-tools.json pins',
    ])
    expect(withReport((parsed) => delete parsed.report.buildInformation).problems).toEqual(['veraPDF’s report names no version of itself'])
  })

  // Each PDF of the corpus is one job, once, and nothing else: a job
  // missing is a PDF nobody judged, one extra or twice a run of another
  // corpus; a file it failed to parse or that threw is no verdict.
  test('refuses a run whose jobs are not the corpus’s PDFs, once each, all parsed', () => {
    const at = (file) => entries.findIndex((entry) => entry.file === file)
    expect(withReport((parsed) => parsed.report.jobs.splice(at('control-pdfa.pdf'), 1)).problems).toEqual(['veraPDF has no job for control-pdfa.pdf'])
    expect(
      withReport((parsed) => {
        parsed.report.jobs.push(structuredClone(parsed.report.jobs[0]))
        parsed.report.batchSummary.totalJobs = entries.length + 1
      }).problems,
    ).toEqual([`veraPDF ran ${String(entries.length + 1)} jobs, where the corpus has ${String(entries.length)} PDFs`, 'veraPDF judged e-invoice.pdf more than once'])
    expect(withReport((parsed) => (parsed.report.jobs[0].itemDetails.name = 'C:\\x\\invoice.pdf')).problems).toEqual(['veraPDF judged invoice.pdf, which is no PDF of the corpus', 'veraPDF has no job for e-invoice.pdf'])
    expect(withReport((parsed) => (parsed.report.batchSummary.failedParsingJobs = 1)).problems).toEqual(['veraPDF’s failedParsingJobs is 1, not 0'])
    expect(withReport((parsed) => (parsed.report.batchSummary.failedEncryptedJobs = 1)).problems).toEqual(['veraPDF’s failedEncryptedJobs is 1, not 0'])
    expect(withReport((parsed) => (parsed.report.batchSummary.veraExceptions = 1)).problems).toEqual(['veraPDF’s veraExceptions is 1, not 0'])
    expect(withReport((parsed) => (parsed.report.batchSummary.outOfMemory = 1)).problems).toEqual(['veraPDF’s outOfMemory is 1, not 0'])
  })

  // A control veraPDF refuses by its feature report alone -- the embedded
  // file's declared /CheckSum, /Size or relationship -- fails no rule of
  // the profile, so a run of such controls among the samples exits 0, and
  // an exit 1 there is a file failing that nothing expects to fail.
  test('expects an exit of 0 where every control it refuses is refused by its embedded file’s fields alone', () => {
    const byFields = (entry) => entry.from === undefined || (Array.isArray(entry.expect.verapdf) && entry.expect.verapdf.every((key) => key.startsWith('embedded ')))
    const kept = new Set(entries.filter(byFields).map((entry) => entry.file))
    expect([...kept].filter((file) => file.startsWith('control-'))).toEqual(['control-checksum.pdf', 'control-size.pdf', 'control-relationship.pdf'])
    const only = (status) =>
      judged((given) => {
        given.entries = given.entries.filter((entry) => kept.has(entry.file))
        const parsed = report()
        parsed.report.jobs = parsed.report.jobs.filter((each) => kept.has(String(each.itemDetails.name).split(/[\\/]/).pop()))
        parsed.report.batchSummary.totalJobs = parsed.report.jobs.length
        given.stdout = JSON.stringify(parsed)
        given.status = status
      })
    expect(only(0).problems).toEqual([])
    expect(only(1).problems).toEqual(['veraPDF exited 1, where every file complies and it exits 0'])
  })

  // A sample is PDF/A-3b by the 3b profile, its job ended normally, and it
  // passed rules: a job that stopped, or validated nothing, is no pass.
  test('refuses a sample that does not comply, was validated otherwise, or checked nothing', () => {
    const sample = (parsed) => job(parsed, 'e-invoice.pdf').validationResult[0]
    expect(withReport((parsed) => (sample(parsed).compliant = false)).problems).toEqual(['veraPDF finds e-invoice.pdf not PDF/A-3b compliant, where it must be'])
    expect(withReport((parsed) => (sample(parsed).profileName = 'PDF/A-2B validation profile')).problems).toEqual(['veraPDF validated e-invoice.pdf against PDF/A-2B validation profile, not the PDF/A-3b validation profile'])
    expect(withReport((parsed) => (sample(parsed).jobEndStatus = 'timeout')).problems).toEqual(['veraPDF’s job on e-invoice.pdf ended timeout, not normally'])
    expect(withReport((parsed) => (sample(parsed).details.passedRules = 0)).problems).toEqual(['veraPDF passed no rule on e-invoice.pdf, so it checked nothing'])
    expect(withReport((parsed) => job(parsed, 'e-invoice.pdf').validationResult.push(sample(parsed))).problems).toEqual(['veraPDF validated e-invoice.pdf against 2 profiles, where the gate asks for one'])
    expect(withReport((parsed) => (sample(parsed).details.failedRules = 1)).problems).toEqual(['veraPDF counts 1 rules e-invoice.pdf failed, and summarises 0'])
  })

  // veraPDF reports the embedded file as the PDF declares it; the judge
  // holds it to the XML the corpus says the PDF embeds. Its JSON keeps one
  // file of several, under another key, and the judge reads that as more.
  test('refuses a sample whose embedded file veraPDF shows otherwise than the corpus’s XML, or more than one', () => {
    const shown = (parsed) => job(parsed, 'e-invoice.pdf').featuresReport.embeddedFiles
    expect(withReport((parsed) => (shown(parsed).size = String(Number(shown(parsed).size) + 1))).problems).toEqual(['e-invoice.pdf is refused by veraPDF: embedded size'])
    expect(withReport((parsed) => (shown(parsed).fileName = 'zugferd-invoice.xml')).problems).toEqual(['e-invoice.pdf is refused by veraPDF: embedded fileName'])
    expect(withReport((parsed) => (shown(parsed).afRelationship = 'Data')).problems).toEqual(['e-invoice.pdf is refused by veraPDF: embedded afRelationship'])
    expect(withReport((parsed) => (shown(parsed).subtype = 'application/xml')).problems).toEqual(['e-invoice.pdf is refused by veraPDF: embedded subtype'])
    expect(withReport((parsed) => (job(parsed, 'e-invoice.pdf').featuresReport.embeddedFiles = { embeddedFile: shown(parsed) })).problems).toEqual(['e-invoice.pdf is refused by veraPDF: embedded files'])
    expect(withReport((parsed) => (job(parsed, 'e-invoice.pdf').featuresReport = {})).problems).toEqual(['e-invoice.pdf is refused by veraPDF: embedded files'])
    // A PDF the corpus says embeds nothing, with a file.
    expect(withReport((parsed) => (job(parsed, 'control-plain.pdf').featuresReport = job(parsed, 'e-invoice.pdf').featuresReport)).problems).toEqual(['control-plain.pdf was refused by veraPDF for embedded files as well, which it is not broken for'])
  })

  // A control veraPDF accepted is a broken file nothing is watching; one
  // refused for something else as well, or not for all it expects, is not
  // the file its name says.
  test('refuses a control it accepted, or refused for anything but exactly what it breaks', () => {
    const like = (parsed, file, as) => Object.assign(job(parsed, file), { validationResult: structuredClone(job(parsed, as).validationResult) })
    const pdfa = entries.find((entry) => entry.file === 'control-pdfa.pdf')
    expect(withReport((parsed) => like(parsed, 'control-pdfa.pdf', 'e-invoice.pdf')).problems).toEqual([`control-pdfa.pdf is broken for ${pdfa.why}, and veraPDF accepted it: nothing is watching that`])
    expect(withReport((parsed) => like(parsed, 'control-pdfa.pdf', 'control-plain.pdf')).problems).toEqual(['control-pdfa.pdf was refused by veraPDF for 6.6.2.1-1 as well, which it is not broken for'])
    expect(judged((given) => given.entries.find((entry) => entry.file === 'control-plain.pdf').expect.verapdf.push('6.6.4-1')).problems).toEqual(['control-plain.pdf was not refused by veraPDF for 6.6.4-1, which it is broken for'])
  })

  // A run that did not start, or wrote no JSON, is no verdict on anything.
  test('refuses a run that did not run, or wrote no report it can read', () => {
    expect(judged((given) => (given.error = new Error('spawn java ENOENT'))).problems).toEqual(['veraPDF did not run: spawn java ENOENT'])
    expect(judged((given) => (given.stdout = '')).problems[0]).toMatch(/^veraPDF wrote no report it can read: /)
  })
})

describe('the veraPDF inside Mustang', () => {
  // Mustang validates a PDF's PDF/A with a veraPDF of its own, which the
  // gate does not pin: the floor holds it, read from the pom.properties
  // Maven writes into a JAR for each artefact it bundles.
  test('is read from its JAR’s pom.properties, and held to the floor', () => {
    const jar = zipOf([
      { name: 'META-INF/maven/org.verapdf/validation-model-jakarta/pom.properties', data: 'artifactId=validation-model-jakarta\ngroupId=org.verapdf\nversion=1.30.2\n' },
      { name: 'META-INF/maven/org.verapdf/parser/pom.properties', data: 'artifactId=parser\ngroupId=org.verapdf\nversion=1.30.1\n' },
      { name: 'META-INF/maven/org.mustangproject/core/pom.properties', data: 'version=2.26.0\n' },
      { name: 'org/verapdf/Some.class', data: 'x' },
    ])
    const bundled = bundledVeraPdf(jar)
    expect(bundled).toEqual([
      { artifact: 'validation-model-jakarta', version: '1.30.2' },
      { artifact: 'parser', version: '1.30.1' },
    ])
    expect(bundledProblems(bundled, tools.veraPdfFloor, 'Mustang 2.26.0')).toEqual(['Mustang 2.26.0 bundles veraPDF’s parser 1.30.1, below the floor of 1.30.2 (GHSA-3jh7-wm29-q568, GHSA-36mm-w85j-3q2j)'])
    expect(bundledProblems(bundled.slice(0, 1), tools.veraPdfFloor, 'Mustang 2.26.0')).toEqual([])
    // A JAR that names no veraPDF is one whose PDF/A part nobody can hold to the floor.
    expect(bundledProblems(bundledVeraPdf(zipOf([{ name: 'a.txt', data: 'a' }])), tools.veraPdfFloor, 'Mustang 2.26.0')).toEqual(['Mustang 2.26.0’s JAR names no veraPDF it bundles, where it validates PDF/A with one: the floor cannot be held'])
  })
})
