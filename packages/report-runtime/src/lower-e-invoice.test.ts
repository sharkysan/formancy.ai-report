import { emptyReport, FACTUR_X, FACTUR_X_PROFILES } from '@formancy/report-spec'
import type { Component, EInvoice, EpcQrCodeComponent, FieldRef, Inline, ReportDefinition, SwissQrBill } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { ReportData } from './data.js'
import type { Block, Paragraph } from './document.js'
import * as runtime from './index.js'
import { eInvoiceFile } from './lower-e-invoice.js'
import type { ResolvedInvoice } from './lower-e-invoice.js'
import type { Render } from './render-context.js'
import { E_INVOICE_PREVIEW_LABEL, PREVIEW_LABEL, resolveReport } from './resolve.js'
import type { Resolution, ResolveOptions } from './resolve.js'
import { Problems } from './resolve-errors.js'
import type { RuntimeError } from './resolve-errors.js'
import { invoiceData, invoiceReport, invoiceRow } from './test-support.js'

/**
 * A report's e-invoice resolved: its file in a final render, named as
 * report-spec names it; none in a preview, which says so on every page;
 * the totals the page prints, the very values the XML holds; and a payment
 * code printed with it held to its amount due and its account.
 */

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const said = (text: string): readonly Inline[] => [{ kind: 'text', text }]

const FINAL: ResolveOptions = { mode: 'final', creationDate: '2026-10-17T08:00:00Z' }
const PREVIEW: ResolveOptions = { ...FINAL, mode: 'preview' }

function resolved(report: ReportDefinition, data: ReportData, options: ResolveOptions = FINAL): Extract<Resolution, { ok: true }> {
  const outcome = resolveReport(report, data, options)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome
}

function refused(report: ReportDefinition, data: ReportData, options: ResolveOptions = FINAL): readonly RuntimeError[] {
  const outcome = resolveReport(report, data, options)
  if (outcome.ok) throw new Error('resolved, and was expected to be refused')
  return outcome.errors
}

const text = (block: Block | undefined): string => (block?.kind === 'paragraph' ? block.runs.map((run) => ('text' in run ? run.text : '')).join('') : '')

/** Every value of the element `name` in `xml`, in order. */
const values = (xml: string, name: string): string[] =>
  [...xml.matchAll(new RegExp(`<${name}(?: [^>]*)?>([^<]*)</${name}>`, 'g'))].map((match) => match[1] as string)

const LINES = [
  invoiceRow(),
  invoiceRow({ position: '2', item: 'Brot', quantity: '3', unit: 'KGM', price: '2.99', amount: '8.97', vat: 'reduced' }),
  invoiceRow({ position: '3', item: 'Beratung', quantity: '1', unit: 'HUR', price: '80.00', amount: '80.00', vat: 'exempt' }),
]

describe("a final render's e-invoice", () => {
  // The document carries the file the renderer embeds, named by
  // report-spec's constants, which the runtime hands on: one decision for
  // the name, the relationship and the conformance level, never an
  // engine's own [S]; and its kind, which says it is embedded at all (an
  // XRechnung's is not, xrechnung.test.ts).
  test('is the XML, named as report-spec names it', () => {
    const file = resolved(invoiceReport(), invoiceData(LINES)).document.eInvoice
    expect(file).toEqual({
      kind: 'facturX',
      xml: expect.stringMatching(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<rsm:CrossIndustryInvoice /),
      fileName: 'factur-x.xml',
      relationship: 'Alternative',
      conformanceLevel: 'EN 16931',
    })
    expect(file?.kind === 'facturX' && file.fileName).toBe(FACTUR_X.fileName)
    expect(file?.kind === 'facturX' && file.conformanceLevel).toBe(FACTUR_X_PROFILES.en16931.conformanceLevel)
    expect(runtime.FACTUR_X).toBe(FACTUR_X)
    expect(runtime.FACTUR_X_PROFILES).toBe(FACTUR_X_PROFILES)
  })

  // What the page prints is what the XML holds: each total the summary
  // prints is formatted from the very value the XML is written from, so a
  // reader and a buyer's system see one invoice. A category no line is in
  // has no breakdown in the XML, and its row is hidden on the page.
  test('holds the totals the page prints, and no breakdown where the page prints none', () => {
    const resolution = resolved(invoiceReport(), invoiceData(LINES))
    const xml = resolution.document.eInvoice?.xml ?? ''
    const printed = resolution.document.body.filter((block): block is Paragraph => block.kind === 'paragraph').map(text)
    const euro = (amount: string): string => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount as Intl.StringNumericLiteral)
    const [basis = '', vat = '', grand = ''] = [
      values(xml, 'ram:TaxBasisTotalAmount')[0],
      values(xml, 'ram:TaxTotalAmount')[0],
      values(xml, 'ram:GrandTotalAmount')[0],
    ]
    expect([basis, vat, grand]).toEqual(['113.97', '5.38', '119.35'])
    expect(printed).toEqual(expect.arrayContaining([`Netto ${euro(basis)}`, `MwSt. ${euro(vat)}`, `Brutto ${euro(grand)}`]))
    expect(values(xml, 'ram:BasisAmount')).toEqual(['25.00', '8.97', '80.00'])
    expect(values(xml, 'ram:CalculatedAmount')).toEqual(['4.75', '0.63', '0.00'])
    expect(printed).toEqual(
      expect.arrayContaining([
        `standard ${euro('25.00')}: ${euro('4.75')}`,
        `reduced ${euro('8.97')}: ${euro('0.63')}`,
        `exempt ${euro('80.00')}: ${euro('0.00')}`,
      ]),
    )
    const only = resolved(invoiceReport(), invoiceData([invoiceRow()]))
    expect(
      only.document.body
        .filter((block): block is Paragraph => block.kind === 'paragraph')
        .map(text)
        .filter((line) => /^(standard|reduced|exempt) /.test(line)),
    ).toEqual([`standard ${euro('25.00')}: ${euro('4.75')}`])
    expect(values(only.document.eInvoice?.xml ?? '', 'ram:CategoryCode')).toEqual(['S', 'S'])
  })

  // The same report over the same data is the same file, byte for byte: no
  // clock, no machine, no order but the template's and the table's.
  test('is the same bytes for the same report and data', () => {
    expect(resolved(invoiceReport(), invoiceData(LINES)).document.eInvoice?.xml).toBe(resolved(invoiceReport(), invoiceData(LINES)).document.eInvoice?.xml)
  })

  // A report that is no e-invoice carries none, and a preview of it with
  // complete data is not labelled: the e-invoice changes nothing else.
  test('is absent from a report that is none', () => {
    const report = { ...invoiceReport() }
    const { eInvoice: _invoice, ...plain } = report
    const summary = plain.regions.summary
      .filter((component) => component.id === 'gross')
      .map((component) => ({ ...component, content: said('Brutto') }) as Component)
    const none = { ...plain, regions: { ...plain.regions, summary } }
    expect(resolved(none, invoiceData()).document.eInvoice).toBeUndefined()
    const preview = resolved(none, invoiceData(), PREVIEW)
    expect(preview.warnings).toEqual([])
    expect(preview.document.pageHeader).toEqual([])
  })
})

describe('a preview of an e-invoice', () => {
  // In Germany the XML a hybrid invoice embeds is the invoice. A preview
  // writes none, and says so whatever its data: a complete preview looks
  // like the invoice, and would otherwise carry no label at all. With
  // nothing else lacking, the label says it is no e-invoice; with data
  // lacking, the label every preview of incomplete data carries.
  test('writes no XML, warns that it is none, and labels every page', () => {
    const complete = resolved(invoiceReport(), invoiceData(LINES), PREVIEW)
    expect(complete.document.eInvoice).toBeUndefined()
    expect(complete.warnings).toEqual([
      {
        stage: 'resolve',
        code: 'e-invoice-preview',
        path: '/eInvoice',
        message: expect.stringMatching(/^the e-invoice: this is a preview, which writes no e-invoice/),
      },
    ])
    expect(text(complete.document.pageHeader[0])).toBe(E_INVOICE_PREVIEW_LABEL)
    expect(runtime.E_INVOICE_PREVIEW_LABEL).toBe(E_INVOICE_PREVIEW_LABEL)
    const lacking = resolved(invoiceReport(), { ...invoiceData(LINES), completeness: { complete: false, captured: 3 } }, PREVIEW)
    expect(text(lacking.document.pageHeader[0])).toBe(PREVIEW_LABEL)
    expect(lacking.document.pageHeader).toHaveLength(1)
  })

  // Its totals are those of what it has, printed as a final render's are.
  test('prints the totals of what it has', () => {
    const preview = resolved(invoiceReport(), invoiceData(LINES), PREVIEW)
    expect(preview.document.body.filter((block): block is Paragraph => block.kind === 'paragraph').map(text)).toContain(
      `Brutto ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format('119.35')}`,
    )
  })
})

/** The invoice report, a paid amount declared and printed, and `components` added to its summary. */
function paying(...components: Component[]): ReportDefinition {
  const report = invoiceReport()
  const own = report.datasets.header as NonNullable<ReportDefinition['datasets']['header']>
  const printed: Component = {
    id: 'paid',
    kind: 'text',
    content: [
      { kind: 'expression', expression: { cel: 'invoice.paid' } },
      { kind: 'expression', expression: { cel: 'invoice.duePayable' } },
    ],
  }
  return {
    ...report,
    datasets: {
      ...report.datasets,
      header: {
        ...own,
        fields: [...own.fields, { id: 'paid', type: 'decimal', label: 'Paid', nullable: true }, { id: 'iban', type: 'string', label: 'IBAN', nullable: true }],
      },
    },
    regions: { ...report.regions, summary: [...report.regions.summary, printed, ...components] },
    eInvoice: { ...(report.eInvoice as EInvoice), paid: { cel: 'header.paid' } },
  }
}

/** Data for `paying`: the invoice's, its paid amount and its account none unless `values` gives them. */
const payData = (values: Record<string, unknown> = {}): ReportData => invoiceData(undefined, { paid: null, iban: null, ...values })

const epc = (patch: Partial<EpcQrCodeComponent> = {}): EpcQrCodeComponent => ({
  id: 'pay-code',
  kind: 'epcQrCode',
  size: 85.04,
  beneficiary: said('Muster & Söhne GmbH'),
  iban: said('DE83 0123 4567 0012 3456 78'),
  amount: { cel: 'invoice.duePayable' },
  ...patch,
})

describe('a payment code printed with an e-invoice', () => {
  // A code that asks for another amount than the amount due, or to another
  // account than the e-invoice's, makes a page that is another invoice
  // than its XML (§ 14c UStG). The amount is always an expression, so the
  // runtime compares it once both have resolved; an account read from the
  // data, too. Neither value is quoted.
  test('asks for the amount due, or leaves the amount to the payer', () => {
    expect(resolved(paying(epc()), payData({ paid: '10.00' })).document.body.some((block) => block.kind === 'epcQrCode')).toBe(true)
    const { amount: _amount, ...open } = epc()
    expect(resolved(paying(open), payData({ paid: '10.00' })).document.body.some((block) => block.kind === 'epcQrCode')).toBe(true)
    const errors = refused(paying(epc({ amount: { cel: 'invoice.grandTotal' } })), payData({ paid: '10.00' }))
    expect(errors).toEqual([
      {
        stage: 'resolve',
        code: 'invalid-e-invoice',
        path: '/regions/summary/7/amount',
        componentId: 'pay-code',
        message:
          "component pay-code: the EPC QR code asks for another amount than the e-invoice's amount due for payment (BT-115): a page and its XML ask for one amount",
      },
    ])
  })

  test("asks to be paid to the e-invoice's account, as its own rule writes it", () => {
    const report = paying(epc({ iban: [{ kind: 'field', field: header('iban') }] }))
    expect(resolved(report, payData({ iban: 'de83012345670012345678' })).document.eInvoice).toBeDefined()
    expect(refused(report, payData({ iban: 'DE89 3704 0044 0532 0130 00' }))).toEqual([
      expect.objectContaining({
        code: 'invalid-e-invoice',
        path: '/regions/summary/7/iban',
        message: expect.stringMatching(/another account than the e-invoice's payment account \(BT-84\)/),
      }),
    ])
  })

  // A QR-bill in euro is held the same way: its amount and its account.
  test('is the QR-bill as well as an EPC QR code', () => {
    const account = 'CH93 0076 2011 6238 5295 7'
    const bill: SwissQrBill = {
      kind: 'swissQrBill',
      language: 'de',
      account: said(account),
      creditor: { name: said('Muster & Söhne GmbH'), postalCode: said('8000'), town: said('Zürich'), country: said('CH') },
      currency: 'EUR',
      amount: { cel: 'invoice.duePayable' },
    }
    const base = paying()
    const invoice = { ...(base.eInvoice as EInvoice), payment: { means: '58' as const, iban: said(account) } }
    expect(resolved({ ...base, eInvoice: invoice, paymentPart: bill }, payData()).document.paymentPart?.amount).toBe('29.75')
    expect(refused({ ...base, eInvoice: invoice, paymentPart: { ...bill, amount: { cel: 'invoice.taxBasisTotal' } } }, payData())).toEqual([
      expect.objectContaining({
        code: 'invalid-e-invoice',
        path: '/paymentPart/amount',
        message: expect.stringMatching(/^the payment part: the QR-bill asks for another amount than/),
      }),
    ])
  })

  // Outside an e-invoice a code asks for what its template says: nothing
  // here holds it to totals no report has.
  test('is held to nothing in a report that is no e-invoice', () => {
    const report = { ...emptyReport('codes', 'Codes', 'de-DE') }
    const code = epc({ amount: { cel: 'dec("12.30")' } })
    const plain = { ...report, regions: { ...report.regions, summary: [code] } }
    expect(resolved(plain, { completeness: { complete: true, captured: 0 }, consistency: 'host-captured' }).document.body).toHaveLength(1)
  })
})

describe('the runtime hands on', () => {
  // The renderer depends on the runtime alone, and embeds by report-spec's
  // decisions, never its own: the file's name and media type, the XMP's
  // namespace, prefix, document type and version, and each profile's
  // conformance level and relationship.
  test("report-spec's Factur-X constants, as they are", () => {
    expect(runtime.FACTUR_X).toEqual({
      fileName: 'factur-x.xml',
      mediaType: 'text/xml',
      xmpNamespace: 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#',
      xmpPrefix: 'fx',
      documentType: 'INVOICE',
      version: '1.0',
    })
  })
})

describe('a final render that resolved no XML', () => {
  // A final render writes the XML or refuses. Every way its terms or its
  // lines fail to resolve records an error first, so the document is
  // refused; one that recorded none and handed on a document without its
  // XML would be drawn by a renderer as a plain PDF, which in Germany is a
  // picture of an invoice handed over as though it were one. So it is a
  // defect, and throws.
  test('throws where nothing says why, and is refused where something does', () => {
    const invoice = invoiceReport().eInvoice as EInvoice
    const nothing = {
      reads: { names: {}, columns: new Map(), payable: { amount: undefined, account: undefined } },
      written: undefined,
    } as unknown as ResolvedInvoice
    const final = { preview: false, problems: new Problems() } as unknown as Render
    expect(() => eInvoiceFile(final, nothing, invoice)).toThrow(
      new RangeError('a final render of an e-invoice wrote no XML and recorded no reason: a defect, refused rather than drawn as a plain PDF'),
    )
    const said = new Problems()
    said.error({ stage: 'resolve', code: 'invalid-e-invoice', path: '/eInvoice/number', message: 'the e-invoice: refused' })
    expect(eInvoiceFile({ preview: false, problems: said } as unknown as Render, nothing, invoice)).toBeUndefined()
  })
})
