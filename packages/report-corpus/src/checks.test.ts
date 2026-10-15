import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { describe, expect, test } from 'vitest'
import { verify, verifyRefusal } from './checks.js'
import { RenderRefusal, type ResolvedDocument, type TableRow } from './document.js'
import { expectation, type Fixture, type Stated } from './fixture.js'
import { encodePng } from './fixtures/png.js'
import { uniqueWords } from './fixtures/words.js'
import { pageLines } from './lines.js'
import { readPdf } from './read-pdf.js'
import { pdfmakePdf } from './testing/pdfmake.js'

/**
 * A two-region table of sixty rows that runs onto a second page, and PDFs of
 * it made directly with pdfmake: one correct, the others each broken in the
 * one way a check exists to see. The correct one must pass every check, or a
 * check that always complains would pass every test below.
 */
const key = (n: number): string => `ROW-${String(n).padStart(4, '0')}`
const detail = (n: number): TableRow => ({ kind: 'detail', cells: [key(n), `Item ${n}`, `${n}.00`] })
const ROWS: readonly TableRow[] = [
  { kind: 'groupHeader', cells: ['Region North', '', ''] },
  ...Array.from({ length: 30 }, (_, i) => detail(i + 1)),
  { kind: 'groupFooter', cells: ['Subtotal North', '', '465.00'] },
  { kind: 'groupHeader', cells: ['Region South', '', ''] },
  ...Array.from({ length: 30 }, (_, i) => detail(i + 31)),
  { kind: 'groupFooter', cells: ['Subtotal South', '', '1365.00'] },
  { kind: 'total', cells: ['Total', '', '1830.00'] },
]
const MARGIN = 40
const PAGE_HEADER = 'Checks report'

function documentOf(rows: readonly TableRow[]): ResolvedDocument {
  return {
    info: { title: 'Checks', creationDate: '2026-01-01T00:00:00Z' },
    page: { size: 'A4', orientation: 'portrait', margins: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } },
    pageHeader: [{ kind: 'paragraph', runs: [{ text: PAGE_HEADER }] }],
    pageFooter: [{ kind: 'paragraph', runs: [{ text: 'Page ' }, { field: 'pageNumber' }, { text: ' of ' }, { field: 'pageCount' }], style: { align: 'center' } }],
    body: [
      {
        kind: 'table',
        id: 'lines',
        columns: [
          { width: 100, align: 'left' },
          { width: 'fill', align: 'left' },
          { width: 80, align: 'right' },
        ],
        header: ['Key', 'Description', 'Amount'],
        rows,
        emptyText: 'No lines',
      },
    ],
  }
}

function fixtureOf(id: string, rows: readonly TableRow[], stated: Stated): Fixture {
  const document = documentOf(rows)
  return { id, title: id, document, maxPages: 10, expect: expectation(document, stated) }
}

const fixture = fixtureOf('checks', ROWS, { minPagesExpected: 2, maxPagesExpected: 2 })

type Region = (page: number, pages: number) => string | undefined
const pageOfPages: Region = (page, pages) => `Page ${page} of ${pages}`

interface Options {
  /** Whether the table's header row repeats on every page; it does unless told otherwise. */
  readonly repeatHeader?: boolean
  readonly header?: Region
  readonly footer?: Region
  /**
   * Draws the footer this far from the top of the paper on every page,
   * instead of in the bottom margin, as the page's background: pdfmake tells
   * a background its page's number but not how many pages there are, so the
   * count is given, and is the two pages of `ROWS`.
   */
  readonly footerAt?: number
  /** The table's columns in this order of the document's: `[1, 0, 2]` prints the description first. */
  readonly columns?: readonly number[]
  readonly before?: Content[]
  readonly extra?: Content[]
  /** Drawn on the first page as its background, which pdfmake lays out over the whole sheet and so can place anywhere. */
  readonly onPageOne?: Content
}

/**
 * The table as pdfmake draws it: the page header inside the top margin, the
 * footer inside the bottom one, both within the document's own 40pt margin,
 * `before` and `extra` around the table.
 */
function definition(rows: readonly TableRow[], options: Options = {}): TDocumentDefinitions {
  const header = options.header ?? (() => PAGE_HEADER)
  const footer = options.footer ?? pageOfPages
  const { onPageOne, footerAt } = options
  const background = (page: number): Content[] => [
    ...(footerAt === undefined ? [] : [{ text: footer(page, 2) ?? '', alignment: 'center' as const, absolutePosition: { x: MARGIN, y: footerAt } }]),
    ...(page === 1 && onPageOne !== undefined ? [onPageOne] : []),
  ]
  return {
    pageSize: 'A4',
    // The page header from the top margin down, 20pt above the body; the footer 10pt below it.
    pageMargins: [MARGIN, MARGIN + 20, MARGIN, MARGIN + 30],
    header: (page, pages) => {
      const text = header(page, pages)
      return text === undefined ? null : { text, margin: [MARGIN, MARGIN, MARGIN, 0] }
    },
    footer: (page, pages) => {
      const text = footerAt === undefined ? footer(page, pages) : undefined
      return text === undefined ? null : { text, alignment: 'center', margin: [MARGIN, 10, MARGIN, 0] }
    },
    ...(onPageOne === undefined && footerAt === undefined ? {} : { background }),
    content: [...(options.before ?? []), table(rows, options.repeatHeader ?? true, options.columns ?? [0, 1, 2]), ...(options.extra ?? [])],
  }
}

function table(rows: readonly TableRow[], repeatHeader: boolean, columns: readonly number[]): Content {
  const header = ['Key', 'Description', 'Amount']
  const cell = (cells: readonly string[], column: number): TableCell => ({ text: cells[column] ?? '', alignment: column === 2 ? 'right' : 'left' })
  const body: TableCell[][] = [header, ...rows.map((row) => row.cells)].map((cells) => columns.map((column) => cell(cells, column)))
  return { table: { headerRows: repeatHeader ? 1 : 0, widths: columns.map((column) => [100, '*', 80][column]!), body } }
}

async function problems(made: TDocumentDefinitions, of: Fixture = fixture): Promise<string[]> {
  return verify(of, await readPdf(await pdfmakePdf(made)))
}

/** `text` as a pattern that matches it literally. */
const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A 2 × 2 black PNG as a data URL. Made afresh for each definition: pdfmake replaces an image in the definition it is given. */
const png = (): string => `data:image/png;base64,${Buffer.from(encodePng(2, 2, () => [0, 0, 0])).toString('base64')}`

describe('verify, on a correct PDF', () => {
  // Every check below is shown to complain about one defect. This shows they
  // complain about nothing else: a check that failed every PDF would pass all
  // of those tests and be worthless.
  test('finds nothing wrong', async () => {
    expect(await problems(definition(ROWS))).toEqual([])
  })
})

describe('verify finds rows that are not each printed once, in order', () => {
  // The defect the whole corpus exists for: a row lost at a page break.
  test('a missing row', async () => {
    const found = await problems(definition(ROWS.filter((row) => row.cells[0] !== 'ROW-0030')))
    expect(found).toContainEqual(expect.stringMatching(/^checks: ROW-0030 is missing$/))
  })

  // The other half of it: a row printed at the bottom of one page and again
  // at the top of the next.
  test('a duplicated row', async () => {
    const index = ROWS.findIndex((row) => row.cells[0] === 'ROW-0020')
    const found = await problems(definition([...ROWS.slice(0, index + 1), ROWS[index]!, ...ROWS.slice(index + 1)]))
    expect(found).toContainEqual('checks: ROW-0020 appears 2 times, on pages 1, 1')
  })

  // Every row present once, but two of them swapped: a count alone would
  // pass this.
  test('a reordered row', async () => {
    const index = ROWS.findIndex((row) => row.cells[0] === 'ROW-0010')
    const swapped = [...ROWS]
    ;[swapped[index], swapped[index + 1]] = [swapped[index + 1]!, swapped[index]!]
    const found = await problems(definition(swapped))
    expect(found).toEqual(['checks: ROW-0011 (page 1) comes before ROW-0010 (page 1)'])
  })
})

describe('verify ties every value to the row it belongs to', () => {
  /** `ROWS` with the cells of the row keyed `at` replaced. */
  const changed = (at: string, cells: (row: readonly string[]) => readonly string[]): TableRow[] => ROWS.map((row) => (row.cells[0] === at ? { ...row, cells: [...cells(row.cells)] } : row))

  // Each amount still printed, each once, but on the other's row: a total
  // that is right somewhere on the page is a total on the wrong line.
  test('two rows with their amounts swapped', async () => {
    const swapped = changed('ROW-0003', ([k, d]) => [k!, d!, '4.00']).map((row) => (row.cells[0] === 'ROW-0004' ? { ...row, cells: ['ROW-0004', 'Item 4', '3.00'] } : row))
    expect(await problems(definition(swapped))).toEqual([
      "checks: page 1: the row ROW-0003 prints nothing of its column 3 cell '3.00' on its first line; it reads 'ROW-0003 Item 3 4.00'",
      "checks: page 1: the row ROW-0004 prints nothing of its column 3 cell '4.00' on its first line; it reads 'ROW-0004 Item 4 3.00'",
    ])
  })

  // A digit changed in one amount, and a description lost from another row:
  // neither row goes missing, and no key moves.
  test('a changed digit and a lost cell', async () => {
    const found = await problems(definition(changed('ROW-0012', ([k, d]) => [k!, d!, '13.00']).map((row) => (row.cells[0] === 'ROW-0040' ? { ...row, cells: ['ROW-0040', '', '40.00'] } : row))))
    expect(found).toEqual([
      "checks: page 1: the row ROW-0012 prints nothing of its column 3 cell '12.00' on its first line; it reads 'ROW-0012 Item 12 13.00'",
      expect.stringMatching(/^checks: page 2: the row ROW-0040 prints nothing of its column 2 cell 'Item 40' on its first line; it reads 'ROW-0040 40\.00'$/),
    ])
  })

  // The dash a null prints is the same in every row, so finding one
  // somewhere proves nothing about the row that lost its own.
  test("one row's placeholder standing in for another's", async () => {
    const rows: TableRow[] = [
      { kind: 'detail', cells: ['NUL-01', '', '—'] },
      { kind: 'detail', cells: ['NUL-02', '—', ''] },
    ]
    const nulls = fixtureOf('nulls', rows, { maxPagesExpected: 1 })
    expect(await problems(definition(rows), nulls)).toEqual([])
    expect(await problems(definition([{ kind: 'detail', cells: ['NUL-01', '', ''] }, rows[1]!]), nulls)).toEqual([
      "nulls: page 1: the row NUL-01 prints nothing of its column 3 cell '—' on its first line; it reads 'NUL-01'",
    ])
  })

  // Columns printed in another order than the document's: every value is
  // still on its row's line, under the wrong heading.
  test('the key and description columns printed the other way round', async () => {
    const found = await problems(definition(ROWS, { columns: [1, 0, 2] }))
    expect(found).toContainEqual("checks: page 1: the row ROW-0001 does not begin a line, so its cells are not in column order: 'Item 1 ROW-0001 1.00'")
  })
})

describe('verify reads a row that wraps, onto the next page', () => {
  // A row of 300 distinct words between two short ones: it wraps, and
  // pdfmake continues it from the first page onto the second.
  const words = uniqueWords(300)
  const tall: TableRow[] = [detail(1), { kind: 'detail', cells: ['TALL-0002', words.join(' '), '2.00'] }, detail(3)]
  const fixture = fixtureOf('tall', tall, { minPagesExpected: 2, maxPagesExpected: 3 })
  const without = (lost: string): TableRow[] => tall.map((row) => (row.cells[0] === 'TALL-0002' ? { ...row, cells: ['TALL-0002', words.filter((word) => word !== lost).join(' '), '2.00'] } : row))

  // The correct PDF, so that the cases below fail for their defect alone.
  test('finds nothing wrong with a row continued correctly', async () => {
    expect(await problems(definition(tall), fixture)).toEqual([])
  })

  // A word lost from the middle of a wrapped cell: every key is still there,
  // and the cell's first and last words too.
  test('a word lost from a line after the first, and one lost on the next page', async () => {
    const correct = await readPdf(await pdfmakePdf(definition(tall)))
    // The second word of the first line on the page that continues the cell, rather than beginning the row.
    const onPage = (page: number): string => pageLines(correct.pages[page - 1]!).find((line) => line.words.length > 3 && words.includes(line.words[0]!))!.words[1]!
    const [first, second] = [onPage(1), onPage(2)]
    // Read a line at a time, the row stops at the line that lost the word, which reads on without it.
    expect(await problems(definition(without(first)), fixture)).toEqual([
      expect.stringMatching(new RegExp(`^tall: page 1: the row TALL-0002 stops before '[a-z]+\\d{4} ${first} .+' of its column 2 cell; the next line reads '[a-z]+\\d{4} (?!${first})`)),
    ])
    expect(await problems(definition(without(second)), fixture)).toEqual([
      expect.stringMatching(new RegExp(`^tall: page 2: the row TALL-0002, begun on page 1, stops before '[a-z]+\\d{4} ${second} .+' of its column 2 cell; the next line reads '[a-z]+\\d{4} (?!${second})`)),
    ])
  })

  // A wrapped row whose last words never print: before the next row, with
  // every key still in place, or at the very end of the document, where a
  // report cut short would leave it.
  test('a wrapped row that ends early, before the next row and at the end of the document', async () => {
    const shortened = (rows: readonly TableRow[]): TableRow[] => rows.map((row) => (row.cells[0] === 'TALL-0002' ? { ...row, cells: ['TALL-0002', words.slice(0, -5).join(' '), '2.00'] } : row))
    const lost = `'${words.slice(-5).join(' ')}'`
    expect(await problems(definition(shortened(tall)), fixture)).toEqual([`tall: page 2: the row TALL-0002, begun on page 1, stops before ${lost} of its column 2 cell`])
    const last = tall.slice(0, 2)
    const lastFixture = fixtureOf('tall-last', last, { minPagesExpected: 2, maxPagesExpected: 3 })
    expect(await problems(definition(last), lastFixture)).toEqual([])
    expect(await problems(definition(shortened(last)), lastFixture)).toEqual([`tall-last: page 2: the row TALL-0002, begun on page 1, stops before ${lost} of its column 2 cell`])
  })

  // The row's continuation is the table on the next page as much as a new
  // row is: without its header there, the reader has no column names.
  test('a header that does not repeat over the continued row', async () => {
    const found = await problems(definition(tall, { repeatHeader: false }), fixture)
    expect(found).toEqual([expect.stringMatching(/^tall: page 2: the header cells 'Key', 'Description', 'Amount' are not above the first line of table lines, '[a-z]+\d{4} .+'$/)])
  })
})

describe('verify holds the page regions to their places', () => {
  // The page header left off a page: the report's title, missing there.
  test('a page header missing from a page', async () => {
    expect(await problems(definition(ROWS, { header: (page) => (page === 2 ? undefined : PAGE_HEADER) }))).toEqual(["checks: page 2: the page header line 'Checks report' is missing"])
  })

  // A footer of plain text -- a confidentiality notice -- left off a page.
  // With no page number in it, nothing else would look for it.
  test('a page footer line missing from a page', async () => {
    const plain = { ...fixture, expect: expectation({ ...fixture.document, pageFooter: [{ kind: 'paragraph', runs: [{ text: 'Confidential' }] }] }, { minPagesExpected: 2, maxPagesExpected: 2 }) }
    expect(await problems(definition(ROWS, { footer: () => 'Confidential' }), plain)).toEqual([])
    expect(await problems(definition(ROWS, { footer: (page) => (page === 2 ? undefined : 'Confidential') }), plain)).toEqual(["checks: page 2: the page footer line 'Confidential' is missing"])
  })

  // An image of the body that runs down into the page footer, beside its
  // text rather than over it, so that no box crosses the footer's.
  test('an image drawn into the page footer', async () => {
    const footer = pageLines((await readPdf(await pdfmakePdf(definition(ROWS)))).pages[0]!).find((line) => line.text.startsWith('Page '))!
    const stated = { ...fixture, expect: { ...fixture.expect, images: [{ width: 20, height: 20 }] } }
    const found = await problems(definition(ROWS, { onPageOne: { image: png(), width: 20, height: 20, absolutePosition: { x: 100, y: footer.top - 10 } } }), stated)
    expect(found).toEqual([expect.stringMatching(/^checks: page 1: an image at 100, [\d.]+ reaches [\d.]+ pt, below the top of the page footer at [\d.]+$/)])
  })

  // A page header drawn in the middle of the body has the body's first
  // lines above it.
  test('a page header drawn below the top of the body', async () => {
    // Halfway between two rows, so that it is a line of its own, and right of their descriptions, so that it covers no text.
    const lines = pageLines((await readPdf(await pdfmakePdf(definition(ROWS)))).pages[0]!)
    const [fifth, sixth] = ['ROW-0005', 'ROW-0006'].map((each) => lines.find((line) => line.text.startsWith(each))!)
    const found = await problems(definition(ROWS, { header: (page) => (page === 1 ? undefined : PAGE_HEADER), onPageOne: { text: PAGE_HEADER, absolutePosition: { x: 300, y: (fifth!.top + sixth!.top) / 2 - 1.5 } } }))
    expect(found).toEqual([expect.stringMatching(/^checks: page 1: 'Key Description Amount' starts at [\d.]+ pt, above the foot of the page header at [\d.]+$/)])
  })

  // "Page n of N" at the top of the page, where a footer that counts
  // correctly would pass every other check.
  test('a footer printed at the top of the page', async () => {
    const found = await problems(definition(ROWS, { header: () => undefined, footerAt: MARGIN }))
    expect(found).toContainEqual(expect.stringMatching(/^checks: page 1: '.+' reaches [\d.]+ pt, below the top of the page footer at [\d.]+$/))
  })

  // A footer drawn into the last row's line, between its description and
  // its amount: no box crosses another, so only the regions show it.
  test('a footer drawn into the last row on a page, between two of its cells', async () => {
    const correct = await readPdf(await pdfmakePdf(definition(ROWS)))
    const last = pageLines(correct.pages[0]!).filter((line) => line.text.startsWith('ROW-')).at(-1)!
    const found = await problems(definition(ROWS, { footerAt: last.top + 5 }))
    expect(found.filter((problem) => / overlaps /.test(problem))).toEqual([])
    expect(found).toContainEqual(expect.stringMatching(new RegExp(`^checks: page 1: '${escaped(last.text)}' reaches [\\d.]+ pt, below the top of the page footer at [\\d.]+$`)))
  })

  // A blank page: a page break too many, or a table that left only the page
  // regions behind.
  test('a page with nothing between its page header and footer', async () => {
    expect(await problems(definition(ROWS, { extra: [{ text: '', pageBreak: 'before' }] }))).toEqual(['checks: 3 pages; at most 2 expected', 'checks: page 3 prints nothing between its page header and footer'])
  })
})

describe('verify finds headings left alone at the foot of a page', () => {
  // A group's heading at the foot of a page with its rows on the next: the
  // reader sees a heading over nothing.
  test('an orphaned group header', async () => {
    const south = ROWS.findIndex((row) => row.cells[0] === 'Region South')
    const orphaned = definition(ROWS.slice(0, south + 1), { extra: [{ ...(table(ROWS.slice(south + 1), true, [0, 1, 2]) as object), pageBreak: 'before' } as Content] })
    expect(await problems(orphaned)).toEqual(["checks: page 1: the last table row is the group header 'Region South'"])
  })

  // The column header at the foot of a page, its first row on the next:
  // pdfmake does this unless told to keep the header with a row.
  test('an orphaned column header', async () => {
    const lines = pageLines((await readPdf(await pdfmakePdf(definition(ROWS)))).pages[0]!)
    const [header, groupHeader] = ['Key Description Amount', 'Region North'].map((text) => lines.find((line) => line.text === text)!)
    // The table pushed down by an empty stack, which takes no height of its
    // own, until the header row's pitch and half the next one's are left of
    // the body above the footer's 10pt gap: the header fits, the row under it
    // does not.
    const pitch = groupHeader!.top - header!.top
    const bodyFoot = 841.89 - (MARGIN + 30)
    const pushed = bodyFoot - (MARGIN + 20) - 1.5 * pitch
    const found = await problems(definition(ROWS, { before: [{ stack: [], margin: [0, pushed, 0, 0] }] }), { ...fixture, expect: { ...fixture.expect, maxPagesExpected: 3 } })
    expect(found).toEqual(['checks: page 1: the column header of table lines ends the page, with none of its rows under it'])
  })
})

describe('verify checks what a fixture states about its text and pages', () => {
  // An exact value -- a total, an amount in francs -- printed differently,
  // or not at all.
  test('exact text that is not on any page', async () => {
    const stated = { ...fixture, expect: { ...fixture.expect, exactText: ['1830.00', '1’830.00'] } }
    expect(await problems(definition(ROWS), stated)).toEqual(["checks: '1’830.00' is not on any page"])
  })

  // An identifier an engine may wrap anywhere is still there in full, and
  // no longer than it is: a wrapped line of it printed twice is not it.
  test('wrapped text, found across line breaks but not when cut short or printed too long', async () => {
    const id = `ID-${'X'.repeat(297)}`
    const stated = { ...fixture, expect: { ...fixture.expect, wrappedText: [id] } }
    expect(await problems(definition(ROWS, { extra: [{ text: id }] }), stated)).toEqual([])
    const message = `checks: '${id.slice(0, 40)}…' (300 characters) is not printed as lines of its own on one page, even with line breaks removed`
    expect(await problems(definition(ROWS, { extra: [{ text: id.slice(0, 250) }] }), stated)).toEqual([message])
    expect(await problems(definition(ROWS, { extra: [{ text: `${id}${'X'.repeat(60)}` }] }), stated)).toEqual([message])
  })

  // A summary split across two pages.
  test('lines kept together that are split across pages', async () => {
    const stated = { ...fixture, expect: { ...fixture.expect, keptTogether: [['Summary of lines', 'Grand total 1830.00']], maxPagesExpected: 4 } }
    const together = definition(ROWS, { extra: [{ text: 'Summary of lines' }, { text: 'Grand total 1830.00' }] })
    expect(await problems(together, stated)).toEqual([])
    const split = definition(ROWS, { extra: [{ text: 'Summary of lines', pageBreak: 'before' }, { text: 'Grand total 1830.00', pageBreak: 'before' }] })
    expect(await problems(split, stated)).toEqual(["checks: 'Summary of lines', 'Grand total 1830.00' are split across pages 3, 4"])
    // A line of the block that never printed is not "together" with the rest.
    const lost = { ...stated, expect: { ...stated.expect, keptTogether: [['Summary of lines', 'Not printed anywhere']] } }
    expect(await problems(together, lost)).toEqual(["checks: 'Not printed anywhere', which must be kept together with 1 other line, is not on any page"])
  })

  // A sweep across a page boundary: blocks given less room move to a page
  // of their own from some point on, and never one with more room while a
  // later one stays. A block moved needlessly, or a sweep that never reached
  // the boundary, is reported.
  test('kept-together groups that move out of order of their room, or never cross the boundary', async () => {
    const groups = [['First block', 'First end'], ['Second block', 'Second end'], ['Third block', 'Third end']]
    const stated = (fixture: Fixture): Fixture => ({ ...fixture, expect: { ...fixture.expect, keptTogether: groups, keptTogetherByRoom: true, maxPagesExpected: 10 } })
    const block = ([first, end]: readonly string[], placed: 'under' | 'alone'): Content[] => [
      ...(placed === 'under' ? [{ text: 'Filler before the block', pageBreak: 'before' as const }] : []),
      { stack: [{ text: first! }, { text: end! }], ...(placed === 'alone' ? { pageBreak: 'before' as const } : {}) },
    ]
    const made = (...placed: ('under' | 'alone')[]): TDocumentDefinitions => definition(ROWS, { extra: groups.flatMap((group, index) => block(group, placed[index]!)) })
    expect(await problems(made('under', 'under', 'alone'), stated(fixture))).toEqual([])
    expect(await problems(made('under', 'alone', 'under'), stated(fixture))).toEqual(["checks: 'Third block' fits under what precedes it on page 5, though 'Second block', which had more room, moved to page 4"])
    expect(await problems(made('under', 'under', 'under'), stated(fixture))).toEqual(['checks: no kept-together group starts a page of its own: none reached the page boundary'])
    expect(await problems(made('alone', 'alone', 'alone'), stated(fixture))).toEqual(['checks: every kept-together group starts a page of its own: none fitted under what precedes it'])
  })

  // An accidental blank page, or a report cut short.
  test('too many pages and too few', async () => {
    expect(await problems(definition(ROWS, { extra: [{ text: '', pageBreak: 'before' }] }))).toContainEqual('checks: 3 pages; at most 2 expected')
    expect(await problems(definition(ROWS.slice(0, 5)))).toContainEqual('checks: 1 page; at least 2 expected')
  })

  // A page of another size or orientation than the document asked for: every
  // margin check would then be made against the wrong paper.
  test('a page of the wrong size', async () => {
    const found = await problems({ ...definition(ROWS), pageOrientation: 'landscape' })
    expect(found).toContainEqual('checks: page 1 is 841.89 × 595.28 pt; the document asks for 595.28 × 841.89')
  })

  // A font the PDF only names prints in whatever the reader's machine has.
  test('a font that is not embedded', async () => {
    const found = await problems({ ...definition(ROWS), defaultStyle: { font: 'Helvetica' } })
    expect(found).toContainEqual('checks: the font Helvetica is not embedded')
  })

  // A character the embedded font has no glyph for prints as an empty box,
  // whatever the fixture expected of that line: Roboto has no CJK glyphs.
  test('a character drawn without a glyph', async () => {
    const found = await problems(definition(ROWS, { extra: [{ text: 'Reference 漢' }] }))
    expect(found).toEqual(["checks: page 2: 'Reference ␀' has U+0000, a character no glyph was drawn for"])
  })

  // An image that never made it onto the page is invisible to every text
  // check, and one drawn at another size than the document gives is not the
  // image the author placed.
  test('images drawn, counted and measured against the document', async () => {
    const stated = { ...fixture, expect: { ...fixture.expect, images: [{ width: 20, height: 20 }] } }
    expect(await problems(definition(ROWS), stated)).toEqual(['checks: 0 images drawn; 1 expected'])
    expect(await problems(definition(ROWS, { extra: [{ image: png(), width: 20, height: 20 }] }), stated)).toEqual([])
    expect(await problems(definition(ROWS, { extra: [{ image: png(), width: 10, height: 20 }] }), stated)).toEqual([
      expect.stringMatching(/^checks: page 2: an image at 40, [\d.]+ is drawn 10 × 20 pt; the document draws it 20 × 20$/),
    ])
  })
})

describe('verify finds layout defects', () => {
  // Text drawn over other text extracts perfectly: only the boxes show it.
  test('text drawn over other text', async () => {
    // Drawn where the correct PDF has ROW-0001, five points to its right and
    // four down: a line of its own, over half of the row's.
    const correct = await readPdf(await pdfmakePdf(definition(ROWS)))
    const row = correct.pages[0]!.items.find((item) => item.text === 'ROW-0001')!
    const found = await problems(definition(ROWS, { onPageOne: { text: 'COLLISION', absolutePosition: { x: row.x + 5, y: row.top + 4 } } }))
    expect(found).toEqual([expect.stringMatching(/^checks: page 1: 'ROW-0001' overlaps 'COLLISION' by [\d.]+ × [\d.]+ pt$/)])
  })

  // Text past the right margin is clipped by a printer even when a viewer
  // shows it.
  test('text outside the margins', async () => {
    // Right of the table, small enough to fit before the paper's edge.
    const found = await problems(definition(ROWS, { onPageOne: { text: 'OUTSIDE', fontSize: 6, absolutePosition: { x: 562, y: 300 } } }))
    expect(found).toEqual([expect.stringMatching(/^checks: page 1: 'OUTSIDE' extends past the right margin \(to [\d.]+ pt; the margin is at 555.28\)$/)])
  })

  // The other three margins, and an image as well as text: a page header
  // drawn into the top margin or a footer below the bottom one is as lost to
  // a printer as text past the right edge.
  test('text past the top, bottom and left margins, and an image past the right', async () => {
    const outside: Content = {
      stack: [
        { text: 'ABOVE', absolutePosition: { x: 200, y: 10 } },
        { text: 'BELOW', absolutePosition: { x: 100, y: 815 } },
        { text: 'LEFT', absolutePosition: { x: 8, y: 400 } },
        { image: png(), width: 30, height: 30, absolutePosition: { x: 556, y: 400 } },
      ],
    }
    const found = await problems(definition(ROWS, { onPageOne: outside }), { ...fixture, expect: { ...fixture.expect, images: [{ width: 30, height: 30 }] } })
    expect(found.filter((problem) => /extends past/.test(problem))).toEqual([
      expect.stringMatching(/^checks: page 1: 'ABOVE' extends past the top margin \(from [\d.]+ pt; the margin is at 40\)$/),
      expect.stringMatching(/^checks: page 1: 'BELOW' extends past the bottom margin \(to [\d.]+ pt; the margin is at 801.89\)$/),
      expect.stringMatching(/^checks: page 1: 'LEFT' extends past the left margin \(from 8 pt; the margin is at 40\)$/),
      'checks: page 1: an image at 556, 400 extends past the right margin (to 586 pt; the margin is at 555.28)',
    ])
  })

  // An image over text hides it from a reader and from nobody else: the text
  // still extracts. Only the boxes show it. And a fixture that turns the
  // check off -- because overlap is what it is about -- is not told about it.
  test('an image drawn over text, unless the fixture turns the check off', async () => {
    const correct = await readPdf(await pdfmakePdf(definition(ROWS)))
    const row = correct.pages[0]!.items.find((item) => item.text === 'ROW-0001')!
    const covered = (): TDocumentDefinitions => definition(ROWS, { onPageOne: { image: png(), width: 40, height: 14, absolutePosition: { x: row.x, y: row.top - 2 } } })
    const stated = { ...fixture, expect: { ...fixture.expect, images: [{ width: 40, height: 14 }] } }
    expect(await problems(covered(), stated)).toEqual([expect.stringMatching(/^checks: page 1: an image at [\d.]+, [\d.]+ overlaps 'ROW-0001' by [\d.]+ × [\d.]+ pt$/)])
    expect(await problems(covered(), { ...stated, expect: { ...stated.expect, noOverlaps: false } })).toEqual([])
  })

  // A footer left off a page, or numbered as another page.
  test('a missing footer and a wrongly numbered one', async () => {
    const missing = await problems(definition(ROWS, { footer: (page, pages) => (page === 2 ? undefined : pageOfPages(page, pages)) }))
    expect(missing).toEqual([`checks: page 2: no line matches the footer ${String(fixture.expect.footerEveryPage)}`])
    const wrong = await problems(definition(ROWS, { footer: (_, pages) => pageOfPages(1, pages) }))
    expect(wrong).toEqual(["checks: page 2: the footer says 'Page 1 of 2'; this is page 2 of 2"])
  })

  // The table's header printed on its first page only: the second page's
  // rows have no column names.
  test('a header that does not repeat', async () => {
    const found = await problems(definition(ROWS, { repeatHeader: false }))
    expect(found).toEqual([expect.stringMatching(/^checks: page 2: the header cells 'Key', 'Description', 'Amount' are not above the first line of table lines, 'ROW-\d{4}.*'$/)])
    // One cell the header never prints is missing on every page.
    const stated = { ...fixture, expect: { ...fixture.expect, tables: fixture.expect.tables.map((each) => ({ ...each, header: ['Key', 'Currency'] })) } }
    expect(await problems(definition(ROWS), stated)).toEqual([
      "checks: page 1: the header cell 'Currency' is not above the first line of table lines, 'Region North'",
      expect.stringMatching(/^checks: page 2: the header cell 'Currency' is not above the first line of table lines, 'ROW-\d{4}.*'$/),
    ])
  })

  // The same, where no line begins with a key: the columns printed in
  // another order. The page is still the table's, and still needs its header.
  test('a header that does not repeat over rows whose key is not first', async () => {
    const found = await problems(definition(ROWS, { repeatHeader: false, columns: [1, 0, 2] }))
    expect(found).toContainEqual(expect.stringMatching(/^checks: page 2: the header cells 'Key', 'Description', 'Amount' are not above the first line of table lines, 'Item \d+ ROW-\d{4}.*'$/))
  })
})

describe('verify and verifyRefusal, against the outcome a fixture expects', () => {
  const refusing: Fixture = { ...fixture, id: 'refusing', expect: { ...fixture.expect, outcome: 'refuse', refusal: { code: 'invalid-asset', subject: 'logo' } } }
  const either: Fixture = { ...fixture, id: 'either', expect: { ...fixture.expect, outcome: 'render-or-refuse', refusal: { code: 'content-too-large' } } }

  // An engine that renders what it should have refused -- a truncated
  // report, an image it could not read -- has produced a wrong PDF, whatever
  // that PDF shows.
  test('a PDF where a refusal was expected', async () => {
    expect(await problems(definition(ROWS), refusing)).toEqual(['refusing: expected a refusal (invalid-asset), but a PDF was produced'])
    expect(await problems(definition(ROWS), either)).toEqual([])
  })

  // The refusal must be the one expected: right code, naming the right
  // asset. A crash is not a refusal, and neither is a refusal for another
  // reason.
  test('a refusal: the expected one passes, any other does not', () => {
    expect(verifyRefusal(refusing, new RenderRefusal('invalid-asset', 'logo is not a PNG', 'logo'))).toEqual([])
    expect(verifyRefusal(either, new RenderRefusal('content-too-large', 'row 1 is taller than a page', 'lines'))).toEqual([])
    expect(verifyRefusal(refusing, new RenderRefusal('invalid-asset', 'banner is not a PNG', 'banner'))).toEqual(["refusing: the refusal names 'banner'; expected 'logo'"])
    expect(verifyRefusal(refusing, new RenderRefusal('unsupported', 'no images'))).toEqual(['refusing: refused with unsupported; expected invalid-asset'])
    expect(verifyRefusal(refusing, new TypeError('x is undefined'))).toEqual(['refusing: failed with TypeError: x is undefined; expected the refusal invalid-asset'])
    expect(verifyRefusal(fixture, new RenderRefusal('too-many-pages', 'too long'))).toEqual(['checks: refused with too-many-pages (too long); expected a PDF'])
  })

  // The rest of what an engine can reject with: a refusal that names no
  // asset where one is expected, a crash where a PDF is, a value thrown that
  // is not even an Error -- and a fixture that allows a refusal without
  // saying which, which would otherwise accept any.
  test('a refusal naming nothing, a crash, a thrown value, and a fixture that names no refusal', () => {
    expect(verifyRefusal(refusing, new RenderRefusal('invalid-asset', 'an image is unreadable'))).toEqual(["refusing: the refusal names nothing; expected 'logo'"])
    expect(verifyRefusal(fixture, new RangeError('Maximum call stack size exceeded'))).toEqual(['checks: failed with RangeError: Maximum call stack size exceeded; expected a PDF'])
    expect(verifyRefusal(refusing, 'out of memory')).toEqual(['refusing: failed with out of memory; expected the refusal invalid-asset'])
    const { refusal: _, ...unnamed } = either.expect
    expect(verifyRefusal({ ...either, expect: unnamed }, new RenderRefusal('content-too-large', 'too tall'))).toEqual(['either: the fixture allows a refusal but names no refusal code'])
  })
})
