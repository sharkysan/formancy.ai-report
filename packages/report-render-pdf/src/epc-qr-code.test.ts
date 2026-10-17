import pdfmake from 'pdfmake'
import { rasterPixels, readCodes, readPdf, verify, type PdfCode, type PdfTextItem, type ReadPdf } from '@formancy/report-corpus'
import { EPC_CAPTION, EPC_FRAME, type Block, type EpcQrCode, type QrCode, type ResolvedDocument } from '@formancy/report-runtime'
import { encode } from 'uqr'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderPdf } from './node.js'
import { bareDocument, BODY_HEIGHT, details, documentOf, fixtureOf, heading, ledger, PAGE, paragraph, PRINTABLE_WIDTH, TIMEOUT } from './testing/documents.js'
import { readDrawing, type DrawnPage, type Shape } from './testing/drawing.js'
import { lineOf } from './testing/lines.js'

/**
 * EPC QR codes, proved on the PDF they were drawn in (0003, 0020): each
 * page drawn by PDF.js and decoded by ZXing (`readCodes`) for what a
 * banking app reads, the caption read back as text by PDF.js (`readPdf`),
 * and the frame, the square and the modules read from the PDF's own
 * content stream (`testing/drawing.ts`) and from its pixels. None asks the
 * encoder what it meant to draw.
 *
 * "EPC" is EPC069-12 version 3.1, whose examples (2.3) are the payloads
 * here; "PSA" is Austria's "QR-Code und BCD Definition", version 3.0,
 * whose section 5 gives the frame and the caption.
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

/** EPC 2.3's first example, byte for byte: 95 characters, 96 bytes of UTF-8, "Resulting QR code version 6". */
const V1 = ['BCD', '001', '1', 'SCT', 'BHBLDEHHXXX', 'Franz Mustermänn', 'DE71110220330123456789', 'EUR12.3', 'GDDS', 'RF18539007547034'].join('\n')

/** Its second, written in UTF-8 as the runtime writes it: character set 1 where the example has 2, and 104 bytes for its 103 characters. */
const V2 = ['BCD', '002', '1', 'SCT', '', "François D'Alsace S.A.", 'FR1420041010050500013M02606', 'EUR12.3', '', '', 'Client:Marie Louise La Lune'].join('\n')

/**
 * A payload of the EPC's shape and `bytes` bytes, every element within
 * its length: a BIC, a name of 70, an IBAN, the largest amount, a purpose,
 * no reference, a text of 140, and information to make up the rest, its
 * last character `last`.
 */
function payloadOf(bytes: number, last = 'I'): string {
  const head = ['BCD', '001', '1', 'SCT', 'BHBLDEHHXXX', 'N'.repeat(70), 'DE89370400440532013000', 'EUR999999999.99', 'GDDS', '', 'T'.repeat(140)].join('\n')
  const rest = bytes - new TextEncoder().encode(`${head}\n${last}`).length
  return rest < 0 ? head.slice(0, bytes) : `${head}\n${'I'.repeat(rest)}${last}`
}

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

function epc(payload: string, size: number, caption?: 'zahlenMitCode', id = 'pay-code'): EpcQrCode {
  return { kind: 'epcQrCode', id, payload, size, ...(caption === undefined ? {} : { caption }) }
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

/** One mil in millimetres, and a millimetre in points. */
const MIL = 0.0254
const MM = 72 / 25.4

/** The caption's length as report-spec counts it: its advance at its size. */
const CAPTION = EPC_CAPTION.advance * EPC_CAPTION.size

/** How near a drawn length is held to the exact one: PDFKit writes six decimals, and a module is scaled from the square. */
const DRAWN = 3

/** The square, the frame, the symbol and the caption of the one captioned code on the first page. */
async function captioned(size: number, payload = V1): Promise<{ bytes: Uint8Array; square: Shape; frame: Shape; symbol: { x: number; top: number; side: number; module: number }; caption: PdfTextItem; pdf: ReadPdf }> {
  const { bytes, pdf, drawing } = await rendered(bareDocument('Zahlen mit Code', [epc(payload, size, 'zahlenMitCode')]))
  const shapes = drawing[0]!.shapes
  const [square] = shapes.filter((shape) => shape.fill === '#ffffff')
  const frames = shapes.filter((shape) => shape.stroke === '#000000')
  expect(frames, 'the frame is one stroked path').toHaveLength(1)
  const dark = shapes.filter((shape) => shape.fill === '#000000')
  const [x, top] = [Math.min(...dark.map((each) => each.x)), Math.min(...dark.map((each) => each.top))]
  const side = Math.max(...dark.map((each) => each.x + each.width)) - x
  const module = Math.min(...dark.map((each) => each.height))
  const [caption, ...others] = pdf.pages[0]!.items
  expect(others).toEqual([])
  return { bytes, square: square!, frame: frames[0]!, symbol: { x, top, side, module }, caption: caption!, pdf }
}

describe('what an EPC QR code says', () => {
  // A code that scans to other bytes than its payload -- an umlaut as
  // Latin-1, a line feed lost -- initiates a transfer to someone else, or
  // none. At another level than M, or past version 13, a banking app need
  // not read it (EPC 2.1). Without a caption the version is the smallest
  // that holds the payload, as the EPC's examples say: version 6.
  test.each([
    ['V1', V1],
    ['V2', V2],
  ])("reads back EPC 2.3's example %s byte for byte, at level M, in version 6", async (_, payload) => {
    const { bytes } = await rendered(bareDocument('EPC', [epc(payload, 85.04)]))
    expect(await onlyCode(bytes)).toMatchObject({ text: payload, bytes: utf8(payload), ecLevel: 'M', version: 6 })
  })

  // 331 bytes is the most the EPC allows, and what version 13 holds at
  // level M (EPC 2.1; PSA 4): drawn whole and read back, with and without
  // the caption, whose square of 118.6 pt gives version 13 modules of
  // 20 mil exactly.
  test.each([
    ['without the caption', undefined, 100],
    ['with the caption', 'zahlenMitCode', 118.6],
  ] as const)('reads back the most an EPC QR code holds, 331 bytes in version 13, %s', async (_, caption, size) => {
    const payload = payloadOf(331)
    expect(utf8(payload)).toHaveLength(331)
    const { bytes } = await rendered(bareDocument('Most', [epc(payload, size, caption)]))
    expect(await onlyCode(bytes)).toMatchObject({ bytes: utf8(payload), ecLevel: 'M', version: 13 })
  })

  // A 32 mm square, 90.71 pt as the format stores it, prints every payload
  // the EPC allows, with the caption and without: version 13's modules are
  // 0.416 mm without it, over 0020's 0.4, and 0.381 mm with it, the PSA's
  // 15 mil. A 30 mm square refuses the longest, past 287 bytes without the
  // caption and past 251 with it, so that one template would print one
  // invoice and refuse the next by the length of its data alone. The
  // builders' new code is 32 mm for this (0025).
  test.each([
    ['without the caption', undefined],
    ['with the caption', 'zahlenMitCode'],
  ] as const)('reads back 331 bytes from a 32 mm square %s, which a 30 mm square refuses', async (_, caption) => {
    const payload = payloadOf(331)
    const { bytes } = await rendered(bareDocument('Most', [epc(payload, 90.71, caption)]))
    expect(await onlyCode(bytes)).toMatchObject({ bytes: utf8(payload), ecLevel: 'M', version: 13 })
    expect(await refusal(bareDocument('Most', [epc(payload, 85.04, caption)]))).toMatchObject({ code: 'content-too-large' })
  })
})

describe('how an EPC QR code is drawn without a caption', () => {
  // Without a caption the EPC gives no size and no frame, and the code is
  // a QR code (0020): the same square, quiet zone and modules as a
  // `qrCode` of its payload at level M. Drawn otherwise, two codes the
  // same size on one invoice would have different quiet zones.
  test('is drawn as a QR code of its payload at level M is', async () => {
    const code: QrCode = { kind: 'qrCode', id: 'pay-code', text: V1, size: 85.04, errorCorrection: 'M' }
    const [asEpc, asQr] = await Promise.all([rendered(bareDocument('EPC', [epc(V1, 85.04)])), rendered(bareDocument('EPC', [code]))])
    expect(asEpc.drawing).toEqual(asQr.drawing)
    expect(asEpc.pdf.pages[0]!.items).toEqual([])
  })

  // Without its caption a code holds no text and no image the corpus's
  // reader sees, as a QR code holds none: a page of it alone prints all the
  // same, and the checks a document implies take it so, as they take a QR
  // code's, rather than fail a page that prints a code as empty.
  test('alone on a page is a page that prints, to the checks a document implies', async () => {
    const document = bareDocument('Code alone', [paragraph('Bitte bezahlen Sie mit dem Code.'), { kind: 'pageBreak' }, epc(V1, 85.04)])
    const { pdf, bytes } = await rendered(document)
    expect(pdf.pages[1]!.items).toEqual([])
    expect(await onlyCode(bytes, 2)).toMatchObject({ text: V1 })
    expect(verify(fixtureOf('code-alone', document, { minPagesExpected: 2, maxPagesExpected: 2 }), pdf)).toEqual([])
  })
})

describe('how an EPC QR code is drawn with the caption', () => {
  // The PSA's frame (PSA 5's figure): a line at most 0.8 modules wide,
  // corners of two modules, four modules from the symbol on every side
  // but the caption's; around it all, the square exactly its size. A
  // frame closer than four modules stands in ISO/IEC 18004's quiet zone,
  // a line too heavy reads as part of the symbol, and a frame past the
  // square prints over what stands beside it.
  test("draws the PSA's frame inside its square, four modules from the symbol", async () => {
    const size = 85.04
    const { square, frame, symbol } = await captioned(size)
    const module = symbol.module
    expect(square).toMatchObject({ x: expect.closeTo(PAGE.margins.left, DRAWN), top: expect.closeTo(PAGE.margins.top, DRAWN), width: expect.closeTo(size, DRAWN), height: expect.closeTo(size, DRAWN) })
    expect(frame.lineWidth).toBeCloseTo(EPC_FRAME.line * module, DRAWN)
    expect(frame.lineWidth).toBeLessThanOrEqual(0.8 * module)
    // The frame's outer edge is the square's on the left and on the right.
    expect(frame.x - frame.lineWidth / 2).toBeCloseTo(square.x, DRAWN)
    expect(frame.x + frame.width + frame.lineWidth / 2).toBeCloseTo(square.x + size, DRAWN)
    // Its inner edge four modules from the symbol, left, above and below.
    const inner = { left: frame.x + frame.lineWidth / 2, top: frame.top + frame.lineWidth / 2, bottom: frame.top + frame.height - frame.lineWidth / 2 }
    expect(symbol.x - inner.left).toBeCloseTo(4 * module, DRAWN)
    expect(symbol.top - inner.top).toBeCloseTo(4 * module, DRAWN)
    expect(inner.bottom - (symbol.top + symbol.side)).toBeCloseTo(4 * module, DRAWN)
    // Inside the square down, in the middle of it.
    expect(frame.top - frame.lineWidth / 2 - square.top).toBeCloseTo(square.top + size - (frame.top + frame.height + frame.lineWidth / 2), DRAWN)
    // Each side straight to two modules from the corner: the left side runs from two modules below the top to two above the foot.
    const left = frame.points.filter(([x]) => Math.abs(x - frame.x) < 1e-3).map(([, y]) => y)
    expect(Math.min(...left) - frame.top).toBeCloseTo(EPC_FRAME.radius * module, DRAWN)
    expect(frame.top + frame.height - Math.max(...left)).toBeCloseTo(EPC_FRAME.radius * module, DRAWN)
  })

  // "Zahlen mit Code ... to the right from bottom to top", at 7 pt or more
  // in "Arial o.s. non-serifs" (PSA 5): text a reader finds, in Liberation
  // Sans, up the right side, its baseline on the frame's line, which is
  // broken a module beyond each end of it. Its length is report-spec's
  // `EPC_CAPTION.advance`, which decides the sizes a captioned code may
  // have: a caption longer than that would run into the frame's corners.
  test('prints "Zahlen mit Code" up the right side at 7 pt in Liberation Sans, the frame broken around it', async () => {
    const { frame, symbol, caption, pdf } = await captioned(85.04)
    expect(caption).toMatchObject({ text: 'Zahlen mit Code', angle: 90 })
    expect(caption.width).toBeCloseTo(7, DRAWN)
    expect(caption.height).toBeCloseTo(CAPTION, DRAWN)
    expect(CAPTION).toBeCloseTo(51.36, 2)
    expect(pdf.fonts).toEqual([{ name: expect.stringMatching(/\+LiberationSans$/), embedded: true }])
    // Its baseline, four fifths of the size right of its box's left edge, is the frame's right line.
    const right = frame.x + frame.width
    expect(caption.x + 0.8 * 7).toBeCloseTo(right, DRAWN)
    // Centred on the symbol, and no longer than it.
    expect((caption.top + caption.bottom) / 2).toBeCloseTo(symbol.top + symbol.side / 2, DRAWN)
    expect(caption.height).toBeLessThanOrEqual(symbol.side)
    // The frame's path runs from below the caption round to above it, a module clear of each end.
    const [start, end] = [frame.points[0]!, frame.points.at(-1)!]
    expect(start[0]).toBeCloseTo(right, DRAWN)
    expect(end[0]).toBeCloseTo(right, DRAWN)
    expect(start[1] - caption.bottom).toBeCloseTo(symbol.module, DRAWN)
    expect(caption.top - end[1]).toBeCloseTo(symbol.module, DRAWN)
  })

  // ISO/IEC 18004's quiet zone is four modules of light around the
  // symbol, and the PSA's caption stands at least three from it: the
  // pixels PDF.js draws within four modules of the symbol's sides are
  // white, and the frame's line and the caption dark where they stand.
  // At the corners the PSA's own figure reaches in: a frame four modules
  // from the symbol with corners rounded by two has its inner edge 2.25
  // modules out and 1.75 round, so that out along the diagonal from the
  // symbol's corner it comes within 3.49 modules of both of the symbol's
  // edges, half a module into the quiet zone's corner. Within 3.3 modules
  // there, the pixels are white too.
  test("leaves the quiet zone white in the pixels but where the PSA's corners round into it, and draws the frame's line and the caption dark", async () => {
    const { bytes, square, frame, symbol, caption } = await captioned(85.04)
    const scale = 4
    const { data, width } = await rasterPixels(bytes, 1, scale)
    const at = (x: number, y: number): number => data[(Math.floor(y * scale) * width + Math.floor(x * scale)) * 4]!
    /** How far `value` is outside the symbol along one axis, from `from`, in modules; 0 within it. */
    const outside = (value: number, from: number): number => Math.max(from - value, value - from - symbol.side, 0) / symbol.module
    // Half a point short of the symbol and of four modules out, where a pixel is part covered whatever is drawn.
    const margin = 0.5 / symbol.module
    const ring: number[] = []
    for (let y = symbol.top - 4 * symbol.module; y < symbol.top + symbol.side + 4 * symbol.module; y += 1 / scale) {
      for (let x = symbol.x - 4 * symbol.module; x < symbol.x + symbol.side + 4 * symbol.module; x += 1 / scale) {
        const [across, down] = [outside(x, symbol.x), outside(y, symbol.top)]
        const far = Math.max(across, down)
        if (far < margin || far > 4 - margin || (across > 0 && down > 0 && far > 3.3)) continue
        ring.push(at(x, y))
      }
    }
    expect(ring.length).toBeGreaterThan(10000)
    expect(Math.min(...ring)).toBeGreaterThan(250)
    // The frame's left line, down its middle, and the caption's letters.
    const line = Array.from({ length: 40 }, (_, index) => at(frame.x, symbol.top + (index * symbol.side) / 40))
    expect(Math.max(...line)).toBeLessThan(128)
    const letters = Array.from({ length: Math.floor(caption.height * scale) }, (_, index) => at(caption.x + 0.8 * 7 - 1, caption.top + index / scale))
    expect(Math.min(...letters)).toBeLessThan(64)
    // From the symbol's top left corner out along the diagonal, the first dark pixel is the frame's corner, its inner edge 3.49 modules out and its line a third of a module on.
    const diagonal = Array.from({ length: Math.ceil(5 * symbol.module * scale) }, (_, index) => index / scale)
    const reach = diagonal.find((out) => out > 0.5 && at(symbol.x - out, symbol.top - out) < 128)!
    expect(reach / symbol.module).toBeGreaterThan(3.3)
    expect(reach / symbol.module).toBeLessThan(3.7)
    // Nothing is drawn outside the square.
    expect(at(square.x - 1, square.top + 40)).toBe(255)
    expect(at(square.x + square.width + 1, square.top + 40)).toBe(255)
  })

  // The PSA prints modules from 15 to 20 mil (PSA 5). In a 30 mm square
  // the version that holds the EPC's first example, 6, would have modules
  // of 0.557 mm; the code is drawn in version 8, the least whose modules
  // are within the PSA's and whose symbol the caption fits beside, and
  // reads back to the same bytes.
  test("draws the least version whose modules are the PSA's, which reads back to the same payload", async () => {
    const { bytes, symbol } = await captioned(85.04)
    expect(await onlyCode(bytes)).toMatchObject({ text: V1, ecLevel: 'M', version: 8 })
    const width = symbol.module / MM
    expect(width).toBeGreaterThanOrEqual(15 * MIL)
    expect(width).toBeLessThanOrEqual(20 * MIL)
    expect(symbol.side).toBeCloseTo(modulesOf(8) * symbol.module, DRAWN)
  })

  // A payload that needs a larger version than the least is drawn in the
  // version it needs, while its modules are 15 mil or more: 282 bytes
  // need version 12 at level M, whose modules in a square of 95 pt are
  // 0.422 mm.
  test('draws a payload in the larger version it needs, while its modules are 15 mil or more', async () => {
    const payload = payloadOf(282)
    const { bytes, symbol } = await captioned(95, payload)
    expect(await onlyCode(bytes)).toMatchObject({ bytes: utf8(payload), ecLevel: 'M', version: 12 })
    expect(symbol.module / MM).toBeGreaterThanOrEqual(15 * MIL)
  })

  // What the frame and the caption take of a 30 mm square, measured on
  // the PDF on 17 October 2026 and recorded in `epc.ts`: across, 8.5
  // modules and the caption's 7 pt band, 18.54 pt of 85.04, so that the
  // symbol is 78.2 % of the side; down, 9 modules, with 6.32 pt of the
  // square white above and below the frame.
  test('leaves the symbol 78.2 % of a 30 mm square, the frame and caption the rest', async () => {
    const size = 85.04
    const { frame, symbol, square } = await captioned(size)
    expect(symbol.module).toBeCloseTo((size - 7) / (modulesOf(8) + 8.5), DRAWN)
    expect(symbol.module / MM).toBeCloseTo(0.479, 3)
    expect(size - symbol.side).toBeCloseTo(18.54, 2)
    expect(symbol.side / size).toBeCloseTo(0.782, 3)
    expect(size - (frame.height + frame.lineWidth)).toBeCloseTo(6.32, 2)
    expect(frame.top - frame.lineWidth / 2 - square.top).toBeCloseTo(3.16, 2)
  })
})

describe('an EPC QR code in the document', () => {
  // pdfmake lays a page footer out anew for every page; a code there is
  // drawn, captioned, on each, and encoded once.
  test('prints a captioned code in the page footer on every page, encoded once', async () => {
    const document = { ...documentOf('Footer code', [ledger('lines', details(1, 120))]), pageFooter: [epc(V1, 85.04, 'zahlenMitCode', 'footer-code')] }
    const { bytes, pdf } = await rendered(document)
    expect(pdf.pages.length).toBeGreaterThan(1)
    for (const page of pdf.pages) {
      expect((await onlyCode(bytes, page.number)).text).toBe(V1)
      expect(page.items.filter((item) => item.angle === 90).map((item) => item.text)).toEqual(['Zahlen mit Code'])
    }
    expect(encode).toHaveBeenCalledTimes(1)
  }, TIMEOUT)

  // "Bitte mit dem Code bezahlen" left at the foot of one page, the
  // code on the next, is a heading over nothing: a heading is kept with
  // the code after it, as with a QR code.
  test('keeps a heading with the code after it', async () => {
    const document = documentOf('Kept with a code', [{ kind: 'spacer', height: BODY_HEIGHT - 60 }, heading('Bitte mit dem Code bezahlen'), epc(V1, 85.04, 'zahlenMitCode')])
    const { bytes, pdf } = await rendered(document)
    expect(pdf.pages).toHaveLength(2)
    expect(await readCodes(bytes, 1)).toEqual([])
    expect((await onlyCode(bytes, 2)).text).toBe(V1)
    expect(lineOf(pdf, 'Bitte mit dem Code bezahlen').page).toBe(2)
  })

  // A body of codes taller than the page limit allows is refused before
  // pdfmake measures it, as a body of QR codes is.
  test('counts a code’s side in the least height a body needs', async () => {
    const codes = Array.from({ length: 10 }, (_, index) => epc(V1, 300, undefined, `code-${index}`))
    expect(await refusal(documentOf('Many codes', codes), 2)).toMatchObject({ code: 'too-many-pages', message: expect.stringContaining('at least') })
  })
})

describe('what an EPC QR code refuses', () => {
  /** A refusal's message, which names the code and the rule and never quotes the payload: it holds a name and an account. */
  async function refused(block: Block, code: string): Promise<string> {
    const error = await refusal(bareDocument('Refused', [block]))
    expect(error).toMatchObject({ code, subject: 'pay-code' })
    const { message } = error as Error
    for (const quoted of ['Mustermänn', 'DE71110220330123456789', 'BHBLDEHHXXX', 'RF18539007547034', 'N'.repeat(10)]) expect(message).not.toContain(quoted)
    return message
  }

  // Past 331 bytes the EPC's code is no longer one (EPC 2.1): never drawn
  // in a larger version, which a banking app need not read. A payload
  // longer than that in characters is refused without being encoded; one
  // whose characters fit but whose UTF-8 does not, once the encoder finds
  // no version up to 13 holds it.
  test('refuses a payload past 331 bytes, unencoded when its characters are already past it', async () => {
    expect(await refused(epc(payloadOf(332), 100), 'content-too-large')).toContain('more than the 331 bytes the EPC allows')
    expect(encode).not.toHaveBeenCalled()
    const wide = payloadOf(332, 'ä')
    expect(wide).toHaveLength(331)
    expect(await refused(epc(wide, 100), 'content-too-large')).toContain('332 bytes, more than version 13 holds at level M')
    expect(encode).toHaveBeenCalledTimes(1)
  })

  // Without a caption, 0020's floor: modules under 0.4 mm make a code a
  // printer and a phone may not resolve, and the refusal names the square
  // the payload needs. The EPC's first example is version 6, 49 modules
  // with its quiet zone: at least 55.56 pt.
  test('refuses, without a caption, a square too small for its payload at 0.4 mm a module', async () => {
    const message = await refused(epc(V1, 55.55), 'content-too-large')
    expect(message).toContain('so its payload needs a square of at least 55.56 pt')
    const { bytes } = await rendered(bareDocument('Smallest', [epc(V1, 55.56)]))
    expect((await onlyCode(bytes)).version).toBe(6)
  })

  // With the caption, the square alone can break the PSA's rules: below
  // 68.06 pt no symbol with modules of 15 mil or more is as tall as the
  // caption beside it, and above 118.6 pt even version 13's modules are
  // over 20 mil. report-spec refuses both in the editor; a document that
  // reaches the renderer without it is refused here, before encoding.
  test.each([
    [68.05, 'a code needs a square of at least 68.06 pt'],
    [118.61, 'a code needs a square of at most 118.60 pt'],
  ])('refuses, with the caption, a square of %s pt, which no version prints in', async (size, rule) => {
    expect(await refused(epc(V1, size, 'zahlenMitCode'), 'content-too-large')).toContain(rule)
    expect(encode).not.toHaveBeenCalled()
  })

  // A payload whose version has modules under 15 mil in its square is
  // refused, never drawn finer or at a lower level: 282 bytes need version
  // 12, whose modules in 85.04 pt are 0.374 mm.
  test('refuses, with the caption, a payload whose version has modules under 15 mil in its square', async () => {
    expect(await refused(epc(payloadOf(282), 85.04, 'zahlenMitCode'), 'content-too-large')).toContain('this version 12 code has modules of 0.374 mm')
  })

  // A square wider than where it stands runs into the next column or past
  // the margin; taller than the body, past its foot.
  test.each([
    ['wider than the page', [epc(V1, PRINTABLE_WIDTH + 1)], PAGE],
    ['wider than its column', [{ kind: 'columns', columns: [{ width: 80, blocks: [epc(V1, 85.04, 'zahlenMitCode')] }, { width: 'fill', blocks: [] }] }], PAGE],
    ['taller than the body of a landscape page', [epc(V1, 500)], { ...PAGE, orientation: 'landscape' }],
  ] as const)('refuses a code %s', async (_, body, page) => {
    expect(await refusal({ ...documentOf('Too large', body as readonly Block[]), page })).toMatchObject({ code: 'content-too-large', subject: 'pay-code' })
  })

  // What no encoder can draw as written: a square of no size, a caption
  // this renderer does not know -- never drawn as no caption, or as some
  // other -- and a payload that is not text, or holds a lone half of a
  // surrogate pair, which has no UTF-8.
  test.each([
    ['a square of no size', epc(V1, 0)],
    ['a square of a size that is not a number', epc(V1, Number.NaN)],
    ['a square of an endless size', epc(V1, Number.POSITIVE_INFINITY)],
    ['a caption it does not know', { ...epc(V1, 85.04), caption: 'girocode' as 'zahlenMitCode' }],
    ['a payload that is not a string', { ...epc(V1, 85.04), payload: [V1] as unknown as string }],
    ['a lone half of a surrogate pair', epc(`${V1}\n\uD83E`, 85.04)],
  ])('refuses %s', async (_, code) => {
    await refused(code, 'unsupported')
  })

  // pdfmake's SVG converter, when it cannot open a face, warns and draws
  // the text in whatever face it drew in last, and the render succeeds: a
  // caption in Roboto, or in nothing a reader finds. The renderer has it
  // fail the render instead, an engine's failure and not a refusal of the
  // report. Here the font table names a Liberation Sans that is not there.
  test('fails the render, rather than drawing the caption in another face, when the converter cannot open Liberation Sans', async () => {
    const setFonts = pdfmake.setFonts.bind(pdfmake)
    const spy = vi.spyOn(pdfmake, 'setFonts').mockImplementation((fonts) => setFonts({ ...fonts, LiberationSans: { normal: 'missing/LiberationSans-Regular.ttf', bold: 'missing/LiberationSans-Bold.ttf' } }))
    try {
      const error = await refusal(bareDocument('No face', [epc(V1, 85.04, 'zahlenMitCode')]))
      expect(error).toBeInstanceOf(Error)
      expect(error).not.toHaveProperty('code')
      expect((error as Error).message).toMatch(/^pdfmake's SVG converter could not draw an EPC QR code's caption as written: SVGElemText: failed to open font/)
    } finally {
      spy.mockRestore()
    }
  })

  // The encoder failing for any other reason than a payload too long is
  // the engine failing, and said so, never a report refused for its length.
  test('passes on an encoder error that is not about the payload’s length', async () => {
    vi.mocked(encode).mockImplementationOnce(() => {
      throw new RangeError('Invalid value')
    })
    const error = await refusal(bareDocument('Encoder fails', [epc(V1, 85.04)]))
    expect(error).toBeInstanceOf(RangeError)
    expect(error).toMatchObject({ message: 'Invalid value' })
  })
})
