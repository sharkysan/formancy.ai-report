import { swissSymbol } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { readSlipCode } from './check-docx-slip.js'
import { verifyDocx } from './check-docx.js'
import { readDocx } from './docx/read.js'
import { codePng } from './docx/testing/hand-codes.js'
import { HAND_BILL, HAND_SLIP, HAND_SWISS_PIXELS, HAND_SWISS_SYMBOL, handSlipParts, SLIP_IN, slipLine, slipWhite, swissPng } from './docx/testing/hand-slip.js'
import { HAND, handDocx, handParts, relationships, rewritten, TYPE } from './docx/testing/hand.js'
import { expectation, type Fixture } from './fixture.js'

/**
 * What `verifyDocx` holds a QR-bill's slip to (0075), proved on the file
 * written by hand (`docx/testing/hand-slip.ts`), never on one the writer
 * wrote: the file passes as it stands, and with one thing of the slip
 * taken out of it or written otherwise the check says so. A check that
 * never failed on a defect has not been shown to see it.
 */

type Parts = Map<string, string | Uint8Array>
const DOCUMENT = 'word/document.xml'
const PNG = 'word/media/image1.png'

const problems = async (parts: ReadonlyMap<string, string | Uint8Array>, fixture: Fixture = HAND_SLIP): Promise<string> =>
  (await verifyDocx(fixture, readDocx(handDocx(parts)))).join('\n')

/** The hand-written file with `from` in its document written as `to`. */
const written = (from: string, to: string): Parts => rewritten(DOCUMENT, from, to, handSlipParts())

/** The hand-written file with every `from` of its document written as `to`. */
const everywhere = (from: string, to: string): Parts => {
  const parts = handSlipParts()
  return parts.set(DOCUMENT, (parts.get(DOCUMENT) as string).replaceAll(from, to))
}

const pictured = (png: Uint8Array): Parts => handSlipParts().set(PNG, png)

const SYMBOL = HAND_SWISS_SYMBOL
const TITLE = slipLine('Receipt', 11, true, 246, SLIP_IN)
const SEPARATOR = '<w:p><w:pPr><w:spacing w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>'
const INSTRUCTION = '<w:jc w:val="center"/>'
const SECTION_MARGINS = 'w:top="10680" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0"'

// The file as it was typed is its document, whole: without this, every case below could fail for a reason of its own.
test('the hand-written file of a slip is its document, with nothing to say against it', async () => {
  expect(await problems(handSlipParts())).toBe('')
})

describe('verifyDocx fails on a slip whose page', () => {
  // Each a way a writer lays the page out that Word then prints with the slip elsewhere than at the foot of an A4 page, or under the report's own header.
  test.each<[string, () => Parts, RegExp]>([
    ['starts the slip lower than 192 mm', () => written('w:top="10680"', 'w:top="10700"'), /its top is 545\.25 pt down the page, where SIX puts it 544\.25/],
    [
      'has a margin at its side',
      () => written(SECTION_MARGINS, SECTION_MARGINS.replace('w:right="0"', 'w:right="100"')),
      /has a margin at a side or at its foot/,
    ],
    [
      'has a margin at its foot',
      () => written(SECTION_MARGINS, SECTION_MARGINS.replace('w:bottom="0"', 'w:bottom="100"')),
      /has a margin at a side or at its foot/,
    ],
    [
      'stands its header in from the edge',
      () => written(SECTION_MARGINS, SECTION_MARGINS.replace('w:header="0"', 'w:header="700"')),
      /stands in from the paper's edge/,
    ],
    [
      'is of another paper',
      () => written('<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="10680"', '<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="10680"'),
      /its page is not A4 upright/,
    ],
    [
      'holds something after the slip',
      () =>
        written(
          '</w:tbl><w:p><w:pPr><w:spacing w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p><w:sectPr><w:headerReference w:type="default" r:id="rId6"/>',
          '</w:tbl><w:p><w:pPr><w:spacing w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p><w:p><w:pPr><w:spacing w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p><w:sectPr><w:headerReference w:type="default" r:id="rId6"/>',
        ),
      /is not the instruction to separate, the slip and an empty paragraph a point tall/,
    ],
    ['prints another instruction', () => written('Separate before paying in', 'Cut here'), /its first line is not the bill's instruction to separate/],
    ['sets the instruction to the left', () => written(INSTRUCTION, ''), /its instruction is not 8 pt, regular and centred/],
  ])('%s', async (_name, parts, problem) => {
    expect(await problems(parts())).toMatch(problem)
  })

  // A section that names no header prints the one before it: the report's, of a height nobody measured, above the slip.
  test('names no header of its own, and so prints the report’s', async () => {
    const parts = handSlipParts()
    const document = (parts.get(DOCUMENT) as string)
      .replace(
        '<w:sectPr><w:headerReference w:type="default" r:id="rId6"/><w:footerReference w:type="default" r:id="rId7"/>',
        '<w:sectPr><w:footerReference w:type="default" r:id="rId6"/>',
      )
      .replace('r:embed="rId8"', 'r:embed="rId7"')
    parts.set(DOCUMENT, document)
    parts.set(
      'word/_rels/document.xml.rels',
      relationships(
        [`${TYPE}/styles`, 'styles.xml'],
        [`${TYPE}/settings`, 'settings.xml'],
        [`${TYPE}/fontTable`, 'fontTable.xml'],
        [`${TYPE}/header`, 'header1.xml'],
        [`${TYPE}/footer`, 'footer1.xml'],
        [`${TYPE}/footer`, 'footer2.xml'],
        [`${TYPE}/image`, 'media/image1.png'],
      ),
    )
    parts.delete('word/header3.xml')
    parts.set('[Content_Types].xml', (parts.get('[Content_Types].xml') as string).replace(/<Override PartName="\/word\/header3\.xml"[^>]*\/>/, ''))
    expect(await problems(parts)).toMatch(/its page prints the report's page header, or one that is not empty/)
  })

  // An empty header that held a line would be a header: the one the slip's page names holds nothing.
  test('names a header that holds text', async () => {
    const parts = handSlipParts()
    parts.set('word/header3.xml', parts.get('word/header1.xml') as string)
    expect(await problems(parts)).toMatch(/its page prints the report's page header, or one that is not empty/)
  })
})

describe('verifyDocx fails on a slip that', () => {
  // Each a way a slip is written that Word prints as one a bank's reader, or a payer, takes for another, or cuts a line of.
  test.each<[string, () => Parts, RegExp]>([
    ['is not 62, 56 and 92 mm across', () => everywhere('w:w="3515"', 'w:w="3600"'), /it is not one row of three cells, 62, 56 and 92 mm wide/],
    [
      'is a row of exactly its height',
      () => written('<w:trHeight w:val="5873" w:hRule="atLeast"/>', '<w:trHeight w:val="5873" w:hRule="exact"/>'),
      /its row is not at least 100 mm tall and at most 105, or is exactly its height/,
    ],
    ['is taller than 105 mm', () => written('<w:trHeight w:val="5873"', '<w:trHeight w:val="6000"'), /its row is not at least 100 mm tall and at most 105/],
    [
      'has no line between the receipt and the payment part',
      () => written('<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>', ''),
      /it is not cut along its top and between the receipt and the payment part/,
    ],
    ['is cut by a heavier line', () => everywhere('<w:top w:val="single" w:sz="4"', '<w:top w:val="single" w:sz="8"'), /it is not cut along its top/],
    [
      'holds its amount in a row of exactly its height',
      () => written('<w:trHeight w:val="794" w:hRule="atLeast"/>', '<w:trHeight w:val="794" w:hRule="exact"/>'),
      /a row of the slip that holds text is exactly its height, which cuts a line that does not fit it/,
    ],
    [
      'starts the receipt’s information lower than 12 mm',
      () => written('w:line="151"', 'w:line="171"'),
      /the receipt's 'Account \/ Payable to', a heading, is not printed 5\.0 mm in and 12\.0 mm down, at 6 pt bold/,
    ],
    [
      'starts the receipt’s amount higher than 68 mm',
      () => written('w:line="871"', 'w:line="800"'),
      /the receipt's heading over the currency is not printed 5\.0 mm in and 68\.0 mm down/,
    ],
    [
      'leaves a line of an address out',
      () => written(slipLine('Musterstrasse 123', 10, false, 224), slipWhite(220)),
      /the payment part's 'Account \/ Payable to' does not print its values, line under line a pitch of 11\.2 pt apart/,
    ],
    [
      'prints a value at the heading’s size',
      () => written(slipLine('Simon Muster', 10, false, 224), slipLine('Simon Muster', 8, false, 220)),
      /the payment part's 'Payable by' does not print its values/,
    ],
    [
      'prints a heading light',
      () => written(slipLine('Reference', 8, true, 184), slipLine('Reference', 8, false, 184)),
      /the payment part's 'Reference', a heading, is not printed 118\.0 mm in/,
    ],
    [
      'sets a line in another family',
      () => written(TITLE, TITLE.replaceAll('Arial', 'Roboto')),
      /'Receipt' is not set in Arial, black and upright on its line/,
    ],
    [
      'sets a line in grey',
      () => written(TITLE, TITLE.replace('w:val="000000"', 'w:val="808080"')),
      /'Receipt' is not set in Arial, black and upright on its line/,
    ],
    [
      'prints another message than the bill’s',
      () => written('Order from 15.10.2020', 'Order from 16.10.2020'),
      /the payment part's 'Additional information' does not print its values/,
    ],
    [
      'prints a line the bill does not',
      () =>
        written(
          `${slipLine('8000 Seldwyla', 10, false, 224)}</w:tc>`,
          `${slipLine('8000 Seldwyla', 10, false, 224)}${slipLine('Thank you', 10, false, 224)}</w:tc>`,
        ),
      /'Thank you' is a line no part of the bill prints there/,
    ],
    [
      'sets the acceptance point to the left',
      () => written('<w:ind w:right="283"/><w:jc w:val="right"/>', ''),
      /the acceptance point is not printed 82 mm down, 6 pt bold, set to the right 57 mm in/,
    ],
    [
      'gives a line a height by Word’s own rule',
      () => written(TITLE, TITLE.replace('w:lineRule="exact"', 'w:lineRule="auto"')),
      /a paragraph of the slip is on no line of an exact height/,
    ],
    [
      'puts space before a line',
      () => written(TITLE, TITLE.replace('<w:spacing ', '<w:spacing w:before="40" ')),
      /a paragraph of the slip has space before or after it/,
    ],
    [
      'sets a value of 10 pt on a line of 11, shorter than its face’s own',
      () => written(slipLine('Simon Muster', 10, false, 224), slipLine('Simon Muster', 10, false, 220)),
      /'Simon Muster' is on a line of 11 pt, shorter than its face's own at 10 pt, 11\.17: Word would cut what reaches past it/,
    ],
    [
      'puts its code on a line of an exact height',
      () =>
        written(`<w:p><w:pPr>${SLIP_IN}<w:rPr><w:sz w:val="2"/>`, `<w:p><w:pPr><w:spacing w:line="200" w:lineRule="exact"/>${SLIP_IN}<w:rPr><w:sz w:val="2"/>`),
      /its code stands on a line of a stated height, which shows as much of the picture as the line is tall/,
    ],
    [
      'gives its code’s paragraph a mark of 40 pt',
      () =>
        written(
          `<w:p><w:pPr>${SLIP_IN}<w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr>`,
          `<w:p><w:pPr>${SLIP_IN}<w:rPr><w:sz w:val="80"/><w:szCs w:val="80"/></w:rPr></w:pPr>`,
        ),
      /its code's paragraph has a mark of 40 pt, where one of a point leaves its line as tall as the picture/,
    ],
    [
      'ends its page with a paragraph of 40 pt, which starts another page',
      () =>
        written(
          `${SEPARATOR}<w:sectPr><w:headerReference w:type="default" r:id="rId6"/>`,
          `${SEPARATOR.replace('w:line="20"', 'w:line="800"')}<w:sectPr><w:headerReference w:type="default" r:id="rId6"/>`,
        ),
      /is not the instruction to separate, the slip and an empty paragraph a point tall/,
    ],
    ['prints its code another size', () => everywhere('1656000', '1600000'), /its code is 125\.98\d* × 125\.98\d* pt, where SIX prints it 46 mm a side/],
    ['stands its code higher than 17 mm', () => written('w:line="435"', 'w:line="400"'), /its code does not stand 67 mm in and 17 mm down/],
  ])('%s', async (_name, parts, problem) => {
    expect(await problems(parts())).toMatch(problem)
  })

  // The font table says what a reader without Arial draws the slip in: without the other name, a face of other widths, in which a line may break.
  test('names Arial without the face of its widths beside it', async () => {
    const parts = handSlipParts()
    parts.set('word/fontTable.xml', (parts.get('word/fontTable.xml') as string).replace('<w:altName w:val="Liberation Sans"/>', ''))
    expect(await problems(parts)).toMatch(/the font table does not give Liberation Sans as Arial's other name/)
  })

  // A report whose section is not ended where its slip begins is one section: its slip would print on the report's own page, under its margins.
  test('is not on a page of its own, or is one where the document has no bill', async () => {
    expect(await problems(handParts(), HAND_SLIP)).toMatch(/the document is paid by a QR-bill, and the file has no page for its slip/)
    const unpaid = { ...HAND_SLIP.document }
    delete (unpaid as { paymentPart?: unknown }).paymentPart
    const fixture = { ...HAND_SLIP, document: unpaid, expect: expectation(unpaid, { maxPagesExpected: 2 }) }
    expect(await problems(handSlipParts(), fixture)).toMatch(/the file has a second section, and the document no payment part/)
    expect(HAND.document.paymentPart).toBeUndefined()
  })
})

describe('verifyDocx fails on a Swiss QR Code that', () => {
  const crossless = codePng(SYMBOL, HAND_SWISS_PIXELS, 0)
  /** The symbol read down where it reads across: the code mirrored about its diagonal, which a scanner reads only as a mirror. */
  const mirrored = { modules: SYMBOL.modules.map((_, row) => SYMBOL.modules.map((line) => line[row]!)) }

  // Each a picture Word prints as a code a banking app does not read, or reads as another bill.
  test.each<[string, () => Uint8Array, RegExp]>([
    ['has no Swiss cross', () => crossless, /its code: the picture is (black|white) .* from its centre, where the Swiss cross is (white|black)/],
    [
      'has a quiet zone of its own, and so modules smaller than 46 mm give them',
      () => codePng(SYMBOL, HAND_SWISS_PIXELS, 4),
      /its code: the picture's first dark run is 0 pixels from its corner/,
    ],
    [
      'has a pixel that is not its module’s colour',
      () => swissPng((x, y, dark) => (x === 30 && y === 400 ? !dark : dark)),
      /its code: the pixel 30, 400 is not the colour of the module it stands in/,
    ],
    ['is too coarse for 46 mm', () => swissPng(undefined, 5), /its code is \d+ pixels across 46 mm, fewer than 600 to the inch/],
    // Read down where it reads across: a scanner reads such a symbol only as a mirror, which the reader refuses.
    ['is mirrored', () => swissPng(undefined, HAND_SWISS_PIXELS, mirrored), /the slip's code: .*mirrored/],
  ])('%s', async (_name, png, problem) => {
    expect(await problems(pictured(png()))).toMatch(problem)
  })

  // The payload byte for byte, with its cross: a code of another amount is a bill paid wrongly, and it is the scanner that says so.
  test('scans to another payload than the bill’s, cross and all', async () => {
    const png = swissPng(undefined, HAND_SWISS_PIXELS, swissSymbol(HAND_BILL.payload.replace('1949.75', '9949.75')))
    expect(await problems(pictured(png))).toMatch(/the slip's code scans to other text, or other bytes, than the bill's payload/)
  })
})

// What a test asks of a file's slip code: the hand-written file's, as a scanner reads it with the white the slip leaves around it.
test('readSlipCode reads the code of the hand-written file, and none of a file with no slip', async () => {
  const code = await readSlipCode(readDocx(handDocx(handSlipParts())))
  expect(code?.read?.text).toBe(HAND_BILL.payload)
  expect(code).toMatchObject({ side: SYMBOL.modules.length * HAND_SWISS_PIXELS, version: (SYMBOL.modules.length - 17) / 4 })
  expect(await readSlipCode(readDocx(handDocx(handParts())))).toBeUndefined()
})
