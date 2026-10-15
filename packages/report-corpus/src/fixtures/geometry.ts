import { pageDimensions, type PageSetup } from '../document.js'

/**
 * The page every fixture uses, and the nominal model the boundary fixtures
 * are sized with.
 *
 * Engines measure text their own way: a line's height, a cell's padding and
 * the space a page header takes are each engine's choice. No fixture can put
 * a boundary in the same place for every engine, so each one says what it
 * computed, and either covers the whole range an engine might plausibly fall
 * in (group-boundary) or checks only what must hold wherever the boundary
 * falls (the summary fixtures). The model:
 *
 * - body text 9pt, page header and footer 8pt, each one line;
 * - a line is 1.2 times its font size -- Roboto's natural line is 1.17
 *   (2400 of 2048 units), Helvetica's 1.16, and 1.2 is the common default;
 * - 6pt between the page header and the body, and between the body and the
 *   footer.
 */
export const PAGE: PageSetup = { size: 'A4', orientation: 'portrait', margins: { top: 36, right: 40, bottom: 36, left: 40 } }

export const BODY_SIZE = 9
export const SMALL_SIZE = 8
const LINE_FACTOR = 1.2
const REGION_GAP = 6

export function lineHeight(size: number): number {
  return size * LINE_FACTOR
}

const { width, height } = pageDimensions(PAGE)

/** 515.28pt on A4 with 40pt side margins. */
export const PRINTABLE_WIDTH = width - PAGE.margins.left - PAGE.margins.right

/** The body's height when a line is `lineFactor` times its font size: the printable area less one header line, one footer line and the gap after and before each. */
export function bodyHeight(lineFactor: number): number {
  return height - PAGE.margins.top - PAGE.margins.bottom - 2 * (SMALL_SIZE * lineFactor + REGION_GAP)
}

/** The body's height in the nominal model: 738.69pt. */
export const BODY_HEIGHT = bodyHeight(LINE_FACTOR)

/** Line heights an engine might use, as multiples of the font size. */
export const LINE_FACTOR_RANGE = { min: 1.1, max: 1.3 } as const

/**
 * How wide an average character of running text is, in em, at the extremes:
 * lowercase letters, digits and spaces average about half an em in Roboto and
 * Helvetica, a space a quarter, a digit 0.56.
 */
export const CHAR_EM_RANGE = { min: 0.4, max: 0.6 } as const

/**
 * The heights a single-line row of 9pt text might have in any engine: a line
 * of 1.1 to 1.3 em (9.9 to 11.7pt) with 1 to 6pt of padding and rule above
 * and below.
 */
const ROW_HEIGHT_RANGE = { min: 12, max: 24 } as const

/** Detail rows that fit in the body under the repeated header row, for one row height. */
function rowsPerPage(rowHeight: number): number {
  return Math.floor(BODY_HEIGHT / rowHeight) - 1
}

/** 29 to 60 rows a page across `ROW_HEIGHT_RANGE`. */
export const ROWS_PER_PAGE_RANGE = { min: rowsPerPage(ROW_HEIGHT_RANGE.max), max: rowsPerPage(ROW_HEIGHT_RANGE.min) } as const

/**
 * The fewest and most pages `characters` of running text take in a column
 * `columnWidth` wide, from the extremes of `CHAR_EM_RANGE` and
 * `LINE_FACTOR_RANGE`, with `extraLines` more lines of other text on the
 * pages. The most allows one more page for where a page break falls.
 */
export function pagesOfText(characters: number, columnWidth: number, extraLines: number): { min: number; max: number } {
  const lines = (em: number): number => Math.ceil((characters * em * BODY_SIZE) / columnWidth) + extraLines
  return {
    min: Math.max(1, Math.ceil((lines(CHAR_EM_RANGE.min) * BODY_SIZE * LINE_FACTOR_RANGE.min) / BODY_HEIGHT)),
    max: Math.ceil((lines(CHAR_EM_RANGE.max) * BODY_SIZE * LINE_FACTOR_RANGE.max) / BODY_HEIGHT) + 1,
  }
}

/** The fewest and most pages a table of `rows` single-line rows takes, from `ROWS_PER_PAGE_RANGE`. */
export function pagesOfRows(rows: number): { min: number; max: number } {
  return { min: Math.ceil(rows / ROWS_PER_PAGE_RANGE.max), max: Math.ceil(rows / ROWS_PER_PAGE_RANGE.min) }
}
