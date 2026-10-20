/**
 * The payment part a report may print: one Swiss QR-bill, its receipt and
 * its payment part, at the foot of the report's last page.
 *
 * It belongs to the report, not to a region: a bill is printed once, at a
 * place SIX fixes, whatever the regions hold. Its texts are runs, read as
 * a paragraph's in the report's scope, and resolved whole before there are
 * pages, since every one of them is encoded in the bill's QR code: none
 * holds a page number or count. What each must hold, SIX's Swiss
 * Implementation Guidelines for the QR-bill say; `qr-bill.ts` holds their
 * rules, and the validator applies them to a text no data can change.
 */
import type { Expression, Inline } from './values.js'

/**
 * The languages a QR-bill's headings may be printed in: German, French,
 * Italian, English, and Romansh since 1 January 2026 (IG 2.4, Annex C). A
 * report in any other language prints its slip in one of these.
 */
export const QR_BILL_LANGUAGES = ['de', 'fr', 'it', 'en', 'rm'] as const
export type QrBillLanguage = (typeof QR_BILL_LANGUAGES)[number]

/** The currencies a QR-bill pays in, and the only ones (IG Table 8, Ccy). */
export const QR_BILL_CURRENCIES = ['CHF', 'EUR'] as const
export type QrBillCurrency = (typeof QR_BILL_CURRENCIES)[number]

/**
 * A party's address, structured: the one address type SIX has taken since
 * version 2.3 removed the combined one. Each part is runs of text; what
 * each may hold is `QR_BILL_ADDRESS_RULES`.
 */
export interface QrBillAddress {
  /** A person's first and last name, or a company's: 70 characters. */
  readonly name: readonly Inline[]
  /** The street or post office box, without the building number: 70 characters. */
  readonly street?: readonly Inline[]
  readonly buildingNumber?: readonly Inline[]
  /** Without a country prefix. */
  readonly postalCode: readonly Inline[]
  readonly town: readonly Inline[]
  /** ISO 3166-1's two capital letters: CH. */
  readonly country: readonly Inline[]
}

/**
 * A Swiss QR-bill. Each text is runs, one at least where it is present; an
 * optional one absent is a field the bill leaves empty, never an empty
 * list of runs, so that one bill has one spelling and one hash.
 */
export interface SwissQrBill {
  readonly kind: 'swissQrBill'
  /** The language of the slip's headings, which may differ from the report's. */
  readonly language: QrBillLanguage
  /** The creditor's IBAN or QR-IBAN, of Switzerland or Liechtenstein. Spaces are for reading, and are dropped. */
  readonly account: readonly Inline[]
  readonly creditor: QrBillAddress
  readonly currency: QrBillCurrency
  /** A decimal of at most two places. Absent, or null, leaves the amount for the payer to fill in. */
  readonly amount?: Expression
  /** Who pays. Absent leaves a field for the payer's name and address. */
  readonly debtor?: QrBillAddress
  /** A QR reference, with a QR-IBAN, or a creditor reference, with an IBAN. Absent, the bill has none. */
  readonly reference?: readonly Inline[]
  /** The unstructured message: what the payment is for. */
  readonly message?: readonly Inline[]
  /** Coded information for the payer's software, beginning with `//`. */
  readonly billingInformation?: readonly Inline[]
}

/** The kinds of payment part. A kind this version does not know is refused, never skipped. */
export const PAYMENT_PART_KINDS = ['swissQrBill'] as const
export type PaymentPartKind = (typeof PAYMENT_PART_KINDS)[number]

export type PaymentPart = SwissQrBill
