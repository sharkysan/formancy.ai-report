import type { TableColumn } from '@formancy/report-runtime'

/** Points, or `'fill'` for an equal share of what the fixed widths leave. */
type Width = TableColumn['width']

/**
 * Widths as the renderer hands them to pdfmake: always a number of points.
 * pdfmake widens a column it is handed as `'*'` to its longest word, so a
 * table, a columns block or a frame grew past the page with a long word in
 * it; a fill column is therefore its share of the width worked out here,
 * the one place the check (`check.ts`) and the content (`content.ts`,
 * `table.ts`) take it from.
 */

/** Points, or nothing for `'fill'`. */
export function fixedWidth(width: Width): number {
  return width === 'fill' ? 0 : width
}

/** The width each `'fill'` gets of `width`: what the fixed widths leave, shared equally. Infinity when there is none. */
export function fillWidth(widths: readonly Width[], width: number): number {
  const fixed = widths.reduce<number>((sum, each) => sum + fixedWidth(each), 0)
  const fills = widths.filter((each) => each === 'fill').length
  return fills === 0 ? Infinity : (width - fixed) / fills
}

/** Each column's width in points, of `width`: a fixed one its own, each fill its share. */
export function columnWidths(widths: readonly Width[], width: number): number[] {
  const fill = fillWidth(widths, width)
  return widths.map((each) => (each === 'fill' ? fill : each))
}
