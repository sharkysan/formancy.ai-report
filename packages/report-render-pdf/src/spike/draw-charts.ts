/**
 * SPIKE (Task 15, spike/chart-echarts): throwaway, never merged.
 *
 * Every chart of a document drawn before pdfmake lays the document out:
 * `chart-draw.js`, the one module that imports ECharts, imported the first
 * time a document holds a chart (`loadOnce`, as the browser entry imports
 * Liberation Sans), and its words measured in the faces pdfmake opens on a
 * document of the entry's own pdfmake (`Engine.widths`).
 */
import type { ResolvedDocument } from '@formancy/report-runtime'
import { type Engine, loadOnce } from '../engine.js'
import type { RenderFonts } from '../host-fonts.js'
import { type Chart, chartFaces, chartsIn, DRAWN, type FaceMetrics, type FaceWidths } from './chart.js'
import type { Layout } from './chart-draw.js'

const chartDraw = loadOnce(async () => {
  loads.count += 1
  return import('./chart-draw.js')
})

/** Each chart's layout, for the spike's probes to read: the strings zrender measured, in which font, and the widths it was measured by. */
export const LAYOUTS = new WeakMap<Chart, Layout & { readonly widths: FaceWidths }>()

/** How many times the chart module was imported, for the spike's laziness probe. */
export const loads = { count: 0 }

export async function drawCharts(engine: Engine, document: ResolvedDocument, fonts: RenderFonts): Promise<void> {
  const charts = chartsIn(document.body)
  if (charts.length === 0) return
  if (engine.widths === undefined) throw new Error('this engine measures no chart')
  const module = await chartDraw()
  const faces = charts.map((chart) => chartFaces(chart, fonts))
  const wanted = new Map(faces.flatMap(({ words, title }) => [words, title]).map((face) => [`${face.family}/${String(face.bold)}`, face]))
  const widths = await engine.widths(fonts.engine, [...wanted.values()])
  charts.forEach((chart, index) => {
    const layout = module.drawChart(chart, faces[index]!, widths, (chart as { readonly spikeTurn?: 0 | 90 }).spikeTurn ?? 0)
    DRAWN.set(chart, layout.svg)
    LAYOUTS.set(chart, { ...layout, widths })
  })
}

/** A PDFKit face as pdfmake's `provideFont` returns it. */
interface PdfKitFace {
  widthOfString(text: string, size: number): number
  lineHeight(size: number): number
  readonly ascender: number
  readonly descender: number
  readonly bbox: { readonly minY: number; readonly maxY: number }
  readonly scale?: number
}

/** `faces` opened at once on `document`, a document of the entry's pdfmake, while the host's virtual files are registered; widths and lines as pdfmake measures a line. */
export function faceWidths(
  document: { provideFont(family: string, bold: boolean, italics: boolean): PdfKitFace },
  faces: readonly { readonly family: string; readonly bold: boolean }[],
): FaceWidths {
  const opened = new Map(faces.map(({ family, bold }) => [`${family}/${String(bold)}`, document.provideFont(family, bold, false)]))
  const font = (family: string, bold: boolean): PdfKitFace => {
    const found = opened.get(`${family}/${String(bold)}`)
    if (found === undefined) throw new Error(`no face ${family} ${bold ? 'bold' : 'regular'} was opened for measuring`)
    return found
  }
  return {
    width: (family, bold, size, text) => font(family, bold).widthOfString(text, size),
    line: (family, bold, size) => font(family, bold).lineHeight(size),
    metrics: (family, bold): FaceMetrics => {
      const face = font(family, bold)
      return { ascender: face.ascender, descender: face.descender, bbox: { minY: face.bbox.minY, maxY: face.bbox.maxY }, scale: face.scale ?? 1 }
    },
  }
}
