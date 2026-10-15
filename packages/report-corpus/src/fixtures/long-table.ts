import { expectation, type Fixture } from '../fixture.js'
import { details, documentOf, ledger, totalRow } from './build.js'
import { pagesOfRows } from './geometry.js'

/**
 * Three hundred detail rows over several pages: every row once and in order,
 * the column header at the top of every page, "Page n of N" at the foot. Its
 * page count lies between what the densest and the loosest plausible rows
 * give (`pagesOfRows`); the title is in the page header, so the table starts
 * at the top of the first page's body.
 */
const rows = details(1, 300)
const total = totalRow(rows)
const document = documentOf('Long table', [ledger('lines', [...rows, total])])
const pages = pagesOfRows(rows.length + 1)

export const longTable: Fixture = {
  id: 'long-table',
  title: 'A long table: 300 rows, the header on every page, Page n of N',
  document,
  maxPages: 50,
  expect: expectation(document, {
    minPagesExpected: pages.min,
    maxPagesExpected: pages.max,
    exactText: [total.cells[2] ?? ''],
  }),
}
