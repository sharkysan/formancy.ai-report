import { describe, expect, test } from 'vitest'
import type { RowKind } from './build.js'
import { blockHeight, keepBlocks, keptCounts, naturalLayout, plannedBreaks, type Geometry, type PlannedRow } from './breaks.js'

/**
 * The arithmetic of a table's page breaks, apart from pdfmake: which rows
 * stand together, and where the breaks fall. The PDFs that hold it to what
 * pdfmake lays out are `tables.test.ts`'s.
 */

const kinds = (...each: RowKind[]): RowKind[] => ['header', ...each]

describe('keepBlocks', () => {
  // A group header alone at the foot of a page, a subtotal or a total alone
  // at the top of the next under a repeated header: each is kept with the
  // row it belongs to, and the closing rows of the last group with the
  // table's totals.
  test('keeps a group header with its first row, and closing rows with the row before them', () => {
    const rows = kinds('groupHeader', 'detail', 'detail', 'groupFooter', 'groupHeader', 'detail', 'groupFooter', 'total', 'total')
    expect(keepBlocks(rows, true)).toEqual([
      { first: 1, last: 2 },
      { first: 3, last: 4 },
      { first: 5, last: 9 },
    ])
  })

  // Rows that may split have no height to keep a block by; a group header
  // is still kept with what it heads, as it always was.
  test('keeps only group headers when closing rows cannot be kept', () => {
    expect(keepBlocks(kinds('groupHeader', 'detail', 'groupFooter', 'total'), false)).toEqual([{ first: 1, last: 2 }])
  })

  // The totals of a table without rows stay with the text that says so;
  // totals under nothing, or a group header last in the table, keep nothing.
  test('keeps totals with the empty text, and nothing with nothing', () => {
    expect(keepBlocks(kinds('empty', 'total', 'total'), true)).toEqual([{ first: 1, last: 3 }])
    expect(keepBlocks(kinds('total'), true)).toEqual([])
    expect(keepBlocks(kinds('detail', 'groupHeader'), true)).toEqual([])
  })

  test('measures a block as its rows', () => {
    expect(blockHeight([10, 11, 12, 13], { first: 1, last: 2 })).toBe(23)
  })
})

describe('keepBlocks, for a group header that keeps more than one row', () => {
  // Rows: the column header 0; a group of four details (1 to 6), of which
  // its header keeps three; a group of two (7 to 10), of which its header
  // keeps both; the table's total, 11.
  const rows = kinds('groupHeader', 'detail', 'detail', 'detail', 'detail', 'groupFooter', 'groupHeader', 'detail', 'detail', 'groupFooter', 'total')
  const counts = Object.assign([], { 1: 3, 7: 2 })

  // The block a count makes is the header and that many rows, the rule a
  // header of one row has always had, longer; and where it reaches the
  // group's last row it runs into the footers and the totals that close
  // it, as the closing rows' block of that row already does.
  test('keeps a header with the rows it keeps, and a whole group with what closes it', () => {
    expect(keepBlocks(rows, true, counts)).toEqual([
      { first: 1, last: 4 },
      { first: 5, last: 6 },
      { first: 7, last: 11 },
    ])
  })

  // In a table whose rows may split there is no block of closing rows to
  // run into: the header is kept with its rows alone.
  test('keeps a header with its rows alone where closing rows cannot be kept', () => {
    expect(keepBlocks(rows, false, counts)).toEqual([
      { first: 1, last: 4 },
      { first: 7, last: 9 },
    ])
  })

  // No count, or a count of one, is the block every header had before.
  test('keeps a header with its first row where it keeps one', () => {
    expect(keepBlocks(rows, true, Object.assign([], { 1: 1 }))).toEqual(keepBlocks(rows, true))
  })
})

describe('keptCounts', () => {
  /** A row of 10pt that prints, keeping one row. */
  const row = (kind: RowKind, more: Partial<PlannedRow> = {}): PlannedRow => ({ kind, pitch: 10, keep: 1, prints: true, ...more })
  /** The column header, a group header keeping `keep` over `details` rows, and its subtotal. */
  const group = (keep: number, details: readonly Partial<PlannedRow>[], closing: readonly RowKind[] = ['groupFooter']): PlannedRow[] => [
    row('header'),
    row('groupHeader', { keep }),
    ...details.map((each) => row('detail', each)),
    ...closing.map((kind) => row(kind)),
  ]
  const five = Array.from({ length: 5 }, () => ({}))

  // A header and the rows it keeps that fit under the repeated header are
  // kept so; any other row keeps one.
  test('keeps a header with the rows it keeps where they fit', () => {
    expect(keptCounts(group(3, five), true, 100)).toEqual([1, 3, 1, 1, 1, 1, 1, 1])
  })

  // Where they do not, as many as fit, down to the one row every header
  // is kept with: a header and three rows of 10pt need 40pt, and two 30.
  test('keeps as many as fit where the rows it keeps do not, and one where no more do', () => {
    expect(keptCounts(group(3, five), true, 35)[1]).toBe(2)
    expect(keptCounts(group(3, five), true, 25)[1]).toBe(1)
  })

  // A count that reaches its group's last row keeps the group's footers
  // and the totals under it too, so they must fit with it: a group of two
  // and its subtotal and total need 50pt, and kept with its first row
  // alone, the header leaves its last row to the closing rows' rule.
  test('counts the footers and totals that close a whole group in what must fit', () => {
    const small = group(2, [{}, {}], ['groupFooter', 'total'])
    expect(keptCounts(small, true, 50)[1]).toBe(2)
    expect(keptCounts(small, true, 45)[1]).toBe(1)
    // Where rows may split, nothing closes a block, and the header and its two rows fit in 30.
    expect(keptCounts(small, false, 30)[1]).toBe(2)
  })

  // A rule finds a row on its page by its text alone: a block whose last
  // row prints nothing could never be held to its page, and the plan,
  // which counts every row, would break where the rule does not. A row
  // with no text before the last is counted where it stands.
  test('ends a block on a row that prints, counting a row with no text before it', () => {
    expect(keptCounts(group(3, [{}, { prints: false }, {}, {}]), true, 100)[1]).toBe(3)
    expect(keptCounts(group(3, [{}, {}, { prints: false }, {}]), true, 100)[1]).toBe(2)
    expect(keptCounts(group(3, [{ prints: false }, { prints: false }, { prints: false }, {}]), true, 100)[1]).toBe(1)
  })

  // A whole group's block ends on what closes it, which prints: the last
  // row with no text does not end it, and the subtotal is kept with the
  // rows it adds up.
  test("ends a whole group's block on its subtotal, though its last row prints nothing", () => {
    expect(keptCounts(group(3, [{}, {}, { prints: false }]), true, 100)[1]).toBe(3)
  })

  // A header that prints nothing has nothing for a rule to find, and keeps
  // what every header had: one row. Kept with three, a table's first group
  // header would still move them with the column header, which reads no
  // text, and the count of a header with no text would print otherwise.
  test('keeps one row with a header that prints nothing', () => {
    const rows = group(3, five)
    expect(keptCounts([rows[0]!, { ...rows[1]!, prints: false }, ...rows.slice(2)], true, 100)[1]).toBe(1)
  })
})

describe('plannedBreaks', () => {
  // A page whose body ends at 105pt, under a header row of 10pt: the first
  // body row at 20, a continued page's rows from 10.
  const page: Geometry = { top: 20, continued: 10, bottom: 105 }
  const pitches = (count: number): number[] => [10, ...Array.from({ length: count }, () => 10)]

  // Rows of 10pt from 20 fill the page with eight; the ninth starts the
  // next page under the header, which holds nine.
  test('lays rows out as pdfmake does, row after row', () => {
    const placed = naturalLayout(pitches(20), 1, page)
    expect(placed.map((row) => row.page)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2])
    expect(placed.flatMap((row, index) => (row.first ? [index + 1] : []))).toEqual([1, 9, 18])
    expect(placed.slice(7, 10).map((row) => row.top)).toEqual([90, 10, 20])
  })

  // A block of two that would straddle the foot of the page breaks before
  // its first row, and every row after it moves: the second block, which
  // would have fitted where the rows first fell, now straddles and breaks
  // too. Found together, they are made in one layout.
  test('breaks before every block that would straddle a page, as the earlier breaks move the rest', () => {
    const blocks = [
      { first: 8, last: 9 },
      { first: 16, last: 17 },
    ]
    expect(plannedBreaks(pitches(20), blocks, 1, page)).toEqual({ breaks: [8, 16], sure: true })
  })

  // A block whose first row starts the next page by itself, or that is
  // first under the repeated header, has the whole page, and is never
  // broken before.
  test('never breaks before a block that starts its page', () => {
    expect(plannedBreaks(pitches(12), [{ first: 9, last: 10 }], 1, page)).toEqual({ breaks: [], sure: true })
  })

  // A row that ends within a hundredth of a point of the foot of the page
  // could go either way in pdfmake's arithmetic: the plan stops before it.
  test('stops where a height comes too close to the foot of a page to say', () => {
    const close = [10, 10, 10, 10, 10, 10, 10, 10, 14.995, 10]
    expect(plannedBreaks(close, [], 1, page)).toEqual({ breaks: [], sure: false })
    expect(plannedBreaks(close, [{ first: 8, last: 9 }], 1, page)).toEqual({ breaks: [], sure: false })
    // A block that would end within a hundredth of the foot, though each of its rows fits.
    const blockClose = [10, 10, 10, 10, 10, 10, 10, 10, 9.995, 5]
    expect(plannedBreaks(blockClose, [{ first: 8, last: 9 }], 1, page)).toEqual({ breaks: [], sure: false })
  })
})
