import type { Content, CustomTableLayout, TableCell } from 'pdfmake/interfaces.js'
import type { Table, TableColumn, TextStyle } from '@formancy/report-runtime'
import { mark, UNPLANNED, type Build, type RowKind } from './build.js'
import type { FaceWanted } from './host-fonts.js'
import { textProperties } from './style.js'
import { tableRules } from './table-rules.js'
import { columnWidths } from './widths.js'

/**
 * A table as pdfmake content: its header row repeated on every page it
 * spans, its rows styled, a row across the table as one cell spanning every
 * column, and the rule that keeps a group header with the row it heads.
 */

/** A table's cells, whose size the document does not set: the body size the corpus's geometry assumes. */
export const TABLE_SIZE = 9

/** The table layout: horizontal rules of half a point, no vertical ones, 4pt of padding at the sides and 2pt above and below. */
export const RULE = 0.5
export const PADDING_X = 4
export const PADDING_Y = 2
const TABLE_LAYOUT: CustomTableLayout = {
  hLineWidth: () => RULE,
  vLineWidth: () => 0,
  hLineColor: (index) => (index === 1 ? '#000000' : '#bfbfbf'),
  paddingLeft: () => PADDING_X,
  paddingRight: () => PADDING_X,
  paddingTop: () => PADDING_Y,
  paddingBottom: () => PADDING_Y,
}

/** Laid out as one line of text, as wide as a space, that no line break can fall in. */
const NO_BREAK_SPACE = String.fromCodePoint(0xa0)

/** The renderer's own style for a row of each kind, under the document's: the column header and every row but a detail row in bold. */
export const KIND_BOLD: Readonly<Record<RowKind, boolean>> = { header: true, empty: false, detail: false, groupHeader: true, groupFooter: true, total: true }

/** Whether `table` prints its empty text, in italic, in place of detail rows: where it has none, whatever else its rows are. */
export function printsEmptyText(table: Table): boolean {
  return !table.rows.some((row) => row.kind === 'detail')
}

/**
 * A row as `tableContent` lays it out, before it is pdfmake's: its kind,
 * where it stands in the table's rows -- none for the header and the empty
 * text, which the renderer adds -- its cells' text, the style each cell
 * prints in, and whether its one cell spans every column.
 */
export interface StyledRow {
  readonly kind: RowKind
  readonly index: number | undefined
  readonly cells: readonly string[]
  readonly styles: readonly TextStyle[]
  readonly across: boolean
}

/** A cell neither it nor its row styles. */
const UNSTYLED: TextStyle = {}

/** The empty text's style: italic, at the table's size. */
const EMPTY_TEXT: TextStyle = { italic: true }

/**
 * Every row of `table` as `tableContent` lays it out, each cell in the
 * style it prints in: the header in the header's style; the empty text,
 * in italic and across the table, where the table prints it; and each of
 * its rows, a cell in its own style where it has one, else its row's -- a
 * null cell style is the runtime's for a column with no style of its own
 * -- else none. The one walk of a table's cells: `tableContent` builds its
 * rows from it, check.ts holds every cell's text and line to it, and
 * bound.ts counts every row's least line by it, so that no two of them can
 * take a cell's style, its size or its face from different places. Each
 * row's cell count is check.ts's to have held to its columns first.
 */
export function styledRows(table: Table): StyledRow[] {
  const header = table.headerStyle ?? UNSTYLED
  const rows: StyledRow[] = [{ kind: 'header', index: undefined, cells: table.header, styles: table.header.map(() => header), across: false }]
  if (printsEmptyText(table)) rows.push({ kind: 'empty', index: undefined, cells: [table.emptyText], styles: [EMPTY_TEXT], across: true })
  table.rows.forEach((row, index) => {
    rows.push({ kind: row.kind, index, cells: row.cells, styles: row.cells.map((_, column) => row.cellStyles?.[column] ?? row.style ?? UNSTYLED), across: row.across === true })
  })
  return rows
}

/** The size a cell prints at: its style's, else the table's. */
export function cellSize(style: TextStyle): number {
  return style.size ?? TABLE_SIZE
}

/**
 * The face a cell of a row of `kind` prints in, as `tableContent` hands it
 * to pdfmake: its style's token, its style's weight where it sets one and
 * else the kind's, and its style's slant.
 */
export function cellFace(style: TextStyle, kind: RowKind): FaceWanted {
  return { token: style.font, bold: style.bold ?? KIND_BOLD[kind], italic: style.italic ?? false }
}

/** A table cell as the renderer makes it. A cell a column span covers is one too, as pdfmake requires, and pdfmake lays out nothing of it. */
export interface Cell {
  readonly text: string
  readonly alignment: TableColumn['align']
  readonly colSpan?: number
  headlineLevel?: number
  id?: string
  /** Set by a table's planned breaks (`table-rules.ts`). */
  pageBreak?: 'before'
}

/** A row as pdfmake lays it out: the header, the empty text in place of detail rows when there are none, the document's rows. */
export interface Row {
  readonly kind: RowKind
  readonly cells: readonly Cell[]
}

/**
 * The content of `table`, standing `width` wide: `kept` inside a keep-together
 * block or a page region, where no rule may break it; `record`ing its cells
 * for the word check; `top` the body's top, outside any frame, where its
 * breaks can be planned (`table-rules.ts`). Every column is handed to pdfmake
 * as a number, a fill column as its share, never as `'*'`, which pdfmake
 * widens to its longest word (`widths.ts`).
 */
export function tableContent(table: Table, build: Build, place: { readonly width: number; readonly kept: boolean; readonly record: boolean; readonly top: number }): Content {
  const { kept } = place
  const measuring = build.mode === 'measure'
  const columns = table.columns.length
  const widths = columnWidths(table.columns.map((column) => column.width), place.width).map((width) => width - 2 * PADDING_X)
  const across = place.width - 2 * PADDING_X
  // A no-break space where a cell is empty while measuring: every cell then
  // lays out one line, as tall as a cell of text beside it, so each row has a
  // first cell to mark.
  const cell = (text: string, column: number, kind: RowKind, style: TextStyle, span?: number): Cell => ({
    text: measuring && text === '' ? NO_BREAK_SPACE : text,
    alignment: style.align ?? table.columns[column]!.align,
    ...textProperties(style, { size: TABLE_SIZE, bold: KIND_BOLD[kind] }, build.familyOf),
    ...(span === undefined ? {} : { colSpan: span }),
  })
  // The cells a span covers: one per column after the first, laid out as nothing.
  const covered = (): Cell[] => table.columns.slice(1).map((_, index) => cell('', index + 1, 'detail', {}))
  const rows = styledRows(table).map(({ kind, cells, styles, across }): Row => {
    if (across) return { kind, cells: [cell(cells[0]!, 0, kind, styles[0]!, columns), ...covered()] }
    return { kind, cells: cells.map((text, column) => cell(text, column, kind, styles[column]!)) }
  })
  if (place.record) recordWords(table, rows, widths, across, build)
  const plan = build.plans.get(table) ?? UNPLANNED
  if (measuring) {
    build.measuredRows.set(table, rows.map((row) => ({ kind: row.kind, mark: mark(row.cells[0]!, build) })))
  } else if (!kept) {
    // In the body outside any frame, a page the table continues on starts under its top rule and repeated header.
    tableRules(rows, plan, build, place.top === build.bodyTop ? build.bodyTop + RULE + (plan.pitches[0] ?? 0) : undefined)
  }
  return {
    table: {
      headerRows: measuring ? 0 : 1,
      ...(measuring || plan.keepWithHeaderRows === 0 ? {} : { keepWithHeaderRows: plan.keepWithHeaderRows }),
      ...(measuring ? {} : { dontBreakRows: plan.dontBreakRows }),
      widths,
      body: rows.map((row): TableCell[] => [...row.cells]),
    },
    layout: TABLE_LAYOUT,
    fontSize: TABLE_SIZE,
  }
}

/** Every cell of the table, held to its column's width, or the table's for a cell across it (`words.ts`). */
function recordWords(table: Table, rows: readonly Row[], widths: readonly number[], across: number, build: Build): void {
  let row = 0
  for (const { kind, cells } of rows) {
    const which = kind === 'header' ? `the header of table ${table.id}` : kind === 'empty' ? `the empty text of table ${table.id}` : `row ${row++} of table ${table.id}`
    cells.forEach((cell, column) => {
      if (cell.text === '') return
      const spans = cell.colSpan !== undefined
      build.words.push({ node: cell, width: spans ? across : widths[column]!, lines: 1, what: spans ? which : `${which}, column ${column + 1}`, subject: table.id })
    })
  }
}
