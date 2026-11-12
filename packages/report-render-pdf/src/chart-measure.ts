import { platformApi } from 'zrender/lib/core/platform.js'
import type { ChartFace, ChartFaces } from './chart-faces.js'
import type { FaceWidths } from './engine.js'

/**
 * zrender's platform for one chart's layout (0058). ECharts measures every
 * word it places through zrender's `platformApi.measureText`, and pdfmake
 * prints the word where ECharts placed it, so the measurer answers in the
 * width pdfmake prints the word in: the engine's (`Engine.widths`), in the
 * face, weight and size the chart's style names (`chart-faces.ts`). zrender
 * asks the width of 国 for a font's line (contain/text.js
 * `getLineHeight`), answered with the face's line, pdfmake's, never the
 * width PDFKit gives it, which in a face without the character is its
 * .notdef glyph's. A chart's words are never 国: the report prints no Han
 * character (`refusedCharacter`, 0043).
 *
 * A font string the measurer was not handed is refused: a width for it
 * would be one of a face nobody chose, as zrender's own 12px sans-serif is,
 * which a pie's default label layout measures in. A canvas and an image are
 * refused too: the layout into an SVG string needs neither, and a canvas
 * would measure in the browser's fonts, an image be fetched by its address.
 *
 * zrender's platform is one for the process or the page, which a host's
 * own ECharts measures through as well. ECharts' layout is synchronous, so
 * the measurer, set for one layout and put back after it, whether the
 * layout returned or threw, is never seen by another layout, in Node or in
 * a page; and nothing of it, the render's widths least of all, outlives
 * the layout. zrender keeps the widths it was answered, process-wide and
 * by the whole font string, which names a face by the bytes it embeds
 * (`ChartFace.font`), so a width it kept is the width of those bytes.
 *
 * Imported by the drawing alone, which a document with a chart loads
 * (`chart-draw.ts`), so that it is in the chunk that carries ECharts.
 */

/**
 * zrender's platform, as far as a layout's measuring reads and replaces it:
 * three functions, none of which reads `this` -- zrender's own name
 * `platformApi` (core/platform.js) -- so that each is taken and put back
 * as the function it is.
 */
interface Platform {
  measureText(this: void, text: string, font?: string): { width: number }
  createCanvas(this: void): unknown
  loadImage(this: void, src: string, onload: () => void, onerror: () => void): unknown
}
const platform: Platform = platformApi

/** zrender's probe for a font's line: the width of this character, which it takes as a line's height. */
const LINE_PROBE = '国'

/** The font string zrender measures `face`'s words in: style, weight, size in pixels and family, joined as ECharts' `getFont` and zrender's `Text` join them. */
const fontOf = ({ font }: ChartFace): string => `${font.fontStyle} ${font.fontWeight} ${String(font.fontSize)}px ${font.fontFamily}`

/**
 * What `lay` returns, run with zrender's `measureText` answering in
 * `faces` by `widths` -- 国 with the face's line -- and `createCanvas` and
 * `loadImage` refusing; the three put back as they were after it, also
 * when it throws. `lay` is the whole of one synchronous layout: a measure
 * it left for later would be answered by whatever stands then.
 */
export function withMeasurer<T>(faces: ChartFaces, widths: FaceWidths, lay: () => T): T {
  const handed = new Map((faces.title === undefined ? [faces.words] : [faces.words, faces.title]).map((face) => [fontOf(face), face]))
  const saved = { measureText: platform.measureText, createCanvas: platform.createCanvas, loadImage: platform.loadImage }
  platform.measureText = (text, font) => {
    const face = font === undefined ? undefined : handed.get(font)
    if (face === undefined) throw new Error(`a chart's layout measured text in a font it was not handed: ${font === undefined ? 'none' : `'${font}'`}`)
    return { width: text === LINE_PROBE ? face.line : widths.width(face.family, face.face, face.size, text) }
  }
  platform.createCanvas = () => {
    throw new Error("a chart's layout asked for a canvas")
  }
  platform.loadImage = () => {
    throw new Error("a chart's layout asked for an image")
  }
  try {
    return lay()
  } finally {
    platform.measureText = saved.measureText
    platform.createCanvas = saved.createCanvas
    platform.loadImage = saved.loadImage
  }
}
