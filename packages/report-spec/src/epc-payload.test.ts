import { describe, expect, test } from 'vitest'
import {
  checkEpcAmount,
  checkEpcBic,
  checkEpcField,
  checkEpcIban,
  checkEpcPayload,
  checkEpcPurpose,
  checkEpcReference,
  checkEpcText,
  EPC_BENEFICIARY_RULE,
  EPC_INFORMATION_RULE,
  EPC_MAX_BYTES,
  EPC_TEXT_FIELDS,
  EPC_TEXT_RULE,
  epcBlank,
  epcPairing,
  epcPayload,
  utf8Length,
} from './epc-payload.js'
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

/**
 * The example IBAN SWIFT's IBAN Registry gives for each country of SEPA
 * (EPC409-09 v8.0, 5), as php-iban's registry.txt holds them: an
 * account number no person holds, of its country's length.
 */
const REGISTRY_EXAMPLES = [
  'AD1200012030200359100100',
  'AL47212110090000000235698741',
  'AT611904300234573201',
  'BE68539007547034',
  'BG80BNBG96611020345678',
  'CH9300762011623852957',
  'CY17002001280000001200527600',
  'CZ6508000000192000145399',
  'DE89370400440532013000',
  'DK5000400440116243',
  'EE382200221020145685',
  'ES9121000418450200051332',
  'FI2112345600000785',
  'FR1420041010050500013M02606',
  'GB29NWBK60161331926819',
  'GI75NWBK000000007099453',
  'GR1601101250000000012300695',
  'HR1210010051863000160',
  'HU42117730161111101800000000',
  'IE29AIBK93115212345678',
  'IS140159260076545510730339',
  'IT60X0542811101000000123456',
  'LI21088100002324013AA',
  'LT121000011101001000',
  'LU280019400644750000',
  'LV80BANK0000435195001',
  'MC5811222000010123456789030',
  'MD24AG000225100013104168',
  'ME25505000012345678951',
  'MK07250120000058984',
  'MT84MALT011000012345MTLCAST001S',
  'NL91ABNA0417164300',
  'NO9386011117947',
  'PL61109010140000071219812874',
  'PT50000201231234567890154',
  'RO49AAAA1B31007593840000',
  'RS35260005601001611379',
  'SE4550000000058398257466',
  'SI56191000000123438',
  'SK3112000000198742637541',
  'SM86U0322509800000000270100',
  'VA59001123000012345678',
]

const OUTSIDE_SEPA = 'is not the IBAN of an account in SEPA: its country is not one EPC409-09 lists'
const QR_IBAN =
  "is a QR-IBAN, which SIX keeps for QR-bills in francs paid with a QR reference (SIX's QR-bill guidelines 2.8, 2.10), and a SEPA credit transfer in euro carries none"
const NOT_AN_IBAN = 'is not an IBAN: two letters for its country, two check digits, then letters or digits'

describe('the IBAN', () => {
  // Every country of SEPA, by the example SWIFT's registry gives for it:
  // a length in the table that disagreed with the registry by one would
  // refuse every account of that country, and nobody would see it until an
  // invoice to one was printed.
  test('takes the example account of every country of SEPA', () => {
    for (const iban of REGISTRY_EXAMPLES) expect(accepted(checkEpcIban(iban)), iban).toBe(iban)
    expect(new Set(REGISTRY_EXAMPLES.map((iban) => iban.slice(0, 2))).size).toBe(REGISTRY_EXAMPLES.length)
  })

  // The EPC's samples (EPC069-12 2.3) and the PSA's (PSA v3.0 8), written
  // in groups of four as an invoice prints them, and in lower case as a
  // person may type one: the code holds the electronic form, no spaces and
  // capitals.
  test("takes the EPC's and the PSA's samples, spaces dropped and capitals made", () => {
    expect(accepted(checkEpcIban('DE71 1102 2033 0123 4567 89'))).toBe('DE71110220330123456789')
    expect(accepted(checkEpcIban('FR14 2004 1010 0505 0001 3M02 606'))).toBe('FR1420041010050500013M02606')
    expect(accepted(checkEpcIban('AT68 2011 1310 3242 3628'))).toBe('AT682011131032423628')
    expect(accepted(checkEpcIban('de52 2109 0007 0088 2993 09'))).toBe('DE52210900070088299309')
  })

  // A length is its country's, exactly (SWIFT's IBAN Registry): a digit
  // dropped or doubled, which check digits miss one time in 97, is refused
  // by its length every time. The message says the lengths, never the
  // account.
  test("is its country's length, exactly", () => {
    expect(broken(checkEpcIban('DE8937040044053201300'))).toBe("is 21 characters long, and an IBAN of its country has 22 (SWIFT's IBAN Registry)")
    expect(broken(checkEpcIban('DE893704004405320130000'))).toBe("is 23 characters long, and an IBAN of its country has 22 (SWIFT's IBAN Registry)")
  })

  // SCT pays within SEPA (EPC409-09): an account of the Faroe Islands or
  // Greenland, which have IBANs of Denmark's shape and are not in SEPA, or
  // one of Brazil or Kosovo, is no account a SEPA credit transfer reaches.
  // Each is SWIFT's own example, its check digits right.
  test('is the account of a country of SEPA', () => {
    for (const iban of ['FO2000400440116243', 'GL2000400440116243', 'BR9700360305000010009795493P1', 'XK051212012345678906', 'AE070331234567890123456']) {
      expect(broken(checkEpcIban(iban)), iban).toBe(OUTSIDE_SEPA)
    }
  })

  // EPC069-12 2.2: "Only IBAN is allowed". A national account number, a
  // sort code, or an IBAN with a hyphen or a letter its alphabet does not
  // have, is refused before its country is looked up. A dotless ı is I
  // made a capital, and would pass as Italy's example account if letters
  // were made capitals first.
  test('is an IBAN and nothing else', () => {
    for (const text of [
      '',
      'DE',
      '0123456789',
      '1234DE89370400440532013000',
      'DE8937040044-0532013000',
      'D189370400440532013000',
      'ıT60X0542811101000000123456',
      'ÄT611904300234573201',
    ]) {
      expect(broken(checkEpcIban(text)), text).toBe(NOT_AN_IBAN)
    }
  })

  test('refuses check digits that do not match', () => {
    expect(broken(checkEpcIban('DE89370400440532013001'))).toBe('has check digits that do not match the rest of it (ISO 13616: the IBAN modulo 97 is 1)')
  })

  // A QR-IBAN, of a Swiss or Liechtenstein institution numbered 30000 to
  // 31999, is "used only for the procedure with a QR reference in the
  // QR-bill" and "only for invoicing and payments in CHF" (SIX's QR-bill
  // guidelines, version 2.4, 2.8 and 2.10): a transfer in euro, with a
  // creditor reference or none, is one its bank does not credit. SIX's own
  // example QR-IBAN and one of Liechtenstein at the range's first
  // institution, their check digits right, are refused by the range the
  // QR-bill's rules hold; an account just outside it on either side is an
  // IBAN, and taken.
  test('is not a QR-IBAN, which only a QR-bill in francs pays', () => {
    for (const iban of ['CH44 3199 9123 0008 8901 2', 'LI7030000123456789012']) expect(broken(checkEpcIban(iban)), iban).toBe(QR_IBAN)
    for (const iban of ['CH4929999123000889012', 'CH5232000123000889012']) expect(accepted(checkEpcIban(iban)), iban).toBe(iban)
  })
})

describe('the BIC', () => {
  // The EPC's and the PSA's BICs, of eleven characters and of eight
  // (ISO 9362). The EPC types the element as alphanumeric (2.2,
  // "8/11an"), so a digit among the four that name the bank is taken:
  // refusing one would refuse a BIC the EPC's own data type allows.
  test('takes eight or eleven characters, as ISO 9362 writes one', () => {
    for (const bic of ['BHBLDEHHXXX', 'GIBAATWW', 'GENODEF1KIL', 'B1BLDEHH']) expect(accepted(checkEpcBic(bic)), bic).toBe(bic)
  })

  // A BIC has no spaces and no lower case, and its country is two letters:
  // anything else would reach the payer's bank as no bank it knows.
  test('refuses another length, lower case, spaces and a country of digits', () => {
    for (const text of ['', 'BHBLDEH', 'BHBLDEHHX', 'BHBLDEHHXX', 'BHBLDEHHXXXX', 'bhbldehhxxx', 'BHBL DE HH XXX', 'BHBL12HHXXX']) {
      expect(broken(checkEpcBic(text)), text).toBe(
        'is not a BIC: four letters or digits for the bank, two letters for its country, two letters or digits for its place, and three for a branch or none (ISO 9362)',
      )
    }
  })

  // A bank in the United States takes no SEPA credit transfer.
  test('is the BIC of a bank in SEPA', () => {
    expect(broken(checkEpcBic('CHASUS33'))).toBe('is not the BIC of a bank in SEPA: its country is not one EPC409-09 lists')
  })
})

describe('the BIC and the IBAN together', () => {
  const NON_EEA =
    "an account outside the EEA is paid to with its bank's BIC: EPC069-12 2.2 keeps the BIC mandatory where SCT scheme participants from non-EEA countries take part"
  const ELSEWHERE = "the BIC is of a bank in another country than the IBAN's account (EPC409-09 5 gives each country's BICs and IBANs)"

  // "The BIC will continue to be mandatory for SEPA payment transactions
  // involving SCT scheme participants from non-EEA countries" (EPC069-12
  // 2.2). A code without one, for a Swiss or a British account, initiates a
  // transfer the payer's bank must refuse or ask for.
  test('has a BIC when the account is outside the EEA', () => {
    expect(epcPairing('CH9300762011623852957', null)).toEqual([{ field: 'bic', rule: NON_EEA }])
    expect(epcPairing('GB29NWBK60161331926819', null)).toEqual([{ field: 'bic', rule: NON_EEA }])
    expect(epcPairing('CH9300762011623852957', 'UBSWCHZH80A')).toEqual([])
    expect(epcPairing('DE89370400440532013000', null)).toEqual([])
    expect(epcPairing('LI21088100002324013AA', null)).toEqual([])
  })

  // EPC409-09's table gives each territory the country code its BICs and
  // its IBANs carry: a bank on Guernsey has a GG BIC and GB IBANs, one on
  // Guadeloupe a GP BIC and FR IBANs. A BIC of another country than the
  // account's is a BIC typed wrong.
  test("is a BIC of the account's country, as EPC409-09 pairs them", () => {
    expect(epcPairing('GB29NWBK60161331926819', 'NWBKGGSX')).toEqual([])
    expect(epcPairing('FR1420041010050500013M02606', 'BDAFGPGP')).toEqual([])
    expect(epcPairing('FI2112345600000785', 'AABAFI22')).toEqual([])
    expect(epcPairing('DE89370400440532013000', 'GIBAATWW')).toEqual([{ field: 'bic', rule: ELSEWHERE }])
    expect(epcPairing('FR1420041010050500013M02606', 'NWBKGGSX')).toEqual([{ field: 'bic', rule: ELSEWHERE }])
  })

  // An account or a BIC read from data is not known before a render, nor
  // is one already refused: nothing is said of it.
  test('says nothing of what is not known', () => {
    expect(epcPairing(undefined, null)).toEqual([])
    expect(epcPairing(undefined, 'GIBAATWW')).toEqual([])
    expect(epcPairing('CH9300762011623852957', undefined)).toEqual([])
  })
})

describe('the reference', () => {
  // EPC069-12 2.2: "ISO 11649 RF Creditor Reference may be used". Checked
  // by the one check a QR-bill's creditor reference is (ISO 11649), its
  // spaces dropped, and then made capitals, as the IBAN's letters are: the
  // EPC marks the reference as one the payer may not change (2.2, "Fixed"),
  // and says nothing of case, so a reference typed in lower case is written
  // in the one case its letters are known in, rather than left for a
  // banking app to read either way. A QR-bill keeps the case it was written
  // in, as SIX says banks draw no distinction (0022).
  test('is a creditor reference, spaces dropped and capitals made', () => {
    expect(accepted(checkEpcReference('RF18 5390 0754 7034'))).toBe('RF18539007547034')
    expect(accepted(checkEpcReference('rf18 5390 0754 7034'))).toBe('RF18539007547034')
    expect(accepted(checkEpcReference('rf20 abc1 23xy z'))).toBe('RF20ABC123XYZ')
  })

  // A Belgian structured communication, a QR-bill's QR reference or an
  // invoice number is a structured reference the EPC's field does not
  // name, and this code does not take: written as text, it reaches the
  // payee as text.
  test('is refused when it is any other reference', () => {
    for (const text of ['+++090/9337/55493+++', '090933755493', '210000000003139471430009017', 'INV-2026-0042']) {
      expect(broken(checkEpcReference(text)), text).toBe(
        'is not a creditor reference: RF, two check digits and up to 21 letters or digits (ISO 11649), the one structured reference this code holds',
      )
    }
    expect(broken(checkEpcReference('RF19539007547034'))).toBe('has check digits that do not match the rest of it (ISO 11649: the reference modulo 97 is 1)')
  })
})

describe('a text the code holds', () => {
  const outside = (position: number) => `holds a control character or a line break at character ${position}, which would end its line of the code early`

  // EPC069-12 2.2: the name at most 70 characters, the text 140, the
  // information 70. A character is one, whatever its bytes: an emoji is
  // one, as a reader counts it.
  test('is held to its length, in characters', () => {
    expect([EPC_BENEFICIARY_RULE.max, EPC_TEXT_RULE.max, EPC_INFORMATION_RULE.max]).toEqual([70, 140, 70])
    for (const rule of [EPC_BENEFICIARY_RULE, EPC_TEXT_RULE, EPC_INFORMATION_RULE]) {
      expect(accepted(checkEpcText('a'.repeat(rule.max), rule))).toHaveLength(rule.max)
      expect(broken(checkEpcText('a'.repeat(rule.max + 1), rule))).toBe(`is ${rule.max + 1} characters long; the EPC allows at most ${rule.max}`)
      expect(accepted(checkEpcText('😀'.repeat(rule.max), rule))).toHaveLength(rule.max * 2)
    }
  })

  // EPC069-12 names character sets (2.1) and no narrower one; with UTF-8,
  // any letter of any script is written as itself, as the samples' ä and
  // ç are. A text is not trimmed: the EPC asks for nothing of the kind.
  test('takes any character UTF-8 writes, as written', () => {
    for (const text of ['Franz Mustermänn', "François D'Alsace S.A.", 'Zoë Ćwikła Ștefănescu', 'Ελληνική Τράπεζα', 'Müller & Söhne 😀', ' Leerzeichen ']) {
      expect(accepted(checkEpcText(text, EPC_BENEFICIARY_RULE)), text).toBe(text)
    }
  })

  // Elements are separated by a line feed or a carriage return and a line
  // feed (EPC069-12 2.2). One inside a text would end its element early and
  // move every element after it: the amount read as the purpose, the
  // reference as the text. So no control character is taken -- C0, DEL,
  // C1 -- nor the line and paragraph separators a reader may break at. The
  // position is said, counted in characters from 1, never the text.
  test('refuses a control character or a line break, saying where it is', () => {
    expect(broken(checkEpcText('Franz\nMustermann', EPC_BENEFICIARY_RULE))).toBe(outside(6))
    // Counted in characters: the emoji is one, though it is two UTF-16 units.
    for (const character of ['\r', '\t', '\u0000', '\u001f', '\u007f', '\u0085', '\u009f', ' ', ' ']) {
      expect(broken(checkEpcText(`😀 Max${character}`, EPC_TEXT_RULE)), JSON.stringify(character)).toBe(outside(6))
    }
    expect(accepted(checkEpcText('a bÿc‧d', EPC_TEXT_RULE))).toBe('a bÿc‧d')
  })

  // Half of a surrogate pair is no character, and UTF-8 cannot write it:
  // an encoder would write a replacement character in its place.
  test('refuses half of a character', () => {
    expect(broken(checkEpcText('Max \ud83d', EPC_TEXT_RULE))).toBe('holds half of a character at character 5, which UTF-8 cannot write')
    expect(broken(checkEpcText('\ude00 Max', EPC_TEXT_RULE))).toBe('holds half of a character at character 1, which UTF-8 cannot write')
  })
})

describe('the texts of a code', () => {
  const NEEDED = 'is empty, and an EPC QR code needs it'
  const LEFT_OUT = 'is blank, and an element the code holds has one character at least (EPC069-12 2.2): a text the code does not hold is left out'

  // The payload's texts in its order, each with what a refusal calls it
  // and whether the code may leave its element unused (EPC069-12 2.2): the
  // validator and the runtime both read this table, so the two cannot name
  // a field two ways, or disagree about which one may be left out.
  test("are the payload's six, the BIC, the reference, the text and the information optional", () => {
    expect(Object.entries(EPC_TEXT_FIELDS).map(([field, { what, optional }]) => [field, what, optional])).toEqual([
      ['bic', 'the BIC', true],
      ['beneficiary', "the beneficiary's name", false],
      ['iban', 'the IBAN', false],
      ['reference', 'the reference', true],
      ['text', 'the text', true],
      ['information', 'the information', true],
    ])
  })

  // An element the code holds has one character at least (EPC069-12 2.2:
  // "1..70an", "1..140an"). A blank name or account names nobody. A blank
  // optional text is the element left out, written a second way, with a
  // hash of its own -- and spaces would reach the payer's app as a text of
  // nothing. Blank is empty, or white space alone, a no-break space
  // among it.
  test('are refused blank: a required one as needed, an optional one as left out', () => {
    for (const blank of ['', '   ', ' ', ' 　 ']) {
      expect(epcBlank(blank), JSON.stringify(blank)).toBe(true)
      for (const field of ['beneficiary', 'iban'] as const) expect(broken(checkEpcField(field, blank)), `${field} ${JSON.stringify(blank)}`).toBe(NEEDED)
      for (const field of ['bic', 'reference', 'text', 'information'] as const)
        expect(broken(checkEpcField(field, blank)), `${field} ${JSON.stringify(blank)}`).toBe(LEFT_OUT)
    }
    expect(epcBlank(' . ')).toBe(false)
  })

  // Past being blank, a text is held to its own field's rule, and is what
  // that rule makes of it: the IBAN and the reference without spaces and
  // in capitals, a text as written.
  test("are each held to its field's rule", () => {
    expect(accepted(checkEpcField('iban', 'de71 1102 2033 0123 4567 89'))).toBe('DE71110220330123456789')
    expect(accepted(checkEpcField('reference', 'rf18 5390 0754 7034'))).toBe('RF18539007547034')
    expect(accepted(checkEpcField('information', ' Danke '))).toBe(' Danke ')
    expect(broken(checkEpcField('bic', 'bhbldehhxxx'))).toMatch(/^is not a BIC: /)
    expect(broken(checkEpcField('beneficiary', 'n'.repeat(71)))).toBe('is 71 characters long; the EPC allows at most 70')
    expect(broken(checkEpcField('text', 't'.repeat(141)))).toBe('is 141 characters long; the EPC allows at most 140')
    expect(broken(checkEpcField('information', 'i'.repeat(71)))).toBe('is 71 characters long; the EPC allows at most 70')
  })
})

describe('the purpose', () => {
  // A purpose code is four capital letters, as the EPC's sample GDDS is.
  test('is four capital letters', () => {
    expect(accepted(checkEpcPurpose('GDDS'))).toBe('GDDS')
    for (const code of ['', 'GDD', 'GDDSX', 'gdds', 'GD1S']) {
      expect(broken(checkEpcPurpose(code)), code).toBe('is not a purpose code: four capital letters, as ISO 20022 writes one, such as GDDS')
    }
  })
})

describe('the amount', () => {
  // The PSA's own list (PSA v3.0 3, "Clarification on amount format"): as
  // short as possible, no trailing zero after the point, no point without a
  // decimal after it, and no leading zero. The EPC allows these too. Every
  // amount the PSA calls valid is written as the PSA writes it, from the
  // exact decimal's digits.
  test("is written as short as it can be, as the PSA's valid amounts are", () => {
    const written = (decimal: string): string => accepted(checkEpcAmount(decimal))
    expect(['0.01', '0.2', '0.97', '45', '184.6', '58723.01', '999999999.99'].map(written)).toEqual([
      '0.01',
      '0.2',
      '0.97',
      '45',
      '184.6',
      '58723.01',
      '999999999.99',
    ])
  })

  // An amount of a decimal field or a total comes with its scale: 45.00,
  // 184.60, 0.20. Each is written as the PSA's valid form of it, never as
  // the trailing zeros the PSA lists as invalid.
  test("drops the trailing zeros a decimal's scale gives it", () => {
    expect(['45.00', '45.0', '184.60', '0.20', '1000.10'].map((decimal) => accepted(checkEpcAmount(decimal)))).toEqual(['45', '45', '184.6', '0.2', '1000.1'])
  })

  // "Must be larger than or equal to 0.01, and cannot be larger than
  // 999999999.99" (EPC069-12 2.2).
  test('is from 0.01 to 999999999.99', () => {
    for (const decimal of ['0', '0.00', '-1', '-0.01', '1000000000', '1000000000.00']) {
      expect(broken(checkEpcAmount(decimal)), decimal).toBe('is not from 0.01 to 999999999.99, the amounts an EPC QR code pays (EPC069-12 2.2)')
    }
  })

  // Never rounded here, as a QR-bill's is not: a third decimal, a zero
  // among them, says the template computes cents it does not round.
  test('is refused with more than two decimals, rather than rounded', () => {
    for (const decimal of ['1191.005', '45.000', '0.001']) {
      expect(broken(checkEpcAmount(decimal)), decimal).toBe(
        'has more than two decimals; a SEPA credit transfer pays whole cents, so the amount is rounded where it is computed',
      )
    }
  })

  // The PSA's invalid spellings that are no decimal at all, refused as such.
  test('is a decimal', () => {
    for (const text of ['', '.01', '45.', '00045.0', '184,6', '999.999.999,99', '1e3', 'EUR45'])
      expect(broken(checkEpcAmount(text)), text).toBe('is not a decimal')
  })
})

describe('the payload', () => {
  // EPC069-12 2.3's first sample, version 1 with its BIC, byte for byte:
  // "95 characters including spaces (1) and line feeds (9), 96 byte UTF-8".
  // A code with a BIC is written as version 001, as this sample is; one
  // without, as 002, the version that lets the BIC be left out. That a
  // reader of either version takes 001 is 0025's reading of the two, and
  // nothing here shows it.
  test("is the EPC's first sample, byte for byte, when it holds what that sample holds", () => {
    const payload = epcPayload({
      bic: 'BHBLDEHHXXX',
      beneficiary: 'Franz Mustermänn',
      iban: 'DE71110220330123456789',
      amount: '12.3',
      purpose: 'GDDS',
      reference: 'RF18539007547034',
    })
    expect(payload).toBe('BCD\n001\n1\nSCT\nBHBLDEHHXXX\nFranz Mustermänn\nDE71110220330123456789\nEUR12.3\nGDDS\nRF18539007547034')
    expect([...payload]).toHaveLength(95)
    expect(utf8Length(payload)).toBe(96)
  })

  // The second sample is version 002 without a BIC, in ISO 8859-1: "103
  // characters including spaces (5) and line feeds (10), 103 byte". This
  // code is always UTF-8, so it is the same 103 characters and, for its ç,
  // 104 bytes.
  test("is the EPC's second sample in UTF-8: its characters, one byte more", () => {
    const payload = epcPayload({
      beneficiary: "François D'Alsace S.A.",
      iban: 'FR1420041010050500013M02606',
      amount: '12.3',
      text: 'Client:Marie Louise La Lune',
    })
    expect(payload).toBe("BCD\n002\n1\nSCT\n\nFrançois D'Alsace S.A.\nFR1420041010050500013M02606\nEUR12.3\n\n\nClient:Marie Louise La Lune")
    expect([...payload]).toHaveLength(103)
    expect(utf8Length(payload)).toBe(104)
  })

  // "The last populated element is not followed by any character or
  // element separator" (EPC069-12 2.2), and every element before it is a
  // line, empty when it is unused (PSA v3.0 3: "Unused elements are dropped
  // out with a line ending"). A reader counts lines: a line missing before
  // the reference reads the reference as the purpose, and a line ending at
  // the end is an element the EPC does not have.
  test('keeps every element up to the last it holds, and nothing after it', () => {
    const account = { beneficiary: 'Max Muster', iban: 'DE89370400440532013000' }
    const head = 'BCD\n002\n1\nSCT\n\nMax Muster\nDE89370400440532013000'
    expect(epcPayload(account)).toBe(head)
    expect(epcPayload({ ...account, amount: '45' })).toBe(`${head}\nEUR45`)
    expect(epcPayload({ ...account, reference: 'RF18539007547034' })).toBe(`${head}\n\n\nRF18539007547034`)
    expect(epcPayload({ ...account, text: 'Rechnung 2026-0042' })).toBe(`${head}\n\n\n\nRechnung 2026-0042`)
    expect(epcPayload({ ...account, information: 'Danke!' })).toBe(`${head}\n\n\n\n\nDanke!`)
    expect(epcPayload({ ...account, amount: '45', information: 'Danke!' })).toBe(`${head}\nEUR45\n\n\n\nDanke!`)
    // An element given empty is unused, as one not given is.
    expect(epcPayload({ ...account, bic: '', text: '', information: '' })).toBe(head)
  })

  // The total payload is at most 331 bytes (EPC069-12 2.2), counted in
  // UTF-8's bytes and not in characters: a name of umlauts takes two bytes
  // for each. 331 is what a version 13 code holds at level M (2.1).
  test('is at most 331 bytes in UTF-8', () => {
    expect(EPC_MAX_BYTES).toBe(331)
    // A name of 70 umlauts is 140 bytes; with the head, the IBAN, a text
    // of 100 characters and their lines, 48 characters of information
    // bring the payload to 331 bytes in 261 characters.
    const fields = { beneficiary: 'ä'.repeat(70), iban: 'DE89370400440532013000', text: 't'.repeat(100) }
    const full = epcPayload({ ...fields, information: 'i'.repeat(48) })
    expect([utf8Length(full), [...full].length]).toEqual([331, 261])
    expect(accepted(checkEpcPayload(full))).toBe(full)
    const over = epcPayload({ ...fields, information: 'i'.repeat(49) })
    expect(broken(checkEpcPayload(over))).toBe(
      'is 332 bytes long in UTF-8; the EPC allows at most 331 (EPC069-12 2.2), what a version 13 code holds at level M',
    )
  })
})

describe('a byte count', () => {
  // UTF-8 writes a code point in one to four bytes; a surrogate pair is
  // one code point of four.
  test("is UTF-8's", () => {
    expect(['a', 'ä', '€', '😀', ''].map(utf8Length)).toEqual([1, 2, 3, 4, 0])
  })
})
