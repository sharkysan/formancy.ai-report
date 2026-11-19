import { epcSymbol, qrSymbol, type QrSymbol } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { verifyDocx } from './check-docx.js'
import type { Block } from './document.js'
import { readDocx } from './docx/read.js'
import { codePng, HAND_CODES, HAND_CODES_DOCUMENT, HAND_EPC, HAND_QR, handCodeParts } from './docx/testing/hand-codes.js'
import { handDocx, rewritten } from './docx/testing/hand.js'
import { expectation, type Fixture } from './fixture.js'
import { encodePng } from './fixtures/png.js'

/**
 * What `verifyDocx` holds a code to (0074), proved on the file written by
 * hand (`docx/testing/hand-codes.ts`), never on one the writer wrote: the
 * file passes as it stands, and with one thing of a code taken out of it
 * or written otherwise the check says so. A check that never failed on a
 * defect has not been shown to see it.
 */

type Parts = Map<string, string | Uint8Array>
const DOCUMENT = 'word/document.xml'
const [QR_PNG, EPC_PNG] = ['word/media/image1.png', 'word/media/image2.png']

const problems = async (parts: ReadonlyMap<string, string | Uint8Array>, fixture: Fixture = HAND_CODES): Promise<string> =>
  (await verifyDocx(fixture, readDocx(handDocx(parts)))).join('\n')

/** The hand-written file with `from` in its document written as `to`. */
const written = (from: string, to: string): Parts => rewritten(DOCUMENT, from, to, handCodeParts())

/** The fixture with its body's blocks changed by `change`. */
const changed = (change: (block: Block) => Block): Fixture => {
  const document = { ...HAND_CODES_DOCUMENT, body: HAND_CODES_DOCUMENT.body.map(change) }
  return { ...HAND_CODES, document, expect: expectation(document, { maxPagesExpected: 1 }) }
}

const QR_SYMBOL = qrSymbol(HAND_QR, 1000)

/** The QR code's symbol at the top left of a square of `side` modules, with a dark module at each of `strays`, by row and column. */
const inSquare = (side: number, strays: readonly (readonly [number, number])[] = []): QrSymbol => ({
  modules: Array.from({ length: side }, (_, row) =>
    Array.from({ length: side }, (_, column) => QR_SYMBOL.modules[row]?.[column] === true || strays.some(([r, c]) => r === row && c === column)),
  ),
})

// The file as it was typed is its document, whole: without this, every case below could fail for a reason of its own.
test('the hand-written file of codes is its document, with nothing to say against it', async () => {
  expect(await problems(handCodeParts())).toBe('')
})

describe('verifyDocx fails on a code whose picture', () => {
  // Each a way a writer draws a code that Word then prints as a code no phone reads, or another code than the report's.
  test.each<[string, () => Parts, RegExp, Fixture?]>([
    [
      'is another size than the code',
      () => {
        const parts = handCodeParts()
        return parts.set(DOCUMENT, (parts.get(DOCUMENT) as string).replaceAll('914400', '900000'))
      },
      /the QR code code is a picture of 70\.86\d+ × 70\.86\d+ pt where its symbol and quiet zone are 72 pt a side/,
    ],
    [
      'has a pixel that is not its module’s colour',
      () =>
        handCodeParts().set(
          QR_PNG,
          codePng(QR_SYMBOL, 19, 4, (x, y, dark) => (x === 80 && y === 80 ? !dark : dark)),
        ),
      /the pixel 80, 80 is not the colour of the module it stands in/,
    ],
    [
      'is dark inside its quiet zone',
      () =>
        handCodeParts().set(
          QR_PNG,
          codePng(QR_SYMBOL, 19, 4, (x, y, dark) => dark || (x < 19 && y >= 19 * 10 && y < 19 * 11)),
        ),
      /is dark inside the quiet zone of four modules/,
    ],
    ['has three modules of quiet zone', () => handCodeParts().set(QR_PNG, codePng(QR_SYMBOL, 19, 3)), /the picture's symbol starts 57 pixels in/],
    ['is all white', () => handCodeParts().set(QR_PNG, codePng({ modules: [] }, 19, 16)), /the picture is all white/],
    [
      'is too coarse for its size',
      () => handCodeParts().set(QR_PNG, codePng(QR_SYMBOL, 5)),
      /a picture of 165 pixels across 72 pt, fewer than 600 to the inch/,
    ],
    [
      'is of more pixels than a code’s is at the most',
      () => handCodeParts().set(QR_PNG, codePng(QR_SYMBOL, 73)),
      /a picture of 2409 pixels a side, more than the 2400 a code's is at the most/,
    ],
    [
      // The picture a writer draws that takes a symbol's rows for its columns: every module uniform, the quiet zone white, the text, the
      // level and the version the document's. ZXing reads it, mirrored, and many a banking app does not.
      'shows its symbol with its rows as its columns',
      () => handCodeParts().set(QR_PNG, codePng({ modules: QR_SYMBOL.modules.map((row, r) => row.map((_, c) => QR_SYMBOL.modules[c]![r]!)) }, 19)),
      /body\[1\]: the QR code code: ZXing reads the code only mirrored: /,
    ],
    [
      'shows its symbol mirrored, left to right',
      () => handCodeParts().set(QR_PNG, codePng({ modules: QR_SYMBOL.modules.map((row) => [...row].reverse()) }, 19)),
      /the QR code code: ZXing reads the code only mirrored: /,
    ],
    [
      // Four modules of white above the symbol and to its left, eight to its right and under it: 37 modules across at 17 pixels, fine
      // enough for its inch. Taken for a version 3 picture, its modules would be held to a ninth finer than they print.
      'shows its symbol in the corner of a larger square',
      () => handCodeParts().set(QR_PNG, codePng(inSquare(29), 17)),
      /the QR code code: the picture's symbol ends 136 pixels from the right and 136 from the bottom, where four modules of 17 pixels are 68/,
    ],
    [
      // The same, with a speck at each far corner of the square, so that the drawing reaches four modules from every side: what the
      // pixels are a picture of and what a scanner reads in them are then two versions, and the scanner's is the symbol's.
      'is one version’s square around another version’s symbol',
      () =>
        handCodeParts().set(
          QR_PNG,
          codePng(
            inSquare(29, [
              [0, 28],
              [28, 0],
            ]),
            17,
          ),
        ),
      /the QR code code is a picture of a version 3 symbol in which a scanner reads one of version 2/,
    ],
    [
      'says another text',
      () => handCodeParts().set(QR_PNG, codePng(qrSymbol({ ...HAND_QR, text: 'Grüezi 🧾 12.50 $$$' }, 1000), 19)),
      /the QR code code scans to other text, or other bytes, than its own/,
    ],
    [
      'is at another level',
      () => handCodeParts().set(QR_PNG, codePng(qrSymbol({ ...HAND_QR, errorCorrection: 'L' }, 1000), 19)),
      /the QR code code is at level L where it asks for M/,
    ],
    [
      'is no picture of one bit of grey',
      () =>
        handCodeParts().set(
          QR_PNG,
          encodePng(4, 4, () => [0, 0, 0]),
        ),
      /the PNG is not one bit of grey a pixel/,
    ],
    [
      'is cropped',
      () => written('<a:blip r:embed="rId6"/><a:stretch>', '<a:blip r:embed="rId6"/><a:srcRect l="1000" t="0" r="1000" b="0"/><a:stretch>'),
      /the QR code code is a picture cropped/,
    ],
    [
      'stands beside a drawing a reader shows in its place',
      () => {
        const blip =
          '<a:blip r:embed="rId6"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId8"/></a:ext></a:extLst></a:blip>'
        const parts = written('<a:blip r:embed="rId6"/>', blip)
        const added = (name: string, from: string, to: string): void => void parts.set(name, (parts.get(name) as string).replace(from, to))
        added('[Content_Types].xml', '<Default Extension="png"', '<Default Extension="svg" ContentType="image/svg+xml"/><Default Extension="png"')
        added(
          'word/_rels/document.xml.rels',
          '</Relationships>',
          '<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image3.svg"/></Relationships>',
        )
        return parts.set('word/media/image3.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>')
      },
      /the QR code code is embedded as something other than a PNG/,
    ],
    [
      'stands with room around it',
      () =>
        written(
          `<w:p><w:pPr><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr><w:r>`,
          `<w:p><w:pPr><w:ind w:left="40"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr><w:r>`,
        ),
      /the QR code code stands with room around it/,
    ],
    [
      'stands beside a word in its paragraph',
      () =>
        written(
          '</w:drawing></w:r></w:p><w:p><w:pPr><w:keepNext/><w:spacing w:line="63"',
          '</w:drawing></w:r><w:r><w:t xml:space="preserve">x</w:t></w:r></w:p><w:p><w:pPr><w:keepNext/><w:spacing w:line="63"',
        ),
      /the QR code code is not a paragraph of one picture/,
    ],
  ])('%s', async (_name, parts, problem) => {
    expect(await problems(parts())).toMatch(problem)
  })

  // A symbol of no data is what a preview's empty code is drawn as, and ZXing reads no code in it: for any other text, a picture nothing reads is the code lost.
  test('scans to nothing, unless its text is nothing', async () => {
    const empty = handCodeParts().set(QR_PNG, codePng(qrSymbol({ ...HAND_QR, text: '' }, 1000), 22))
    expect(await problems(empty)).toMatch(/the QR code code is a picture no scanner reads a code in/)
    expect(
      await problems(
        empty,
        changed((block) => (block === HAND_QR ? { ...HAND_QR, text: '' } : block)),
      ),
    ).toBe('')
  })

  // An EPC QR code without Austria's caption is drawn as a QR code is, and is one at level M whatever it would be asked: held by the same picture.
  test('is an EPC QR code’s at another level than M', async () => {
    const plain = (payload: string): Fixture => changed((block) => (block === HAND_QR ? { kind: 'epcQrCode', id: 'code', payload, size: 72 } : block))
    expect(await problems(handCodeParts(), plain(HAND_QR.text))).toBe('')
    const low = handCodeParts().set(QR_PNG, codePng(qrSymbol({ ...HAND_QR, errorCorrection: 'L' }, 1000), 19))
    expect(await problems(low, plain(HAND_QR.text))).toMatch(/the EPC QR code code is at level L where it asks for M/)
  })

  // A wide code would be more than 2,400 pixels a side at 600 to the inch: its picture is as many whole pixels a module as 2,400 hold,
  // and fine enough at that. At a pixel a module fewer it is too coarse, as any picture under 600 to the inch is.
  test('is a large code’s, fine enough at as many pixels a module as the most hold', async () => {
    const large = (pixels: number): Promise<string> => {
      const parts = handCodeParts().set(QR_PNG, codePng(QR_SYMBOL, pixels))
      // Five inches a side, 4,572,000 English Metric Units: 600 to the inch would be 3,000 pixels, 91 a module.
      parts.set(DOCUMENT, (parts.get(DOCUMENT) as string).replaceAll('914400', '4572000'))
      return problems(
        parts,
        changed((block) => (block === HAND_QR ? { ...HAND_QR, size: 360 } : block)),
      )
    }
    expect(await large(72)).toBe('')
    expect(await large(71)).toMatch(/a picture of 2343 pixels across 360 pt, fewer than 600 to the inch/)
  })

  // The EPC allows a symbol up to version 13, which is what a bank's app must read: 340 bytes at level M are version 14, and no EPC QR code.
  test('is an EPC QR code’s in a larger version than the EPC allows', async () => {
    const payload = 'x'.repeat(340)
    const large = handCodeParts().set(QR_PNG, codePng(qrSymbol({ ...HAND_QR, text: payload, size: 1000 }, 1000), 8))
    const fixture = changed((block) => (block === HAND_QR ? { kind: 'epcQrCode', id: 'code', payload, size: 100 } : block))
    // A hundred points a side, 1,270,000 English Metric Units, so that its 81 modules are no finer than they may be.
    large.set(DOCUMENT, (large.get(DOCUMENT) as string).replaceAll('914400', '1270000'))
    expect(await problems(large, fixture)).toMatch(/the EPC QR code code is a version 14 symbol, larger than the EPC allows/)
  })

  // The floor is the module's size on paper, which the file states by the picture's extent: a symbol of more modules in the same square has finer ones.
  test('has modules finer than 0.4 mm at the size the file states', async () => {
    const text = 'x'.repeat(200)
    const fine = handCodeParts().set(QR_PNG, codePng(qrSymbol({ ...HAND_QR, text, size: 1000 }, 1000), 10))
    expect(
      await problems(
        fine,
        changed((block) => (block === HAND_QR ? { ...HAND_QR, text } : block)),
      ),
    ).toMatch(/the QR code code has modules of 0\.3\d\d mm at its size, finer than the 0\.4 mm a code prints at/)
  })
})

describe('verifyDocx fails on a captioned EPC QR code whose', () => {
  const FRAME_ROW = '<w:trHeight w:val="1574" w:hRule="exact"/>'
  // Each a rule of the PSA's frame and caption (0025) as record 0074 writes them in a Word file, taken out or written otherwise.
  test.each<[string, () => Parts, RegExp]>([
    [
      'caption says something else',
      () => written('>Zahlen mit Code<', '>Zahlen mit Karte<'),
      /the EPC QR code pay's caption is not one paragraph of 'Zahlen mit Code'/,
    ],
    ['caption reads across', () => written('<w:textDirection w:val="btLr"/>', ''), /the EPC QR code pay's caption does not read from bottom to top/],
    [
      'caption is another size',
      () => written('<w:color w:val="000000"/><w:sz w:val="14"/><w:szCs w:val="14"/>', '<w:color w:val="000000"/><w:sz w:val="12"/><w:szCs w:val="12"/>'),
      /the EPC QR code pay's caption is not 7 pt, black and upright on its line/,
    ],
    [
      'caption is bold',
      () => written('<w:color w:val="000000"/><w:sz w:val="14"/>', '<w:b/><w:color w:val="000000"/><w:sz w:val="14"/>'),
      /the EPC QR code pay's caption is not 7 pt, black and upright on its line/,
    ],
    [
      'caption is named in a face with serifs',
      () => {
        const serif = '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/><w:color'
        const parts = written('<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:color', serif)
        return rewritten('word/fontTable.xml', 'w:name="Arial"', 'w:name="Georgia"', parts)
      },
      /the EPC QR code pay's caption names the family Georgia where the PSA names Arial/,
    ],
    [
      'caption stands at the foot of its band',
      () => written('<w:spacing w:line="140" w:lineRule="exact"/><w:jc w:val="center"/>', '<w:spacing w:line="140" w:lineRule="exact"/>'),
      /the EPC QR code pay's caption is not centred beside its symbol/,
    ],
    [
      'caption stands on a line of another height than its band',
      () => written('<w:spacing w:line="140" w:lineRule="exact"/><w:jc', '<w:spacing w:line="180" w:lineRule="exact"/><w:jc'),
      /the EPC QR code pay's caption is not centred beside its symbol on a line of exactly its band, 7 pt/,
    ],
    [
      'frame is a heavier line',
      () => {
        const parts = handCodeParts()
        return parts.set(
          DOCUMENT,
          (parts.get(DOCUMENT) as string).replaceAll('w:sz="5" w:space="0" w:color="000000"', 'w:sz="16" w:space="0" w:color="000000"'),
        )
      },
      /the EPC QR code pay's frame is not a line of 0\.67\d+ pt, half a module, around its symbol and its caption/,
    ],
    [
      'frame is open on the right',
      () =>
        written(
          '<w:bottom w:val="single" w:sz="5" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="5" w:space="0" w:color="000000"/>',
          '<w:bottom w:val="single" w:sz="5" w:space="0" w:color="000000"/>',
        ),
      /the EPC QR code pay's frame is not a line of/,
    ],
    [
      'frame runs between its symbol and its caption',
      () =>
        written(
          '<w:bottom w:val="single" w:sz="5" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:spacing w:before="14"/>',
          '<w:bottom w:val="single" w:sz="5" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="5" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:spacing w:before="14"/>',
        ),
      /the EPC QR code pay's frame is not a line of/,
    ],
    [
      'frame is another height',
      () => written(FRAME_ROW, '<w:trHeight w:val="1701" w:hRule="exact"/>'),
      /the EPC QR code pay's frame is not exactly 78\.7\d+ pt tall/,
    ],
    ['frame may grow', () => written(FRAME_ROW, '<w:trHeight w:val="1574" w:hRule="atLeast"/>'), /the EPC QR code pay's frame is not exactly/],
    [
      'frame gives its caption another band',
      () => written('<w:gridCol w:w="1561"/><w:gridCol w:w="140"/>', '<w:gridCol w:w="1501"/><w:gridCol w:w="200"/>'),
      /the EPC QR code pay's frame is 75\.05 and 10 pt across where its symbol's room is 78\.04\d* and its caption's band 7/,
    ],
    [
      'frame pads its cells',
      () => {
        const parts = handCodeParts()
        const document = parts.get(DOCUMENT) as string
        const padded = document.replace(
          '<w:tblW w:w="1701" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0"',
          '<w:tblW w:w="1701" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40"',
        )
        if (padded === document) throw new Error("the frame's cell margins are not found")
        return parts.set(DOCUMENT, padded)
      },
      /the EPC QR code pay's frame is a table with rules of its own, or one that pads its cells/,
    ],
    [
      'frame is filled',
      () =>
        written(
          '</w:tcBorders><w:textDirection w:val="btLr"/>',
          '</w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="EEEEEE"/><w:textDirection w:val="btLr"/>',
        ),
      /the EPC QR code pay's frame is filled, or turns its symbol's cell/,
    ],
    [
      'symbol stands in a cell that is turned',
      () =>
        written(
          '</w:tcBorders></w:tcPr><w:p><w:pPr><w:spacing w:before="14"/>',
          '</w:tcBorders><w:textDirection w:val="btLr"/></w:tcPr><w:p><w:pPr><w:spacing w:before="14"/>',
        ),
      /the EPC QR code pay's frame is filled, or turns its symbol's cell/,
    ],
    [
      'picture stands at its frame’s corner',
      () => written('<w:spacing w:before="14"/><w:ind w:left="13"/>', ''),
      /the EPC QR code pay's picture does not stand half a module, 0\.67\d+ pt, down from its frame's top and 0\.65 pt in from its left/,
    ],
    [
      // Half a module is 0.6786 pt, fourteen twentieths to the nearest; the picture, 77.3614 pt, would then end 78.0614 pt into a cell
      // of 78.05, and a picture wider than its cell is one Word may fit to it, resampling a code. It stands thirteen in.
      'picture and its distance from the left are a hair wider than its cell',
      () => written('<w:spacing w:before="14"/><w:ind w:left="13"/>', '<w:spacing w:before="14"/><w:ind w:left="14"/>'),
      /the EPC QR code pay's picture, 77\.36\d+ pt wide and 0\.7 pt in from the left, is wider than its cell of 78\.05 pt/,
    ],
    [
      'picture stands two twentieths of a point short of half a module in',
      () => written('<w:spacing w:before="14"/><w:ind w:left="13"/>', '<w:spacing w:before="14"/><w:ind w:left="12"/>'),
      /the EPC QR code pay's picture does not stand half a module, 0\.67\d+ pt, down from its frame's top and 0\.65 pt in from its left/,
    ],
    [
      'picture stands a twentieth of a point short of half a module down',
      () => written('<w:spacing w:before="14"/><w:ind w:left="13"/>', '<w:spacing w:before="13"/><w:ind w:left="13"/>'),
      /the EPC QR code pay's picture does not stand half a module, 0\.67\d+ pt, down from its frame's top and 0\.65 pt in from its left/,
    ],
    [
      'picture is another size than its modules',
      () => {
        const parts = handCodeParts()
        return parts.set(DOCUMENT, (parts.get(DOCUMENT) as string).replaceAll('982490', '900000'))
      },
      /the EPC QR code pay is a picture 70\.8\d+ pt a side where its 57 modules of 1\.357\d+ pt are 77\.36\d+/,
    ],
    [
      'white above the frame is another height',
      () => written('<w:keepNext/><w:spacing w:line="63" w:lineRule="exact"/>', '<w:keepNext/><w:spacing w:line="20" w:lineRule="exact"/>'),
      /the EPC QR code pay does not stand between two empty lines of 3\.16\d+ pt/,
    ],
    [
      'white above the frame may be left at the foot of a page',
      () => written('<w:keepNext/><w:spacing w:line="63" w:lineRule="exact"/>', '<w:spacing w:line="63" w:lineRule="exact"/>'),
      /body: 'an empty paragraph' is not kept with what follows it/,
    ],
    [
      'symbol is drawn at the version its payload needs, with modules over the PSA’s 20 mil',
      () => handCodeParts().set(EPC_PNG, codePng(epcSymbol({ ...HAND_EPC, caption: undefined as never }, 1000), 14)),
      /the EPC QR code pay is not printed as the PSA prints one: with the caption, this version 6 code has modules of 0\.55\d mm/,
    ],
  ])('%s', async (_name, parts, problem) => {
    expect(await problems(parts())).toMatch(problem)
  })

  // The frame is the symbol's: one that holds a word where the picture stood, or one cell of two, is a frame around no code.
  test('frame holds no picture, or is no table of two cells', async () => {
    const parts = handCodeParts()
    const document = parts.get(DOCUMENT) as string
    const drawn = /<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="982490".*?<\/w:drawing>/
    if (!drawn.test(document)) throw new Error("the frame's picture is not found")
    const worded = new Map(parts).set(DOCUMENT, document.replace(drawn, '<w:t xml:space="preserve">x</w:t>'))
    worded.set('word/_rels/document.xml.rels', (parts.get('word/_rels/document.xml.rels') as string).replace(/<Relationship Id="rId7"[^>]*\/>/, ''))
    worded.delete(EPC_PNG)
    expect(await problems(worded)).toMatch(/the EPC QR code pay is not a paragraph of one picture/)
    const cell = /<w:tc><w:tcPr><w:tcW w:w="140".*?<\/w:tc>/
    if (!cell.test(document)) throw new Error("the caption's cell is not found")
    const one = document.replace(cell, '').replace('<w:gridCol w:w="1561"/><w:gridCol w:w="140"/>', '<w:gridCol w:w="1561"/>')
    expect(await problems(new Map(parts).set(DOCUMENT, one))).toMatch(/the EPC QR code pay, captioned, is not a table of one row of two cells/)
    // A line under the picture in its cell makes the row taller than the frame, or cuts the line off where the row's height is exact.
    const band = '</w:tc><w:tc><w:tcPr><w:tcW w:w="140"'
    if (!document.includes(band)) throw new Error("the end of the symbol's cell is not found")
    const two = document.replace(band, `<w:p/>${band}`)
    expect(await problems(new Map(parts).set(DOCUMENT, two))).toMatch(/the EPC QR code pay, captioned, has no paragraph of its picture alone in its first cell/)
  })
})

// A code's picture is no image of the document's: counted as one, a report with a code and no image would be said to hold a picture too many.
test('a code’s picture is not counted among the document’s images', async () => {
  const images = (await verifyDocx(HAND_CODES, readDocx(handDocx(handCodeParts())))).filter((problem) => problem.includes('pictures where the document has'))
  expect(images).toEqual([])
  expect(HAND_CODES.expect.images).toEqual([])
})
