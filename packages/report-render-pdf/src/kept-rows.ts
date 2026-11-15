import { MAX_KEEP_WITH_ROWS, RenderRefusal, type Table } from '@formancy/report-runtime'

/**
 * Refuses a table whose rows keep rows otherwise than the runtime writes
 * them (0059), naming the table and the row, never a cell's text: a count
 * on a row that is no group header; one that is not a whole number from 2
 * to `MAX_KEEP_WITH_ROWS`, the one row every header keeps being no member;
 * and one past the detail rows under its header, before the next row of
 * another kind. How many rows a group has is the runtime's to count, once;
 * the plan reads the count as given (`breaks.ts`), and a count the runtime
 * could not have written -- a header of two rows keeping three, the next
 * group's header among them, or text where a number stands -- is never
 * guessed at. If the two ever disagree, the render says so.
 */
export function checkKeptRows(table: Table): void {
  table.rows.forEach((row, index) => {
    const count: unknown = row.keepWithRows
    if (count === undefined) return
    const at = `row ${index} of table ${table.id}`
    if (row.kind !== 'groupHeader') throw new RenderRefusal('unsupported', `${at} keeps rows with it, and only a group header does`, table.id)
    if (!(typeof count === 'number' && Number.isInteger(count) && count >= 2 && count <= MAX_KEEP_WITH_ROWS)) {
      // A value that is no number is named by its type alone, never quoted.
      const keeps = typeof count === 'number' ? `${count} rows` : `rows by a count of type ${typeof count}`
      throw new RenderRefusal(
        'unsupported',
        `${at}, a group header, keeps ${keeps}; a group header keeps a whole number of them from 2 to ${MAX_KEEP_WITH_ROWS}, and only its first where it says none`,
        table.id,
      )
    }
    let details = 0
    while (table.rows[index + 1 + details]?.kind === 'detail') details++
    if (count > details) throw new RenderRefusal('unsupported', `${at}, a group header, keeps ${count} rows, and ${details} detail rows follow it`, table.id)
  })
}
