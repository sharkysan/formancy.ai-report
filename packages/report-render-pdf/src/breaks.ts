import type { RowKind } from './build.js'

/**
 * Which rows of a table must share a page, and where a table's page breaks
 * fall once they do: pure arithmetic on the row heights the body pass
 * measured (`measure.ts`), which `table.ts` turns into pdfmake's rules.
 *
 * **What is kept together.** A group header with the row it heads, so a
 * group never starts at the foot of a page with nothing under its heading,
 * or with as many of its group's first rows as its row keeps and a page
 * holds (`keptCounts`, 0059). And a table's closing rows -- a group's
 * footers, the totals under the last row -- with the row before them, and
 * with its group header when that row is the group's first: a quotation's
 * subtotal, VAT and total on one page with the last line item, a subtotal
 * on the page of the rows it adds up, never alone under a repeated column
 * header. Each is a `KeepBlock`.
 *
 * **Why plan the breaks.** pdfmake asks the renderer's rule for each marked
 * node once its layout is done, and lays the whole document out again for
 * the first rule that asks for a break. A rule fires about once a page, so
 * a long grouped table was laid out once per page: 1,600 groups over 134
 * pages took 60 seconds (measured on 2026-10-15, on an Intel i9-10900K under
 * Node 24.21). So when the first row of a table is laid out, the breaks its
 * rules will ask for are worked out here, from the measured heights, where
 * the first row stands and where a row starts under the repeated header,
 * and are all made in the next layout. The rules stay, and hold the next
 * layout to them: a break the plan missed is still made, one layout later.
 */

/** Rows from `first` to `last`, indices into the table's rows as pdfmake lays them out (the column header at 0), that stand on one page. */
export interface KeepBlock {
  readonly first: number
  readonly last: number
}

/** Rows that close what is above them: a group's footer, a total. */
const CLOSING: ReadonlySet<RowKind> = new Set(['groupFooter', 'total'])

/** The last of the closing rows that close the row `row`, a detail row or the empty text, where `closing`; `row` itself where none do. */
function closedAt(kinds: readonly RowKind[], row: number, closing: boolean): number {
  let last = row
  if (closing && (kinds[row] === 'detail' || kinds[row] === 'empty')) while (kinds[last + 1] !== undefined && CLOSING.has(kinds[last + 1]!)) last++
  return last
}

/**
 * The blocks of rows of these kinds that stand on one page, overlapping
 * ones merged, in order: a group header with as many rows as `counts`
 * says, one where it says nothing. Closing rows are kept with the row
 * before them only when `closing`: a table whose rows may split across
 * pages has no row height to keep them by.
 */
export function keepBlocks(kinds: readonly RowKind[], closing: boolean, counts: readonly number[] = []): KeepBlock[] {
  const blocks: KeepBlock[] = []
  kinds.forEach((kind, index) => {
    if (kind === 'groupHeader' && index + 1 < kinds.length) blocks.push({ first: index, last: index + (counts[index] ?? 1) })
    const before = kinds[index - 1]
    if (!closing || !CLOSING.has(kind) || before === undefined || CLOSING.has(before) || (before !== 'detail' && before !== 'empty')) return
    const anchor = index - 1
    blocks.push({ first: kinds[anchor - 1] === 'groupHeader' ? anchor - 1 : anchor, last: closedAt(kinds, anchor, closing) })
  })
  const merged: KeepBlock[] = []
  for (const block of blocks.sort((a, b) => a.first - b.first)) {
    const previous = merged.at(-1)
    if (previous !== undefined && block.first <= previous.last) merged[merged.length - 1] = { first: previous.first, last: Math.max(previous.last, block.last) }
    else merged.push(block)
  }
  return merged
}

/** A table's row as its plan reads it: its kind, its pitch, how many rows it keeps -- a group header's, one for any other -- and whether any of its cells prints. */
export interface PlannedRow {
  readonly kind: RowKind
  readonly pitch: number
  readonly keep: number
  readonly prints: boolean
}

/**
 * How many of its first rows each group header is kept with, one for every
 * other row (0059): the most, up to the number its row keeps, whose block
 * -- the header, those rows, and the footers and totals that close them
 * where they reach the group's last row and `closing` -- ends on a row
 * that prints and fits `room`, a page under the repeated header. A rule
 * finds a row on its page by its text alone, so a block that ended on one
 * that prints nothing could not be held to its page, and the plan, which
 * counts every row, would break where the rule does not. Where no number
 * above one does, one: the block every header has had, which `keepBlocks`
 * makes, `keptBlocks` drops where it does not fit, and a rule leaves where
 * it falls where its first row prints nothing. A header that prints
 * nothing keeps one too: no rule can find it, and the rows that move with
 * the column header, which read no text, would otherwise take its count
 * with them.
 */
export function keptCounts(rows: readonly PlannedRow[], closing: boolean, room: number): number[] {
  const kinds = rows.map((row) => row.kind)
  const pitches = rows.map((row) => row.pitch)
  return rows.map((row, index) => {
    for (let count = row.kind === 'groupHeader' && row.prints ? row.keep : 1; count > 1; count--) {
      const block = { first: index, last: closedAt(kinds, index + count, closing) }
      if (rows[block.last]?.prints === true && blockHeight(pitches, block) <= room) return count
    }
    return 1
  })
}

/** The rows' height from `first` to `last`, each row's pitch being its height and the rule under it. */
export function blockHeight(pitches: readonly number[], block: KeepBlock): number {
  return pitches.slice(block.first, block.last + 1).reduce((sum, pitch) => sum + pitch, 0)
}

/** The blocks a table's rules can keep: each fits under the repeated header, and starts after the rows that move with it. */
export function keptBlocks(blocks: readonly KeepBlock[], pitches: readonly number[], keepWithHeaderRows: number, room: number): KeepBlock[] {
  return blocks.filter((block) => block.first > keepWithHeaderRows && blockHeight(pitches, block) <= room)
}

/** Where a table stands on the pages its body pass did not see: what the first layout showed. */
export interface Geometry {
  /** The top of the row `first`, on its page. */
  readonly top: number
  /** Where a row starts on a page the table continues on: under the repeated column header. */
  readonly continued: number
  /** The foot of every page's body. */
  readonly bottom: number
}

/** A height closer than this to what is left of a page could fall either way in pdfmake's arithmetic: the plan stops there and leaves the rest to the rules. */
const UNSURE = 0.01

/**
 * The rows, from `first` on, that the `blocks`' rules will break before,
 * laid out row after row as pdfmake lays out rows it keeps whole: a row
 * that does not fit in what is left of a page starts the next one. `sure`
 * is false when a height came too close to the foot of a page to say, and
 * the breaks are then those before it.
 */
export function plannedBreaks(
  pitches: readonly number[],
  blocks: readonly KeepBlock[],
  first: number,
  geometry: Geometry,
): { readonly breaks: readonly number[]; readonly sure: boolean } {
  const { continued, bottom } = geometry
  const starts = new Map(blocks.map((block) => [block.first, block]))
  const breaks: number[] = []
  let y = geometry.top
  /** Whether `height` fits below `y`, or undefined when that is too close to say. */
  const fits = (height: number): boolean | undefined => {
    const left = bottom - y - height
    return Math.abs(left) < UNSURE ? undefined : left > 0
  }
  for (let row = first; row < pitches.length; row++) {
    // A row that does not fit starts the next page by itself, and its block with it.
    const fitting = fits(pitches[row]!)
    if (fitting === undefined) return { breaks, sure: false }
    if (!fitting) y = continued
    const block = starts.get(row)
    if (block !== undefined && y > continued + UNSURE) {
      const whole = fits(blockHeight(pitches, block))
      if (whole === undefined) return { breaks, sure: false }
      if (!whole) {
        breaks.push(row)
        y = continued
      }
    }
    y += pitches[row]!
  }
  return { breaks, sure: true }
}

/** Where a row stands when nothing breaks the table but pdfmake: the page, counting the first row's as 0; its top; whether it is first on that page. */
export interface Placed {
  readonly page: number
  readonly top: number
  readonly first: boolean
}

/** Where each row from `first` on stands when no rule breaks the table: how pdfmake lays out rows it keeps whole. */
export function naturalLayout(pitches: readonly number[], first: number, geometry: Geometry): Placed[] {
  const placed: Placed[] = []
  let [y, page] = [geometry.top, 0]
  for (let row = first; row < pitches.length; row++) {
    const moves = y + pitches[row]! > geometry.bottom
    if (moves) [y, page] = [geometry.continued, page + 1]
    placed.push({ page, top: y, first: moves || row === first })
    y += pitches[row]!
  }
  return placed
}
