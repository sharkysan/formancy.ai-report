import { describe, expect, test } from 'vitest'
import type { RowKind } from './build.js'
import { blockHeight, keepBlocks, naturalLayout, plannedBreaks, type Geometry } from './breaks.js'

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
