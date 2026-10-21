import { resolveReport } from '@formancy/report-runtime'
import type { ReportDefinition } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { pathsOf, readCii } from './testing/cii.js'

/**
 * The CII XML the runtime writes of an e-invoice, read back by a parser
 * that is not the writer: saxes 6.0.0, strictly, its namespaces resolved
 * (`testing/cii.ts`). Each business term is found at the path CEN/TC 434's
 * CII binding gives it -- the paths KoSIT's `cii-xr.xsl` matches each BT
 * at -- by namespace URI and local name, so that a prefix bound to another
 * namespace, an element at another path or a text that does not come back
 * as written fails here, where the runtime's own tests compare text with
 * text. The terms past 0027's -- the business process, the electronic
 * addresses and the seller's contact (0037) -- are where the pinned
 * XRechnung schematron reads them (PEPPOL-EN16931-R001, -R020, -R010,
 * BR-DE-5 to -7, in KoSIT's configuration of 2026-08-31).
 *
 * What this cannot show is that a validator takes the file: the XSD's
 * order and the schematron's rules are the e-invoice gate's.
 */

const said = (text: string) => [{ kind: 'text', text }] as const
const field = (dataset: 'header' | 'detail', id: string) => ({ kind: 'field', field: { dataset, field: id } }) as const
const printed = (cel: string) => ({ kind: 'expression', expression: { cel } }) as const

/** A German invoice of two lines at two rates, one a discount, a paid amount, payment by SEPA credit transfer, every term past 0027's, and texts XML must escape. */
const REPORT = {
  reportSpecVersion: '0',
  id: 'rechnung',
  title: 'Rechnung',
  locale: 'de-DE',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 } },
  styles: [],
  datasets: {
    header: { id: 'h', fields: [{ id: 'number', type: 'string', label: 'Nr.', nullable: false }] },
    detail: {
      id: 'd',
      fields: [
        { id: 'position', type: 'integer', label: 'Pos.', nullable: false },
        { id: 'item', type: 'string', label: 'Artikel', nullable: false },
        { id: 'quantity', type: 'decimal', label: 'Menge', nullable: false },
        { id: 'unit', type: 'string', label: 'Einheit', nullable: false },
        { id: 'price', type: 'decimal', label: 'Preis', nullable: false },
        { id: 'amount', type: 'decimal', label: 'Betrag', nullable: false },
        { id: 'vat', type: 'string', label: 'MwSt.', nullable: false },
      ],
    },
  },
  parameters: [],
  assets: [],
  aggregates: [],
  regions: {
    reportHeader: [],
    pageHeader: [],
    body: [
      {
        id: 'lines',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'item', header: 'Artikel', width: 'fill', align: 'left', value: field('detail', 'item') },
          { id: 'qty', header: 'Menge', width: 50, align: 'right', value: field('detail', 'quantity') },
          { id: 'price', header: 'Preis', width: 70, align: 'right', value: field('detail', 'price') },
          { id: 'amount', header: 'Betrag', width: 80, align: 'right', value: field('detail', 'amount') },
        ],
        emptyText: '-',
        repeatHeader: true,
      },
    ],
    pageFooter: [],
    summary: [
      {
        id: 'totals',
        kind: 'text',
        content: ['invoice.taxBasisTotal', 'vatBasis.standard', 'vatAmount.standard', 'vatBasis.reduced', 'vatAmount.reduced', 'invoice.taxTotal', 'invoice.grandTotal', 'invoice.paid', 'invoice.duePayable'].map(printed),
      },
    ],
  },
  eInvoice: {
    kind: 'facturX',
    profile: 'en16931',
    type: '380',
    currency: 'EUR',
    number: [field('header', 'number')],
    issued: { cel: '"2026-10-17"' },
    businessProcess: said('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'),
    seller: {
      name: said('Muster & Söhne <GmbH>'),
      vatId: said('DE 123 456 789'),
      taxNumber: said('201/113/40209'),
      legalId: { id: said('HRB 12345') },
      electronicAddress: { id: said('rechnung@muster-soehne.example'), scheme: 'EM' },
      contact: { name: said('Erika Mustermann & Team'), telephone: said('+49 221 4710 123'), email: said('erika.mustermann@muster-soehne.example') },
      address: { line1: said('Industriestraße 7'), line2: said('Hof 2'), postalCode: said('50735'), city: said('Köln'), country: said('DE') },
    },
    buyer: {
      name: said('Bäckerei Huber GmbH'),
      vatId: said('ATU12345678'),
      legalId: { id: said('4012345000009'), scheme: '0088' },
      electronicAddress: { id: said('4012345000009'), scheme: '0088' },
      address: { line1: said('Ring 1'), postalCode: said('1010'), city: said('Wien'), country: said('AT') },
    },
    buyerReference: said('PO-4711'),
    delivered: { cel: '"2026-10-15"' },
    period: { start: { cel: '"2026-10-01"' }, end: { cel: '"2026-10-15"' } },
    vat: [
      { id: 'standard', code: 'S', rate: '19' },
      { id: 'reduced', code: 'S', rate: '7.00' },
    ],
    lines: { table: 'lines', name: 'item', quantity: 'qty', netPrice: 'price', netAmount: 'amount', id: field('detail', 'position'), unit: field('detail', 'unit'), vat: field('detail', 'vat') },
    payment: { means: '58', iban: said('DE83 0123 4567 0012 3456 78'), bic: said('COBADEFFXXX'), accountName: said('Muster & Söhne'), remittance: [{ kind: 'text', text: 'Rechnung ' }, field('header', 'number')] },
    due: { cel: '"2026-10-31"' },
    terms: said('Zahlbar binnen 14 Tagen;\r\n2 % Skonto bis 24.10.2026'),
    paid: { cel: 'dec("10.00")' },
  },
} as const

const ROWS = [
  { position: '1', item: 'Schrauben "M6" & Muttern', quantity: '100', unit: 'H87', price: '0.25', amount: '25.00', vat: 'standard' },
  { position: '2', item: 'Brot', quantity: '3', unit: 'KGM', price: '2.99', amount: '8.97', vat: 'reduced' },
  { position: '3', item: 'Rabatt', quantity: '-1', unit: 'C62', price: '5.00', amount: '-5.00', vat: 'standard' },
]

/** The report as an XRechnung 3.0 (0038): the same terms, its kind and version where the profile was. */
function asXRechnung(report: typeof REPORT): ReportDefinition {
  const { profile: _profile, ...invoice } = report.eInvoice
  return { ...report, eInvoice: { ...invoice, kind: 'xrechnung', version: '3.0' } } as unknown as ReportDefinition
}

function xmlOf(report: ReportDefinition = JSON.parse(JSON.stringify(REPORT)) as ReportDefinition): string {
  const outcome = resolveReport(report, { header: { number: 'RE-2026-0042' }, detail: ROWS, completeness: { complete: true, captured: 3 }, consistency: 'host-captured' }, { mode: 'final', creationDate: '2026-10-17T08:00:00Z' })
  if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; '))
  return outcome.document.eInvoice?.xml ?? ''
}

const CII = 'rsm:CrossIndustryInvoice'
const STT = `${CII}/rsm:SupplyChainTradeTransaction`
const HTA = `${STT}/ram:ApplicableHeaderTradeAgreement`
const HTD = `${STT}/ram:ApplicableHeaderTradeDelivery`
const HTS = `${STT}/ram:ApplicableHeaderTradeSettlement`
const LINE = `${STT}/ram:IncludedSupplyChainTradeLineItem`
const SUMMATION = `${HTS}/ram:SpecifiedTradeSettlementHeaderMonetarySummation`
const DATE = 'udt:DateTimeString'

/** Each business term, its CII path (as KoSIT's XRechnung visualisation of 2026-10-13 maps each term, `xsl/cii-xr.xsl`) and what it holds, in document order. */
const TERMS: readonly (readonly [string, string, readonly string[]])[] = [
  ['BT-23', `${CII}/rsm:ExchangedDocumentContext/ram:BusinessProcessSpecifiedDocumentContextParameter/ram:ID`, ['urn:fdc:peppol.eu:2017:poacc:billing:01:1.0']],
  ['BT-24', `${CII}/rsm:ExchangedDocumentContext/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID`, ['urn:cen.eu:en16931:2017']],
  ['BT-1', `${CII}/rsm:ExchangedDocument/ram:ID`, ['RE-2026-0042']],
  ['BT-3', `${CII}/rsm:ExchangedDocument/ram:TypeCode`, ['380']],
  ['BT-2', `${CII}/rsm:ExchangedDocument/ram:IssueDateTime/${DATE}`, ['20261017']],
  ['BT-126', `${LINE}/ram:AssociatedDocumentLineDocument/ram:LineID`, ['1', '2', '3']],
  ['BT-153', `${LINE}/ram:SpecifiedTradeProduct/ram:Name`, ['Schrauben "M6" & Muttern', 'Brot', 'Rabatt']],
  ['BT-146', `${LINE}/ram:SpecifiedLineTradeAgreement/ram:NetPriceProductTradePrice/ram:ChargeAmount`, ['0.25', '2.99', '5.00']],
  ['BT-129', `${LINE}/ram:SpecifiedLineTradeDelivery/ram:BilledQuantity`, ['100', '3', '-1']],
  ['the tax, VAT (CII-DT-037)', `${LINE}/ram:SpecifiedLineTradeSettlement/ram:ApplicableTradeTax/ram:TypeCode`, ['VAT', 'VAT', 'VAT']],
  ['BT-151', `${LINE}/ram:SpecifiedLineTradeSettlement/ram:ApplicableTradeTax/ram:CategoryCode`, ['S', 'S', 'S']],
  ['BT-152', `${LINE}/ram:SpecifiedLineTradeSettlement/ram:ApplicableTradeTax/ram:RateApplicablePercent`, ['19', '7', '19']],
  ['BT-131', `${LINE}/ram:SpecifiedLineTradeSettlement/ram:SpecifiedTradeSettlementLineMonetarySummation/ram:LineTotalAmount`, ['25.00', '8.97', '-5.00']],
  ['BT-10', `${HTA}/ram:BuyerReference`, ['PO-4711']],
  ['BT-27', `${HTA}/ram:SellerTradeParty/ram:Name`, ['Muster & Söhne <GmbH>']],
  ['BT-30', `${HTA}/ram:SellerTradeParty/ram:SpecifiedLegalOrganization/ram:ID`, ['HRB 12345']],
  ['BT-41', `${HTA}/ram:SellerTradeParty/ram:DefinedTradeContact/ram:PersonName`, ['Erika Mustermann & Team']],
  ['BT-42', `${HTA}/ram:SellerTradeParty/ram:DefinedTradeContact/ram:TelephoneUniversalCommunication/ram:CompleteNumber`, ['+49 221 4710 123']],
  ['BT-43', `${HTA}/ram:SellerTradeParty/ram:DefinedTradeContact/ram:EmailURIUniversalCommunication/ram:URIID`, ['erika.mustermann@muster-soehne.example']],
  ['BT-38', `${HTA}/ram:SellerTradeParty/ram:PostalTradeAddress/ram:PostcodeCode`, ['50735']],
  ['BT-35', `${HTA}/ram:SellerTradeParty/ram:PostalTradeAddress/ram:LineOne`, ['Industriestraße 7']],
  ['BT-36', `${HTA}/ram:SellerTradeParty/ram:PostalTradeAddress/ram:LineTwo`, ['Hof 2']],
  ['BT-37', `${HTA}/ram:SellerTradeParty/ram:PostalTradeAddress/ram:CityName`, ['Köln']],
  ['BT-40', `${HTA}/ram:SellerTradeParty/ram:PostalTradeAddress/ram:CountryID`, ['DE']],
  ['BT-34', `${HTA}/ram:SellerTradeParty/ram:URIUniversalCommunication/ram:URIID`, ['rechnung@muster-soehne.example']],
  ['BT-31, BT-32', `${HTA}/ram:SellerTradeParty/ram:SpecifiedTaxRegistration/ram:ID`, ['DE123456789', '201/113/40209']],
  ['BT-44', `${HTA}/ram:BuyerTradeParty/ram:Name`, ['Bäckerei Huber GmbH']],
  ['BT-47', `${HTA}/ram:BuyerTradeParty/ram:SpecifiedLegalOrganization/ram:ID`, ['4012345000009']],
  ['BT-53', `${HTA}/ram:BuyerTradeParty/ram:PostalTradeAddress/ram:PostcodeCode`, ['1010']],
  ['BT-50', `${HTA}/ram:BuyerTradeParty/ram:PostalTradeAddress/ram:LineOne`, ['Ring 1']],
  ['BT-52', `${HTA}/ram:BuyerTradeParty/ram:PostalTradeAddress/ram:CityName`, ['Wien']],
  ['BT-55', `${HTA}/ram:BuyerTradeParty/ram:PostalTradeAddress/ram:CountryID`, ['AT']],
  ['BT-49', `${HTA}/ram:BuyerTradeParty/ram:URIUniversalCommunication/ram:URIID`, ['4012345000009']],
  ['BT-48', `${HTA}/ram:BuyerTradeParty/ram:SpecifiedTaxRegistration/ram:ID`, ['ATU12345678']],
  ['BT-72', `${HTD}/ram:ActualDeliverySupplyChainEvent/ram:OccurrenceDateTime/${DATE}`, ['20261015']],
  ['BT-83', `${HTS}/ram:PaymentReference`, ['Rechnung RE-2026-0042']],
  ['BT-5', `${HTS}/ram:InvoiceCurrencyCode`, ['EUR']],
  ['BT-81', `${HTS}/ram:SpecifiedTradeSettlementPaymentMeans/ram:TypeCode`, ['58']],
  ['BT-84', `${HTS}/ram:SpecifiedTradeSettlementPaymentMeans/ram:PayeePartyCreditorFinancialAccount/ram:IBANID`, ['DE83012345670012345678']],
  ['BT-85', `${HTS}/ram:SpecifiedTradeSettlementPaymentMeans/ram:PayeePartyCreditorFinancialAccount/ram:AccountName`, ['Muster & Söhne']],
  ['BT-86', `${HTS}/ram:SpecifiedTradeSettlementPaymentMeans/ram:PayeeSpecifiedCreditorFinancialInstitution/ram:BICID`, ['COBADEFFXXX']],
  ['BT-117', `${HTS}/ram:ApplicableTradeTax/ram:CalculatedAmount`, ['3.80', '0.63']],
  ['the tax, VAT (CII-DT-037)', `${HTS}/ram:ApplicableTradeTax/ram:TypeCode`, ['VAT', 'VAT']],
  ['BT-116', `${HTS}/ram:ApplicableTradeTax/ram:BasisAmount`, ['20.00', '8.97']],
  ['BT-118', `${HTS}/ram:ApplicableTradeTax/ram:CategoryCode`, ['S', 'S']],
  ['BT-119', `${HTS}/ram:ApplicableTradeTax/ram:RateApplicablePercent`, ['19', '7']],
  ['BT-73', `${HTS}/ram:BillingSpecifiedPeriod/ram:StartDateTime/${DATE}`, ['20261001']],
  ['BT-74', `${HTS}/ram:BillingSpecifiedPeriod/ram:EndDateTime/${DATE}`, ['20261015']],
  ['BT-20', `${HTS}/ram:SpecifiedTradePaymentTerms/ram:Description`, ['Zahlbar binnen 14 Tagen;\r\n2 % Skonto bis 24.10.2026']],
  ['BT-9', `${HTS}/ram:SpecifiedTradePaymentTerms/ram:DueDateDateTime/${DATE}`, ['20261031']],
  ['BT-106', `${SUMMATION}/ram:LineTotalAmount`, ['28.97']],
  ['BT-109', `${SUMMATION}/ram:TaxBasisTotalAmount`, ['28.97']],
  ['BT-110', `${SUMMATION}/ram:TaxTotalAmount`, ['4.43']],
  ['BT-112', `${SUMMATION}/ram:GrandTotalAmount`, ['33.40']],
  ['BT-113', `${SUMMATION}/ram:TotalPrepaidAmount`, ['10.00']],
  ['BT-115', `${SUMMATION}/ram:DuePayableAmount`, ['23.40']],
]

describe("the runtime's CII, read by another parser", () => {
  const xml = xmlOf()
  const parsed = pathsOf(readCii(xml))

  // A text the writer escaped comes back as written: an ampersand, angle
  // brackets and quotes in a name, a carriage return in the terms, which a
  // parser would read as a line feed had it not been written as a
  // reference. Every term is where the binding puts it, and no element
  // holds text this table does not name.
  test.each(TERMS)('holds %s at its path', (_, path, values) => {
    expect(parsed.texts.get(path)).toEqual(values)
  })

  test('holds no text at a path the binding does not name', () => {
    expect([...parsed.texts.keys()].filter((path) => !TERMS.some(([, named]) => named === path))).toEqual([])
  })

  // The attributes a term needs, and no other: the unit (BT-130), each
  // scheme -- `VA`, `FC`, the buyer's registration's (BT-47-1), each
  // electronic address's (BT-34-1, BT-49-1) -- format 102 of each of the
  // five dates, and the currency of BT-110 alone (CII-DT-031).
  test('names a unit, a scheme, a date format and the VAT total currency, and no other attribute', () => {
    expect(parsed.attributes.get(`${LINE}/ram:SpecifiedLineTradeDelivery/ram:BilledQuantity/@unitCode`)).toEqual(['H87', 'KGM', 'C62'])
    expect(parsed.attributes.get(`${HTA}/ram:SellerTradeParty/ram:SpecifiedTaxRegistration/ram:ID/@schemeID`)).toEqual(['VA', 'FC'])
    expect(parsed.attributes.get(`${HTA}/ram:BuyerTradeParty/ram:SpecifiedTaxRegistration/ram:ID/@schemeID`)).toEqual(['VA'])
    expect(parsed.attributes.get(`${HTA}/ram:BuyerTradeParty/ram:SpecifiedLegalOrganization/ram:ID/@schemeID`)).toEqual(['0088'])
    expect(parsed.attributes.get(`${HTA}/ram:SellerTradeParty/ram:URIUniversalCommunication/ram:URIID/@schemeID`)).toEqual(['EM'])
    expect(parsed.attributes.get(`${HTA}/ram:BuyerTradeParty/ram:URIUniversalCommunication/ram:URIID/@schemeID`)).toEqual(['0088'])
    expect(parsed.attributes.get(`${SUMMATION}/ram:TaxTotalAmount/@currencyID`)).toEqual(['EUR'])
    const named = [...parsed.attributes.keys()].map((path) => path.split('/@')[1])
    expect(new Set(named)).toEqual(new Set(['unitCode', 'schemeID', 'currencyID', 'format']))
    expect([...parsed.attributes.entries()].filter(([path]) => path.endsWith('/@format')).flatMap(([, values]) => values)).toEqual(Array.from({ length: 5 }, () => '102'))
  })

  // An XRechnung is written by the same writer (0038): the same report as
  // an XRechnung holds every term at the same path with the same text and
  // the same attributes, but for BT-24, KoSIT's XRechnung identifier.
  test('holds every term an XRechnung of the same report holds, BT-24 apart', () => {
    const xrechnung = pathsOf(readCii(xmlOf(asXRechnung(JSON.parse(JSON.stringify(REPORT)) as typeof REPORT))))
    const guideline = `${CII}/rsm:ExchangedDocumentContext/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID`
    expect(xrechnung.texts.get(guideline)).toEqual(['urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'])
    expect(new Map([...xrechnung.texts].filter(([path]) => path !== guideline))).toEqual(new Map([...parsed.texts].filter(([path]) => path !== guideline)))
    expect(xrechnung.attributes).toEqual(parsed.attributes)
  })
})
