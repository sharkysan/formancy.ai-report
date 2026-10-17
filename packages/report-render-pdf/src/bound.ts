import { RenderRefusal, type Block, type Table, type TextStyle } from '@formancy/report-runtime'
import { frameOf } from './content.js'
import { DEFAULT_SIZE, LINE_FACTOR } from './style.js'
import { PADDING_Y, TABLE_SIZE } from './table.js'

/**
 * A height the body cannot be shorter than, worked out from the document
 * alone, so that a job too long for its page limit is refused before
 * pdfmake measures it.
 *
 * pdfmake measures every node of a document before it lays out the first
 * page, and the page limit stops only the layout: refusing 100,000 table
 * rows against five pages took 20 seconds, all of it measuring, and nothing
 * could interrupt it (measured on 2026-10-15, on an Intel i9-10900K under
 * Node 24.21). A document whose least height is more than the limit's pages
 * of body is refused here, for nothing.
 *
 * Least, never more than pdfmake lays out, so that nothing that fits is
 * refused: a line of text is one line of its size, however it wraps; a
 * table row one line of its largest text and its padding, without its rule;
 * an image, a rectangle and a rule their own height, without the space
 * around a rule, and a QR code its side; a frame its border and padding
 * once. A spacer and a page break count nothing, since a spacer at the foot
 * of a page gives up its space, and a page region is not body.
 */
export function leastHeight(blocks: readonly Block[]): number {
  return blocks.reduce((sum, block) => sum + least(block), 0)
}

function least(block: Block): number {
  switch (block.kind) {
    case 'paragraph':
      return block.runs.length === 0 ? 0 : line(block.style, DEFAULT_SIZE)
    case 'table':
      return tableHeight(block)
    case 'image':
    case 'rectangle':
      return block.height
    case 'qrCode':
      return block.size
    case 'rule':
      return block.thickness
    case 'spacer':
    case 'pageBreak':
      return 0
    case 'keepTogether':
      return leastHeight(block.blocks)
    case 'section':
      return leastHeight(block.blocks) + 2 * frameOf(block)
    case 'columns':
      return Math.max(0, ...block.columns.map((slot) => leastHeight(slot.blocks)))
  }
}

function line(style: TextStyle | null | undefined, size: number): number {
  return (style?.size ?? size) * LINE_FACTOR
}

/** A row: one line of the largest text in it, and the cells' padding above and below. */
function rowHeight(cells: readonly string[], style: (column: number) => TextStyle | null | undefined): number {
  return Math.max(0, ...cells.map((text, column) => (text === '' ? 0 : line(style(column), TABLE_SIZE)))) + 2 * PADDING_Y
}

/** The header once, and each row. */
function tableHeight(table: Table): number {
  const header = rowHeight(table.header, () => table.headerStyle)
  return table.rows.reduce((sum, row) => sum + rowHeight(row.cells, (column) => row.cellStyles?.[column] ?? row.style), header)
}

/**
 * Refuses a body whose least height needs more than `maxPages` pages of
 * `bodyHeight`, with `reserved` points more at its end: the room a QR-bill's
 * slip keeps on the last page. That room is less than a page's body, so it
 * takes at least its own height of the pages whether it ends the last page
 * of the body or starts one of its own, and the two heights together stay
 * a least height.
 */
export function refuseOversized(blocks: readonly Block[], bodyHeight: number, maxPages: number, reserved = 0): void {
  const height = leastHeight(blocks) + reserved
  if (height > maxPages * bodyHeight) {
    const slip = reserved > 0 ? `, the ${reserved.toFixed(2)} pt the payment part's slip keeps at its end included` : ''
    throw new RenderRefusal('too-many-pages', `the report needs more than ${maxPages} pages: its body is at least ${height.toFixed(2)} pt tall${slip}, and ${maxPages} pages hold ${(maxPages * bodyHeight).toFixed(2)} pt`)
  }
}
