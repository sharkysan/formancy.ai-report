import { describe, expect, test } from 'vitest'
import { ADDRESS_SCHEMES, COUNTRY_CODES, E_INVOICE_NAMES, E_INVOICE_PROFILES, FACTUR_X, FACTUR_X_PROFILES, INVOICE_TOTALS, SCHEME_IDS, UNIT_CODES, VAT_BREAKDOWN, VAT_PREFIXES } from './e-invoice.js'
import type { VatCategory } from './e-invoice.js'
import { checkEInvoiceDate, checkInvoicingPeriod, E_INVOICE_DATES, periodBreak, supplyBreak } from './en16931-dates.js'
import { checkEInvoiceDecimal, E_INVOICE_DECIMALS } from './en16931-decimals.js'
import { E_INVOICE_LINE_CODES, E_INVOICE_LINE_COLUMNS } from './en16931-lines.js'
import {
  checkAddressScheme,
  checkCountryCode,
  checkEInvoiceText,
  checkElectronicAddress,
  checkSchemeId,
  checkUnitCode,
  checkVatIdentifier,
  E_INVOICE_KIND_TEXTS,
  E_INVOICE_TEXT_TERMS,
  E_INVOICE_TEXTS,
  eInvoiceBlank,
  xmlCharacterBreak,
} from './en16931-texts.js'
import { buyerIdentificationBreak, checkLineCategory, checkVatRate, sellerIdentificationBreaks, vatCategoryBreaks, vatReasonBreak } from './en16931-vat.js'
import { EN16931_RULES, en16931Rule, FULL_ADDRESS, neededBy } from './en16931.js'
import type { PaymentCheck } from './payment-reference.js'
import { EXPRESSION_NAMES, VALUE_SCOPES } from './values.js'
import { XRECHNUNG_NEEDS, XRECHNUNG_RULES, XRECHNUNG_TEXT_NEEDS } from './xrechnung.js'

/** The rule a check says is broken, or undefined when it accepts the value. */
function broken<T>(check: PaymentCheck<T>): string | undefined {
  return check.ok ? undefined : check.rule
}

/** The value a check accepts; fails the test with the rule otherwise. */
function accepted<T>(check: PaymentCheck<T>): T {
  if (!check.ok) throw new Error(`refused: ${check.rule}`)
  return check.value
}

/** Every rule this file's cases saw broken, so the last case can hold the list of rule ids to what the rules say. */
const said = new Set<string>()

/** The rule ids a message names: CEN's and XRechnung's BR ids, a letter after one among them, and Peppol's that XRechnung runs. */
function ruleIds(message: string): string[] {
  return [...message.matchAll(/\b(?:BR-(?:[A-Z]+-)?\d+(?:-[a-z])?|PEPPOL-EN16931-R\d+)\b/g)].map((match) => match[0])
}

/** A broken rule, recorded. */
function rule<T>(check: PaymentCheck<T>): string | undefined {
  const text = broken(check)
  if (text !== undefined) said.add(text)
  return text
}

/** A break that is a message or none, recorded. */
function recorded(text: string | undefined): string | undefined {
  if (text !== undefined) said.add(text)
  return text
}

describe('the constants an e-invoice is named by', () => {
  // BT-24 is what a receiver reads to know which rules the XML follows;
  // Mustang refuses the old `urn:factur-x.eu:1p0:en16931`. The file name,
  // the relationship and the XMP's values rest on the transcription of the
  // specification [S] until the owner's copy is read: a change to any of
  // them is a change to what every e-invoice PDF says it is.
  test('are the EN 16931 profile of Factur-X 1.09.2, as recorded', () => {
    expect(E_INVOICE_PROFILES).toEqual(['en16931'])
    expect(FACTUR_X_PROFILES.en16931).toEqual({ guideline: 'urn:cen.eu:en16931:2017', conformanceLevel: 'EN 16931', relationship: 'Alternative' })
    expect(FACTUR_X).toEqual({
      fileName: 'factur-x.xml',
      mediaType: 'text/xml',
      xmpNamespace: 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#',
      xmpPrefix: 'fx',
      documentType: 'INVOICE',
      version: '1.0',
    })
  })
})

describe('the names an e-invoice gives its expressions', () => {
  // A template prints its totals as invoice.grandTotal and its breakdown
  // as vatAmount.<id>. A name or a member renamed here would leave every
  // template that reads it refused; one added would be bound by nobody.
  // Each member is the business term it is, as a refusal names it.
  test('are invoice, vatBasis and vatAmount, each member by its business term', () => {
    expect(E_INVOICE_NAMES).toEqual(['invoice', 'vatBasis', 'vatAmount'])
    expect(INVOICE_TOTALS).toEqual({
      lineTotal: 'the sum of the invoice line net amounts (BT-106)',
      taxBasisTotal: 'the invoice total amount without VAT (BT-109)',
      taxTotal: 'the invoice total VAT amount (BT-110)',
      grandTotal: 'the invoice total amount with VAT (BT-112)',
      paid: E_INVOICE_DECIMALS['BT-113'].what,
      duePayable: 'the amount due for payment (BT-115)',
    })
    expect(VAT_BREAKDOWN).toEqual({ vatBasis: 'the VAT category taxable amount (BT-116)', vatAmount: 'the VAT category tax amount (BT-117)' })
  })

  // They are bound in a report that is an e-invoice and in no other, so
  // they are not the format's names in every report: one in
  // EXPRESSION_NAMES as well would be bound where there are no totals.
  test('are none of the names every report binds', () => {
    for (const scope of VALUE_SCOPES) expect(EXPRESSION_NAMES[scope].filter((name) => (E_INVOICE_NAMES as readonly string[]).includes(name))).toEqual([])
  })
})

describe('the terms of a line', () => {
  // What a line's term is read from: the validator holds a field to these
  // types, and the editing core an expression to what it reads each type
  // as, from this one table. Two would let a column print a quantity the
  // validator takes as text and the core as a number.
  // The runtime holds what each resolved to by its term's rule, so each
  // names its term as well: one that named another would hold a quantity
  // to a net price's rule, with no one to see it.
  test('are read from fields of these types, each named by its business term', () => {
    expect(E_INVOICE_LINE_COLUMNS).toEqual({
      name: { term: 'BT-153', what: E_INVOICE_TEXTS['BT-153'].what, types: ['string'] },
      quantity: { term: 'BT-129', what: E_INVOICE_DECIMALS['BT-129'].what, types: ['integer', 'decimal'] },
      netPrice: { term: 'BT-146', what: E_INVOICE_DECIMALS['BT-146'].what, types: ['integer', 'decimal'] },
      netAmount: { term: 'BT-131', what: E_INVOICE_DECIMALS['BT-131'].what, types: ['integer', 'decimal'] },
    })
    expect(E_INVOICE_LINE_CODES).toEqual({
      id: { term: 'BT-126', what: E_INVOICE_TEXTS['BT-126'].what, types: ['string', 'integer'] },
      unit: { term: 'BT-130', what: E_INVOICE_TEXTS['BT-130'].what, types: ['string'] },
      vat: { term: 'BT-151', what: E_INVOICE_TEXTS['BT-151'].what, types: ['string'] },
    })
  })
})

describe('the closed lists', () => {
  // Each list is a choice, narrower than CEN's, and the owner's. A code
  // that slips in by an edit nobody reviewed would be written into a
  // customer's XML; one dropped would refuse an invoice that rendered
  // yesterday. Pinned whole, so either is a change a reviewer sees here.
  test('are the chosen codes and no others', () => {
    expect(UNIT_CODES).toEqual(['C62', 'H87', 'SET', 'PR', 'LS', 'MIN', 'HUR', 'DAY', 'WEE', 'MON', 'ANN', 'GRM', 'KGM', 'TNE', 'MTR', 'KMT', 'MTK', 'MTQ', 'MLT', 'LTR', 'KWH'])
    expect([...COUNTRY_CODES].sort().join(' ')).toBe('AT BE BG CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MT NL NO PL PT RO SE SI SK')
    expect(SCHEME_IDS).toEqual(['0002', '0009', '0060', '0088'])
    expect(VAT_PREFIXES).toEqual([...COUNTRY_CODES, 'EL'])
    expect(ADDRESS_SCHEMES).toEqual(['EM', '0204', '0225', '9930', '0088'])
    for (const list of [UNIT_CODES, COUNTRY_CODES, SCHEME_IDS, VAT_PREFIXES, ADDRESS_SCHEMES]) expect(new Set(list).size).toBe(list.length)
  })

  // "Two capitals" takes UK, which neither ISO 3166-1 nor CEN's list
  // holds: an invoice to a British buyer written UK is refused by every
  // validator after Formancy called the render final (BR-CL-14). EL is
  // Greece's VAT prefix, never its country.
  test('take a country of the list, its blanks dropped, and nothing that only looks like one', () => {
    expect(accepted(checkCountryCode('DE'))).toBe('DE')
    expect(accepted(checkCountryCode(' AT '))).toBe('AT')
    for (const text of ['UK', 'EL', 'de', 'D E', 'DEU', 'US', '']) {
      expect(rule(checkCountryCode(text)), text).toBe("is not a country code of those this release takes, a list narrower than ISO 3166-1's (BR-CL-14)")
    }
  })

  // A unit a person writes -- Stk, h, kg -- is no UN/ECE code, and fails
  // BR-CL-23 in every validator. The codes are capitals, as Recommendation
  // 20 writes them.
  test('take a unit of the list, and none a person would write instead', () => {
    for (const unit of UNIT_CODES) expect(accepted(checkUnitCode(unit))).toBe(unit)
    expect(accepted(checkUnitCode('HUR '))).toBe('HUR')
    for (const text of ['Stk', 'h', 'kg', 'hur', 'XPP', 'E48', '']) {
      expect(rule(checkUnitCode(text)), text).toBe('is not a unit of measure of those this release takes, a list narrower than UN/ECE Recommendation 20 (BR-CL-23)')
    }
  })

  // A scheme outside ISO 6523's list fails BR-CL-11; the Leitweg-ID,
  // 0204, routes an invoice to a public buyer and waits with XRechnung.
  test('take a scheme of the list', () => {
    for (const scheme of SCHEME_IDS) expect(accepted(checkSchemeId(scheme))).toBe(scheme)
    for (const text of ['0204', '9930', '88', 'GLN']) {
      expect(rule(checkSchemeId(text)), text).toBe("is not a scheme of those this release takes, a list narrower than ISO 6523's (BR-CL-11)")
    }
  })

  // An electronic address's scheme (BT-34-1, BT-49-1) outside the CEF's
  // EAS list fails BR-CL-25 in every validator. The list is five codes of
  // it: an email address, the Leitweg-ID a German public buyer is reached
  // by, France's addressing scheme, a German VAT identifier and a GLN.
  // 0060, D-U-N-S, is the CEF's but not taken here; a scheme is a code
  // written as the list writes it, never in another case.
  test('take an electronic address scheme of the list, and none the CEF list holds that was not chosen', () => {
    for (const scheme of ADDRESS_SCHEMES) expect(accepted(checkAddressScheme(scheme))).toBe(scheme)
    for (const text of ['0060', '0002', 'em', 'EMAIL', '9906', ' EM', '']) {
      expect(rule(checkAddressScheme(text)), text).toBe("is not an electronic address scheme of those this release takes, a list narrower than the CEF's EAS code list (BR-CL-25)")
    }
  })
})

describe('a VAT identifier', () => {
  // BR-CO-09 reads the first two characters as the country that issued
  // it. Spaces a person writes to read one are dropped, as an IBAN's are;
  // Greece's EL is taken, and GB's, though not in the EU, is a prefix CEN
  // takes.
  test('begins with a prefix of the list, its spaces dropped', () => {
    expect(accepted(checkVatIdentifier('DE 123 456 789'))).toBe('DE123456789')
    expect(accepted(checkVatIdentifier('EL123456789'))).toBe('EL123456789')
    expect(accepted(checkVatIdentifier('ATU12345678'))).toBe('ATU12345678')
    for (const text of ['UK123456789', 'de123456789', '123456789', 'XI123456789', 'DE']) {
      expect(rule(checkVatIdentifier(text)), text).toBe('does not begin with a country code this release takes as a VAT prefix, then the number it gives (BR-CO-09)')
    }
  })
})

describe('a text of the e-invoice', () => {
  // XML 1.0 has no way to write a C0 control but tab, line feed and
  // carriage return, half of a surrogate pair, U+FFFE or U+FFFF: a file
  // holding one is not XML, and dropping it would change what the
  // invoice says. The character is named by its position, never quoted.
  test('holds only characters XML 1.0 can write, each refused by its position', () => {
    expect(xmlCharacterBreak('Müller & Söhne <AG>\tLine\nTwo\rThree 😀')).toBeUndefined()
    expect(recorded(xmlCharacterBreak('ab\u0000c'))).toBe('holds a character at character 3 that XML 1.0 cannot write')
    expect(xmlCharacterBreak('\u001f')).toBe('holds a character at character 1 that XML 1.0 cannot write')
    expect(xmlCharacterBreak('a\ud800b')).toBe('holds a character at character 2 that XML 1.0 cannot write')
    expect(xmlCharacterBreak('a\udc00')).toBe('holds a character at character 2 that XML 1.0 cannot write')
    expect(xmlCharacterBreak('😀￾')).toBe('holds a character at character 2 that XML 1.0 cannot write')
    expect(xmlCharacterBreak('￿')).toBe('holds a character at character 1 that XML 1.0 cannot write')
    // The edges of what XML takes: DEL and the C1 controls are characters
    // XML 1.0 allows, and so is U+FFFD.
    expect(xmlCharacterBreak('\u007f\u0085�\u{10ffff}')).toBeUndefined()
  })

  // An e-invoice is refused where it says less than EN 16931 needs: an
  // invoice number of blanks is a number nobody can find the invoice by
  // (BR-02). An optional text that is blank is a second spelling of one
  // left out, which the XML leaves out instead.
  test('is needed where EN 16931 needs it, and not blank where it may be left out', () => {
    expect(rule(checkEInvoiceText('BT-1', ' '))).toBe('is empty, and an e-invoice needs it (BR-02)')
    expect(rule(checkEInvoiceText('BT-27', ''))).toBe('is empty, and an e-invoice needs it (BR-06)')
    expect(rule(checkEInvoiceText('BT-10', ' \n'))).toBe('is blank: a term the e-invoice does not hold is left out of it')
    expect(accepted(checkEInvoiceText('BT-1', 'RE-2026-0042'))).toBe('RE-2026-0042')
    expect(eInvoiceBlank(' \t\n')).toBe(true)
    expect(eInvoiceBlank(' x ')).toBe(false)
  })

  // Each term is held to its own rule after its characters: a country, a
  // unit, a VAT identifier, an account.
  test("is held to its term's own rule", () => {
    expect(accepted(checkEInvoiceText('BT-40', 'DE'))).toBe('DE')
    expect(rule(checkEInvoiceText('BT-55', 'UK'))).toMatch(/BR-CL-14\)$/)
    expect(rule(checkEInvoiceText('BT-130', 'Stk'))).toMatch(/BR-CL-23\)$/)
    expect(rule(checkEInvoiceText('BT-48', 'UK123'))).toMatch(/BR-CO-09\)$/)
    expect(accepted(checkEInvoiceText('BT-84', 'DE83 0123 4567 0012 3456 78'))).toBe('DE83012345670012345678')
    expect(rule(checkEInvoiceText('BT-153', 'a\u0007'))).toBe('holds a character at character 2 that XML 1.0 cannot write')
  })

  // The table is what the validator and the runtime both read: each term
  // called what EN 16931 calls it, with its BT, so that a refusal names
  // the term and the rule and never the value.
  //
  // CEN's BR-08 and BR-10 ask only that each party has a postal address
  // (BG-5, BG-8), and BR-09 and BR-11 its country: an empty city breaks no
  // rule of CEN's. The street, the post code and the city are the UStG's,
  // whose § 14 Abs. 4 Satz 1 Nr. 1 asks for "die vollständige Anschrift"
  // of both parties, and a refusal that cited BR-08 for them would name a
  // rule the file does not break.
  test('is named by its business term, and needed by the rule that asks for it', () => {
    const needed = Object.fromEntries(Object.entries(E_INVOICE_TEXTS).flatMap(([term, { required }]) => (required === undefined ? [] : [[term, required]])))
    expect(needed).toEqual({
      'BT-1': 'BR-02',
      'BT-27': 'BR-06',
      'BT-35': FULL_ADDRESS,
      'BT-37': FULL_ADDRESS,
      'BT-38': FULL_ADDRESS,
      'BT-40': 'BR-09',
      'BT-44': 'BR-07',
      'BT-50': FULL_ADDRESS,
      'BT-52': FULL_ADDRESS,
      'BT-53': FULL_ADDRESS,
      'BT-55': 'BR-11',
      'BT-84': 'BR-61',
      'BT-126': 'BR-21',
      'BT-130': 'BR-23',
      'BT-151': 'BR-CO-04',
      'BT-153': 'BR-25',
    })
    for (const [term, { what }] of Object.entries(E_INVOICE_TEXTS)) expect(what, term).toMatch(new RegExp(`^the .+ \\(${term}\\)$`))
    expect(FULL_ADDRESS).toBe('§ 14 Abs. 4 Satz 1 Nr. 1 UStG')
    expect(rule(checkEInvoiceText('BT-37', ' '))).toBe('is empty, and a German invoice gives the full address of the seller and the buyer (§ 14 Abs. 4 Satz 1 Nr. 1 UStG)')
    expect(neededBy('BR-06', 'is empty')).toBe('is empty, and an e-invoice needs it (BR-06)')
    expect(neededBy(FULL_ADDRESS, 'has no value')).toBe('has no value, and a German invoice gives the full address of the seller and the buyer (§ 14 Abs. 4 Satz 1 Nr. 1 UStG)')
  })

  // The XSD types an identifier and a code (udt:IDType, udt:CodeType) as
  // xs:token, which a schema-aware reader collapses: a tab or a line break
  // becomes a space, two spaces one, and one at either end is dropped. An
  // invoice number "RE-2026  0820" was accepted by both validators on 17
  // October 2026 and reads "RE-2026 0820" to such a reader, where the page
  // prints the two spaces. So the texts the XML writes as tokens hold none
  // of it; a name, an address line or a free text is xs:string, kept
  // whole. A VAT identifier and an IBAN drop their spaces by their own
  // rules, and a country and a unit their blanks.
  test('is refused where the XML writes it as a token and it holds white space a token collapses', () => {
    const tokens = Object.entries(E_INVOICE_TEXTS).flatMap(([term, { token }]) => (token === true ? [term] : []))
    expect(tokens).toEqual(['BT-1', 'BT-23', 'BT-30', 'BT-32', 'BT-34', 'BT-38', 'BT-43', 'BT-47', 'BT-49', 'BT-53', 'BT-86', 'BT-126'])
    const collapsed = 'holds white space the XML would not keep: its schema types the term as a token, read with each tab and line break as a space, two spaces as one, and none at either end'
    for (const text of ['RE-2026  0820', 'RE-2026\t0820', 'RE-2026\n0820', 'RE-2026\r0820', ' RE-2026-0820', 'RE-2026-0820 ']) expect(rule(checkEInvoiceText('BT-1', text)), JSON.stringify(text)).toBe(collapsed)
    expect(accepted(checkEInvoiceText('BT-1', 'RE 2026 0820'))).toBe('RE 2026 0820')
    expect(rule(checkEInvoiceText('BT-38', '50735 '))).toBe(collapsed)
    expect(rule(checkEInvoiceText('BT-126', '1 0'.replace(' ', '  ')))).toBe(collapsed)
    // xs:string, kept as written.
    expect(accepted(checkEInvoiceText('BT-27', 'Formancy  Haustechnik\tGmbH '))).toBe('Formancy  Haustechnik\tGmbH ')
    expect(accepted(checkEInvoiceText('BT-31', 'DE 123\t456 789'))).toBe('DE123456789')
  })

  // A BIC is the one the EPC QR code beside it would be held to: one bank
  // identifier, one rule (checkEpcBic), as the account is the EPC code's
  // account rule. Unchecked, a BIC the EPC code refuses could be written
  // into the XML.
  test("holds the payment account's BIC to the EPC QR code's BIC rule", () => {
    expect(accepted(checkEInvoiceText('BT-86', 'FMNCDEF0XXX'))).toBe('FMNCDEF0XXX')
    expect(accepted(checkEInvoiceText('BT-86', 'COLSDE33'))).toBe('COLSDE33')
    expect(rule(checkEInvoiceText('BT-86', 'COLSDE3'))).toMatch(/^is not a BIC: /)
    expect(rule(checkEInvoiceText('BT-86', 'colsde33'))).toMatch(/^is not a BIC: /)
    expect(rule(checkEInvoiceText('BT-86', 'BOFAUS3NXXX'))).toBe('is not the BIC of a bank in SEPA: its country is not one EPC409-09 lists')
  })

  // Which term a text is, by where it stands in the e-invoice, is read by
  // the validator for a literal and by the runtime for what the data
  // resolved. Two tables could call the seller's city its post code, and
  // a refusal would name a term the author never wrote; so there is one,
  // and every text term but a line's (which a column or a row gives) is in
  // it exactly once.
  test('is the term of the place it stands in, one table for the validator and the runtime', () => {
    expect(E_INVOICE_TEXT_TERMS).toEqual({
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
      buyer: { name: 'BT-44', vatId: 'BT-48', legalId: 'BT-47', electronicAddress: 'BT-49', address: { line1: 'BT-50', line2: 'BT-51', postalCode: 'BT-53', city: 'BT-52', country: 'BT-55' } },
      reason: 'BT-120',
      payment: { iban: 'BT-84', bic: 'BT-86', accountName: 'BT-85', remittance: 'BT-83' },
    })
    const leaves = (value: unknown): string[] => (typeof value === 'string' ? [value] : Object.values(value as object).flatMap(leaves))
    const lines = ['BT-126', 'BT-130', 'BT-151', 'BT-153']
    expect(leaves(E_INVOICE_TEXT_TERMS).sort()).toEqual(Object.keys(E_INVOICE_TEXTS).filter((term) => !lines.includes(term)).sort())
  })
})

describe('the payment account', () => {
  // BT-84 is the account a credit transfer in euro is paid to, held by the
  // one rule the EPC QR code's account is: a SEPA country's IBAN, of its
  // length, its check digits right (payment-reference.ts), and no QR-IBAN.
  // The two cannot disagree about an account an invoice prints both of.
  test("is the EPC QR code's account rule, check digits and all", () => {
    expect(accepted(checkEInvoiceText('BT-84', 'de83 0123 4567 0012 3456 78'))).toBe('DE83012345670012345678')
    expect(rule(checkEInvoiceText('BT-84', 'DE83 0123 4567 0012 3456 79'))).toBe('has check digits that do not match the rest of it (ISO 13616: the IBAN modulo 97 is 1)')
    expect(rule(checkEInvoiceText('BT-84', 'CH44 3199 9123 0008 8901 2'))).toMatch(/^is a QR-IBAN/)
    expect(rule(checkEInvoiceText('BT-84', 'FO2000400440116243'))).toMatch(/^is not the IBAN of an account in SEPA/)
  })
})

describe("the seller's contact, the electronic addresses and the business process", () => {
  // EN 16931 asks nothing of a telephone number's shape. XRechnung does,
  // as a warning KoSIT's XRechnung scenario raises (BR-DE-27): three
  // digits at least, ASCII digits, since XPath's [0-9] is those. A number
  // of fewer is a contact nobody can call, and refused where it is
  // written, by the very expression the pinned schematron holds, read as
  // XPath reads it after normalize-space.
  test("is a telephone number of three digits at least, as XRechnung reads one", () => {
    for (const text of ['+49 221 4710 820', '0221/4710-820', '123', 'Tel. 1 2 3', 'Durchwahl\n820', '1\n2\n3']) expect(accepted(checkEInvoiceText('BT-42', text)), JSON.stringify(text)).toBe(text)
    for (const text of ['12', 'Zentrale', '+49', '\u0661\u0662\u0663']) {
      expect(rule(checkEInvoiceText('BT-42', text)), text).toBe("has fewer than three digits, which a telephone number has at least (XRechnung's BR-DE-27)")
    }
  })

  // XRechnung's BR-DE-28, a warning too, reads an email address as no
  // white space, one @ with something before it, and after it two names
  // at least joined by single dots. Its words say a dot should stand at
  // neither end; its expression lets one begin the address, and the
  // expression is what KoSIT runs, so it is what is held here.
  test('is an email address of the shape XRechnung reads one in', () => {
    for (const text of ['rechnung@formancy-haustechnik.example', 'erika.mustermann@haustechnik.example', 'a@b.c.d', '.a@b.c']) expect(accepted(checkEInvoiceText('BT-43', text)), text).toBe(text)
    const shape = "is not an email address of the shape XRechnung reads one in: no white space, one @ with something before it, and after it two names at least, each joined to the next by one dot (XRechnung's BR-DE-28)"
    for (const text of ['rechnung', 'a@b', 'a@@b.c', 'a@b.c.', 'a@.b.c', 'a@b..c', '@b.c', 'a b@c.d', 'a@b.c@d.e']) expect(rule(checkEInvoiceText('BT-43', text)), text).toBe(shape)
    // An identifier the XML writes as a token, as every URIID is.
    expect(rule(checkEInvoiceText('BT-43', ' a@b.c'))).toMatch(/^holds white space the XML would not keep/)
  })

  // The business process (BT-23) and the electronic addresses (BT-34,
  // BT-49) are identifiers, xs:token in the XSD, held to nothing else:
  // neither CEN nor the pinned XRechnung rules ask a shape of them, and
  // what an address under a scheme must be is the scheme's.
  test('are tokens where the XML writes them as identifiers, and texts where it does not', () => {
    for (const term of ['BT-23', 'BT-34', 'BT-49'] as const) {
      expect(accepted(checkEInvoiceText(term, 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'))).toBe('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0')
      expect(rule(checkEInvoiceText(term, 'a  b'))).toMatch(/^holds white space the XML would not keep/)
    }
    expect(accepted(checkEInvoiceText('BT-41', ' Erika  Mustermann '))).toBe(' Erika  Mustermann ')
  })
})

describe("an XRechnung's texts", () => {
  // An XRechnung's terms are EN 16931's, held by the same table, but for
  // what XRechnung needs past it -- the buyer's reference, the business
  // process, both electronic addresses and the contact's three terms,
  // each by the rule of XRechnung's that needs it -- and its payment
  // terms, which may hold no Skonto line (BR-DE-18). One table per kind,
  // over every term, so that the validator and the runtime read one rule
  // of each term of each kind; a kind without a table does not compile.
  test("are EN 16931's, but for what XRechnung needs and its payment terms", () => {
    expect(E_INVOICE_KIND_TEXTS.facturX).toBe(E_INVOICE_TEXTS)
    const xrechnung = E_INVOICE_KIND_TEXTS.xrechnung
    expect(Object.keys(xrechnung)).toEqual(Object.keys(E_INVOICE_TEXTS))
    const apart = Object.entries(xrechnung).flatMap(([term, held]) => {
      const { what, token, check, required } = E_INVOICE_TEXTS[term as keyof typeof E_INVOICE_TEXTS]
      return held.what === what && held.token === token && held.check === check && held.required === required ? [] : [term]
    })
    expect(apart.sort()).toEqual(['BT-10', 'BT-20', 'BT-23', 'BT-34', 'BT-41', 'BT-42', 'BT-43', 'BT-49'])
    for (const [term, need] of Object.entries(XRECHNUNG_TEXT_NEEDS)) expect(xrechnung[term as keyof typeof xrechnung].required, term).toBe(need)
    expect(rule(checkEInvoiceText('BT-10', ' ', 'xrechnung'))).toBe("is empty, and an XRechnung needs it (XRechnung's BR-DE-15)")
    expect(rule(checkEInvoiceText('BT-41', '', 'xrechnung'))).toBe("is empty, and an XRechnung needs it (XRechnung's BR-DE-5)")
    expect(rule(checkEInvoiceText('BT-10', ' '))).toBe('is blank: a term the e-invoice does not hold is left out of it')
    expect(neededBy('PEPPOL-EN16931-R001', 'has no value')).toBe("has no value, and an XRechnung needs it (XRechnung's PEPPOL-EN16931-R001)")
    expect(rule(checkEInvoiceText('BT-20', 'Zahlbar binnen 14 Tagen\n#SKONTO#TAGE=14#PROZENT=2.00#\n', 'xrechnung'))).toMatch(/\(XRechnung's BR-DE-18\)$/)
    expect(accepted(checkEInvoiceText('BT-20', 'Zahlbar binnen 14 Tagen\n#SKONTO#TAGE=14#PROZENT=2.00#\n'))).toMatch(/^Zahlbar/)
    expect(accepted(checkEInvoiceText('BT-20', 'Zahlbar binnen 14 Tagen', 'xrechnung'))).toBe('Zahlbar binnen 14 Tagen')
    // What the format holds past its texts is a need of its own, a part, by the place it stands in.
    expect(Object.keys(XRECHNUNG_NEEDS)).toEqual(['businessProcess', 'buyerReference', 'payment', 'seller/contact', 'seller/electronicAddress', 'buyer/electronicAddress'])
  })

  // The scheme says what an address is (0038, Q3): one under 0204 is a
  // Leitweg-ID, held to its shape and check digits after the rule of its
  // term, in an invoice of either kind; one under another scheme is held
  // to its term's rule alone, as 0037 left it.
  test('hold an electronic address under 0204 to a Leitweg-ID, after its term’s rule', () => {
    for (const kind of ['facturX', 'xrechnung'] as const) {
      expect(accepted(checkElectronicAddress('BT-49', '0204', '991-33333TEST-33', kind))).toBe('991-33333TEST-33')
      expect(rule(checkElectronicAddress('BT-49', '0204', '991-33333TEST-34', kind))).toMatch(/^is under 0204, a Leitweg-ID, and has check digits that do not match/)
      expect(rule(checkElectronicAddress('BT-34', '0204', 'rechnung@bund.example', kind))).toMatch(/^is under 0204, a Leitweg-ID, and is not shaped as one/)
      expect(accepted(checkElectronicAddress('BT-49', 'EM', 'rechnung@bund.example', kind))).toBe('rechnung@bund.example')
      expect(rule(checkElectronicAddress('BT-49', '0204', '991-33333TEST-33 ', kind))).toMatch(/^holds white space the XML would not keep/)
    }
    expect(rule(checkElectronicAddress('BT-49', '0204', ' ', 'xrechnung'))).toBe("is empty, and an XRechnung needs it (XRechnung's PEPPOL-EN16931-R010)")
  })
})

describe('a decimal of the e-invoice', () => {
  // The XML writes BT-131 with two decimals at most (BR-DEC-23). A line
  // amount of 10.505 is refused, never rounded: the page printed it, and
  // rounding it here would write another amount than the page's. 10.500 is
  // the same number of cents, and is written 10.50.
  test('is a whole number of cents where CEN writes two decimals, never rounded', () => {
    expect(accepted(checkEInvoiceDecimal('BT-131', '10.500'))).toBe('10.50')
    expect(accepted(checkEInvoiceDecimal('BT-131', '10'))).toBe('10.00')
    expect(accepted(checkEInvoiceDecimal('BT-131', '-12.3'))).toBe('-12.30')
    expect(accepted(checkEInvoiceDecimal('BT-131', '-0.010'))).toBe('-0.01')
    expect(accepted(checkEInvoiceDecimal('BT-113', '0'))).toBe('0.00')
    expect(rule(checkEInvoiceDecimal('BT-131', '10.505'))).toBe('is not a whole number of cents, and the XML writes it with two decimals at most: it is rounded where the template computes it (BR-DEC-23)')
    expect(rule(checkEInvoiceDecimal('BT-113', '0.001'))).toBe('is not a whole number of cents, and the XML writes it with two decimals at most: it is rounded where the template computes it (BR-DEC-16)')
  })

  // BR-27: a negative net price is refused by every validator. A
  // discount is a line of negative quantity at a positive price, so the
  // quantity may be negative and the price may not.
  test('is a net price of 0 or more, and a quantity of either sign, as written', () => {
    expect(accepted(checkEInvoiceDecimal('BT-146', '0'))).toBe('0')
    expect(accepted(checkEInvoiceDecimal('BT-146', '12.3456'))).toBe('12.3456')
    expect(accepted(checkEInvoiceDecimal('BT-129', '-1'))).toBe('-1')
    expect(accepted(checkEInvoiceDecimal('BT-129', '2.500'))).toBe('2.500')
    expect(rule(checkEInvoiceDecimal('BT-146', '-0.01'))).toBe('is negative, and a net price never is: a discount is a line of negative quantity at a positive price (BR-27)')
  })

  // A value that is not a decimal is refused by its type before any rule.
  test('is a decimal', () => {
    for (const term of Object.keys(E_INVOICE_DECIMALS) as (keyof typeof E_INVOICE_DECIMALS)[]) {
      for (const text of ['', '1e3', '1,50', '.5', '-0', 'NaN']) expect(broken(checkEInvoiceDecimal(term, text)), `${term} ${text}`).toBe('is not a decimal')
    }
  })

  // What the runtime refuses a null with in a final render, by the rule
  // CEN gives each: a line without its quantity, price or amount.
  test('is needed by the rule CEN gives it', () => {
    expect(Object.fromEntries(Object.entries(E_INVOICE_DECIMALS).map(([term, { what, required }]) => [term, [what, required]]))).toEqual({
      'BT-129': ['the invoiced quantity (BT-129)', 'BR-22'],
      'BT-146': ['the item net price (BT-146)', 'BR-26'],
      'BT-131': ['the line net amount (BT-131)', 'BR-24'],
      'BT-113': ['the paid amount (BT-113)', undefined],
    })
    expect(Object.fromEntries(Object.entries(E_INVOICE_DATES).map(([term, { what, required }]) => [term, [what, required]]))).toEqual({
      'BT-2': ['the issue date (BT-2)', 'BR-03'],
      'BT-9': ['the payment due date (BT-9)', undefined],
      'BT-72': ['the delivery date (BT-72)', undefined],
      'BT-73': ["the invoicing period's start (BT-73)", undefined],
      'BT-74': ["the invoicing period's end (BT-74)", undefined],
    })
  })
})

describe('the VAT categories', () => {
  // BR-S-05: a standard rate is more than 0; BR-E-05, BR-AE-05: exempt and
  // reverse-charged lines are at 0. A rate is a percentage, compared by
  // value: 19 and 19.00 are one rate.
  test('have the rate their code allows, compared by value', () => {
    expect(accepted(checkVatRate('S', '19'))).toBe('19')
    expect(accepted(checkVatRate('S', '19.00'))).toBe('19')
    expect(accepted(checkVatRate('S', '5.50'))).toBe('5.5')
    expect(accepted(checkVatRate('S', '99.99'))).toBe('99.99')
    expect(accepted(checkVatRate('E', '0.00'))).toBe('0')
    expect(accepted(checkVatRate('AE', '0'))).toBe('0')
    expect(rule(checkVatRate('S', '0.0'))).toBe("is 0, and a standard rated category's rate is more than 0 (BR-S-05)")
    expect(rule(checkVatRate('E', '7'))).toBe("is not 0, and an exempt category's rate is 0 (BR-E-05)")
    expect(rule(checkVatRate('AE', '0.01'))).toBe("is not 0, and a reverse-charged category's rate is 0 (BR-AE-05)")
    for (const rate of ['100', '-19', '19.000', '019', '.5', '7,5', '1e1', '']) {
      expect(broken(checkVatRate('S', rate)), rate).toBe('is not a rate this release takes: a percentage from 0 to below 100, an exact decimal of two places at most')
    }
  })

  // BR-CO-17 rounds the rate before it reads the tax: XPath's round(0.4)
  // is 0, and a breakdown whose rate rounds to 0 must hold a tax that
  // rounds to 0 as well. A standard rate below 0.5 passed BR-S-05 and was
  // written with the tax it computes: at 0.4 over 635.80 that is 2.54,
  // which Mustang 2.26.0 and KoSIT 1.6.3 both refused under BR-CO-17,
  // fatal, when a review measured it on 17 October 2026. Refused where the
  // rate is written, compared as text, by value.
  test('are refused standard rated below 0.5, which BR-CO-17 rounds to 0', () => {
    for (const rate of ['0.01', '0.4', '0.40', '0.49']) expect(rule(checkVatRate('S', rate)), rate).toBe("is below 0.5, which BR-CO-17 rounds to 0, and a breakdown whose rate rounds to 0 holds a tax that rounds to 0 too: a standard rated category's tax would not, past a small basis (BR-CO-17)")
    for (const rate of ['0.5', '0.50', '0.99', '1', '2.1']) expect(accepted(checkVatRate('S', rate)), rate).toBe(rate.replace(/0$/, ''))
    expect(accepted(checkVatRate('E', '0'))).toBe('0')
  })

  // BR-S-10, BR-E-10, BR-AE-10: an exempt or reverse-charged breakdown
  // says why, and a standard rated one has no reason to give.
  test('give a reason where they are exempt or reverse-charged, and none where they are standard rated', () => {
    expect(vatReasonBreak('S', false)).toBeUndefined()
    expect(vatReasonBreak('E', true)).toBeUndefined()
    expect(vatReasonBreak('AE', true)).toBeUndefined()
    expect(recorded(vatReasonBreak('S', true))).toBe('a standard rated category gives no exemption reason (BR-S-10)')
    expect(recorded(vatReasonBreak('E', false))).toBe('an exempt category gives its exemption reason (BR-E-10)')
    expect(recorded(vatReasonBreak('AE', false))).toBe('a reverse-charged category gives its reason, "Reverse charge" or its words in the invoice\'s language (BR-AE-10)')
  })

  // One breakdown per rate of the standard rated lines (BR-S-08), and
  // exactly one of the exempt and one of the reverse-charged (BR-E-01,
  // BR-AE-01; BR-E-08 and BR-AE-08 are their sums, which the runtime
  // computes): two categories that would be one breakdown would each claim
  // every line's amount, and the XML would fail. The second is refused,
  // where it is. Named by the rule the XML would break, as the runtime's
  // breakdown names it.
  test('are one breakdown each: standard rates distinct by value, one exempt and one reverse-charged at most', () => {
    expect(vatCategoryBreaks([{ code: 'S', rate: '19' }, { code: 'S', rate: '7' }, { code: 'E', rate: '0' }, { code: 'AE', rate: '0' }])).toEqual([])
    const breaks = vatCategoryBreaks([
      { code: 'S', rate: '19' },
      { code: 'S', rate: '19.00' },
      { code: 'E', rate: '0' },
      { code: 'E', rate: '0' },
      { code: 'AE', rate: '0' },
      { code: 'AE', rate: '0.0' },
      { code: 'S', rate: '7' },
    ])
    for (const { rule: text } of breaks) said.add(text)
    expect(breaks).toEqual([
      { index: 1, field: 'rate', rule: 'is the rate of an earlier standard rated category, and the standard rated lines have one breakdown for each rate (BR-S-08)' },
      { index: 3, field: 'code', rule: 'is a second exempt category, and the exempt lines have exactly one breakdown (BR-E-01)' },
      { index: 5, field: 'code', rule: 'is a second reverse-charged category, and the reverse-charged lines have exactly one breakdown (BR-AE-01)' },
    ])
  })

  // BR-CO-04: every line is in a category the invoice declares. The id is
  // the template's own field key, so it may be quoted; the runtime names
  // the row, never its values.
  test('are what each line names its category by', () => {
    const categories: readonly VatCategory[] = [
      { id: 'standard', code: 'S', rate: '19' },
      { id: 'reduced', code: 'S', rate: '7' },
    ]
    expect(accepted(checkLineCategory('reduced', categories))).toBe(categories[1])
    expect(rule(checkLineCategory('zero', categories))).toBe('is not the id of a VAT category this invoice declares, and every line is in one (BR-CO-04)')
  })
})

describe('the rules over what an invoice holds', () => {
  // BR-CO-26: a buyer identifies the seller by its VAT identifier or its
  // legal registration (BT-29, the third, this version does not write).
  // BR-S-02, BR-E-02, BR-AE-02: a line in any of the three categories needs
  // the seller's VAT identifier or tax number. Every invoice has a line in
  // one of them, so the rules of the categories it has are named.
  test("hold the seller's identification", () => {
    expect(sellerIdentificationBreaks({ vatId: true, taxNumber: false, legalId: false }, ['S', 'E', 'AE'])).toEqual([])
    expect(sellerIdentificationBreaks({ vatId: false, taxNumber: true, legalId: true }, ['S'])).toEqual([])
    const breaks = sellerIdentificationBreaks({ vatId: false, taxNumber: false, legalId: false }, ['S', 'AE'])
    for (const text of breaks) said.add(text)
    expect(breaks).toEqual([
      'the seller has neither a VAT identifier (BT-31) nor a legal registration identifier (BT-30), one of which a buyer identifies a seller by (BR-CO-26)',
      'the seller has neither a VAT identifier (BT-31) nor a tax registration identifier (BT-32), one of which a line of these VAT categories needs (BR-S-02, BR-AE-02)',
    ])
    expect(sellerIdentificationBreaks({ vatId: false, taxNumber: false, legalId: true }, ['E']).map((text) => recorded(text))).toEqual([
      'the seller has neither a VAT identifier (BT-31) nor a tax registration identifier (BT-32), one of which a line of these VAT categories needs (BR-E-02)',
    ])
    expect(sellerIdentificationBreaks({ vatId: false, taxNumber: true, legalId: false }, ['S'])).toEqual([
      'the seller has neither a VAT identifier (BT-31) nor a legal registration identifier (BT-30), one of which a buyer identifies a seller by (BR-CO-26)',
    ])
  })

  // BR-AE-02: reverse charge moves the tax to the buyer, so the invoice
  // names the buyer by its VAT identifier or its legal registration.
  test("hold the buyer's identification where a line is reverse-charged", () => {
    expect(buyerIdentificationBreak({ vatId: false, legalId: false }, ['S', 'E'])).toBeUndefined()
    expect(buyerIdentificationBreak({ vatId: true, legalId: false }, ['AE'])).toBeUndefined()
    expect(buyerIdentificationBreak({ vatId: false, legalId: true }, ['AE'])).toBeUndefined()
    expect(recorded(buyerIdentificationBreak({ vatId: false, legalId: false }, ['S', 'AE']))).toBe(
      "a reverse-charged line needs the buyer's VAT identifier (BT-48) or its legal registration identifier (BT-47), and the buyer has neither (BR-AE-02)",
    )
  })

  // § 14 (4) 1 no. 6 UStG asks a German invoice for the time of supply,
  // which the XML gives as a delivery date or an invoicing period; FeRD's
  // BR-FX-DE-04, as the specification is transcribed, warns of one
  // without. An invoicing period has a start or an end (BR-CO-19) that
  // does not come before it (BR-29).
  test('hold the time of supply, and a period that is one', () => {
    expect(supplyBreak(true, false)).toBeUndefined()
    expect(supplyBreak(false, true)).toBeUndefined()
    expect(supplyBreak(false, false)).toBe('a German invoice says when it was supplied: a delivery date (BT-72), an invoicing period (BG-14), or both (§ 14 Abs. 4 Satz 1 Nr. 6 UStG)')
    expect(periodBreak(true, false)).toBeUndefined()
    expect(periodBreak(false, true)).toBeUndefined()
    expect(recorded(periodBreak(false, false))).toBe('an invoicing period has a start (BT-73), an end (BT-74), or both (BR-CO-19)')
    expect(checkInvoicingPeriod('2026-10-01', '2026-10-31')).toBeUndefined()
    expect(checkInvoicingPeriod('2026-10-01', '2026-10-01')).toBeUndefined()
    expect(recorded(checkInvoicingPeriod('2026-10-02', '2026-10-01'))).toBe('the invoicing period ends (BT-74) before it starts (BT-73) (BR-29)')
    expect(checkInvoicingPeriod('2026-02-30', '2026-10-01')).toBe('the invoicing period is not two dates written YYYY-MM-DD')
  })

  // A date term is typed by the editing core as the ISO string a date field
  // is read as, so any text passes it; the runtime holds what the data
  // resolved to a day on the calendar. One that is not -- a customer's
  // name, the 30th of February, a moment with its time -- would write a
  // DateTimeString no validator reads as a date (CII-DT-097).
  test('hold a date to a day on the calendar, written YYYY-MM-DD', () => {
    expect(accepted(checkEInvoiceDate('2026-10-17'))).toBe('2026-10-17')
    expect(accepted(checkEInvoiceDate('2024-02-29'))).toBe('2024-02-29')
    for (const text of ['2026-02-29', '2026-10-17T08:00:00', '17.10.2026', 'Muster AG', '']) expect(broken(checkEInvoiceDate(text)), text).toBe('is not a day on the calendar written YYYY-MM-DD')
  })
})

describe('the rules named', () => {
  // The gate holds every rule id report-spec names to a rule of a pinned
  // schematron, since ids move: BR-CO-27 became CII-SR-470 in 2.5.2. CEN's
  // ids it holds to fatal rules of CEN's and FeRD's, XRechnung's to rules
  // of XRechnung's of whatever flag, since the two it names only warn. So
  // the list it reads is every id a rule here says, and nothing
  // else: an id said that is not listed would escape the gate, and one
  // listed that nothing says would be checked for nothing. Run last, over
  // every rule the cases above saw broken.
  test('are every id a rule here says, and nothing else', () => {
    // XRechnung's are its own list, held by the gate to the pinned XRechnung schematron as CEN's are to CEN's.
    const listed: readonly string[] = [...EN16931_RULES, ...XRECHNUNG_RULES]
    for (const text of said) for (const id of ruleIds(text)) expect(listed, `${id} in "${text}"`).toContain(id)
    const named = new Set([...said].flatMap(ruleIds))
    for (const term of [...Object.values(E_INVOICE_KIND_TEXTS).flatMap((texts) => Object.values(texts)), ...Object.values(E_INVOICE_DECIMALS), ...Object.values(E_INVOICE_DATES)]) {
      // The UStG's full address is the law's, not one of CEN's rules.
      if (term.required !== undefined && term.required !== FULL_ADDRESS) named.add(term.required)
    }
    // BR-16 and BR-CO-18 are said through en16931Rule alone, by the
    // validator where a report has no table or no category, and by the
    // runtime where a table has no rows; validate-e-invoice.test.ts holds
    // the validator's words.
    for (const id of ['BR-16', 'BR-CO-18'] as const) named.add(ruleIds(en16931Rule(id, 'said'))[0] as string)
    // What an XRechnung needs past its texts the validator says where a part is missing; validate-xrechnung.test.ts holds its words.
    for (const need of Object.values(XRECHNUNG_NEEDS)) named.add(need.rule)
    expect([...named].sort()).toEqual([...listed].sort())
    expect(en16931Rule('BR-16', 'an e-invoice has one line at least')).toBe('an e-invoice has one line at least (BR-16)')
  })
})
