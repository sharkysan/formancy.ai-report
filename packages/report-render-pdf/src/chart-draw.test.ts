import { RenderRefusal, type AxisChart, type ChartValue, type PieChart } from '@formancy/report-runtime'
import type { EChartsType } from 'echarts/core'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { BAND_GAP, drawChart, MIN_BAR_WIDTH, TICK_CLEARANCE, type DrawnChart } from './chart-draw.js'
import type { ChartFace, ChartFaces } from './chart-faces.js'
import { withMeasurer } from './chart-measure.js'
import { barWidth, CATEGORY_LABEL_MARGIN, chartOption, chartWords, VALUE_LABEL_DISTANCE, type ChartLayout } from './chart-option.js'
import type { PlacedWord } from './chart-svg.js'
import type { FaceWidths } from './engine.js'
import { TIMEOUT } from './testing/documents.js'
import { layOut } from './testing/echarts.js'

/**
 * A chart laid out by ECharts and held to the drawing's rules
 * (`chart-draw.ts`). Every block is built by hand, and every word is
 * measured in faces of fixed advances -- each character half its size
 * wide, its line a quarter more than its size -- so that each rule's
 * numbers are the case's own: a word of n characters at 8 points is 4n
 * wide and 10 tall. A render's real faces are the document's tests'.
 *
 * Every layout the drawing hands ECharts is recorded, passing through,
 * so that a case reads which layouts were made and where each put the
 * plot; where a case needs the plot ECharts chose, it reads it as the
 * drawing does, by `convertToPixel`, from a layout of its own.
 */

vi.mock('./chart-option.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./chart-option.js')>()
  return { ...actual, chartOption: vi.fn(actual.chartOption) }
})
beforeEach(() => {
  vi.mocked(chartOption).mockClear()
})

/** The layouts the drawing handed ECharts since the case began, in order. */
const layouts = (): ChartLayout[] => vi.mocked(chartOption).mock.calls.map(([, , layout]) => layout)

/** The size every chart's words print at here, and the line most print in. */
const SIZE = 8
const LINE = 10

/**
 * A face of fixed advances, its line `line` and its ascent four fifths of
 * it: its family names no font, and its digest, `digit` 64 times, is the
 * case's own, as the drawing's reader requires one. zrender keeps a font's
 * line by its font string, so each line has a digest of its own.
 */
const fixed = (bold: boolean, line: number, digit: string): ChartFace => ({
  family: 'Fixed',
  face: bold ? 'bold' : 'normal',
  size: SIZE,
  line,
  ascent: (4 * line) / 5,
  descent: -line / 5,
  font: { fontFamily: `Fixed, f${digit.repeat(64)}`, fontWeight: bold ? 'bold' : 'normal', fontStyle: 'normal', fontSize: SIZE, color: '#000000' },
})

/** A title's and the words' faces of `line`, under `digit`'s digest. */
const facesOf = (line: number, digit: string): ChartFaces => ({ words: fixed(false, line, digit), title: fixed(true, line, digit) })

const FACES = facesOf(LINE, '0')

/** Faces of Roboto's line at 8 points, 2400/2048 of an em: a line whose half has more places than a whole or a half point, so that the plot ECharts fits stands off a half point. */
const ROBOTO_LINE = facesOf(9.375, '1')

/** Faces of a line of 8 points, a line and a quarter of which is a whole 10, as an interval between ticks may be. */
const SHORT_LINE = facesOf(8, '2')

/** Every character half its size wide, in every face. */
const WIDTHS: FaceWidths = { width: (_family, _face, size, text) => ([...text].length * size) / 2 }

/** A value the runtime resolved: exactly, and as it prints. */
const value = (exact: string, text = `${exact}.00`): ChartValue => ({ exact, text })

/** The runtime's ticks at `exacts`, each printed with two places. */
const ticksAt = (...exacts: readonly string[]): ChartValue[] => exacts.map((exact) => value(exact))

/** The eight colours a chart's palette holds at most. */
const PALETTE = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'] as const

/** Two series of bars over three regions, one below zero and one value missing, every value labelled, with a title, axis titles and a legend. */
const BARS: AxisChart = {
  kind: 'chart',
  chart: 'bar',
  id: 'bars',
  width: 300,
  height: 240,
  title: 'Umsatz',
  categoryTitle: 'Region',
  valueTitle: 'Betrag',
  categories: ['Nord', 'Süd', 'Ost'],
  series: [
    { color: PALETTE[0], values: [value('300'), value('-300'), null] },
    { color: PALETTE[1], values: [value('1000'), value('450'), value('100')] },
  ],
  ticks: ticksAt('-500', '0', '500', '1000', '1500'),
  valueLabels: true,
  legend: [
    { text: 'Plan', color: PALETTE[0] },
    { text: 'Ist', color: PALETTE[1] },
  ],
}

/** One line over three months, below zero at one, every value labelled: ECharts' own default would stand its category axis on zero. */
const LINE_CHART: AxisChart = {
  kind: 'chart',
  chart: 'line',
  id: 'line',
  width: 300,
  height: 240,
  title: 'Saldo',
  categoryTitle: 'Monat',
  valueTitle: 'CHF',
  categories: ['Jan', 'Feb', 'Mar'],
  series: [{ color: PALETTE[2], values: [value('300'), value('-400'), value('1200')] }],
  ticks: ticksAt('-500', '0', '500', '1000', '1500'),
  valueLabels: true,
  legend: [],
}

/** Three slices, each value printed in its legend entry, with a title. */
const PIE: PieChart = {
  kind: 'chart',
  chart: 'pie',
  id: 'pie',
  width: 300,
  height: 240,
  title: 'Anteile',
  slices: [
    { color: PALETTE[0], value: value('50') },
    { color: PALETTE[1], value: value('30') },
    { color: PALETTE[2], value: value('20') },
  ],
  legend: [
    { text: 'Beratung 50 %', color: PALETTE[0] },
    { text: 'Material 30 %', color: PALETTE[1] },
    { text: 'Reise 20 %', color: PALETTE[2] },
  ],
}

/** One series of bars over `categories`, ticked at `ticks`, in a box `width` by `height`, with no title, axis title, legend or value label. */
function bare(id: string, width: number, height: number, ticks: readonly ChartValue[], categories: readonly string[] = ['Nord', 'Süd', 'Ost']): AxisChart {
  return {
    kind: 'chart',
    chart: 'bar',
    id,
    width,
    height,
    categories,
    series: [{ color: PALETTE[0], values: categories.map((_, index) => value(String(10 * (index + 1)))) }],
    ticks,
    valueLabels: false,
    legend: [],
  }
}

/** The word `key` of `drawing`, which must hold it. */
function word(drawing: DrawnChart, key: string): PlacedWord {
  const found = drawing.words.find((each) => each.key === key)
  if (found === undefined) throw new Error(`the drawing holds no word ${key}`)
  return found
}

/** Where `word`'s box ends, below. */
const below = ({ top, height }: PlacedWord): number => top + height

/** The top of the highest row of `drawing`'s legend. */
const legendTop = (drawing: DrawnChart): number => Math.min(...drawing.words.filter(({ key }) => key.startsWith('legend/')).map(({ top }) => top))

/** The plot ECharts laid `chart` out in, in `layout`, read as the drawing reads it: its foot and top at the lowest tick's place and the highest's, its sides half a slot past the first and the last categories' middles. */
function fittedPlot(chart: AxisChart, layout: ChartLayout, faces: ChartFaces = FACES): NonNullable<ChartLayout['plot']> {
  const read = (laid: EChartsType) => {
    const foot = laid.convertToPixel({ yAxisIndex: 0 }, 0)
    const top = laid.convertToPixel({ yAxisIndex: 0 }, chart.ticks.length - 1)
    const first = laid.convertToPixel({ xAxisIndex: 0 }, 'c0')
    const last = laid.convertToPixel({ xAxisIndex: 0 }, `c${String(chart.categories.length - 1)}`)
    const half = (last - first) / (chart.categories.length - 1) / 2
    return { left: first - half, top, width: last - first + 2 * half, height: foot - top }
  }
  const option = chartOption(chart, faces, layout)
  const { read: plot } = withMeasurer(faces, WIDTHS, () => layOut(option, chart.width, chart.height, read))
  return plot!
}

/** The drawn layout's plot: the last the drawing handed ECharts. */
function drawnPlot(): NonNullable<ChartLayout['plot']> {
  const plot = layouts().at(-1)?.plot
  if (plot === undefined) throw new Error('the drawing laid no plot out')
  return plot
}

/** Each gridline `drawing` draws, by its height, from the plot's foot up: a horizontal stroke in the grid's colour. */
const gridlines = ({ svg }: DrawnChart): number[] =>
  [...svg.matchAll(/<path d="M[\d.]+ ([\d.]+)L[\d.]+ ([\d.]+)"[^>]*stroke="#d9d9d9"/g)].map(([, y]) => Number(y)).sort((a, b) => b - a)

/** Whether `a` and `b` overlap, more than on an edge. */
const meet = (a: PlacedWord, b: PlacedWord): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.top < b.top + b.height && b.top < a.top + a.height

/** Whether `word` stands inside a box `width` by `height`. */
const inside = (word: PlacedWord, width: number, height: number): boolean =>
  word.x >= 0 && word.top >= 0 && word.x + word.width <= width && word.top + word.height <= height

/**
 * What `draw` threw, which must be a refusal of `chart` as `code`, its
 * message naming the chart and its box and then saying `does` -- so that a
 * case refused for another reason than its own fails -- and quoting none
 * of the chart's words.
 */
function refused(draw: () => unknown, chart: AxisChart | PieChart, does: string | RegExp, code = 'content-too-large'): RenderRefusal {
  let caught: unknown
  try {
    draw()
  } catch (error) {
    caught = error
  }
  if (!(caught instanceof RenderRefusal)) throw new Error(`not refused: ${String(caught)}`)
  expect([caught.code, caught.subject]).toEqual([code, chart.id])
  expect(caught.message.startsWith(`the chart ${chart.id}, ${String(chart.width)} by ${String(chart.height)} points, `)).toBe(true)
  expect(caught.message).toMatch(does)
  for (const { text } of chartWords(chart)) expect(caught.message).not.toContain(text)
  return caught
}

describe('a chart drawn', () => {
  // ECharts lays a chart out and the drawing only snaps what it chose: a
  // first layout across the whole box is read for where the title and the
  // legend stand, which no plot moves; a second lets ECharts fit the plot
  // and its axes' words between them; a third is drawn, its plot's top on
  // the first half point at or below ECharts' and its height the most that
  // fits above ECharts' foot with every interval a whole number of points.
  // A drawing that drew the second layout would leave gridlines up to 0.7
  // points off their ticks, and one that read no bands would let the
  // plot's words stand on the title or the legend. The band at the top
  // keeps a value label's line and its distance from its mark above the
  // plot where values are labelled; the band at the foot is the legend's
  // alone, a bar below zero labelled under its end having its room above
  // the category labels. In a line of 9.375 points ECharts fits the plot's
  // top at 57.8125, which the snap moves down to 58.5, never up to 57.5,
  // into the band.
  test.each<readonly [string, AxisChart, ChartFaces, (drawing: DrawnChart, line: number) => NonNullable<ChartLayout['bands']>]>([
    [
      'bars in a line of 10',
      BARS,
      FACES,
      (drawing, line) => ({ top: below(word(drawing, 'title')) + line / 2 + line + 5, bottom: BARS.height - legendTop(drawing) + line / 2 }),
    ],
    [
      'bars in a line of 9.375',
      BARS,
      ROBOTO_LINE,
      (drawing, line) => ({ top: below(word(drawing, 'title')) + line / 2 + line + 5, bottom: BARS.height - legendTop(drawing) + line / 2 }),
    ],
    ['a line', LINE_CHART, FACES, (drawing, line) => ({ top: below(word(drawing, 'title')) + line / 2 + line + 5, bottom: 0 })],
  ])(
    'lays a bar or a line chart out three times -- its bands, its plot between them, and drawn on its plot snapped: %s',
    (_, chart, faces, bandsOf) => {
      const drawing = drawChart(chart, faces, WIDTHS)
      const [first, second, third, ...more] = layouts()
      expect(more).toEqual([])
      expect(first).toEqual({ tickEvery: 1 })
      const { line } = faces.words
      expect([BAND_GAP * line, VALUE_LABEL_DISTANCE]).toEqual([line / 2, 5])
      const bands = bandsOf(drawing, line)
      expect(second).toEqual({ tickEvery: 1, bands })
      const fitted = fittedPlot(chart, second!, faces)
      const top = Math.ceil(fitted.top - 0.5) + 0.5
      const intervals = chart.ticks.length - 1
      const height = Math.floor((fitted.top + fitted.height - top) / intervals) * intervals
      expect(top).toBeGreaterThanOrEqual(fitted.top)
      expect(third).toEqual({ tickEvery: 1, bands, plot: { left: fitted.left, top, width: fitted.width, height } })
    },
    TIMEOUT,
  )

  // A pie has no ticks to snap: it is laid out once for its bands, the
  // title's box and a gap under it and the legend's rows and a gap above
  // them, and drawn in the largest square centred between them -- as tall
  // as the room between the bands, or in a narrow box as wide as the box,
  // centred in the room. A pie of a size of its own would stand on the
  // title or the legend, or leave the box.
  test.each([PIE, { ...PIE, id: 'narrow-pie', width: 120, height: 300 }])(
    'lays a pie out twice, in the largest square centred between its bands: $id',
    (chart) => {
      const drawing = drawChart(chart, FACES, WIDTHS)
      const [first, second, ...more] = layouts()
      expect(more).toEqual([])
      expect(first).toEqual({ tickEvery: 1 })
      const bands = { top: below(word(drawing, 'title')) + LINE / 2, bottom: chart.height - legendTop(drawing) + LINE / 2 }
      const room = chart.height - bands.top - bands.bottom
      const side = Math.min(chart.width, room)
      expect(second).toEqual({ tickEvery: 1, bands, plot: { left: (chart.width - side) / 2, top: bands.top + (room - side) / 2, width: side, height: side } })
    },
    TIMEOUT,
  )

  // zrender moves a thin line to the nearest half point for a crisp edge,
  // which the option cannot turn off: a gridline stands on its tick only
  // where the plot's top is on a half point and each interval a whole
  // number of points. Every gridline the drawing draws stands at its
  // tick's height on the snapped plot, on a half point, and every tick's
  // label is centred on its gridline: a plot left where ECharts fitted it
  // would set them apart by up to 0.7 points.
  test(
    'draws every gridline at its tick, the plot snapped',
    () => {
      const drawing = drawChart(BARS, FACES, WIDTHS)
      const { top, height } = drawnPlot()
      const pitch = height / (BARS.ticks.length - 1)
      expect(Number.isInteger(pitch)).toBe(true)
      const ticks = BARS.ticks.map((_, index) => top + height - index * pitch)
      expect(gridlines(drawing)).toEqual(ticks)
      for (const tick of ticks) expect(tick % 1).toBe(0.5)
      BARS.ticks.forEach((_, index) => {
        const label = word(drawing, `tick/${String(index)}`)
        expect(label.top + label.height / 2, String(index)).toBeCloseTo(ticks[index]!, 4)
      })
    },
    TIMEOUT,
  )

  // Eleven ticks on a short plot stand closer than their labels' lines:
  // labelled each, the labels would meet, and dropped where ECharts finds
  // them crowded, a reader could not tell which went. The drawing labels
  // every k-th from the lowest, k the least whose labels stand a line and
  // a quarter apart, and keeps every gridline. Labels exactly a line and
  // a quarter apart are far enough: in a line of 8 points, ticks 10
  // points apart are each labelled, and 5 apart every other one.
  test(
    'labels every k-th tick from the lowest, k the least that keeps them a line and a quarter apart',
    () => {
      const chart = bare('thinned', 300, 120, ticksAt('0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'))
      const drawing = drawChart(chart, FACES, WIDTHS)
      const { height } = drawnPlot()
      const pitch = height / (chart.ticks.length - 1)
      const least = Array.from({ length: chart.ticks.length - 1 }, (_, index) => index + 1).find((k) => k * pitch >= TICK_CLEARANCE * LINE)!
      expect(least).toBeGreaterThan(1)
      expect(layouts().at(-1)?.tickEvery).toBe(least)
      const labelled = drawing.words.filter(({ key }) => key.startsWith('tick/')).map(({ key }) => Number(key.slice('tick/'.length)))
      expect(labelled).toEqual(chart.ticks.flatMap((_, index) => (index % least === 0 ? [index] : [])))
      expect(gridlines(drawing)).toHaveLength(chart.ticks.length)

      const spaced = Array.from({ length: 61 }, (_, index) => 70 + index).map((boxHeight) => {
        drawChart(bare('spaced', 300, boxHeight, chart.ticks), SHORT_LINE, WIDTHS)
        return { pitch: drawnPlot().height / (chart.ticks.length - 1), tickEvery: layouts().at(-1)!.tickEvery }
      })
      const exactly = spaced.filter(({ pitch }) => (TICK_CLEARANCE * SHORT_LINE.words.line) % pitch === 0)
      expect(new Set(exactly.map(({ pitch }) => pitch))).toEqual(new Set([5, 10]))
      for (const { pitch, tickEvery } of exactly) expect(tickEvery, String(pitch)).toBe((TICK_CLEARANCE * SHORT_LINE.words.line) / pitch)
    },
    TIMEOUT,
  )

  // Three ticks label only the lowest and the highest once the interval
  // between them is under a line and a quarter: two labels a line and a
  // quarter apart are the fewest a value axis is read by. A plot too short
  // for that is refused, naming its height, never drawn with one label or
  // none.
  test(
    'refuses a chart too short for two tick labels',
    () => {
      const ticks = ticksAt('0', '50', '100')
      const drawn = [36, 37, 38, 39, 40, 41, 42].flatMap((height) => {
        const chart = bare(`short-${String(height)}`, 300, height, ticks)
        try {
          return [{ height, drawing: drawChart(chart, FACES, WIDTHS), pitch: drawnPlot().height / 2 }]
        } catch (error) {
          const refusal = refused(
            () => {
              throw error
            },
            chart,
            new RegExp(
              String.raw`^the chart short-\d+, 300 by \d+ points, has a plot (\d+) points tall, too short to label two of its 3 ticks ${String(TICK_CLEARANCE)} lines apart$`,
            ),
          )
          const [, plotHeight] = /a plot (\d+) points tall/.exec(refusal.message)!
          expect(Number(plotHeight) / 2, String(height)).toBeLessThan((TICK_CLEARANCE * LINE) / 2)
          return []
        }
      })
      // The taller boxes draw two labels, the lowest and the highest, a line and a quarter apart or more; the shorter are refused.
      expect(drawn.length).toBeGreaterThan(0)
      expect(drawn.length).toBeLessThan(7)
      for (const { height, drawing, pitch } of drawn) {
        expect(
          drawing.words.filter(({ key }) => key.startsWith('tick/')).map(({ key }) => key),
          String(height),
        ).toEqual(['tick/0', 'tick/2'])
        expect(2 * pitch).toBeGreaterThanOrEqual(TICK_CLEARANCE * LINE)
      }
    },
    TIMEOUT,
  )

  // A category label wider than its slot, less half a line, would meet its
  // neighbour or stand under another's bars; turned a quarter it would be
  // a word pdfmake cannot draw turned. Labels that fit print across, and a
  // label one character too wide is refused, naming the slot and quoting
  // no label.
  test(
    'refuses category labels that do not fit across their slots, naming the chart and quoting no label',
    () => {
      const ticks = ticksAt('0', '20', '40')
      const short = bare('across', 300, 200, ticks, ['Q1', 'Q2', 'Q3', 'Q4'])
      drawChart(short, FACES, WIDTHS)
      const slot = drawnPlot().width / short.categories.length
      // The most characters of 4 points a label may hold in its slot, less half a line.
      const most = Math.floor((slot - LINE / 2) / (SIZE / 2))
      const fits = bare('across', 300, 200, ticks, ['Q1', 'X'.repeat(most), 'Q3', 'Q4'])
      expect(word(drawChart(fits, FACES, WIDTHS), 'category/1').width).toBe((most * SIZE) / 2)
      const wide = bare('across', 300, 200, ticks, ['Q1', 'X'.repeat(most + 1), 'Q3', 'Q4'])
      refused(() => drawChart(wide, FACES, WIDTHS), wide, /has category labels too wide for their slots of [\d.]+ points across, and never turned$/)
    },
    TIMEOUT,
  )

  // A bar under the least width the drawing allows is a hairline nobody
  // reads as a bar. Eight series over ten categories stand at or above it
  // and draw; over eleven they would be thinner, and are refused by the
  // width ECharts gives a bar. A line has no bars: eight lines over eleven
  // categories draw.
  test(
    'refuses bars narrower than MIN_BAR_WIDTH',
    () => {
      const eight = (count: number): AxisChart => ({
        ...bare(`bars-${String(count)}`, 300, 200, ticksAt('0', '50', '100')),
        categories: Array.from({ length: count }, () => 'Q'),
        series: PALETTE.map((color, series) => ({ color, values: Array.from({ length: count }, () => value(String(10 + series))) })),
      })
      drawChart(eight(10), FACES, WIDTHS)
      const { width } = drawnPlot()
      expect(barWidth(width / 10, 8)).toBeGreaterThanOrEqual(MIN_BAR_WIDTH)
      expect(barWidth(width / 11, 8)).toBeLessThan(MIN_BAR_WIDTH)
      refused(() => drawChart(eight(11), FACES, WIDTHS), eight(11), /has bars [\d.]+ points wide, narrower than the 2 points a bar is drawn at least$/)
      expect(drawChart({ ...eight(11), chart: 'line', id: 'lines-11' }, FACES, WIDTHS).words.length).toBeGreaterThan(0)
    },
    TIMEOUT,
  )

  // ECharts widens a bar narrower than 1 point to 1, and a group of bars
  // so widened overflows its slot: it leaves the outer bars, and their
  // labels, undrawn. Labelled bars that thin, thirty categories of four
  // series in 120 points, are refused as bars too thin, naming their
  // width, before any layout's words are read: read first, the words
  // ECharts left out would refuse the chart as a drawing it did not hold
  // to, which tells nobody to widen the chart or show fewer categories.
  test(
    'refuses labelled bars too thin for ECharts to draw whole as bars too thin',
    () => {
      const categories = Array.from({ length: 30 }, (_, index) => `K${String(index)}`)
      const thin: AxisChart = {
        ...bare('thin', 120, 200, ticksAt('0', '1000', '2000'), categories),
        series: PALETTE.slice(0, 4).map((color, series) => ({ color, values: categories.map((_, index) => value(String(1000 + 4 * index + series))) })),
        valueLabels: true,
      }
      const refusal = refused(() => drawChart(thin, FACES, WIDTHS), thin, /has bars ([\d.]+) points wide, narrower than the 2 points a bar is drawn at least$/)
      expect(Number(/has bars ([\d.]+) points wide/.exec(refusal.message)![1])).toBeLessThan(1)
    },
    TIMEOUT,
  )

  // Under 1 point ECharts draws a bar at 1, wider than barWidth says, and
  // drops the bars a group so widened pushes past its slot -- silently,
  // where no word of them is lost. The least width the drawing allows
  // stays at or above ECharts' least, so that no bar it draws is ever
  // widened: bars laid out at 0.4 points are drawn 1 point wide, the two
  // outermost, widened past the plot's sides, cut to them.
  test(
    'keeps MIN_BAR_WIDTH at or above the least width ECharts draws a bar at',
    () => {
      const categories = Array.from({ length: 60 }, () => 'Q')
      const chart: AxisChart = { ...bare('least', 200, 200, ticksAt('0', '50', '100'), categories) }
      const plot = { left: 40, top: 20.5, width: 30, height: 100 }
      expect(barWidth(plot.width / categories.length, 1)).toBeCloseTo(0.4, 9)
      const { svg } = withMeasurer(FACES, WIDTHS, () => layOut(chartOption(chart, FACES, { tickEvery: 1, plot }), chart.width, chart.height))
      const drawn = [...svg.matchAll(/<path d="M-?[\d.]+ -?[\d.]+l(-?[\d.]+) 0l0 -?[\d.]+l-?[\d.]+ 0Z" fill="#1f77b4"[^>]*ecmeta_ssr_type="chart"/g)].map(
        ([, width]) => Number(width),
      )
      expect(drawn).toHaveLength(categories.length)
      const widened = drawn.slice(1, -1)
      expect(new Set(widened)).toEqual(new Set([1]))
      expect(Math.max(drawn[0]!, drawn.at(-1)!)).toBeLessThan(1)
      expect(MIN_BAR_WIDTH).toBeGreaterThanOrEqual(widened[0]!)
    },
    TIMEOUT,
  )

  // A chart of one category has one middle, which says nothing of its
  // slot: its plot's sides are where ECharts' grid ends, found as the last
  // points it holds. Read from a slot of nothing, the plot would be no
  // plot; read near enough, the drawn plot would stand off ECharts' by
  // as much, its gridlines past the words ECharts fitted beside them. The
  // drawn plot's sides are where ECharts drew the gridlines of the plot
  // it fitted, to the tenth of a point zrender writes a path to.
  test(
    'reads the plot of a chart of one category where ECharts laid it',
    () => {
      const chart = bare('one', 300, 200, ticksAt('0', '50', '100'), ['Nord'])
      drawChart(chart, FACES, WIDTHS)
      const [, fitted] = layouts()
      const { left, width } = drawnPlot()
      const { svg } = withMeasurer(FACES, WIDTHS, () => layOut(chartOption(chart, FACES, fitted!), chart.width, chart.height))
      const [, from = '', to = ''] = /<path d="M([\d.]+) [\d.]+L([\d.]+) [\d.]+"[^>]*stroke="#d9d9d9"/.exec(svg) ?? []
      expect(Math.abs(left - Number(from))).toBeLessThanOrEqual(0.05)
      expect(Math.abs(left + width - Number(to))).toBeLessThanOrEqual(0.05)
      expect(Number(to) - Number(from)).toBeGreaterThan(200)
    },
    TIMEOUT,
  )

  // A title and a legend that take the whole box leave the plot no room:
  // ECharts would stand them in it, over the bars, or draw the plot
  // between bands that cross. Refused before a plot is laid out, for a
  // bar chart as for a pie, and where the bands meet and leave nothing: a
  // title and a legend of one row, each 20 points with its gap, in a box
  // 40 points tall.
  test(
    'refuses a legend or a title that would stand in the plot',
    () => {
      const crowded: AxisChart = {
        ...BARS,
        id: 'crowded',
        height: 60,
        series: PALETTE.map((color) => ({ color, values: [value('100'), value('200'), value('300')] })),
        legend: PALETTE.map((color, index) => ({ color, text: `Eintrag ${String(index)}` })),
      }
      refused(() => drawChart(crowded, FACES, WIDTHS), crowded, /has no room for its plot: its title and its legend would stand in it$/)
      const flush: AxisChart = { ...BARS, id: 'flush', height: 40, valueLabels: false }
      refused(() => drawChart(flush, FACES, WIDTHS), flush, /has no room for its plot: its title and its legend would stand in it$/)
      const pie: PieChart = { ...PIE, id: 'tiny-pie', height: 40 }
      refused(() => drawChart(pie, FACES, WIDTHS), pie, /has no room for its pie: its title and its legend would stand in it$/)
    },
    TIMEOUT,
  )

  // A word another word stands on, or that stands past the box pdfmake
  // reserves, prints over the other or over what follows the chart: the
  // labels of two bars side by side at one height, each wider than the
  // room between their bars' middles; a title or a pie's legend entry
  // wider than the box. Each is refused, naming the chart and quoting no
  // word; and a title that fits, within a point of the box's side, is
  // drawn.
  test(
    'refuses words that would meet or leave the box, and draws a title that fits',
    () => {
      const labelled: AxisChart = {
        ...bare('labelled', 300, 240, ticksAt('0', '500', '1000', '1500'), ['Q1', 'Q2', 'Q3']),
        series: [0, 1].map((series) => ({ color: PALETTE[series]!, values: ['Q1', 'Q2', 'Q3'].map(() => value('1000', '1000.00000')) })),
        valueLabels: true,
      }
      refused(() => drawChart(labelled, FACES, WIDTHS), labelled, /has two words that would meet$/)
      const titled = (title: string): AxisChart => ({ ...bare('titled', 150, 100, ticksAt('0', '30')), categories: ['Q1', 'Q2'], title })
      // 37 characters of 4 points: 148 points in a box of 150. One more is 152.
      const fits = drawChart(titled('T'.repeat(37)), FACES, WIDTHS)
      expect(word(fits, 'title')).toMatchObject({ x: 1, width: 148 })
      refused(() => drawChart(titled('T'.repeat(38)), FACES, WIDTHS), titled('T'.repeat(38)), /has a word that would leave its box$/)
      const wide: PieChart = { ...PIE, id: 'wide-pie', legend: [{ text: 'W'.repeat(80), color: PALETTE[0] }, ...PIE.legend.slice(1)] }
      refused(() => drawChart(wide, FACES, WIDTHS), wide, /has a word that would leave its box$/)
    },
    TIMEOUT,
  )

  // A line chart's category labels would stand among its marks wherever
  // its category axis stood inside the plot. ECharts stands it on zero by
  // default, which on the runtime's axis of ticks by their places is the
  // lowest tick's, the plot's foot, and the option keeps it there whatever
  // the values: every label under the foot, a value below zero or not,
  // and by ECharts' own margin, since a line's labels all stand above
  // their points. A word in the plot that is not a value's label -- a
  // category label ECharts is asked to print inside the plot -- is
  // refused.
  test(
    "keeps the category labels at the plot's foot when a value is negative",
    () => {
      const drawing = drawChart(LINE_CHART, FACES, WIDTHS)
      const { top, height } = drawnPlot()
      for (const index of [0, 1, 2]) expect(word(drawing, `category/${String(index)}`).top).toBe(top + height + CATEGORY_LABEL_MARGIN)
      const actual = vi.mocked(chartOption).getMockImplementation()!
      vi.mocked(chartOption).mockImplementation((chart, faces, layout) => {
        const option = actual(chart, faces, layout)
        const xAxis = option.xAxis as { readonly axisLabel: object }
        return { ...option, xAxis: { ...xAxis, axisLabel: { ...xAxis.axisLabel, inside: true } } }
      })
      try {
        refused(() => drawChart(LINE_CHART, FACES, WIDTHS), LINE_CHART, /has a word that would stand in its plot$/)
      } finally {
        vi.mocked(chartOption).mockImplementation(actual)
      }
    },
    TIMEOUT,
  )

  // The runtime's ticks may end just past the highest value and just
  // before the lowest -- 1480 of 1500, -480 of -500 -- so that the label
  // above the highest bar stands above the plot, and the label under the
  // lowest bar below zero under it, in the row its own category's label
  // would stand in. The bands keep the highest's line and its distance
  // from its bar above the plot; the category labels stand that much
  // further under the plot's foot where a labelled bar is below zero, its
  // label between them and the foot, and the category title under them.
  // Kept anywhere else, the room would be the chart's and the label would
  // stand on its category's, refused. Where no value is labelled, the
  // category labels keep ECharts' own margin under the foot.
  test(
    'keeps a value label of the highest bar, and of the lowest negative one, inside the box',
    () => {
      const chart: AxisChart = {
        ...bare('edges', 300, 240, ticksAt('-500', '0', '500', '1000', '1500'), ['Nord', 'Süd']),
        categoryTitle: 'Region',
        series: [{ color: PALETTE[0], values: [value('1480'), value('-480')] }],
        valueLabels: true,
      }
      const drawing = drawChart(chart, FACES, WIDTHS)
      const { top, height } = drawnPlot()
      const [highest, lowest] = [word(drawing, 'value/0/0'), word(drawing, 'value/0/1')]
      expect(below(highest)).toBeLessThanOrEqual(top)
      expect(lowest.top).toBeGreaterThanOrEqual(top + height)
      expect(below(lowest)).toBeLessThanOrEqual(word(drawing, 'category/1').top)
      expect(below(word(drawing, 'category/1'))).toBeLessThanOrEqual(word(drawing, 'categoryTitle').top)
      for (const label of [highest, lowest]) expect(inside(label, chart.width, chart.height)).toBe(true)
      expect(word(drawing, 'category/1').top).toBe(top + height + CATEGORY_LABEL_MARGIN + LINE + VALUE_LABEL_DISTANCE)
      const unlabelled = drawChart({ ...chart, valueLabels: false }, FACES, WIDTHS)
      const foot = drawnPlot().top + drawnPlot().height
      expect(word(unlabelled, 'category/1').top).toBe(foot + CATEGORY_LABEL_MARGIN)
    },
    TIMEOUT,
  )

  // ECharts' plain legend wraps its entries into rows where they do not
  // fit across: eight entries print whole, in rows under the plot, none on
  // another and none past the box. A legend cut, or held to one row, would
  // drop or crowd the series it names.
  test(
    'wraps a legend of eight long entries into rows, every entry whole',
    () => {
      const chart: AxisChart = {
        ...BARS,
        id: 'eight',
        valueLabels: false,
        series: PALETTE.map((color, index) => ({ color, values: [value(String(100 * index)), value('50'), value('90')] })),
        legend: PALETTE.map((color, index) => ({ color, text: `Langer Eintrag Nummer ${String(index)}` })),
      }
      const drawing = drawChart(chart, FACES, WIDTHS)
      const entries = drawing.words.filter(({ key }) => key.startsWith('legend/'))
      expect(entries.map(({ text, width }) => [text, width])).toEqual(chart.legend.map(({ text }) => [text, ([...text].length * SIZE) / 2]))
      expect(new Set(entries.map(({ top }) => top)).size).toBeGreaterThan(1)
      const { top, height } = drawnPlot()
      for (const entry of entries) {
        expect(entry.top).toBeGreaterThan(top + height)
        expect(inside(entry, chart.width, chart.height)).toBe(true)
      }
    },
    TIMEOUT,
  )

  // ECharts writes an empty path for a line series that has no value at
  // any category beside one that has: the series is drawn, as nothing,
  // and its legend entry names it. A drawing that refused the empty path
  // would refuse a line of a counted series beside an average of a field
  // a preview's data lacks.
  test(
    'draws a line series with no value as nothing, its legend entry kept',
    () => {
      const chart: AxisChart = {
        ...LINE_CHART,
        id: 'no-values',
        valueLabels: false,
        series: [
          { color: PALETTE[0], values: [value('3'), value('5'), value('4')] },
          { color: PALETTE[1], values: [null, null, null] },
        ],
        ticks: ticksAt('0', '2', '4', '6'),
        legend: [
          { text: 'Anzahl', color: PALETTE[0] },
          { text: 'Mittel', color: PALETTE[1] },
        ],
      }
      const drawing = drawChart(chart, FACES, WIDTHS)
      expect(drawing.svg).toContain('d=""')
      expect(word(drawing, 'legend/1').text).toBe('Mittel')
    },
    TIMEOUT,
  )

  // Every word the drawn layout prints is placed, once, and nothing else:
  // a word ECharts hid would print nowhere and a word of its own would
  // print what the runtime never resolved. The words are the drawn
  // layout's -- its ticks every tickEvery-th, every other one on a short
  // plot of eleven -- and the drawing hands the converter none of them.
  test.each([BARS, LINE_CHART, PIE, bare('thinned', 300, 120, ticksAt('0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'))])(
    'places every word the layout prints, once, and no other: $id',
    (chart) => {
      const drawing = drawChart(chart, FACES, WIDTHS)
      const printed = chartWords(chart, layouts().at(-1))
      expect(drawing.words.map(({ key, text, title }) => ({ key, text, title }))).toEqual(printed)
      expect(drawing.svg).not.toContain('<text')
    },
    TIMEOUT,
  )

  // zrender numbers its instances, and the classes it writes across the
  // whole process (svg/cssClassId.js), and keeps the widths it measured: a
  // chart laid out a second time in one process must print the same words
  // in the same boxes and the same marks, or two renders of one report
  // would differ before the PDF. Its ids aside: each instance's number, and
  // each class by the order it first appears in.
  test(
    'lays the same chart out the same way twice in one process',
    () => {
      for (const chart of [BARS, LINE_CHART, PIE]) {
        const [once, twice] = [drawChart(chart, FACES, WIDTHS), drawChart(chart, FACES, WIDTHS)]
        const ids = (svg: string): string => {
          const classes = new Map<string, number>()
          const numbered = (each: string): number => classes.get(each) ?? classes.set(each, classes.size).size - 1
          return svg.replaceAll(/zr\d+-cls-\d+/g, (each) => `cls-${String(numbered(each))}`).replaceAll(/zr\d+-/g, 'zr-')
        }
        expect(once.svg).not.toBe(twice.svg)
        expect(ids(once.svg)).toBe(ids(twice.svg))
        expect(once.words).toEqual(twice.words)
      }
    },
    TIMEOUT,
  )
})

describe('charts drawn over seeds', () => {
  /** A generator of numbers in [0, 1) from `seed`: mulberry32, so that each chart is the seed's own. */
  function seeded(seed: number): () => number {
    let state = seed >>> 0
    return () => {
      state = (state + 0x6d2b79f5) >>> 0
      let mixed = Math.imul(state ^ (state >>> 15), state | 1)
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
    }
  }

  /** A chart of `seed`'s own: its kind, box, words, series, values and ticks drawn from it, as the runtime would resolve one. */
  function chartOf(seed: number): AxisChart | PieChart {
    const next = seeded(seed)
    const between = (low: number, high: number): number => low + Math.floor(next() * (high - low + 1))
    const text = (most: number): string => Array.from({ length: between(1, most) }, () => 'abcdefghijklmnopqrstuvwxyz'[between(0, 25)]).join('')
    const maybe = <K extends 'title' | 'categoryTitle' | 'valueTitle'>(key: K, most: number): Partial<Record<K, string>> =>
      next() < 0.5 ? {} : ({ [key]: text(most) } as Record<K, string>)
    const frame = { kind: 'chart', id: `seed-${String(seed)}`, width: between(140, 480), height: between(100, 360), ...maybe('title', 24) } as const
    const kind = (['bar', 'line', 'pie'] as const)[between(0, 2)]!
    if (kind === 'pie') {
      const slices = Array.from({ length: between(1, 6) }, (_, index) => ({ color: PALETTE[index]!, value: value(String(between(1, 100))) }))
      return { ...frame, chart: 'pie', slices, legend: slices.map(({ color, value: { text: share } }) => ({ color, text: `${text(12)} ${share}` })) }
    }
    const categories = Array.from({ length: between(1, 10) }, () => text(8))
    const count = between(1, kind === 'line' ? 3 : 4)
    const values = Array.from({ length: count }, () => categories.map(() => (next() < 0.1 ? null : between(-200, 800))))
    values[0]![0] = between(-200, 800)
    const known = values.flat().filter((each) => each !== null)
    const step = [50, 100, 200, 250][between(0, 3)]!
    const lowest = Math.floor(Math.min(...known, ...(kind === 'bar' ? [0] : [])) / step) * step
    const highest = Math.max(lowest + step, Math.ceil(Math.max(...known, ...(kind === 'bar' ? [0] : [])) / step) * step)
    return {
      ...frame,
      chart: kind,
      ...maybe('categoryTitle', 16),
      ...maybe('valueTitle', 12),
      categories,
      series: values.map((each, index) => ({ color: PALETTE[index]!, values: each.map((one) => (one === null ? null : value(String(one)))) })),
      ticks: Array.from({ length: (highest - lowest) / step + 1 }, (_, index) => value(String(lowest + index * step))),
      // Two lines' labels at one category could only meet: the runtime refuses them.
      valueLabels: (kind === 'bar' || count === 1) && next() < 0.5,
      legend: count > 1 ? values.map((_, index) => ({ color: PALETTE[index]!, text: text(14) })) : [],
    }
  }

  // The rules are the drawing's whole promise: whatever ECharts lays out,
  // a chart that is drawn has no two words on each other and none past its
  // box, and a chart that is not is refused as one whose content does not
  // fit, naming it -- never thrown otherwise, and never drawn regardless.
  // Over sixty charts of every kind, size and length of word, a third or
  // more draw, so that the property is not held by refusing everything.
  test(
    'lays words in boxes that never meet and never leave the chart',
    () => {
      let drawn = 0
      for (let seed = 1; seed <= 60; seed += 1) {
        const chart = chartOf(seed)
        let drawing: DrawnChart
        try {
          drawing = drawChart(chart, FACES, WIDTHS)
        } catch (error) {
          if (!(error instanceof RenderRefusal)) throw error
          expect([error.code, error.subject], error.message).toEqual(['content-too-large', chart.id])
          continue
        }
        drawn += 1
        const { words } = drawing
        for (const each of words) expect(inside(each, chart.width, chart.height), `${chart.id} ${each.key}`).toBe(true)
        words.forEach((each, index) => {
          for (const other of words.slice(index + 1)) expect(meet(each, other), `${chart.id} ${each.key} ${other.key}`).toBe(false)
        })
      }
      expect(drawn).toBeGreaterThanOrEqual(20)
    },
    TIMEOUT,
  )
})

describe('ECharts as the drawing finds it', () => {
  afterEach(() => {
    vi.doUnmock('echarts/core')
    vi.resetModules()
  })

  // The measurer is set on the zrender the renderer resolves; ECharts
  // measures through the one it resolves. A host's install that nests a
  // second copy would lay every word out in widths nobody chose, unseen:
  // the drawing refuses to lay a chart out through an ECharts whose
  // zrender is not the renderer's, before it measures anything.
  test(
    'refuses to lay a chart out through an ECharts that measures through another zrender',
    async () => {
      vi.resetModules()
      vi.doMock('echarts/core', async (importOriginal) => ({ ...(await importOriginal<typeof import('echarts/core')>()), setPlatformAPI: () => undefined }))
      const { drawChart: fresh } = await import('./chart-draw.js')
      let caught: unknown
      try {
        fresh(BARS, FACES, WIDTHS)
      } catch (error) {
        caught = error
      }
      // The module imported afresh refuses with its own runtime's class, which is not this file's.
      expect(caught).toMatchObject({
        name: 'RenderRefusal',
        code: 'unsupported',
        subject: BARS.id,
        message:
          'the chart bars, 300 by 240 points, cannot be laid out: ECharts measures through another copy of zrender than the one the renderer measures it with',
      })
    },
    TIMEOUT,
  )
})
