import { rasterPixels, readPdf, type PdfPage, type PdfPath } from '@formancy/report-corpus'
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
 * option handed ECharts. The four pies are those the measurement of
 * 2026-11-13 found printed worst as zrender writes their arcs: blank, on
 * a circle moved 57 pt, and 5 pt and 2.2 pt off their circles.
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

/**
 * Points: how far every point a slice's outline draws may stand from its
 * share's sector, and every point of the sector from the outline. The
 * measurement of 2026-11-13 found 0.088 at most over 14,381 pies the
 * renderer drew with the arcs written again (`chart-arcs.ts`).
 */
const ON_CIRCLE = 0.1

/** Points between two samples of the sector's outline, and parts of a curve sampled: a curve of an eighth of a turn at a radius of 257.5 pt stands 0.005 pt off the lines between its samples. */
const STEP = 0.25
const SAMPLES = 64

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

/** A cubic's point at `t`. */
function onCurve(from: Point, [c1, c2]: readonly [Point, Point], to: Point, t: number): Point {
  const u = 1 - t
  const at = (axis: 0 | 1): number => u * u * u * from[axis] + 3 * u * u * t * c1[axis] + 3 * u * t * t * c2[axis] + t * t * t * to[axis]
  return [at(0), at(1)]
}

/**
 * `path`'s outline on the page as segments: each line between its
 * points, each curve sampled, and each subpath closed, as a fill closes
 * it; and every point a curve draws.
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
        const drawn = Array.from({ length: SAMPLES + 1 }, (_, step) => onCurve(point, curve.through, to, step / SAMPLES))
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
 * page; each slice held within `ON_CIRCLE` of its sector, its measures
 * returned.
 */
async function drawnOnItsCircle(
  chart: PieChart,
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
      [out, back, rim].map((each) => each <= ON_CIRCLE),
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
  // it does not. Every point its curves draw stands within `ON_CIRCLE` of
  // the circle round the pie's centre.
  test(
    "draws the larger slice of a pie of 9998 and 2 on the pie's circle",
    async () => {
      const { measures } = await drawnOnItsCircle(pieOf('moved', ['9998', '2'], 250, 300.09985))
      expect(measures[0]!.rim).toBeLessThanOrEqual(ON_CIRCLE)
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
 * arc as a run of arcs on `circle` -- its radius, never turned, each a
 * small arc of at most a quarter turn about its centre -- the points
 * between them on the circle and the last at the very point zrender
 * wrote.
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
  }
  expect(next, what).toBe(parts.length)
}

describe("a pie's arcs as the drawing writes them", () => {
  // The converter is handed what the reader held (`chart-svg.ts`), and
  // what it draws of a slice is held to its sector by the PDF above, for
  // four pies; the drawing holds the rule for every pie: each arc ECharts
  // writes of a slice is a run of arcs of at most a quarter turn about the
  // pie's centre and of its radius, from and to the very points zrender
  // wrote, so that two neighbours still meet where zrender put their
  // common end, and a slice of no share is still no path. A pie of one
  // slice, which zrender writes as two arcs, a whole turn but a tenth of a
  // radian and that tenth, and pies near half a turn and near a whole one,
  // titled and not.
  test(
    'writes every arc of a slice as arcs of at most a quarter turn about the pie’s centre, between the ends zrender wrote',
    async () => {
      const pies = [
        pieOf('blank', ['9999', '1'], 160.23, 160.23),
        pieOf('moved', ['9998', '2'], 250, 300.09985),
        pieOf('half', ['126550000000', '126550000000', '493800000000', '126550000000', '126550000000'], 515, 515),
        pieOf('titled', ['45', '2', '44'], 300, 300, 'Shares'),
        pieOf('whole', ['7'], 200, 180, 'One'),
        pieOf('no-share', ['3', '0', '1'], 220, 200, 'None'),
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
  // cross is the whole turn, either way round. Written by hand: no pie was
  // seen to cross its ends, over 14,375 arcs of slivers all round the
  // circle at five radii from 36 to 125 pt, nor any of 2,000,000 slivers
  // modelled, rounded as zrender rounds (measured on 2026-11-13).
  test('turns an arc within the half its flag says: a sliver whose ends cross back the little they cross, a large arc whose ends meet the whole way', () => {
    const circle: Circle = { centre: [100, 100], radius: 36 }
    const path = (d: string): string => `<path d="${d}" fill="#1f77b4" ecmeta_ssr_type="chart"></path>`
    const crossed = slicesOf(pieArcs(path('M136 100.1A36 36 0 0 1 136 100L100 100Z'), circle)).get('#1f77b4')!
    expect(partsOf(crossed).map(({ command }) => command)).toEqual(['M', 'A', 'L', 'Z'])
    expect(partsOf(crossed)[1]!.numbers).toEqual(['36', '36', '0', '0', '0', '136', '100'])
    const whole = slicesOf(pieArcs(path('M100 64A36 36 0 1 1 100 64L100 100Z'), circle)).get('#1f77b4')!
    expect(partsOf(whole).map(({ command }) => command)).toEqual(['M', 'A', 'A', 'A', 'A', 'L', 'Z'])
    expect(
      partsOf(whole)
        .slice(1, 5)
        .map(({ numbers }) => numbers.slice(2, 5)),
    ).toEqual(Array.from({ length: 4 }, () => ['0', '0', '1']))
    const nothing = slicesOf(pieArcs(path('M100 64A36 36 0 0 1 100 64L100 100Z'), circle)).get('#1f77b4')!
    expect(nothing).toBe('M100 64A36 36 0 0 1 100 64L100 100Z')
    // Anticlockwise, the way a sweep flag of 0 says: from noon, a quarter turn ends at nine o'clock.
    const back = partsOf(slicesOf(pieArcs(path('M100 64A36 36 0 1 0 100 64L100 100Z'), circle)).get('#1f77b4')!)
    expect(back.slice(1, 5).map(({ numbers }) => numbers[4])).toEqual(['0', '0', '0', '0'])
    expect(back[1]!.numbers.slice(5).map((each) => Math.round(Number(each) * 1e9) / 1e9)).toEqual([64, 100])
  })

  // The reader holds a slice as ECharts wrote it. Written again, a path it
  // would refuse -- a number too many, an ellipse's arc, a flag of 2 --
  // would pass as arcs on the pie's circle, and the drawing print what
  // ECharts never wrote, the number too many dropped. Such a slice is left
  // as written, for the reader to refuse.
  test('leaves a slice the reader would refuse as written', () => {
    const circle: Circle = { centre: [100, 100], radius: 36 }
    for (const d of ['M100 64A36 36 0 1 1 100 64 7L100 100Z', 'M100 64A36 30 0 1 1 100 64L100 100Z', 'M100 64A36 36 0 2 1 100 64L100 100Z']) {
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
