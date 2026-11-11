/**
 * SPIKE (Task 15, spike/chart-echarts): throwaway, never merged.
 *
 * The chart block, as PR 2 (#72, feat/chart-runtime) resolves one: its
 * types copied from that branch's packages/report-runtime/src/chart-document.ts,
 * since the spike draws hand-built blocks and needs none of PR 2's code.
 * This module imports nothing of ECharts: `render.ts` imports
 * `chart-draw.js`, which does, only for a document that holds a chart.
 */
import type { Content } from 'pdfmake/interfaces.js'
import { assetDigest, type Block, type FontFamily, RenderRefusal, type TextStyle } from '@formancy/report-runtime'
import type { RenderFonts } from '../host-fonts.js'

export interface ChartValue {
  readonly exact: string
  readonly text: string
}
export interface ChartLegendEntry {
  readonly text: string
  readonly color: string
}
interface ChartFrame {
  readonly kind: 'chart'
  readonly id: string
  readonly width: number
  readonly height: number
  readonly style?: TextStyle
  readonly title?: string
  readonly legend: readonly ChartLegendEntry[]
  readonly empty?: string
}
export interface ChartSeriesValues {
  readonly color: string
  readonly values: readonly (ChartValue | null)[]
}
export interface AxisChart extends ChartFrame {
  readonly chart: 'bar' | 'line'
  readonly categoryTitle?: string
  readonly valueTitle?: string
  readonly categories: readonly string[]
  readonly series: readonly ChartSeriesValues[]
  readonly ticks: readonly ChartValue[]
  readonly valueLabels: boolean
}
export interface PieChart extends ChartFrame {
  readonly chart: 'pie'
  readonly slices: readonly { readonly color: string; readonly value: ChartValue }[]
}
export type Chart = AxisChart | PieChart

/** `block` as a chart, or undefined: main's `Block` has no chart, so the spike reads one where it finds one. */
export function asChart(block: unknown): Chart | undefined {
  return (block as { kind?: unknown }).kind === 'chart' ? (block as Chart) : undefined
}

/** Every chart among `blocks`, nested ones included, in document order. */
export function chartsIn(blocks: readonly Block[]): Chart[] {
  return blocks.flatMap((block): Chart[] => {
    const chart = asChart(block)
    if (chart !== undefined) return [chart]
    switch (block.kind) {
      case 'keepTogether':
      case 'section':
        return chartsIn(block.blocks)
      case 'columns':
        return block.columns.flatMap((slot) => chartsIn(slot.blocks))
      default:
        return []
    }
  })
}

/** One face a chart's words print in: pdfmake's family, the weight, and the string ECharts is told, `family, f<key>`. */
export interface ChartFace {
  readonly family: string
  readonly bold: boolean
  readonly size: number
  /** pdfmake's findFont takes the first name; zrender's width cache keys by the whole string. */
  readonly fontFamily: string
}

/** What PDFKit's face says of itself, which svg-to-pdfkit places a baseline by (`getBaseline`, `getAscent`, `getDescent`). */
export interface FaceMetrics {
  readonly ascender: number
  readonly descender: number
  readonly bbox: { readonly minY: number; readonly maxY: number }
  readonly scale: number
}

/** Widths as pdfmake measures them: PDFKit's face, opened by pdfmake's own `provideFont`. */
export interface FaceWidths {
  width(family: string, bold: boolean, size: number, text: string): number
  line(family: string, bold: boolean, size: number): number
  metrics(family: string, bold: boolean): FaceMetrics
}

/** The size a chart's words print in when its style names none. */
export const CHART_TEXT_SIZE = 8

/** The words' face and the title's (bold), in the chart's token: a key of the face's bytes for a host's face, `Roboto` and its weight for the renderer's own. */
export function chartFaces(chart: Chart, fonts: RenderFonts): { readonly words: ChartFace; readonly title: ChartFace } {
  const token: FontFamily | undefined = chart.style?.font
  const family = token === undefined ? fonts.defaultFamily : fonts.familyOf(token)
  const size = chart.style?.size ?? CHART_TEXT_SIZE
  const face = (bold: boolean): ChartFace => {
    const file = fonts.engine.families[family]?.[bold ? 'bold' : 'normal']
    const bytes = file === undefined ? undefined : fonts.engine.files.get(file)
    const key = bytes === undefined ? `roboto${bold ? 'bold' : ''}` : assetDigest(bytes).replace(/[^0-9a-f]/g, '').slice(0, 16)
    return { family, bold, size, fontFamily: `${family}, f${key}` }
  }
  return { words: face(chart.style?.bold === true), title: face(true) }
}

/** The SVG each chart was drawn as, for the render in flight. */
export const DRAWN = new WeakMap<Chart, string>()

/** A chart as pdfmake's node: ECharts' SVG in the chart's box, the converter's callbacks refusing it. */
export function chartContent(chart: Chart): Content {
  const svg = DRAWN.get(chart)
  if (svg === undefined) throw new RenderRefusal('unsupported', `the chart ${chart.id} was not drawn`, chart.id)
  return {
    svg,
    width: chart.width,
    height: chart.height,
    options: {
      imageCallback: () => {
        throw new RenderRefusal('unsupported', `pdfmake's SVG converter was asked to open an image in the chart ${chart.id}`, chart.id)
      },
      // SPIKE: the warning is quoted, so the spike can read why; PR 3 quotes nothing.
      warningCallback: (warning: string) => {
        throw new RenderRefusal('unsupported', `pdfmake's SVG converter could not draw the chart ${chart.id} whole: ${warning}`, chart.id)
      },
    },
  } as Content
}
