/**
 * The viewer's numbers, each derived and said through Intl in the Studio's
 * language (English, as the editors it holds are opened in).
 */
import { clampZoom, PX_PER_PT } from '@formancy/report-builder-core'

const LOCALE = 'en'
const plural = new Intl.PluralRules(LOCALE)
const number = new Intl.NumberFormat(LOCALE)

/** "1 page", "2 pages". */
export function count(n: number, one: string, other: string): string {
  return `${number.format(n)} ${plural.select(n) === 'one' ? one : other}`
}

/** "Page 2 of 12". */
export function pageOf(page: number, pages: number): string {
  return `Page ${number.format(page)} of ${number.format(pages)}`
}

/**
 * The zoom at which a page `width` points wide fills `room` CSS pixels and
 * no more, within the design view's zoom range; 100 % when either is
 * unknown. Rounded down to a hundredth, so the page is never a fraction of
 * a pixel wider than its room.
 */
export function fitZoom(room: number, width: number): number {
  if (!(room > 0) || !(width > 0)) return 1
  return clampZoom(Math.floor((room / (width * PX_PER_PT)) * 100) / 100)
}
