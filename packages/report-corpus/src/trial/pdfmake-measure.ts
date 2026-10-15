import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { PADDING_Y, RULE, type RowKind, type TablePlan } from './pdfmake-content.js'

/**
 * Heights measured by laying content out with pdfmake itself, before the
 * PDF is laid out: pdfmake has no measuring call of its own, and the
 * adapter needs heights it cannot compute -- how tall the page header is,
 * whether a keep-together block or a table row fits on a page -- because
 * pdfmake drops content that does not fit where it must, without a word: a
 * page header taller than its margin loses lines, and an unbreakable block
 * or row taller than the page is not drawn at all.
 *
 * How: the items go on one tall page, one after another, each between two
 * sentinels -- one-point text, so that each has a position -- and the first
 * call of `pageBreakBefore`, which pdfmake makes once the layout is done,
 * reads the top of every marked node on the page and throws, so that no PDF
 * is written. A page break means the items did not fit on the page; the
 * `background` function pdfmake calls for every new page throws then.
 */

/** The result of measuring: each item's height and where it ends, and the top of every node marked with a headline level, on the measuring page. */
export interface Measured {
  readonly heights: readonly number[]
  readonly ends: readonly number[]
  /** Throws for a mark pdfmake laid out no node for. */
  readonly top: (mark: number) => number
}

/** What runs pdfmake: the adapter's one configured entry to it. */
export type RunPdfmake = (definition: TDocumentDefinitions) => Promise<Uint8Array>

/** Thrown out of pdfmake's layout with what was read; never seen outside `measure`. */
class Measurement {
  readonly tops: ReadonlyMap<number, number>
  constructor(tops: ReadonlyMap<number, number>) {
    this.tops = tops
  }
}

/** Sentinels are marked with negative numbers, so that they never meet the marks content carries. */
const sentinel = (index: number): Content => ({ text: '.', fontSize: 1, headlineLevel: -1 - index })

/** Room left on the measuring page for the sentinels: each is one line of one-point text, 1.17pt in Roboto. */
export const SENTINEL_ROOM = 2

/**
 * Lays `items` out on one page `height` tall, between those side margins,
 * and measures them; `overflow` is what to throw when they do not fit on it.
 */
export async function measure(
  run: RunPdfmake,
  page: { readonly width: number; readonly height: number; readonly left: number; readonly right: number },
  items: readonly Content[],
  resources: Required<Pick<TDocumentDefinitions, 'defaultStyle' | 'images'>>,
  overflow: () => Error,
): Promise<Measured> {
  const definition: TDocumentDefinitions = {
    pageSize: { width: page.width, height: page.height },
    pageMargins: [page.left, 0, page.right, 0],
    ...resources,
    content: [sentinel(0), sentinel(1), ...items.flatMap((item, index) => [item, sentinel(index + 2)])],
    background: (number) => {
      if (number > 1) throw overflow()
      return null
    },
    pageBreakBefore: (node, queries) => {
      const tops = new Map<number, number>()
      for (const each of [node, ...queries.getFollowingNodesOnPage()]) {
        if (each.headlineLevel !== undefined) tops.set(each.headlineLevel, each.startPosition.top)
      }
      throw new Measurement(tops)
    },
  }
  let tops: ReadonlyMap<number, number>
  try {
    await run(definition)
    throw new Error('pdfmake wrote a PDF instead of measuring')
  } catch (error) {
    if (!(error instanceof Measurement)) throw error
    tops = error.tops
  }
  const top = (mark: number): number => {
    const found = tops.get(mark)
    if (found === undefined) throw new Error(`pdfmake laid out no node marked ${mark}`)
    return found
  }
  const pitch = top(-2) - top(-1)
  const ends = items.map((_, index) => top(-3 - index))
  return { heights: ends.map((end, index) => end - top(-2 - index) - pitch), ends, top }
}

/**
 * Each row's height, from the tops of the marks on their first cells: a
 * row's top to the next one's is its height and the rule under it. The last
 * row ends where the table does, which is where the sentinel after it
 * starts, measured from the top of its cell, which stands `PADDING_Y` below
 * the row's top.
 */
export function rowPitches(marks: readonly number[], top: Measured['top'], tableEnd: number): number[] {
  return marks.map((mark, index) => {
    const next = marks[index + 1]
    return next === undefined ? tableEnd - top(mark) + PADDING_Y : top(next) - top(mark)
  })
}

/**
 * pdfmake loses unbreakable content that misses its page by any amount.
 * Heights measured in one layout and used in another agree to the last bit
 * in practice; this much slack keeps rounding from ever deciding it.
 */
export const FIT_SLACK = 1

/**
 * How a table breaks across pages of a body `bodyHeight` tall, from its
 * measured rows, the header row first:
 *
 * - rows are kept whole (`dontBreakRows`) only when every one fits on a
 *   page under the repeated header, and the first row of each group under
 *   its group header as well. pdfmake's option is the whole table's, so one
 *   row that does not lets every row of the table split. Split is what a row
 *   taller than the page needs, since pdfmake would otherwise not draw it,
 *   and what the first row of a group needs to start on its group header's
 *   page when the two cannot share one whole;
 * - the header moves with the first row, or with the first two when the
 *   first is a group header, so that neither ends a page alone; not when
 *   they do not fit on a page together, for the same reason.
 */
export function tablePlan(rows: readonly { readonly kind: RowKind; readonly pitch: number }[], bodyHeight: number): TablePlan {
  const [header, ...body] = rows
  const room = bodyHeight - RULE - (header?.pitch ?? 0) - FIT_SLACK
  const under = (index: number): number => (body[index - 1]?.kind === 'groupHeader' ? body[index - 1]!.pitch : 0)
  const lead = body[0]?.kind === 'groupHeader' && body.length > 1 ? 2 : 1
  const leading = body.slice(0, lead).reduce((sum, row) => sum + row.pitch, 0)
  return { dontBreakRows: body.every((row, index) => under(index) + row.pitch <= room), keepWithHeaderRows: leading <= room ? lead : 0 }
}
