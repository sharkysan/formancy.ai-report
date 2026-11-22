// samples/: every starter of the corpus as a host prints it -- its PDF, its
// Word file and, of an e-invoice, the XML of its final render -- committed
// for a reader to download from the README, and held to the build (0079).
//
//   node scripts/samples.mjs --write   write samples/ from the packages as built
//   node scripts/samples.mjs           say what in samples/ is not what they write; write nothing
//
// Needs `pnpm build` first: the starters are resolved, drawn and written by
// the packages as built, imported from their dist/ as scripts/e-invoice.mjs
// imports them, so that the root installs none of them. Each starter is
// resolved as the browser gate holds the Studio's downloads
// (apps/studio/scripts/gate-word.mjs): its own data and parameters, in its
// own language, its images the corpus's, but in a final render made at one
// instant, CREATED, where the gate reads the clock; its PDF drawn by the
// renderer's Node entry; its Word file written of the same document, or,
// of an e-invoice, of its copy, `eInvoice: 'copy'` (0077), or the writer's
// refusal, which the index gives in place of a file. Each row of the index,
// and of the README's table of the starters, which this writes too, says
// what its file holds: its pages, counted by PDF.js, its language, and its
// tables, charts, codes and slip, read from the document it is drawn from.
//
// scripts/samples.test.mjs holds the folder and the README's table to what
// this writes, in `pnpm test:repo`: each Word file, each XML, the index and
// the table byte for byte,
// each PDF by its objects with every stream inflated (report-corpus's
// `inflatedDigest`), since PDFKit deflates with the zlib of the Node it runs
// on. So --write leaves a PDF whose document is unchanged as it was,
// whatever bytes another zlib would write of it.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { block, blocks, END, marker } from './generated-block.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The folder the samples are committed in, and the index it opens with. */
export const SAMPLES = join(repo, 'samples')
const INDEX = 'README.md'

/** The record that says why the folder exists and what holds it, linked from the index. */
const RECORD = '0079-every-starters-pdf-and-word-file-are-committed-as-samples-held-to-the-build-and-the-readme-draws-every-package-in-a-sketch.md'

/**
 * The instant every sample is made at: the date a PDF's metadata and a
 * Word file's core properties state, which a clock would change on every
 * run. The e-invoice gate's (scripts/e-invoice/draw.mjs), so that the
 * Factur-X's PDF is the document that gate records and has veraPDF and
 * Mustang judge, which samples.test.mjs holds.
 */
export const CREATED = '2026-10-17T08:00:00Z'

/** The most pages a sample may print: a bound on the work, as the e-invoice gate's; the longest starter printed two on 22 November 2026. */
const MAX_PAGES = 10

/** The packages as built, each refused, saying how to build it, where it is not. */
const BUILT = {
  runtime: 'packages/report-runtime/dist/index.mjs',
  renderer: 'packages/report-render-pdf/dist/index.mjs',
  writer: 'packages/report-render-docx/dist/index.mjs',
  corpus: 'packages/report-corpus/dist/index.mjs',
}

/** `{ runtime, renderer, writer, corpus }`, imported from their dist/. */
export async function packagesBuilt(root = repo) {
  const packages = {}
  for (const [name, path] of Object.entries(BUILT)) {
    if (!existsSync(join(root, path))) throw new Error(`${path} is missing: run pnpm build first, since the samples are written by the packages as built`)
    packages[name] = await import(pathToFileURL(join(root, path)).href)
  }
  return packages
}

/** The runtime's errors, one line, as a refusal says them. */
const reasons = (errors) => errors.map((error) => `${error.code} at ${error.path}`).join('; ')

/** The builder's word for each kind of e-invoice, as the Studio's picker names an e-invoice starter by it. */
const KINDS = { facturX: 'Factur-X', xrechnung: 'XRechnung' }

/**
 * A starter's name as the Studio's picker gives it (apps/studio's
 * `starterLabel`): an e-invoice by its kind, any other from its id,
 * 'grouped-equipment' as "Grouped equipment".
 */
export function nameOf({ id, report }) {
  const kind = report.eInvoice?.kind
  if (kind !== undefined) return `E-invoice (${KINDS[kind]})`
  const words = id.split('-').join(' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}

/** Every object of `value`, a resolved document or a part of one, depth first: its blocks, by their `kind`, and its runs among them. */
function* objectsIn(value) {
  if (Array.isArray(value)) {
    for (const each of value) yield* objectsIn(each)
    return
  }
  if (value === null || typeof value !== 'object') return
  yield value
  for (const each of Object.values(value)) if (typeof each === 'object') yield* objectsIn(each)
}

/** `count` of a thing, as a reader says it: "a table", "2 tables". */
const counted = (count, one, many) => (count === 1 ? one : `${String(count)} ${many}`)

/**
 * What `document`, a resolved document, holds that a reader looks for in
 * its file: its tables, charts and pictures, a QR code, an EPC QR code, a
 * Swiss QR-bill, a first page of its own and text set below or above the
 * line. Read from the document the PDF is drawn from, never from what its
 * starter was written to show; a picture of a region is counted once, though
 * every page prints it.
 */
export function holdingsOf(document) {
  const objects = [...objectsIn([document.firstPageHeader ?? [], document.pageHeader, document.body, document.pageFooter])]
  const count = (kind) => objects.filter((each) => each.kind === kind).length
  const some = (kind, one, many) => (count(kind) > 0 ? [counted(count(kind), one, many)] : [])
  return [
    ...some('table', 'a table', 'tables'),
    ...some('chart', 'a chart', 'charts'),
    ...some('image', 'a picture', 'pictures'),
    ...some('qrCode', 'a QR code', 'QR codes'),
    ...some('epcQrCode', 'an EPC QR code', 'EPC QR codes'),
    ...(document.paymentPart === undefined ? [] : ['a Swiss QR-bill']),
    ...((document.firstPageHeader?.length ?? 0) > 0 ? ['a first page of its own'] : []),
    ...(objects.some((each) => typeof each.text === 'string' && typeof each.baseline === 'string') ? ['text set above or below the line'] : []),
  ]
}

/**
 * Every starter of `corpus.STARTERS`, in its order, as a host prints it at
 * `created`: `{ id, name, title, locale, pages, holds, kind, pdf, word, xml }`
 * -- `pages` the PDF's, read back by the corpus's PDF.js reader, `holds`
 * what its document holds (`holdingsOf`), `kind` the e-invoice's, `word`
 * `{ bytes }` or `{ refused }`, the writer's sentence, and `xml` the
 * runtime's of an e-invoice's final render. A starter the runtime or the
 * renderer refuses is thrown, and so is an e-invoice whose copy the runtime
 * refuses: the Studio prints every one, and only the writer's refusal is a
 * sample's to report.
 */
export async function samplesOf({ runtime, renderer, writer, corpus }, { created = CREATED } = {}) {
  const samples = []
  for (const starter of corpus.STARTERS) {
    const options = { mode: 'final', parameters: starter.parameters, images: corpus.starterImages, creationDate: created }
    const resolved = runtime.resolveReport(starter.report, starter.data, options)
    if (!resolved.ok) throw new Error(`the runtime refuses the starter ${starter.id}: ${reasons(resolved.errors)}`)
    const { document } = resolved
    const pdf = await renderer.renderPdf(document, { maxPages: MAX_PAGES })
    // An e-invoice's Word file is its copy's (0077), as the Studio's Download Word gives it.
    const copy = document.eInvoice === undefined ? resolved : runtime.resolveReport(starter.report, starter.data, { ...options, eInvoice: 'copy' })
    if (!copy.ok) throw new Error(`the runtime refuses the copy of the starter ${starter.id}: ${reasons(copy.errors)}`)
    let word
    try {
      word = { bytes: writer.renderDocx(copy.document) }
    } catch (error) {
      if (!(error instanceof runtime.RenderRefusal)) throw error
      word = { refused: error.message }
    }
    samples.push({
      id: starter.id,
      name: nameOf(starter),
      title: starter.title,
      locale: starter.report.locale,
      pages: (await corpus.readPdf(pdf)).pages.length,
      holds: holdingsOf(document),
      kind: starter.report.eInvoice?.kind,
      pdf,
      word,
      xml: document.eInvoice?.xml,
    })
  }
  return samples
}

/** `text` as one cell of a Markdown table: on one line, its pipes escaped. */
const cell = (text) => text.replaceAll(/\s*\n\s*/g, ' ').replaceAll('|', '\\|')

const link = (name) => `[${name}](${name})`

/** What each file of an e-invoice is (0031, 0038, 0077): which is the invoice, and which a copy. */
const COPY = 'a copy, labelled on every page as not the invoice'
const PDF_IS = { facturX: 'the invoice, a PDF/A-3b that embeds its XML', xrechnung: COPY }
const XML_IS = { facturX: 'the XML its PDF embeds', xrechnung: 'the invoice' }

/** What a sample's row says it holds: the e-invoice it is, and what its document holds, or its text alone. */
function holds(sample) {
  const invoice = sample.kind === 'facturX' ? ['a Factur-X e-invoice'] : sample.kind === 'xrechnung' ? ["an XRechnung's copy"] : []
  const all = [...invoice, ...sample.holds]
  return all.length === 0 ? 'text' : all.join(', ')
}

/** The README's table of the starters: a row a starter, what its file holds, and its downloads, linked from the repository's root. */
export function readmeTable(samples) {
  const at = (name) => `./samples/${name}`
  const rows = samples.map((sample) => {
    const copy = sample.kind === undefined ? '' : ' copy'
    const downloads = [
      `[PDF${sample.kind === 'xrechnung' ? ' copy' : ''}](${at(`${sample.id}.pdf`)})`,
      'bytes' in sample.word ? `[Word${copy}](${at(`${sample.id}.docx`)})` : `No Word file: ${sample.word.refused}`,
      ...(sample.xml === undefined ? [] : [`[XML${sample.kind === 'xrechnung' ? ', the invoice' : ''}](${at(`${sample.id}.xml`)})`]),
    ]
    return `| ${cell(sample.name)} | ${String(sample.pages)} | ${cell(sample.locale)} | ${cell(holds(sample))} | ${cell(downloads.join(' · '))} |`
  })
  return ['| Starter | Pages | Language | Its PDF holds | Download |', '| --- | --- | --- | --- | --- |', ...rows].join('\n')
}

/** The name of the README's block the table stands in. */
const TABLE = 'starters'

/** What is wrong with `readme`'s table of the starters against `samples`: none, more than one, or one other than `readmeTable` writes. */
export function readmeProblems(readme, samples) {
  const tables = blocks(readme).filter((each) => each.generator === 'scripts/samples.mjs' && each.name === TABLE)
  if (tables.length === 0) return [`README.md has no table of the starters, opened by ${marker('scripts/samples.mjs', { name: TABLE })}`]
  if (tables.length > 1) return ['README.md holds the table of the starters twice']
  return tables[0].body === readmeTable(samples)
    ? []
    : ["README.md's table of the starters is not what scripts/samples.mjs writes: run node scripts/samples.mjs --write"]
}

/** `readme` with its table of the starters written from `samples`; throws where it holds none. */
export function withReadmeTable(readme, samples) {
  const open = marker('scripts/samples.mjs', { name: TABLE })
  const start = readme.indexOf(open)
  const end = readme.indexOf(END, start)
  if (start === -1 || end === -1) throw new Error(`README.md has no table of the starters, opened by ${open}`)
  return `${readme.slice(0, start)}${block('scripts/samples.mjs', readmeTable(samples), { name: TABLE })}${readme.slice(end + END.length)}`
}

/** The index of `samples`: what they are, a row a starter linking its files, and what holds them. */
export function indexOf(samples) {
  const rows = samples.map((sample) => {
    const pdf = `${link(`${sample.id}.pdf`)}${sample.kind === undefined ? '' : `: ${PDF_IS[sample.kind]}`}`
    const word = 'bytes' in sample.word ? `${link(`${sample.id}.docx`)}${sample.kind === undefined ? '' : `: ${COPY}`}` : `No Word file: ${sample.word.refused}`
    const xml = sample.xml === undefined ? '' : `${link(`${sample.id}.xml`)}: ${XML_IS[sample.kind]}`
    return `| ${cell(sample.name)}, ${cell(sample.title)} | ${String(sample.pages)} | ${cell(sample.locale)} | ${cell(holds(sample))} | ${cell(pdf)} | ${cell(word)} | ${cell(xml)} |`
  })
  const body = [
    "Every starter of the Studio, printed as your application would print it: a final render of the starter's own synthetic data, which is no customer's,",
    `resolved by \`@formancy/report-runtime\` at ${CREATED}, drawn as a PDF by \`@formancy/report-render-pdf\` and written as a Word file by`,
    "`@formancy/report-render-docx`. A report that carries an e-invoice is written as a Word file from its copy, and its XML is the runtime's of the same render:",
    "the file the e-invoice gate records and has Mustang and KoSIT's validator judge, as it has veraPDF and Mustang judge the Factur-X's PDF. A PDF's pages are",
    "counted by PDF.js, and what it holds is read from the document it is drawn from; a Word file's pages are Word's to lay out.",
    '',
    '| Starter | Pages | Language | Its PDF holds | PDF | Word | XML |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '`node scripts/samples.mjs --write` writes this folder from the packages as built, after `pnpm build`. `pnpm test:repo` fails when a file here is not',
    'what the current build writes: this page, each Word file and each XML byte for byte, and each PDF by its objects with every stream inflated, since',
    'PDFKit deflates them with the zlib of the Node it runs on, and another zlib may write the same document in other bytes',
    `([0079](../docs/decisions/${RECORD})). Lines and pages in a Word file are Word's to lay out, and no test opens one in Word.`,
  ].join('\n')
  return `# Samples\n\n${block('scripts/samples.mjs', body)}\n`
}

/** The files of `samples`, `{ name, bytes }`, in the order the index lists them, the index last. */
export function filesOf(samples) {
  const encode = (text) => new TextEncoder().encode(text)
  return [
    ...samples.flatMap((sample) => [
      { name: `${sample.id}.pdf`, bytes: sample.pdf },
      ...('bytes' in sample.word ? [{ name: `${sample.id}.docx`, bytes: sample.word.bytes }] : []),
      ...(sample.xml === undefined ? [] : [{ name: `${sample.id}.xml`, bytes: encode(sample.xml) }]),
    ]),
    { name: INDEX, bytes: encode(indexOf(samples)) },
  ]
}

const same = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0

/**
 * What in a folder is not `expected`, the files the build writes: one
 * missing, one changed -- a PDF where its document is another, read by
 * `pdfDigest`, any other file where a byte differs -- and one no starter
 * writes. `read(name)` gives a committed file's bytes, undefined where
 * there is none, and `listing` the folder's names.
 */
export async function problemsOf(expected, { read, listing, pdfDigest }) {
  const problems = []
  for (const { name, bytes } of expected) {
    const committed = read(name)
    if (committed === undefined) problems.push(`samples/${name} is missing`)
    else if (same(committed, bytes)) continue
    else if (!name.endsWith('.pdf')) problems.push(`samples/${name} is not the file the build writes`)
    else {
      let digest
      try {
        digest = await pdfDigest(committed)
      } catch (error) {
        problems.push(`samples/${name} cannot be read as a PDF: ${error instanceof Error ? error.message : String(error)}`)
        continue
      }
      if (digest !== (await pdfDigest(bytes))) problems.push(`samples/${name} is another document than the build draws, every stream inflated`)
    }
  }
  const names = new Set(expected.map((file) => file.name))
  for (const name of listing) if (!names.has(name)) problems.push(`samples/${name} is no file the build writes`)
  return problems
}

/** samples/ written: every file the build writes, but a PDF whose document is the committed one's, and no other file. */
async function write(files, pdfDigest) {
  mkdirSync(SAMPLES, { recursive: true })
  const names = new Set(files.map((file) => file.name))
  for (const name of readdirSync(SAMPLES)) if (!names.has(name)) rmSync(join(SAMPLES, name))
  let kept = 0
  for (const { name, bytes } of files) {
    const path = join(SAMPLES, name)
    if (name.endsWith('.pdf') && existsSync(path) && (await pdfDigest(readFileSync(path))) === (await pdfDigest(bytes))) {
      kept += 1
      continue
    }
    writeFileSync(path, bytes)
  }
  const size = readdirSync(SAMPLES).reduce((total, name) => total + readFileSync(join(SAMPLES, name)).length, 0)
  console.log(`samples: ${String(files.length)} files, ${String(size)} bytes${kept === 0 ? '' : `; ${String(kept)} PDFs kept, their documents unchanged`}`)
}

/** The repository's README, whose table of the starters this writes and checks. */
const README = join(repo, 'README.md')

async function main(argv) {
  const packages = await packagesBuilt()
  const samples = await samplesOf(packages)
  const files = filesOf(samples)
  const pdfDigest = packages.corpus.inflatedDigest
  if (argv.includes('--write')) {
    await write(files, pdfDigest)
    writeFileSync(README, withReadmeTable(readFileSync(README, 'utf8').replaceAll('\r\n', '\n'), samples), 'utf8')
    return console.log('README.md: the table of the starters written')
  }
  const listing = existsSync(SAMPLES) ? readdirSync(SAMPLES) : []
  const read = (name) => (listing.includes(name) ? new Uint8Array(readFileSync(join(SAMPLES, name))) : undefined)
  const problems = [...(await problemsOf(files, { read, listing, pdfDigest })), ...readmeProblems(readFileSync(README, 'utf8'), samples)]
  if (problems.length === 0) return console.log(`samples: every one of ${String(files.length)} files, and the README's table, is what the build writes`)
  console.error(`samples:\n  ${problems.join('\n  ')}\n\`node scripts/samples.mjs --write\` writes them`)
  process.exitCode = 1
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`samples: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
