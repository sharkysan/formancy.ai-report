/**
 * The viewer's numbers, each derived and said through Intl in the Studio's
 * language (English, as the editors it holds are opened in); and where the
 * paper opens on a document that carries a QR-bill (0090).
 */
import { clampZoom, PX_PER_PT } from '@formancy/report-builder-core'
import { QR_BILL_SIZE } from '@formancy/report-spec'

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

/**
 * The least zoom the paper opens a QR-bill at. Chosen, not measured: half
 * size, one of the design view's steps, at which a 10 pt line is 6.7 CSS
 * pixels high; beside the builder the Preview already opens a page at
 * 51 % (0029). A paper too short for the slip at half shows it from its
 * top, its title and its code, rather than a page too small to read.
 */
export const BILL_ZOOM_FLOOR = 0.5

/**
 * How tall a QR-bill's slip stands on the paper at `zoom`, in CSS pixels:
 * report-spec's `QR_BILL_SIZE`, 105 mm, which the renderer draws across
 * the foot of the last page (0022).
 */
export const slipHeight = (zoom: number): number => QR_BILL_SIZE.height * zoom * PX_PER_PT

/**
 * The zoom the paper opens a document's QR-bill at, `fit` being the zoom
 * Fit width gives and `view` the CSS pixels the paper shows its slip in:
 * `fit` where the slip is no taller than that at it; else the largest at
 * which it is, rounded down to a hundredth as `fitZoom` is, never under
 * `BILL_ZOOM_FLOOR` and never past `fit`, which would scroll the page
 * sideways.
 */
export function billZoom(fit: number, view: number): number {
  if (slipHeight(fit) <= view) return fit
  return Math.min(fit, Math.max(BILL_ZOOM_FLOOR, Math.floor((view / slipHeight(1)) * 100) / 100))
}

/**
 * How far down the paper opens on a document's QR-bill, `padding` being
 * the CSS pixels below its last page and `slip` the slip's height there.
 * The slip is the last thing on the paper, at the foot of the last page:
 * where it fits the view, the paper is scrolled to its end, the slip's
 * foot at the view's; where it does not, to the slip's top. A paper that
 * holds its pages whole is not scrolled.
 */
export function billScroll(paper: Pick<HTMLElement, 'scrollHeight' | 'clientHeight'>, padding: number, slip: number): number {
  return Math.max(0, paper.scrollHeight - Math.max(paper.clientHeight, padding + slip))
}
