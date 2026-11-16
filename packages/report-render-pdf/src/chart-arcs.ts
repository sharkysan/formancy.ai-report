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
 * (`chart-svg.ts`), in two pieces or more, each of at most a quarter turn
 * about the pie's own centre and of its own radius -- the circle ECharts
 * is handed (`pieCircle`) -- from and to the very points zrender wrote, so
 * that two neighbours still meet where zrender put their common end; each
 * point between is on the circle, written as JavaScript writes a double.
 * An arc turns as far as its ends stand apart about the centre, the way
 * its sweep flag says, within the half of a turn its large-arc flag says,
 * which zrender sets from the slice's exact sweep: a large arc whose ends
 * meet is the whole turn zrender drew, a small one whose ends meet turns
 * nothing, out to the circle and back, and one whose ends rounding crossed
 * turns back the little they crossed. A slice the reader would refuse as
 * ECharts wrote it, or with an arc of any radius but the pie's to
 * zrender's rounding, is left so, for the reader to judge as written.
 *
 * Each slice stays one path, a slice of no share is still none
 * (`chart-option.ts`), and no other path is touched: a legend's swatch,
 * and a bar or a line chart, are ECharts' own.
 *
 * The bound, by its reason. zrender rounds a point to a tenth, at most
 * half a tenth's diagonal, 0.1 · √2 / 2 ≈ 0.0707 pt, from where it
 * belongs. Each arc the converter is handed has an end on the pie's
 * circle, and its other end on it too, or zrender's, that close to it; the
 * converter draws it on the circle of the pie's radius through both,
 * which to first order is the pie's circle turned about the end on it, so
 * that no point of an arc of a quarter turn or less stands farther off
 * than its other end. One arc between two rounded ends, as zrender writes
 * a quarter, has no end to turn about: its middle stood 0.10003 pt off.
 * The converter draws at most a sixth of a turn as one cubic, which stands
 * outside its arc by up to 2.4 · 10^-5 of the radius, 0.0062 pt on the
 * widest pie, 257.64 pt in radius. Every point of a slice's outline stands
 * within 0.0707 pt of its share's sector on the pie's circle, and the
 * cubic's own, and every point of the sector within as much of the
 * outline (`chart-arcs.test.ts`). Measured on 2026-11-13, read back by
 * PDF.js, each curve sampled: at most 0.0718 pt, either way, over 90,428
 * slices with arcs of 22,955 pies the renderer drew, of radii 0.12 to
 * 257.64 pt -- among them each pie found printed more than 0.5 pt off its
 * circle, or blank, as zrender writes it -- 688 of them past 0.0707 pt,
 * by 0.0011 at most, inside the cubic's share; and 0.0707 pt on the
 * quarter above.
 *
 * Three kinds of slice are drawn otherwise. One within 10^-4 of a radian
 * of a whole turn zrender writes as a whole circle, with no line to the
 * centre, its arcs written again as any other's: it stood within 0.053 pt
 * of the pie's circle. One of 10^-4 of a radian or less
 * zrender writes with no arc at all, a line from its start to the centre
 * (graphic/helper/roundSector.js): it stands within 0.0707 pt and its own
 * arc's length, at most 10^-4 of the radius, 0.026 pt on the widest pie,
 * of its sector -- 0.07205 pt at most, measured, for an arc of 0.0115 pt.
 * And one whose arc is shorter than a tenth's diagonal, 0.1 · √2 ≈ 0.141
 * pt, may have its two ends rounded into one point: it draws no more of
 * its arc than a hair out to the circle and back, and may draw no curve,
 * while every point of its sector stands within 0.0707 pt of the outline
 * drawn.
 * A slice whose arc is shorter than 0.141 pt may so draw no curve at all.
 */

/** Radians: a whole turn, and the most an arc of a slice turns once written again. */
const TURN = 2 * Math.PI
const QUARTER = TURN / 4

/**
 * Points: how far the radius zrender writes of a slice's arc stands from
 * the pie's: half a tenth, to which it rounds, and the doubles' own error
 * in that, which reached 1.1 · 10^-14 over 28,904 arcs (measured on
 * 2026-11-13).
 */
const RADIUS_ROUNDING = 0.05 + 1e-9

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
 * refuse: written again, it could pass. So is a path with an arc of any
 * radius but the pie's, to zrender's rounding: written again, an arc past
 * the box would pass, and one on another circle, as a donut's inner arc,
 * be moved onto the pie's.
 */
function arcsOf(d: string, circle: PieCircle): string {
  if (!heldPath(d)) return d
  const arcs = pathParts(d).filter(({ command }) => command === 'A')
  if (arcs.some(({ numbers: [radius] }) => Math.abs(Number(radius) - circle.radius) > RADIUS_ROUNDING)) return d
  let written = ''
  let after = 0
  for (const arc of arcs) {
    written += d.slice(after, arc.index) + quarters(arc, circle)
    after = arc.index + arc.written.length
  }
  return written + d.slice(after)
}

/**
 * An arc of a slice as two arcs or more, each of at most a quarter turn on
 * `circle`, ending where it ends: its turn about the centre the one, among
 * those its ends allow, nearest the middle of the half its large-arc flag
 * says, three quarters of a turn or a quarter. Every number of a path the
 * reader holds reads as a double, so that every angle and every turn here
 * is one.
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
  // Two at least, so that each the converter draws has an end on the circle.
  const count = Math.max(2, Math.ceil(Math.abs(turn) / QUARTER))
  // An arc turned back runs against its flag.
  const flag = turn < 0 === (way === 1) ? 0 : 1
  return Array.from({ length: count }, (_, index) => {
    const along = begins + (way * turn * (index + 1)) / count
    const end = index + 1 === count ? numbers.slice(5).join(' ') : `${String(cx + radius * Math.cos(along))} ${String(cy + radius * Math.sin(along))}`
    return `A${String(radius)} ${String(radius)} 0 0 ${String(flag)} ${end}`
  }).join('')
}
