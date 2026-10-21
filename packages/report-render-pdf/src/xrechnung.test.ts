import { readPdf, readPdfObjects, starterImages, XRECHNUNG_SAMPLE } from '@formancy/report-corpus'
import { resolveReport, XRECHNUNG_COPY_LABEL, type ReportData, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf as renderInBrowser } from './browser.js'
import { renderPdf } from './node.js'
import { TIMEOUT } from './testing/documents.js'

/**
 * An XRechnung's copy (0038, Q1), read back from the PDF the engine
 * produced (0003): a plain PDF, no PDF/A and no embedded file, since the
 * XRechnung is its XML, which a host takes from the resolved document and
 * sends; and every page labelled, at its head, as the copy whose invoice
 * is the XML. That its page prints what its XML holds is
 * `e-invoice-samples.test.ts`'s, as of every e-invoice sample.
 */

const CREATED = '2026-10-16T08:00:00Z'

function resolved(data: ReportData = XRECHNUNG_SAMPLE.data): ResolvedDocument {
  const outcome = resolveReport(XRECHNUNG_SAMPLE.report, data, { mode: 'final', parameters: XRECHNUNG_SAMPLE.parameters, images: starterImages, creationDate: CREATED })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}

/** The sample's data with its lines repeated `times` times, each at a position and an article of its own, so that its table runs onto a second page. */
function longer(times: number): ReportData {
  const rows = XRECHNUNG_SAMPLE.data.detail as Record<string, string>[]
  const detail = Array.from({ length: times }, (_, round) => rows.map((row, index) => ({ ...row, position: String(round * rows.length + index + 1), article: `H-${9000 + round * rows.length + index}` }))).flat()
  return { ...XRECHNUNG_SAMPLE.data, detail, completeness: { complete: true, captured: detail.length } }
}

describe("an XRechnung's copy", () => {
  // The federal portals take XRechnung as XML alone, and a buyer who
  // receives a PDF that embeds it would hold two files of one invoice. So
  // the copy is no PDF/A and no ZUGFeRD hybrid: no metadata, no output
  // intent, no associated file and nothing in the name tree, by pdf-lib;
  // no attachment, by PDF.js.
  test('is a plain PDF that embeds nothing', async () => {
    const document = resolved()
    expect(document.eInvoice?.kind).toBe('xrechnung')
    const bytes = await renderPdf(document, { maxPages: 5 })
    const objects = await readPdfObjects(bytes)
    expect(objects).toMatchObject({ version: '1.3', metadata: undefined, associatedFiles: [], embeddedFiles: [], outputIntents: [] })
    expect((await readPdf(bytes)).attachments).toEqual([])
    expect(objects.info['Title']).toBe('Rechnung (XRechnung)')
  }, TIMEOUT)

  // Every page says it is the copy, as the first line at its top: a page
  // printed or passed on alone is never taken for the invoice. Held on a
  // copy of the sample whose table runs onto a second page.
  test('says on every page, at its head, that it is the copy whose invoice is the XML', async () => {
    const pdf = await readPdf(await renderPdf(resolved(longer(12)), { maxPages: 5 }))
    expect(pdf.pages.length).toBeGreaterThanOrEqual(2)
    for (const page of pdf.pages) {
      const top = page.items.toSorted((a, b) => a.top - b.top || a.x - b.x)[0]
      expect(top?.text, `page ${page.number}`).toBe(XRECHNUNG_COPY_LABEL)
      expect(page.items.filter((item) => item.text === XRECHNUNG_COPY_LABEL), `page ${page.number}`).toHaveLength(1)
    }
  }, TIMEOUT)

  // The browser entry draws the very pages the Node entry does, and one
  // document is the same bytes every time, as every report's is.
  test('is drawn alike by both entries, and the same bytes twice', async () => {
    const document = resolved()
    const [node, again, browser] = [await renderPdf(document, { maxPages: 5 }), await renderPdf(document, { maxPages: 5 }), await renderInBrowser(document, { maxPages: 5 })]
    expect(Buffer.from(node).equals(Buffer.from(again))).toBe(true)
    expect((await readPdf(browser)).pages).toEqual((await readPdf(node)).pages)
    expect((await readPdfObjects(browser)).associatedFiles).toEqual([])
  }, TIMEOUT)
})
