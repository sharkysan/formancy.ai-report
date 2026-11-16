import { curvePoints, rasterPixels, readPdf, type PdfPage, type PdfPath } from '@formancy/report-corpus'
import type { PieChart } from '@formancy/report-runtime'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { pieArcs } from './chart-arcs.js'
import { drawChart } from './chart-draw.js'
import { withMeasurer } from './chart-measure.js'
import { chartOption, type ChartOption } from './chart-option.js'
import { renderPdf } from './node.js'
import { value } from './testing/charts.js'
import { bareDocument, TIMEOUT } from './testing/documents.js'
import { layOut, measured, planned } from './testing/echarts.js'

/**
 * A pie's slices drawn on the pie's own circle (`chart-arcs.ts`), proved
 * on the PDF it produced (0003): each slice read back by the corpus, each
 * curve with its control points (`PdfPath.curves`), and every point of
 * its outline held to the sector its exact share makes on the circle the
 * option handed ECharts. Four pies are those the measurement of
 * 2026-11-13 found printed worst as zrender writes their arcs: blank, on
 * a circle moved 57 pt, and 5 pt and 2.2 pt off their circles; two are
 * built to reach what the rewrite must hold: a quarter whose two ends
 * round outward, which one arc between them put 0.10003 pt off, and a
 * sliver whose rounded ends cross.
 *
 * Every option the drawing hands ECharts is recorded, passing through, so
 * that a case reads the circle a pie was laid out on as ECharts was told
 * it, never as the drawing works it out.
 */

vi.mock('./chart-option.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./chart-option.js')>()
  return { ...actual, chartOption: vi.fn(actual.chartOption) }
})
beforeEach(() => {
  vi.mocked(chartOption).mockClear()
})

type Point = readonly [number, number]

/** A pie's circle in its box: its centre, from the box's top left, and its radius. */
interface Circle {
  readonly centre: Point
  readonly radius: number
}

/** Points: the farthest zrender's rounding to a tenth moves a point, half a tenth's diagonal. */
const ROUNDING = (0.1 * Math.SQRT2) / 2

/** Of the radius: how far outside its arc the cubic svg-to-pdfkit draws an arc of a sixth of a turn with stands at most, 2.386 · 10^-5 -- the longest arc it draws as one cubic. */
const CUBIC = 2.4e-5

/**
 * Points: how far every point a slice's outline draws may stand from its
 * share's sector on a circle of `radius`, and every point of the sector
 * from the outline -- the bound `chart-arcs.ts` gives, by its reason.
 */
const onCircle = (radius: number): number => ROUNDING + CUBIC * radius

/** Points between two samples of the sector's outline, and parts of a curve sampled: a curve of a sixth of a turn at a radius of 257.64 pt stands 0.00014 pt off the lines between its samples. */
const STEP = 0.25
const SAMPLES = 512

const TURN = 2 * Math.PI

/** The palette the pies here are coloured from. */
const PALETTE = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'] as const

/** A pie of `values` in a box `width` by `height`, with no title and no legend unless given: as the runtime resolves one. */
function pieOf(id: string, values: readonly string[], width: number, height: number, title?: string): PieChart {
  const slices = values.map((exact, index) => ({ color: PALETTE[index]!, value: value(exact) }))
  return {
    kind: 'chart',
    chart: 'pie',
    id,
    width,
    height,
    ...(title === undefined ? {} : { title }),
    slices,
    legend: title === undefined ? [] : values.map((exact, index) => ({ color: PALETTE[index]!, text: `S${String(index + 1)} ${exact}` })),
  }
}

/** The option the drawing handed ECharts for `chart`'s drawn layout: the last of its own, laid out on its square. */
function drawnOption(chart: PieChart): ChartOption {
  const { calls, results } = vi.mocked(chartOption).mock
  const index = calls.findLastIndex(([each, , layout]) => each.id === chart.id && layout.plot !== undefined)
  const result = results[index]
  if (result?.type !== 'return') throw new Error(`the drawing handed ECharts no option for the pie ${chart.id} on its square`)
  return result.value
}

/** The circle the drawing handed ECharts for `chart`: its series' centre and radius. */
function circleOf(chart: PieChart): Circle {
  const [series] = drawnOption(chart).series as unknown as readonly { readonly center: Point; readonly radius: number }[]
  return { centre: series!.center, radius: series!.radius }
}

/** Each slice's sector, clockwise from noon, from the shares before it to its own end: in radians from the page's x towards its foot. */
function sectorsOf(chart: PieChart): { readonly from: number; readonly to: number }[] {
  const units = chart.slices.map(({ value: { exact } }) => BigInt(exact))
  const total = units.reduce((sum, each) => sum + each, 0n)
  // A share to a double: the quotient of exact sums, scaled to 2^53.
  const turn = (units: bigint): number => Number((units * 2n ** 53n) / total) / 2 ** 53
  let before = 0n
  return units.map((each) => {
    const from = -Math.PI / 2 + TURN * turn(before)
    before += each
    return { from, to: -Math.PI / 2 + TURN * turn(before) }
  })
}

const apart = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Whether `a` and `b` are one point, as the corpus reads both. */
const same = (a: Point, b: Point): boolean => a[0] === b[0] && a[1] === b[1]

/** How far `point` stands from the segment `a` to `b`. */
function fromSegment(point: Point, a: Point, b: Point): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const length = dx * dx + dy * dy
  const along = length === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length))
  return apart(point, [a[0] + along * dx, a[1] + along * dy])
}

/**
 * `path`'s outline on the page as segments: each line between its
 * points, each curve sampled in `SAMPLES` parts by the corpus's sampler,
 * which its pie check reads the same curves by (`curvePoints`), and each
 * subpath closed, as a fill closes it; and every point a curve draws.
 */
function outlineOf(path: PdfPath): { readonly segments: readonly (readonly [Point, Point])[]; readonly curved: readonly Point[] } {
  const segments: [Point, Point][] = []
  const curved: Point[] = []
  let next = 0
  for (const subpath of path.subpaths)
    subpath.forEach((point, index) => {
      const to = subpath[(index + 1) % subpath.length]!
      const curve = path.curves[next]
      if (index + 1 < subpath.length && curve !== undefined && same(curve.from, point) && same(curve.to, to)) {
        next += 1
        const drawn = curvePoints(curve, SAMPLES)
        curved.push(...drawn)
        drawn.slice(1).forEach((each, step) => segments.push([drawn[step]!, each]))
      } else segments.push([point, to])
    })
  expect(next, 'curves read in no subpath').toBe(path.curves.length)
  return { segments, curved }
}

/**
 * How far `outline` stands from the sector of `circle` from `from` to
 * `to`, both ways: `out`, the farthest a point it draws stands from the
 * sector's outline -- its arc and its two radii -- each segment sampled
 * every `STEP`; `back`, the farthest a point of the sector's outline,
 * sampled as finely, stands from the outline, which an arc left out
 * shows; and `rim`, the farthest a point a curve draws stands from the
 * circle.
 */
function deviation(outline: ReturnType<typeof outlineOf>, { centre, radius }: Circle, from: number, to: number): { out: number; back: number; rim: number } {
  const rimAt = (angle: number): Point => [centre[0] + radius * Math.cos(angle), centre[1] + radius * Math.sin(angle)]
  const [start, end] = [rimAt(from), rimAt(to)]
  const sweep = to - from
  const fromSector = (point: Point): number => {
    const phi = (((Math.atan2(point[1] - centre[1], point[0] - centre[0]) - from) % TURN) + TURN) % TURN
    const arc = phi <= sweep ? Math.abs(apart(point, centre) - radius) : Math.min(apart(point, start), apart(point, end))
    return Math.min(arc, fromSegment(point, centre, start), fromSegment(point, centre, end))
  }
  const drawn = outline.segments.flatMap(([a, b]) => {
    const steps = Math.max(1, Math.ceil(apart(a, b) / STEP))
    return Array.from({ length: steps + 1 }, (_, step): Point => [a[0] + ((b[0] - a[0]) * step) / steps, a[1] + ((b[1] - a[1]) * step) / steps])
  })
  const arcSteps = Math.ceil((radius * sweep) / STEP)
  const radiusSteps = Math.ceil(radius / STEP)
  const sector = [
    ...Array.from({ length: arcSteps + 1 }, (_, step) => rimAt(from + (sweep * step) / arcSteps)),
    ...[start, end].flatMap((rim) =>
      Array.from({ length: radiusSteps + 1 }, (_, step): Point => [
        centre[0] + ((rim[0] - centre[0]) * step) / radiusSteps,
        centre[1] + ((rim[1] - centre[1]) * step) / radiusSteps,
      ]),
    ),
  ]
  return {
    out: Math.max(...drawn.map(fromSector)),
    back: Math.max(...sector.map((point) => Math.min(...outline.segments.map(([a, b]) => fromSegment(point, a, b))))),
    rim: Math.max(0, ...outline.curved.map((point) => Math.abs(apart(point, centre) - radius))),
  }
}

/**
 * `chart` rendered alone in a bare document and read back: the page, its
 * slices -- the paths filled in each slice's colour inside the clip of
 * its box, one each -- and the circle the option handed ECharts, on the
 * page; each slice held within `bound` of its sector, by default
 * `onCircle`, its measures returned.
 */
async function drawnOnItsCircle(
  chart: PieChart,
  bound: (slice: number, radius: number) => number = (_, radius) => onCircle(radius),
): Promise<{ readonly bytes: Uint8Array; readonly page: PdfPage; readonly circle: Circle; readonly measures: readonly ReturnType<typeof deviation>[] }> {
  const bytes = await renderPdf(bareDocument('Pie', [chart]), { maxPages: 2 })
  const [page] = (await readPdf(bytes)).pages
  const clip = page!.clips.findIndex(({ width, height }) => Math.abs(width - chart.width) < 1e-3 && Math.abs(height - chart.height) < 1e-3)
  expect(clip, `the clip of the pie ${chart.id}`).toBeGreaterThanOrEqual(0)
  const box = page!.clips[clip]!
  const { centre, radius } = circleOf(chart)
  const circle: Circle = { centre: [box.x + centre[0], box.top + centre[1]], radius }
  const sectors = sectorsOf(chart)
  const measures = chart.slices.map(({ color }, index) => {
    const paths = page!.paths.filter((path) => path.paint === 'fill' && path.fill === color && path.clip === clip)
    expect(paths, `the paths of slice ${String(index + 1)} of ${chart.id}`).toHaveLength(1)
    return deviation(outlineOf(paths[0]!), circle, sectors[index]!.from, sectors[index]!.to)
  })
  measures.forEach(({ out, back, rim }, index) => {
    expect(
      [out, back, rim].map((each) => each <= bound(index, radius)),
      `slice ${String(index + 1)} of ${chart.id}: out, back and rim ${[out, back, rim].join(', ')}`,
    ).toEqual([true, true, true])
  })
  return { bytes, page: page!, circle, measures }
}

describe("a pie's slices drawn on its own circle", () => {
  // zrender writes a slice of all but 10^-4 of a pie as an arc whose ends
  // round to one point, which svg-to-pdfkit draws as nothing (SVG 1.1
  // F.6.2): a pie of 9999 and 1 printed blank, its legend and its title
  // the only sign of it. Both slices are drawn, each on its sector, and
  // every pixel of the disc, drawn by PDF.js at 2 pixels to the point,
  // is painted: none white (each channel 247 or more) a point or more in
  // from the rim.
  test(
    'draws both slices of a pie of 9999 and 1, and paints its disc',
    async () => {
      const { bytes, page, circle } = await drawnOnItsCircle(pieOf('blank', ['9999', '1'], 160.23, 160.23))
      const scale = 2
      const pixels = await rasterPixels(bytes, page.number, scale)
      let white = 0
      let inside = 0
      for (let row = 0; row < pixels.height; row += 1)
        for (let column = 0; column < pixels.width; column += 1) {
          if (apart([(column + 0.5) / scale, (row + 0.5) / scale], circle.centre) > circle.radius - 1) continue
          inside += 1
          const at = 4 * (row * pixels.width + column)
          if ([0, 1, 2].every((channel) => pixels.data[at + channel]! >= 247)) white += 1
        }
      expect(inside).toBeGreaterThan(Math.PI * (2 * (circle.radius - 2)) ** 2)
      expect(white).toBe(0)
    },
    TIMEOUT,
  )

  // Near a whole turn, the arc's ends stand a few tenths apart, and the
  // circle svg-to-pdfkit works out through them turns with their rounding:
  // the larger slice of 9998 and 2, in a square of 250 pt whose top stands
  // 0.049925 pt past a tenth, was drawn on a circle 57 pt from the pie's,
  // cut by the box, the disc left white where it belongs and painted where
  // it does not. Every point its curves draw stands within `onCircle` of
  // the circle round the pie's centre.
  test(
    "draws the larger slice of a pie of 9998 and 2 on the pie's circle",
    async () => {
      await drawnOnItsCircle(pieOf('moved', ['9998', '2'], 250, 300.09985))
    },
    TIMEOUT,
  )

  // Near half a turn, the circle through the arc's ends stands off the
  // pie's by up to the square root of the radius times the rounding: a
  // slice of 0.4938 of a pie 257.5 pt in radius, the widest a chart on A4
  // is, printed 5 pt past its circle, and its neighbours' arcs as far
  // inside theirs where they meet it.
  test(
    'draws a slice of 0.4938 of a pie 257.5 pt in radius on its circle',
    async () => {
      const chart = pieOf('half', ['126550000000', '126550000000', '493800000000', '126550000000', '126550000000'], 515, 515)
      const { circle } = await drawnOnItsCircle(chart)
      expect(circle.radius).toBe(257.5)
    },
    TIMEOUT,
  )

  // A pie with a title and a legend stands in a square between them, its
  // radius as the words leave it, here 130.9375 pt: its first slice, 45 of
  // 91, printed 2.23 pt past its circle, a bulge a reader sees.
  test(
    'draws a pie of 45, 2 and 44 with a title and a legend on its circle',
    async () => {
      const { circle } = await drawnOnItsCircle(pieOf('titled', ['45', '2', '44'], 300, 300, 'Shares'))
      expect(circle.radius).toBe(130.9375)
    },
    TIMEOUT,
  )

  // An arc of a quarter turn or less written as one, between the two ends
  // zrender rounds, is drawn on the circle through both: rounded outward
  // by e1 and e2, it stands out by (e1 + e2) / (2 cos(θ/2)) at its middle,
  // a tenth of a point for a quarter whose ends round half a tenth's
  // diagonal straight out. The middle slice of 1, 2 and 5 in a box of
  // 196.99998 by 197.20002 pt, a quarter whose ends zrender writes as
  // 168.2, 28.9 and 168.2, 168.3, stood 0.10003 pt off its circle. Written
  // in two pieces, each has an end on the pie's circle.
  test(
    'draws a quarter whose two ends round outward on its circle',
    async () => {
      const { circle } = await drawnOnItsCircle(pieOf('quarter', ['1', '2', '5'], 196.99998, 197.20002))
      expect(circle.radius).toBeCloseTo(98.49999, 9)
    },
    TIMEOUT,
  )

  // Rounding crosses a sliver's ends where the pie's square stands just
  // under half a tenth past a tenth and its centre's x a little past one:
  // zrender writes the first slice of 30230370076 parts in 10^15, at
  // 200.06 by 200.159998 pt, from 100, 0 to 100, 0.1, the end turned back
  // about the pie's centre. Taken the long way round, which its flag
  // says, the sliver would paint the whole disc in its colour; it is drawn
  // back the little its ends cross, and the slice after it, whose ends
  // cross the other way, the whole turn and that little more.
  test(
    'draws a sliver whose rounded ends cross as the sliver it is',
    async () => {
      const chart = pieOf('crossed', ['30230370076', '999969769629924'], 200.06, 200.159998)
      await drawnOnItsCircle(chart)
      // The ends zrender wrote cross about the pie's centre, so that the case holds what it says.
      const { faces, widths } = await measured(planned(), {})
      const { svg } = withMeasurer(faces, widths, () => layOut(drawnOption(chart), chart.width, chart.height))
      const [move, arc] = partsOf(slicesOf(svg).get(PALETTE[0])!)
      const point = (numbers: readonly string[]): Point => [Number(numbers.at(-2)), Number(numbers.at(-1))]
      expect([move!.command, arc!.command, arc!.numbers[3]]).toEqual(['M', 'A', '0'])
      expect(turnOf(point(move!.numbers), point(arc!.numbers), arc!.numbers[4]!, circleOf(chart).centre)).toBeGreaterThan(Math.PI)
    },
    TIMEOUT,
  )

  // zrender writes a slice of 10^-4 of a radian or less with no arc at
  // all, a line from its start to the centre (graphic/helper/roundSector.js),
  // which the rewrite has no arc of to write again: it stands within
  // 0.0707 pt and its own arc's length of its sector, the header's bound,
  // and not within 0.0707 pt alone. The first slice of 15127021 parts in
  // a pie of 999959116159 and 25756820 more, 9.5 · 10^-5 of a radian in a
  // titled box of 333.3 by 280.7 pt, is such a sliver: written as no arc,
  // drawn with no curve, and held to that bound on the PDF, its
  // neighbours, one all but a whole turn, to `onCircle`.
  test(
    'draws a sliver zrender writes with no arc within half a tenth’s diagonal and its own arc of its sector',
    async () => {
      const chart = pieOf('no-arc', ['15127021', '999959116159', '25756820'], 333.3, 280.7, 'Shares of it')
      const [sliver] = sectorsOf(chart)
      const arc = (radius: number): number => radius * (sliver!.to - sliver!.from)
      const { page, circle, measures } = await drawnOnItsCircle(chart, (slice, radius) => (slice === 0 ? ROUNDING + arc(radius) : onCircle(radius)))
      expect(arc(circle.radius)).toBeLessThanOrEqual(1e-4 * circle.radius)
      expect(Math.max(measures[0]!.out, measures[0]!.back)).toBeGreaterThan(ROUNDING)
      // As zrender wrote it: a move, lines and a close, no arc; and drawn with no curve.
      const { faces, widths } = await measured(planned(), {}, chart.title)
      drawChart(chart, faces, widths)
      const { svg } = withMeasurer(faces, widths, () => layOut(drawnOption(chart), chart.width, chart.height))
      expect(partsOf(slicesOf(svg).get(PALETTE[0])!).map(({ command }) => command)).not.toContain('A')
      const [path] = page.paths.filter((each) => each.paint === 'fill' && each.fill === PALETTE[0])
      expect(path!.curves).toEqual([])
    },
    TIMEOUT,
  )

  // zrender writes a slice's radius rounded to a tenth, half a tenth off
  // the pie's at most -- by decimals. A radius of 130.95 is no double, and
  // zrender writes it as 131, 0.05000000000001137 off by doubles: a rewrite
  // that held a slice's radius to half a tenth alone would leave every arc
  // of that pie as written, its quarters single arcs between two rounded
  // ends, up to a tenth off its circle. `RADIUS_ROUNDING` takes the
  // doubles' own error too: a pie 261.9 pt across, its radius 130.95, has
  // every arc written again in quarters on its circle, and draws on it.
  test(
    'writes again the arcs of a pie whose radius zrender rounds half a tenth away, as doubles count it',
    async () => {
      const chart = pieOf('rounded', ['1', '2', '5'], 261.9, 261.9)
      const { faces, widths } = await measured(planned(), {})
      const drawing = drawChart(chart, faces, widths)
      const circle = circleOf(chart)
      expect(circle.radius).toBe(130.95)
      const { svg: written } = withMeasurer(faces, widths, () => layOut(drawnOption(chart), chart.width, chart.height))
      const zrender = slicesOf(written)
      const radii = [...zrender.values()].flatMap((d) => partsOf(d).flatMap(({ command, numbers }) => (command === 'A' ? [Number(numbers[0])] : [])))
      expect(radii.length).toBeGreaterThan(0)
      for (const radius of radii) expect(Math.abs(radius - circle.radius)).toBeGreaterThan(0.05)
      for (const [fill, d] of slicesOf(drawing.svg)) expectQuarters(d, zrender.get(fill)!, circle, `rounded ${fill}`)
      await drawnOnItsCircle(chart)
    },
    TIMEOUT,
  )
})

/** Each slice of `svg`, by its fill: the path ECharts writes as the chart's own. */
const slicesOf = (svg: string): Map<string, string> =>
  new Map([...svg.matchAll(/<path d="([^"]*)" fill="(#[0-9a-f]{6})"[^>]*ecmeta_ssr_type="chart"/g)].map(([, d = '', fill = '']) => [fill, d]))

/** `d`'s parts: each command and its numbers as written. */
const partsOf = (d: string): { readonly command: string; readonly numbers: readonly string[] }[] =>
  [...d.matchAll(/([MLAZ])([^MLAZ]*)/g)].map(([, command = '', numbers = '']) => ({ command, numbers: numbers.split(' ').filter((each) => each !== '') }))

/** How far an arc from `from` to `to` turns about `centre`, the way its sweep flag says: from 0 up to a whole turn. */
function turnOf(from: Point, to: Point, sweep: string, centre: Point): number {
  const angle = (point: Point): number => Math.atan2(point[1] - centre[1], point[0] - centre[0])
  return ((((sweep === '1' ? 1 : -1) * (angle(to) - angle(from))) % TURN) + TURN) % TURN
}

/**
 * `drawn`, a slice's path as the drawing returned it, held to `written`,
 * the path zrender wrote of it: every part but an arc as written, and each
 * arc as a run of two arcs or more on `circle` -- its radius, never
 * turned, each a small arc of at most a quarter turn about its centre --
 * the points between them on the circle and the last at the very point
 * zrender wrote.
 */
function expectQuarters(drawn: string, written: string, { centre, radius }: Circle, what: string): void {
  const parts = partsOf(drawn)
  let next = 0
  let at: Point = [0, 0]
  for (const part of partsOf(written)) {
    if (part.command !== 'A') {
      expect(parts[next], what).toEqual(part)
      next += 1
      if (part.command !== 'Z') at = [Number(part.numbers[0]), Number(part.numbers[1])]
      continue
    }
    const end = part.numbers.slice(-2).join(' ')
    const first = next
    for (let reached = false; !reached; next += 1) {
      const arc = parts[next]
      expect(arc?.command, what).toBe('A')
      const [rx, ry, turned, large, sweep = '', x = '', y = ''] = arc!.numbers
      expect([Number(rx), Number(ry), turned, large], what).toEqual([radius, radius, '0', '0'])
      const to: Point = [Number(x), Number(y)]
      expect(turnOf(at, to, sweep, centre), what).toBeLessThanOrEqual(Math.PI / 2 + 1e-12)
      reached = `${x} ${y}` === end
      if (!reached) expect(Math.abs(apart(to, centre) - radius), what).toBeLessThan(1e-9)
      at = to
    }
    expect(next - first, `${what}: the pieces of an arc`).toBeGreaterThanOrEqual(2)
  }
  expect(next, what).toBe(parts.length)
}

describe("a pie's arcs as the drawing writes them", () => {
  // The converter is handed what the reader held (`chart-svg.ts`), and
  // what it draws of a slice is held to its sector by the PDF above, for
  // four pies; the drawing holds the rule for every pie: each arc ECharts
  // writes of a slice is a run of two arcs or more, each of at most a
  // quarter turn about the pie's centre and of its radius, from and to the
  // very points zrender wrote, so that two neighbours still meet where
  // zrender put their common end, and a slice of no share is still no
  // path. One arc between two ends zrender rounds can stand a tenth off
  // its circle; of two, each has an end on it. A pie of one slice, which
  // zrender writes as two arcs, a whole turn but a tenth of a radian and
  // that tenth, and pies near half a turn and near a whole one, titled and
  // not, and a quarter.
  test(
    'writes every arc of a slice as two arcs or more of at most a quarter turn about the pie’s centre, between the ends zrender wrote',
    async () => {
      const pies = [
        pieOf('blank', ['9999', '1'], 160.23, 160.23),
        pieOf('moved', ['9998', '2'], 250, 300.09985),
        pieOf('half', ['126550000000', '126550000000', '493800000000', '126550000000', '126550000000'], 515, 515),
        pieOf('titled', ['45', '2', '44'], 300, 300, 'Shares'),
        pieOf('whole', ['7'], 200, 180, 'One'),
        pieOf('no-share', ['3', '0', '1'], 220, 200, 'None'),
        pieOf('quarter', ['1', '2', '5'], 196.99998, 197.20002),
      ]
      for (const chart of pies) {
        const { faces, widths } = await measured(planned(), {}, chart.title)
        const drawing = drawChart(chart, faces, widths)
        const option = drawnOption(chart)
        const { svg: written } = withMeasurer(faces, widths, () => layOut(option, chart.width, chart.height))
        const zrender = slicesOf(written)
        const drawn = slicesOf(drawing.svg)
        expect([...drawn.keys()], chart.id).toEqual([...zrender.keys()])
        expect(drawn.size, chart.id).toBe(chart.slices.filter(({ value: { exact } }) => exact !== '0').length)
        for (const [fill, d] of drawn) expectQuarters(d, zrender.get(fill)!, circleOf(chart), `${chart.id} ${fill}`)
      }
    },
    TIMEOUT,
  )

  // Rounding moves both ends of a sliver's arc, and where the slice is
  // thinner than a tenth of a point they may cross: an arc that turned
  // the whole way round from the one to the other would paint the pie in
  // the sliver's colour. A small arc turns within half a turn, as zrender
  // flags it from the slice's exact sweep, so one whose ends cross is
  // drawn back the little they cross, and a large one whose ends meet or
  // cross is the whole turn, either way round. A crossing is rare -- none
  // in 14,375 arcs of slivers all round the circle at five radii, nor in
  // 2,000,000 slivers modelled (measured on 2026-11-13) -- but a pie can be
  // built to make one, which the PDF above holds; here each turn is
  // written by hand, either way round, and an arc whose ends meet turns
  // nothing, out to the circle and back.
  test('turns an arc within the half its flag says: a sliver whose ends cross back the little they cross, a large arc whose ends meet the whole way', () => {
    const circle: Circle = { centre: [100, 100], radius: 36 }
    const path = (d: string): string => `<path d="${d}" fill="#1f77b4" ecmeta_ssr_type="chart"></path>`
    const crossed = partsOf(slicesOf(pieArcs(path('M136 100.1A36 36 0 0 1 136 100L100 100Z'), circle)).get('#1f77b4')!)
    expect(crossed.map(({ command }) => command)).toEqual(['M', 'A', 'A', 'L', 'Z'])
    expect(crossed.slice(1, 3).map(({ numbers }) => numbers.slice(0, 5))).toEqual(Array.from({ length: 2 }, () => ['36', '36', '0', '0', '0']))
    expect(crossed[2]!.numbers.slice(5)).toEqual(['136', '100'])
    const whole = slicesOf(pieArcs(path('M100 64A36 36 0 1 1 100 64L100 100Z'), circle)).get('#1f77b4')!
    expect(partsOf(whole).map(({ command }) => command)).toEqual(['M', 'A', 'A', 'A', 'A', 'L', 'Z'])
    expect(
      partsOf(whole)
        .slice(1, 5)
        .map(({ numbers }) => numbers.slice(2, 5)),
    ).toEqual(Array.from({ length: 4 }, () => ['0', '0', '1']))
    const nothing = partsOf(slicesOf(pieArcs(path('M100 64.05A36 36 0 0 1 100 64.05L100 100Z'), circle)).get('#1f77b4')!)
    expect(nothing.map(({ command }) => command)).toEqual(['M', 'A', 'A', 'L', 'Z'])
    expect(nothing.slice(1, 3).map(({ numbers }) => numbers.slice(5).map((each) => Math.round(Number(each) * 1e9) / 1e9))).toEqual([
      [100, 64],
      [100, 64.05],
    ])
    // Anticlockwise, the way a sweep flag of 0 says: from noon, a quarter turn ends at nine o'clock.
    const back = partsOf(slicesOf(pieArcs(path('M100 64A36 36 0 1 0 100 64L100 100Z'), circle)).get('#1f77b4')!)
    expect(back.slice(1, 5).map(({ numbers }) => numbers[4])).toEqual(['0', '0', '0', '0'])
    expect(back[1]!.numbers.slice(5).map((each) => Math.round(Number(each) * 1e9) / 1e9)).toEqual([64, 100])
  })

  // The reader holds a slice as ECharts wrote it. Written again, a path it
  // would refuse -- a number too many, an ellipse's arc, a flag of 2, a
  // radius past the box or no finite number -- would pass as arcs on the
  // pie's circle, and the drawing print what ECharts never wrote, the
  // number too many dropped; and an arc on another circle, as a donut's
  // inner one, would be moved onto the pie's. A slice with an arc of any
  // radius but the pie's, to zrender's rounding, is left as written, for
  // the reader to refuse, or to hold as ECharts wrote it.
  test('leaves a slice the reader would refuse as written', () => {
    const circle: Circle = { centre: [100, 100], radius: 36 }
    for (const d of [
      'M100 64A36 36 0 1 1 100 64 7L100 100Z',
      'M100 64A36 30 0 1 1 100 64L100 100Z',
      'M100 64A36 36 0 2 1 100 64L100 100Z',
      'M100 64A1e999 1e999 0 1 1 100 64L100 100Z',
      'M100 64A1e6 1e6 0 0 1 136 100L100 100Z',
      'M100 64A36 36 0 0 1 136 100L105 100A5 5 0 0 0 100 95Z',
    ]) {
      const slice = `<path d="${d}" fill="#1f77b4" ecmeta_ssr_type="chart"></path>`
      expect(pieArcs(slice, circle)).toBe(slice)
    }
  })

  // Only a slice is the pie's: a legend's swatch, a title's or a legend's
  // background, and anything else ECharts writes, is left as written, and
  // so is every number of a slice but its arcs'.
  test('leaves every path but a slice’s as written', () => {
    const circle: Circle = { centre: [100, 100], radius: 36 }
    const other = '<path d="M0 0A4 4 0 0 1 8 0l0 8l-8 0Z" transform="translate(10 20)" fill="#1f77b4" ecmeta_ssr_type="legend"></path>'
    expect(pieArcs(other, circle)).toBe(other)
  })
})
