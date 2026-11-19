import { describe, expect, test } from 'vitest'
import { BILL_HEADING_FACES, checkQrBill, refuseBillPage, type BillUndrawn } from './bill-check.js'
import { RenderRefusal, type PageSetup, type QrBill } from './document.js'
import { qrBillPart } from './qr-bill.js'
import { SLIP_PAYMENT_PART, SLIP_RECEIPT, slipBlocks } from './slip-print.js'

/**
 * What refuses a QR-bill's payment part below every engine (0075): each
 * rule by its code, its subject and its words, which the PDF renderer and
 * the Word writer both throw. A rule decided in one engine alone would be
 * a bill one of them draws and the other refuses.
 */

const A4: PageSetup = { size: 'A4', orientation: 'portrait', margins: { top: 50, right: 50, bottom: 50, left: 50 } }

/** A bill as the runtime makes one of values SIX's rules accepted. */
const BILL: QrBill = qrBillPart({
  language: 'de',
  account: { iban: 'CH4431999123000889012', qrIban: true },
  creditor: { name: 'Max Muster & Söhne', street: 'Musterstrasse', buildingNumber: '123', postalCode: '8000', town: 'Seldwyla', country: 'CH' },
  currency: 'CHF',
  amount: '1949.75',
  debtor: { name: 'Simon Muster', street: 'Musterstrasse', buildingNumber: '1', postalCode: '8000', town: 'Seldwyla', country: 'CH' },
  reference: { type: 'QRR', reference: '210000000003139471430009017' },
  message: 'Auftrag vom 15.10.2020',
  billingInformation: '',
})

/** An engine whose face draws everything. */
const drawsAll: BillUndrawn = () => undefined

function refusal(
  bill: object,
  page: PageSetup = A4,
  undrawn: BillUndrawn = drawsAll,
): { readonly code: string; readonly subject: string | undefined; readonly message: string } {
  try {
    checkQrBill({ ...BILL, ...bill }, page, undrawn)
  } catch (error) {
    if (error instanceof RenderRefusal) return { code: error.code, subject: error.subject, message: error.message }
    throw error
  }
  throw new Error('the bill was accepted, where a refusal was expected')
}

// A bill the runtime made passes, and its code is encoded once: the symbol an engine draws is the one this check returned.
test('a bill the runtime made is accepted, with its Swiss QR Code encoded', () => {
  const checked = checkQrBill(BILL, A4, drawsAll)
  expect(checked.bill).toBe(BILL)
  expect(checked.symbol.modules.length).toBeGreaterThanOrEqual(21)
  expect(checked.symbol.modules.every((row) => row.length === checked.symbol.modules.length)).toBe(true)
})

describe('a bill no engine draws is refused, naming the payment part and its field and never a value', () => {
  // Each a document the runtime never makes and a host may hand over: drawn, it would be a slip that says something else than its code, or one a bank refuses.
  test.each([
    ['a kind nobody knows', { kind: 'giro' }, 'unsupported', "the payment part is a 'giro', which the renderer does not know"],
    ['an account that is no text', { account: 7 }, 'unsupported', "the payment part's account holds something that is not text"],
    [
      'a value longer than any SIX allows',
      { reference: '1'.repeat(141) },
      'unsupported',
      "the payment part's reference holds a value longer than any SIX allows, 140 characters",
    ],
    ['an address that is no lines', { creditor: 'Max Muster' }, 'unsupported', "the payment part's creditor's address is not lines of text"],
    [
      'an address of one line',
      { creditor: ['Max Muster'] },
      'unsupported',
      "the payment part's creditor's address has the wrong number of lines: a slip prints 2 to 3",
    ],
    [
      'an address of four lines',
      { debtor: ['a', 'b', 'c', 'd'] },
      'unsupported',
      "the payment part's debtor's address has the wrong number of lines: a slip prints 2 to 3",
    ],
    [
      'three lines of additional information',
      { additionalInformation: ['a', 'b', 'c'] },
      'unsupported',
      "the payment part's additional information has the wrong number of lines: a slip prints 0 to 2",
    ],
    ['a currency SIX does not allow', { currency: 'USD' }, 'unsupported', "the payment part's currency is not one SIX allows: CHF or EUR"],
    [
      'an amount not written as a slip prints one',
      { amount: '1949.75' },
      'unsupported',
      "the payment part's amount is not written as the slip prints one: its thousands apart and two decimals",
    ],
    [
      'a missing heading',
      { headings: { ...BILL.headings, receipt: undefined } },
      'unsupported',
      "the payment part's heading 'receipt' holds something that is not text",
    ],
    ['a payload that is no text', { payload: 7 }, 'unsupported', "the payment part's Swiss QR Code holds something that is not text"],
    ['a payload of 998 characters', { payload: 'x'.repeat(998) }, 'content-too-large', "the payment part's Swiss QR Code holds 998 characters; SIX allows 997"],
  ])('%s', (_name, wrong, code, message) => {
    expect(refusal(wrong)).toEqual({ code, subject: 'paymentPart', message })
  })

  // SIX's range is report-spec's rule, asked again of what the slip prints: an amount of a thousand millions is one no bank pays.
  test('an amount past the range SIX allows, by report-spec’s rule', () => {
    const refused = refusal({ amount: '1 000 000 000.00' })
    expect(refused).toMatchObject({ code: 'unsupported', subject: 'paymentPart' })
    expect(refused.message).toMatch(/^the payment part's amount /)
  })

  // A bill without a debtor, a reference or an amount is SIX's own donation slip: null is no missing text.
  test('and not a bill that leaves the debtor, the reference and the amount to the payer', () => {
    expect(() => checkQrBill({ ...BILL, debtor: null, reference: null, amount: null }, A4, drawsAll)).not.toThrow()
  })
})

describe('the page a slip is printed on', () => {
  // The editor refuses such a page by report-spec's rule, and an engine by the same: a slip on a page with no foot it spans is no slip.
  test.each([
    ['US Letter', { ...A4, size: 'Letter' as const }, 'unsupported', /printed across the foot of an A4 page in portrait, and this page is Letter in portrait/],
    ['landscape', { ...A4, orientation: 'landscape' as const }, 'unsupported', /this page is A4 in landscape/],
    ['a top margin that reaches into the slip', { ...A4, margins: { ...A4.margins, top: 560 } }, 'content-too-large', /past the top of the QR-bill's slip/],
  ])('is refused where it is %s', (_name, page, code, message) => {
    const refused = refusal({}, page)
    expect(refused).toMatchObject({ code, subject: 'paymentPart' })
    expect(refused.message).toMatch(message)
  })

  // What an engine measured above the slip is added to the margin: a header that reaches into the slip is refused where the margin alone is not.
  test('is refused by what an engine printed under its top margin, and not without it', () => {
    expect(() => refuseBillPage(A4)).not.toThrow()
    expect(() => refuseBillPage(A4, 480)).not.toThrow()
    expect(() => refuseBillPage(A4, 500)).toThrow(RenderRefusal)
  })
})

describe('what an engine’s face does not draw', () => {
  // The one thing an engine says itself, since only it knows its face: asked of every text, in the face it prints in, and its words used.
  test('is asked of every text the slip prints, each heading in its own face and each value in the regular one', () => {
    const asked: [string, string][] = []
    checkQrBill(BILL, A4, (text, face) => void asked.push([text, face]))
    const headings = Object.entries(BILL_HEADING_FACES).map(([key, face]) => [BILL.headings[key as keyof typeof BILL.headings], face])
    const values = [BILL.account, ...BILL.creditor, BILL.reference, ...BILL.additionalInformation, ...(BILL.debtor ?? []), BILL.currency, BILL.amount]
    expect(asked).toEqual([...headings, ...values.map((value) => [value, 'normal'])])
    expect(asked.filter(([, face]) => face === 'normal').map(([text]) => text)).toContain(BILL.headings.separate)
  })

  test('refuses the bill in the engine’s words, after the field’s name', () => {
    const undrawn: BillUndrawn = (text) => (text.includes('ö') ? 'prints U+00F6, which this face has no glyph for' : undefined)
    expect(refusal({}, A4, undrawn)).toEqual({
      code: 'unsupported',
      subject: 'paymentPart',
      message: "the payment part's creditor's address prints U+00F6, which this face has no glyph for",
    })
  })
})

describe('the blocks of a part’s information', () => {
  // SIX's order (IG 3.5.4, 3.6.2), which both engines lay out: the additional information in the payment part alone, and a blank field for a debtor left to the payer.
  test('are the account, the reference, the additional information in the payment part alone, and the payer', () => {
    const headings = (part: typeof SLIP_RECEIPT): string[] => slipBlocks(BILL, part).map((block) => block.heading)
    expect(headings(SLIP_PAYMENT_PART)).toEqual(['Konto / Zahlbar an', 'Referenz', 'Zusätzliche Informationen', 'Zahlbar durch'])
    expect(headings(SLIP_RECEIPT)).toEqual(['Konto / Zahlbar an', 'Referenz', 'Zahlbar durch'])
    const blank = slipBlocks({ ...BILL, debtor: null, reference: null, additionalInformation: [] }, SLIP_PAYMENT_PART)
    expect(blank).toEqual([
      { heading: 'Konto / Zahlbar an', values: [BILL.account, ...BILL.creditor] },
      { heading: 'Zahlbar durch', field: SLIP_PAYMENT_PART.debtorField },
    ])
  })
})
