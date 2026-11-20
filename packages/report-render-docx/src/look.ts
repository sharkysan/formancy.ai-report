import type { TableRow } from '@formancy/report-runtime'

/**
 * What the resolved document leaves to an engine, as the PDF renderer
 * decides it, stated again (0068): the sizes text prints at where no
 * style says, bold for a table's header, group and total rows, a table's
 * rules and padding, the space around a rule, a rectangle's outline, the
 * gap between a page region and the body, and the face the sans token
 * prints in where the report maps none. Each is report-render-pdf's own
 * constant, named beside it; nothing imports the renderer here, since a
 * writer that did would carry pdfmake and ECharts for a few numbers.
 *
 * Stated twice, so held together by a test, not by an import:
 * `against-pdf.test.ts` reads the sizes, the weights and the slant from
 * the PDF the renderer draws of the same document, a chart's words among
 * them. The rules, the padding and the gaps print nothing a reader of the
 * PDF's text sees, and are held by review; so are a chart's marks, which
 * Word draws from what the file states and nothing here sees drawn.
 */

/** Text when a paragraph names no size: report-render-pdf's `DEFAULT_SIZE` (`style.ts`). */
export const DEFAULT_SIZE = 10

/** A table's cells where their style names no size: its `TABLE_SIZE` (`table.ts`). */
export const TABLE_SIZE = 9

/** A row as the writer lays it out: the document's kinds, the column header, and the empty text in place of detail rows. */
export type RowKind = TableRow['kind'] | 'header' | 'empty'

/** Bold where a cell's style says nothing: its `KIND_BOLD`, the column header and every row but a detail row. */
export const KIND_BOLD: Readonly<Record<RowKind, boolean>> = { header: true, empty: false, detail: false, groupHeader: true, groupFooter: true, total: true }

/** A table's horizontal rules, half a point, and its cells' padding, four points at the sides and two above and below: its `RULE`, `PADDING_X` and `PADDING_Y`. */
export const RULE = 0.5
export const PADDING_X = 4
export const PADDING_Y = 2

/** The rule under the column header, and every other rule of a table: its `TABLE_LAYOUT`'s colours. */
export const HEADER_RULE = '#000000'
export const ROW_RULE = '#bfbfbf'

/** Space above and below a rule's line: its `RULE_GAP` (`content.ts`). */
export const RULE_GAP = 3

/** The weight a rectangle's outline is drawn at: its `OUTLINE`. */
export const OUTLINE = 0.5

/** Between the page header and the body, and between the body and the page footer: its `REGION_GAP` (`definition.ts`). */
export const REGION_GAP = 6

/** The family the sans token prints in where the report maps no host font: its `ROBOTO` (`style.ts`). */
export const ROBOTO = 'Roboto'

/** What prints where a style names no colour: black, as pdfmake draws text. */
export const BLACK = '#000000'

/** A chart's words where its style names no size: its `CHART_TEXT_SIZE` (`chart-faces.ts`). */
export const CHART_TEXT_SIZE = 8

/**
 * A chart's marks, as the PDF renderer's option states them
 * (`chart-option.ts`): of a category's slot, the room between one
 * category's bars and the next's, and of a bar's width, the room between
 * two bars of one category, its `BAR_CATEGORY_GAP` and `BAR_GAP`; a
 * line's width and its marker's radius, its `LINE_WIDTH` and
 * `POINT_RADIUS`; and the gridlines and the category axis's line, its
 * `GRID` and `AXIS`. A Word file states the first two as Word states
 * them, in whole hundredths of a bar's width (`chart-xml.ts`).
 */
export const BAR_CATEGORY_GAP = 0.2
export const BAR_GAP = 0.25
export const LINE_WIDTH = 1.5
export const POINT_RADIUS = 2
export const GRID = { color: '#d9d9d9', weight: 0.5 } as const
export const AXIS = { color: '#000000', weight: 0.75 } as const
