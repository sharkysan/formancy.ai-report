import type { AxisChart, ResolvedFonts, TextStyle } from '@formancy/report-runtime'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TitleComponent } from 'echarts/components'
import { init, use, type EChartsCoreOption, type EChartsType } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { platformApi } from 'zrender/lib/core/platform.js'
import { chartFaces, type ChartFace, type ChartFaces } from '../chart-faces.js'
import type { FaceWidths } from '../engine.js'
import type { Glyphs } from '../glyphs.js'
import { planFonts, type RenderFonts } from '../host-fonts.js'
import { engine } from '../node.js'

/**
 * ECharts 6.1.0 for the renderer's tests, laid out as the drawing lays a
 * chart out -- server-side, into an SVG string, without animation -- and
 * what zrender asks of its platform while it does; and the faces a chart's
 * words print in, with the widths a render measures them by. The tests
 * hand ECharts options of their own, shaped as the drawing's is described
 * (0058), to pin what ECharts and zrender do with them: the drawing's own
 * option is its module's, and its tests'.
 */

/** Roboto's four faces, each mapping 'A': a plan's glyphs are not what these tests read. */
const ROBOTO: Glyphs = { normal: new Set([0x41]), bold: new Set([0x41]), italics: new Set([0x41]), bolditalics: new Set([0x41]) }

/** The render's plan of `fonts`, the host's faces a report maps, or of none. */
export const planned = (fonts?: ResolvedFonts): RenderFonts => planFonts(fonts, ROBOTO)

/** A chart for `chartFaces` to read a style and a title from: what it would draw is no test's. */
export const styled = (style: TextStyle, title?: string): AxisChart => ({
  kind: 'chart',
  chart: 'bar',
  id: 'styled',
  width: 300,
  height: 200,
  ...(title === undefined ? {} : { title }),
  legend: [],
  categories: [],
  series: [],
  ticks: [],
  valueLabels: false,
  style,
})

/** The faces a chart in `style`, with `title` or none, prints in under `plan`, and their widths, opened in the Node entry as a render opens them. */
export async function measured(plan: RenderFonts, style: TextStyle, title?: string): Promise<{ readonly faces: ChartFaces; readonly widths: FaceWidths }> {
  const faces = chartFaces(styled(style, title), plan)
  return { faces, widths: await engine.widths(plan.engine, faces.title === undefined ? [faces.words] : [faces.words, faces.title]) }
}

/** The font string zrender measures `face`'s words in: ECharts' style, weight, size in pixels and family, joined by spaces, as ECharts 6.1.0's `getFont` and zrender 6.1.0's `Text` join them. */
export const fontString = ({ font }: ChartFace): string => `${font.fontStyle} ${font.fontWeight} ${font.fontSize}px ${font.fontFamily}`

let registered = false

/** `option` laid out by ECharts in a box `width` by `height` points: the SVG zrender writes, and what `read` reads of the chart before it is disposed. */
export function layOut<T = undefined>(
  option: EChartsCoreOption,
  width: number,
  height: number,
  read?: (chart: EChartsType) => T,
): { readonly svg: string; readonly read: T | undefined } {
  if (!registered) {
    use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TitleComponent, SVGRenderer])
    registered = true
  }
  const chart = init(null, null, { renderer: 'svg', ssr: true, width, height })
  try {
    chart.setOption({ animation: false, ...option })
    return { svg: chart.renderToSVGString(), read: read?.(chart) }
  } finally {
    chart.dispose()
  }
}

/** zrender's platform as these tests wrap it: three functions that read no `this` (core/platform.js names `platformApi`), as `chart-measure.ts` holds it. */
export interface Platform {
  measureText(this: void, text: string, font?: string): { width: number }
  createCanvas(this: void): unknown
  loadImage(this: void, src: string, onload: () => void, onerror: () => void): unknown
}
export const platform: Platform = platformApi

/** What zrender asked its platform for: each text it measured, and the font string it measured it in; and how many canvases and images it asked for. */
export interface Asked {
  readonly measures: (readonly [text: string, font: string | undefined])[]
  canvases: number
  images: number
}

/**
 * What `lay` makes, and what zrender asked its platform for while it ran:
 * each of the three is wrapped as it stands -- whatever measurer is set
 * still answers, and whatever canvas or image loader is set still runs --
 * and put back after. A canvas or an image asked for is counted before the
 * loader set runs, so a refusal ECharts swallowed is counted all the same.
 */
export function asked<T>(lay: () => T): { readonly result: T; readonly asked: Asked } {
  const saved = { measureText: platform.measureText, createCanvas: platform.createCanvas, loadImage: platform.loadImage }
  const record: Asked = { measures: [], canvases: 0, images: 0 }
  platform.measureText = (text, font) => {
    record.measures.push([text, font])
    return saved.measureText(text, font)
  }
  platform.createCanvas = () => {
    record.canvases += 1
    return saved.createCanvas()
  }
  platform.loadImage = (src, onload, onerror) => {
    record.images += 1
    return saved.loadImage(src, onload, onerror)
  }
  try {
    return { result: lay(), asked: record }
  } finally {
    platform.measureText = saved.measureText
    platform.createCanvas = saved.createCanvas
    platform.loadImage = saved.loadImage
  }
}

/** A word zrender wrote: its text, the font family its style names, and where its anchor stands -- its translation and its own x and y added -- the y at the middle of its line (`dominant-baseline="central"`). */
export interface SvgWord {
  readonly text: string
  readonly family: string
  readonly x: number
  readonly y: number
}

/** Every `<text>` in `svg`, in the order zrender wrote them, as zrender 6.1.0 writes one unturned: a `translate` and an `x` and `y` of its own, either absent where it is 0. */
export function wordsOf(svg: string): SvgWord[] {
  return [...svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map(([, attributes = '', text = '']) => {
    const attribute = (name: string): string | undefined => new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1]
    const translated = /^translate\((-?[\d.]+) (-?[\d.]+)\)$/.exec(attribute('transform') ?? 'translate(0 0)')
    if (translated === null) throw new Error('zrender wrote a word turned or scaled, which these tests do not read')
    const family = /font-family:([^;]*);/.exec(attribute('style') ?? '')?.[1]
    if (family === undefined) throw new Error('zrender wrote a word with no font family')
    const [, tx, ty] = translated
    return { text, family, x: Number(tx) + Number(attribute('x') ?? 0), y: Number(ty) + Number(attribute('y') ?? 0) }
  })
}
