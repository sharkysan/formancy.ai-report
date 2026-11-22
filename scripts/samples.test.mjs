import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { CREATED, filesOf, indexOf, packagesBuilt, problemsOf, SAMPLES, samplesOf } from './samples.mjs'

/**
 * samples/: every starter's PDF and Word file, and the XML of each
 * e-invoice's final render, committed for a reader to download from the
 * README (0079), and held here to what the packages as built write of the
 * corpus's starters, so that a sample is never a file an older build made.
 * Read after the build, as CI's verify job runs this suite after `pnpm
 * build`; without a build it fails, and says so.
 *
 * Each Word file, each XML and the index are held byte for byte. Each PDF
 * is held by its objects with every stream inflated, report-corpus's
 * `inflatedDigest`, never by its bytes: PDFKit deflates a PDF's streams
 * with the zlib of the Node it runs on, and another zlib may write the same
 * document in other bytes (0031, 0035), so a guard held to the bytes would
 * fail CI on a Node the files were not written on.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Rendering every starter twice over takes seconds; a cold build's first import of pdfmake and ECharts adds to it. */
const TIMEOUT = 180_000

const bytes = (text) => new TextEncoder().encode(text)
const text = (file) => new TextDecoder().decode(file.bytes)

/** A sample as `samplesOf` gives one, of a report that is no e-invoice, with `over` in its place. */
const sample = (over = {}) => ({
  id: 'quotation',
  title: 'Offerte',
  proves: 'exact totals',
  kind: undefined,
  pdf: bytes('%PDF quotation'),
  word: { bytes: bytes('PK quotation') },
  xml: undefined,
  ...over,
})

/** What a check reads of a folder holding `files`: each one's bytes by name, and the listing. */
const folder = (files) => ({
  read: (name) => files.find((file) => file.name === name)?.bytes,
  listing: files.map((file) => file.name),
})

/** A digest that reads a fixture's "PDF" as its document: its text without what another zlib would write otherwise, here a trailing `~`. */
const documentDigest = async (pdf) => new TextDecoder().decode(pdf).replace(/~+$/, '')

describe('samples/', () => {
  // A starter changed, a renderer's or the writer's output changed, or a
  // starter added without its files: the README would send a reader to a
  // download that is not what Formancy Report prints today, and nothing
  // else would say so, since no other test reads these files.
  test(
    'holds what the packages as built write of every starter, and nothing else',
    async () => {
      const packages = await packagesBuilt()
      const samples = await samplesOf(packages)
      // A guard on the guard: one sample a starter, so a corpus read empty is not a folder held to nothing.
      expect(samples.map((each) => each.id)).toEqual(packages.corpus.STARTERS.map((starter) => starter.id))
      const committed = existsSync(SAMPLES) ? readdirSync(SAMPLES) : []
      const read = (name) => (committed.includes(name) ? new Uint8Array(readFileSync(join(SAMPLES, name))) : undefined)
      const problems = await problemsOf(filesOf(samples), { read, listing: committed, pdfDigest: packages.corpus.inflatedDigest })
      expect(problems, 'node scripts/samples.mjs --write writes samples/ from the packages as built').toEqual([])
    },
    TIMEOUT,
  )

  // The README's table of starters is where a reader finds a sample: a
  // starter added without its links is one nobody downloads, and a link to
  // a file renamed away is a dead end on the repository's front page.
  test('are each linked from the README, which links no sample the folder does not hold', () => {
    const readme = readFileSync(join(repo, 'README.md'), 'utf8')
    const linked = new Set([...readme.matchAll(/\]\(\.\/samples\/([^)#\s]+)\)/g)].map((match) => match[1]))
    const held = existsSync(SAMPLES) ? readdirSync(SAMPLES) : []
    expect(linked.has('README.md'), 'the README links the samples’ index').toBe(true)
    expect([...linked].filter((name) => !held.includes(name))).toEqual([])
    expect(held.filter((name) => !linked.has(name))).toEqual([])
  })

  // The index says of an e-invoice's files what the e-invoice gate judged
  // (0031, 0065): an instant moved here, or a sample drawn otherwise than
  // the gate draws it, would offer a Factur-X no validator has read, and an
  // XML other than the one Mustang and KoSIT judged, under the same names.
  test(
    'are, of each e-invoice, the XML the e-invoice gate records and of the Factur-X the PDF it judged',
    async () => {
      const packages = await packagesBuilt()
      const run = JSON.parse(readFileSync(join(repo, 'scripts/e-invoice/recorded/run.json'), 'utf8'))
      const invoices = (await samplesOf(packages)).filter((each) => each.kind !== undefined)
      expect(invoices.map((each) => each.kind)).toEqual(['facturX', 'xrechnung'])
      for (const invoice of invoices) {
        expect(invoice.xml, invoice.id).toBe(readFileSync(join(repo, 'scripts/e-invoice/recorded/corpus', `${invoice.id}.xml`), 'utf8'))
        if (invoice.kind === 'facturX') expect(await packages.corpus.inflatedDigest(invoice.pdf), invoice.id).toBe(run.pdfs[`${invoice.id}.pdf`])
      }
    },
    TIMEOUT,
  )

  // A creation date read from the clock would make every run another set
  // of files, and this guard would fail each day: the date reaches a PDF's
  // bytes and a Word file's, so the samples are made at one instant,
  // CREATED, and the same instant gives the same bytes on one machine.
  test(
    'are made at one instant, since the instant is in the bytes',
    async () => {
      const packages = await packagesBuilt()
      const quotation = packages.corpus.STARTERS.filter((starter) => starter.id === 'quotation')
      const [once] = await samplesOf({ ...packages, corpus: { ...packages.corpus, STARTERS: quotation } })
      const [again] = await samplesOf({ ...packages, corpus: { ...packages.corpus, STARTERS: quotation } })
      const [later] = await samplesOf({ ...packages, corpus: { ...packages.corpus, STARTERS: quotation } }, { created: '2026-10-16T08:00:00Z' })
      expect(Buffer.compare(Buffer.from(once.pdf), Buffer.from(again.pdf))).toBe(0)
      expect(Buffer.compare(Buffer.from(once.word.bytes), Buffer.from(again.word.bytes))).toBe(0)
      expect(Buffer.compare(Buffer.from(once.pdf), Buffer.from(later.pdf))).not.toBe(0)
      expect(Buffer.compare(Buffer.from(once.word.bytes), Buffer.from(later.word.bytes))).not.toBe(0)
      expect(CREATED).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    },
    TIMEOUT,
  )
})

describe("the samples' files and index", () => {
  // Each starter is a PDF and a Word file of its own id, as the Studio's
  // downloads name them, and the index links each: a file the index does
  // not link is one no reader finds, and a link to no file a dead end.
  test('are a PDF and a Word file a starter, its XML beside an e-invoice, and an index linking each', () => {
    const files = filesOf([sample(), sample({ id: 'e-invoice', title: 'Rechnung (ZUGFeRD)', kind: 'facturX', xml: '<rsm:CrossIndustryInvoice/>' })])
    expect(files.map((file) => file.name)).toEqual(['quotation.pdf', 'quotation.docx', 'e-invoice.pdf', 'e-invoice.docx', 'e-invoice.xml', 'README.md'])
    const index = text(files.at(-1))
    for (const file of files.slice(0, -1)) expect(index).toContain(`](${file.name})`)
    expect(text(files.find((file) => file.name === 'e-invoice.xml'))).toBe('<rsm:CrossIndustryInvoice/>')
  })

  // Where the writer refuses a starter, a Word file that is not there must
  // not be linked, and the reader is owed the reason, in the writer's own
  // words, as the Studio's Preview says it.
  test('give no Word file of a starter the writer refuses, and the sentence it refuses it with', () => {
    const refused = sample({ word: { refused: 'the report holds what belongs to its PDF' } })
    const files = filesOf([refused])
    expect(files.map((file) => file.name)).toEqual(['quotation.pdf', 'README.md'])
    expect(text(files.at(-1))).toContain('No Word file: the report holds what belongs to its PDF')
    expect(text(files.at(-1))).not.toContain('quotation.docx')
  })

  // Which document is the invoice differs by kind (0031, 0038, 0077): a
  // reader who took a copy for the invoice, or the Factur-X's XML for the
  // invoice beside its PDF, would send the wrong file.
  test('say of an e-invoice which file is the invoice and which a copy', () => {
    const facturX = indexOf([sample({ id: 'e-invoice', kind: 'facturX', xml: '<x/>' })])
    expect(facturX).toMatch(/\[e-invoice\.pdf\]\(e-invoice\.pdf\): the invoice, a PDF\/A-3b that embeds its XML/)
    expect(facturX).toMatch(/\[e-invoice\.docx\]\(e-invoice\.docx\): a copy, labelled on every page as not the invoice/)
    const xrechnung = indexOf([sample({ id: 'e-invoice-xrechnung', kind: 'xrechnung', xml: '<x/>' })])
    expect(xrechnung).toMatch(/\[e-invoice-xrechnung\.pdf\]\(e-invoice-xrechnung\.pdf\): a copy, labelled on every page as not the invoice/)
    expect(xrechnung).toMatch(/\[e-invoice-xrechnung\.xml\]\(e-invoice-xrechnung\.xml\): the invoice/)
  })

  // A title or a description with a pipe in it would split its row into
  // more cells than the table has, and every column after it would say
  // another starter's file.
  test("keep a cell's pipe and line break inside its cell", () => {
    const index = indexOf([sample({ title: 'A | B', proves: 'one\nline' })])
    const row = index.split('\n').find((line) => line.includes('quotation.pdf'))
    expect(row).toContain('A \\| B')
    expect(row).toContain('one line')
  })

  // The index's links are relative to samples/: one into the decisions
  // that does not resolve would be a dead link on the page the README
  // sends a reader to.
  test("link only files of the repository from the index's prose", () => {
    const index = indexOf([sample()])
    const targets = [...index.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]).filter((target) => !target.endsWith('.pdf') && !target.endsWith('.docx'))
    expect(targets.length).toBeGreaterThan(0)
    for (const target of targets) expect(existsSync(join(SAMPLES, target.split('#')[0])), target).toBe(true)
    expect(index.startsWith('# ')).toBe(true)
    expect(index).not.toContain('\r')
    expect(repo).toBe(dirname(SAMPLES))
  })
})

describe('the check', () => {
  const written = () => filesOf([sample(), sample({ id: 'invoice', title: 'Rechnung' })])

  // A guard that read nothing would pass anything: the files as written pass.
  test('passes the files as they are written', async () => {
    const files = written()
    expect(await problemsOf(files, { ...folder(files), pdfDigest: documentDigest })).toEqual([])
  })

  // Each is a sample that is not what the build writes: a Word file
  // changed by a byte, an index edited by hand, a starter's file deleted,
  // and a file no starter writes, which nothing regenerates.
  test('names a file changed, missing or no starter writes', async () => {
    const files = written()
    const edited = files.map((file) =>
      file.name === 'quotation.docx'
        ? { ...file, bytes: bytes('PK quotatioN') }
        : file.name === 'README.md'
          ? { ...file, bytes: bytes(`${text(file)}more\n`) }
          : file,
    )
    const committed = [...edited.filter((file) => file.name !== 'invoice.docx'), { name: 'old.pdf', bytes: bytes('%PDF old') }]
    const problems = await problemsOf(files, { ...folder(committed), pdfDigest: documentDigest })
    expect(problems).toEqual([
      'samples/quotation.docx is not the file the build writes',
      'samples/invoice.docx is missing',
      'samples/README.md is not the file the build writes',
      'samples/old.pdf is no file the build writes',
    ])
  })

  // A PDF is its document: the same document deflated by another zlib
  // passes, and another document fails, as the e-invoice gate records a
  // PDF (0031).
  test('holds a PDF to its document and not to its bytes', async () => {
    const files = written()
    const deflatedOtherwise = files.map((file) => (file.name === 'quotation.pdf' ? { ...file, bytes: bytes('%PDF quotation~~') } : file))
    expect(await problemsOf(files, { ...folder(deflatedOtherwise), pdfDigest: documentDigest })).toEqual([])
    const another = files.map((file) => (file.name === 'quotation.pdf' ? { ...file, bytes: bytes('%PDF quotatioN') } : file))
    expect(await problemsOf(files, { ...folder(another), pdfDigest: documentDigest })).toEqual([
      'samples/quotation.pdf is another document than the build draws, every stream inflated',
    ])
    const unreadable = async (pdf) => {
      if (new TextDecoder().decode(pdf).includes('broken')) throw new Error('no PDF')
      return documentDigest(pdf)
    }
    const broken = files.map((file) => (file.name === 'quotation.pdf' ? { ...file, bytes: bytes('broken') } : file))
    expect(await problemsOf(files, { ...folder(broken), pdfDigest: unreadable })).toEqual(['samples/quotation.pdf cannot be read as a PDF: no PDF'])
  })
})
