import pdfmake from 'pdfmake'
import { readPdf, verify, type ReadPdf } from '@formancy/report-corpus'
import type { ResolvedDocument, TableRow } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import { renderPdf } from './node.js'
import { details, documentOf, fixtureOf, ledger, paragraph, TIMEOUT, totalRow } from './testing/documents.js'
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
  test('stand on the page of the last row they close, wherever the page ends', async () => {
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
  }, TIMEOUT)

  // A group's subtotal stood alone at the top of a page under the repeated
  // header, apart from every row it adds up, and so did the grand total.
  test("keep a group's footer with its last row, and the grand total with the last group's footer", async () => {
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
  }, TIMEOUT)
})

describe("a table's first rows", () => {
  // A table of one line and its totals at the foot of a page: the line
  // moves with the header, and the totals, which no rule may break away
  // from rows that move with the header, move with them, rather than
  // standing alone on the next page.
  test('move with the header, and the totals with them, when the totals close the first row', async () => {
    const failures: string[] = []
    for (let filler = 62; filler <= 69; filler++) {
      const rows: TableRow[] = [{ kind: 'detail', cells: ['ROW-9001', 'The one line', '10.00'] }, { kind: 'total', cells: ['Subtotal', '', '10.00'] }, { kind: 'total', cells: ['Total', '', '10.00'] }]
      const document = documentOf('One line', [...Array.from({ length: filler }, (_, index) => paragraph(`Filler line ${index + 1}`)), ledger('one', rows)])
      const pdf = await readPdf(await renderPdf(document, { maxPages: 5 }))
      expect(verify(fixtureOf(`one-line-${filler}`, document, { maxPagesExpected: 5 }), pdf)).toEqual([])
      const pages = pagesOf(pdf, ['Key Description Amount', 'ROW-9001', 'Subtotal', 'Total'])
      if (new Set(pages.values()).size !== 1) failures.push(`${filler}: ${JSON.stringify([...pages])}`)
    }
    expect(failures).toEqual([])
  }, TIMEOUT)
})

describe("a table's planned breaks", () => {
  // pdfmake laid a grouped table out again for every break a rule asked
  // for, about once a page: 800 groups over 67 pages took 17 seconds, 1,600
  // over 134 a minute. Planned, the last pass is laid out a few times,
  // whatever the length.
  test('lay a long grouped table out a few times, not once a page', async () => {
    const document = documentOf('Long groups', [ledger('groups', grouped(400, 3))])
    expect(await lastPassLayouts(document, 200)).toBeLessThanOrEqual(3)
  }, TIMEOUT)

  // The plan only makes, sooner, the breaks the rules would make: the same
  // document renders to the same bytes with the plan and with the rules
  // alone, for every table length across several page ends.
  test('make exactly the breaks the rules alone would make', async () => {
    vi.resetModules()
    vi.doMock('./breaks.js', async (original) => ({ ...(await original<typeof import('./breaks.js')>()), plannedBreaks: () => ({ breaks: [], sure: false }) }))
    const unplanned = (await import('./node.js')).renderPdf
    vi.doUnmock('./breaks.js')
    vi.resetModules()
    const planned = (await import('./node.js')).renderPdf
    const differing: number[] = []
    for (let size = 6; size <= 14; size++) {
      const document = documentOf('Groups', [paragraph('Before the table'), ledger('groups', grouped(12, size))])
      const [a, b] = await Promise.all([planned(document, { maxPages: 40 }), unplanned(document, { maxPages: 40 })].map((rendering) => rendering.then((bytes) => Buffer.from(bytes).toString('base64'))))
      if (a !== b) differing.push(size)
    }
    expect(differing).toEqual([])
  }, TIMEOUT)
})
