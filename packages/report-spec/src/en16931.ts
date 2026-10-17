/**
 * EN 16931's rules for what an e-invoice holds, as checks over text: each
 * answers the value the XML is written with, or the rule the text breaks,
 * named by its business term (BT) and its business rule (BR) and never by
 * the value, which may be a person's name, account or VAT identifier.
 *
 * One set of rules, read twice, as the QR-bill's are (0022): the validator
 * applies them to a text no data can change, so that the editor refuses a
 * country written UK where it is written; the runtime applies the same
 * functions to every text once the data has resolved it. Two copies could
 * disagree about which invoices are valid, and nobody would find out until
 * a buyer's system refused one. The arithmetic -- the totals and the VAT
 * breakdown -- is not here: the runtime computes it once
 * (`e-invoice-totals.ts`), so it is right by construction and not checked.
 *
 * The rules are CEN/TC 434's CII artefacts 1.3.17, each fatal there and in
 * the 1.3.16 the pinned validators run; the e-invoice gate holds every id
 * `EN16931_RULES` lists to a fatal rule of its pinned schematron. The one
 * that is not CEN's, the time of supply, is the UStG's, and says so. Which
 * release each check follows where they differ, 0027 says: EL as a VAT
 * prefix only.
 */
import { checkEpcBic, checkEpcIban } from './epc-payload.js'
import { COUNTRY_CODES, SCHEME_IDS, UNIT_CODES, VAT_PREFIXES } from './e-invoice.js'
import type { CountryCode, EInvoiceAddress, EInvoiceBuyer, EInvoiceSeller, PaymentInstructions, SchemeId, UnitCode, VatCategory, VatCategoryCode } from './e-invoice.js'
import { no, ok, withoutSpaces } from './payment-reference.js'
import type { PaymentCheck } from './payment-reference.js'
import { DECIMAL, isCalendarDate } from './syntax.js'
import type { FieldType } from './types.js'

/**
 * Every rule of EN 16931 a refusal here names, and no other. The gate reads
 * this list; `en16931.test.ts` holds it to the ids the rules say.
 */
export const EN16931_RULES = [
  'BR-02',
  'BR-03',
  'BR-06',
  'BR-07',
  'BR-09',
  'BR-11',
  'BR-16',
  'BR-21',
  'BR-22',
  'BR-23',
  'BR-24',
  'BR-25',
  'BR-26',
  'BR-27',
  'BR-29',
  'BR-61',
  'BR-CL-11',
  'BR-CL-14',
  'BR-CL-23',
  'BR-CO-04',
  'BR-CO-09',
  'BR-CO-17',
  'BR-CO-18',
  'BR-CO-19',
  'BR-CO-26',
  'BR-DEC-16',
  'BR-DEC-23',
  'BR-S-02',
  'BR-S-05',
  'BR-S-08',
  'BR-S-10',
  'BR-E-01',
  'BR-E-02',
  'BR-E-05',
  'BR-E-10',
  'BR-AE-01',
  'BR-AE-02',
  'BR-AE-05',
  'BR-AE-10',
] as const
export type En16931Rule = (typeof EN16931_RULES)[number]

/** What a rule says, with the ids of the rules it is: the one way a message here names one, so that every id is a listed one. */
export function en16931Rule(id: En16931Rule | readonly En16931Rule[], said: string): string {
  return `${said} (${typeof id === 'string' ? id : id.join(', ')})`
}

/**
 * The section of the UStG that asks a German invoice for "die vollständige
 * Anschrift" of the seller and of the buyer (§ 14 Abs. 4 Satz 1 Nr. 1,
 * read on gesetze-im-internet.de on 17 October 2026): their street, post
 * code and city, which no rule of CEN's asks for. BR-08 and BR-10 need
 * only that each party has a postal address (BG-5, BG-8), and BR-09 and
 * BR-11 its country. It is the law's, not one of CEN's rules, and so not
 * in `EN16931_RULES`.
 */
export const FULL_ADDRESS = '§ 14 Abs. 4 Satz 1 Nr. 1 UStG'

/** What asks for a term an e-invoice cannot leave out: one of EN 16931's rules, or the UStG's full address. */
export type EInvoiceNeed = En16931Rule | typeof FULL_ADDRESS

/** What a refusal says of a term `need` asks for that is `said` -- empty, or without a value -- and what asks for it: a rule of CEN's by its id, the UStG by its section and what it asks. */
export function neededBy(need: EInvoiceNeed, said: string): string {
  return need === FULL_ADDRESS ? `${said}, and a German invoice gives the full address of the seller and the buyer (${FULL_ADDRESS})` : en16931Rule(need, `${said}, and an e-invoice needs it`)
}

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
 */
export type EInvoiceTextTerm =
  | 'BT-1'
  | 'BT-10'
  | 'BT-20'
  | 'BT-27'
  | 'BT-30'
  | 'BT-31'
  | 'BT-32'
  | 'BT-35'
  | 'BT-36'
  | 'BT-37'
  | 'BT-38'
  | 'BT-40'
  | 'BT-44'
  | 'BT-47'
  | 'BT-48'
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
  'BT-27': { what: "the seller's name (BT-27)", required: 'BR-06' },
  'BT-30': { what: "the seller's legal registration identifier (BT-30)", token: true },
  'BT-31': { what: "the seller's VAT identifier (BT-31)", check: checkVatIdentifier },
  'BT-32': { what: "the seller's tax registration identifier (BT-32)", token: true },
  'BT-35': { what: "the seller's address line (BT-35)", required: FULL_ADDRESS },
  'BT-36': { what: "the seller's second address line (BT-36)" },
  'BT-37': { what: "the seller's city (BT-37)", required: FULL_ADDRESS },
  'BT-38': { what: "the seller's post code (BT-38)", required: FULL_ADDRESS, token: true },
  'BT-40': { what: "the seller's country code (BT-40)", required: 'BR-09', check: checkCountryCode },
  'BT-44': { what: "the buyer's name (BT-44)", required: 'BR-07' },
  'BT-47': { what: "the buyer's legal registration identifier (BT-47)", token: true },
  'BT-48': { what: "the buyer's VAT identifier (BT-48)", check: checkVatIdentifier },
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

/** Each part of an address, by its business term. */
type AddressTerms = { readonly [A in keyof EInvoiceAddress]-?: EInvoiceTextTerm }

/** Which term each text of an e-invoice is, by where it stands in it: the type of `E_INVOICE_TEXT_TERMS`, over every text the format has. */
export interface EInvoiceTextTerms {
  readonly number: EInvoiceTextTerm
  readonly buyerReference: EInvoiceTextTerm
  readonly terms: EInvoiceTextTerm
  readonly seller: { readonly [K in Exclude<keyof EInvoiceSeller, 'address'>]-?: EInvoiceTextTerm } & { readonly address: AddressTerms }
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
  buyerReference: 'BT-10',
  terms: 'BT-20',
  seller: { name: 'BT-27', vatId: 'BT-31', taxNumber: 'BT-32', legalId: 'BT-30', address: { line1: 'BT-35', line2: 'BT-36', postalCode: 'BT-38', city: 'BT-37', country: 'BT-40' } },
  buyer: { name: 'BT-44', vatId: 'BT-48', legalId: 'BT-47', address: { line1: 'BT-50', line2: 'BT-51', postalCode: 'BT-53', city: 'BT-52', country: 'BT-55' } },
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
 * here.
 */
export function checkEInvoiceText(term: EInvoiceTextTerm, text: string): PaymentCheck<string> {
  const rule = E_INVOICE_TEXTS[term]
  if (eInvoiceBlank(text)) return no(rule.required === undefined ? 'is blank: a term the e-invoice does not hold is left out of it' : neededBy(rule.required, 'is empty'))
  const characters = xmlCharacterBreak(text)
  if (characters !== undefined) return no(characters)
  if (rule.token === true && !collapsed(text)) {
    return no('holds white space the XML would not keep: its schema types the term as a token, read with each tab and line break as a space, two spaces as one, and none at either end')
  }
  return rule.check === undefined ? ok(text) : rule.check(text)
}

/** How a decimal term of the e-invoice is held: what a refusal calls it, the rule a null breaks, and what it may be. */
export interface EInvoiceDecimalRule {
  readonly what: string
  /** The rule a final render's null breaks; absent, the term may be left out. */
  readonly required?: En16931Rule
  /** The rule more than two decimals break, for a term the XML writes as an amount with two. */
  readonly cents?: En16931Rule
  /** The rule a negative value breaks, for a term that may not be one. */
  readonly least?: En16931Rule
}

/**
 * Each decimal term the runtime reads from data, by its business term:
 * the line's quantity, net price and net amount, and the paid amount. The
 * totals and the breakdown are not here: the runtime computes them.
 */
export type EInvoiceDecimalTerm = 'BT-129' | 'BT-146' | 'BT-131' | 'BT-113'

export const E_INVOICE_DECIMALS: { readonly [T in EInvoiceDecimalTerm]: EInvoiceDecimalRule } = {
  'BT-129': { what: 'the invoiced quantity (BT-129)', required: 'BR-22' },
  'BT-146': { what: 'the item net price (BT-146)', required: 'BR-26', least: 'BR-27' },
  'BT-131': { what: 'the line net amount (BT-131)', required: 'BR-24', cents: 'BR-DEC-23' },
  'BT-113': { what: 'the paid amount (BT-113)', cents: 'BR-DEC-16' },
}

/**
 * The decimal of `term`, an exact decimal as a string, as the XML writes
 * it: an amount with exactly two decimals, from its own digits; a quantity
 * or a price as written. Never rounded, and never read through a
 * JavaScript number: an amount of 10.505 is refused, so that a template
 * that does not round where it computes a line is refused on its first
 * render, rather than writing another amount than its page prints. 10.500
 * is the same number of cents, and is written 10.50.
 */
export function checkEInvoiceDecimal(term: EInvoiceDecimalTerm, decimal: string): PaymentCheck<string> {
  if (!DECIMAL.test(decimal)) return no('is not a decimal')
  const rule = E_INVOICE_DECIMALS[term]
  const negative = decimal.startsWith('-')
  if (negative && rule.least !== undefined) return no(en16931Rule(rule.least, 'is negative, and a net price never is: a discount is a line of negative quantity at a positive price'))
  if (rule.cents === undefined) return ok(decimal)
  const [whole = '', fraction = ''] = decimal.replace(/^-/, '').split('.')
  if (/[1-9]/.test(fraction.slice(2))) {
    return no(en16931Rule(rule.cents, 'is not a whole number of cents, and the XML writes it with two decimals at most: it is rounded where the template computes it'))
  }
  return ok(`${negative ? '-' : ''}${whole}.${fraction.slice(0, 2).padEnd(2, '0')}`)
}

/** A date term of the e-invoice: what a refusal calls it, and the rule a final render's null breaks where the e-invoice needs it. */
export interface EInvoiceDateRule {
  readonly what: string
  readonly required?: En16931Rule
}

export type EInvoiceDateTerm = 'BT-2' | 'BT-9' | 'BT-72' | 'BT-73' | 'BT-74'

/** Each date term, by its business term. */
export const E_INVOICE_DATES: { readonly [T in EInvoiceDateTerm]: EInvoiceDateRule } = {
  'BT-2': { what: 'the issue date (BT-2)', required: 'BR-03' },
  'BT-9': { what: 'the payment due date (BT-9)' },
  'BT-72': { what: 'the delivery date (BT-72)' },
  'BT-73': { what: "the invoicing period's start (BT-73)" },
  'BT-74': { what: "the invoicing period's end (BT-74)" },
}

/**
 * A date term the data resolved, held to a day on the calendar written
 * YYYY-MM-DD, as the runtime holds a date. The editing core types a date
 * term as the ISO string a date field is read as, so any text passes it;
 * one that is not a day -- a name, 2026-02-29, a moment with its time --
 * would be written as a date no validator reads as one.
 */
export function checkEInvoiceDate(text: string): PaymentCheck<string> {
  return isCalendarDate(text) ? ok(text) : no('is not a day on the calendar written YYYY-MM-DD')
}

/** What a line's term is read from: its business term, whose rule holds it, what a refusal calls it, and the types of field that can give it. */
export interface EInvoiceLineTerm {
  readonly term: EInvoiceTextTerm | EInvoiceDecimalTerm
  readonly what: string
  readonly types: readonly FieldType[]
}

export type EInvoiceLineColumn = 'name' | 'quantity' | 'netPrice' | 'netAmount'
export type EInvoiceLineCode = 'id' | 'unit' | 'vat'

/**
 * Each term a column of the lines' table prints, in the order the XML
 * holds a line's. A column prints a detail field of one of these types, or
 * an expression the editing core holds to what it reads them as: one
 * table, so the validator and the core cannot take a column for two
 * things.
 */
export const E_INVOICE_LINE_COLUMNS: { readonly [K in EInvoiceLineColumn]: EInvoiceLineTerm } = {
  name: { term: 'BT-153', what: E_INVOICE_TEXTS['BT-153'].what, types: ['string'] },
  quantity: { term: 'BT-129', what: E_INVOICE_DECIMALS['BT-129'].what, types: ['integer', 'decimal'] },
  netPrice: { term: 'BT-146', what: E_INVOICE_DECIMALS['BT-146'].what, types: ['integer', 'decimal'] },
  netAmount: { term: 'BT-131', what: E_INVOICE_DECIMALS['BT-131'].what, types: ['integer', 'decimal'] },
}

/** Each code read from a line's row, a detail field of one of these types or an expression held to them in the same way. */
export const E_INVOICE_LINE_CODES: { readonly [K in EInvoiceLineCode]: EInvoiceLineTerm } = {
  id: { term: 'BT-126', what: E_INVOICE_TEXTS['BT-126'].what, types: ['string', 'integer'] },
  unit: { term: 'BT-130', what: E_INVOICE_TEXTS['BT-130'].what, types: ['string'] },
  vat: { term: 'BT-151', what: E_INVOICE_TEXTS['BT-151'].what, types: ['string'] },
}

/**
 * The rule an invoicing period breaks whose dates the data resolved, or
 * undefined: it ends no earlier than it starts (BR-29). Both are calendar
 * dates written YYYY-MM-DD, as the runtime's dates are, so they compare as
 * text.
 */
export function checkInvoicingPeriod(start: string, end: string): string | undefined {
  if (!isCalendarDate(start) || !isCalendarDate(end)) return 'the invoicing period is not two dates written YYYY-MM-DD'
  return end < start ? en16931Rule('BR-29', 'the invoicing period ends (BT-74) before it starts (BT-73)') : undefined
}

/** The rule an invoicing period breaks by holding neither date (BR-CO-19), or undefined: `start` and `end` say which it holds. */
export function periodBreak(start: boolean, end: boolean): string | undefined {
  return start || end ? undefined : en16931Rule('BR-CO-19', 'an invoicing period has a start (BT-73), an end (BT-74), or both')
}

/**
 * The rule an invoice breaks that says nothing of when it was supplied, or
 * undefined: § 14 (4) 1 no. 6 UStG asks a German invoice for the time of
 * supply, which the XML gives as a delivery date or an invoicing period.
 * Not one of CEN's rules: FeRD's BR-FX-DE-04, as the specification is
 * transcribed [S], only warns of an invoice without one.
 */
export function supplyBreak(delivered: boolean, period: boolean): string | undefined {
  return delivered || period ? undefined : 'a German invoice says when it was supplied: a delivery date (BT-72), an invoicing period (BG-14), or both (§ 14 Abs. 4 Satz 1 Nr. 6 UStG)'
}

/** The rules of the seller's identifiers each VAT category's lines need, in the order the categories are listed. */
const SELLER_VAT_RULES: { readonly [C in VatCategoryCode]: En16931Rule } = { S: 'BR-S-02', E: 'BR-E-02', AE: 'BR-AE-02' }

/**
 * The rules the seller's identifiers break, `has` saying which it holds,
 * for an invoice whose lines are in categories of `codes`:
 * - BR-CO-26: a buyer identifies a seller by its VAT identifier or its
 *   legal registration (BT-29, the third way, this version does not write);
 * - BR-S-02, BR-E-02, BR-AE-02: a line in any of the three categories needs
 *   the seller's VAT identifier or its tax number.
 *
 * The validator passes what the template declares: every line is in a
 * category the invoice declares, and every invoice has a line, so a rule
 * of a declared category is one some render breaks. The runtime passes
 * the categories its lines use and the identifiers that print.
 */
export function sellerIdentificationBreaks(has: { readonly vatId: boolean; readonly taxNumber: boolean; readonly legalId: boolean }, codes: readonly VatCategoryCode[]): readonly string[] {
  const breaks: string[] = []
  if (!has.vatId && !has.legalId) {
    breaks.push(en16931Rule('BR-CO-26', 'the seller has neither a VAT identifier (BT-31) nor a legal registration identifier (BT-30), one of which a buyer identifies a seller by'))
  }
  const rules = (Object.keys(SELLER_VAT_RULES) as VatCategoryCode[]).filter((code) => codes.includes(code)).map((code) => SELLER_VAT_RULES[code])
  if (!has.vatId && !has.taxNumber && rules.length > 0) {
    breaks.push(en16931Rule(rules, 'the seller has neither a VAT identifier (BT-31) nor a tax registration identifier (BT-32), one of which a line of these VAT categories needs'))
  }
  return breaks
}

/**
 * The rule the buyer's identifiers break, or undefined: a reverse-charged
 * line moves the tax to the buyer, and needs it named by its VAT identifier
 * or its legal registration (BR-AE-02).
 */
export function buyerIdentificationBreak(has: { readonly vatId: boolean; readonly legalId: boolean }, codes: readonly VatCategoryCode[]): string | undefined {
  if (!codes.includes('AE') || has.vatId || has.legalId) return undefined
  return en16931Rule('BR-AE-02', "a reverse-charged line needs the buyer's VAT identifier (BT-48) or its legal registration identifier (BT-47), and the buyer has neither")
}

/**
 * A rate in per cent (BT-119, BT-152), as this version takes one: from 0 to
 * below 100, an exact decimal with two places at most. Chosen, not
 * measured, as `limits.ts`'s bounds are: Germany's 19 and 7 need none, and
 * a rate past the bound is a typo, or a rate in hundredths.
 */
const RATE = /^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/

/** A rate without the trailing zeros that do not change its value: 19.00 is 19, 5.50 is 5.5. */
function byValue(rate: string): string {
  return rate.includes('.') ? rate.replace(/\.?0+$/, '') : rate
}

/** A rate below 0.5 by value: XPath's `round` makes it 0, which BR-CO-17 reads as a breakdown whose tax rounds to 0. */
const BELOW_HALF = /^0\.[0-4]/

/** What a rate must be for each code, and the rule a rate that is not breaks. */
const RATE_RULES: { readonly [C in VatCategoryCode]: { readonly zero: boolean; readonly rule: string } } = {
  S: { zero: false, rule: en16931Rule('BR-S-05', "is 0, and a standard rated category's rate is more than 0") },
  E: { zero: true, rule: en16931Rule('BR-E-05', "is not 0, and an exempt category's rate is 0") },
  AE: { zero: true, rule: en16931Rule('BR-AE-05', "is not 0, and a reverse-charged category's rate is 0") },
}

/**
 * The rate of a category of `code`, by value, without the trailing zeros
 * that do not change it: more than 0 when standard rated (BR-S-05), 0 when
 * exempt or reverse-charged (BR-E-05, BR-AE-05). Compared as text, never
 * as a JavaScript number: report-spec has no decimal, and needs none.
 *
 * And a standard rate of 0.5 or more (BR-CO-17). CEN's rule rounds the
 * rate first, and XPath's round(0.4) is 0: a breakdown whose rate rounds
 * to 0 must then hold a tax that rounds to 0, which a standard rated
 * category's tax does not past a small basis -- at 0.4, one of 125 or
 * more. No rate of the EU's is that low.
 */
export function checkVatRate(code: VatCategoryCode, rate: string): PaymentCheck<string> {
  if (!RATE.test(rate)) return no('is not a rate this release takes: a percentage from 0 to below 100, an exact decimal of two places at most')
  const value = byValue(rate)
  if ((value === '0') !== RATE_RULES[code].zero) return no(RATE_RULES[code].rule)
  if (code === 'S' && BELOW_HALF.test(value)) {
    return no(en16931Rule('BR-CO-17', "is below 0.5, which BR-CO-17 rounds to 0, and a breakdown whose rate rounds to 0 holds a tax that rounds to 0 too: a standard rated category's tax would not, past a small basis"))
  }
  return ok(value)
}

/**
 * The rule a category's exemption reason (BT-120) breaks, or undefined:
 * exempt and reverse-charged categories say why (BR-E-10, BR-AE-10), and a
 * standard rated one has no reason to give (BR-S-10).
 */
export function vatReasonBreak(code: VatCategoryCode, hasReason: boolean): string | undefined {
  if (code === 'S') return hasReason ? en16931Rule('BR-S-10', 'a standard rated category gives no exemption reason') : undefined
  if (hasReason) return undefined
  return code === 'E'
    ? en16931Rule('BR-E-10', 'an exempt category gives its exemption reason')
    : en16931Rule('BR-AE-10', 'a reverse-charged category gives its reason, "Reverse charge" or its words in the invoice\'s language')
}

/** A rule a list of categories breaks, and the category and field it is said of. */
export interface VatCategoryBreak {
  readonly index: number
  readonly field: 'code' | 'rate'
  readonly rule: string
}

/** For each code but S, the rule a second category of it breaks: an invoice with a line of the code holds exactly one breakdown of it. */
const ONE_BREAKDOWN: { readonly [C in Exclude<VatCategoryCode, 'S'>]: string } = {
  E: en16931Rule('BR-E-01', 'is a second exempt category, and the exempt lines have exactly one breakdown'),
  AE: en16931Rule('BR-AE-01', 'is a second reverse-charged category, and the reverse-charged lines have exactly one breakdown'),
}

/**
 * The rules a list of categories, each with a rate `checkVatRate` took,
 * breaks together: each is one VAT breakdown (BG-23), so standard rated
 * categories have distinct rates by value (BR-S-08), and there is one
 * exempt and one reverse-charged category at most (BR-E-01, BR-AE-01). Two
 * that would be one breakdown would each claim every one of its lines, and
 * the XML would fail. The later of the two is refused.
 */
export function vatCategoryBreaks(categories: readonly { readonly code: VatCategoryCode; readonly rate: string }[]): readonly VatCategoryBreak[] {
  const seen = new Set<string>()
  const breaks: VatCategoryBreak[] = []
  for (const [index, { code, rate }] of categories.entries()) {
    const breakdown = code === 'S' ? `S ${byValue(rate)}` : code
    if (!seen.has(breakdown)) seen.add(breakdown)
    else if (code === 'S') breaks.push({ index, field: 'rate', rule: en16931Rule('BR-S-08', 'is the rate of an earlier standard rated category, and the standard rated lines have one breakdown for each rate') })
    else breaks.push({ index, field: 'code', rule: ONE_BREAKDOWN[code] })
  }
  return breaks
}

/** The category a line names by `id`, a category the invoice declares (BR-CO-04). */
export function checkLineCategory(id: string, categories: readonly VatCategory[]): PaymentCheck<VatCategory> {
  const category = categories.find((declared) => declared.id === id)
  return category === undefined ? no(en16931Rule('BR-CO-04', 'is not the id of a VAT category this invoice declares, and every line is in one')) : ok(category)
}
