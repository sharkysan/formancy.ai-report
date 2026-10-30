import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { RenderRefusal, type Table } from '@formancy/report-runtime'
import { keepBlocks, keptBlocks } from './breaks.js'
import type { RowKind, TablePlan } from './build.js'
import type { RowLine } from './check.js'
import type { Engine } from './engine.js'
import type { HostFontFiles } from './host-fonts.js'
import { LINE_FACTOR, ROBOTO } from './style.js'
import { checkWords, type WordRoom } from './words.js'
import { PADDING_Y, RULE } from './table.js'

/**
 * Heights measured by laying content out with pdfmake itself, before the
 * PDF is laid out: pdfmake has no measuring call of its own, and the
 * renderer needs heights it cannot compute -- how tall the page header is,
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

/** Thrown out of pdfmake's layout with what was read; never seen outside `measure`. */
class Measurement extends Error {
  readonly tops: ReadonlyMap<number, number>
  constructor(tops: ReadonlyMap<number, number>) {
    super('pdfmake was stopped once it had measured')
    this.tops = tops
  }
}

/** Sentinels are marked with negative numbers, so that they never meet the marks content carries; in Roboto, so their one line is its known height whatever the document's default face lays out (0043). */
const sentinel = (index: number): Content => ({ text: '.', fontSize: 1, font: ROBOTO, headlineLevel: -1 - index })

/** Room left on the measuring page for the sentinels: each is one line of one-point text, 1.17pt in Roboto. */
export const SENTINEL_ROOM = 2

/** A sentinel's height exactly: one line of one-point Roboto, for a page that must hold its items and nothing more. */
export const SENTINEL_LINE = LINE_FACTOR

/**
 * Lays `items` out on one page `height` tall, between those side margins,
 * and measures them; `overflow` is what to throw when they do not fit on it.
 * Before a line is laid out, the `words` of the items are held to their
 * room, so that pdfmake never breaks one too wide for it.
 */
export async function measure(
  engine: Engine,
  page: { readonly width: number; readonly height: number; readonly left: number; readonly right: number },
  items: readonly Content[],
  resources: Required<Pick<TDocumentDefinitions, 'defaultStyle' | 'images'>>,
  overflow: () => Error,
  words: readonly WordRoom[],
  host: HostFontFiles,
): Promise<Measured> {
  const definition: TDocumentDefinitions = {
    pageSize: { width: page.width, height: page.height },
    pageMargins: [page.left, 0, page.right, 0],
    ...resources,
    content: [sentinel(0), sentinel(1), ...items.flatMap((item, index) => [item, sentinel(index + 2)])],
    background: (number) => {
      // pdfmake has measured every word, and laid out no line yet (`words.ts`).
      if (number === 1) checkWords(words)
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
    await engine.run(definition, host)
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
 * What a page of a body `bodyHeight` tall holds of a table's rows under its
 * column header, which pdfmake 0.3.11 repeats at the top of every page the
 * table reaches (`headerRows: 1`, `table.ts`) as the block it laid the
 * header out in: the table's top rule, the header row and the rule under
 * it (`TableProcessor.beginTable` and `endRow`, `currentBlockToRepeatable`),
 * `RULE` and the header's pitch. Less `FIT_SLACK`. pdfmake repeats the
 * column header alone, never a group header, and has no footer rows of its
 * own: a group's footer and a total are rows under the header like any other.
 */
function underHeader(headerPitch: number, bodyHeight: number): number {
  return bodyHeight - RULE - headerPitch - FIT_SLACK
}

/**
 * Refuses `table` when the tallest line of its rows under the header,
 * `under`, does not fit on a page under the repeated header, `headerPitch`
 * tall as measured, in a body `bodyHeight` tall where the table stands.
 *
 * pdfmake lays a row it may split out line by line. A line that does not
 * fit what is left of a page goes to the next, under the repeated header,
 * and one that does not fit there either goes to the page after and is
 * dropped without a word (`LayoutBuilder.processLeaf`,
 * `PageElementWriter._fitOnPage`, where `addLine` returns false): a row of
 * one 40 pt line under a 40 pt header, in a body that held the row alone,
 * printed five pages of the header and no row. On a page the table
 * continues on, a row's line stands under its padding, with its padding
 * and the rule under it kept below it (`TableProcessor.beginRow` and
 * `onRowBreak`): it needs the header as it repeats, the line, its padding
 * and three rules. A row kept whole (`dontBreakRows`) needs no less, so
 * every table the body pass measures is held to it, whatever its plan.
 */
export function refuseLineUnderHeader(table: Table, under: RowLine, headerPitch: number, bodyHeight: number): void {
  const row = PADDING_Y + under.line + PADDING_Y + RULE
  if (row <= underHeader(headerPitch, bodyHeight)) return
  const needs = RULE + headerPitch + row
  throw new RenderRefusal(
    'content-too-large',
    `${under.what} has a line that needs ${needs.toFixed(2)} pt of a page under the table's repeated header, and a point more for rounding; a page's body is ${bodyHeight.toFixed(2)} pt where it stands`,
    table.id,
  )
}

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
 *   first is a group header, so that neither ends a page alone, and with
 *   every row of a block of rows kept together that starts among them --
 *   a one-line quotation's totals; not when they do not fit on a page
 *   together, for the same reason;
 * - the rows kept together (`breaks.ts`) are the blocks that fit on a page
 *   under the header and start after the rows that move with it. A table
 *   whose rows may split keeps only its group headers with what they head.
 */
export function tablePlan(rows: readonly { readonly kind: RowKind; readonly pitch: number }[], bodyHeight: number): TablePlan {
  const [header, ...body] = rows
  const room = underHeader(header?.pitch ?? 0, bodyHeight)
  const under = (index: number): number => (body[index - 1]?.kind === 'groupHeader' ? body[index - 1]!.pitch : 0)
  const dontBreakRows = body.every((row, index) => under(index) + row.pitch <= room)
  const pitches = rows.map((row) => row.pitch)
  const blocks = keepBlocks(
    rows.map((row) => row.kind),
    dontBreakRows,
  )
  const first = body[0]?.kind === 'groupHeader' && body.length > 1 ? 2 : 1
  let lead = first
  for (const block of blocks) if (block.first <= lead) lead = Math.max(lead, block.last)
  const fits = (count: number): boolean => body.slice(0, count).reduce((sum, row) => sum + row.pitch, 0) <= room
  const keepWithHeaderRows = fits(lead) ? lead : fits(first) ? first : 0
  return { dontBreakRows, keepWithHeaderRows, pitches, blocks: keptBlocks(blocks, pitches, keepWithHeaderRows, room) }
}
