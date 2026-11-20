import { E_INVOICE_PREVIEW_LABEL, PREVIEW_LABEL } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { verifyDocx, wordRefusal } from './check-docx.js'
import type { Block, Image, ResolvedDocument } from './document.js'
import { readDocx } from './docx/read.js'
import { HAND, HAND_DOCUMENT, HAND_SEPARATOR, handDocx, handParts, rewritten } from './docx/testing/hand.js'
import { expectation, type Fixture } from './fixture.js'
import { CHART_FIXTURES } from './fixtures/charts.js'
import { encodePng } from './fixtures/png.js'
import { SVG_MARK } from './fixtures/svg.js'
import { IMAGE_KINDS, UNSEEN_JPEGS } from './image-kinds.js'

/**
 * `verifyDocx`, proved on the file written by hand (`docx/testing/hand.ts`),
 * never on one the writer wrote (0068): the file passes as it stands, and
 * with one thing taken out of it or written otherwise the check says so. A
 * check that never failed on a defect has not been shown to see it.
 */

const problems = (parts: ReadonlyMap<string, string | Uint8Array>, fixture: Fixture = HAND): Promise<string[]> => verifyDocx(fixture, readDocx(handDocx(parts)))
const DOCUMENT = 'word/document.xml'

// The file as it was typed is the document, whole: without this, every case below could fail for a reason of its own.
test('the hand-written file is its document, with nothing to say against it', async () => {
  expect(await problems(handParts())).toEqual([])
})

describe('verifyDocx fails on a file that', () => {
  const ROW_2 = /<w:tr><w:trPr><w:cantSplit\/><\/w:trPr><w:tc>(?:(?!<w:tr>).)*ROW-2.*?<\/w:tr>/
  const withoutRow2 = (): Map<string, string | Uint8Array> => {
    const parts = handParts()
    const document = parts.get(DOCUMENT) as string
    if (!ROW_2.test(document)) throw new Error('the row of ROW-2 is not found')
    return parts.set(DOCUMENT, document.replace(ROW_2, ''))
  }
  const NUMPAGES = / of <\/w:t><\/w:r>.*<\/w:p>/
  const withoutCount = (): Map<string, string | Uint8Array> => {
    const parts = handParts()
    const footer = parts.get('word/footer1.xml') as string
    if (!NUMPAGES.test(footer)) throw new Error('the page count is not found')
    return parts.set('word/footer1.xml', footer.replace(NUMPAGES, ' of </w:t></w:r></w:p>'))
  }

  // One defect a case, each a way a writer loses or misstates something with the file still opening.
  test.each<[string, () => ReadonlyMap<string, string | Uint8Array>, RegExp]>([
    ['lost a row', withoutRow2, /ROW-2|holds 4 rows/],
    [
      "lost a cell's text",
      () => rewritten(DOCUMENT, '<w:t xml:space="preserve">2.00</w:t>', '<w:t xml:space="preserve"></w:t>'),
      /prints '' where the table states '2\.00'/,
    ],
    ['lost a word', () => rewritten(DOCUMENT, '>Heading<', '>Head<'), /the run 'Heading' is 'Head'/],
    [
      'lost the space a run ends in',
      () => rewritten(DOCUMENT, ' rises &amp; &lt;falls&gt; <', ' rises &amp; &lt;falls&gt;<'),
      /the run ' rises & <falls> ' is/,
    ],
    ["lost the header row's mark", () => rewritten(DOCUMENT, '<w:cantSplit/><w:tblHeader/>', '<w:cantSplit/>'), /not marked as the row to repeat/],
    [
      "lost a kept row's mark",
      () =>
        rewritten(
          DOCUMENT,
          '<w:keepNext/><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:color w:val="000000"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">ROW-1<',
          '<w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:color w:val="000000"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">ROW-1<',
        ),
      /'ROW-1' is not kept with what follows it/,
    ],
    [
      'may split a row',
      () =>
        rewritten(
          DOCUMENT,
          '<w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="9906" w:type="dxa"/><w:gridSpan',
          '<w:trPr></w:trPr><w:tc><w:tcPr><w:tcW w:w="9906" w:type="dxa"/><w:gridSpan',
        ),
      /row 0 may split/,
    ],
    [
      "embeds other bytes than the picture's",
      () =>
        new Map(handParts()).set(
          'word/media/image1.png',
          encodePng(2, 2, () => [1, 2, 3]),
        ),
      /embeds other bytes than its asset's/,
    ],
    [
      'lost a page field',
      withoutCount,
      /page footer has no line of the page's number and count[^]*holds 3 runs|holds 3 runs[^]*page footer has no line of the page's number and count/,
    ],
    [
      'prints a run in another colour',
      () =>
        rewritten(
          DOCUMENT,
          '<w:i/><w:color w:val="336699"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">CO<',
          '<w:i/><w:color w:val="336698"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">CO<',
        ),
      /the run 'CO' is #336698/,
    ],
    [
      'prints a run upright',
      () =>
        rewritten(
          DOCUMENT,
          '<w:i/><w:color w:val="336699"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">CO<',
          '<w:color w:val="336699"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">CO<',
        ),
      /the run 'CO' is not italic/,
    ],
    [
      'prints a run at another size',
      () => rewritten(DOCUMENT, '<w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t', '<w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t'),
      /the run 'Heading' is 13 pt/,
    ],
    [
      'prints a heading light',
      () => rewritten(DOCUMENT, '<w:b/><w:color w:val="000000"/><w:sz w:val="28"/>', '<w:color w:val="000000"/><w:sz w:val="28"/>'),
      /the run 'Heading' is not bold/,
    ],
    ['sets a lowered run on the line', () => rewritten(DOCUMENT, '<w:vertAlign w:val="subscript"/>', ''), /sets it subscript|off the line/],
    [
      'aligns a paragraph elsewhere',
      () =>
        rewritten(
          DOCUMENT,
          '<w:p><w:pPr><w:jc w:val="right"/><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:sz w:val="20"/>',
          '<w:p><w:pPr><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:sz w:val="20"/>',
        ),
      /is aligned left where its style says right/,
    ],
    [
      'lets a heading end a page',
      () =>
        rewritten(
          DOCUMENT,
          '<w:p><w:pPr><w:keepNext/><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:sz w:val="28"/>',
          '<w:p><w:pPr><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:sz w:val="28"/>',
        ),
      /'Heading' is not kept with what follows it/,
    ],
    [
      'draws a rule at another weight',
      () =>
        rewritten(
          DOCUMENT,
          '<w:bottom w:val="single" w:sz="8" w:space="0" w:color="999999"/>',
          '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>',
        ),
      /a rule 1 pt thick is not/,
    ],
    [
      'draws a rule in another colour',
      () =>
        rewritten(
          DOCUMENT,
          '<w:bottom w:val="single" w:sz="8" w:space="0" w:color="999999"/>',
          '<w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>',
        ),
      /a rule 1 pt thick is not/,
    ],
    [
      'would print two equal rules as one line',
      () => rewritten(DOCUMENT, '<w:between w:val="single" w:sz="8" w:space="0" w:color="999999"/>', ''),
      /no line between it and a rule like it/,
    ],
    [
      'makes a spacer another height',
      () => rewritten(DOCUMENT, '<w:spacing w:line="240" w:lineRule="exact"/>', '<w:spacing w:line="200" w:lineRule="exact"/>'),
      /a spacer 12 pt tall is not/,
    ],
    [
      'makes a rectangle another size',
      () => rewritten(DOCUMENT, '<w:trHeight w:val="200" w:hRule="exact"/>', '<w:trHeight w:val="220" w:hRule="exact"/>'),
      /a rectangle of 30 × 10 pt is not/,
    ],
    ['fills a rectangle otherwise', () => rewritten(DOCUMENT, 'w:fill="FFCC00"', 'w:fill="FFCC01"'), /a rectangle is filled or outlined otherwise/],
    [
      'frames a section in another colour',
      () =>
        rewritten(DOCUMENT, '<w:top w:val="single" w:sz="8" w:space="0" w:color="1F4E79"/>', '<w:top w:val="single" w:sz="8" w:space="0" w:color="1F4E78"/>'),
      /bordered otherwise than it states/,
    ],
    ['fills a section otherwise', () => rewritten(DOCUMENT, 'w:fill="EEF3F8"', 'w:fill="EEF3F9"'), /a framed section is filled #eef3f9/],
    [
      'pads a section otherwise',
      () => rewritten(DOCUMENT, '<w:top w:w="120" w:type="dxa"/>', '<w:top w:w="100" w:type="dxa"/>'),
      /does not pad its blocks by 6 pt/,
    ],
    [
      'makes a column another width',
      () => rewritten(DOCUMENT, '<w:gridCol w:w="4000"/><w:gridCol w:w="5906"/>', '<w:gridCol w:w="5000"/><w:gridCol w:w="4906"/>'),
      /a columns block is not one row of a cell a column, at its widths/,
    ],
    [
      "makes a table's column another width",
      () => rewritten(DOCUMENT, '<w:gridCol w:w="2000"/><w:gridCol w:w="7906"/>', '<w:gridCol w:w="2400"/><w:gridCol w:w="7506"/>'),
      /its grid is 120, 375\.3 pt/,
    ],
    [
      'places a picture off its centre',
      () => rewritten(DOCUMENT, '<w:ind w:left="200"/>', '<w:ind w:left="100"/>'),
      /the image dot is not centred in its box|takes 30/,
    ],
    [
      'draws a picture at another size',
      () =>
        rewritten(DOCUMENT, '<wp:extent cx="254000" cy="254000"/>', '<wp:extent cx="254000" cy="127000"/>').set(
          DOCUMENT,
          (rewritten(DOCUMENT, '<wp:extent cx="254000" cy="254000"/>', '<wp:extent cx="254000" cy="127000"/>').get(DOCUMENT) as string).replace(
            '<a:ext cx="254000" cy="254000"/>',
            '<a:ext cx="254000" cy="127000"/>',
          ),
        ),
      /the image dot is 20 × 10 pt/,
    ],
    [
      'starts no page where a page break stands',
      () => rewritten(DOCUMENT, '<w:pageBreakBefore/>', ''),
      /a page break is not an empty paragraph that starts a page/,
    ],
    ['lets a kept block split', () => rewritten(DOCUMENT, '<w:keepNext/><w:keepLines/>', '<w:keepLines/>'), /'Kept one' is not kept with what follows it/],
    [
      'runs two tables into one',
      () => rewritten(DOCUMENT, `</w:tbl>${HAND_SEPARATOR}<w:tbl><w:tblPr><w:tblW w:w="600"`, '</w:tbl><w:tbl><w:tblPr><w:tblW w:w="600"'),
      /two tables with no paragraph a point tall between them/,
    ],
    ['is on another paper', () => rewritten(DOCUMENT, '<w:pgSz w:w="11906" w:h="16838"/>', '<w:pgSz w:w="12240" w:h="15840"/>'), /the paper is 612 × 792 pt/],
    [
      'is turned',
      () => rewritten(DOCUMENT, '<w:pgSz w:w="11906" w:h="16838"/>', '<w:pgSz w:w="11906" w:h="16838" w:orient="landscape"/>'),
      /the page is landscape/,
    ],
    ['has another margin', () => rewritten(DOCUMENT, 'w:left="1000"', 'w:left="1100"'), /the left margin is 55 pt/],
    ['moves the header off its margin', () => rewritten(DOCUMENT, 'w:header="1000"', 'w:header="708"'), /stands elsewhere than at its margin/],
    ['gives page 1 a header of its own', () => rewritten(DOCUMENT, '</w:sectPr>', '<w:titlePg/></w:sectPr>'), /page 1 has a header of its own in the file/],
    ['lost the page header', () => rewritten('word/header1.xml', '>Hand-written file<', '>Another file<'), /the run 'Hand-written file' is 'Another file'/],
    [
      'lost the gap between the header and the body',
      () =>
        rewritten(
          'word/header1.xml',
          '<w:p><w:pPr><w:spacing w:line="120" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>',
          '',
        ),
      /does not end with the gap to the body/,
    ],
    ['has another title', () => rewritten('docProps/core.xml', 'Hand &amp; &lt;written&gt;', 'Hand written'), /the title is 'Hand written'/],
    [
      'is dated by a clock',
      () => rewritten('docProps/core.xml', '2026-01-01T00:00:00Z', '2026-11-17T10:00:00Z'),
      /the creation date is '2026-11-17T10:00:00Z'/,
    ],
    [
      'names a family its font table lacks',
      () => rewritten('word/fontTable.xml', 'w:name="Roboto"', 'w:name="Arial"'),
      /the family Roboto is named by a run and missing from the font table/,
    ],
  ])('%s', async (_name, parts, problem) => {
    expect((await problems(parts())).join('\n')).toMatch(problem)
  })

  // A file that holds more than its document is no better than one that holds less.
  test('holds a paragraph the document does not', async () => {
    const parts = rewritten(DOCUMENT, '<w:sectPr>', `${HAND_SEPARATOR}<w:sectPr>`)
    expect((await problems(parts)).join('\n')).toMatch(/body holds 1 paragraphs or tables more than its blocks state/)
  })
})

/** The hand-written file's fixture with its document's body changed by `change`, a block at a time. */
const changed = (change: (block: Block, index: number) => Block): Fixture => {
  const document = { ...HAND_DOCUMENT, body: HAND_DOCUMENT.body.map(change) }
  return { ...HAND, document, expect: expectation(document, { maxPagesExpected: 2 }) }
}

describe('the line ending that ends a text', () => {
  const LAST = HAND_DOCUMENT.body.length - 1
  /** The document with a line feed at the end of its last paragraph and of the cell ROW-1. */
  const ended = changed((block, index) =>
    index === LAST
      ? { kind: 'paragraph', runs: [{ text: 'After the break\n' }] }
      : block.kind === 'table'
        ? { ...block, rows: block.rows.map((row) => (row.cells[0] === 'ROW-1' ? { ...row, cells: ['ROW-1\r\n', '1.00'] } : row)) }
        : block,
  )

  // pdfmake ends its last line at such an ending and opens none after it: a check that asked for a break there would ask for a line the PDF does not print.
  test('is no break of the file, in a paragraph and in a cell', async () => {
    expect(await problems(handParts(), ended)).toEqual([])
  })

  // The other way round: a writer that wrote the break would print a line more than the PDF, with every word in place.
  test.each([
    ['a paragraph', 'After the break</w:t>', /the run 'After the break' is 'After the break\n'/],
    ['a cell', 'ROW-1</w:t>', /row 1, column 1, prints 'ROW-1\n' where the table states/],
  ])('written as a break in %s is said', async (_name, from, problem) => {
    expect((await problems(rewritten(DOCUMENT, from, `${from}<w:br/>`), ended)).join('\n')).toMatch(problem)
  })

  // Only the one that ends the text: a line ending inside it is a line the PDF prints, and the file's break.
  test('inside a text is still a break', async () => {
    const inside = changed((block, index) => (index === LAST ? { kind: 'paragraph', runs: [{ text: 'After\nthe break' }] } : block))
    expect((await problems(handParts(), inside)).join('\n')).toMatch(/the run 'After\nthe break' is 'After the break'/)
    expect(await problems(rewritten(DOCUMENT, '>After the break<', '>After</w:t><w:br/><w:t xml:space="preserve">the break<'), inside)).toEqual([])
  })
})

describe('a keep-together block that ends in a table', () => {
  /** The document with its columns block kept together. */
  const kept = changed((block) => (block.kind === 'columns' ? { kind: 'keepTogether', blocks: [block] } : block))
  const cell = (width: number): string => `<w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p><w:pPr>`
  /** Where the columns block's table starts, after the paragraph that keeps it apart from the table before it: the one table of that width with no padding. */
  const START = '<w:tbl><w:tblPr><w:tblW w:w="9906" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0"'
  /**
   * The file with that block marked: the paragraph before its table, which the block holds, kept with the table and its lines kept; its one row
   * whole; the lines of its two paragraphs kept; and its left paragraph marked as `left` says.
   */
  const file = (left: string): Map<string, string | Uint8Array> => {
    const between = rewritten(DOCUMENT, `${HAND_SEPARATOR}${START}`, `${HAND_SEPARATOR.replace('<w:pPr>', '<w:pPr><w:keepNext/><w:keepLines/>')}${START}`)
    const whole = rewritten(DOCUMENT, '<w:tr><w:tc><w:tcPr><w:tcW w:w="4000"', '<w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="4000"', between)
    return rewritten(DOCUMENT, cell(5906), `${cell(5906)}<w:keepLines/>`, rewritten(DOCUMENT, cell(4000), `${cell(4000)}${left}`, whole))
  }

  // A row is kept with the next by every paragraph of it: the row that ends the block is kept with nothing after the block, in every cell.
  test('marks no paragraph of its last row as kept with the next', async () => {
    expect(await problems(file('<w:keepLines/>'), kept)).toEqual([])
  })

  // "Every paragraph but the last" would mark the row's first cell and not its second: a row half kept with what follows the block.
  test('with its last row kept in one cell and not the other is said', async () => {
    expect((await problems(file('<w:keepNext/><w:keepLines/>'), kept)).join('\n')).toMatch(/'Left' is kept with what follows it/)
  })
})

describe('wordRefusal derives', () => {
  const body = (...blocks: readonly Block[]): ResolvedDocument => ({ ...HAND_DOCUMENT, body: blocks })
  const image = (asset: Image['asset'], fit: Image['fit'] = 'contain', width = 40, height = 40): Image => ({ kind: 'image', asset, width, height, fit })
  const svg = { id: 'mark', mediaType: 'image/svg+xml', bytes: SVG_MARK } as const
  const kind = (id: string): Image['asset'] =>
    [...IMAGE_KINDS, ...UNSEEN_JPEGS].find((asset) => asset.id === id) ??
    (() => {
      throw new Error(`no image kind ${id}`)
    })()
  const chart = CHART_FIXTURES[0]!.document.body.find((block) => block.kind === 'chart')!

  // A document the writer writes owes no refusal: one derived for it would refuse every report.
  test('none for a document of what a Word file holds', () => {
    expect(wordRefusal(HAND_DOCUMENT)).toBeUndefined()
  })

  // Each is a block or a part record 0068 gives to the PDF, or that nobody has seen Word print: named, so that a refusal for another reason is not taken for it.
  test.each<[string, ResolvedDocument, { code: string; subject: string }]>([
    ['a payment part', { ...HAND_DOCUMENT, paymentPart: {} as NonNullable<ResolvedDocument['paymentPart']> }, { code: 'unsupported', subject: 'paymentPart' }],
    ['an e-invoice', { ...HAND_DOCUMENT, eInvoice: {} as NonNullable<ResolvedDocument['eInvoice']> }, { code: 'unsupported', subject: 'eInvoice' }],
    [
      'the payment part before a chart in the body',
      { ...body(chart), paymentPart: {} as NonNullable<ResolvedDocument['paymentPart']> },
      { code: 'unsupported', subject: 'paymentPart' },
    ],
    [
      'a preview labelled as lacking data',
      { ...HAND_DOCUMENT, pageHeader: [{ kind: 'paragraph', runs: [{ text: PREVIEW_LABEL }] }] },
      { code: 'unsupported', subject: 'pageHeader' },
    ],
    [
      "an e-invoice's preview",
      { ...HAND_DOCUMENT, pageHeader: [{ kind: 'paragraph', runs: [{ text: E_INVOICE_PREVIEW_LABEL }] }] },
      { code: 'unsupported', subject: 'pageHeader' },
    ],
    [
      'a table in a framed section',
      body({ kind: 'section', padding: 4, blocks: [{ kind: 'table', id: 'boxed', columns: [], header: [], rows: [], emptyText: '' }] }),
      { code: 'unsupported', subject: 'boxed' },
    ],
    [
      'a page break in a framed section',
      body({ kind: 'section', fill: '#eeeeee', blocks: [{ kind: 'pageBreak' }] }),
      { code: 'unsupported', subject: 'body[0].blocks[0]' },
    ],
    ['a JPEG its Exif block turns', body(image(kind('jpeg-turned'))), { code: 'unsupported', subject: 'jpeg-turned' }],
    ['a JPEG of four components', body(image(kind('jpeg-cmyk'))), { code: 'unsupported', subject: 'jpeg-cmyk' }],
    ['an SVG that covers a box of other proportions', body(image(svg, 'cover', 80, 40)), { code: 'unsupported', subject: 'mark' }],
    // A picture's bytes are read once every block has been walked, as the PDF renderer reads them: a table in a frame is met first, wherever the picture stands.
    [
      'a table in a framed section after a JPEG its Exif block turns',
      body(image(kind('jpeg-turned')), {
        kind: 'section',
        padding: 4,
        blocks: [{ kind: 'table', id: 'boxed', columns: [], header: [], rows: [], emptyText: '' }],
      }),
      { code: 'unsupported', subject: 'boxed' },
    ],
    // A chart owes no refusal since 0076, so the picture after it is what the file is refused for.
    ['a turned JPEG after a chart', body(chart, image(kind('jpeg-turned'))), { code: 'unsupported', subject: 'jpeg-turned' }],
    [
      'a turned JPEG in a column before one of four components',
      body({ kind: 'columns', columns: [{ width: 'fill', blocks: [image(kind('jpeg-turned'))] }] }, image(kind('jpeg-cmyk'))),
      { code: 'unsupported', subject: 'jpeg-turned' },
    ],
  ])('%s', (_name, document, refusal) => {
    expect(wordRefusal(document)).toEqual(refusal)
  })

  // What a Word file holds as well as the PDF does owes no refusal: a table in a section that only groups, an SVG that covers its own proportions, an upright JPEG, a code.
  test.each<[string, ResolvedDocument]>([
    [
      'a table in a section with no frame',
      body({ kind: 'section', blocks: [{ kind: 'table', id: 'plain', columns: [], header: [], rows: [], emptyText: '' }] }),
    ],
    ['an SVG that covers a box of its own proportions', body(image(svg, 'cover', 40, 40))],
    ['an SVG contained in a box of other proportions', body(image(svg, 'contain', 80, 40))],
    ['a JPEG that is upright', body(image(kind('jpeg-colour')))],
    // A code is the writer's to draw since 0074: what refuses one is the rules below both engines, and no reading of what a Word file holds.
    ['a QR code', body({ kind: 'qrCode', id: 'code', text: 'x', size: 60, errorCorrection: 'M' })],
    ['an EPC QR code in a column', body({ kind: 'columns', columns: [{ width: 'fill', blocks: [{ kind: 'epcQrCode', id: 'pay', payload: 'x', size: 60 }] }] })],
    // A chart is Word's own since 0076: what refuses one is what any engine refuses of its block, and no reading of what a Word file holds.
    ['a chart', body(chart)],
    ['a chart in a framed section', body({ kind: 'section', padding: 4, blocks: [chart] })],
  ])('none for %s', (_name, document) => {
    expect(wordRefusal(document)).toBeUndefined()
  })
})

// The fixture's own expectation is what a file is held to: a stated key the file lacks is found by the keys, not by the walk.
test('verifyDocx holds a file to what its fixture states beside what its document implies', async () => {
  const stated: Fixture = { ...HAND, expect: expectation(HAND_DOCUMENT, { maxPagesExpected: 2, exactText: ['Nowhere in the file'], keys: ['ROW-2', 'ROW-1'] }) }
  expect(await problems(handParts(), stated)).toEqual(["the key 'ROW-1' is printed before the key it follows", "'Nowhere in the file' is on no line"])
})
