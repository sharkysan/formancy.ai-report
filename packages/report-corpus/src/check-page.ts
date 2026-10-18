import { normalise, type Expectation } from './fixture.js'
import { pageLines, type Line } from './lines.js'
import type { PdfBox, PdfPage, ReadPdf } from './read-pdf.js'

/**
 * A page as the checks read it: its lines, sorted into the page header's,
 * the page footer's and the body's. A line belongs to a page region when it
 * reads as one of that region's lines -- the page header's and footer's
 * plain lines exactly, the footer's numbered line by its pattern -- wherever
 * on the page it is, so that a region drawn in the wrong place is still
 * found, and is then reported for where it is.
 */
export interface Page {
  readonly page: PdfPage
  /** Every line, top to bottom. */
  readonly lines: readonly Line[]
  readonly header: readonly Line[]
  readonly footer: readonly Line[]
  /** Every line that is neither, top to bottom. */
  readonly body: readonly Line[]
  /** The boxes of the SVG images drawn on the page, the page regions' and the body's: the clips their drawings are painted inside (`drawings.ts`). */
  readonly drawings: readonly PdfBox[]
}

/** `pdf`'s pages as the checks read them, each with the boxes of the SVG images `drawings` found on it, page by page. */
export function pagesOf(pdf: ReadPdf, expected: Expectation, drawings: readonly (readonly PdfBox[])[]): Page[] {
  const header = new Set(expected.pageHeaderLines.map(normalise))
  const footer = new Set(expected.pageFooterLines.map(normalise))
  const numbered = expected.footerEveryPage === undefined ? undefined : once(expected.footerEveryPage)
  return pdf.pages.map((page, index) => {
    const lines = pageLines(page)
    const region = (line: Line): 'header' | 'footer' | 'body' => {
      if (header.has(line.text)) return 'header'
      return footer.has(line.text) || numbered?.test(line.text) === true ? 'footer' : 'body'
    }
    return {
      page,
      lines,
      header: lines.filter((line) => region(line) === 'header'),
      footer: lines.filter((line) => region(line) === 'footer'),
      body: lines.filter((line) => region(line) === 'body'),
      drawings: drawings[index] ?? [],
    }
  })
}

/** `pattern` without the global and sticky flags, whose `lastIndex` would make one match depend on the one before. */
export function once(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''))
}

/**
 * Two boxes overlap when they share more than this many points both across
 * and down. Positions are read to a hundredth of a point, and two runs that
 * meet on one line share at most a fraction of a point where kerning pulls a
 * glyph across the join; text drawn over other text shares several points
 * both ways at any size the fixtures use. The same allowance says when one
 * line is above or below another, and when a line reaches into a page
 * region.
 */
export const OVERLAP = 1

/**
 * How far past a margin a box may reach before it is outside. Half a point
 * for rounding on every edge; at the top, a tenth of the font size more,
 * because a text box stands a font size above its bottom, and in a font with
 * a short ascender that is above the tallest glyph (Helvetica's capitals are
 * 0.718 em tall; the box reaches 0.8 em above the baseline). Half a point is
 * also how far a drawn image may differ from the size the document gives it.
 */
export const EDGE = 0.5
export const TOP_EDGE_PER_POINT = 0.1

/** No check reports more than this many problems; a lost page would otherwise be fifty lines saying so. */
const REPORTED = 10

export function capped(problems: string[]): string[] {
  return problems.length <= REPORTED ? problems : [...problems.slice(0, REPORTED), `and ${problems.length - REPORTED} more like these`]
}

/** Text short enough for a message, quoted: the first `length` characters. */
export function quoted(text: string, length = 40): string {
  return `'${text.length > length ? `${text.slice(0, length)}…` : text}'`
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function points(value: number): string {
  return String(Math.round(value * 100) / 100)
}

export function imageLabel(image: PdfBox): string {
  return `an image at ${points(image.x)}, ${points(image.top)}`
}

export function drawingLabel(drawing: PdfBox): string {
  return `a drawing at ${points(drawing.x)}, ${points(drawing.top)}`
}

/** What a page shows that is not text: its images and its SVG images' drawings, each with the words a problem names it by. */
export function pictures(page: Page): { readonly label: string; readonly box: PdfBox }[] {
  return [...page.page.images.map((box) => ({ label: imageLabel(box), box })), ...page.drawings.map((box) => ({ label: drawingLabel(box), box }))]
}
