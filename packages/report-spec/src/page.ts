/**
 * Page geometry: the size of each page the format names, the area its
 * margins leave, and the largest square that area holds. The validator's
 * margin check, the builder's rulers and the renderer read the same numbers
 * from here.
 */
import type { Orientation, PageSettings, PageSizeName } from './types.js'
import { mmToPt, POINTS_PER_INCH, roundPt } from './units.js'

export interface PageDimensions {
  readonly width: number
  readonly height: number
}

/**
 * Portrait sizes in points. A4 is ISO 216's 210 x 297 mm, converted and
 * rounded like any other length (595.28 x 841.89, the values PDF engines
 * use); Letter is 8.5 x 11 inches, exactly 612 x 792.
 */
export const PAGE_SIZES: { readonly [S in PageSizeName]: PageDimensions } = {
  A4: { width: mmToPt(210), height: mmToPt(297) },
  Letter: { width: 8.5 * POINTS_PER_INCH, height: 11 * POINTS_PER_INCH },
}

/** The page's width and height as oriented: landscape swaps the sides. */
export function pageDimensions(page: { readonly size: PageSizeName; readonly orientation: Orientation }): PageDimensions {
  const { width, height } = PAGE_SIZES[page.size]
  return page.orientation === 'portrait' ? { width, height } : { width: height, height: width }
}

/** What the margins leave of the oriented page, to the hundredth of a point that lengths are stored at. */
export function printableArea(page: PageSettings): PageDimensions {
  const { width, height } = pageDimensions(page)
  const { top, right, bottom, left } = page.margins
  return { width: roundPt(width - left - right), height: roundPt(height - top - bottom) }
}

/**
 * The largest square `area` holds: the length of its shorter side, and
 * which side that is, the width when the two are equal. The validator
 * measures a QR code's square against it and refuses one that overruns it
 * on that side; the builders size a new code by it and name it as the room
 * a refused size lacks.
 */
export function squareRoom(area: PageDimensions): { readonly side: 'width' | 'height'; readonly length: number } {
  return area.height < area.width ? { side: 'height', length: area.height } : { side: 'width', length: area.width }
}
