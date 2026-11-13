import type { Content } from 'pdfmake/interfaces.js'
import { RenderRefusal, type Chart } from '@formancy/report-runtime'
import type { Build } from './build.js'
import type { PlacedWord } from './chart-svg.js'
import type { ConvertedSvg, ConverterOptions } from './svg-content.js'

/**
 * A chart as pdfmake content (0058): its box, as the render drew it
 * (`drawCharts`), one unbreakable stack, in every pass, of
 *
 * 1. its marks: the drawing ECharts laid out, without a word or a style
 *    sheet (`chart-svg.ts`), handed to pdfmake's SVG converter in the
 *    box, whose callbacks refuse rather than draw it otherwise, detached
 *    at the box's top left;
 * 2. each of its words as pdfmake text, unbroken, in its face, size and
 *    colour, detached at its box's top left, and held, once pdfmake has
 *    measured it, to its box's width (`words.ts`), the advance the
 *    drawing placed it by;
 * 3. a spacer of the box's height, the one node that takes the flow's room.
 *
 * pdfmake lays a detached node out from where the flow stands, moved by
 * its offset, and fits it against the room there, not below its offset
 * (`pdfmake.test.ts`): every node of the stack is fitted against the room
 * at the box's top, so that a word at the box's foot is never fitted
 * against what a drawing before it left, and sent to another page than
 * its chart. The words are painted after the marks, over them, in the
 * order pdfmake is handed them. The stack is moved to the next page
 * whole where the box does not fit at the foot of one, and measured, in
 * a keep-together block, as the box. A word stands where ECharts placed
 * it, which pdfmake prints it at: its box's top half its face's line above
 * the line's centre, `dominant-baseline: central`, and its baseline the
 * face's ascent below its top, where pdfmake sets a line's.
 *
 * A chart with nothing to draw has no marks: its title and its empty text
 * are its words, in its box, and no SVG is handed to the converter.
 */
export function chartContent(chart: Chart, build: Build): Content {
  const drawing = build.charts.get(chart)
  // render.ts draws every chart check.ts collected before a build holds one, and check.ts refuses one in a page region, whose build is made before.
  if (drawing === undefined) throw new Error(`the chart ${chart.id} reached the pdfmake content undrawn`)
  const marks = 'svg' in drawing ? [marksOf(chart, drawing.svg)] : []
  const words = drawing.words.map((word) => wordOf(chart, word, build))
  return { stack: [...marks, ...words, { stack: [], margin: [0, chart.height, 0, 0] }], unbreakable: true }
}

/** `svg`, `chart`'s drawing, in its box at its top left, under the converter's callbacks for it. */
function marksOf(chart: Chart, svg: string): ConvertedSvg & { readonly relativePosition: { readonly x: number; readonly y: number } } {
  return { svg, width: chart.width, height: chart.height, options: converterOptions(chart), relativePosition: { x: 0, y: 0 } }
}

/**
 * The converter's options for `chart`'s drawing: both callbacks refusing
 * it, naming it and quoting nothing the converter says, as an SVG asset's
 * do (`svg-content.ts`). The drawing holds only what ECharts 6.1.0 was
 * seen to write and nothing the converter would open, so either is a
 * converter that draws it otherwise than it was read, which is refused
 * rather than printed partly.
 */
function converterOptions(chart: Chart): ConverterOptions {
  return {
    imageCallback: () => {
      throw new RenderRefusal(
        'unsupported',
        `ECharts' drawing of the chart ${chart.id} asks pdfmake's SVG converter to open an image, which the renderer never lets it do`,
        chart.id,
      )
    },
    warningCallback: () => {
      throw new RenderRefusal(
        'unsupported',
        `pdfmake's SVG converter could not draw the chart ${chart.id} as ECharts laid it out: it warned, and the renderer draws a chart whole or not at all`,
        chart.id,
      )
    },
  }
}

/** `word`, of `chart`, as pdfmake text at its box's top left, recorded for the word check with its box's width as its room. */
function wordOf(chart: Chart, word: PlacedWord, build: Build): Content {
  const { family, face, size, font } = word.face
  const node = {
    text: word.text,
    noWrap: true,
    alignment: 'left',
    font: family,
    fontSize: size,
    bold: face === 'bold' || face === 'bolditalics',
    italics: face === 'italics' || face === 'bolditalics',
    color: font.color,
    relativePosition: { x: word.x, y: word.top },
  } satisfies Content
  const what = `the chart ${chart.id}`
  build.words.push({ node, width: word.width, lines: 1, what, subject: chart.id })
  return node
}
