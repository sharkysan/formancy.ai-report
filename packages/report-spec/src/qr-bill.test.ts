import { describe, expect, test } from 'vitest'
import { PAGE_SIZES } from './page.js'
import {
  checkQrBillAccount,
  checkQrBillAdditionalInformation,
  checkQrBillAmount,
  checkQrBillReference,
  checkQrBillText,
  QR_BILL_ADDRESS_RULES,
  QR_BILL_BILLING_RULE,
  QR_BILL_MESSAGE_RULE,
  QR_BILL_SIZE,
  QR_BILL_TOP,
  qrBillPageBreak,
  qrBillPairing,
} from './qr-bill.js'
import type { QrBillCheck } from './qr-bill.js'
import type { PageSettings } from './types.js'

/** The rule a check says is broken, or undefined when it accepts the value. */
function broken<T>(check: QrBillCheck<T>): string | undefined {
  return check.ok ? undefined : check.rule
}

/** The value a check accepts; fails the test with the rule otherwise. */
function accepted<T>(check: QrBillCheck<T>): T {
  if (!check.ok) throw new Error(`refused: ${check.rule}`)
  return check.value
}

describe('the account', () => {
  // SIX's own examples (IG 2.4, Annex A): two QR-IBANs and two IBANs. A
  // check that refused one of them would refuse every bill of that bank.
  test("takes SIX's example accounts, spaces aside, and tells a QR-IBAN by its QR-IID", () => {
    expect(accepted(checkQrBillAccount('CH44 3199 9123 0008 8901 2'))).toEqual({ iban: 'CH4431999123000889012', qrIban: true })
    expect(accepted(checkQrBillAccount('CH6431961000004421557'))).toEqual({ iban: 'CH6431961000004421557', qrIban: true })
    expect(accepted(checkQrBillAccount('CH52 0483 5012 3456 7100 0'))).toEqual({ iban: 'CH5204835012345671000', qrIban: false })
    expect(accepted(checkQrBillAccount('CH5800791123000889012'))).toEqual({ iban: 'CH5800791123000889012', qrIban: false })
  })

  // The QR-IID is 30000 to 31999 (IG 2.8). One out at either end would
  // pair an ordinary IBAN with a QR reference, or refuse a QR-IBAN its own.
  test('is a QR-IBAN exactly when its institution is 30000 to 31999', () => {
    expect(accepted(checkQrBillAccount('CH4929999123000889012')).qrIban).toBe(false)
    expect(accepted(checkQrBillAccount('CH5830000000000000000')).qrIban).toBe(true)
    expect(accepted(checkQrBillAccount('CH4531999000000000000')).qrIban).toBe(true)
    expect(accepted(checkQrBillAccount('CH5232000123000889012')).qrIban).toBe(false)
  })

  // Liechtenstein's IBANs are the same shape, and an account part may hold
  // capitals: a check for Swiss digits alone would refuse both.
  test("takes Liechtenstein's IBANs, and an account part with capitals", () => {
    expect(accepted(checkQrBillAccount('LI90 0880 0000 0020 1763 0')).qrIban).toBe(false)
    expect(accepted(checkQrBillAccount('LI390880000002017630A')).iban).toBe('LI390880000002017630A')
  })

  // SIX takes only CH and LI (IG Table 8, IBAN), 21 characters, in
  // capitals as ISO 13616 writes one. A German IBAN, a short one or one in
  // lower case would reach a bank that refuses the payment.
  test('refuses another country, another length and lower case', () => {
    for (const text of ['DE51 3704 0044 0532 0130 0', 'CH443199912300088901', 'CH44319991230008890123', 'ch4431999123000889012', 'CH44-3199-9123-0008-8901-2', '']) {
      expect(broken(checkQrBillAccount(text)), text).toBe('is not an IBAN of Switzerland or Liechtenstein: CH or LI, two check digits and 17 digits or capitals, 21 characters without spaces')
    }
  })

  // One digit typed wrong is what the check digits are for (ISO 13616):
  // a bill with it pays nobody, or somebody else.
  test('refuses check digits that do not match', () => {
    expect(broken(checkQrBillAccount('CH4431999123000889013'))).toBe('has check digits that do not match the rest of it (ISO 13616: the IBAN modulo 97 is 1)')
    expect(broken(checkQrBillAccount('CH4531999123000889012'))).toBe('has check digits that do not match the rest of it (ISO 13616: the IBAN modulo 97 is 1)')
  })
})

describe('the reference', () => {
  // SIX's two QR references (IG Annex A, examples 1 and 2), printed in
  // groups as the slip prints them, and a creditor reference. A check that
  // kept the spaces would write them into the code.
  test("takes SIX's QR references and a creditor reference, spaces aside", () => {
    expect(accepted(checkQrBillReference('21 00000 00003 13947 14300 09017'))).toEqual({ type: 'QRR', reference: '210000000003139471430009017' })
    expect(accepted(checkQrBillReference('000008207791225857421286694'))).toEqual({ type: 'QRR', reference: '000008207791225857421286694' })
    expect(accepted(checkQrBillReference('RF18 5390 0754 7034'))).toEqual({ type: 'SCOR', reference: 'RF18539007547034' })
  })

  // "The banks draw no distinction between lower and upper case" (IG Table
  // 8, Ref): a creditor reference in lower case is the same reference, and
  // is kept as written. Its shortest and longest are 5 and 25 characters.
  test('takes a creditor reference in any case, from 5 to 25 characters', () => {
    expect(accepted(checkQrBillReference('rf18539007547034'))).toEqual({ type: 'SCOR', reference: 'rf18539007547034' })
    expect(accepted(checkQrBillReference('RF18000000000539007547034')).reference).toHaveLength(25)
    expect(accepted(checkQrBillReference('RF741')).reference).toHaveLength(5)
    expect(broken(checkQrBillReference('RF180000000005390075470341'))).toBe(
      'is neither a QR reference, 27 digits, nor a creditor reference, RF, two check digits and up to 21 letters or digits',
    )
  })

  // A QR reference is 27 digits, the last its check digit (IG 2.12.1,
  // Annex B), and never all zeros. Each wrong one would be refused by the
  // bank after the bill was printed and sent.
  test('refuses a QR reference of another length, of zeros, or with a wrong check digit', () => {
    expect(broken(checkQrBillReference('21000000000313947143000901'))).toBe('is a QR reference of 26 digits; a QR reference has 27')
    expect(broken(checkQrBillReference('000000000000000000000000000'))).toBe('is a QR reference of zeros only, which SIX does not allow (IG 2.12.1)')
    expect(broken(checkQrBillReference('210000000003139471430009018'))).toBe('ends in a digit that is not its check digit (IG Annex B: modulo 10, recursive)')
  })

  // SIX's own fourth example (IG 2.4, Table 20) is a creditor reference
  // whose remainder is 49, not 1: refused, as a bank would refuse it.
  test("refuses a creditor reference whose check digits do not match, SIX's fourth example among them", () => {
    expect(broken(checkQrBillReference('RF720191230100405JSH0438'))).toBe('has check digits that do not match the rest of it (ISO 11649: the reference modulo 97 is 1)')
    expect(broken(checkQrBillReference('RF19539007547034'))).toBe('has check digits that do not match the rest of it (ISO 11649: the reference modulo 97 is 1)')
  })

  test('refuses what is neither', () => {
    for (const text of ['', 'INV-2026-0042', 'RF1', 'RF18 5390 0754 7034 !']) {
      expect(broken(checkQrBillReference(text)), text).toBe('is neither a QR reference, 27 digits, nor a creditor reference, RF, two check digits and up to 21 letters or digits')
    }
  })
})

describe('a text on the bill', () => {
  // The lengths are IG Table 8's: name 70, street 70, building number 16,
  // postal code 16, town 35. Each is accepted at its bound and refused one
  // past it: a code with a longer one is refused by the bank's reader.
  test('is held to the length SIX allows for its field', () => {
    const bounds = Object.entries(QR_BILL_ADDRESS_RULES).map(([part, rule]) => [part, rule.max])
    expect(bounds).toEqual([
      ['name', 70],
      ['street', 70],
      ['buildingNumber', 16],
      ['postalCode', 16],
      ['town', 35],
      ['country', 2],
    ])
    for (const [part, rule] of Object.entries(QR_BILL_ADDRESS_RULES)) {
      if (part === 'country') continue
      expect(broken(checkQrBillText('a'.repeat(rule.max), rule)), part).toBeUndefined()
      expect(broken(checkQrBillText('a'.repeat(rule.max + 1), rule)), part).toBe(`is ${rule.max + 1} characters long; SIX allows at most ${rule.max}`)
    }
    expect(QR_BILL_MESSAGE_RULE.max).toBe(140)
    expect(QR_BILL_BILLING_RULE.max).toBe(140)
  })

  // The name, the postal code, the town and the country "must be filled
  // in" (IG 4.3.1); the street and the building number may be empty. A
  // field of blanks is empty, and is not sent padded (IG 4.1.3).
  test('is required where SIX requires it, and is sent without blanks around it', () => {
    const required = Object.entries(QR_BILL_ADDRESS_RULES).filter(([, rule]) => rule.required).map(([part]) => part)
    expect(required).toEqual(['name', 'postalCode', 'town', 'country'])
    for (const rule of Object.values(QR_BILL_ADDRESS_RULES)) {
      expect(broken(checkQrBillText('  ', rule))).toBe(rule.required ? 'is empty, and a QR-bill needs it' : undefined)
    }
    expect(accepted(checkQrBillText('  Rue du Lac ', QR_BILL_ADDRESS_RULES.street))).toBe('Rue du Lac')
    expect(accepted(checkQrBillText('', QR_BILL_ADDRESS_RULES.street))).toBe('')
  })

  // IG 4.1.1: Basic Latin, Latin-1, Latin Extended-A, Ș ș Ț ț and the euro
  // sign. A line break inside a field would end its line of the code early
  // and shift every line after it; an emoji is outside the set too. The
  // position is said, never the text: a name is the customer's.
  test("takes only SIX's characters, and says where the first other one is", () => {
    const name = QR_BILL_ADDRESS_RULES.name
    expect(accepted(checkQrBillText('Zoë Ćwikła Ștefănescu-Țuțu ~ ÿ ſ €', name))).toBe('Zoë Ćwikła Ștefănescu-Țuțu ~ ÿ ſ €')
    expect(accepted(checkQrBillText('a\u00a0\u00ff\u0100\u017f\u0218\u021b\u20ac', name))).toBe('a\u00a0\u00ff\u0100\u017f\u0218\u021b\u20ac')
    const outside = 'is not written in the characters SIX allows (IG 4.1.1): character'
    expect(broken(checkQrBillText('Robert\nSchneider', name))).toBe(`${outside} 7 is outside them`)
    expect(broken(checkQrBillText('A\u0180', name))).toBe(`${outside} 2 is outside them`)
    expect(broken(checkQrBillText('A\u0217', name))).toBe(`${outside} 2 is outside them`)
    expect(broken(checkQrBillText('A\u021c', name))).toBe(`${outside} 2 is outside them`)
    expect(broken(checkQrBillText('A\u009f', name))).toBe(`${outside} 2 is outside them`)
    expect(broken(checkQrBillText('A\u007f', name))).toBe(`${outside} 2 is outside them`)
    // An emoji is one character, counted as one, outside the set.
    expect(broken(checkQrBillText('😀 Muster', name))).toBe(`${outside} 1 is outside them`)
    // Counted in the text as written, the blanks before it included.
    expect(broken(checkQrBillText('  Max 😀', name))).toBe(`${outside} 7 is outside them`)
  })

  // A country is ISO 3166-1's two capital letters (IG Table 8, Ctry). A
  // name, or lower case, would be read by the bank as no country it knows.
  test('is a country of two capital letters', () => {
    const country = QR_BILL_ADDRESS_RULES.country
    expect(accepted(checkQrBillText('CH', country))).toBe('CH')
    for (const text of ['ch', 'CHE', 'Schweiz', 'C1']) {
      expect(broken(checkQrBillText(text, country)), text).toBe('is not a country code: two capital letters, as ISO 3166-1 writes one, such as CH')
    }
  })

  // Billing information always begins with // and the two characters that
  // name its syntax (IG 4.3.3): without them, nobody reading it can tell
  // which syntax it is in. A // with no name after it, or half of one, is
  // as unreadable as none.
  test('is billing information only when it begins with // and the name of its syntax', () => {
    expect(accepted(checkQrBillText('//S1/10/10201409/11/200701/20/140.000-53', QR_BILL_BILLING_RULE))).toBe('//S1/10/10201409/11/200701/20/140.000-53')
    expect(accepted(checkQrBillText('//S1', QR_BILL_BILLING_RULE))).toBe('//S1')
    for (const text of ['S1/10/10201409', '//', '//S', '//S/10/10201409', '// S1']) {
      expect(broken(checkQrBillText(text, QR_BILL_BILLING_RULE)), text).toBe('does not begin with //, then the two characters that name its syntax (IG 4.3.3)')
    }
    expect(accepted(checkQrBillText('', QR_BILL_BILLING_RULE))).toBe('')
  })

  // "A common total of up to 140 characters" for the message and the
  // billing information (IG Table 8, AddInf): each within its own bound,
  // the two together past it.
  test('is a message and billing information of 140 characters together at most', () => {
    expect(checkQrBillAdditionalInformation('a'.repeat(70), `//${'b'.repeat(68)}`)).toBeUndefined()
    expect(checkQrBillAdditionalInformation('a'.repeat(71), `//${'b'.repeat(68)}`)).toBe('the message and the billing information are 141 characters long together; SIX allows at most 140')
  })
})

describe('the account, the reference and the currency together', () => {
  // A QR-IBAN goes with a QR reference and nothing else, an IBAN with a
  // creditor reference or none (IG Table 8, Tp; 7.1). From version 2.4,
  // valid from 14 November 2026, a QR-IBAN and a QR reference are for CHF
  // only (IG 2.4, 2.10). A bill that broke one would be refused by the
  // payer's bank.
  test('pair as SIX pairs them', () => {
    expect(qrBillPairing('qrIban', 'QRR', 'CHF')).toEqual([])
    expect(qrBillPairing('iban', 'SCOR', 'CHF')).toEqual([])
    expect(qrBillPairing('iban', 'NON', 'EUR')).toEqual([])
    expect(qrBillPairing('iban', 'SCOR', 'EUR')).toEqual([])
    expect(qrBillPairing('qrIban', 'SCOR', 'CHF')).toEqual([{ field: 'reference', rule: 'a QR-IBAN is paid to with a QR reference, and this is a creditor reference' }])
    expect(qrBillPairing('qrIban', 'NON', 'CHF')).toEqual([{ field: 'reference', rule: 'a QR-IBAN is paid to with a QR reference, and this bill has none' }])
    expect(qrBillPairing('iban', 'QRR', 'CHF')).toEqual([{ field: 'reference', rule: 'a QR reference is paid to a QR-IBAN, and the account is an IBAN' }])
    expect(qrBillPairing('qrIban', 'QRR', 'EUR')).toEqual([
      { field: 'currency', rule: 'a QR-IBAN and a QR reference are for invoices in CHF only, from version 2.4 of the guidelines, valid from 14 November 2026' },
    ])
  })

  // What is not known until a render -- an account or a reference read
  // from data -- is not judged: each rule speaks only of what it is told.
  test('say nothing of what is not known', () => {
    expect(qrBillPairing(undefined, 'SCOR', 'CHF')).toEqual([])
    expect(qrBillPairing('qrIban', undefined, 'CHF')).toEqual([])
    expect(qrBillPairing(undefined, 'QRR', 'EUR')).toEqual([
      { field: 'currency', rule: 'a QR-IBAN and a QR reference are for invoices in CHF only, from version 2.4 of the guidelines, valid from 14 November 2026' },
    ])
    expect(qrBillPairing('qrIban', undefined, 'EUR')).toHaveLength(1)
  })
})

describe('the amount', () => {
  // The code writes the amount with two decimals and no leading zero (IG
  // Table 8, Amt), from the exact decimal's own digits: never a JavaScript
  // number, whose 0.1 + 0.2 is not 0.3.
  test('is written with two decimals, from the exact digits', () => {
    expect(accepted(checkQrBillAmount('1949.75'))).toBe('1949.75')
    expect(accepted(checkQrBillAmount('50'))).toBe('50.00')
    expect(accepted(checkQrBillAmount('0.5'))).toBe('0.50')
    expect(accepted(checkQrBillAmount('0.01'))).toBe('0.01')
    expect(accepted(checkQrBillAmount('999999999.99'))).toBe('999999999.99')
    expect(accepted(checkQrBillAmount('12345678.9'))).toBe('12345678.90')
  })

  // The amount reaches this check from data, so the decimal syntax it is
  // read by must take time in its length, not its square: '-0.' and a long
  // run of digits that then fails backtracked over every split of the run
  // (0.4 s on 20 000 digits and 38 s on these 200 000, measured on 17
  // October 2026), which a hostile value could make arbitrarily long.
  test('is refused in time linear in its length, however it fails', () => {
    const hostile = `-0.${'1'.repeat(200_000)}x`
    const started = Date.now()
    expect(broken(checkQrBillAmount(hostile))).toBe('is not a decimal')
    expect(Date.now() - started).toBeLessThan(1000)
  })

  // "between 0.01 and 999,999,999.99" (IG Table 8, Amt). Zero is the "do
  // not use for payment" bill's, which this module does not print.
  test('is from 0.01 to 999 999 999.99', () => {
    for (const amount of ['0', '0.00', '-1.00', '1000000000', '1000000000.00']) {
      expect(broken(checkQrBillAmount(amount)), amount).toBe('is not from 0.01 to 999 999 999.99, the amounts a QR-bill pays')
    }
  })

  // Never rounded here: an amount with a third decimal is refused, even
  // one that is zero, so that a template that forgot to round fails on
  // its first render rather than on the first total that is not whole cents.
  test('is refused with more than two decimals, rather than rounded', () => {
    for (const amount of ['1191.005', '1191.000', '0.001']) {
      expect(broken(checkQrBillAmount(amount)), amount).toBe('has more than two decimals; a QR-bill pays whole cents, so the amount is rounded where it is computed')
    }
  })

  test('is a decimal', () => {
    for (const amount of ['', '1,50', '1e3', '.5', 'NaN', '007.50', '-0']) expect(broken(checkQrBillAmount(amount)), amount).toBe('is not a decimal')
  })
})

describe('the slip', () => {
  // 210 by 105 mm (IG 3.1), across the whole width of A4: the builders'
  // band and the renderer's slip read their size from here.
  test('is 210 by 105 mm, the width of an A4 page', () => {
    expect(QR_BILL_SIZE).toEqual({ width: 595.28, height: 297.64 })
    expect(QR_BILL_SIZE.width).toBe(PAGE_SIZES.A4.width)
  })

  // The slip ends at the paper's foot (IG 3.1), so its top is the A4
  // page's height less its own, stored as every length is, to the
  // hundredth of a point. The renderer draws it from here: a second
  // subtraction, from another table of paper sizes or another rounding,
  // could put the slip and the rule that keeps its room a hair apart.
  test('starts 105 mm above the foot of the A4 page', () => {
    expect(QR_BILL_TOP).toBe(544.25)
    expect(QR_BILL_TOP).toBeCloseTo(PAGE_SIZES.A4.height - QR_BILL_SIZE.height, 9)
  })
})

describe('the page a slip is printed on', () => {
  const page = (top: number, size: PageSettings['size'] = 'A4', orientation: PageSettings['orientation'] = 'portrait'): PageSettings => ({ size, orientation, margins: { top, right: 42.52, bottom: 56.69, left: 42.52 } })

  // SIX prints the slip across the foot of an A4 page in portrait (IG
  // 3.1): on Letter it would not span the paper, and in landscape it would
  // not stand at its foot. The rule names the page as it is, which is no
  // value of the bill.
  test('is A4 in portrait', () => {
    expect(qrBillPageBreak(page(56.69))).toBeUndefined()
    for (const [size, orientation] of [
      ['A4', 'landscape'],
      ['Letter', 'portrait'],
    ] as const) {
      expect(qrBillPageBreak(page(56.69, size, orientation))).toEqual({ field: 'page', rule: `a QR-bill is printed across the foot of an A4 page in portrait, and this page is ${size} in ${orientation}` })
    }
  })

  // The page header and the body start at the top margin. A top margin
  // that reaches past the slip's top would print the invoice into the
  // slip, and a hundredth of a point is the finest a margin is stored at:
  // one held loosely by as much lets a header's line into it.
  test('leaves the slip its room: a top margin may reach its top and no further', () => {
    expect(qrBillPageBreak(page(QR_BILL_TOP))).toBeUndefined()
    expect(qrBillPageBreak(page(544.26))).toEqual({
      field: 'topMargin',
      rule: "the top margin reaches 544.26 pt down the page, past the top of the QR-bill's slip at 544.25 pt, 105 mm above the paper's foot",
    })
  })

  // What only a render measures -- the page header's height, and the
  // instruction to separate printed over the slip's top line -- counts
  // with the margin under the same rule, so the renderer refuses no page
  // by a rule of its own, and says what it counted.
  test('counts what is printed between the top margin and the slip, when a render knows it', () => {
    expect(qrBillPageBreak(page(500), 44.25)).toBeUndefined()
    expect(qrBillPageBreak(page(500), 44.26)).toEqual({
      field: 'topMargin',
      rule: "the top margin, with the page header and the instruction to separate printed above the slip, reaches 544.26 pt down the page, past the top of the QR-bill's slip at 544.25 pt, 105 mm above the paper's foot",
    })
    // What a render measures is no hundredth: past the top by less than one, it is said to the hundredth above, never as the top itself.
    expect(qrBillPageBreak(page(534.01), 10.2421875)?.rule).toMatch(/reaches 544\.26 pt down the page, past the top of the QR-bill's slip at 544\.25 pt/)
  })

  // A Letter page has no slip to keep room for; its size is the rule it
  // breaks, whatever its margins.
  test('is refused for its size before its margins', () => {
    expect(qrBillPageBreak(page(700, 'Letter'))?.field).toBe('page')
  })
})
