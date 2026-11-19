import { swissSymbol, type QrSymbol } from '@formancy/report-runtime'
import type { ResolvedDocument } from '../../document.js'
import { expectation, type Fixture } from '../../fixture.js'
import { codePng } from './hand-codes.js'
import { DECLARATION, DRAWING, HAND_DOCUMENT, HAND_SEPARATOR, handParts, plain, R, relationships, SECTION, side, text, TINY, TYPE, W } from './hand.js'

/**
 * A Word file with a QR-bill's slip, written by hand (0075): the XML
 * typed out below, every length worked out from SIX's millimetres by
 * hand, for the tests of what `verifyDocx` holds a slip to. Nothing in
 * it comes from report-render-docx.
 *
 * Twentieths of a point, 56.693 to the millimetre: 5 mm are 283, 12 are
 * 680, 17 are 964, 57 are 3,231, 62 are 3,515, 68 are 3,855, 82 are
 * 4,649, 90 are 5,102, 118 are 6,690, and the slip's top, 192 mm down an
 * A4 page, is 10,885. A picture's extent is in English Metric Units,
 * 36,000 to the millimetre: 46 mm are 1,656,000.
 */

type QrBill = NonNullable<ResolvedDocument['paymentPart']>

/** SIX's second example (IG Annex A), without its billing information: a QR reference, an amount and a debtor, each value on one line of either part. */
export const HAND_BILL: QrBill = {
  kind: 'swissQrBill',
  payload: [
    'SPC',
    '0200',
    '1',
    'CH4431999123000889012',
    'S',
    'Max Muster & Söhne',
    'Musterstrasse',
    '123',
    '8000',
    'Seldwyla',
    'CH',
    ...['', '', '', '', '', '', ''],
    '1949.75',
    'CHF',
    'S',
    'Simon Muster',
    'Musterstrasse',
    '1',
    '8000',
    'Seldwyla',
    'CH',
    'QRR',
    '210000000003139471430009017',
    'Order from 15.10.2020',
    'EPD',
  ].join('\n'),
  headings: {
    paymentPart: 'Payment part',
    receipt: 'Receipt',
    account: 'Account / Payable to',
    reference: 'Reference',
    additionalInformation: 'Additional information',
    payableBy: 'Payable by',
    currency: 'Currency',
    amount: 'Amount',
    acceptancePoint: 'Acceptance point',
    separate: 'Separate before paying in',
  },
  account: 'CH44 3199 9123 0008 8901 2',
  creditor: ['Max Muster & Söhne', 'Musterstrasse 123', '8000 Seldwyla'],
  reference: '21 00000 00003 13947 14300 09017',
  additionalInformation: ['Order from 15.10.2020'],
  debtor: ['Simon Muster', 'Musterstrasse 1', '8000 Seldwyla'],
  currency: 'CHF',
  amount: '1 949.75',
}

/** The hand-written file's document: one paragraph, the page header and footer of the hand-written file, and the bill. */
export const HAND_SLIP_DOCUMENT: ResolvedDocument = { ...HAND_DOCUMENT, body: [{ kind: 'paragraph', runs: [{ text: 'An invoice' }] }], paymentPart: HAND_BILL }

export const HAND_SLIP: Fixture = {
  id: 'hand-slip',
  title: 'A report paid by a QR-bill, its slip written by hand',
  document: HAND_SLIP_DOCUMENT,
  maxPages: 2,
  expect: expectation(HAND_SLIP_DOCUMENT, { maxPagesExpected: 2 }),
}

/** The bill's Swiss QR Code, as the runtime encodes it. */
export const HAND_SWISS_SYMBOL = swissSymbol(HAND_BILL.payload)
const SYMBOL = HAND_SWISS_SYMBOL
/** Pixels a module: 1,656,000 EMU are 1.811 inches, 1,087 pixels at 600 to the inch, and the symbol's modules take that many between them at this many each. */
export const HAND_SWISS_PIXELS = Math.ceil(1087 / SYMBOL.modules.length)

/**
 * The Swiss QR Code's picture, with no quiet zone and the Swiss cross
 * over its centre, by the millimetres IG 6.4.2's logo is drawn in: a
 * white square of 7, a black one of 6, and a white cross on it whose arms
 * are 7/6 wide and 35/9 from end to end. `spoil` changes what a pixel is,
 * for a test that draws it wrongly on purpose.
 */
export function swissPng(
  spoil: (x: number, y: number, dark: boolean) => boolean = (_x, _y, dark) => dark,
  pixels = HAND_SWISS_PIXELS,
  symbol: QrSymbol = SYMBOL,
): Uint8Array {
  const side = symbol.modules.length * pixels
  return codePng(symbol, pixels, 0, (x, y, dark) => {
    const [across, down] = [Math.abs(((x + 0.5) * 46) / side - 23), Math.abs(((y + 0.5) * 46) / side - 23)]
    const far = Math.max(across, down)
    const crossed = (across <= 7 / 12 && down <= 35 / 18) || (down <= 7 / 12 && across <= 35 / 18)
    return spoil(x, y, far > 3.5 ? dark : far > 3 ? false : !crossed)
  })
}

const ARIAL = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>'
const size = (points: number): string => `<w:sz w:val="${points * 2}"/><w:szCs w:val="${points * 2}"/>`

/** White, exactly `height` twentieths tall. */
export const slipWhite = (height: number): string => `<w:p><w:pPr><w:spacing w:line="${height}" w:lineRule="exact"/>${TINY}</w:pPr></w:p>`

/** One line of the slip: `words` at `points`, on a line exactly `height` twentieths tall, `more` of its paragraph's properties between its line and its mark. */
export const slipLine = (words: string, points: number, bold: boolean, height: number, more = ''): string =>
  `<w:p><w:pPr><w:spacing w:line="${height}" w:lineRule="exact"/>${more}<w:rPr>${ARIAL}${size(points)}</w:rPr></w:pPr>` +
  `<w:r><w:rPr>${ARIAL}${bold ? '<w:b/>' : ''}<w:color w:val="000000"/>${size(points)}</w:rPr>${text(words)}</w:r></w:p>`

/** Five millimetres in from its cell's left. */
export const SLIP_IN = '<w:ind w:left="283"/>'
const IN = SLIP_IN

/** A part's information: each block's heading over its values, a blank line between two; `heading`, `value` and `gap` are its lines' heights. */
function information(
  blocks: readonly (readonly [string, readonly string[]])[],
  sizes: readonly [number, number],
  heights: readonly [number, number, number],
  more: string,
): string {
  return blocks
    .map(
      ([heading, values], index) =>
        `${index === 0 ? '' : slipWhite(heights[2])}${slipLine(heading, sizes[0], true, heights[0], more)}${values.map((value) => slipLine(value, sizes[1], false, heights[1], more)).join('')}`,
    )
    .join('')
}

const ACCOUNT = ['Account / Payable to', ['CH44 3199 9123 0008 8901 2', 'Max Muster &amp; Söhne', 'Musterstrasse 123', '8000 Seldwyla']] as const
const REFERENCE = ['Reference', ['21 00000 00003 13947 14300 09017']] as const
const PAYABLE_BY = ['Payable by', ['Simon Muster', 'Musterstrasse 1', '8000 Seldwyla']] as const

const NO_MARGINS =
  '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar>'
const table = (grid: readonly number[], rows: string): string =>
  `<w:tbl><w:tblPr><w:tblW w:w="${grid.reduce((sum, each) => sum + each, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${NO_MARGINS}</w:tblPr>` +
  `<w:tblGrid>${grid.map((each) => `<w:gridCol w:w="${each}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>`
const cell = (width: number, content: string, borders = ''): string =>
  `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${borders === '' ? '' : `<w:tcBorders>${borders}</w:tcBorders>`}</w:tcPr>${content}</w:tc>`
const atLeast = (height: number, cells: string): string =>
  `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="${height}" w:hRule="atLeast"/></w:trPr>${cells}</w:tr>`

/** A part's amount section, `height` tall: "Currency" and "Amount" over the currency and the amount, the amount's column `indent` in. */
const amount = (grid: readonly [number, number], height: number, sizes: readonly [number, number], heights: readonly [number, number]): string =>
  table(
    grid,
    atLeast(
      height,
      cell(grid[0], slipLine('Currency', sizes[0], true, heights[0], IN) + slipLine('CHF', sizes[1], false, heights[1], IN)) +
        cell(grid[1], slipLine('Amount', sizes[0], true, heights[0]) + slipLine('1 949.75', sizes[1], false, heights[1])),
    ),
  )

const CODE =
  `<w:p><w:pPr>${IN}${TINY}</w:pPr><w:r>${TINY}<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1656000" cy="1656000"/><wp:docPr id="1" name="Picture 1"/>` +
  '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="Picture 1"/><pic:cNvPicPr/></pic:nvPicPr>' +
  '<pic:blipFill><a:blip r:embed="rId8"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
  '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1656000" cy="1656000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'

const CUT = side('top', 4, '000000')

/** The receipt: its title 5 mm down, its information from 12 mm, its amount from 68 and the acceptance point at 82, set to the right 57 mm in. */
const RECEIPT =
  slipWhite(283) +
  slipLine('Receipt', 11, true, 246, IN) +
  slipWhite(151) +
  // 680, and 144 + 4 × 180, 216 + 144 + 180 and 216 + 144 + 3 × 180 more: 2,984.
  information([ACCOUNT, REFERENCE, PAYABLE_BY], [6, 8], [144, 180, 216], IN) +
  slipWhite(871) +
  amount([964, 2267], 794, [6, 8], [184, 179]) +
  slipLine('Acceptance point', 6, true, 134, '<w:ind w:right="283"/><w:jc w:val="right"/>')

/** The payment part's left: its title, the code from 17 mm, 46 mm tall, and its amount from 68 to 90. */
const PAYMENT =
  slipWhite(283) +
  slipLine('Payment part', 11, true, 246, IN) +
  slipWhite(435) +
  CODE +
  slipWhite(283) +
  amount([1134, 2041], 1247, [8, 10], [224, 223]) +
  HAND_SEPARATOR

/** Its information, from 5 mm down. */
const INFORMATION =
  slipWhite(283) + information([ACCOUNT, REFERENCE, ['Additional information', ['Order from 15.10.2020']], PAYABLE_BY], [8, 10], [184, 220, 256], '')

/** The slip's page: the instruction, on a line that ends 192 mm down, the slip, and the paragraph after it. */
export const HAND_SLIP_PAGE =
  slipLine('Separate before paying in', 8, false, 205, '<w:jc w:val="center"/>') +
  table(
    [3515, 3175, 5216],
    atLeast(5873, cell(3515, RECEIPT, `${CUT}${side('right', 4, '000000')}`) + cell(3175, PAYMENT, CUT) + cell(5216, INFORMATION, CUT)),
  ) +
  HAND_SEPARATOR

/** The slip's section: A4 upright, its top margin down to the instruction, and an empty header and footer of its own. */
export const HAND_SLIP_SECTION =
  '<w:sectPr><w:headerReference w:type="default" r:id="rId6"/><w:footerReference w:type="default" r:id="rId7"/>' +
  '<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="10680" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>'

/** The paragraph that ends the report's section. */
const ENDING = `<w:p><w:pPr><w:spacing w:line="20" w:lineRule="exact"/>${TINY}${SECTION}</w:pPr></w:p>`

const MAIN = 'application/vnd.openxmlformats-officedocument.wordprocessingml'

/** The hand-written file's parts by name: a test changes one and zips them again. */
export function handSlipParts(): Map<string, string | Uint8Array> {
  const parts = handParts()
  parts.set(
    '[Content_Types].xml',
    (parts.get('[Content_Types].xml') as string).replace(
      '<Override PartName="/docProps/core.xml"',
      `<Override PartName="/word/header3.xml" ContentType="${MAIN}.header+xml"/><Override PartName="/word/footer2.xml" ContentType="${MAIN}.footer+xml"/><Override PartName="/docProps/core.xml"`,
    ),
  )
  parts.set(
    'word/document.xml',
    `${DECLARATION}<w:document ${W} ${R} ${DRAWING}><w:body>${plain('An invoice')}${ENDING}${HAND_SLIP_PAGE}${HAND_SLIP_SECTION}</w:body></w:document>`,
  )
  parts.set(
    'word/_rels/document.xml.rels',
    relationships(
      [`${TYPE}/styles`, 'styles.xml'],
      [`${TYPE}/settings`, 'settings.xml'],
      [`${TYPE}/fontTable`, 'fontTable.xml'],
      [`${TYPE}/header`, 'header1.xml'],
      [`${TYPE}/footer`, 'footer1.xml'],
      [`${TYPE}/header`, 'header3.xml'],
      [`${TYPE}/footer`, 'footer2.xml'],
      [`${TYPE}/image`, 'media/image1.png'],
    ),
  )
  parts.set(
    'word/fontTable.xml',
    `${DECLARATION}<w:fonts ${W}><w:font w:name="Roboto"><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font>` +
      '<w:font w:name="Arial"><w:altName w:val="Liberation Sans"/><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font></w:fonts>',
  )
  parts.set('word/header3.xml', `${DECLARATION}<w:hdr ${W}>${HAND_SEPARATOR}</w:hdr>`)
  parts.set('word/footer2.xml', `${DECLARATION}<w:ftr ${W}>${HAND_SEPARATOR}</w:ftr>`)
  parts.set('word/media/image1.png', swissPng())
  return parts
}
