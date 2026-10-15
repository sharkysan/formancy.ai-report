import type { Node, NodeQueries } from 'pdfmake/interfaces.js'
import { naturalLayout, plannedBreaks, type Geometry, type KeepBlock } from './breaks.js'
import { mark, pageOf, type BreakRule, type Build, type TablePlan } from './build.js'
import type { Cell, Row } from './table.js'

/**
 * The rules that keep a table's blocks of rows on one page (`breaks.ts`),
 * as pdfmake runs them: each cell of a block's first row that prints is
 * marked with a rule, each cell of its first and last rows that prints gets
 * an id, and when none of the last row's starts on the first row's page,
 * the first row breaks to the next page, under the repeated column header.
 * pdfmake breaks before a cell, not a row, so every cell of the row that
 * prints carries the rule, and the first to break sets the break on the
 * others: one at a time, each left a piece of the row's rule at the foot of
 * the page, and took a layout of its own. The ids are what make a row's
 * page right: pdfmake corrects the page of a node it moved whole to the
 * next page only when it has one, and without it a row that did not fit
 * reported the page before, and its rule broke before a row already first
 * on its page, for another layout. Every id is a named destination in the
 * PDF, two to a block.
 *
 * A block first on its page always fits: the table's plan keeps only
 * blocks that fit under the repeated header, and none that start among the
 * rows that move with the header (`keepWithHeaderRows`), where a break
 * inside pdfmake's unbreakable block would lose the rows after it. A block
 * whose first or last row has no text cannot be kept: there is nothing on
 * the page for the rule to find.
 *
 * In the body, outside any frame, a table whose rows are kept whole also
 * has its breaks planned. The first body row after those that move with
 * the header carries one more rule, which pdfmake asks before any block's
 * once its first layout is done. It reads where that row stands, works out
 * every break the blocks' rules would ask for (`plannedBreaks`), and makes
 * them all in the next layout -- the first through its own rule's answer,
 * the rest by setting the break on their cells -- so that a table of any
 * length is laid out about twice, not once a page.
 *
 * pdfmake reports where a row of a table it keeps whole starts: its row's
 * top, on its page. Not for a row that did not fit, which reports where it
 * would have stood, at the foot of the page before, nor for the rows that
 * move with the header, which report where they stand in the block they
 * move in. So the plan starts from the first row after those, and before it
 * plans anything it lays the table out by its own arithmetic and compares
 * every row pdfmake reports on that page and the next, other than the first
 * of a page: if one differs, nothing is planned, and the rules alone break
 * the table, one layout each.
 */

/** Where a page's first row starts on the pages a table continues on; `undefined` where its breaks are not planned. */
export type Continued = number | undefined

export function tableRules(rows: readonly Row[], plan: TablePlan, build: Build, continued: Continued): void {
  const forced = new Set<Cell>()
  const ruled = plan.blocks.flatMap((block) => {
    const starts = printing(rows[block.first]!)
    const end = rows.slice(block.first + 1, block.last + 1).findLast((row) => printing(row).length > 0)
    if (starts.length === 0 || end === undefined) return []
    const ends = printing(end)
    for (const cell of [...starts, ...ends]) cell.id ??= `row-${build.next++}`
    for (const cell of starts) {
      add(
        cell,
        (node) => {
          const breaks = forced.has(cell) || !ends.some((other) => pageOf(other) === node.startPosition.pageNumber)
          if (breaks) for (const other of starts) if (other !== cell) other.pageBreak = 'before'
          return breaks
        },
        build,
      )
    }
    return [block]
  })
  if (continued === undefined || !plan.dontBreakRows || ruled.length === 0) return
  // Every row's first printing cell is marked, so that a row is found among the nodes pdfmake reports by its mark.
  const rowOf = new Map<number, number>()
  rows.forEach((row, index) => {
    const [first] = printing(row)
    if (first !== undefined && index > 0) rowOf.set(mark(first, build), index)
  })
  const hookRow = rows.findIndex((row, index) => index > plan.keepWithHeaderRows && printing(row).length > 0)
  if (hookRow === -1 || hookRow > ruled[0]!.first) return
  const hook = printing(rows[hookRow]!)[0]!
  let done = false
  const planning: BreakRule = (node, queries) => {
    if (!done) {
      done = true
      const geometry: Geometry = { top: node.startPosition.top, continued, bottom: build.bodyBottom }
      for (const [index, row] of planBreaks(plan, ruled, hookRow, geometry, node, queries, rowOf).entries()) {
        // The first break is made by its first cell's own rule, which pdfmake asks next; the rest are set here.
        printing(rows[row]!).forEach((cell, at) => (index === 0 && at === 0 ? forced.add(cell) : (cell.pageBreak = 'before')))
      }
    }
    return forced.has(hook)
  }
  add(hook, planning, build)
}

/** The rows the blocks' rules will break before, from row `hookRow` on; none when what pdfmake reports of this page and the next is not what the arithmetic gives. */
function planBreaks(
  plan: TablePlan,
  blocks: readonly KeepBlock[],
  hookRow: number,
  geometry: Geometry,
  node: Node,
  queries: NodeQueries,
  rowOf: ReadonlyMap<number, number>,
): readonly number[] {
  // A row that did not fit reports where it would have stood, and nothing can be planned from it.
  if (geometry.top + plan.pitches[hookRow]! > geometry.bottom) return []
  const placed = naturalLayout(plan.pitches, hookRow, geometry)
  const page = node.startPosition.pageNumber
  for (const other of [...queries.getFollowingNodesOnPage(), ...queries.getNodesOnNextPage()]) {
    const row = other.headlineLevel === undefined ? undefined : rowOf.get(other.headlineLevel)
    const at = row === undefined ? undefined : placed[row - hookRow]
    if (at === undefined || at.first) continue
    if (other.startPosition.pageNumber !== page + at.page || Math.abs(other.startPosition.top - at.top) > 0.01) return []
  }
  return plannedBreaks(plan.pitches, blocks, hookRow, geometry).breaks
}

/** Sets `rule` on `cell`'s mark, asked before a rule it has: the planning rule, before the block rule of a row that starts a block. */
function add(cell: Cell, rule: BreakRule, build: Build): void {
  const at = mark(cell, build)
  const had = build.rules.get(at)
  build.rules.set(at, had === undefined ? rule : (node, queries) => rule(node, queries) || had(node, queries))
}

/** The cells of a row that have text. */
export function printing(row: Row): Cell[] {
  return row.cells.filter((cell) => cell.text.trim() !== '')
}
