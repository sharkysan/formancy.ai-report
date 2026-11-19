import type { QrBill } from './document.js'

/**
 * Where SIX puts each part of a QR-bill's slip, the receipt and the
 * payment part, and at what size: stated here once, below every engine,
 * so that the PDF renderer and the Word writer lay one slip out (0075).
 * An engine draws by these, in its own way, and decides none of them.
 * Nothing here formats a value: the runtime hands every text as it
 * prints (`QrBill`).
 *
 * The numbers are SIX's: "IG" is the Swiss Implementation Guidelines for
 * the QR-bill, version 2.4, and "SG" its Style Guide, version 1.1, whose
 * page 6 gives every section's place and size in millimetres, page 7 the
 * blank fields', and page 15 the sizes and line spacing. What neither gives
 * is taken from manuelbl's SwissQRBill generator, which matches SG 7 drawn
 * to scale: where the blank amount fields stand, and 2 pt between a
 * debtor's heading and its field.
 *
 * Positions are in points from the slip's top left. The slip is
 * report-spec's `QR_BILL_SIZE`, 210 by 105 mm.
 */

/** Millimetres in points. */
const mm = (value: number): number => (value * 72) / 25.4

/** The receipt is 62 mm wide, and the payment part starts there (IG 3.3). */
export const SLIP_RECEIPT_WIDTH = mm(62)

/**
 * "Separate before paying in", above the line along the slip's top, outside
 * the payment part, which a slip may print instead of a scissors symbol
 * (IG 3.7, SG 4): 8 pt, the payment part's heading size, centred over the
 * slip, its baseline 3 pt above the line. SIX gives neither.
 */
export const SLIP_INSTRUCTION = { size: 8, gap: 3 } as const

/** The lines the slip is cut along (IG 3.7): solid, half a point. SIX gives no weight. */
export const SLIP_SEPARATION = 0.5

/** A blank field's corner marks: 3 mm arms, 0.75 pt (IG 3.5.3, SG 7). */
export const SLIP_CORNER = { arm: mm(3), weight: 0.75 } as const

/** Between a debtor's heading's line and its blank field. */
export const SLIP_FIELD_GAP = 2

/** The titles, "Receipt" and "Payment part": 11 pt bold (IG 3.5.1, 3.6.1). */
export const SLIP_TITLE = 11

/** A part's text: headings bold and 2 pt smaller than their values, every line `pitch` below the one before (IG 3.4, SG 15). */
export interface SlipLettering {
  readonly heading: number
  readonly value: number
  readonly pitch: number
}

/** A part of the slip: where each of its sections starts, and the room its information has. */
export interface SlipPart {
  readonly name: string
  readonly lettering: SlipLettering
  /** Where its title stands, and which heading it prints: "Receipt" or "Payment part". */
  readonly title: { readonly x: number; readonly top: number; readonly heading: 'receipt' | 'paymentPart' }
  /** Whether it prints the additional information: the payment part does, the receipt never (IG 3.6.2). */
  readonly additionalInformation: boolean
  readonly information: { readonly x: number; readonly top: number; readonly width: number; readonly height: number; readonly millimetres: number }
  /** The amount section: its headings' top, and how far the amount stands in from the currency. */
  readonly amount: { readonly x: number; readonly top: number; readonly indent: number; readonly pitch: number }
  /** The blank amount field: its box, and whether its top is the amount's line rather than the section's. */
  readonly amountField: { readonly x: number; readonly width: number; readonly height: number; readonly onAmountLine: boolean }
  readonly debtorField: { readonly width: number; readonly height: number }
}

/** The receipt, 62 by 105 mm (SG 6): 5 mm margins, its title, 56 mm of information, 14 of amount, 18 of acceptance point. */
export const SLIP_RECEIPT: SlipPart = {
  name: 'the receipt',
  lettering: { heading: 6, value: 8, pitch: 9 },
  title: { x: mm(5), top: mm(5), heading: 'receipt' },
  additionalInformation: false,
  information: { x: mm(5), top: mm(12), width: mm(52), height: mm(56), millimetres: 56 },
  // A receipt's amount is 8 pt on 11 pt (SG 15), 12 mm in (SG 7).
  amount: { x: mm(5), top: mm(68), indent: mm(12), pitch: 11 },
  // 30 by 10 mm, right-aligned to the receipt's text, at the section's top.
  amountField: { x: mm(27), width: mm(30), height: mm(10), onAmountLine: false },
  debtorField: { width: mm(52), height: mm(20) },
}

/** The payment part, 148 by 105 mm (SG 6): the code's 46 mm and the amount's 22 mm beside 87 by 85 mm of information. */
export const SLIP_PAYMENT_PART: SlipPart = {
  name: 'the payment part',
  lettering: { heading: 8, value: 10, pitch: 11 },
  title: { x: SLIP_RECEIPT_WIDTH + mm(5), top: mm(5), heading: 'paymentPart' },
  additionalInformation: true,
  information: { x: SLIP_RECEIPT_WIDTH + mm(56), top: mm(5), width: mm(87), height: mm(85), millimetres: 85 },
  // The payment part's amount is 10 pt on 13 pt (SG 15), 15 mm in (SG 7).
  amount: { x: SLIP_RECEIPT_WIDTH + mm(5), top: mm(68), indent: mm(15), pitch: 13 },
  // 40 by 15 mm, its right edge at the information section's left, its top where the amount would stand.
  amountField: { x: SLIP_RECEIPT_WIDTH + mm(16), width: mm(40), height: mm(15), onAmountLine: true },
  debtorField: { width: mm(65), height: mm(25) },
}

/** The Swiss QR Code's place: 5 mm in, below the title section and 5 mm of quiet zone (IG 3.5.2, SG 6). */
export const SLIP_CODE = { x: SLIP_RECEIPT_WIDTH + mm(5), top: mm(17) } as const

/** The acceptance point, right-aligned to the receipt's text at the top of its section (IG 3.6.4, SG 6). */
export const SLIP_ACCEPTANCE = { right: mm(57), top: mm(82) } as const

/** A block of a part's information: a heading over its values, or over a blank field for the payer's hand. */
export type SlipBlock = { readonly heading: string; readonly values: readonly string[] } | { readonly heading: string; readonly field: SlipPart['debtorField'] }

/** The blocks a part's information holds, in SIX's order (IG 3.5.4, 3.6.2): the additional information in the payment part alone. */
export function slipBlocks(bill: QrBill, part: SlipPart): SlipBlock[] {
  const { headings } = bill
  return [
    { heading: headings.account, values: [bill.account, ...bill.creditor] },
    ...(bill.reference === null ? [] : [{ heading: headings.reference, values: [bill.reference] }]),
    ...(part.additionalInformation && bill.additionalInformation.length > 0
      ? [{ heading: headings.additionalInformation, values: bill.additionalInformation }]
      : []),
    bill.debtor === null ? { heading: headings.payableBy, field: part.debtorField } : { heading: headings.payableBy, values: bill.debtor },
  ]
}

/** A Swiss QR Code's side, without a quiet zone, whatever its version (IG 6.4): its modules are this over theirs. */
export const SWISS_CODE_SIZE = mm(46)

/**
 * The Swiss cross over the code's centre (IG 6.4.2), in millimetres: SIX's
 * logo, as schoero's generator draws it, is a white square of 7 mm, a black
 * square of 6 mm on it, and a white cross on that, its arms 7/6 mm wide and
 * 35/9 mm from end to end. manuelbl's draws the same black square and cross
 * on modules it clears, rather than on a white square.
 */
export const SWISS_CROSS = { white: 7, black: 6, arm: 7 / 6, span: 35 / 9 } as const
