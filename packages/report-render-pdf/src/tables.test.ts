import pdfmake from 'pdfmake'
import { readPdf, verify, type ReadPdf } from '@formancy/report-corpus'
import { RenderRefusal, type ResolvedDocument, type ResolvedFonts, type Table, type TableColumn, type TableRow, type TextStyle } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import { renderPdf } from './node.js'
import { styledRows } from './table.js'
import { bareDocument, details, documentOf, fixtureOf, ledger, PAGE, paragraph, TIMEOUT, totalRow } from './testing/documents.js'
import { face, HOST_SANS, HOST_SANS_BOLD, withEms } from './testing/fonts.js'
import { pageLines } from './testing/lines.js'

/**
 * A table's closing rows kept with what they close, and its page breaks
 * planned: proved on the PDFs, by where each row's key is printed.
 */

/** The page each line starting with one of `keys` is printed on, by key. */
function pagesOf(pdf: ReadPdf, keys: readonly string[]): Map<string, number> {
  const found = new Map<string, number>()
  for (const page of pdf.pages) {
    for (const line of pageLines(page)) {
      const key = keys.find((each) => ` ${line.text} `.startsWith(` ${each} `))
      if (key !== undefined && !found.has(key)) found.set(key, page.number)
    }
  }
  return found
}

/** `groups` groups of `size` detail rows, each headed across the table and closed by a subtotal, and a grand total under all. */
function grouped(groups: number, size: number): TableRow[] {
  const rows: TableRow[] = []
  for (let group = 1; group <= groups; group++) {
    const own = details((group - 1) * size + 1, group * size)
    rows.push({ kind: 'groupHeader', cells: [`Region G${group}`], across: true }, ...own, { ...totalRow(own, `Subtotal G${group}`), kind: 'groupFooter' })
  }
  return [...rows, totalRow(rows, 'Grand total')]
}

/** How many times pdfmake laid out the last pass of rendering `document`: each layout asks for the first page's background once. */
async function lastPassLayouts(document: ResolvedDocument, maxPages: number): Promise<number> {
  const passes: number[] = []
  const createPdf = pdfmake.createPdf.bind(pdfmake)
  const spy = vi.spyOn(pdfmake, 'createPdf').mockImplementation((definition, options) => {
    const pass = passes.push(0) - 1
    const background = definition.background
    return createPdf(
      {
        ...definition,
        background: (page, size) => {
          if (page === 1) passes[pass]! += 1
          return typeof background === 'function' ? background(page, size) : null
        },
      },
      options,
    )
  })
  try {
    await renderPdf(document, { maxPages })
  } finally {
    spy.mockRestore()
  }
  return passes.at(-1)!
}

describe("a table's closing rows", () => {
  // A quotation of 31 lines printed its subtotal and VAT under the last
  // line and its total alone on the next page, under a repeated header; at
  // 32 lines all three stood alone there. Swept across that page's foot:
  // the totals stand on the page of the last line, every time.
  test(
    'stand on the page of the last row they close, wherever the page ends',
    async () => {
      const failures: string[] = []
      for (let count = 40; count <= 52; count++) {
        const lines = details(1, count)
        const subtotal = { ...totalRow(lines, 'Subtotal') }
        const rows: TableRow[] = [...lines, subtotal, { kind: 'total', cells: ['VAT', '', '1.00'] }, { kind: 'total', cells: ['Total', '', '2.00'] }]
        const document = documentOf('Totals', [paragraph('A quotation'), ledger('lines', rows)])
        const pdf = await readPdf(await renderPdf(document, { maxPages: 10 }))
        expect(verify(fixtureOf(`totals-${count}`, document, { maxPagesExpected: 10 }), pdf)).toEqual([])
        const last = `ROW-${String(count).padStart(4, '0')}`
        const pages = pagesOf(pdf, [last, 'Subtotal', 'VAT', 'Total'])
        if (new Set(pages.values()).size !== 1) failures.push(`${count} lines: ${JSON.stringify([...pages])}`)
      }
      expect(failures).toEqual([])
    },
    TIMEOUT,
  )

  // A group's subtotal stood alone at the top of a page under the repeated
  // header, apart from every row it adds up, and so did the grand total.
  test(
    "keep a group's footer with its last row, and the grand total with the last group's footer",
    async () => {
      const failures: string[] = []
      for (let size = 10; size <= 22; size++) {
        const rows = grouped(4, size)
        const document = documentOf('Groups', [ledger('groups', rows)])
        const pdf = await readPdf(await renderPdf(document, { maxPages: 20 }))
        expect(verify(fixtureOf(`groups-${size}`, document, { maxPagesExpected: 20 }), pdf)).toEqual([])
        for (let group = 1; group <= 4; group++) {
          const last = `ROW-${String(group * size).padStart(4, '0')}`
          const closing = group === 4 ? [`Subtotal G${group}`, 'Grand total'] : [`Subtotal G${group}`]
          const pages = pagesOf(pdf, [last, ...closing])
          if (new Set(pages.values()).size !== 1) failures.push(`groups of ${size}, G${group}: ${JSON.stringify([...pages])}`)
        }
      }
      expect(failures).toEqual([])
    },
    TIMEOUT,
  )
})

describe("a table's first rows", () => {
  // A table of one line and its totals at the foot of a page: the line
  // moves with the header, and the totals, which no rule may break away
  // from rows that move with the header, move with them, rather than
  // standing alone on the next page.
  test(
    'move with the header, and the totals with them, when the totals close the first row',
    async () => {
      const failures: string[] = []
      for (let filler = 62; filler <= 69; filler++) {
        const rows: TableRow[] = [
          { kind: 'detail', cells: ['ROW-9001', 'The one line', '10.00'] },
          { kind: 'total', cells: ['Subtotal', '', '10.00'] },
          { kind: 'total', cells: ['Total', '', '10.00'] },
        ]
        const document = documentOf('One line', [...Array.from({ length: filler }, (_, index) => paragraph(`Filler line ${index + 1}`)), ledger('one', rows)])
        const pdf = await readPdf(await renderPdf(document, { maxPages: 5 }))
        expect(verify(fixtureOf(`one-line-${filler}`, document, { maxPagesExpected: 5 }), pdf)).toEqual([])
        const pages = pagesOf(pdf, ['Key Description Amount', 'ROW-9001', 'Subtotal', 'Total'])
        if (new Set(pages.values()).size !== 1) failures.push(`${filler}: ${JSON.stringify([...pages])}`)
      }
      expect(failures).toEqual([])
    },
    TIMEOUT,
  )
})

describe("a table's planned breaks", () => {
  // pdfmake laid a grouped table out again for every break a rule asked
  // for, about once a page: 800 groups over 67 pages took 17 seconds, 1,600
  // over 134 a minute. Planned, the last pass is laid out a few times,
  // whatever the length.
  test(
    'lay a long grouped table out a few times, not once a page',
    async () => {
      const document = documentOf('Long groups', [ledger('groups', grouped(400, 3))])
      expect(await lastPassLayouts(document, 200)).toBeLessThanOrEqual(3)
    },
    TIMEOUT,
  )

  // The plan only makes, sooner, the breaks the rules would make: the same
  // document renders to the same bytes with the plan and with the rules
  // alone, for every table length across several page ends.
  test(
    'make exactly the breaks the rules alone would make',
    async () => {
      vi.resetModules()
      vi.doMock('./breaks.js', async (original) => ({
        ...(await original<typeof import('./breaks.js')>()),
        plannedBreaks: () => ({ breaks: [], sure: false }),
      }))
      const unplanned = (await import('./node.js')).renderPdf
      vi.doUnmock('./breaks.js')
      vi.resetModules()
      const planned = (await import('./node.js')).renderPdf
      const differing: number[] = []
      for (let size = 6; size <= 14; size++) {
        const document = documentOf('Groups', [paragraph('Before the table'), ledger('groups', grouped(12, size))])
        const [a, b] = await Promise.all(
          [planned(document, { maxPages: 40 }), unplanned(document, { maxPages: 40 })].map((rendering) =>
            rendering.then((bytes) => Buffer.from(bytes).toString('base64')),
          ),
        )
        if (a !== b) differing.push(size)
      }
      expect(differing).toEqual([])
    },
    TIMEOUT,
  )
})

describe("a table's cells, as one walk styles them", () => {
  // tableContent builds a table's rows from styledRows, check.ts holds every
  // cell's text and line to it, and bound.ts counts every row by it: the
  // header in its style, the empty text in italic across the table where
  // the table prints it, and a cell in its own style, else its row's where
  // its own is null, else none. check.ts once took a row's cell styles in
  // place of its style, and lost the 96pt line of a cell under a null one.
  test('styles each cell where tableContent lays it out', () => {
    const table = ledger('walked', [
      { kind: 'groupHeader', cells: ['Region A'], across: true, style: { bold: false } },
      { kind: 'groupFooter', cells: ['A', 'B', 'C'], style: { size: 12 }, cellStyles: [null, { size: 20 }, {}] },
    ])
    expect(styledRows({ ...table, headerStyle: { size: 8 } })).toEqual([
      { kind: 'header', index: undefined, cells: ['Key', 'Description', 'Amount'], styles: [{ size: 8 }, { size: 8 }, { size: 8 }], across: false },
      { kind: 'empty', index: undefined, cells: ['No records'], styles: [{ italic: true }], across: true },
      { kind: 'groupHeader', index: 0, cells: ['Region A'], styles: [{ bold: false }], across: true },
      { kind: 'groupFooter', index: 1, cells: ['A', 'B', 'C'], styles: [{ size: 12 }, { size: 20 }, {}], across: false },
    ])
    expect(styledRows(ledger('detailed', details(1, 1))).map((row) => row.kind)).toEqual(['header', 'detail'])
  })
})

describe("a row under the table's repeated header", () => {
  const columns: TableColumn[] = [
    { width: 'fill', align: 'left' },
    { width: 'fill', align: 'left' },
  ]
  /** A table of two columns, its header 'H1 H2' in `headerStyle`, and `rows`. */
  const under = (headerStyle: TextStyle, rows: TableRow[]): Table => ({
    kind: 'table',
    id: 'under',
    columns,
    header: ['H1', 'H2'],
    headerStyle,
    rows,
    emptyText: 'none',
  })
  /** A row of `kind` whose first cell is `key`, both its cells at `size`. */
  const row = (key: string, size: number, kind: TableRow['kind'] = 'detail'): TableRow => ({ kind, cells: [key, 'x'], style: { size } })
  /** `table` and a line after it, without page regions, on a page whose body is `height` points tall. */
  const onBody = (height: number, table: Table, fonts?: ResolvedFonts): ResolvedDocument => {
    const margin = (841.89 - height) / 2
    const document = bareDocument('Under the header', [table, paragraph('AFTER', { size: 4 })])
    return { ...document, page: { ...PAGE, margins: { ...PAGE.margins, top: margin, bottom: margin } }, ...(fonts === undefined ? {} : { fonts }) }
  }
  /** The refusal `document` is rejected with, or each page's lines as the PDF prints them. */
  const outcome = (document: ResolvedDocument): Promise<RenderRefusal | string[][]> =>
    renderPdf(document, { maxPages: 5 }).then(
      async (pdf) => (await readPdf(pdf)).pages.map((page) => pageLines(page).map((line) => line.text)),
      (error: unknown) => {
        if (error instanceof RenderRefusal) return error
        throw error
      },
    )
  const refused = (what: string, needs: string, body: string): Partial<RenderRefusal> => ({
    code: 'content-too-large',
    subject: 'under',
    message: `${what} has a line that needs ${needs} pt of a page under the table's repeated header, and a point more for rounding; a page's body is ${body} pt where it stands`,
  })

  // pdfmake repeats a table's column header at the top of every page the
  // table continues on, and lays a row that may split out line by line: a
  // line that does not fit what is left of a page goes to the next, under
  // the header, and one that does not fit there either to the page after,
  // where it is dropped. A row of one 40 pt line of Roboto is 50.88 pt with
  // its padding, and fits a body of 76.31 or 102.75 alone, but not under a
  // 40 pt header: the PDF was five pages of the header alone, both rows gone,
  // and the render succeeded. A line needs the header, the row, the table's
  // top rule and the rules under the header and the row, 103.25 pt, and a
  // point more for rounding: refused below 104.25, and printed whole from it.
  test.each<[number, Partial<RenderRefusal> | string[][]]>([
    [76.31, refused('row 0 of table under, a detail row,', '103.25', '76.31')],
    [102.75, refused('row 0 of table under, a detail row,', '103.25', '102.75')],
    [104.24, refused('row 0 of table under, a detail row,', '103.25', '104.24')],
    [104.25, [['H1 H2', 'ROW1 x'], ['H1 H2', 'ROW2 x'], ['AFTER']]],
    [104.75, [['H1 H2', 'ROW1 x'], ['H1 H2', 'ROW2 x'], ['AFTER']]],
  ])(
    'a 40 pt row of Roboto under a 40 pt header, in a body of %d pt',
    async (height, expected) => {
      const result = await outcome(onBody(height, under({ size: 40 }, [row('ROW1', 40), row('ROW2', 40)])))
      if (Array.isArray(expected)) expect(result).toEqual(expected)
      else expect(result).toMatchObject(expected)
    },
    TIMEOUT,
  )

  // The header is as tall as pdfmake lays it out, measured, never one line
  // of its size: a 20 pt header that wraps to three lines in a column of
  // 120 pt, over 40 pt rows, needs 126.69 pt where one line of it would
  // make 79.81, and its rows print whole only from 127.69.
  test(
    'a 40 pt row under a header that wraps to three lines',
    async () => {
      const wrapped: Table = {
        ...under({ size: 20 }, [row('ROW1', 40), row('ROW2', 40)]),
        columns: [
          { width: 120, align: 'left' },
          { width: 'fill', align: 'left' },
        ],
        header: ['A header of words that wrap', 'H2'],
      }
      expect(await outcome(onBody(127.68, wrapped))).toMatchObject(refused('row 0 of table under, a detail row,', '126.69', '127.68'))
      const header = ['A header of H2', 'words that', 'wrap']
      expect(await outcome(onBody(127.69, wrapped))).toEqual([[...header, 'ROW1 x'], [...header, 'ROW2 x'], ['AFTER']])
    },
    TIMEOUT,
  )

  // Each kind of row is laid out under the header as a detail row is, and
  // none repeats with it: pdfmake repeats the column header alone. Under a
  // 9 pt header a 40 pt line needs 66.92 pt, which a body of 55.88 does not
  // hold, though the row alone fits it; each was gone from the PDF. Refused,
  // naming the row and its kind; in a body of 68 each prints whole.
  test.each<[string, TableRow[], string, string]>([
    ['a detail row', [row('BIG', 40)], 'row 0 of table under, a detail row,', 'BIG x'],
    [
      'a group header across the table',
      [{ kind: 'groupHeader', cells: ['BIG'], across: true, style: { size: 40 } }, row('d', 4)],
      'row 0 of table under, a group header row,',
      'BIG',
    ],
    ["a group's footer", [row('d', 4), row('BIG', 40, 'groupFooter')], 'row 1 of table under, a group footer row,', 'BIG x'],
    ['a total', [row('d', 4), row('BIG', 40, 'total')], 'row 1 of table under, a total row,', 'BIG x'],
  ])(
    '%s of a 40 pt line under a 9 pt header',
    async (_, rows, what, line) => {
      expect(await outcome(onBody(55.88, under({ size: 9 }, rows)))).toMatchObject(refused(what, '66.92', '55.88'))
      const pages = await outcome(onBody(68, under({ size: 9 }, rows)))
      expect(Array.isArray(pages) && pages.flat().filter((each) => each === line)).toEqual([line])
    },
    TIMEOUT,
  )

  // A table in a framed section stands in less of the body than the page
  // gives: a border of 2 and a padding of 6 take 16 pt of it. Measured
  // against the whole body, a 30 pt row under a 30 pt header passed in
  // bodies from 80.82 to 95.81 pt and the PDF was five pages of the header
  // alone, both rows gone; it is refused while what the frame leaves is
  // short of the line, and printed whole from 96.82.
  test(
    'a 30 pt row under a 30 pt header, in a framed section',
    async () => {
      const framed = (height: number): ResolvedDocument => {
        const document = onBody(height, under({ size: 30 }, [row('ROW1', 30), row('ROW2', 30)]))
        const [table, after] = document.body
        return { ...document, body: [{ kind: 'section', border: { thickness: 2, color: '#000000' }, padding: 6, blocks: [table!] }, after!] }
      }
      expect(await outcome(framed(96.81))).toMatchObject({
        code: 'content-too-large',
        subject: 'under',
        message: expect.stringMatching(/a page's body is 80\.81 pt where it stands$/) as string,
      })
      expect(await outcome(framed(96.82))).toEqual([['H1 H2', 'ROW1 x'], ['H1 H2', 'ROW2 x'], ['AFTER']])
    },
    TIMEOUT,
  )

  // In a host face of a 2 em line, a 40 pt row is 84 pt and a 40 pt header
  // as tall: the row fits a body of 126 or 169 alone, and was gone under the
  // header, which needs 169.5 pt and a point more. The empty text, in
  // italic at the table's 9 pt, is a 22 pt row in that face, under a 4 pt
  // header of 12: it fits a body of 30 alone, and needs 35.5 pt under the
  // header. Each is measured in the face it prints in.
  const two = withEms(HOST_SANS, 2)
  const fonts: ResolvedFonts = { sans: { normal: face('two', two), bold: face('two-bold', withEms(HOST_SANS_BOLD, 2)), italic: face('two', two) } }
  test.each<[string, number, Table, Partial<RenderRefusal> | string[][]]>([
    [
      'a 40 pt row under a 40 pt header',
      126,
      under({ size: 40 }, [row('ROW1', 40), row('ROW2', 40)]),
      refused('row 0 of table under, a detail row,', '169.50', '126.00'),
    ],
    [
      'a 40 pt row under a 40 pt header',
      169,
      under({ size: 40 }, [row('ROW1', 40), row('ROW2', 40)]),
      refused('row 0 of table under, a detail row,', '169.50', '169.00'),
    ],
    ['a 40 pt row under a 40 pt header', 170.5, under({ size: 40 }, [row('ROW1', 40), row('ROW2', 40)]), [['H1 H2', 'ROW1 x'], ['H1 H2', 'ROW2 x'], ['AFTER']]],
    ['the empty text under a 4 pt header', 30, under({ size: 4 }, []), refused('the empty text of table under', '35.50', '30.00')],
    ['the empty text under a 4 pt header', 36.5, under({ size: 4 }, []), [['H1 H2', 'none'], ['AFTER']]],
  ])(
    'in a face of a 2 em line, %s, in a body of %d pt',
    async (_, height, table, expected) => {
      const result = await outcome(onBody(height, table, fonts))
      if (Array.isArray(expected)) expect(result).toEqual(expected)
      else expect(result).toMatchObject(expected)
    },
    TIMEOUT,
  )
})
