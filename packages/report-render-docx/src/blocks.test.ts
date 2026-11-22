import {
  TITLES_FROM_GROUPS_DATA,
  TITLES_FROM_GROUPS_REPORT,
  verifyDocx,
  type Docx,
  type DocxBlock,
  type DocxParagraph,
  type DocxTable,
} from '@formancy/report-corpus'
import { resolveReport, type Block, type ResolvedDocument, type Table } from '@formancy/report-runtime'
import { afterEach, describe, expect, test } from 'vitest'
import { HEADER_RULE, OUTLINE, PADDING_X, PADDING_Y, REGION_GAP, ROW_RULE, RULE, RULE_GAP } from './look.js'
import { CREATED, documentOf, fixtureOf, paragraph, written } from './testing/support.js'

/**
 * Each block of a resolved document as the Word file states it (0068),
 * on the file: read back by the corpus's reader, held whole by the
 * corpus's check, and here to the things record 0068's table says of
 * each block -- which a file can lose with every word still in it. What
 * the document leaves to an engine (`look.ts`) is held to the constant,
 * so that a change of one is a change someone made.
 */

/**
 * `document` written and read back, the corpus's check having nothing to
 * say against the file. The check is waited for, since what a scanner
 * reads in a code's picture is (0074): asked here, and held once the case
 * that asked has run.
 */
const checks: Promise<void>[] = []
function file(document: ResolvedDocument): Docx {
  const docx = written(document)
  checks.push(verifyDocx(fixtureOf('blocks', document), docx).then((problems) => expect(problems).toEqual([])))
  return docx
}
afterEach(async () => {
  await Promise.all(checks.splice(0))
})

const body = (...blocks: readonly Block[]): DocxBlock[] => [...file(documentOf(blocks)).body]
const words = (block: DocxBlock | undefined): string =>
  block?.kind === 'paragraph' ? block.runs.map((run) => (run.kind === 'text' ? run.text : `{${run.kind}}`)).join('') : `table of ${block?.rows.length ?? 0}`
const table = (more: Partial<Table> = {}): Table => ({
  kind: 'table',
  id: 'lines',
  columns: [
    { width: 100, align: 'left' },
    { width: 'fill', align: 'right' },
  ],
  header: ['Key', 'Amount'],
  rows: [
    { kind: 'detail', cells: ['ROW-1', '1.00'] },
    { kind: 'detail', cells: ['ROW-2', '2.00'] },
  ],
  emptyText: 'No records',
  ...more,
})
/** Whether each row is kept with the row after it: every paragraph of its cells marked so. */
const keptRows = (node: DocxTable): boolean[] =>
  node.rows.map((row) => row.cells.every((cell) => (cell.blocks as DocxParagraph[]).every((each) => each.keepNext)))

describe('a rule', () => {
  // ECMA-376 has Word draw, between two paragraphs of the same borders, the line between them alone (Part 1, 17.3.1.7): a rule that stated
  // only the line under it would print one line where a report draws two, a total's double rule among them.
  test('states the line under it and between it and a rule like it, so that two equal rules are two lines', () => {
    const [first, second] = body({ kind: 'rule', thickness: 1 }, { kind: 'rule', thickness: 1 }) as DocxParagraph[]
    for (const rule of [first!, second!]) {
      expect(rule.bottom).toEqual({ weight: 1, color: '#000000' })
      expect(rule.between).toEqual(rule.bottom)
    }
  })

  // The PDF's rule takes its line and a gap above and below: an exact line as tall as the gap, the line under it, and the gap after.
  test('takes its line and the gap above and below it, in its weight and colour', () => {
    const [rule] = body({ kind: 'rule', thickness: 0.5, color: '#336699' }) as DocxParagraph[]
    expect(rule).toMatchObject({ runs: [], bottom: { weight: 0.5, color: '#336699' }, line: { height: RULE_GAP, rule: 'exact' }, after: RULE_GAP, before: 0 })
  })
})

describe('a spacer, a page break and a rectangle', () => {
  // Space is all a spacer is: at the line Word gives an empty paragraph by itself it would be a line of text tall, whatever the report asked for.
  test('a spacer is an empty paragraph whose line is exactly its height', () => {
    expect(body({ kind: 'spacer', height: 18 })[0]).toMatchObject({ kind: 'paragraph', runs: [], line: { height: 18, rule: 'exact' } })
  })

  // No exact line is none: a spacer of nothing, or of less than Word's unit, is written as nothing, never as a line of some least height.
  test.each([0, 0.02])('a spacer of %d points writes nothing', (height) => {
    expect(body(paragraph('above'), { kind: 'spacer', height }, paragraph('below')).map(words)).toEqual(['above', 'below'])
  })

  // The break is a mark on a paragraph of its own: on the block after it, that block would start a page wherever a person moved it to.
  test('a page break is an empty paragraph, a point tall, that starts a page', () => {
    const [, breaks, after] = body(paragraph('before'), { kind: 'pageBreak' }, paragraph('after')) as DocxParagraph[]
    expect(breaks).toMatchObject({ runs: [], pageBreakBefore: true, line: { height: 1, rule: 'exact' } })
    expect(after!.pageBreakBefore).toBe(false)
  })

  // A rectangle is a box of exactly its size: a row of exact height, filled as it is filled and outlined at the PDF's weight.
  test('a rectangle is a cell of exactly its size, filled and outlined as it states', () => {
    const [box] = body({ kind: 'rectangle', width: 30, height: 10, fill: '#ffcc00', stroke: '#112233' }) as DocxTable[]
    const outline = { weight: OUTLINE, color: '#112233' }
    expect(box).toMatchObject({ grid: [30], width: 30, margins: { top: 0, left: 0, bottom: 0, right: 0 } })
    expect(box!.rows[0]).toMatchObject({
      height: { value: 10, rule: 'exact' },
      cells: [{ shade: '#ffcc00', borders: { top: outline, left: outline, bottom: outline, right: outline } }],
    })
  })

  // As the PDF draws it: a box no taller than two outlines is all outline, in the outline's colour; one with neither paint is only space.
  test.each<[string, Block, string | undefined]>([
    ['too small to hold its outline', { kind: 'rectangle', width: 30, height: 1, fill: '#ffcc00', stroke: '#112233' }, '#112233'],
    ['filled and not outlined', { kind: 'rectangle', width: 30, height: 10, fill: '#ffcc00' }, '#ffcc00'],
    ['neither filled nor outlined', { kind: 'rectangle', width: 30, height: 10 }, undefined],
  ])('a rectangle %s has no border', (_name, block, shade) => {
    const cell = (body(block)[0] as DocxTable).rows[0]!.cells[0]!
    expect([cell.borders, cell.shade]).toEqual([{}, shade])
  })
})

describe('columns and sections', () => {
  // A cell is a column: fixed ones their width, a fill its share, with no border, no fill and no padding between them.
  test('a columns block is one row of a cell a column, at its widths, which may split across pages', () => {
    const [columns] = body({
      kind: 'columns',
      columns: [
        { width: 200, blocks: [paragraph('Left'), paragraph('Left again')] },
        { width: 'fill', blocks: [paragraph('Right')] },
      ],
    }) as DocxTable[]
    expect(columns).toMatchObject({ grid: [200, 295.3], borders: {}, margins: { top: 0, left: 0, bottom: 0, right: 0 } })
    expect(columns!.rows).toHaveLength(1)
    expect(columns!.rows[0]!.cantSplit).toBe(false)
    expect(columns!.rows[0]!.cells.map((cell) => cell.blocks.map(words))).toEqual([['Left', 'Left again'], ['Right']])
  })

  // WordprocessingML's readers expect a cell to end with a paragraph: an empty column, and one that ends with a box, are given one a point tall.
  test('a column that is empty, or ends with a table, ends with a paragraph a point tall', () => {
    const [columns] = body({
      kind: 'columns',
      columns: [
        { width: 'fill', blocks: [] },
        { width: 'fill', blocks: [{ kind: 'rectangle', width: 10, height: 10 }] },
      ],
    }) as DocxTable[]
    const [empty, boxed] = columns!.rows[0]!.cells
    expect(empty!.blocks).toMatchObject([{ runs: [], line: { height: 1, rule: 'exact' } }])
    expect(boxed!.blocks.map((block) => block.kind)).toEqual(['table', 'paragraph'])
  })

  // A Word file has no box but a table's cell: a frame lost on the way is a section that prints as its blocks alone, every word still there.
  test('a section with a frame is a cell with its border, its fill and its padding around its blocks', () => {
    const border = { weight: 1, color: '#1f4e79' }
    const [section] = body({
      kind: 'section',
      border: { thickness: 1, color: '#1f4e79' },
      fill: '#eef3f8',
      padding: 6,
      blocks: [paragraph('Framed')],
    }) as DocxTable[]
    expect(section).toMatchObject({ grid: [495.3], margins: { top: 6, left: 6, bottom: 6, right: 6 } })
    expect(section!.rows[0]!.cells[0]).toMatchObject({ shade: '#eef3f8', borders: { top: border, left: border, bottom: border, right: border } })
    expect(section!.rows[0]!.cells[0]!.blocks.map(words)).toEqual(['Framed'])
  })

  // A section adds no layout rule: without a frame it is its blocks, where it stands, and no table at all.
  test('a section without a frame is its blocks and nothing more', () => {
    expect(
      body(paragraph('above'), { kind: 'section', blocks: [paragraph('inside'), { kind: 'section', padding: 0, blocks: [paragraph('deeper')] }] }).map(words),
    ).toEqual(['above', 'inside', 'deeper'])
  })
})

describe('what is kept together', () => {
  const marks = (blocks: readonly DocxBlock[]): [string, boolean, boolean][] =>
    (blocks as DocxParagraph[]).filter((block) => block.kind === 'paragraph').map((block) => [words(block), block.keepNext, block.keepLines])
  /** Every paragraph of `blocks`, through every table's cells, in order. */
  const paragraphsIn = (blocks: readonly DocxBlock[]): DocxParagraph[] =>
    blocks.flatMap((block) => (block.kind === 'paragraph' ? [block] : block.rows.flatMap((row) => row.cells.flatMap((cell) => paragraphsIn(cell.blocks)))))

  // A summary that must stay on one page: every paragraph of it kept with the next, and its lines together, but the last, which is kept with nothing after the block.
  test('a keep-together block marks every paragraph but its last as kept with the next, and every one to keep its lines', () => {
    expect(marks(body({ kind: 'keepTogether', blocks: [paragraph('one'), { kind: 'spacer', height: 4 }, paragraph('two')] }, paragraph('after')))).toEqual([
      ['one', true, true],
      ['', true, true],
      ['two', false, true],
      ['after', false, false],
    ])
  })

  // A row that may split is a block that may: the marks on its paragraphs keep them with each other, and say nothing of the row they stand in.
  test("a columns block in a keep-together block may not split, nor a table's rows", () => {
    const [columns] = body({ kind: 'keepTogether', blocks: [{ kind: 'columns', columns: [{ width: 'fill', blocks: [paragraph('kept')] }] }] }) as DocxTable[]
    expect(columns!.rows[0]!.cantSplit).toBe(true)
  })

  // A row is kept with the next by every paragraph of it. "Every paragraph but the last" marked the last row's first cell and left its second:
  // a row half kept with what follows the block, which the block is not kept with at all.
  test('a keep-together block that ends in a table keeps every row but its last, and no cell of that one', () => {
    const read = body({ kind: 'keepTogether', blocks: [paragraph('Summary'), table()] }, paragraph('after'))
    expect(marks(read)).toEqual([
      ['Summary', true, true],
      ['after', false, false],
    ])
    const rows = (read[1] as DocxTable).rows
    expect(rows.map((row) => row.cells.map((cell) => (cell.blocks[0] as DocxParagraph).keepNext))).toEqual([
      [true, true],
      [true, true],
      [false, false],
    ])
    expect(rows.every((row) => row.cantSplit && row.cells.every((cell) => (cell.blocks[0] as DocxParagraph).keepLines))).toBe(true)
  })

  // The same of a columns block that ends one: its one row is whole by its own mark, and none of its paragraphs is kept with what follows the block.
  test('a keep-together block that ends in a columns block keeps no paragraph of it with the next', () => {
    const columns: Block = {
      kind: 'columns',
      columns: [
        { width: 'fill', blocks: [paragraph('left'), paragraph('below')] },
        { width: 'fill', blocks: [paragraph('right')] },
      ],
    }
    const read = body({ kind: 'keepTogether', blocks: [paragraph('Summary'), columns] }, paragraph('after'))
    const inside = (read[1] as DocxTable).rows[0]!.cells.flatMap((cell) => cell.blocks as DocxParagraph[])
    expect(inside.map((each) => [words(each), each.keepNext, each.keepLines])).toEqual([
      ['left', false, true],
      ['below', false, true],
      ['right', false, true],
    ])
    expect((read[0] as DocxParagraph).keepNext).toBe(true)
  })

  // Word keeps a paragraph with the paragraph after it and no further: a heading over a spacer and a rule would be kept with the spacer,
  // and the table it heads would start the next page. The PDF keeps it with what prints, so every paragraph between the two is marked.
  test('a heading is kept with the next block that prints, through the spacers and the rules between them', () => {
    const heading: Block = { ...paragraph('Heading'), keepWithNext: true }
    const read = body(heading, { kind: 'spacer', height: 6 }, { kind: 'rule', thickness: 1 }, paragraph('Text'), paragraph('More'))
    expect(marks(read)).toEqual([
      ['Heading', true, false],
      ['', true, false],
      ['', true, false],
      ['Text', false, false],
      ['More', false, false],
    ])
  })

  // A chapter's heading over a section's: marked one by one to the next paragraph alone, the first would be kept with the second and not with the text.
  test('a run of headings moves as one, to the block that prints after the last', () => {
    const kept = (text: string): Block => ({ ...paragraph(text), keepWithNext: true })
    expect(marks(body(kept('Chapter'), kept('Section'), paragraph('Text')))).toEqual([
      ['Chapter', true, false],
      ['Section', true, false],
      ['Text', false, false],
    ])
  })

  // A heading over a box and a table: the paragraph that keeps the two tables apart stands between it and what it heads, and is kept too.
  test('a heading is kept through a rectangle, and through the paragraph between two tables, to the table it heads', () => {
    const read = body({ ...paragraph('Heading'), keepWithNext: true }, { kind: 'rectangle', width: 10, height: 4 }, table())
    expect(read.map((block) => block.kind)).toEqual(['paragraph', 'table', 'paragraph', 'table', 'paragraph'])
    const inBox = (read[1] as DocxTable).rows[0]!.cells[0]!.blocks[0] as DocxParagraph
    expect([(read[0] as DocxParagraph).keepNext, inBox.keepNext, (read[2] as DocxParagraph).keepNext]).toEqual([true, true, true])
  })

  // A block that holds nothing ends with nothing: it writes no paragraph and marks none, and what stands around it is as it was.
  test('a keep-together block that holds nothing writes nothing and marks nothing', () => {
    expect(marks(body(paragraph('above'), { kind: 'keepTogether', blocks: [] }, paragraph('below')))).toEqual([
      ['above', false, false],
      ['below', false, false],
    ])
  })

  // What a heading is kept with is found inside a container as the PDF finds it: a kept block's first paragraph that prints, however deep.
  test('a heading over a keep-together block is kept with it', () => {
    const read = body(
      { ...paragraph('Heading'), keepWithNext: true },
      { kind: 'keepTogether', blocks: [paragraph('one'), paragraph('two')] },
      paragraph('after'),
    )
    expect(marks(read)).toEqual([
      ['Heading', true, false],
      ['one', true, true],
      ['two', false, true],
      ['after', false, false],
    ])
  })

  // A kept block and a framed section that print nothing are passed like a spacer, and every paragraph of them is between the heading and what it heads.
  test('a heading over a keep-together block and a section that print nothing is kept through both', () => {
    const read = body(
      { ...paragraph('Heading'), keepWithNext: true },
      { kind: 'keepTogether', blocks: [{ kind: 'spacer', height: 4 }] },
      { kind: 'section', padding: 2, blocks: [{ kind: 'rule', thickness: 1 }] },
      paragraph('Text'),
    )
    expect(paragraphsIn(read).map((each) => [words(each), each.keepNext])).toEqual([
      ['Heading', true],
      ['', true],
      ['', true],
      ['Text', false],
    ])
  })

  // A table prints its empty text only in place of detail rows. One of blank cells that has them prints nothing, and the PDF keeps a heading over it
  // with the block after it: counted as printing for an empty text it never prints, the table would end the heading's keep at its own first row.
  test('a heading over a table that prints nothing is kept through it, to the block that prints after it', () => {
    const blank = table({ header: ['', ''], rows: [{ kind: 'detail', cells: ['', ' '] }], emptyText: 'No records' })
    const read = body({ ...paragraph('Heading'), keepWithNext: true }, blank, paragraph('Text'))
    expect(keptRows(read[1] as DocxTable)).toEqual([true, true])
    expect(marks(read)).toEqual([
      ['Heading', true, false],
      ['Text', false, false],
    ])
    // The same table with no detail row prints its empty text, and is what the heading is kept with: its last row is kept with nothing.
    const empty = body({ ...paragraph('Heading'), keepWithNext: true }, table({ header: ['', ''], rows: [], emptyText: 'No records' }), paragraph('Text'))
    expect(keptRows(empty[1] as DocxTable)).toEqual([true, false])
  })

  // A heading over nothing is kept with nothing, as in the PDF: one before a page break would otherwise drag the break's paragraph with it.
  test.each<[string, readonly Block[]]>([
    ['at the end of its list', [paragraph('Text'), { ...paragraph('Heading'), keepWithNext: true }]],
    ['before a page break', [{ ...paragraph('Heading'), keepWithNext: true }, { kind: 'pageBreak' }, paragraph('Text')]],
    [
      'over nothing that prints',
      [
        { ...paragraph('Heading'), keepWithNext: true },
        { kind: 'spacer', height: 6 },
      ],
    ],
  ])('a heading %s is kept with nothing', (_name, blocks) => {
    expect(marks(body(...blocks)).every(([, next]) => !next)).toBe(true)
  })
})

describe('a table', () => {
  // Left to fit its words, Word would size the columns itself: the grid is the document's widths, and the look the engine's own (`look.ts`).
  test("is of fixed layout at its columns' widths, with the rules and the padding the PDF draws", () => {
    const [read] = body(table()) as DocxTable[]
    const rule = { weight: RULE, color: ROW_RULE }
    expect(read).toMatchObject({
      grid: [100, 395.3],
      borders: { top: rule, bottom: rule, insideH: rule },
      margins: { top: PADDING_Y, left: PADDING_X, bottom: PADDING_Y, right: PADDING_X },
    })
    expect(read!.rows[0]!.cells.map((cell) => cell.borders)).toEqual([
      { bottom: { weight: RULE, color: HEADER_RULE } },
      { bottom: { weight: RULE, color: HEADER_RULE } },
    ])
  })

  // The marks are all a file says about a table's pages: the one row Word repeats, and that no row splits.
  test('marks its header as the row to repeat, and every row not to split', () => {
    const [read] = body(table()) as DocxTable[]
    expect(read!.rows.map((row) => [row.header, row.cantSplit])).toEqual([
      [true, true],
      [false, true],
      [false, true],
    ])
  })

  // A quotation's subtotal, VAT and total stand on the page of the last line item, and the column header never ends a page alone.
  test('keeps its header with its first row, and its closing rows with the row before them', () => {
    const rows: Table['rows'] = [
      { kind: 'detail', cells: ['ROW-1', '1.00'] },
      { kind: 'detail', cells: ['ROW-2', '2.00'] },
      { kind: 'groupFooter', cells: ['Subtotal', '3.00'] },
      { kind: 'total', cells: ['VAT', '0.24'] },
      { kind: 'total', cells: ['Total', '3.24'] },
    ]
    expect(keptRows(body(table({ rows }))[0] as DocxTable)).toEqual([true, false, true, true, true, false])
  })

  // 0059: a group header stands with as many of its group's first rows as its row keeps, and with its first where it says none.
  test('keeps a group header with as many rows as it keeps, and with one where it says none', () => {
    const rows: Table['rows'] = [
      { kind: 'groupHeader', cells: ['Group A'], across: true, keepWithRows: 3 },
      { kind: 'detail', cells: ['ROW-1', '1.00'] },
      { kind: 'detail', cells: ['ROW-2', '2.00'] },
      { kind: 'detail', cells: ['ROW-3', '3.00'] },
      { kind: 'detail', cells: ['ROW-4', '4.00'] },
      { kind: 'groupHeader', cells: ['Group B'], across: true },
      { kind: 'detail', cells: ['ROW-5', '5.00'] },
      { kind: 'detail', cells: ['ROW-6', '6.00'] },
    ]
    //                                                  header  A     1     2     3      4      B     5      6
    expect(keptRows(body(table({ rows }))[0] as DocxTable)).toEqual([true, true, true, true, false, false, true, false, false])
  })

  // A group's name across the table, and "No records" under a header with nothing beneath it: each one cell wide, it would stand in the first column.
  test('prints a row across it as one cell that spans every column, and its empty text across it in place of detail rows', () => {
    const [read] = body(table({ rows: [{ kind: 'total', cells: ['Total', '0.00'] }] })) as DocxTable[]
    expect(read!.rows.map((row) => row.cells.map((cell) => [cell.span, words(cell.blocks[0])]))).toEqual([
      [
        [1, 'Key'],
        [1, 'Amount'],
      ],
      [[2, 'No records']],
      [
        [1, 'Total'],
        [1, '0.00'],
      ],
    ])
    // The totals that close an empty table stand with its empty text.
    expect(keptRows(read!)).toEqual([true, true, false])
  })

  // An empty cell is an empty paragraph of its row's size, as tall as a cell of text beside it: with no mark of its own it would be a line of the default size.
  test('writes an empty cell as an empty paragraph of its size', () => {
    const [read] = body(table({ rows: [{ kind: 'detail', cells: ['', '1.00'], style: { size: 7 } }] })) as DocxTable[]
    expect(read!.rows[1]!.cells[0]!.blocks).toMatchObject([{ runs: [], mark: { size: 7 } }])
  })

  // A table whose column titles come from its groups has no header row (0078): written as one, it is a row of nothing Word repeats on every
  // page, under the darker rule, as the PDF's band was. Its first row is its first, kept as a row is and not as a header, which is kept always.
  test('writes no header row for a table without one, marks no row to repeat, and keeps its first rows as rows', () => {
    const { header: _none, ...headerless } = table({
      rows: [
        { kind: 'groupHeader', cells: ['Parts: key and amount'], across: true },
        { kind: 'detail', cells: ['ROW-1', '1.00'] },
        { kind: 'detail', cells: ['ROW-2', '2.00'] },
        { kind: 'total', cells: ['Total', '3.00'] },
      ],
    })
    const [read] = body(headerless) as DocxTable[]
    expect(read!.rows.map((row) => [row.header, row.cantSplit, row.cells.map((cell) => words(cell.blocks[0])).join(' | ')])).toEqual([
      [false, true, 'Parts: key and amount'],
      [false, true, 'ROW-1 | 1.00'],
      [false, true, 'ROW-2 | 2.00'],
      [false, true, 'Total | 3.00'],
    ])
    expect(read!.rows.flatMap((row) => row.cells.map((cell) => cell.borders))).toEqual(read!.rows.flatMap((row) => row.cells.map(() => ({}))))
    expect(read).toMatchObject({ borders: { top: { weight: RULE, color: ROW_RULE }, insideH: { weight: RULE, color: ROW_RULE } } })
    expect(keptRows(read!)).toEqual([true, false, true, false])
    // With no detail row, its empty text is its first row, and the totals that close it stand with it.
    const [empty] = body({ ...headerless, rows: [{ kind: 'total', cells: ['Total', '0.00'] }] }) as DocxTable[]
    expect(empty!.rows.map((row) => [row.header, words(row.cells[0]!.blocks[0])])).toEqual([
      [false, 'No records'],
      [false, 'Total'],
    ])
    expect(keptRows(empty!)).toEqual([true, false])
  })

  // The corpus's check finds the row of nothing a table without a header row must not have (0078), held to that table's expectation: written
  // as the header row Word repeats, or as a plain row over the table. A check that passed either would pass the band this record took away.
  test('is held by the corpus to no header row: a blank one, marked to repeat or not, is found', async () => {
    const { header: _none, ...headerless } = table()
    const expected = fixtureOf('headerless', documentOf([headerless]))
    const marked = await verifyDocx(expected, written(documentOf([{ ...headerless, header: ['', ''] }])))
    expect(marked).toEqual(expect.arrayContaining(['table lines marks 1 of its rows as the row to repeat on every page, and has no header row']))
    const unmarked = await verifyDocx(expected, written(documentOf([{ ...headerless, rows: [{ kind: 'detail', cells: ['', ''] }, ...headerless.rows] }])))
    expect(unmarked).toEqual(expect.arrayContaining(['table lines holds 3 rows where the document has 2']))
  })

  // The case 0078 is for, as a person writes it, through the runtime: every column titled with nothing or a space and a group header that names
  // the columns. The file holds no header row, no row marked to repeat, and every row the document has, held by the corpus's check.
  test('writes a report whose column titles are empty, resolved by the runtime, with no header row', () => {
    const outcome = resolveReport(TITLES_FROM_GROUPS_REPORT, TITLES_FROM_GROUPS_DATA, { mode: 'final', creationDate: CREATED })
    if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path}`).join('; '))
    const read = body(...outcome.document.body).find((block): block is DocxTable => block.kind === 'table')
    expect(read?.rows.some((row) => row.header)).toBe(false)
    expect(words(read?.rows[0]?.cells[0]?.blocks[0])).toBe('Labour: number, item and amount')
  })

  // A table without a header row whose first rows are plain rows keeps none of them with the next: what a header is kept with is a header's,
  // and a first row marked so would drag every table's second row with it onto the next page.
  test('keeps no first row of a table without a header row for a header it does not have', () => {
    const { header: _none, ...headerless } = table()
    const [read] = body(headerless) as DocxTable[]
    expect(read!.rows.map((row) => row.header)).toEqual([false, false])
    expect(keptRows(read!)).toEqual([false, false])
  })

  // Two tables with nothing between them are one table to Word, and a body that ends in a table is one WordprocessingML's readers do not expect.
  test('after a table that ends the body stands a paragraph a point tall, and between two tables one', () => {
    expect(body(table(), table({ id: 'more', rows: [] })).map((block) => (block.kind === 'table' ? 'table' : block.line?.height))).toEqual([
      'table',
      1,
      'table',
      1,
    ])
  })
})

describe('the page and its regions', () => {
  const footer: Block = {
    kind: 'paragraph',
    runs: [{ text: 'Page ' }, { field: 'pageNumber' }, { text: ' of ' }, { field: 'pageCount' }],
    style: { size: 8, align: 'center' },
  }

  // The paper is the document's, turned where the document's is: a landscape report on a portrait page would lose its right-hand columns to Word's wrapping.
  test.each([
    ['A4 upright', { size: 'A4', orientation: 'portrait' }, [595.3, 841.9]],
    ['A4 on its side', { size: 'A4', orientation: 'landscape' }, [841.9, 595.3]],
    ['Letter upright', { size: 'Letter', orientation: 'portrait' }, [612, 792]],
    ['Letter on its side', { size: 'Letter', orientation: 'landscape' }, [792, 612]],
  ] as const)('%s is the paper the section states', (_name, setup, [width, height]) => {
    const page = { ...setup, margins: { top: 30, right: 40, bottom: 50, left: 60 } }
    expect(file(documentOf([paragraph('x')], { page })).page).toEqual({
      width,
      height,
      orientation: setup.orientation,
      margins: { top: 30, right: 40, bottom: 50, left: 60 },
      header: 30,
      footer: 50,
      titlePage: false,
    })
  })

  // A page number the writer does not know is a field Word works out, in the footer's own style, with nothing written in its place.
  test("the page's number and count are fields, in the paragraph's style", () => {
    const docx = file(documentOf([paragraph('x')], { pageFooter: [footer] }))
    const [gap, line] = docx.footer!.blocks as DocxParagraph[]
    expect(gap).toMatchObject({ runs: [], line: { height: REGION_GAP, rule: 'exact' } })
    expect(line!.runs.map((run) => (run.kind === 'field' ? run.field : words({ ...line!, runs: [run] })))).toEqual(['Page ', 'PAGE', ' of ', 'NUMPAGES'])
    expect(line!.runs.every((run) => run.props.size === 8)).toBe(true)
    expect(line!.align).toBe('center')
  })

  // The PDF keeps a gap between a region and the body: without it a header's last line touches the body's first.
  test('a header ends, and a footer begins, with the gap to the body', () => {
    const docx = file(documentOf([paragraph('x')], { pageHeader: [paragraph('Header'), table()], pageFooter: [paragraph('Footer')] }))
    expect(docx.header!.blocks.map((block) => (block.kind === 'table' ? 'table' : (block.line?.height ?? words(block))))).toEqual([
      'Header',
      'table',
      REGION_GAP,
    ])
    expect(docx.footer!.blocks.map((block) => (block.kind === 'table' ? 'table' : (block.line?.height ?? words(block))))).toEqual([REGION_GAP, 'Footer'])
  })

  // An empty header part is still a header: Word would reserve its line on every page of a report that has none.
  test('a region that holds nothing is no part of the file', () => {
    const docx = file(documentOf([paragraph('x')]))
    expect([docx.header, docx.firstHeader, docx.footer, docx.firstFooter]).toEqual([undefined, undefined, undefined, undefined])
    expect([...docx.parts.keys()].filter((name) => /header|footer/.test(name))).toEqual([])
  })

  // 0060: page 1 prints a header of its own in the page header's place, and the page footer every page prints.
  test("page 1's own header is the first page's, and the page footer is referenced for the first page and for the rest", () => {
    const docx = file(documentOf([paragraph('x')], { pageHeader: [paragraph('Every page')], firstPageHeader: [paragraph('Page one')], pageFooter: [footer] }))
    expect(docx.page.titlePage).toBe(true)
    expect([docx.header?.part, docx.firstHeader?.part, docx.footer?.part, docx.firstFooter?.part]).toEqual([
      'word/header1.xml',
      'word/header2.xml',
      'word/footer1.xml',
      'word/footer1.xml',
    ])
    expect(words(docx.firstHeader!.blocks[0])).toBe('Page one')
  })

  // Its empty list is none: page 1 has a header of its own, and the file gives it no part, which ECMA-376 has Word print as a blank one.
  test("page 1's own header that holds nothing is no part, and page 1 still has a header of its own", () => {
    const docx = file(documentOf([paragraph('x')], { pageHeader: [paragraph('Every page')], firstPageHeader: [] }))
    expect([docx.page.titlePage, docx.header?.part, docx.firstHeader]).toEqual([true, 'word/header1.xml', undefined])
  })

  // The styles part takes away what Word adds to every paragraph, and the settings say the file is of the current format.
  test('the file states no space between paragraphs, a single line, the default face and size, and the current compatibility mode', () => {
    const docx = file(documentOf([paragraph('x')]))
    expect(docx.defaults).toEqual({ run: { family: 'Roboto', bold: false, italic: false, size: 10 }, before: 0, after: 0, line: { height: 1, rule: 'auto' } })
    expect(docx.compatibilityMode).toBe('15')
  })

  // A size Word does not hold is the nearest half point, at most a quarter of a point away: said in record 0068 as a cost, and held here to being that and no more.
  test.each([
    [9.2, 9],
    [9.25, 9.5],
    [9.7, 9.5],
  ])('a size of %d points is written as %d, the half point nearest it', (size, written) => {
    expect((body(paragraph('x', { size }))[0] as DocxParagraph).runs[0]!.props.size).toBe(written)
  })
})
