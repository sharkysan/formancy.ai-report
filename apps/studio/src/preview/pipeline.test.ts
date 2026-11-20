// @vitest-environment node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INVOICE_EDITIONS, INVOICE_LANGUAGES, invoiceLanguagesData, STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { drawingsOn, epcCodes, readCii, readCodes, readPdf, readPdfObjects, textAt } from '@formancy/report-corpus'
import { expectation, readDocx, verifyDocx, wordRefusal } from '@formancy/report-corpus'
import { resolveReport } from '@formancy/report-runtime'
import { afterAll, beforeAll, describe, expect, test, vi, type MockInstance } from 'vitest'
import { studioImages } from '../images/image-store.js'
import { decodeStarters, encodeStarters } from '../starters/codec.js'
import { BLANK } from '../starters/starters.js'
import { preview, PREVIEW_PAGE_LIMIT } from './pipeline.js'
import type { PreviewRequest } from './pipeline.js'

/**
 * The preview's pipeline as the page runs it -- the starters as the page
 * receives them, the runtime, and the renderer's browser entry -- run here
 * under Node, where PDF.js reads the PDFs back (0003), so a claim about
 * what printed rests on the PDF, not on what the renderer was handed. The
 * journey runs the same entry under jsdom, and the browser gate in
 * Chromium.
 *
 * The Word file a printed render hands on (0068) is read back the same
 * way: by the corpus's `readDocx`, which is not its writer, and held by
 * `verifyDocx` to the document this suite resolves for itself, a code in
 * it by what ZXing reads in its picture (0074).
 */

const { starters, images } = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))
const CREATED = '2026-10-16T08:00:00Z'

function request(id: string, overrides: Partial<PreviewRequest> = {}): PreviewRequest {
  const starter = [...starters, BLANK].find((each) => each.id === id)
  if (starter === undefined) throw new Error(`no starter ${id}`)
  return { report: starter.report, starter, mode: 'preview', images: studioImages(images).resolve, creationDate: CREATED, ...overrides }
}

/**
 * What each starter's Word file is, as record 0068's table says it and
 * record 0074 changed it: written, or refused by the writer, a preview
 * and a final render each for the part of the document it names. A
 * QR-bill's slip belongs to the PDF; an e-invoice's final render is its
 * PDF/A-3b or the copy of its XML, and its preview is labelled in its
 * page header as no invoice; and a chart is laid out for the PDF alone,
 * so the sales report is refused for the first of its two, by its id.
 * The euro invoice, which an EPC QR code pays, is written since 0074.
 */
const WORD: Readonly<Record<string, 'written' | { readonly preview: string; readonly final: string }>> = {
  'service-inspection': 'written',
  quotation: 'written',
  'grouped-equipment': 'written',
  'site-visit': 'written',
  'order-confirmation': 'written',
  'product-data-sheet': 'written',
  'euro-invoice': 'written',
  blank: 'written',
  invoice: { preview: 'paymentPart', final: 'paymentPart' },
  'payment-reminder': { preview: 'paymentPart', final: 'paymentPart' },
  'e-invoice': { preview: 'pageHeader', final: 'eInvoice' },
  'e-invoice-xrechnung': { preview: 'pageHeader', final: 'eInvoice' },
  'sales-report': { preview: 'by-category', final: 'by-category' },
}

// pdfmake's browser build warns, outside a browser, that it has no local
// access policy to set; report-render-pdf's own browser test silences that
// one warning the same way, and holds that it is the only one.
let warn: MockInstance<typeof console.warn>
beforeAll(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterAll(() => {
  const warnings = new Set(warn.mock.calls.map((call) => String(call[0])))
  warn.mockRestore()
  expect([...warnings].filter((each) => !each.startsWith('No local access policy defined'))).toEqual([])
})

describe('the preview pipeline', () => {
  // Each starter opens in the Studio and previews at once. One that came
  // back refused -- an image the host's lookup did not hand over, data the
  // page decoded differently -- would greet the person with an error for a
  // report the corpus proves prints.
  test.each([...starters.map((starter) => starter.id), 'blank'])('prints %s, and the PDF holds its title', async (id) => {
    const outcome = await preview(request(id), new AbortController().signal)
    if (outcome.kind !== 'printed') throw new Error(`${id} was not printed: ${JSON.stringify(outcome)}`)
    const pdf = await readPdf(outcome.pdf)
    expect(pdf.pages.length).toBeGreaterThan(0)
    const titles: Readonly<Record<string, string>> = {
      'service-inspection': 'Service inspection',
      quotation: 'Offerte',
      'grouped-equipment': 'Equipment register',
      invoice: 'Rechnung',
      'euro-invoice': 'Rechnung',
      'e-invoice': 'Rechnung',
      'e-invoice-xrechnung': 'Rechnung',
      'site-visit': 'Site visit',
      'order-confirmation': 'Auftragsbestätigung',
      'product-data-sheet': 'Produktdatenblatt',
      'payment-reminder': 'Mahnung',
      'sales-report': 'Umsatzbericht',
    }
    if (id !== 'blank') expect(pdf.pages.flatMap((page) => page.items.map((item) => item.text)).join(' ')).toContain(titles[id] ?? `(no title for ${id})`)
    expect(outcome.manifest.mode).toBe('preview')
    // A preview writes no e-invoice (0027): an XML handed on here would be a
    // Download XML of an invoice the runtime never wrote.
    expect(outcome.xml).toBeUndefined()
  })

  // Each e-invoice starter's final render hands on the XML the runtime
  // wrote (0065), the one writer's (cii.ts), read back by namespace: the
  // Factur-X's the very bytes its PDF/A-3b embeds as factur-x.xml, the
  // XRechnung's beside a copy that embeds nothing (0038), each naming its
  // own guideline (BT-24) and a total with VAT (BT-112) its page prints.
  // A second writer, or the XML of another render, would hand a person an
  // invoice the PDF beside it does not hold.
  test.each([
    ['e-invoice', 'urn:cen.eu:en16931:2017', ['factur-x.xml']],
    ['e-invoice-xrechnung', 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0', []],
  ] as const)('writes the XML of %s’s final render, the one its PDF embeds or none', async (id, guideline, embedded) => {
    const outcome = await preview(request(id, { mode: 'final' }), new AbortController().signal)
    if (outcome.kind !== 'printed' || outcome.xml === undefined) throw new Error(`${id} printed no XML: ${outcome.kind}`)
    const files = (await readPdfObjects(outcome.pdf)).associatedFiles
    expect(files.map((file) => file.f)).toEqual(embedded)
    for (const file of files) expect(file.embedded?.bytes).toEqual(new TextEncoder().encode(outcome.xml))
    const xml = readCii(outcome.xml)
    expect(textAt(xml, 'rsm:ExchangedDocumentContext/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID')).toBe(guideline)
    const total = textAt(
      xml,
      'rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeSettlement/ram:SpecifiedTradeSettlementHeaderMonetarySummation/ram:GrandTotalAmount',
    )
    const printed = (await readPdf(outcome.pdf)).pages.flatMap((page) => page.items.map((item) => item.text)).join(' ')
    expect(printed.replaceAll(/[\u00a0\u202f]/g, ' ')).toContain(
      `Rechnungsbetrag ${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2 }).format(Number(total))} €`,
    )
  })

  // As each e-invoice starter opens, its XML is byte for byte the file the
  // e-invoice gate recorded and had Mustang and KoSIT's validator judge
  // (scripts/e-invoice/recorded/corpus/), whose run fails where what it
  // judged is not that recording: what the README says of the Download
  // XML rests on this. The render's clock is not the gate's, and the XML
  // reads none. A starter whose XML drifted from the gate's would offer a
  // file no validator has seen.
  test.each(['e-invoice', 'e-invoice-xrechnung'])('writes %s’s XML, as it opens, as the e-invoice gate recorded and judged it', async (id) => {
    const outcome = await preview(request(id, { mode: 'final', creationDate: new Date().toISOString() }), new AbortController().signal)
    const recorded = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'scripts', 'e-invoice', 'recorded', 'corpus', `${id}.xml`)
    expect(outcome.kind === 'printed' ? outcome.xml : outcome.kind).toBe(readFileSync(recorded, 'utf8'))
  })

  // The invoice's slip is drawn by the browser entry the page uses, which
  // loads the slip's Liberation Sans only for a report with a bill: its
  // receipt and payment part are printed on the invoice's one page, and
  // its code, read from the pixels PDF.js draws, is the bill's text. A
  // browser entry that lost the font, or drew the slip without the code,
  // would show a Studio invoice nobody could pay.
  test('prints the invoice with its QR-bill, its code the bill the runtime resolved', async () => {
    const invoice = request('invoice')
    const outcome = await preview(invoice, new AbortController().signal)
    if (outcome.kind !== 'printed') throw new Error(`the invoice was not printed: ${JSON.stringify(outcome)}`)
    const resolved = resolveReport(invoice.report, invoice.starter.data, {
      mode: 'preview',
      parameters: invoice.starter.parameters,
      images: invoice.images,
      creationDate: CREATED,
    })
    if (!resolved.ok || resolved.document.paymentPart === undefined) throw new Error('the invoice resolved without its bill')
    const bill = resolved.document.paymentPart
    const pdf = await readPdf(outcome.pdf)
    expect(pdf.pages).toHaveLength(1)
    const printed = pdf.pages[0]?.items.map((item) => item.text).join(' ') ?? ''
    for (const words of ['Empfangsschein', 'Zahlteil', bill.amount ?? '(no amount)']) expect(printed).toContain(words)
    expect((await readCodes(outcome.pdf, 1)).map((code) => code.text)).toEqual([bill.payload])
  })

  // The euro invoice's EPC code is drawn by the browser entry the page
  // uses, as the Node entry draws it: read from the pixels PDF.js draws,
  // it is the payload the runtime resolved, on the invoice's one page,
  // beside the payment details the page prints. A browser entry that drew
  // no code, or another, would show a Studio invoice a banking app could
  // not pay, or would pay wrongly.
  test('prints the euro invoice with its EPC code, the payload the runtime resolved', async () => {
    const invoice = request('euro-invoice')
    const outcome = await preview(invoice, new AbortController().signal)
    if (outcome.kind !== 'printed') throw new Error(`the euro invoice was not printed: ${JSON.stringify(outcome)}`)
    const resolved = resolveReport(invoice.report, invoice.starter.data, {
      mode: 'preview',
      parameters: invoice.starter.parameters,
      images: invoice.images,
      creationDate: CREATED,
    })
    if (!resolved.ok) throw new Error('the euro invoice was refused')
    const pdf = await readPdf(outcome.pdf)
    expect(pdf.pages).toHaveLength(1)
    expect(pdf.pages[0]?.items.map((item) => item.text).join(' ')).toContain('Bankverbindung')
    expect((await readCodes(outcome.pdf, 1)).map((code) => code.text)).toEqual(epcCodes(resolved.document.body).map((code) => code.payload))
  })

  // The firm's mark (0032) crosses into the page with the starters, its
  // bytes as base64, and the browser entry the page uses draws it as
  // vectors: on the quotation's first page, a clip 15 mm square at the left
  // margin with the mark's blue painted inside it, and no image embedded. A
  // codec that dropped an SVG's bytes, or an entry that drew none, would
  // show a quotation without its letterhead, or refuse it as missing-asset.
  test('prints the quotation with the firm’s mark drawn at the head of its first page', async () => {
    const outcome = await preview(request('quotation'), new AbortController().signal)
    if (outcome.kind !== 'printed') throw new Error(`the quotation was not printed: ${JSON.stringify(outcome)}`)
    const [first] = (await readPdf(outcome.pdf)).pages
    const marks = first === undefined ? [] : drawingsOn(first).filter((drawing) => drawing.paints.includes('#1f4e79'))
    expect(marks.map(({ box: [x, , width, height] }) => [x, width, height])).toEqual([[56.69, 42.52, 42.52]])
    expect(first?.images).toEqual([])
  })

  // What the runtime refuses comes back as its errors, each with its stage
  // and the component it is in, for the pane to list and link -- not as an
  // exception that leaves the preview blank. Final refuses data a preview
  // would show with a warning.
  test('returns what the runtime refuses, with where it is', async () => {
    const quotation = request('quotation')
    const header = { ...(quotation.starter.data.header ?? {}) }
    delete header[Object.keys(header)[0] ?? '']
    const lacking = { ...quotation.starter, data: { ...quotation.starter.data, header } }
    const final = await preview({ ...quotation, starter: lacking, mode: 'final' }, new AbortController().signal)
    expect(final.kind).toBe('refused')
    if (final.kind === 'refused') expect(final.errors.map((error) => error.stage)).toContain('data')
    const sample = await preview({ ...quotation, starter: lacking, mode: 'preview' }, new AbortController().signal)
    expect(sample.kind).toBe('printed')
    if (sample.kind === 'printed') expect(sample.warnings.length).toBeGreaterThan(0)
  })

  // The Preview prints in the language the builder shows (0063): the
  // invoice written in four languages, previewed in French, prints its
  // French words and names French in its manifest; one word taken out of
  // the French, it comes back refused for it, where the German prints. A
  // pipeline that dropped the locale would print the German invoice for
  // a person writing the French.
  test('prints in the language asked for, and returns the refusal of one that lacks a word', async () => {
    const french = INVOICE_EDITIONS[1]
    if (french === undefined) throw new Error('the invoice has no French edition')
    const invoice = request('invoice')
    const starter = { ...invoice.starter, data: invoiceLanguagesData(french) }
    const printed = await preview({ ...invoice, report: INVOICE_LANGUAGES, starter, locale: 'fr-CH' }, new AbortController().signal)
    if (printed.kind !== 'printed') throw new Error(`the French invoice was not printed: ${JSON.stringify(printed)}`)
    expect(printed.manifest.locale).toBe('fr-CH')
    const pdf = await readPdf(printed.pdf)
    expect(pdf.pages.flatMap((page) => page.items.map((item) => item.text)).join(' ')).toContain('Facture')
    const lacking = {
      ...INVOICE_LANGUAGES,
      translations: (INVOICE_LANGUAGES.translations ?? []).map((translation) =>
        translation.locale === 'fr-CH' ? { ...translation, words: translation.words.slice(1) } : translation,
      ),
    }
    const refused = await preview({ ...invoice, report: lacking, starter, locale: 'fr-CH' }, new AbortController().signal)
    expect(refused.kind === 'refused' ? refused.errors.map((error) => error.code) : refused.kind).toContain('word-missing')
    const own = await preview({ ...invoice, report: lacking, locale: 'de-CH' }, new AbortController().signal)
    expect(own.kind).toBe('printed')
  })

  // What the renderer refuses -- here, the inspection's two pages against a
  // limit of one -- comes back as its code and subject, never as a PDF cut
  // short (0011).
  test("returns the renderer's refusal, never part of a PDF", async () => {
    const outcome = await preview(request('service-inspection'), new AbortController().signal, { maxPages: 1 })
    expect(outcome).toEqual({ kind: 'not-drawn', refusal: expect.objectContaining({ code: 'too-many-pages' }) })
  })

  // A starter added to the corpus is read before the Preview is said to
  // offer its Word file: one the table below does not name fails here,
  // rather than pass the cases after it by being in none of them.
  test('names what the Word file of every starter the page offers is', () => {
    expect([...starters.map((starter) => starter.id), 'blank'].sort()).toEqual(Object.keys(WORD).sort())
  })

  // A printed render hands on the Word file of the very document its PDF
  // was drawn from (0068): read whole by the corpus's reader and held to
  // the document this case resolves from the same request -- every word,
  // cell and picture, the page, the title and the instant it was made --
  // or, where the writer refuses the report, its refusal and no file, by
  // the subject record 0068's table names for that starter and the corpus
  // derives from the document. A pipeline that wrote the file of another
  // document, or dropped the refusal, would have the Preview offer a Word
  // file that is not the report on the paper, or none and no reason.
  test.each(Object.keys(WORD).flatMap((id) => (['preview', 'final'] as const).map((mode) => [id, mode] as const)))(
    'hands on the Word file of %s’s %s render, or why the writer refused it',
    async (id, mode) => {
      const asked = request(id, { mode })
      const outcome = await preview(asked, new AbortController().signal)
      if (outcome.kind !== 'printed') throw new Error(`${id} was not printed: ${JSON.stringify(outcome)}`)
      const resolved = resolveReport(asked.report, asked.starter.data, {
        mode,
        parameters: asked.starter.parameters,
        images: asked.images,
        creationDate: CREATED,
      })
      if (!resolved.ok) throw new Error(`${id} was refused`)
      const { document } = resolved
      const expected = WORD[id]
      if (expected === undefined || expected === 'written') {
        if (outcome.word.kind !== 'written') throw new Error(`${id} has no Word file: ${JSON.stringify(outcome.word)}`)
        expect(wordRefusal(document)).toBeUndefined()
        // Its pages are Word's: the page counts a fixture states are read by no check of a Word file.
        const fixture = { id, title: id, document, maxPages: PREVIEW_PAGE_LIMIT, expect: expectation(document, { maxPagesExpected: PREVIEW_PAGE_LIMIT }) }
        expect(await verifyDocx(fixture, readDocx(outcome.word.docx))).toEqual([])
      } else {
        const refusal = { code: 'unsupported', subject: expected[mode] }
        expect(outcome.word).toEqual({ kind: 'refused', refusal: { ...refusal, message: expect.stringMatching(/print (the report|the preview) as a PDF$/) } })
        expect(wordRefusal(document)).toEqual(refusal)
      }
    },
  )

  // A preview of data that lacks something is labelled on every page as
  // no final report (0010), and the writer refuses a labelled preview: in
  // a Word file the label is a paragraph a person deletes. The PDF is
  // printed all the same, with its warning; a pipeline that took the
  // writer's refusal for the render's would show no preview of a report
  // whose data is still being filled in.
  test('prints a preview of incomplete data, and hands on the writer’s refusal of its label', async () => {
    const quotation = request('quotation')
    const header = { ...(quotation.starter.data.header ?? {}) }
    delete header[Object.keys(header)[0] ?? '']
    const outcome = await preview(
      { ...quotation, starter: { ...quotation.starter, data: { ...quotation.starter.data, header } } },
      new AbortController().signal,
    )
    if (outcome.kind !== 'printed') throw new Error(`the preview was not printed: ${JSON.stringify(outcome)}`)
    expect(outcome.warnings.length).toBeGreaterThan(0)
    expect(outcome.word).toEqual({ kind: 'refused', refusal: expect.objectContaining({ code: 'unsupported', subject: 'pageHeader' }) })
  })

  // An abort is the renderer's `cancelled`: the scheduler drops it, and
  // nothing else hears of it as a failure.
  test('is cancelled by its signal', async () => {
    const controller = new AbortController()
    controller.abort()
    const outcome = await preview(request('quotation'), controller.signal)
    expect(outcome).toEqual({ kind: 'not-drawn', refusal: expect.objectContaining({ code: 'cancelled' }) })
  })
})
