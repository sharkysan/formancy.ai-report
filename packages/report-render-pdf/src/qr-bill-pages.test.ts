import { readCodes, readPdf, type ReadPdf } from '@formancy/report-corpus'
import type { Block, QrBill, ResolvedDocument } from '@formancy/report-runtime'
import { encode } from 'uqr'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderPdf } from './node.js'
import { bareBillDocument, billDocument, resolvedBill, SIX_EXAMPLES } from './testing/bills.js'
import { details, ledger, PAGE, paragraph, TIMEOUT } from './testing/documents.js'
import { readDrawing } from './testing/drawing.js'
import { pageLines } from './testing/lines.js'

/**
 * Where a QR-bill's slip goes, and what the renderer refuses about one,
 * proved on the PDF (0003). The slip is printed at the foot of the
 * report's last page, across the whole width of the paper (IG 3.1); when
 * the body leaves it no room, it takes a page of its own. "IG" is SIX's
 * Swiss Implementation Guidelines for the QR-bill, version 2.4.
 */

// Every call to the encoder, counted and passed through: a payload too long
// for any Swiss QR Code is refused before it is encoded.
vi.mock('uqr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('uqr')>()
  return { ...actual, encode: vi.fn(actual.encode) }
})
beforeEach(() => {
  vi.mocked(encode).mockClear()
})

const mm = (value: number): number => (value * 72) / 25.4
const PAPER_HEIGHT = 841.89
/** The slip's top: 105 mm above the foot of the paper (IG 3.3). */
const TOP = PAPER_HEIGHT - mm(105)
/** Where the slip's drawing starts: the top of the line of 8 pt that tells the payer to separate it, its baseline 3 pt above the slip. */
const DRAWN_TOP = TOP - 3 - (1854 / 2048) * 8

const EXAMPLE = resolvedBill(SIX_EXAMPLES.two)

async function rendered(document: ResolvedDocument, maxPages = 20): Promise<{ bytes: Uint8Array; pdf: ReadPdf }> {
  const bytes = await renderPdf(document, { maxPages })
  return { bytes, pdf: await readPdf(bytes) }
}

async function refusal(document: ResolvedDocument, maxPages = 5): Promise<unknown> {
  return renderPdf(document, { maxPages }).then(
    () => 'rendered',
    (error: unknown) => error,
  )
}

/** The pages a Swiss QR Code is read on, from 1. */
async function pagesWithCodes(bytes: Uint8Array, pages: number): Promise<number[]> {
  const found: number[] = []
  for (let page = 1; page <= pages; page++) if ((await readCodes(bytes, page)).length > 0) found.push(page)
  return found
}

/** A grey box `height` points tall across `width` points: fixed-height content the tests can find in the drawing. */
const box = (height: number, width = 100): Block => ({ kind: 'rectangle', width, height, fill: '#cccccc' })

describe('where the slip goes', () => {
  // A short invoice's slip is at the foot of its one page (IG 3.1). The
  // slip is that page's foot: the page footer is not printed over it, and
  // the page header is.
  test('stands at the foot of a short report’s only page, in place of its page footer', async () => {
    const { bytes, pdf } = await rendered(billDocument(EXAMPLE, [paragraph('Invoice 2026-0042')]))
    expect(pdf.pages).toHaveLength(1)
    const [code] = await readCodes(bytes, 1)
    expect(code).toMatchObject({ text: EXAMPLE.payload, top: expect.closeTo(TOP + mm(17), 0) })
    const lines = pageLines(pdf.pages[0]!).map((line) => line.text)
    expect(lines).toContain('Formancy Report corpus: Invoice')
    expect(lines.filter((line) => line.startsWith('Page '))).toEqual([])
  })

  // A body longer than a page puts the slip at the foot of the last page,
  // and every page before it keeps its footer, counting the slip's page:
  // "Page 1 of 3" on an invoice of three pages. Nothing of the body is
  // printed into the slip or the instruction above it.
  test('stands on the last page of a long report, whose footers count its page', async () => {
    const { bytes, pdf } = await rendered(billDocument(EXAMPLE, [ledger('lines', details(1, 120))]))
    const count = pdf.pages.length
    expect(count).toBeGreaterThan(2)
    expect(await pagesWithCodes(bytes, count)).toEqual([count])
    pdf.pages.forEach((page, index) => {
      const footers = pageLines(page).filter((line) => line.text.startsWith('Page '))
      expect(footers.map((line) => line.text), `page ${page.number}`).toEqual(index + 1 < count ? [`Page ${index + 1} of ${count}`] : [])
    })
    const last = pageLines(pdf.pages[count - 1]!)
    const body = last.filter((line) => line.text.startsWith('ROW-'))
    for (const line of body) expect(line.bottom, line.text).toBeLessThanOrEqual(DRAWN_TOP)
  }, TIMEOUT)

  // The body reserves the slip's room at its end, unbreakable: content
  // that ends above the instruction shares its page with the slip, and
  // content a hundredth of a point lower sends the slip to a page of its
  // own, which nothing of the body reaches.
  test.each([
    ['ends above the slip, on its page', -0.01, 1],
    ['ends a hundredth of a point too low, before a page of the slip’s own', 0.01, 2],
  ])('keeps the room for the slip: a body that %s', async (_, past, pages) => {
    const height = DRAWN_TOP - PAGE.margins.top + past
    const { bytes, pdf } = await rendered(bareBillDocument(EXAMPLE, [box(height)]))
    expect(pdf.pages).toHaveLength(pages)
    expect(await pagesWithCodes(bytes, pages)).toEqual([pages])
    const [grey] = readDrawing(bytes)[0]!.shapes.filter((shape) => shape.fill === '#cccccc')
    expect(grey).toMatchObject({ top: expect.closeTo(PAGE.margins.top, 2), height: expect.closeTo(height, 2) })
  })

  // The slip's page is a page: a report whose body fills its last page
  // allowed has no room left for the slip, and is refused, never printed
  // without the slip or past its limit.
  test('refuses a report whose slip needs a page past the limit, and prints it with one more', async () => {
    // A paragraph that wraps over most of the page, whose least height is one line.
    const long = paragraph(Array.from({ length: 900 }, (_, index) => `word${index}`).join(' '))
    expect(await refusal(bareBillDocument(EXAMPLE, [long]), 1)).toMatchObject({ code: 'too-many-pages' })
    const { pdf } = await rendered(bareBillDocument(EXAMPLE, [long]), 2)
    expect(pdf.pages).toHaveLength(2)
  })

  // The room the slip reserves counts in the least height a body needs,
  // so a body that can never leave it room is refused before pdfmake lays
  // it out.
  test('counts the slip’s room in the least height a body needs', async () => {
    const height = PAPER_HEIGHT - 2 * PAGE.margins.top
    expect(await refusal(bareBillDocument(EXAMPLE, [box(height)]), 1)).toMatchObject({ code: 'too-many-pages', message: expect.stringContaining('at least') })
  })
})

/** The refusal's message, held to naming no value of the bill: a name, an account or an amount is personal data. */
function namesNoValue(error: unknown, ...values: readonly string[]): void {
  const { message } = error as Error
  for (const value of values) expect(message).not.toContain(value)
}

describe('what the slip refuses', () => {
  // SIX prints the slip across the foot of an A4 page in portrait (IG 3.1).
  // A Letter page, or a landscape one, has no such foot.
  test.each([
    ['a Letter page', { ...PAGE, size: 'Letter' as const }],
    ['an A4 page in landscape', { ...PAGE, orientation: 'landscape' as const }],
  ])('refuses a slip on %s', async (_, page) => {
    expect(await refusal({ ...billDocument(EXAMPLE), page })).toMatchObject({ code: 'unsupported', subject: 'paymentPart', message: expect.stringContaining('A4') })
  })

  // A payment part of a kind the renderer does not know is refused, never
  // drawn as a Swiss slip: fail closed.
  test('refuses a payment part of a kind it does not know', async () => {
    const other = { ...EXAMPLE, kind: 'sepaCreditTransfer' } as unknown as QrBill
    expect(await refusal(billDocument(other))).toMatchObject({ code: 'unsupported', subject: 'paymentPart' })
  })

  // Version 25 at level M holds 997 bytes, and SIX allows no larger code
  // (IG 6.2). A payload past it is refused, never drawn as a larger code a
  // bank's scanner may not take: 998 ASCII characters are refused before
  // they are encoded, and 500 umlauts, 1000 bytes in UTF-8, once the
  // encoder finds no version 25 holds them.
  test('refuses a payload larger than the largest Swiss QR Code', async () => {
    const characters = await refusal(billDocument({ ...EXAMPLE, payload: 'x'.repeat(998) }))
    expect(characters).toMatchObject({ code: 'content-too-large', subject: 'paymentPart', message: expect.stringContaining('998 characters') })
    expect(encode).not.toHaveBeenCalled()
    const bytes = await refusal(billDocument({ ...EXAMPLE, payload: 'ä'.repeat(500) }))
    expect(bytes).toMatchObject({ code: 'content-too-large', subject: 'paymentPart', message: expect.stringContaining('1000 bytes') })
    namesNoValue(bytes, 'ää')
  })

  // What no encoder or font can draw as written: half of a surrogate pair
  // has no UTF-8, and a character Liberation Sans has no glyph for prints
  // as an empty box. The refusal names the field and the character, never
  // the value it is in.
  test.each([
    ['half of a surrogate pair in the payload', { payload: `${EXAMPLE.payload}\uD83E` }, 'surrogate', []],
    ['a character the font has no glyph for', { creditor: ['山田 Trading', 'Musterstrasse 1', '8000 Seldwyla'] }, 'U+5C71', ['Trading', 'Musterstrasse']],
    ['a value that is not text', { creditor: [42, 'Musterstrasse 1', '8000 Seldwyla'] }, 'creditor', []],
    ['an amount SIX does not print', { amount: '1949.7' }, 'amount', ['1949.7']],
    // Written as the slip prints an amount, and outside the amounts a QR-bill pays: report-spec's range, not one of the renderer's own.
    ['an amount of nothing, which no QR-bill pays', { amount: '0.00' }, 'amount', ['0.00']],
    ['an amount past the largest a QR-bill pays', { amount: '1 000 000 000.00' }, 'amount', ['1 000 000 000']],
    ['a currency SIX does not have', { currency: 'USD' }, 'currency', ['USD']],
    ['an address of more lines than a slip prints', { debtor: ['Simon Muster', 'c/o Sarah Beispiel', 'Musterstrasse 1', '8000 Seldwyla'] }, 'debtor', ['Simon', 'Sarah']],
    ['an address of fewer lines than a slip prints', { creditor: ['Max Muster & Söhne'] }, 'creditor', ['Muster']],
    // Two characters, which a check of the count alone would take for two lines.
    ['an address that is not lines of text', { creditor: 'Bo' }, 'creditor', ['Bo']],
    ['a slip without its headings', { headings: undefined }, 'heading', []],
    ['a payload that is not text', { payload: 42 }, 'Swiss QR Code', []],
    ['a value longer than any SIX allows', { additionalInformation: ['x'.repeat(141)] }, 'additional information', ['xxx']],
  ])('refuses %s, naming no value', async (_, patch, named, values) => {
    const refused = await refusal(billDocument({ ...EXAMPLE, ...patch } as unknown as QrBill))
    expect(refused).toMatchObject({ code: 'unsupported', subject: 'paymentPart', message: expect.stringContaining(named) })
    namesNoValue(refused, ...values)
  })

  // The encoder failing for any other reason than a payload too long is
  // the engine failing, and said so, never a bill refused for its length.
  test('passes on an encoder error that is not about the payload’s length', async () => {
    vi.mocked(encode).mockImplementationOnce(() => {
      throw new RangeError('Invalid value')
    })
    const refused = await refusal(billDocument(EXAMPLE))
    expect(refused).toBeInstanceOf(RangeError)
    expect(refused).toMatchObject({ message: 'Invalid value' })
  })

  // A page header or top margin reaching into the slip's room would print
  // over it on a page of its own, where nothing of the body is: refused.
  test('refuses a page whose top margin and header reach into the slip', async () => {
    const page = { ...PAGE, margins: { ...PAGE.margins, top: DRAWN_TOP } }
    expect(await refusal({ ...billDocument(EXAMPLE, [paragraph('Body')]), page })).toMatchObject({ code: 'content-too-large', subject: 'paymentPart' })
  })

  // The rule is report-spec's, the one the editor refuses a top margin by
  // (`qrBillPageBreak`), so the two cannot disagree about where the slip
  // starts. A top margin alone past the slip's top is refused in the
  // editor's own words, before anything is laid out; with what only a
  // render measures -- the header, and the instruction to separate above
  // the slip -- counted under the same rule, to the hundredth of a point a
  // margin is stored at.
  test('refuses a top margin by the rule the editor refuses it by, the header and the instruction counted with it', async () => {
    const at = (top: number): ResolvedDocument => ({ ...bareBillDocument(EXAMPLE, [paragraph('Body')]), page: { ...PAGE, margins: { ...PAGE.margins, top } } })
    expect(await refusal(at(544.26))).toMatchObject({
      code: 'content-too-large',
      subject: 'paymentPart',
      message: "the top margin reaches 544.26 pt down the page, past the top of the QR-bill's slip at 544.25 pt, 105 mm above the paper's foot",
    })
    // The instruction's line is 10.24 pt tall over the slip's top at 544.25 pt.
    const { pdf } = await rendered(at(534))
    expect(pdf.pages).toHaveLength(2)
    expect(await refusal(at(534.01))).toMatchObject({
      code: 'content-too-large',
      subject: 'paymentPart',
      message: expect.stringMatching(/^the top margin, with the page header and the instruction to separate printed above the slip, reaches 544\.26 pt down the page, past the top of the QR-bill's slip at 544\.25 pt/),
    })
  })

  // SIX's sections are fixed: the payment part's information 85 mm tall,
  // the receipt's 56 mm (SG 6). Text taller than its section would run
  // into the further information or the amount below it, or off the
  // paper; it is refused, naming the section and its room, never cut.
  test.each([
    [
      'the payment part',
      {
        creditor: ['W '.repeat(43), 'W '.repeat(43), 'W '.repeat(27)],
        debtor: ['W '.repeat(43), 'W '.repeat(43), 'W '.repeat(27)],
        additionalInformation: ['W '.repeat(70), 'W '.repeat(70)],
      },
      '85 mm',
    ],
    ['the receipt', { creditor: ['W '.repeat(18), 'W '.repeat(18), 'W '.repeat(18)], debtor: ['W '.repeat(18), 'W '.repeat(18), 'W '.repeat(18)] }, '56 mm'],
  ])('refuses %s’s information when it is taller than its section', async (part, patch, room) => {
    const refused = await refusal(billDocument({ ...EXAMPLE, ...patch }))
    expect(refused).toMatchObject({ code: 'content-too-large', subject: 'paymentPart', message: expect.stringContaining(`${part}'s information`) })
    expect((refused as Error).message).toContain(room)
  })

  // The receipt's 56 mm hold its three blocks and four lines more, which
  // end 7.55 pt short of the section's foot; a fifth ends 1.45 pt past it.
  // Its lines are 9 pt apart; a line of eighteen W at 8 pt is wider than
  // its 52 mm and wraps once, and in the payment part's 87 mm it does not.
  // A section's foot held loosely, by as much as a line, lets the last
  // line into the amount below it.
  test('lays the receipt’s information out to the last line its section holds, and refuses one more', async () => {
    const wide = 'W '.repeat(18).trim()
    const fits = { creditor: [wide, wide, '8000 Seldwyla'], debtor: [wide, wide, '8000 Seldwyla'] }
    const { pdf } = await rendered(billDocument({ ...EXAMPLE, ...fits }))
    const last = pageLines({ ...pdf.pages[0]!, items: pdf.pages[0]!.items.filter((item) => item.x < mm(62)) }).filter((line) => line.text === '8000 Seldwyla').at(-1)!
    expect(last.bottom - 0.2 * 8).toBeLessThan(TOP + mm(68))
    const over = await refusal(billDocument({ ...EXAMPLE, creditor: fits.creditor, debtor: [wide, wide, wide] }))
    expect(over).toMatchObject({ code: 'content-too-large', subject: 'paymentPart', message: expect.stringContaining("the receipt's information") })
  })
})
