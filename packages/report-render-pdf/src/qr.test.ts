import { rasterPixels, readCodes, readPdf, verify, type PdfCode, type ReadPdf } from '@formancy/report-corpus'
import type { Block, QrCode, ResolvedDocument } from '@formancy/report-runtime'
import { encode } from 'uqr'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderPdf } from './node.js'
import { bareDocument, BODY_HEIGHT, details, documentOf, fixtureOf, heading, ledger, PAGE, paragraph, PRINTABLE_WIDTH, TIMEOUT } from './testing/documents.js'
import { readDrawing, type DrawnPage, type Shape } from './testing/drawing.js'
import { lineOf } from './testing/lines.js'

/**
 * QR codes, proved on the PDF they were drawn in (0003): each page drawn by
 * PDF.js and decoded by ZXing (`readCodes`), as a scanner would, for what
 * the code says, and read from the PDF's own content stream
 * (`testing/drawing.ts`) for where its square and its modules are. Neither
 * asks the encoder what it meant to draw.
 */

// Every call to the encoder, counted, and passed through to it: a code
// encoded once to be checked and again to be drawn is two decisions that
// could disagree.
vi.mock('uqr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('uqr')>()
  return { ...actual, encode: vi.fn(actual.encode) }
})
beforeEach(() => {
  vi.mocked(encode).mockClear()
})

const LEFT = PAGE.margins.left

/** 0.4 mm, in points: the smallest module SIX's Swiss Implementation Guidelines for the QR-bill, version 2.3, section 6.3, allow in print. */
const MIN_MODULE = (0.4 * 72) / 25.4

/** Umlauts, the euro sign, and an emoji outside the Basic Multilingual Plane, which UTF-8 writes in four bytes and JavaScript in two code units. */
const SWISS = 'Grüezi Zürich: CHF 12.50 oder 9,99 € 🧾'

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

function qr(text: string, size: number, errorCorrection: QrCode['errorCorrection'] = 'M', id = 'payment-code'): QrCode {
  return { kind: 'qrCode', id, text, size, errorCorrection }
}

async function rendered(document: ResolvedDocument, maxPages = 20): Promise<{ bytes: Uint8Array; pdf: ReadPdf; drawing: DrawnPage[] }> {
  const bytes = await renderPdf(document, { maxPages })
  return { bytes, pdf: await readPdf(bytes), drawing: readDrawing(bytes) }
}

async function refusal(document: ResolvedDocument, maxPages = 5): Promise<unknown> {
  return renderPdf(document, { maxPages }).then(
    () => 'rendered',
    (error: unknown) => error,
  )
}

/** The one code on `page` of `bytes`; a page with none, or more, fails here. */
async function onlyCode(bytes: Uint8Array, page = 1): Promise<PdfCode> {
  const codes = await readCodes(bytes, page)
  expect(codes, `page ${page}`).toHaveLength(1)
  return codes[0]!
}

/** A version's symbol is 17 modules across and four more for each version after the first (ISO/IEC 18004). */
const modulesOf = (version: number): number => 17 + 4 * version

const white = (shapes: readonly Shape[]): Shape[] => shapes.filter((shape) => shape.fill === '#ffffff')
const dark = (shapes: readonly Shape[]): Shape[] => shapes.filter((shape) => shape.fill === '#000000')

/**
 * How near a code's geometry in the PDF is held to the exact one: within
 * half a thousandth of a point. A code is drawn in modules and scaled to
 * its size, and PDFKit writes the scale to six decimals, so a side of 185
 * modules can be off by a ten-thousandth.
 */
const DRAWN = 3

describe('what a QR code says', () => {
  // A code that scans to other bytes than its text's UTF-8 -- an umlaut as
  // Latin-1, an emoji as two broken halves -- sends a payment or a lookup
  // somewhere else. At a level other than the one asked for, it is either
  // less robust than the report says, or larger.
  test.each(['L', 'M', 'Q', 'H'] as const)('encodes its text as UTF-8 at level %s, and a scanner reads back the very bytes', async (level) => {
    const { bytes } = await rendered(bareDocument('Swiss', [qr(SWISS, 120, level)]))
    expect(await onlyCode(bytes)).toMatchObject({ text: SWISS, bytes: utf8(SWISS), ecLevel: level })
  })

  // report-runtime refuses a code of nothing in a final render, and a
  // preview hands it on as its content resolves, which can be nothing. A
  // renderer that refused it would fail the whole preview of a report whose
  // reference is not filled in yet, where its paragraphs print nothing; one
  // that drew anything but a symbol of no data could scan to text the
  // report does not hold. Its square and a version 1 symbol are drawn, and
  // ZXing reads no code in them. What a phone shows for it, nothing here
  // says.
  test('draws empty text as a symbol of no data, which ZXing reads as no code', async () => {
    const { bytes, drawing } = await rendered(bareDocument('Empty', [qr('', 60)]))
    const [square] = white(drawing[0]!.shapes)
    expect(square).toMatchObject({ width: expect.closeTo(60, DRAWN), height: expect.closeTo(60, DRAWN) })
    expect(new Set(dark(drawing[0]!.shapes).map((shape) => shape.height.toFixed(DRAWN)))).toEqual(new Set([(60 / (modulesOf(1) + 8)).toFixed(DRAWN)]))
    expect(await readCodes(bytes, 1)).toEqual([])
  })

  // uqr can raise the level to the highest the version it chose still
  // holds (`boostEcc`), which prints a code at another level than the
  // report asks for: denser to scan, or sturdier than it says. Each text is
  // sized to be raised one level and no further. Version 1 has 19, 16, 13
  // and 9 data codewords at L, M, Q and H; byte mode spends 4 bits on its
  // mode and 8 on the length, so it holds 17, 14, 11 and 7 bytes. Twelve
  // bytes are version 1 at L, and fit M's 14 but not Q's 11; nine at M fit
  // Q's 11 but not H's 7; five at Q fit H's 7.
  test.each([
    ['L', 'twelve bytes', 12],
    ['M', 'nine char', 9],
    ['Q', 'five!', 5],
  ] as const)('keeps level %s where uqr would raise it', async (level, text, length) => {
    expect(utf8(text)).toHaveLength(length)
    const { bytes } = await rendered(bareDocument('Not raised', [qr(text, 60, level)]))
    expect(await onlyCode(bytes)).toMatchObject({ text, ecLevel: level, version: 1 })
  })
})

describe('how a QR code is drawn', () => {
  // A square of another size than the report's, or one the layout did not
  // reserve, prints a code over the next paragraph or leaves a gap the
  // template does not have. White under the whole square, the quiet zone
  // included, is what lets it scan on a tinted section.
  test('draws a white square exactly its size where it stands, its code four modules in, and starts what follows below it', async () => {
    const size = 100
    const { bytes, pdf, drawing } = await rendered(bareDocument('Square', [paragraph('Above'), qr(SWISS, size), paragraph('Below')]))
    const [square] = white(drawing[0]!.shapes)
    expect(white(drawing[0]!.shapes)).toHaveLength(1)
    expect(square).toMatchObject({ x: expect.closeTo(LEFT, DRAWN), width: expect.closeTo(size, DRAWN), height: expect.closeTo(size, DRAWN) })
    expect(square!.top).toBeGreaterThan(lineOf(pdf, 'Above').bottom)
    expect(lineOf(pdf, 'Below').top).toBeGreaterThan(square!.top + size)
    const code = await onlyCode(bytes)
    const module = size / (modulesOf(code.version) + 8)
    // Where a scanner finds the symbol: within half a point of four modules in from every side.
    expect(code).toMatchObject({
      x: expect.closeTo(square!.x + 4 * module, 0),
      top: expect.closeTo(square!.top + 4 * module, 0),
      width: expect.closeTo(size - 8 * module, 0),
      height: expect.closeTo(size - 8 * module, 0),
    })
    // Every dark module is one module tall, in a row of the grid, inside the quiet zone, and painted over the white.
    for (const each of dark(drawing[0]!.shapes)) {
      expect(each.height).toBeCloseTo(module, DRAWN)
      const row = (each.top - square!.top) / module
      expect(row - Math.round(row)).toBeCloseTo(0, DRAWN)
      expect(each.x).toBeGreaterThanOrEqual(square!.x + 4 * module - 1e-3)
      expect(each.x + each.width).toBeLessThanOrEqual(square!.x + size - 4 * module + 1e-3)
      expect(each.paint).toBeGreaterThan(square!.paint)
    }
  })

  // A rectangle a module would be thousands of them in the path of a large
  // code, each written out in the PDF. A run of dark modules in a row is
  // one.
  test('draws each run of dark modules in a row as one rectangle of the path', async () => {
    const { drawing } = await rendered(bareDocument('Runs', [qr(SWISS, 120)]))
    const modules = dark(drawing[0]!.shapes)
    const rows = new Set(modules.map((shape) => shape.top.toFixed(DRAWN)))
    expect(rows.size).toBeGreaterThan(1)
    for (const row of rows) {
      const sorted = modules.filter((shape) => shape.top.toFixed(DRAWN) === row).sort((a, b) => a.x - b.x)
      const touching = sorted.slice(1).filter((each, index) => each.x - (sorted[index]!.x + sorted[index]!.width) < 1e-3)
      expect(touching, `the row at ${row} pt`).toEqual([])
    }
  })

  // A run of dark modules filled on its own is blended into the page on
  // its own: where two rows meet inside a pixel, each covers part of it,
  // and the pixel comes out grey, a light line across a dark bar. With each
  // run filled as a rectangle of its own, PDF.js drew such lines down this
  // code's finder pattern, its lightest pixel 62 of 255 at four pixels to
  // the point (17 October 2026). Filled once, as one path, the column is
  // black.
  test('draws its dark modules as one path filled once, so no light line runs between its rows', async () => {
    const size = 85.04
    const { bytes, drawing } = await rendered(bareDocument('Seams', [qr(SWISS, size)]))
    expect(new Set(dark(drawing[0]!.shapes).map((shape) => shape.paint)).size).toBe(1)
    const [square] = white(drawing[0]!.shapes)
    const module = size / (modulesOf((await onlyCode(bytes)).version) + 8)
    const scale = 4
    const { data, width } = await rasterPixels(bytes, 1, scale)
    // The finder pattern's left column, the symbol's first, is dark down
    // its seven rows. The pixels at its top and bottom edge are left out:
    // half covered, they are grey however the code is drawn.
    const x = Math.floor((square!.x + (4 + 0.5) * module) * scale)
    const [from, to] = [Math.ceil((square!.top + 4 * module) * scale) + 1, Math.floor((square!.top + 11 * module) * scale) - 1]
    const column = Array.from({ length: to - from }, (_, index) => data[((from + index) * width + x) * 4]!)
    expect(column.length).toBeGreaterThan(50)
    expect(Math.max(...column)).toBeLessThan(16)
  })

  // A code drawn a module apart from the box it was measured for, in a
  // column or a frame, prints over its neighbour.
  test('draws a code in a column at the column, and in a frame inside its padding', async () => {
    const { bytes, drawing } = await rendered(
      bareDocument('Placed', [
        {
          kind: 'columns',
          columns: [
            { width: 'fill', blocks: [paragraph('Beside the code')] },
            { width: 80, blocks: [qr('INV-2026-0042', 80, 'Q', 'column-code')] },
          ],
        },
        { kind: 'section', padding: 12, fill: '#eeeeee', blocks: [qr('INV-2026-0043', 60, 'Q', 'framed-code')] },
      ]),
    )
    const squares = white(drawing[0]!.shapes)
    expect(squares.map(({ x, width }) => ({ x, width }))).toEqual([
      { x: expect.closeTo(LEFT + PRINTABLE_WIDTH - 80, DRAWN), width: expect.closeTo(80, DRAWN) },
      { x: expect.closeTo(LEFT + 12, DRAWN), width: expect.closeTo(60, DRAWN) },
    ])
    expect((await readCodes(bytes, 1)).map((code) => code.text)).toEqual(['INV-2026-0042', 'INV-2026-0043'])
  })

  // The floor is a size the module may be. Checked with `<=`, it would
  // refuse a code at exactly 0.4 mm a module, and with it the size its own
  // refusal tells the author to use whenever that size is exact to the
  // hundredth of a point. Drawn at exactly the floor, the code is drawn and
  // read.
  test('draws a code whose modules are exactly the smallest it allows, and a scanner reads it', async () => {
    const text = 'https://formancy.ai/report/'
    const version = (await onlyCode((await rendered(bareDocument('Large', [qr(text, 150)]))).bytes)).version
    const smallest = (modulesOf(version) + 8) * MIN_MODULE
    const { bytes } = await rendered(bareDocument('Smallest', [qr(text, smallest)]))
    expect(await onlyCode(bytes)).toMatchObject({ text, version })
  })

  // A drawing that broke on the largest symbol -- 177 modules a side, the
  // most runs to draw and the finest modules in its square -- would print a
  // code no scanner reads, and nothing would refuse it. Version 40 at H
  // holds 1273 bytes, the fewest of any level, so it is the largest symbol
  // for the least text: every byte of it is drawn and read back.
  test(
    'draws the largest symbol whole, and a scanner reads every byte of it',
    async () => {
      const text = 'x'.repeat(1273)
      const { bytes } = await rendered(bareDocument('Version 40', [qr(text, 300, 'H')]))
      expect(await onlyCode(bytes)).toMatchObject({ text, ecLevel: 'H', version: 40 })
    },
    TIMEOUT,
  )

  // pdfmake's page header and footer are laid out anew for every page; a
  // code there is drawn on each, and encoded once.
  test(
    'prints a code in the page footer on every page, encoded once',
    async () => {
      const document = { ...documentOf('Footer code', [ledger('lines', details(1, 120))]), pageFooter: [qr('INV-2026-0042', 40, 'Q', 'footer-code')] }
      const { bytes, pdf } = await rendered(document)
      expect(pdf.pages.length).toBeGreaterThan(1)
      for (const page of pdf.pages) expect((await onlyCode(bytes, page.number)).text).toBe('INV-2026-0042')
      expect(encode).toHaveBeenCalledTimes(1)
    },
    TIMEOUT,
  )
})

describe('a QR code in the flow', () => {
  // A heading kept with the block after it is kept with a code as with an
  // image: "Scan to pay" left at the foot of one page, its code on the
  // next, is a heading over nothing and a code under nothing. Inside a
  // framed section the code is found as well.
  test.each([
    ['standing alone', (code: QrCode): Block => code],
    ['inside a framed section', (code: QrCode): Block => ({ kind: 'section', border: { thickness: 1, color: '#000000' }, padding: 4, blocks: [code] })],
  ])('keeps a heading with the code after it, %s', async (_, around) => {
    const document = documentOf('Kept with a code', [{ kind: 'spacer', height: BODY_HEIGHT - 60 }, heading('Scan to pay'), around(qr('INV-2026-0042', 100))])
    const { bytes, pdf } = await rendered(document)
    expect(pdf.pages).toHaveLength(2)
    expect(await readCodes(bytes, 1)).toEqual([])
    expect((await onlyCode(bytes, 2)).text).toBe('INV-2026-0042')
    expect(lineOf(pdf, 'Scan to pay').page).toBe(2)
  })

  // A heading that has to move to stay with what follows it makes pdfmake
  // lay the whole document out again. A code drawn before it stays where it
  // stood. pdfmake 0.3.11 puts a canvas's rectangles back before it lays
  // out again, but not a polyline's points, which it moved in place: a
  // code drawn as a polyline is drawn twice as far from the page's corner,
  // off its square.
  test('stays where it stands when pdfmake lays the document out again', async () => {
    const terms: Block = { kind: 'keepTogether', blocks: Array.from({ length: 8 }, (_, index) => paragraph(`Term ${index + 1}`)) }
    // The heading fits at the foot of the first page; the eight terms kept together after it do not.
    const document = bareDocument('Laid out again', [
      qr('INV-2026-0041', 60, 'Q', 'first-code'),
      { kind: 'spacer', height: BODY_HEIGHT - 120 },
      heading('Terms'),
      terms,
    ])
    const { bytes, pdf, drawing } = await rendered(document)
    expect(lineOf(pdf, 'Terms').page).toBe(2)
    const [square] = white(drawing[0]!.shapes)
    expect(square).toMatchObject({ x: expect.closeTo(LEFT, DRAWN), top: expect.closeTo(PAGE.margins.top, DRAWN) })
    const module = 60 / (modulesOf(1) + 8)
    expect(await onlyCode(bytes, 1)).toMatchObject({
      text: 'INV-2026-0041',
      x: expect.closeTo(LEFT + 4 * module, 0),
      top: expect.closeTo(PAGE.margins.top + 4 * module, 0),
    })
  })

  // A page that holds a code and no text prints something: the corpus's
  // checks see text and images, and a code is neither.
  test('prints a page that holds a code alone', async () => {
    const document = documentOf('Code alone', [paragraph('Before the break'), { kind: 'pageBreak' }, qr('INV-2026-0042', 100)])
    const { bytes, pdf } = await rendered(document)
    expect(verify(fixtureOf('code-alone', document, { minPagesExpected: 2, maxPagesExpected: 2 }), pdf)).toEqual([])
    expect((await onlyCode(bytes, 2)).text).toBe('INV-2026-0042')
  })

  // A body of codes taller than the page limit allows is refused before
  // pdfmake measures it, as a body of images is.
  test('counts a code’s side in the least height a body needs', async () => {
    const codes = Array.from({ length: 10 }, (_, index) => qr(`CODE-${index}`, 300, 'M', `code-${index}`))
    expect(await refusal(documentOf('Many codes', codes), 2)).toMatchObject({ code: 'too-many-pages', message: expect.stringContaining('at least') })
  })
})

describe('what a QR code refuses', () => {
  // A code drawn at another level, cut short, or not drawn at all says
  // something the report does not.
  test('refuses text no version holds at its level', async () => {
    expect(await refusal(bareDocument('Too long', [qr('x'.repeat(1274), 300, 'H')]))).toMatchObject({
      code: 'content-too-large',
      subject: 'payment-code',
      message: expect.stringContaining('1274 bytes'),
    })
  })

  // Encoding takes time and memory with the length of the text, and a
  // field's value can be any length: text longer than any code holds, in
  // any mode at any level, is refused without being encoded.
  test('refuses text past the most any version holds, unencoded', async () => {
    expect(await refusal(bareDocument('Too long', [qr('1'.repeat(7090), 300, 'L')]))).toMatchObject({
      code: 'content-too-large',
      subject: 'payment-code',
      message: expect.stringContaining('7090 characters'),
    })
    expect(encode).not.toHaveBeenCalled()
  })

  // An emoji is one character and two UTF-16 code units. Counted in code
  // units, 7090 receipts would be refused as 14180 characters, and 3600 --
  // more than 7089 code units, fewer characters -- refused for a length
  // they do not have. The cap counts characters; within it the encoder
  // decides, in bytes.
  test('counts characters as a reader does, an emoji as one', async () => {
    const past = await refusal(bareDocument('Too long', [qr('\u{1F9FE}'.repeat(7090), 300, 'L')]))
    expect(past).toMatchObject({ code: 'content-too-large', message: expect.stringContaining('holds 7090 characters') })
    expect(encode).not.toHaveBeenCalled()
    const within = await refusal(bareDocument('Too many bytes', [qr('\u{1F9FE}'.repeat(3600), 300, 'L')]))
    expect(within).toMatchObject({ code: 'content-too-large', message: expect.stringContaining(`${4 * 3600} bytes`) })
    expect(encode).toHaveBeenCalledTimes(1)
  })

  // Every character a version-40 code at level L holds as digits is drawn;
  // the cap that refuses longer text unread is no lower than the standard's.
  test(
    'draws the most digits any version holds',
    async () => {
      const { bytes } = await rendered(bareDocument('Most digits', [qr('1'.repeat(7089), 300, 'L')]))
      expect(await onlyCode(bytes)).toMatchObject({ text: '1'.repeat(7089), version: 40 })
    },
    TIMEOUT,
  )

  // The encoder failing for any other reason than text too long is the
  // engine failing, and said so, never a report refused for its length.
  test('passes on an encoder error that is not about the text’s length', async () => {
    vi.mocked(encode).mockImplementationOnce(() => {
      throw new RangeError('Invalid value')
    })
    const refused = await refusal(bareDocument('Encoder fails', [qr('A', 60)]))
    expect(refused).toBeInstanceOf(RangeError)
    expect(refused).toMatchObject({ message: 'Invalid value' })
  })

  // Modules finer than a printer and a scanner resolve make a code that
  // does not scan. The refusal says how large the square must be.
  test('refuses a square too small for its text, naming the module and the size it needs', async () => {
    const text = 'https://formancy.ai/report/'
    const version = (await onlyCode((await rendered(bareDocument('Large', [qr(text, 150)]))).bytes)).version
    const smallest = (modulesOf(version) + 8) * MIN_MODULE
    const refused = await refusal(bareDocument('Too small', [qr(text, smallest - 0.01)]))
    expect(refused).toMatchObject({ code: 'content-too-large', subject: 'payment-code' })
    // Rounded up, so that the size it names is one that is drawn.
    expect((refused as Error).message).toContain(`at least ${(Math.ceil(smallest * 100) / 100).toFixed(2)} pt`)
    expect((refused as Error).message).toContain(`${((smallest - 0.01) / (modulesOf(version) + 8)).toFixed(2)} pt`)
  })

  // The floor is SIX's (Swiss Implementation Guidelines for the QR-bill,
  // version 2.3, section 6.3), and the same guidelines print the largest
  // code a QR-bill holds, version 25 for 997 bytes at level M (6.2), at
  // 46 mm a side without its quiet zone (6.4): modules of 0.393 mm. A floor
  // rounded, or given a tolerance, to let that code through would let
  // every code be drawn finer than 0.4 mm. The general code refuses it;
  // how a QR-bill draws its own is a later record's to decide.
  test('refuses the largest code a QR-bill prints, its modules 0.393 mm', async () => {
    const symbol = modulesOf(25)
    const refused = await refusal(bareDocument('QR-bill', [qr('x'.repeat(997), (((46 * 72) / 25.4) * (symbol + 8)) / symbol)]))
    expect(refused).toMatchObject({
      code: 'content-too-large',
      subject: 'payment-code',
      message: expect.stringContaining(`the ${symbol + 8} modules across its symbol and quiet zone 1.11 pt each`),
    })
  })

  // A square wider than where it stands runs into the next column or past
  // the margin; taller than the body, past its foot.
  test.each([
    ['wider than the page', [qr('A', PRINTABLE_WIDTH + 1)], PAGE],
    [
      'wider than its column',
      [
        {
          kind: 'columns',
          columns: [
            { width: 100, blocks: [qr('A', 120)] },
            { width: 'fill', blocks: [] },
          ],
        },
      ],
      PAGE,
    ],
    ['wider than the padding of its frame leaves', [{ kind: 'section', padding: 20, blocks: [qr('A', PRINTABLE_WIDTH - 20)] }], PAGE],
    ['taller than the body of a landscape page', [qr('A', 500)], { ...PAGE, orientation: 'landscape' }],
  ] as const)('refuses a code %s', async (_, body, page) => {
    expect(await refusal({ ...documentOf('Too large', body as readonly Block[]), page })).toMatchObject({ code: 'content-too-large', subject: 'payment-code' })
  })

  // What no encoder can draw as written: a square of no size, a level the
  // standard does not have, text that is not text -- an array, or a lone
  // half of a surrogate pair, which has no UTF-8.
  test.each([
    ['a square of no size', qr('A', 0)],
    ['a square of a size that is not a number', qr('A', Number.NaN)],
    ['a square of an endless size', qr('A', Number.POSITIVE_INFINITY)],
    ['a level the standard does not have', { ...qr('A', 60), errorCorrection: 'X' as 'L' }],
    ['text that is not a string', { ...qr('A', 60), text: ['A'] as unknown as string }],
    ['a lone half of a surrogate pair', qr('receipt \uD83E', 60)],
  ])('refuses %s', async (_, code) => {
    expect(await refusal(bareDocument('Malformed', [code]))).toMatchObject({ code: 'unsupported', subject: 'payment-code' })
  })
})
