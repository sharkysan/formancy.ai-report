import { RenderRefusal, type Table, type TableRow } from '@formancy/report-runtime'
import { cellLine } from './bound.js'
import { checkStyle, checkText } from './check-faces.js'
import { tall, type Place, type Walk } from './check-walk.js'
import type { RenderFonts } from './host-fonts.js'
import { cellFace, PADDING_X, PADDING_Y, styledRows, type StyledRow } from './table.js'
import { fillWidth, fixedWidth } from './widths.js'

/** The tallest line of a table's rows under its header, and the row it is in: what every page the table reaches must hold under the repeated header (`refuseLineUnderHeader`). */
export interface RowLine {
  readonly line: number
  /** "row 2 of table lines, a total row," or "the empty text of table lines": the row, for a refusal, never its text. */
  readonly what: string
}

/**
 * Every cell of `table`, each as `styledRows` styles it, the walk
 * `tableContent` builds the table from: its text in the face it prints in
 * -- the renderer's weight for its row's kind under the cell's style's
 * font token, weight and slant; the empty text in italic, and only where
 * the table prints it, so a table of rows never asks for the face -- and
 * its line, the tallest of which is a row no page can start, and which
 * pdfmake would drop without a word: every cell's, at its size or the
 * table's, in the face it prints in (`cellLine`), so a host face of a
 * taller line than Roboto's is measured by its own. An empty cell's line
 * is counted too, since the measuring pass lays it out as a no-break
 * space of its size.
 *
 * Returns the tallest line of the rows under the header, and its row: one
 * that a page the table continues on cannot hold under the repeated header
 * is refused once the header is measured (`refuseLineUnderHeader`). There
 * is always one, since a table of no detail row prints its empty text.
 */
export function checkTableCells(table: Table, place: Place, walk: Walk): RowLine {
  const at = `table ${table.id}`
  let tallest = 0
  let under: RowLine | undefined
  // A running max, never a spread of one array per cell: a 100,000-row table would overflow the call stack.
  for (const row of styledRows(table)) {
    let line = 0
    row.cells.forEach((text, column) => {
      const style = row.styles[column]!
      const where =
        row.index !== undefined
          ? `${at}, row ${row.index}, column ${column + 1},`
          : row.kind === 'header'
            ? `${at}'s header, column ${column + 1},`
            : `${at}'s empty text`
      checkText(text, cellFace(style, row.kind), walk, where, table.id)
      line = Math.max(line, cellLine(style, row.kind, walk.fonts))
    })
    tallest = Math.max(tallest, line)
    const { kind } = row
    if (kind !== 'header' && line > (under?.line ?? 0)) under = { line, what: rowWords(table, kind, row.index) }
  }
  tall(walk, place, tallest + 2 * PADDING_Y, `a line of ${at}`, table.id)
  return under!
}

/** A row of the document's in a person's words, by its kind. */
const ROW_WORDS: Readonly<Record<TableRow['kind'], string>> = {
  detail: 'a detail row',
  groupHeader: 'a group header row',
  groupFooter: 'a group footer row',
  total: 'a total row',
}

/** A row under the header of `table`, for a refusal: the empty text, or where the row stands among the table's rows, `index`, and its kind. */
function rowWords(table: Table, kind: Exclude<StyledRow['kind'], 'header'>, index: number | undefined): string {
  return kind === 'empty' ? `the empty text of table ${table.id}` : `row ${String(index)} of table ${table.id}, ${ROW_WORDS[kind]},`
}

export function checkTable(table: Table, width: number, fonts: RenderFonts): void {
  const columns = table.columns.length
  if (columns === 0) throw new RenderRefusal('unsupported', `table ${table.id} has no columns`, table.id)
  if (table.columns.some((column) => column.align !== 'left' && column.align !== 'center' && column.align !== 'right'))
    throw new RenderRefusal('unsupported', `table ${table.id} aligns a column in a way the renderer does not know`, table.id)
  if (table.header.length !== columns)
    throw new RenderRefusal('unsupported', `the header of table ${table.id} has ${table.header.length} cells for ${columns} columns`, table.id)
  table.rows.forEach((row, index) => {
    const cells = row.across === true ? 1 : columns
    if (row.cells.length !== cells) {
      throw new RenderRefusal(
        'unsupported',
        `row ${index} of table ${table.id} has ${row.cells.length} cells for ${row.across === true ? 'a row across the table, which has one' : `${columns} columns`}`,
        table.id,
      )
    }
    if (row.cellStyles !== undefined && row.cellStyles.length !== row.cells.length) {
      throw new RenderRefusal(
        'unsupported',
        `row ${index} of table ${table.id} has ${row.cellStyles.length} cell styles for ${row.cells.length} cells`,
        table.id,
      )
    }
    for (const style of [row.style, ...(row.cellStyles ?? [])]) checkStyle(style ?? undefined, table.id, fonts)
  })
  checkStyle(table.headerStyle, table.id, fonts)
  const narrow = table.columns.find((column) => column.width !== 'fill' && !(column.width > 2 * PADDING_X && Number.isFinite(column.width)))
  if (narrow !== undefined)
    throw new RenderRefusal('unsupported', `table ${table.id} has a column of ${String(narrow.width)} pt, no wider than its cell padding`, table.id)
  const widths = table.columns.map((column) => column.width)
  const fixed = widths.reduce<number>((sum, each) => sum + fixedWidth(each), 0)
  if (fixed > width || fillWidth(widths, width) <= 2 * PADDING_X) {
    throw new RenderRefusal('content-too-large', `table ${table.id}'s fixed columns are ${fixed} pt wide; it stands ${width.toFixed(2)} pt wide`, table.id)
  }
}
