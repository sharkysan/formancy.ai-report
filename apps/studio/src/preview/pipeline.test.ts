// @vitest-environment node

import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { drawingsOn, epcCodes, readCodes, readPdf } from '@formancy/report-corpus'
import { resolveReport } from '@formancy/report-runtime'
import { afterAll, beforeAll, describe, expect, test, vi, type MockInstance } from 'vitest'
import { studioImages } from '../images/image-store.js'
import { decodeStarters, encodeStarters } from '../starters/codec.js'
import { BLANK } from '../starters/starters.js'
import { preview } from './pipeline.js'
import type { PreviewRequest } from './pipeline.js'

/**
 * The preview's pipeline as the page runs it -- the starters as the page
 * receives them, the runtime, and the renderer's browser entry -- run here
 * under Node, where PDF.js reads the PDFs back (0003), so a claim about
 * what printed rests on the PDF, not on what the renderer was handed. The
 * journey runs the same entry under jsdom, and the browser gate in
 * Chromium.
 */

const { starters, images } = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))
const CREATED = '2026-10-16T08:00:00Z'

function request(id: string, overrides: Partial<PreviewRequest> = {}): PreviewRequest {
  const starter = [...starters, BLANK].find((each) => each.id === id)
  if (starter === undefined) throw new Error(`no starter ${id}`)
  return { report: starter.report, starter, mode: 'preview', images: studioImages(images).resolve, creationDate: CREATED, ...overrides }
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
    const titles: Readonly<Record<string, string>> = { 'service-inspection': 'Service inspection', quotation: 'Offerte', 'grouped-equipment': 'Equipment register', invoice: 'Rechnung', 'euro-invoice': 'Rechnung', 'e-invoice': 'Rechnung', 'site-visit': 'Site visit' }
    if (id !== 'blank') expect(pdf.pages.flatMap((page) => page.items.map((item) => item.text)).join(' ')).toContain(titles[id] ?? `(no title for ${id})`)
    expect(outcome.manifest.mode).toBe('preview')
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
    const resolved = resolveReport(invoice.report, invoice.starter.data, { mode: 'preview', parameters: invoice.starter.parameters, images: invoice.images, creationDate: CREATED })
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
    const resolved = resolveReport(invoice.report, invoice.starter.data, { mode: 'preview', parameters: invoice.starter.parameters, images: invoice.images, creationDate: CREATED })
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

  // What the renderer refuses -- here, the inspection's two pages against a
  // limit of one -- comes back as its code and subject, never as a PDF cut
  // short (0011).
  test("returns the renderer's refusal, never part of a PDF", async () => {
    const outcome = await preview(request('service-inspection'), new AbortController().signal, { maxPages: 1 })
    expect(outcome).toEqual({ kind: 'not-drawn', refusal: expect.objectContaining({ code: 'too-many-pages' }) })
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
