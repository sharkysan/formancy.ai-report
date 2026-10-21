/**
 * The parties of a CII invoice and how it is paid: the seller (BG-4) and
 * the buyer (BG-7) with their addresses (BG-5, BG-8), and the payment
 * instructions (BG-16), each in the order the Factur-X EN 16931 XSD's
 * `xs:sequence` gives its elements and at the path CEN/TC 434's CII binding
 * gives each business term. `cii.ts` places them in the document.
 *
 * A trade party is `Name`, `SpecifiedLegalOrganization`,
 * `DefinedTradeContact`, `PostalTradeAddress`, `URIUniversalCommunication`
 * and `SpecifiedTaxRegistration`, in that order, the VAT identifier under
 * scheme `VA` and the seller's tax number under `FC`; a contact is
 * `PersonName`, `TelephoneUniversalCommunication` and
 * `EmailURIUniversalCommunication`; an address is `PostcodeCode`,
 * `LineOne`, `LineTwo`, `CityName`, `CountryID`. Only elements D16B
 * shares with D22B are written, since the validators run the D16B schema.
 */
import type { AddressTerms, ContactTerms, PartyTerms, PaymentTerms } from './e-invoice-terms.js'
import { element, leaf } from './xml.js'
import type { XmlElement } from './xml.js'

/** `make` of `value` where there is one; nothing where the term is left out. */
export function optional(value: string | undefined, make: (value: string) => XmlElement): XmlElement | undefined {
  return value === undefined ? undefined : make(value)
}

/** BG-5 or BG-8: the post code, the lines, the city and the country (BT-38, 35, 36, 37, 40; BT-53, 50, 51, 52, 55). */
function postalAddress(address: AddressTerms): XmlElement {
  return element('ram:PostalTradeAddress', [
    leaf('ram:PostcodeCode', address.postalCode),
    leaf('ram:LineOne', address.line1),
    optional(address.line2, (line) => leaf('ram:LineTwo', line)),
    leaf('ram:CityName', address.city),
    leaf('ram:CountryID', address.country),
  ])
}

/** BG-6: the contact point (BT-41), the telephone number (BT-42) and the email address (BT-43), all three, as a contact gives them; no element where the seller names none. */
function tradeContact(contact: ContactTerms | undefined): XmlElement | undefined {
  if (contact === undefined) return undefined
  return element('ram:DefinedTradeContact', [
    leaf('ram:PersonName', contact.name),
    element('ram:TelephoneUniversalCommunication', [leaf('ram:CompleteNumber', contact.telephone)]),
    element('ram:EmailURIUniversalCommunication', [leaf('ram:URIID', contact.email)]),
  ])
}

/**
 * The seller or the buyer: its name (BT-27, BT-44), its legal registration
 * and its scheme (BT-30, BT-47), the seller's contact (BG-6), its address,
 * its electronic address and its scheme (BT-34, BT-49), its VAT
 * identifier (BT-31, BT-48) and, the seller's, its tax number (BT-32).
 */
export function tradeParty(name: 'ram:SellerTradeParty' | 'ram:BuyerTradeParty', party: PartyTerms): XmlElement {
  const registration = party.legalId
  const reached = party.electronicAddress
  return element(name, [
    leaf('ram:Name', party.name),
    registration === undefined ? undefined : element('ram:SpecifiedLegalOrganization', [leaf('ram:ID', registration.id, registration.scheme === undefined ? [] : [['schemeID', registration.scheme]])]),
    tradeContact(party.contact),
    postalAddress(party.address),
    reached === undefined ? undefined : element('ram:URIUniversalCommunication', [leaf('ram:URIID', reached.id, [['schemeID', reached.scheme]])]),
    optional(party.vatId, (id) => element('ram:SpecifiedTaxRegistration', [leaf('ram:ID', id, [['schemeID', 'VA']])])),
    optional(party.taxNumber, (id) => element('ram:SpecifiedTaxRegistration', [leaf('ram:ID', id, [['schemeID', 'FC']])])),
  ])
}

/**
 * BG-16: the means (BT-81), the account by its IBAN (BT-84) and its name
 * (BT-85), and the BIC of its bank (BT-86). The remittance information
 * (BT-83) is the settlement's `PaymentReference`, which `cii.ts` writes.
 */
export function paymentMeans(payment: PaymentTerms): XmlElement {
  return element('ram:SpecifiedTradeSettlementPaymentMeans', [
    leaf('ram:TypeCode', payment.means),
    element('ram:PayeePartyCreditorFinancialAccount', [leaf('ram:IBANID', payment.account), optional(payment.accountName, (name) => leaf('ram:AccountName', name))]),
    optional(payment.bic, (bic) => element('ram:PayeeSpecifiedCreditorFinancialInstitution', [leaf('ram:BICID', bic)])),
  ])
}
