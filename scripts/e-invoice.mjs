// The e-invoice gate (0027, 0031, 0038, 0056): Mustang, KoSIT's validator
// and veraPDF, at the releases docs/release/e-invoice-tools.json pins, over
// the CII XML the runtime writes of every e-invoice sample of the corpus --
// the Factur-X samples' and the XRechnung sample's, each in its kind's
// KoSIT scenario -- the PDF/A-3b the renderer draws of each Factur-X
// sample, and the PDF/A-2b it draws of every starter that is no e-invoice,
// which veraPDF alone judges; and over controls broken one named way
// each, with Java's HTTP and HTTPS proxies at a dead port (a raw socket is
// not caught); and the closed code lists and rule ids of report-spec held
// to the schematrons those tools run.
//
//   node scripts/e-invoice.mjs [--java <path>] [--cache <dir>] [--results <file>] [--record]
//
// It needs `pnpm build` first, because the corpus is resolved, written and
// drawn by the packages as built, and a Java at least as new as every pin's
// `java`. In order:
//
// 1. Checks the registers, and the Java against every JAR's, and refuses to
//    run on a wrong one.
// 2. Fetches every tool into the cache, each refused unless its SHA-256 is
//    the registered one (scripts/e-invoice/cache.mjs), unpacks KoSIT's
//    configuration from its verified bytes (scripts/e-invoice/zip.mjs), and
//    holds the veraPDF Mustang bundles to the register's floor.
// 3. Makes the corpus -- the samples' XML, resolved in a final render, and
//    its controls (scripts/e-invoice/corpus.mjs); each sample's PDF, drawn
//    from that very document, its variants and its controls
//    (scripts/e-invoice/pdf-corpus.mjs); every starter that is no
//    e-invoice drawn as a PDF/A-2b, its variants and its controls
//    (scripts/e-invoice/pdfa-2b.mjs), each PDF drawn by
//    scripts/e-invoice/draw.mjs -- checks it, each PDF's embedded file read
//    back by pdf-lib, and what a sample's XMP states of it and of the PDF/A
//    it is, among it, refusing to run on a wrong one, and writes it.
// 4. Runs Mustang once per file of the XML and the PDF/A-3b, KoSIT once
//    over the XML, and veraPDF once over the PDF/A-3b with `--flavour 3b`
//    and once over the PDF/A-2b with `--flavour 2b`, every proxy a dead
//    port (scripts/e-invoice/java.mjs), stdin an empty pipe.
// 5. Judges what each said (mustang.mjs, kosit.mjs, verapdf.mjs) and holds
//    report-spec's lists and rule ids to the schematrons the runs name, and
//    its XRechnung rules and shapes to the XRechnung schematron of the same
//    configuration (oracle.mjs).
// 6. Writes `test-results/e-invoice.json` -- the corpus as judged, every
//    verdict, the times -- with every tool's own output beside it in
//    `test-results/e-invoice/`, and exits 1 on any problem. A run that
//    stopped still writes the file, saying why.
//
// `--record` copies a passing run's XML corpus and outputs into
// scripts/e-invoice/recorded/, which the judges' tests read, without the
// machine's path to the repository (scripts/e-invoice/record.mjs), and each
// PDF's digest of its inflated objects (report-corpus's `inflatedDigest`)
// rather than its bytes, which depend on the zlib that deflated them: run it when a
// tool, the corpus, a control or what the renderer draws changes, and
// commit what it wrote. A run without it fails where the recorded corpus is
// not the one it judged, so that the judges' tests never read a corpus gone
// stale.
//
// Run by the `e-invoice` job in gates.yml, and by hand the same way.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { fetchVerified, layout, readVerified, sha256File } from './e-invoice/cache.mjs'
import { corpus as buildCorpus, corpusProblems, KINDS, strayAccepted } from './e-invoice/corpus.mjs'
import { samplesOf } from './e-invoice/draw.mjs'
import { javaMajor, javaVersion } from './e-invoice/java.mjs'
import { judgeKosit, kositArguments, readKositConsole, reportName } from './e-invoice/kosit.mjs'
import { judgeMustang, mustangArguments, mustangOutputs } from './e-invoice/mustang.mjs'
import { CODE_LISTS, oracleProblems, readCodedb, readSchematron, readVariables, scenarioSchematrons } from './e-invoice/oracle.mjs'
import { embeddingProblems, PDF_BASE, pdfCorpus, variantProblems } from './e-invoice/pdf-corpus.mjs'
import { identificationProblems, pdfa2bCorpus, pdfa2bPlan } from './e-invoice/pdfa-2b.mjs'
import { recordedConsole, recordedText, staleRecorded } from './e-invoice/record.mjs'
import { acceptedProblems, judgedBy, PDF_FORMATS, readRegisters, toolOf, toolProblems } from './e-invoice/registers.mjs'
import { bundledProblems, bundledVeraPdf, judgeVeraPdf, veraPdfArguments, veraPdfOutputs } from './e-invoice/verapdf.mjs'
import { entryNamed, unzip } from './e-invoice/zip.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Where the gate writes, under the repository. */
export const RESULTS = 'test-results/e-invoice.json'
const WORK = 'test-results/e-invoice'
const RECORDED = 'scripts/e-invoice/recorded'
const BUILT = {
  spec: 'packages/report-spec/dist/index.mjs',
  runtime: 'packages/report-runtime/dist/index.mjs',
  corpus: 'packages/report-corpus/dist/index.mjs',
  renderer: 'packages/report-render-pdf/dist/index.mjs',
}
/** What each tool's outputs are kept in, under the run's directory and the record's. */
const OUTPUTS = ['mustang', 'kosit', 'verapdf']

/** The scenario of KoSIT's configuration every Factur-X sample must match: the CII D16B schema and CEN's schematron, nothing of XRechnung's; the oracle reads CEN's schematron where it runs. */
const SCENARIO = KINDS.facturX.scenario
/** The scenario an XRechnung sample must match, whose schematron beside CEN's is XRechnung's, which the oracle holds report-spec's XRechnung rules and shapes to (0037, 0038). */
const XRECHNUNG_SCENARIO = KINDS.xrechnung.scenario

/** The options of the command line. */
function options(argv) {
  const value = (name) => {
    const at = argv.indexOf(name)
    return at === -1 ? undefined : argv[at + 1]
  }
  return {
    java: value('--java') ?? 'java',
    cache: resolve(repo, value('--cache') ?? '.e-invoice-cache'),
    results: resolve(repo, value('--results') ?? RESULTS),
    record: argv.includes('--record'),
  }
}

const seconds = (since) => Math.round((performance.now() - since) / 100) / 10
const local = (path) => relative(repo, path).replaceAll('\\', '/')
const base64Sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('base64')
const md5 = (bytes) => createHash('md5').update(bytes).digest('hex')
/** Every run is a JVM's, each output read whole: veraPDF's report on the corpus was 70 kB on 18 October 2026, Mustang's on a file a few. */
const RUN = { encoding: 'utf8', input: '', maxBuffer: 64 * 1024 * 1024, windowsHide: true }

/** A package as built: refused, saying how to build it, where it is not. */
async function built(path) {
  if (!existsSync(join(repo, path)))
    throw new Error(`${path} is missing: run pnpm build first, since the corpus is resolved and drawn by the packages as built`)
  return import(pathToFileURL(join(repo, path)).href)
}

/** The Java to run on, refused below any JAR's own floor: `{ version, major }`. */
function checkedJava(java, tools) {
  const said = spawnSync(java, ['-version'], { encoding: 'utf8' })
  if (said.error !== undefined) throw new Error(`cannot run ${java}: ${said.error.message}; pass --java <path to java>`)
  const text = `${said.stderr}${said.stdout}`
  const major = javaMajor(text)
  for (const tool of tools.filter((entry) => entry.java !== null)) {
    if (major === undefined || major < tool.java)
      throw new Error(`${java} is Java ${String(major)}, and ${tool.name} ${tool.version} needs ${String(tool.java)} or later`)
  }
  return { version: javaVersion(text), major }
}

/**
 * Every tool fetched into the cache and checked; KoSIT's configuration
 * unpacked again from its verified bytes; Mustang's JAR read once, verified,
 * for the veraPDF it bundles and the schematron it runs.
 */
async function prepareTools(register, cache) {
  const where = layout(cache)
  const fetched = []
  for (const tool of register.tools)
    if (await fetchVerified({ url: tool.url, path: where.file(tool), sha256: tool.sha256 })) fetched.push(`${tool.id} ${tool.version}`)
  const configuration = toolOf(register, 'xrechnung-configuration')
  const unpacked = where.unpacked(configuration)
  rmSync(unpacked, { recursive: true, force: true })
  mkdirSync(unpacked, { recursive: true })
  const files = unzip(readVerified(where.file(configuration), configuration.sha256), unpacked)
  const mustang = toolOf(register, 'mustang')
  const mustangJar = readVerified(where.file(mustang), mustang.sha256)
  const bundled = bundledVeraPdf(mustangJar)
  console.log(
    `e-invoice: ${register.tools.map((tool) => `${tool.id} ${tool.version}`).join(', ')} checked against their registered SHA-256; fetched ${fetched.length === 0 ? 'nothing' : fetched.join(', ')}; the configuration unpacked to ${String(files.length)} files; Mustang bundles veraPDF ${[...new Set(bundled.map((part) => part.version))].join(', ') || 'nowhere'}`,
  )
  return { where, unpacked, mustang, mustangJar, bundled, kosit: toolOf(register, 'kosit'), verapdf: toolOf(register, 'verapdf'), configuration }
}

/** Mustang once per file, each run's report and log written beside the corpus's. */
function runMustang({ java, jar, entries, work }) {
  const runs = new Map()
  const started = performance.now()
  for (const entry of entries) {
    const ran = spawnSync(java, mustangArguments({ jar, file: entry.file }), { ...RUN, cwd: join(work, 'corpus') })
    const outputs = mustangOutputs(entry.file)
    writeFileSync(join(work, 'mustang', outputs.report), ran.stdout ?? '')
    writeFileSync(join(work, 'mustang', outputs.log), ran.stderr ?? '')
    runs.set(entry.file, { status: ran.status, stdout: ran.stdout ?? '', stderr: ran.stderr ?? '', ...(ran.error === undefined ? {} : { error: ran.error }) })
  }
  return { runs, seconds: seconds(started) }
}

/** KoSIT once over every XML file: its reports, the names of any others it wrote, its console and its status. */
function runKosit({ java, major, tools, entries, work }) {
  const out = join(work, 'kosit')
  const started = performance.now()
  const ran = spawnSync(
    java,
    kositArguments({
      jar: tools.where.file(tools.kosit),
      scenarios: join(tools.unpacked, 'scenarios.xml'),
      repository: tools.unpacked,
      out,
      files: entries.map((entry) => join(work, 'corpus', entry.file)),
      java: major,
    }),
    { ...RUN, cwd: work },
  )
  const took = seconds(started)
  const console_ = `${ran.stdout ?? ''}${ran.stderr ?? ''}`
  writeFileSync(join(out, 'console.log'), console_)
  const names = new Set(entries.map((entry) => reportName(entry.file)))
  const reports = new Map(
    entries.map((entry) => [entry.file, existsSync(join(out, reportName(entry.file))) ? readFileSync(join(out, reportName(entry.file)), 'utf8') : undefined]),
  )
  const others = readdirSync(out).filter((name) => name !== 'console.log' && !names.has(name))
  return { reports, others, status: ran.status, error: ran.error, console: console_, seconds: took }
}

/** veraPDF once over every PDF of `entries`, as `flavour`, run in the corpus's directory: its report and what it wrote on stderr, kept beside the others'. */
function runVeraPdf({ java, tools, entries, work, flavour }) {
  const started = performance.now()
  const ran = spawnSync(java, veraPdfArguments({ jar: tools.where.file(tools.verapdf), files: entries.map((entry) => entry.file), flavour }), {
    ...RUN,
    cwd: join(work, 'corpus'),
  })
  const outputs = veraPdfOutputs(flavour)
  writeFileSync(join(work, 'verapdf', outputs.report), ran.stdout ?? '')
  writeFileSync(join(work, 'verapdf', outputs.log), ran.stderr ?? '')
  return { status: ran.status, stdout: ran.stdout ?? '', stderr: ran.stderr ?? '', error: ran.error, seconds: seconds(started) }
}

/** The schematrons the runs name, and XRechnung's beside CEN's in the configuration, read out of the verified downloads, for the oracle; or why they cannot be. */
function pinnedSchematrons({ tools, mustangVerdict, kositVerdict, profile }) {
  const problems = []
  const located = kositVerdict.schematrons[SCENARIO] ?? []
  const compiled = mustangVerdict.compiled[profile] ?? []
  if (located.length !== 1)
    problems.push(`KoSIT's reports on the samples name ${String(located.length)} schematrons for ${SCENARIO}, where the oracle reads one`)
  if (compiled.length !== 1)
    problems.push(`Mustang's logs on the Factur-X samples name ${String(compiled.length)} schematrons it compiled, where the oracle reads one`)
  if (problems.length > 0) return { problems }
  const [location] = located
  const cen = {
    name: `CEN’s schematron (${location} in KoSIT’s configuration ${tools.configuration.version})`,
    asserts: readSchematron(readFileSync(join(tools.unpacked, location), 'utf8')),
  }
  // XRechnung's is the one schematron its scenario runs that the samples' does not.
  const xrechnungAt = scenarioSchematrons(readFileSync(join(tools.unpacked, 'scenarios.xml'), 'utf8'), XRECHNUNG_SCENARIO).filter((each) => each !== location)
  if (xrechnungAt.length !== 1)
    return {
      problems: [`KoSIT’s configuration has ${XRECHNUNG_SCENARIO} run ${String(xrechnungAt.length)} schematrons beside CEN’s, where the oracle reads one`],
    }
  const xrechnungText = readFileSync(join(tools.unpacked, xrechnungAt[0]), 'utf8')
  // The release of XRechnung the register pins the configuration to, whose asset is fetched by it and verified by its SHA-256.
  const xrechnung = {
    name: `XRechnung’s schematron (${xrechnungAt[0]} in KoSIT’s configuration ${tools.configuration.version})`,
    asserts: readSchematron(xrechnungText),
    variables: readVariables(xrechnungText),
    release: tools.configuration.xrechnung,
  }
  const jar = tools.mustangJar
  const path = compiled[0].replace(/^\//, '')
  const asserts = readSchematron(entryNamed(jar, path).toString('utf8'))
  const databases = [...new Set(asserts.flatMap((assert) => [...String(assert.test).matchAll(/document\('([^']+)'\)/g)].map((match) => match[1])))]
  if (databases.length !== 1) return { problems: [`Mustang's ${path} reads ${String(databases.length)} code databases, where the oracle reads one`] }
  const codedb = readCodedb(entryNamed(jar, `${dirname(path)}/${databases[0]}`).toString('utf8'))
  return { problems: [], cen, ferd: { name: `FeRD’s schematron (/${path} in Mustang ${tools.mustang.version})`, asserts, codedb }, xrechnung }
}

/** The run the record holds: its run.json, or nothing where none is recorded. */
function recordedRun() {
  const file = join(repo, RECORDED, 'run.json')
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
}

/** The XML corpus a run recorded, by file name: what the judges' tests read. */
function recordedCorpus() {
  const dir = join(repo, RECORDED, 'corpus')
  return new Map(existsSync(dir) ? readdirSync(dir).map((name) => [name, readFileSync(join(dir, name), 'utf8')]) : [])
}

/**
 * A passing run's XML corpus and outputs, copied for the judges' tests as
 * `recordedText` writes them, with what they were recorded on, and each
 * PDF's inflated digest. The PDFs themselves are not recorded: their bytes
 * are the zlib's they were drawn with, and the outputs are what the tests read.
 */
function record({ work, entries, java, mustangRuns, kosit, verapdf, verapdf2b, tools }) {
  const into = join(repo, RECORDED)
  for (const part of ['corpus', ...OUTPUTS]) {
    rmSync(join(into, part), { recursive: true, force: true })
    mkdirSync(join(into, part), { recursive: true })
    for (const name of readdirSync(join(work, part))) {
      if (part === 'corpus' && !name.endsWith('.xml')) continue
      const text = readFileSync(join(work, part, name), 'utf8')
      writeFileSync(join(into, part, name), part === 'kosit' && name === 'console.log' ? recordedConsole(text, repo) : recordedText(text, repo))
    }
  }
  const run = recordedRun()
  const recorded = {
    $comment: run.$comment,
    recordedAt: new Date().toISOString(),
    machine: { platform: process.platform, arch: process.arch, node: process.version, zlib: process.versions.zlib, java: java.version },
    tools: Object.fromEntries([tools.mustang, tools.kosit, tools.configuration, tools.verapdf].map((tool) => [tool.id, tool.version])),
    samples: entries.filter((entry) => entry.format === 'xml' && entry.sample !== undefined).map((entry) => entry.sample),
    kinds: Object.fromEntries(
      entries
        .filter((entry) => entry.format === 'xml' && entry.sample !== undefined)
        .map((entry) => [entry.sample, { kind: entry.kind, guideline: entry.guideline }]),
    ),
    mustang: Object.fromEntries(judgedBy('mustang', entries).map((entry) => [entry.file, mustangRuns.get(entry.file).status])),
    kosit: { status: kosit.status },
    verapdf: { status: verapdf.status },
    verapdf2b: { status: verapdf2b.status },
    pdfs: Object.fromEntries(entries.filter((entry) => PDF_FORMATS.includes(entry.format)).map((entry) => [entry.file, entry.digest])),
    research: run.research,
  }
  writeFileSync(join(into, 'run.json'), `${JSON.stringify(recorded, null, 2)}\n`)
  console.log(`e-invoice: recorded the run into ${RECORDED}`)
}

async function main(argv) {
  const startedAt = new Date().toISOString()
  const started = performance.now()
  const { java, cache, results, record: recording } = options(argv)
  const { tools: register, accepted } = readRegisters(repo)
  const wrong = [...toolProblems(register), ...acceptedProblems(accepted)]
  if (wrong.length > 0) throw new Error(`the registers do not hold:\n  - ${wrong.join('\n  - ')}`)
  const jvm = checkedJava(java, register.tools)
  const tools = await prepareTools(register, cache)
  const floor = bundledProblems(tools.bundled, register.veraPdfFloor, `Mustang ${tools.mustang.version}`)
  if (floor.length > 0) throw new Error(`the tools do not hold:\n  - ${floor.join('\n  - ')}`)

  const spec = await built(BUILT.spec)
  const corpusPackage = await built(BUILT.corpus)
  const { documentOf, draw, drawVariant, drawStarter2b, drawVariant2b, drawPlain2bBase } = samplesOf({
    spec,
    runtime: await built(BUILT.runtime),
    renderer: await built(BUILT.renderer),
    corpus: corpusPackage,
  })
  const drawing = performance.now()
  // Each sample's BT-24 as report-spec names its kind's, which Mustang must read it as.
  const GUIDELINES = {
    facturX: (invoice) => spec.FACTUR_X_PROFILES[invoice.profile].guideline,
    xrechnung: (invoice) => spec.XRECHNUNG[invoice.version].guideline,
  }
  const xmlEntries = buildCorpus({
    samples: [...corpusPackage.E_INVOICE_SAMPLES, ...corpusPackage.XRECHNUNG_SAMPLES],
    xmlOf: (sample) => documentOf(sample).eInvoice.xml,
    kindOf: (sample) => sample.report.eInvoice.kind,
    guidelineOf: (sample) => GUIDELINES[sample.report.eInvoice.kind](sample.report.eInvoice),
  })
  const pdfEntries = await pdfCorpus({ entries: xmlEntries, draw, drawVariant })
  // The 2b corpus's starters as they are, and its 3b control the very PDF/A-3b the 3b corpus drew of its base sample.
  const base3b = pdfEntries.find((entry) => entry.file === `${PDF_BASE}.pdf`)
  const pdfa2bEntries = await pdfa2bCorpus({
    plan: pdfa2bPlan(
      corpusPackage.STARTERS.map((starter) => ({ id: starter.id, eInvoice: starter.report.eInvoice !== undefined })),
      { base3bXml: base3b.embeds },
    ),
    drawStarter: drawStarter2b,
    drawVariant: drawVariant2b,
    drawPlain: drawPlain2bBase,
    sample3b: base3b.pdf,
  })
  const pdfs = [...pdfEntries, ...pdfa2bEntries]
  for (const entry of pdfs) entry.digest = await corpusPackage.inflatedDigest(entry.pdf)
  const drawn = seconds(drawing)
  const entries = [...xmlEntries, ...pdfs]
  // The fx and pdfaid properties read by their namespace, and BT-24 by its path, with the corpus's readers.
  const texts = (xmp, namespace, ...locals) => {
    const read = corpusPackage.readXmp(xmp)
    return locals.map((local) => corpusPackage.propertiesOf(read, namespace, local).map((property) => property.text))
  }
  const fx = (xmp) => {
    const [documentFileName, conformanceLevel] = texts(xmp, spec.FACTUR_X.xmpNamespace, 'DocumentFileName', 'ConformanceLevel')
    return { documentFileName, conformanceLevel }
  }
  const pdfaid = (xmp) => {
    const [part, conformance] = texts(xmp, corpusPackage.XMP_NAMESPACES.pdfaid, 'part', 'conformance')
    return { part, conformance }
  }
  const guidelineOf = (xml) =>
    corpusPackage.textAt(corpusPackage.readCii(xml), 'rsm:ExchangedDocumentContext/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID')
  const corpusWrong = [
    ...corpusProblems(entries),
    ...strayAccepted(accepted.accepted, entries),
    ...variantProblems(corpusPackage.STARTERS.map((starter) => starter.id)),
    ...(await embeddingProblems(pdfs, {
      readObjects: corpusPackage.readPdfObjects,
      fileName: spec.FACTUR_X.fileName,
      fx,
      guidelineOf,
      profiles: spec.FACTUR_X_PROFILES,
    })),
    ...(await identificationProblems(pdfs, { readObjects: corpusPackage.readPdfObjects, pdfaid })),
  ]
  if (corpusWrong.length > 0) throw new Error(`the corpus does not hold:\n  - ${corpusWrong.join('\n  - ')}`)
  const work = join(repo, WORK)
  rmSync(work, { recursive: true, force: true })
  for (const part of ['corpus', ...OUTPUTS]) mkdirSync(join(work, part), { recursive: true })
  for (const entry of entries) writeFileSync(join(work, 'corpus', entry.file), PDF_FORMATS.includes(entry.format) ? entry.pdf : entry.xml)

  // Mustang validates an e-invoice: handed a PDF/A-2b, which embeds no XML, it would refuse it for that.
  const mustangEntries = judgedBy('mustang', entries)
  const mustang = runMustang({ java, jar: tools.where.file(tools.mustang), entries: mustangEntries, work })
  const kosit = runKosit({ java, major: jvm.major, tools, entries: xmlEntries, work })
  const verapdf = runVeraPdf({ java, tools, entries: pdfEntries, work, flavour: '3b' })
  const verapdf2b = runVeraPdf({ java, tools, entries: pdfa2bEntries, work, flavour: '2b' })
  const profile = spec.FACTUR_X_PROFILES.en16931
  const mustangVerdict = judgeMustang({
    entries: mustangEntries,
    runs: mustang.runs,
    accepted: accepted.accepted,
    pinned: tools.mustang.version,
    profile: profile.guideline,
  })
  const hashes = new Map(xmlEntries.map((entry) => [entry.file, base64Sha256(entry.xml)]))
  const kositVerdict = judgeKosit({ entries: xmlEntries, ...kosit, accepted: accepted.accepted, pinned: tools.kosit.version, hashes, scenario: SCENARIO })
  const file = { fileName: spec.FACTUR_X.fileName, relationship: profile.relationship, mediaType: spec.FACTUR_X.mediaType, md5 }
  const veraVerdict = judgeVeraPdf({ entries: pdfEntries, ...verapdf, pinned: tools.verapdf.version, file, flavour: '3b' })
  const vera2bVerdict = judgeVeraPdf({ entries: pdfa2bEntries, ...verapdf2b, pinned: tools.verapdf.version, file, flavour: '2b' })
  const schematrons = pinnedSchematrons({ tools, mustangVerdict, kositVerdict, profile: profile.guideline })
  const oracle =
    schematrons.problems.length > 0
      ? { checked: null, problems: schematrons.problems }
      : oracleProblems({ spec, lists: CODE_LISTS, cen: schematrons.cen, ferd: schematrons.ferd, xrechnung: schematrons.xrechnung })
  const stale = recording ? [] : staleRecorded(entries, recordedCorpus(), new Map(Object.entries(recordedRun().pdfs ?? {})))
  const problems = [...mustangVerdict.problems, ...kositVerdict.problems, ...veraVerdict.problems, ...vera2bVerdict.problems, ...oracle.problems, ...stale]
  // The bytes each tool ran from, hashed once the runs are over: what the
  // release report holds to the register, with the version each tool
  // reported of itself, rather than the register's own word.
  const ran = async (tool) => ({ id: tool.id, version: tool.version, sha256: await sha256File(tools.where.file(tool)) })

  const report = {
    gate: 'e-invoice',
    startedAt,
    finishedAt: new Date().toISOString(),
    java: jvm,
    tools: [
      {
        ...(await ran(tools.mustang)),
        reported: [...new Set(mustangVerdict.rows.map((row) => row.validator).filter((version) => version !== null))],
        bundles: { verapdf: [...new Set(tools.bundled.map((part) => part.version))] },
      },
      { ...(await ran(tools.kosit)), reported: readKositConsole(kosit.console).version ?? null },
      await ran(tools.configuration),
      { ...(await ran(tools.verapdf)), reported: [...new Set([...veraVerdict.reported, ...vera2bVerdict.reported])] },
    ],
    corpus: entries.map(({ file: name, format, sample, starter, variant, from, why, expect }) => ({
      file: name,
      format,
      ...(sample !== undefined ? { sample } : starter !== undefined ? { starter } : variant !== undefined ? { variant, why } : { from, why }),
      expect,
    })),
    mustang: mustangVerdict.rows,
    kosit: kositVerdict.rows,
    verapdf: [...veraVerdict.rows, ...vera2bVerdict.rows],
    oracle: oracle.checked,
    outputs: local(work),
    seconds: {
      draw: drawn,
      mustang: mustang.seconds,
      kosit: kosit.seconds,
      verapdf: verapdf.seconds,
      verapdf2b: verapdf2b.seconds,
      total: seconds(started),
    },
    problems,
    passed: problems.length === 0,
  }
  mkdirSync(dirname(results), { recursive: true })
  writeFileSync(results, `${JSON.stringify(report, null, 2)}\n`)

  const count = (format, kind) => String(entries.filter((entry) => entry.format === format && entry[kind] !== undefined).length)
  console.log(
    `e-invoice: ${count('xml', 'sample')} samples and ${count('xml', 'from')} controls as XML, ${count('pdf', 'sample')} samples, ${count('pdf', 'variant')} variants and ${count('pdf', 'from')} controls as PDF, ${count('pdfa-2b', 'starter')} samples, ${count('pdfa-2b', 'variant')} variants and ${count('pdfa-2b', 'from')} controls as PDF/A-2b, judged on Java ${String(jvm.version)}: drawn in ${String(drawn)} s, Mustang in ${String(mustang.seconds)} s, KoSIT in ${String(kosit.seconds)} s, veraPDF in ${String(verapdf.seconds)} s as PDF/A-3b and ${String(verapdf2b.seconds)} s as PDF/A-2b, ${String(report.seconds.total)} s in all; results in ${local(results)}`,
  )
  if (problems.length > 0) {
    console.error('E-invoice gate failed:')
    for (const problem of problems) console.error(`  - ${problem}`)
    return 1
  }
  console.log('e-invoice: every file judged as the corpus expects, and every list, rule and shape held to the pinned schematrons')
  if (recording) record({ work, entries, java: jvm, mustangRuns: mustang.runs, kosit, verapdf, verapdf2b, tools })
  return 0
}

// `node scripts/e-invoice.mjs [--java <path>] [--cache <dir>] [--results <file>] [--record]`
if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/e-invoice.mjs')) {
  const argv = process.argv.slice(2)
  main(argv).then(
    (code) => {
      process.exitCode = code
    },
    (error) => {
      // A run that stopped still leaves results, so that whatever reads
      // them finds a failure and not an absence.
      const { results } = options(argv)
      mkdirSync(dirname(results), { recursive: true })
      writeFileSync(
        results,
        `${JSON.stringify({ gate: 'e-invoice', startedAt: new Date().toISOString(), problems: [error.message], passed: false }, null, 2)}\n`,
      )
      console.error(`E-invoice gate failed: ${error.message}`)
      process.exitCode = 1
    },
  )
}
