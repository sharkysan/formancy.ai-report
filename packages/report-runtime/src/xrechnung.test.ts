import { XRECHNUNG } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { ReportData } from './data.js'
import type { Block } from './document.js'
import * as runtime from './index.js'
import { E_INVOICE_PREVIEW_LABEL, resolveReport, XRECHNUNG_COPY_LABEL, XRECHNUNG_COPY_PARAGRAPH } from './resolve.js'
import type { Resolution, ResolveOptions } from './resolve.js'
import type { RuntimeError } from './resolve-errors.js'
import { invoiceData, invoiceReport, invoiceRow, xrechnungData, xrechnungReport } from './test-support.js'

/**
 * An XRechnung resolved (0038): its XML in a final render, standalone and
 * named by its syntax, guideline and version, for a host to take; the
 * same writer and the same terms as a Factur-X invoice, BT-24 apart; every
 * page labelled as the copy; and what XRechnung needs held where the data
 * gives it.
 */

const FINAL: ResolveOptions = { mode: 'final', creationDate: '2026-10-17T08:00:00Z' }
const PREVIEW: ResolveOptions = { ...FINAL, mode: 'preview' }

function resolved(report: ReportDefinition, data: ReportData, options: ResolveOptions = FINAL): Extract<Resolution, { ok: true }> {
  const outcome = resolveReport(report, data, options)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome
}

/** Each error a resolution is refused with, as its code, its path and its message. */
function refused(report: ReportDefinition, data: ReportData, options: ResolveOptions = FINAL): string[] {
  const outcome = resolveReport(report, data, options)
  if (outcome.ok) throw new Error('resolved, and was expected to be refused')
  return outcome.errors.map(({ code, path, message }: RuntimeError) => `${code} ${path} ${message}`)
}

const text = (block: Block | undefined): string => (block?.kind === 'paragraph' ? block.runs.map((run) => ('text' in run ? run.text : '')).join('') : '')

/** Every value of the element `name` in `xml`, in order. */
const values = (xml: string, name: string): string[] => [...xml.matchAll(new RegExp(`<${name}(?: [^>]*)?>([^<]*)</${name}>`, 'g'))].map((match) => match[1] as string)

const LINES = [invoiceRow(), invoiceRow({ position: '2', item: 'Brot', quantity: '3', unit: 'KGM', price: '2.99', amount: '8.97', vat: 'reduced' })]

describe("a final render's XRechnung", () => {
  // A host takes the XML from the resolved document and sends it: XRechnung
  // is XML, which the federal portals take alone. The file says what it is
  // -- its kind, its syntax, its guideline and its version -- and nothing a
  // PDF embeds it as: no file name, no relationship, no conformance level,
  // which would make a renderer draw a hybrid nobody asked for.
  test('is its XML, named by its syntax, guideline and version, for a host to take', () => {
    const file = resolved(xrechnungReport(), xrechnungData(LINES)).document.eInvoice
    expect(file).toEqual({ kind: 'xrechnung', xml: expect.stringMatching(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<rsm:CrossIndustryInvoice /), syntax: 'cii', guideline: XRECHNUNG['3.0'].guideline, version: '3.0' })
    expect(values(file?.xml ?? '', 'ram:ID')[1]).toBe('urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0')
    expect(runtime.XRECHNUNG).toBe(XRECHNUNG)
    const facturX = resolved(invoiceReport(), invoiceData(LINES)).document.eInvoice
    expect(facturX).toMatchObject({ kind: 'facturX', fileName: 'factur-x.xml', relationship: 'Alternative', conformanceLevel: 'EN 16931' })
  })

  // One writer of one invoice: the XML of an XRechnung is the XML of the
  // same terms as a Factur-X invoice, byte for byte, but for BT-24, which
  // says which rules it follows. A second writer, or a second reading of
  // the terms, would be two invoices nobody compared.
  test('is the XML a Factur-X invoice of the same terms is, BT-24 apart', () => {
    const report = xrechnungReport()
    const { kind: _kind, version: _version, ...terms } = report.eInvoice as Extract<ReportDefinition['eInvoice'], { kind: 'xrechnung' }>
    const asFacturX = { ...report, eInvoice: { kind: 'facturX', profile: 'en16931', ...terms } } as ReportDefinition
    const xrechnung = resolved(report, xrechnungData(LINES)).document.eInvoice?.xml ?? ''
    const facturX = resolved(asFacturX, xrechnungData(LINES)).document.eInvoice?.xml ?? ''
    expect(xrechnung).not.toBe(facturX)
    expect(xrechnung).toBe(facturX.replace('<ram:ID>urn:cen.eu:en16931:2017</ram:ID>', `<ram:ID>${XRECHNUNG['3.0'].guideline}</ram:ID>`))
    expect(values(xrechnung, 'ram:BuyerReference')).toEqual(['991-33333TEST-33'])
  })

  // The PDF of an XRechnung is a copy: the invoice is the XML. Every page
  // says so, at the top of its page header, as a preview's does, so that
  // a picture printed or passed on is never taken for the invoice. A
  // Factur-X invoice's final render is the invoice, and carries no label.
  test('labels every page as the copy whose invoice is the XML', () => {
    const resolution = resolved(xrechnungReport(), xrechnungData(LINES))
    expect(text(resolution.document.pageHeader[0])).toBe(XRECHNUNG_COPY_LABEL)
    expect(XRECHNUNG_COPY_LABEL).toBe('Copy of an XRechnung: the invoice is its XML, and this PDF is not the invoice')
    expect(runtime.XRECHNUNG_COPY_LABEL).toBe(XRECHNUNG_COPY_LABEL)
    expect(resolution.warnings).toEqual([])
    expect(resolved(invoiceReport(), invoiceData(LINES)).document.pageHeader).toEqual([])
  })

  // The renderer refuses a copy whose page header does not open with the
  // label as the runtime writes it, its style and all: a label in white,
  // or at one point, is the text and says nothing to a reader. So the
  // runtime hands on the paragraph itself, the one it heads every page
  // with, pinned whole here, and frozen, so that a host that changed it
  // would not change what the renderer holds a copy to.
  test('hands on the paragraph it labels the copy with, as it writes it', () => {
    const [first] = resolved(xrechnungReport(), xrechnungData(LINES)).document.pageHeader
    expect(first).toEqual(XRECHNUNG_COPY_PARAGRAPH)
    expect(XRECHNUNG_COPY_PARAGRAPH).toEqual({ kind: 'paragraph', runs: [{ text: XRECHNUNG_COPY_LABEL }], style: { size: 8, bold: true, color: '#b00020' } })
    expect(runtime.XRECHNUNG_COPY_PARAGRAPH).toBe(XRECHNUNG_COPY_PARAGRAPH)
    for (const part of [XRECHNUNG_COPY_PARAGRAPH, XRECHNUNG_COPY_PARAGRAPH.runs, XRECHNUNG_COPY_PARAGRAPH.runs[0], XRECHNUNG_COPY_PARAGRAPH.style]) expect(Object.isFrozen(part)).toBe(true)
    // The document's own paragraph is another object: a host may build on a resolved document as it likes.
    expect(first).not.toBe(XRECHNUNG_COPY_PARAGRAPH)
    // The preview's label is printed in the same style, from the same place.
    const [preview] = resolved(xrechnungReport(), xrechnungData(LINES), PREVIEW).document.pageHeader
    expect(preview).toEqual({ ...XRECHNUNG_COPY_PARAGRAPH, runs: [{ text: E_INVOICE_PREVIEW_LABEL }] })
  })

  // A preview of an XRechnung is no XRechnung either: it writes no XML,
  // warns, and carries the preview's label, as a Factur-X preview does.
  test('is none in a preview, which says so on every page', () => {
    const preview = resolved(xrechnungReport(), xrechnungData(LINES), PREVIEW)
    expect(preview.document.eInvoice).toBeUndefined()
    expect(preview.warnings.map(({ code }) => code)).toEqual(['e-invoice-preview'])
    expect(preview.document.pageHeader.map(text)).toEqual([E_INVOICE_PREVIEW_LABEL])
  })
})

describe('what an XRechnung needs, as the data gives it', () => {
  // The validator holds a literal; what the data gives is held here, by
  // the same rules. The buyer's reference read from data that gives none
  // would be an XRechnung without BT-10, which KoSIT refuses (BR-DE-15),
  // and the same address read as the buyer's electronic address one
  // without BT-49 (PEPPOL-EN16931-R010).
  test('refuses a needed term the data gives as nothing, by its rule', () => {
    expect(refused(xrechnungReport(), xrechnungData(LINES, { leitwegId: null }))).toEqual([
      "invalid-e-invoice /eInvoice/buyer/electronicAddress/id the e-invoice: the buyer's electronic address (BT-49) is empty, and an XRechnung needs it (XRechnung's PEPPOL-EN16931-R010)",
      "invalid-e-invoice /eInvoice/buyerReference the e-invoice: the buyer's reference (BT-10) is empty, and an XRechnung needs it (XRechnung's BR-DE-15)",
    ])
  })

  // A Factur-X invoice leaves out a contact the data gives none of; an
  // XRechnung needs it (BR-DE-2), and each of its terms (BR-DE-5 to -7),
  // so each is refused by the rule that needs it.
  test("refuses a seller's contact the data gives none of, each term by its rule", () => {
    const report = xrechnungReport()
    const invoice = report.eInvoice as Extract<ReportDefinition['eInvoice'], { kind: 'xrechnung' }>
    const fromData = (field: string) => [{ kind: 'field', field: { dataset: 'header', field } }] as const
    const contacted = { ...report, eInvoice: { ...invoice, seller: { ...invoice.seller, contact: { name: fromData('number'), telephone: fromData('buyerVatId'), email: fromData('street') } } } } as ReportDefinition
    expect(refused(contacted, xrechnungData(LINES, { number: null, buyerVatId: null, street: null })).filter((error) => error.includes('/contact/'))).toEqual([
      "invalid-e-invoice /eInvoice/seller/contact/name the e-invoice: the seller's contact point (BT-41) is empty, and an XRechnung needs it (XRechnung's BR-DE-5)",
      "invalid-e-invoice /eInvoice/seller/contact/telephone the e-invoice: the seller's contact telephone number (BT-42) is empty, and an XRechnung needs it (XRechnung's BR-DE-6)",
      "invalid-e-invoice /eInvoice/seller/contact/email the e-invoice: the seller's contact email address (BT-43) is empty, and an XRechnung needs it (XRechnung's BR-DE-7)",
    ])
  })

  // The payment terms read from data are held to BR-DE-18 as a literal
  // is: a Skonto line the data puts in an XRechnung's terms is refused,
  // and a Factur-X invoice's terms are free text.
  test('refuses payment terms the data gives a line led by #', () => {
    const withTerms = (report: ReportDefinition): ReportDefinition => ({ ...report, eInvoice: { ...report.eInvoice, terms: [{ kind: 'text', text: 'Zahlbar binnen 14 Tagen.\n' }, { kind: 'field', field: { dataset: 'header', field: 'buyer' } }] } } as ReportDefinition)
    const skonto = { buyer: '#SKONTO#TAGE=14#PROZENT=2.00#' }
    expect(refused(withTerms(xrechnungReport()), xrechnungData(LINES, skonto))).toEqual([
      "invalid-e-invoice /eInvoice/terms the e-invoice: the payment terms (BT-20) hold a line that begins with #, which XRechnung reads as a Skonto line of its own syntax, and this release writes none: a discount is said in words (XRechnung's BR-DE-18)",
    ])
    expect(values(resolved(withTerms(invoiceReport()), invoiceData(LINES, skonto)).document.eInvoice?.xml ?? '', 'ram:Description')).toEqual(['Zahlbar binnen 14 Tagen.\n#SKONTO#TAGE=14#PROZENT=2.00#'])
  })

  // An electronic address under 0204 is a Leitweg-ID, whatever the kind:
  // one the data gives with wrong check digits would route the invoice
  // nowhere, and no validator of the gate's sees it.
  test('refuses a Leitweg-ID under 0204 the data gives with wrong check digits', () => {
    expect(refused(xrechnungReport(), xrechnungData(LINES, { leitwegId: '991-33333TEST-34' }))).toEqual([
      "invalid-e-invoice /eInvoice/buyer/electronicAddress/id the e-invoice: the buyer's electronic address (BT-49) is under 0204, a Leitweg-ID, and has check digits that do not match the rest of it (the Leitweg-ID's check digits, ISO/IEC 7064 MOD 97-10)",
    ])
    expect(resolved(xrechnungReport(), xrechnungData(LINES, { leitwegId: '04011000-12345-03' })).document.eInvoice?.xml).toContain('<ram:URIID schemeID="0204">04011000-12345-03</ram:URIID>')
  })
})
