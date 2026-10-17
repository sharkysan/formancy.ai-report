/**
 * What an EPC QR code may hold, as checks over text, and the payload it
 * encodes: the European Payments Council's "Quick Response Code --
 * Guidelines to Enable the Data Capture for the Initiation of a SEPA Credit
 * Transfer", EPC069-12 version 3.1 of 19 March 2024 ("EPC" below, by its
 * section). Where Austria's "QR-Code und BCD Definition", PSA version 3.0
 * of 1 May 2021, is stricter and the EPC allows its rule, the PSA's is
 * taken: an amount as short as it can be written (PSA 3, note 5).
 *
 * One set of rules, read twice, as the QR-bill's are (`qr-bill.ts`): the
 * validator applies them to a text no data can change, so that the editor
 * refuses a mistyped IBAN where it is written, and the runtime to every
 * text once the data has resolved it. The IBAN's check digits and the
 * creditor reference are the checks a QR-bill's are
 * (`payment-reference.ts`); which countries' accounts this code reaches is
 * `sepa.ts`'s table.
 *
 * What the code is: SEPA credit transfers, `SCT`, in euro, written in
 * UTF-8, character set 1. A rule broken is said without the value that
 * broke it: an IBAN, a name or a reference may be a person's. Lengths and
 * positions are said; characters are not.
 */
import { checkCreditorReference, checkIbanCheckDigits, no, ok, withoutSpaces } from './payment-reference.js'
import type { PaymentCheck } from './payment-reference.js'
import { isQrIban } from './qr-bill.js'
import { sepaCountry, sepaIbanCountryOfBic } from './sepa.js'
import { DECIMAL } from './syntax.js'

/** The most bytes the whole payload may take (EPC 2.2): what a version 13 code holds at level M (EPC 2.1). */
export const EPC_MAX_BYTES = 331

/** An IBAN as a person may write one: two letters for its country, two check digits, then letters or digits, in either case. */
const IBAN = /^[A-Za-z]{2}\d{2}[A-Za-z0-9]+$/

/**
 * The account (EPC 2.2, AT-C001: "Only IBAN is allowed"): an IBAN of a
 * country of SEPA, of that country's length, its check digits right. Its
 * spaces are dropped and its letters made capitals, as the electronic form
 * writes it -- after its letters are known to be A to Z, so that no letter
 * becomes two.
 *
 * And no QR-IBAN, which SIX keeps for a QR-bill in francs paid with a QR
 * reference (SIX's QR-bill guidelines 2.8, 2.10): a transfer in euro with
 * a creditor reference or none is not one it is credited by. That rule is
 * SIX's, not the EPC's, and its range is the QR-bill's (`isQrIban`).
 *
 * An e-invoice's payment account (BT-84) is held by this rule too
 * (`en16931.ts`): every credit transfer it writes is paid in euro, and an
 * invoice that prints an EPC QR code beside it names one account.
 */
export function checkEpcIban(text: string): PaymentCheck<string> {
  const written = withoutSpaces(text)
  if (!IBAN.test(written)) return no('is not an IBAN: two letters for its country, two check digits, then letters or digits')
  const iban = written.toUpperCase()
  const country = sepaCountry(iban.slice(0, 2))
  if (country === undefined) return no('is not the IBAN of an account in SEPA: its country is not one EPC409-09 lists')
  if (iban.length !== country.length) return no(`is ${iban.length} characters long, and an IBAN of its country has ${country.length} (SWIFT's IBAN Registry)`)
  const checked = checkIbanCheckDigits(iban)
  if (checked.ok && isQrIban(iban)) {
    return no("is a QR-IBAN, which SIX keeps for QR-bills in francs paid with a QR reference (SIX's QR-bill guidelines 2.8, 2.10), and a SEPA credit transfer in euro carries none")
  }
  return checked
}

/**
 * A BIC (ISO 9362): four letters or digits for the bank, two letters for
 * its country, two letters or digits for its place, and three for a branch
 * or none. The EPC types the element as 8 or 11 alphanumeric characters
 * (2.2, "8/11an"), so a digit is taken in the bank's four, where
 * Wikipedia's article on ISO 9362 gives four letters; SWIFT's own text,
 * which would decide it, could not be read (17 October 2026).
 */
const BIC = /^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/

/** The BIC of the beneficiary's bank (EPC 2.2, AT-C002), of a bank in SEPA. */
export function checkEpcBic(text: string): PaymentCheck<string> {
  if (!BIC.test(text)) {
    return no('is not a BIC: four letters or digits for the bank, two letters for its country, two letters or digits for its place, and three for a branch or none (ISO 9362)')
  }
  if (sepaIbanCountryOfBic(text.slice(4, 6)) === undefined) return no('is not the BIC of a bank in SEPA: its country is not one EPC409-09 lists')
  return ok(text)
}

/** A rule an IBAN and a BIC break together, reported on the BIC. */
export interface EpcPairingBreak {
  readonly field: 'bic'
  readonly rule: string
}

/**
 * The rules an IBAN and a BIC break together. An account outside the EEA
 * is paid to with its bank's BIC: version 002 lets a code leave the BIC
 * out, and "the BIC will continue to be mandatory for SEPA payment
 * transactions involving SCT scheme participants from non-EEA countries"
 * (EPC 2.2). Those participants are the payer's bank as well as the
 * beneficiary's, and the payer is not known here: only the account's side
 * is held.
 *
 * And a BIC is of the account's country, by the territory codes EPC409-09
 * gives each country's BICs and IBANs (5). That pairing is this module's
 * inference, so that a BIC typed for the wrong country is refused: neither
 * EPC document says an account's bank has a BIC of the account's country,
 * and one whose bank's BIC is another country's is refused too. `bic` is
 * null when the code has none; an IBAN or a BIC that is not known -- read
 * from data, before a render, or already refused -- is undefined, and
 * nothing is said of it.
 */
export function epcPairing(iban: string | undefined, bic: string | null | undefined): readonly EpcPairingBreak[] {
  if (iban === undefined) return []
  const country = iban.slice(0, 2)
  if (bic === null) {
    if (sepaCountry(country)?.eea !== false) return []
    return [{ field: 'bic', rule: "an account outside the EEA is paid to with its bank's BIC: EPC069-12 2.2 keeps the BIC mandatory where SCT scheme participants from non-EEA countries take part" }]
  }
  if (bic === undefined || sepaIbanCountryOfBic(bic.slice(4, 6)) === country) return []
  return [{ field: 'bic', rule: "the BIC is of a bank in another country than the IBAN's account (EPC409-09 5 gives each country's BICs and IBANs)" }]
}

/**
 * The structured remittance information (EPC 2.2, AT-T009): "ISO 11649 RF
 * Creditor Reference may be used", and it is the one structured reference
 * this code takes. Checked as a QR-bill's creditor reference is, and then
 * made capitals, as the IBAN's letters are -- after they are known to be A
 * to Z. The EPC marks the reference as one the payer should not change
 * (2.2, "Fixed") and says nothing of its case, so it is written in one
 * case, not left to each banking app; a QR-bill keeps the case it was
 * written in, as SIX says banks draw no distinction.
 */
export function checkEpcReference(text: string): PaymentCheck<string> {
  const checked = checkCreditorReference(text, 'is not a creditor reference: RF, two check digits and up to 21 letters or digits (ISO 11649), the one structured reference this code holds')
  return checked.ok ? ok(checked.value.toUpperCase()) : checked
}

/** What a free text of the code may hold: how many characters. */
export interface EpcTextRule {
  /** Characters, as the EPC counts them: code points, whatever their bytes. */
  readonly max: number
}

/** The beneficiary's name (EPC 2.2, AT-E001): at most 70 characters. */
export const EPC_BENEFICIARY_RULE: EpcTextRule = { max: 70 }

/** The unstructured remittance information (EPC 2.2, AT-T009): at most 140 characters. */
export const EPC_TEXT_RULE: EpcTextRule = { max: 140 }

/** The beneficiary to originator information (EPC 2.2): at most 70 characters, shown to the payer and not sent on (PSA 3, note 8). */
export const EPC_INFORMATION_RULE: EpcTextRule = { max: 70 }

/**
 * Whether a code point is one no text may hold: a control character -- C0,
 * DEL or C1, the line feed and carriage return that separate the code's
 * elements among them (EPC 2.2) -- or the line or paragraph separator a
 * reader may break a line at.
 */
function breaksLine(codePoint: number): boolean {
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f) || codePoint === 0x2028 || codePoint === 0x2029
}

/** Whether a code point is half of a surrogate pair, which UTF-8 cannot write. */
function half(codePoint: number): boolean {
  return codePoint >= 0xd800 && codePoint <= 0xdfff
}

/**
 * A free text of the code, checked against `rule`: its characters and its
 * length. The EPC names character sets (2.1) and no narrower one, so in
 * UTF-8 any character is taken but a control character, a line break or
 * half of one: any of them would end the text's element early, or be
 * written as something else. The first is named by its position, counted
 * in characters from 1, and never quoted. A text is not trimmed: the EPC
 * asks for nothing of the kind. Whether it may be blank is its field's
 * question (`checkEpcField`).
 */
export function checkEpcText(text: string, rule: EpcTextRule): PaymentCheck<string> {
  const characters = [...text]
  for (const [index, character] of characters.entries()) {
    const codePoint = character.codePointAt(0) as number
    if (breaksLine(codePoint)) return no(`holds a control character or a line break at character ${index + 1}, which would end its line of the code early`)
    if (half(codePoint)) return no(`holds half of a character at character ${index + 1}, which UTF-8 cannot write`)
  }
  if (characters.length > rule.max) return no(`is ${characters.length} characters long; the EPC allows at most ${rule.max}`)
  return ok(text)
}

/** The texts a code holds, by their names in its component, in the order its payload holds them. */
export type EpcTextField = 'bic' | 'beneficiary' | 'iban' | 'reference' | 'text' | 'information'

/** How a text of the code is held: what a refusal calls it, whether the code may leave its element unused, and the rule it is held to when it holds one. */
export interface EpcTextFieldRule {
  readonly what: string
  readonly optional: boolean
  readonly check: (text: string) => PaymentCheck<string>
}

/**
 * Each text of the code (EPC 2.2): the name and the IBAN mandatory, the
 * BIC, the reference, the text and the information optional. One table,
 * which the validator reads for a literal text and the runtime for one the
 * data resolved: two could call a field two things, or disagree about
 * which one a code may leave out, and nobody would find out.
 */
export const EPC_TEXT_FIELDS: { readonly [K in EpcTextField]: EpcTextFieldRule } = {
  bic: { what: 'the BIC', optional: true, check: checkEpcBic },
  beneficiary: { what: "the beneficiary's name", optional: false, check: (text) => checkEpcText(text, EPC_BENEFICIARY_RULE) },
  iban: { what: 'the IBAN', optional: false, check: checkEpcIban },
  reference: { what: 'the reference', optional: true, check: checkEpcReference },
  text: { what: 'the text', optional: true, check: (text) => checkEpcText(text, EPC_TEXT_RULE) },
  information: { what: 'the information', optional: true, check: (text) => checkEpcText(text, EPC_INFORMATION_RULE) },
}

/** Whether a text prints nothing a payer reads: empty, or white space alone. */
export function epcBlank(text: string): boolean {
  return text.trim() === ''
}

/**
 * The text of `field`, held to its rule. An element the code holds has one
 * character at least (EPC 2.2: "1..70an", "1..140an"), so a blank text is
 * refused: a required one as needed, an optional one as the element left
 * out, written a second way. That is what the validator says of a literal;
 * an optional text the data resolves to blank is its element unused
 * instead, which the runtime decides by `epcBlank` before it asks here.
 */
export function checkEpcField(field: EpcTextField, text: string): PaymentCheck<string> {
  const { optional, check } = EPC_TEXT_FIELDS[field]
  if (!epcBlank(text)) return check(text)
  return no(optional ? 'is blank, and an element the code holds has one character at least (EPC069-12 2.2): a text the code does not hold is left out' : 'is empty, and an EPC QR code needs it')
}

/**
 * The purpose of the transfer (EPC 2.2, AT-T007): a purpose code, four
 * capital letters, as ISO 20022 writes one and the EPC's sample, GDDS, is.
 */
export function checkEpcPurpose(code: string): PaymentCheck<string> {
  return /^[A-Z]{4}$/.test(code) ? ok(code) : no('is not a purpose code: four capital letters, as ISO 20022 writes one, such as GDDS')
}

/** The most digits before the point: 999999999.99 is the largest amount (EPC 2.2). */
const MAX_WHOLE_DIGITS = 9

/**
 * The amount in euro (EPC 2.2, AT-T002), as the code writes it after `EUR`:
 * from 0.01 to 999999999.99, a point and at most two decimals, and "as
 * short as possible" (PSA 3, note 5) -- no trailing zero after the point,
 * no point without a decimal after it, and no leading zero, which `DECIMAL`
 * admits none of. Written from the exact decimal's own digits, never a
 * JavaScript number. Never rounded: an amount written with more than two
 * decimals is refused, a third decimal of zero among them, so that a
 * template that does not round is refused on its first render.
 */
export function checkEpcAmount(decimal: string): PaymentCheck<string> {
  if (!DECIMAL.test(decimal)) return no('is not a decimal')
  const [whole = '', fraction = ''] = decimal.replace(/^-/, '').split('.')
  if (fraction.length > 2) return no('has more than two decimals; a SEPA credit transfer pays whole cents, so the amount is rounded where it is computed')
  const decimals = fraction.replace(/0+$/, '')
  if (decimal.startsWith('-') || whole.length > MAX_WHOLE_DIGITS || (whole === '0' && decimals === '')) {
    return no('is not from 0.01 to 999999999.99, the amounts an EPC QR code pays (EPC069-12 2.2)')
  }
  return ok(decimals === '' ? whole : `${whole}.${decimals}`)
}

/**
 * What a payload holds, each already checked: absent, undefined or empty is
 * an element the code leaves unused. A reference and a text are never both
 * given: only one of the two may be populated (EPC 2.2, {Or}), which the
 * validator holds a code to.
 */
export interface EpcPayloadFields {
  readonly bic?: string | undefined
  readonly beneficiary: string
  readonly iban: string
  /** As `checkEpcAmount` writes it, without `EUR`. */
  readonly amount?: string | undefined
  readonly purpose?: string | undefined
  readonly reference?: string | undefined
  readonly text?: string | undefined
  readonly information?: string | undefined
}

/**
 * The text the code encodes (EPC 2.2): the service tag `BCD`, the version,
 * the character set `1` for UTF-8, the identification `SCT`, then the
 * BIC, the name, the IBAN, the amount in euro, the purpose, the reference,
 * the text and the information, each on its own line, separated by a line
 * feed. Every element up to the last the code holds is a line, empty when
 * it is unused, and "the last populated element is not followed by any
 * character or element separator" (EPC 2.2; PSA 3).
 *
 * A code with a BIC is written as version 001, as the EPC's first sample
 * is, and one without as 002, the version that lets the BIC be left empty.
 * That a reader of either version takes 001 is a reading of the two
 * versions (0025), not something a test here shows.
 */
export function epcPayload(fields: EpcPayloadFields): string {
  const bic = fields.bic ?? ''
  const amount = fields.amount === undefined || fields.amount === '' ? '' : `EUR${fields.amount}`
  const elements = [
    'BCD',
    bic === '' ? '002' : '001',
    '1',
    'SCT',
    bic,
    fields.beneficiary,
    fields.iban,
    amount,
    fields.purpose ?? '',
    fields.reference ?? '',
    fields.text ?? '',
    fields.information ?? '',
  ]
  let last = elements.length
  while (last > 0 && elements[last - 1] === '') last -= 1
  return elements.slice(0, last).join('\n')
}

/** How many bytes UTF-8 writes `text` in: one to four for each code point. */
export function utf8Length(text: string): number {
  let bytes = 0
  for (const character of text) {
    const codePoint = character.codePointAt(0) as number
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4
  }
  return bytes
}

/** A whole payload, held to the 331 bytes the EPC allows (2.2), counted in UTF-8's bytes and not in characters. */
export function checkEpcPayload(payload: string): PaymentCheck<string> {
  const bytes = utf8Length(payload)
  if (bytes <= EPC_MAX_BYTES) return ok(payload)
  return no(`is ${bytes} bytes long in UTF-8; the EPC allows at most ${EPC_MAX_BYTES} (EPC069-12 2.2), what a version 13 code holds at level M`)
}
