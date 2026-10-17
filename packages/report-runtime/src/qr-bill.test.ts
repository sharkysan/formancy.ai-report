import { MAX_QR_BILL_ADDITIONAL_INFORMATION, QR_BILL_ADDRESS_RULES, QR_BILL_LANGUAGES } from '@formancy/report-spec'
import type { QrBillAddress } from '@formancy/report-spec'
import * as spec from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import * as runtime from './index.js'
import { qrBillPart } from './qr-bill.js'
import type { CheckedAddress, CheckedQrBill } from './qr-bill.js'

/**
 * The bill's document part made from values SIX's rules have accepted: the
 * code's payload, and every text the slip prints. "IG" is SIX's Swiss
 * Implementation Guidelines for the QR-bill, version 2.4; the golden cases
 * from its Annex A are in `lower-payment-part.test.ts`, through a render.
 */

const SELDWYLA: CheckedAddress = { name: 'Max Muster & Söhne', street: 'Musterstrasse', buildingNumber: '123', postalCode: '8000', town: 'Seldwyla', country: 'CH' }

const BILL: CheckedQrBill = {
  language: 'en',
  account: { iban: 'CH4431999123000889012', qrIban: true },
  creditor: SELDWYLA,
  currency: 'CHF',
  amount: '2500.25',
  debtor: { name: 'Simon Muster', street: 'Musterstrasse', buildingNumber: '1', postalCode: '8000', town: 'Seldwyla', country: 'CH' },
  reference: { type: 'QRR', reference: '210000000003139471430009017' },
  message: '',
  billingInformation: '',
}

describe('the headings', () => {
  // A slip with a heading of another wording than SIX's is refused at the
  // counter (IG 3.5.4: "they must not be changed"). These are Annex C's,
  // Table 23, in version 2.4, which corrects three of 2.3's English table's
  // Italian and French words and adds Romansh.
  test("are SIX's own in each of the five languages", () => {
    const headings = Object.fromEntries(QR_BILL_LANGUAGES.map((language) => [language, qrBillPart({ ...BILL, language }).headings]))
    expect(headings).toEqual({
      de: {
        paymentPart: 'Zahlteil',
        receipt: 'Empfangsschein',
        account: 'Konto / Zahlbar an',
        reference: 'Referenz',
        additionalInformation: 'Zusätzliche Informationen',
        payableBy: 'Zahlbar durch',
        currency: 'Währung',
        amount: 'Betrag',
        acceptancePoint: 'Annahmestelle',
        separate: 'Vor der Einzahlung abzutrennen',
      },
      fr: {
        paymentPart: 'Section paiement',
        receipt: 'Récépissé',
        account: 'Compte / Payable à',
        reference: 'Référence',
        additionalInformation: 'Informations supplémentaires',
        payableBy: 'Payable par',
        currency: 'Monnaie',
        amount: 'Montant',
        acceptancePoint: 'Point de dépôt',
        separate: 'A détacher avant le versement',
      },
      it: {
        paymentPart: 'Sezione pagamento',
        receipt: 'Ricevuta',
        account: 'Conto / Pagabile a',
        reference: 'Riferimento',
        additionalInformation: 'Informazioni supplementari',
        payableBy: 'Pagabile da',
        currency: 'Valuta',
        amount: 'Importo',
        acceptancePoint: 'Punto di accettazione',
        separate: 'Da staccare prima del versamento',
      },
      en: {
        paymentPart: 'Payment part',
        receipt: 'Receipt',
        account: 'Account / Payable to',
        reference: 'Reference',
        additionalInformation: 'Additional information',
        payableBy: 'Payable by',
        currency: 'Currency',
        amount: 'Amount',
        acceptancePoint: 'Acceptance point',
        separate: 'Separate before paying in',
      },
      rm: {
        paymentPart: 'Part da pajament',
        receipt: 'Quittanza',
        account: 'Conto / Da pajar a',
        reference: 'Referenza',
        additionalInformation: 'Infurmaziuns supplementaras',
        payableBy: 'Da pajar da',
        currency: 'Valuta',
        amount: 'Import',
        acceptancePoint: 'Post da recepziun',
        separate: 'Da distatgar avant che pajar',
      },
    })
  })

  // Without a debtor the slip prints a blank field for the payer's name and
  // address, and its heading must say what to write there (IG 3.5.4); "Payable
  // by" over an empty box would read as a bill with no one to pay it.
  test('ask for the name and address when the bill has no debtor', () => {
    const headings = Object.fromEntries(QR_BILL_LANGUAGES.map((language) => [language, qrBillPart({ ...BILL, language, debtor: null }).headings.payableBy]))
    expect(headings).toEqual({
      de: 'Zahlbar durch (Name/Adresse)',
      fr: 'Payable par (nom/adresse)',
      it: 'Pagabile da (nome/indirizzo)',
      en: 'Payable by (name/address)',
      rm: 'Da pajar da (num/adressa)',
    })
  })
})

describe('the printed values', () => {
  // A space, never a comma or an apostrophe, groups the thousands, and the
  // amount always has two decimals (IG 3.5.3: "CHF 1 590.00"). The digits are
  // the code's own, grouped as text: no amount is read as a number.
  test.each([
    ['0.01', '0.01'],
    ['1.00', '1.00'],
    ['999.99', '999.99'],
    ['1000.00', '1 000.00'],
    ['2500.25', '2 500.25'],
    ['100000.00', '100 000.00'],
    ['999999999.99', '999 999 999.99'],
  ])('prints the amount %s as %s', (amount, printed) => {
    expect(qrBillPart({ ...BILL, amount }).amount).toBe(printed)
  })

  // IG 3.5.4: an IBAN in blocks of four, the last character on its own; a QR
  // reference in two digits and five blocks of five; a creditor reference in
  // blocks of four, its last block shorter. A reader copies them by block.
  test('groups the account and the reference as SIX prints them', () => {
    expect(qrBillPart(BILL)).toMatchObject({ account: 'CH44 3199 9123 0008 8901 2', reference: '21 00000 00003 13947 14300 09017' })
    const scor = (reference: string): string | null => qrBillPart({ ...BILL, account: { iban: 'CH5800791123000889012', qrIban: false }, reference: { type: 'SCOR', reference } }).reference
    expect(scor('RF18539007547034')).toBe('RF18 5390 0754 7034')
    expect(scor('RF741')).toBe('RF74 1')
    expect(scor('RF95ABCDEFGHIJKLMNOPQRSTU')).toBe('RF95 ABCD EFGH IJKL MNOP QRST U')
    expect(qrBillPart({ ...BILL, account: { iban: 'CH5800791123000889012', qrIban: false }, reference: null }).reference).toBeNull()
  })

  // An address prints as the slip's samples print it: the name, the street
  // and its number on one line, the postal code and the town. The country
  // code is printed for a party outside Switzerland, Liechtenstein included
  // (IG 3.5.4); the guidelines do not say how, and it is printed before the
  // postal code, as a letter's address once wrote it.
  test('prints an address in lines, its country only outside Switzerland', () => {
    expect(qrBillPart(BILL).creditor).toEqual(['Max Muster & Söhne', 'Musterstrasse 123', '8000 Seldwyla'])
    const at = (address: Partial<CheckedAddress>): readonly string[] | null => qrBillPart({ ...BILL, debtor: { ...SELDWYLA, ...address } }).debtor
    expect(at({ postalCode: '9490', town: 'Vaduz', country: 'LI' })).toEqual(['Max Muster & Söhne', 'Musterstrasse 123', 'LI-9490 Vaduz'])
    expect(at({ street: '', buildingNumber: '' })).toEqual(['Max Muster & Söhne', '8000 Seldwyla'])
    expect(at({ street: 'P.O. box', buildingNumber: '' })).toEqual(['Max Muster & Söhne', 'P.O. box', '8000 Seldwyla'])
    expect(at({ street: '', buildingNumber: '12a' })).toEqual(['Max Muster & Söhne', '12a', '8000 Seldwyla'])
    expect(qrBillPart({ ...BILL, debtor: null }).debtor).toBeNull()
  })

  // Only the message is of interest to the payer, and it must be printed;
  // billing information is printed too, on a line of its own after it (IG
  // 3.5.4), since whether it holds personal data, which must then be
  // printed, is not the runtime's to judge. Neither: no heading at all.
  test('prints the message and then the billing information, each that is there', () => {
    expect(qrBillPart({ ...BILL, message: 'Order from 15.10.2020', billingInformation: '//S1/10/1234' }).additionalInformation).toEqual(['Order from 15.10.2020', '//S1/10/1234'])
    expect(qrBillPart({ ...BILL, message: 'Order from 15.10.2020' }).additionalInformation).toEqual(['Order from 15.10.2020'])
    expect(qrBillPart({ ...BILL, billingInformation: '//S1/10/1234' }).additionalInformation).toEqual(['//S1/10/1234'])
    expect(qrBillPart(BILL).additionalInformation).toEqual([])
  })

  // No amount is a blank field for the payer, not "0.00" (IG 3.5.3).
  test('prints no amount for a bill without one', () => {
    expect(qrBillPart({ ...BILL, amount: null })).toMatchObject({ amount: null, currency: 'CHF' })
  })
})

describe('the payload', () => {
  // IG 6.2: a Swiss QR Code holds at most 997 characters, separators
  // included. Every part's limit is report-spec's, so this bill, each text
  // at its longest, is the longest any render can make; a check of the
  // limit at render time could never fail, and so is not written.
  test('is within the 997 characters SIX allows for the longest bill the rules accept', () => {
    const longest = Object.fromEntries(Object.entries(QR_BILL_ADDRESS_RULES).map(([part, rule]) => [part, 'W'.repeat(rule.max)])) as { [P in keyof QrBillAddress]-?: string }
    const half = MAX_QR_BILL_ADDITIONAL_INFORMATION / 2
    const payload = qrBillPart({
      ...BILL,
      creditor: longest,
      debtor: longest,
      amount: '999999999.99',
      message: 'W'.repeat(half),
      billingInformation: `//${'W'.repeat(half - 2)}`,
    }).payload
    // A QR reference and its type, 27 digits and QRR, are the longest there are: a creditor reference is 25 at most, and SCOR.
    expect(payload.length).toBe(668)
    expect(payload.length).toBeLessThanOrEqual(997)
  })
})

describe("what an engine reads of report-spec's decisions", () => {
  // An engine depends on the runtime alone, and draws the slip and refuses
  // its page by report-spec's decisions, handed on here: the slip's size
  // and place, the page rule, the currencies, the amount's range and the
  // longest value SIX allows. A number copied into an engine could
  // disagree with the editor's, and nobody would find out until a slip
  // printed a hair from where the editor drew it, or a page the editor
  // took was refused at render.
  test("hands them on as report-spec's own", () => {
    expect(runtime.QR_BILL_SIZE).toBe(spec.QR_BILL_SIZE)
    expect(runtime.QR_BILL_TOP).toBe(spec.QR_BILL_TOP)
    expect(runtime.qrBillPageBreak).toBe(spec.qrBillPageBreak)
    expect(runtime.QR_BILL_CURRENCIES).toBe(spec.QR_BILL_CURRENCIES)
    expect(runtime.checkQrBillAmount).toBe(spec.checkQrBillAmount)
    expect(runtime.MAX_QR_BILL_ADDITIONAL_INFORMATION).toBe(spec.MAX_QR_BILL_ADDITIONAL_INFORMATION)
  })
})
