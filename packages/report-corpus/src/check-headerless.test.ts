import type { CustomTableLayout, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { describe, expect, test } from 'vitest'
import { verify } from './checks.js'
import type { ResolvedDocument, TableRow } from './document.js'
import { expectation, type Fixture } from './fixture.js'
import { readPdf } from './read-pdf.js'
import { pdfmakePdf } from './testing/pdfmake.js'

/**
 * A table without a header row (0078), whose column titles come from its
 * groups, held to its PDF: its first line under the table's top rule on
 * every page it reaches, where a header row's line would stand. The PDFs
 * are pdfmake's, made directly, with the renderer's look -- half-point
 * rules across the table, none at its sides, 4pt of padding at the sides
 * and 2pt above and below -- one drawn right and each of the others
 * printing the header the document has not in one way a check exists to
 * see. The right one passes every check, or a check that always
 * complained would pass each test below.
 */
const MARGIN = 40
const key = (n: number): string => `ROW-${String(n).padStart(4, '0')}`
const detail = (n: number): TableRow => ({ kind: 'detail', cells: [key(n), `Item ${n}`, `${n}.00`] })
/** Each group's header says what its columns are: the table's own titles are empty. */
const ROWS: readonly TableRow[] = [
  { kind: 'groupHeader', cells: ['Parts: key, item and amount'], across: true },
  ...Array.from({ length: 40 }, (_, i) => detail(i + 1)),
  { kind: 'groupHeader', cells: ['Labour: key, task and amount'], across: true },
  ...Array.from({ length: 40 }, (_, i) => detail(i + 41)),
  { kind: 'total', cells: ['Total', '', '3240.00'] },
]

const DOCUMENT: ResolvedDocument = {
  info: { title: 'Headerless', creationDate: '2026-01-01T00:00:00Z' },
  page: { size: 'A4', orientation: 'portrait', margins: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } },
  pageHeader: [{ kind: 'paragraph', runs: [{ text: 'Headerless report' }] }],
  pageFooter: [],
  body: [
    {
      kind: 'table',
      id: 'lines',
      columns: [
        { width: 100, align: 'left' },
        { width: 'fill', align: 'left' },
        { width: 80, align: 'right' },
      ],
      rows: ROWS,
      emptyText: 'No lines',
    },
  ],
}

const FIXTURE: Fixture = {
  id: 'headerless',
  title: 'headerless',
  document: DOCUMENT,
  maxPages: 10,
  expect: expectation(DOCUMENT, { minPagesExpected: 2, maxPagesExpected: 2 }),
}

const layout = (header: { readonly padding: number; readonly rule: number } | undefined): CustomTableLayout => ({
  hLineWidth: (index) => (header !== undefined && index === 1 ? header.rule : 0.5),
  vLineWidth: () => 0,
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: (index) => (header !== undefined && index === 0 ? header.padding : 2),
  paddingBottom: (index) => (header !== undefined && index === 0 ? header.padding : 2),
})

/**
 * The table as pdfmake draws it, its rows kept whole, under `header` where
 * one is given: a row of cells that print nothing, its padding and the
 * width of the rule under it, repeated on every page.
 */
function definition(header?: { readonly cells: string; readonly padding: number; readonly rule: number }): TDocumentDefinitions {
  const cell = (text: string, column: number, span?: number): TableCell => ({
    text,
    alignment: column === 2 ? 'right' : 'left',
    ...(span === undefined ? {} : { colSpan: span }),
  })
  const rows = ROWS.map((row): TableCell[] =>
    row.across === true ? [cell(row.cells[0]!, 0, 3), cell('', 1), cell('', 2)] : row.cells.map((text, column) => cell(text, column)),
  )
  const body = header === undefined ? rows : [[0, 1, 2].map((column) => cell(header.cells, column)), ...rows]
  return {
    pageSize: 'A4',
    pageMargins: [MARGIN, MARGIN + 20, MARGIN, MARGIN],
    header: () => ({ text: 'Headerless report', margin: [MARGIN, MARGIN, MARGIN, 0] }),
    content: [
      {
        table: { headerRows: header === undefined ? 0 : 1, dontBreakRows: true, widths: [100, '*', 80], body },
        layout: layout(header),
        fontSize: 9,
      },
    ],
  }
}

async function problems(made: TDocumentDefinitions): Promise<string[]> {
  return verify(FIXTURE, await readPdf(await pdfmakePdf(made)))
}

describe('verify, on a table without a header row', () => {
  // The right PDF: each problem below is shown to be the one defect of its
  // PDF, never one every PDF of such a table has.
  test('finds nothing wrong with a table whose first line stands under its top rule on every page', async () => {
    expect(await problems(definition())).toEqual([])
  })

  // The band a table whose every title is empty printed before 0078: an
  // empty header row, a line tall, and the rule under it, on every page.
  test('finds the band of an empty header row above the first line on every page', async () => {
    expect(await problems(definition({ cells: '', padding: 2, rule: 0.5 }))).toEqual([
      "headerless: page 1: the first line of table lines, 'Parts: key, item and amount', stands under a band of 15.05 pt between two rules that prints nothing",
      "headerless: page 2: the first line of table lines, 'ROW-0047 Item 47 47.00', stands under a band of 15.05 pt between two rules that prints nothing",
    ])
  })

  // A header row of white space is a band a line tall, which is as tall
  // as a row: a band no more than a row's height is one.
  test('finds the band of a header row of white space', async () => {
    const found = await problems(definition({ cells: ' ', padding: 2, rule: 0.5 }))
    expect(found).toHaveLength(2)
    expect(found.every((problem) => / stands under a band of [\d.]+ pt between two rules that prints nothing$/.test(problem))).toBe(true)
  })

  // A header row of nothing and no rule under it: no second rule, and the
  // first line stands the empty row's line and padding lower under the top
  // rule than a row stands under its own.
  test('finds a first line standing lower under the top rule than the rows stand under theirs', async () => {
    expect(await problems(definition({ cells: '', padding: 2, rule: 0 }))).toEqual([
      "headerless: page 1: the first line of table lines, 'Parts: key, item and amount', stands 17.95 pt under the rule above it, and its rows 3.4 pt under theirs",
      "headerless: page 2: the first line of table lines, 'ROW-0047 Item 47 47.00', stands 17.95 pt under the rule above it, and its rows 3.4 pt under theirs",
    ])
  })
})
