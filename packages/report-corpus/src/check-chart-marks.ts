import { EDGE, plural, points, quoted } from './check-page.js'
import type { ExpectedChart } from './fixture.js'
import type { PdfBox, PdfPage, PdfPath, PdfTextItem } from './read-pdf.js'

/**
 * A drawn chart's marks held to the renderer's paint (0058) and to its
 * values: a bar or a line chart's gridlines, its category axis's line and
 * its ticks' labels, each bar its value's length and each line's marker at
 * its value, joined where its values are; a pie's slices, one path each,
 * none of a slice of nothing; and nothing painted that the paint names no
 * part of a chart by. The paint is the renderer's (`chart-option.ts`):
 * bars, slices and line markers filled in their colour; lines, gridlines
 * and the category axis's line stroked; legend swatches filled and
 * stroked; nothing else.
 *
 * What it rests on, and what it does not see:
 * - **Boxes.** A path is read by the box of its points (`PdfPath`): a bar
 *   by its ends, a marker by its centre, a line by the box of the points
 *   it joins. A slice is a path in its colour and nothing more, since a
 *   sector's box cannot say its sweep; its share is the runtime's word in
 *   its legend, which the words check holds.
 * - **The exact place.** A value's height is its place among the ticks
 *   -- its distance from the lowest in their interval, worked out from
 *   the runtime's decimals, `Number` applied to the place alone -- set
 *   between the gridlines the PDF draws at the ticks' places. Ticks that
 *   share fifteen digits stand apart only as decimals: their doubles
 *   would put a value up to an interval from its place (Task 19).
 * - **The renderer's colours.** The grid's and the axis's, and the unit a
 *   slice's share is handed over in, are the renderer's constants written
 *   here, since the corpus depends on no renderer; every chart fixture
 *   holds them to it, its axis being found by them.
 */

/** The renderer's colours of a chart's gridlines and of its category axis's line, `chart-option.ts`'s GRID and AXIS. */
export const GRID_PAINT = '#d9d9d9'
export const AXIS_PAINT = '#000000'

/** The renderer hands ECharts each slice's share of its pie in this many parts (`chart-option.ts`'s QUOTIENT_UNIT): a slice under one part is handed over as a share of nothing. */
const SHARE_UNIT = 10n ** 17n

/** The parts the check works a quotient out to before `Number` makes it a place. */
const PLACE_UNIT = 10n ** 17n

/** A drawn chart as its page shows it. */
export interface ChartRead {
  readonly expected: ExpectedChart
  readonly page: PdfPage
  /** Its clip's box: the chart's box on the page. */
  readonly box: PdfBox
  /** The paths painted in its clip and in the clips set inside it. */
  readonly paths: readonly PdfPath[]
  /** The runs of text that meet its box. */
  readonly items: readonly PdfTextItem[]
  /** A problem of the chart: `what` after its page and its name. */
  readonly say: (what: string) => string
}

/** A plot as its gridlines draw it: its sides, and each tick's gridline down the page, the lowest tick's first. */
export interface Plot {
  readonly left: number
  readonly right: number
  readonly gridlines: readonly number[]
}

/** What the axes say of a bar or a line chart: its plot, where its gridlines draw one, the runs that are its ticks' labels, and what is wrong. */
export interface Axes {
  readonly plot?: Plot
  readonly ticks: ReadonlySet<PdfTextItem>
  readonly problems: readonly string[]
}

const near = (a: number, b: number): boolean => Math.abs(a - b) <= EDGE

/** How many times a word prints, as a problem says it. */
export const times = (count: number): string => (count === 1 ? 'once' : count === 2 ? 'twice' : `${String(count)} times`)

/** Whether `inner` lies inside `outer`, give or take `EDGE`. */
export const within = (inner: PdfBox, outer: PdfBox): boolean =>
  inner.x >= outer.x - EDGE && inner.x + inner.width <= outer.x + outer.width + EDGE && inner.top >= outer.top - EDGE && inner.bottom <= outer.bottom + EDGE

/** Whether `path` is painted `paint` in `colour` alone: a swatch, filled and stroked, in it both ways. */
function painted(path: PdfPath, paint: PdfPath['paint'], colour: string): boolean {
  const same = (each: string | undefined): boolean => each?.toLowerCase() === colour.toLowerCase()
  if (path.paint !== paint) return false
  if (paint === 'fillStroke') return same(path.fill) && same(path.stroke)
  return same(paint === 'fill' ? path.fill : path.stroke)
}

/** A path as a problem names it: how it is painted, in what, and its box. */
export function described(path: PdfPath): string {
  const paint = [path.fill === undefined ? [] : [`fill ${path.fill}`], path.stroke === undefined ? [] : [`stroke ${path.stroke}`]].flat().join(' and ')
  return `${paint} at ${points(path.x)}, ${points(path.top)}, ${points(path.width)} × ${points(path.height)} pt`
}

/** Each path of `read` that `named` does not name, as a problem. */
function unnamed(read: ChartRead, named: (path: PdfPath) => boolean): string[] {
  return read.paths.filter((path) => !named(path)).map((path) => read.say(`paints ${described(path)}, which is no part of a chart`))
}

/** A decimal as the runtime writes one (`ChartValue.exact`): its units, and how many of its digits are places. */
interface Decimal {
  readonly units: bigint
  readonly scale: number
}

function decimalOf(exact: string, chart: ExpectedChart): Decimal {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(exact)
  if (match === null) throw new Error(`the expectation of the chart ${chart.id} holds ${quoted(exact)}, which is no decimal`)
  const [, sign = '', whole = '', fraction = ''] = match
  const units = BigInt(whole + fraction)
  return { units: sign === '-' ? -units : units, scale: fraction.length }
}

/** `value`'s units at `scale`, as many places as its own or more. */
const unitsAt = (value: Decimal, scale: number): bigint => value.units * 10n ** BigInt(scale - value.scale)

/** `numerator / denominator`, the denominator above 0, as a double: its whole part exactly and the rest to `PLACE_UNIT`. */
const quotient = (numerator: bigint, denominator: bigint): number =>
  Number(numerator / denominator) + Number(((numerator % denominator) * PLACE_UNIT) / denominator) / Number(PLACE_UNIT)

/**
 * Where a value of `chart` stands on its value axis: its distance from the
 * lowest tick, in the ticks' interval, tick i at place i. Ticks that are
 * not two or more ascending in equal steps are the expectation's mistake.
 */
function placesOf(chart: ExpectedChart): (exact: string) => number {
  const ticks = chart.ticks.map(({ exact }) => decimalOf(exact, chart))
  const [lowest, next] = ticks
  const uneven = new Error(`the expectation of the chart ${chart.id} has ticks that do not ascend in equal steps`)
  if (lowest === undefined || next === undefined) throw uneven
  const scale = Math.max(...ticks.map((tick) => tick.scale))
  const from = (value: Decimal, at: number): bigint => unitsAt(value, at) - unitsAt(lowest, at)
  const step = from(next, scale)
  if (step <= 0n || ticks.some((tick, index) => from(tick, scale) !== BigInt(index) * step)) throw uneven
  return (exact) => {
    const value = decimalOf(exact, chart)
    const at = Math.max(scale, value.scale)
    return quotient(from(value, at), from(next, at))
  }
}

/** The height down the page at `place`, set between the gridlines of the ticks either side of it. */
function heightAt({ gridlines }: Plot, place: number): number {
  const below = Math.min(Math.max(Math.floor(place), 0), gridlines.length - 2)
  return gridlines[below]! + (place - below) * (gridlines[below + 1]! - gridlines[below]!)
}

/** The plot's box: across between its sides, down between its highest gridline and its lowest. */
const plotBox = ({ left, right, gridlines }: Plot): PdfBox => {
  const [top, bottom] = [gridlines.at(-1)!, gridlines[0]!]
  return { x: left, top, bottom, width: right - left, height: bottom - top }
}

/** The middle of category `index`'s slot: the plot's width shared among the categories, a line's as a bar's. */
const middleOf = (plot: Plot, chart: ExpectedChart, index: number): number => plot.left + ((index + 0.5) * (plot.right - plot.left)) / chart.categories.length

/** Category `index`'s slot across the plot: from its left edge to its right. */
const slotAt = (plot: Plot, chart: ExpectedChart, index: number): readonly [number, number] => {
  const width = (plot.right - plot.left) / chart.categories.length
  return [plot.left + index * width, plot.left + (index + 1) * width]
}

/** Which category's slot `x` stands in. */
const slotOf = (plot: Plot, chart: ExpectedChart, x: number): number =>
  Math.min(Math.max(Math.floor(((x - plot.left) * chart.categories.length) / (plot.right - plot.left)), 0), chart.categories.length - 1)

/**
 * A bar or a line chart's axes and marks: its gridlines in the grid's
 * colour, one a tick, as wide as each other and evenly apart; the category
 * axis's line along the lowest; its tick labels; its bars or its lines;
 * and nothing painted that the paint does not name. Without as many
 * gridlines as ticks there is no plot to read the rest on.
 */
export function axisProblems(read: ChartRead): Axes {
  const { expected, say } = read
  // The expectation's ticks are held whatever the PDF draws: an axis it cannot place is the fixture's mistake.
  const place = placesOf(expected)
  const grid = read.paths.filter((path) => painted(path, 'stroke', GRID_PAINT) && path.height <= EDGE).sort((a, b) => b.top - a.top)
  const [lowest] = grid
  if (lowest === undefined || grid.length !== expected.ticks.length)
    return { ticks: new Set(), problems: [say(`draws ${plural(grid.length, 'gridline')} in the grid's colour; its ticks are ${expected.ticks.length}`)] }
  const plot: Plot = { left: lowest.x, right: lowest.x + lowest.width, gridlines: grid.map(({ top }) => top) }
  const axis = read.paths.find(
    (path) =>
      painted(path, 'stroke', AXIS_PAINT) &&
      path.height <= EDGE &&
      near(path.top, lowest.top) &&
      near(path.x, plot.left) &&
      near(path.x + path.width, plot.right),
  )
  const labels = tickLabels(read, plot)
  const paints = expected.marks.map(({ paint }) => paint)
  const named = (path: PdfPath): boolean =>
    path === axis ||
    grid.includes(path) ||
    paints.some((paint) => painted(path, 'fill', paint) || painted(path, 'fillStroke', paint) || (expected.chart === 'line' && painted(path, 'stroke', paint)))
  const problems = [
    ...gridProblems(read, grid),
    ...(axis === undefined ? [say(`draws no line in the axis's colour along its plot's foot at ${points(lowest.top)} pt`)] : []),
    ...labels.problems,
    ...(expected.chart === 'bar' ? barProblems(read, plot, place) : lineProblems(read, plot, place)),
    ...unnamed(read, named),
  ]
  return { plot, ticks: labels.items, problems }
}

/** The gridlines, lowest first, as wide as the lowest and as far apart as the lowest two. */
function gridProblems({ say }: ChartRead, grid: readonly PdfPath[]): string[] {
  const [lowest, next] = grid as [PdfPath, PdfPath]
  const across = (line: PdfPath): string => `from ${points(line.x)} to ${points(line.x + line.width)}`
  const step = lowest.top - next.top
  return [
    ...grid.flatMap((line, index) =>
      near(line.x, lowest.x) && near(line.width, lowest.width)
        ? []
        : [say(`draws its gridline of tick ${index + 1} ${across(line)} pt across; its lowest ${across(lowest)}`)],
    ),
    ...grid.slice(1).flatMap((line, index) => {
      const apart = grid[index]!.top - line.top
      return near(apart, step)
        ? []
        : [say(`draws its gridlines unevenly: ${points(step)} pt apart from its lowest tick, ${points(apart)} pt from tick ${index + 1} to tick ${index + 2}`)]
    }),
  ]
}

/**
 * Its ticks' labels: each a run of a tick's text wholly left of the plot,
 * across its tick's gridline; the lowest and every k-th above it, at least
 * two, as the renderer thins them; their tops falling as their values rise.
 */
function tickLabels({ expected, say, items }: ChartRead, plot: Plot): { items: ReadonlySet<PdfTextItem>; problems: string[] } {
  const claimed = new Set<PdfTextItem>()
  const problems: string[] = []
  const printed: { readonly index: number; readonly item: PdfTextItem }[] = []
  expected.ticks.forEach(({ text }, index) => {
    const found = items.filter((item) => item.text === text && item.x + item.width <= plot.left + EDGE)
    for (const item of found) claimed.add(item)
    const [item] = found
    if (item === undefined) return
    if (found.length > 1) problems.push(say(`prints tick ${quoted(text)} ${times(found.length)} beside its plot`))
    printed.push({ index, item })
    const gridline = plot.gridlines[index]!
    if (item.top > gridline + EDGE || item.bottom < gridline - EDGE)
      problems.push(
        say(`prints tick ${quoted(text)} from ${points(item.top)} to ${points(item.bottom)} pt down the page, not across its gridline at ${points(gridline)}`),
      )
  })
  const indices = printed.map(({ index }) => index)
  const label = (index: number): string => quoted(expected.ticks[index]!.text)
  const list = (each: readonly number[]): string => each.map(label).join(', ')
  const [first, every] = indices
  if (first !== 0 || every === undefined) {
    problems.push(say(`labels ${indices.length === 0 ? 'none of its ticks' : `its ticks ${list(indices)}`}; at least two, from its lowest, ${label(0)}`))
  } else {
    const thinned = expected.ticks.flatMap((_, index) => (index % every === 0 ? [index] : []))
    if (thinned.join() !== indices.join()) problems.push(say(`labels its ticks ${list(indices)}; one in every ${every} from the lowest is ${list(thinned)}`))
  }
  printed.slice(1).forEach(({ index, item }, at) => {
    const below = printed[at]!
    if (item.top >= below.item.top) problems.push(say(`prints tick ${label(index)} no higher than tick ${label(below.index)}`))
  })
  return { items: claimed, problems }
}

/** A series' filled paths that stand in the plot by `inPlot`, and a problem of each that does not. */
function filledIn(read: ChartRead, paint: string, series: number, inPlot: (path: PdfPath) => boolean): { inside: PdfPath[]; problems: string[] } {
  const filled = read.paths.filter((path) => painted(path, 'fill', paint))
  return {
    inside: filled.filter(inPlot),
    problems: filled
      .filter((path) => !inPlot(path))
      .map((path) => read.say(`paints a filled path in series ${series + 1}'s colour outside its plot: ${described(path)}`)),
  }
}

/**
 * Each series' bars: a filled path in its colour in each category's slot
 * where it has a value and none where it has none, wholly in the slot its
 * middle stands in, spanning zero's height to its value's, every bar of
 * the chart one width. A bar no longer than
 * `EDGE` -- a zero, which ECharts draws along zero -- shows nothing, and
 * may be left out.
 */
function barProblems(read: ChartRead, plot: Plot, place: (exact: string) => number): string[] {
  const { expected, say } = read
  const zero = heightAt(plot, place('0'))
  const area = plotBox(plot)
  let first: PdfPath | undefined
  return expected.marks.flatMap(({ paint, values }, series) => {
    const { inside, problems } = filledIn(read, paint, series, (path) => within(path, area))
    const of = (category: number): string => `series ${series + 1} at category ${category + 1}`
    values.forEach((value, category) => {
      const bars = inside.filter((bar) => slotOf(plot, expected, bar.x + bar.width / 2) === category)
      if (value === null) return bars.forEach(() => problems.push(say(`draws a bar of ${of(category)}, which has no value`)))
      const height = heightAt(plot, place(value))
      const [top, bottom] = [Math.min(zero, height), Math.max(zero, height)]
      const [bar] = bars
      if (bars.length > 1) problems.push(say(`draws ${bars.length} bars of ${of(category)}`))
      else if (bar === undefined) {
        if (bottom - top > EDGE) problems.push(say(`draws no bar of ${of(category)}`))
      } else {
        if (!near(bar.top, top) || !near(bar.bottom, bottom))
          problems.push(
            say(
              `draws the bar of ${of(category)} from ${points(bar.top)} to ${points(bar.bottom)} pt down the page; its value stands from ${points(top)} to ${points(bottom)}`,
            ),
          )
        const [left, right] = slotAt(plot, expected, category)
        if (bar.x < left - EDGE || bar.x + bar.width > right + EDGE)
          problems.push(
            say(
              `draws the bar of ${of(category)} from ${points(bar.x)} to ${points(bar.x + bar.width)} pt across, past its slot from ${points(left)} to ${points(right)}`,
            ),
          )
        first ??= bar
        if (!near(bar.width, first.width))
          problems.push(say(`draws the bar of ${of(category)} ${points(bar.width)} pt wide; its first bar is ${points(first.width)}`))
      }
    })
    return problems
  })
}

/** Each run of a series' values with no gap, two or more long: what the renderer joins with a line. */
function stretchesOf(values: readonly (string | null)[]): { readonly from: number; readonly to: number }[] {
  const stretches: { from: number; to: number }[] = []
  values.forEach((value, index) => {
    const last = stretches.at(-1)
    if (value === null) return
    if (last !== undefined && last.to === index - 1) last.to = index
    else stretches.push({ from: index, to: index })
  })
  return stretches.filter(({ from, to }) => to > from)
}

/**
 * Each series' line: a filled marker of a square box in its colour at
 * each value, centred at its category's middle and its value's height,
 * none where it has no value; and a stroked line in its colour across
 * each stretch of two or more values, as far as their markers' middles.
 * A series with no value draws neither (Task 20's ruling).
 */
function lineProblems(read: ChartRead, plot: Plot, place: (exact: string) => number): string[] {
  const { expected, say } = read
  const area = plotBox(plot)
  const centre = (path: PdfPath): PdfBox => ({
    x: path.x + path.width / 2,
    top: path.top + path.height / 2,
    bottom: path.top + path.height / 2,
    width: 0,
    height: 0,
  })
  return expected.marks.flatMap(({ paint, values }, series) => {
    const name = `series ${series + 1}`
    const { inside, problems } = filledIn(read, paint, series, (path) => within(centre(path), area))
    values.forEach((value, category) => {
      const markers = inside.filter((marker) => slotOf(plot, expected, centre(marker).x) === category)
      const at = `${name} at category ${category + 1}`
      if (value === null) return markers.forEach(() => problems.push(say(`draws a marker of ${at}, which has no value`)))
      const [marker] = markers
      if (marker === undefined || markers.length > 1)
        return problems.push(say(`draws ${markers.length === 0 ? 'no marker' : plural(markers.length, 'marker')} of ${at}`))
      const [x, y] = [centre(marker).x, centre(marker).top]
      const [middle, height] = [middleOf(plot, expected, category), heightAt(plot, place(value))]
      if (!near(marker.width, marker.height))
        problems.push(say(`draws the marker of ${at} ${points(marker.width)} × ${points(marker.height)} pt, which is no square`))
      if (!near(x, middle) || !near(y, height))
        problems.push(say(`draws the marker of ${at} at ${points(x)}, ${points(y)}; its value stands at ${points(middle)}, ${points(height)}`))
    })
    const stretches = stretchesOf(values)
    const lines = read.paths.filter((path) => painted(path, 'stroke', paint)).sort((a, b) => a.x - b.x)
    if (lines.length !== stretches.length)
      return [
        ...problems,
        say(
          `draws ${plural(lines.length, 'line')} of ${name}; its values make ${stretches.length} ${stretches.length === 1 ? 'stretch' : 'stretches'} of two or more`,
        ),
      ]
    lines.forEach((line, index) => {
      const { from, to } = stretches[index]!
      const heights = values.slice(from, to + 1).map((value) => heightAt(plot, place(value!)))
      const [left, right, top, bottom] = [middleOf(plot, expected, from), middleOf(plot, expected, to), Math.min(...heights), Math.max(...heights)]
      if (!near(line.x, left) || !near(line.x + line.width, right) || !near(line.top, top) || !near(line.bottom, bottom))
        problems.push(
          say(
            `draws its line of ${name} from category ${from + 1} to ${to + 1} across ${points(line.x)} to ${points(line.x + line.width)} pt and down ${points(line.top)} to ${points(line.bottom)} pt; its values span ${points(left)} to ${points(right)} across and ${points(top)} to ${points(bottom)} down`,
          ),
        )
    })
    return problems
  })
}

/**
 * The words of a bar or a line chart's categories: each label printed
 * centred under its slot, below the plot. A label not printed is the
 * words check's to say; an empty one prints nothing that could be read.
 */
export function categoryProblems({ expected, say }: ChartRead, plot: Plot, words: readonly PdfTextItem[]): string[] {
  const foot = plot.gridlines[0]!
  return expected.categories.flatMap((label, index) => {
    const printed = words.filter((item) => item.text === label)
    const middle = middleOf(plot, expected, index)
    if (printed.length === 0 || printed.some((item) => near(item.x + item.width / 2, middle) && item.top >= foot - EDGE)) return []
    return [say(`prints category ${index + 1}'s label ${quoted(label)} nowhere under its slot, centred at ${points(middle)} pt`)]
  })
}

/**
 * A pie's slices: one filled path in each slice's colour where it has a
 * share of the pie as the renderer hands it over, however thin, and none
 * where it has none -- a zero, or a slice under one part of `SHARE_UNIT`
 * -- and together a disc, whose box is a square. Its swatches are filled
 * and stroked; it paints nothing else. ECharts 6.1.0 draws a slice of no
 * share as a sector of no sweep, a path from the pie's centre to its rim
 * (measured on 2026-11-13), which this refuses: the box of a path at a
 * slant cannot prove it has no area, and a rasteriser that paints every
 * pixel a shape touches may print it as a hairline.
 */
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
  const problems = slices.flatMap((paths, index) => {
    const slice = `slice ${index + 1}`
    if (units[index]! * SHARE_UNIT < total) return paths.length === 0 ? [] : [say(`paints ${slice}, which has no share of its pie`)]
    if (paths.length === 0) return [say(`paints nothing of ${slice}`)]
    return paths.length === 1 ? [] : [say(`paints ${slice} in ${paths.length} paths`)]
  })
  const drawn = slices.flat()
  const [width, height] = [
    Math.max(...drawn.map(({ x, width: across }) => x + across)) - Math.min(...drawn.map(({ x }) => x)),
    Math.max(...drawn.map(({ bottom }) => bottom)) - Math.min(...drawn.map(({ top }) => top)),
  ]
  if (drawn.length > 0 && !near(width, height))
    problems.push(say(`paints its slices together across ${points(width)} × ${points(height)} pt, which is no square`))
  const paints = expected.marks.map(({ paint }) => paint)
  return [...problems, ...unnamed(read, (path) => paints.some((paint) => painted(path, 'fill', paint) || painted(path, 'fillStroke', paint)))]
}
