import type { Table } from '@formancy/report-runtime'
import type { DocxFonts } from './fonts.js'
import { BLACK, HEADER_RULE, KIND_BOLD, PADDING_X, PADDING_Y, ROW_RULE, RULE } from './look.js'
import { withoutLastEnding, type CellNode, type ParagraphNode, type RowNode, type TableNode } from './nodes.js'
import { cellSize, keptRows, styledRows } from './rows.js'
import { twips } from './units.js'
import { columnWidths } from './widths.js'

/**
 * A table as a Word table of fixed layout, standing `width` wide (0068):
 * its grid the columns' widths, a fill column its share; its header row
 * marked as the one Word repeats on every page the table reaches; every
 * row marked not to split, since a row is kept whole wherever the PDF
 * can keep it; a row across the table one cell spanning every column;
 * the empty text in place of detail rows where the table has none; and
 * the rows that stand on a page together marked to (`keptRows`). A cell
 * is one paragraph of the document's string, never a number, in the
 * style `styledRows` gives it, without the line ending that ends it,
 * which is no break; an empty cell is an empty paragraph of its size, as
 * tall as a cell of text beside it.
 *
 * Its rules and padding are the PDF's (`look.ts`): a rule above it, under
 * it and between its rows, the one under the header darker, none at its
 * sides.
 */
export function tableNode(table: Table, fonts: DocxFonts, width: number): TableNode {
  const grid = columnWidths(
    table.columns.map((column) => column.width),
    width,
  ).map(twips)
  const whole = grid.reduce((sum, each) => sum + each, 0)
  const styled = styledRows(table)
  const kept = keptRows(styled, table)
  const rows = styled.map((row, at): RowNode => {
    const header = row.kind === 'header'
    const cells = row.cells.map((stated, column): CellNode => {
      const style = row.styles[column]!
      const family = fonts.family(style.font)
      const size = cellSize(style)
      const align = style.align ?? table.columns[column]!.align
      const text = withoutLastEnding(stated)
      const paragraph: ParagraphNode = {
        kind: 'paragraph',
        runs:
          text === ''
            ? []
            : [
                {
                  kind: 'text',
                  text,
                  style: { family, size, bold: style.bold ?? KIND_BOLD[row.kind], italic: style.italic ?? false, color: style.color ?? BLACK },
                },
              ],
        mark: { family, size },
        ...(align === 'left' ? {} : { align }),
        keepNext: kept.has(at),
        keepLines: false,
      }
      return {
        width: row.across ? whole : grid[column]!,
        ...(row.across ? { span: grid.length } : {}),
        ...(header ? { borders: { bottom: { weight: RULE, color: HEADER_RULE } } } : {}),
        content: [paragraph],
      }
    })
    return { cantSplit: true, ...(header ? { header: true as const } : {}), cells }
  })
  return { kind: 'table', grid, rules: { weight: RULE, color: ROW_RULE }, padding: { x: PADDING_X, y: PADDING_Y }, rows }
}
