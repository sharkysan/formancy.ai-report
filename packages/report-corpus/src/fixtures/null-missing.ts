import type { TableRow } from '../document.js'
import { expectation, type Fixture } from '../fixture.js'
import { documentOf, ledger, totalRow } from './build.js'

/**
 * Rows whose values are missing: empty cells, and the dash the runtime prints
 * for a null. Every row still prints, an empty cell prints as nothing, and an
 * engine does not stumble on a cell with no text. Each row is read cell by
 * cell, so one row's dash cannot stand in for another's.
 */
const rows: readonly TableRow[] = [
  { kind: 'detail', cells: ['NUL-01', '', '—'] },
  { kind: 'detail', cells: ['NUL-02', '—', ''] },
  { kind: 'detail', cells: ['NUL-03', '', ''] },
  { kind: 'detail', cells: ['NUL-04', 'Present', '1.00'] },
]
const document = documentOf('Null and missing values', [ledger('values', [...rows, totalRow(rows.filter((row) => /^\d/.test(row.cells[2] ?? '')))])])

export const nullMissing: Fixture = {
  id: 'null-missing',
  title: 'Null and missing values: empty cells and placeholders, every row still present',
  document,
  maxPages: 5,
  expect: expectation(document, { maxPagesExpected: 1 }),
}
