import { RenderRefusal, type AxisChart, type Chart, type ChartValue, type PieChart } from '@formancy/report-runtime'
import type { EChartsType } from 'echarts/core'
import { describe, expect, test } from 'vitest'
import type { ChartFaces } from './chart-faces.js'
import { withMeasurer } from './chart-measure.js'
import { AXIS, barWidth, chartOption, chartWords, GRID, LINE_WIDTH, POINT_RADIUS, SWATCH_BORDER, type ChartLayout } from './chart-option.js'
import type { FaceWidths } from './engine.js'
import { TIMEOUT } from './testing/documents.js'
import { asked, fontString, layOut, measured, planned, wordsOf, type Asked } from './testing/echarts.js'

/**
 * The option ECharts is handed for a chart (`chart-option.ts`), read as
 * the data it is and laid out as the drawing lays it out: ECharts 6.1.0
 * server-side into an SVG string, its words measured by the render's
 * measurer in the report's faces (`chart-measure.ts`), so that the option
 * these cases hold and the one `echarts.test.ts`'s pins were taken with
 * cannot drift apart.
 *
 * zrender keeps the widths it measured for the life of the process, by
 * font string, and asks a font's words only the first time it meets
 * them: a case that must see what zrender asks measures at a size no case
 * before it in this file lays out.
 */

/** A value the runtime resolved: exactly, and as it prints. */
const value = (exact: string, text = exact): ChartValue => ({ exact, text })

/** The runtime's ticks at `exacts`, each printed at two places. */
const ticksAt = (exacts: readonly string[]): ChartValue[] => exacts.map((exact) => value(exact, Number(exact).toFixed(2)))

/** The colour every block here prints its words in, the axis's being black. */
const INK = '#336699'

/** Two series of bars over three categories: a negative bar, a value missing, every value labelled, a legend of both. */
const BARS: AxisChart = {
  kind: 'chart',
  chart: 'bar',
  id: 'bars',
  width: 300,
  height: 200,
  title: 'Umsatz nach Region',
  categoryTitle: 'Region',
  valueTitle: 'Betrag',
  categories: ['Nord', 'Süd', 'Ost'],
  series: [
    { color: '#1f77b4', values: [value('30', '30.00'), value('-30', '-30.00'), null] },
    { color: '#ff7f0e', values: [value('70', '70.00'), value('45', '45.00'), value('10', '10.00')] },
  ],
  ticks: ticksAt(['-50', '0', '50', '100']),
  valueLabels: true,
  legend: [
    { text: 'Plan', color: '#1f77b4' },
    { text: 'Ist', color: '#ff7f0e' },
  ],
  style: { color: INK },
}

/** One line over four categories, below zero at one and with no value at another, every value labelled. */
const LINE: AxisChart = {
  kind: 'chart',
  chart: 'line',
  id: 'line',
  width: 300,
  height: 200,
  title: 'Saldo',
  categoryTitle: 'Monat',
  valueTitle: 'CHF',
  categories: ['Jan', 'Feb', 'Mär', 'Apr'],
  series: [{ color: '#2ca02c', values: [value('30', '30.00'), null, value('-30', '-30.00'), value('80', '80.00')] }],
  ticks: ticksAt(['-50', '0', '50', '100']),
  valueLabels: true,
  legend: [],
  style: { color: INK },
}

/** Three slices, each value printed in its legend entry. */
const PIE: PieChart = {
  kind: 'chart',
  chart: 'pie',
  id: 'pie',
  width: 300,
  height: 200,
  title: 'Anteile',
  slices: [
    { color: '#1f77b4', value: value('50', '50.00') },
    { color: '#ff7f0e', value: value('30', '30.00') },
    { color: '#2ca02c', value: value('20', '20.00') },
  ],
  legend: [
    { text: 'Beratung 50.00 (50 %)', color: '#1f77b4' },
    { text: 'Material 30.00 (30 %)', color: '#ff7f0e' },
    { text: 'Reise 20.00 (20 %)', color: '#2ca02c' },
  ],
  style: { color: INK },
}

/** A plot of 200 by 150 points whose top is on a half point and whose height is a whole multiple of three and of five intervals, where every gridline lands on its tick (`echarts.test.ts`). */
const PLOT = { left: 40, top: 20.5, width: 200, height: 150 } as const

/** The drawn layout of a chart in `PLOT`, every tick labelled. */
const DRAWN: ChartLayout = { tickEvery: 1, plot: PLOT }

/** The drawn layout of a pie: a square of 120 points in the middle of its box. */
const SQUARE = { tickEvery: 1, plot: { left: 90, top: 40, width: 120, height: 120 } } as const

/** The drawn layout of `chart`: its square for a pie, `DRAWN` for a bar or a line chart. */
const drawnLayout = (chart: Chart): ChartLayout => (chart.chart === 'pie' ? SQUARE : DRAWN)

/** `chart` and its faces in `style` (the block's own where none is given), measured as a render measures them. */
const facesOf = (chart: Chart, style = chart.style ?? {}) => measured(planned(), style, chart.title)

/**
 * `chart` laid out in `layout` as the drawing lays it out: the option
 * ECharts is handed, the SVG it writes, what `read` reads of it before it
 * is disposed, and what zrender asked its platform for meanwhile.
 */
function drawn<T = undefined>(
  chart: Chart,
  { faces, widths }: { readonly faces: ChartFaces; readonly widths: FaceWidths },
  layout: ChartLayout,
  read?: (laid: EChartsType) => T,
): { readonly svg: string; readonly read: T | undefined; readonly asked: Asked } {
  const option = chartOption(chart, faces, layout)
  const { result, asked: record } = withMeasurer(faces, widths, () => asked(() => layOut(option, chart.width, chart.height, read)))
  return { svg: result.svg, read: result.read, asked: record }
}

/** What `from` holds at `path`, an object's key or an array's index at each step, read as data. */
function at(from: unknown, ...path: readonly (string | number)[]): unknown {
  return path.reduce<unknown>(
    (reached, key) => (typeof reached === 'object' && reached !== null ? (reached as Record<string | number, unknown>)[key] : undefined),
    from,
  )
}

/** Whether `formatter` is a function, as every formatter the option holds must be. */
const isFunction = (formatter: unknown): formatter is (...args: unknown[]) => unknown => typeof formatter === 'function'

/** What the formatter at `path` in `option` answers for `args`. */
function format(option: unknown, path: readonly (string | number)[], ...args: unknown[]): unknown {
  const formatter = at(option, ...path)
  if (!isFunction(formatter)) throw new Error(`no formatter at ${path.join('.')}`)
  return formatter(...args)
}

/** What a formatter threw, or what it answered. */
function thrown(run: () => unknown): string {
  try {
    return `answered ${String(run())}`
  } catch (error) {
    return (error as Error).message
  }
}

/** Every property in `option`, however deep: the keys that lead to it, its own key and what it holds. */
function* properties(
  option: unknown,
  path: readonly string[] = [],
): Generator<{ readonly path: readonly string[]; readonly key: string; readonly value: unknown }> {
  if (typeof option !== 'object' || option === null) return
  for (const [key, held] of Object.entries(option)) {
    yield { path, key, value: held }
    yield* properties(held, [...path, key])
  }
}

/** Every word `svg` holds, in the order zrender wrote them. */
const textsOf = (svg: string): string[] => wordsOf(svg).map(({ text }) => text)

/** `words`' texts, in order. */
const sorted = (words: readonly string[]): string[] => [...words].sort()

/** Each gridline's y in `svg`: a horizontal stroke in the grid's colour, at its width. */
const gridlines = (svg: string): number[] =>
  [...svg.matchAll(new RegExp(`<path d="M[\\d.]+ ([\\d.]+)L[\\d.]+ ([\\d.]+)"[^>]*stroke="${GRID.color}" stroke-width="${String(GRID.width)}"`, 'g'))].map(
    ([, y]) => Number(y),
  )

/** The pixel a value stands at, read from the laid-out chart for each of `exacts`. */
const pixels =
  (exacts: readonly string[]) =>
  (laid: EChartsType): number[] =>
    exacts.map((exact) => laid.convertToPixel({ yAxisIndex: 0 }, Number(exact)))

/** One element `svg` paints with, as zrender writes it. */
interface Paint {
  readonly element: string
  readonly fill?: string
  readonly stroke?: string
  readonly strokeWidth?: number
  readonly d?: string
  readonly transform?: string
}

/**
 * What `svg` paints with: the `fill` and `stroke` of every element but a
 * clip path's, which paints nothing (zrender writes its rectangle filled
 * black), the stroke-width each stroke is drawn at, and a path's outline
 * and transform.
 */
function paintsOf(svg: string): Paint[] {
  const outsideClips = svg.replace(/<clipPath[\s\S]*?<\/clipPath>/g, '')
  return [...outsideClips.matchAll(/<(path|rect|text|circle|line|polyline|polygon)\s([^>]*)>/g)].map(([, element = '', attributes = '']) => {
    const attribute = (name: string): string | undefined => new RegExp(`\\s${name}="([^"]*)"`).exec(` ${attributes}`)?.[1]
    const width = attribute('stroke-width')
    const named = (['fill', 'stroke', 'd', 'transform'] as const).flatMap((name) => {
      const held = attribute(name)
      return held === undefined ? [] : [[name, held] as const]
    })
    return { element, ...Object.fromEntries(named), ...(width === undefined ? {} : { strokeWidth: Number(width) }) }
  })
}

/** Whether a fill or a stroke paints: neither none nor transparent, nor a stroke of no width. */
const paints = (colour: string | undefined, width?: number): colour is string =>
  colour !== undefined && colour !== 'none' && colour !== 'transparent' && width !== 0

/** `n` to the thousandth of a point: zrender writes a translation to four places, and ECharts' own coordinates are a division's. */
const thousandths = (n: number): number => Math.round(n * 1000) / 1000

describe('the option ECharts is handed', () => {
  // An axis ECharts chose would be a double's ticks and labels of its
  // own, and the chart could print a number the table does not, or a
  // gridline no tick stands at. The axis is the runtime's ticks, its range
  // their first and last, and ECharts draws a gridline at each of them and
  // at nothing else, each where the axis places its tick -- over the
  // runtime's table of ranges (`chart-ticks.test.ts`) and a 40-digit total
  // -- and ticks no double tells apart are refused, never drawn as one.
  test(
    "hands ECharts the runtime's ticks as the axis, and no other",
    async () => {
      const ranges: readonly (readonly ['bar' | 'line', readonly string[]])[] = [
        ['bar', ['0', '1', '2', '3']],
        ['bar', ['0', '100', '200', '300', '400', '500']],
        ['bar', ['-50', '0', '50', '100']],
        ['bar', ['0', '0.2', '0.4', '0.6', '0.8', '1']],
        ['bar', ['0', '200', '400', '600', '800', '1000']],
        ['line', ['0', '500', '1000', '1500']],
        ['line', ['10.5', '11', '11.5', '12', '12.5']],
        ['bar', ['0', '1']],
        ['line', ['12', '13']],
        ['line', ['10000', '10500', '11000', '11500', '12000']],
        ['bar', ['0', '5000', '10000', '15000']],
        ['bar', ['0', '500000000000000000000000000000000000000', '1000000000000000000000000000000000000000', '1500000000000000000000000000000000000000']],
      ]
      const measuredFaces = await facesOf(BARS)
      for (const [kind, exacts] of ranges) {
        const ticks = exacts.map((exact) => value(exact))
        const highest = exacts.at(-1)!
        const chart: AxisChart = {
          ...BARS,
          chart: kind,
          series: [{ color: '#1f77b4', values: [value(highest), value(exacts[0]!), null] }],
          legend: [],
          ticks,
          valueLabels: false,
        }
        // The plot's height a whole multiple of the intervals, as the drawing snaps it.
        const plot = { ...PLOT, height: (ticks.length - 1) * 30 }
        const option = chartOption(chart, measuredFaces.faces, { tickEvery: 1, plot })
        const numbers = exacts.map(Number)
        expect(at(option, 'yAxis', 'type')).toBe('value')
        expect([at(option, 'yAxis', 'min'), at(option, 'yAxis', 'max')]).toEqual([numbers[0], numbers.at(-1)])
        expect(at(option, 'yAxis', 'axisTick', 'customValues')).toEqual(numbers)
        expect(at(option, 'yAxis', 'axisLabel', 'customValues')).toEqual(numbers)
        const { svg, read } = drawn(chart, measuredFaces, { tickEvery: 1, plot }, pixels(exacts))
        expect(gridlines(svg).map(thousandths), exacts.join(' ')).toEqual(read!.map(thousandths))
        expect(
          textsOf(svg).filter((text) => exacts.includes(text)),
          exacts.join(' '),
        ).toEqual(exacts)
      }
      // Ticks of seventeen whole digits, a twentieth apart, are one double, at which ECharts draws one gridline and one label for five.
      const close = ['12345678901234567.1', '12345678901234567.15', '12345678901234567.2', '12345678901234567.25', '12345678901234567.3']
      const refusal = (() => {
        try {
          chartOption({ ...BARS, chart: 'line', ticks: close.map((exact) => value(exact)) }, measuredFaces.faces, DRAWN)
        } catch (error) {
          if (error instanceof RenderRefusal) return error
        }
        throw new Error('the close ticks were handed to ECharts')
      })()
      expect([refusal.code, refusal.subject, refusal.message]).toEqual([
        'unsupported',
        'bars',
        'the chart bars has 5 ticks too close for their size to place apart: as coordinates they stand at 1',
      ])
      // A single tick is no axis: the runtime never resolves one, and a range of nothing would place every mark at once.
      expect(thrown(() => chartOption({ ...BARS, ticks: ticksAt(['0']) }, measuredFaces.faces, DRAWN))).toBe(
        'the chart bars has 1 of the two or more ticks an axis needs',
      )
    },
    TIMEOUT,
  )

  // Every word ECharts prints is one of the block's, which it never
  // sees but by index -- a category's key, a series' -- so a formatter
  // asked for an index the block does not have would print a word of
  // another chart's, or none. Each answers the block's word at its index,
  // and refuses an index, a key or a value the block does not have, naming
  // the chart and the counts and quoting none of its words; and the words
  // the layout prints are the block's, each once.
  test(
    'looks every printed string up by index, and refuses an index the block does not have',
    async () => {
      const bars = chartOption(BARS, (await facesOf(BARS)).faces, DRAWN)
      const category = ['xAxis', 'axisLabel', 'formatter'] as const
      expect([0, 1, 2].map((index) => format(bars, category, `c${String(index)}`, index))).toEqual(['Nord', 'Süd', 'Ost'])
      expect(thrown(() => format(bars, category, 'c3', 3))).toBe('the chart bars was asked for category 3 of 3')
      expect(thrown(() => format(bars, category, 'c-1', -1))).toBe('the chart bars was asked for category -1 of 3')
      expect(thrown(() => format(bars, category, 'c1', 0.5))).toBe('the chart bars was asked for category 0.5 of 3')
      expect(thrown(() => format(bars, category, 'c1', 0))).toBe("the chart bars was asked for category 0 by another category's key")
      const tick = ['yAxis', 'axisLabel', 'formatter'] as const
      expect([-50, 0, 50, 100].map((number, index) => format(bars, tick, number, index))).toEqual(['-50.00', '0.00', '50.00', '100.00'])
      expect(thrown(() => format(bars, tick, 150, 4))).toBe('the chart bars was asked for labelled tick 4 of 4')
      expect(thrown(() => format(bars, tick, 50, 1))).toBe('the chart bars was asked for labelled tick 1 at another value')
      const legend = ['legend', 'formatter'] as const
      expect([format(bars, legend, 's0'), format(bars, legend, 's1')]).toEqual(['Plan', 'Ist'])
      expect(thrown(() => format(bars, legend, 's2'))).toBe('the chart bars was asked for a legend entry by a key it does not have, of 2')
      expect(thrown(() => format(bars, legend, 'c0'))).toBe('the chart bars was asked for a legend entry by a key it does not have, of 2')
      const label = (series: number) => ['series', series, 'label', 'formatter'] as const
      expect([0, 1, 2].map((dataIndex) => format(bars, label(1), { dataIndex }))).toEqual(['70.00', '45.00', '10.00'])
      expect(thrown(() => format(bars, label(0), { dataIndex: 2 }))).toBe('the chart bars was asked to label value 2 of series 0, which has none')
      expect(thrown(() => format(bars, label(0), { dataIndex: 3 }))).toBe('the chart bars was asked for value 3 of 3')
      const pie = chartOption(PIE, (await facesOf(PIE)).faces, SQUARE)
      expect([0, 1, 2].map((index) => format(pie, legend, `c${String(index)}`))).toEqual(PIE.legend.map(({ text }) => text))
      expect(thrown(() => format(pie, legend, 's0'))).toBe('the chart pie was asked for a legend entry by a key it does not have, of 3')
      expect(at(bars, 'xAxis', 'data')).toEqual(['c0', 'c1', 'c2'])
      expect(at(bars, 'series', 1, 'name')).toBe('s1')
      expect(at(pie, 'series', 0, 'data', 2, 'name')).toBe('c2')
      expect(chartWords(BARS).map(({ key, title }) => `${key}${title ? ' (title)' : ''}`)).toEqual([
        'title (title)',
        'categoryTitle',
        'valueTitle',
        'category/0',
        'category/1',
        'category/2',
        'tick/0',
        'tick/1',
        'tick/2',
        'tick/3',
        'value/0/0',
        'value/0/1',
        'value/1/0',
        'value/1/1',
        'value/1/2',
        'legend/0',
        'legend/1',
      ])
      for (const chart of [BARS, LINE, PIE]) {
        const layout = drawnLayout(chart)
        const { svg } = drawn(chart, await facesOf(chart), layout)
        expect(sorted(textsOf(svg)), chart.id).toEqual(sorted(chartWords(chart, layout).map(({ text }) => text)))
      }
    },
    TIMEOUT,
  )

  // A colour from ECharts' theme would be a colour no report chose --
  // a series' in ECharts' own palette, a slice stroked in its border
  // colour, a word in its text colour. Every colour the option names is
  // the block's, the grid's or the axis's, the words' style's, or
  // transparent; and every fill and stroke ECharts writes is one of them,
  // or none.
  test(
    "names every colour it paints, each the palette's or the renderer's",
    async () => {
      for (const chart of [BARS, LINE, PIE]) {
        const measuredFaces = await facesOf(chart)
        const layout = drawnLayout(chart)
        const option = chartOption(chart, measuredFaces.faces, layout)
        const palette = chart.chart === 'pie' ? chart.slices.map(({ color }) => color) : chart.series.map(({ color }) => color)
        const named = new Set([...palette, ...chart.legend.map(({ color }) => color), GRID.color, AXIS.color, INK, 'transparent'])
        const colours = [...properties(option)].filter(({ key }) => /color$/i.test(key))
        expect(colours.length, chart.id).toBeGreaterThan(0)
        for (const { path, key, value: held } of colours) {
          const each: unknown[] = Array.isArray(held) ? held : [held]
          for (const colour of each) expect(typeof colour === 'string' && named.has(colour), `${[...path, key].join('.')}: ${String(colour)}`).toBe(true)
        }
        expect(at(option, 'color'), chart.id).toEqual(palette)
        const painted = paintsOf(drawn(chart, measuredFaces, layout).svg).flatMap(({ fill, stroke, strokeWidth }) => [
          ...(paints(fill) ? [fill] : []),
          ...(paints(stroke, strokeWidth) ? [stroke] : []),
        ])
        expect(
          painted.filter((colour) => !named.has(colour)),
          chart.id,
        ).toEqual([])
        expect(new Set(painted), chart.id).toEqual(new Set([...palette, ...(chart.chart === 'pie' ? [] : [GRID.color, AXIS.color]), INK]))
      }
    },
    TIMEOUT,
  )

  // Each of these hides, shortens, wraps, turns or rewrites a word
  // without saying so -- a text's width wraps or cuts it,
  // overflow and ellipsis shorten it, hideOverlap and an automatic
  // interval hide it, rich text and a string formatter read it as markup,
  // and showMinLabel and showMaxLabel, set either way, hide a label that
  // meets its neighbour, where unset with a fixed axis ECharts hides none.
  // None is in the option, and every word a crowded chart prints is in
  // what ECharts wrote, whole, however its words meet.
  test(
    'never asks ECharts to wrap, cut, hide or template a word',
    async () => {
      const crowded: AxisChart = {
        ...BARS,
        width: 120,
        height: 60,
        categories: ['Nordwestschweiz', 'Zentralschweiz', 'Ostschweiz'],
        ticks: ticksAt(['-50', '-25', '0', '25', '50', '75', '100']),
      }
      const forbidden = new Set([
        'overflow',
        'ellipsis',
        'hideOverlap',
        'rich',
        'nameTruncate',
        'lineOverflow',
        'rotate',
        'nameRotate',
        'showMinLabel',
        'showMaxLabel',
      ])
      for (const chart of [BARS, LINE, PIE, crowded]) {
        const measuredFaces = await facesOf(chart)
        const layout = chart.chart === 'pie' ? { tickEvery: 1 } : { tickEvery: 1, bands: { top: 12, bottom: 12 } }
        const option = chartOption(chart, measuredFaces.faces, layout)
        const found = [...properties(option)]
        expect(
          found.filter(({ key }) => forbidden.has(key)).map(({ path, key }) => [...path, key].join('.')),
          chart.id,
        ).toEqual([])
        // A width is a line's or the plot's, never a word's.
        expect(
          found.filter(({ path, key }) => key === 'width' && !['lineStyle', 'grid'].includes(path.at(-1) ?? '')).map(({ path }) => path.join('.')),
          chart.id,
        ).toEqual([])
        expect(
          found.filter(({ key }) => key === 'interval').map(({ value: held }) => held),
          chart.id,
        ).toEqual(chart.chart === 'pie' ? [] : [0])
        expect(
          found.filter(({ key, value: held }) => key === 'formatter' && !isFunction(held)).map(({ path }) => path.join('.')),
          chart.id,
        ).toEqual([])
        if (chart.chart === 'pie') expect(at(option, 'series', 0, 'labelLayout')).toBeNull()
        const { svg } = drawn(chart, measuredFaces, layout)
        expect(sorted(textsOf(svg)), chart.id).toEqual(sorted(chartWords(chart).map(({ text }) => text)))
      }
    },
    TIMEOUT,
  )

  // The drawing thins a chart's tick labels where a line and a quarter do
  // not fit between two, never its gridlines: a label at another tick than
  // every k-th from the lowest would print a number off the pattern a
  // reader follows down the axis, and a gridline dropped with its label
  // would leave a value's bar against no line. Every tick is a gridline,
  // every k-th from the lowest is labelled, beside its gridline, and the
  // words the layout prints are those.
  test(
    'labels every k-th tick from the lowest, and draws every gridline',
    async () => {
      const exacts = ['0', '100', '200', '300', '400', '500']
      const chart: AxisChart = {
        ...BARS,
        ticks: ticksAt(exacts),
        series: [{ color: '#1f77b4', values: [value('120', '120.00'), value('480', '480.00'), value('0', '0.00')] }],
        legend: [],
        valueLabels: false,
      }
      const measuredFaces = await facesOf(chart)
      const labelled = { 1: [0, 1, 2, 3, 4, 5], 2: [0, 2, 4], 3: [0, 3], 5: [0, 5] } as const
      for (const [every, indices] of Object.entries(labelled)) {
        const layout = { tickEvery: Number(every), plot: PLOT }
        const option = chartOption(chart, measuredFaces.faces, layout)
        expect(at(option, 'yAxis', 'axisTick', 'customValues'), every).toEqual(exacts.map(Number))
        expect(at(option, 'yAxis', 'axisLabel', 'customValues'), every).toEqual(indices.map((index) => Number(exacts[index])))
        const ticks = chartWords(chart, layout).filter(({ key }) => key.startsWith('tick/'))
        expect(
          ticks.map(({ key }) => key),
          every,
        ).toEqual(indices.map((index) => `tick/${String(index)}`))
        const { svg, read } = drawn(chart, measuredFaces, layout, pixels(exacts))
        expect(gridlines(svg).map(thousandths), every).toEqual(read!.map(thousandths))
        const printed = wordsOf(svg).filter(({ text }) => chart.ticks.some((tick) => tick.text === text))
        expect(
          printed.map(({ text, y }) => [text, thousandths(y)]),
          every,
        ).toEqual(indices.map((index) => [chart.ticks[index]!.text, thousandths(read![index]!)]))
      }
      for (const every of [0, -1, 1.5])
        expect(thrown(() => chartOption(chart, measuredFaces.faces, { tickEvery: every }))).toBe(`the chart bars cannot label every ${String(every)}th tick`)
    },
    TIMEOUT,
  )

  // ECharts 6.1.0's axisLine.onZero 'auto' would put a line chart's
  // category axis, and its labels, on zero inside the plot wherever a
  // value is below it, where the drawing refuses any word but a value's
  // label; and a line's points at the axis's ends, without a boundary
  // gap, would give it slots of another width than a bar chart's. The
  // axis line stands at the plot's foot, its labels below it, each at the
  // middle of its slot, for a line as for bars.
  test(
    "keeps the category axis at the plot's foot",
    async () => {
      for (const chart of [LINE, BARS]) {
        const { svg, read } = drawn(chart, await facesOf(chart), DRAWN, pixels(['-50', '0']))
        const [foot, zero] = read!
        const axisLines = [
          ...svg.matchAll(new RegExp(`<path d="M[\\d.]+ ([\\d.]+)L[\\d.]+ ([\\d.]+)"[^>]*stroke="${AXIS.color}" stroke-width="${String(AXIS.width)}"`, 'g')),
        ]
        expect(
          axisLines.map(([, y]) => Number(y)),
          chart.id,
        ).toEqual([foot])
        expect(foot, chart.id).not.toBe(zero)
        const slot = PLOT.width / chart.categories.length
        const labels = wordsOf(svg).filter(({ text }) => chart.categories.includes(text))
        expect(
          labels.map(({ x }) => thousandths(x)),
          chart.id,
        ).toEqual(chart.categories.map((_, index) => thousandths(PLOT.left + (index + 0.5) * slot)))
        expect(
          labels.every(({ y }) => y > foot!),
          chart.id,
        ).toBe(true)
      }
    },
    TIMEOUT,
  )

  // The paint contract, which 0058 states and the corpus reads: a paint
  // the corpus does not expect -- a tick, the value axis's line, a
  // marker drawn hollow, a line joined across a missing value, a
  // background -- would be read as a mark of the chart's, and a mark it
  // expects and ECharts did not draw would be a value lost. ECharts paints
  // a gridline at each tick and the category axis's line, at their widths;
  // each bar, slice and marker filled in its colour and stroked not at
  // all, a marker a circle of POINT_RADIUS; each line stroked in its
  // colour at LINE_WIDTH, broken where a value is missing; a swatch for
  // each legend entry, a square an em on a side; and, but for the words,
  // nothing else.
  test(
    'paints its marks, its lines and its swatches, and nothing else',
    async () => {
      const expected: Record<string, Record<string, number>> = {
        bars: {
          [`stroke ${GRID.color} ${String(GRID.width)}`]: 4,
          [`stroke ${AXIS.color} ${String(AXIS.width)}`]: 1,
          'fill #1f77b4': 2,
          'fill #ff7f0e': 3,
          [`swatch #1f77b4 ${String(SWATCH_BORDER)}`]: 1,
          [`swatch #ff7f0e ${String(SWATCH_BORDER)}`]: 1,
        },
        line: {
          [`stroke ${GRID.color} ${String(GRID.width)}`]: 4,
          [`stroke ${AXIS.color} ${String(AXIS.width)}`]: 1,
          [`stroke #2ca02c ${String(LINE_WIDTH)}`]: 1,
          'fill #2ca02c': 3,
        },
        pie: {
          'fill #1f77b4': 1,
          'fill #ff7f0e': 1,
          'fill #2ca02c': 1,
          [`swatch #1f77b4 ${String(SWATCH_BORDER)}`]: 1,
          [`swatch #ff7f0e ${String(SWATCH_BORDER)}`]: 1,
          [`swatch #2ca02c ${String(SWATCH_BORDER)}`]: 1,
        },
      }
      for (const chart of [BARS, LINE, PIE]) {
        const layout = drawnLayout(chart)
        const measuredFaces = await facesOf(chart)
        const painted = paintsOf(drawn(chart, measuredFaces, layout).svg).filter(
          ({ element, fill, stroke, strokeWidth }) => element !== 'text' && (paints(fill) || paints(stroke, strokeWidth)),
        )
        const kinds = painted.map(({ fill, stroke, strokeWidth }) => {
          if (paints(fill) && paints(stroke, strokeWidth)) return `swatch ${fill === stroke ? fill : `${fill} ${stroke}`} ${String(strokeWidth)}`
          return paints(fill) ? `fill ${fill}` : `stroke ${String(stroke)} ${String(strokeWidth)}`
        })
        const counted: Record<string, number> = {}
        for (const kind of kinds) counted[kind] = (counted[kind] ?? 0) + 1
        expect(counted, chart.id).toEqual(expected[chart.id])
        const em = String(measuredFaces.faces.words.size)
        expect(
          painted.filter(({ fill, stroke, strokeWidth }) => paints(fill) && paints(stroke, strokeWidth)).map(({ d }) => d),
          chart.id,
        ).toEqual(chart.legend.map(() => `M0 0l${em} 0l0 ${em}l-${em} 0Z`))
        if (chart === LINE) {
          const [line] = painted.filter(({ stroke }) => stroke === '#2ca02c')
          // Two runs of values, 30 alone and -30 to 80: two moves, and one line between the second run's two points.
          expect([...line!.d!.matchAll(/[ML]/g)].map(([command]) => command)).toEqual(['M', 'M', 'L'])
          const markers = painted.filter(({ fill }) => fill === '#2ca02c')
          expect(markers.map(({ transform }) => transform?.startsWith(`matrix(${String(POINT_RADIUS)},0,0,${String(POINT_RADIUS)},`))).toEqual([
            true,
            true,
            true,
          ])
        }
      }
    },
    TIMEOUT,
  )

  // The drawing reads the title's band at the top and the legend's rows at
  // the foot, and keeps a value label's line beyond the plot where a bar
  // below zero is labelled: a legend at the top would stand in the title's band,
  // and a label at a negative bar's base would stand inside the bars above
  // zero, over theirs. The title stands centred above the plot and the
  // legend below it; the category axis's title centred under its labels
  // and the value axis's at its end, above the plot; and each value's
  // label beyond its mark: above a bar of zero or more and above a line's
  // point, below a bar below zero.
  test(
    "places the title at the top, the legend at the foot, the axes' titles by their axes, and each value's label beyond its mark",
    async () => {
      for (const chart of [BARS, LINE]) {
        const values = chart.series.flatMap(({ values: each }) => each.flatMap((held) => (held === null ? [] : [held])))
        const { svg, read } = drawn(chart, await facesOf(chart), DRAWN, pixels(values.map(({ exact }) => exact)))
        const words = wordsOf(svg)
        const word = (text: string) => words.find((each) => each.text === text)!
        const foot = PLOT.top + PLOT.height
        expect([word(chart.title!).x, word(chart.title!).y < PLOT.top], chart.id).toEqual([chart.width / 2, true])
        expect(
          chart.legend.map(({ text }) => word(text).y > foot),
          chart.id,
        ).toEqual(chart.legend.map(() => true))
        const lowestLabel = Math.max(...chart.categories.map((text) => word(text).y))
        expect([thousandths(word(chart.categoryTitle!).x), word(chart.categoryTitle!).y > lowestLabel], chart.id).toEqual([PLOT.left + PLOT.width / 2, true])
        expect([word(chart.valueTitle!).x, word(chart.valueTitle!).y < PLOT.top], chart.id).toEqual([PLOT.left, true])
        const beyond = values.map(({ exact, text }, index) => {
          const below = chart.chart === 'bar' && exact.startsWith('-')
          return below ? word(text).y > read![index]! : word(text).y < read![index]!
        })
        expect(beyond, chart.id).toEqual(values.map(() => true))
      }
      const pie = wordsOf(drawn(PIE, await facesOf(PIE), SQUARE).svg)
      const { top, height } = SQUARE.plot
      expect(pie.map(({ text, y }) => (text === PIE.title ? y < top : y > top + height))).toEqual(pie.map(() => true))
    },
    TIMEOUT,
  )

  // ECharts strokes a pie's slices in a border colour of its theme by
  // default, and leaves a bar's and a marker's border, and a word's
  // colour, to its own: the corpus reads a filled and stroked shape as a
  // legend's swatch, and a word in a colour the report did not choose as
  // printed otherwise than asked. Nothing it fills is stroked but a
  // swatch, in its own colour at SWATCH_BORDER; the title and the legend
  // have no border or background; and every word is in the style's colour.
  test(
    'borders nothing it fills, and colours every word',
    async () => {
      for (const chart of [BARS, LINE, PIE]) {
        const measuredFaces = await facesOf(chart)
        const layout = drawnLayout(chart)
        const option = chartOption(chart, measuredFaces.faces, layout)
        const found = [...properties(option)]
        const items = found.filter(({ key }) => key === 'itemStyle')
        expect(
          items.filter(({ path }) => path[0] !== 'legend').map(({ value: held }) => at(held, 'borderWidth')),
          chart.id,
        ).toEqual(items.filter(({ path }) => path[0] !== 'legend').map(() => 0))
        expect(at(option, 'legend', 'data'), chart.id).toEqual(
          chart.legend.length === 0
            ? undefined
            : chart.legend.map(({ color }, index) => ({
                name: `${chart.chart === 'pie' ? 'c' : 's'}${String(index)}`,
                itemStyle: { color, borderColor: color, borderWidth: SWATCH_BORDER },
              })),
        )
        for (const component of ['title', ...(chart.legend.length === 0 ? [] : ['legend'])]) {
          expect(
            ['borderWidth', 'borderColor', 'backgroundColor'].map((key) => at(option, component, key)),
            `${chart.id} ${component}`,
          ).toEqual([0, 'transparent', 'transparent'])
        }
        const styles = found.filter(({ value: held }) => at(held, 'fontFamily') !== undefined)
        expect(styles.length, chart.id).toBeGreaterThan(0)
        expect(
          styles.filter(({ value: held }) => at(held, 'color') !== INK).map(({ path, key }) => [...path, key].join('.')),
          chart.id,
        ).toEqual([])
        const drawing = paintsOf(drawn(chart, measuredFaces, layout).svg)
        const filledAndStroked = drawing.filter(({ fill, stroke, strokeWidth }) => paints(fill) && paints(stroke, strokeWidth))
        expect(
          filledAndStroked.map(({ fill, stroke, strokeWidth }) => [fill, stroke, strokeWidth]),
          chart.id,
        ).toEqual(chart.legend.map(({ color }) => [color, color, SWATCH_BORDER]))
        expect(
          drawing.filter(({ element }) => element === 'text').map(({ fill, stroke }) => [fill, stroke]),
          chart.id,
        ).toEqual(chartWords(chart, layout).map(() => [INK, undefined]))
      }
    },
    TIMEOUT,
  )

  // The measurer's pins (`echarts.test.ts`) were taken with options of
  // their own, shaped as this one is described: were the option to ask
  // for a font it was not handed, cut a word into characters or ask for
  // a canvas, every measure after would be one nobody pinned. Laid out
  // through the measurer, each kind is measured in the title's face and
  // the words' alone, word by word and whole, every word it prints
  // measured, and with no canvas and no image -- in Roboto at 6.5 pt, a
  // size no case before this one lays out, so that zrender asks.
  test(
    'is measured in the faces handed over alone, each word whole, and asks for no canvas or image',
    async () => {
      const probes = new Set(['国', 'a'])
      const asks: Asked[] = []
      const printed = new Set<string>()
      for (const chart of [BARS, LINE, PIE]) {
        const measuredFaces = await facesOf(chart, { size: 6.5, color: INK })
        const layout = drawnLayout(chart)
        asks.push(drawn(chart, measuredFaces, layout).asked)
        for (const { text } of chartWords(chart, layout)) printed.add(text)
        const fonts = new Set(asks.at(-1)!.measures.map(([, font]) => font))
        expect(fonts, chart.id).toEqual(new Set([fontString(measuredFaces.faces.title!), fontString(measuredFaces.faces.words)]))
      }
      const measures = asks.flatMap(({ measures: each }) => each.map(([text]) => text))
      expect(new Set(measures.filter((text) => !probes.has(text)))).toEqual(printed)
      expect(asks.map(({ canvases, images }) => [canvases, images])).toEqual([
        [0, 0],
        [0, 0],
        [0, 0],
      ])
    },
    TIMEOUT,
  )

  // ECharts' own grid -- 15 % at the left, 65 points at the top, 80 at
  // the foot -- leaves a chart of a hundred points almost no plot,
  // and where it shrinks a plot to fit its words it puts the plot where no
  // gridline lands on its tick. Until the drawing knows the plot, ECharts
  // fits the plot and its axes' words between the bands the title and the
  // legend take; once it does, the plot stands exactly where the drawing
  // snapped it, and a pie fills the square the drawing gives it.
  test(
    'lays the plot out in the bands, or exactly where the layout puts it, and a pie in its square',
    async () => {
      const measuredFaces = await facesOf(BARS)
      const corners = (laid: EChartsType): number[] => [
        laid.convertToPixel({ yAxisIndex: 0 }, -50),
        laid.convertToPixel({ yAxisIndex: 0 }, 100),
        laid.convertToPixel({ xAxisIndex: 0 }, 'c0'),
      ]
      const placed = drawn(BARS, measuredFaces, DRAWN, corners).read!
      expect(placed.map(thousandths)).toEqual([PLOT.top + PLOT.height, PLOT.top, thousandths(PLOT.left + PLOT.width / 6)])
      const { line } = measuredFaces.faces.words
      const axisWords = new Set([BARS.categoryTitle, BARS.valueTitle, ...BARS.categories, ...BARS.ticks.map(({ text }) => text)])
      // The bands at the top and at the foot, and none: the plot between them, and every word of its axes too.
      for (const { top, bottom } of [
        { top: 30, bottom: 40 },
        { top: 0, bottom: 0 },
      ]) {
        const layout: ChartLayout = top === 0 ? { tickEvery: 1 } : { tickEvery: 1, bands: { top, bottom } }
        const banded = drawn(BARS, measuredFaces, layout, corners)
        const [foot, plotTop] = banded.read!
        expect(plotTop).toBeGreaterThanOrEqual(top)
        expect(foot).toBeLessThanOrEqual(BARS.height - bottom)
        const outside = wordsOf(banded.svg).filter(
          ({ text, y }) => axisWords.has(text) && (y - line / 2 < top - 0.001 || y + line / 2 > BARS.height - bottom + 0.001),
        )
        expect(outside, `${String(top)} ${String(bottom)}`).toEqual([])
      }
      const pieFaces = await facesOf(PIE)
      const pieOption = chartOption(PIE, pieFaces.faces, SQUARE)
      expect([at(pieOption, 'series', 0, 'center'), at(pieOption, 'series', 0, 'radius')]).toEqual([[150, 100], 60])
      const pie = drawn(PIE, pieFaces, SQUARE).svg
      // The first slice, a half, from noon clockwise: from the circle's top, an arc of the square's half-width to its foot, back to its centre.
      expect(pie).toMatch(/<path d="M150 40A60 60 0 1 1 150 160L150 100Z" fill="#1f77b4"/)
    },
    TIMEOUT,
  )

  // A bar narrower than the least the drawing allows is refused before
  // the PDF, by the width barWidth says ECharts gives it: a barWidth of
  // another rule than ECharts' would pass bars ECharts draws thinner, or
  // refuse bars it draws wide enough. Each bar ECharts draws
  // is barWidth's width, for one series to eight, to the tenth of a point
  // zrender writes a path's numbers to.
  test(
    'gives a bar the width ECharts lays it out at',
    async () => {
      const palette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f']
      const measuredFaces = await facesOf(BARS)
      for (const count of [1, 2, 3, 8]) {
        const series = palette.slice(0, count).map((color, index) => ({ color, values: [value(String(10 + index)), value('50'), value('90')] }))
        const chart: AxisChart = { ...BARS, series, ticks: ticksAt(['0', '50', '100']), legend: [], valueLabels: false }
        const { svg } = drawn(chart, measuredFaces, { tickEvery: 1, plot: PLOT })
        const bars = [...svg.matchAll(/<path d="M-?[\d.]+ -?[\d.]+l(-?[\d.]+) 0l0 -?[\d.]+l-?[\d.]+ 0Z" fill="(#[0-9a-f]{6})"[^>]*ecmeta_ssr_type="chart"/g)]
        expect(bars, String(count)).toHaveLength(count * 3)
        const width = barWidth(PLOT.width / 3, count)
        expect(
          bars.filter(([, drawnWidth]) => Math.abs(Number(drawnWidth) - width) > 0.05).map(([, drawnWidth]) => drawnWidth),
          `${String(count)}: ${String(width)}`,
        ).toEqual([])
      }
      expect(barWidth(100, 2)).toBeCloseTo(35.5556, 4)
    },
    TIMEOUT,
  )

  // An absent title is no word: handed to ECharts as an empty or an
  // undefined text it would still be laid out, and a legend without
  // entries would list the series by their keys and print `s0`. A chart
  // without a title, axis titles or a legend holds none in its option and
  // prints none, its words measured in their face alone, which asks the
  // plan for no bold face; and a chart whose title has no face to print
  // in is refused a layout.
  test(
    'hands ECharts no title, axis title or legend the chart does not have',
    async () => {
      const bare: AxisChart = {
        kind: 'chart',
        chart: 'line',
        id: 'bare',
        width: 300,
        height: 200,
        categories: ['Jan', 'Feb'],
        series: [{ color: '#2ca02c', values: [value('10', '10.00'), value('20', '20.00')] }],
        ticks: ticksAt(['0', '10', '20']),
        valueLabels: false,
        legend: [],
      }
      const measuredFaces = await facesOf(bare, {})
      expect(measuredFaces.faces.title).toBeUndefined()
      const option = chartOption(bare, measuredFaces.faces, DRAWN)
      expect(['title', 'legend', 'xAxis.name', 'yAxis.name'].map((path) => at(option, ...path.split('.')))).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
      ])
      const { svg, asked: record } = drawn(bare, measuredFaces, DRAWN)
      expect(sorted(textsOf(svg))).toEqual(['0.00', '10.00', '20.00', 'Feb', 'Jan'])
      expect(new Set(record.measures.map(([, font]) => font))).toEqual(new Set([fontString(measuredFaces.faces.words)]))
      expect(thrown(() => chartOption(BARS, measuredFaces.faces, DRAWN))).toBe('the chart bars has a title and no face to print it in')
    },
    TIMEOUT,
  )

  // A chart with nothing to draw prints its title and its empty text and
  // no axis or mark, never ECharts' empty frame; and a word that
  // prints nothing -- an empty category label in a preview -- can be
  // proved by nothing, and its slot stays. Such a chart is refused a
  // layout, its words are its title and its empty text, and an empty
  // label is no word, its category still a slot.
  test(
    'refuses to lay out an empty chart, and lists no empty word',
    async () => {
      const empty: AxisChart = {
        kind: 'chart',
        chart: 'bar',
        id: 'nothing',
        width: 300,
        height: 200,
        title: 'Umsatz nach Region',
        empty: 'Keine Daten',
        categories: [],
        series: [],
        ticks: [],
        valueLabels: true,
        legend: [],
      }
      expect(chartWords(empty).map(({ key, text, title }) => [key, text, title])).toEqual([
        ['title', 'Umsatz nach Region', true],
        ['empty', 'Keine Daten', false],
      ])
      const faces = (await facesOf(BARS)).faces
      expect(thrown(() => chartOption(empty, faces, DRAWN))).toBe('the chart nothing has nothing to draw, and is printed without a layout')
      const unnamed: AxisChart = { ...BARS, categories: ['', 'Süd', 'Ost'] }
      expect(chartWords(unnamed).filter(({ key }) => key.startsWith('category/'))).toEqual([
        { key: 'category/1', text: 'Süd', title: false },
        { key: 'category/2', text: 'Ost', title: false },
      ])
      expect(at(chartOption(unnamed, faces, DRAWN), 'xAxis', 'data')).toEqual(['c0', 'c1', 'c2'])
    },
    TIMEOUT,
  )
})
