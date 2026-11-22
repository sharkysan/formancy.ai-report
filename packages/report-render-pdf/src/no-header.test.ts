import { readPdf, TITLES_FROM_GROUPS_DATA, TITLES_FROM_GROUPS_REPORT, verify, type ReadPdf } from '@formancy/report-corpus'
import { RenderRefusal, resolveReport, type ResolvedDocument, type Table, type TableRow } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import { renderPdf } from './node.js'
import { bareDocument, details, documentOf, fixtureOf, ledger, PAGE, paragraph, TIMEOUT, totalRow } from './testing/documents.js'
import { lastPassLayouts } from './testing/layouts.js'
import { pageLines, pageOf } from './testing/lines.js'

/**
 * A table the runtime writes without a header row (0078) -- one whose
 * column titles come from its groups -- proved on the PDFs read back with
 * PDF.js (0003): by the corpus's checks, which hold its first line under
 * the table's top rule on every page it reaches, where a header's line
 * would stand, and by the page each row's key is printed on. It prints no
 * band of nothing above its rows, keeps its first rows on their page as a
 * table with a header does, and breaks as one does.
 */

/** The ledger's columns over `rows`, with no header row: a table whose every title is empty, as the runtime resolves it. */
function headerless(id: string, rows: readonly TableRow[]): Table {
  const { header: _none, ...table } = ledger(id, rows)
  return table
}

/** `groups` groups of `size` detail rows, each headed across the table by its own column titles and closed by a subtotal, and a total under all. */
function sections(groups: number, size: number): TableRow[] {
  const rows: TableRow[] = []
  for (let group = 1; group <= groups; group++) {
    const own = details((group - 1) * size + 1, group * size)
    rows.push({ kind: 'groupHeader', cells: [`Section S${group}: key, item, amount`], across: true }, ...own, {
      ...totalRow(own, `Subtotal S${group}`),
      kind: 'groupFooter',
    })
  }
  return [...rows, totalRow(rows, 'Grand total')]
}

/** The rules of every page stroked in black, the colour of the rule under a header row alone. */
const blackRules = (pdf: ReadPdf): number => pdf.pages.flatMap((page) => page.paths.filter((path) => path.stroke === '#000000' && path.height < 0.01)).length

/** `document` rendered by `renderer`, as base64, for comparing bytes. */
const bytes = (rendering: Promise<Uint8Array>): Promise<string> => rendering.then((pdf) => Buffer.from(pdf).toString('base64'))

describe('a table without a header row', () => {
  // A header row of nothing printed a band a line tall above the table,
  // and repeated it on every page; and the rule under it, the header's,
  // is black where every other is grey. The same table with its header
  // draws that rule once a page, so the count sees it where it is drawn.
  test(
    'prints no band above its first line on any page, and no rule of a header',
    async () => {
      const rows = sections(4, 30)
      const document = documentOf('Sections', [paragraph('Before the table'), headerless('sections', rows)])
      const pdf = await readPdf(await renderPdf(document, { maxPages: 10 }))
      expect(pdf.pages.length).toBeGreaterThan(2)
      expect(verify(fixtureOf('sections', document, { minPagesExpected: 3, maxPagesExpected: 4 }), pdf)).toEqual([])
      expect(pageLines(pdf.pages[0]!).some((line) => line.text === 'Key Description Amount')).toBe(false)
      expect(blackRules(pdf)).toBe(0)
      const headed = await readPdf(await renderPdf(documentOf('Sections', [paragraph('Before the table'), ledger('sections', rows)]), { maxPages: 10 }))
      expect(blackRules(headed)).toBe(headed.pages.length)
    },
    TIMEOUT,
  )

  // With no header for pdfmake to keep them with, the table's first group
  // header could end a page alone above the rows it heads; and a one-line
  // table's totals could stand alone on the next page. Swept across the
  // page's foot by lines of text above the table, each moves with what it
  // heads or closes, as under a header.
  test(
    "keeps its first group header with its first row, and a one-line table's totals with its line, at a page's foot",
    async () => {
      const failures: string[] = []
      for (let filler = 62; filler <= 69; filler++) {
        const lines = Array.from({ length: filler }, (_, index) => paragraph(`Filler line ${index + 1}`))
        const one: TableRow[] = [
          { kind: 'detail', cells: ['ROW-9001', 'The one line', '10.00'] },
          { kind: 'total', cells: ['Subtotal', '', '10.00'] },
          { kind: 'total', cells: ['Total', '', '10.00'] },
        ]
        for (const [name, rows, keys] of [
          ['grouped', sections(2, 3), ['Section S1: key, item, amount', 'ROW-0001']],
          ['one line', one, ['ROW-9001', 'Subtotal', 'Total']],
        ] as const) {
          const document = documentOf('First rows', [...lines, headerless('first', rows)])
          const pdf = await readPdf(await renderPdf(document, { maxPages: 5 }))
          expect(verify(fixtureOf(`${name}-${filler}`, document, { maxPagesExpected: 5 }), pdf)).toEqual([])
          const pages = keys.map((key) => pageOf(pdf, key))
          if (new Set(pages).size !== 1) failures.push(`${name}, ${filler} lines before: ${pages.join(', ')}`)
        }
      }
      expect(failures).toEqual([])
    },
    TIMEOUT,
  )

  // Its breaks are planned as a headed table's are: laid out a few times,
  // never once a page, and to the very bytes the rules alone make.
  test(
    'lays a long grouped table out a few times, and makes exactly the breaks the rules alone would make',
    async () => {
      expect(await lastPassLayouts(documentOf('Long sections', [headerless('sections', sections(400, 3))]), 200)).toBeLessThanOrEqual(3)
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
        const document = documentOf('Sections', [paragraph('Before the table'), headerless('sections', sections(12, size))])
        const [a, b] = await Promise.all([bytes(planned(document, { maxPages: 40 })), bytes(unplanned(document, { maxPages: 40 }))])
        if (a !== b) differing.push(size)
      }
      expect(differing).toEqual([])
    },
    TIMEOUT,
  )

  // In a keep-together block, and in the page footer, no rule breaks a
  // table, and the plan is none: each is drawn under a header of no height
  // all the same, the kept one held by the corpus's check to no band and
  // the footer's, which no expectation reads, to no rule of a header.
  test(
    'prints no band in a keep-together block, and no rule of a header in the page footer',
    async () => {
      const kept = headerless('kept', details(1, 3))
      const footer = headerless('footer', [{ kind: 'detail', cells: ['FOOT-1', 'In the footer', '1.00'] }])
      const document: ResolvedDocument = {
        ...documentOf('Kept', [paragraph('Before the block'), { kind: 'keepTogether', blocks: [paragraph('Kept lines'), kept] }]),
        pageFooter: [footer],
      }
      const pdf = await readPdf(await renderPdf(document, { maxPages: 2 }))
      expect(verify(fixtureOf('kept', document, { maxPagesExpected: 1 }), pdf)).toEqual([])
      expect(blackRules(pdf)).toBe(0)
    },
    TIMEOUT,
  )
})

describe('a report whose column titles are empty, from its definition to its PDF', () => {
  // The case 0078 is for, as a person writes it: every column titled with
  // nothing or a space, a group header that names the columns across the
  // table. The runtime resolves no header row, and the PDF prints no band
  // over the rows on any page, held by the corpus's checks; a runtime that
  // wrote the blank titles as a header row gave the renderer the band.
  test(
    'resolves no header row, and prints none over its rows on any page',
    async () => {
      const outcome = resolveReport(TITLES_FROM_GROUPS_REPORT, TITLES_FROM_GROUPS_DATA, { mode: 'final', creationDate: '2026-11-22T08:00:00Z' })
      if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path}`).join('; '))
      const { document } = outcome
      const table = document.body.find((block): block is Table => block.kind === 'table')
      expect(table).toBeDefined()
      expect(table).not.toHaveProperty('header')
      expect(table?.rows[0]).toMatchObject({ kind: 'groupHeader', cells: ['Labour: number, item and amount'], across: true })
      const pdf = await readPdf(await renderPdf(document, { maxPages: 10 }))
      expect(pdf.pages.length).toBeGreaterThan(2)
      expect(verify(fixtureOf('titles-from-groups-report', document, { minPagesExpected: 3, maxPagesExpected: 4 }), pdf)).toEqual([])
      expect(blackRules(pdf)).toBe(0)
    },
    TIMEOUT,
  )
})

describe("a row under a table's top rule, with no header row", () => {
  /** `rows` of 40 pt Roboto and a line after them, without page regions, on a page whose body is `height` points tall. */
  const onBody = (height: number): ResolvedDocument => {
    const margin = (841.89 - height) / 2
    const rows: TableRow[] = ['ROW1', 'ROW2'].map((key) => ({ kind: 'detail', cells: [key, 'x'], style: { size: 40 } }))
    const table: Table = {
      kind: 'table',
      id: 'under',
      columns: [
        { width: 'fill', align: 'left' },
        { width: 'fill', align: 'left' },
      ],
      rows,
      emptyText: 'none',
    }
    const document = bareDocument('Under the top rule', [table, paragraph('AFTER', { size: 4 })])
    return { ...document, page: { ...PAGE, margins: { ...PAGE.margins, top: margin, bottom: margin } } }
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

  // No header repeats over the row: a 40 pt line of Roboto needs the
  // table's top rule, the row's padding, the line and the rule under it,
  // 51.88 pt, and a point more for rounding, where under a header of its
  // size it needed 103.25. A page is never asked to hold room for a
  // header the table does not print, nor allowed less than the line.
  test.each<[number, Partial<RenderRefusal> | string[][]]>([
    [
      52.87,
      {
        code: 'content-too-large',
        subject: 'under',
        message:
          "row 0 of table under, a detail row, has a line that needs 51.88 pt of a page under the table's top rule, and a point more for rounding; a page's body is 52.87 pt where it stands",
      },
    ],
    [52.88, [['ROW1 x'], ['ROW2 x'], ['AFTER']]],
  ])(
    'a 40 pt row of Roboto, in a body of %d pt',
    async (height, expected) => {
      const result = await outcome(onBody(height))
      if (Array.isArray(expected)) expect(result).toEqual(expected)
      else expect(result).toMatchObject(expected)
    },
    TIMEOUT,
  )
})
