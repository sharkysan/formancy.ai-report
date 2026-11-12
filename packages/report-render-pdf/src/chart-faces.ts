import { assetDigest, type Chart } from '@formancy/report-runtime'
import { type Face, faceOf } from './glyphs.js'
import type { RenderFonts } from './host-fonts.js'

/**
 * The faces a chart's words print in, and what ECharts is told of each
 * (0058). ECharts lays a chart out and pdfmake prints its words where
 * ECharts placed them, so each word must be measured in the face, at the
 * size and in the line pdfmake prints it in: the face is the plan's
 * (`host-fonts.ts`), refused there as any text's is, and the widths are the
 * engine's (`Engine.widths`).
 *
 * A chart's words take its style's font token, size, weight, slant and
 * colour; its `align` is not read, since ECharts places each word, and an
 * alignment means nothing for a word placed. Its title is bold in the same
 * token. This module imports nothing of ECharts or zrender.
 */

/** Points: the size a chart's words print in where its style names none. */
export const CHART_TEXT_SIZE = 8

/** One face a chart's words print in, its measures in points at its size. */
export interface ChartFace {
  /** pdfmake's family, and which of its faces. */
  readonly family: string
  readonly face: Face
  readonly size: number
  /** The line pdfmake lays a word out in, which zrender asks for as the width of `国`. */
  readonly line: number
  /** The face's ascender and descender at `size`: the descender negative, below the baseline, and `line` their difference. */
  readonly ascent: number
  readonly descent: number
  /**
   * What ECharts is told. Its `fontFamily` is the family, a comma, and `f`
   * and the hex of the SHA-256 of the face's key (`RenderFace.key`):
   * zrender keeps widths process-wide by the whole font string, so two
   * faces of other bytes are never measured alike, and the drawing's reader
   * knows a word's face by it. pdfmake draws every word, and no `<text>`
   * reaches its SVG converter, so nothing else reads it. Neither part holds
   * `"`, `;`, `:` or `,` but the separator, since zrender writes a
   * text's attributes unescaped. The whole digest and not a part of it: a
   * prefix two crafted fonts shared would lay one's words out by the
   * other's widths.
   */
  readonly font: {
    readonly fontFamily: string
    readonly fontWeight: 'normal' | 'bold'
    readonly fontStyle: 'normal' | 'italic'
    readonly fontSize: number
    /** The chart's style's colour, else black: no word is left to ECharts' theme. */
    readonly color: string
  }
}

/** A chart's words' face, and its title's where it has a title. */
export interface ChartFaces {
  readonly words: ChartFace
  /** Bold in the words' token, size, slant and colour; absent for a chart without a title, which asks the plan for no bold face. */
  readonly title?: ChartFace
}

/** What a chart's words print in where its style names no colour. */
const BLACK = '#000000'

/** The faces `chart` prints its words and its title in, from `fonts`, the render's plan, which refuses a face the report does not map, naming the chart. */
export function chartFaces(chart: Chart, fonts: RenderFonts): ChartFaces {
  const style = chart.style ?? {}
  const token = style.font
  const family = token === undefined ? fonts.defaultFamily : fonts.familyOf(token)
  const size = style.size ?? CHART_TEXT_SIZE
  const italic = style.italic ?? false
  const color = style.color ?? BLACK
  const faceOfChart = (bold: boolean): ChartFace => {
    const planned = fonts.face(token, bold, italic, chart.id)
    return {
      family,
      face: faceOf(bold, italic),
      size,
      line: planned.lineFactor * size,
      ascent: planned.ascent * size,
      descent: planned.descent * size,
      font: {
        fontFamily: `${family}, f${hexDigest(planned.key())}`,
        fontWeight: bold ? 'bold' : 'normal',
        fontStyle: italic ? 'italic' : 'normal',
        fontSize: size,
        color,
      },
    }
  }
  return { words: faceOfChart(style.bold ?? false), ...(chart.title === undefined ? {} : { title: faceOfChart(true) }) }
}

/** The hex digits of the SHA-256 of `key`'s UTF-8: a host face's key holds a colon, which a font string may not. */
function hexDigest(key: string): string {
  return assetDigest(new TextEncoder().encode(key)).slice('sha256:'.length)
}
