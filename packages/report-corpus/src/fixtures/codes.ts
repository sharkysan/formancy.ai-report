import type { Block, EpcQrCode, Paragraph, QrCode, ResolvedDocument } from '../document.js'
import { expectation, type Fixture } from '../fixture.js'
import { details, documentOf, heading, ledger, paragraph } from './build.js'
import { SMALL_SIZE } from './geometry.js'

/**
 * QR codes and EPC QR codes (0020, 0025), as every engine draws them
 * (0074): a code at each error correction level, saying umlauts, the euro
 * sign and an emoji; a code where a report puts one -- in a column, in a
 * framed section, kept with its heading, in a kept block, in the page
 * footer on every page, in page 1's own header and in the page header;
 * the largest symbol there is; one whose modules are exactly the smallest
 * a code prints at; a preview's code of no text; and EPC QR codes, with
 * Austria's caption and without it, the EPC's own example and the most a
 * code holds, in the places a report puts one and at the foot of every
 * page.
 *
 * The corpus's checks of a PDF read text and images, and a code is
 * neither: what a PDF's code says is read from the page's pixels where a
 * test asks (`readCodes`). A Word file's is held by `verifyDocx`, on the
 * picture the file embeds. Every page of these holds a line of text, so
 * that no page is one the checks take for empty.
 *
 * A code the rules below both engines refuse is no fixture here: each
 * way one is refused is a document of `MALFORMED`.
 *
 * Not in `ALL_FIXTURES`, the corpus the renderer trial chose an engine on
 * (0005): neither trial adapter draws a code (`trial/undrawn.ts`).
 */

/** Umlauts, the euro sign, and an emoji outside the Basic Multilingual Plane, which UTF-8 writes in four bytes and JavaScript in two code units. */
const SWISS = 'Grüezi Zürich: CHF 12.50 oder 9,99 € 🧾'

/** EPC069-12 2.3's first example: 96 bytes of UTF-8, "Resulting QR code version 6". */
const EPC_EXAMPLE = ['BCD', '001', '1', 'SCT', 'BHBLDEHHXXX', 'Franz Mustermänn', 'DE71110220330123456789', 'EUR12.3', 'GDDS', 'RF18539007547034'].join('\n')

/** A payload of the EPC's shape and exactly 331 bytes, the most the EPC allows: a name of 70, the largest amount, a text of 140, and information to make up the rest. */
const EPC_MOST = ((): string => {
  const head = ['BCD', '001', '1', 'SCT', 'BHBLDEHHXXX', 'N'.repeat(70), 'DE89370400440532013000', 'EUR999999999.99', 'GDDS', '', 'T'.repeat(140)].join('\n')
  return `${head}\n${'I'.repeat(331 - head.length - 1)}`
})()

function qr(id: string, text: string, size: number, errorCorrection: QrCode['errorCorrection'] = 'M'): QrCode {
  return { kind: 'qrCode', id, text, size, errorCorrection }
}

function epc(id: string, payload: string, size: number, caption?: 'zahlenMitCode'): EpcQrCode {
  return { kind: 'epcQrCode', id, payload, size, ...(caption === undefined ? {} : { caption }) }
}

/** A fixture of one page, or of as many as it says, each line of `lines` found on a line of its own. */
function fixture(
  id: string,
  title: string,
  document: ResolvedDocument,
  lines: readonly string[],
  pages: { readonly min: number; readonly max: number },
): Fixture {
  return {
    id,
    title,
    document,
    maxPages: pages.max,
    expect: expectation(document, { minPagesExpected: pages.min, maxPagesExpected: pages.max, exactText: lines }),
  }
}
const ONE_PAGE = { min: 1, max: 1 } as const

const LEVELS = ['L', 'M', 'Q', 'H'] as const

/** One code a level, each under a line that names it: 120 points a side, which holds the text at every level with modules well over the smallest. */
const levels = fixture(
  'qr-codes',
  'A QR code at each error correction level, saying umlauts, the euro sign and an emoji',
  documentOf(
    'QR codes',
    LEVELS.flatMap((level): Block[] => [paragraph(`Error correction level ${level}`), qr(`code-${level}`, SWISS, 120, level)]),
  ),
  LEVELS.map((level) => `Error correction level ${level}`),
  ONE_PAGE,
)

/**
 * A code where a report puts one: beside a paragraph, in a column as wide
 * as it is; inside a frame's padding; under a heading kept with it; and in
 * a block kept on one page with the line under it.
 */
const placed = fixture(
  'qr-code-placed',
  'A QR code in a column, in a framed section, kept with its heading and in a kept block',
  documentOf('QR codes placed', [
    {
      kind: 'columns',
      columns: [
        { width: 'fill', blocks: [paragraph('Beside the code, in the column that fills what the code leaves')] },
        { width: 80, blocks: [qr('column-code', 'INV-2026-0042', 80, 'Q')] },
      ],
    },
    { kind: 'section', padding: 12, fill: '#eeeeee', border: { thickness: 1, color: '#1f4e79' }, blocks: [qr('framed-code', 'INV-2026-0043', 60, 'Q')] },
    heading('Scan to pay'),
    qr('headed-code', 'INV-2026-0044', 100),
    { kind: 'keepTogether', blocks: [qr('kept-code', 'INV-2026-0045', 72, 'H'), paragraph('Kept with the code above it')] },
  ]),
  ['Beside the code, in the column that fills what the code leaves', 'Scan to pay', 'Kept with the code above it'],
  ONE_PAGE,
)

/**
 * A code in each page region, under a table long enough for a second
 * page: the page footer's on every page, page 1's own header's on page 1
 * alone, and the page header's on every page after it.
 */
const regions = ((): Fixture => {
  const titled = documentOf('QR codes in the page regions', [ledger('lines', details(1, 90))])
  const small = (text: string): Paragraph => paragraph(text, { size: SMALL_SIZE })
  const document: ResolvedDocument = {
    ...titled,
    pageHeader: [...titled.pageHeader, qr('header-code', 'INV-2026-0042-CONTINUED', 48, 'Q')],
    firstPageHeader: [small('Invented Supplies Ltd, order 2026-0042'), qr('first-code', 'https://formancy.ai/report/', 60)],
    pageFooter: [...titled.pageFooter, qr('footer-code', 'INV-2026-0042', 40, 'Q')],
  }
  // Some 14 points a row, under regions a code taller than the corpus's own: two pages at the least, and four leaves room for any engine's lines.
  return fixture('qr-code-regions', "A QR code in the page footer, in page 1's own header and in the page header", document, [], { min: 2, max: 4 })
})()

/** Version 40 at level H: 177 modules a side, the most there are, for the fewest bytes of any level, 1273. */
const largest = fixture(
  'qr-code-largest',
  'The largest symbol, version 40, for 1273 bytes at level H',
  documentOf('The largest QR code', [paragraph('Version 40 at level H'), qr('largest-code', 'x'.repeat(1273), 300, 'H')]),
  ['Version 40 at level H'],
  ONE_PAGE,
)

/**
 * A square exactly as large as its text needs at 0.4 mm a module. Fourteen
 * bytes are the most version 1 holds at level M in byte mode (ISO/IEC
 * 18004, table 7), so the symbol is 21 modules, 29 with its quiet zone,
 * and the square 11.6 mm: a floor checked with `<=` would refuse it.
 */
const smallestModule = fixture(
  'qr-code-smallest-module',
  'A QR code whose modules are exactly the smallest a code prints at, 0.4 mm',
  documentOf('The smallest module', [paragraph('Modules of 0.4 mm'), qr('fine-code', 'fourteen bytes', (29 * 0.4 * 72) / 25.4)]),
  ['Modules of 0.4 mm'],
  ONE_PAGE,
)

/** What a preview hands on for a code whose content resolved to nothing: drawn as a symbol of no data, which no scanner reads a code in. */
const empty = fixture(
  'qr-code-empty',
  'A QR code of no text, as a preview resolves one whose reference is not filled in',
  documentOf('A QR code of no text', [paragraph('No reference yet'), qr('empty-code', '', 60)]),
  ['No reference yet'],
  ONE_PAGE,
)

/**
 * EPC QR codes: the EPC's first example without a caption and in
 * Austria's frame, each in a 30 mm square, and the most the EPC allows,
 * 331 bytes, without a caption and in the largest square the PSA's frame
 * prints in, where version 13's modules are 20 mil.
 */
const epcCodes = fixture(
  'epc-qr-codes',
  "EPC QR codes, without a caption and in Austria's frame, the EPC's example and the most a code holds",
  documentOf('EPC QR codes', [
    paragraph("The EPC's example"),
    epc('example-code', EPC_EXAMPLE, 85.04),
    paragraph("The EPC's example in Austria's frame"),
    epc('example-framed', EPC_EXAMPLE, 85.04, 'zahlenMitCode'),
    paragraph('The most the EPC allows'),
    epc('most-code', EPC_MOST, 100),
    paragraph("The most the EPC allows in Austria's frame"),
    epc('most-framed', EPC_MOST, 118.6, 'zahlenMitCode'),
  ]),
  ["The EPC's example", "The EPC's example in Austria's frame", 'The most the EPC allows', "The most the EPC allows in Austria's frame"],
  ONE_PAGE,
)

/**
 * A framed EPC QR code where a report puts one: in a column beside the
 * payment's details, as the euro invoice prints it; inside a section's
 * frame; under a heading kept with it; and in a kept block.
 */
const epcPlaced = fixture(
  'epc-qr-code-placed',
  "An EPC QR code in Austria's frame in a column, in a framed section, kept with its heading and in a kept block",
  documentOf('EPC QR codes placed', [
    {
      kind: 'columns',
      columns: [
        { width: 90, blocks: [epc('column-framed', EPC_EXAMPLE, 85.04, 'zahlenMitCode')] },
        { width: 'fill', blocks: [paragraph('Payable to Franz Mustermänn, DE71 1102 2033 0123 4567 89')] },
      ],
    },
    { kind: 'section', padding: 8, border: { thickness: 1, color: '#1f4e79' }, blocks: [epc('boxed-framed', EPC_EXAMPLE, 90.71, 'zahlenMitCode')] },
    heading('Pay by code'),
    epc('headed-framed', EPC_EXAMPLE, 85.04, 'zahlenMitCode'),
    { kind: 'keepTogether', blocks: [paragraph('Kept with the code under it'), epc('kept-framed', EPC_EXAMPLE, 85.04, 'zahlenMitCode')] },
  ]),
  ['Payable to Franz Mustermänn, DE71 1102 2033 0123 4567 89', 'Pay by code', 'Kept with the code under it'],
  ONE_PAGE,
)

/**
 * A framed EPC QR code in the page footer, as the PSA places a code at a
 * page's foot, on each of two pages. Its caption is a line of the footer
 * (`expectation`), and a fixture of its own: the checks of a PDF tell a
 * page's footer from its body by the text of their lines, so a body that
 * printed the caption too, under a framed code of its own, would be read
 * as the footer from there down. The body's code has none.
 */
const epcFooter = ((): Fixture => {
  const titled = documentOf('An EPC QR code at the foot of every page', [
    paragraph('Payable by the code at the foot of the page'),
    epc('body-code', EPC_EXAMPLE, 85.04),
    { kind: 'pageBreak' },
    paragraph('And on the page after it'),
  ])
  const document: ResolvedDocument = { ...titled, pageFooter: [...titled.pageFooter, epc('footer-framed', EPC_EXAMPLE, 85.04, 'zahlenMitCode')] }
  return fixture(
    'epc-qr-code-footer',
    "An EPC QR code in Austria's frame in the page footer, on every page",
    document,
    ['Payable by the code at the foot of the page', 'And on the page after it'],
    { min: 2, max: 2 },
  )
})()

/** The code fixtures, which the renderer and the Word writer answer to beside `ALL_FIXTURES`. */
export const CODE_FIXTURES: readonly Fixture[] = [levels, placed, regions, largest, smallestModule, empty, epcCodes, epcPlaced, epcFooter]
