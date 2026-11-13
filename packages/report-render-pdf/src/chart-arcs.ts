import type { PieCircle } from './chart-option.js'
import { heldPath, pathParts, type PathPart } from './chart-svg.js'

/**
 * A pie's slices drawn on the pie's own circle (0058). zrender writes the
 * arc of a slice as one SVG arc, its ends and its radius rounded to a
 * tenth of a point (svg/SVGPathRebuilder.js), and svg-to-pdfkit draws an
 * arc on the circle it works out again through those two ends (SVG 1.1
 * F.6.5, `SvgShape.A` in pdfmake's copy). Through ends a tenth off, that
 * circle stands off the pie's near half a turn, and turns about the ends
 * near a whole one; where both ends round to one point it is no circle,
 * and the arc is left out (F.6.2). Measured on 2026-11-13, as zrender
 * writes them: a slice of 0.4938 of a pie 257.5 pt in radius printed 5 pt
 * off its circle, the larger slice of 9998 and 2 on a circle 57 pt from
 * the pie's, and a pie of 9999 and 1 at 160.23 pt nothing at all.
 *
 * So every arc of a slice is written again before the drawing is read
 * (`chart-svg.ts`), as arcs of at most a quarter turn about the pie's own
 * centre and of its own radius -- the circle ECharts is handed
 * (`pieCircle`) -- from and to the very points zrender wrote, so that two
 * neighbours still meet where zrender put their common end; each point
 * between is on the circle, written as JavaScript writes a double. An
 * arc turns as far as its ends stand apart about the centre, the way its
 * sweep flag says, within the half of a turn its large-arc flag says,
 * which zrender sets from the slice's exact sweep: a large arc whose ends
 * meet is the whole turn zrender drew, a small one whose ends meet turns
 * nothing and is drawn as nothing, as before, and one whose ends rounding
 * crossed turns back the little they crossed. A slice the reader would
 * refuse as ECharts wrote it is left so, for the reader to refuse.
 *
 * Each slice stays one path, a slice of no share is still none
 * (`chart-option.ts`), and no other path is touched: a legend's swatch,
 * and a bar or a line chart, are ECharts' own. Every point of a slice's
 * outline then stands within 0.1 pt of its share's sector on the pie's
 * circle (`chart-arcs.test.ts`), and every point of the sector within 0.1
 * pt of the outline: 0.088 pt at most, either way, over the 63,184 slices
 * drawn as sectors of 14,381 pies the renderer drew, of radii 36 to 257.5
 * pt -- among them each pie found printed more than 0.5 pt off its
 * circle, or blank, as zrender writes it -- read back by PDF.js, each
 * curve sampled (measured on 2026-11-13). Two kinds of slice are drawn as
 * zrender draws them: one within 10^-4 of a radian of a whole turn is a
 * whole circle, with no line to the centre, which stood within 0.049 pt
 * of the pie's circle; and one whose arc is shorter than the rounding,
 * its two ends one point, draws no curve, its arc at most 0.097 pt long.
 */

/** Radians: a whole turn, and the most an arc of a slice turns once written again. */
const TURN = 2 * Math.PI
const QUARTER = TURN / 4

/** A slice as zrender writes it: a `<path>` written as the chart's own, its `d` first. Any other path is not the pie's. */
const SLICE = /<path d="([^"]*)"(?=[^>]*\secmeta_ssr_type="chart")/g

/** `svg`, ECharts' drawing of a pie on `circle`, with every arc of its slices written again on it. */
export function pieArcs(svg: string, circle: PieCircle): string {
  return svg.replace(SLICE, (_, d: string) => `<path d="${arcsOf(d, circle)}"`)
}

/**
 * `d`, a slice's path, each of its arcs written again on `circle`, from
 * the point the converter takes it from (`pathParts`), and everything else
 * as written. A path the reader would refuse is left as written, for it to
 * refuse: written again, it could pass.
 */
function arcsOf(d: string, circle: PieCircle): string {
  if (!heldPath(d)) return d
  let written = ''
  let after = 0
  for (const part of pathParts(d)) {
    if (part.command !== 'A') continue
    written += d.slice(after, part.index) + quarters(part, circle)
    after = part.index + part.written.length
  }
  return written + d.slice(after)
}

/**
 * An arc of a slice as arcs of at most a quarter turn on `circle`, ending
 * where it ends: its turn about the centre the one, among those its ends
 * allow, nearest the middle of the half its large-arc flag says, three
 * quarters of a turn or a quarter. Every number of a path the reader holds
 * reads as a double, an infinite one among them, so that every angle and
 * every turn here is one.
 */
function quarters({ from, to, numbers }: PathPart, { centre: [cx, cy], radius }: PieCircle): string {
  const [, , , large, sweep] = numbers
  // The way the angle grows on the page, whose y runs down: a sweep flag of 1 is clockwise.
  const way = sweep === '1' ? 1 : -1
  const angle = ([px, py]: readonly [number, number]): number => Math.atan2(py - cy, px - cx)
  const begins = angle(from)
  const apart = way * (angle(to) - begins)
  const middle = large === '1' ? 3 * QUARTER : QUARTER
  const turn = apart + TURN * Math.round((middle - apart) / TURN)
  const count = Math.max(1, Math.ceil(Math.abs(turn) / QUARTER))
  // An arc turned back runs against its flag.
  const flag = turn < 0 === (way === 1) ? 0 : 1
  return Array.from({ length: count }, (_, index) => {
    const along = begins + (way * turn * (index + 1)) / count
    const end = index + 1 === count ? numbers.slice(5).join(' ') : `${String(cx + radius * Math.cos(along))} ${String(cy + radius * Math.sin(along))}`
    return `A${String(radius)} ${String(radius)} 0 0 ${String(flag)} ${end}`
  }).join('')
}
