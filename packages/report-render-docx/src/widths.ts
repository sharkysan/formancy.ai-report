import type { TableColumn } from '@formancy/report-runtime'

/** Points, or `'fill'` for an equal share of what the fixed widths leave. */
type Width = TableColumn['width']

/**
 * A table's and a columns block's widths in points, a fill column its
 * share of what the fixed ones leave: what a Word table of fixed layout
 * is given as its grid. The PDF renderer's own arithmetic (`widths.ts`
 * there), stated again, since a document's widths mean one thing to
 * every engine; `against-pdf.test.ts` holds a document both would refuse
 * for its widths to the same refusal.
 */

/** The fixed widths of `widths`, summed. */
export function fixedWidth(widths: readonly Width[]): number {
  return widths.reduce<number>((sum, each) => sum + (each === 'fill' ? 0 : each), 0)
}

/** The width each `'fill'` gets of `width`: what the fixed widths leave, shared equally. Infinity when there is none. */
export function fillWidth(widths: readonly Width[], width: number): number {
  const fills = widths.filter((each) => each === 'fill').length
  return fills === 0 ? Infinity : (width - fixedWidth(widths)) / fills
}

/** Each column's width in points, of `width`: a fixed one its own, each fill its share. */
export function columnWidths(widths: readonly Width[], width: number): number[] {
  const fill = fillWidth(widths, width)
  return widths.map((each) => (each === 'fill' ? fill : each))
}
