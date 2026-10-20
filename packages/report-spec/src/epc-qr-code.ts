/**
 * The EPC QR code: the code a SEPA credit transfer is initiated from, as
 * the European Payments Council's guidelines define it (EPC069-12 v3.1),
 * printed on an invoice beside the payment details it holds.
 *
 * It is a component in a region, as a QR code is, and not a payment part:
 * the EPC prescribes no slip and no place for it. Austria's PSA asks for
 * "the right most or left most lower edge of the page" (PSA v3.0 5), and
 * the author puts it there. Its texts are runs, read as a paragraph's in
 * the report's scope and resolved whole before there are pages, since all
 * are encoded: none holds a page number or count. What each may hold,
 * `epc-payload.ts` says; how it is printed, `epc-print.ts`.
 *
 * It pays SEPA credit transfers (`SCT`) in euro, and nothing else: no
 * instant transfer, no other currency, and no structured reference but a
 * creditor reference (ISO 11649).
 */
import type { ComponentBase } from './components.js'
import type { Expression, Inline } from './values.js'

/**
 * What a code may be framed and captioned with: Austria's frame and the
 * words "Zahlen mit Code" (PSA v3.0 5), drawn inside the code's square.
 * Absent, the code is printed alone, as a QR code is.
 */
export const EPC_CAPTIONS = ['zahlenMitCode'] as const
export type EpcCaption = (typeof EPC_CAPTIONS)[number]

/**
 * An EPC QR code. Each text is runs, one at least where it is present; an
 * optional one absent is an element the code leaves empty, never an empty
 * list of runs, so that one code has one spelling and one hash.
 */
export interface EpcQrCodeComponent extends ComponentBase {
  readonly kind: 'epcQrCode'
  /** The side of the square in points: the quiet zone, and the frame and caption when there are any, inside it. */
  readonly size: number
  /** The beneficiary's name (AT-E001): at most 70 characters. */
  readonly beneficiary: readonly Inline[]
  /** The beneficiary's IBAN (AT-C001), of a country of SEPA. Spaces are for reading, and are dropped. */
  readonly iban: readonly Inline[]
  /** The BIC of the beneficiary's bank (AT-C002): needed for an account outside the EEA, and may be left out for one inside it. */
  readonly bic?: readonly Inline[]
  /** The amount in euro, a decimal of at most two places. Absent, or null, leaves the amount for the payer to fill in. */
  readonly amount?: Expression
  /** The purpose code (AT-T007): four capital letters, written into the template. */
  readonly purpose?: string
  /** A creditor reference (AT-T009, structured): RF and its check digits. Never with `text`. */
  readonly reference?: readonly Inline[]
  /** The remittance text (AT-T009, unstructured): at most 140 characters. Never with `reference`. */
  readonly text?: readonly Inline[]
  /** Information for the payer, shown by the banking app and not sent with the transfer: at most 70 characters. */
  readonly information?: readonly Inline[]
  readonly caption?: EpcCaption
}
