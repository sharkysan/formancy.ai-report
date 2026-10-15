import type { Node, NodeQueries } from 'pdfmake/interfaces.js'
import { describe, expect, test } from 'vitest'
import { naturalLayout, type KeepBlock } from './breaks.js'
import { newBuild, type Build, type RowKind, type TablePlan } from './build.js'
import type { Cell, Row } from './table.js'
import { tableRules } from './table-rules.js'

/**
 * The planner's decisions on what pdfmake reports, without pdfmake: rows of
 * 10pt under a 10pt header, on a body from 0 to 105pt, so the first body row
 * stands at 20, the second at 30, and a continued page's first row at 10.
 * What pdfmake lays out from these decisions is `tables.test.ts`'s, on the
 * PDFs.
 */

const BODY = { top: 0, bottom: 105 }
const CONTINUED = 10

function rowsOf(kinds: readonly RowKind[]): Row[] {
  return ['header' as const, ...kinds].map((kind, index) => ({ kind, cells: [{ text: `R${index}`, alignment: 'left' } as Cell, { text: '', alignment: 'left' } as Cell] }))
}

function setUp(kinds: readonly RowKind[], blocks: readonly KeepBlock[], keepWithHeaderRows = 1): { rows: Row[]; build: Build; plan: TablePlan } {
  const rows = rowsOf(kinds)
  const build = newBuild('render', { pixels: new Map(), paths: new Map() }, BODY)
  const plan: TablePlan = { dontBreakRows: true, keepWithHeaderRows, pitches: rows.map(() => 10), blocks }
  tableRules(rows, plan, build, CONTINUED)
  return { rows, build, plan }
}

/** What pdfmake reports of a row: its first cell's mark, page and top. */
const reported = (row: Row, pageNumber: number, top: number): Node => ({ headlineLevel: row.cells[0]!.headlineLevel, startPosition: { pageNumber, top } }) as unknown as Node

/** pdfmake's report of every row from `first`, where the arithmetic puts it, on page 1 on; `shift` moves one row's top. */
function queriesOf(rows: readonly Row[], plan: TablePlan, first: number, top: number, shift: Readonly<Record<number, number>> = {}): NodeQueries {
  const placed = naturalLayout(plan.pitches, first, { top, continued: CONTINUED, bottom: BODY.bottom })
  const nodes = placed.map((at, index) => reported(rows[first + index]!, 1 + at.page, at.top + (shift[first + index] ?? 0)))
  return {
    getFollowingNodesOnPage: () => nodes.slice(1).filter((node) => node.startPosition.pageNumber === 1),
    getNodesOnNextPage: () => nodes.filter((node) => node.startPosition.pageNumber === 2),
  } as unknown as NodeQueries
}

const asked = (build: Build, row: Row, node: Node, queries: NodeQueries): boolean => build.rules.get(row.cells[0]!.headlineLevel!)!(node, queries)

describe('a table’s planned breaks', () => {
  // Rows 1 to 8 fill the first page from 20; a block of rows 8 and 9 would
  // straddle its foot, and breaks before 8; after it every row moves, and a
  // block of rows 16 and 17 then straddles the next page's foot.
  const kinds: RowKind[] = Array.from({ length: 20 }, () => 'detail')
  const blocks = [
    { first: 8, last: 9 },
    { first: 16, last: 17 },
  ]

  test('are made from what pdfmake reports once its first layout is done: the first by its rule, the rest on their cells', () => {
    const { rows, build, plan } = setUp(kinds, blocks)
    const hook = rows[2]!
    expect(asked(build, hook, reported(hook, 1, 30), queriesOf(rows, plan, 2, 30))).toBe(false)
    expect(rows[16]!.cells[0]!.pageBreak).toBe('before')
    expect(rows[8]!.cells[0]!.pageBreak).toBeUndefined()
    // The first break's own rule answers it, wherever pdfmake put the row.
    expect(asked(build, rows[8]!, reported(rows[8]!, 1, 90), queriesOf(rows, plan, 2, 30))).toBe(true)
  })

  // pdfmake's report and the arithmetic must agree on the two pages the
  // first layout shows, or the plan is not trusted with the rest.
  test('are not made when a row pdfmake reports stands elsewhere than the arithmetic puts it', () => {
    const { rows, build, plan } = setUp(kinds, blocks)
    const hook = rows[2]!
    asked(build, hook, reported(hook, 1, 30), queriesOf(rows, plan, 2, 30, { 5: 0.5 }))
    expect(rows.flatMap((row) => row.cells).filter((cell) => cell.pageBreak !== undefined)).toEqual([])
  })

  // A row that did not fit reports where it would have stood, at the foot
  // of the page before: nothing can be planned from it.
  test('are not made from a row that did not fit where it reports', () => {
    const { rows, build, plan } = setUp(kinds, blocks)
    const hook = rows[2]!
    asked(build, hook, reported(hook, 1, 100), queriesOf(rows, plan, 2, 100))
    expect(rows.flatMap((row) => row.cells).filter((cell) => cell.pageBreak !== undefined)).toEqual([])
  })

  // The first row after those that move with the header plans the table,
  // and may also start a block: its rule plans first, then keeps its block.
  test('are planned by a row that starts a block too, before its block is kept', () => {
    const { rows, build, plan } = setUp(kinds, [{ first: 1, last: 2 }, ...blocks], 0)
    const hook = rows[1]!
    // pdfmake records where it laid the block's last row out on the row's own cell (build.ts's pageOf).
    Object.assign(rows[2]!.cells[0]!, { positions: [{ pageNumber: 1 }] })
    expect(asked(build, hook, reported(hook, 1, 20), queriesOf(rows, plan, 1, 20))).toBe(false)
    expect(rows[16]!.cells[0]!.pageBreak).toBe('before')
  })

  // A table whose first rows after the header print nothing has no row to
  // plan from before its first block; its rules alone break it.
  test('are not planned without a row that prints before the first block', () => {
    const rows = rowsOf(kinds)
    for (const row of rows.slice(1, 9)) row.cells.forEach((cell) => ((cell as { text: string }).text = ''))
    const build = newBuild('render', { pixels: new Map(), paths: new Map() }, BODY)
    tableRules(rows, { dontBreakRows: true, keepWithHeaderRows: 1, pitches: rows.map(() => 10), blocks }, build, CONTINUED)
    expect(rows.slice(1, 9).every((row) => row.cells[0]!.headlineLevel === undefined)).toBe(true)
    expect(build.rules.size).toBe(2)
  })
})
