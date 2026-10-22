import { RenderRefusal, type Block, type Paragraph, type Table, type TextStyle } from '@formancy/report-runtime'
import type { RowKind } from './build.js'
import { frameOf, runFace } from './content.js'
import type { FaceWanted, RenderFonts } from './host-fonts.js'
import { DEFAULT_SIZE } from './style.js'
import { cellFace, cellSize, PADDING_Y, styledRows } from './table.js'

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
 * refused: a paragraph is one line of its size, however it wraps, as tall
 * as its tallest run, since pdfmake lays a line out as tall as the tallest
 * run on it; a table's row, the header and the empty text among them, one
 * line of its tallest cell of text, each cell as `styledRows` styles it,
 * and its padding, without its rule; an image, a rectangle and a rule
 * their own height, without the space around a rule, and a QR code and an
 * EPC QR code its side; a frame its border and padding once. A spacer and
 * a page break count nothing, since a spacer at the foot of a page gives
 * up its space, and a page region is not body.
 *
 * A line is its size times the line of the face it prints in (0043), the
 * face check.ts held its text to, never another face the report maps: a
 * host face of a shorter line than Roboto's lowers no bound but its own
 * text's, and none lower than report-spec's reader admits,
 * `MIN_FONT_LINE` ems.
 */
export function leastHeight(blocks: readonly Block[], fonts: Pick<RenderFonts, 'face'>): number {
  return blocks.reduce((sum, block) => sum + least(block, fonts), 0)
}

function least(block: Block, fonts: Pick<RenderFonts, 'face'>): number {
  switch (block.kind) {
    case 'paragraph':
      return paragraphLine(block, fonts)
    case 'table':
      return tableHeight(block, fonts)
    case 'image':
    case 'rectangle':
      return block.height
    case 'qrCode':
    case 'epcQrCode':
      return block.size
    case 'rule':
      return block.thickness
    case 'spacer':
    case 'pageBreak':
      return 0
    case 'keepTogether':
      return leastHeight(block.blocks, fonts)
    case 'section':
      return leastHeight(block.blocks, fonts) + 2 * frameOf(block)
    case 'columns':
      return Math.max(0, ...block.columns.map((slot) => leastHeight(slot.blocks, fonts)))
  }
}

/** A line of `size` in the face `wanted` names: check.ts resolved every face a block prints in before the bound is taken, so none is refused here. */
function line(size: number, wanted: FaceWanted, fonts: Pick<RenderFonts, 'face'>): number {
  return size * fonts.face(wanted.token, wanted.bold, wanted.italic, '').lineFactor
}

/**
 * One line of the paragraph, as tall as its tallest run's, since pdfmake
 * lays a line out as tall as the tallest run on it; nothing for a paragraph
 * of no runs. It is the least a paragraph takes of the body, and a line of
 * it no page can hold, which check.ts refuses where it is taller than the
 * body.
 */
export function paragraphLine(paragraph: Paragraph, fonts: Pick<RenderFonts, 'face'>): number {
  const size = paragraph.style?.size ?? DEFAULT_SIZE
  let tallest = 0
  for (const run of paragraph.runs) tallest = Math.max(tallest, line(size, runFace(paragraph.style, run), fonts))
  return tallest
}

/** A cell's line: its size times the line of the face it prints in, as `styledRows` styles it. check.ts refuses a row whose cell's line, with its padding, is taller than the body. */
export function cellLine(style: TextStyle, kind: RowKind, fonts: Pick<RenderFonts, 'face'>): number {
  return line(cellSize(style), cellFace(style, kind), fonts)
}

/** Each row the table lays out: one line of the tallest cell of text in it, and the cells' padding above and below. */
function tableHeight(table: Table, fonts: Pick<RenderFonts, 'face'>): number {
  let height = 0
  for (const row of styledRows(table)) {
    let tallest = 0
    row.cells.forEach((text, column) => {
      if (text !== '') tallest = Math.max(tallest, cellLine(row.styles[column]!, row.kind, fonts))
    })
    height += tallest + 2 * PADDING_Y
  }
  return height
}

/**
 * Refuses a body whose least height needs more than `maxPages` pages of
 * `bodyHeight`, with `reserved` points more at its end: the room a QR-bill's
 * slip keeps on the last page. That room is less than a page's body, so it
 * takes at least its own height of the pages whether it ends the last page
 * of the body or starts one of its own, and the two heights together stay
 * a least height.
 */
export function refuseOversized(blocks: readonly Block[], bodyHeight: number, maxPages: number, fonts: Pick<RenderFonts, 'face'>, reserved = 0): void {
  const height = leastHeight(blocks, fonts) + reserved
  if (height > maxPages * bodyHeight) {
    const slip = reserved > 0 ? `, the ${reserved.toFixed(2)} pt the payment part's slip keeps at its end included` : ''
    throw new RenderRefusal('too-many-pages', `the report needs more than ${maxPages} pages: its body is at least ${height.toFixed(2)} pt tall${slip}, and ${maxPages} pages hold ${(maxPages * bodyHeight).toFixed(2)} pt`)
  }
}
