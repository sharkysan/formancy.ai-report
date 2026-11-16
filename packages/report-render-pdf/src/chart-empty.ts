import type { Chart } from '@formancy/report-runtime'
import type { ChartFaces } from './chart-faces.js'
import { held } from './chart-held.js'
import { chartWords, TITLE_PADDING } from './chart-option.js'
import type { PlacedWord } from './chart-svg.js'
import type { FaceWidths } from './engine.js'

/**
 * A chart with nothing to draw -- no rows, a bar or a line chart with no
 * value, a pie of nothing (R7, R8) -- placed by the renderer, and never
 * handed to ECharts, which would draw nothing of it but its words: its box
 * reserved whole, its title where a drawn chart's stands, `TITLE_PADDING`
 * below the box's top, centred across it, in the title's face, and its
 * empty text, the report's words, centred in the box, each measured as
 * pdfmake prints it (`Engine.widths`). No axis and no mark. Its words
 * are held as a drawn chart's are (`chart-held.ts`): one past the box, or
 * the two meeting, refuse it. It imports nothing of ECharts.
 */
export function drawEmpty(chart: Chart, faces: ChartFaces, widths: FaceWidths): readonly PlacedWord[] {
  const words = chartWords(chart).map((word): PlacedWord => {
    const face = word.title ? faces.title : faces.words
    // chartFaces gives a title its face wherever chartWords lists one.
    if (face === undefined) throw new Error(`the chart ${chart.id}'s title was placed with no face to print it in`)
    const width = widths.width(face.family, face.face, face.size, word.text)
    const top = word.title ? TITLE_PADDING : (chart.height - face.line) / 2
    return { ...word, face, x: (chart.width - width) / 2, top, width, height: face.line }
  })
  return held(chart, words)
}
