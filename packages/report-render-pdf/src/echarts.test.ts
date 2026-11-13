import type { EChartsCoreOption } from 'echarts/core'
import { describe, expect, test } from 'vitest'
import type { ChartFaces } from './chart-faces.js'
import { withMeasurer } from './chart-measure.js'
import type { FaceWidths } from './engine.js'
import { fixture, TIMEOUT } from './testing/documents.js'
import { asked, fontString, layOut, measured, planned, wordsOf, type Asked } from './testing/echarts.js'
import { face } from './testing/fonts.js'

/**
 * What the drawing leans on in ECharts 6.1.0 and zrender 6.1.0, as
 * `pdfmake.test.ts` holds pdfmake's: each case fails if the behaviour it
 * pins goes. ECharts lays a chart out and pdfmake prints its words where
 * ECharts placed them (0058), so every width ECharts places a word by is
 * one zrender asked its platform for, which `chart-measure.ts` answers for
 * one layout with pdfmake's widths in the report's faces.
 *
 * zrender keeps what it measured for the life of the process, by font
 * string, and asks a font's probes only the first time it meets it: a case
 * that must see what zrender asks of a font measures in a face, or at a
 * size, no case before it here lays out.
 */

/** Liberation Serif's and Liberation Mono's faces, the corpus's host fonts. */
const { serif: SERIF, mono: MONO } = fixture('host-fonts').document.fonts!

/** zrender's probes of a font: the width of 国, which it takes as a line's height, and of `a`, an ASCII character's where it has no map of them. */
const PROBES: ReadonlySet<string> = new Set(['国', 'a'])

/** The title's padding, ECharts' default (component/title/install.js), which the title's word stands inside. */
const TITLE_PADDING = 5

/** `lookup`'s entry at `index`, failing the layout for an index the chart does not have, as the drawing's formatters do. */
function looked<T>(lookup: readonly T[], index: number): T {
  const found = lookup[index]
  if (found === undefined) throw new Error(`the chart has no entry ${String(index)}`)
  return found
}

/** A bar or a line chart's words and axis: two categories, the runtime's ticks, and two series, each value labelled. */
const AXIS = {
  title: 'Umsatz nach Region',
  categories: ['Nord', 'Süd'],
  categoryTitle: 'Region',
  valueTitle: 'Betrag',
  ticks: ['-50.00', '0.00', '50.00', '100.00'],
  series: [
    { legend: 'Plan', values: ['30.00', '70.00'] },
    { legend: 'Ist', values: ['-30.00', '45.00'] },
  ],
} as const

/**
 * `AXIS` as the drawing hands a bar or a line chart to ECharts, in `faces`:
 * categories and series by key, the axis fixed at the runtime's ticks, and
 * every word looked up by index; a line chart of the first series alone,
 * since two series' value labels on a line would meet.
 */
function axisOption(kind: 'bar' | 'line', { words, title }: ChartFaces): EChartsCoreOption {
  const series = kind === 'line' ? AXIS.series.slice(0, 1) : AXIS.series
  const ticks = AXIS.ticks.map(Number)
  return {
    title: { text: AXIS.title, left: 'center', top: 0, textStyle: title!.font },
    textStyle: words.font,
    legend: {
      show: series.length > 1,
      bottom: 0,
      icon: 'rect',
      itemWidth: 8,
      itemHeight: 8,
      data: series.map((_, index) => `s${String(index)}`),
      formatter: (key: string) => looked(series, Number(key.slice(1))).legend,
      textStyle: words.font,
    },
    grid: { left: 48, right: 24, top: 32.5, bottom: 50 },
    xAxis: {
      type: 'category',
      data: AXIS.categories.map((_, index) => `c${String(index)}`),
      name: AXIS.categoryTitle,
      nameLocation: 'middle',
      nameGap: 22,
      nameTextStyle: words.font,
      axisTick: { show: false },
      axisLine: { onZero: false },
      axisLabel: { interval: 0, ...words.font, formatter: (_: string, index: number) => looked(AXIS.categories, index) },
    },
    yAxis: {
      type: 'value',
      min: ticks[0],
      max: ticks.at(-1),
      name: AXIS.valueTitle,
      nameTextStyle: words.font,
      axisTick: { show: false, customValues: ticks },
      axisLabel: { customValues: ticks, ...words.font, formatter: (_: number, index: number) => looked(AXIS.ticks, index) },
      splitLine: { show: true },
    },
    series: series.map(({ values }, index) => ({
      type: kind,
      name: `s${String(index)}`,
      data: values.map(Number),
      label: { show: true, position: 'top', ...words.font, formatter: ({ dataIndex }: { dataIndex: number }) => looked(values, dataIndex) },
    })),
  }
}

/** A pie's words: its title, and three slices, each value in its legend entry. */
const PIE = { title: 'Anteile', legend: ['Beratung 50.00 (50 %)', 'Material 30.00 (30 %)', 'Reise 20.00 (20 %)'], values: [50, 30, 20] } as const

/** `PIE` as the drawing hands a pie to ECharts, in `faces`: slices by key, no label on a slice, and its series' `labelLayout` the one given, ECharts' default where none is. */
function pieOption({ words, title }: ChartFaces, labelLayout: { readonly labelLayout?: null }): EChartsCoreOption {
  return {
    title: { text: PIE.title, left: 'center', top: 0, textStyle: title!.font },
    textStyle: words.font,
    legend: {
      show: true,
      bottom: 0,
      icon: 'rect',
      data: PIE.values.map((_, index) => `c${String(index)}`),
      formatter: (key: string) => looked(PIE.legend, Number(key.slice(1))),
      textStyle: words.font,
    },
    series: [
      {
        type: 'pie',
        radius: 50,
        center: [150, 90],
        startAngle: 90,
        clockwise: true,
        label: { show: false },
        labelLine: { show: false },
        ...labelLayout,
        data: PIE.values.map((value, index) => ({ name: `c${String(index)}`, value })),
      },
    ],
  }
}

/** Every word the drawing hands ECharts in `axisOption` and `pieOption`. */
const WORDS: ReadonlySet<string> = new Set([
  AXIS.title,
  ...AXIS.categories,
  AXIS.categoryTitle,
  AXIS.valueTitle,
  ...AXIS.ticks,
  ...AXIS.series.flatMap(({ legend, values }) => [legend, ...values]),
  PIE.title,
  ...PIE.legend,
])

/** The three kinds, each laid out in `faces` and measured by `widths` as a render lays a chart out, with what zrender asked meanwhile. */
function kinds(faces: ChartFaces, widths: FaceWidths): Asked[] {
  const options = [axisOption('bar', faces), axisOption('line', faces), pieOption(faces, { labelLayout: null })]
  return options.map((option) => withMeasurer(faces, widths, () => asked(() => layOut(option, 300, 200))).asked)
}

describe('ECharts and zrender as the drawing leans on them', () => {
  // zrender takes a line's height as the width of 国 (contain/text.js
  // getLineHeight), asked once per font string: answered as PDFKit
  // measures it, a face without the character lays every line out by its
  // .notdef box, 3.546875 pt in Roboto at 8 pt against a 9.375 pt line.
  // The title's word stands inside the title's padding, its middle half a
  // line below it, by the line the measurer answered: in Roboto at 9.5 pt,
  // 11.1328125 pt (9.5 times its line of 2400/2048 em), and in Liberation
  // Serif at 10.5 pt, 11.6279296875 pt (2268/2048 em), each a size no case
  // before this one lays out.
  test(
    'asks the measurer for 国 to know a line, and lays text out by the line it is answered',
    async () => {
      const cases = [
        { plan: planned(), style: { size: 9.5 }, line: 11.1328125 },
        { plan: planned({ serif: SERIF! }), style: { font: 'serif', size: 10.5 }, line: 11.6279296875 },
      ] as const
      for (const { plan, style, line } of cases) {
        const { faces, widths } = await measured(plan, style, AXIS.title)
        const title = faces.title!
        const option = { title: { text: AXIS.title, left: 0, top: 0, textStyle: title.font } }
        const { result, asked: record } = withMeasurer(faces, widths, () => asked(() => layOut(option, 300, 100)))
        const font = `normal bold ${String(style.size)}px ${title.font.fontFamily}`
        expect(record.measures).toEqual([
          ['国', font],
          ['a', font],
          [AXIS.title, font],
        ])
        expect(title.line).toBe(line)
        expect(wordsOf(result.svg)).toEqual([{ text: AXIS.title, family: title.font.fontFamily, x: TITLE_PADDING, y: TITLE_PADDING + line / 2 }])
      }
    },
    TIMEOUT,
  )

  // zrender keeps widths process-wide by the whole font string
  // (contain/text.js, an LRU of 100 fonts): two faces under one family
  // name would share them, and a chart be laid out by another font's
  // widths. The family a face is told by carries the digest of the bytes
  // the render embeds, so Liberation Serif mapped as `sans`, then
  // Liberation Mono mapped as `sans` under the very digest the serif was
  // handed under, are each laid out by their own widths -- the legend's
  // second entry standing after the first's own -- and the serif once
  // more by its own, which zrender kept and did not ask again.
  test(
    'keys widths by the whole font string, so a face is known by its bytes',
    async () => {
      const declared = SERIF!.normal.digest
      const asSans = (bytes: Uint8Array) => planned({ sans: { normal: face('brand', bytes, declared) } })
      const entries = ['Umsatz', 'Kosten']
      const laid = []
      for (const plan of [asSans(SERIF!.normal.bytes), asSans(MONO!.normal.bytes), asSans(SERIF!.normal.bytes)]) {
        const { faces, widths } = await measured(plan, {})
        const { words } = faces
        const option = {
          legend: {
            show: true,
            left: 0,
            top: 0,
            icon: 'rect',
            itemWidth: 8,
            itemHeight: 8,
            data: ['s0', 's1'],
            formatter: (key: string) => looked(entries, Number(key.slice(1))),
            textStyle: words.font,
          },
          xAxis: { type: 'category', data: ['c0'], show: false },
          yAxis: { type: 'value', show: false },
          series: [
            { type: 'bar', name: 's0', data: [1] },
            { type: 'bar', name: 's1', data: [2] },
          ],
        }
        const { result, asked: record } = withMeasurer(faces, widths, () => asked(() => layOut(option, 300, 60)))
        const [first, second] = wordsOf(result.svg)
        const width = widths.width(words.family, words.face, words.font.fontSize, entries[0]!)
        laid.push({
          family: words.family,
          font: words.font.fontFamily,
          measured: record.measures.map(([text]) => text).filter((text) => !PROBES.has(text)),
          width,
          after: second!.x - first!.x - width,
        })
      }
      const [serif, mono, again] = laid
      expect(laid.map(({ family }) => family)).toEqual(['formancy-host-sans', 'formancy-host-sans', 'formancy-host-sans'])
      expect(mono!.font).not.toBe(serif!.font)
      expect(again!.font).toBe(serif!.font)
      expect([serif!.measured, mono!.measured, again!.measured]).toEqual([entries, entries, []])
      // zrender writes a translation to four places.
      expect(mono!.after).toBeCloseTo(serif!.after, 3)
      expect(again!.after).toBeCloseTo(serif!.after, 3)
      expect(Math.abs(mono!.width - serif!.width)).toBeGreaterThan(1)
    },
    TIMEOUT,
  )

  // zrender's map of the 128 ASCII characters' widths
  // (tryCreateASCIIWidthMap) is built against the clock, and abandoned
  // for every font once building one has been slow: a layout that reached
  // it could vary with the machine's speed and load, and would measure a
  // word character by character, as pdfmake never does. It is reached only
  // to wrap or cut a word, which the drawing never asks: every measure is
  // a word the chart prints, whole, or a probe, once a font -- here each
  // kind in Roboto at 8.5 pt, a size no case before this one lays out.
  test(
    'is never asked for a single character but its probes',
    async () => {
      const { faces, widths } = await measured(planned(), { size: 8.5 }, AXIS.title)
      const measures = kinds(faces, widths).flatMap(({ measures: each }) => each)
      expect(measures.filter(([text]) => !WORDS.has(text) && !PROBES.has(text))).toEqual([])
      expect(measures.filter(([text]) => [...text].length === 1 && !PROBES.has(text))).toEqual([])
      const probes = measures.filter(([text]) => PROBES.has(text)).map(([text, font]) => `${text} in ${String(font)}`)
      const once = [faces.words, faces.title!].flatMap((each) => [...PROBES].map((probe) => `${probe} in ${fontString(each)}`))
      expect(probes.sort()).toEqual(once.sort())
    },
    TIMEOUT,
  )

  // The drawing runs in Node, which has no canvas, and in a host's page,
  // whose canvas would measure in the browser's fonts and whose images
  // would be fetched: ECharts' layout into an SVG string asks for
  // neither, for any of the three kinds, and the measurer refuses both.
  test(
    'never asks for a canvas or an image',
    async () => {
      const { faces, widths } = await measured(planned(), {}, AXIS.title)
      expect(kinds(faces, widths).map(({ canvases, images }) => ({ canvases, images }))).toEqual([
        { canvases: 0, images: 0 },
        { canvases: 0, images: 0 },
        { canvases: 0, images: 0 },
      ])
    },
    TIMEOUT,
  )

  // PieSeries' default labelLayout, { hideOverlap: true }, sends a pie's
  // hidden slice labels through ECharts' LabelManager, which measures them
  // in zrender's own 12px sans-serif whatever their style says: widths in
  // a face nobody chose, which the measurer refuses. A labelLayout of null
  // stops it; hideOverlap false and a function did not (the chart spike,
  // 11 November 2026). In Roboto at 7.5 pt, a size no case before this one
  // lays out, so that zrender asks for every font it measures in.
  test(
    'measures a pie in no font but the ones handed over, with labelLayout null',
    async () => {
      const { faces, widths } = await measured(planned(), { size: 7.5 }, PIE.title)
      const { asked: record } = withMeasurer(faces, widths, () => asked(() => layOut(pieOption(faces, { labelLayout: null }), 300, 200)))
      expect(new Set(record.measures.map(([, font]) => font))).toEqual(new Set([fontString(faces.title!), fontString(faces.words)]))
      expect(() => withMeasurer(faces, widths, () => layOut(pieOption(faces, {}), 300, 200))).toThrow('12px sans-serif')
    },
    TIMEOUT,
  )

  // zrender moves a thin line to the nearest half point for a crisp edge
  // (subPixelOptimizeLine, CartesianAxisView.js), and the option cannot
  // turn it off: a gridline stands up to 0.7 pt from its tick, as far as
  // the corpus's reading tolerates and farther. Every tick stands on a
  // half point, and every gridline on its tick, only where the plot's top
  // is on a half point and its height a whole multiple of the intervals
  // between ticks; a plot on a whole point, or of another height, moves
  // them. Six ticks, five intervals, measured on 12 November 2026.
  test(
    "keeps every gridline on its tick only where the plot's top is on a half point and its height a whole multiple of the intervals",
    async () => {
      const { faces, widths } = await measured(planned(), {})
      const ticks = ['0', '100', '200', '300', '400', '500']
      const offsets = (top: number, height: number): number[] => {
        const option = {
          grid: { left: 40, right: 20, top, bottom: 240 - top - height, outerBoundsMode: 'none' },
          xAxis: { type: 'category', data: ['c0', 'c1'], axisTick: { show: false }, axisLabel: { interval: 0, ...faces.words.font, formatter: () => 'Nord' } },
          yAxis: {
            type: 'value',
            min: 0,
            max: 500,
            axisTick: { show: false, customValues: ticks.map(Number) },
            axisLabel: { customValues: ticks.map(Number), ...faces.words.font, formatter: (_: number, index: number) => looked(ticks, index) },
            splitLine: { show: true, lineStyle: { color: '#d9d9d9', width: 0.5 } },
          },
          series: [{ type: 'bar', data: [120, 480] }],
        }
        const { svg, read } = withMeasurer(faces, widths, () =>
          layOut(option, 360, 240, (chart) => ticks.map((tick) => chart.convertToPixel({ yAxisIndex: 0 }, Number(tick)))),
        )
        const gridlines = [...svg.matchAll(/<path d="M[\d.]+ ([\d.]+)L[\d.]+ ([\d.]+)"[^>]*stroke="#d9d9d9"/g)].map(([, y]) => Number(y))
        expect(gridlines).toHaveLength(ticks.length)
        return read!.map((y, index) => Math.abs(gridlines[index]! - y))
      }
      // On a half point, a whole multiple of five: every gridline on its tick.
      expect(offsets(32.5, 165)).toEqual([0, 0, 0, 0, 0, 0])
      // A whole point, a whole multiple: every tick on a whole point, every gridline half a point off it.
      expect(offsets(32, 165)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 0.5])
      // A half point, a height of 33.5 a tick: every other tick on a whole point.
      expect(offsets(32.5, 167.5)).toEqual([0.5, 0, 0.5, 0, 0.5, 0])
      // Neither: a gridline 0.7 pt off its tick.
      expect(Math.max(...offsets(32, 168))).toBeCloseTo(0.7, 9)
    },
    TIMEOUT,
  )

  // These cases read where a word stands from its translation, as zrender
  // writes a word across. A word turned -- which the drawing never asks
  // for, and an option could -- zrender writes with a matrix in place of
  // the translation, so a reader of translations would place it wrong or
  // nowhere: the cases' reader refuses it by name, here on the quarter
  // turn zrender writes as matrix(0,-1,1,0,x,y) (seen 13 November 2026).
  test(
    "writes a turned word's place as a matrix, which the cases' reader refuses",
    async () => {
      const { faces, widths } = await measured(planned(), {})
      const option = {
        xAxis: { type: 'category', data: ['c0'], axisLabel: { interval: 0, rotate: 90, ...faces.words.font, formatter: () => 'Nord' } },
        yAxis: { type: 'value', show: false },
        series: [{ type: 'bar', data: [1] }],
      }
      const { svg } = withMeasurer(faces, widths, () => layOut(option, 200, 100))
      expect(svg).toMatch(/<text[^>]*transform="matrix\(0,-1,1,0,[-\d.]+,[-\d.]+\)"[^>]*>Nord<\/text>/)
      expect(() => wordsOf(svg)).toThrow('zrender wrote a word turned or scaled, which these tests do not read')
    },
    TIMEOUT,
  )
})
