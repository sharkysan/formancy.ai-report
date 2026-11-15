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
 * - **Numbers.** The value axis is the runtime's ticks, fixed, in places:
 *   tick i stands at place i, from 0 at the lowest to the last index at
 *   the highest, each a gridline, and every `tickEvery`-th from the lowest
 *   labelled. A value stands at its distance from the lowest tick in the
 *   ticks' interval (`placesOf`), worked out from the runtime's decimal
 *   strings exactly but for the one division that makes it a coordinate,
 *   and a bar stands on zero's place. ECharts never sees a value, so it
 *   neither rounds nor formats one, and places each mark where its value
 *   stands among the ticks, however close the ticks stand for their size:
 *   the values' doubles would put ticks that share fifteen leading digits
 *   up to half an interval from their places, and draw two ticks that
 *   share seventeen as one. This is what the drawing's fixed value axis
 *   is: the runtime's ticks by their places, never their doubles; and
 *   every number ECharts is handed is a place, or a slice's share of its
 *   pie worked out the same way, or `NO_SHARE` for a slice of none, never
 *   `Number(exact)`. Every word it prints is the runtime's, looked up by
 *   index.
 * - **Words.** ECharts sees a category as its key (`c0`) and a series as
 *   its (`s0`). Every word comes from a formatter -- the chart's title and
 *   its axes' titles from the block itself -- and a formatter asked for an
 *   index, a key or a place the block does not have throws, naming the
 *   chart and counts and quoting no word. Every word is the one pdfmake
 *   prints, trimmed as pdfmake trims a run (`chartText`), for ECharts and
 *   for the words a layout prints alike. Nothing wraps, cuts, hides,
 *   turns or reads a word as markup: no text width, overflow, ellipsis,
 *   rich text, string formatter, rotation, hideOverlap or automatic
 *   interval, and no showMinLabel or showMaxLabel, which set either way
 *   hide a label that meets its neighbour, where unset with a fixed axis
 *   and every category labelled ECharts hides none (AxisBuilder.js
 *   `fixMinMaxLabelShow`).
 * - **Colours.** Every colour it paints is the block's -- each series' or
 *   slice's and each legend entry's -- the grid's or the axis's, the
 *   words' style's, or transparent; none is left to ECharts' theme.
 * - **Styles.** Every word in its face's font (`chart-faces.ts`), the
 *   title's or the words', colour included.
 *
 * What it paints, which 0058 states and the corpus reads: bars, slices
 * and line markers filled in their colour, each with no border, and
 * nothing of a slice of no share (`NO_SHARE`); lines, gridlines and the
 * category axis's line stroked, that line a horizontal stroke in the
 * axis's colour beside the gridlines; legend swatches filled and stroked
 * in their colour, a slice of no share's among them; nothing else -- no
 * tick, no value axis line, no background, and no border or background on
 * the title or the legend.
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

/** Points: how far a value's label stands from its bar's end or its line's point, ECharts' own default, stated, since the room kept for a label holds it too. */
export const VALUE_LABEL_DISTANCE = 5

/** Points: how far the category labels stand under the plot's foot, ECharts' own default, stated, since a bar below zero labelled under its end widens it. */
export const CATEGORY_LABEL_MARGIN = 8

/** Points: how far a chart's title stands below its box's top, ECharts' own default padding, stated, since an empty chart's title, which the renderer places, stands there too (`chart-empty.ts`). */
export const TITLE_PADDING = 5

/** Whether `value` is below zero, the one test of it the option and the check make: a bar of it stands down from zero, labelled under its end, and a slice of it is refused (`check-chart.ts`). */
export const belowZero = (value: ChartValue): boolean => value.exact.startsWith('-')

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
  /** Set by the first layout: the title's band at the top, with a value label's line and its distance from its mark where values are labelled; the legend's rows at the foot. */
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

/** The ticks a layout labels, every `tickEvery`-th from the lowest, each with its index among all the chart's ticks, which is its place on the axis. */
function labelledTicks(chart: AxisChart, tickEvery: number): { readonly index: number; readonly tick: ChartValue }[] {
  if (!Number.isInteger(tickEvery) || tickEvery < 1) throw new Error(`the chart ${chart.id} cannot label every ${String(tickEvery)}th tick`)
  return chart.ticks.flatMap((tick, index) => (index % tickEvery === 0 ? [{ index, tick }] : []))
}

/**
 * A control character -- Unicode's general category Cc, which holds the
 * tab and every line break but two -- or one of those two, the line and
 * paragraph separators U+2028 and U+2029. zrender 6.1.0 splits a word into lines at a line
 * feed alone (`parseText.js`), and pdfmake's `noWrap` keeps a run whole,
 * as one word (`TextBreaker.js`); but pdfmake prints a tab four spaces
 * wide, and any other control character as its face's glyph for it --
 * Roboto's for U+0000 and U+0002 is empty -- while the PDF's text and
 * ECharts' SVG hold the character itself. Refusing the whole set is
 * fail-closed: wider than the characters either engine was read to break
 * a line at, so that a chart's word prints as it is written or not at all.
 */
const CONTROL = /[\p{Cc}\u2028\u2029]/u

/**
 * `text`, a word of the chart `id`, as the chart prints it: trimmed of the
 * whitespace pdfmake cuts from either end of a run it prints, JavaScript's
 * `\s`, the no-break spaces U+00A0 and U+202F among it, so that ECharts
 * measures and places the very word pdfmake prints (`FaceWidths.width`),
 * which may be empty. A word holding a control character (`CONTROL`) is
 * refused, naming the chart and quoting nothing: it would print otherwise
 * than it is written. So is one that is not text, which pdfmake would read
 * as inlines, a link among them, or neither could print.
 */
export function chartText(text: unknown, id: string): string {
  if (typeof text !== 'string') throw new RenderRefusal('unsupported', `the chart ${id} has a word that is not text`, id)
  if (CONTROL.test(text))
    throw new RenderRefusal(
      'unsupported',
      `the chart ${id} has a word with a tab, a line break or another control character in it, which a chart never prints`,
      id,
    )
  return text.trim()
}

/** A word the chart `id` may hold or not -- its title, an axis's, its empty text -- as it prints (`chartText`), '' where it holds none: a word that prints nothing asks for no face. */
export const wordOf = (text: string | undefined, id: string): string => (text === undefined ? '' : chartText(text, id))

/**
 * Every word `chart` may print, in the order listed at `ChartWord.key`;
 * with a layout's `tickEvery`, the words that layout prints, its ticks
 * every `tickEvery`-th from the lowest. A value prints only where the
 * chart labels its values and it has one. Each word is as the chart
 * prints it (`chartText`), and a word empty once trimmed is no word: it
 * prints nothing, so nothing could prove it printed, and its slot -- a
 * category's, a legend entry's -- stays.
 */
export function chartWords(chart: Chart, layout?: Pick<ChartLayout, 'tickEvery'>): ChartWord[] {
  const words: ChartWord[] = []
  const push = (key: string, word: string, title = false): void => {
    if (word !== '') words.push({ key, text: word, title })
  }
  const add = (key: string, text: unknown): void => {
    push(key, chartText(text, chart.id))
  }
  push('title', wordOf(chart.title, chart.id), true)
  if (chart.chart !== 'pie') {
    push('categoryTitle', wordOf(chart.categoryTitle, chart.id))
    push('valueTitle', wordOf(chart.valueTitle, chart.id))
    chart.categories.forEach((text, index) => {
      add(`category/${String(index)}`, text)
    })
    for (const { index, tick } of labelledTicks(chart, layout?.tickEvery ?? 1)) add(`tick/${String(index)}`, tick.text)
    if (chart.valueLabels)
      chart.series.forEach(({ values }, series) => {
        values.forEach((each, index) => {
          if (each !== null) add(`value/${String(series)}/${String(index)}`, each.text)
        })
      })
  }
  chart.legend.forEach(({ text }, index) => {
    add(`legend/${String(index)}`, text)
  })
  push('empty', wordOf(chart.empty, chart.id))
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

/** The chart's title, at the top, `TITLE_PADDING` below it, centred, in the title's face, with no border or background; or none where it has none, or one that is empty once trimmed. */
function titleOf(chart: Chart, faces: ChartFaces): Pick<ChartOption, 'title'> {
  const text = wordOf(chart.title, chart.id)
  if (text === '') return {}
  if (faces.title === undefined) throw new Error(`the chart ${chart.id} has a title and no face to print it in`)
  return {
    title: {
      text,
      left: 'center',
      top: 0,
      padding: TITLE_PADDING,
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
        return chartText(nth(chart.legend, index, 'legend entry', chart.id).text, chart.id)
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

/** A decimal as the runtime writes one (`ChartValue.exact`): its units, and how many of its digits are places. */
interface Exact {
  readonly units: bigint
  readonly scale: number
}

/** `exact` read as the runtime writes a decimal -- a minus or none, digits, and a point and digits or none -- or undefined for anything else, which a chart's check refuses before it is laid out (`check-chart.ts`). */
export function exactOf(exact: unknown): Exact | undefined {
  const match = typeof exact === 'string' ? /^(-?)(\d+)(?:\.(\d+))?$/.exec(exact) : null
  if (match === null) return undefined
  const [, sign = '', whole = '', fraction = ''] = match
  const units = BigInt(whole + fraction)
  return { units: sign === '-' ? -units : units, scale: fraction.length }
}

/** `exact`, a value of the chart `id`, read as a decimal; one that is not is an invariant of the renderer's, since the chart's check refuses it first. */
function decimalOf(exact: string, id: string): Exact {
  const read = exactOf(exact)
  if (read === undefined) throw new Error(`the chart ${id} holds a value that is not a decimal, which its check refuses before it is laid out`)
  return read
}

/** `each`'s units at `scale`, as many places as its own or more. */
const unitsAt = (each: Exact, scale: number): bigint => each.units * 10n ** BigInt(scale - each.scale)

/**
 * The places a quotient of decimals is worked out to before it is made a
 * double: a value's place on the value axis, a slice's share of its pie.
 * Seventeen, because a double holds about 15.9 significant digits: a
 * place on an axis of the runtime's few intervals, or a share, is a
 * quotient below ten, which to seventeen places keeps every digit a
 * double can hold of it, so that `Number`'s rounding is the only one that
 * shows, and tick i's place is i exactly. Cut to three, a value a
 * ten-thousandth of an interval below a tick would stand at the tick, on
 * a plot as tall as an A4 page 0.76 points from its place
 * (`chart-option.test.ts`).
 */
export const QUOTIENT_UNIT = 10n ** 17n

/** `numerator / denominator`, the denominator more than 0, worked out in BigInt to `QUOTIENT_UNIT` and made a double at the end. */
const quotient = (numerator: bigint, denominator: bigint): number => Number((numerator * QUOTIENT_UNIT) / denominator) / Number(QUOTIENT_UNIT)

/**
 * Where a value of `chart` stands on its value axis: its distance from the
 * lowest tick, in the ticks' interval, on the decimals' units -- a
 * `quotient`, made a double at the end. Never a double less a double: a value of 308 digits at 20 places is 328
 * digits of units, which as a double is infinite. The runtime's ticks are
 * two or more, ascending in equal steps, so tick i stands at i; any others
 * are undefined, which the chart's check refuses before it is laid out,
 * as it refuses a value that is no decimal first (`check-chart.ts`).
 */
export function placesOf(chart: AxisChart): ((exact: string) => number) | undefined {
  const [lowest, next] = chart.ticks.map(({ exact }) => decimalOf(exact, chart.id))
  if (lowest === undefined || next === undefined) return undefined
  const scale = Math.max(lowest.scale, next.scale)
  if (unitsAt(next, scale) <= unitsAt(lowest, scale)) return undefined
  const place = (exact: string): number => {
    const value = decimalOf(exact, chart.id)
    const common = Math.max(value.scale, scale)
    const step = unitsAt(next, common) - unitsAt(lowest, common)
    return quotient(unitsAt(value, common) - unitsAt(lowest, common), step)
  }
  return chart.ticks.every(({ exact }, index) => place(exact) === index) ? place : undefined
}

/**
 * A bar or a line chart's plot, axes and series. The category axis stands
 * at the plot's foot -- which on an axis of places is zero's place for
 * ECharts, so that its own `onZero` would stand it there too; `onZero` is
 * off all the same, so that no value axis ever moves it into the plot --
 * with a slot for each category, a line's as a bar's (`boundaryGap`). Its
 * labels stand `CATEGORY_LABEL_MARGIN` under the foot, and a value
 * label's line and its distance further where a labelled bar is below
 * zero, so that its label stands between them and the foot, and ECharts
 * fits that room with them; its title is centred under its labels, where
 * ECharts moves it clear of them. The value axis is the runtime's ticks
 * at their places (`placesOf`), its title at its end, across. Neither axis
 * has a tick, and the value axis no line, which is ECharts' own for a
 * value axis.
 */
function axesOf(chart: AxisChart, words: ChartFace, layout: ChartLayout): Pick<ChartOption, 'grid' | 'xAxis' | 'yAxis' | 'series'> {
  const place = placesOf(chart)
  if (place === undefined) throw new Error(`the chart ${chart.id} has ticks that do not ascend evenly, which its check refuses before it is laid out`)
  const labelled = labelledTicks(chart, layout.tickEvery)
  const [categoryTitle, valueTitle] = [wordOf(chart.categoryTitle, chart.id), wordOf(chart.valueTitle, chart.id)]
  const under = chart.chart === 'bar' && chart.valueLabels && chart.series.some(({ values }) => values.some((each) => each !== null && belowZero(each)))
  return {
    grid: gridOf(layout),
    xAxis: {
      type: 'category',
      data: chart.categories.map((_, index) => categoryKey(index)),
      boundaryGap: true,
      ...(categoryTitle === '' ? {} : { name: categoryTitle, nameLocation: 'middle', nameTextStyle: { ...words.font } }),
      axisTick: { show: false },
      axisLine: { show: true, onZero: false, lineStyle: { color: AXIS.color, width: AXIS.width } },
      axisLabel: {
        interval: 0,
        margin: CATEGORY_LABEL_MARGIN + (under ? words.line + VALUE_LABEL_DISTANCE : 0),
        ...words.font,
        formatter: (key: string, index: number) => {
          const text = nth(chart.categories, index, 'category', chart.id)
          if (key !== categoryKey(index)) throw new Error(`the chart ${chart.id} was asked for category ${String(index)} by another category's key`)
          return chartText(text, chart.id)
        },
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: chart.ticks.length - 1,
      // ECharts draws a bar from its axis's start value, which unless it is told another is 0, the lowest tick's place: a bar stands on zero's.
      ...(chart.chart === 'bar' ? { startValue: place('0') } : {}),
      ...(valueTitle === '' ? {} : { name: valueTitle, nameLocation: 'end', nameTextStyle: { ...words.font } }),
      axisTick: { show: false, customValues: chart.ticks.map((_, index) => index) },
      splitLine: { show: true, lineStyle: { color: GRID.color, width: GRID.width } },
      axisLabel: {
        customValues: labelled.map(({ index }) => index),
        ...words.font,
        formatter: (placed: number, index: number) => {
          const { index: tickPlace, tick } = nth(labelled, index, 'labelled tick', chart.id)
          if (placed !== tickPlace) throw new Error(`the chart ${chart.id} was asked for labelled tick ${String(index)} at another place`)
          return chartText(tick.text, chart.id)
        },
      },
    },
    series: chart.series.map((series, index) =>
      chart.chart === 'bar' ? barSeries(chart, series, index, words, place) : lineSeries(chart, series, index, words, place),
    ),
  }
}

/** One series of bars, each at its value's place: filled in its colour with no border, its value's label above its end, below it for a bar below zero. */
function barSeries(chart: AxisChart, { color, values }: ChartSeriesValues, index: number, words: ChartFace, place: (exact: string) => number): BarSeriesOption {
  return {
    type: 'bar',
    name: seriesKey(index),
    data: values.map((each) => {
      if (each === null) return null
      const at = place(each.exact)
      return chart.valueLabels && belowZero(each) ? { value: at, label: { position: 'bottom' } } : at
    }),
    barCategoryGap: `${String(BAR_CATEGORY_GAP * 100)}%`,
    barGap: `${String(BAR_GAP * 100)}%`,
    itemStyle: { color, borderWidth: 0 },
    label: valueLabel(chart, values, index, words),
  }
}

/**
 * One line: stroked in its colour, broken where it has no value, each
 * value a marker at its place, filled in its colour with no border, its
 * label above it. Every category is labelled, so ECharts hides no marker
 * (LineView.js `getIsIgnoreFunc`).
 */
function lineSeries(
  chart: AxisChart,
  { color, values }: ChartSeriesValues,
  index: number,
  words: ChartFace,
  place: (exact: string) => number,
): LineSeriesOption {
  return {
    type: 'line',
    name: seriesKey(index),
    data: values.map((each) => (each === null ? null : place(each.exact))),
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
    distance: VALUE_LABEL_DISTANCE,
    ...words.font,
    formatter: ({ dataIndex }: { readonly dataIndex: number }) => {
      const each = nth(values, dataIndex, 'value', chart.id)
      if (each === null) throw new Error(`the chart ${chart.id} was asked to label value ${String(dataIndex)} of series ${String(series)}, which has none`)
      return chartText(each.text, chart.id)
    },
  }
}

/**
 * Each slice's share of `chart`'s total, worked out from the runtime's
 * decimals as a place is (`quotient`): ECharts sizes a slice by its
 * value's share of the sum it is handed, and as doubles the slices of the
 * largest values sum past the largest double, to infinity, which would
 * leave every slice nothing. A pie whose slices sum to nothing holds its
 * empty text, never slices: any other has no shares, undefined, which the
 * chart's check refuses before it is laid out (`check-chart.ts`).
 */
export function sharesOf(chart: PieChart): { readonly color: string; readonly share: number }[] | undefined {
  const slices = chart.slices.map(({ color, value }) => ({ color, value: decimalOf(value.exact, chart.id) }))
  const scale = Math.max(...slices.map(({ value }) => value.scale))
  const total = slices.reduce((sum, { value }) => sum + unitsAt(value, scale), 0n)
  if (total <= 0n) return undefined
  return slices.map(({ color, value }) => ({ color, share: quotient(unitsAt(value, scale), total) }))
}

/**
 * What ECharts is handed for a slice of no share -- a zero, or a value
 * under one part in `QUOTIENT_UNIT` of its pie's total, whose `quotient`
 * is 0 -- in place of that share: a value below zero, which ECharts 6.1.0
 * leaves out of the pie's data before it lays the pie out
 * (processor/negativeDataFilter.js, which chart/pie/install.js registers),
 * so that it draws nothing of the slice; while the legend names each entry
 * the series' data holds before any is left out
 * (visual/LegendVisualProvider.js `containName`, of the raw data), so that
 * the slice's entry prints, its swatch in its colour. Of a share of 0,
 * ECharts draws a sector of no sweep, a path in the slice's colour from
 * the pie's centre to its rim, which may print as a hairline; of a value
 * it reads as missing, '-' or null, a path with no outline in zrender's
 * default black, a colour the drawing refuses as one the option did not
 * name (`chart-svg.ts`); and of a slice left out of the option's data, no
 * legend entry, its words printed nowhere. Never a share: the chart's
 * check refuses a slice below zero before it is laid out (`check-chart.ts`).
 */
const NO_SHARE = -1

/** A pie's circle: its centre, in points from the chart's top left, and its radius. */
export interface PieCircle {
  readonly centre: readonly [number, number]
  readonly radius: number
}

/**
 * The circle a pie is drawn on in `square`, the drawing's: its middle, and
 * half its side. ECharts is handed it, and the drawing writes the pie's
 * arcs again on it (`chart-arcs.ts`).
 */
export function pieCircle(square: NonNullable<ChartLayout['plot']>): PieCircle {
  return { centre: [square.left + square.width / 2, square.top + square.height / 2], radius: Math.min(square.width, square.height) / 2 }
}

/**
 * A pie: a slice for each category, its share of the pie's total, from
 * noon and clockwise, each filled in its colour with no border and no
 * label or label line -- its words print in the legend alone -- and a
 * slice of no share drawn as nothing (`NO_SHARE`), in the square the
 * drawing gives it, once it has: until then, where ECharts puts it, since
 * the first layout is read for its title and its legend alone.
 */
function pieSeries(chart: PieChart, { plot }: ChartLayout): PieSeries {
  const shares = sharesOf(chart)
  if (shares === undefined) throw new Error(`the chart ${chart.id} has slices that sum to nothing, which its check refuses before it is laid out`)
  const circle = plot === undefined ? undefined : pieCircle(plot)
  return {
    type: 'pie',
    ...(circle === undefined ? {} : { center: [...circle.centre], radius: circle.radius }),
    startAngle: 90,
    clockwise: true,
    label: { show: false },
    labelLine: { show: false },
    labelLayout: null,
    itemStyle: { borderWidth: 0 },
    data: shares.map(({ color, share }, index) => ({ name: categoryKey(index), value: share === 0 ? NO_SHARE : share, itemStyle: { color, borderWidth: 0 } })),
  }
}

/** The `index`th of `entries`, which ECharts asked a formatter of the chart `id` for: an index the chart does not have is refused, naming what was asked and how many there are. */
function nth<T>(entries: readonly T[], index: number, what: string, id: string): T {
  const entry = Number.isInteger(index) && index >= 0 ? entries[index] : undefined
  if (entry === undefined) throw new Error(`the chart ${id} was asked for ${what} ${String(index)} of ${String(entries.length)}`)
  return entry
}
