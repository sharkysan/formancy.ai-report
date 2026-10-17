/**
 * What SIX's Swiss Implementation Guidelines for the QR-bill allow a bill
 * to hold, as checks over text: the account, the reference, each address
 * part, the message, the billing information and the amount; and the
 * slip's size, where it stands on its page, and the room it needs there.
 *
 * One set of rules, read twice. The validator applies them to a text no
 * data can change -- a field of literal runs -- so that the editor refuses
 * a mistyped IBAN where it is written; the runtime applies them to every
 * text once the data has resolved it. Two copies could disagree about
 * which bills are valid, and nobody would find out until a bank refused
 * one.
 *
 * The rules are version 2.3's, in force since 21 November 2025, and one of
 * version 2.4's, valid from 14 November 2026: a QR-IBAN and a QR reference
 * only in CHF. Version 2.4 changes nothing else a bill holds, so a bill
 * these accept is valid under both. "IG" below is the guidelines, Table 8
 * their table of the code's elements.
 *
 * A rule broken is said without the value that broke it: an IBAN, a name
 * or a town may be a person's, and a message reaches logs and screens.
 * Lengths and positions are said; characters are not.
 */
import { mmToPt, roundPt } from './units.js'
import { PAGE_SIZES, type PageDimensions } from './page.js'
import type { QrBillAddress, QrBillCurrency } from './payment-part.js'
import { DECIMAL } from './syntax.js'
import type { PageSettings } from './types.js'

/** What a check made of a text it accepts, or the rule the text breaks. */
export type QrBillCheck<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly rule: string }

function ok<T>(value: T): QrBillCheck<T> {
  return { ok: true, value }
}

function no(rule: string): QrBillCheck<never> {
  return { ok: false, rule }
}

/**
 * The slip: the receipt and the payment part, 210 by 105 mm (IG 3.1),
 * across the foot of an A4 page in portrait. The builders' band and the
 * renderer's slip are this size.
 */
export const QR_BILL_SIZE: PageDimensions = { width: mmToPt(210), height: mmToPt(105) }

/**
 * How far down its page the slip starts, in points from the paper's top:
 * 105 mm above the foot of the A4 page (IG 3.1), stored as every length
 * is. The renderer draws the slip from here, and `qrBillPageBreak` keeps
 * what the page prints above it out of it.
 */
export const QR_BILL_TOP = roundPt(PAGE_SIZES.A4.height - QR_BILL_SIZE.height)

/** A rule a page breaks by carrying a QR-bill, and what it is said of: the page's size and orientation, or its top margin. */
export interface QrBillPageBreak {
  readonly field: 'page' | 'topMargin'
  readonly rule: string
}

/**
 * The rule `page` breaks by carrying a QR-bill's slip, or undefined. The
 * slip is printed across the foot of an A4 page in portrait (IG 3.1), and
 * what the page prints above it ends at its top, `QR_BILL_TOP`: the page
 * header and the body, which start at the top margin. The page footer
 * never meets it: the slip stands in its place on the last page, and the
 * footers of the pages before it are on pages of their own.
 *
 * `above` is what stands between the top margin and the slip that only a
 * render measures: the page header's height, and the instruction to
 * separate that a PDF prints over the slip's top line (IG 3.7). The
 * validator knows neither and passes none, so it refuses what the top
 * margin alone decides; the renderer passes both, and the same rule
 * refuses the rest. One rule, so that where the slip starts and what
 * reaching into it is are decided once.
 */
export function qrBillPageBreak(page: PageSettings, above = 0): QrBillPageBreak | undefined {
  if (page.size !== 'A4' || page.orientation !== 'portrait') {
    return { field: 'page', rule: `a QR-bill is printed across the foot of an A4 page in portrait, and this page is ${page.size} in ${page.orientation}` }
  }
  const reach = page.margins.top + above
  if (reach <= QR_BILL_TOP) return undefined
  // Said to the hundredth above, so that a reach past the top by less than a hundredth never reads as the top itself.
  const said = (Math.ceil(reach * 100 - 1e-6) / 100).toFixed(2)
  const what = above === 0 ? 'the top margin reaches' : 'the top margin, with the page header and the instruction to separate printed above the slip, reaches'
  return { field: 'topMargin', rule: `${what} ${said} pt down the page, past the top of the QR-bill's slip at ${QR_BILL_TOP.toFixed(2)} pt, 105 mm above the paper's foot` }
}

/** Every space, which a person writes into an IBAN or a reference to read it, and which the code never holds. */
const SPACES = /\s+/g

/**
 * A text's remainder modulo 97, each letter read as the two digits ISO
 * 7064 gives it (A is 10, Z is 35), digit by digit: never as one number,
 * which a 25-character reference is too long to be exactly.
 */
function mod97(text: string): number {
  let remainder = 0
  for (const character of text) {
    const value = Number.parseInt(character, 36)
    remainder = (remainder * (value < 10 ? 10 : 100) + value) % 97
  }
  return remainder
}

/** ISO 13616 and ISO 11649 check the same way: the first four characters moved to the end, and the remainder modulo 97 is 1. */
function checksOut(text: string): boolean {
  return mod97(`${text.slice(4)}${text.slice(0, 4)}`) === 1
}

/** An IBAN of Switzerland or Liechtenstein: the country, two check digits, the five-digit institution and twelve digits or capitals. */
const IBAN = /^(?:CH|LI)\d{2}(\d{5})[0-9A-Z]{12}$/

/** The institutions whose IBANs are QR-IBANs (IG 2.8). */
const QR_IID = { first: 30000, last: 31999 }

export interface QrBillAccount {
  /** The IBAN as the code holds it: 21 characters, no spaces. */
  readonly iban: string
  /** Whether its institution is a QR-IID, so that it is paid to with a QR reference. */
  readonly qrIban: boolean
}

/** The account: an IBAN or a QR-IBAN of Switzerland or Liechtenstein (IG Table 8, IBAN), its spaces dropped. */
export function checkQrBillAccount(text: string): QrBillCheck<QrBillAccount> {
  const iban = text.replace(SPACES, '')
  const match = IBAN.exec(iban)
  if (match === null) return no('is not an IBAN of Switzerland or Liechtenstein: CH or LI, two check digits and 17 digits or capitals, 21 characters without spaces')
  if (!checksOut(iban)) return no('has check digits that do not match the rest of it (ISO 13616: the IBAN modulo 97 is 1)')
  const institution = Number(match[1])
  return ok({ iban, qrIban: institution >= QR_IID.first && institution <= QR_IID.last })
}

/** The recursive modulo 10 of IG Annex B, row by row: the carry after each digit. */
const CARRY = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5]

/** The check digit of a QR reference's first 26 digits. */
function qrCheckDigit(digits: string): number {
  let carry = 0
  for (const digit of digits) carry = CARRY[(carry + Number(digit)) % 10] as number
  return (10 - carry) % 10
}

/** The kinds of reference a bill holds (IG Table 8, Tp): a QR reference, a creditor reference, or none. */
export type QrBillReferenceType = 'QRR' | 'SCOR' | 'NON'

export interface QrBillReference {
  readonly type: 'QRR' | 'SCOR'
  /** The reference as the code holds it: no spaces, in the case it was written. */
  readonly reference: string
}

const QR_REFERENCE_LENGTH = 27

/** A creditor reference: RF, two check digits and from one to 21 letters or digits (ISO 11649), in any case. */
const CREDITOR_REFERENCE = /^RF\d{2}[0-9A-Z]{1,21}$/i

/**
 * The reference: a QR reference of 27 digits, the last its check digit
 * (IG 2.12.1, Annex B), or a creditor reference (IG Table 8, Ref), its
 * spaces dropped.
 */
export function checkQrBillReference(text: string): QrBillCheck<QrBillReference> {
  const reference = text.replace(SPACES, '')
  if (/^\d+$/.test(reference)) {
    if (reference.length !== QR_REFERENCE_LENGTH) return no(`is a QR reference of ${reference.length} digits; a QR reference has ${QR_REFERENCE_LENGTH}`)
    if (/^0+$/.test(reference)) return no('is a QR reference of zeros only, which SIX does not allow (IG 2.12.1)')
    if (qrCheckDigit(reference.slice(0, -1)) !== Number(reference.at(-1))) return no('ends in a digit that is not its check digit (IG Annex B: modulo 10, recursive)')
    return ok({ type: 'QRR', reference })
  }
  if (!CREDITOR_REFERENCE.test(reference)) {
    return no('is neither a QR reference, 27 digits, nor a creditor reference, RF, two check digits and up to 21 letters or digits')
  }
  if (!checksOut(reference)) return no('has check digits that do not match the rest of it (ISO 11649: the reference modulo 97 is 1)')
  return ok({ type: 'SCOR', reference })
}

/** What a text of the bill may hold: whether it must, how many characters, and a syntax it must have when it is not empty. */
export interface QrBillTextRule {
  /** What a person calls it, for a message: "postal code". */
  readonly said: string
  readonly required: boolean
  /** Characters, as SIX counts them: every character it allows is one UTF-16 unit. */
  readonly max: number
  readonly syntax?: { readonly pattern: RegExp; readonly rule: string }
}

/**
 * Each part of an address, in the order the code holds them, with what it
 * may hold (IG Table 8, Cdtr and UltmtDbtr). The name, the postal code,
 * the town and the country "must be filled in" (IG 4.3.1). A table over
 * every part, so a part added to `QrBillAddress` without its rule does not
 * compile, and what reads an address reads it in this order.
 */
export const QR_BILL_ADDRESS_RULES: { readonly [P in keyof QrBillAddress]-?: QrBillTextRule } = {
  name: { said: 'name', required: true, max: 70 },
  street: { said: 'street', required: false, max: 70 },
  buildingNumber: { said: 'building number', required: false, max: 16 },
  postalCode: { said: 'postal code', required: true, max: 16 },
  town: { said: 'town', required: true, max: 35 },
  country: {
    said: 'country',
    required: true,
    max: 2,
    syntax: { pattern: /^[A-Z]{2}$/, rule: 'is not a country code: two capital letters, as ISO 3166-1 writes one, such as CH' },
  },
}

/** The most characters the message and the billing information hold together (IG Table 8, AddInf). */
export const MAX_QR_BILL_ADDITIONAL_INFORMATION = 140

/** The unstructured message (IG Table 8, Ustrd). */
export const QR_BILL_MESSAGE_RULE: QrBillTextRule = { said: 'message', required: false, max: MAX_QR_BILL_ADDITIONAL_INFORMATION }

/**
 * The billing information (IG Table 8, StrdBkgInf; 4.3.3): it begins with
 * `//` and the two letters or digits that name its syntax, as SIX's own,
 * `S1`. What follows is the syntax's, which SIX does not standardise.
 */
export const QR_BILL_BILLING_RULE: QrBillTextRule = {
  said: 'billing information',
  required: false,
  max: MAX_QR_BILL_ADDITIONAL_INFORMATION,
  syntax: { pattern: /^\/\/[0-9A-Za-z]{2}/, rule: 'does not begin with //, then the two characters that name its syntax (IG 4.3.3)' },
}

/**
 * Whether a character is one SIX allows (IG 4.1.1): Basic Latin, Latin-1
 * Supplement and Latin Extended-A, Ș ș Ț ț, and the euro sign. A line
 * break is not one, so no text can end its line of the code early.
 */
function allowed(codePoint: number): boolean {
  return (codePoint >= 0x20 && codePoint <= 0x7e) || (codePoint >= 0xa0 && codePoint <= 0x17f) || (codePoint >= 0x218 && codePoint <= 0x21b) || codePoint === 0x20ac
}

/**
 * A text of the bill, without the blanks around it, which SIX never sends
 * (IG 4.1.3), checked against `rule` and the characters SIX allows. The
 * first character outside them is named by its position in the text as
 * written, counted in characters from 1, and never quoted.
 */
export function checkQrBillText(text: string, rule: QrBillTextRule): QrBillCheck<string> {
  const value = text.trim()
  const outside = [...value].findIndex((character) => !allowed(character.codePointAt(0) as number))
  if (outside !== -1) {
    // Every blank trimmed is one UTF-16 unit, so the units before the text are as many characters.
    const position = text.length - text.trimStart().length + outside + 1
    return no(`is not written in the characters SIX allows (IG 4.1.1): character ${position} is outside them`)
  }
  if (value === '') return rule.required ? no('is empty, and a QR-bill needs it') : ok(value)
  if (rule.syntax !== undefined && !rule.syntax.pattern.test(value)) return no(rule.syntax.rule)
  if (value.length > rule.max) return no(`is ${value.length} characters long; SIX allows at most ${rule.max}`)
  return ok(value)
}

/** The rule the message and the billing information break together, each already checked on its own, or undefined. */
export function checkQrBillAdditionalInformation(message: string, billingInformation: string): string | undefined {
  const length = message.length + billingInformation.length
  if (length <= MAX_QR_BILL_ADDITIONAL_INFORMATION) return undefined
  return `the message and the billing information are ${length} characters long together; SIX allows at most ${MAX_QR_BILL_ADDITIONAL_INFORMATION}`
}

/** A rule an account, a reference and a currency break together, and the field it is reported on. */
export interface QrBillPairingBreak {
  readonly field: 'reference' | 'currency'
  readonly rule: string
}

/**
 * The rules an account, a reference and a currency break together. A
 * QR-IBAN is paid to with a QR reference and nothing else; a QR reference
 * only to a QR-IBAN (IG Table 8, Tp); and from version 2.4 both are for
 * CHF only (IG 2.4, 2.10). An account or a reference that is not known --
 * read from data, before a render -- is undefined, and nothing is said of
 * it.
 */
export function qrBillPairing(account: 'iban' | 'qrIban' | undefined, reference: QrBillReferenceType | undefined, currency: QrBillCurrency): readonly QrBillPairingBreak[] {
  const breaks: QrBillPairingBreak[] = []
  if (account === 'qrIban' && reference !== undefined && reference !== 'QRR') {
    const has = reference === 'NON' ? 'this bill has none' : 'this is a creditor reference'
    breaks.push({ field: 'reference', rule: `a QR-IBAN is paid to with a QR reference, and ${has}` })
  }
  if (account === 'iban' && reference === 'QRR') breaks.push({ field: 'reference', rule: 'a QR reference is paid to a QR-IBAN, and the account is an IBAN' })
  if (currency !== 'CHF' && (account === 'qrIban' || reference === 'QRR')) {
    breaks.push({ field: 'currency', rule: 'a QR-IBAN and a QR reference are for invoices in CHF only, from version 2.4 of the guidelines, valid from 14 November 2026' })
  }
  return breaks
}

/** The most digits before the point: 999 999 999.99 is the largest amount (IG Table 8, Amt). */
const MAX_WHOLE_DIGITS = 9

/**
 * The amount as the code writes it: the exact decimal's own digits, a
 * point and two decimals (IG Table 8, Amt), from 0.01 to 999 999 999.99.
 * `DECIMAL` admits no leading zero, so none is written. Never rounded: an
 * amount written with more than two decimals is refused, a third decimal
 * of zero among them, so that a template that does not round is refused
 * on its first render.
 */
export function checkQrBillAmount(decimal: string): QrBillCheck<string> {
  if (!DECIMAL.test(decimal)) return no('is not a decimal')
  const [whole = '', fraction = ''] = decimal.replace(/^-/, '').split('.')
  if (fraction.length > 2) return no('has more than two decimals; a QR-bill pays whole cents, so the amount is rounded where it is computed')
  const cents = fraction.padEnd(2, '0')
  if (decimal.startsWith('-') || whole.length > MAX_WHOLE_DIGITS || (whole === '0' && cents === '00')) return no('is not from 0.01 to 999 999 999.99, the amounts a QR-bill pays')
  return ok(`${whole}.${cents}`)
}
