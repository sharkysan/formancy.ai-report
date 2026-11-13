import { RenderRefusal, type AxisChart, type Chart, type ChartSeriesValues, type ChartValue, type PieChart } from '@formancy/report-runtime'
import type { BarSeriesOption, LineSeriesOption, PieSeriesOption } from 'echarts/charts'
import type { GridComponentOption, LegendComponentOption, TitleComponentOption } from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
import type { ChartFace, ChartFaces } from './chart-faces.js'

/**
 * The option ECharts is handed for a chart (0058): ECharts lays the chart
 * out and draws its marks, and pdfmake prints each of its words where
 * ECharts placed it, so the option holds everything ECharts could decide
 * otherwise than the report did, and nothing it could round or rewrite.
 *
 * - **Numbers.** The value axis is the runtime's ticks, fixed: its range
 *   their first and last, a gridline at each, a label at every
 *   `tickEvery`-th from the lowest. ECharts places a mark at its value's
 *   `Number(exact)`, a coordinate, and never formats one: every word it
 *   prints is the runtime's, looked up by index. Ticks so close for their
 *   size that two are one double are refused: ECharts would draw one
 *   gridline and one label for them.
 * - **Words.** ECharts sees a category as its key (`c0`) and a series as
 *   its (`s0`). Every word comes from a formatter -- the chart's title and
 *   its axes' titles from the block itself -- and a formatter asked for an
 *   index, a key or a value the block does not have throws, naming the
 *   chart and counts and quoting no word. Nothing wraps, cuts, hides, turns or reads a word as markup: no
 *   text width, overflow, ellipsis, rich text, string formatter, rotation,
 *   hideOverlap or automatic interval, and no showMinLabel or
 *   showMaxLabel, which set either way hide a label that meets its
 *   neighbour, where unset with a fixed axis and every category labelled
 *   ECharts hides none (AxisBuilder.js `fixMinMaxLabelShow`).
 * - **Colours.** Every colour it paints is the block's -- each series' or
 *   slice's and each legend entry's -- the grid's or the axis's, the
 *   words' style's, or transparent; none is left to ECharts' theme.
 * - **Styles.** Every word in its face's font (`chart-faces.ts`), the
 *   title's or the words', colour included.
 *
 * What it paints, which 0058 states and the corpus reads: bars, slices
 * and line markers filled in their colour, each with no border; lines,
 * gridlines and the category axis's line stroked, that line a horizontal
 * stroke in the axis's colour beside the gridlines; legend swatches
 * filled and stroked in their colour; nothing else -- no tick, no value
 * axis line, no background, and no border or background on the title or
 * the legend.
 *
 * It imports ECharts' types alone, so that a module reading a chart's
 * words loads no ECharts: the drawing, which a document with a chart
 * loads, hands the option over (`chart-draw.ts`).
 */

/** Of a category's slot: the room left between one category's bars and the next's, ECharts' `barCategoryGap`. Chosen, as a table's padding is. */
export const BAR_CATEGORY_GAP = 0.2

/** Of a bar's width: the room between the bars of one category, ECharts' `barGap`. Chosen. */
export const BAR_GAP = 0.25

/** Points: a line's marker's radius, the line's width, and the stroke round a legend's swatch. Chosen. */
export const POINT_RADIUS = 2
export const LINE_WIDTH = 1.5
export const SWATCH_BORDER = 0.5

/** The value axis's gridlines, one at every tick, and the category axis's line: the renderer's, as a table's rules are. Chosen. */
export const GRID = { color: '#d9d9d9', width: 0.5 } as const
export const AXIS = { color: '#000000', width: 0.75 } as const

/** One word a chart may print, by which of its words it is, in the title's face or the words'. */
export interface ChartWord {
  /** 'title', 'categoryTitle', 'valueTitle', 'category/i', 'tick/i', 'value/s/i' (series s, category i), 'legend/j', or an empty chart's 'empty'. */
  readonly key: string
  readonly text: string
  /** Whether it prints in the title's face. */
  readonly title: boolean
}

/** One layout of a chart: the ticks it labels, and, once a layout before it has read them, its bands and its plot. */
export interface ChartLayout {
  /** Every `tickEvery`-th tick from the lowest is labelled, 1 labelling each; every tick is a gridline. */
  readonly tickEvery: number
  /** Set by the first layout: the title's band at the top, with a value label's line where values are labelled; the legend's rows at the foot, with a label's line where a labelled value is negative. */
  readonly bands?: { readonly top: number; readonly bottom: number }
  /** Set by the second: the plot (axis charts) or the pie's square, in points, snapped. */
  readonly plot?: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
}

/**
 * A pie's series as the option holds it: its `labelLayout` null, which
 * ECharts 6.1.0 reads as no layout of its labels and its types do not
 * admit. Its default, `{ hideOverlap: true }`, lays a pie's hidden slice
 * labels out in zrender's own 12px sans-serif, which the measurer refuses
 * (`echarts.test.ts`).
 */
type PieSeries = Omit<PieSeriesOption, 'labelLayout'> & { labelLayout: null }

export type ChartOption = ComposeOption<BarSeriesOption | LineSeriesOption | PieSeries | GridComponentOption | LegendComponentOption | TitleComponentOption>

/** A bar's width in a slot `slot` points wide, of `series` bars, as ECharts 6.1.0 lays it out by `BAR_CATEGORY_GAP` and `BAR_GAP` (layout/barGrid.js). */
export function barWidth(slot: number, series: number): number {
  return (slot * (1 - BAR_CATEGORY_GAP)) / (series + (series - 1) * BAR_GAP)
}

/** A category's key, which ECharts places it by, and a series' -- or for a pie, its legend's entries, which are its categories. */
const categoryKey = (index: number): string => `c${String(index)}`
const seriesKey = (index: number): string => `s${String(index)}`

/** The ticks a layout labels, every `tickEvery`-th from the lowest, each with its index among all the chart's ticks. */
function labelledTicks(chart: AxisChart, tickEvery: number): { readonly index: number; readonly tick: ChartValue }[] {
  if (!Number.isInteger(tickEvery) || tickEvery < 1) throw new Error(`the chart ${chart.id} cannot label every ${String(tickEvery)}th tick`)
  return chart.ticks.flatMap((tick, index) => (index % tickEvery === 0 ? [{ index, tick }] : []))
}

/**
 * Every word `chart` may print, in the order listed at `ChartWord.key`;
 * with a layout's `tickEvery`, the words that layout prints, its ticks
 * every `tickEvery`-th from the lowest. A value prints only where the
 * chart labels its values and it has one, and an empty word is no word:
 * it prints nothing, so nothing could prove it printed, and its slot --
 * a category's, a legend entry's -- stays.
 */
export function chartWords(chart: Chart, layout?: Pick<ChartLayout, 'tickEvery'>): ChartWord[] {
  const words: ChartWord[] = []
  const add = (key: string, text: string | undefined, title = false): void => {
    if (text !== undefined && text !== '') words.push({ key, text, title })
  }
  add('title', chart.title, true)
  if (chart.chart !== 'pie') {
    add('categoryTitle', chart.categoryTitle)
    add('valueTitle', chart.valueTitle)
    chart.categories.forEach((text, index) => {
      add(`category/${String(index)}`, text)
    })
    for (const { index, tick } of labelledTicks(chart, layout?.tickEvery ?? 1)) add(`tick/${String(index)}`, tick.text)
    if (chart.valueLabels)
      chart.series.forEach(({ values }, series) => {
        values.forEach((each, index) => {
          add(`value/${String(series)}/${String(index)}`, each?.text)
        })
      })
  }
  chart.legend.forEach(({ text }, index) => {
    add(`legend/${String(index)}`, text)
  })
  add('empty', chart.empty)
  return words
}

/**
 * What ECharts is handed to lay `chart` out in `layout`, its words in
 * `faces`. A chart with nothing to draw is refused: it prints its title
 * and its empty text, and nothing ECharts would draw.
 */
export function chartOption(chart: Chart, faces: ChartFaces, layout: ChartLayout): ChartOption {
  if (chart.empty !== undefined) throw new Error(`the chart ${chart.id} has nothing to draw, and is printed without a layout`)
  const palette = chart.chart === 'pie' ? chart.slices.map(({ color }) => color) : chart.series.map(({ color }) => color)
  const frame: ChartOption = {
    animation: false,
    backgroundColor: 'transparent',
    color: palette,
    ...titleOf(chart, faces),
    ...legendOf(chart, faces.words),
  }
  return chart.chart === 'pie' ? { ...frame, series: [pieSeries(chart, layout)] } : { ...frame, ...axesOf(chart, faces.words, layout) }
}

/** The chart's title, at the top, centred, in the title's face, with no border or background; or none where it has none. */
function titleOf(chart: Chart, faces: ChartFaces): Pick<ChartOption, 'title'> {
  if (chart.title === undefined) return {}
  if (faces.title === undefined) throw new Error(`the chart ${chart.id} has a title and no face to print it in`)
  return {
    title: {
      text: chart.title,
      left: 'center',
      top: 0,
      textStyle: { ...faces.title.font },
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
    },
  }
}

/**
 * The chart's legend, at the foot, ECharts' plain legend, whose entries
 * wrap into rows: each a square swatch an em wide, filled and stroked in
 * its colour, and its words, looked up by the key of what it names -- a
 * series', or for a pie a category's. None where the chart has no legend.
 */
function legendOf(chart: Chart, words: ChartFace): Pick<ChartOption, 'legend'> {
  if (chart.legend.length === 0) return {}
  const keyOf = chart.chart === 'pie' ? categoryKey : seriesKey
  const keys = chart.legend.map((_, index) => keyOf(index))
  return {
    legend: {
      bottom: 0,
      icon: 'rect',
      itemWidth: words.size,
      itemHeight: words.size,
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      textStyle: { ...words.font },
      data: chart.legend.map(({ color }, index) => ({ name: keyOf(index), itemStyle: { color, borderColor: color, borderWidth: SWATCH_BORDER } })),
      formatter: (name: string) => {
        const index = keys.indexOf(name)
        if (index < 0) throw new Error(`the chart ${chart.id} was asked for a legend entry by a key it does not have, of ${String(keys.length)}`)
        return nth(chart.legend, index, 'legend entry', chart.id).text
      },
    },
  }
}

/** The plot: between the bands, or the whole box, which ECharts shrinks until its axes' words fit inside; once the drawing has snapped it, exactly where it stands. */
function gridOf({ bands, plot }: ChartLayout): GridComponentOption {
  if (plot !== undefined) return { left: plot.left, top: plot.top, width: plot.width, height: plot.height, outerBoundsMode: 'none' }
  const { top, bottom } = bands ?? { top: 0, bottom: 0 }
  return { left: 0, right: 0, top, bottom, outerBoundsMode: 'same', outerBoundsContain: 'all' }
}

/**
 * A bar or a line chart's plot, axes and series. The category axis stands
 * at the plot's foot, never on zero (ECharts' `onZero: 'auto'` would put a
 * line chart's there, its labels inside the plot), with a slot for each
 * category, a line's as a bar's (`boundaryGap`), its title centred under
 * its labels, where ECharts moves it clear of them; the value axis is
 * fixed at the runtime's ticks, its title at its end, across. Neither
 * axis has a tick, and the value axis no line, which is ECharts' own for
 * a value axis.
 */
function axesOf(chart: AxisChart, words: ChartFace, layout: ChartLayout): Pick<ChartOption, 'grid' | 'xAxis' | 'yAxis' | 'series'> {
  const ticks = chart.ticks.map(({ exact }) => Number(exact))
  const [lowest] = ticks
  const highest = ticks.at(-1)
  if (lowest === undefined || highest === undefined || ticks.length < 2)
    throw new Error(`the chart ${chart.id} has ${String(ticks.length)} of the two or more ticks an axis needs`)
  // The ticks ascend exactly, and Number keeps their order, rounding each to its nearest double: two that do not stand apart are one double.
  const places = new Set(ticks).size
  if (places < ticks.length)
    throw new RenderRefusal(
      'unsupported',
      `the chart ${chart.id} has ${String(ticks.length)} ticks too close for their size to place apart: as coordinates they stand at ${String(places)}`,
      chart.id,
    )
  const labelled = labelledTicks(chart, layout.tickEvery).map(({ tick }) => tick)
  return {
    grid: gridOf(layout),
    xAxis: {
      type: 'category',
      data: chart.categories.map((_, index) => categoryKey(index)),
      boundaryGap: true,
      ...(chart.categoryTitle === undefined ? {} : { name: chart.categoryTitle, nameLocation: 'middle', nameTextStyle: { ...words.font } }),
      axisTick: { show: false },
      axisLine: { show: true, onZero: false, lineStyle: { color: AXIS.color, width: AXIS.width } },
      axisLabel: {
        interval: 0,
        ...words.font,
        formatter: (key: string, index: number) => {
          const text = nth(chart.categories, index, 'category', chart.id)
          if (key !== categoryKey(index)) throw new Error(`the chart ${chart.id} was asked for category ${String(index)} by another category's key`)
          return text
        },
      },
    },
    yAxis: {
      type: 'value',
      min: lowest,
      max: highest,
      ...(chart.valueTitle === undefined ? {} : { name: chart.valueTitle, nameLocation: 'end', nameTextStyle: { ...words.font } }),
      axisTick: { show: false, customValues: ticks },
      splitLine: { show: true, lineStyle: { color: GRID.color, width: GRID.width } },
      axisLabel: {
        customValues: labelled.map(({ exact }) => Number(exact)),
        ...words.font,
        formatter: (at: number, index: number) => {
          const tick = nth(labelled, index, 'labelled tick', chart.id)
          if (at !== Number(tick.exact)) throw new Error(`the chart ${chart.id} was asked for labelled tick ${String(index)} at another value`)
          return tick.text
        },
      },
    },
    series: chart.series.map((series, index) => (chart.chart === 'bar' ? barSeries(chart, series, index, words) : lineSeries(chart, series, index, words))),
  }
}

/** One series of bars: each filled in its colour with no border, its value's label above its end, below it for a bar below zero. */
function barSeries(chart: AxisChart, { color, values }: ChartSeriesValues, index: number, words: ChartFace): BarSeriesOption {
  return {
    type: 'bar',
    name: seriesKey(index),
    data: values.map((each) => {
      if (each === null) return null
      const at = Number(each.exact)
      return chart.valueLabels && each.exact.startsWith('-') ? { value: at, label: { position: 'bottom' } } : at
    }),
    barCategoryGap: `${String(BAR_CATEGORY_GAP * 100)}%`,
    barGap: `${String(BAR_GAP * 100)}%`,
    itemStyle: { color, borderWidth: 0 },
    label: valueLabel(chart, values, index, words),
  }
}

/**
 * One line: stroked in its colour, broken where it has no value, each
 * value a marker filled in its colour with no border, its label above it.
 * Every category is labelled, so ECharts hides no marker (LineView.js
 * `getIsIgnoreFunc`).
 */
function lineSeries(chart: AxisChart, { color, values }: ChartSeriesValues, index: number, words: ChartFace): LineSeriesOption {
  return {
    type: 'line',
    name: seriesKey(index),
    data: values.map((each) => (each === null ? null : Number(each.exact))),
    connectNulls: false,
    symbol: 'circle',
    symbolSize: 2 * POINT_RADIUS,
    lineStyle: { color, width: LINE_WIDTH },
    itemStyle: { color, borderWidth: 0 },
    label: valueLabel(chart, values, index, words),
  }
}

/** A series' value labels: none where the chart labels no value; otherwise above each mark, each its value's text by its index. */
function valueLabel(chart: AxisChart, values: readonly (ChartValue | null)[], series: number, words: ChartFace) {
  if (!chart.valueLabels) return { show: false }
  return {
    show: true,
    position: 'top' as const,
    ...words.font,
    formatter: ({ dataIndex }: { readonly dataIndex: number }) => {
      const each = nth(values, dataIndex, 'value', chart.id)
      if (each === null) throw new Error(`the chart ${chart.id} was asked to label value ${String(dataIndex)} of series ${String(series)}, which has none`)
      return each.text
    },
  }
}

/**
 * A pie: a slice for each category, from noon and clockwise, each filled
 * in its colour with no border and no label or label line -- its words
 * print in the legend alone -- in the square the drawing gives it, once
 * it has: until then, where ECharts puts it, since the first layout is
 * read for its title and its legend alone.
 */
function pieSeries(chart: PieChart, { plot }: ChartLayout): PieSeries {
  return {
    type: 'pie',
    ...(plot === undefined ? {} : { center: [plot.left + plot.width / 2, plot.top + plot.height / 2], radius: Math.min(plot.width, plot.height) / 2 }),
    startAngle: 90,
    clockwise: true,
    label: { show: false },
    labelLine: { show: false },
    labelLayout: null,
    itemStyle: { borderWidth: 0 },
    data: chart.slices.map(({ color, value }, index) => ({ name: categoryKey(index), value: Number(value.exact), itemStyle: { color, borderWidth: 0 } })),
  }
}

/** The `index`th of `entries`, which ECharts asked a formatter of the chart `id` for: an index the chart does not have is refused, naming what was asked and how many there are. */
function nth<T>(entries: readonly T[], index: number, what: string, id: string): T {
  const entry = Number.isInteger(index) && index >= 0 ? entries[index] : undefined
  if (entry === undefined) throw new Error(`the chart ${id} was asked for ${what} ${String(index)} of ${String(entries.length)}`)
  return entry
}
