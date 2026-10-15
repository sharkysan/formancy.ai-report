import type { Content, CustomTableLayout, TableCell } from 'pdfmake/interfaces.js'
import type { Table, TableColumn, TextStyle } from '@formancy/report-runtime'
import { mark, UNPLANNED, type Build, type RowKind } from './build.js'
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
    ...textProperties(style, { size: TABLE_SIZE, bold: KIND_BOLD[kind] }),
    ...(span === undefined ? {} : { colSpan: span }),
  })
  // The cells a span covers: one per column after the first, laid out as nothing.
  const covered = (): Cell[] => table.columns.slice(1).map((_, index) => cell('', index + 1, 'detail', {}))
  const empty = !table.rows.some((row) => row.kind === 'detail')
  const rows: Row[] = [
    { kind: 'header', cells: table.header.map((text, column) => cell(text, column, 'header', table.headerStyle ?? {})) },
    ...(empty ? [{ kind: 'empty' as const, cells: [cell(table.emptyText, 0, 'empty', { italic: true }, columns), ...covered()] }] : []),
    ...table.rows.map((row): Row => {
      const style = (column: number): TextStyle => row.cellStyles?.[column] ?? row.style ?? {}
      if (row.across === true) return { kind: row.kind, cells: [cell(row.cells[0]!, 0, row.kind, style(0), columns), ...covered()] }
      return { kind: row.kind, cells: row.cells.map((text, column) => cell(text, column, row.kind, style(column))) }
    }),
  ]
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
