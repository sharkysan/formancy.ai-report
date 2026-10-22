// veraPDF over the corpus's PDFs (0031): its command line, what it writes,
// the gate's verdict on it, and the veraPDF inside Mustang held to the
// register's floor, pure over what one run left so that every rule below is
// held by a test on a recorded run (scripts/e-invoice/verapdf.test.mjs).
//
// What veraPDF 1.30.3 writes with `--format json -x embeddedFile`, measured
// on 18 October 2026 (Java 25 and 17, the same but for their times): one
// JSON document on stdout, and nothing on stderr. `report.buildInformation`
// names each part's version (core, validation-model, apps); `report.jobs`
// holds one job per file, in the order given, each naming its file by its
// absolute path however it was given, with one validation result per
// profile -- its name, how the job ended, whether the file complies, and a
// summary of each rule it failed by clause and test number -- and its
// feature report; `report.batchSummary` counts the jobs. Its exit status is
// 0 where every file complies and 1 where one does not
// (`CliConstants.ExitCodes` at v1.30.3).
//
// The feature report is the file specification as the PDF declares it: its
// name, /AFRelationship, /Subtype, and the /CheckSum and /Size of its
// /Params, copied as written -- a /CheckSum or a /Size changed in the file
// is reported changed, and the file still complies. And the JSON keeps one
// embedded file: with one, `embeddedFiles` holds its fields; with two,
// `embeddedFiles.embeddedFile` holds the last, and the first is gone
// (measured with a second file pdf-lib attached). So the judge holds the
// one file veraPDF shows to the XML the corpus says the PDF embeds, and
// pdf-lib's reading counts the files and compares their bytes
// (scripts/e-invoice/pdf-corpus.mjs's `embeddingProblems`).
//
// The rules:
//
// - **A refusal** is a rule of the PDF/A-3B profile the file failed, keyed
//   `<clause>-<test>`, or a field of its embedded file other than the
//   corpus's, keyed `embedded <field>`.
// - **The run** exits 0 where no file may fail a rule and 1 where one must,
//   writes nothing on stderr, reports the version the register pins of
//   every part, and has one job per PDF of the corpus and no other, none of
//   which failed to parse, was encrypted, threw or ran out of memory.
// - **A sample** has one result, of the PDF/A-3b profile, which ended
//   normally, complies, passed at least one rule, and has no refusal.
// - **A control** is refused for exactly what it expects.

import { atLeast } from './registers.mjs'
import { JVM_OPTIONS } from './java.mjs'
import { zipEntries, entryNamed } from './zip.mjs'

/** The profile `--flavour 3b` validates against, as veraPDF names it. */
export const PROFILE = 'PDF/A-3b validation profile'

/**
 * veraPDF's command line for every PDF at once, all of it but `java`
 * itself: PDF/A-3b whatever a file says of itself, a JSON report, and the
 * embedded files' features. A file is given as its name in the corpus's
 * directory, where the gate runs it.
 */
export function veraPdfArguments({ jar, files }) {
  return [...JVM_OPTIONS, '-jar', jar, '--flavour', '3b', '--format', 'json', '-x', 'embeddedFile', ...files]
}

/** The file a job names, by its last path segment: veraPDF writes each as an absolute path, with the platform's separators. */
const baseName = (name) => String(name).split(/[\\/]/).pop()

/** The one embedded file a job's feature report shows, `null` where it shows none, or `'more'` where its JSON kept the last of several. */
function shownFile(job) {
  const files = job.featuresReport?.embeddedFiles
  if (files === undefined) return null
  if (files.embeddedFile !== undefined) return 'more'
  return files
}

/**
 * veraPDF's report: `{ versions, jobs: [{ file, results, embedded }], batch }`,
 * each result `{ profile, end, compliant, passedRules, failedRules, failed }`,
 * `failed` the keys of the rules it failed, and `embedded` the file its
 * feature report shows. Anything that is not such a report throws.
 */
export function readVeraPdf(stdout) {
  const { report } = JSON.parse(stdout)
  if (typeof report !== 'object' || report === null || !Array.isArray(report.jobs)) throw new Error('veraPDF wrote no report with jobs')
  return {
    versions: (report.buildInformation?.releaseDetails ?? []).map((part) => ({ id: part.id, version: part.version })),
    jobs: report.jobs.map((job) => ({
      file: baseName(job.itemDetails?.name),
      results: (job.validationResult ?? []).map((result) => ({
        profile: result.profileName,
        end: result.jobEndStatus,
        compliant: result.compliant,
        passedRules: result.details?.passedRules,
        failedRules: result.details?.failedRules,
        // Sorted: veraPDF lists a job's rule summaries in no fixed order from one run to the next.
        failed: (result.details?.ruleSummaries ?? []).filter((rule) => rule.status === 'failed').map((rule) => `${String(rule.clause)}-${String(rule.testNumber)}`).sort(),
      })),
      embedded: shownFile(job),
    })),
    batch: report.batchSummary ?? {},
  }
}

/** The MD5 and the size of `xml`'s UTF-8 bytes, as veraPDF reports a file's: lowercase hexadecimal, and a decimal string. */
function declared(xml, md5) {
  const bytes = Buffer.from(xml, 'utf8')
  return { checkSum: md5(bytes), size: String(bytes.length) }
}

/** The refusals of a job's embedded file, against the XML `embeds` (or null) and the name, relationship and media type it must be declared with. */
function embeddedRefusals(shown, embeds, { fileName, relationship, mediaType, md5 }) {
  if (shown === 'more') return ['embedded files']
  if (embeds === null) return shown === null ? [] : ['embedded files']
  if (shown === null) return ['embedded files']
  const wanted = { fileName, afRelationship: relationship, subtype: mediaType, ...declared(embeds, md5) }
  return Object.entries(wanted)
    .filter(([field, value]) => shown[field] !== value)
    .map(([field]) => `embedded ${field}`)
}

/** What is wrong with the run as a whole, as sentences. */
function runProblems({ status, stderr, report, entries, pinned }) {
  const problems = []
  const mustFail = entries.some((entry) => Array.isArray(entry.expect.verapdf) && entry.expect.verapdf.some((key) => !key.startsWith('embedded ')))
  if (status !== (mustFail ? 1 : 0)) problems.push(`veraPDF exited ${String(status)}, where ${mustFail ? 'a control fails a rule and it exits 1' : 'every file complies and it exits 0'}`)
  for (const line of String(stderr).split(/\r?\n/).filter((each) => each.trim() !== '')) problems.push(`veraPDF wrote on stderr, which it does not on a run that went as its report says: ${line}`)
  if (report.versions.length === 0) problems.push('veraPDF’s report names no version of itself')
  for (const part of report.versions) if (part.version !== pinned) problems.push(`veraPDF’s ${String(part.id)} is ${String(part.version)}, not ${pinned}, which docs/release/e-invoice-tools.json pins`)
  const { batch } = report
  if (batch.totalJobs !== entries.length) problems.push(`veraPDF ran ${String(batch.totalJobs)} jobs, where the corpus has ${String(entries.length)} PDFs`)
  for (const count of ['failedParsingJobs', 'failedEncryptedJobs', 'veraExceptions', 'outOfMemory']) if (batch[count] !== 0) problems.push(`veraPDF’s ${count} is ${String(batch[count])}, not 0`)
  const files = report.jobs.map((job) => job.file)
  for (const file of new Set(files)) if (!entries.some((entry) => entry.file === file)) problems.push(`veraPDF judged ${file}, which is no PDF of the corpus`)
  for (const file of new Set(files.filter((file, at) => files.indexOf(file) !== at))) problems.push(`veraPDF judged ${file} more than once`)
  return problems
}

/**
 * The verdict: `{ rows, problems, reported }`. `rows` is one per PDF of the
 * corpus, for the results file; `problems` every sentence that fails the
 * gate; `reported` the versions veraPDF reported of itself.
 *
 * - `entries`: the corpus's PDFs (scripts/e-invoice/pdf-corpus.mjs);
 * - `status`, `stdout`, `stderr`, `error`: how the one run ended;
 * - `pinned`: the veraPDF version the register pins;
 * - `file`: the name, the relationship and the media type an embedded
 *   file is declared with, and `md5`, a function from bytes to their MD5
 *   in lowercase hexadecimal.
 */
export function judgeVeraPdf({ entries, status, stdout, stderr, error, pinned, file }) {
  if (error !== undefined) return { rows: [], problems: [`veraPDF did not run: ${error.message}`], reported: [] }
  let report
  try {
    report = readVeraPdf(stdout)
  } catch (failure) {
    return { rows: [], problems: [`veraPDF wrote no report it can read: ${failure.message}`], reported: [] }
  }
  const problems = runProblems({ status, stderr, report, entries, pinned })
  const rows = entries.map((entry) => {
    const row = { file: entry.file, expect: entry.expect.verapdf, verdict: 'not as expected', compliant: null, refusals: [] }
    const job = report.jobs.find((each) => each.file === entry.file)
    if (job === undefined) {
      problems.push(`veraPDF has no job for ${entry.file}`)
      return row
    }
    const wrong = []
    if (job.results.length !== 1) wrong.push(`veraPDF validated ${entry.file} against ${String(job.results.length)} profiles, where the gate asks for one`)
    const [result] = job.results
    if (result !== undefined) {
      if (result.profile !== PROFILE) wrong.push(`veraPDF validated ${entry.file} against ${String(result.profile)}, not the ${PROFILE}`)
      if (result.end !== 'normal') wrong.push(`veraPDF’s job on ${entry.file} ended ${String(result.end)}, not normally`)
      if (result.failedRules !== result.failed.length) wrong.push(`veraPDF counts ${String(result.failedRules)} rules ${entry.file} failed, and summarises ${String(result.failed.length)}`)
      row.compliant = result.compliant
    }
    row.refusals = [...new Set([...(result?.failed ?? []), ...embeddedRefusals(job.embedded, entry.embeds, file)])]
    if (entry.expect.verapdf === 'accepted') {
      if (result !== undefined && result.compliant !== true) wrong.push(`veraPDF finds ${entry.file} not PDF/A-3b compliant, where it must be`)
      if (result !== undefined && !(result.passedRules > 0)) wrong.push(`veraPDF passed no rule on ${entry.file}, so it checked nothing`)
      for (const key of row.refusals) wrong.push(`${entry.file} is refused by veraPDF: ${key}`)
    } else if (row.refusals.length === 0) wrong.push(`${entry.file} is broken for ${entry.why}, and veraPDF accepted it: nothing is watching that`)
    else {
      for (const key of entry.expect.verapdf) if (!row.refusals.includes(key)) wrong.push(`${entry.file} was not refused by veraPDF for ${key}, which it is broken for`)
      for (const key of row.refusals) if (!entry.expect.verapdf.includes(key)) wrong.push(`${entry.file} was refused by veraPDF for ${key} as well, which it is not broken for`)
    }
    problems.push(...wrong)
    row.verdict = wrong.length === 0 ? 'as expected' : 'not as expected'
    return row
  })
  return { rows, problems, reported: [...new Set(report.versions.map((part) => part.version))] }
}

/** The pom.properties a JAR carries for each artefact of veraPDF's it was built with. */
const BUNDLED = /^META-INF\/maven\/org\.verapdf\/([^/]+)\/pom\.properties$/

/**
 * The veraPDF a JAR bundles, read from the pom.properties Maven wrote for
 * each of veraPDF's artefacts in it: `[{ artifact, version }]`. Mustang
 * 2.26.0 bundles validation-model-jakarta and six more, each 1.30.2
 * (measured on 18 October 2026).
 */
export function bundledVeraPdf(jar) {
  return zipEntries(jar)
    .filter((entry) => BUNDLED.test(entry.name))
    .map((entry) => ({ artifact: BUNDLED.exec(entry.name)[1], version: /^version=(.*)$/m.exec(entryNamed(jar, entry.name).toString('utf8'))?.[1]?.trim() }))
}

/** What is wrong with the veraPDF a tool bundles, against the register's floor, as sentences. */
export function bundledProblems(bundled, floor, tool) {
  if (bundled.length === 0) return [`${tool}’s JAR names no veraPDF it bundles, where it validates PDF/A with one: the floor cannot be held`]
  return bundled.filter((part) => !atLeast(part.version, floor.version)).map((part) => `${tool} bundles veraPDF’s ${part.artifact} ${String(part.version)}, below the floor of ${floor.version} (${floor.advisories.join(', ')})`)
}
