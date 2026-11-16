import { describe, expect, test } from 'vitest'
import { curvePoints, curveSamples, onCurve } from './curves.js'
import type { PdfCurve } from './read-pdf.js'

/**
 * A curve a path draws, as points on the page (`curves.ts`): the one
 * sampler of a curve, which the corpus's pie check and the renderer's own
 * tests of a pie's arcs both read a slice's arc by.
 */

type Point = readonly [number, number]
const apart = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1])

/** A quarter of a circle of 100 about the origin, as a cubic draws one: from 100, 0 to 0, 100. */
const KAPPA = 0.5522847498
const QUARTER: PdfCurve = {
  from: [100, 0],
  through: [
    [100, 100 * KAPPA],
    [100 * KAPPA, 100],
  ],
  to: [0, 100],
}

describe('a curve sampled', () => {
  // A curve read by another point than the one it draws would hold the
  // PDF to a shape it does not print: a cubic at t is the Bernstein sum of
  // its four points, its start at 0, its end at 1, and a quarter circle's
  // middle within 0.03 % of its radius from the circle.
  test('stands at its start, its end, and its cubic between them', () => {
    expect(onCurve(QUARTER, 0)).toEqual([100, 0])
    expect(onCurve(QUARTER, 1)).toEqual([0, 100])
    const [x, y] = onCurve(QUARTER, 0.5)
    expect(x).toBeCloseTo(y, 12)
    expect(Math.hypot(x, y)).toBeCloseTo(100, 1)
    expect(Math.abs(Math.hypot(x, y) - 100)).toBeLessThan(0.03)
  })

  // A curve held at too few points passes a bulge between them; one
  // sampled in parts of t is held at every part's end, its ends among them.
  test('is read at even parts of t from its start to its end', () => {
    const points = curvePoints(QUARTER, 4)
    expect(points).toHaveLength(5)
    expect(points[0]).toEqual(QUARTER.from)
    expect(points.at(-1)).toEqual(QUARTER.to)
    expect(points[2]).toEqual(onCurve(QUARTER, 0.5))
  })

  // A curve sampled by a count of its own passes what bulges between its
  // samples, and one sampled by its ends alone passes a curve whose
  // control points lie on its chord, flat across a slice: held at points
  // no farther apart than the step along it, whatever its control points,
  // a curve's every point stands within half a step of one held. A curve
  // of no length is held at its ends.
  test('is held at points no farther apart along it than its step, whatever its control points', () => {
    const flat: PdfCurve = {
      from: [0, 0],
      through: [
        [1, 0],
        [2, 0],
      ],
      to: [3, 0],
    }
    const swinging: PdfCurve = {
      from: [0, 0],
      through: [
        [400, -300],
        [-200, 500],
      ],
      to: [10, 10],
    }
    for (const curve of [QUARTER, flat, swinging]) {
      const samples = curveSamples(curve, 0.25)
      expect(samples[0]).toEqual(curve.from)
      expect(samples.at(-1)).toEqual(curve.to)
      // Read finely between each two samples, no point of it stands farther than half a step from the nearer.
      const parts = samples.length - 1
      let reach = 0
      for (let part = 0; part < parts; part += 1)
        for (let step = 1; step < 50; step += 1) {
          const point = onCurve(curve, (part + step / 50) / parts)
          reach = Math.max(reach, Math.min(apart(point, samples[part]!), apart(point, samples[part + 1]!)))
        }
      expect(reach, `${String(parts)} parts`).toBeLessThanOrEqual(0.125 + 1e-9)
      expect(reach).toBeGreaterThan(0)
    }
    expect(curveSamples({ from: [5, 5], through: [[5, 5] as const, [5, 5] as const], to: [5, 5] }, 0.25)).toEqual([
      [5, 5],
      [5, 5],
    ])
  })
})
