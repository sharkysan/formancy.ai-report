import type { PlacedChart, PlacedDrawings } from './drawings.js'
import { normalise, type Expectation, type ExpectedImage } from './fixture.js'
import { pageLines, type Line } from './lines.js'
import type { PdfBox, PdfPage, ReadPdf } from './read-pdf.js'

/**
 * A page as the checks read it: its lines, sorted into the page header's,
 * the page footer's and the body's. A line belongs to a page region when it
 * reads as one of that region's lines -- the header's and footer's plain
 * lines exactly, the footer's numbered line by its pattern -- wherever on
 * the page it is, so that a region drawn in the wrong place is still found,
 * and is then reported for where it is. Page 1's header is its own where
 * the document gives it one (0060), and the page header on every other
 * page (`regionsOn`).
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
  /** The charts drawn on the page, each found by its clip in the same walk as the SVG images (`drawings.ts`). */
  readonly charts: readonly PlacedChart[]
}

/** What a page shows of its page regions: on page 1, page 1's own where the document gives it a header of its own (0060), and every page's otherwise. */
export interface PageRegions {
  /** Whether these are page 1's own. */
  readonly own: boolean
  readonly headerLines: readonly string[]
  readonly regionImages: readonly ExpectedImage[]
  /** The lines of the other header, which this page must not print: the page header's on page 1 under its own, page 1's own on every other page. */
  readonly otherLines: readonly string[]
}

/** What page `number` shows of its page regions, by what `expected` says of page 1 and of every page. */
export function regionsOn(expected: Expectation, number: number): PageRegions {
  const { firstPage } = expected
  const every = { headerLines: expected.pageHeaderLines, regionImages: expected.pageRegionImages }
  if (firstPage === undefined) return { own: false, ...every, otherLines: [] }
  const own = number === 1
  const [mine, other] = own ? [firstPage.headerLines, expected.pageHeaderLines] : [expected.pageHeaderLines, firstPage.headerLines]
  // A line both headers print, or the footer does, is no sign of the wrong one: a preview's label heads both.
  const shared = new Set([...mine, ...expected.pageFooterLines].map(normalise))
  return { own, ...(own ? firstPage : every), otherLines: other.filter((line) => !shared.has(normalise(line))) }
}

/** `pdf`'s pages as the checks read them, each with the SVG images' boxes and the charts `drawings` placed on it, page by page. */
export function pagesOf(pdf: ReadPdf, expected: Expectation, drawings: Pick<PlacedDrawings, 'boxes' | 'charts'>): Page[] {
  const footer = new Set(expected.pageFooterLines.map(normalise))
  const numbered = expected.footerEveryPage === undefined ? undefined : once(expected.footerEveryPage)
  return pdf.pages.map((page, index) => {
    const header = new Set(regionsOn(expected, page.number).headerLines.map(normalise))
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
      drawings: drawings.boxes[index] ?? [],
      charts: drawings.charts[index] ?? [],
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

export function chartLabel({ id, box }: PlacedChart): string {
  return `the chart ${id} at ${points(box.x)}, ${points(box.top)}`
}

/** Something a page shows that is not text, by the words a problem names it by; a chart's by its id too. */
export interface Picture {
  readonly label: string
  readonly box: PdfBox
  readonly chart?: string
}

/** What a page shows that is not text: its images, its SVG images' drawings and its charts, each by their boxes, which the layout's checks hold as they hold an image's. */
export function pictures(page: Page): Picture[] {
  return [
    ...page.page.images.map((box) => ({ label: imageLabel(box), box })),
    ...page.drawings.map((box) => ({ label: drawingLabel(box), box })),
    ...page.charts.map((chart) => ({ label: chartLabel(chart), box: chart.box, chart: chart.id })),
  ]
}
