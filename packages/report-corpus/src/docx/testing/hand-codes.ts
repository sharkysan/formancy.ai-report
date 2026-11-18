import { deflateSync } from 'node:zlib'
import { epcSymbol, qrSymbol, type QrSymbol } from '@formancy/report-runtime'
import type { EpcQrCode, QrCode, ResolvedDocument } from '../../document.js'
import { expectation, type Fixture } from '../../fixture.js'
import { pngOf } from '../../fixtures/png.js'
import { DECLARATION, DRAWING, HAND_DOCUMENT, handParts, margins, plain, R, relationships, SECTION, side, TINY, TYPE, W } from './hand.js'

/**
 * A Word file with a QR code and a captioned EPC QR code, written by hand
 * (0074), for the tests of the corpus's checks of a code: its XML typed
 * out below as record 0074's table states it, and each code's picture
 * made here, from the symbol the runtime decides, by Node's zlib -- every
 * scanline as it is, where report-render-docx writes a repeated one as
 * nothing but its filter. Nothing in it comes from the writer, so a check
 * that passes it was not taught by the writer what to expect.
 */

/** Umlauts, the euro sign and an emoji outside the Basic Multilingual Plane: 22 bytes of UTF-8, which version 2 holds at level M and version 1 does not. */
export const HAND_QR: QrCode = { kind: 'qrCode', id: 'code', text: 'Grüezi 🧾 12.50 €', size: 72, errorCorrection: 'M' }

/** EPC069-12 2.3's first example, in Austria's frame in a 30 mm square: version 8 there, the least whose modules are the PSA's. */
export const HAND_EPC: EpcQrCode = {
  kind: 'epcQrCode',
  id: 'pay',
  payload: ['BCD', '001', '1', 'SCT', 'BHBLDEHHXXX', 'Franz Mustermänn', 'DE71110220330123456789', 'EUR12.3', 'GDDS', 'RF18539007547034'].join('\n'),
  size: 85.04,
  caption: 'zahlenMitCode',
}

/**
 * A symbol as a PNG of one bit of grey a pixel, `pixels` a module, black
 * on white, `quiet` modules of white around it: every scanline written as
 * it is, its filter none. `spoil` changes a pixel's colour, for a test
 * that wants a picture a pixel out.
 */
export function codePng(
  symbol: QrSymbol,
  pixels: number,
  quiet = 4,
  spoil: (x: number, y: number, dark: boolean) => boolean = (_x, _y, dark) => dark,
): Uint8Array {
  const side = (symbol.modules.length + 2 * quiet) * pixels
  const stride = 1 + Math.ceil(side / 8)
  const lines = new Uint8Array(side * stride)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const dark = symbol.modules[Math.floor(y / pixels) - quiet]?.[Math.floor(x / pixels) - quiet] === true
      if (!spoil(x, y, dark)) lines[y * stride + 1 + (x >> 3)]! |= 0x80 >> (x & 7)
    }
  }
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, side)
  view.setUint32(4, side)
  header.set([1, 0, 0, 0, 0], 8)
  return pngOf([
    ['IHDR', header],
    ['IDAT', new Uint8Array(deflateSync(lines))],
    ['IEND', new Uint8Array(0)],
  ])
}

/** The QR code's picture: 33 modules across at 19 pixels each, 627 pixels across the inch it prints at. */
export const HAND_QR_PNG = codePng(qrSymbol(HAND_QR, 1000), 19)

/** The EPC QR code's: 57 modules across at 12 pixels each, 684 pixels across its 77.36 points. */
export const HAND_EPC_PNG = codePng(epcSymbol(HAND_EPC, 1000), 12)

/** The document the file says: a heading kept with the QR code under it, the code, the captioned EPC QR code and a line after them. */
export const HAND_CODES_DOCUMENT: ResolvedDocument = {
  ...HAND_DOCUMENT,
  body: [
    { kind: 'paragraph', runs: [{ text: 'Scan to pay' }], style: { size: 10 }, keepWithNext: true },
    HAND_QR,
    HAND_EPC,
    { kind: 'paragraph', runs: [{ text: 'After the codes' }], style: { size: 10 } },
  ],
}

export const HAND_CODES: Fixture = {
  id: 'hand-codes',
  title: 'A QR code and a captioned EPC QR code, written by hand',
  document: HAND_CODES_DOCUMENT,
  maxPages: 1,
  expect: expectation(HAND_CODES_DOCUMENT, { maxPagesExpected: 1 }),
}

/** An inline picture `emu` English Metric Units a side, 12,700 to the point. */
const picture = (id: number, relationship: string, emu: number): string =>
  `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emu}" cy="${emu}"/><wp:docPr id="${id}" name="Picture ${id}"/>` +
  `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Picture ${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
  `<pic:blipFill><a:blip r:embed="${relationship}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
  `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu}" cy="${emu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`

const ARIAL = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>'
const SEVEN = '<w:sz w:val="14"/><w:szCs w:val="14"/>'

/**
 * The frame, by hand. In a square of 85.04 points a version 8 symbol, 49
 * modules, has modules of (85.04 - 7) / 57.5 = 1.3572 points (report-spec's
 * `epcModule`): its picture, with four of quiet zone a side, 57 modules,
 * 77.3614 points, 982,490 English Metric Units; the frame's line half a
 * module, 0.6786 points, five eighths of a point as a border and fourteen
 * twentieths as the picture's distance from the frame's left and top; the
 * frame 58 modules tall, 78.7186 points, 1,574 twentieths; the white above
 * and under it half of what the square has left, 3.1607 points, 63
 * twentieths; and across, 78.04 points to the caption's band of 7.
 */
const FRAME =
  `<w:tbl><w:tblPr><w:tblW w:w="1701" w:type="dxa"/><w:tblLayout w:type="fixed"/>${margins(0, 0)}</w:tblPr><w:tblGrid><w:gridCol w:w="1561"/><w:gridCol w:w="140"/></w:tblGrid>` +
  '<w:tr><w:trPr><w:trHeight w:val="1574" w:hRule="exact"/></w:trPr>' +
  `<w:tc><w:tcPr><w:tcW w:w="1561" w:type="dxa"/><w:tcBorders>${['top', 'left', 'bottom'].map((each) => side(each, 5, '000000')).join('')}</w:tcBorders></w:tcPr>` +
  `<w:p><w:pPr><w:spacing w:before="14"/><w:ind w:left="14"/>${TINY}</w:pPr><w:r>${TINY}${picture(2, 'rId7', 982490)}</w:r></w:p></w:tc>` +
  `<w:tc><w:tcPr><w:tcW w:w="140" w:type="dxa"/><w:tcBorders>${['top', 'bottom', 'right'].map((each) => side(each, 5, '000000')).join('')}</w:tcBorders><w:textDirection w:val="btLr"/></w:tcPr>` +
  `<w:p><w:pPr><w:spacing w:line="140" w:lineRule="exact"/><w:jc w:val="center"/><w:rPr>${ARIAL}${SEVEN}</w:rPr></w:pPr>` +
  `<w:r><w:rPr>${ARIAL}<w:color w:val="000000"/>${SEVEN}</w:rPr><w:t xml:space="preserve">Zahlen mit Code</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`

/** The white above the frame, kept with it, and the white under it. */
const WHITE = (kept: boolean): string => `<w:p><w:pPr>${kept ? '<w:keepNext/>' : ''}<w:spacing w:line="63" w:lineRule="exact"/>${TINY}</w:pPr></w:p>`

const BODY = [
  plain('Scan to pay', '<w:keepNext/>'),
  // A point is 12,700 English Metric Units: 72 points a side.
  `<w:p><w:pPr>${TINY}</w:pPr><w:r>${TINY}${picture(1, 'rId6', 914400)}</w:r></w:p>`,
  WHITE(true),
  FRAME,
  WHITE(false),
  plain('After the codes'),
].join('')

/** The file's parts by name: the hand-written file's, with this body, its two pictures, and Arial in its font table beside Roboto. */
export function handCodeParts(): Map<string, string | Uint8Array> {
  const parts = handParts()
  parts.set('word/document.xml', `${DECLARATION}<w:document ${W} ${R} ${DRAWING}><w:body>${BODY}${SECTION}</w:body></w:document>`)
  parts.set(
    'word/_rels/document.xml.rels',
    relationships(
      [`${TYPE}/styles`, 'styles.xml'],
      [`${TYPE}/settings`, 'settings.xml'],
      [`${TYPE}/fontTable`, 'fontTable.xml'],
      [`${TYPE}/header`, 'header1.xml'],
      [`${TYPE}/footer`, 'footer1.xml'],
      [`${TYPE}/image`, 'media/image1.png'],
      [`${TYPE}/image`, 'media/image2.png'],
    ),
  )
  parts.set(
    'word/fontTable.xml',
    `${DECLARATION}<w:fonts ${W}><w:font w:name="Roboto"><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font><w:font w:name="Arial"><w:family w:val="swiss"/><w:pitch w:val="variable"/></w:font></w:fonts>`,
  )
  parts.set('word/media/image1.png', HAND_QR_PNG)
  parts.set('word/media/image2.png', HAND_EPC_PNG)
  return parts
}
