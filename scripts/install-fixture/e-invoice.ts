/*
 * An e-invoice (0027, 0031), from the packed packages under Node: validated,
 * resolved to its CII XML and drawn as a PDF/A-3b that embeds it, and its
 * preview drawn embedding nothing; and the same invoice as an XRechnung
 * (0038), its XML taken from the resolved document and its copy drawn as a
 * plain PDF labelled on every page. consume.ts runs it where these checks
 * stood, on its own report's page, and prints what it returns. It lives
 * apart because it changes when the e-invoice does -- a term, a profile, a
 * format -- and the rest of consume.ts does not.
 */
import { ADDRESS_SCHEMES, FACTUR_X, FACTUR_X_PROFILES, REPORT_SPEC_VERSION, validateReport, XRECHNUNG, XRECHNUNG_PATTERNS } from '@formancy/report-spec'
import type {
  AddressScheme,
  FacturXInvoice,
  ReportDefinition,
  ReportError,
  ReportValidation,
  SellerContact,
  TableComponent,
  TextComponent,
  XRechnungInvoice,
} from '@formancy/report-spec'
import { resolveReport } from '@formancy/report-runtime'
import {
  E_INVOICE_PREVIEW_LABEL,
  FACTUR_X as RUNTIME_FACTUR_X,
  FACTUR_X_PROFILES as RUNTIME_FACTUR_X_PROFILES,
  XRECHNUNG as RUNTIME_XRECHNUNG,
  XRECHNUNG_COPY_LABEL,
  XRECHNUNG_COPY_PARAGRAPH,
} from '@formancy/report-runtime'
import type { EInvoiceFile, Paragraph, ReportData, Resolution } from '@formancy/report-runtime'
import { renderPdf } from '@formancy/report-render-pdf'
import { readEmbedding } from './embedding.js'
import type { Embedding } from './embedding.js'

const text = (value: string): [{ kind: 'text'; text: string }] => [{ kind: 'text', text: value }]

/** Checks an e-invoice on `page`, consume.ts's report's, from the packed packages; throws on the first wrong, and says what held. */
export async function drawnEInvoice(page: ReportDefinition['page']): Promise<string> {
  // An e-invoice (0027): a German invoice of its own, since the corpus's
  // samples are never packed, whose two lines are at 19 % and at 7 %. The
  // runtime computes its totals once, for the page and for the CII XML it
  // writes, and the renderer draws it as a PDF/A-3b that embeds that XML
  // (0031). A runtime that lost the XML writer, a renderer that drew the
  // picture without the invoice, or a hand-on of the file's names that is a
  // copy rather than report-spec's own fails here, outside the workspace.
  // The consumer has no XML parser, so the XML is read by its elements'
  // text, which the runtime writes one way.
  const headerField = (field: string): { kind: 'field'; field: { dataset: 'header'; field: string } } => ({
    kind: 'field',
    field: { dataset: 'header', field },
  })
  const lineField = (field: string): { kind: 'field'; field: { dataset: 'detail'; field: string } } => ({ kind: 'field', field: { dataset: 'detail', field } })
  const euro = { kind: 'currency', currency: { kind: 'code', code: 'EUR' }, scale: 2 } as const
  const total = (id: string, label: string, cel: string): TextComponent => ({
    id,
    kind: 'text',
    content: [
      { kind: 'text', text: label },
      { kind: 'expression', expression: { cel }, format: euro },
    ],
  })
  const invoiceBlock: FacturXInvoice = {
    kind: 'facturX',
    profile: 'en16931',
    type: '380',
    currency: 'EUR',
    number: [headerField('number')],
    issued: { cel: 'header.issuedOn' },
    seller: {
      name: text('Formancy Haustechnik GmbH'),
      vatId: text('DE123456789'),
      address: { line1: text('Industriestraße 7'), postalCode: text('50735'), city: text('Köln'), country: text('DE') },
    },
    buyer: {
      name: [headerField('customer')],
      address: { line1: [headerField('street')], postalCode: [headerField('postcode')], city: [headerField('city')], country: text('DE') },
    },
    delivered: { cel: 'header.servedOn' },
    vat: [
      { id: 'standard', code: 'S', rate: '19' },
      { id: 'reduced', code: 'S', rate: '7' },
    ],
    lines: {
      table: 'positions',
      name: 'item',
      quantity: 'quantity',
      netPrice: 'price',
      netAmount: 'amount',
      id: lineField('article'),
      unit: lineField('unitCode'),
      vat: lineField('vat'),
    },
    payment: { means: '58', iban: text('DE83 0123 4567 0012 3456 78'), bic: text('FMNCDEF0XXX') },
  }
  const positions: TableComponent = {
    id: 'positions',
    kind: 'table',
    dataset: 'detail',
    columns: [
      { id: 'item', header: 'Leistung', width: 'fill', align: 'left', value: lineField('item') },
      { id: 'quantity', header: 'Menge', width: 60, align: 'right', value: lineField('quantity') },
      { id: 'price', header: 'Einzelpreis', width: 80, align: 'right', value: { ...lineField('price'), format: euro } },
      { id: 'amount', header: 'Betrag', width: 80, align: 'right', value: { ...lineField('amount'), format: euro } },
    ],
    emptyText: 'Keine Positionen.',
    repeatHeader: true,
  }
  const invoiced: ReportDefinition = {
    reportSpecVersion: REPORT_SPEC_VERSION,
    id: 'install-e-invoice',
    title: 'Rechnung',
    locale: 'de-DE',
    page,
    styles: [],
    datasets: {
      header: {
        id: 'invoice',
        fields: [
          { id: 'number', type: 'string', label: 'Rechnungsnummer', nullable: false },
          { id: 'issuedOn', type: 'date', label: 'Rechnungsdatum', nullable: false },
          { id: 'servedOn', type: 'date', label: 'Leistungsdatum', nullable: false },
          { id: 'customer', type: 'string', label: 'Kunde', nullable: false },
          { id: 'street', type: 'string', label: 'Straße', nullable: false },
          { id: 'postcode', type: 'string', label: 'PLZ', nullable: false },
          { id: 'city', type: 'string', label: 'Ort', nullable: false },
        ],
      },
      detail: {
        id: 'invoice-lines',
        fields: [
          { id: 'article', type: 'string', label: 'Artikel', nullable: false },
          { id: 'item', type: 'string', label: 'Leistung', nullable: false },
          { id: 'quantity', type: 'decimal', label: 'Menge', nullable: false, scale: 2 },
          { id: 'unitCode', type: 'string', label: 'Einheit (UN/ECE)', nullable: false },
          { id: 'price', type: 'decimal', label: 'Einzelpreis', nullable: false, scale: 2 },
          { id: 'amount', type: 'decimal', label: 'Betrag', nullable: false, scale: 2 },
          { id: 'vat', type: 'string', label: 'Umsatzsteuer', nullable: false },
        ],
      },
    },
    parameters: [],
    assets: [],
    aggregates: [],
    regions: {
      reportHeader: [{ id: 'title', kind: 'text', content: [{ kind: 'text', text: 'Rechnung ' }, headerField('number')] }],
      pageHeader: [],
      body: [positions],
      pageFooter: [],
      // Every total the XML holds, printed by the names the runtime binds them to: report-core refuses an e-invoice whose page leaves one out.
      summary: [
        total('net', 'Nettobetrag ', 'invoice.taxBasisTotal'),
        {
          id: 'vat-standard',
          kind: 'text',
          content: [
            { kind: 'text', text: 'Umsatzsteuer 19 % auf ' },
            { kind: 'expression', expression: { cel: 'vatBasis.standard' }, format: euro },
            { kind: 'text', text: ': ' },
            { kind: 'expression', expression: { cel: 'vatAmount.standard' }, format: euro },
          ],
        },
        {
          id: 'vat-reduced',
          kind: 'text',
          content: [
            { kind: 'text', text: 'Umsatzsteuer 7 % auf ' },
            { kind: 'expression', expression: { cel: 'vatBasis.reduced' }, format: euro },
            { kind: 'text', text: ': ' },
            { kind: 'expression', expression: { cel: 'vatAmount.reduced' }, format: euro },
          ],
        },
        total('vat-total', 'Umsatzsteuer gesamt ', 'invoice.taxTotal'),
        total('grand', 'Rechnungsbetrag ', 'invoice.grandTotal'),
      ],
    },
    eInvoice: invoiceBlock,
  }
  const invoiceData: ReportData = {
    header: {
      number: 'RE-2026-0901',
      issuedOn: '2026-10-16',
      servedOn: '2026-10-12',
      customer: 'Gasthaus Zur Linde GmbH',
      street: 'Venloer Straße 210',
      postcode: '50823',
      city: 'Köln',
    },
    detail: [
      { article: 'H-1', item: 'Wartung Gas-Brennwertkessel', quantity: '1.00', unitCode: 'LS', price: '245.00', amount: '245.00', vat: 'standard' },
      { article: 'H-2', item: 'Kaminholz Buche, ofenfertig', quantity: '250.00', unitCode: 'KGM', price: '0.38', amount: '95.00', vat: 'reduced' },
    ],
    completeness: { complete: true, captured: 2 },
    consistency: 'host-captured',
  }
  const invoicedValidation: ReportValidation = validateReport(invoiced)
  if (!invoicedValidation.valid)
    throw new Error(`the e-invoice was refused: ${invoicedValidation.errors.map((error: ReportError) => `${error.code} ${error.path}`).join(', ')}`)
  // 0.1.0's validator refuses the block as unknown-property; this one reads it, and names the rule a literal breaks without quoting it: a seller's country outside the closed list.
  const stuck: ReportValidation = validateReport({
    ...invoiced,
    eInvoice: { ...invoiceBlock, seller: { ...invoiceBlock.seller, address: { ...invoiceBlock.seller.address, country: text('UK') } } },
  })
  if (
    stuck.valid ||
    !stuck.errors.some(
      (error: ReportError) =>
        error.code === 'invalid-e-invoice' &&
        error.path.startsWith('/eInvoice/seller/address/country') &&
        error.message.includes('BR-CL-14') &&
        !error.message.includes('UK'),
    )
  ) {
    throw new Error(
      `a seller's country outside the list was not refused by its rule: ${stuck.valid ? 'valid' : stuck.errors.map((error: ReportError) => `${error.code} ${error.path}`).join(', ')}`,
    )
  }
  // The terms past 0027's (0037), none of which the invoice above needs: each
  // written where it is given, an address under its scheme, and a contact's
  // telephone number held to XRechnung's shape, named by its rule and never
  // by what it says.
  const gln: AddressScheme = '0088'
  if (!ADDRESS_SCHEMES.includes(gln)) throw new Error(`report-spec's address schemes lack the GLN's: ${ADDRESS_SCHEMES.join(', ')}`)
  const contact: SellerContact = {
    name: text('Erika Mustermann'),
    telephone: text('+49 221 4710 820'),
    email: text('e.mustermann@formancy-haustechnik.example'),
  }
  const addressedBlock: FacturXInvoice = {
    ...invoiceBlock,
    businessProcess: text('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'),
    seller: { ...invoiceBlock.seller, electronicAddress: { id: text('rechnung@formancy-haustechnik.example'), scheme: 'EM' }, contact },
    buyer: { ...invoiceBlock.buyer, electronicAddress: { id: text('4012345000009'), scheme: gln } },
  }
  const addressed: Resolution = resolveReport({ ...invoiced, eInvoice: addressedBlock }, invoiceData, { mode: 'final', creationDate: '2026-10-16T08:00:00Z' })
  if (!addressed.ok)
    throw new Error(
      `the e-invoice with every term past 0027's did not resolve: ${addressed.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`,
    )
  const addressedXml = addressed.document.eInvoice?.xml ?? ''
  const terms = [
    '<ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ram:ID>',
    '<ram:URIID schemeID="EM">rechnung@formancy-haustechnik.example</ram:URIID>',
    '<ram:PersonName>Erika Mustermann</ram:PersonName>',
    '<ram:CompleteNumber>+49 221 4710 820</ram:CompleteNumber>',
    '<ram:URIID>e.mustermann@formancy-haustechnik.example</ram:URIID>',
    '<ram:URIID schemeID="0088">4012345000009</ram:URIID>',
  ]
  const unwritten = terms.filter((term) => !addressedXml.includes(term))
  if (unwritten.length > 0) throw new Error(`the e-invoice's XML does not hold the terms past 0027's it was given: ${unwritten.join(', ')}`)
  const unreachable: ReportValidation = validateReport({
    ...invoiced,
    eInvoice: { ...addressedBlock, seller: { ...addressedBlock.seller, contact: { ...contact, telephone: text('Zentrale') } } },
  })
  if (
    unreachable.valid ||
    !unreachable.errors.some(
      (error: ReportError) =>
        error.path === '/eInvoice/seller/contact/telephone' &&
        error.message.includes(`(XRechnung's ${XRECHNUNG_PATTERNS.telephone.rule})`) &&
        !error.message.includes('Zentrale'),
    )
  ) {
    throw new Error(
      `a contact's telephone number of no digits was not refused by XRechnung's rule: ${unreachable.valid ? 'valid' : unreachable.errors.map((error: ReportError) => `${error.code} ${error.path}`).join(', ')}`,
    )
  }
  const invoicedResolution: Resolution = resolveReport(invoiced, invoiceData, { mode: 'final', creationDate: '2026-10-16T08:00:00Z' })
  if (!invoicedResolution.ok)
    throw new Error(`the e-invoice did not resolve: ${invoicedResolution.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
  const file: EInvoiceFile | undefined = invoicedResolution.document.eInvoice
  if (file?.kind !== 'facturX' || !file.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice '))
    throw new Error('a final render of the e-invoice wrote no Factur-X file of CII XML')
  // The file's names reach the renderer through the runtime as report-spec's own, as the QR-bill's rules do: a copy would be a second decision.
  if (RUNTIME_FACTUR_X !== FACTUR_X || RUNTIME_FACTUR_X_PROFILES !== FACTUR_X_PROFILES)
    throw new Error("the runtime does not hand on report-spec's own Factur-X names")
  if (
    file.fileName !== FACTUR_X.fileName ||
    file.conformanceLevel !== FACTUR_X_PROFILES.en16931.conformanceLevel ||
    file.relationship !== FACTUR_X_PROFILES.en16931.relationship
  ) {
    throw new Error(`the e-invoice is named otherwise than report-spec names it: ${file.fileName}, ${file.conformanceLevel}, ${file.relationship}`)
  }
  // Net 340.00; VAT 245.00 x 19 % = 46.55 and 95.00 x 7 % = 6.65, rounded once per category; with VAT 393.20.
  const xmlSays = (element: string): string[] =>
    [...file.xml.matchAll(new RegExp(`<ram:${element}(?: [^>]*)?>([^<]*)</ram:${element}>`, 'g'))].map((match) => match[1] ?? '')
  const written = {
    guideline: xmlSays('ID')[0],
    number: xmlSays('ID')[1],
    basis: xmlSays('BasisAmount'),
    tax: xmlSays('CalculatedAmount'),
    taxTotal: xmlSays('TaxTotalAmount'),
    grandTotal: xmlSays('GrandTotalAmount'),
    due: xmlSays('DuePayableAmount'),
  }
  const expected = {
    guideline: 'urn:cen.eu:en16931:2017',
    number: 'RE-2026-0901',
    basis: ['245.00', '95.00'],
    tax: ['46.55', '6.65'],
    taxTotal: ['53.20'],
    grandTotal: ['393.20'],
    due: ['393.20'],
  }
  if (JSON.stringify(written) !== JSON.stringify(expected)) throw new Error(`the e-invoice's XML does not hold its totals: ${JSON.stringify(written)}`)
  // The page prints the total the XML holds, from the one value the runtime bound.
  const printed = invoicedResolution.document.body
    .filter((block): block is Paragraph => block.kind === 'paragraph')
    .map((block) => block.runs.map((run) => ('text' in run ? run.text : '')).join(''))
  const grandLine = printed.find((line) => line.startsWith('Rechnungsbetrag '))
  if (grandLine === undefined || !grandLine.includes((written.grandTotal[0] ?? '').replace('.', ',')))
    throw new Error(`the page does not print the XML's total: ${String(grandLine)}`)
  // Drawn, it is a PDF/A-3b that embeds the XML as report-spec names the
  // file, as the catalog's /AF and the name tree list it, and says so in its
  // XMP, on the reviewed sRGB profile. The consumer has no PDF reader, so
  // embedding.ts reads PDFKit's bytes. What only this gate sees is the
  // PDFKit a clean npm install gives pdfmake, the one report-render-pdf pins
  // (0036), rather than the workspace's lockfile's, and the profile it reads
  // from its own directory there.
  const invoicePdf = await renderPdf(invoicedResolution.document, { maxPages: 50 })
  const embedding: Embedding = readEmbedding(invoicePdf)
  const [attached] = embedding.associated
  const fx = FACTUR_X.xmpPrefix
  const xmp = embedding.xmp ?? ''
  const held: Readonly<Record<string, boolean>> = {
    'PDF 1.7': embedding.version === '1.7',
    'one associated file, its relationship and its names':
      embedding.associated.length === 1 &&
      attached?.relationship === file.relationship &&
      attached.file === file.fileName &&
      attached.unicodeFile === file.fileName,
    'the name tree naming it alone': JSON.stringify(embedding.names) === JSON.stringify([file.fileName]) && attached?.named === file.fileName,
    "the runtime's XML, byte for byte, as its media type":
      attached?.mediaType === FACTUR_X.mediaType && attached.bytes !== undefined && Buffer.from(attached.bytes).equals(Buffer.from(file.xml, 'utf8')),
    'PDF/A-3b in the XMP': xmp.includes('<pdfaid:part>3</pdfaid:part>') && xmp.includes('<pdfaid:conformance>B</pdfaid:conformance>'),
    'the fx properties in the XMP':
      xmp.includes(`xmlns:${fx}="${FACTUR_X.xmpNamespace}"`) &&
      xmp.includes(`<${fx}:DocumentFileName>${file.fileName}</${fx}:DocumentFileName>`) &&
      xmp.includes(`<${fx}:ConformanceLevel>${file.conformanceLevel}</${fx}:ConformanceLevel>`),
    // The ICC's sRGB2014, reviewed in PDFKit 0.19.1 (ICC_PROFILES in scripts/dependency-licences.mjs): another PDFKit's profile would reach a customer unreviewed.
    'the reviewed sRGB2014 output intent':
      JSON.stringify(embedding.outputProfiles) === JSON.stringify(['384b832de3412066743b52a75ee906b6fb9fb8d9e09e936fc2c43223815c6e0a']),
  }
  const missed = Object.keys(held).filter((check) => held[check] !== true)
  if (missed.length > 0) {
    const seen = { ...embedding, associated: embedding.associated.map(({ bytes, ...rest }) => ({ ...rest, bytes: bytes?.length })), xmp: embedding.xmp?.length }
    throw new Error(`the e-invoice was not drawn as a PDF/A-3b that embeds its XML; it lacks ${missed.join('; ')}: ${JSON.stringify(seen)}`)
  }
  // A preview writes no XML, warns, and is labelled as not the invoice on every page; that, the renderer draws, embedding nothing.
  const previewed: Resolution = resolveReport(invoiced, invoiceData, { mode: 'preview', creationDate: '2026-10-16T08:00:00Z' })
  if (!previewed.ok || previewed.document.eInvoice !== undefined || !previewed.warnings.some((warning) => warning.code === 'e-invoice-preview'))
    throw new Error('a preview of the e-invoice wrote its XML, or did not warn')
  const [previewLabel] = previewed.document.pageHeader
  if (previewLabel?.kind !== 'paragraph' || previewLabel.runs.map((run) => ('text' in run ? run.text : '')).join('') !== E_INVOICE_PREVIEW_LABEL)
    throw new Error('a preview of the e-invoice is not labelled as not the invoice')
  const invoicePreview = await renderPdf(previewed.document, { maxPages: 50 })
  const previewEmbedding: Embedding = readEmbedding(invoicePreview)
  if (
    new TextDecoder().decode(invoicePreview.subarray(0, 5)) !== '%PDF-' ||
    previewEmbedding.associated.length !== 0 ||
    previewEmbedding.names.length !== 0 ||
    previewEmbedding.xmp?.includes('pdfaid:') === true
  ) {
    throw new Error(
      `the preview of the e-invoice did not render to a PDF that embeds nothing: ${JSON.stringify({ ...previewEmbedding, associated: previewEmbedding.associated.length })}`,
    )
  }
  const xrechnung = await drawnXRechnung(invoiced, addressedBlock, invoiceData, addressedXml)
  return `an e-invoice validated, a country outside its list was refused by its rule, its business process, electronic addresses and seller's contact were written where given and a telephone number of no digits refused by XRechnung's rule, a final render wrote ${file.xml.length} characters of CII XML holding the totals its page prints, and the renderer drew it as a ${invoicePdf.length}-byte PDF/A-3b that embeds those bytes as ${file.fileName}, says so in its XMP and carries the reviewed sRGB profile, and its labelled preview as a ${invoicePreview.length}-byte PDF that embeds nothing; ${xrechnung}`
}

/**
 * The same invoice as an XRechnung 3.0 (0038), from the packed packages: the
 * addressed invoice's terms, which hold every one XRechnung needs past EN
 * 16931 but the buyer's reference, given here as KoSIT's test Leitweg-ID
 * and under 0204 as the buyer's address. It validates; one without its
 * buyer's reference is refused by XRechnung's BR-DE-15, and a Leitweg-ID of
 * wrong check digits by the Leitweg-ID's rule, neither quoting it; a final
 * render hands a host the XML as an XRechnung's file, in CII, named by
 * report-spec's `XRECHNUNG` as the runtime hands it on, the very XML the
 * Factur-X invoice of the same terms is but for BT-24; and the renderer
 * draws its copy as a plain PDF that embeds nothing, its page header the
 * copy's label. A runtime that wrote the XRechnung as a hybrid, or a
 * renderer that embedded its XML or dropped the label, fails here.
 */
async function drawnXRechnung(invoiced: ReportDefinition, addressed: FacturXInvoice, data: ReportData, addressedXml: string): Promise<string> {
  const { kind: _kind, profile: _profile, ...terms } = addressed
  const leitwegId = text('991-33333TEST-33')
  const { businessProcess, seller, payment } = terms
  if (businessProcess === undefined || seller.contact === undefined || seller.electronicAddress === undefined || payment === undefined)
    throw new Error('the addressed invoice lacks a term an XRechnung needs')
  const block: XRechnungInvoice = {
    ...terms,
    kind: 'xrechnung',
    version: '3.0',
    businessProcess,
    seller: { ...seller, contact: seller.contact, electronicAddress: seller.electronicAddress },
    buyer: { ...terms.buyer, electronicAddress: { id: leitwegId, scheme: '0204' } },
    buyerReference: leitwegId,
    payment,
  }
  const report: ReportDefinition = { ...invoiced, id: 'install-xrechnung', title: 'Rechnung & Kopie', eInvoice: block }
  const valid: ReportValidation = validateReport(report)
  if (!valid.valid) throw new Error(`the XRechnung was refused: ${valid.errors.map((error: ReportError) => `${error.code} ${error.path}`).join(', ')}`)
  const { buyerReference: _reference, ...unreferenced } = block
  const unaddressed: ReportValidation = validateReport({ ...report, eInvoice: unreferenced })
  if (
    unaddressed.valid ||
    !unaddressed.errors.some((error: ReportError) => error.path === '/eInvoice/buyerReference' && error.message.includes("(XRechnung's BR-DE-15)"))
  ) {
    throw new Error(
      `an XRechnung without its buyer's reference was not refused by XRechnung's BR-DE-15: ${unaddressed.valid ? 'valid' : unaddressed.errors.map((error: ReportError) => `${error.code} ${error.path}`).join(', ')}`,
    )
  }
  const misrouted: ReportValidation = validateReport({
    ...report,
    eInvoice: { ...block, buyer: { ...block.buyer, electronicAddress: { id: text('991-33333TEST-34'), scheme: '0204' } } },
  })
  if (
    misrouted.valid ||
    !misrouted.errors.some(
      (error: ReportError) =>
        error.path === '/eInvoice/buyer/electronicAddress/id' && error.message.includes('MOD 97-10') && !error.message.includes('33333TEST'),
    )
  ) {
    throw new Error(
      `a Leitweg-ID of wrong check digits was not refused by its rule: ${misrouted.valid ? 'valid' : misrouted.errors.map((error: ReportError) => `${error.code} ${error.path}`).join(', ')}`,
    )
  }
  const resolution: Resolution = resolveReport(report, data, { mode: 'final', creationDate: '2026-10-16T08:00:00Z' })
  if (!resolution.ok) throw new Error(`the XRechnung did not resolve: ${resolution.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
  const file: EInvoiceFile | undefined = resolution.document.eInvoice
  if (RUNTIME_XRECHNUNG !== XRECHNUNG) throw new Error("the runtime does not hand on report-spec's own XRechnung names")
  const version = XRECHNUNG['3.0']
  if (file?.kind !== 'xrechnung' || file.syntax !== version.syntax || file.guideline !== version.guideline || file.version !== '3.0')
    throw new Error(`a final render of the XRechnung handed on no XRechnung's file of its version: ${JSON.stringify({ ...file, xml: file?.xml.length })}`)
  // The XML a host takes is the addressed Factur-X invoice's, byte for byte, but for BT-24 and the buyer's reference and address this one gives: one writer of one invoice. The consumer has no XML parser, and the runtime writes one way.
  const expected = addressedXml
    .replace('<ram:ID>urn:cen.eu:en16931:2017</ram:ID>', `<ram:ID>${version.guideline}</ram:ID>`)
    .replace(
      '<ram:ApplicableHeaderTradeAgreement>\n',
      '<ram:ApplicableHeaderTradeAgreement>\n      <ram:BuyerReference>991-33333TEST-33</ram:BuyerReference>\n',
    )
    .replace('<ram:URIID schemeID="0088">4012345000009</ram:URIID>', '<ram:URIID schemeID="0204">991-33333TEST-33</ram:URIID>')
  if (file.xml !== expected) throw new Error("the XRechnung's XML is not the addressed invoice's, BT-24 and the buyer's reference and address apart")
  // The label as the renderer holds a copy to it, the runtime's own paragraph, style and all; one runtime writes both, so its properties come in one order.
  const [label] = resolution.document.pageHeader
  if (
    label?.kind !== 'paragraph' ||
    label.runs.map((run) => ('text' in run ? run.text : '')).join('') !== XRECHNUNG_COPY_LABEL ||
    JSON.stringify(label) !== JSON.stringify(XRECHNUNG_COPY_PARAGRAPH)
  )
    throw new Error("the XRechnung's document is not labelled as the copy")
  const copy = await renderPdf(resolution.document, { maxPages: 50 })
  const embedding: Embedding = readEmbedding(copy)
  if (
    new TextDecoder().decode(copy.subarray(0, 5)) !== '%PDF-' ||
    embedding.associated.length !== 0 ||
    embedding.names.length !== 0 ||
    embedding.xmp !== undefined ||
    embedding.outputProfiles.length !== 0
  ) {
    throw new Error(
      `the XRechnung's copy was not drawn as a plain PDF that embeds nothing: ${JSON.stringify({ ...embedding, associated: embedding.associated.length, xmp: embedding.xmp?.length })}`,
    )
  }
  return `and as an XRechnung it validated, one without its buyer's reference was refused by XRechnung's BR-DE-15 and a Leitweg-ID of wrong check digits by its rule, a final render handed on ${file.xml.length} characters of XRechnung ${file.version} XML in ${file.syntax.toUpperCase()} for a host to send, and the renderer drew its labelled copy as a ${copy.length}-byte PDF that embeds nothing and states no PDF/A`
}
