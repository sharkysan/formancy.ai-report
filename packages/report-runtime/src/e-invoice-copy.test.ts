import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { ReportData } from './data.js'
import type { Block, Paragraph } from './document.js'
import { E_INVOICE_COPY_LABELS, E_INVOICE_COPY_LANGUAGES, eInvoiceCopyParagraph, readCopyLabel } from './e-invoice-copy.js'
import * as runtime from './index.js'
import { E_INVOICE_PREVIEW_LABEL, resolveReport, XRECHNUNG_COPY_PARAGRAPH } from './resolve.js'
import type { Resolution, ResolveOptions } from './resolve.js'
import type { RuntimeError } from './resolve-errors.js'
import { invoiceData, invoiceReport, invoiceRow, sampleData, sampleReport, xrechnungData, xrechnungReport } from './test-support.js'

/**
 * The copy of an e-invoice (0077): a final render resolved where a host
 * asks for `eInvoice: 'copy'`, which says on every page, in the render's
 * language, that it is not the invoice and what is, and carries no XML.
 * It is what a Word file is written of; the label is the runtime's, and
 * an engine only reads it.
 */

const FINAL: ResolveOptions = { mode: 'final', creationDate: '2026-11-19T08:00:00Z' }
const COPY: ResolveOptions = { ...FINAL, eInvoice: 'copy' }

function resolved(report: ReportDefinition, data: ReportData, options: ResolveOptions): Extract<Resolution, { ok: true }> {
  const outcome = resolveReport(report, data, options)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome
}

function refused(report: ReportDefinition, data: ReportData, options: ResolveOptions): string[] {
  const outcome = resolveReport(report, data, options)
  if (outcome.ok) throw new Error('resolved, and was expected to be refused')
  return outcome.errors.map(({ code, path, message }: RuntimeError) => `${code} ${path} ${message}`)
}

const LINES = [invoiceRow(), invoiceRow({ position: '2', item: 'Brot', quantity: '3', unit: 'KGM', price: '2.99', amount: '8.97', vat: 'reduced' })]

/** `report` with a header of page 1's own (0060), which a label must head as it heads the page header. */
const withFirstPage = (report: ReportDefinition): ReportDefinition => ({
  ...report,
  regions: { ...report.regions, firstPageHeader: [] },
})

describe("a copy of an e-invoice's final render", () => {
  // A Factur-X's final render carries no label: it is the invoice. A Word
  // file written of that document would be a picture of the invoice that
  // says nothing of what it is. The copy says it at the top of every
  // header a page prints, in the language the render prints in.
  test('heads every header with the label of its kind, in the language the render prints in', () => {
    const report = withFirstPage(invoiceReport())
    const { document } = resolved(report, invoiceData(LINES), COPY)
    const label = eInvoiceCopyParagraph('facturX', 'de-DE')
    expect(label?.runs).toEqual([
      { text: 'Kopie einer E-Rechnung: Die Rechnung ist das PDF, das ihr XML einbettet, und dieses Dokument ist nicht die Rechnung' },
    ])
    expect(document.pageHeader[0]).toEqual(label)
    expect(document.firstPageHeader?.[0]).toEqual(label)
    // Each header has a paragraph of its own, and neither is the runtime's frozen one.
    expect(document.pageHeader[0]).not.toBe(document.firstPageHeader?.[0])
    expect(document.pageHeader[0]).not.toBe(label)
  })

  // An XRechnung's final render says "this PDF is not the invoice", which
  // in a Word file is a sentence about something else. Its copy carries
  // the copy's own label in the XRechnung's place, never both.
  test("labels an XRechnung's copy with the copy's label in the place of the PDF's", () => {
    const { document } = resolved(xrechnungReport(), xrechnungData(LINES), COPY)
    const label = eInvoiceCopyParagraph('xrechnung', 'de-DE')
    expect(label?.runs).toEqual([{ text: 'Kopie einer XRechnung: Die Rechnung ist ihr XML, und dieses Dokument ist nicht die Rechnung' }])
    expect(document.pageHeader[0]).toEqual(label)
    expect(document.pageHeader.filter((block) => readCopyLabel([block]) !== undefined)).toHaveLength(1)
    expect(document.pageHeader).not.toContainEqual(XRECHNUNG_COPY_PARAGRAPH)
  })

  // The copy embeds nothing and sends nothing: a document that carried
  // the XML beside a label saying it is not the invoice would be drawn by
  // the PDF renderer as the PDF/A-3b that embeds it. So the copy carries
  // none, and no engine can take one from it.
  test('carries no XML, and is the final render in everything else but its label', () => {
    for (const [report, data] of [
      [invoiceReport(), invoiceData(LINES)],
      [xrechnungReport(), xrechnungData(LINES)],
    ] as const) {
      const invoice = resolved(report, data, FINAL)
      const copy = resolved(report, data, COPY)
      expect(invoice.document.eInvoice).toBeDefined()
      expect(copy.document.eInvoice).toBeUndefined()
      expect('eInvoice' in copy.document).toBe(false)
      const { eInvoice: _file, pageHeader: invoiceHeader, ...rest } = invoice.document
      const { pageHeader, ...copied } = copy.document
      expect(copied).toEqual(rest)
      // The Factur-X's header gains the label; the XRechnung's has the copy's in the place of its own.
      expect(pageHeader.slice(1)).toEqual(report.eInvoice?.kind === 'xrechnung' ? invoiceHeader.slice(1) : invoiceHeader)
      expect(copy.warnings).toEqual([])
    }
  })

  // What a file was resolved as is kept beside it: a manifest that said
  // nothing would describe the invoice's render and the copy's alike.
  test('says in its manifest that it is the copy', () => {
    expect(resolved(invoiceReport(), invoiceData(LINES), COPY).manifest.eInvoice).toBe('copy')
    expect('eInvoice' in resolved(invoiceReport(), invoiceData(LINES), FINAL).manifest).toBe(false)
  })

  // A copy is of an invoice that exists: the terms are held and the XML
  // written as for the invoice, and dropped. A copy of a report whose
  // invoice is refused would be a page whose invoice nobody can send.
  test('is refused where the invoice is refused, by the same errors', () => {
    const data = xrechnungData(LINES, { leitwegId: null })
    expect(refused(xrechnungReport(), data, COPY)).toEqual(refused(xrechnungReport(), data, FINAL))
  })

  // A preview writes no XML: there is nothing it is a copy of, and its
  // label says another thing. One header carries one label.
  test('is refused of a preview', () => {
    expect(refused(invoiceReport(), invoiceData(LINES), { ...COPY, mode: 'preview' })).toEqual([
      'no-e-invoice-copy  a copy is of a final render of an e-invoice; a preview writes no XML, and there is no invoice it is a copy of',
    ])
    // Asked for without the copy, the preview is what it was.
    expect(resolved(invoiceReport(), invoiceData(LINES), { ...FINAL, mode: 'preview' }).document.pageHeader[0]).toMatchObject({
      runs: [{ text: E_INVOICE_PREVIEW_LABEL }],
    })
  })

  // The option is the host's, whatever its type says: a value nobody
  // knows read as "no copy" would hand a host the invoice's document
  // where it asked for something else.
  test('is refused where it is asked for as anything but a copy', () => {
    for (const asked of ['kopie', true, 1, null, {}]) {
      expect(refused(invoiceReport(), invoiceData(LINES), { ...FINAL, eInvoice: asked as 'copy' })).toEqual([
        "no-e-invoice-copy  a render's eInvoice option is 'copy' or absent",
      ])
    }
  })

  // The label is the one thing that tells a reader what the page is. In
  // a language the page does not speak it tells them nothing (0063), so
  // a copy in a language the runtime holds no label in is refused, never
  // labelled in English.
  test('is refused in a language the runtime has no label in, at the locale', () => {
    const polish: ReportDefinition = { ...invoiceReport(), locale: 'pl-PL' }
    expect(refused(polish, invoiceData(LINES), COPY)).toEqual([
      `no-e-invoice-copy /locale a copy of an e-invoice is labelled in the language it prints in, and the runtime has no label in the language of pl-PL: it has one in ${E_INVOICE_COPY_LANGUAGES.join(', ')}`,
    ])
    // The invoice itself prints in Polish as it did.
    expect(resolved(polish, invoiceData(LINES), FINAL).document.eInvoice).toBeDefined()
  })

  // A host that writes every report's Word file asks for the copy of each:
  // a report that carries no e-invoice has nothing the option speaks of.
  test('says nothing of a report that carries no e-invoice', () => {
    const parameters = { from: '2026-01-01' }
    const plain = resolved(sampleReport(), sampleData(), { ...FINAL, parameters })
    const asked = resolved(sampleReport(), sampleData(), { ...COPY, parameters })
    expect(asked.document).toEqual(plain.document)
    expect(asked.manifest).toEqual(plain.manifest)
    // In a preview too, where an e-invoice's copy is refused.
    expect(resolved(sampleReport(), sampleData(), { ...COPY, parameters, mode: 'preview' }).document).toEqual(
      resolved(sampleReport(), sampleData(), { ...FINAL, parameters, mode: 'preview' }).document,
    )
  })
})

describe("the copy's label", () => {
  const KINDS = ['facturX', 'xrechnung'] as const

  // Each label must say three things -- that this is a copy, that it is
  // not the invoice, and what the invoice is -- in every language. The
  // words are pinned whole: a label reworded to drop one would still be a
  // label.
  test('says, in each language, that the page is a copy, what the invoice is, and that this is not it', () => {
    expect(E_INVOICE_COPY_LABELS).toEqual({
      facturX: {
        de: 'Kopie einer E-Rechnung: Die Rechnung ist das PDF, das ihr XML einbettet, und dieses Dokument ist nicht die Rechnung',
        en: 'Copy of an e-invoice: the invoice is the PDF that embeds its XML, and this document is not the invoice',
        es: 'Copia de una factura electrónica: la factura es el PDF que incorpora su XML, y este documento no es la factura',
        fr: "Copie d'une facture électronique : la facture est le PDF qui intègre son XML, et ce document n'est pas la facture",
        it: 'Copia di una fattura elettronica: la fattura è il PDF che incorpora il suo XML, e questo documento non è la fattura',
        nl: 'Kopie van een e-factuur: de factuur is de pdf waarin haar XML is ingesloten, en dit document is niet de factuur',
      },
      xrechnung: {
        de: 'Kopie einer XRechnung: Die Rechnung ist ihr XML, und dieses Dokument ist nicht die Rechnung',
        en: 'Copy of an XRechnung: the invoice is its XML, and this document is not the invoice',
        es: 'Copia de una XRechnung: la factura es su XML, y este documento no es la factura',
        fr: "Copie d'une XRechnung : la facture est son XML, et ce document n'est pas la facture",
        it: 'Copia di una XRechnung: la fattura è il suo XML, e questo documento non è la fattura',
        nl: 'Kopie van een XRechnung: de factuur is haar XML, en dit document is niet de factuur',
      },
    })
    expect(Object.keys(E_INVOICE_COPY_LABELS.facturX)).toEqual([...E_INVOICE_COPY_LANGUAGES])
    expect(Object.keys(E_INVOICE_COPY_LABELS.xrechnung)).toEqual([...E_INVOICE_COPY_LANGUAGES])
    // No two labels are the same words: a label read back names one kind in one language.
    const all = KINDS.flatMap((kind) => Object.values(E_INVOICE_COPY_LABELS[kind]))
    expect(new Set(all).size).toBe(all.length)
  })

  // A language is a locale's first subtag, whatever its region and its
  // case: fr-CH and fr-FR read the same French, and "pl" none.
  test('is found by the language of a locale, whatever its region', () => {
    for (const kind of KINDS) {
      expect(eInvoiceCopyParagraph(kind, 'fr-CH')?.runs).toEqual([{ text: E_INVOICE_COPY_LABELS[kind].fr }])
      expect(eInvoiceCopyParagraph(kind, 'FR')?.runs).toEqual([{ text: E_INVOICE_COPY_LABELS[kind].fr }])
      expect(eInvoiceCopyParagraph(kind, 'en-IE')?.runs).toEqual([{ text: E_INVOICE_COPY_LABELS[kind].en }])
      expect(eInvoiceCopyParagraph(kind, 'pl-PL')).toBeUndefined()
      // A language is found by the list, never by a lookup that finds 'constructor' on every object.
      expect(eInvoiceCopyParagraph(kind, 'constructor')).toBeUndefined()
      expect(eInvoiceCopyParagraph(kind, '')).toBeUndefined()
    }
  })

  // An engine holds a copy to the paragraph the runtime writes, style and
  // all, as the renderer holds an XRechnung's (0038): small, bold and red,
  // the one run. Frozen, so that a host cannot change what a file is held to.
  test('is a paragraph in the style every label of the runtime is printed in, frozen', () => {
    const paragraph = eInvoiceCopyParagraph('facturX', 'en') as Paragraph
    expect(paragraph).toEqual({ ...XRECHNUNG_COPY_PARAGRAPH, runs: [{ text: E_INVOICE_COPY_LABELS.facturX.en }] })
    for (const part of [paragraph, paragraph.runs, paragraph.runs[0], paragraph.style]) expect(Object.isFrozen(part)).toBe(true)
    expect(eInvoiceCopyParagraph('facturX', 'en-GB')).toBe(paragraph)
    for (const labels of Object.values(E_INVOICE_COPY_LABELS)) expect(Object.isFrozen(labels)).toBe(true)
    expect(Object.isFrozen(E_INVOICE_COPY_LABELS)).toBe(true)
    expect(runtime.E_INVOICE_COPY_LABELS).toBe(E_INVOICE_COPY_LABELS)
    expect(runtime.eInvoiceCopyParagraph).toBe(eInvoiceCopyParagraph)
    expect(runtime.readCopyLabel).toBe(readCopyLabel)
    expect(runtime.E_INVOICE_COPY_LANGUAGES).toBe(E_INVOICE_COPY_LANGUAGES)
  })
})

describe('a header read for the label of a copy', () => {
  const label = eInvoiceCopyParagraph('xrechnung', 'it') as Paragraph
  const other: Block = { kind: 'paragraph', runs: [{ text: 'Rechnung' }] }

  // What an engine asks of a header: whether it opens with a copy's label,
  // of which kind and language, and whether as the runtime writes it.
  test('finds the label a header opens with, its kind and its language', () => {
    expect(readCopyLabel([{ ...label }, other])).toEqual({ kind: 'xrechnung', language: 'it', paragraph: label, asWritten: true })
    expect(readCopyLabel([{ ...label }, other])?.paragraph).toBe(label)
    expect(readCopyLabel([eInvoiceCopyParagraph('facturX', 'nl') as Paragraph])).toMatchObject({ kind: 'facturX', language: 'nl', asWritten: true })
  })

  // A label below another block heads nothing, and no header is none.
  test('finds none where a header opens with anything else', () => {
    expect(readCopyLabel([])).toBeUndefined()
    expect(readCopyLabel([other, label])).toBeUndefined()
    expect(readCopyLabel([XRECHNUNG_COPY_PARAGRAPH])).toBeUndefined()
    expect(readCopyLabel([{ kind: 'spacer', height: 4 }])).toBeUndefined()
    // The words among other runs are a sentence of the report's, not the label.
    expect(readCopyLabel([{ ...label, runs: [...label.runs, { text: '!' }] }])).toBeUndefined()
    expect(readCopyLabel([{ ...label, runs: [{ field: 'pageNumber' }] }])).toBeUndefined()
  })

  // The words in white, at one point, light, or beside a property the
  // runtime does not write are the label's text and say nothing to a
  // reader. They are found, so that an engine can refuse them, and said
  // not to be as written.
  test('says where the words are printed otherwise than the runtime writes them', () => {
    const altered: Paragraph[] = [
      { ...label, style: { ...label.style, color: '#ffffff' } },
      { ...label, style: { ...label.style, size: 1 } },
      { ...label, style: { size: 8, color: '#b00020' } },
      { ...label, style: { ...label.style, italic: true } },
      { kind: 'paragraph', runs: label.runs },
      // A style that is no style at all: a list where the runtime writes an object.
      { ...label, style: [] as unknown as NonNullable<Paragraph['style']> },
      { ...label, keepWithNext: true },
      { ...label, runs: [{ text: label.runs[0] && 'text' in label.runs[0] ? label.runs[0].text : '', baseline: 'subscript' }] },
    ]
    for (const paragraph of altered) expect(readCopyLabel([paragraph])).toMatchObject({ kind: 'xrechnung', language: 'it', asWritten: false })
  })
})
