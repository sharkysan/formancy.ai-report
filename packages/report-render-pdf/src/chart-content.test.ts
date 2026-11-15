import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPdf, type PdfBox, type PdfPage, type PdfTextItem, type ReadPdf } from '@formancy/report-corpus'
import {
  readFont,
  type AxisChart,
  type Block,
  type Chart,
  type FontAsset,
  type PieChart,
  type ResolvedDocument,
  type ResolvedFonts,
} from '@formancy/report-runtime'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { drawChart, type DrawnChart } from './chart-draw.js'
import { TITLE_PADDING } from './chart-option.js'
import type { PlacedWord } from './chart-svg.js'
import type { Engine, FaceWidths } from './engine.js'
import { engine } from './node-engine.js'
import { renderPdf } from './node.js'
import { render } from './render.js'
import { BARS, EMPTY, LINE, MONO, PIE, SERIF, value } from './testing/charts.js'
import { collected } from './testing/collector.js'
import { BODY_HEIGHT, bareDocument, documentOf, heading, paragraph, PAGE, TIMEOUT } from './testing/documents.js'
import { readDrawing } from './testing/drawing.js'
import { svg } from './testing/svg.js'
import { fromWire, toWire } from './testing/wire.js'

/**
 * A chart in the document (0058, C10), proved on the PDF it produced
 * (0003): one unbreakable stack of the box ECharts laid it out in -- its
 * marks, the SVG the drawing kept without a word, then each of its words
 * as pdfmake text at its box, then the box's height of the flow -- so that
 * it moves to the next page whole, its words with it, and every word
 * prints, in the report's face, where the drawing placed it.
 *
 * Every chart the drawing lays out is recorded, passing through, so that
 * a case holds the PDF to the very words the render placed: each read
 * back by PDF.js at its box, within `EDGE`. A chart's box is where the SVG
 * converter clips its drawing, the viewport (`pdfmake.test.ts`), found by
 * its size: the charts of a case are each of a size of its own.
 */

vi.mock('./chart-draw.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./chart-draw.js')>()
  return { ...actual, drawChart: vi.fn(actual.drawChart) }
})
beforeEach(() => {
  vi.mocked(drawChart).mockClear()
})

/** How far a word may read back from where the drawing boxed it: the corpus's `EDGE` (`check-page.ts`), half a point, which its index does not export. */
const EDGE = 0.5

/** The page limit every render here is made with, the child's among them (`render-child.ts`). */
const OPTIONS = { maxPages: 20 } as const

/** The charts the drawing laid out since the case began, each with what it drew, in the order it drew them. */
const drawings = (): readonly { readonly chart: Chart; readonly drawn: DrawnChart }[] =>
  vi.mocked(drawChart).mock.calls.map(([chart], index) => {
    const result = vi.mocked(drawChart).mock.results[index]!
    if (result.type !== 'return') throw new Error(`the drawing of the chart ${chart.id} threw`)
    return { chart, drawn: result.value }
  })

/** What the drawing drew of `chart`, by its id, once. */
function drawingOf(id: string): DrawnChart {
  const found = drawings().filter(({ chart }) => chart.id === id)
  expect(found, id).toHaveLength(1)
  return found[0]!.drawn
}

/** A run's baseline, a fifth of its size above its box's foot (`read-pdf.ts`). */
const baselineOf = (item: PdfTextItem): number => item.bottom - 0.2 * item.height

/** Whether `inner`, a run's box, stands inside `outer`, give or take `EDGE`. */
const inside = (inner: PdfBox, outer: { readonly x: number; readonly top: number; readonly width: number; readonly height: number }): boolean =>
  inner.x >= outer.x - EDGE &&
  inner.top >= outer.top - EDGE &&
  inner.x + inner.width <= outer.x + outer.width + EDGE &&
  inner.bottom <= outer.top + outer.height + EDGE

/** A chart's box on the page it was drawn on, from its top left, in points. */
interface Placed {
  readonly page: PdfPage
  readonly x: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** Where `chart` was drawn: the one clip, on any page, of its box's size, which the converter sets as its viewport; PDF.js reads a clip's box in single precision. */
function placedOf(read: ReadPdf, chart: Chart): Placed {
  const found = read.pages.flatMap((page) =>
    page.clips.filter(({ width, height }) => Math.abs(width - chart.width) < 1e-3 && Math.abs(height - chart.height) < 1e-3).map((clip) => ({ page, ...clip })),
  )
  expect(
    found.map(({ page }) => page.number),
    `the clips of the chart ${chart.id}'s size`,
  ).toHaveLength(1)
  const { page, x, top } = found[0]!
  return { page, x, top, width: chart.width, height: chart.height }
}

/**
 * The runs `box` holds on its page, held to `words`, each where the
 * drawing boxed it: every run inside one word's box, on its baseline --
 * the box's top and the face's ascent below it, where pdfmake sets a
 * line's -- and each word its runs, in the order the page draws them,
 * their text the word's and their extent its left and its advance, each
 * within `EDGE`. PDF.js reads a word of spaces in some faces as a run
 * for each part, and in others as one. Each run is returned with its word.
 */
function printedAt(box: Placed, words: readonly PlacedWord[], what: string): readonly { readonly run: PdfTextItem; readonly word: PlacedWord }[] {
  const runs = box.page.items.filter((item) => inside(item, box))
  const boxed = words.map((word) => ({ word, left: box.x + word.x, baseline: box.top + word.top + word.face.ascent }))
  const owner = (run: PdfTextItem): number =>
    boxed.findIndex(
      ({ word, left, baseline }) => Math.abs(baselineOf(run) - baseline) <= EDGE && run.x >= left - EDGE && run.x + run.width <= left + word.width + EDGE,
    )
  const owners = runs.map(owner)
  expect(
    runs.filter((_, index) => owners[index]! < 0).map(({ text }) => text),
    `${what}: runs in no word's box`,
  ).toEqual([])
  expect(owners, `${what}: the order the page draws its words in`).toEqual([...owners].sort((a, b) => a - b))
  boxed.forEach(({ word, left, baseline }, index) => {
    const own = runs.filter((_, at) => owners[at] === index)
    expect(own.map(({ text }) => text).join(' '), `${what}: ${word.key}`).toBe(word.text)
    const right = Math.max(...own.map((run) => run.x + run.width))
    for (const [read, placed, measure] of [
      [own[0]!.x, left, 'left'],
      [baselineOf(own[0]!), baseline, 'baseline'],
      [right - own[0]!.x, word.width, 'advance'],
    ] as const)
      expect(Math.abs(read - placed), `${what}: ${word.key}'s ${measure}`).toBeLessThanOrEqual(EDGE)
  })
  return runs.map((run, index) => ({ run, word: words[owners[index]!]! }))
}

/** `chart`'s words read back at their boxes in `read`, wherever it was drawn, and nothing of it on another page: its box, and each run it prints with its word. */
function expectDrawn(read: ReadPdf, chart: Chart): Placed & { readonly printed: ReturnType<typeof printedAt> } {
  const box = placedOf(read, chart)
  return { ...box, printed: printedAt(box, drawingOf(chart.id).words, `the chart ${chart.id}`) }
}

/** The PDF of `document`, read. */
const readOf = async (document: ResolvedDocument): Promise<ReadPdf> => readPdf(await renderPdf(document, OPTIONS))

/** A copy of `chart` under another id and in another box, so that it is told apart by its size. */
const sized = (chart: AxisChart, id: string, width: number, height: number): AxisChart => ({ ...chart, id, width, height })

/** The PostScript name a host face draws in, as the renderer reads it. */
function postScriptName(asset: FontAsset): string {
  const read = readFont(asset.bytes)
  if (!read.ok) throw new Error(read.message)
  return read.names.postScriptName
}

/** A font's name in the PDF without its subset prefix. */
const unprefixed = (name: string): string => name.replace(/^[A-Z]{6}\+/, '')

/** `size` to the thousandth of a point: where a box is read back, past the rounding of a page's coordinates. */
const thousandths = (size: number): number => Math.round(size * 1000) / 1000

/** Roboto's line, as a multiple of the font size: its ascender less its descender, 2400 of its 2048 units. */
const ROBOTO_LINE = 2400 / 2048

/** A host face's line, as a multiple of the font size, as its horizontal header gives it. */
function lineOf(asset: FontAsset): number {
  const read = readFont(asset.bytes)
  if (!read.ok) throw new Error(read.message)
  const { ascender, descender, unitsPerEm } = read.metrics
  return (ascender - descender) / unitsPerEm
}

/** Where a `documentOf` body starts in a face of `line`: the top margin, the page header's one 8-point line, and the gap under it; 51.375 points down in Roboto. */
const bodyTop = (line: number): number => PAGE.margins.top + 8 * line + 6
const BODY_TOP = bodyTop(ROBOTO_LINE)

describe('a chart in the document', () => {
  // C10: pdfmake places a word detached from the flow where its offset
  // from the chart's top left says, but fits it against the room where it
  // stands (pdfmake.test.ts): a word laid out after a drawing that took
  // the flow's room would be fitted against what is left below it, and
  // printed on the next page without its chart, and one before the
  // drawing painted under its marks. Every word of a bar chart, a pie and
  // two lines is read back at its box, within EDGE, wherever the chart
  // stands -- at the body's top, in a column beside a spacer, in a framed
  // section, and in a keep-together block under a paragraph that moved to
  // a second page -- in Roboto, and in Liberation Serif mapped as sans.
  // Measured on 13 November 2026, Node 22.23.4 on an Apple M2: every word
  // read back within half a millionth of a point of its box: PDFKit
  // writes a number to six places.
  test.each([
    ['Roboto', undefined, ROBOTO_LINE],
    ['Liberation Serif mapped as sans', { sans: SERIF }, lineOf(SERIF.normal)],
  ] as const)(
    'draws each word where Task 20 boxed it, within EDGE, in the body, a column, a section and a keep-together block: %s',
    async (_, fonts, line) => {
      const kept = sized(BARS, 'kept', 280, 180)
      const column = sized(LINE, 'column', 230, 150)
      const framed = sized(LINE, 'framed', 240, 140)
      const body: Block[] = [
        BARS,
        {
          kind: 'columns',
          columns: [
            { width: 220, blocks: [PIE] },
            { width: 'fill', blocks: [{ kind: 'spacer', height: 12 }, column] },
          ],
        },
        { kind: 'section', padding: 6, border: { thickness: 1, color: '#000000' }, blocks: [framed] },
        { kind: 'keepTogether', blocks: [paragraph('Kept with its chart'), kept] },
      ]
      const read = await readOf({ ...documentOf('Charts', body), ...(fonts === undefined ? {} : { fonts }) })
      const boxes = [BARS, PIE, column, framed, kept].map((chart) => expectDrawn(read, chart))
      // Where each stands: at the body's top, beside a column 220 points wide, 12 points down; in a section, inside its frame; and the kept block on the next page, under its paragraph.
      const top = bodyTop(line)
      expect(boxes.map(({ page, x, top: at }) => [page.number, x, at].map(thousandths))).toEqual(
        [
          [1, PAGE.margins.left, top],
          [1, PAGE.margins.left, top + BARS.height],
          [1, PAGE.margins.left + 220, top + BARS.height + 12],
          [1, PAGE.margins.left + 7, top + BARS.height + PIE.height + 7],
          [2, PAGE.margins.left, top + 9 * line],
        ].map((each) => each.map(thousandths)),
      )
    },
    TIMEOUT,
  )

  // A word painted before the drawing would lie under its marks -- a
  // value's label under its bar, a legend entry under its swatch -- and
  // print hidden where it was proved present. The drawing's paths are
  // every one painted before the first of its words is shown.
  test(
    "paints a chart's words after its marks",
    async () => {
      const pdf = await renderPdf(bareDocument('Charts', [BARS, PIE]), OPTIONS)
      const read = await readPdf(pdf)
      const [page] = readDrawing(pdf)
      for (const chart of [BARS, PIE]) {
        const box = placedOf(read, chart)
        const held = (x: number, top: number, width = 0, height = 0): boolean =>
          x >= box.x - EDGE && top >= box.top - EDGE && x + width <= box.x + box.width + EDGE && top + height <= box.top + box.height + EDGE
        const marks = page!.shapes.filter((shape) => held(shape.x, shape.top, shape.width, shape.height))
        const words = page!.text.filter((run) => held(run.x, run.baseline))
        expect(marks.length, chart.id).toBeGreaterThan(0)
        expect(words, chart.id).toHaveLength(drawingOf(chart.id).words.length)
        expect(Math.min(...words.map(({ painted }) => painted)), chart.id).toBeGreaterThan(Math.max(...marks.map(({ paint }) => paint)))
      }
    },
    TIMEOUT,
  )

  // A chart as tall as the body fills the page, its lowest words -- the
  // legend's, the category axis's title -- at its foot: fitted against the
  // room left below the drawing, they would go to the next page without
  // it. Every word prints on the chart's page, at its box.
  test(
    'draws a chart as tall as the body, its words on its page',
    async () => {
      const tall = sized(BARS, 'tall', 300, BODY_HEIGHT)
      const read = await readOf(documentOf('Chart', [tall]))
      expect(read.pages).toHaveLength(1)
      const box = expectDrawn(read, tall)
      expect(box.top + box.height).toBeCloseTo(BODY_TOP + BODY_HEIGHT, 6)
    },
    TIMEOUT,
  )

  // A heading kept with a chart that moves to the next page would be left
  // at the foot of the page before, over nothing: pdfmake records where a
  // node of an unbreakable block starts on the page its layout began on,
  // and corrects it once it moves the block only for text with an id
  // (pdfmake.test.ts), never for a drawing, which is the first thing a
  // chart paints. So the heading is kept with the chart's first word, and
  // moves with it, as it is with a keep-together block's first text
  // (`flow.test.ts`). A chart that prints no word has none to keep it
  // with, and leaves it behind (`flow.test.ts` holds that limitation).
  test(
    "keeps a heading kept with a chart that prints a word on the chart's page, by its first word",
    async () => {
      const room = 120
      const filler: Block = { kind: 'spacer', height: BODY_HEIGHT - room }
      const read = await readOf(documentOf('Chart', [filler, heading('Kept heading'), BARS]))
      const box = expectDrawn(read, BARS)
      expect(box.page.number).toBe(2)
      const headings = read.pages.map((page) => page.items.filter(({ text }) => text === 'Kept heading').length)
      expect(headings).toEqual([0, 1])
      expect(box.page.items.find(({ text }) => text === 'Kept heading')!.bottom).toBeLessThanOrEqual(box.top)
    },
    TIMEOUT,
  )

  // A keep-together block is measured before it is laid out, and refused
  // where no page holds it: a chart measured as its words alone, or as its
  // drawing and its box both, would pass a block no page holds, or refuse
  // one a page does. A block of a paragraph and a chart is as tall as its
  // line and the chart's box: a point under the body it is drawn on one
  // page, and a point over it is refused, saying so.
  test(
    'measures a keep-together block holding a chart as its box',
    async () => {
      const line = 9 * ROBOTO_LINE
      const kept = (height: number): Block => ({ kind: 'keepTogether', blocks: [paragraph('Kept'), sized(BARS, 'kept', 300, height)] })
      const read = await readOf(documentOf('Chart', [kept(BODY_HEIGHT - line - 1)]))
      expect(read.pages).toHaveLength(1)
      expectDrawn(read, sized(BARS, 'kept', 300, BODY_HEIGHT - line - 1))
      await expect(renderPdf(documentOf('Chart', [kept(BODY_HEIGHT - line + 1)]), OPTIONS)).rejects.toMatchObject({
        code: 'content-too-large',
        subject: 'body[0]',
        message: `the keep-together block body[0] is ${(BODY_HEIGHT + 1).toFixed(2)} pt tall; a page's body is ${BODY_HEIGHT.toFixed(2)} pt where it stands`,
      })
    },
    TIMEOUT,
  )

  // Q4: the converter opens a <text>'s font by the name pdfmake gives it,
  // past pdfmake's local access policy, with Node's file system -- a host
  // face's virtual file, which is no file, or anything a drawing named. A
  // chart's drawing holds no word: every SVG the render hands pdfmake is
  // free of <text>, and the render reads no file but Roboto's, in Roboto
  // and with a host face mapped as sans.
  test(
    "hands the converter a chart's SVG with no <text>, and opens no file for it in Node",
    async () => {
      const roboto = path.join(path.dirname(createRequire(import.meta.url).resolve('pdfmake/package.json')), 'fonts', 'Roboto')
      const svgs: string[] = []
      const watched: Engine = {
        ...engine,
        run: (definition, host, finish) => {
          svgs.push(...svgsOf(definition))
          return engine.run(definition, host, finish)
        },
      }
      for (const fonts of [undefined, { sans: SERIF }] as const) {
        svgs.length = 0
        const spy = vi.spyOn(fs, 'readFileSync')
        try {
          await render(watched, { ...documentOf('Charts', [BARS, PIE, LINE]), ...(fonts === undefined ? {} : { fonts }) }, OPTIONS)
          const read = [...new Set(spy.mock.calls.map(([file]) => path.resolve(String(file))))]
          expect(read.filter((file) => path.dirname(file) !== roboto)).toEqual([])
        } finally {
          spy.mockRestore()
        }
        expect(svgs).toHaveLength(3)
        expect(svgs.filter((svg) => svg.includes('<text'))).toEqual([])
      }
    },
    TIMEOUT,
  )

  // A word is placed by the advance the drawing measured it in, and
  // printed in the advance pdfmake measures: were the two to differ, the
  // word would print past the room ECharts left it, over its neighbour,
  // and nothing on the drawing's side would see it. Each word is held to
  // its box's width once pdfmake has measured it (`words.ts`): a drawing
  // that boxed a word a point narrower than it prints is refused, naming
  // the chart, before a line is laid out.
  test(
    'holds each word to the advance the drawing placed it by, and refuses one pdfmake measures wider',
    async () => {
      const actual = (await vi.importActual<typeof import('./chart-draw.js')>('./chart-draw.js')).drawChart
      vi.mocked(drawChart).mockImplementationOnce((chart, faces, widths) => {
        const drawn = actual(chart, faces, widths)
        return { ...drawn, words: drawn.words.map((word) => (word.key === 'category/0' ? { ...word, width: word.width - 1 } : word)) }
      })
      const outcome = await renderPdf(documentOf('Chart', [BARS]), OPTIONS).then(
        () => 'rendered',
        (error: unknown) => error,
      )
      const word = drawingOf(BARS.id).words.find(({ key }) => key === 'category/0')!
      expect(outcome).toMatchObject({
        code: 'content-too-large',
        subject: BARS.id,
        message: `a word of the chart sales is ${(word.width + 1).toFixed(2)} pt wide as pdfmake measures it, and the drawing placed it in ${word.width.toFixed(2)} pt: a chart's word prints in the advance it was laid out by, or not at all`,
      })
      expect((outcome as Error).message).not.toContain(word.text)
    },
    TIMEOUT,
  )

  // The converter draws on past what it cannot, saying so to the console,
  // and opens an <image>'s file past pdfmake's policy (pdfmake.test.ts):
  // a chart's drawing holds neither, being held to what ECharts was seen
  // to write (`chart-svg.ts`), and a converter that warned of it, or was
  // asked to open an image, would be drawing something else. Both of its
  // callbacks refuse, naming the chart and quoting nothing of the drawing.
  test.each([
    [
      'warns',
      svg('<clipPath id="c"><rect clip-path="url(#c)" width="1" height="1"/></clipPath><rect width="10" height="10" clip-path="url(#c)"/>'),
      "pdfmake's SVG converter could not draw the chart sales as ECharts laid it out: it warned, and the renderer draws a chart whole or not at all",
    ],
    [
      'would open an image',
      svg('<image href="secret.png" width="10" height="10"/>'),
      "ECharts' drawing of the chart sales asks pdfmake's SVG converter to open an image, which the renderer never lets it do",
    ],
  ] as const)('refuses a drawing the converter %s, naming the chart', async (_, drawing, message) => {
    vi.mocked(drawChart).mockImplementationOnce(() => ({ svg: drawing, words: [] }))
    await expect(renderPdf(documentOf('Chart', [BARS]), OPTIONS)).rejects.toMatchObject({ code: 'unsupported', subject: BARS.id, message })
  })
})

/** Every SVG `definition` hands pdfmake's converter, from its content. */
function svgsOf(definition: TDocumentDefinitions): string[] {
  const found: string[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(walk)
    else if (typeof node === 'object' && node !== null) {
      const { svg } = node as { readonly svg?: unknown }
      if (typeof svg === 'string') found.push(svg)
      Object.values(node).forEach(walk)
    }
  }
  walk(definition.content)
  return found
}

describe('a chart of each kind, in the report’s faces', () => {
  // The spec's success: a chart's words are the report's, in its fonts --
  // every word one text item, in the face it prints in, the title bold --
  // and a face is embedded once however many charts and paragraphs print
  // in it. Roboto's bold is its Medium; Liberation Serif mapped as sans
  // prints the charts, the page header and the footer alike.
  test.each([
    ['Roboto', undefined, 'Roboto-Regular', 'Roboto-Medium'],
    ['Liberation Serif mapped as sans', { sans: SERIF }, postScriptName(SERIF.normal), postScriptName(SERIF.bold!)],
  ] as const)(
    'draws a chart of each kind, every word a text item in the face it prints in, each face embedded once: %s',
    async (_, fonts, regular, bold) => {
      const read = await readOf({ ...documentOf('Charts', [BARS, PIE, LINE]), ...(fonts === undefined ? {} : { fonts }) })
      for (const chart of [BARS, PIE, LINE]) {
        const { printed } = expectDrawn(read, chart)
        expect(
          printed.map(({ run }) => unprefixed(run.font)),
          chart.id,
        ).toEqual(printed.map(({ word }) => (word.title ? bold : regular)))
        expect(printed.some(({ word }) => word.title)).toBe(true)
      }
      const names = read.fonts.map(({ name }) => unprefixed(name))
      expect(new Set(names).size).toBe(names.length)
      expect(names.sort()).toEqual([bold, regular].sort())
      expect(read.fonts.every(({ embedded }) => embedded)).toBe(true)
    },
    TIMEOUT,
  )

  // A chart's words take its style's colour, as a paragraph's do, and
  // print black where it names none: none is left to ECharts' theme,
  // whose words are a grey. Every run of a chart in a colour is shown in
  // it, its title's too, and every run of one in none in black.
  test(
    "prints a chart's words in its style's colour, and black where it names none",
    async () => {
      const coloured: AxisChart = { ...BARS, style: { color: '#336699' } }
      const pdf = await renderPdf(bareDocument('Charts', [coloured, PIE]), OPTIONS)
      const read = await readPdf(pdf)
      const [page] = readDrawing(pdf)
      for (const [chart, color] of [
        [coloured, '#336699'],
        [PIE, '#000000'],
      ] as const) {
        const { printed } = expectDrawn(read, chart)
        const shown = printed.map(({ run }) => page!.text.find((each) => Math.abs(each.x - run.x) < 1e-3 && Math.abs(each.baseline - baselineOf(run)) < 1e-3))
        expect(
          shown.map((each) => each?.color),
          chart.id,
        ).toEqual(printed.map(() => color))
      }
    },
    TIMEOUT,
  )

  // A slice of no share -- a zero, or a value under one part in 10^17 of
  // its pie's total -- is drawn as nothing (`chart-draw.test.ts`): a path
  // in its colour from the pie's centre to its rim would print as a
  // hairline where a rasteriser paints every pixel a shape touches. In the
  // PDF of a pie with a zero slice and of one with a slice that small,
  // each slice with a share is one path filled in its colour, a slice
  // without one is none, and every legend entry's swatch is filled and
  // stroked in its slice's colour, its words printed at their boxes.
  test(
    "draws nothing of a pie's slice of no share, and prints its legend entry",
    async () => {
      const small: PieChart = {
        ...PIE,
        id: 'small-share',
        width: 220,
        height: 180,
        slices: [value('1'), value('1'), value('0.00000000000000001')].map((each, index) => ({ color: PIE.slices[index]!.color, value: each })),
        legend: ['North: 1 (50.0 %)', 'South: 1 (50.0 %)', 'East: 0.00000000000000001 (0.0 %)'].map((text, index) => ({
          color: PIE.slices[index]!.color,
          text,
        })),
      }
      const read = await readOf(bareDocument('Pies', [PIE, small]))
      for (const chart of [PIE, small]) {
        const box = expectDrawn(read, chart)
        const paths = box.page.paths.filter((each) => inside(each, box))
        expect(
          chart.slices.map(({ color }) => [
            paths.filter(({ paint, fill }) => paint === 'fill' && fill === color).length,
            paths.filter(({ paint, fill, stroke }) => paint === 'fillStroke' && fill === color && stroke === color).length,
          ]),
          chart.id,
        ).toEqual([
          [1, 1],
          [1, 1],
          [0, 1],
        ])
      }
    },
    TIMEOUT,
  )
})

/** `EMPTY` without its title: its empty text alone. */
const { title: _untitled, ...untitled } = EMPTY
const UNTITLED: AxisChart = untitled

describe('a chart with nothing to draw', () => {
  /** A bare document of `chart` alone, at the top of the body, 36 points down and 40 in. */
  const alone = (chart: Chart): ResolvedDocument => bareDocument('Empty', [chart, paragraph('After')])

  // R7, R8: a chart with nothing to draw reserves its box and prints its
  // title and its empty text -- the report's words -- and nothing else: no
  // axis, no mark, never handed to ECharts. The title stands at the top,
  // its padding below the box's, centred across it, bold; the empty text
  // in the middle of the box; and what follows the chart, under its box.
  // Without a title, its empty text alone.
  test(
    "prints an empty chart's title and empty text in its box, and draws no mark",
    async () => {
      for (const chart of [EMPTY, UNTITLED]) {
        const pdf = await renderPdf(alone(chart), OPTIONS)
        const read = await readPdf(pdf)
        const [page] = read.pages
        const box = { x: PAGE.margins.left, top: PAGE.margins.top, width: chart.width, height: chart.height }
        const runs = page!.items.filter((item) => inside(item, box))
        const expected = chart.title === undefined ? ['No data'] : ['Balance', 'No data']
        expect(runs.map(({ text }) => text)).toEqual(expected)
        const [line, ascent] = [8 * ROBOTO_LINE, 8 * (1900 / 2048)]
        for (const run of runs) expect(Math.abs(run.x + run.width / 2 - (box.x + box.width / 2)), run.text).toBeLessThanOrEqual(EDGE)
        const empty = runs.at(-1)!
        expect(Math.abs(baselineOf(empty) - (box.top + (box.height - line) / 2 + ascent))).toBeLessThanOrEqual(EDGE)
        if (chart.title !== undefined) {
          expect(Math.abs(baselineOf(runs[0]!) - (box.top + TITLE_PADDING + ascent))).toBeLessThanOrEqual(EDGE)
          expect(unprefixed(runs[0]!.font)).toBe('Roboto-Medium')
        }
        expect(unprefixed(empty.font)).toBe('Roboto-Regular')
        expect(page!.paths.filter((each) => inside(each, box))).toEqual([])
        expect(page!.clips).toEqual([])
        expect(page!.items.find(({ text }) => text === 'After')!.top).toBeGreaterThanOrEqual(box.top + box.height - EDGE)
        expect(vi.mocked(drawChart)).not.toHaveBeenCalled()
      }
    },
    TIMEOUT,
  )

  // An empty chart's words are held as a drawn chart's are: one that would
  // leave the box would print over what stands beside or under it, and two
  // that meet, the one over the other. Refused, naming the chart and its
  // box: a box too short for its title and its empty text one above the
  // other, too short for one line, or too narrow for its empty text.
  test.each([
    ['too short for both its words', { ...EMPTY, style: { size: 30 } }, 'has two words that would meet'],
    ['too short for a line', { ...UNTITLED, style: { size: 96 } }, 'has a word that would leave its box'],
    ['too narrow for its empty text', { ...EMPTY, width: 20 }, 'has a word that would leave its box'],
  ] as const)('refuses an empty chart whose words would meet or leave its box: %s', async (_, chart, has) => {
    await expect(renderPdf(alone(chart), OPTIONS)).rejects.toMatchObject({
      code: 'content-too-large',
      subject: 'nothing',
      message: `the chart nothing, ${String(chart.width)} by ${String(chart.height)} points, ${has}`,
    })
  })

  // A chart's title stands where every chart's does: an empty chart
  // beside a drawn one, its title at another height, reads as a page of
  // two charts set by two hands. The drawn chart's title is placed by
  // ECharts, its padding the option's, and the empty chart's by the
  // renderer, from the same padding: side by side at the body's top, in
  // one face, their titles' runs stand at one top.
  test(
    "sets an empty chart's title where a drawn chart's stands",
    async () => {
      const read = await readOf(
        bareDocument('Titles', [
          {
            kind: 'columns',
            columns: [
              { width: BARS.width, blocks: [BARS] },
              { width: 'fill', blocks: [EMPTY] },
            ],
          },
        ]),
      )
      const top = (text: string): number => read.pages[0]!.items.find((item) => item.text === text)!.top
      expect(thousandths(top('Balance'))).toBe(thousandths(top('Sales')))
    },
    TIMEOUT,
  )

  // The box's edge is the edge: a box exactly as wide as its empty text
  // holds it, from its left edge to its right, and one a half point
  // narrower, a quarter point past either side, is refused.
  test('holds an empty chart to the very width of its empty text', async () => {
    const widths = await engine.widths({ families: {}, files: new Map() }, [{ family: 'Roboto', face: 'normal' }])
    const exact = widths.width('Roboto', 'normal', 8, 'No data')
    const read = await readOf(alone({ ...UNTITLED, width: exact }))
    const [run] = read.pages[0]!.items.filter(({ text }) => text === 'No data')
    expect(Math.abs(run!.x - PAGE.margins.left)).toBeLessThanOrEqual(EDGE)
    await expect(renderPdf(alone({ ...UNTITLED, width: exact - 0.5 }), OPTIONS)).rejects.toMatchObject({
      code: 'content-too-large',
      message: `the chart nothing, ${String(exact - 0.5)} by 100 points, has a word that would leave its box`,
    })
  })
})

describe('a chart across pages', () => {
  /** `BARS`, 280 points wide, so that it stands in a column beside one of 220 too. */
  const chart = sized(BARS, BARS.id, 280, BARS.height)
  /** A spacer that leaves a page 100 points, less than the chart's 200, then `blocks`, then a paragraph after them. */
  const footOf = (...blocks: Block[]): Block[] => [{ kind: 'spacer', height: BODY_HEIGHT - 100 }, ...blocks, paragraph('After')]

  // Review Focus 4: a chart that does not fit at the foot of a page is
  // drawn whole on the next, its words with it, wherever it stands --
  // cut, its lower half or its lowest words would print on another page
  // than the rest, and the page before would hold a drawing's top and no
  // word of it. In the body; in a column, which moves to the next page
  // while the column beside it stays, its paragraph where it was; in a
  // framed section, under its paragraph, which stays, the frame drawn
  // again around the chart on the next page; and in a keep-together
  // block, which moves whole, its paragraph with it. What follows prints
  // under the chart.
  test.each([
    ['in the body', footOf(chart), [PAGE.margins.left, BODY_TOP], [], []],
    [
      'in a column, beside one that stays',
      footOf({
        kind: 'columns',
        columns: [
          { width: 220, blocks: [paragraph('Left side')] },
          { width: 'fill', blocks: [chart] },
        ],
      }),
      [PAGE.margins.left + 220, BODY_TOP],
      ['Left side'],
      [],
    ],
    [
      'in a framed section, under its paragraph',
      footOf({ kind: 'section', padding: 6, border: { thickness: 1, color: '#000000' }, blocks: [paragraph('In the frame'), chart] }),
      [PAGE.margins.left + 7, BODY_TOP + 7],
      ['In the frame'],
      [],
    ],
    [
      'in a keep-together block',
      footOf({ kind: 'keepTogether', blocks: [paragraph('Kept with it'), chart] }),
      [PAGE.margins.left, BODY_TOP + 9 * ROBOTO_LINE],
      [],
      ['Kept with it'],
    ],
  ] as const)(
    "moves a chart that does not fit at the page's foot to the next page whole, its words with it, %s",
    async (_, body, [x, top], stays, moves) => {
      const read = await readOf(documentOf('Chart', body))
      const box = expectDrawn(read, chart)
      expect([box.page.number, thousandths(box.x), thousandths(box.top)]).toEqual([2, thousandths(x), thousandths(top)])
      const words = new Set(drawingOf(chart.id).words.map(({ text }) => text))
      const [first, second] = read.pages as [PdfPage, PdfPage]
      expect(first.items.filter(({ text }) => words.has(text))).toEqual([])
      expect(first.paths.filter(({ fill }) => chart.series.some(({ color }) => color === fill))).toEqual([])
      const on = (page: PdfPage, text: string): PdfTextItem | undefined => page.items.find((item) => item.text === text)
      expect(stays.filter((text) => on(first, text) === undefined)).toEqual([])
      expect(moves.filter((text) => on(second, text) === undefined || on(second, text)!.bottom > box.top)).toEqual([])
      expect(on(second, 'After')!.top).toBeGreaterThanOrEqual(box.top + box.height - EDGE)
    },
    TIMEOUT,
  )
})

describe('a render of charts', () => {
  /** A document of every kind of chart and an empty one, in `fonts`. */
  const charted = (fonts?: ResolvedFonts): ResolvedDocument => ({
    ...documentOf('Charts', [BARS, PIE, LINE, EMPTY]),
    ...(fonts === undefined ? {} : { fonts }),
  })
  const UNRUN = path.join(path.dirname(createRequire(import.meta.url).resolve('unrun/package.json')), 'dist', 'cli.mjs')
  const CHILD = fileURLToPath(new URL('testing/render-child.ts', import.meta.url))

  /** `document` rendered by the Node entry in a process of its own (`render-child.ts`). */
  const inChild = (document: ResolvedDocument): Buffer =>
    Buffer.from(execFileSync(process.execPath, [UNRUN, CHILD], { input: toWire(document), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }), 'base64')

  // 0003's determinism, on charts: a PDF that differs from one render to
  // the next, or from one process to another, cannot be found again by its
  // digest, nor a preview compared with a server's PDF. zrender keeps the
  // widths it measured for the process, and the ids it writes count up
  // from one layout to the next: a chart laid out by a process that has
  // laid one out already, or by one that has not, is the same chart.
  test(
    'renders a document with charts to the same bytes twice, and in another process',
    async () => {
      for (const document of [charted(), charted({ sans: SERIF })]) {
        // The child reads the document the test renders, its faces' bytes and all.
        expect(fromWire(toWire(document))).toEqual(document)
        const first = Buffer.from(await renderPdf(document, OPTIONS))
        const second = Buffer.from(await renderPdf(document, OPTIONS))
        expect(second.equals(first)).toBe(true)
        expect(inChild(document).equals(first)).toBe(true)
      }
    },
    TIMEOUT,
  )

  // 0043 and Task 18b's M5: nothing a render measured by outlives it. Two
  // renders in one process, under one token mapped to two host faces --
  // Liberation Serif, then Liberation Mono, whose words are wider -- each
  // lay their charts out in their own face: each word at its box in its
  // own face's advance, and the legend's entries as far apart as their own
  // advances say, which a layout measured in the other face's widths, kept
  // by zrender or by the render, would not set them. And once each render
  // has ended, the widths it opened -- the measuring document's faces --
  // are let go: no render holds the one before it.
  test(
    "measures each render's charts in its own faces, and keeps nothing of them once it ends",
    async () => {
      const opened: WeakRef<FaceWidths>[] = []
      const watched: Engine = {
        ...engine,
        widths: async (host, faces) => {
          const widths = await engine.widths(host, faces)
          opened.push(new WeakRef(widths))
          return widths
        },
      }
      const gaps: number[][] = []
      for (const faces of [SERIF, MONO]) {
        vi.mocked(drawChart).mockClear()
        const read = await readPdf(await render(watched, { ...documentOf('Charts', [BARS, PIE]), fonts: { sans: faces } }, OPTIONS))
        const own = new Set([postScriptName(faces.normal), postScriptName(faces.bold!)])
        for (const chart of [BARS, PIE]) expect(expectDrawn(read, chart).printed.filter(({ run }) => !own.has(unprefixed(run.font)))).toEqual([])
        const legend = drawingOf(BARS.id).words.filter(({ key }) => key.startsWith('legend/'))
        gaps.push(legend.slice(1).map((entry, index) => entry.x - (legend[index]!.x + legend[index]!.width)))
        vi.mocked(drawChart).mockClear()
        expect(opened).toHaveLength(gaps.length)
        expect(await collected(opened)).toBe(true)
      }
      // zrender writes a translation to four places.
      expect(gaps.flat().every((gap) => Math.abs(gap - gaps[0]![0]!) < 1e-3)).toBe(true)
    },
    TIMEOUT,
  )
})
