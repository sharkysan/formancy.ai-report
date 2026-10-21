import { decimalFromString } from '@formancy/expressions'
import type { VatCategory } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { ciiXml } from './cii.js'
import type { CiiInvoice } from './cii.js'
import type { LineTerms } from './e-invoice-lines.js'
import type { InvoiceTerms } from './e-invoice-terms.js'
import { invoiceTotals } from './e-invoice-totals.js'

/**
 * An e-invoice written as CII XML in the Factur-X 1.09.2 / ZUGFeRD 2.5.2
 * EN 16931 profile: each business term at the path CEN/TC 434's CII
 * binding gives it, each element in the order the profile's XSD
 * `xs:sequence` gives it, written from the values it is handed and
 * deciding nothing.
 *
 * `COMPLETE` is the XML a probe wrote of this very invoice through
 * `resolveReport` on 17 October 2026, byte for byte, which the pinned
 * validators then took: KoSIT 1.6.3 with its XRechnung configuration of
 * 2026-08-31 matched it to the scenario `EN16931 (CII)` -- the D16B schema
 * and CEN's schematron 1.3.16 -- and accepted it with no failed assertion,
 * and Mustang 2.26.0 found it valid, 143 rules fired and none failed. That
 * was a run by hand, dated, and nothing runs it again: the e-invoice gate
 * judges the corpus's samples and the controls made from them, not this
 * file. The golden holds only that the writer still writes what they took.
 */

const said = (text: string) => [{ kind: 'text', text }] as const

const standard: VatCategory = { id: 'standard', code: 'S', rate: '19' }
const reduced: VatCategory = { id: 'reduced', code: 'S', rate: '7.00' }
const exempt: VatCategory = { id: 'exempt', code: 'E', rate: '0', reason: said('Steuerfrei nach § 4 Nr. 14 UStG') }

const line = (id: string, name: string, quantity: string, unit: string, netPrice: string, netAmount: string, category: VatCategory): LineTerms => ({
  id,
  name,
  quantity,
  unit,
  netPrice,
  netAmount: decimalFromString(netAmount),
  category,
})

const LINES: readonly LineTerms[] = [
  line('1', 'Schrauben M6 <verzinkt>', '100', 'H87', '0.25', '25.00', standard),
  line('2', 'Brot', '3', 'KGM', '2.99', '8.97', reduced),
  line('3', 'Beratung', '1.5', 'HUR', '80.00', '120.00', exempt),
  line('4', 'Rabatt', '-1', 'C62', '5.00', '-5.00', standard),
]

const TERMS: InvoiceTerms = {
  number: 'RE-2026-0042',
  issued: '2026-10-17',
  seller: {
    name: 'Muster & Söhne GmbH',
    vatId: 'DE123456789',
    taxNumber: '201/113/40209',
    legalId: { id: 'HRB 12345' },
    address: { line1: 'Industriestraße 7', line2: 'Hof 2', postalCode: '50735', city: 'Köln', country: 'DE' },
  },
  buyer: { name: 'Bäckerei Huber GmbH', vatId: 'ATU12345678', legalId: { id: '4012345000009', scheme: '0088' }, address: { line1: 'Ring 1', postalCode: '1010', city: 'Wien', country: 'AT' } },
  buyerReference: 'PO-4711',
  delivered: '2026-10-15',
  reasons: new Map([['exempt', 'Steuerfrei nach § 4 Nr. 14 UStG']]),
  payment: { means: '58', account: 'DE83012345670012345678', bic: 'COBADEFFXXX', accountName: 'Muster & Söhne GmbH', remittance: 'Rechnung RE-2026-0042' },
  due: '2026-10-31',
  terms: 'Zahlbar innerhalb von 14 Tagen ohne Abzug; 2 % Skonto bei Zahlung bis 24.10.2026',
}

const invoice = (terms: InvoiceTerms, lines: readonly LineTerms[] = LINES, paid: string | null = '100.00'): CiiInvoice => ({
  guideline: 'urn:cen.eu:en16931:2017',
  type: '380',
  currency: 'EUR',
  terms,
  lines,
  totals: invoiceTotals([standard, reduced, exempt], lines, paid === null ? null : decimalFromString(paid)),
})

const COMPLETE = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>RE-2026-0042</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">20261017</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>1</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>Schrauben M6 &lt;verzinkt&gt;</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>0.25</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="H87">100</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>19</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>25.00</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>2</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>Brot</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>2.99</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="KGM">3</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>7</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>8.97</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>3</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>Beratung</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>80.00</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="HUR">1.5</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>E</ram:CategoryCode>
          <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>120.00</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>4</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>Rabatt</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>5.00</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">-1</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>19</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>-5.00</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>PO-4711</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>Muster &amp; Söhne GmbH</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID>HRB 12345</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>50735</ram:PostcodeCode>
          <ram:LineOne>Industriestraße 7</ram:LineOne>
          <ram:LineTwo>Hof 2</ram:LineTwo>
          <ram:CityName>Köln</ram:CityName>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">DE123456789</ram:ID>
        </ram:SpecifiedTaxRegistration>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="FC">201/113/40209</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>Bäckerei Huber GmbH</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0088">4012345000009</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>1010</ram:PostcodeCode>
          <ram:LineOne>Ring 1</ram:LineOne>
          <ram:CityName>Wien</ram:CityName>
          <ram:CountryID>AT</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">ATU12345678</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">20261015</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>Rechnung RE-2026-0042</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>DE83012345670012345678</ram:IBANID>
          <ram:AccountName>Muster &amp; Söhne GmbH</ram:AccountName>
        </ram:PayeePartyCreditorFinancialAccount>
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>COBADEFFXXX</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>
      </ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>3.80</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>20.00</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>19</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>0.63</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>8.97</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>7</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>0.00</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:ExemptionReason>Steuerfrei nach § 4 Nr. 14 UStG</ram:ExemptionReason>
        <ram:BasisAmount>120.00</ram:BasisAmount>
        <ram:CategoryCode>E</ram:CategoryCode>
        <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>Zahlbar innerhalb von 14 Tagen ohne Abzug; 2 % Skonto bei Zahlung bis 24.10.2026</ram:Description>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">20261031</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>148.97</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>148.97</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">4.43</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>153.40</ram:GrandTotalAmount>
        <ram:TotalPrepaidAmount>100.00</ram:TotalPrepaidAmount>
        <ram:DuePayableAmount>53.40</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`

describe('the CII an e-invoice is written as', () => {
  // Every term this release writes, each where CEN's binding puts it and in
  // the XSD's order: a validator refuses an element out of its sequence,
  // and reads one at another path as another term, or as none.
  test('is every term at its path, in the order of the XSD, as the pinned validators took it', () => {
    expect(ciiXml(invoice(TERMS))).toBe(COMPLETE)
  })

  // A term the invoice does not hold is no element at all, never an empty
  // one a buyer's system would read as the term given blank. The delivery
  // element the XSD needs is written empty where there is no delivery
  // date, which Mustang's Factur-X schematron warns of (PEPPOL-EN16931-R008).
  test('leaves out every term the invoice does not hold', () => {
    const terms: InvoiceTerms = {
      number: TERMS.number,
      issued: TERMS.issued,
      seller: { name: TERMS.seller.name, vatId: 'DE123456789', address: { line1: 'Industriestraße 7', postalCode: '50735', city: 'Köln', country: 'DE' } },
      buyer: { name: TERMS.buyer.name, address: TERMS.buyer.address },
      period: { end: '2026-10-31' },
      reasons: new Map(),
    }
    const xml = ciiXml(invoice(terms, [LINES[0] as LineTerms], null))
    for (const name of ['LineTwo', 'SpecifiedLegalOrganization', 'BuyerReference', 'PaymentReference', 'SpecifiedTradeSettlementPaymentMeans', 'ExemptionReason', 'SpecifiedTradePaymentTerms', 'TotalPrepaidAmount', 'StartDateTime', 'schemeID="FC"']) {
      expect(xml, name).not.toContain(name)
    }
    expect(xml.match(/<ram:SpecifiedTaxRegistration>/g)).toHaveLength(1)
    expect(xml).toContain('    <ram:ApplicableHeaderTradeDelivery/>\n')
    expect(xml).toContain(['      <ram:BillingSpecifiedPeriod>', '        <ram:EndDateTime>', '          <udt:DateTimeString format="102">20261031</udt:DateTimeString>'].join('\n'))
    expect(xml).toContain('<ram:DuePayableAmount>29.75</ram:DuePayableAmount>')
  })

  // The terms past 0027's (0037) -- the business process, both parties'
  // electronic addresses and the seller's contact -- each where CEN's
  // binding puts it, at the paths the pinned XRechnung schematron reads
  // them at (PEPPOL-EN16931-R001, -R020, -R010, BR-DE-5 to -7), and in the
  // order of the Factur-X EN 16931 XSD's sequences: the business process
  // before the guideline, a party's contact after its legal organisation
  // and its electronic address after its postal address, the contact's
  // name, telephone and email in that order. Everything else is the
  // complete invoice's, byte for byte, which the validators took.
  test('writes the terms past 0027s at their paths, in the order of the XSD, and nothing else differently', () => {
    const terms: InvoiceTerms = {
      ...TERMS,
      businessProcess: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
      seller: { ...TERMS.seller, electronicAddress: { id: 'rechnung@muster-soehne.example', scheme: 'EM' }, contact: { name: 'Erika Mustermann', telephone: '+49 221 4710 123', email: 'erika.mustermann@muster-soehne.example' } },
      buyer: { ...TERMS.buyer, electronicAddress: { id: '4012345000009', scheme: '0088' } },
    }
    const xml = ciiXml(invoice(terms))
    const context = [
      '  <rsm:ExchangedDocumentContext>',
      '    <ram:BusinessProcessSpecifiedDocumentContextParameter>',
      '      <ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ram:ID>',
      '    </ram:BusinessProcessSpecifiedDocumentContextParameter>',
      '    <ram:GuidelineSpecifiedDocumentContextParameter>',
    ]
    const contact = [
      '        </ram:SpecifiedLegalOrganization>',
      '        <ram:DefinedTradeContact>',
      '          <ram:PersonName>Erika Mustermann</ram:PersonName>',
      '          <ram:TelephoneUniversalCommunication>',
      '            <ram:CompleteNumber>+49 221 4710 123</ram:CompleteNumber>',
      '          </ram:TelephoneUniversalCommunication>',
      '          <ram:EmailURIUniversalCommunication>',
      '            <ram:URIID>erika.mustermann@muster-soehne.example</ram:URIID>',
      '          </ram:EmailURIUniversalCommunication>',
      '        </ram:DefinedTradeContact>',
      '        <ram:PostalTradeAddress>',
    ]
    const sellerAddress = ['        </ram:PostalTradeAddress>', '        <ram:URIUniversalCommunication>', '          <ram:URIID schemeID="EM">rechnung@muster-soehne.example</ram:URIID>', '        </ram:URIUniversalCommunication>', '        <ram:SpecifiedTaxRegistration>']
    const buyerAddress = ['          <ram:CountryID>AT</ram:CountryID>', '        </ram:PostalTradeAddress>', '        <ram:URIUniversalCommunication>', '          <ram:URIID schemeID="0088">4012345000009</ram:URIID>', '        </ram:URIUniversalCommunication>']
    for (const lines of [context, contact, sellerAddress, buyerAddress]) expect(xml).toContain(lines.join('\n'))
    const added = new Set([...context.slice(1, 4), ...contact.slice(1, -1), ...sellerAddress.slice(1, -1), ...buyerAddress.slice(2)])
    // Taken out again, line by line, what is left is the complete invoice the validators took.
    expect(xml.split('\n').filter((line) => !added.has(line)).join('\n')).toBe(COMPLETE)
  })

  // An amount is written from its own digits at two places; one at another
  // scale is a defect of what computed it, never rounded or padded here,
  // where nobody would see the XML part from the page.
  test('refuses an amount not at two places, as a defect', () => {
    const odd = { ...(LINES[0] as LineTerms), netAmount: decimalFromString('25.000') }
    const totals = invoiceTotals([standard], [LINES[0] as LineTerms], null)
    expect(() => ciiXml({ ...invoice(TERMS, [LINES[0] as LineTerms], null), lines: [odd], totals })).toThrow(/ram:LineTotalAmount is at 3 places/)
  })
})
