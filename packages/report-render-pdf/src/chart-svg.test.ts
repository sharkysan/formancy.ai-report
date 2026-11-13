import { RenderRefusal, type AxisChart, type ChartValue, type PieChart, type ResolvedFonts } from '@formancy/report-runtime'
import type { EChartsType } from 'echarts/core'
import { describe, expect, test } from 'vitest'
import type { ChartFaces } from './chart-faces.js'
import { withMeasurer } from './chart-measure.js'
import { chartOption, chartWords, type ChartLayout, type ChartWord } from './chart-option.js'
import { CHART_DRAWN, readChartSvg, type PlacedWord } from './chart-svg.js'
import type { FaceWidths } from './engine.js'
import { PDF_A_NESTING } from './svg-pdfa.js'
import { fixture, TIMEOUT } from './testing/documents.js'
import { layOut, measured, planned } from './testing/echarts.js'

/**
 * The SVG ECharts 6.1.0 writes of a chart, held and read back
 * (`chart-svg.ts`): each drawing here is ECharts' own, of the option the
 * drawing hands it (`chart-option.ts`), its words measured by the render's
 * measurer; a refusal's case edits that drawing in the one place it names.
 * Where a word stands is held to where zrender laid it out, read from
 * zrender's display list before the chart is disposed, which no public
 * interface answers.
 */

/** A value the runtime resolved: exactly, and as it prints. */
const value = (exact: string, text = exact): ChartValue => ({ exact, text })

/** The colour every chart here prints its words in. */
const INK = '#336699'

/** A plot of 220 by 160 points whose top is on a half point and whose height a whole multiple of four intervals. */
const PLOT = { left: 48, top: 30.5, width: 220, height: 160 } as const

/**
 * Two series of bars whose words zrender escapes or a reader might take
 * for markup -- a template, an ampersand, a tag, a quotation, an
 * apostrophe in a name and in a Swiss thousand -- a bar below zero, a
 * value missing, every value labelled, the axis's thousand a value's
 * too, and a legend of both.
 */
const MARKUP: AxisChart = {
  kind: 'chart',
  chart: 'bar',
  id: 'markup',
  width: 300,
  height: 240,
  title: 'Umsatz & <b>',
  categoryTitle: 'Region "Nord"',
  valueTitle: 'Betrag',
  categories: ['{a|b}', 'A & B', "O'Brien"],
  series: [
    { color: '#1f77b4', values: [value('300', '300.00'), value('-300', '-300.00'), null] },
    { color: '#ff7f0e', values: [value('1000', "1'000.00"), value('450', '450.00'), value('100', '100.00')] },
  ],
  ticks: [value('-500', '-500.00'), value('0', '0.00'), value('500', '500.00'), value('1000', "1'000.00"), value('1500', "1'500.00")],
  valueLabels: true,
  legend: [
    { text: 'Plan', color: '#1f77b4' },
    { text: 'Ist', color: '#ff7f0e' },
  ],
  style: { color: INK },
}

/** One line over four categories, below zero at one and with no value at another, every value labelled: ECharts clips it to its plot. */
const LINE: AxisChart = {
  kind: 'chart',
  chart: 'line',
  id: 'line',
  width: 300,
  height: 240,
  title: 'Saldo',
  categoryTitle: 'Monat',
  valueTitle: 'CHF',
  categories: ['Jan', 'Feb', 'Mär', 'Apr'],
  series: [{ color: '#2ca02c', values: [value('30', '30.00'), null, value('-30', '-30.00'), value('80', '80.00')] }],
  ticks: ['-50', '0', '50', '100', '150'].map((exact) => value(exact, `${exact}.00`)),
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
  height: 240,
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

/** Liberation Serif's faces, the corpus's host font, mapped as the report's serif. */
const SERIF = { serif: fixture('host-fonts').document.fonts!.serif! }

/** `chart` with each of its words, in `chartWords`' order, the next of `text`. */
function retexted(chart: AxisChart | PieChart, text: (index: number) => string): AxisChart | PieChart {
  let index = 0
  const next = (): string => text(index++)
  const title = next()
  const axes =
    chart.chart === 'pie'
      ? chart
      : {
          ...chart,
          categoryTitle: next(),
          valueTitle: next(),
          categories: chart.categories.map(next),
          ticks: chart.ticks.map(({ exact }) => value(exact, next())),
          series: chart.series.map((series) => ({ ...series, values: series.values.map((each) => (each === null ? null : value(each.exact, next()))) })),
        }
  return { ...axes, title, legend: chart.legend.map((entry) => ({ ...entry, text: next() })) }
}

/** A word zrender laid out: its text, and its box as zrender holds it, its transform applied. */
interface LaidWord {
  readonly text: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** What these cases read of an element on zrender's display list: a line of text is a `tspan`, its box in its own coordinates. */
interface Displayed {
  readonly type: string
  readonly style: { readonly text?: string }
  getBoundingRect(): { clone(): LaidWord & { applyTransform(matrix: readonly number[]): void } }
  getComputedTransform(): readonly number[] | null
}

/** Every word on `laid`'s display list, in the order zrender draws them, each with the box zrender laid it out in. */
function laidWords(laid: EChartsType): LaidWord[] {
  const { storage } = laid.getZr() as unknown as { readonly storage: { getDisplayList(update: boolean): readonly Displayed[] } }
  return storage.getDisplayList(true).flatMap((each) => {
    const text = each.style.text
    if (each.type !== 'tspan' || text === undefined || text === '') return []
    const box = each.getBoundingRect().clone()
    const matrix = each.getComputedTransform()
    if (matrix !== null) box.applyTransform(matrix)
    return [{ text, x: box.x, y: box.y, width: box.width, height: box.height }]
  })
}

/** A chart laid out as the drawing lays it out: the SVG ECharts wrote, its faces and widths, the words its layout prints, and the words zrender laid out. */
interface Drawn {
  readonly chart: AxisChart | PieChart
  readonly svg: string
  readonly faces: ChartFaces
  readonly widths: FaceWidths
  readonly printed: readonly ChartWord[]
  readonly laid: readonly LaidWord[]
}

/** A pie's square of 120 points in the middle of a box of 300 by 240, above its legend. */
const SQUARE = { left: 90, top: 50, width: 120, height: 120 } as const

/** `chart` laid out in `plot`, by default its plot or a pie's square, its words in `fonts`' faces or Roboto. */
async function drawn(
  chart: AxisChart | PieChart,
  fonts?: ResolvedFonts,
  plot: NonNullable<ChartLayout['plot']> = chart.chart === 'pie' ? SQUARE : PLOT,
): Promise<Drawn> {
  const layout: ChartLayout = { tickEvery: 1, plot }
  const { faces, widths } = await measured(planned(fonts), chart.style ?? {}, chart.title)
  const option = chartOption(chart, faces, layout)
  const { svg, read } = withMeasurer(faces, widths, () => layOut(option, chart.width, chart.height, laidWords))
  return { chart, svg, faces, widths, printed: chartWords(chart, layout), laid: read ?? [] }
}

/** `drawing` read back, its own SVG or `svg`, with the words its layout prints or `printed`. */
const readBack = (drawing: Drawn, svg = drawing.svg, printed = drawing.printed) => readChartSvg(svg, drawing.chart, printed, drawing.faces, drawing.widths)

/**
 * What `read` threw, which must be a refusal of the chart as `unsupported`,
 * saying of ECharts' drawing of it what `does` -- so that a case refused
 * for another reason than its own fails -- and quoting none of its words,
 * nor any of `quoted`.
 */
function refused(read: () => unknown, chart: AxisChart | PieChart, does: string, ...quoted: readonly string[]): void {
  let caught: unknown
  try {
    read()
  } catch (error) {
    caught = error
  }
  if (!(caught instanceof RenderRefusal)) throw new Error(`not refused: ${String(caught)}`)
  expect([caught.code, caught.subject]).toEqual(['unsupported', chart.id])
  expect(caught.message).toBe(
    `ECharts' drawing of the chart ${chart.id} ${does}: the renderer hands pdfmake's SVG converter only what ECharts 6.1.0 was seen to write, and prints only the words the runtime resolved, each once`,
  )
  for (const text of [...chartWords(chart).map((word) => word.text), ...quoted]) expect(caught.message).not.toContain(text)
}

/** What a refusal says of a drawing holding an attribute of a value ECharts does not write it with, on `element`. */
const VALUE = (element: string): string => `holds a value ECharts does not write an attribute of its <${element}> with`

/** What it says of a word ECharts wrote that the layout does not print, or not as often, or not in its face. */
const UNRESOLVED = 'holds a word the runtime did not resolve, one more often than it did, or one in another face than its own'

/** What it says of an entity zrender writes none of. */
const ENTITY = 'holds an entity or a character reference but the five zrender writes'

/** What it says of a number past the box of `MARKUP`, or of `PIE`, by more than its size. */
const PAST = 'holds a number past its box by more than its size, 300 by 240 points'

/** What it says of a clip by a path the drawing does not define once. */
const CLIP = 'clips by a path it does not define once'

/** Every start tag in `svg`, in order: its element, and its attributes as written. */
const tagsOf = (svg: string): (readonly [string, string])[] =>
  [...svg.matchAll(/<([A-Za-z]+)((?:\s+[^\s=>]+="[^"]*")*)\s*\/?>/g)].map(([, name = '', attributes = '']) => [name, attributes.trim()] as const)

/** A word's box, to compare with another's to a ten-thousandth: zrender writes a translation to four places. */
const boxOf = ({ text, x, top, width, height }: PlacedWord) => ({ text, x, top, width, height })

describe('the SVG ECharts writes of a chart', () => {
  // The converter is handed only what ECharts was seen to write; anything
  // else is a release of ECharts nobody read. A bar chart with every word
  // zrender escapes, a line with its gap and its clip, and a pie, each with
  // its titles and its legend: each reads whole, and together they hold
  // every element and attribute the list names, so that it names nothing
  // ECharts was not seen to write.
  test(
    "holds each kind's SVG to the elements and attributes ECharts 6.1.0 writes",
    async () => {
      const drawings = await Promise.all([MARKUP, LINE, PIE].map((chart) => drawn(chart)))
      for (const drawing of drawings) expect(readBack(drawing).words.map(({ key }) => key)).toEqual(drawing.printed.map(({ key }) => key))
      const seen = new Map<string, Set<string>>()
      for (const { svg } of drawings)
        for (const [name, attributes] of tagsOf(svg)) {
          const held = seen.get(name) ?? new Set<string>()
          for (const [, attribute = ''] of attributes.matchAll(/([^\s=]+)="/g)) held.add(attribute)
          seen.set(name, held)
        }
      const listed = (map: ReadonlyMap<string, ReadonlySet<string>>) => Object.fromEntries([...map].map(([name, held]) => [name, [...held].sort()]))
      expect(listed(seen)).toEqual(listed(CHART_DRAWN))
    },
    TIMEOUT,
  )

  // Each is something ECharts 6.1.0 does not write: a reference the
  // converter would follow out of the drawing, an element or a style sheet
  // it would draw as no chart's, a comment, a declaration or an entity
  // ECharts writes none of, text outside a word, a drawing inside the
  // drawing. Refused whole, naming the chart and quoting nothing of it.
  test.each([
    ['<image href="x"/>', 'holds an element ECharts writes none of'],
    ['<a href="x"><path d="M0 0"/></a>', 'holds an element ECharts writes none of'],
    ['<style>*{}</style>', 'holds a style sheet but its one of hover rules'],
    ['<foreignObject/>', 'holds an element ECharts writes none of'],
    ['<!-- x -->', 'holds a comment'],
    ['&nbsp;', ENTITY],
    ['<!DOCTYPE svg>', 'holds a DOCTYPE or a declaration'],
    ['<?xml-stylesheet href="x"?>', 'holds a processing instruction'],
    ['<![CDATA[<path d="M0 0"/>]]>', 'holds CDATA outside its one style sheet'],
    ['&apos;', ENTITY],
    ['&#38;', ENTITY],
    ['&#x26;', ENTITY],
    ['stray', 'holds text outside a word'],
    ['<svg width="300" height="240" viewBox="0 0 300 240"></svg>', 'holds an element inside its <svg>'],
    ['<use href="#zr0-c0"/>', 'holds an element ECharts writes none of'],
    ['<g><path d="M0 0"><path d="M0 0"></path></path></g>', 'holds an element inside its <path>'],
    ['<path d="M0 0"></path></path>', 'holds an end tag that ends no element it opened'],
    ['<g></g >', 'holds markup that is no end tag'],
    ['<path d=M0></path>', 'holds markup that is no element'],
    ['<path d="M0 0"/>', 'holds an element closed as it opens'],
  ])(
    'refuses %s',
    async (fragment, does) => {
      const drawing = await drawn(MARKUP)
      // An entity is written into a word, as zrender writes one; anything else after the last element.
      const edited = fragment.startsWith('&') ? drawing.svg.replace('>Betrag<', `>Betrag${fragment}<`) : drawing.svg.replace('</svg>', `${fragment}</svg>`)
      expect(edited).not.toBe(drawing.svg)
      refused(() => readBack(drawing, edited), MARKUP, does, fragment)
    },
    TIMEOUT,
  )

  // Each is a value or a shape ECharts 6.1.0 does not write: a number the
  // converter would write past a PDF's bounds, a drawing of another size
  // than the box pdfmake gives it, an attribute or a value nobody read,
  // markup that does not close as it opens, a word placed otherwise than
  // its box is read, a clip that clips by nothing the drawing defines.
  test.each<readonly [string, AxisChart | PieChart, (svg: string) => string, string]>([
    ['a number that is not finite', MARKUP, (svg) => svg.replace(/<path d="M[\d.]+ /, '<path d="M1e999 '), 'holds a number that is not finite'],
    ['a number past its box by more than its size', MARKUP, (svg) => svg.replace('translate(150 5)', 'translate(601 5)'), PAST],
    ['a number before its box by more than its size', MARKUP, (svg) => svg.replace('translate(150 5)', 'translate(-301 5)'), PAST],
    ['a point a relative step takes past its box by more than its size', MARKUP, (svg) => svg.replace(/(<path d="M-5 -5)l[\d.]+ 0/, '$1l606 0'), PAST],
    [
      'a point a relative step takes before its box by more than its size',
      MARKUP,
      (svg) => svg.replace(/(<path d="M-5 -5l[\d.]+ 0l0 [\d.]+)l-[\d.]+ 0/, '$1l-596 0'),
      PAST,
    ],
    // A curve's control points are drawn through as its ends are: the gridline at the plot's foot, curved.
    [
      'a curve through a point past its box by more than its size',
      MARKUP,
      (svg) => svg.replace('M48 190.5L268 190.5', 'M48 190.5C48 190.5 601 0 268 190.5'),
      PAST,
    ],
    [
      'a quadratic curve through a point before its box by more than its size',
      MARKUP,
      (svg) => svg.replace('M48 190.5L268 190.5', 'M48 190.5Q-301 0 268 190.5'),
      PAST,
    ],
    // A large arc of a radius that long sweeps round the far side of its circle, as far past the box.
    ['an arc of a radius longer than its box twice over', PIE, (svg) => svg.replace(/A60 60 /, 'A601 601 '), PAST],
    // ECharts draws every arc a circle's, unturned. An ellipse's too narrow to reach its end the converter widens as many times over
    // as it is too narrow, its far side as far past the box as that makes it, whatever its radii: a pie's slice in a box of 300 by
    // 240, its arc's radii 60 and 0.1, had svg-to-pdfkit write 32,224.74 for it, and at 60 and 60 nothing past 300 (13 November 2026).
    ['an arc of an ellipse', PIE, (svg) => svg.replace(/A60 60 /, 'A60 0.1 '), VALUE('path')],
    ['an arc turned', PIE, (svg) => svg.replace(/A60 60 0 /, 'A60 60 30 '), VALUE('path')],
    ['an svg of another width than its box', MARKUP, (svg) => svg.replace('width="300"', 'width="301"'), 'is of another size than its box'],
    ['a viewBox other than its box', MARKUP, (svg) => svg.replace('viewBox="0 0 300 240"', 'viewBox="0 0 300 120"'), 'is of another size than its box'],
    ['an svg without its viewBox', MARKUP, (svg) => svg.replace(' viewBox="0 0 300 240"', ''), 'holds its <svg> without an attribute it is read by'],
    ['an attribute written twice', MARKUP, (svg) => svg.replace('<rect ', '<rect fill="none" '), 'holds an attribute written twice on its <rect>'],
    [
      'an attribute ECharts was not seen to write',
      MARKUP,
      (svg) => svg.replace('<rect ', '<rect onload="x" '),
      'holds an attribute ECharts does not write its <rect> with',
    ],
    ['a value ECharts was not seen to write', MARKUP, (svg) => svg.replace('stroke-linecap="round"', 'stroke-linecap="inherit"'), VALUE('path')],
    ['a path of commands zrender does not write', MARKUP, (svg) => svg.replace(/<path d="M([\d.]+) /, '<path d="M$1 H'), VALUE('path')],
    [
      'a path command with more numbers than zrender writes it with',
      MARKUP,
      (svg) => svg.replace(/<path d="M([\d.]+) ([\d.]+)L/, '<path d="M$1 $2 0L'),
      VALUE('path'),
    ],
    ['a path that does not start where it moves', MARKUP, (svg) => svg.replace(/<path d="M([\d.]+) ([\d.]+)L/, '<path d="L$1 $2L'), VALUE('path')],
    ['an end tag that ends another element', MARKUP, (svg) => svg.replace('</path>', '</rect>'), 'holds an end tag that ends no element it opened'],
    ['an element left open', MARKUP, (svg) => svg.replace('</svg>', ''), 'holds an element left open, or no <svg>'],
    ['no drawing at all', MARKUP, () => '', 'holds an element left open, or no <svg>'],
    ['an element after its svg', MARKUP, (svg) => `${svg}<path d="M0 0"></path>`, 'holds an element outside its <svg>'],
    ['text after its svg', MARKUP, (svg) => `${svg}stray`, 'holds text outside a word'],
    ['a word not centred on its line', MARKUP, (svg) => svg.replace('dominant-baseline="central"', 'dominant-baseline="alphabetic"'), VALUE('text')],
    ['a word with no anchor', MARKUP, (svg) => svg.replace(' text-anchor="end"', ''), 'holds its <text> without an attribute it is read by'],
    ['a word in no face', MARKUP, (svg) => svg.replace(/ style="font-size:8px;[^"]*"/, ''), 'holds its <text> without an attribute it is read by'],
    ['a word in a font written whole', MARKUP, (svg) => svg.replace(/style="font-size:8px;[^"]*"/, 'style="font: 8px Roboto"'), VALUE('text')],
    [
      'a word with a character zrender escapes, unescaped',
      MARKUP,
      (svg) => svg.replace('O&#39;Brien', "O'Brien"),
      'holds a word with a character zrender escapes, unescaped',
    ],
    ['a clip by nothing the drawing defines', LINE, (svg) => svg.replace(/clip-path="url\(#[^)]*\)"/, 'clip-path="url(#elsewhere)"'), CLIP],
    ['a clip by an address', LINE, (svg) => svg.replace(/clip-path="url\(#[^)]*\)"/, 'clip-path="url(x.svg#c)"'), VALUE('g')],
    ['two clips of one id', LINE, (svg) => svg.replace('</defs>', `${/<clipPath[\s\S]*?<\/clipPath>/.exec(svg)?.[0] ?? ''}</defs>`), CLIP],
  ])(
    'refuses %s',
    async (_, chart, edit, does) => {
      const drawing = await drawn(chart)
      const edited = edit(drawing.svg)
      expect(edited).not.toBe(drawing.svg)
      refused(() => readBack(drawing, edited), chart, does)
    },
    TIMEOUT,
  )

  // A number past the box by no more than its own size is ECharts' own
  // reach -- a label's box pushed past the edge, a background's padding --
  // and far under what a PDF/A holds, so it reads. A relative step after a
  // close is taken, as the converter takes it, from where its path began:
  // the gridline from 48 to 268 at the plot's foot, closed, reaches 548
  // and -282 by steps of 500 and -330, not 768 from its end, nor -330
  // from the drawing's corner.
  test(
    'reads a number past its box by no more than its size',
    async () => {
      const drawing = await drawn(MARKUP)
      const gridline = '<path d="M48 190.5L268 190.5"'
      expect(drawing.svg).toContain(gridline)
      for (const edited of [
        ...['600 5', '-300 5', '150 540', '150 -300'].map((at) => drawing.svg.replace('translate(150 5)', `translate(${at})`)),
        ...['500', '-330'].map((step) => drawing.svg.replace(gridline, `<path d="M48 190.5L268 190.5Zl${step} 0"`)),
      ]) {
        expect(edited).not.toBe(drawing.svg)
        expect(readBack(drawing, edited).words).toHaveLength(drawing.printed.length)
      }
    },
    TIMEOUT,
  )

  // ECharts draws a title's and a legend's backgrounds from their corner by
  // relative steps -- across, down, and back across the whole width, its
  // padding of 5 points each side and all -- and the converter writes the
  // points they reach, never the steps. Read as a number of its own, the
  // step back across a title within 10 points of its box's side, or across
  // a pie's legend entry wider than its box, is longer than the box, and
  // would refuse a chart whose every point stands within its reach: the
  // title, 149.66 points wide in a box of 150 by 100, inside its box, and
  // the entry, each read whole and its own width.
  test(
    "reads a title within its padding of its box's side, and a legend entry wider than its box, by the points their backgrounds reach",
    async () => {
      const titled = await drawn(
        {
          kind: 'chart',
          chart: 'bar',
          id: 'narrow',
          width: 150,
          height: 100,
          title: 'Umsatz nach Region und Quartal 2024/25',
          categories: ['a', 'b'],
          series: [{ color: '#1f77b4', values: [value('1', '1.00'), value('2', '2.00')] }],
          ticks: [value('0', '0.00'), value('2', '2.00')],
          valueLabels: false,
          legend: [],
        },
        undefined,
        { left: 24, top: 20, width: 116, height: 60 },
      )
      const legended = await drawn(
        {
          kind: 'chart',
          chart: 'pie',
          id: 'narrow-pie',
          width: 150,
          height: 150,
          slices: PIE.slices.slice(0, 2),
          legend: [
            { text: 'Beratung und Projektleitung 50.00 (62.5 %)', color: '#1f77b4' },
            { text: 'Material 30.00 (37.5 %)', color: '#ff7f0e' },
          ],
        },
        undefined,
        { left: 45, top: 20, width: 60, height: 60 },
      )
      const read = [titled, legended].map((drawing) => {
        const backgrounds = [...drawing.svg.matchAll(/<path d="M-?[\d.]+ -?[\d.]+l([\d.]+) 0l0 [\d.]+l-\1 0Z"/g)].map(([, across = '']) => Number(across))
        expect(Math.max(...backgrounds)).toBeGreaterThan(Math.max(drawing.chart.width, drawing.chart.height))
        const { words } = readBack(drawing)
        expect(words.map(({ key }) => key)).toEqual(drawing.printed.map(({ key }) => key))
        for (const { text, face, width } of words) expect(width).toBe(drawing.widths.width(face.family, face.face, face.size, text))
        return words
      })
      const title = read[0]!.find(({ key }) => key === 'title')!
      expect([title.width, title.x, title.x + title.width]).toEqual([149.66015625, 75 - 149.66015625 / 2, 75 + 149.66015625 / 2])
      expect(read[1]!.find(({ key }) => key === 'legend/0')!.width).toBeGreaterThan(150)
    },
    TIMEOUT,
  )

  // A PDF/A nests the graphics state 28 deep at most, and the converter
  // nests one as it starts, one for the svg, one for every group and one
  // for every shape: ECharts' clip group of a line, held in 24 more,
  // nests its line 28 deep and reads; in 25 more, 29, and is refused.
  test(
    'refuses groups nested deeper than a PDF/A nests the graphics state',
    async () => {
      const drawing = await drawn(LINE)
      const nested = (groups: number): string =>
        drawing.svg.replace(/<g clip-path="[^"]*">[\s\S]*?<\/g>/, (group) => `${'<g>'.repeat(groups)}${group}${'</g>'.repeat(groups)}`)
      expect(readBack(drawing, nested(PDF_A_NESTING - 4)).words).toHaveLength(drawing.printed.length)
      refused(() => readBack(drawing, nested(PDF_A_NESTING - 3)), LINE, 'holds groups nested deeper than the 28 graphics states a PDF/A holds')
    },
    TIMEOUT,
  )

  // Every word ECharts writes is one the runtime resolved, placed once,
  // and every word the layout prints is placed: a word of ECharts' own, a
  // word twice, a word missing, or a word in a face not its own would
  // print what the report does not say, or leave out what it does.
  test(
    'refuses a word ECharts wrote that the runtime did not, and a word it did not write',
    async () => {
      const drawing = await drawn(MARKUP)
      const { svg, printed } = drawing
      const [betrag = ''] = /<text[^>]*>Betrag<\/text>/.exec(svg) ?? []
      expect(betrag).not.toBe('')
      const missing = `leaves out 1 of the ${String(printed.length)} words its layout prints`
      refused(() => readBack(drawing, svg.replace('>Betrag<', '>Gebiet<')), MARKUP, UNRESOLVED, 'Gebiet')
      refused(() => readBack(drawing, svg.replace('</svg>', `${betrag}</svg>`)), MARKUP, UNRESOLVED)
      refused(() => readBack(drawing, svg.replace(betrag, '')), MARKUP, missing)
      refused(
        () =>
          readBack(
            drawing,
            svg,
            printed.filter(({ key }) => key !== 'valueTitle'),
          ),
        MARKUP,
        UNRESOLVED,
      )
      refused(
        () => readBack(drawing, svg, [...printed, { key: 'legend/2', text: 'Soll', title: false }]),
        MARKUP,
        `leaves out 1 of the ${String(printed.length + 1)} words its layout prints`,
        'Soll',
      )
      // The title written in the words' face, and a word at another size than its face's.
      refused(() => readBack(drawing, svg.replace(';font-weight:bold;', ';')), MARKUP, UNRESOLVED)
      refused(() => readBack(drawing, svg.replace('font-size:8px', 'font-size:9px')), MARKUP, UNRESOLVED)
      // An empty word prints nothing, and is no word: zrender writes none, and one written is taken out with the rest and places nothing.
      const empty = betrag.replace('>Betrag<', '><')
      const read = readBack(drawing, svg.replace('</svg>', `${empty}</svg>`))
      expect([read.svg, read.words]).toEqual([readBack(drawing).svg, readBack(drawing).words])
      // A title the layout prints with no face to print it in is the renderer's own error, which the option refuses first.
      expect(() => readChartSvg(svg, MARKUP, printed, { words: drawing.faces.words }, drawing.widths)).toThrow(
        "a chart's title was read with no face to print it in",
      )
    },
    TIMEOUT,
  )

  // A word read back other than as written would be refused, or worse,
  // printed. zrender writes a word's & < > " and ' as the five entities
  // its encodeHTML writes, an apostrophe as a numeric reference -- a
  // Swiss thousand's among them -- and nothing of a word is a template:
  // each reads back as the runtime wrote it.
  test(
    'reads back the entities ECharts escapes a word with, and {a|b}, A & B and <b> as written',
    async () => {
      const drawing = await drawn(MARKUP)
      for (const escaped of ['>{a|b}<', '>A &amp; B<', '>Umsatz &amp; &lt;b&gt;<', '>Region &quot;Nord&quot;<', '>O&#39;Brien<', '>1&#39;000.00<'])
        expect(drawing.svg).toContain(escaped)
      const { words } = readBack(drawing)
      expect(words.map(({ key, text }) => [key, text])).toEqual(drawing.printed.map(({ key, text }) => [key, text]))
      expect(
        Object.fromEntries(
          words
            .filter(({ key }) => ['title', 'categoryTitle', 'category/0', 'category/1', 'category/2', 'tick/3', 'value/1/0'].includes(key))
            .map(({ key, text }) => [key, text]),
        ),
      ).toEqual({
        title: 'Umsatz & <b>',
        categoryTitle: 'Region "Nord"',
        'category/0': '{a|b}',
        'category/1': 'A & B',
        'category/2': "O'Brien",
        'tick/3': "1'000.00",
        'value/1/0': "1'000.00",
      })
    },
    TIMEOUT,
  )

  // pdfmake prints a word from the top left of its box, its baseline its
  // face's ascent below; ECharts placed it by its anchor, its y the centre
  // of its line. A box read otherwise than zrender laid it out would print
  // a word where ECharts left it no room. Each word's box is the box
  // zrender holds it in, to a ten-thousandth, in Roboto and in a host's
  // Liberation Serif, anchored at its start, its middle and its end; and a
  // face's line is its ascent less its descent, so that the baseline
  // pdfmake prints at is the one svg-to-pdfkit reads `central` as, half
  // the face's ascent and descent below the line's centre.
  test(
    "places a word's box where pdfmake will draw it, by its anchor and its line's centre",
    async () => {
      const drawings = await Promise.all([
        drawn(MARKUP),
        drawn(LINE),
        drawn(PIE),
        drawn({ ...MARKUP, style: { font: 'serif', color: INK } }, SERIF),
        drawn({ ...PIE, style: { font: 'serif', italic: true, color: INK } }, SERIF),
      ])
      const anchors = new Set<string>()
      for (const drawing of drawings) {
        const { words } = readBack(drawing)
        const sorted = <T extends { readonly text: string; readonly x: number }>(boxes: readonly T[]): T[] =>
          [...boxes].sort((a, b) => (a.text === b.text ? a.x - b.x : a.text < b.text ? -1 : 1))
        const placed = sorted(words)
        const laid = sorted(drawing.laid)
        expect(placed).toHaveLength(laid.length)
        placed.forEach((word, index) => {
          const box = laid[index]!
          expect(word.text).toBe(box.text)
          for (const [mine, zrender] of [
            [word.x, box.x],
            [word.top, box.y],
            [word.width, box.width],
            [word.height, box.height],
          ] as const)
            expect(Math.abs(mine - zrender), `${drawing.chart.id} ${word.key}`).toBeLessThan(1e-4)
          const { ascent, descent, line } = word.face
          expect(line).toBeCloseTo(ascent - descent, 12)
          expect(word.top + ascent).toBeCloseTo(box.y + box.height / 2 + (ascent + descent) / 2, 4)
        })
        for (const [anchor] of drawing.svg.matchAll(/text-anchor="(start|middle|end)"/g)) anchors.add(anchor)
        expect(words.every(({ face, title }) => face === (title ? drawing.faces.title : drawing.faces.words))).toBe(true)
      }
      expect(anchors.size).toBe(3)
      // Pinned, in Roboto at 8 points, a line of 9.375: the lowest tick's label, 26.80078125 wide, anchored at its end at
      // translate(40 190.5), 8 points left of the plot on the gridline at its foot; a category's, 19.1484375 wide, at its middle at
      // translate(158 198.5) and half a line below it, the middle of its slot, 8 points below the plot; and a legend entry's,
      // 15.76171875 wide, at its start at translate(120.6582 226.3125) and 13 across and 4 down from it, right of its swatch and
      // centred on it. Its translation taken out, the entry stands at its own x and y alone.
      const [markup] = drawings
      const words = readBack(markup).words
      const of = (key: string, read: readonly PlacedWord[] = words) => boxOf(read.find((word) => word.key === key)!)
      expect(of('tick/0')).toEqual({ text: '-500.00', x: 40 - 26.80078125, top: 190.5 - 9.375 / 2, width: 26.80078125, height: 9.375 })
      expect(of('category/1')).toEqual({ text: 'A & B', x: 158 - 19.1484375 / 2, top: 198.5, width: 19.1484375, height: 9.375 })
      expect(of('legend/0')).toEqual({ text: 'Plan', x: 120.6582 + 13, top: 226.3125 + 4 - 9.375 / 2, width: 15.76171875, height: 9.375 })
      const unmoved = markup.svg.replace(' transform="translate(120.6582 226.3125)" fill="#336699">Plan<', ' fill="#336699">Plan<')
      expect(unmoved).not.toBe(markup.svg)
      expect(of('legend/0', readBack(markup, unmoved).words)).toEqual({ text: 'Plan', x: 13, top: 4 - 9.375 / 2, width: 15.76171875, height: 9.375 })
    },
    TIMEOUT,
  )

  // Two words of one text in one face print alike, but are not one word:
  // a tick's label and a value's of one text stand apart, and the layout's
  // rules read which is which -- no word but a value's label in the plot --
  // as the bands read where the title went. They are told apart by the
  // order ECharts 6.1.0 writes a chart's words in, which this holds: a
  // chart all of whose words are one text places each where the word of
  // its key stands in a twin whose words are all different and all as
  // wide -- bars, a line and a pie, each also bold, where the title prints
  // in the words' own face and stands among them by its order alone.
  test.each([MARKUP, LINE, PIE].flatMap((chart) => [chart, { ...chart, id: `${chart.id}-bold`, style: { ...chart.style, bold: true } }]))(
    'tells words of one text apart by the order ECharts writes them, each where its own stands: $id',
    async (chart) => {
      const same = await drawn(retexted(chart, () => '50.00'))
      const twin = await drawn(retexted(chart, (index) => `${String(10 + index)}.00`))
      // Every word as wide as every other in its face, and the title's face the words' where the style is bold.
      const widthsOf = ({ faces, widths, printed }: Drawn) =>
        new Set(
          printed.map(({ text, title }) => {
            const { family, face, size } = title ? faces.title! : faces.words
            return widths.width(family, face, size, text)
          }),
        )
      expect(widthsOf(twin)).toEqual(widthsOf(same))
      expect(widthsOf(same).size).toBe(chart.style?.bold === true ? 1 : 2)
      // Each word where its twin stands, and no two where one other stands, so that two swapped would be seen.
      const placed = (drawing: Drawn) => readBack(drawing).words.map(({ key, x, top, width, height }) => ({ key, x, top, width, height }))
      expect(placed(same)).toEqual(placed(twin))
      expect(new Set(placed(same).map(({ x, top }) => `${String(x)} ${String(top)}`)).size).toBe(same.printed.length)
    },
    TIMEOUT,
  )

  // The converter draws the marks and no word, and reads no style sheet:
  // the drawing it is handed holds no `<text>`, no `<style>` and no CDATA,
  // and everything else as ECharts wrote it, itself held to what ECharts
  // writes. ECharts' one style sheet of hover rules is removed; a style
  // sheet anywhere else, a second, or one with a rule of anything but
  // hovering, is no sheet ECharts writes and refused.
  test(
    'returns the drawing with no <text> and no <style>, and refuses any other <style>',
    async () => {
      for (const drawing of await Promise.all([MARKUP, LINE, PIE].map((chart) => drawn(chart)))) {
        const { svg } = readBack(drawing)
        expect(svg).not.toMatch(/<text|<style|CDATA|:hover/)
        expect(tagsOf(svg)).toEqual(tagsOf(drawing.svg).filter(([name]) => name !== 'text' && name !== 'style'))
        expect(readChartSvg(svg, drawing.chart, [], drawing.faces, drawing.widths)).toEqual({ svg, words: [] })
      }
      const drawing = await drawn(MARKUP)
      const { svg } = drawing
      const style = svg.slice(svg.indexOf('<style'), svg.indexOf('</style>') + '</style>'.length)
      expect(style).toMatch(/^<style ><!\[CDATA\[[\s\S]*:hover[\s\S]*\]\]>\s*<\/style>$/)
      const sheet = 'holds a style sheet but its one of hover rules'
      const hovering = 'holds a style sheet with a rule but of hovering'
      for (const [edited, does] of [
        [svg.replace('</svg>', `${style}</svg>`), sheet],
        [svg.replace(style, '').replace('</svg>', `<g>${style}</g></svg>`), 'holds an element inside its <g>'],
        [svg.replace(':hover {', ' {'), hovering],
        [svg.replace(':hover {', ':hover, path {'), hovering],
        [svg.replace('<style >', '<style type="text/css">'), 'holds an attribute ECharts does not write its <style> with'],
        [svg.replace('<![CDATA[', '<![CDATA[@import url(x);'), sheet],
        [svg.replace(']]>', ']]>.zr-cls-0:hover {}'), sheet],
        [svg.replace('<style >', '<style ><path d="M0 0"></path>'), sheet],
        [svg.replace('</style>', ''), sheet],
      ] as const) {
        expect(edited).not.toBe(svg)
        refused(() => readBack(drawing, edited), MARKUP, does)
      }
    },
    TIMEOUT,
  )

  // A sheet one character from ECharts' is refused at once, however many
  // rules it holds. Read by a pattern that took the whitespace before a
  // selector two ways, a sheet of 26 rules as ECharts writes them, with an
  // `@` before its end, took 54 seconds to refuse, about twice as long for
  // each rule more: a later ECharts writing more rules, or a drawing built
  // to, would hang a render rather than be refused. Read one way, it is
  // refused in 0.12 ms, and one of 2,600 rules in 0.9 (the median of 20
  // runs; Node 22.23 on an Apple M2, 13 November 2026). Without its `@`,
  // the same sheet reads.
  test(
    "refuses a style sheet one character from ECharts' at once",
    async () => {
      const drawing = await drawn(MARKUP)
      const { svg } = drawing
      const style = svg.slice(svg.indexOf('<style'), svg.indexOf('</style>') + '</style>'.length)
      const rules = Array.from({ length: 26 }, (_, index) => `\n.zr0-cls-${String(index)}:hover {\nfill:rgba(1,2,3,1);\n}`).join('')
      const sheet = (end: string) => svg.replace(style, `<style ><![CDATA[${rules}\n${end}]]>\n\n</style>`)
      expect(readBack(drawing, sheet('')).words).toHaveLength(drawing.printed.length)
      const started = performance.now()
      refused(() => readBack(drawing, sheet('@')), MARKUP, 'holds a style sheet but its one of hover rules')
      expect(performance.now() - started).toBeLessThan(1000)
    },
    TIMEOUT,
  )

  // The option turns no word: a `<text>` turned or scaled would be read
  // as a box pdfmake prints across. And every colour ECharts paints is
  // one the option named, the block's, the grid's, the axis's or the
  // words', or none: a colour of ECharts' theme, or one nobody named,
  // would print what the report did not say. A clip's black is a mask,
  // and paints nothing; ECharts' hover colours are in the sheet removed.
  test(
    'refuses a turned <text>, and a colour the option did not name',
    async () => {
      const drawing = await drawn(MARKUP)
      const { svg } = drawing
      // The title's word, moved to the middle of the box's top: turned a quarter as ECharts turns a label, turned about its origin, and scaled.
      const title = /<text[^>]*transform="translate\(150 5\)"[^>]*>/.exec(svg)?.[0] ?? ''
      expect(title).toContain('font-weight:bold;')
      for (const turned of ['matrix(0,-1,1,0,150,5)', 'rotate(-90)', 'translate(150 5) scale(2)'])
        refused(() => readBack(drawing, svg.replace(title, title.replace('translate(150 5)', turned))), MARKUP, 'holds a word turned or scaled')
      const unnamed = 'holds a colour the option did not name'
      for (const [written, edited, does] of [
        ['fill="#1f77b4"', 'fill="#1f77b5"', unnamed],
        ['stroke="#d9d9d9"', 'stroke="#5470c6"', unnamed],
        [`fill="${INK}"`, 'fill="#000"', unnamed],
        [`fill="${INK}"`, 'fill="rgba(51,102,153,1)"', VALUE('text')],
      ] as const) {
        expect(svg).toContain(written)
        refused(() => readBack(drawing, svg.replace(written, edited)), MARKUP, does)
      }
      for (const nothing of ['none', 'transparent'])
        expect(readBack(drawing, svg.replace('fill="#1f77b4"', `fill="${nothing}"`)).words).toHaveLength(drawing.printed.length)
      const line = await drawn(LINE)
      expect(line.svg).toMatch(/<clipPath[^>]*>\s*<path [^>]*fill="#000"/)
      expect(readBack(line).words).toHaveLength(line.printed.length)
      refused(() => readBack(line, line.svg.replace('fill="#000"', 'fill="#2ca02c"')), LINE, 'paints a clip path')
    },
    TIMEOUT,
  )
})
