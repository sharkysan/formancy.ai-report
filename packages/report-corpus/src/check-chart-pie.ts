import { decimalOf, painted, quotient, unitsAt, unnamed, type ChartRead } from './check-chart-read.js'
import { EDGE, points } from './check-page.js'
import type { PdfPath } from './read-pdf.js'

/**
 * A pie's slices held to their shares (0058): one filled path in each
 * slice's colour where it has a share of the pie as the renderer hands it
 * over, however thin, and none where it has none -- a zero, or a slice
 * under one part of `SHARE_UNIT`, which the renderer draws nothing of
 * (8818a5a) -- each the sector its exact share makes, so that two slices
 * whose colours are swapped are seen. Its swatches are filled and stroked;
 * it paints nothing else.
 *
 * A slice is read by its points (`PdfPath.subpaths`): zrender writes a
 * sector as its arc from where its share starts to where it ends, then a
 * line to the pie's centre, so its first point, the one before its last
 * and its last are those three, each to a tenth of a point. Every slice's
 * centre is the pie's, and every arc's ends stand at one radius from it,
 * the mean of theirs; a slice runs clockwise from noon, as ECharts'
 * `startAngle` 90 sets it, from the shares before it to its own end, each
 * a quotient of the runtime's decimals with `Number` applied to the turn
 * alone; and each of its three points is where that sector puts it,
 * within `EDGE`. Over 150 of the renderer's pies of two to eight random
 * slices, 100 to 400 pt across, every one stood within 0.098 pt of it
 * (measured on 2026-11-13).
 *
 * What it does not see:
 * - **The arc between its ends.** Its points are where its curves end,
 *   and an arc drawn as nothing leaves its start and its end where its
 *   sector puts them. svg-to-pdfkit draws an arc on the circle through its
 *   ends, and through ends zrender rounds to a tenth that circle stood off
 *   the pie's -- on a pie of 45, 2 and 44 at 300 pt with a title and a
 *   legend, its first slice 2.2 pt past it -- or was none, and drew
 *   nothing (measured on 2026-11-13). The renderer writes each arc of a
 *   slice again on the pie's own circle (render-pdf's `chart-arcs.ts`),
 *   which its own tests hold on each curve's control points
 *   (`PdfPath.curves`); this check does not read them. A slice's box is
 *   no measure of its share, and is not read.
 * - **A whole circle.** zrender draws a slice of all but 10^-4 of a radian
 *   as a whole circle, with no centre (`WHOLE`); the slices beside it,
 *   slivers no point can tell apart, are held to their count alone.
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
  const whole = ends.some((end, index) => end - (ends[index - 1] ?? 0) > WHOLE)
  if (problems.length === 0 && !whole) problems.push(...sectorProblems(read, slices, ends))
  const paints = expected.marks.map(({ paint }) => paint)
  return [...problems, ...unnamed(read, (path) => paints.some((paint) => painted(path, 'fill', paint) || painted(path, 'fillStroke', paint)))]
}

/**
 * Each drawn slice's arc's ends and centre where its sector puts them: the
 * centre the slices' mean, the radius their arcs' ends' mean distance from
 * it, a slice's start the end of the one before it, from noon.
 */
function sectorProblems({ say }: ChartRead, slices: readonly (readonly PdfPath[])[], ends: readonly number[]): string[] {
  const drawn = slices.flatMap(([path], index) => {
    const subpath = path?.subpaths[0]
    if (subpath === undefined || subpath.length < 2) return []
    return [{ index, start: subpath[0]!, end: subpath.at(-2)!, centre: subpath.at(-1)! }]
  })
  const centre: Point = [mean(drawn.map(({ centre: [x] }) => x)), mean(drawn.map(({ centre: [, y] }) => y))]
  const radius = mean(drawn.flatMap(({ start, end }) => [apart(start, centre), apart(end, centre)]))
  const rim = (turn: number): Point => [centre[0] + radius * Math.sin(2 * Math.PI * turn), centre[1] - radius * Math.cos(2 * Math.PI * turn)]
  return drawn.flatMap(({ index, start, end, centre: own }) => {
    const [from, to] = [rim(ends[index - 1] ?? 0), rim(ends[index]!)]
    if (apart(start, from) <= EDGE && apart(end, to) <= EDGE && apart(own, centre) <= EDGE) return []
    return [
      say(
        `paints slice ${index + 1} from ${at(start)} to ${at(end)} round ${at(own)}; its share's sector runs from ${at(from)} to ${at(to)} round ${at(centre)}`,
      ),
    ]
  })
}
