import type { Block, Image, ResolvedDocument, TableRow } from '../document.js'
import { expectation, type Fixture } from '../fixture.js'
import { details, documentOf, ledger, paragraph, totalRow } from './build.js'
import { pagesOfRows, SMALL_SIZE } from './geometry.js'
import { SVG_MARK } from './svg.js'

/**
 * Page 1's own header (0060), in the page header's place, over a long
 * grouped table that runs on under the page header: a letterhead taller
 * than the page header, with a drawing in it; none, so that page 1's body
 * starts at the top margin; and a header of page 1's own shorter than the
 * page header. Each page's body starts under the header that page prints,
 * so page 1 holds more rows than the others or fewer, and the table's
 * column header and group headers must still stand where they should on
 * every page, over rows that wrap nowhere.
 *
 * Not in `ALL_FIXTURES`, which is the corpus the renderer trial chose an
 * engine on (0005): neither trial adapter draws a first page header, and
 * both refuse one (`trial/undrawn.ts`). The renderer answers to these as
 * it answers to those.
 */

/** Groups of `size` detail rows, each under its header and over its subtotal, and the total under them all. */
function groupedRows(groups: number, size: number): TableRow[] {
  const rows: TableRow[] = []
  for (let group = 0; group < groups; group++) {
    const label = `G${String(group + 1).padStart(2, '0')}`
    const lines = details(group * size + 1, (group + 1) * size)
    rows.push({ kind: 'groupHeader', cells: [`Group ${label}`, '', ''] }, ...lines, {
      kind: 'groupFooter',
      cells: [`Subtotal ${label}`, '', totalRow(lines).cells[2]!],
    })
  }
  return [...rows, totalRow(rows)]
}

const ROWS = groupedRows(14, 9)

/** The corpus's mark, 40 points a side: drawn on page 1 alone, in its own header. */
const MARK: Image = { kind: 'image', asset: { id: 'letterhead-mark', mediaType: 'image/svg+xml', bytes: SVG_MARK }, width: 40, height: 40, fit: 'contain' }

/** A letterhead of five lines and a drawing: some 110 points, where the page header takes one line of 8 points. */
const LETTERHEAD: readonly Block[] = [
  MARK,
  { kind: 'spacer', height: 6 },
  paragraph('Invented Supplies Ltd', { size: 14, bold: true }),
  paragraph('1 Example Street, 1000 Sample Town'),
  paragraph('Order 2026-0042, placed on 15 November 2026'),
  paragraph('Delivery to the sample warehouse, gate 3'),
]

/** A first page header of one line, under a page header of three. */
const SHORT_HEADER: readonly Block[] = [paragraph('Order 2026-0042', { size: SMALL_SIZE })]
const LONG_PAGE_HEADER: readonly Block[] = [
  paragraph('Order 2026-0042, continued', { size: SMALL_SIZE }),
  paragraph('Invented Supplies Ltd, 1 Example Street, 1000 Sample Town', { size: SMALL_SIZE }),
  paragraph('Delivery to the sample warehouse, gate 3', { size: SMALL_SIZE }),
]

/** A fixture of the grouped table under `firstPageHeader` on page 1 and `pageHeader`, or the corpus's, on the pages after it. */
function underFirstPage(id: string, title: string, firstPageHeader: readonly Block[], pageHeader?: readonly Block[]): Fixture {
  const titled = documentOf(title, [ledger('lines', ROWS)])
  const document: ResolvedDocument = { ...titled, firstPageHeader, pageHeader: pageHeader ?? titled.pageHeader }
  const pages = pagesOfRows(ROWS.length)
  // Page 1's body is a letterhead shorter, or a line taller, than the others, and a group header moved to the next page takes a row's room.
  const expect = expectation(document, { minPagesExpected: pages.min, maxPagesExpected: pages.max + 1, exactText: [ROWS.at(-1)!.cells[2]!] })
  return { id: `first-page-${id}`, title, document, maxPages: 20, expect }
}

export const firstPageLetterhead = underFirstPage('letterhead', 'A letterhead on page 1, taller than the page header', LETTERHEAD)
export const firstPageNone = underFirstPage('none', 'No header on page 1, the page header on every other page', [])
export const firstPageShorter = underFirstPage('shorter', 'A header on page 1 shorter than the page header', SHORT_HEADER, LONG_PAGE_HEADER)

/** The first page header fixtures, which the renderer answers to beside `ALL_FIXTURES`. */
export const FIRST_PAGE_FIXTURES: readonly Fixture[] = [firstPageLetterhead, firstPageNone, firstPageShorter]
