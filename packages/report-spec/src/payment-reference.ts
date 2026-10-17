/**
 * What every payment code a report prints shares: ISO 7064's check modulo
 * 97, which ISO 13616 checks an IBAN with and ISO 11649 a creditor
 * reference; the creditor reference itself; and what a check says.
 *
 * One check, read by the QR-bill's rules (`qr-bill.ts`) and the EPC QR
 * code's (`epc-payload.ts`): two copies could disagree about which account
 * is typed right, and nobody would find out until a bank refused a payment.
 * What only one code allows -- the QR-bill's accounts of Switzerland and
 * Liechtenstein, its QR reference, the EPC's countries of SEPA -- stays
 * with that code's rules.
 *
 * A rule broken is said without the value that broke it: an IBAN or a
 * reference may be a person's.
 */

/** What a check made of a text it accepts, or the rule the text breaks. */
export type PaymentCheck<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly rule: string }

export function ok<T>(value: T): PaymentCheck<T> {
  return { ok: true, value }
}

export function no(rule: string): PaymentCheck<never> {
  return { ok: false, rule }
}

/** Every gap a person writes into an IBAN or a reference to read it, and which a code never holds. */
const SPACES = /\s+/g

export function withoutSpaces(text: string): string {
  return text.replace(SPACES, '')
}

/**
 * A text's remainder modulo 97, each letter read as the two digits ISO
 * 7064 gives it (A is 10, Z is 35), digit by digit: never as one number,
 * which a 27-character IBAN is too long to be exactly.
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

/**
 * An IBAN its code's own rule has already shaped -- its country, its
 * length, its characters -- checked by its check digits (ISO 13616).
 */
export function checkIbanCheckDigits(iban: string): PaymentCheck<string> {
  return checksOut(iban) ? ok(iban) : no('has check digits that do not match the rest of it (ISO 13616: the IBAN modulo 97 is 1)')
}

/** A creditor reference: RF, two check digits and from one to 21 letters or digits (ISO 11649), in any case. */
const CREDITOR_REFERENCE = /^RF\d{2}[0-9A-Z]{1,21}$/i

/**
 * A creditor reference (ISO 11649), its spaces dropped and its case kept as
 * written: the check reads a letter the same in either case, and which
 * case a code holds is that code's rule -- a QR-bill's as written, since
 * "the banks draw no distinction between lower and upper case" (SIX's
 * guidelines, Table 8, Ref); an EPC QR code's in capitals
 * (`epc-payload.ts`). A text that is not shaped as one breaks `shape`, the
 * caller's words for what its code takes instead.
 */
export function checkCreditorReference(text: string, shape: string): PaymentCheck<string> {
  const reference = withoutSpaces(text)
  if (!CREDITOR_REFERENCE.test(reference)) return no(shape)
  return checksOut(reference) ? ok(reference) : no('has check digits that do not match the rest of it (ISO 11649: the reference modulo 97 is 1)')
}
