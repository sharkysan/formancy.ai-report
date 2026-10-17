// The e-invoice gate (0027): Mustang and KoSIT's validator, at the releases
// docs/release/e-invoice-tools.json pins, over the CII XML the runtime
// writes of every e-invoice sample of the corpus, and over controls broken
// one named way each, with Java's HTTP and HTTPS proxies at a dead port (a
// raw socket is not caught); and the closed code lists and rule ids of
// report-spec held to the schematrons those tools run.
//
//   node scripts/e-invoice.mjs [--java <path>] [--cache <dir>] [--results <file>] [--record]
//
// It needs `pnpm build` first, because the corpus is resolved and written by
// the packages as built, and a Java at least as new as every pin's `java`.
// In order:
//
// 1. Checks the registers, and the Java against every JAR's, and refuses to
//    run on a wrong one.
// 2. Fetches every tool into the cache, each refused unless its SHA-256 is
//    the registered one (scripts/e-invoice/cache.mjs), and unpacks KoSIT's
//    configuration from its verified bytes (scripts/e-invoice/zip.mjs).
// 3. Makes the corpus (scripts/e-invoice/corpus.mjs) -- the samples'
//    XML, resolved in a final render, and the controls -- checks it,
//    refusing to run on a wrong one, and writes it.
// 4. Runs Mustang once per file and KoSIT once over all of them, every
//    proxy a dead port (scripts/e-invoice/java.mjs), stdin an empty pipe.
// 5. Judges what each said (mustang.mjs, kosit.mjs) and holds report-spec's
//    lists and rule ids to the schematrons the runs name (oracle.mjs).
// 6. Writes `test-results/e-invoice.json` -- the corpus as judged, every
//    verdict, the times -- with every tool's own output beside it in
//    `test-results/e-invoice/`, and exits 1 on any problem. A run that
//    stopped still writes the file, saying why.
//
// `--record` copies a passing run's corpus and outputs into
// scripts/e-invoice/recorded/, which the judges' tests read, without the
// machine's path to the repository (scripts/e-invoice/record.mjs): run it
// when a tool, the corpus or a control changes, and commit what it wrote.
// A run without it fails where the recorded corpus is not the one it
// judged, so that the judges' tests never read a corpus gone stale.
//
// Run by the `e-invoice` job in gates.yml, and by hand the same way.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { fetchVerified, layout, readVerified, sha256File } from './e-invoice/cache.mjs'
import { corpus as buildCorpus, corpusProblems, strayAccepted } from './e-invoice/corpus.mjs'
import { javaMajor, javaVersion } from './e-invoice/java.mjs'
import { judgeKosit, kositArguments, readKositConsole, reportName } from './e-invoice/kosit.mjs'
import { judgeMustang, mustangArguments } from './e-invoice/mustang.mjs'
import { CODE_LISTS, oracleProblems, readCodedb, readSchematron } from './e-invoice/oracle.mjs'
import { recordedConsole, recordedText, staleRecorded } from './e-invoice/record.mjs'
import { acceptedProblems, readRegisters, toolOf, toolProblems } from './e-invoice/registers.mjs'
import { entryNamed, unzip } from './e-invoice/zip.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Where the gate writes, under the repository. */
export const RESULTS = 'test-results/e-invoice.json'
const WORK = 'test-results/e-invoice'
const RECORDED = 'scripts/e-invoice/recorded'
const BUILT = { spec: 'packages/report-spec/dist/index.mjs', runtime: 'packages/report-runtime/dist/index.mjs', corpus: 'packages/report-corpus/dist/index.mjs' }

/** The instant every sample is resolved at: the XML reads no clock, and a final render needs one. */
const CREATED = '2026-10-17T08:00:00Z'
/** The scenario of KoSIT's configuration every sample must match: the CII D16B schema and CEN's schematron, nothing of XRechnung's. */
const SCENARIO = 'EN16931 (CII)'

/** The options of the command line. */
function options(argv) {
  const value = (name) => {
    const at = argv.indexOf(name)
    return at === -1 ? undefined : argv[at + 1]
  }
  return { java: value('--java') ?? 'java', cache: resolve(repo, value('--cache') ?? '.e-invoice-cache'), results: resolve(repo, value('--results') ?? RESULTS), record: argv.includes('--record') }
}

const seconds = (since) => Math.round((performance.now() - since) / 100) / 10
const local = (path) => relative(repo, path).replaceAll('\\', '/')
const base64Sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('base64')
/** Every run is a JVM's, each output read whole; Mustang's report on the largest sample is a few kilobytes. */
const RUN = { encoding: 'utf8', input: '', maxBuffer: 64 * 1024 * 1024, windowsHide: true }

/** A package as built: refused, saying how to build it, where it is not. */
async function built(path) {
  if (!existsSync(join(repo, path))) throw new Error(`${path} is missing: run pnpm build first, since the corpus is resolved by the packages as built`)
  return import(pathToFileURL(join(repo, path)).href)
}

/** The Java to run on, refused below any JAR's own floor: `{ version, major }`. */
function checkedJava(java, tools) {
  const said = spawnSync(java, ['-version'], { encoding: 'utf8' })
  if (said.error !== undefined) throw new Error(`cannot run ${java}: ${said.error.message}; pass --java <path to java>`)
  const text = `${said.stderr}${said.stdout}`
  const major = javaMajor(text)
  for (const tool of tools.filter((entry) => entry.java !== null)) {
    if (major === undefined || major < tool.java) throw new Error(`${java} is Java ${String(major)}, and ${tool.name} ${tool.version} needs ${String(tool.java)} or later`)
  }
  return { version: javaVersion(text), major }
}

/** Every tool fetched into the cache and checked; KoSIT's configuration unpacked again from its verified bytes. */
async function prepareTools(register, cache) {
  const where = layout(cache)
  const fetched = []
  for (const tool of register.tools) if (await fetchVerified({ url: tool.url, path: where.file(tool), sha256: tool.sha256 })) fetched.push(`${tool.id} ${tool.version}`)
  const configuration = toolOf(register, 'xrechnung-configuration')
  const unpacked = where.unpacked(configuration)
  rmSync(unpacked, { recursive: true, force: true })
  mkdirSync(unpacked, { recursive: true })
  const files = unzip(readVerified(where.file(configuration), configuration.sha256), unpacked)
  console.log(`e-invoice: ${register.tools.map((tool) => `${tool.id} ${tool.version}`).join(', ')} checked against their registered SHA-256; fetched ${fetched.length === 0 ? 'nothing' : fetched.join(', ')}; the configuration unpacked to ${String(files.length)} files`)
  return { where, unpacked, mustang: toolOf(register, 'mustang'), kosit: toolOf(register, 'kosit'), configuration }
}

/** Mustang once per file, each run's report and log written beside the corpus's. */
function runMustang({ java, jar, entries, work }) {
  const runs = new Map()
  const started = performance.now()
  for (const entry of entries) {
    const ran = spawnSync(java, mustangArguments({ jar, file: entry.file }), { ...RUN, cwd: join(work, 'corpus') })
    writeFileSync(join(work, 'mustang', entry.file.replace(/\.xml$/, '.report.xml')), ran.stdout ?? '')
    writeFileSync(join(work, 'mustang', entry.file.replace(/\.xml$/, '.log')), ran.stderr ?? '')
    runs.set(entry.file, { status: ran.status, stdout: ran.stdout ?? '', stderr: ran.stderr ?? '', ...(ran.error === undefined ? {} : { error: ran.error }) })
  }
  return { runs, seconds: seconds(started) }
}

/** KoSIT once over every file: its reports, the names of any others it wrote, its console and its status. */
function runKosit({ java, major, tools, entries, work }) {
  const out = join(work, 'kosit')
  const started = performance.now()
  const ran = spawnSync(java, kositArguments({ jar: tools.where.file(tools.kosit), scenarios: join(tools.unpacked, 'scenarios.xml'), repository: tools.unpacked, out, files: entries.map((entry) => join(work, 'corpus', entry.file)), java: major }), { ...RUN, cwd: work })
  const took = seconds(started)
  const console_ = `${ran.stdout ?? ''}${ran.stderr ?? ''}`
  writeFileSync(join(out, 'console.log'), console_)
  const names = new Set(entries.map((entry) => reportName(entry.file)))
  const reports = new Map(entries.map((entry) => [entry.file, existsSync(join(out, reportName(entry.file))) ? readFileSync(join(out, reportName(entry.file)), 'utf8') : undefined]))
  const others = readdirSync(out).filter((name) => name !== 'console.log' && !names.has(name))
  return { reports, others, status: ran.status, error: ran.error, console: console_, seconds: took }
}

/** The schematrons the runs name, read out of the verified downloads, for the oracle; or why they cannot be. */
function pinnedSchematrons({ tools, mustangVerdict, kositVerdict }) {
  const problems = []
  if (kositVerdict.schematrons.length !== 1) problems.push(`KoSIT's reports on the samples name ${String(kositVerdict.schematrons.length)} schematrons for ${SCENARIO}, where the oracle reads one`)
  if (mustangVerdict.compiled.length !== 1) problems.push(`Mustang's logs on the samples name ${String(mustangVerdict.compiled.length)} schematrons it compiled, where the oracle reads one`)
  if (problems.length > 0) return { problems }
  const [location] = kositVerdict.schematrons
  const cen = { name: `CEN’s schematron (${location} in KoSIT’s configuration ${tools.configuration.version})`, asserts: readSchematron(readFileSync(join(tools.unpacked, location), 'utf8')) }
  const jar = readVerified(tools.where.file(tools.mustang), tools.mustang.sha256)
  const path = mustangVerdict.compiled[0].replace(/^\//, '')
  const asserts = readSchematron(entryNamed(jar, path).toString('utf8'))
  const databases = [...new Set(asserts.flatMap((assert) => [...String(assert.test).matchAll(/document\('([^']+)'\)/g)].map((match) => match[1])))]
  if (databases.length !== 1) return { problems: [`Mustang's ${path} reads ${String(databases.length)} code databases, where the oracle reads one`] }
  const codedb = readCodedb(entryNamed(jar, `${dirname(path)}/${databases[0]}`).toString('utf8'))
  return { problems: [], cen, ferd: { name: `FeRD’s schematron (/${path} in Mustang ${tools.mustang.version})`, asserts, codedb } }
}

/** The corpus a run recorded, by file name: what the judges' tests read. */
function recordedCorpus() {
  const dir = join(repo, RECORDED, 'corpus')
  return new Map(existsSync(dir) ? readdirSync(dir).map((name) => [name, readFileSync(join(dir, name), 'utf8')]) : [])
}

/** A passing run's corpus and outputs, copied for the judges' tests as `recordedText` writes them, with what they were recorded on. */
function record({ work, entries, java, mustangRuns, kosit, tools }) {
  const into = join(repo, RECORDED)
  for (const part of ['corpus', 'mustang', 'kosit']) {
    rmSync(join(into, part), { recursive: true, force: true })
    mkdirSync(join(into, part), { recursive: true })
    for (const name of readdirSync(join(work, part))) {
      const text = readFileSync(join(work, part, name), 'utf8')
      writeFileSync(join(into, part, name), part === 'kosit' && name === 'console.log' ? recordedConsole(text, repo) : recordedText(text, repo))
    }
  }
  const run = JSON.parse(readFileSync(join(into, 'run.json'), 'utf8'))
  const recorded = {
    $comment: run.$comment,
    recordedAt: new Date().toISOString(),
    machine: { platform: process.platform, arch: process.arch, node: process.version, java: java.version },
    tools: Object.fromEntries([tools.mustang, tools.kosit, tools.configuration].map((tool) => [tool.id, tool.version])),
    samples: entries.filter((entry) => entry.sample !== undefined).map((entry) => entry.sample),
    mustang: Object.fromEntries(entries.map((entry) => [entry.file, mustangRuns.get(entry.file).status])),
    kosit: { status: kosit.status },
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

  const spec = await built(BUILT.spec)
  const runtime = await built(BUILT.runtime)
  const samples = await built(BUILT.corpus)
  const entries = buildCorpus({
    samples: samples.E_INVOICE_SAMPLES,
    xmlOf: (sample) => {
      const outcome = runtime.resolveReport(sample.report, sample.data, { mode: 'final', parameters: sample.parameters, creationDate: CREATED })
      if (!outcome.ok) throw new Error(`the sample ${sample.id} does not resolve: ${outcome.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
      return outcome.document.eInvoice.xml
    },
  })
  const corpusWrong = [...corpusProblems(entries), ...strayAccepted(accepted.accepted, entries)]
  if (corpusWrong.length > 0) throw new Error(`the corpus does not hold:\n  - ${corpusWrong.join('\n  - ')}`)
  const work = join(repo, WORK)
  rmSync(work, { recursive: true, force: true })
  for (const part of ['corpus', 'mustang', 'kosit']) mkdirSync(join(work, part), { recursive: true })
  for (const entry of entries) writeFileSync(join(work, 'corpus', entry.file), entry.xml)

  const mustang = runMustang({ java, jar: tools.where.file(tools.mustang), entries, work })
  const kosit = runKosit({ java, major: jvm.major, tools, entries, work })
  const profile = spec.FACTUR_X_PROFILES.en16931.guideline
  const mustangVerdict = judgeMustang({ entries, runs: mustang.runs, accepted: accepted.accepted, pinned: tools.mustang.version, profile })
  const hashes = new Map(entries.map((entry) => [entry.file, base64Sha256(entry.xml)]))
  const kositVerdict = judgeKosit({ entries, ...kosit, accepted: accepted.accepted, pinned: tools.kosit.version, hashes, scenario: SCENARIO })
  const schematrons = pinnedSchematrons({ tools, mustangVerdict, kositVerdict })
  const oracle = schematrons.problems.length > 0 ? { checked: null, problems: schematrons.problems } : oracleProblems({ spec, lists: CODE_LISTS, cen: schematrons.cen, ferd: schematrons.ferd })
  const problems = [...mustangVerdict.problems, ...kositVerdict.problems, ...oracle.problems, ...(recording ? [] : staleRecorded(entries, recordedCorpus()))]
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
      { ...(await ran(tools.mustang)), reported: [...new Set(mustangVerdict.rows.map((row) => row.validator).filter((version) => version !== null))] },
      { ...(await ran(tools.kosit)), reported: readKositConsole(kosit.console).version ?? null },
      await ran(tools.configuration),
    ],
    corpus: entries.map(({ file, sample, from, why, expect }) => ({ file, ...(sample === undefined ? { from, why } : { sample }), expect })),
    mustang: mustangVerdict.rows,
    kosit: kositVerdict.rows,
    oracle: oracle.checked,
    outputs: local(work),
    seconds: { mustang: mustang.seconds, kosit: kosit.seconds, total: seconds(started) },
    problems,
    passed: problems.length === 0,
  }
  mkdirSync(dirname(results), { recursive: true })
  writeFileSync(results, `${JSON.stringify(report, null, 2)}\n`)

  const controls = entries.filter((entry) => entry.from !== undefined).length
  console.log(`e-invoice: ${String(entries.length - controls)} samples and ${String(controls)} controls judged on Java ${String(jvm.version)}: Mustang in ${String(mustang.seconds)} s, KoSIT in ${String(kosit.seconds)} s, ${String(report.seconds.total)} s in all; results in ${local(results)}`)
  if (problems.length > 0) {
    console.error('E-invoice gate failed:')
    for (const problem of problems) console.error(`  - ${problem}`)
    return 1
  }
  console.log('e-invoice: every file judged as the corpus expects, and every list and rule held to both schematrons')
  if (recording) record({ work, entries, java: jvm, mustangRuns: mustang.runs, kosit, tools })
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
      writeFileSync(results, `${JSON.stringify({ gate: 'e-invoice', startedAt: new Date().toISOString(), problems: [error.message], passed: false }, null, 2)}\n`)
      console.error(`E-invoice gate failed: ${error.message}`)
      process.exitCode = 1
    },
  )
}
