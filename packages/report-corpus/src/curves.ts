import type { PdfCurve } from './read-pdf.js'

/**
 * A curve a path draws, as points on the page: the cubic Bézier a
 * `PdfCurve` reads, from its start through its two control points to its
 * end. The one sampler of a curve: the corpus's pie check holds a slice's
 * arc by it (`check-chart-pie.ts`), and report-render-pdf's tests of a
 * pie's arcs hold them by it to finer bounds (`chart-arcs.test.ts`), so
 * that the two never read one outline two ways.
 */

type Point = readonly [number, number]

const apart = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1])

/** `curve`'s point at `t`, its start at 0 and its end at 1. */
export function onCurve({ from, through: [first, second], to }: PdfCurve, t: number): Point {
  const u = 1 - t
  const at = (axis: 0 | 1): number => u * u * u * from[axis] + 3 * u * u * t * first[axis] + 3 * u * t * t * second[axis] + t * t * t * to[axis]
  return [at(0), at(1)]
}

/** `curve` at `parts + 1` points, `parts` even parts of t apart, from its start to its end. */
export function curvePoints(curve: PdfCurve, parts: number): Point[] {
  return Array.from({ length: parts + 1 }, (_, part) => (part === 0 ? curve.from : part === parts ? curve.to : onCurve(curve, part / parts)))
}

/**
 * `curve` at points no farther than `step` apart along it, from its start
 * to its end, so that every point of it stands within half a step of one
 * of them, whatever its control points. A cubic moves at most three times
 * its longest leg -- from its start to its first control point, between
 * them, or from its second to its end -- along itself for each unit of t,
 * so parts of t that long over the step are each no longer than it.
 */
export function curveSamples(curve: PdfCurve, step: number): Point[] {
  const { from, through, to } = curve
  const leg = Math.max(apart(from, through[0]), apart(through[0], through[1]), apart(through[1], to))
  return curvePoints(curve, Math.max(1, Math.ceil((3 * leg) / step)))
}
