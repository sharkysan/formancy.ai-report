import {
  checkQrBillAmount,
  MAX_QR_BILL_ADDITIONAL_INFORMATION,
  QR_BILL_CURRENCIES,
  qrBillPageBreak,
  RenderRefusal,
  type PageSetup,
  type QrBill,
  type QrBillHeadings,
} from '@formancy/report-runtime'
import { codePoint, missingGlyph, type BillFace, type BillGlyphs } from './glyphs.js'
import { swissSymbol, type QrSymbol } from './qr.js'

/**
 * What the renderer refuses about a QR-bill's payment part before anything
 * is laid out, and its Swiss QR Code, encoded once.
 *
 * The runtime hands the renderer a bill SIX's rules have accepted, every
 * text as the slip prints it (report-runtime's `QrBill`); the renderer
 * formats nothing, and decides none of SIX's rules again. What it refuses
 * is what it cannot draw whole, or would draw as some other slip: a kind of
 * payment part it does not know, a page the slip has no room on, text that
 * is not text or that its font has no glyph for, an amount or currency SIX
 * does not print, more lines than a slip prints, a value longer than any
 * SIX allows, and a code larger than SIX allows (`qr.ts`). Where one of
 * those is SIX's rule -- the page, the currencies, the amounts, the longest
 * value -- it is report-spec's, which the runtime hands on, so that what
 * the editor accepts and what the renderer draws cannot part. Every
 * refusal names the payment part and the field, and none quotes a value: a
 * bill holds names, addresses and accounts.
 */

/** A bill the renderer draws, and its code's symbol. */
export interface CheckedBill {
  readonly bill: QrBill
  readonly symbol: QrSymbol
}

/** The longest value a slip prints: a line of the additional information, which the message and the billing information share (IG Table 8). An address line is shorter. */
const MAX_VALUE = MAX_QR_BILL_ADDITIONAL_INFORMATION

/** An amount as the slip prints it: a space between thousands, a point and two decimals (IG 3.5.3). Which amounts a bill pays is report-spec's `checkQrBillAmount`. */
const AMOUNT = /^\d{1,3}(?: \d{3})*\.\d{2}$/

/** The lines an address prints: its name, its street and building number, its postal code and town (IG 3.5.4). */
const ADDRESS_LINES = 3

/** The message and the billing information, each on its line. */
const ADDITIONAL_LINES = 2

function refuse(what: string): RenderRefusal {
  return new RenderRefusal('unsupported', `the payment part's ${what}`, 'paymentPart')
}

/**
 * Refuses `page` for a slip by report-spec's rule, the one the editor
 * refuses it by (`qrBillPageBreak`): a page that is not A4 in portrait,
 * which has no foot the slip spans, and one whose top margin, with `above`
 * printed under it, reaches into the slip, which no layout can undo.
 */
export function refusePage(page: PageSetup, above = 0): void {
  const broken = qrBillPageBreak(page, above)
  if (broken !== undefined) throw new RenderRefusal(broken.field === 'page' ? 'unsupported' : 'content-too-large', broken.rule, 'paymentPart')
}

/** Refuses what the renderer cannot draw of `bill` on `page`, the top margin alone before the header is measured, and encodes its code. */
export function checkBill(bill: QrBill, page: PageSetup, glyphs: BillGlyphs): CheckedBill {
  const { kind } = bill as { readonly kind?: unknown }
  if (kind !== 'swissQrBill') throw new RenderRefusal('unsupported', `the payment part is a '${String(kind)}', which the renderer does not know`, 'paymentPart')
  refusePage(page)
  const text = (value: unknown, what: string, face: BillFace): void => {
    if (typeof value !== 'string') throw refuse(`${what} holds something that is not text`)
    if (value.length > MAX_VALUE) throw refuse(`${what} holds a value longer than any SIX allows, ${MAX_VALUE} characters`)
    const missing = missingGlyph(value, glyphs[face])
    if (missing !== undefined) throw refuse(`${what} prints ${codePoint(missing)}, which Liberation Sans has no glyph for: it would print as an empty box`)
  }
  const lines = (value: unknown, what: string, most: number, least: number): void => {
    if (!Array.isArray(value)) throw refuse(`${what} is not lines of text`)
    if (value.length > most || value.length < least) throw refuse(`${what} has the wrong number of lines: a slip prints ${least} to ${most}`)
    for (const line of value) text(line, what, 'normal')
  }
  const headings = (bill.headings ?? {}) as Partial<Record<keyof QrBillHeadings, unknown>>
  for (const [key, face] of Object.entries(HEADING_FACES) as [keyof QrBillHeadings, BillFace][]) text(headings[key], `heading '${key}'`, face)
  text(bill.account, 'account', 'normal')
  lines(bill.creditor, "creditor's address", ADDRESS_LINES, 2)
  if (bill.reference !== null) text(bill.reference, 'reference', 'normal')
  lines(bill.additionalInformation, 'additional information', ADDITIONAL_LINES, 0)
  if (bill.debtor !== null) lines(bill.debtor, "debtor's address", ADDRESS_LINES, 2)
  if (!(QR_BILL_CURRENCIES as readonly unknown[]).includes(bill.currency)) throw refuse(`currency is not one SIX allows: ${QR_BILL_CURRENCIES.join(' or ')}`)
  text(bill.currency, 'currency', 'normal')
  if (bill.amount !== null) {
    if (typeof bill.amount !== 'string' || !AMOUNT.test(bill.amount))
      throw refuse('amount is not written as the slip prints one: its thousands apart and two decimals')
    const paid = checkQrBillAmount(bill.amount.replaceAll(' ', ''))
    if (!paid.ok) throw refuse(`amount ${paid.rule}`)
    text(bill.amount, 'amount', 'normal')
  }
  return { bill, symbol: swissSymbol(bill.payload) }
}

/**
 * The face each heading a slip prints in, which its glyphs are held to:
 * `separate` regular, the rest bold (`slip.ts`). A table over every
 * heading, so that one added to the document's `QrBillHeadings` without
 * its face does not compile, rather than going unchecked.
 */
const HEADING_FACES: { readonly [K in keyof QrBillHeadings]-?: BillFace } = {
  paymentPart: 'bold',
  receipt: 'bold',
  account: 'bold',
  reference: 'bold',
  additionalInformation: 'bold',
  payableBy: 'bold',
  currency: 'bold',
  amount: 'bold',
  acceptancePoint: 'bold',
  separate: 'normal',
}
