/**
 * A Swiss QR-bill made from values SIX's rules have accepted: the Swiss QR
 * Code's payload, and every text its slip prints.
 *
 * The rules a value is held to are report-spec's (`qr-bill.ts` there), one
 * set for a literal at validation and for a value from data here. What is
 * the runtime's alone is what a checked bill becomes:
 *
 * - **The payload**, in the order of IG Table 8, each element on its line.
 * - **The printed values**, grouped as the slip prints them (IG 3.5, 3.6).
 * - **The headings**, in the slip's language (IG Annex C).
 *
 * Nothing here reads a value as a number: an amount's digits are grouped
 * as text. "IG" is SIX's Swiss Implementation Guidelines for the QR-bill,
 * version 2.4 of 24 February 2026, whose payload, printing rules and
 * headings are version 2.3's, but for the Romansh headings it adds.
 */
import { QR_BILL_ADDRESS_RULES } from '@formancy/report-spec'
import type { QrBillAccount, QrBillAddress, QrBillCurrency, QrBillLanguage, QrBillReference } from '@formancy/report-spec'
import type { QrBill, QrBillHeadings } from './document.js'

/** A party's address as SIX's rules accepted it: each part without the blanks around it, a part absent as ''. */
export type CheckedAddress = { readonly [P in keyof QrBillAddress]-?: string }

/** A bill whose every text SIX's rules accepted, each as the code holds it. */
export interface CheckedQrBill {
  readonly language: QrBillLanguage
  readonly account: QrBillAccount
  readonly creditor: CheckedAddress
  readonly currency: QrBillCurrency
  /** As the code writes it: "1949.75"; null leaves it to the payer. */
  readonly amount: string | null
  /** Null leaves the field for the payer's name and address. */
  readonly debtor: CheckedAddress | null
  /** Null is a bill without one: NON. */
  readonly reference: QrBillReference | null
  /** '' for none. */
  readonly message: string
  /** '' for none. */
  readonly billingInformation: string
}

/** What the slip's headings say, before the payer's heading is chosen by whether the bill has a debtor. */
type Words = Omit<QrBillHeadings, 'payableBy'> & { readonly payableBy: string; readonly payableByBlank: string }

/**
 * IG Annex C, Table 23, version 2.4, read in its PDF's text. Version 2.3's
 * English table printed Italian's currency as "Value date" and two French
 * words wrongly, which version 2.4 and the French edition correct; and
 * version 2.4 adds Romansh, in force since 1 January 2026.
 */
const HEADINGS: { readonly [L in QrBillLanguage]: Words } = {
  de: {
    paymentPart: 'Zahlteil',
    receipt: 'Empfangsschein',
    account: 'Konto / Zahlbar an',
    reference: 'Referenz',
    additionalInformation: 'Zusätzliche Informationen',
    payableBy: 'Zahlbar durch',
    payableByBlank: 'Zahlbar durch (Name/Adresse)',
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
    payableByBlank: 'Payable par (nom/adresse)',
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
    payableByBlank: 'Pagabile da (nome/indirizzo)',
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
    payableByBlank: 'Payable by (name/address)',
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
    payableByBlank: 'Da pajar da (num/adressa)',
    currency: 'Valuta',
    amount: 'Import',
    acceptancePoint: 'Post da recepziun',
    separate: 'Da distatgar avant che pajar',
  },
}

/** An address's parts in the order the code holds them, which report-spec's table of their rules is in. */
const ADDRESS_PARTS = Object.keys(QR_BILL_ADDRESS_RULES) as readonly (keyof QrBillAddress)[]

/** A party's seven lines (IG Table 8): the structured address type, S, and its parts; none at all, seven empty lines. */
function party(address: CheckedAddress | null): string[] {
  return address === null ? ['', ...ADDRESS_PARTS.map(() => '')] : ['S', ...ADDRESS_PARTS.map((part) => address[part])]
}

/**
 * The Swiss QR Code's text (IG 4.1.4, Table 8). Every element is on its
 * line, an empty one as an empty line, and the lines are separated by a
 * line feed, with none after the last. The ultimate creditor's lines are
 * empty: SIX keeps them for later use and they "must not be filled in".
 * Billing information, of status A, is left out when the bill has none:
 * nothing after it is ever used, since this format has no alternative
 * procedure. Version 0200 is the only one SIX allows in master version 02,
 * and coding 1 is UTF-8 restricted to the characters of IG 4.1.1.
 */
function payload(bill: CheckedQrBill): string {
  return [
    'SPC',
    '0200',
    '1',
    bill.account.iban,
    ...party(bill.creditor),
    ...party(null),
    bill.amount ?? '',
    bill.currency,
    ...party(bill.debtor),
    bill.reference?.type ?? 'NON',
    bill.reference?.reference ?? '',
    bill.message,
    'EPD',
    ...(bill.billingInformation === '' ? [] : [bill.billingInformation]),
  ].join('\n')
}

/** `text` in blocks of `size` characters from its start, the last block shorter. */
function blocks(text: string, size: number): string {
  const parts: string[] = []
  for (let start = 0; start < text.length; start += size) parts.push(text.slice(start, start + size))
  return parts.join(' ')
}

/** A QR reference in two digits and five blocks of five; a creditor reference in blocks of four (IG 3.5.4). */
function printedReference(reference: QrBillReference): string {
  const { type, reference: text } = reference
  return type === 'QRR' ? `${text.slice(0, 2)} ${blocks(text.slice(2), 5)}` : blocks(text, 4)
}

/** The amount with a space between each three digits before the point (IG 3.5.3: "CHF 1 590.00"), grouped as text. */
function printedAmount(amount: string): string {
  const [whole = '', cents = ''] = amount.split('.')
  const groups: string[] = []
  for (let end = whole.length; end > 0; end -= 3) groups.unshift(whole.slice(Math.max(0, end - 3), end))
  return `${groups.join(' ')}.${cents}`
}

/**
 * An address as the slip prints it, as IG 3.5.4 and SIX's style guide show
 * it: the name; the street and building number, on one line; the postal
 * code and the town. The country is printed for a party outside
 * Switzerland, Liechtenstein one of them; the guidelines do not say how,
 * and it goes before the postal code, as in "LI-9490 Vaduz".
 */
function printedAddress(address: CheckedAddress): string[] {
  const street = [address.street, address.buildingNumber].filter((part) => part !== '').join(' ')
  const country = address.country === 'CH' ? '' : `${address.country}-`
  return [address.name, ...(street === '' ? [] : [street]), `${country}${address.postalCode} ${address.town}`]
}

/** The document's bill: `bill`'s payload, and every text its slip prints, in its language. */
export function qrBillPart(bill: CheckedQrBill): QrBill {
  const { payableByBlank, payableBy, ...words } = HEADINGS[bill.language]
  return {
    kind: 'swissQrBill',
    payload: payload(bill),
    headings: { ...words, payableBy: bill.debtor === null ? payableByBlank : payableBy },
    account: blocks(bill.account.iban, 4),
    creditor: printedAddress(bill.creditor),
    reference: bill.reference === null ? null : printedReference(bill.reference),
    additionalInformation: [bill.message, bill.billingInformation].filter((text) => text !== ''),
    debtor: bill.debtor === null ? null : printedAddress(bill.debtor),
    currency: bill.currency,
    amount: bill.amount === null ? null : printedAmount(bill.amount),
  }
}
