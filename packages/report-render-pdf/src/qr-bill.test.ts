import { readFileSync } from 'node:fs'
import { rasterPixels, readCodes, readPdf, type PdfPage, type PdfTextItem, type ReadPdf } from '@formancy/report-corpus'
import type { QrBill, ReportDefinition } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { characterMap, codePoint } from './glyphs.js'
import { renderPdf } from './node.js'
import { bareBillDocument, GERMAN, resolvedBill, SIX_EXAMPLES } from './testing/bills.js'
import { readDrawing, type DrawnPage, type Shape } from './testing/drawing.js'
import { pageLines } from './testing/lines.js'

/**
 * A QR-bill's slip, proved on the PDF it was drawn in (0003): the Swiss QR
 * Code decoded by ZXing from the pixels PDF.js draws, every heading and
 * value read back by PDF.js where SIX puts it, and the lines, the blank
 * fields' corner marks and the Swiss cross read from the PDF's own content
 * stream (`testing/drawing.ts`).
 *
 * Every number here is SIX's, written out from the source, never read from
 * the renderer: "IG" is the Swiss Implementation Guidelines for the
 * QR-bill, version 2.4; "SG" its Style Guide, version 1.1, whose pages 6
 * and 7 are drawn to scale and whose page 15 gives the line spacing.
 */

const mm = (value: number): number => (value * 72) / 25.4
const PAPER = { width: 595.28, height: 841.89 }
/** The slip is 105 mm tall at the foot of the A4 page (IG 3.1, 3.3). */
const TOP = PAPER.height - mm(105)
/** The receipt is 62 mm wide; the payment part starts there (IG 3.3). */
const PAYMENT = mm(62)
/** Liberation Sans's ascender, 1854 of its 2048 units: a line's baseline stands this far below its top. */
const ascent = (size: number): number => (1854 / 2048) * size

type Language = NonNullable<ReportDefinition['paymentPart']>['language']

/** Every language a slip is printed in (IG Annex C): a record over the format's own, so that a language added there without its case here does not compile. */
const LANGUAGES = Object.keys({ de: 0, fr: 0, it: 0, en: 0, rm: 0 } satisfies Record<Language, 0>) as Language[]

const REGULAR = 'LiberationSans'
const BOLD = 'LiberationSans-Bold'

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

interface Rendered {
  readonly bytes: Uint8Array
  readonly pdf: ReadPdf
  readonly drawing: DrawnPage[]
}

async function rendered(bill: QrBill): Promise<Rendered> {
  const bytes = await renderPdf(bareBillDocument(bill), { maxPages: 5 })
  return { bytes, pdf: await readPdf(bytes), drawing: readDrawing(bytes) }
}

/** A box on the page, in points from its top left. */
interface Box {
  readonly x: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** A line of text as it is drawn: where its first run starts, on its baseline, at its size, in its font. */
interface Run {
  readonly text: string
  readonly x: number
  readonly baseline: number
  readonly size: number
  readonly font: string
}

const baselineOf = (item: PdfTextItem): number => item.bottom - 0.2 * item.height

/**
 * The lines PDF.js reads whose runs start inside `box`, each with the font
 * and size the content stream shows its first run in. Read box by box, so
 * that the receipt's and the payment part's lines on one baseline are not
 * read as one.
 */
function runsIn(page: PdfPage, drawn: DrawnPage, box: Box): Run[] {
  const inside = (item: PdfTextItem): boolean => {
    const baseline = baselineOf(item)
    return item.x >= box.x - 0.01 && item.x < box.x + box.width && baseline >= box.top - 0.01 && baseline < box.top + box.height
  }
  return pageLines({ ...page, items: page.items.filter(inside) }).map((line) => {
    const shown = drawn.text.find((each) => Math.abs(each.x - line.x) < 0.01 && Math.abs(each.baseline + 0.2 * each.size - line.bottom) < 0.01)
    if (shown === undefined) throw new Error(`nothing is drawn where '${line.text}' starts`)
    return { text: line.text, x: line.x, baseline: shown.baseline, size: shown.size, font: shown.font }
  })
}

/** A run as expected: `x` within a hundredth of a point, or anywhere when it is null. */
const run = (text: string, x: number | null, baseline: number, size: number, font: string): Run => ({
  text,
  x: x === null ? expect.any(Number) : expect.closeTo(x, 2),
  baseline: expect.closeTo(baseline, 2),
  size,
  font,
})

/** The lines of a section of SIX's: each block a heading and its values, the first heading's top at the section's top, every line `pitch` below the one before, and a blank line between blocks (SG 15). */
function stacked(
  x: number,
  top: number,
  sizes: { readonly heading: number; readonly value: number; readonly pitch: number },
  blocks: readonly (readonly [string, readonly string[]])[],
): Run[] {
  const runs: Run[] = []
  let baseline = top + ascent(sizes.heading) - 2 * sizes.pitch
  for (const [heading, values] of blocks) {
    baseline += 2 * sizes.pitch
    runs.push(run(heading, x, baseline, sizes.heading, BOLD))
    for (const value of values) {
      baseline += sizes.pitch
      runs.push(run(value, x, baseline, sizes.value, REGULAR))
    }
  }
  return runs
}

/** The receipt's headings and values: 6 and 8 pt on 9 pt (IG 3.4, SG 15). */
const RECEIPT = { heading: 6, value: 8, pitch: 9 }
/** The payment part's: 8 and 10 pt on 11 pt (IG 3.4, SG 15). */
const PAYMENT_TEXT = { heading: 8, value: 10, pitch: 11 }

/** The sections of SIX's slip (SG 6), in points on the page. */
const SECTIONS = {
  receiptTitle: { x: 0, top: TOP, width: PAYMENT, height: mm(12) },
  receiptInformation: { x: 0, top: TOP + mm(12), width: PAYMENT, height: mm(56) },
  receiptAmounts: { x: 0, top: TOP + mm(68), width: PAYMENT, height: mm(14) },
  acceptancePoint: { x: 0, top: TOP + mm(82), width: PAYMENT, height: mm(23) },
  paymentTitle: { x: PAYMENT, top: TOP, width: mm(56), height: mm(17) },
  paymentCurrency: { x: PAYMENT, top: TOP + mm(68), width: mm(20), height: mm(22) },
  paymentAmount: { x: PAYMENT + mm(20), top: TOP + mm(68), width: mm(36), height: mm(22) },
  paymentInformation: { x: PAYMENT + mm(56), top: TOP, width: mm(92), height: mm(90) },
} as const satisfies Record<string, Box>

/** Example 2's information, as the receipt and the payment part print it. */
const ACCOUNT: readonly [string, readonly string[]] = [
  'Account / Payable to',
  ['CH44 3199 9123 0008 8901 2', 'Max Muster & Söhne', 'Musterstrasse 123', '8000 Seldwyla'],
]
const REFERENCE: readonly [string, readonly string[]] = ['Reference', ['21 00000 00003 13947 14300 09017']]
const PAYABLE_BY: readonly [string, readonly string[]] = ['Payable by', ['Simon Muster', 'Musterstrasse 1', '8000 Seldwyla']]

describe('the font', () => {
  // Every character SIX allows in a QR-bill (IG 4.1.1) has a glyph in both
  // faces the slip prints in, so no bill the runtime accepts is refused for
  // its font, or printed with an empty box. Held to the files the package
  // ships, which a later Liberation Sans would replace.
  test("maps every character of SIX's set, in both faces", () => {
    const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, index) => from + index)
    const allowed = [...range(0x20, 0x7e), ...range(0xa0, 0xff), ...range(0x100, 0x17f), ...range(0x218, 0x21b), 0x20ac]
    for (const file of ['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf']) {
      const map = characterMap(new Uint8Array(readFileSync(new URL(`../fonts/${file}`, import.meta.url))))
      expect(allowed.filter((point) => !map.has(point)).map(codePoint), file).toEqual([])
    }
  })
})

describe('what the Swiss QR Code says', () => {
  // A payload a byte off pays another account, another amount or nobody.
  // Each of SIX's examples is decoded from the page as a scanner reads it:
  // its every byte as UTF-8, "Söhne" included, at level M (IG 6.1), and no
  // larger than version 25 (IG 6.2).
  test.each(Object.entries(SIX_EXAMPLES))('decodes example %s byte for byte, at level M', async (_, definition) => {
    const bill = resolvedBill(definition)
    expect(bill.payload.startsWith('SPC\n0200\n1\n')).toBe(true)
    const { bytes } = await rendered(bill)
    const codes = await readCodes(bytes, 1)
    expect(codes).toHaveLength(1)
    expect(codes[0]).toMatchObject({ text: bill.payload, bytes: utf8(bill.payload), ecLevel: 'M' })
    expect(codes[0]!.version).toBeLessThanOrEqual(25)
  })

  // The encoder can raise the level to the highest the version it chose
  // still holds; SIX prescribes M (IG 6.1). SIX's examples fill their
  // versions too closely to be raised, so ten bytes stand in: version 1
  // holds 14 at M and 11 at Q, so a code raised would read Q.
  test('keeps level M where the encoder would raise it', async () => {
    const payload = 'SPC\n0200\n1'
    expect(utf8(payload)).toHaveLength(10)
    const { bytes } = await rendered({ ...resolvedBill(SIX_EXAMPLES.three), payload })
    expect(await readCodes(bytes, 1)).toEqual([expect.objectContaining({ text: payload, ecLevel: 'M', version: 1 })])
  })

  // SIX's largest code is version 25 at level M, 997 bytes (IG 6.2), drawn
  // at 46 mm like any other (IG 6.4): its modules are 0.393 mm, finer than
  // the 0.4 mm a `qrCode` is held to (0020), and it still reads back.
  test('draws the largest code SIX allows, version 25, and a scanner reads every byte', async () => {
    const payload = 'x'.repeat(997)
    const { bytes } = await rendered({ ...resolvedBill(SIX_EXAMPLES.three), payload })
    expect(await readCodes(bytes, 1)).toEqual([expect.objectContaining({ text: payload, ecLevel: 'M', version: 25 })])
  })
})

describe('where the Swiss QR Code stands', () => {
  // The code is 46 mm square without a quiet zone of its own, 5 mm in from
  // the payment part's left edge and 17 mm below the slip's top: the 5 mm
  // around it are its quiet zone (IG 3.5.2, 6.4, 6.4.1; SG 6). A code of
  // another size scans, and a bank's scanner still refuses the slip.
  test('is 46 mm square at its place in the payment part, its modules to its edges', async () => {
    const { bytes, drawing } = await rendered(resolvedBill(SIX_EXAMPLES.two))
    const square = drawing[0]!.shapes.find((shape) => shape.fill === '#ffffff' && Math.abs(shape.width - mm(46)) < 0.01)
    expect(square).toMatchObject({ x: expect.closeTo(PAYMENT + mm(5), 2), top: expect.closeTo(TOP + mm(17), 2), height: expect.closeTo(mm(46), 2) })
    const [code] = await readCodes(bytes, 1)
    // Where a scanner finds the symbol: within half a point of the square.
    expect(code).toMatchObject({
      x: expect.closeTo(PAYMENT + mm(5), 0),
      top: expect.closeTo(TOP + mm(17), 0),
      width: expect.closeTo(mm(46), 0),
      height: expect.closeTo(mm(46), 0),
    })
  })

  // The Swiss cross marks a Swiss QR Code (IG 6.4.2): 7 mm square in black
  // and white over the code's centre. Its geometry is SIX's logo file's as
  // two libraries draw it: a white square of 7 mm, a black one of 6 mm,
  // and a white cross of arms 7/6 mm wide and 35/9 mm long, laid over the
  // modules in that order.
  test('carries the Swiss cross at its centre, white, black and white', async () => {
    const { drawing } = await rendered(resolvedBill(SIX_EXAMPLES.two))
    const shapes = drawing[0]!.shapes
    const centre = { x: PAYMENT + mm(5 + 23), y: TOP + mm(17 + 23) }
    const centred = (shape: Shape, side: number): boolean =>
      Math.abs(shape.x + shape.width / 2 - centre.x) < 0.01 &&
      Math.abs(shape.top + shape.height / 2 - centre.y) < 0.01 &&
      Math.abs(shape.width - side) < 0.01 &&
      Math.abs(shape.height - side) < 0.01
    const white = shapes.filter((shape) => shape.fill === '#ffffff' && centred(shape, mm(7)))
    const black = shapes.filter((shape) => shape.fill === '#000000' && centred(shape, mm(6)))
    const cross = shapes.filter((shape) => shape.fill === '#ffffff' && centred(shape, mm(35 / 9)))
    expect([white.length, black.length, cross.length]).toEqual([1, 1, 1])
    const modules = shapes.find((shape) => shape.fill === '#000000' && !centred(shape, mm(6)))!
    expect([modules.paint < white[0]!.paint, white[0]!.paint < black[0]!.paint, black[0]!.paint < cross[0]!.paint]).toEqual([true, true, true])
    // The cross's twelve corners, clockwise from the top of its upright arm: arms 7/6 mm wide, 35/9 mm from end to end.
    const [arm, span] = [mm(7 / 6) / 2, mm(35 / 9) / 2]
    const corners = [
      [-arm, -span],
      [arm, -span],
      [arm, -arm],
      [span, -arm],
      [span, arm],
      [arm, arm],
      [arm, span],
      [-arm, span],
      [-arm, arm],
      [-span, arm],
      [-span, -arm],
      [-arm, -arm],
    ]
    expect(cross[0]!.points).toEqual(corners.map(([x, y]) => [expect.closeTo(centre.x + x!, 2), expect.closeTo(centre.y + y!, 2)]))
  })

  // The same cross in the pixels PDF.js draws, which is what a person and
  // a camera see: white at its centre and along its arms, black in the
  // square between the arms and past their ends, and white again in the
  // ring between the black square and the white one.
  test('shows the cross in the pixels: a white cross on black, ringed in white', async () => {
    const { bytes } = await rendered(resolvedBill(SIX_EXAMPLES.two))
    const scale = 4
    const { data, width } = await rasterPixels(bytes, 1, scale)
    const centre = { x: PAYMENT + mm(28), y: TOP + mm(40) }
    const red = (dx: number, dy: number): number => data[(Math.round((centre.y + mm(dy)) * scale) * width + Math.round((centre.x + mm(dx)) * scale)) * 4]!
    const at = (points: readonly (readonly [number, number])[]): number[] => points.map(([dx, dy]) => red(dx, dy))
    // The centre, and along both arms, short of their ends at 35/18 mm.
    expect(
      Math.min(
        ...at([
          [0, 0],
          [0, 1.6],
          [0, -1.6],
          [1.6, 0],
          [-1.6, 0],
        ]),
      ),
    ).toBeGreaterThan(224)
    // Between the arms, and past their ends, inside the 3 mm of the black square.
    expect(
      Math.max(
        ...at([
          [2.2, 2.2],
          [-2.2, 2.2],
          [2.2, -2.2],
          [-2.2, -2.2],
          [0, 2.5],
          [2.5, 0],
          [0, -2.5],
          [-2.5, 0],
        ]),
      ),
    ).toBeLessThan(32)
    // The white ring between 3 and 3.5 mm out, at the corners.
    expect(
      Math.min(
        ...at([
          [3.25, 3.25],
          [-3.25, 3.25],
          [3.25, -3.25],
          [-3.25, -3.25],
        ]),
      ),
    ).toBeGreaterThan(224)
  })
})

describe('what the slip prints, and where', () => {
  // Each heading and value where SIX's sections put it, at SIX's sizes and
  // spacing, in Liberation Sans, one of the four fonts SIX allows (IG 3.4):
  // a slip in Roboto, or a value outside its section, is one a bank may
  // refuse to process.
  test('prints the receipt: its title, its information, its amount and the acceptance point', async () => {
    const { pdf, drawing } = await rendered(resolvedBill(SIX_EXAMPLES.two))
    const [page, drawn] = [pdf.pages[0]!, drawing[0]!]
    expect(runsIn(page, drawn, SECTIONS.receiptTitle)).toEqual([run('Receipt', mm(5), TOP + mm(5) + ascent(11), 11, BOLD)])
    expect(runsIn(page, drawn, SECTIONS.receiptInformation)).toEqual(stacked(mm(5), TOP + mm(12), RECEIPT, [ACCOUNT, REFERENCE, PAYABLE_BY]))
    const amounts = TOP + mm(68) + ascent(6)
    // A receipt's amount is 8 pt on 11 pt (SG 15), "Amount" 12 mm in from
    // "Currency". PDF.js reads the two, at 6 pt, as one line; where the
    // amount's run starts is read from the content stream.
    expect(runsIn(page, drawn, SECTIONS.receiptAmounts)).toEqual([
      run('Currency Amount', mm(5), amounts, 6, BOLD),
      run('CHF 1 949.75', mm(5), amounts + 11, 8, REGULAR),
    ])
    const indented = drawn.text.filter((shown) => Math.abs(shown.x - mm(17)) < 0.01)
    expect(indented.map(({ baseline, size, font }) => ({ baseline, size, font }))).toEqual([
      { baseline: expect.closeTo(amounts, 2), size: 6, font: BOLD },
      { baseline: expect.closeTo(amounts + 11, 2), size: 8, font: REGULAR },
    ])
    // Right-aligned to the receipt's text, 5 mm in from its edge (IG 3.6.4).
    expect(runsIn(page, drawn, SECTIONS.acceptancePoint)).toEqual([run('Acceptance point', null, TOP + mm(82) + ascent(6), 6, BOLD)])
    const [acceptance] = pageLines({ ...page, items: page.items.filter((item) => item.text.includes('Acceptance')) })
    expect(acceptance!.right).toBeCloseTo(mm(57), 1)
  })

  // The payment part's information holds the additional information, which
  // the receipt never prints (IG 3.6.2), and its amount is 10 pt on 13 pt.
  test('prints the payment part: its title, its amount and its information, the additional information in it alone', async () => {
    const { pdf, drawing } = await rendered(resolvedBill(SIX_EXAMPLES.two))
    const [page, drawn] = [pdf.pages[0]!, drawing[0]!]
    expect(runsIn(page, drawn, SECTIONS.paymentTitle)).toEqual([run('Payment part', PAYMENT + mm(5), TOP + mm(5) + ascent(11), 11, BOLD)])
    const amounts = TOP + mm(68) + ascent(8)
    expect(runsIn(page, drawn, SECTIONS.paymentCurrency)).toEqual([
      run('Currency', PAYMENT + mm(5), amounts, 8, BOLD),
      run('CHF', PAYMENT + mm(5), amounts + 13, 10, REGULAR),
    ])
    expect(runsIn(page, drawn, SECTIONS.paymentAmount)).toEqual([
      run('Amount', PAYMENT + mm(20), amounts, 8, BOLD),
      run('1 949.75', PAYMENT + mm(20), amounts + 13, 10, REGULAR),
    ])
    const additional: readonly [string, readonly string[]] = [
      'Additional information',
      ['Order from 15.10.2020', '//S1/10/1234/11/201021/30/102673386/32/7.7/40/0:30'],
    ]
    expect(runsIn(page, drawn, SECTIONS.paymentInformation)).toEqual(
      stacked(PAYMENT + mm(56), TOP + mm(5), PAYMENT_TEXT, [ACCOUNT, REFERENCE, additional, PAYABLE_BY]),
    )
    expect(pageLines(page).filter((line) => line.text.includes('Order from'))).toHaveLength(1)
  })

  // A bill without a reference prints no reference heading, and one
  // without additional information none of that (IG 3.5.4): a heading over
  // nothing is information the code does not hold.
  test('leaves out the headings of what a bill does not hold, and the blocks after them move up', async () => {
    const { pdf, drawing } = await rendered(resolvedBill(SIX_EXAMPLES.three))
    const [page, drawn] = [pdf.pages[0]!, drawing[0]!]
    const account: readonly [string, readonly string[]] = ['Account / Payable to', ['CH52 0483 5012 3456 7100 0', 'Muster Stiftung', 'P.O. box', '3001 Bern']]
    const blank: readonly [string, readonly string[]] = ['Payable by (name/address)', []]
    expect(runsIn(page, drawn, SECTIONS.receiptInformation)).toEqual(stacked(mm(5), TOP + mm(12), RECEIPT, [account, blank]))
    expect(runsIn(page, drawn, SECTIONS.paymentInformation)).toEqual(stacked(PAYMENT + mm(56), TOP + mm(5), PAYMENT_TEXT, [account, blank]))
    // Without an amount, the currency alone, over the blank field.
    expect(runsIn(page, drawn, SECTIONS.paymentAmount).map((each) => each.text)).toEqual(['Amount'])
  })

  // SIX's words in German, umlauts and all, drawn with glyphs of their own:
  // a face without "ä" would print an empty box where "Währung" is.
  test('prints a German slip in Liberation Sans, umlauts included', async () => {
    const { pdf } = await rendered(resolvedBill(GERMAN))
    const texts = pageLines(pdf.pages[0]!)
      .map((line) => line.text)
      .join('\n')
    for (const word of ['Empfangsschein', 'Zahlteil', 'Währung', 'Betrag', 'Zusätzliche Informationen', 'Annahmestelle', 'Vor der Einzahlung abzutrennen'])
      expect(texts).toContain(word)
    expect(texts).not.toContain('\u0000')
  })

  // The slip is SIX's, in the one font SIX allows that the renderer can
  // embed: nothing on it in Roboto, and every font in the file embedded.
  test('prints nothing on the slip in any font but Liberation Sans, and embeds it', async () => {
    const { pdf, drawing } = await rendered(resolvedBill(SIX_EXAMPLES.one))
    const fonts = new Set(drawing[0]!.text.filter((shown) => shown.baseline > TOP - mm(5)).map((shown) => shown.font))
    expect([...fonts].sort()).toEqual([REGULAR, BOLD])
    expect(pdf.fonts.every((font) => font.embedded)).toBe(true)
  })
})

describe('the lines a PDF slip is cut along', () => {
  /**
   * Where the scissors symbol stands on the line down the slip: 3 mm of
   * it, from 5 mm below the slip's top. SIX gives no place or size;
   * these are manuelbl's generator's, which breaks the line there for its
   * own symbol (`BillLayout.drawBorder`, read on 17 October 2026).
   */
  const SCISSORS = { top: TOP + mm(5), height: mm(3) }

  // A PDF's slip is marked by lines, one along the top of the slip and one
  // between the receipt and the payment part, with "Separate before paying
  // in" above the first, outside the payment part (IG 3.7, SG 4). The one
  // down is broken where the scissors symbol stands on it, so that no
  // stroke runs through the symbol.
  test('draws a line across the paper at the slip’s top, and one down between receipt and payment part, broken for the scissors', async () => {
    const { drawing } = await rendered(resolvedBill(SIX_EXAMPLES.two))
    const lines = drawing[0]!.shapes.filter((shape) => shape.kind === 'line' && shape.stroke === '#000000' && shape.lineWidth === 0.5)
    expect(lines.map(({ x, top, width, height }) => ({ x, top, width, height }))).toEqual([
      { x: expect.closeTo(0, 2), top: expect.closeTo(TOP, 2), width: expect.closeTo(PAPER.width, 2), height: expect.closeTo(0, 2) },
      { x: expect.closeTo(PAYMENT, 2), top: expect.closeTo(TOP, 2), width: expect.closeTo(0, 2), height: expect.closeTo(SCISSORS.top - TOP, 2) },
      {
        x: expect.closeTo(PAYMENT, 2),
        top: expect.closeTo(SCISSORS.top + SCISSORS.height, 2),
        width: expect.closeTo(0, 2),
        height: expect.closeTo(PAPER.height - SCISSORS.top - SCISSORS.height, 2),
      },
    ])
  })

  // Each line "must bear the scissors symbol or alternatively the
  // instruction ... above the line (outside the payment part)" (IG 3.7).
  // A line down the slip has no "above" outside the payment part, so it
  // bears the symbol: filled in black, 3 mm tall, centred on the line
  // where it is broken, and inside the 5 mm left unprinted on either side
  // of it (SG 6), clear of the receipt's text and the payment part's. Its
  // two halves mirror each other across the line, as a pair of blades
  // does. Drawn as paths, since Liberation Sans has no glyph for U+2702,
  // and the same in every language, since it says nothing in any.
  test.each(LANGUAGES)('bears the scissors symbol on the line between receipt and payment part, in %s', async (language) => {
    const { drawing } = await rendered(resolvedBill({ ...SIX_EXAMPLES.two, language }))
    const symbol = drawing[0]!.shapes.filter(
      (shape) => shape.fill !== undefined && shape.x < PAYMENT + mm(5) && shape.x + shape.width > PAYMENT - mm(5) && shape.top < TOP + mm(12),
    )
    expect(symbol.length).toBeGreaterThan(0)
    expect(symbol.every((shape) => shape.fill === '#000000' && shape.stroke === undefined)).toBe(true)
    const points = symbol.flatMap((shape) => shape.points)
    const [left, right] = [Math.min(...points.map(([x]) => x)), Math.max(...points.map(([x]) => x))]
    const [top, bottom] = [Math.min(...points.map(([, y]) => y)), Math.max(...points.map(([, y]) => y))]
    expect({ top, height: bottom - top, centre: (left + right) / 2 }).toEqual({
      top: expect.closeTo(SCISSORS.top, 2),
      height: expect.closeTo(SCISSORS.height, 2),
      centre: expect.closeTo(PAYMENT, 2),
    })
    expect([left > PAYMENT - mm(5), right < PAYMENT + mm(5)]).toEqual([true, true])
    // Every point has its mirror image across the line.
    const mirrored = (x: number, y: number): boolean => points.some(([other, at]) => Math.abs(other - (2 * PAYMENT - x)) < 0.01 && Math.abs(at - y) < 0.01)
    expect(points.filter(([x, y]) => !mirrored(x, y))).toEqual([])
  })

  // Above the line, centred over the slip, in the slip's language: 8 pt,
  // its baseline 3 pt above the line.
  test('prints the instruction to separate above the line, centred', async () => {
    const { pdf, drawing } = await rendered(resolvedBill(SIX_EXAMPLES.two))
    const above = runsIn(pdf.pages[0]!, drawing[0]!, { x: 0, top: TOP - mm(10), width: PAPER.width, height: mm(10) })
    expect(above).toEqual([run('Separate before paying in', null, TOP - 3, 8, REGULAR)])
    const [line] = pageLines(pdf.pages[0]!).filter((each) => each.text === 'Separate before paying in')
    expect((line!.x + line!.right) / 2).toBeCloseTo(PAPER.width / 2, 1)
  })
})

describe('the blank fields', () => {
  /** The 0.75 pt strokes of the blank fields' corner marks (IG 3.5.3; SG 7): stroked, and not filled, as the code's paths are. */
  const marks = (drawn: DrawnPage): Shape[] =>
    drawn.shapes.filter((shape) => shape.kind === 'line' && shape.stroke !== undefined && shape.fill === undefined && shape.lineWidth === 0.75)

  const closeBox = (box: Box): Box => ({
    x: expect.closeTo(box.x, 2),
    top: expect.closeTo(box.top, 2),
    width: expect.closeTo(box.width, 2),
    height: expect.closeTo(box.height, 2),
  })

  // Without an amount or a debtor, the payer writes them by hand into
  // fields of SIX's sizes, marked by their corners alone, 3 mm arms of
  // 0.75 pt drawn inside the field (IG 3.5.3, 3.5.4, 3.6.2, 3.6.3; SG 7):
  // the receipt's amount 30 by 10 mm, right-aligned to its text at the
  // amount section's top; the payment part's 40 by 15 mm, its top where
  // the amount would print and its right edge at the information
  // section's; and each debtor's field, 52 by 20 and 65 by 25 mm, 2 pt
  // under the line its heading stands on.
  test('marks the amount and the debtor fields by their corners, at SIX’s sizes', async () => {
    const { pdf, drawing } = await rendered(resolvedBill(SIX_EXAMPLES.three))
    const page = pdf.pages[0]!
    const headingBaseline = (from: number, to: number, size: number): number => {
      const [line] = pageLines({ ...page, items: page.items.filter((item) => item.x >= from && item.x < to) }).filter(
        (each) => each.text === 'Payable by (name/address)',
      )
      return line!.bottom - 0.2 * size
    }
    const fields: readonly Box[] = [
      { x: mm(5), top: headingBaseline(0, PAYMENT, 6) + 9 - ascent(8) + 2, width: mm(52), height: mm(20) },
      { x: PAYMENT + mm(56), top: headingBaseline(PAYMENT, PAPER.width, 8) + 11 - ascent(10) + 2, width: mm(65), height: mm(25) },
      { x: mm(27), top: TOP + mm(68), width: mm(30), height: mm(10) },
      { x: PAYMENT + mm(16), top: TOP + mm(68) + ascent(8) + 13 - ascent(10), width: mm(40), height: mm(15) },
    ]
    const all = marks(drawing[0]!)
    expect(all).toHaveLength(4 * fields.length)
    const half = 0.75 / 2
    for (const field of fields) {
      const inside = all.filter(
        (shape) =>
          shape.x >= field.x - 1 &&
          shape.top >= field.top - 1 &&
          shape.x + shape.width <= field.x + field.width + 1 &&
          shape.top + shape.height <= field.top + field.height + 1,
      )
      expect(inside).toHaveLength(4)
      const [left, top] = [Math.min(...inside.map((shape) => shape.x)) - half, Math.min(...inside.map((shape) => shape.top)) - half]
      const [right, bottom] = [
        Math.max(...inside.map((shape) => shape.x + shape.width)) + half,
        Math.max(...inside.map((shape) => shape.top + shape.height)) + half,
      ]
      expect({ x: left, top, width: right - left, height: bottom - top }).toEqual(closeBox(field))
      for (const shape of inside) expect([shape.width + half, shape.height + half]).toEqual([expect.closeTo(mm(3), 2), expect.closeTo(mm(3), 2)])
    }
  })

  // A bill with its amount and its debtor has nothing for the payer to
  // write: no field, and no marks.
  test('draws no corner marks for a bill with an amount and a debtor', async () => {
    const { drawing } = await rendered(resolvedBill(SIX_EXAMPLES.one))
    expect(marks(drawing[0]!)).toEqual([])
  })
})
