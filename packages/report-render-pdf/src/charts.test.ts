import { MAX_CHART_CATEGORIES, MAX_CHART_SERIES, MAX_FONT_SIZE, MAX_TICK_INTERVALS, MIN_FONT_SIZE } from '@formancy/report-runtime'
import type { AxisChart, Block, Chart, PieChart, ResolvedDocument, ResolvedFonts } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { checkChart } from './check-chart.js'
import type { Walk } from './check-walk.js'
import { planFonts } from './host-fonts.js'
import { engine, renderPdf } from './node.js'
import { ACTUAL, BARS, EMPTY, LINE, PIE, PLAN, SERIF, value } from './testing/charts.js'
import { BODY_HEIGHT, documentOf, paragraph, PRINTABLE_WIDTH } from './testing/documents.js'

/**
 * A chart held to what the renderer draws before anything is laid out
 * (`check-chart.ts`). Each refusal is rendered and read as the
 * `RenderRefusal` it is: it names the chart by its id, and the sizes or
 * the counts that do not hold, and quotes none of its words or values,
 * each of which may be the data's. The four charts every case here
 * changes pass every check and are drawn, so that each case is refused
 * for its own defect, and by the check: the drawing, which would refuse
 * otherwise or throw an invariant's plain `Error`, never sees it. What a
 * chart drawn prints, and where, is `chart-content.test.ts`'s.
 */

/** What the Node entry refused `document` with, or 'rendered'. */
function refusal(document: ResolvedDocument): Promise<unknown> {
  return renderPdf(document, { maxPages: 5 }).then(
    () => 'rendered',
    (error: unknown) => error,
  )
}

/** What a document that prints `chart` in its body, after a paragraph, was refused with, its fonts `fonts`. */
function refused(chart: Block, fonts?: ResolvedFonts): Promise<unknown> {
  return refusal({ ...documentOf('Chart', [paragraph('Before'), chart]), ...(fonts === undefined ? {} : { fonts }) })
}

/** What `checkChart` collected of `chart`, standing at the top of the body, or what it threw: what the check makes of a chart the drawing may refuse after it. */
async function checked(chart: Chart): Promise<unknown> {
  const walk: Walk = {
    fonts: planFonts(undefined, await engine.glyphs()),
    paths: new Map(),
    images: [],
    codes: new Map(),
    captioned: false,
    tall: [],
    measured: [],
    charts: [],
  }
  try {
    checkChart(chart, 'body[0]', { region: false, kept: false, column: false, width: PRINTABLE_WIDTH, inset: 0, depth: 0 }, walk)
    return walk.charts
  } catch (error) {
    return error
  }
}

/** The refusal of a word of the chart `id` that holds a control character. */
const controlled = (id: string): object => ({
  code: 'unsupported',
  subject: id,
  message: `the chart ${id} has a word with a tab, a line break or another control character in it, which a chart never prints`,
})

/** A chart built by hand as no runtime types it: a kind, a word or a value of another type. */
const untyped = (chart: object): Chart => chart as Chart

describe('a chart checked before anything is laid out', () => {
  // A chart refused for a defect of its own fixture would make every case
  // below pass whatever it changed: each of the four -- bars, a pie, a
  // line whose axis does not reach zero, which only a bar stands on, and
  // a chart with nothing to draw -- passes every check and is drawn.
  test('draws a bar chart, a pie, a line and an empty chart, each of which the cases below change', async () => {
    for (const chart of [BARS, PIE, LINE, EMPTY]) expect(await refused(chart), chart.id).toBe('rendered')
  })

  // pdfmake draws a character its face has no glyph for as an empty box,
  // and writes U+0000 to the text layer (`glyphs.ts`): a chart's word is
  // printed by pdfmake as a paragraph's is, so it is held to its face as a
  // paragraph's is, wherever in the chart it stands, before ECharts lays
  // out a word of it. The refusal says where the word is and quotes it
  // not.
  test.each([
    ['its title', { ...BARS, title: 'Sales ✓' }, 'the title of the chart sales'],
    ["its category axis's title", { ...BARS, categoryTitle: '✓' }, "the category axis's title of the chart sales"],
    ["its value axis's title", { ...BARS, valueTitle: '✓' }, "the value axis's title of the chart sales"],
    ['a category', { ...BARS, categories: ['North', 'South ✓'] }, 'category 1 of the chart sales'],
    ['a tick', { ...BARS, ticks: [...BARS.ticks.slice(0, 4), value('15', '15 ✓')] }, 'tick 4 of the chart sales'],
    [
      'a value',
      { ...BARS, series: [PLAN, { ...ACTUAL, values: [value('15', '15 ✓'), value('-5')] }] },
      'the value of series 1 at category 0 of the chart sales',
    ],
    ['a legend entry', { ...BARS, legend: [BARS.legend[0]!, { text: '✓', color: '#ff7f0e' }] }, 'legend entry 1 of the chart sales'],
    ["a pie's legend entry", { ...PIE, legend: [{ text: 'North ✓', color: '#1f77b4' }, ...PIE.legend.slice(1)] }, 'legend entry 0 of the chart shares'],
    ['its empty text', { ...EMPTY, empty: 'No data ✓' }, 'the empty text of the chart nothing'],
  ] as const)("refuses a chart word no face draws, as a paragraph's: %s", async (_, chart, where) => {
    expect(await refused(chart)).toMatchObject({
      code: 'unsupported',
      subject: chart.id,
      message: `${where} prints U+2713, which Roboto has no glyph for: it would print as an empty box, and as nothing in the PDF's text, and no other font is embedded`,
    })
  })

  // A chart's words print in its style's face, and its title bold in the
  // same token: a word judged in another face than it prints in passes a
  // character the face it prints in lacks. Liberation Serif has no glyph
  // for U+2713, in its regular face or its bold.
  test('judges each word in the face it prints in, its title bold', async () => {
    const serif: AxisChart = { ...BARS, style: { font: 'serif' } }
    const fonts: ResolvedFonts = { serif: SERIF }
    expect(await refused({ ...serif, categories: ['North', '✓'] }, fonts)).toMatchObject({
      subject: 'sales',
      message: expect.stringContaining(
        "category 1 of the chart sales prints U+2713, which the serif font's regular face, the asset serif, has no glyph for",
      ) as string,
    })
    expect(await refused({ ...serif, title: '✓' }, fonts)).toMatchObject({
      subject: 'sales',
      message: expect.stringContaining(
        "the title of the chart sales prints U+2713, which the serif font's bold face, the asset serif-bold, has no glyph for",
      ) as string,
    })
    expect(await refused(serif, fonts)).toBe('rendered')
  })

  // The renderer prints Latin, Greek and Cyrillic and lays out no
  // right-to-left text, no shaped script and no CJK (0043): a chart's word
  // in another script is refused as a paragraph's is, even by a face that
  // maps it, and so is a bidirectional control, which pdfmake would print
  // as a space.
  test.each([
    ['a CJK category', { ...BARS, categories: ['国', 'South'] }, 'category 0 of the chart sales prints U+56FD, which is in no script the renderer prints'],
    [
      'a bidirectional control in a legend entry',
      { ...BARS, legend: [{ text: '\u202ePlan', color: '#1f77b4' }, BARS.legend[1]!] },
      'legend entry 0 of the chart sales prints U+202E, a bidirectional control',
    ],
  ] as const)('refuses a chart word in no script the renderer prints: %s', async (_, chart, message) => {
    expect(await refused(chart)).toMatchObject({ code: 'unsupported', subject: 'sales', message: expect.stringContaining(message) as string })
  })

  // pdfmake prints a tab four spaces wide, and a word laid out by ECharts
  // with a line break in it would print otherwise than it was measured: a
  // chart's words are one line each, as written. Every control character
  // is refused in every word a chart prints, its empty text too, which
  // ECharts never lays out; naming the chart and quoting nothing.
  test.each([
    ['a line break in a category', { ...BARS, categories: ['North\nEast', 'South'] }],
    ['a tab in the title', { ...BARS, title: 'Sales\t2026' }],
    ['a carriage return in a tick', { ...BARS, ticks: [value('-5', '-5\r'), ...BARS.ticks.slice(1)] }],
    ['a line separator in a value', { ...BARS, series: [{ ...PLAN, values: [value('10.25', '10\u202825'), null] }, ACTUAL] }],
    ["a paragraph separator in a pie's legend entry", { ...PIE, legend: [PIE.legend[0]!, { text: 'South\u2029', color: '#ff7f0e' }, PIE.legend[2]!] }],
    ['a line break in the empty text', { ...EMPTY, empty: 'No\r\ndata' }],
    ['a delete in a legend entry', { ...BARS, legend: [BARS.legend[0]!, { text: 'Act\u007fual', color: '#ff7f0e' }] }],
    ["a C1 control in the value axis's title", { ...BARS, valueTitle: 'CHF\u009b' }],
  ] as const)('refuses a chart word that holds a tab, a line break or another control character: %s', async (_, chart) => {
    expect(await refused(chart)).toMatchObject(controlled(chart.id))
  })

  // Roboto maps U+0000 and U+0002 to empty glyphs of no width: a word
  // holding one passes the face's glyph map, prints as nothing on the
  // paper, and writes the control character into the PDF's text and into
  // ECharts' SVG, so the text a reader copies is not the word printed. A
  // chart's word is refused for a control character whatever its face
  // maps, so that the glyph map never stands in for the rule.
  test("refuses a control character Roboto maps to an empty glyph, which the face's map alone would pass", async () => {
    const roboto = await engine.glyphs()
    expect([0x00, 0x02].map((point) => roboto.normal.has(point))).toEqual([true, true])
    for (const categories of [
      ['North\u0000', 'South'],
      ['No\u0002rth', 'South'],
    ])
      expect(await refused({ ...BARS, categories }), JSON.stringify(categories)).toMatchObject(controlled('sales'))
  })

  // A word that is not text -- an array, which pdfmake would read as
  // inlines carrying any property of their own, a link among them; a
  // number; none where the block must hold one -- is refused, as a
  // paragraph's is, before ECharts is handed it.
  test.each([
    ['a title of inlines', untyped({ ...BARS, title: [{ text: 'Sales', link: 'https://example.com' }] })],
    ['a number for a category', untyped({ ...BARS, categories: [2026, 'South'] })],
    ['a value with no text', untyped({ ...BARS, series: [{ ...PLAN, values: [{ exact: '10.25' }, null] }, ACTUAL] })],
  ] as const)('refuses a chart word that is not text: %s', async (_, chart) => {
    expect(await refused(chart)).toMatchObject({ code: 'unsupported', subject: 'sales', message: 'the chart sales has a word that is not text' })
  })

  // pdfmake cuts the whitespace at either end of a word it prints, so each
  // word is judged as it prints, trimmed: a narrow no-break space, which
  // Roboto has no glyph for, at a word's edges prints nothing and refuses
  // nothing, and inside one is refused. A title blank once trimmed is no
  // title: it prints nothing, so it asks for no bold face, which a family
  // that maps none would refuse.
  test('judges each word trimmed, so that a title blank once trimmed asks for no bold face', async () => {
    expect(await refused({ ...BARS, categories: ['\u202fNorth\u202f', 'South'] })).toBe('rendered')
    expect(await refused({ ...BARS, categories: ['North', 'South 1\u202f000'] })).toMatchObject({
      subject: 'sales',
      message: expect.stringContaining('category 1 of the chart sales prints U+202F') as string,
    })
    const regular: ResolvedFonts = { serif: { normal: SERIF.normal } }
    const serif: AxisChart = { ...BARS, style: { font: 'serif' } }
    expect(await refused({ ...serif, title: ' \u00a0\u202f' }, regular)).toBe('rendered')
    expect(await refused(serif, regular)).toMatchObject({
      code: 'unsupported',
      subject: 'sales',
      message: 'sales prints bold text in the serif font, which maps no bold face; the renderer never synthesises one',
    })
  })

  // A page region is laid out on every page, and measured before the body:
  // a chart there would be drawn once for every page, and the runtime
  // never puts one there. Refused, naming it, wherever in the region it
  // stands, rather than drawn on every page or dropped.
  test('refuses a chart in a page region, which the runtime never puts there', async () => {
    const body = documentOf('Chart', [paragraph('Body')])
    for (const [document, id] of [
      [{ ...body, pageHeader: [BARS] }, 'sales'],
      [{ ...body, pageFooter: [{ kind: 'section', padding: 4, blocks: [PIE] }] }, 'shares'],
    ] as const) {
      expect(await refusal(document)).toMatchObject({
        code: 'unsupported',
        subject: id,
        message: `the chart ${id} stands in a page region, which is drawn on every page: a chart is drawn in the body`,
      })
    }
  })

  // A chart wider than where it stands would be drawn past the margin, or
  // over the column beside it, where a printer cuts it off or it covers
  // what is there. Its box is reserved whole, so it is refused by its
  // width, wherever it stands: in the body, a column, a section whose
  // frame narrows it. One as wide as the body is drawn.
  test('refuses a chart wider than its column', async () => {
    const wide = (width: number): AxisChart => ({ ...BARS, width })
    for (const [blocks, width, room] of [
      [[wide(520)], 520, PRINTABLE_WIDTH],
      [
        [
          {
            kind: 'columns',
            columns: [
              { width: 200, blocks: [BARS] },
              { width: 'fill', blocks: [] },
            ],
          },
        ],
        300,
        200,
      ],
      [[{ kind: 'section', padding: 4, border: { thickness: 1, color: '#000000' }, blocks: [wide(510)] }], 510, PRINTABLE_WIDTH - 10],
    ] as const) {
      expect(await refusal(documentOf('Chart', blocks as readonly Block[]))).toMatchObject({
        code: 'content-too-large',
        subject: 'sales',
        message: `the chart sales is ${width} pt wide; it stands ${room.toFixed(2)} pt wide`,
      })
    }
    expect(await refused(wide(PRINTABLE_WIDTH))).toBe('rendered')
  })

  // A chart taller than the body would be drawn past the foot of every
  // page it starts on, over the page footer and off the paper. The body's
  // height is known once the page regions are measured, after every
  // check, and the render holds each fixed height to it there, with the
  // frames of the sections around it, before ECharts lays a chart out:
  // refused, naming it, in the body and in a section, and one as tall as
  // the body where it stands is drawn (`chart-content.test.ts`).
  test('refuses a chart taller than the body, with the frames around it', async () => {
    const tall = (height: number): AxisChart => ({ ...BARS, height })
    const framed = (chart: Chart): Block => ({ kind: 'section', padding: 4, border: { thickness: 1, color: '#000000' }, blocks: [chart] })
    for (const [block, height, room] of [
      [tall(BODY_HEIGHT + 0.01), BODY_HEIGHT + 0.01, BODY_HEIGHT],
      [framed(tall(BODY_HEIGHT - 10 + 0.01)), BODY_HEIGHT - 10 + 0.01, BODY_HEIGHT - 10],
    ] as const) {
      expect(await refusal(documentOf('Chart', [block]))).toMatchObject({
        code: 'content-too-large',
        subject: 'sales',
        message: `the chart sales is ${height.toFixed(2)} pt tall; the body is ${room.toFixed(2)} pt where it stands`,
      })
    }
    expect(await refusal(documentOf('Chart', [framed(tall(BODY_HEIGHT - 10))]))).toBe('rendered')
  })

  // The runtime groups a chart's rows into at most MAX_CHART_CATEGORIES
  // categories, a pie's slices among them, before it totals anything, and
  // writes a value axis of at most MAX_TICK_INTERVALS intervals; report-spec
  // admits at most MAX_CHART_SERIES series, one colour each from the
  // palette. A chart built by hand past any of them would be laid out by
  // ECharts, three times, at a cost no bound holds: refused by the bound
  // itself, before its words are read, and a chart at each bound passes
  // the check, which is what is held of it here: the drawing then refuses
  // one of them, 200 bars in a box of 300 points, as too thin to see.
  test('refuses a chart past a bound the runtime holds it to, and passes one at it', async () => {
    const categories = (count: number): AxisChart => ({
      ...BARS,
      categories: Array.from({ length: count }, (_, index) => `C${String(index)}`),
      series: [{ ...PLAN, values: Array.from({ length: count }, () => value('1')) }],
      legend: [],
    })
    const slices = (count: number): PieChart => ({ ...PIE, slices: Array.from({ length: count }, () => ({ color: '#1f77b4', value: value('1') })), legend: [] })
    const ticks = (count: number): AxisChart => ({ ...BARS, ticks: Array.from({ length: count }, (_, index) => value(String(5 * index - 5))) })
    const series = (count: number): AxisChart => ({
      ...BARS,
      series: Array.from({ length: count }, (_, index) => ({ color: `#0000${index.toString(16).padStart(2, '0')}`, values: [value('1'), null] })),
      legend: [],
    })
    expect(await refused(categories(MAX_CHART_CATEGORIES + 1))).toMatchObject({
      code: 'content-too-large',
      subject: 'sales',
      message: `the chart sales has ${String(MAX_CHART_CATEGORIES + 1)} categories; a chart has at most ${String(MAX_CHART_CATEGORIES)}`,
    })
    expect(await refused(slices(MAX_CHART_CATEGORIES + 1))).toMatchObject({
      code: 'content-too-large',
      subject: 'shares',
      message: `the chart shares has ${String(MAX_CHART_CATEGORIES + 1)} categories; a chart has at most ${String(MAX_CHART_CATEGORIES)}`,
    })
    expect(await refused(ticks(MAX_TICK_INTERVALS + 2))).toMatchObject({
      code: 'unsupported',
      subject: 'sales',
      message: `the value axis of the chart sales has ${String(MAX_TICK_INTERVALS + 2)} ticks; an axis has at most ${String(MAX_TICK_INTERVALS + 1)}`,
    })
    expect(await refused(series(MAX_CHART_SERIES + 1))).toMatchObject({
      code: 'unsupported',
      subject: 'sales',
      message: `the chart sales has ${String(MAX_CHART_SERIES + 1)} series; a chart has at most ${String(MAX_CHART_SERIES)}, one colour each from its palette`,
    })
    for (const chart of [categories(MAX_CHART_CATEGORIES), slices(MAX_CHART_CATEGORIES), ticks(MAX_TICK_INTERVALS + 1), series(MAX_CHART_SERIES)])
      expect(await checked(chart), chart.id).toEqual([{ block: chart, at: 'body[0]' }])
  })

  // What the renderer does not know is refused, never drawn as something
  // else: a kind of chart a later runtime resolves, a box of no size, a
  // colour pdfmake or ECharts would paint as another, a style the report
  // cannot print in. Its style's alignment is held to the values a
  // paragraph's is, though nothing reads it: ECharts places each word.
  test.each([
    ['a kind it does not know', untyped({ ...BARS, chart: 'donut' }), 'the chart sales is of a kind the renderer does not know'],
    ['a box of no width', { ...BARS, width: 0 }, 'the chart sales is drawn 0 × 200 pt'],
    ['a box of a height that is no number', { ...BARS, height: Number.NaN }, 'the chart sales is drawn 300 × NaN pt'],
    ['a box of an endless width', { ...BARS, width: Number.POSITIVE_INFINITY }, 'the chart sales is drawn Infinity × 200 pt'],
    [
      'a series in a colour it cannot read',
      { ...BARS, series: [{ ...PLAN, color: 'red' }, ACTUAL] },
      "the chart sales names the colour 'red', which is not #rrggbb in lower case",
    ],
    [
      "a pie's slice in upper case",
      { ...PIE, slices: [{ ...PIE.slices[0]!, color: '#1F77B4' }, ...PIE.slices.slice(1)] },
      "the chart shares names the colour '#1F77B4', which is not #rrggbb in lower case",
    ],
    [
      'a legend entry in a colour it cannot read',
      { ...BARS, legend: [BARS.legend[0]!, { text: 'Actual', color: '#ff7f0' }] },
      "the chart sales names the colour '#ff7f0', which is not #rrggbb in lower case",
    ],
    ["its words' colour", { ...BARS, style: { color: 'blue' } }, "the chart sales names the colour 'blue', which is not #rrggbb in lower case"],
    [
      'a font the report maps nothing to',
      { ...BARS, style: { font: 'mono' } },
      'the chart sales is set in the mono font, which the report maps to no host font; the renderer embeds Roboto alone, as the sans font, and prints no other in its place',
    ],
    [
      "a size past the format's",
      { ...BARS, style: { size: MAX_FONT_SIZE + 1 } },
      `the chart sales is set at ${MAX_FONT_SIZE + 1} pt; a report's text is ${MIN_FONT_SIZE} to ${MAX_FONT_SIZE} pt`,
    ],
    ['an alignment it does not know', untyped({ ...BARS, style: { align: 'justify' } }), "the chart sales is aligned 'justify'"],
  ] as const)('refuses a chart of %s', async (_, chart, message) => {
    expect(await refused(chart)).toMatchObject({ code: 'unsupported', subject: chart.id, message })
  })

  // A chart whose parts do not match would be drawn with some of them
  // left out -- a series' values past its categories, a legend entry for
  // no series -- or with a legend that names a series by another's colour,
  // or as an empty chart that prints its title and empty text and drops
  // what else it holds: the runtime resolves none of these, and the
  // renderer draws none.
  test.each([
    [
      'a series of fewer values than categories',
      { ...BARS, series: [{ ...PLAN, values: [value('10.25')] }, ACTUAL] },
      'series 0 of the chart sales has 1 value for 2 categories',
    ],
    [
      'a series of more values than categories',
      { ...BARS, series: [PLAN, { ...ACTUAL, values: [...ACTUAL.values, value('1')] }] },
      'series 1 of the chart sales has 3 values for 2 categories',
    ],
    [
      'a legend of fewer entries than series',
      { ...BARS, legend: [BARS.legend[0]!] },
      'the chart sales has 1 legend entry for 2 series, and names every series in its legend or none',
    ],
    [
      "a pie's legend of more entries than slices",
      { ...PIE, legend: [...PIE.legend, { text: 'West', color: '#d62728' }] },
      'the chart shares has 4 legend entries for 3 slices, and names every slice in its legend or none',
    ],
    [
      'a legend entry in another colour than its series',
      { ...BARS, legend: [BARS.legend[0]!, { text: 'Actual', color: '#2ca02c' }] },
      'legend entry 1 of the chart sales is not in the colour of the series it names',
    ],
    [
      "a pie's legend entry in another colour than its slice",
      { ...PIE, legend: [{ text: 'North', color: '#ff7f0e' }, ...PIE.legend.slice(1)] },
      'legend entry 0 of the chart shares is not in the colour of the slice it names',
    ],
    [
      'an empty chart that holds a category',
      { ...EMPTY, categories: ['North'] },
      'the chart nothing has nothing to draw, and holds more than its title and its empty text, which is all such a chart prints',
    ],
    [
      'an empty chart with a category axis title',
      { ...EMPTY, categoryTitle: 'Month' },
      'the chart nothing has nothing to draw, and holds more than its title and its empty text, which is all such a chart prints',
    ],
    [
      'an empty chart with a value axis title',
      { ...EMPTY, valueTitle: 'CHF' },
      'the chart nothing has nothing to draw, and holds more than its title and its empty text, which is all such a chart prints',
    ],
    [
      'an empty chart with a series',
      { ...EMPTY, series: [{ color: '#1f77b4', values: [] }] },
      'the chart nothing has nothing to draw, and holds more than its title and its empty text, which is all such a chart prints',
    ],
    [
      'an empty chart with ticks',
      { ...EMPTY, ticks: [value('0'), value('5')] },
      'the chart nothing has nothing to draw, and holds more than its title and its empty text, which is all such a chart prints',
    ],
    [
      'an empty pie with a slice',
      { ...PIE, empty: 'No data', legend: [] },
      'the chart shares has nothing to draw, and holds more than its title and its empty text, which is all such a chart prints',
    ],
    [
      'a chart of no value and no empty text',
      {
        ...BARS,
        series: [
          { ...PLAN, values: [null, null] },
          { ...ACTUAL, values: [null, null] },
        ],
      },
      'the chart sales has no value to draw, and no empty text to print in its place',
    ],
  ] as const)('refuses a chart whose parts do not match: %s', async (_, chart, message) => {
    expect(await refused(chart)).toMatchObject({ code: 'unsupported', subject: chart.id, message })
  })

  // A chart's numbers are the runtime's: each value a decimal, its ticks
  // two or more in equal steps upward holding every value, a bar's holding
  // zero, which it stands on, and a pie's slices no less than nothing and
  // more than nothing together. Any other is drawn wrong -- a mark at no
  // place, an axis upside down, a bar cut at the plot's edge or standing
  // on its foot rather than on zero, a pie of no slice -- and is refused
  // before ECharts is handed it, which the option holds as an invariant;
  // naming the chart, and quoting none of its values.
  test.each([
    [
      'a tick that is no decimal',
      { ...BARS, ticks: [...BARS.ticks.slice(0, 3), value('1e1', '10'), BARS.ticks[4]!] },
      '1e1',
      'the chart sales holds a value that is not a decimal',
    ],
    [
      'a value of a decimal point and no digit after it',
      { ...BARS, series: [{ ...PLAN, values: [value('10.', '10.00'), null] }, ACTUAL] },
      '10.',
      'the chart sales holds a value that is not a decimal',
    ],
    [
      'a value of a sign the runtime never writes',
      { ...BARS, series: [{ ...PLAN, values: [value('+10.25'), null] }, ACTUAL] },
      '+10',
      'the chart sales holds a value that is not a decimal',
    ],
    [
      'a value held as a number',
      untyped({ ...BARS, series: [{ ...PLAN, values: [{ exact: 10.25, text: '10.25' }, null] }, ACTUAL] }),
      '10.25',
      'the chart sales holds a value that is not a decimal',
    ],
    [
      "a pie's slice that is no decimal",
      { ...PIE, slices: [{ ...PIE.slices[0]!, value: value('.5') }, ...PIE.slices.slice(1)] },
      '.5',
      'the chart shares holds a value that is not a decimal',
    ],
    [
      'one tick',
      { ...BARS, series: [{ ...PLAN, values: [value('0'), null] }], legend: [], ticks: [value('0')] },
      '0',
      'the value axis of the chart sales is 1 tick, and not two or more ascending in equal steps',
    ],
    [
      'two ticks alike',
      { ...BARS, ticks: [value('-5'), value('-5')] },
      '-5',
      'the value axis of the chart sales is 2 ticks, and not two or more ascending in equal steps',
    ],
    [
      'ticks that descend',
      { ...BARS, ticks: [...BARS.ticks].reverse() },
      '15',
      'the value axis of the chart sales is 5 ticks, and not two or more ascending in equal steps',
    ],
    [
      'ticks in steps of two sizes',
      { ...BARS, ticks: [...BARS.ticks.slice(0, 4), value('20')] },
      '20',
      'the value axis of the chart sales is 5 ticks, and not two or more ascending in equal steps',
    ],
    [
      'a value above the highest tick',
      { ...BARS, series: [{ ...PLAN, values: [value('15.01'), null] }, ACTUAL] },
      '15.01',
      'the chart sales has a value its ticks do not hold, which would be drawn past its plot',
    ],
    [
      'a value below the lowest tick',
      { ...BARS, series: [PLAN, { ...ACTUAL, values: [value('15'), value('-5.5')] }] },
      '-5.5',
      'the chart sales has a value its ticks do not hold, which would be drawn past its plot',
    ],
    [
      'a bar chart whose ticks do not hold zero',
      { ...BARS, series: [{ ...PLAN, values: [value('10.25'), value('12')] }], legend: [], ticks: ['5', '10', '15'].map((exact) => value(exact)) },
      '5',
      'the chart sales is a bar chart whose ticks do not hold zero, which its bars stand on',
    ],
    [
      "a pie's slice below zero",
      { ...PIE, slices: [PIE.slices[0]!, { ...PIE.slices[1]!, value: value('-1') }, PIE.slices[2]!] },
      '-1',
      'the chart shares is a pie with a slice below zero, which is no share of a whole',
    ],
    [
      'a pie whose slices sum to nothing',
      { ...PIE, slices: PIE.slices.map(({ color }) => ({ color, value: value('0.00') })) },
      '0.00',
      'the chart shares is a pie whose slices sum to nothing, and holds no empty text to print in their place',
    ],
    [
      'a pie of no slice',
      { ...PIE, title: 'Umsatzanteile', slices: [], legend: [] },
      'Umsatzanteile',
      'the chart shares is a pie whose slices sum to nothing, and holds no empty text to print in their place',
    ],
  ] as const)('refuses %s, naming the chart and quoting no value', async (_, chart, quoted, message) => {
    const outcome = await refused(chart)
    expect(outcome).toMatchObject({ code: 'unsupported', subject: chart.id, message })
    expect((outcome as Error).message).not.toContain(quoted)
  })

  // The option holds each number it is handed as an invariant, and throws
  // a plain `Error` -- no refusal code, no subject, a bug's message --
  // where one does not hold (`chart-option.test.ts`): a chart that reached
  // it with such a number would fail its render as a fault of the
  // renderer's. Every input the option's own tests throw on is refused by
  // the check first, as the `RenderRefusal` it is, naming the chart: the
  // ticks that do not ascend evenly, a single tick, each value that is no
  // decimal as the runtime writes one, and a pie of nothing.
  const INVARIANTS: readonly (readonly [string, Chart, string])[] = [
    ...[['10', '10'], ['10', '0'], ['0', '10', '15'], ['0']].map((exacts): readonly [string, Chart, string] => [
      `the ticks ${exacts.join(' ')}`,
      { ...BARS, series: [{ ...PLAN, values: [value(exacts[0]!), null] }], legend: [], ticks: exacts.map((exact) => value(exact)) },
      `the value axis of the chart sales is ${String(exacts.length)} ${exacts.length === 1 ? 'tick' : 'ticks'}, and not two or more ascending in equal steps`,
    ]),
    ...['1e3', '12.', '.5', '+1', '', '1,000.00'].map((exact): readonly [string, Chart, string] => [
      `the value '${exact}'`,
      { ...BARS, series: [{ ...PLAN, values: [value(exact, '10'), null] }, ACTUAL] },
      'the chart sales holds a value that is not a decimal',
    ]),
    [
      'a pie of nothing',
      { ...PIE, slices: PIE.slices.map(({ color }) => ({ color, value: value('0') })) },
      'the chart shares is a pie whose slices sum to nothing, and holds no empty text to print in their place',
    ],
  ]
  test.each(INVARIANTS)('refuses what the option holds as an invariant before the option is handed it: %s', async (_, chart, message) => {
    expect(await refused(chart)).toMatchObject({ code: 'unsupported', subject: chart.id, message })
  })
})
