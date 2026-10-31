/**
 * Each text term of the e-invoice held to EN 16931: what a refusal calls
 * it, whether the invoice may leave it out, whether the XML writes it as a
 * token, and its own rule -- a code from a closed list, a VAT identifier,
 * the EPC QR code's account and BIC, XRechnung's shape of a telephone
 * number and of an email address -- in one table, and which term each
 * text of the format is, by where it stands. What a text may hold at all,
 * XML 1.0 decides. An XRechnung's texts are the same terms, with what
 * XRechnung needs past EN 16931 needed and its payment terms held to
 * BR-DE-18 (`E_INVOICE_KIND_TEXTS`, 0038).
 */
import { checkEpcBic, checkEpcIban } from './epc-payload.js'
import { ADDRESS_SCHEMES, COUNTRY_CODES, SCHEME_IDS, UNIT_CODES, VAT_PREFIXES } from './e-invoice.js'
import type {
  AddressScheme,
  CountryCode,
  EInvoiceAddress,
  EInvoiceBuyer,
  EInvoiceKind,
  EInvoiceSeller,
  PaymentInstructions,
  SchemeId,
  SellerContact,
  UnitCode,
} from './e-invoice.js'
import { en16931Rule, FULL_ADDRESS, neededBy } from './en16931.js'
import type { EInvoiceNeed } from './en16931.js'
import { no, ok, withoutSpaces } from './payment-reference.js'
import type { PaymentCheck } from './payment-reference.js'
import { emailBreak, leitwegIdBreak, skontoBreak, telephoneBreak, XRECHNUNG_TEXT_NEEDS } from './xrechnung.js'

/** Whether a text says nothing: empty, or white space alone. */
export function eInvoiceBlank(text: string): boolean {
  return text.trim() === ''
}

/**
 * Whether a code point is one XML 1.0 cannot write (2.2, Char): a C0
 * control but tab, line feed and carriage return; half of a surrogate
 * pair; U+FFFE or U+FFFF. DEL and the C1 controls it allows.
 */
function unwritable(codePoint: number): boolean {
  if (codePoint < 0x20) return codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d
  return (codePoint >= 0xd800 && codePoint <= 0xdfff) || codePoint === 0xfffe || codePoint === 0xffff
}

/**
 * The rule a text breaks by holding a character XML 1.0 cannot write, or
 * undefined. A file that held one would not be XML, and dropping it would
 * change what the invoice says, so it is refused, named by its position,
 * counted in characters from 1, never quoted.
 */
export function xmlCharacterBreak(text: string): string | undefined {
  let position = 0
  for (const character of text) {
    position += 1
    if (unwritable(character.codePointAt(0) as number)) return `holds a character at character ${position} that XML 1.0 cannot write`
  }
  return undefined
}

/** A country (BT-40, BT-55) of `COUNTRY_CODES`, its blanks dropped. */
export function checkCountryCode(text: string): PaymentCheck<CountryCode> {
  const code = text.trim()
  if ((COUNTRY_CODES as readonly string[]).includes(code)) return ok(code as CountryCode)
  return no(en16931Rule('BR-CL-14', "is not a country code of those this release takes, a list narrower than ISO 3166-1's"))
}

/** A unit of measure (BT-130) of `UNIT_CODES`, its blanks dropped. */
export function checkUnitCode(text: string): PaymentCheck<UnitCode> {
  const code = text.trim()
  if ((UNIT_CODES as readonly string[]).includes(code)) return ok(code as UnitCode)
  return no(en16931Rule('BR-CL-23', 'is not a unit of measure of those this release takes, a list narrower than UN/ECE Recommendation 20'))
}

/** A scheme (BT-30-1, BT-47-1) of `SCHEME_IDS`: a literal the template writes, taken as written. */
export function checkSchemeId(code: string): PaymentCheck<SchemeId> {
  if ((SCHEME_IDS as readonly string[]).includes(code)) return ok(code as SchemeId)
  return no(en16931Rule('BR-CL-11', "is not a scheme of those this release takes, a list narrower than ISO 6523's"))
}

/** An electronic address's scheme (BT-34-1, BT-49-1) of `ADDRESS_SCHEMES`: a literal the template writes, taken as written. */
export function checkAddressScheme(code: string): PaymentCheck<AddressScheme> {
  if ((ADDRESS_SCHEMES as readonly string[]).includes(code)) return ok(code as AddressScheme)
  return no(en16931Rule('BR-CL-25', "is not an electronic address scheme of those this release takes, a list narrower than the CEF's EAS code list"))
}

/** A check of `breaks`: the text as written where it breaks nothing, and the rule it breaks where it does. */
const held =
  (breaks: (text: string) => string | undefined) =>
  (text: string): PaymentCheck<string> => {
    const rule = breaks(text)
    return rule === undefined ? ok(text) : no(rule)
  }

/**
 * A VAT identifier (BT-31, BT-48): a prefix of `VAT_PREFIXES`, which names
 * the country that issued it (BR-CO-09), and then the number it gives. The
 * spaces a person writes to read one are dropped, as an IBAN's are; what
 * follows the prefix is the issuing country's to define, and not checked.
 */
export function checkVatIdentifier(text: string): PaymentCheck<string> {
  const id = withoutSpaces(text)
  if (id.length > 2 && VAT_PREFIXES.includes(id.slice(0, 2))) return ok(id)
  return no(en16931Rule('BR-CO-09', 'does not begin with a country code this release takes as a VAT prefix, then the number it gives'))
}

/** How a text term of the e-invoice is held: what a refusal calls it, the rule its absence breaks, and its own rule. */
export interface EInvoiceTextRule {
  /** What a refusal calls it, its business term named: "the seller's name (BT-27)". */
  readonly what: string
  /** What an empty one breaks, when the e-invoice needs it; absent, it may be left out. */
  readonly required?: EInvoiceNeed
  /**
   * Whether the XML writes it as a token: the Factur-X EN 16931 XSD types
   * an identifier and a code (udt:IDType, udt:CodeType) as xs:token, which
   * a schema-aware reader collapses -- each tab and line break a space, two
   * spaces one, none at either end. Such a text holds none of that, or a
   * reader would read another identifier than the page prints.
   */
  readonly token?: true
  /** What it holds when it holds something, past its characters: the value the XML writes, or the rule it breaks. */
  readonly check?: (text: string) => PaymentCheck<string>
}

/**
 * Each text term of the e-invoice, by its business term. One table, which
 * the validator reads for a literal text and the runtime for one the data
 * resolved: two could call a term two things, or disagree about which an
 * invoice may leave out, and nobody would find out.
 *
 * - The address lines, post codes and cities are needed by the UStG's
 *   full address (`FULL_ADDRESS`), past EN 16931, which asks only for the
 *   country.
 * - An identifier or a code the XML writes as a token holds no white
 *   space a token collapses (`token`).
 * - The payment account (BT-84) is held by the one rule an EPC QR code's
 *   account is (`checkEpcIban`): an IBAN of a country of SEPA, of its
 *   length, its check digits right (`payment-reference.ts`), and no
 *   QR-IBAN; and its BIC (BT-86) by the EPC QR code's BIC rule
 *   (`checkEpcBic`). Every credit transfer this version writes is paid in
 *   euro, and an invoice that prints both cannot hold two rules for one
 *   account or one bank.
 * - The exemption reason (BT-120) is needed by its category's code
 *   (`vatReasonBreak`); a line's VAT category (BT-151) is one the invoice
 *   declares (`checkLineCategory`).
 * - The business process (BT-23), the electronic addresses (BT-34, BT-49)
 *   and the seller's contact (BT-41 to BT-43) are needed by no rule a
 *   German B2B invoice is held to (0037). The telephone number and the
 *   email address are held to the shapes XRechnung's KoSIT warns of
 *   (`xrechnung.ts`), so that no file earns the warning; the business
 *   process and an address, identifiers of no shape CEN or XRechnung asks,
 *   are tokens alone.
 */
export type EInvoiceTextTerm =
  | 'BT-1'
  | 'BT-10'
  | 'BT-20'
  | 'BT-23'
  | 'BT-27'
  | 'BT-30'
  | 'BT-31'
  | 'BT-32'
  | 'BT-34'
  | 'BT-35'
  | 'BT-36'
  | 'BT-37'
  | 'BT-38'
  | 'BT-40'
  | 'BT-41'
  | 'BT-42'
  | 'BT-43'
  | 'BT-44'
  | 'BT-47'
  | 'BT-48'
  | 'BT-49'
  | 'BT-50'
  | 'BT-51'
  | 'BT-52'
  | 'BT-53'
  | 'BT-55'
  | 'BT-83'
  | 'BT-84'
  | 'BT-85'
  | 'BT-86'
  | 'BT-120'
  | 'BT-126'
  | 'BT-130'
  | 'BT-151'
  | 'BT-153'

export const E_INVOICE_TEXTS: { readonly [T in EInvoiceTextTerm]: EInvoiceTextRule } = {
  'BT-1': { what: 'the invoice number (BT-1)', required: 'BR-02', token: true },
  'BT-10': { what: "the buyer's reference (BT-10)" },
  'BT-20': { what: 'the payment terms (BT-20)' },
  'BT-23': { what: 'the business process (BT-23)', token: true },
  'BT-27': { what: "the seller's name (BT-27)", required: 'BR-06' },
  'BT-30': { what: "the seller's legal registration identifier (BT-30)", token: true },
  'BT-31': { what: "the seller's VAT identifier (BT-31)", check: checkVatIdentifier },
  'BT-32': { what: "the seller's tax registration identifier (BT-32)", token: true },
  'BT-34': { what: "the seller's electronic address (BT-34)", token: true },
  'BT-35': { what: "the seller's address line (BT-35)", required: FULL_ADDRESS },
  'BT-36': { what: "the seller's second address line (BT-36)" },
  'BT-37': { what: "the seller's city (BT-37)", required: FULL_ADDRESS },
  'BT-38': { what: "the seller's post code (BT-38)", required: FULL_ADDRESS, token: true },
  'BT-40': { what: "the seller's country code (BT-40)", required: 'BR-09', check: checkCountryCode },
  'BT-41': { what: "the seller's contact point (BT-41)" },
  'BT-42': { what: "the seller's contact telephone number (BT-42)", check: held(telephoneBreak) },
  'BT-43': { what: "the seller's contact email address (BT-43)", token: true, check: held(emailBreak) },
  'BT-44': { what: "the buyer's name (BT-44)", required: 'BR-07' },
  'BT-47': { what: "the buyer's legal registration identifier (BT-47)", token: true },
  'BT-48': { what: "the buyer's VAT identifier (BT-48)", check: checkVatIdentifier },
  'BT-49': { what: "the buyer's electronic address (BT-49)", token: true },
  'BT-50': { what: "the buyer's address line (BT-50)", required: FULL_ADDRESS },
  'BT-51': { what: "the buyer's second address line (BT-51)" },
  'BT-52': { what: "the buyer's city (BT-52)", required: FULL_ADDRESS },
  'BT-53': { what: "the buyer's post code (BT-53)", required: FULL_ADDRESS, token: true },
  'BT-55': { what: "the buyer's country code (BT-55)", required: 'BR-11', check: checkCountryCode },
  'BT-83': { what: 'the remittance information (BT-83)' },
  'BT-84': { what: 'the payment account (BT-84)', required: 'BR-61', check: checkEpcIban },
  'BT-85': { what: "the payment account's name (BT-85)" },
  'BT-86': { what: "the payment account's BIC (BT-86)", token: true, check: checkEpcBic },
  'BT-120': { what: 'the VAT exemption reason (BT-120)' },
  'BT-126': { what: 'the line identifier (BT-126)', required: 'BR-21', token: true },
  'BT-130': { what: 'the unit of measure (BT-130)', required: 'BR-23', check: checkUnitCode },
  'BT-151': { what: "the line's VAT category (BT-151)", required: 'BR-CO-04' },
  'BT-153': { what: 'the item name (BT-153)', required: 'BR-25' },
}

/** How each text term is held, by its business term: a table over every term. */
export type EInvoiceTextRules = { readonly [T in EInvoiceTextTerm]: EInvoiceTextRule }

/** An XRechnung's text rules: EN 16931's, with each term XRechnung needs needed by its rule, and its payment terms holding no Skonto line. */
function xrechnungTexts(): EInvoiceTextRules {
  const rules: Record<string, EInvoiceTextRule> = { ...E_INVOICE_TEXTS }
  for (const [term, rule] of Object.entries(XRECHNUNG_TEXT_NEEDS)) rules[term] = { ...E_INVOICE_TEXTS[term as EInvoiceTextTerm], required: rule }
  rules['BT-20'] = { ...E_INVOICE_TEXTS['BT-20'], check: held(skontoBreak) }
  return rules as EInvoiceTextRules
}

/**
 * Each kind's text rules, one table per kind over every term (0038): the
 * validator reads a literal by its kind's, the runtime what the data
 * resolved, so the two cannot hold one term of one kind to two rules. A
 * kind without a table does not compile.
 */
export const E_INVOICE_KIND_TEXTS: { readonly [K in EInvoiceKind]: EInvoiceTextRules } = {
  facturX: E_INVOICE_TEXTS,
  xrechnung: xrechnungTexts(),
}

/** Each part of an address, by its business term. */
type AddressTerms = { readonly [A in keyof EInvoiceAddress]-?: EInvoiceTextTerm }

/** Each part of the seller's contact, by its business term. */
type ContactTerms = { readonly [C in keyof SellerContact]-?: EInvoiceTextTerm }

/**
 * Which term each text of an e-invoice is, by where it stands in it: the
 * type of `E_INVOICE_TEXT_TERMS`, over every text the format has. A legal
 * registration and an electronic address are named by their identifier's
 * term; their schemes are codes, not texts.
 */
export interface EInvoiceTextTerms {
  readonly number: EInvoiceTextTerm
  readonly businessProcess: EInvoiceTextTerm
  readonly buyerReference: EInvoiceTextTerm
  readonly terms: EInvoiceTextTerm
  readonly seller: { readonly [K in Exclude<keyof EInvoiceSeller, 'address' | 'contact'>]-?: EInvoiceTextTerm } & {
    readonly contact: ContactTerms
    readonly address: AddressTerms
  }
  readonly buyer: { readonly [K in Exclude<keyof EInvoiceBuyer, 'address'>]-?: EInvoiceTextTerm } & { readonly address: AddressTerms }
  /** A VAT category's exemption reason. */
  readonly reason: EInvoiceTextTerm
  readonly payment: { readonly [K in Exclude<keyof PaymentInstructions, 'means'>]-?: EInvoiceTextTerm }
}

/**
 * Which business term each text of an e-invoice is, by where it stands:
 * the validator reads a literal by it and the runtime what the data
 * resolved, so the two cannot call one text two terms. A line's texts are
 * not here: the columns and the row that give them are `E_INVOICE_LINE_COLUMNS`'
 * and `E_INVOICE_LINE_CODES`'.
 */
export const E_INVOICE_TEXT_TERMS: EInvoiceTextTerms = {
  number: 'BT-1',
  businessProcess: 'BT-23',
  buyerReference: 'BT-10',
  terms: 'BT-20',
  seller: {
    name: 'BT-27',
    vatId: 'BT-31',
    taxNumber: 'BT-32',
    legalId: 'BT-30',
    electronicAddress: 'BT-34',
    contact: { name: 'BT-41', telephone: 'BT-42', email: 'BT-43' },
    address: { line1: 'BT-35', line2: 'BT-36', postalCode: 'BT-38', city: 'BT-37', country: 'BT-40' },
  },
  buyer: {
    name: 'BT-44',
    vatId: 'BT-48',
    legalId: 'BT-47',
    electronicAddress: 'BT-49',
    address: { line1: 'BT-50', line2: 'BT-51', postalCode: 'BT-53', city: 'BT-52', country: 'BT-55' },
  },
  reason: 'BT-120',
  payment: { iban: 'BT-84', bic: 'BT-86', accountName: 'BT-85', remittance: 'BT-83' },
}

/** Whether `text` is what xs:token's white space facet, collapse, leaves it: no tab, line feed or carriage return, no space at either end, and no two in a row. */
function collapsed(text: string): boolean {
  return !/[\t\n\r]|^ | $| {2}/.test(text)
}

/**
 * The text of `term`, held to its rule: one that says nothing is refused,
 * as needed where the e-invoice needs it and as the term left out where it
 * may be, a second spelling of one absent; then its characters, which XML
 * 1.0 must be able to write; then, for a term the XML writes as a token,
 * its white space; then its own rule. That is what the validator says of a
 * literal; an optional term the data resolves to blank is left out of the
 * XML instead, which the runtime decides by `eInvoiceBlank` before it asks
 * here. `kind` is the e-invoice's, whose rules the term is held to.
 */
export function checkEInvoiceText(term: EInvoiceTextTerm, text: string, kind: EInvoiceKind = 'facturX'): PaymentCheck<string> {
  const rule = E_INVOICE_KIND_TEXTS[kind][term]
  if (eInvoiceBlank(text))
    return no(rule.required === undefined ? 'is blank: a term the e-invoice does not hold is left out of it' : neededBy(rule.required, 'is empty'))
  const characters = xmlCharacterBreak(text)
  if (characters !== undefined) return no(characters)
  if (rule.token === true && !collapsed(text)) {
    return no(
      'holds white space the XML would not keep: its schema types the term as a token, read with each tab and line break as a space, two spaces as one, and none at either end',
    )
  }
  return rule.check === undefined ? ok(text) : rule.check(text)
}

/**
 * The identifier of an electronic address (BT-34, BT-49), `term`, given in
 * `scheme`: held to its term's rule, and, under 0204, which says it is a
 * Leitweg-ID, to a Leitweg-ID's shape and check digits (`leitwegIdBreak`,
 * 0038), in an e-invoice of either kind. What a value under another
 * scheme must be is not checked (0037).
 */
export function checkElectronicAddress(term: EInvoiceTextTerm, scheme: AddressScheme, text: string, kind: EInvoiceKind = 'facturX'): PaymentCheck<string> {
  const checked = checkEInvoiceText(term, text, kind)
  if (!checked.ok || scheme !== '0204') return checked
  const broken = leitwegIdBreak(checked.value)
  return broken === undefined ? checked : no(broken)
}
