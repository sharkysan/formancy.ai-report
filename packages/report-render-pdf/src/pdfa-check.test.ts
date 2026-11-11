import pdfmake from 'pdfmake'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { E_INVOICE, QUOTATION, starterImages, type Starter } from '@formancy/report-corpus'
import { RenderRefusal, resolveReport, type ReportData, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import { renderPdf } from './node.js'
import type { RenderOptions } from './options.js'
import { bareDocument, fixture, paragraph, TIMEOUT } from './testing/documents.js'
import { copied, E_INVOICE_FILE, invoiced } from './testing/e-invoice.js'

/**
 * What a document is drawn as, which `checkPdfA` decides once (0056): an
 * e-invoice's PDF/A-3b, the PDF/A-2b a host asked for with `pdfa: '2b'`,
 * or a plain PDF; and what it refuses as a PDF/A-2b. Each case runs
 * through the Node entry, watching what pdfmake is handed, so that a
 * refusal is seen to come before anything is laid out. What the PDF/A-2b
 * a definition asks for holds once PDFKit has written it is
 * `pdfa-2b.test.ts`'s, read back from the PDF.
 *
 * The messages are written here as the literals a host reads, never
 * imported from the code that writes them.
 */

const MSG_FACTUR_X = 'a Factur-X e-invoice is drawn as the PDF/A-3b that embeds its XML, and a PDF/A-2b may embed no such file: render it without pdfa'
const MSG_XRECHNUNG = "an XRechnung's PDF is the plain copy of its XML, labelled so on every page, and never an archival PDF/A: render it without pdfa"
const MSG_PREVIEW =
  'this document is a preview, labelled on every page as not a final report, and a PDF/A-2b of it would be kept as the report: draw the final render as PDF/A-2b, and the preview without pdfa'
const MSG_TITLE = "a PDF/A-2b's title is written into its XMP as it stands, where it may hold no &, < or > and no character XML 1.0 cannot write: this one does"

const CREATED = '2026-11-11T08:00:00Z'

/**
 * What rendering `document` with `options` came to -- its bytes or what it
 * was refused with -- and every definition pdfmake's Node build was handed
 * meanwhile, the final pass's last, each as it was handed over: pdfmake
 * writes a `version` of '1.3' into a definition that has none (Printer.js
 * 38), so the object read after the render is no longer what the renderer
 * gave it.
 */
async function attempt(
  document: ResolvedDocument,
  options: RenderOptions,
): Promise<{ readonly outcome: unknown; readonly definitions: readonly TDocumentDefinitions[] }> {
  const definitions: TDocumentDefinitions[] = []
  const createPdf = pdfmake.createPdf.bind(pdfmake)
  const spy = vi.spyOn(pdfmake, 'createPdf').mockImplementation((definition, options) => {
    definitions.push({ ...definition })
    return createPdf(definition, options)
  })
  try {
    const outcome = await renderPdf(document, options).then(
      (bytes) => bytes,
      (error: unknown) => error,
    )
    return { outcome, definitions }
  } finally {
    spy.mockRestore()
  }
}

/** `document`, refused with `options` as `expected` before pdfmake was handed anything. */
async function expectRefused(document: ResolvedDocument, options: RenderOptions, expected: Partial<RenderRefusal>): Promise<void> {
  const { outcome, definitions } = await attempt(document, options)
  expect(outcome).toBeInstanceOf(RenderRefusal)
  expect(outcome).toMatchObject(expected)
  expect(definitions).toEqual([])
}

/** The definition of the PDF `document` is drawn to with `options`: the final pass's. */
async function drawn(document: ResolvedDocument, options: RenderOptions): Promise<TDocumentDefinitions> {
  const { outcome, definitions } = await attempt(document, options)
  expect(outcome).toBeInstanceOf(Uint8Array)
  return definitions.at(-1)!
}

/** `starter` resolved against `data` as a preview, failing the test when the runtime refuses it. */
function preview(starter: Starter, data: ReportData): ResolvedDocument {
  const outcome = resolveReport(starter.report, data, { mode: 'preview', parameters: starter.parameters, images: starterImages, creationDate: CREATED })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join('; ')}`)
  return outcome.document
}

/** The quotation's data with `supplierUid`, a field its header declares, left out: data a preview lacks. */
const lacking: ReportData = {
  ...QUOTATION.data,
  header: Object.fromEntries(Object.entries(QUOTATION.data.header!).filter(([field]) => field !== 'supplierUid')),
}

const ONE_ROW = fixture('one-row').document

describe('pdfa', () => {
  // A misspelt or unsupported level would otherwise give a host a plain PDF it files as an archival one.
  test.each([
    ['3b', '3b'],
    ['2a', '2a'],
    ['2u', '2u'],
    ['PDF/A-2b', 'PDF/A-2b'],
    ['1b', '1b'],
    [2, '2'],
    [null, 'null'],
  ] as const)('pdfa %j is the caller’s RangeError, before pdfmake is asked', async (value, written) => {
    const { outcome, definitions } = await attempt(ONE_ROW, { maxPages: 5, pdfa: value as unknown as '2b' })
    expect(outcome).toBeInstanceOf(RangeError)
    expect((outcome as RangeError).message).toBe(`pdfa must be '2b' or left out; it is ${written}`)
    expect(definitions).toEqual([])
  })

  // The option is what makes the PDF/A: a definition without it is a plain PDF filed as an archive.
  test(
    'a final render asked for as PDF/A-2b hands pdfmake version 1.7 and subset PDF/A-2b, and one without pdfa neither',
    async () => {
      expect(await drawn(ONE_ROW, { maxPages: 5, pdfa: '2b' })).toMatchObject({ version: '1.7', subset: 'PDF/A-2b' })
      const plain = Object.keys(await drawn(ONE_ROW, { maxPages: 5 }))
      expect(plain).not.toContain('version')
      expect(plain).not.toContain('subset')
    },
    TIMEOUT,
  )
})

describe('an e-invoice asked for as PDF/A-2b', () => {
  // Drawn as 2b, a Factur-X would be a picture of an invoice in an archive that cannot hold the invoice.
  test(
    'a Factur-X e-invoice asked for as PDF/A-2b is refused as unsupported, naming eInvoice, before pdfmake is asked',
    async () => {
      await expectRefused(invoiced(ONE_ROW), { maxPages: 5, pdfa: '2b' }, { code: 'unsupported', subject: 'eInvoice', message: MSG_FACTUR_X })
      expect(await drawn(invoiced(ONE_ROW), { maxPages: 5 })).toMatchObject({ version: '1.7', subset: 'PDF/A-3b' })
    },
    TIMEOUT,
  )

  // Drawn as 2b, an XRechnung's copy would be kept as the archived invoice while every page says it is not one: its invoice is the XML a host sends.
  test(
    'an XRechnung’s copy asked for as PDF/A-2b is refused as unsupported, naming eInvoice, and drawn as its plain copy without pdfa',
    async () => {
      await expectRefused(copied(ONE_ROW), { maxPages: 5, pdfa: '2b' }, { code: 'unsupported', subject: 'eInvoice', message: MSG_XRECHNUNG })
      const plain = Object.keys(await drawn(copied(ONE_ROW), { maxPages: 5 }))
      expect(plain).not.toContain('version')
      expect(plain).not.toContain('subset')
    },
    TIMEOUT,
  )

  // An unknown e-invoice is refused for what it is, whatever the option: checkEInvoice runs first. Read by its kind alone, a file that only says
  // it is a Factur-X would be refused as one, and a host told to render it without pdfa would meet a second refusal there.
  test.each([
    ['of a kind the renderer does not know', { ...E_INVOICE_FILE, kind: 'ubl' }, 'the e-invoice is of a kind the renderer does not know'],
    [
      'that says it is a Factur-X under a file name the renderer does not know',
      { ...E_INVOICE_FILE, fileName: 'zugferd-invoice.xml' },
      'the e-invoice is embedded under a file name the renderer does not know',
    ],
  ] as const)(
    'an e-invoice %s is refused alike with and without pdfa',
    async (_, file, message) => {
      const unknown = invoiced(ONE_ROW, file)
      await expectRefused(unknown, { maxPages: 5, pdfa: '2b' }, { code: 'unsupported', subject: 'eInvoice', message })
      await expectRefused(unknown, { maxPages: 5 }, { code: 'unsupported', subject: 'eInvoice', message })
    },
    TIMEOUT,
  )
})

describe('a preview asked for as PDF/A-2b', () => {
  // A preview says on every page it is not the report; archived as one it would be kept as the report.
  test.each([
    ['incomplete data', () => preview(QUOTATION, lacking), 'Preview of incomplete data: not a final report'],
    ['an e-invoice', () => preview(E_INVOICE, E_INVOICE.data), 'Preview: not an e-invoice, and not a final report'],
  ] as const)(
    'a preview of %s, labelled so by the runtime, asked for as PDF/A-2b is refused as unsupported, naming pageHeader, and drawn without pdfa',
    async (_, resolved, label) => {
      const document = resolved()
      // The guard on the guard: the runtime heads the preview's page header with its label, a paragraph of that one run, which is what the renderer reads; an array matches only at its length.
      expect(document.pageHeader[0]).toMatchObject({ kind: 'paragraph', runs: [{ text: label }] })
      await expectRefused(document, { maxPages: 5, pdfa: '2b' }, { code: 'unsupported', subject: 'pageHeader', message: MSG_PREVIEW })
      await drawn(document, { maxPages: 5 })
    },
    TIMEOUT,
  )
})

describe("a PDF/A-2b's title", () => {
  // PDFKit writes the title into the XMP unescaped (pdfkit.js 6025-6032): a 2b of one would say PDF/A and not be one.
  test.each(['Müller & Söhne', 'Kunde <AG>', 'a > b', 'Bell\u0007', 'Half \uD800'])(
    'the title %j is refused in a PDF/A-2b, naming info.title, and drawn without pdfa',
    async (title) => {
      const document = bareDocument(title, [paragraph('Bericht')])
      await expectRefused(document, { maxPages: 1, pdfa: '2b' }, { code: 'unsupported', subject: 'info.title', message: MSG_TITLE })
      await drawn(document, { maxPages: 1 })
    },
    TIMEOUT,
  )
})
