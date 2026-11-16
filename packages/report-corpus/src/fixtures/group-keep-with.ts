import type { TableRow } from '../document.js'
import { expectation, type Fixture } from '../fixture.js'
import { amount, details, documentOf, ledger, totalRow } from './build.js'
import { pagesOfRows, ROWS_PER_PAGE_RANGE } from './geometry.js'

/**
 * Groups whose headers each keep their group's first three rows on their
 * page (0059), placed so that wherever an engine's page breaks fall, an
 * engine that kept a group header with fewer -- with its first row, as
 * every header always was, or with two -- would leave one at the foot of a
 * page with one of its rows under it, or with two.
 *
 * How: as group-boundary's. Every row is one line, so a page holds some
 * number `n` of rows under the repeated column header, between 29 and 60
 * for any plausible row height (`ROWS_PER_PAGE_RANGE`), and the table
 * starts at the top of the first page's body. A row at position `p`, from
 * 0, then has `n - 1 - p mod n` rows under it on its page, and a group
 * header is placed, one at a time, at the next position that leaves one or
 * two of its rows room for some `n` not yet covered for that room.
 *
 * An engine that keeps fewer rows moves a header of its own accord, and
 * every position after it shifts: one that keeps one row where none fits
 * under its header, one that keeps two where one alone does, and either
 * where a group's footer would start a page, which the closing rows' rule
 * keeps with the row before it. So no header is placed where that would
 * happen for an `n` still to be covered, and where it would happen for an
 * engine of two rows only once that `n` is covered for two rows. The
 * fixture test lays the rows out as an engine of each count would and
 * recounts it.
 *
 * Every group has at least three rows, so each header keeps three, but the
 * last, which has two, keeps both, and stands whole on one page with its
 * subtotal and the table's total. Every row is keyed, so that a check finds
 * each of the rows a header keeps.
 *
 * Not in `ALL_FIXTURES`, which is the corpus the renderer trial chose an
 * engine on (0005): neither trial adapter keeps a header with more than its
 * first row, and the trial's findings are of that corpus as it stood. The
 * renderer answers to it as it answers to those.
 */

/** The rows a group header keeps here: more than the one row every header is kept with, and more than two. */
export const KEPT = 3

/** The rooms swept: one row under a header on its page, and two. */
const ROOMS = [1, 2] as const

/** A group's least rows: its header, `KEPT` detail rows and its subtotal. */
const LEAST_GROUP = KEPT + 2

/** The rows under the row at position `p` on its page, with `perPage` rows a page. */
const under = (p: number, perPage: number): number => perPage - 1 - (p % perPage)

/**
 * Whether a group header at `p` covers a room still to be covered, and
 * shifts no engine's layout for a number of rows a page with any left: an
 * engine of one row moves a header with none under it, and one of two a
 * header with one, while that number is to be covered for two rows; and
 * either moves the row before a footer that would start a page, which is
 * the row before `p`.
 */
function placeable(p: number, uncovered: ReadonlyMap<number, ReadonlySet<number>>): boolean {
  let covers = false
  for (const [perPage, rooms] of uncovered) {
    const room = under(p, perPage)
    if (room === 0 || (p - 1) % perPage === 0 || (room === 1 && rooms.has(2))) return false
    covers ||= rooms.has(room)
  }
  return covers
}

export function groupStarts(): number[] {
  const uncovered = new Map<number, Set<number>>()
  for (let perPage = ROWS_PER_PAGE_RANGE.min; perPage <= ROWS_PER_PAGE_RANGE.max; perPage++) uncovered.set(perPage, new Set(ROOMS))
  const starts = [0]
  while (uncovered.size > 0) {
    let next = starts.at(-1)! + LEAST_GROUP
    while (!placeable(next, uncovered)) next++
    starts.push(next)
    for (const [perPage, rooms] of uncovered) {
      rooms.delete(under(next, perPage))
      if (rooms.size === 0) uncovered.delete(perPage)
    }
  }
  return starts
}

function keptGroups(): TableRow[] {
  const starts = groupStarts()
  const rows: TableRow[] = []
  let detail = 1
  starts.forEach((start, index) => {
    const label = `D${String(index + 1).padStart(2, '0')}`
    // The last group has two detail rows; every other one runs to the next group's header.
    const count = index + 1 < starts.length ? starts[index + 1]! - start - 2 : 2
    const group = details(detail, detail + count - 1)
    detail += count
    const subtotal = totalRow(group).cells[2] ?? amount(0n)
    rows.push({ kind: 'groupHeader', cells: [`Delivery ${label}`, '', ''], keepWithRows: Math.min(KEPT, count) }, ...group, {
      kind: 'groupFooter',
      cells: [`Subtotal ${label}`, '', subtotal],
    })
  })
  return [...rows, totalRow(rows)]
}

const rows = keptGroups()
const document = documentOf('Group keep with', [ledger('deliveries', rows)])
const pages = pagesOfRows(rows.length)

export const groupKeepWith: Fixture = {
  id: 'group-keep-with',
  title: 'Group headers that keep three rows, swept across page ends: never fewer under a header, exact subtotals',
  document,
  maxPages: 40,
  expect: expectation(document, {
    exactText: rows.filter((row) => row.kind === 'groupFooter' || row.kind === 'total').map((row) => row.cells[2] ?? ''),
    minPagesExpected: pages.min,
    // A header moved to the next page with the rows it keeps leaves at most their room, three rows, on each page it passes.
    maxPagesExpected: Math.ceil(rows.length / (ROWS_PER_PAGE_RANGE.min - KEPT)),
  }),
}

/** The fixtures of 0059, beside section 20's and the SVG ones. */
export const KEEP_WITH_FIXTURES: readonly Fixture[] = [groupKeepWith]
