import type { Table, TableRow } from '../document.js'
import { expectation, type Fixture } from '../fixture.js'
import { amount, details, documentOf, ledger, totalRow } from './build.js'
import { HEADERLESS_ROWS_PER_PAGE_RANGE } from './geometry.js'
import { groupStarts } from './group-boundary.js'

/**
 * A table whose group headers name its columns (0078): one table over
 * sections of different kinds, each group header naming its section over
 * the first column and the columns' titles over the others, so the
 * table's own titles are empty and the runtime writes it no header row.
 * Drawn with one, it printed a band of nothing over its rows, repeated on
 * every page; the checks hold its first line under its top rule on every
 * page it reaches, where a header's would stand, and its Word file to no
 * header row and no row marked to repeat. The runtime writes a group
 * header as one cell across the table, never three: the report it would
 * be the document of is `titles-from-groups-report.ts`'s, whose resolved
 * document both engines' tests draw too.
 *
 * Its groups are placed as group-boundary's are (`groupStarts`), for the
 * rows a page holds of a table that repeats nothing over them, one more
 * than under a header: wherever an engine's page breaks fall, one group
 * header would stand last on its page if the engine let it, which a table
 * without a header has no header row to keep with. Its first row is a
 * group header, at the top of the first page's body.
 *
 * Not in `ALL_FIXTURES`, which is the corpus the renderer trial chose an
 * engine on (0005): the trial's documents always had a header row.
 */

function sections(): TableRow[] {
  const starts = groupStarts(HEADERLESS_ROWS_PER_PAGE_RANGE)
  const rows: TableRow[] = []
  let detail = 1
  starts.forEach((start, index) => {
    const label = `S${String(index + 1).padStart(2, '0')}`
    // The last group has three detail rows; every other one runs to the next group's header.
    const count = (starts[index + 1] ?? start + 5) - start - 2
    const group = details(detail, detail + count - 1)
    detail += count
    const subtotal = totalRow(group).cells[2] ?? amount(0n)
    rows.push({ kind: 'groupHeader', cells: [`Section ${label}`, 'Description', 'Amount'] }, ...group, {
      kind: 'groupFooter',
      cells: [`Subtotal ${label}`, '', subtotal],
    })
  })
  return [...rows, totalRow(rows)]
}

const rows = sections()
/** The ledger's columns with no header row, as the runtime resolves a table whose every column title is empty. */
const { header: _titles, ...table }: Table = ledger('sections', rows)
const document = documentOf('Titles from groups', [table])
const pages = {
  min: Math.ceil(rows.length / HEADERLESS_ROWS_PER_PAGE_RANGE.max),
  max: Math.ceil(rows.length / HEADERLESS_ROWS_PER_PAGE_RANGE.min),
}

export const titlesFromGroups: Fixture = {
  id: 'titles-from-groups',
  title: 'A table whose column titles come from its groups: no header row, its first line under its top rule on every page, no orphaned group header',
  document,
  maxPages: 80,
  expect: expectation(document, {
    exactText: rows.filter((row) => row.kind === 'groupFooter' || row.kind === 'total').map((row) => row.cells[2] ?? ''),
    minPagesExpected: pages.min,
    // A group header moved to the next page takes one row's space from each page it passes.
    maxPagesExpected: pages.max + 1,
  }),
}

/** The fixtures of 0078, beside section 20's and the others. */
export const HEADERLESS_FIXTURES: readonly Fixture[] = [titlesFromGroups]
