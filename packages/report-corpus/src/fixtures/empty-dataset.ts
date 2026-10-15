import { expectation, type Fixture } from '../fixture.js'
import { documentOf, heading, ledger, totalRow } from './build.js'

/**
 * A table with no rows: its header, the empty text in place of the rows, and
 * a total of zero. On one page -- an engine that breaks before an empty table,
 * or after a table that ends exactly at the foot of a page, prints a blank one.
 */
const total = totalRow([])
const table = ledger('open-invoices', [total])
const document = documentOf('Empty dataset', [heading('Open invoices'), table])

export const emptyDataset: Fixture = {
  id: 'empty-dataset',
  title: 'An empty dataset: the header, the empty text and a zero total on one page',
  document,
  maxPages: 5,
  expect: expectation(document, {
    maxPagesExpected: 1,
    exactText: [...table.header, table.emptyText, ...total.cells.filter((cell) => cell !== '')],
  }),
}
