import { decimalOf, described, inPaint, meet, MEET, near, painted, quotient, times, unitsAt, within, type ChartRead, type Decimal } from './check-chart-read.js'
import { EDGE, plural, points, quoted } from './check-page.js'
import type { ExpectedChart } from './fixture.js'
import type { PdfBox, PdfPath, PdfTextItem } from './read-pdf.js'

/**
 * A bar or a line chart's axes and marks held to the renderer's paint
 * (0058) and to its values: its gridlines, its category axis's line and its
 * ticks' labels; each bar its value's length, and each series' line
 * through its markers, in a part for each stretch of its values; its
 * categories' labels under their slots; and nothing painted that the paint
 * names no part of a chart by. The paint is the renderer's
 * (`chart-option.ts`): bars and line markers filled in their colour; a
 * series' line, gridlines and the category axis's line stroked; legend
 * swatches filled and stroked; nothing else.
 *
 * What it rests on, and what it does not see:
 * - **Geometry and colour together.** A series may be painted in any
 *   colour, the grid's and the axis's among them. The gridlines are the
 *   strokes across the page in the grid's colour as wide as the widest of
 *   them, the plot, one at each tick; the category axis's line is the
 *   stroke in the axis's colour along the plot's foot, as wide; every other
 *   path in a series' colour is that series'. A series' line spans its
 *   categories' middles, never the plot, so a grey line flat on a tick is
 *   not taken for its gridline, nor a black one along zero for the axis.
 * - **Boxes and points.** A bar is read by the box of its points, a marker
 *   by its box's centre. A series' line is one path, a subpath for each
 *   stretch of two values or more (measured on ECharts 6.1.0's renders: a
 *   lone value draws a marker alone), and is read by its subpaths' points
 *   (`PdfPath.subpaths`): a line drawn across a gap has the box of the
 *   line drawn either side of it, and other points.
 * - **The exact place.** A value's height is its place among the ticks
 *   -- its distance from the lowest in their interval, worked out from
 *   the runtime's decimals, `Number` applied to the place alone -- set
 *   between the gridlines the PDF draws at the ticks' places. Ticks that
 *   share fifteen digits stand apart only as decimals: their doubles
 *   would put a value up to an interval from its place (Task 19).
 * - **The renderer's colours.** The grid's and the axis's are the
 *   renderer's constants written here, since the corpus depends on no
 *   renderer; report-render-pdf's `corpus.test.ts` holds them to its own,
 *   and every chart fixture's axis is found by them.
 */

/** The renderer's colours of a chart's gridlines and of its category axis's line, `chart-option.ts`'s GRID and AXIS, which report-render-pdf's `corpus.test.ts` holds them to. */
export const GRID_PAINT = '#d9d9d9'
export const AXIS_PAINT = '#000000'

/**
 * Of the font size: how far a tick label's middle, as the reader boxes it,
 * may stand from its gridline beyond `EDGE`. ECharts sets the middle of the
 * word's line on the gridline, and the reader's box is centred 0.3 em above
 * the baseline (`read-pdf.ts`), where a line's middle is (ascent − descent)
 * / 2 above it: measured on the renderer's ticks at 8 and 14 pt, 0.0418 em
 * below the gridline in Roboto, 0.0374 in Liberation Serif, and 0.0339
 * above it in Liberation Mono. A face whose ascent and descent differ by
 * more than 0.7 em, or by less than 0.5, stands farther off.
 */
const LINE_OFFSET = 0.05

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

/** Category `index`'s slot across the plot: from its left edge to its right. */
const slotAt = (plot: Plot, chart: ExpectedChart, index: number): readonly [number, number] => {
  const width = (plot.right - plot.left) / chart.categories.length
  return [plot.left + index * width, plot.left + (index + 1) * width]
}

/** The middle of category `index`'s slot: the plot's width shared among the categories, a line's as a bar's. */
const middleOf = (plot: Plot, chart: ExpectedChart, index: number): number => plot.left + ((index + 0.5) * (plot.right - plot.left)) / chart.categories.length

/** Which category's slot `x` stands in. */
const slotOf = (plot: Plot, chart: ExpectedChart, x: number): number =>
  Math.min(Math.max(Math.floor(((x - plot.left) * chart.categories.length) / (plot.right - plot.left)), 0), chart.categories.length - 1)

/** A stroke across the page: a gridline, the axis's line, or a line flat along a value. */
const across = (path: PdfPath): boolean => path.paint === 'stroke' && path.height <= EDGE

/**
 * A bar or a line chart's axes and marks: its gridlines, one a tick, as
 * wide as the plot and evenly apart; the category axis's line along the
 * lowest; its tick labels; its bars or its lines; and nothing painted that
 * the paint does not name. Without as many gridlines as ticks there is no
 * plot to read the rest on.
 */
export function axisProblems(read: ChartRead): Axes {
  const { expected, say } = read
  // The expectation's ticks are held whatever the PDF draws: an axis it cannot place is the fixture's mistake.
  const place = placesOf(expected)
  const greys = read.paths.filter((path) => across(path) && painted(path, 'stroke', GRID_PAINT))
  const widest = Math.max(0, ...greys.map(({ width }) => width))
  const grid = greys.filter(({ width }) => near(width, widest)).sort((a, b) => b.top - a.top)
  const [lowest] = grid
  if (lowest === undefined || grid.length !== expected.ticks.length)
    return {
      ticks: new Set(),
      problems: [say(`draws ${plural(grid.length, 'gridline')} in the grid's colour across its plot; its ticks are ${expected.ticks.length}`)],
    }
  const plot: Plot = { left: lowest.x, right: lowest.x + lowest.width, gridlines: grid.map(({ top }) => top) }
  const axis = read.paths.find(
    (path) =>
      across(path) && painted(path, 'stroke', AXIS_PAINT) && near(path.top, lowest.top) && near(path.x, plot.left) && near(path.x + path.width, plot.right),
  )
  const own = (paint: string): PdfPath[] => read.paths.filter((path) => path !== axis && !grid.includes(path) && inPaint(path, paint))
  const labels = tickLabels(read, plot)
  const named = (path: PdfPath): boolean => path === axis || grid.includes(path) || expected.marks.some(({ paint }) => inPaint(path, paint))
  const problems = [
    ...gridProblems(read, grid),
    ...(axis === undefined ? [say(`draws no line in the axis's colour along its plot's foot at ${points(lowest.top)} pt`)] : []),
    ...labels.problems,
    ...(expected.chart === 'bar' ? barProblems(read, plot, place, own) : lineProblems(read, plot, place, own)),
    ...read.paths.filter((path) => !named(path)).map((path) => say(`paints ${described(path)}, which is no part of a chart`)),
  ]
  return { plot, ticks: labels.items, problems }
}

/** The gridlines, lowest first, where the lowest stands across, and as far apart as the lowest two. */
function gridProblems({ say }: ChartRead, grid: readonly PdfPath[]): string[] {
  const [lowest, next] = grid as [PdfPath, PdfPath]
  const span = (line: PdfPath): string => `from ${points(line.x)} to ${points(line.x + line.width)}`
  const step = lowest.top - next.top
  return [
    ...grid.flatMap((line, index) =>
      near(line.x, lowest.x) ? [] : [say(`draws its gridline of tick ${index + 1} ${span(line)} pt across; its lowest ${span(lowest)}`)],
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
 * its middle at its tick's gridline (`LINE_OFFSET`); the lowest and every
 * k-th above it, at least two, as the renderer thins them; their tops
 * falling as their values rise.
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
    const [middle, gridline] = [(item.top + item.bottom) / 2, plot.gridlines[index]!]
    if (Math.abs(middle - gridline) > EDGE + LINE_OFFSET * item.height)
      problems.push(
        say(
          `prints tick ${quoted(text)} with its middle at ${points(middle)} pt down the page, ${points(Math.abs(middle - gridline))} from its gridline at ${points(gridline)}`,
        ),
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
function filledIn(
  read: ChartRead,
  paths: readonly PdfPath[],
  paint: string,
  series: number,
  inPlot: (path: PdfPath) => boolean,
): { inside: PdfPath[]; problems: string[] } {
  const filled = paths.filter((path) => painted(path, 'fill', paint))
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
 * the chart one width and no two meeting. A bar no longer than `EDGE` --
 * a zero, which ECharts draws along zero -- shows nothing, and may be left
 * out. A series paints its bars and its swatch, and nothing else.
 */
function barProblems(read: ChartRead, plot: Plot, place: (exact: string) => number, own: (paint: string) => PdfPath[]): string[] {
  const { expected, say } = read
  const zero = heightAt(plot, place('0'))
  const area = plotBox(plot)
  const drawn: { readonly bar: PdfPath; readonly of: string }[] = []
  const problems = expected.marks.flatMap(({ paint, values }, series) => {
    const paths = own(paint)
    const { inside, problems: outside } = filledIn(read, paths, paint, series, (path) => within(path, area))
    const of = (category: number): string => `series ${series + 1} at category ${category + 1}`
    const found = values.flatMap((value, category) => {
      const bars = inside.filter((bar) => slotOf(plot, expected, bar.x + bar.width / 2) === category)
      if (value === null) return bars.map(() => say(`draws a bar of ${of(category)}, which has no value`))
      const height = heightAt(plot, place(value))
      const [top, bottom] = [Math.min(zero, height), Math.max(zero, height)]
      const [bar] = bars
      if (bars.length > 1) return [say(`draws ${bars.length} bars of ${of(category)}`)]
      if (bar === undefined) return bottom - top > EDGE ? [say(`draws no bar of ${of(category)}`)] : []
      const [left, right] = slotAt(plot, expected, category)
      const [first] = drawn
      drawn.push({ bar, of: of(category) })
      return [
        ...(near(bar.top, top) && near(bar.bottom, bottom)
          ? []
          : [
              say(
                `draws the bar of ${of(category)} from ${points(bar.top)} to ${points(bar.bottom)} pt down the page; its value stands from ${points(top)} to ${points(bottom)}`,
              ),
            ]),
        ...(bar.x >= left - EDGE && bar.x + bar.width <= right + EDGE
          ? []
          : [
              say(
                `draws the bar of ${of(category)} from ${points(bar.x)} to ${points(bar.x + bar.width)} pt across, past its slot from ${points(left)} to ${points(right)}`,
              ),
            ]),
        ...(first === undefined || near(bar.width, first.bar.width)
          ? []
          : [say(`draws the bar of ${of(category)} ${points(bar.width)} pt wide; its first bar is ${points(first.bar.width)}`)]),
      ]
    })
    const other = paths.filter((path) => !painted(path, 'fill', paint) && !painted(path, 'fillStroke', paint))
    return [...outside, ...found, ...other.map((path) => say(`paints ${described(path)}, which is no part of a chart`))]
  })
  const meeting = drawn.flatMap(({ bar, of }, index) =>
    drawn
      .slice(index + 1)
      .filter((other) => meet(bar, other.bar, MEET))
      .map((other) => say(`draws the bars of ${of} and ${other.of} over each other`)),
  )
  return [...problems, ...meeting]
}

/** Each run of a series' values with no gap, two or more long: what the renderer joins with a part of the series' line. */
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

/** Points as a problem lists them. */
const listed = (each: readonly (readonly [number, number])[]): string => each.map(([x, y]) => `${points(x)}, ${points(y)}`).join('; ')

/**
 * Each series' line: a filled marker of a square box in its colour at
 * each value, centred at its category's middle and its value's height,
 * none where it has no value; and, where its values make a stretch of two
 * or more, one stroked path in its colour -- none where they make none --
 * whose subpaths are its stretches, in order, each through its markers'
 * centres, so that none bridges a gap. A series with no value draws
 * neither (Task 20's ruling). A series paints its markers, its line and
 * its swatch, and nothing else.
 */
function lineProblems(read: ChartRead, plot: Plot, place: (exact: string) => number, own: (paint: string) => PdfPath[]): string[] {
  const { expected, say } = read
  const area = plotBox(plot)
  const centre = (path: PdfPath): PdfBox => ({
    x: path.x + path.width / 2,
    top: path.top + path.height / 2,
    bottom: path.top + path.height / 2,
    width: 0,
    height: 0,
  })
  const pointOf = (value: string, category: number): [number, number] => [middleOf(plot, expected, category), heightAt(plot, place(value))]
  return expected.marks.flatMap(({ paint, values }, series) => {
    const name = `series ${series + 1}`
    const paths = own(paint)
    const { inside, problems } = filledIn(read, paths, paint, series, (path) => within(centre(path), area))
    values.forEach((value, category) => {
      const markers = inside.filter((marker) => slotOf(plot, expected, centre(marker).x) === category)
      const at = `${name} at category ${category + 1}`
      if (value === null) return markers.forEach(() => problems.push(say(`draws a marker of ${at}, which has no value`)))
      const [marker] = markers
      if (marker === undefined || markers.length > 1)
        return problems.push(say(`draws ${markers.length === 0 ? 'no marker' : plural(markers.length, 'marker')} of ${at}`))
      const [[x, y], [middle, height]] = [[centre(marker).x, centre(marker).top], pointOf(value, category)]
      if (!near(marker.width, marker.height))
        problems.push(say(`draws the marker of ${at} ${points(marker.width)} × ${points(marker.height)} pt, which is no square`))
      if (!near(x, middle) || !near(y, height))
        problems.push(say(`draws the marker of ${at} at ${points(x)}, ${points(y)}; its value stands at ${points(middle)}, ${points(height)}`))
    })
    const stretches = stretchesOf(values)
    const lines = paths.filter((path) => painted(path, 'stroke', paint))
    const other = paths.filter((path) => !painted(path, 'fill', paint) && !painted(path, 'stroke', paint) && !painted(path, 'fillStroke', paint))
    problems.push(...other.map((path) => say(`paints ${described(path)}, which is no part of a chart`)))
    const [line] = lines
    const count = stretches.length
    const stretched = `${count === 0 ? 'no stretch' : `${String(count)} ${count === 1 ? 'stretch' : 'stretches'}`} of two or more`
    if (lines.length !== (count === 0 ? 0 : 1))
      return [
        ...problems,
        say(`draws ${plural(lines.length, 'line')} of ${name}; its values make ${stretched}, which ECharts draws as ${count === 0 ? 'none' : 'one line'}`),
      ]
    if (line === undefined) return problems
    if (line.subpaths.length !== count)
      return [...problems, say(`draws its line of ${name} in ${plural(line.subpaths.length, 'part')}; its values make ${stretched}`)]
    stretches.forEach(({ from, to }, part) => {
      const drawn = line.subpaths[part]!
      const wanted = values.slice(from, to + 1).map((value, offset) => pointOf(value!, from + offset))
      if (drawn.length !== wanted.length || drawn.some(([x, y], index) => !near(x, wanted[index]![0]) || !near(y, wanted[index]![1])))
        problems.push(
          say(
            `draws part ${part + 1} of its line of ${name} through ${listed(drawn)}; its values from category ${from + 1} to ${to + 1} stand at ${listed(wanted)}`,
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
