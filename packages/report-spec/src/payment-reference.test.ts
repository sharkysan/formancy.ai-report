import { describe, expect, test } from 'vitest'
import { checkCreditorReference, checkIbanCheckDigits, withoutSpaces } from './payment-reference.js'
import type { PaymentCheck } from './payment-reference.js'

/** The rule a check says is broken, or undefined when it accepts the value. */
function broken<T>(check: PaymentCheck<T>): string | undefined {
  return check.ok ? undefined : check.rule
}

/** The value a check accepts; fails the test with the rule otherwise. */
function accepted<T>(check: PaymentCheck<T>): T {
  if (!check.ok) throw new Error(`refused: ${check.rule}`)
  return check.value
}

const SHAPE = 'is not shaped as a creditor reference'
const IBAN_DIGITS = 'has check digits that do not match the rest of it (ISO 13616: the IBAN modulo 97 is 1)'
const REFERENCE_DIGITS = 'has check digits that do not match the rest of it (ISO 11649: the reference modulo 97 is 1)'

describe("an IBAN's check digits", () => {
  // The EPC's two samples (EPC069-12 2.3), SIX's QR-IBAN (IG Annex A) and
  // the PSA's Austrian one (PSA v3.0 8): one check reads them all, so a
  // QR-bill and an EPC QR code cannot disagree about which account is
  // typed right.
  test("take the EPC's, SIX's and the PSA's sample accounts", () => {
    for (const iban of ['DE71110220330123456789', 'FR1420041010050500013M02606', 'CH4431999123000889012', 'AT682011131032423628']) {
      expect(accepted(checkIbanCheckDigits(iban)), iban).toBe(iban)
    }
  })

  // One digit typed wrong, or two swapped, is what ISO 13616's check
  // digits are for: a code with one pays nobody, or somebody else.
  test('refuse a digit typed wrong and two digits swapped', () => {
    expect(broken(checkIbanCheckDigits('DE71110220330123456788'))).toBe(IBAN_DIGITS)
    expect(broken(checkIbanCheckDigits('DE71110220330123456798'))).toBe(IBAN_DIGITS)
    expect(broken(checkIbanCheckDigits('DE17110220330123456789'))).toBe(IBAN_DIGITS)
  })

  // The remainder is taken digit by digit, never of one number: a French
  // IBAN is 27 characters, its letters two digits each, far past the 2^53
  // a JavaScript number holds exactly. Read as one number, its last digits
  // would be lost and a wrong one would pass.
  test('are checked exactly on an IBAN far longer than a number holds', () => {
    expect(accepted(checkIbanCheckDigits('MT84MALT011000012345MTLCAST001S'))).toBe('MT84MALT011000012345MTLCAST001S')
    expect(broken(checkIbanCheckDigits('MT84MALT011000012345MTLCAST001T'))).toBe(IBAN_DIGITS)
  })
})

describe('a creditor reference', () => {
  // ISO 11649's own example, printed in groups of four as an invoice
  // prints it: the code holds it without the spaces.
  test('is taken without its spaces, in the case it was written', () => {
    expect(accepted(checkCreditorReference('RF18 5390 0754 7034', SHAPE))).toBe('RF18539007547034')
    expect(accepted(checkCreditorReference('rf18539007547034', SHAPE))).toBe('rf18539007547034')
    expect(accepted(checkCreditorReference('RF741', SHAPE))).toBe('RF741')
    expect(accepted(checkCreditorReference('RF18000000000539007547034', SHAPE))).toHaveLength(25)
  })

  // What is not shaped as one is refused in the caller's words: a QR-bill
  // says what else its reference may be, an EPC QR code that it holds no
  // other. One shape, so the two cannot disagree about what is one.
  test("is refused in the caller's words when it is not shaped as one", () => {
    for (const text of ['', 'RF1', 'RF18', 'INV-2026-0042', 'RF180000000005390075470341', 'RF18 5390 0754 7034 !', 'XX18539007547034']) {
      expect(broken(checkCreditorReference(text, SHAPE)), text).toBe(SHAPE)
    }
  })

  // One character typed wrong is what its check digits are for.
  test('is refused when its check digits do not match', () => {
    expect(broken(checkCreditorReference('RF19539007547034', SHAPE))).toBe(REFERENCE_DIGITS)
    expect(broken(checkCreditorReference('RF720191230100405JSH0438', SHAPE))).toBe(REFERENCE_DIGITS)
  })
})

describe('spaces', () => {
  // A person writes an IBAN or a reference in groups to read it; the code
  // never holds the gaps, of whatever kind: a no-break space copied from a
  // document is as much a gap as a space.
  test('are every gap, dropped', () => {
    expect(withoutSpaces('DE71 1102 2033\u00a00123 4567 89\t')).toBe('DE71110220330123456789')
  })
})
