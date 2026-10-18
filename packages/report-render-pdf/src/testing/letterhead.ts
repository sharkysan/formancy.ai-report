import { drawingsOn, inkAround, LETTERHEAD, LOGO_ASSET, rasterPixels, type Drawing, type PdfPage } from '@formancy/report-corpus'
import type { ReportDefinition } from '@formancy/report-runtime'
import { colourAt } from './svg.js'

/**
 * The firm's mark at the head of a first page (0032), as the PDF the engine
 * produced draws it (0003): read as 0030's drawings are, a rectangular clip
 * a painted path stands inside, never an image, of which the page has none
 * for it (report-corpus's `drawingsOn`). What the mark should be is stated
 * here, never read from the starters: 15 mm square, 42.52 pt to the
 * hundredth, at the left margin of 56.69 pt, painted in its deep blue and
 * in white, with 12 pt under it before any text. Where it is and in what
 * it is painted is held here; what it draws inside its box is its bytes',
 * pinned by the corpus's digest.
 */

/** Where every marked report's page starts its content, and how large the mark is, in points. */
export const MARGIN = 56.69
export const MARK_SIDE = 42.52
export const MARK_GAP = 12

/** The mark's two paints, as the corpus's reader writes them. */
export const MARK_PAINTS = ['#1f4e79', '#ffffff'] as const

/** A mark where a page draws it: its clip's box, `[x, top, width, height]` to the hundredth of a point, and the paints of the paths inside it, sorted. */
export type Mark = Pick<Drawing, 'box' | 'paints'>

const hundredth = (value: number): number => Math.round(value * 100) / 100

/** The drawings on `page` that paint the mark's blue, each by its box and its paints: the mark, once, where a page draws it, and nothing else in its colour. */
export const marksOn = (page: PdfPage): Mark[] => drawingsOn(page).flatMap(({ box, paints }) => (paints.includes(MARK_PAINTS[0]) ? [{ box, paints }] : []))

/** The mark as it should be drawn with its top at `top`: at the left margin, 15 mm square, in its two paints and no other. */
export const markAt = (top: number): Mark => ({ box: [MARGIN, top, MARK_SIDE, MARK_SIDE], paints: [...MARK_PAINTS] })

/**
 * `report` without its letterhead: the mark and the gap under it taken out
 * of its report header, and the mark's asset out of its assets, which is
 * the report as it printed before 0032. For a test that measures what the
 * mark costs, or holds a yardstick that should not move with it.
 */
export function withoutMark(report: ReportDefinition): ReportDefinition {
  const ids = new Set(LETTERHEAD.map((component) => component.id))
  return {
    ...report,
    assets: report.assets.filter((asset) => asset.id !== LOGO_ASSET.id),
    regions: { ...report.regions, reportHeader: report.regions.reportHeader.filter((component) => !ids.has(component.id)) },
  }
}

/** The text on `page` that stands beside `mark` or within the gap under it, with where it is: none, on a letterhead. */
export function crowding(page: PdfPage, mark: Mark): string[] {
  const [, top, , height] = mark.box
  return page.items.filter((item) => item.bottom > top && item.top < top + height + MARK_GAP).map((item) => `${item.text} at ${hundredth(item.x)}, ${hundredth(item.top)}`)
}

/**
 * What the pixels show of `mark` on page 1 of `bytes`, drawn by PDF.js at
 * four pixels to the point: the colour at a point of the disc above the
 * gable, the colour at a point of the drop, and any ink in a band of 2 pt
 * around the box, which a drawing past its clip would leave and the
 * operator list cannot show (report-corpus's `inkAround`).
 */
export async function markPixels(bytes: Uint8Array, mark: Mark): Promise<{ readonly disc: string; readonly drop: string; readonly around: readonly string[] }> {
  const scale = 4
  const pixels = await rasterPixels(bytes, 1, scale)
  const [x, top, width, height] = mark.box
  // The viewBox is 120 units a side: (60, 14) is on the disc above the gable, and (60, 80) inside the drop.
  const at = (u: number, v: number): string => colourAt(pixels, scale, x + (u / 120) * width, top + (v / 120) * height)
  return { disc: at(60, 14), drop: at(60, 80), around: inkAround(pixels, scale, { x, top, width, height, bottom: top + height }, 2) }
}
