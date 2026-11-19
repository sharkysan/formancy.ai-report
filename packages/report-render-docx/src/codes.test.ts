import { readDocx, readDocxCodes, readPackage, verifyDocx, type DocxCode, type DocxParagraph, type DocxTable } from '@formancy/report-corpus'
import {
  EPC_CAPTION,
  epcCaptionBreak,
  epcModule,
  QR_MIN_MODULE,
  qrSymbol,
  type Block,
  type EpcQrCode,
  type QrCode,
  type ResolvedDocument,
} from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { checkDocument } from './check.js'
import { CODE_RESOLUTION, codePng, MAX_CODE_SIDE, modulePixels } from './code-png.js'
import { codeNodes } from './codes.js'
import { planFonts } from './fonts.js'
import { MAX_DOCX_CODE_MODULES, MAX_DOCX_CODES } from './limits.js'
import { renderDocx } from './render.js'
import { documentOf, fixtureOf, paragraph, refusalOf, written } from './testing/support.js'
import { emu, twips } from './units.js'

/**
 * QR codes and EPC QR codes in a Word file (0074), proved on the file the
 * writer produced (0003, as 0068 extends it): each code's picture read
 * back from the file by the corpus's reader, its bytes decoded to pixels
 * by the corpus's own PNG reader, and those decoded by ZXing, as a scanner
 * would (`readDocxCodes`) -- for what the code says, at which level and
 * version, how fine it is drawn and where its symbol stands. None asks the
 * writer, or the encoder, what it meant to draw.
 *
 * What refuses a code is the runtime's, which both engines ask (0074):
 * its tests hold each refusal, the corpus's `MALFORMED` list holds both
 * engines to each (`against-pdf.test.ts`), and here are the writer's own.
 */

const TIMEOUT = 60_000

/** Umlauts, the euro sign, and an emoji outside the Basic Multilingual Plane, which UTF-8 writes in four bytes and JavaScript in two code units. */
const SWISS = 'Grüezi Zürich: CHF 12.50 oder 9,99 € 🧾'

/** EPC 2.3's first example, byte for byte: 96 bytes of UTF-8, "Resulting QR code version 6". */
const V1 = ['BCD', '001', '1', 'SCT', 'BHBLDEHHXXX', 'Franz Mustermänn', 'DE71110220330123456789', 'EUR12.3', 'GDDS', 'RF18539007547034'].join('\n')

/** A payload of the EPC's shape and exactly 331 bytes, the most the EPC allows. */
const MOST = ((): string => {
  const head = ['BCD', '001', '1', 'SCT', 'BHBLDEHHXXX', 'N'.repeat(70), 'DE89370400440532013000', 'EUR999999999.99', 'GDDS', '', 'T'.repeat(140)].join('\n')
  return `${head}\n${'I'.repeat(331 - head.length - 1)}`
})()

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

function qr(text: string, size: number, errorCorrection: QrCode['errorCorrection'] = 'M', id = 'payment-code'): QrCode {
  return { kind: 'qrCode', id, text, size, errorCorrection }
}

function epc(payload: string, size: number, caption?: 'zahlenMitCode', id = 'pay-code'): EpcQrCode {
  return { kind: 'epcQrCode', id, payload, size, ...(caption === undefined ? {} : { caption }) }
}

/** The one code of `document`'s file; a file with none, or more, fails here. */
async function onlyCode(document: ResolvedDocument): Promise<DocxCode> {
  const codes = await readDocxCodes(written(document))
  expect(codes).toHaveLength(1)
  return codes[0]!
}

/** The file's problems against its document, as the corpus's check derives them. */
const problems = (document: ResolvedDocument): Promise<string[]> => verifyDocx(fixtureOf('codes', document), written(document))

describe('what a QR code in a Word file says', () => {
  // A code that scans to other bytes than its text's UTF-8 -- an umlaut as
  // Latin-1, an emoji as two broken halves -- sends a payment or a lookup
  // somewhere else; at another level than the one asked for, it is less
  // robust than the report says, or larger.
  test.each(['L', 'M', 'Q', 'H'] as const)('encodes its text as UTF-8 at level %s, and a scanner reads back the very bytes', async (level) => {
    const code = await onlyCode(documentOf([qr(SWISS, 120, level)]))
    expect(code.read).toMatchObject({ text: SWISS, bytes: utf8(SWISS), ecLevel: level })
  })

  // A preview hands on a code whose content resolved to nothing: its
  // square and a version 1 symbol are written, as the PDF draws them, and
  // ZXing reads no code in them.
  test('writes empty text as a symbol of no data, which ZXing reads as no code', async () => {
    const code = await onlyCode(documentOf([qr('', 60)]))
    expect(code).toMatchObject({ version: 1, modules: 21, read: undefined })
    expect(code.picture.width).toBeCloseTo(60, 3)
  })

  // The level is never raised to fill a version: each text is sized to be
  // raised one level by an encoder that did, and is version 1 at its own.
  test.each([
    ['L', 'twelve bytes'],
    ['M', 'nine char'],
    ['Q', 'five!'],
  ] as const)('keeps level %s where an encoder would raise it', async (level, text) => {
    const code = await onlyCode(documentOf([qr(text, 60, level)]))
    expect(code.read).toMatchObject({ text, ecLevel: level, version: 1 })
    expect(code.version).toBe(1)
  })

  // A picture that broke on the largest symbol -- 177 modules a side, the
  // most pixels to write -- would be a code no scanner reads: every byte of
  // version 40 at H is read back, and every digit of version 40 at L.
  test.each([
    ['1273 bytes at level H', 'x'.repeat(1273), 'H'],
    ['7089 digits at level L', '1'.repeat(7089), 'L'],
  ] as const)(
    'writes the largest symbol whole, %s, and a scanner reads all of it',
    async (_name, text, level) => {
      const code = await onlyCode(documentOf([qr(text, 300, level)]))
      expect(code.read).toMatchObject({ text, ecLevel: level, version: 40 })
      expect(code.modules).toBe(177)
    },
    TIMEOUT,
  )
})

describe('how a QR code is drawn in a Word file', () => {
  // A picture of another size than the report's code prints a code larger
  // or smaller than its PDF's, with modules of another size than the rule
  // held it to; beside another run, or with room around it, it stands
  // elsewhere than the report put it.
  test('is a picture exactly its size, alone in a paragraph of its own between what stands above and under it', async () => {
    const size = 100
    const document = documentOf([paragraph('Above'), qr(SWISS, size), paragraph('Below')])
    const docx = written(document)
    const [above, code, below] = docx.body as readonly DocxParagraph[]
    expect([above!.runs[0], below!.runs[0]]).toMatchObject([{ text: 'Above' }, { text: 'Below' }])
    expect(code!.runs).toHaveLength(1)
    expect(code).toMatchObject({ indent: 0, before: 0, after: 0 })
    const [run] = code!.runs
    if (run?.kind !== 'picture') throw new Error('the code is no picture')
    // An English Metric Unit is a 12,700th of a point.
    expect(run.picture.width).toBeCloseTo(size, 4)
    expect(run.picture.height).toBeCloseTo(size, 4)
    expect(run.picture.part).toMatchObject({ name: 'word/media/image1.png', contentType: 'image/png' })
    expect(await problems(document)).toEqual([])
  })

  // Word scales a picture to the paper, and a reader that scales a small
  // one up smooths it: at a pixel a module a module's edge would be a ramp
  // a module wide. Whole pixels a module, so that no edge stands inside a
  // pixel, and the least of them that make 600 to the inch at the code's
  // size; and its symbol four modules in, where a scanner finds it.
  test('is whole pixels a module, the least that are 600 to the inch at its size, its symbol four modules in', async () => {
    const size = 100
    const code = await onlyCode(documentOf([qr(SWISS, size)]))
    const across = code.modules + 8
    const module = size / across
    expect(CODE_RESOLUTION).toBe(600)
    expect(code.pixels).toBe(Math.ceil((module * 600) / 72))
    expect(code.side).toBe(across * code.pixels)
    expect(code.resolution).toBeGreaterThanOrEqual(600)
    // One pixel a module fewer would be under it.
    expect((across * (code.pixels - 1) * 72) / size).toBeLessThan(600)
    expect(code.module).toBeCloseTo(module, 4)
    // Where ZXing finds the symbol in the picture: within half a module of four modules in from every side.
    const half = code.pixels / 2
    expect(Math.abs(code.read!.x - 4 * code.pixels)).toBeLessThan(half)
    expect(Math.abs(code.read!.top - 4 * code.pixels)).toBeLessThan(half)
    expect(Math.abs(code.read!.width - code.modules * code.pixels)).toBeLessThan(2 * half)
  })

  // The PSA's 15 mil, 1.08 points, are nine pixels at 600 to the inch,
  // exactly, and a module a hair over is ten. Computed in binary, a
  // module of exactly so many pixels may be a last place over them: 3.24
  // points are 27.000000000000004, and a code of 47.52 points over 33
  // modules a module of 12.000000000000002. A rounding up that took that
  // for a pixel more would draw such a code a pixel a module larger than
  // it need be, and another machine's arithmetic another picture.
  test('gives a module of exactly so many pixels that many, and one a hair larger one more', () => {
    // 29 modules across: a version 1 symbol and its quiet zone.
    expect(modulePixels(1.08, 29)).toBe(9)
    expect(modulePixels(1.081, 29)).toBe(10)
    expect(modulePixels(3.24, 29)).toBe(27)
    expect(modulePixels(47.52 / 33, 33)).toBe(12)
    expect(modulePixels(0.12, 29)).toBe(1)
    expect(modulePixels(0.01, 29)).toBe(1)
    expect(modulePixels(QR_MIN_MODULE, 29)).toBe(10)
  })

  // At 600 to the inch a picture grows with the square of its code's side, and what deflating it costs the thread with it: the largest
  // symbol at the largest size a page holds was 4,995 pixels a side. So a module is drawn in no more whole pixels than 2,400 a side
  // hold of its symbol's modules and their quiet zone, and a code is 600 to the inch only up to the width at which that many are: by
  // its version, since the pixels are whole. These are the figures the record, the README and the comments give of it, measured here,
  // so that a change to the rule fails where the prose would only go stale.
  test(
    'draws a module in no more whole pixels than 2,400 a side hold of its symbol, and so a wide code under 600 to the inch',
    async () => {
      expect([CODE_RESOLUTION, MAX_CODE_SIDE]).toEqual([600, 2400])
      /** A symbol of `across` modules with its quiet zone in a square of `size` points: its picture's pixels a side, and to the inch. */
      const drawn = (across: number, size: number): readonly [number, number] => {
        const side = across * modulePixels(size / across, across)
        return [side, Math.round((side * 72) / size)]
      }
      // The largest symbol, version 40, 185 modules across: twelve pixels a module at the most, 2,220 a side, which is 600 to the inch
      // at 266.4 points and coarser from there, whatever the size.
      expect([drawn(185, 266.4), drawn(185, 280), drawn(185, 288), drawn(185, 595)]).toEqual([
        [2220, 600],
        [2220, 571],
        [2220, 555],
        [2220, 269],
      ])
      // The smallest, version 1, 29 across: 82 pixels a module at the most, 2,378 a side, 600 to the inch up to 285.36 points.
      expect([drawn(29, 285.36), drawn(29, 287), drawn(29, 288), drawn(29, 595)]).toEqual([
        [2378, 600],
        [2378, 597],
        [2378, 595],
        [2378, 288],
      ])
      // Every version between them: the most a picture is of pixels a side, and the widest its code is at 600 to the inch, in points.
      const most = Array.from({ length: 40 }, (_, index) => 25 + 4 * (index + 1)).map((across) => Math.floor(MAX_CODE_SIDE / across) * across)
      expect([Math.min(...most), Math.max(...most)]).toEqual([2220, 2398])
      expect([Math.min(...most), Math.max(...most)].map((side) => (side * 72) / CODE_RESOLUTION)).toEqual([266.4, 287.76])
      // Under that width a picture is 600 to the inch or more, and one more pixel a module is never given for a hair.
      expect([modulePixels(280 / 29, 29), modulePixels(300 / 29, 29), modulePixels(17, 29)]).toEqual([81, 82, 82])
      const code = await onlyCode(documentOf([qr('x'.repeat(1273), 400, 'H')]))
      expect(code).toMatchObject({ pixels: 12, side: 185 * 12 })
      expect(code.read).toMatchObject({ ecLevel: 'H', version: 40 })
      expect(await problems(documentOf([qr('x'.repeat(1273), 400, 'H')]))).toEqual([])
    },
    TIMEOUT,
  )

  // The floor is a size the module may be: a code drawn at exactly 0.4 mm a
  // module is written, and read. Fourteen bytes are the most version 1
  // holds at M, so its square is 29 modules of 0.4 mm.
  test('writes a code whose modules are exactly the smallest a code prints at', async () => {
    const code = await onlyCode(documentOf([qr('fourteen bytes', 29 * QR_MIN_MODULE)]))
    expect(code.read).toMatchObject({ text: 'fourteen bytes', version: 1 })
    expect((code.module * 25.4) / 72).toBeCloseTo(0.4, 6)
    expect(code.pixels).toBe(10)
  })

  // Each row of modules is written once and repeated by PNG's own filter:
  // written out scanline by scanline, the largest symbol at this size is
  // 2,220 lines of 279 bytes, 619,380 bytes before it is deflated.
  test(
    'is a picture of some ten kilobytes even for the largest symbol',
    async () => {
      const code = await onlyCode(documentOf([qr('x'.repeat(1273), 300, 'H')]))
      expect(code.side).toBe(185 * 12)
      expect(code.picture.part.bytes.length).toBeLessThan(16_000)
    },
    TIMEOUT,
  )

  // A code drawn a module apart from where the report puts it, in a column
  // or a frame, prints over its neighbour, or apart from what it pays.
  test('stands in its column, and inside the padding of its frame', async () => {
    const document = documentOf([
      {
        kind: 'columns',
        columns: [
          { width: 'fill', blocks: [paragraph('Beside the code')] },
          { width: 80, blocks: [qr('INV-2026-0042', 80, 'Q', 'column-code')] },
        ],
      },
      { kind: 'section', padding: 12, fill: '#eeeeee', blocks: [qr('INV-2026-0043', 60, 'Q', 'framed-code')] },
    ])
    expect(await problems(document)).toEqual([])
    const codes = await readDocxCodes(written(document))
    expect(codes.map((code) => [code.read?.text, Math.round(code.picture.width)])).toEqual([
      ['INV-2026-0042', 80],
      ['INV-2026-0043', 60],
    ])
  })

  // A page region is a part of its own, with relationships of its own: a
  // code written into the body's would be a picture the header cannot
  // show. Each region's code is read from that region's part.
  test("writes a code in the page header, in page 1's own header and in the page footer into that region's part", async () => {
    const document = documentOf([paragraph('Body')], {
      pageHeader: [qr('HEADER', 40, 'Q', 'header-code')],
      firstPageHeader: [qr('FIRST', 40, 'Q', 'first-code')],
      pageFooter: [qr('FOOTER', 40, 'Q', 'footer-code')],
    })
    const docx = written(document)
    expect((await readDocxCodes(docx)).map((code) => [code.region, code.read?.text])).toEqual([
      ['header', 'HEADER'],
      ['firstHeader', 'FIRST'],
      ['footer', 'FOOTER'],
    ])
    for (const part of ['word/header1.xml', 'word/header2.xml', 'word/footer1.xml'])
      expect(docx.relationships(part).filter(({ type }) => type.endsWith('/image'))).toHaveLength(1)
    expect(await problems(document)).toEqual([])
  })

  // "Scan to pay" left at the foot of one page, its code on the next, is a
  // heading over nothing: a heading kept with the next block is kept with a
  // code, as with an image.
  test('keeps a heading with the code after it', async () => {
    const heading: Block = { kind: 'paragraph', runs: [{ text: 'Scan to pay' }], keepWithNext: true }
    const document = documentOf([heading, qr('INV-2026-0042', 100)])
    expect((written(document).body[0] as DocxParagraph).keepNext).toBe(true)
    expect(await problems(document)).toEqual([])
  })

  // Every code is a picture of its own, numbered as it is written with the
  // file's other pictures, and the same symbol at the same size is the same
  // bytes: a file that differed from one write to the next could not be
  // found again by its digest.
  test('writes each code as a part of its own, and the same document as the same bytes', () => {
    const document = documentOf([qr('ONE', 60, 'M', 'one'), qr('TWO', 60, 'M', 'two')])
    const bytes = renderDocx(document)
    expect(bytes).toEqual(renderDocx(document))
    const parts = [...readPackage(bytes).parts.keys()].filter((name) => name.startsWith('word/media/'))
    expect(parts).toEqual(['word/media/image1.png', 'word/media/image2.png'])
    const symbol = qrSymbol(qr('ONE', 60), 60)
    expect(codePng(symbol, 12)).toEqual(codePng(symbol, 12))
  })
})

describe('an EPC QR code in a Word file', () => {
  // Without a caption the EPC gives no size and no frame, and the code is
  // a QR code of its payload at level M: the very picture, byte for byte.
  // The EPC's own example says version 6.
  test('without a caption is the picture a QR code of its payload at level M is', async () => {
    const [plain, same] = [documentOf([epc(V1, 85.04)]), documentOf([qr(V1, 85.04, 'M')])]
    const code = await onlyCode(plain)
    expect(code.read).toMatchObject({ text: V1, bytes: utf8(V1), ecLevel: 'M', version: 6 })
    expect(code.picture.part.bytes).toEqual((await onlyCode(same)).picture.part.bytes)
    expect(await problems(plain)).toEqual([])
  })

  // The PSA's frame (0025), as a Word file states it: the symbol's picture
  // and the caption's band in a table of one row, bordered around the two
  // by a line half a module wide, between the white the frame leaves above
  // and under it in its square. In a 30 mm square the EPC's example is
  // drawn in version 8, the least whose modules are the PSA's, at 1.357
  // points a module.
  test("with Austria's caption is the PSA's frame around its symbol and the words, the code's size together", async () => {
    const size = 85.04
    const document = documentOf([epc(V1, size, 'zahlenMitCode')])
    const docx = written(document)
    const [lead, frame, trail] = docx.body as readonly [DocxParagraph, DocxTable, DocxParagraph]
    const code = (await readDocxCodes(docx))[0]!
    expect(code.read).toMatchObject({ text: V1, bytes: utf8(V1), ecLevel: 'M', version: 8 })
    const module = epcModule(size, 8, 'zahlenMitCode')
    expect(module).toBeCloseTo(78.04 / 57.5, 10)
    // The picture: 49 modules and four of quiet zone a side, at that module.
    expect(code.picture.width).toBeCloseTo(57 * module, 3)
    expect(code.module).toBeCloseTo(module, 4)
    // The frame: 58 modules tall, the square less the caption's band and the band across, a line of half a module, which Word holds in eighths of a point.
    const row = frame.rows[0]!
    expect(row.height).toEqual({ rule: 'exact', value: Math.round(58 * module * 20) / 20 })
    expect(frame.grid).toEqual([Math.round((size - 7) * 20) / 20, 7])
    expect(row.cells[0]!.borders).toEqual({
      top: { weight: 0.625, color: '#000000' },
      left: { weight: 0.625, color: '#000000' },
      bottom: { weight: 0.625, color: '#000000' },
    })
    expect(row.cells[1]!.borders).toEqual({
      top: { weight: 0.625, color: '#000000' },
      bottom: { weight: 0.625, color: '#000000' },
      right: { weight: 0.625, color: '#000000' },
    })
    // The caption: the PSA's words, 7 pt, turned to read from bottom to top beside the symbol.
    expect(row.cells[1]!.direction).toBe('btLr')
    const caption = row.cells[1]!.blocks[0] as DocxParagraph
    expect(caption.runs).toMatchObject([
      { kind: 'text', text: EPC_CAPTION.words, props: { family: 'Arial', size: 7, bold: false, italic: false, color: '#000000' } },
    ])
    expect(caption).toMatchObject({ align: 'center', line: { rule: 'exact', height: 7 } })
    // The white above the frame is kept with it, and the three are the code's square, to Word's twentieth of a point each.
    expect(lead.keepNext).toBe(true)
    expect(trail.keepNext).toBe(false)
    expect(lead.line!.height + row.height!.value + trail.line!.height).toBeCloseTo(size, 0)
    expect(Math.abs(lead.line!.height + row.height!.value + trail.line!.height - size)).toBeLessThan(0.08)
    expect(await problems(document)).toEqual([])
  })

  // Word holds a cell's width and a picture's distance from its left in twentieths of a point, each rounded by itself, and the frame's
  // first cell is the picture and half a module with nothing over. Rounded up together they were a hair wider than the cell -- 78.0614
  // points in one of 78.05, in a 30 mm square -- and a picture wider than its cell is one Word may fit to it, resampling a code. Held
  // at every size a report states, to the hundredth of a point, and at every version the PSA's frame prints in there (report-spec's
  // `epcCaptionBreak`): the frame is laid out from its symbol's side alone, so the symbols here are blank and none is encoded.
  test('never stands a framed code’s picture, with its distance from the left, wider than its cell', () => {
    const [wider, elsewhere]: [string[], string[]] = [[], []]
    const blank = Array.from({ length: 14 }, (_, version) => {
      const side = 17 + 4 * version
      return { modules: Array.from({ length: side }, () => Array.from({ length: side }, () => false)) }
    })
    let frames = 0
    for (let hundredths = 6806; hundredths <= 11860; hundredths++) {
      const code = epc(V1, hundredths / 100, 'zahlenMitCode')
      for (let version = 1; version <= 13; version++) {
        if (epcCaptionBreak(code.size, version) !== undefined) continue
        const [, frame] = codeNodes(code, blank[version]!, { embed: () => 'rId1', next: () => 1 })
        if (frame?.kind !== 'table') throw new Error('a framed code is not written as a table')
        const [picture] = frame.rows[0]!.cells[0]!.content
        const run = picture?.kind === 'paragraph' ? picture.runs[0] : undefined
        if (picture?.kind !== 'paragraph' || run?.kind !== 'picture') throw new Error("the frame's first cell does not hold its picture")
        frames += 1
        // As the file states them: the cell and the distance in twentieths of a point, 635 English Metric Units each, the picture in those.
        const [fromLeft, cell, side] = [twips(picture.indent ?? 0) * 635, frame.grid[0]! * 635, emu(run.picture.width)]
        const where = `${code.size} pt, version ${version}`
        if (fromLeft + side > cell) wider.push(`${where}: ${fromLeft} + ${side} > ${cell}`)
        // And as far in as its cell leaves it, to the twentieth. The cell is rounded half a twentieth either way, and what it leaves is
        // rounded down: so that is half a module, or less by up to a twentieth and a half, and never more by over half a one.
        const line = (epcModule(code.size, version, 'zahlenMitCode') / 2) * 20 * 635
        if (cell - (fromLeft + side) >= 635 || fromLeft - line > 0.51 * 635 || line - fromLeft > 1.51 * 635)
          elsewhere.push(`${where}: ${fromLeft} of ${cell - side}, by a line of ${line}`)
      }
    }
    expect(wider).toEqual([])
    expect(elsewhere).toEqual([])
    // The sizes the frame prints in at some version are some five thousand, and several versions print in most.
    expect(frames).toBeGreaterThan(5000)
  })

  // The caption's family is the one a file names that no report maps: listed where a caption is written, so that a reader without it
  // chooses a sans face in its place, and in no other file, which would name a family nothing in it prints in.
  test('lists the caption’s family in the font table where a caption is written, and nowhere else', () => {
    const families = (document: ResolvedDocument): string[] => written(document).fonts.map((font) => `${font.name} ${font.family} ${font.pitch}`)
    expect(families(documentOf([epc(V1, 85.04, 'zahlenMitCode')]))).toEqual(['Roboto swiss variable', 'Arial swiss variable'])
    expect(families(documentOf([epc(V1, 85.04)]))).toEqual(['Roboto swiss variable'])
    expect(families(documentOf([qr('A', 60)]))).toEqual(['Roboto swiss variable'])
  })

  // Every byte the EPC allows, 331, in the largest symbol it allows,
  // version 13: without the caption, and with it in the largest square the
  // PSA's frame prints in, where the modules are 20 mil, 1.44 points.
  test.each([
    ['without the caption', undefined, 100],
    ['with the caption', 'zahlenMitCode', 118.6],
  ] as const)('reads back the most an EPC QR code holds, 331 bytes in version 13, %s', async (_name, caption, size) => {
    expect(utf8(MOST)).toHaveLength(331)
    const document = documentOf([epc(MOST, size, caption)])
    const code = (await readDocxCodes(written(document)))[0]!
    expect(code.read).toMatchObject({ text: MOST, ecLevel: 'M', version: 13 })
    if (caption !== undefined) expect(code.module).toBeCloseTo(1.44, 3)
    expect(await problems(document)).toEqual([])
  })
})

describe('what the writer refuses of a code', () => {
  const codes = (length: number): QrCode[] => Array.from({ length }, (_, index) => qr(`CODE-${index + 1}`, 40, 'M', `code-${index + 1}`))

  // Each code is encoded and drawn while the file is written, on the thread
  // that calls: as many as the bound are written, each a part of the file,
  // and one more is refused by the code that crossed it, never left out.
  test(
    'writes as many codes as its bound, and refuses one more by the code that crossed it',
    () => {
      expect(MAX_DOCX_CODES).toBe(64)
      const parts = readPackage(renderDocx(documentOf(codes(MAX_DOCX_CODES)))).parts
      expect([...parts.keys()].filter((name) => name.startsWith('word/media/'))).toHaveLength(MAX_DOCX_CODES)
      const refusal = refusalOf(documentOf(codes(MAX_DOCX_CODES + 1)))
      expect(refusal).toMatchObject({ code: 'content-too-large', subject: `code-${MAX_DOCX_CODES + 1}` })
      expect(refusal.message).toMatch(/holds more than 64 QR codes/)
    },
    TIMEOUT,
  )

  // A count bounds the work only where each thing counted costs what the count takes it for, and the largest symbol takes the encoder
  // some sixty times a version 1's: 64 of them held the thread three seconds. So the modules of a file's symbols are bounded too, at what
  // sixteen of the largest hold: sixteen are written, each read back whole, and a seventeenth is refused by the code that crossed.
  test(
    'writes sixteen of the largest symbol, and refuses a seventeenth by the code that crossed it',
    async () => {
      expect(MAX_DOCX_CODE_MODULES).toBe(16 * 177 * 177)
      const largest = (length: number): QrCode[] => Array.from({ length }, (_, index) => qr(`${index + 1}`.padStart(1273, 'x'), 210, 'H', `large-${index + 1}`))
      const written = await readDocxCodes(readDocx(renderDocx(documentOf(largest(16)))))
      expect(written.map((code) => [code.version, code.read?.text.slice(-4)])).toEqual(largest(16).map((code) => [40, code.text.slice(-4)]))
      const refusal = refusalOf(documentOf(largest(17)))
      expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'large-17' })
      expect(refusal.message).toBe(
        "the report's QR codes up to large-17 hold 532593 modules between them; a Word file may hold 501264, as many as sixteen of the largest symbol",
      )
    },
    TIMEOUT,
  )

  // What the two bounds leave together: a symbol of version 17, 85 modules a side, as often as the count allows, and one of version 18 not.
  // Held on the walk that decides it, which encodes every one of the 128 symbols and writes no picture: written whole, as it was at
  // first, the case took 7.0 seconds in CI's job on 19 November 2026, past the five a case has where it states no more, and 4.6 here
  // under coverage beside another build. As it is it took 3.9 here, the same way: the encoder is most of it, and the bounds are held
  // on real symbols, so the timeout is stated, for the runner.
  test(
    'holds as many codes as its count allows of a symbol of version 17, and not of version 18',
    () => {
      // 644 and 718 bytes are what versions 17 and 18 hold at level L in byte mode (ISO/IEC 18004, table 7).
      const sized = (bytes: number): ResolvedDocument =>
        documentOf(Array.from({ length: MAX_DOCX_CODES }, (_, index) => qr(`${index}`.padStart(bytes, 'x'), 120, 'L', `code-${index + 1}`)))
      const fits = sized(644)
      const checked = checkDocument(fits, planFonts(fits.fonts))
      expect([...checked.codes.values()].map((symbol) => symbol.modules.length)).toEqual(Array.from({ length: MAX_DOCX_CODES }, () => 85))
      expect(refusalOf(sized(718))).toMatchObject({ code: 'content-too-large', subject: 'code-64' })
    },
    TIMEOUT,
  )

  // The bound is on the codes a file draws, and a document may hold one block as often as it likes: counted by the blocks that are
  // different objects, one code standing a thousand times was one code, each of them encoded and drawn, and only the modules' bound
  // refused it, at 1,137. As often as it stands is how often it counts.
  test('counts a code as often as it stands, the same block among them', () => {
    const same = qr('INV-1', 40, 'M', 'same')
    const standing = (times: number): ResolvedDocument => documentOf(Array.from({ length: times }, () => same))
    expect(readPackage(renderDocx(standing(MAX_DOCX_CODES))).parts.size).toBeGreaterThan(0)
    const refusal = refusalOf(standing(MAX_DOCX_CODES + 1))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'same' })
    expect(refusal.message).toMatch(/holds more than 64 QR codes/)
  })

  // The bound is the file's, wherever a code stands: one in the page footer and as many as the bound in the body are one too many.
  test('counts the codes of the page regions with the body’s', () => {
    const document = documentOf(codes(MAX_DOCX_CODES), { pageFooter: [qr('FOOTER', 40, 'M', 'footer-code')] })
    expect(refusalOf(document)).toMatchObject({ code: 'content-too-large', subject: `code-${MAX_DOCX_CODES}` })
  })

  // No page of a Word file holds a square taller than the printable area: the PDF refuses it against its body, by the same code and subject.
  test('refuses a code taller than the printable area', () => {
    const landscape = documentOf([qr('A', 500)]).page
    const refusal = refusalOf(documentOf([qr('A', 500)], { page: { ...landscape, orientation: 'landscape' } }))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'payment-code' })
    expect(refusal.message).toMatch(/the QR code payment-code is 500 pt tall; the printable area is 495\.28 pt/)
  })
})
