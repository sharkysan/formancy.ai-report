import type { TableRow } from '../document.js'
import { expectation, type Fixture } from '../fixture.js'
import { amount, details, documentOf, ledger, totalRow } from './build.js'
import { pagesOfRows, ROWS_PER_PAGE_RANGE } from './geometry.js'

/**
 * Groups of rows, each under a group header and over a subtotal, sized so
 * that wherever an engine's page breaks fall, one group header would fall
 * last on a page if the engine let it.
 *
 * How: every row is one line, so a page holds some number of rows under the
 * repeated column header -- between 29 and 60 for any plausible row height
 * (`ROWS_PER_PAGE_RANGE`). The table starts at the top of the first page's
 * body (the title is in the page header), so with `n` rows a page, the row at
 * position `p` (from 0) is last on its page exactly when `p mod n = n - 1`.
 * Group headers are placed, one at a time, at the next position that is last
 * on a page for some `n` not yet covered, until every `n` in the range is.
 * An engine that does not keep a group header with its first row therefore
 * orphans one, whatever its row height; the fixture test recounts it.
 */
function groupStarts(): number[] {
  const uncovered = new Set<number>()
  for (let perPage = ROWS_PER_PAGE_RANGE.min; perPage <= ROWS_PER_PAGE_RANGE.max; perPage++) uncovered.add(perPage)
  const starts = [0]
  while (uncovered.size > 0) {
    // A group is its header, at least one detail row and its subtotal.
    const earliest = starts.at(-1)! + 3
    const next = Math.min(...[...uncovered].map((perPage) => earliest + ((((perPage - 1 - earliest) % perPage) + perPage) % perPage)))
    starts.push(next)
    for (const perPage of uncovered) if (next % perPage === perPage - 1) uncovered.delete(perPage)
  }
  return starts
}

function groupedRows(): TableRow[] {
  const starts = groupStarts()
  const rows: TableRow[] = []
  let detail = 1
  starts.forEach((start, index) => {
    const label = `R${String(index + 1).padStart(2, '0')}`
    // The last group has three detail rows; every other one runs to the next group's header.
    const count = (starts[index + 1] ?? start + 5) - start - 2
    const group = details(detail, detail + count - 1)
    detail += count
    const subtotal = totalRow(group).cells[2] ?? amount(0n)
    rows.push({ kind: 'groupHeader', cells: [`Region ${label}`, '', ''] }, ...group, { kind: 'groupFooter', cells: [`Subtotal ${label}`, '', subtotal] })
  })
  return [...rows, totalRow(rows)]
}

const rows = groupedRows()
const document = documentOf('Group boundary', [ledger('lines', rows)])
const pages = pagesOfRows(rows.length)

export const groupBoundary: Fixture = {
  id: 'group-boundary',
  title: 'Groups that end at page boundaries: no orphaned group header, exact subtotals',
  document,
  maxPages: 80,
  expect: expectation(document, {
    exactText: rows.filter((row) => row.kind === 'groupFooter' || row.kind === 'total').map((row) => row.cells[2] ?? ''),
    minPagesExpected: pages.min,
    // A group header moved to the next page takes one row's space from each page it passes.
    maxPagesExpected: pages.max + 1,
  }),
}
