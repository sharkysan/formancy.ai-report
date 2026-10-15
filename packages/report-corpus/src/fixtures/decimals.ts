import type { TableRow } from '../document.js'
import { expectation, type Fixture } from '../fixture.js'
import { documentOf, ledger } from './build.js'

/**
 * Values a JavaScript `Number` would change, and the small ones a careless
 * format would: each must reach the page exactly as the document holds it.
 * The amount column is wide enough for the longest on one line, so an engine
 * has no reason to break one.
 */
const rows: readonly TableRow[] = [
  { kind: 'detail', cells: ['DEC-01', 'Fourteen integer digits and four decimals', '99999999999999.9999'] },
  { kind: 'detail', cells: ['DEC-02', 'One more than two to the 53rd', '9007199254740993'] },
  { kind: 'detail', cells: ['DEC-03', 'A negative cent', '-0.01'] },
  { kind: 'detail', cells: ['DEC-04', 'Zero with its decimals', '0.00'] },
  { kind: 'detail', cells: ['DEC-05', 'Swiss grouping with a typographic apostrophe', 'CHF 1’234.50'] },
]
const document = documentOf('Decimals', [
  ledger('values', rows, [
    { width: 70, align: 'left' },
    { width: 'fill', align: 'left' },
    { width: 140, align: 'right' },
  ]),
])

export const decimals: Fixture = {
  id: 'decimals',
  title: 'Exact values: large decimals, integers past 2^53, signed zeros and Swiss grouping, verbatim',
  document,
  maxPages: 5,
  expect: expectation(document, { maxPagesExpected: 1, exactText: rows.map((row) => row.cells[2] ?? '') }),
}
