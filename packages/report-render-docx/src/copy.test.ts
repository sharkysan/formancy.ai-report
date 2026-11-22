import {
  BILL_EXAMPLES,
  E_INVOICE_SAMPLES,
  INVOICE_SAMPLES,
  resolvedBill,
  verifyDocx,
  wordRefusal,
  XRECHNUNG_SAMPLES,
  type Docx,
  type DocxRegion,
  type Starter,
} from '@formancy/report-corpus'
import { E_INVOICE_COPY_LABELS, E_INVOICE_PREVIEW_LABEL, eInvoiceCopyParagraph, readCopyLabel, XRECHNUNG_COPY_PARAGRAPH } from '@formancy/report-runtime'
import type { Block, Paragraph, ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { MAX_DOCX_CHARACTERS, MAX_DOCX_PARAGRAPHS } from './limits.js'
import { renderDocx } from './render.js'
import { documentOf, fixtureOf, paragraph, refusalOf, resolved, written } from './testing/support.js'

/**
 * A copy of an e-invoice as a Word file (0077), proved on the file the
 * writer produced, read back by the corpus's reader and held by the
 * corpus's check: the invoice's page with its lines and its totals, as
 * for any report, and on every header the file states the label that
 * says it is a copy and not the invoice. The writer writes the copy the
 * runtime resolved, decides no word of the label, and refuses the
 * invoice itself, a preview, and a copy labelled otherwise than on every
 * page. What Word then prints is not seen here.
 */

const SAMPLES: readonly Starter[] = [...E_INVOICE_SAMPLES, ...XRECHNUNG_SAMPLES]
const localesOf = (starter: Starter): string[] => [starter.report.locale, ...(starter.report.translations ?? []).map((each) => each.locale)]
const RENDERS = SAMPLES.flatMap((starter) => localesOf(starter).map((locale) => [starter.id, locale, starter] as const))

const copyOf = (starter: Starter, locale?: string): ResolvedDocument => resolved(starter, { eInvoice: 'copy', ...(locale === undefined ? {} : { locale }) })

/** The words a header opens with: its first paragraph's one run, as the file states it. */
const opening = (
  region: DocxRegion | undefined,
): { readonly text: string; readonly size: number | undefined; readonly bold: boolean; readonly color: string | undefined } | undefined => {
  const first = region?.blocks[0]
  const run = first?.kind === 'paragraph' && first.runs.length === 1 ? first.runs[0] : undefined
  return run?.kind === 'text' ? { text: run.text, size: run.props.size, bold: run.props.bold, color: run.props.color } : undefined
}

/** Every header the file states: the report's section's, page 1's own, and a slip's page's. */
const headersOf = (file: Docx): (DocxRegion | undefined)[] => [
  file.header,
  ...(file.page.titlePage ? [file.firstHeader] : []),
  ...(file.slip === undefined ? [] : [file.slip.header]),
]

const LABEL = eInvoiceCopyParagraph('facturX', 'de-DE') as Paragraph
const own = (): Paragraph => ({ ...LABEL })

test('every e-invoice sample of the corpus is written as a copy here, in each language it declares', () => {
  expect(RENDERS.map(([id, locale]) => `${id} ${locale}`)).toEqual([
    'e-invoice de-DE',
    'e-invoice-reverse-charge de-DE',
    'e-invoice-exempt-paid de-DE',
    'e-invoice-addressed de-DE',
    'e-invoice-xrechnung de-DE',
  ])
})

describe.each(RENDERS)('the copy of %s in %s', (id, locale, starter) => {
  const document = copyOf(starter, locale)
  const kind = starter.report.eInvoice!.kind

  // The invoice's page as for any report -- every line, every total, every picture and code -- and the label on every header: a file that
  // lost a line or a total would be a copy that disagrees with its invoice as it leaves the writer.
  test('is written with its lines and its totals, and the label on every header the file states', async () => {
    expect(wordRefusal(document)).toBeUndefined()
    const file = written(document)
    expect(await verifyDocx(fixtureOf(id, document), file)).toEqual([])
    const words = E_INVOICE_COPY_LABELS[kind].de
    const headers = headersOf(file)
    expect(headers.length).toBeGreaterThan(0)
    for (const header of headers) expect(opening(header)).toEqual({ text: words, size: 8, bold: true, color: '#b00020' })
    // The copy says what the invoice is, of its own kind: the PDF that embeds its XML, or the XML.
    expect(words).toMatch(kind === 'facturX' ? /^Kopie einer E-Rechnung: Die Rechnung ist das PDF/ : /^Kopie einer XRechnung: Die Rechnung ist ihr XML/)
  })

  // The file is no invoice and holds none: every part of it is one a report's file has, and no part holds the XML's root element. The
  // corpus's reader refuses a part no relationship reaches and a relationship that leads outside the package, so reading it back says so too.
  test('embeds no XML: its parts are a report’s, and none holds an invoice', () => {
    const invoice = resolved(starter, { locale })
    expect(invoice.eInvoice?.xml).toContain('CrossIndustryInvoice')
    expect(document.eInvoice).toBeUndefined()
    const file = written(document)
    const names = [...file.parts.keys()]
    expect(
      names.filter(
        (name) =>
          !/^(\[Content_Types\]\.xml|_rels\/\.rels|docProps\/core\.xml|word\/(document|styles|settings|fontTable|header[12]|footer1)\.xml|word\/_rels\/(document|header[12]|footer1)\.xml\.rels|word\/media\/image\d+\.(png|jpeg|svg))$/.test(
            name,
          ),
      ),
    ).toEqual([])
    const root = new TextEncoder().encode('CrossIndustryInvoice')
    const holds = (bytes: Uint8Array): boolean => {
      for (let at = 0; at + root.length <= bytes.length; at++) if (root.every((byte, index) => bytes[at + index] === byte)) return true
      return false
    }
    expect(names.filter((name) => holds(file.parts.get(name)!.bytes))).toEqual([])
    expect(names.some((name) => /factur|xrechnung|invoice/i.test(name))).toBe(false)
  })

  // The invoice itself is refused as it was (0068): its document carries the XML, and a Word file written of it would say nothing of what it is.
  test('and its invoice, and its preview, are refused as they were, each saying what to do', () => {
    const invoice = refusalOf(resolved(starter, { locale }))
    expect(invoice).toMatchObject({ code: 'unsupported', subject: 'eInvoice' })
    expect(invoice.message).toMatch(/resolve the report with eInvoice: 'copy'.*print the report as a PDF/)
    const preview = resolved(starter, { locale, mode: 'preview' })
    expect(readCopyLabel(preview.pageHeader)).toBeUndefined()
    expect(preview.pageHeader[0]).toMatchObject({ runs: [{ text: E_INVOICE_PREVIEW_LABEL }] })
    expect(refusalOf(preview)).toMatchObject({ code: 'unsupported', subject: 'pageHeader' })
  })

  // The same copy is the same file: a copy kept beside its invoice is compared by its bytes.
  test('is the same bytes each time it is written', () => {
    expect(renderDocx(document)).toEqual(renderDocx(document))
  })
})

describe('a copy in each language the runtime labels one in', () => {
  // The label is the runtime's, in the render's language (0063); the writer writes whichever it is handed, and decides no word.
  test.each(
    Object.entries(E_INVOICE_COPY_LABELS).flatMap(([kind, labels]) => Object.entries(labels).map(([language, words]) => [kind, language, words] as const)),
  )('of a %s in %s opens every header with the runtime’s words', async (kind, language, words) => {
    const label = eInvoiceCopyParagraph(kind as 'facturX', language) as Paragraph
    const document = documentOf([paragraph('Rechnung 4711')], { pageHeader: [{ ...label }, paragraph('Briefkopf')], firstPageHeader: [{ ...label }] })
    const file = written(document)
    expect(await verifyDocx(fixtureOf(`${kind}-${language}`, document), file)).toEqual([])
    expect(headersOf(file).map((header) => opening(header)?.text)).toEqual([words, words])
  })
})

describe('a copy paid by a QR-bill', () => {
  const bill = resolvedBill(BILL_EXAMPLES.one)
  const mm = (value: number): number => (value * 72) / 25.4
  const footer: Block[] = [{ kind: 'paragraph', runs: [{ text: 'Seite ' }, { field: 'pageNumber' }] }]
  const document = documentOf([paragraph('Rechnung 4711')], { pageHeader: [own(), paragraph('Briefkopf')], pageFooter: footer, paymentPart: bill })

  // The slip's page is a section of its own, whose header 0075 leaves empty so that nothing of unknown height stands above the slip. On a
  // copy that page prints an invoice's slip, and would say nothing of what it is: its header is the label, alone, 5 mm from the paper's
  // top and sides, far above the slip's 192 mm.
  test('says so on the slip’s page too: its header is the label alone, 5 mm down and 5 mm in', async () => {
    const file = written(document)
    expect(await verifyDocx(fixtureOf('copy-slip', document), file)).toEqual([])
    const header = file.slip?.header
    expect(header?.part).toBe('word/header3.xml')
    expect(header?.blocks).toHaveLength(1)
    expect(opening(header)).toEqual({ text: E_INVOICE_COPY_LABELS.facturX.de, size: 8, bold: true, color: '#b00020' })
    const [label] = header!.blocks
    expect(label).toMatchObject({ kind: 'paragraph', keepNext: false })
    expect((label as { indent: number }).indent).toBeCloseTo(mm(5), 1)
    expect((label as { indentRight: number }).indentRight).toBeCloseTo(mm(5), 1)
    expect(file.slip?.page.header).toBeCloseTo(mm(5), 1)
    // The slip stands where SIX puts it all the same: its page's top margin is the one of a report that is no copy.
    const plain = written({ ...document, pageHeader: [paragraph('Briefkopf')] })
    expect(file.slip?.page.margins).toEqual(plain.slip?.page.margins)
    expect(plain.slip?.page.header).toBe(0)
    expect(plain.slip?.header?.blocks).toMatchObject([{ kind: 'paragraph', runs: [] }])
    // The footer stays empty, as it was.
    expect(file.slip?.footer?.blocks).toMatchObject([{ kind: 'paragraph', runs: [] }])
  })

  // The label on the slip's page is a paragraph of the file like any other: uncounted, a file at its bound would be written one past it.
  test('counts the label of the slip’s page with the file’s paragraphs: written at the bound, refused one past it', () => {
    const spacers = (length: number): Block[] => Array.from({ length }, () => ({ kind: 'spacer', height: 1 }))
    const every = (blocks: Docx['body']): number =>
      blocks.reduce(
        (sum, block) =>
          sum + (block.kind === 'paragraph' ? 1 : block.rows.reduce((cells, row) => cells + row.cells.reduce((held, cell) => held + every(cell.blocks), 0), 0)),
        0,
      )
    const of = (body: readonly Block[]): ResolvedDocument => documentOf(body, { pageHeader: [own()], paymentPart: bill })
    const alone = written(of([]))
    // Every paragraph the walk counts beside a body's own: the page header's label, the slip's page, and the label on it. A body of
    // spacers ends the report's section with its own last one, where a body of nothing is given a line for it (0075).
    expect(every(alone.body)).toBe(1)
    const held = 1 + every(alone.slip!.blocks) + every(alone.slip!.header!.blocks)
    expect(() => renderDocx(of(spacers(MAX_DOCX_PARAGRAPHS - held)))).not.toThrow()
    expect(refusalOf(of(spacers(MAX_DOCX_PARAGRAPHS - held + 1)))).toMatchObject({ code: 'content-too-large', subject: 'paymentPart' })
  }, 120_000)
})

describe('a copy the runtime resolves, with what the hand-built ones above stand for', () => {
  const SWISS = 'CH52 0483 5012 3456 7100 0'

  /**
   * The Factur-X sample paid by a QR-bill too: its account a Swiss one wherever the report writes it, which the e-invoice, its EPC QR code
   * and the bill all pay (0044), and the bill the invoice starter's, of no amount, debtor or reference, in euros.
   */
  const paidByBill = (): Starter => {
    const sample = E_INVOICE_SAMPLES[0]!
    const report = JSON.parse(
      JSON.stringify(sample.report).split('DE83 0123 4567 0012 3456 78').join(SWISS).split('FMNCDEF0XXX').join('POFICHBEXXX'),
    ) as Starter['report']
    const { amount: _amount, debtor: _debtor, reference: _reference, ...bill } = INVOICE_SAMPLES[0]!.report.paymentPart!
    return { ...sample, report: { ...report, paymentPart: { ...bill, account: [{ kind: 'text', text: SWISS }], currency: 'EUR' } } }
  }

  // The slip's page's label is proved above on documents made by hand; a runtime that labelled a copy's page header and resolved its bill
  // otherwise than they assume would pass them all. The copy of an invoice paid by a QR-bill, resolved, says on the slip's page what it is.
  test('of an e-invoice paid by a QR-bill says so on the slip’s page', async () => {
    const document = resolved(paidByBill(), { eInvoice: 'copy' })
    expect(document.paymentPart).toBeDefined()
    const file = written(document)
    expect(await verifyDocx(fixtureOf('copy-with-bill', document), file)).toEqual([])
    expect(headersOf(file).map((header) => opening(header)?.text)).toEqual([E_INVOICE_COPY_LABELS.facturX.de, E_INVOICE_COPY_LABELS.facturX.de])
    expect(file.slip?.header?.part).toBe('word/header3.xml')
  }, 120_000)

  // Page 1's own header (0060) is labelled by the runtime as the page header is; the writer holds the two to each other. Resolved with
  // none and with one of the report's own, each file opens both headers with the label, and the report's own words stand below it.
  test.each(SAMPLES.filter((starter) => starter.id === 'e-invoice' || starter.id === 'e-invoice-xrechnung').map((starter) => [starter.id, starter] as const))(
    'of %s with a header of page 1’s own, empty or not, opens both headers with the label',
    async (id, starter) => {
      const words = E_INVOICE_COPY_LABELS[starter.report.eInvoice!.kind].de
      const own = { kind: 'text', id: 'first-page', content: [{ kind: 'text', text: 'Erste Seite' }] } as const
      for (const firstPageHeader of [[], [own]]) {
        const report = { ...starter.report, regions: { ...starter.report.regions, firstPageHeader } } as Starter['report']
        const document = resolved({ ...starter, report }, { eInvoice: 'copy' })
        const file = written(document)
        expect(await verifyDocx(fixtureOf(`${id}-first-${firstPageHeader.length}`, document), file)).toEqual([])
        expect(file.page.titlePage).toBe(true)
        expect(headersOf(file).map((header) => opening(header)?.text)).toEqual([words, words])
        const texts = file.firstHeader!.blocks.flatMap((block) =>
          block.kind === 'paragraph' ? block.runs.flatMap((run) => (run.kind === 'text' ? [run.text] : [])) : [],
        )
        expect(texts).toEqual(firstPageHeader.length === 0 ? [words] : [words, 'Erste Seite'])
      }
    },
    120_000,
  )
})

describe('the label of a copy’s slip’s page is counted with the file’s text', () => {
  const bill = resolvedBill(BILL_EXAMPLES.one)
  const words = (LABEL.runs[0] as { readonly text: string }).text
  const letters = (blocks: Docx['body']): number =>
    blocks.reduce(
      (sum, block) =>
        sum +
        (block.kind === 'paragraph'
          ? block.runs.reduce((held, run) => held + (run.kind === 'text' ? run.text.length : 0), 0)
          : block.rows.reduce((cells, row) => cells + row.cells.reduce((held, cell) => held + letters(cell.blocks), 0), 0)),
      0,
    )

  // Its paragraph is the one 0075 counts for the header of a slip's page; its words are text the file holds twice, in the page header
  // and on the slip's page. Counted once, a file at the bound of its characters would be written a label past it.
  test('its words twice: written at the bound of the file’s characters, refused a character past it, naming the payment part', () => {
    const of = (length: number): ResolvedDocument => documentOf([paragraph('a'.repeat(length))], { pageHeader: [own()], paymentPart: bill })
    const slip = letters(written(of(1)).slip!.blocks)
    expect(slip).toBeGreaterThan(100)
    const room = MAX_DOCX_CHARACTERS - 2 * words.length - slip
    expect(() => renderDocx(of(room))).not.toThrow()
    const refusal = refusalOf(of(room + 1))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'paymentPart' })
    expect(refusal.message).toMatch(/more than 4000000 characters long/)
  }, 120_000)
})

describe('a document labelled as a copy otherwise than on every page is refused', () => {
  const other = paragraph('Briefkopf')
  const white: Paragraph = { ...LABEL, style: { ...LABEL.style, color: '#ffffff' } }
  const french = { ...(eInvoiceCopyParagraph('facturX', 'fr') as Paragraph) }
  type Case = readonly [name: string, pageHeader: readonly Block[], firstPageHeader: readonly Block[] | undefined, subject: string, sentence: RegExp]

  // The runtime labels every header; a document made otherwise, or by a runtime that forgot one, would be written as a file some of whose
  // pages pass for the invoice, or whose label nobody can read. Each is refused before a byte is written, as the corpus derives it too.
  test.each<Case>([
    ['the label in white', [white, other], undefined, 'pageHeader', /page header opens with the words of a copy.*otherwise than the runtime writes them/],
    ['the label at one point', [{ ...LABEL, style: { ...LABEL.style, size: 1 } }], undefined, 'pageHeader', /otherwise than the runtime writes them/],
    ['the label light', [{ ...LABEL, style: { size: 8, color: '#b00020' } }], undefined, 'pageHeader', /otherwise than the runtime writes them/],
    ["no label on page 1's own header", [own(), other], [other], 'firstPageHeader', /first page header does not open with the label/],
    ["page 1's own header empty", [own()], [], 'firstPageHeader', /first page header does not open with the label/],
    ["page 1's label in white", [own()], [white], 'firstPageHeader', /first page header does not open with the label/],
    ["page 1's label another language's", [own()], [french], 'firstPageHeader', /first page header does not open with the label/],
    ["a label on page 1's own header alone", [other], [own()], 'pageHeader', /first page header says the document is a copy.*page header does not/],
  ])('%s', (_name, pageHeader, firstPageHeader, subject, sentence) => {
    const document = documentOf([paragraph('Rechnung')], { pageHeader, ...(firstPageHeader === undefined ? {} : { firstPageHeader }) })
    const refusal = refusalOf(document)
    expect({ code: refusal.code, subject: refusal.subject }).toEqual({ code: 'unsupported', subject })
    expect(refusal.message).toMatch(sentence)
    expect(wordRefusal(document)).toEqual({ code: 'unsupported', subject })
  })

  // An XRechnung's final render with its XML taken off is still its PDF's copy: every page says "this PDF is not the invoice", which in a
  // Word file is a sentence about another file, and the file would stand where the copy the runtime labels for one does. The PDF's
  // label, on either header and in any style, is refused as what only the PDF prints, saying to ask for the copy.
  test("an XRechnung's PDF copy with its XML taken off, labelled on either header", () => {
    const { eInvoice: _xml, ...stripped } = resolved(XRECHNUNG_SAMPLES[0]!)
    expect(stripped.pageHeader[0]).toEqual(XRECHNUNG_COPY_PARAGRAPH)
    const cases: readonly (readonly [ResolvedDocument, string])[] = [
      [stripped, 'pageHeader'],
      [documentOf([paragraph('Rechnung')], { pageHeader: [{ ...XRECHNUNG_COPY_PARAGRAPH, style: { color: '#ffffff' } }, other] }), 'pageHeader'],
      [documentOf([paragraph('Rechnung')], { pageHeader: [other], firstPageHeader: [{ ...XRECHNUNG_COPY_PARAGRAPH }] }), 'firstPageHeader'],
    ]
    for (const [document, subject] of cases) {
      const refusal = refusalOf(document)
      expect({ code: refusal.code, subject: refusal.subject }).toEqual({ code: 'unsupported', subject })
      expect(refusal.message).toMatch(/XRechnung's PDF.*resolve the report with eInvoice: 'copy'/)
      expect(wordRefusal(document)).toEqual({ code: 'unsupported', subject })
    }
  })

  // The order: the e-invoice itself first, then a preview's label, then the copy's, each before any block is walked.
  test('after the e-invoice, and before a block no engine prints', () => {
    const red = paragraph('red', { color: 'red' })
    const invoice = { kind: 'facturX' } as NonNullable<ResolvedDocument['eInvoice']>
    expect(refusalOf(documentOf([red], { pageHeader: [white], eInvoice: invoice })).subject).toBe('eInvoice')
    expect(refusalOf(documentOf([red], { pageHeader: [white] })).subject).toBe('pageHeader')
    expect(refusalOf(documentOf([red], { pageHeader: [own()] })).subject).toBe('body[0]')
  })

  // A copy that carried its invoice's XML again would be the invoice's document with a label: refused as the e-invoice it carries.
  test('and a labelled copy that carries an e-invoice is refused as the e-invoice', () => {
    const copy = copyOf(E_INVOICE_SAMPLES[0]!)
    const invoice = resolved(E_INVOICE_SAMPLES[0]!)
    expect(refusalOf({ ...copy, eInvoice: invoice.eInvoice! })).toMatchObject({ code: 'unsupported', subject: 'eInvoice' })
  })

  // The words lower down, or in the body, are a report's own, as a quoted preview label is.
  test('a report that only quotes the label is written, and is no copy', async () => {
    const quoted = documentOf([own()], { pageHeader: [other, own()], paymentPart: resolvedBill(BILL_EXAMPLES.one) })
    const file = written(quoted)
    expect(await verifyDocx(fixtureOf('quoted', quoted), file)).toEqual([])
    expect(file.slip?.header?.blocks).toMatchObject([{ kind: 'paragraph', runs: [] }])
    expect(file.slip?.page.header).toBe(0)
  })
})
