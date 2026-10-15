import { expectation, plainText, type Fixture } from '../fixture.js'
import { details, documentOf, heading, ledger, totalRow } from './build.js'

/** A normal short report: a title, one row and its total, and the footer on its one page. */
const rows = details(1, 1)
const title = heading('Invoice 2026-0001')
const table = ledger('lines', [...rows, totalRow(rows)])
const document = documentOf('One row', [title, table])

export const oneRow: Fixture = {
  id: 'one-row',
  title: 'One row: a title, one row, its total and the footer on one page',
  document,
  maxPages: 5,
  expect: expectation(document, {
    maxPagesExpected: 1,
    exactText: [plainText(title.runs) ?? '', ...table.rows.flatMap((row) => row.cells.filter((cell) => cell !== ''))],
  }),
}
