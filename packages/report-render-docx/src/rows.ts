import type { Table, TextStyle } from '@formancy/report-runtime'
import type { FaceWanted } from './fonts.js'
import { KIND_BOLD, TABLE_SIZE, type RowKind } from './look.js'

/**
 * A table's rows as a Word file holds them, before they are its XML
 * (0068): the column header, where the table has one (0078), the empty
 * text in place of detail rows where the table has none, and the
 * document's rows, each cell in the style it prints in. The one walk of a
 * table's cells in this package: the checks hold every cell's text to it
 * (`check-table.ts`) and the table is built from it (`table.ts`), so that
 * the two cannot take a cell's style from different places. It is the PDF
 * renderer's `styledRows` (`table.ts` there) stated again, with its own
 * kinds' bold and its size, and `against-pdf.test.ts` holds what comes of
 * it to the PDF.
 */
export interface StyledRow {
  readonly kind: RowKind
  /** Where it stands among the table's rows; none for the header and the empty text, which the writer adds. */
  readonly index: number | undefined
  readonly cells: readonly string[]
  readonly styles: readonly TextStyle[]
  readonly across: boolean
}

const UNSTYLED: TextStyle = {}

/** The empty text's style: italic, at the table's size. */
const EMPTY_TEXT: TextStyle = { italic: true }

/** Whether `table` prints its empty text in place of detail rows: where it has none, whatever else its rows are. */
export function printsEmptyText(table: Table): boolean {
  return !table.rows.some((row) => row.kind === 'detail')
}

/** Every row of `table` as it is laid out; each row's cell count is the checks' to have held to its columns first. */
export function styledRows(table: Table): StyledRow[] {
  const style = table.headerStyle ?? UNSTYLED
  const { header } = table
  const rows: StyledRow[] = header === undefined ? [] : [{ kind: 'header', index: undefined, cells: header, styles: header.map(() => style), across: false }]
  if (printsEmptyText(table)) rows.push({ kind: 'empty', index: undefined, cells: [table.emptyText], styles: [EMPTY_TEXT], across: true })
  table.rows.forEach((row, index) => {
    rows.push({
      kind: row.kind,
      index,
      cells: row.cells,
      styles: row.cells.map((_, column) => row.cellStyles?.[column] ?? row.style ?? UNSTYLED),
      across: row.across === true,
    })
  })
  return rows
}

/** The size a cell prints at: its style's, else the table's. */
export function cellSize(style: TextStyle): number {
  return style.size ?? TABLE_SIZE
}

/** The face a cell of a row of `kind` prints in: its style's token, its style's weight where it sets one and else the kind's, and its style's slant. */
export function cellFace(style: TextStyle, kind: RowKind): FaceWanted {
  return { token: style.font, bold: style.bold ?? KIND_BOLD[kind], italic: style.italic ?? false }
}

/** A row that closes what is above it: a group's footer, a total. */
const closes = (kind: RowKind | undefined): boolean => kind === 'groupFooter' || kind === 'total'

/**
 * Which of `rows` stand on a page with the row after them, by their place
 * in the list: the column header, where the table has one, so that it
 * never ends a page alone; a group header and as many rows after it as it
 * keeps, less one (0059); and each row before a closing row that follows
 * a detail row or the empty text, so that a subtotal and a total stand
 * with the last row they add up, never alone under a repeated header.
 * What the PDF renderer plans from measured heights (`breaks.ts` there)
 * is stated here as marks, and whether a page then holds them together
 * is Word's.
 */
export function keptRows(rows: readonly StyledRow[], table: Table): Set<number> {
  const kept = new Set<number>()
  if (rows[0]?.kind === 'header' && rows.length > 1) kept.add(0)
  // The last row above that closes nothing: what the closing rows under it add up. Carried down the table, never looked for from each
  // closing row, which cost a table of totals alone the square of its rows.
  let above: RowKind | undefined
  rows.forEach((row, at) => {
    const { kind } = row
    if (kind === 'groupHeader' && at + 1 < rows.length) {
      const keeps = table.rows[row.index!]!.keepWithRows ?? 1
      for (let each = 0; each < keeps; each++) kept.add(at + each)
    }
    if (!closes(kind)) above = kind
    else if (above === 'detail' || above === 'empty') kept.add(at - 1)
  })
  return kept
}
