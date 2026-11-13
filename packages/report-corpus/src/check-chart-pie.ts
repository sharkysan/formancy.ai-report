import { decimalOf, painted, quotient, unitsAt, unnamed, type ChartRead } from './check-chart-read.js'
import { EDGE, points } from './check-page.js'
import type { PdfPath } from './read-pdf.js'

/**
 * A pie's slices held to their shares (0058): one filled path in each
 * slice's colour where it has a share of the pie as the renderer hands it
 * over, however thin, and none where it has none -- a zero, or a slice
 * under one part of `SHARE_UNIT`, which the renderer draws nothing of
 * (8818a5a) -- each its exact share's sector, so that two slices whose
 * colours are swapped, or a slice drawn round the other side of its
 * centre, are seen. Its swatches are filled and stroked; it paints
 * nothing else.
 *
 * A slice is read by its outline: the points of its one subpath, which
 * are where each of its curves and its line end (`PdfPath.subpaths`), and
 * its curves (`PdfPath.curves`). zrender writes a sector as its arc from
 * where its share starts to where it ends, and a line to the pie's centre,
 * and the renderer writes the arc again in quarter turns or less on the
 * pie's own circle (render-pdf's `chart-arcs.ts`). So a slice's first
 * point stands where its sector starts, the one before its last where it
 * ends, and its last at the centre; every point between them within its
 * sweep from the centre; and every end of its curves on the pie's circle
 * -- the centre the slices' mean, the radius the mean distance from it of
 * their starts and ends and of a whole circle's points -- each within
 * `EDGE`. A slice runs clockwise from
 * noon, as ECharts' `startAngle` 90 sets it, from the shares before it to
 * its own end, each a quotient of the runtime's decimals with `Number`
 * applied to the turn alone. Every slice whose arc is a tenth's diagonal,
 * 0.1 · √2 pt, or longer draws a curve of it (`UNDRAWN_ARC`): zrender
 * writes a point to a tenth, so a shorter arc may have its two ends
 * written as one point, and draw no curve, or a hair out to the circle
 * and back -- a pie of 9999 and 1 is no false problem. Over 400 of the
 * renderer's pies of two to eight random slices, 100 to 400 pt across,
 * 1997 slices (measured on 2026-11-13 at e0a8637): every start, end and
 * centre stood within 0.101 pt of its sector's, no point between outside
 * its sweep by more than 0.081 pt, and no curve's end off the circle by
 * more than 0.101 pt.
 *
 * What it does not see:
 * - **The arc between its curves' ends.** A curve's control points are
 *   not read here; the renderer's own tests hold them (`chart-arcs.test.ts`).
 *   A slice's box is no measure of its share, and is not read.
 * - **A whole circle's sweep.** zrender draws a slice of all but 10^-4
 *   of a radian as a whole circle, with no line to the centre (`WHOLE`):
 *   its curves' ends are held to the circle, and every point of it is
 *   within its sweep, the whole turn. The slices beside it are slivers,
 *   held as any other slice is.
 */

/** The renderer hands ECharts each slice's share of its pie in this many parts (`chart-option.ts`'s QUOTIENT_UNIT): a slice under one part is handed over as a share of nothing. */
const SHARE_UNIT = 10n ** 17n

/**
 * Of a turn: the most a slice may sweep and be drawn as a sector. zrender
 * 6.1.0 draws an arc within 10^-4 of a radian of a whole turn as a whole
 * circle (`SVGPathRebuilder.js`, `isCircle`), split at a point it rounds to
 * a tenth, with no line to the pie's centre.
 */
const WHOLE = 1 - 1e-4 / (2 * Math.PI)

/**
 * Points: the shortest arc a slice must draw a curve of. zrender writes a
 * point to a tenth, so an arc shorter than a tenth's diagonal, 0.1 · √2,
 * may have its two ends written as one point, and the converter then
 * draws no more of it than a line out to the circle and back, or nothing
 * (render-pdf's `chart-arcs.ts`): the sliver of a pie of 9999 and 1 is
 * such an arc, 0.038 pt long at 160.23 pt.
 */
const UNDRAWN_ARC = 0.1 * Math.SQRT2

/** Radians in a turn. */
const TURN = 2 * Math.PI

type Point = readonly [number, number]

/** A point as a problem names it. */
const at = ([x, y]: Point): string => `${points(x)}, ${points(y)}`

const apart = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1])

/** The mean of `values`. */
const mean = (values: readonly number[]): number => values.reduce((sum, each) => sum + each, 0) / values.length

export function pieProblems(read: ChartRead): string[] {
  const { expected, say } = read
  const values = expected.marks.map(({ values: [value] }) => {
    if (value === undefined || value === null) throw new Error(`the expectation of the chart ${expected.id} has a slice with no value`)
    return decimalOf(value, expected)
  })
  const scale = Math.max(...values.map((value) => value.scale))
  const units = values.map((value) => unitsAt(value, scale))
  const total = units.reduce((sum, each) => sum + each, 0n)
  if (total <= 0n) throw new Error(`the expectation of the chart ${expected.id} is a pie of nothing, which is an empty chart`)
  const slices = expected.marks.map(({ paint }) => read.paths.filter((path) => painted(path, 'fill', paint)))
  const shared = units.map((each) => each * SHARE_UNIT >= total)
  const problems = slices.flatMap((paths, index) => {
    const slice = `slice ${index + 1}`
    if (!shared[index]) return paths.length === 0 ? [] : [say(`paints ${slice}, which has no share of its pie`)]
    if (paths.length === 0) return [say(`paints nothing of ${slice}`)]
    return paths.length === 1 ? [] : [say(`paints ${slice} in ${paths.length} paths`)]
  })
  // Each slice from the shares before it to its own end, in turns.
  const ends = units.map((_, index) =>
    quotient(
      units.slice(0, index + 1).reduce((sum, each) => sum + each, 0n),
      total,
    ),
  )
  if (problems.length === 0) problems.push(...sectorProblems(read, slices, ends))
  const paints = expected.marks.map(({ paint }) => paint)
  return [...problems, ...unnamed(read, (path) => paints.some((paint) => painted(path, 'fill', paint) || painted(path, 'fillStroke', paint)))]
}

/** How far `point` stands outside the sweep from `from` to `to`, in turns clockwise from noon, about `centre`: none inside it, else its distance from the nearer of the sweep's two edges, each a ray from the centre. */
function outside(point: Point, centre: Point, from: number, to: number): number {
  const [x, y] = [point[0] - centre[0], point[1] - centre[1]]
  const turn = (Math.atan2(x, -y) / TURN + 1) % 1
  if (turn >= from && turn <= to) return 0
  const fromRay = (edge: number): number => {
    const [across, down] = [Math.sin(TURN * edge), -Math.cos(TURN * edge)]
    return x * across + y * down >= 0 ? Math.abs(x * down - y * across) : Math.hypot(x, y)
  }
  return Math.min(fromRay(from), fromRay(to))
}

/**
 * Each drawn slice's outline where its share's sector puts it: one
 * subpath of two points or more; where it is no whole circle, its start,
 * its end and its centre where the sector's are, and every point between
 * within its sweep; every curve's ends on the pie's circle; and a curve of
 * its arc, where the arc is `UNDRAWN_ARC` or longer.
 */
function sectorProblems({ say }: ChartRead, slices: readonly (readonly PdfPath[])[], ends: readonly number[]): string[] {
  const drawn = slices.flatMap(([path], index) => {
    const [from, to] = [ends[index - 1] ?? 0, ends[index]!]
    return path === undefined ? [] : [{ index, path, from, to, whole: to - from > WHOLE }]
  })
  const shapeless = drawn.flatMap(({ index, path: { subpaths } }) => {
    const [subpath] = subpaths
    if (subpaths.length !== 1)
      return [say(`paints slice ${index + 1} in ${subpaths.length === 0 ? 'no part' : `${String(subpaths.length)} parts`}, where a slice is one`)]
    return subpath!.length < 2 ? [say(`paints slice ${index + 1} as a single point`)] : []
  })
  if (shapeless.length > 0) return shapeless
  const outline = (path: PdfPath): readonly Point[] => path.subpaths[0]!
  const sectors = drawn.filter(({ whole }) => !whole)
  const [{ path: first }] = drawn as [(typeof drawn)[number]]
  const centre: Point =
    sectors.length > 0
      ? [mean(sectors.map(({ path }) => outline(path).at(-1)![0])), mean(sectors.map(({ path }) => outline(path).at(-1)![1]))]
      : [first.x + first.width / 2, first.top + first.height / 2]
  const curveEnds = (path: PdfPath): Point[] => path.curves.flatMap(({ from, to }) => [from, to])
  // A sector's start and end stand on the circle, and so does every point of a whole circle; a stray point between moves no slice's ends.
  const radius = mean(
    drawn.flatMap(({ path, whole }) => (whole ? outline(path) : [outline(path)[0]!, outline(path).at(-2)!]).map((point) => apart(point, centre))),
  )
  const rim = (turn: number): Point => [centre[0] + radius * Math.sin(TURN * turn), centre[1] - radius * Math.cos(TURN * turn)]
  return drawn.flatMap(({ index, path, from, to, whole }) => {
    const slice = `slice ${index + 1}`
    const vertices = outline(path)
    if (!whole) {
      const [start, end, own] = [vertices[0]!, vertices.at(-2)!, vertices.at(-1)!]
      if (apart(start, rim(from)) > EDGE || apart(end, rim(to)) > EDGE || apart(own, centre) > EDGE)
        return [
          say(
            `paints ${slice} from ${at(start)} to ${at(end)} round ${at(own)}; its share's sector runs from ${at(rim(from))} to ${at(rim(to))} round ${at(centre)}`,
          ),
        ]
      const astray = vertices.slice(1, -2).find((point) => outside(point, centre, from, to) > EDGE)
      if (astray !== undefined)
        return [
          say(
            `paints ${slice} through ${at(astray)}, ${points(outside(astray, centre, from, to))} pt outside its share's sector from ${at(rim(from))} to ${at(rim(to))} round ${at(centre)}`,
          ),
        ]
    }
    const off = curveEnds(path).find((point) => Math.abs(apart(point, centre) - radius) > EDGE)
    if (off !== undefined)
      return [
        say(`paints ${slice}'s arc to ${at(off)}, ${points(apart(off, centre))} pt from the pie's centre at ${at(centre)}; its radius is ${points(radius)}`),
      ]
    const arc = radius * TURN * (to - from)
    return path.curves.length === 0 && arc >= UNDRAWN_ARC ? [say(`paints ${slice} with no arc, where its arc is ${points(arc)} pt long`)] : []
  })
}
