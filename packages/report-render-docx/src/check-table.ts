import { MAX_KEEP_WITH_ROWS, RenderRefusal, type Table } from '@formancy/report-runtime'
import { checkStyle, checkText } from './check-text.js'
import { count, family, type Walk } from './check-walk.js'
import { PADDING_X } from './look.js'
import { lineEndings } from './nodes.js'
import { cellFace, styledRows } from './rows.js'
import { fillWidth, fixedWidth } from './widths.js'

/**
 * A table's block, held before a byte is written (0068) as the PDF
 * renderer holds it (`check-table.ts` and `kept-rows.ts` there): its
 * shape -- its columns, a header row and every row of as many cells as it
 * has columns, or of one across them, the rows a group header keeps
 * (0059), and its columns' widths where it stands -- then every cell's
 * text in the face it prints in, counted with the file, a cell a
 * paragraph of one run.
 *
 * It changes when a table's block does. Where a table may stand -- in no
 * columns block, and in no section with a frame -- is the walk's
 * (`check.ts`).
 */

/** A table held to its shape, as the PDF renderer holds it, and every cell's text to the face it prints in. */
export function checkTable(table: Table, width: number, walk: Walk): void {
  const columns = table.columns.length
  const { id } = table
  if (columns === 0) throw new RenderRefusal('unsupported', `table ${id} has no columns`, id)
  if (table.columns.some((column) => column.align !== 'left' && column.align !== 'center' && column.align !== 'right'))
    throw new RenderRefusal('unsupported', `table ${id} aligns a column in a way a report does not know`, id)
  if (table.header !== undefined && table.header.length !== columns)
    throw new RenderRefusal('unsupported', `the header of table ${id} has ${table.header.length} cells for ${columns} columns`, id)
  table.rows.forEach((row, index) => {
    const cells = row.across === true ? 1 : columns
    if (row.cells.length !== cells)
      throw new RenderRefusal(
        'unsupported',
        `row ${index} of table ${id} has ${row.cells.length} cells for ${row.across === true ? 'a row across the table, which has one' : `${columns} columns`}`,
        id,
      )
    if (row.cellStyles !== undefined && row.cellStyles.length !== row.cells.length)
      throw new RenderRefusal('unsupported', `row ${index} of table ${id} has ${row.cellStyles.length} cell styles for ${row.cells.length} cells`, id)
    for (const style of [row.style, ...(row.cellStyles ?? [])]) checkStyle(style ?? undefined, id, walk.fonts)
  })
  checkKeptRows(table)
  checkStyle(table.headerStyle, id, walk.fonts)
  const narrow = table.columns.find((column) => column.width !== 'fill' && !(column.width > 2 * PADDING_X && Number.isFinite(column.width)))
  if (narrow !== undefined) throw new RenderRefusal('unsupported', `table ${id} has a column of ${String(narrow.width)} pt, no wider than its cell padding`, id)
  const widths = table.columns.map((column) => column.width)
  const fixed = fixedWidth(widths)
  if (fixed > width || fillWidth(widths, width) <= 2 * PADDING_X)
    throw new RenderRefusal('content-too-large', `table ${id}'s fixed columns are ${fixed} pt wide; it stands ${width.toFixed(2)} pt wide`, id)
  for (const row of styledRows(table)) {
    let [characters, endings] = [0, 0]
    row.cells.forEach((text, column) => {
      const where =
        row.index !== undefined
          ? `table ${id}, row ${row.index}, column ${column + 1},`
          : row.kind === 'header'
            ? `table ${id}'s header, column ${column + 1},`
            : `table ${id}'s empty text`
      checkText(text, cellFace(row.styles[column]!, row.kind), walk.fonts, where, id)
      // A cell is a paragraph of one run: the run and the mark each state the family its style names.
      characters += text.length + family(walk, row.styles[column]!.font, 2)
      endings += lineEndings(text)
    })
    count(walk, row.cells.length, characters, id, row.cells.length + endings)
  }
}

/** Refuses a table whose rows keep rows otherwise than the runtime writes them (0059), as the PDF renderer does. */
function checkKeptRows(table: Table): void {
  table.rows.forEach((row, index) => {
    const keeps: unknown = row.keepWithRows
    if (keeps === undefined) return
    const at = `row ${index} of table ${table.id}`
    if (row.kind !== 'groupHeader') throw new RenderRefusal('unsupported', `${at} keeps rows with it, and only a group header does`, table.id)
    if (!(typeof keeps === 'number' && Number.isInteger(keeps) && keeps >= 2 && keeps <= MAX_KEEP_WITH_ROWS)) {
      throw new RenderRefusal(
        'unsupported',
        `${at}, a group header, keeps ${typeof keeps === 'number' ? `${keeps} rows` : `rows by a count of type ${typeof keeps}`}; a group header keeps a whole number of them from 2 to ${MAX_KEEP_WITH_ROWS}, and only its first where it says none`,
        table.id,
      )
    }
    let details = 0
    while (table.rows[index + 1 + details]?.kind === 'detail') details++
    if (keeps > details) throw new RenderRefusal('unsupported', `${at}, a group header, keeps ${keeps} rows, and ${details} detail rows follow it`, table.id)
  })
}
