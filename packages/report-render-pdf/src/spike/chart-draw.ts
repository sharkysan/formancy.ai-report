/**
 * SPIKE (Task 15, spike/chart-echarts): throwaway, never merged.
 *
 * The one module that imports ECharts: a chart block laid out by ECharts
 * 6.1.0 into an SVG string, in Node and in a browser alike, with zrender's
 * platform replaced for the one synchronous layout -- measureText answered
 * by the face pdfmake opened (`FaceWidths`), 国 by the face's line, and
 * createCanvas and loadImage refusing -- and put back after it.
 */
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TitleComponent } from 'echarts/components'
import { init, use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { platformApi } from 'zrender/lib/core/platform.js'
import type { AxisChart, Chart, ChartFace, FaceWidths, PieChart as Pie } from './chart.js'

let registered = false

/** What the spike records of each layout: every string measured, in which font, and anything the platform refused. */
export interface Layout {
  readonly svg: string
  readonly asks: readonly (readonly [string, string])[]
  readonly refused: readonly string[]
}

const GRID = { color: '#d9d9d9', width: 0.5 }
const AXIS = { color: '#000000', width: 0.75 }

function at<T>(list: readonly T[], index: unknown, what: string, id: string): T {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= list.length) throw new Error(`the chart ${id} has no ${what} ${String(index)}`)
  return list[index]!
}
function keyed<T>(key: unknown, prefix: string, list: readonly T[], what: string, id: string): T {
  if (typeof key !== 'string' || !key.startsWith(prefix)) throw new Error(`the chart ${id} has no ${what} ${String(key)}`)
  return at(list, Number(key.slice(prefix.length)), what, id)
}

/** The option for `chart`: its words in `words`, its title in `title`, its category labels turned by `turn`. */
function optionOf(chart: Chart, words: ChartFace, title: ChartFace, turn: 0 | 90): Record<string, unknown> {
  const font = (face: ChartFace) => ({ fontFamily: face.fontFamily, fontWeight: face.bold ? 'bold' : 'normal', fontStyle: 'normal', fontSize: face.size, color: '#000000' })
  const text = font(words)
  const legendKey = chart.chart === 'pie' ? 'c' : 's'
  const base = {
    animation: false,
    backgroundColor: 'transparent',
    textStyle: text,
    title: chart.title === undefined ? undefined : { text: chart.title, left: 'center', top: 0, textStyle: font(title) },
    legend:
      chart.legend.length === 0
        ? { show: false }
        : {
            show: true,
            bottom: 0,
            icon: 'rect',
            itemWidth: 8,
            itemHeight: 8,
            data: chart.legend.map((_, j) => `${legendKey}${j}`),
            formatter: (name: string) => keyed(name, legendKey, chart.legend, 'legend entry', chart.id).text,
            textStyle: text,
            itemStyle: { borderWidth: 0.5, borderColor: '#000000' },
          },
  }
  if (chart.chart === 'pie') return pieOption(chart, base, text)
  return axisOption(chart, base, text, turn)
}

function pieOption(chart: Pie, base: Record<string, unknown>, text: Record<string, unknown>): Record<string, unknown> {
  return {
    ...base,
    series: [
      {
        type: 'pie',
        radius: '60%',
        center: ['50%', '50%'],
        startAngle: 90,
        clockwise: true,
        label: { show: false, ...text },
        labelLine: { show: false },
        // PieSeries' default `labelLayout: { hideOverlap: true }` lays hidden slice labels out in zrender's `12px sans-serif` (Q3).
        labelLayout: null,
        data: chart.slices.map((slice, i) => ({ name: `c${i}`, value: Number(slice.value.exact), itemStyle: { color: slice.color } })),
      },
    ],
  }
}

function axisOption(chart: AxisChart, base: Record<string, unknown>, text: Record<string, unknown>, turn: 0 | 90): Record<string, unknown> {
  const ticks = chart.ticks.map((tick) => Number(tick.exact))
  // The plot's top at a half point and its height a whole multiple of (ticks - 1) points: every tick on a half
  // point, where zrender's subPixelOptimizeLine leaves a 0.5-wide gridline where it is (Q9).
  const top = 32.5
  const bottomRoom = (chart.legend.length === 0 ? 40 : 56) + (turn === 90 ? 30 : 0)
  const intervals = ticks.length - 1
  const plot = Math.floor((chart.height - top - bottomRoom) / intervals) * intervals
  return {
    ...base,
    grid: { left: 48, right: 24, top, bottom: chart.height - top - plot },
    xAxis: {
      type: 'category',
      data: chart.categories.map((_, i) => `c${i}`),
      name: chart.categoryTitle,
      nameLocation: 'middle',
      nameGap: turn === 90 ? 52 : 22,
      nameTextStyle: text,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: AXIS.color, width: AXIS.width } },
      axisLabel: { interval: 0, rotate: turn, ...text, formatter: (value: string) => keyed(value, 'c', chart.categories, 'category', chart.id) },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: ticks[0],
      max: ticks.at(-1),
      name: chart.valueTitle,
      nameLocation: 'end',
      nameTextStyle: text,
      axisTick: { show: false, customValues: ticks },
      axisLine: { show: true, lineStyle: { color: AXIS.color, width: AXIS.width } },
      axisLabel: { customValues: ticks, ...text, formatter: (_: number, index: number) => at(chart.ticks, index, 'tick', chart.id).text },
      splitLine: { show: true, lineStyle: { color: GRID.color, width: GRID.width } },
    },
    series: chart.series.map((series, s) => ({
      type: chart.chart,
      name: `s${s}`,
      data: series.values.map((value) => {
        if (value === null) return null
        const y = Number(value.exact)
        return chart.chart === 'bar' && y < 0 ? { value: y, label: { position: 'bottom' } } : y
      }),
      itemStyle: { color: series.color },
      ...(chart.chart === 'bar'
        ? { barCategoryGap: '20%', barGap: '25%' }
        : { connectNulls: false, symbol: 'circle', symbolSize: 4, showSymbol: true, lineStyle: { color: series.color, width: 1.5 } }),
      label: {
        show: chart.valueLabels,
        position: 'top',
        ...text,
        formatter: (params: { dataIndex: number }) => {
          const value = at(series.values, params.dataIndex, 'value', chart.id)
          if (value === null) throw new Error(`the chart ${chart.id} labels a value it does not have`)
          return value.text
        },
      },
    })),
  }
}

/**
 * `chart` laid out by ECharts into an SVG string, its words measured in
 * `faces` by `widths`, its category labels turned by `turn`. Synchronous:
 * zrender's platform is replaced for this layout and put back after it,
 * whether it throws or not.
 */
export function drawChart(chart: Chart, faces: { readonly words: ChartFace; readonly title: ChartFace }, widths: FaceWidths, turn: 0 | 90 = 0): Layout {
  if (!registered) {
    use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TitleComponent, SVGRenderer])
    registered = true
  }
  const handed = new Map<string, ChartFace>()
  for (const face of [faces.words, faces.title]) handed.set(`normal ${face.bold ? 'bold' : 'normal'} ${face.size}px ${face.fontFamily}`, face)
  const asks: (readonly [string, string])[] = []
  const refused: string[] = []
  const saved = { createCanvas: platformApi.createCanvas, measureText: platformApi.measureText, loadImage: platformApi.loadImage }
  platformApi.createCanvas = () => {
    refused.push('createCanvas')
    throw new Error(`the chart ${chart.id}'s layout asked for a canvas`)
  }
  platformApi.loadImage = () => {
    refused.push('loadImage')
    throw new Error(`the chart ${chart.id}'s layout asked for an image`)
  }
  platformApi.measureText = (text: string, font?: string) => {
    asks.push([text, font ?? ''])
    const face = handed.get(font ?? '')
    if (face === undefined) throw new Error(`the chart ${chart.id}'s layout measured text in a font it was not handed`)
    return { width: text === '国' ? widths.line(face.family, face.bold, face.size) : widths.width(face.family, face.bold, face.size, text) } as TextMetrics
  }
  try {
    const instance = init(null, null, { renderer: 'svg', ssr: true, width: chart.width, height: chart.height })
    try {
      instance.setOption(optionOf(chart, faces.words, faces.title, turn) as never)
      return { svg: instance.renderToSVGString(), asks, refused }
    } finally {
      instance.dispose()
    }
  } finally {
    Object.assign(platformApi, saved)
  }
}
