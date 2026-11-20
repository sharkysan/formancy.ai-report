import { describe, expect, test } from 'vitest'
import type { DocxParagraph, DocxTable } from './model.js'
import { readDocx } from './read.js'
import { handCodeParts } from './testing/hand-codes.js'
import { HAND_PNG, HAND_SEPARATOR, handDocx, handParts, rewritten, zipOf } from './testing/hand.js'
import { readZip } from './zip.js'

/**
 * The corpus's reader of Word files, proved on files written by hand in
 * `testing/hand.ts` and zipped by Node's zlib, never by the writer the
 * reader is there to check (0068). Each refusal is a file the writer must
 * never produce: a reader that took it would let a writer's mistake pass
 * every test built on it.
 */

const text = (paragraph: DocxParagraph): string => paragraph.runs.map((run) => (run.kind === 'text' ? run.text : `{${run.kind}}`)).join('')

describe('readDocx reads the hand-written file', () => {
  const docx = readDocx(handDocx())

  // A reader that lost a paragraph, a run or a cell would make every check built on it pass a file that lost it too.
  test('every paragraph and table of the body, in order', () => {
    expect(docx.body.map((block) => (block.kind === 'paragraph' ? text(block) : `table of ${block.rows.length}`))).toEqual([
      'Heading',
      'CO2 rises & <falls> ',
      '{picture}',
      '',
      '',
      'table of 5',
      '',
      'table of 1',
      '',
      'table of 1',
      '',
      'table of 1',
      'Kept one',
      'Kept two',
      '',
      'After the break',
    ])
  })

  // What a run states is what a check compares with the document's style: a property read wrongly is a style never checked.
  test("a run's own family, size, weight, slant, colour and place against the line", () => {
    const [heading, formula] = docx.body as DocxParagraph[]
    expect(heading!.runs[0]!.props).toEqual({ family: 'Roboto', bold: true, italic: false, color: '#000000', size: 14 })
    expect(formula!.runs.map((run) => run.props.shift)).toEqual([undefined, 'subscript', undefined])
    expect(formula!.runs[1]!.props).toEqual({ family: 'Roboto', bold: false, italic: true, color: '#336699', size: 10, shift: 'subscript' })
    expect(formula!.align).toBe('right')
    expect(heading!.keepNext).toBe(true)
  })

  // A run that ends in a space is the commonest run a report has; the escaped text is the text, not its markup.
  test('text with its spaces and its escaped characters as the text it is', () => {
    expect(text(docx.body[1] as DocxParagraph)).toBe('CO2 rises & <falls> ')
    expect(docx.title).toBe('Hand & <written>')
  })

  // The picture's bytes are the asset's: a reader that returned another part's would prove the wrong picture.
  test('a picture with its extent, its place and the very bytes of its part', () => {
    const paragraph = docx.body[2] as DocxParagraph
    const run = paragraph.runs[0]!
    expect(run.kind === 'picture' && { ...run.picture, part: run.picture.part.name }).toEqual({
      id: 1,
      name: 'Picture 1',
      width: 20,
      height: 20,
      part: 'word/media/image1.png',
    })
    expect(run.kind === 'picture' && run.picture.part.bytes).toEqual(HAND_PNG)
    expect(paragraph.indent).toBe(10)
  })

  // A rule is a border and a spacer a line: read as plain empty paragraphs, two rules and a lost spacer would look alike.
  test('a rule as the line under and between, a spacer as a line of exact height, a page break as one', () => {
    const [, , , rule, spacer] = docx.body as DocxParagraph[]
    expect(rule).toMatchObject({
      bottom: { weight: 1, color: '#999999' },
      between: { weight: 1, color: '#999999' },
      after: 3,
      line: { height: 3, rule: 'exact' },
    })
    expect(spacer).toMatchObject({ runs: [], line: { height: 12, rule: 'exact' } })
    expect((docx.body[14] as DocxParagraph).pageBreakBefore).toBe(true)
  })

  // The marks Word repeats a header and keeps rows by are the whole of what a file says about pages.
  test("a table's grid, its rows' marks, its cells and their spans", () => {
    const table = docx.body[5] as DocxTable
    expect(table.grid).toEqual([100, 395.3])
    expect(table.rows.map((row) => [row.header, row.cantSplit, row.cells.map((cell) => cell.span)])).toEqual([
      [true, true, [1, 1]],
      [false, true, [2]],
      [false, true, [1, 1]],
      [false, true, [1, 1]],
      [false, true, [1, 1]],
    ])
    expect(table.borders).toEqual({
      top: { weight: 0.5, color: '#bfbfbf' },
      bottom: { weight: 0.5, color: '#bfbfbf' },
      insideH: { weight: 0.5, color: '#bfbfbf' },
    })
    expect(table.margins).toEqual({ top: 2, left: 4, bottom: 2, right: 4 })
    expect(table.rows[0]!.cells[0]!.borders).toEqual({ bottom: { weight: 0.5, color: '#000000' } })
    expect(table.rows.map((row) => (row.cells[0]!.blocks[0] as DocxParagraph).keepNext)).toEqual([true, true, true, true, false])
  })

  // A rectangle's size and paints and a section's frame are a cell's: its height, its borders, its fill.
  test('a cell of exact height with its borders and its fill', () => {
    const rectangle = docx.body[7] as DocxTable
    expect(rectangle.rows[0]!.height).toEqual({ value: 10, rule: 'exact' })
    expect(rectangle.rows[0]!.cells[0]).toMatchObject({ width: 30, shade: '#ffcc00', borders: { top: { weight: 0.5, color: '#000000' } } })
    expect((docx.body[11] as DocxTable).margins).toEqual({ top: 6, left: 6, bottom: 6, right: 6 })
  })

  // The regions are parts of their own, found by the kind of their reference: a footer read as a header would pass a file with both swapped.
  test('the header and the footer by the kind of their reference, the fields as fields', () => {
    expect(docx.header?.part).toBe('word/header1.xml')
    expect(docx.footer?.part).toBe('word/footer1.xml')
    expect(docx.firstHeader).toBeUndefined()
    expect(docx.footer!.blocks.map((block) => text(block as DocxParagraph))).toEqual(['', 'Page {field} of {field}'])
    expect((docx.footer!.blocks[1] as DocxParagraph).runs.flatMap((run) => (run.kind === 'field' ? [run.field] : []))).toEqual(['PAGE', 'NUMPAGES'])
  })

  // The page is the section's: read in points, as the document states it.
  test("the section's page, the defaults, the font table, the mode and the core properties", () => {
    expect(docx.page).toEqual({
      width: 595.3,
      height: 841.9,
      orientation: 'portrait',
      margins: { top: 50, right: 50, bottom: 50, left: 50 },
      header: 50,
      footer: 50,
      titlePage: false,
    })
    expect(docx.defaults).toEqual({ run: { family: 'Roboto', bold: false, italic: false, size: 10 }, before: 0, after: 0, line: { height: 1, rule: 'auto' } })
    expect(docx.fonts).toEqual([{ name: 'Roboto', family: 'swiss', pitch: 'variable' }])
    expect(docx.compatibilityMode).toBe('15')
    expect(docx.created).toBe('2026-01-01T00:00:00Z')
  })
})

describe('readZip refuses', () => {
  const file = { name: 'a.txt', bytes: 'the same bytes, twice over, the same bytes' }

  // The reader's own reading of a deflated and a stored entry, against Node's zlib.
  test('nothing of an archive of a stored and a deflated entry', () => {
    const read = readZip(zipOf([file, { name: 'b/c.bin', bytes: new Uint8Array([1, 2, 3]), stored: true }]))
    expect(read.map(({ name, method, bytes }) => [name, method, bytes.length])).toEqual([
      ['a.txt', 'deflated', 42],
      ['b/c.bin', 'stored', 3],
    ])
  })

  // Each is a file a clock, a second writer or a careless one would produce: the same document would give other bytes, or a part would shadow another.
  test.each([
    ['an entry dated by a clock', zipOf([{ ...file, date: 0x5b71, time: 0x4a00 }]), /dated otherwise than 1 January 1980/],
    ['an entry dated a second past the epoch', zipOf([{ ...file, time: 1 }]), /dated otherwise/],
    ['a name twice', zipOf([file, file]), /holds a\.txt twice/],
    ['a name that climbs out', zipOf([{ ...file, name: '../a.txt' }]), /no path inside it/],
    ['a name with a backslash', zipOf([{ ...file, name: 'word\\a.txt' }]), /no path inside it/],
    ['a folder of its own', zipOf([{ ...file, name: 'word/' }]), /no path inside it/],
    ['an encrypted entry', zipOf([{ ...file, flags: 1 }]), /is encrypted/],
    ['an entry with a data descriptor', zipOf([{ ...file, flags: 8 }]), /data descriptor/],
    ['an entry that does not sum to its CRC-32', zipOf([{ ...file, crc: 1 }]), /does not sum to its CRC-32/],
    ['an archive with a comment after its directory', zipOf([file], 'a comment'), /does not end with its directory/],
    ['an archive cut off', zipOf([file]).subarray(0, 60), /does not end with its directory/],
    ['no archive at all', new Uint8Array(4), /does not end with its directory/],
  ])('%s', (_name, bytes, message) => {
    expect(() => readZip(bytes)).toThrow(message)
  })

  // Data that inflates to more than the directory promises is a bomb, or another file's data.
  test('an entry whose data is not what the directory says', () => {
    const bytes = zipOf([file])
    // The uncompressed size, in the local header and the directory: one byte short.
    const view = new DataView(bytes.buffer)
    view.setUint32(22, 41, true)
    view.setUint32(bytes.length - 22 - 46 - 5 + 24, 41, true)
    expect(() => readZip(bytes)).toThrow(/does not inflate to the 41 bytes/)
  })
})

describe('readDocx refuses', () => {
  const document = 'word/document.xml'
  const refused =
    (parts: ReadonlyMap<string, string | Uint8Array>): (() => unknown) =>
    () =>
      readDocx(handDocx(parts))

  // The writer writes a closed vocabulary; anything else is a file nobody decided to write.
  test.each([
    [
      'an element the vocabulary does not hold',
      rewritten(document, '<w:keepNext/><w:keepLines/>', '<w:keepNext/><w:keepLines/><w:widowControl/>'),
      /widowControl.*does not hold/,
    ],
    [
      'an attribute the vocabulary does not hold',
      rewritten(document, '<w:pageBreakBefore/>', '<w:pageBreakBefore w:val="0"/>'),
      /attribute .*val on .*pageBreakBefore/,
    ],
    [
      "a paragraph's properties out of ECMA-376's order",
      rewritten(document, '<w:pageBreakBefore/><w:spacing w:line="20" w:lineRule="exact"/>', '<w:spacing w:line="20" w:lineRule="exact"/><w:pageBreakBefore/>'),
      /pageBreakBefore out of its order/,
    ],
    [
      "a table's properties out of order",
      rewritten(document, '<w:tblW w:w="600" w:type="dxa"/><w:tblLayout w:type="fixed"/>', '<w:tblLayout w:type="fixed"/><w:tblW w:w="600" w:type="dxa"/>'),
      /tblW out of its order/,
    ],
    [
      "a run's properties out of order",
      rewritten(document, '<w:b/><w:color w:val="000000"/><w:sz w:val="28"/>', '<w:color w:val="000000"/><w:b/><w:sz w:val="28"/>'),
      /}b out of its order/,
    ],
    [
      'a second of an element that stands once',
      rewritten(document, '<w:pageBreakBefore/>', '<w:pageBreakBefore/><w:pageBreakBefore/>'),
      /a second .*pageBreakBefore/,
    ],
    ['text where an element holds none', rewritten(document, '<w:body>', '<w:body>stray'), /text inside .*body/],
    ['XML that is not well-formed', rewritten(document, '</w:body>', ''), /word\/document\.xml: /],
    ['a document type', rewritten(document, '<w:document ', '<!DOCTYPE w:document [<!ENTITY e "x">]><w:document '), /word\/document\.xml: /],
    ['a processing instruction', rewritten(document, '<w:body>', '<?mso-application progid="Word.Document"?><w:body>'), /processing instruction/],
  ])('%s', (_name, parts, message) => {
    expect(refused(parts)).toThrow(message)
  })

  // A relationship is how a file reaches outside itself, or carries what nothing shows.
  test.each([
    [
      'a relationship to an address',
      rewritten('word/_rels/document.xml.rels', 'Target="media/image1.png"/>', 'Target="https://example.com/image1.png" TargetMode="External"/>'),
      /leads outside the package/,
    ],
    ['a relationship to no part', rewritten('word/_rels/document.xml.rels', 'Target="media/image1.png"', 'Target="media/image2.png"'), /leads to no part/],
    [
      'a relationship that climbs out of the package',
      rewritten('word/_rels/document.xml.rels', 'Target="media/image1.png"', 'Target="../../image1.png"'),
      /leads to no part/,
    ],
    ['a part no relationship reaches', new Map(handParts()).set('word/media/image2.png', HAND_PNG), /image2\.png is reached by no relationship/],
    ['a part with no content type', new Map(handParts()).set('word/extra.bin', 'x'), /extra\.bin has no content type/],
    [
      'a relationship nothing in its part uses',
      rewritten(
        'word/_rels/document.xml.rels',
        '</Relationships>',
        '<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>',
      ),
      /rId7 is used by nothing/,
    ],
    [
      'a relationship of a type a file does not hold',
      rewritten('word/_rels/document.xml.rels', 'relationships/image"', 'relationships/hyperlink"'),
      /rId6 is used as a image and is none|of a type a file does not hold/,
    ],
    ['an id used twice in one part', rewritten('word/_rels/document.xml.rels', 'Id="rId6"', 'Id="rId5"'), /holds the relationship rId5 twice/],
  ])('%s', (_name, parts, message) => {
    expect(refused(parts)).toThrow(message)
  })

  // What Word would run, strip or lay out otherwise than the file's writer meant.
  test.each([
    ['a field other than PAGE and NUMPAGES', rewritten('word/footer1.xml', ' NUMPAGES ', ' INCLUDETEXT "c:\\\\secret.txt" '), /the field 'INCLUDETEXT/],
    [
      'a field that never ends',
      rewritten('word/footer1.xml', '<w:fldChar w:fldCharType="end"/></w:r></w:p>', '<w:fldChar w:fldCharType="begin"/></w:r></w:p>'),
      /a field/,
    ],
    ['text whose spaces Word would strip', rewritten(document, '<w:t xml:space="preserve">CO</w:t>', '<w:t>CO</w:t>'), /without xml:space="preserve"/],
    [
      'a cell that does not end with a paragraph',
      rewritten(
        document,
        `<w:shd w:val="clear" w:color="auto" w:fill="FFCC00"/></w:tcPr>${HAND_SEPARATOR}`,
        '<w:shd w:val="clear" w:color="auto" w:fill="FFCC00"/></w:tcPr>',
      ),
      /a cell that does not end with a paragraph/,
    ],
    [
      'a table that is not of fixed layout',
      rewritten(document, '<w:tblW w:w="600" w:type="dxa"/><w:tblLayout w:type="fixed"/>', '<w:tblW w:w="600" w:type="dxa"/><w:tblLayout w:type="autofit"/>'),
      /not of fixed layout/,
    ],
    ['a row whose cells do not fill the grid', rewritten(document, '<w:gridSpan w:val="2"/>', ''), /do not fill its grid/],
    ['a width in another unit', rewritten(document, '<w:tblW w:w="600" w:type="dxa"/>', '<w:tblW w:w="600" w:type="pct"/>'), /another unit/],
    [
      'a border that is no single line',
      rewritten(document, '<w:top w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>', '<w:top w:val="double" w:sz="4" w:space="0" w:color="BFBFBF"/>'),
      /no single line/,
    ],
    [
      'a size that is no whole number',
      rewritten(document, '<w:spacing w:line="240" w:lineRule="exact"/>', '<w:spacing w:line="240.5" w:lineRule="exact"/>'),
      /no whole number/,
    ],
    [
      'font slots that name different families',
      rewritten(
        'word/header1.xml',
        'w:hAnsi="Roboto" w:eastAsia="Roboto" w:cs="Roboto"/><w:color',
        'w:hAnsi="Arial" w:eastAsia="Roboto" w:cs="Roboto"/><w:color',
      ),
      /otherwise than alike/,
    ],
    [
      'a header for even pages',
      rewritten(document, '<w:headerReference w:type="default"', '<w:headerReference w:type="even"'),
      /other than the first and the rest/,
    ],
    [
      'a picture whose shape is another size than its extent',
      rewritten(document, '<a:ext cx="254000" cy="254000"/>', '<a:ext cx="254000" cy="127000"/>'),
      /another size than its extent/,
    ],
  ])('%s', (_name, parts, message) => {
    expect(refused(parts)).toThrow(message)
  })

  // The package's own shape: one main document of the right kind.
  test('a package whose main document is of another content type', () => {
    expect(refused(rewritten('[Content_Types].xml', 'document.main+xml', 'template.main+xml'))).toThrow(/main document is of another content type/)
  })

  // An EPC QR code's caption reads from bottom to top (0074), and that is the one way a file turns a cell: turned any other way, the caption
  // would read down the page, or be read by a check as though it read up it.
  test('a cell whose text is turned otherwise than from bottom to top, which it reads as such', () => {
    const frame = readDocx(handDocx(handCodeParts())).body.find((block): block is DocxTable => block.kind === 'table')!
    expect(frame.rows[0]!.cells.map((cell) => cell.direction)).toEqual([undefined, 'btLr'])
    const down = rewritten('word/document.xml', '<w:textDirection w:val="btLr"/>', '<w:textDirection w:val="tbRl"/>', handCodeParts())
    expect(refused(down)).toThrow(/a cell whose text is turned 'tbRl', where a file turns one from bottom to top alone/)
  })
})
