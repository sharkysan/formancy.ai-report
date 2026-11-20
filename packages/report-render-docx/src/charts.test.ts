import { CHART_FIXTURES, docxCharts, readDocx, readPackage, readZip, type DocxChartFrame, type DocxParagraph, type DocxTable } from '@formancy/report-corpus'
import { MAX_SCALE, type AxisChart, type Block, type Chart, type ChartValue, type PieChart, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { MAX_DOCX_CHARACTERS, MAX_DOCX_CHART_DIGITS, MAX_DOCX_CHART_POINTS, MAX_DOCX_CHARTS, MAX_DOCX_PARAGRAPHS } from './limits.js'
import { renderDocx } from './render.js'
import { documentOf, paragraph, refusalOf, written } from './testing/support.js'
import { decimal } from './xml.js'

/**
 * Charts in a Word file (0076), proved on the file the writer produced
 * (0003, as 0068 extends it): each chart's part read back by the corpus's
 * reader, which is not its writer and takes no other form of one
 * (`docxCharts`). The corpus's check holds every chart fixture's file to
 * its block (`corpus.test.ts`); here is what the block does not state and
 * the writer decides -- the part itself, the look, the digits of numbers
 * no fixture holds -- and the writer's own refusals and bounds.
 *
 * What refuses a chart's block as any engine refuses it is held to the
 * PDF renderer by the corpus's `MALFORMED` list (`against-pdf.test.ts`).
 * Nothing here shows what Word draws of a part.
 */

const TIMEOUT = 60_000

const value = (exact: string, text = exact): ChartValue => ({ exact, text })

/** A bar chart as the runtime resolves one, changed by `more`. */
function bars(more: Partial<AxisChart> = {}): AxisChart {
  return {
    kind: 'chart',
    chart: 'bar',
    id: 'sales',
    width: 300,
    height: 200,
    categories: ['North', 'South'],
    series: [{ color: '#1f77b4', values: [value('4'), value('10')] }],
    ticks: [value('0'), value('5'), value('10')],
    valueLabels: false,
    legend: [],
    ...more,
  }
}

function pie(more: Partial<PieChart> = {}): PieChart {
  return {
    kind: 'chart',
    chart: 'pie',
    id: 'shares',
    width: 200,
    height: 200,
    slices: [
      { color: '#1f77b4', value: value('3') },
      { color: '#d95f02', value: value('1') },
    ],
    legend: [
      { text: 'North: 3 (75.0 %)', color: '#1f77b4' },
      { text: 'South: 1 (25.0 %)', color: '#d95f02' },
    ],
    ...more,
  }
}

const nothing = (more: Partial<Chart> = {}): Chart =>
  ({
    kind: 'chart',
    chart: 'line',
    id: 'nothing',
    width: 300,
    height: 120,
    legend: [],
    empty: 'No rows',
    categories: [],
    series: [],
    ticks: [],
    valueLabels: false,
    ...more,
  }) as Chart

/** The charts of the file written of `blocks`. */
const charts = (...blocks: readonly Block[]): DocxChartFrame[] => docxCharts(written(documentOf(blocks)))
const only = (chart: Chart): DocxChartFrame => charts(chart)[0]!

const PALETTE = ['#1f77b4', '#d95f02', '#1b9e77', '#7570b3', '#e7298a', '#5a8f1a', '#a6761d', '#666666']
const fixture = (id: string): ResolvedDocument => CHART_FIXTURES.find((each) => each.id === id)!.document

describe('a chart with something to draw', () => {
  // A chart drawn as a picture, or left out, would open in Word and look whole: it is a part the body draws, Word's own chart, in its box.
  test('is a part of its own, which the body draws inline in exactly its box', () => {
    const bytes = renderDocx(documentOf([paragraph('Above'), bars()]))
    const opc = readPackage(bytes)
    expect([...opc.parts.keys()].filter((name) => name.startsWith('word/charts/'))).toEqual(['word/charts/chart1.xml'])
    expect(opc.parts.get('word/charts/chart1.xml')!.contentType).toBe('application/vnd.openxmlformats-officedocument.drawingml.chart+xml')
    const drawn = opc.relationships('word/document.xml').filter((each) => each.target === 'word/charts/chart1.xml')
    expect(drawn.map((each) => each.type)).toEqual(['http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart'])
    const docx = readDocx(bytes)
    const [, held] = docx.body as DocxParagraph[]
    expect(held!.runs.map((run) => run.kind)).toEqual(['chart'])
    expect(docxCharts(docx)[0]).toMatchObject({ width: 300, height: 200, id: 1, name: 'Chart 1', chart: { kind: 'bar', part: 'word/charts/chart1.xml' } })
  })

  // SECURITY.md names an embedded object and an external relationship: a chart that kept its data in a workbook, or named one, would be both.
  test('holds its data itself: the file has no workbook, the part leads nowhere and names no cell', () => {
    const bytes = renderDocx(fixture('chart-in-columns'))
    const entries = readZip(bytes)
    const names = entries.map((entry) => entry.name)
    expect(names.filter((name) => /embeddings|\.xlsx|\.bin/.test(name))).toEqual([])
    expect(names.filter((name) => name.startsWith('word/charts/'))).toEqual(['word/charts/chart1.xml', 'word/charts/chart2.xml', 'word/charts/chart3.xml'])
    const opc = readPackage(bytes)
    for (const entry of entries.filter((each) => each.name.startsWith('word/charts/'))) {
      expect(opc.relationships(entry.name)).toEqual([])
      const xml = new TextDecoder().decode(entry.bytes)
      expect(xml).not.toMatch(/externalData|<c:f>|strRef|numRef|TargetMode|http:\/\/(?!schemas\.openxmlformats\.org\/drawingml\/2006\/(chart|main)")/)
    }
  })

  // A chart of each kind is its own part, numbered as the body meets it, a column's among them; one with nothing to draw is none.
  test('is numbered as the body meets it, through columns, and a chart with nothing to draw is no part', () => {
    const read = docxCharts(written(fixture('chart-in-columns')))
    expect(read.map(({ chart, name }) => [chart.part, chart.kind, name])).toEqual([
      ['word/charts/chart1.xml', 'bar', 'Chart 1'],
      ['word/charts/chart2.xml', 'pie', 'Chart 2'],
      ['word/charts/chart3.xml', 'line', 'Chart 3'],
    ])
  })

  // A block a document holds twice is drawn twice, and each drawing has a part of its own: two drawings of one part is a file nobody has seen Word open.
  test('is a part of its own for each time the body draws it, the same block twice among them', () => {
    const chart = bars()
    expect(charts(chart, chart).map((frame) => frame.chart.part)).toEqual(['word/charts/chart1.xml', 'word/charts/chart2.xml'])
  })

  // The same document is the same file (0068): a part named by a counter that outlived the call, or a map walked in another order, would break it.
  test('is written the same, byte for byte, every time', () => {
    const document = fixture('chart-in-columns')
    expect(renderDocx(document)).toEqual(renderDocx(document))
  })

  // 0.1 + 0.2 is not 0.3 in a double, and a total of forty digits is not itself: a value written through Number would be another number's digits.
  test('writes each value as the digits the runtime holds, however many, and never through a double', () => {
    const large = '1234567890123456789012345678901234567890.25'
    const chart = bars({
      series: [{ color: '#1f77b4', values: [value(large), value('0.10')] }],
      ticks: [value('0'), value('1000000000000000000000000000000000000000'), value('2000000000000000000000000000000000000000')],
    })
    const { series, valueAxis } = only(chart).chart
    expect(series[0]!.values).toEqual([large, '0.10'])
    expect(valueAxis).toMatchObject({ min: '0', max: '2000000000000000000000000000000000000000', step: '1000000000000000000000000000000000000000' })
  })

  // Left to itself Word scales an axis from the values, to other ends and another step than the report's ticks: all three are said, exactly.
  test.each<[string, string[], { min: string; max: string; step: string; format: string }, string[]?]>([
    ['whole numbers', ['-5', '0', '5', '10'], { min: '-5', max: '10', step: '5', format: '0' }],
    ['quarters', ['0', '0.25', '0.5', '0.75'], { min: '0', max: '0.75', step: '0.25', format: '0.00' }],
    ['a step that a double does not hold', ['0.1', '0.2', '0.3'], { min: '0.1', max: '0.3', step: '0.1', format: '0.0' }],
    // Zeros the exact digits are written with are not places the axis prints: its format is the places the ticks' text prints.
    ['ticks written with zeros they do not need', ['0', '0.50', '1.00'], { min: '0', max: '1.00', step: '0.5', format: '0.0' }, ['0.0', '0.5', '1.0']],
    ['ticks below zero alone', ['-0.02', '-0.01', '0'], { min: '-0.02', max: '0', step: '0.01', format: '0.00' }],
  ])('states the value axis from its lowest tick to its highest in their step: %s', (_name, ticks, axis, texts) => {
    const chart = bars({
      chart: 'line',
      ticks: ticks.map((tick, at) => value(tick, texts?.[at])),
      series: [{ color: '#1f77b4', values: [value(ticks[0]!), value(ticks.at(-1)!)] }],
    })
    expect(only(chart).chart.valueAxis).toMatchObject(axis)
  })

  // A value the chart has none for is no point: written as zero it would be a bar on the axis and a line drawn down to it.
  test('states no point for a value the chart has none for, and breaks a line there', () => {
    const chart = bars({ chart: 'line', categories: ['Jan', 'Feb', 'Mar'], series: [{ color: '#1b9e77', values: [value('4'), null, value('10')] }] })
    expect(only(chart).chart.series[0]!.values).toEqual(['4', null, '10'])
    // The reader refuses a part that draws a missing value as zero, or spans it: read back at all, the part says `gap`.
  })

  // The bars' gaps are the PDF renderer's two numbers in Word's terms, whole hundredths of a bar: other gaps are another chart to look at.
  test.each([
    [1, 25],
    [2, 56],
    [8, 244],
  ])('draws %i bars to a category a quarter of a bar apart, and the categories a fifth of a slot apart', (count, gapWidth) => {
    const series = PALETTE.slice(0, count).map((color) => ({ color, values: [value('4'), value('10')] }))
    expect(only(bars({ series })).chart.bars).toEqual({ gapWidth, overlap: -25 })
  })

  // Each mark as the PDF draws it: a line a point and a half wide with markers four across, grey gridlines of half a point, and the category axis's line.
  test('draws a line, its markers, the gridlines and the category axis as the PDF does', () => {
    const { series, valueAxis, categoryAxis } = only(bars({ chart: 'line' })).chart
    expect(series[0]).toMatchObject({ color: '#1f77b4', line: 1.5, marker: 4 })
    expect(valueAxis!.grid).toEqual({ weight: 0.5, color: '#d9d9d9' })
    expect(categoryAxis!.line).toEqual({ weight: 0.75, color: '#000000' })
  })

  // Word writes the value axis's labels from the numbers, in the reader's own separators. Where the runtime printed the ticks with their
  // thousands grouped, a format that groups none would print 20000 under a table's 20'000; one that groups where the runtime did not
  // would print a separator the report never prints.
  test('groups the value axis’s thousands where the runtime printed its ticks grouped, and only there', () => {
    const format = (ticks: readonly ChartValue[]): string =>
      only(bars({ ticks, series: [{ color: '#1f77b4', values: [ticks[0]!, ticks.at(-1)!] }] })).chart.valueAxis!.format
    expect(format([value('0', '0.00'), value('10000', '10’000.00'), value('20000', '20’000.00')])).toBe('#,##0.00')
    // Grouped by a point, behind a currency, the same.
    expect(format([value('0', 'EUR 0'), value('5000', 'EUR 5.000'), value('10000', 'EUR 10.000')])).toBe('#,##0')
    expect(format([value('0', '0.00'), value('10000', '10000.00'), value('20000', '20000.00')])).toBe('0.00')
    // Under a thousand there is nothing to group, and a decimal comma before three places is no grouping.
    expect(format([value('0'), value('5'), value('10')])).toBe('0')
    expect(format([value('0', '0,000'), value('0.5', '0,500'), value('1', '1,000')])).toBe('0.000')
  })

  // The places are read from a tick's text, which a document made by hand may write at any length: unbounded, a tick of ten thousand
  // digits would write a format code as long into the part, counted by no bound. No number the runtime resolves has more places than
  // MAX_SCALE, so no format has more.
  test('writes the value axis’s format at no more places than any number the runtime resolves', () => {
    const long = `0.${'1'.repeat(10_000)}`
    const chart = bars({ ticks: [value('0', long), value('5'), value('10')], series: [{ color: '#1f77b4', values: [value('0'), value('10')] }] })
    expect(only(chart).chart.valueAxis!.format).toBe(`0.${'0'.repeat(MAX_SCALE)}`)
  })

  // A bar stands on where the category axis crosses: at the axis's foot a bar of -5 on an axis from -5 would be no bar at all.
  test('stands a bar chart’s category axis at zero and a line chart’s at the plot’s foot, every category labelled', () => {
    expect(only(bars()).chart.categoryAxis).toMatchObject({ crosses: 'autoZero', every: 1 })
    expect(only(bars({ chart: 'line' })).chart.categoryAxis).toMatchObject({ crosses: 'min', every: 1 })
  })

  // A label is the runtime's text, a point's own: left to Word it would be the number in the reader's own separators, without its currency.
  test('labels each value with the runtime’s own text, above a bar’s end and above a line’s point, and none where the chart labels none', () => {
    const series = [{ color: '#1f77b4', values: [value('1234.5', "CHF 1'234.50"), null] }]
    const labelled = only(bars({ series, ticks: [value('0'), value('1000'), value('2000')], valueLabels: true })).chart.series[0]!
    expect(labelled.labels.map((label) => label?.text ?? null)).toEqual(["CHF 1'234.50", null])
    expect(labelled.labelPosition).toBe('outEnd')
    expect(only(bars({ chart: 'line', valueLabels: true })).chart.series[0]!.labelPosition).toBe('t')
    expect(only(bars()).chart.series[0]).toMatchObject({ labels: [null, null] })
    expect(only(bars()).chart.series[0]!.labelPosition).toBeUndefined()
  })

  // Every word in the chart's face: one left to Word's default would print in Calibri at ten points whatever the report's style says.
  test('sets every word at 8 pt in the sans face, black, and its title bold, where its style says nothing', () => {
    const words = { family: 'Roboto', size: 8, bold: false, italic: false, color: '#000000' }
    const { chart } = only(
      bars({ title: 'Sales', categoryTitle: 'Region', valueTitle: 'CHF', valueLabels: true, legend: [{ text: 'Plan', color: '#1f77b4' }] }),
    )
    expect(chart.title).toEqual({ text: 'Sales', face: { ...words, bold: true } })
    expect([
      chart.face,
      chart.legend!.face,
      chart.categoryAxis!.face,
      chart.valueAxis!.face,
      chart.categoryAxis!.title!.face,
      chart.valueAxis!.title!.face,
    ]).toEqual(new Array(6).fill(words))
    expect(chart.series[0]!.labels[0]!.face).toEqual(words)
  })

  // The style's size, weight, slant and colour are every word's; its font token is the family the report maps, named as Word lists it.
  test('sets every word as its style says, in the family its font token maps', () => {
    const styled = only(bars({ title: 'Sales', style: { size: 11.5, bold: true, italic: true, color: '#336699' } })).chart
    expect(styled.face).toEqual({ family: 'Roboto', size: 11.5, bold: true, italic: true, color: '#336699' })
    expect(styled.title!.face).toEqual(styled.face)
    const [serif] = docxCharts(written(fixture('chart-host-font')))
    expect(serif!.chart.face.family).toBe('Liberation Serif')
    expect(serif!.chart.title!.face).toMatchObject({ family: 'Liberation Serif', bold: true })
  })

  // The PDF trims a word and prints none of one that is blank; a Word file that kept the spaces, or an empty title, would print otherwise.
  // And a slot whose word prints nothing is stated as nothing: left unstated, Word writes a number for the category and "Series2" for the series.
  test('writes each word trimmed, a category and a series’ name that print nothing as nothing, and no title or label of nothing', () => {
    const chart = bars({
      title: '   ',
      categoryTitle: ' Region ',
      categories: [' North ', '\u00a0'],
      series: [
        { color: '#1f77b4', values: [value('4', ' 4.00 '), value('10', ' ')] },
        { color: '#d95f02', values: [value('1'), value('2')] },
      ],
      valueLabels: true,
      legend: [
        { text: ' Plan ', color: '#1f77b4' },
        { text: ' ', color: '#d95f02' },
      ],
    })
    const read = only(chart).chart
    expect(read.title).toBeUndefined()
    expect(read.categoryAxis!.title!.text).toBe('Region')
    expect(read.series.map((series) => series.categories)).toEqual([
      ['North', ''],
      ['North', ''],
    ])
    expect(read.series.map((series) => series.name)).toEqual(['Plan', ''])
    expect(read.series[0]!.labels.map((label) => label?.text ?? null)).toEqual(['4.00', null])
  })

  // A pie's legend entries are its categories, the runtime's own words with each value and share: Word's own percentages would round again.
  test('names a pie’s slices by its legend’s entries, paints each in its colour, and names none where it has no legend', () => {
    const [series] = only(pie()).chart.series
    expect(series).toMatchObject({ categories: ['North: 3 (75.0 %)', 'South: 1 (25.0 %)'], values: ['3', '1'], points: ['#1f77b4', '#d95f02'] })
    expect(series!.labels).toEqual([null, null])
    // A legend entry that prints nothing is its slice's name all the same, as nothing.
    expect(only(pie({ legend: [pie().legend[0]!, { text: ' ', color: '#d95f02' }] })).chart.series[0]!.categories).toEqual(['North: 3 (75.0 %)', ''])
    const bare = only(pie({ legend: [] })).chart
    expect(bare.series[0]!.categories).toEqual([null, null])
    expect(bare.legend).toBeUndefined()
  })

  // A legend is the chart's to have or not: a chart of one series has none, and Word must not title it by that series either.
  test('has a legend at its foot where the chart has one, and none, and no title of Word’s, where it has none', () => {
    expect(only(pie()).chart.legend).toMatchObject({ position: 'b' })
    const plain = only(bars()).chart
    expect([plain.legend, plain.title]).toEqual([undefined, undefined])
  })

  // What a chart is kept with is its paragraph's mark, as a picture's: a heading that keeps with it, and the lines of its block.
  test('is kept with the heading over it, and with the lines of its keep-together block', () => {
    const heading: Block = { kind: 'paragraph', runs: [{ text: 'Sales' }], keepWithNext: true }
    const [head, drawn] = written(documentOf([heading, bars()])).body as DocxParagraph[]
    expect([head!.keepNext, drawn!.keepNext, drawn!.keepLines]).toEqual([true, false, false])
    const kept = written(documentOf([{ kind: 'keepTogether', blocks: [bars(), paragraph('Under it')] }])).body as DocxParagraph[]
    expect(kept.map((each) => [each.keepNext, each.keepLines])).toEqual([
      [true, true],
      [false, true],
    ])
  })

  // In a framed section a chart stands in a table's cell, as a picture does: an inline drawing, in the body's part.
  test('is drawn in a framed section and in a column, a part of the body all the same', () => {
    const framed = written(documentOf([{ kind: 'section', padding: 6, blocks: [bars()] }]))
    expect(docxCharts(framed).map(({ chart }) => chart.part)).toEqual(['word/charts/chart1.xml'])
    expect((framed.body[0] as DocxTable).rows[0]!.cells[0]!.blocks[0]).toMatchObject({ kind: 'paragraph', runs: [{ kind: 'chart' }] })
  })
})

// The checks refuse a number that is no decimal before anything is written: one that reached the part all the same is a defect, never digits Word reads otherwise.
test('a number is written as the decimal it is, digit for digit, and nothing else is written as one', () => {
  expect(String(decimal('-0.50'))).toBe('-0.50')
  for (const wrong of ['1e3', '1,5', '.5', '5.', '+1', '0x10', '1 000', ''])
    expect(() => decimal(wrong)).toThrow(/a value that is no decimal reached the writer/)
})

describe('a chart with nothing to draw', () => {
  // Word's own chart of no data is an empty plot with nowhere to say why: the box and the two words the PDF prints are what a reader needs.
  test('is its box, a cell as wide and at least as tall, with its title, bold, and its empty text in the middle, and no part', () => {
    const docx = written(documentOf([nothing({ title: 'Balance' })]))
    expect(docxCharts(docx)).toEqual([])
    expect([...docx.parts.keys()].filter((name) => name.startsWith('word/charts/'))).toEqual([])
    const [box] = docx.body as DocxTable[]
    // And the row does not split: the PDF reserves the box whole, on one page.
    expect(box).toMatchObject({ width: 300, grid: [300], rows: [{ cantSplit: true, height: { value: 120, rule: 'atLeast' }, cells: [{ align: 'center' }] }] })
    const lines = box!.rows[0]!.cells[0]!.blocks as DocxParagraph[]
    expect(lines.map((line) => [line.runs[0], line.align])).toEqual([
      [{ kind: 'text', text: 'Balance', props: { family: 'Roboto', bold: true, italic: false, color: '#000000', size: 8 } }, 'center'],
      [{ kind: 'text', text: 'No rows', props: { family: 'Roboto', bold: false, italic: false, color: '#000000', size: 8 } }, 'center'],
    ])
  })

  // A row of an exact height cuts what does not fit it, and nothing would say so: the box may grow, and no word of it is lost.
  test('never states its height exactly, whatever its words are set at', () => {
    const [box] = written(documentOf([nothing({ height: 10, style: { size: 40 } })])).body as DocxTable[]
    expect(box!.rows[0]!.height).toEqual({ value: 10, rule: 'atLeast' })
  })

  // Its box is reserved whole whatever it holds, as the PDF reserves it: a chart of no words is still its room on the page.
  test('reserves its box where neither its title nor its empty text prints', () => {
    const [box] = written(documentOf([nothing({ empty: '  ' })])).body as DocxTable[]
    expect(box!.rows[0]!.height).toEqual({ value: 120, rule: 'atLeast' })
    expect(box!.rows[0]!.cells[0]!.blocks).toMatchObject([{ kind: 'paragraph', runs: [] }])
  })
})

describe('a chart is refused', () => {
  // Word draws a header on every page, and the PDF draws no chart in one: a chart stands in the body in both.
  test.each<[string, Partial<ResolvedDocument>, RegExp]>([
    ['in the page header', { pageHeader: [bars()] }, /the chart sales stands in a page region, which every page prints: a chart stands in the body/],
    ['in the page footer', { pageFooter: [nothing()] }, /the chart nothing stands in a page region/],
    ["in page 1's own header", { firstPageHeader: [bars()] }, /the chart sales stands in page 1's own header, a page region/],
  ])('%s, by its id', (_name, more, sentence) => {
    const refusal = refusalOf(documentOf([], more))
    expect(refusal).toMatchObject({ code: 'unsupported', subject: more.pageFooter === undefined ? 'sales' : 'nothing' })
    expect(refusal.message).toMatch(sentence)
  })

  // No page of a Word file holds a box taller than its printable area, drawn or not.
  test.each([bars({ height: 742 }), nothing({ height: 742 })])('taller than the printable area, as a picture is', (chart) => {
    const refusal = refusalOf(documentOf([chart]))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: chart.id })
    expect(refusal.message).toMatch(/is 742 pt tall; the printable area is 741\.89 pt/)
    expect(() => renderDocx(documentOf([{ ...chart, height: 741 }]))).not.toThrow()
  })

  // A tick's label is Word's to write, and the PDF prints it: a document the PDF refuses for one is refused as a Word file for the same.
  test('for a tick’s label no report prints, though a Word file does not state it', () => {
    const chart = bars({ ticks: [value('0'), value('5', 'fünf\ttausend'), value('10')] })
    expect(refusalOf(documentOf([chart]))).toMatchObject({ code: 'unsupported', subject: 'sales' })
  })

  // A refusal quotes none of the chart's words or values, each of which may be the data's.
  test('in a sentence that names the chart and quotes none of its words', () => {
    const secret = 'Meier AG'
    const wrong = [
      bars({ categories: [secret, `${secret}\n`] }),
      bars({ title: `${secret} 東京` }),
      bars({ series: [{ color: '#1f77b4', values: [value('4'), value('99', secret)] }] }),
      bars({ legend: [{ text: secret, color: '#000000' }] }),
    ]
    for (const chart of wrong) {
      const { message } = refusalOf(documentOf([chart]))
      expect(message).toContain('the chart sales')
      expect(message).not.toContain(secret)
    }
  })
})

/**
 * How long a case of the bounds may take. The heaviest writes four
 * million characters into one chart's categories, four times: 1.0
 * seconds alone, and 6.1 under coverage beside another job, which is how
 * CI's test job runs this suite and is past vitest's own 5 seconds:
 * measured on 19 November 2026 on an Intel Core i9-10900K shared with
 * other work, under Node 24.21.0. No CI runner was timed.
 */
describe('the charts of a file, and the points they hold between them', { timeout: TIMEOUT }, () => {
  // The bounds as they are stated and measured (`limits.ts`): one changed alone would leave the record and the README stating another.
  test('are 64 charts and 25,600 points, sixteen of the largest chart the runtime resolves', () => {
    expect([MAX_DOCX_CHARTS, MAX_DOCX_CHART_POINTS]).toEqual([64, 25_600])
  })

  const many = (count: number, make: (index: number) => Block): Block[] => Array.from({ length: count }, (_, index) => make(index))
  /** A chart of `series` series over `categories` categories, every value 1. */
  const full = (id: string, series: number, categories: number): AxisChart =>
    bars({
      id,
      height: 20,
      chart: 'line',
      categories: Array.from({ length: categories }, (_, index) => String(index)),
      series: PALETTE.slice(0, series).map((color) => ({ color, values: new Array<ChartValue>(categories).fill(value('1')) })),
      ticks: [value('0'), value('1')],
    })

  // A limit applied with >= where it means > refuses what it promised: at the bound every chart is a part of the file.
  test(
    'at the count’s bound are written, each a part, and one past it is refused, naming the chart that crossed',
    () => {
      const most = many(MAX_DOCX_CHARTS, (index) => bars({ id: `c${index}`, height: 20 }))
      expect(docxCharts(written(documentOf(most)))).toHaveLength(MAX_DOCX_CHARTS)
      const refusal = refusalOf(documentOf([...most, bars({ id: 'crossed' })]))
      expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'crossed' })
      expect(refusal.message).toMatch(/the report holds more than 64 charts, crossed the first past them/)
    },
    TIMEOUT,
  )

  // A chart with nothing to draw is no part and no point: it is counted with the paragraphs, where its cell and its words are.
  test('a chart with nothing to draw is none of them', () => {
    const most = many(MAX_DOCX_CHARTS, (index) => bars({ id: `c${index}`, height: 20 }))
    expect(() => renderDocx(documentOf([...most, ...many(8, (index) => nothing({ id: `n${index}`, height: 20 }))]))).not.toThrow()
  })

  // Sixteen charts of eight series over two hundred categories are the points' bound exactly.
  test(
    'at the points’ bound are written, every point of them, and one past it is refused, naming the chart that crossed',
    () => {
      const most = many(16, (index) => full(`c${index}`, 8, 200))
      const read = docxCharts(written(documentOf(most)))
      expect(
        read.reduce((points, { chart }) => points + chart.series.reduce((sum, series) => sum + series.values.filter((each) => each !== null).length, 0), 0),
      ).toBe(MAX_DOCX_CHART_POINTS)
      const refusal = refusalOf(documentOf([...most, full('crossed', 1, 1)]))
      expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'crossed' })
      expect(refusal.message).toMatch(/the report's charts up to crossed hold 25601 points between them/)
    },
    TIMEOUT,
  )

  // A pie's slices are points too, and a value the chart has none for is a point all the same: its category is written for it.
  test('a slice is a point, and so is a value a series has none for', () => {
    const most = many(16, (index) => full(`c${index}`, 8, 200))
    const last = most.pop() as AxisChart
    const gaps = { ...last, series: last.series.map((series, index) => (index === 0 ? { ...series, values: series.values.map(() => null) } : series)) }
    expect(refusalOf(documentOf([...most, gaps, pie({ id: 'crossed' })]))).toMatchObject({ code: 'content-too-large', subject: 'crossed' })
    const short = { ...last, series: last.series.slice(1) }
    expect(refusalOf(documentOf([...most, short, full('held', 1, 198), pie({ id: 'crossed', height: 20 }), pie({ id: 'second', height: 20 })]))).toMatchObject({
      subject: 'second',
    })
  })

  // Counted before the work they bound: a chart past either bound is refused for it before a word or a number of it is read.
  test('are counted before a chart’s words and numbers are read', () => {
    const most = many(MAX_DOCX_CHARTS, (index) => bars({ id: `c${index}`, height: 20 }))
    const unread = { ...bars({ id: 'crossed' }), title: 7, ticks: [value('none')] } as unknown as Block
    expect(refusalOf(documentOf([...most, unread]))).toMatchObject({ code: 'content-too-large', subject: 'crossed' })
    const points = many(16, (index) => full(`c${index}`, 8, 200))
    expect(refusalOf(documentOf([...points, unread]))).toMatchObject({ code: 'content-too-large', subject: 'crossed' })
  })

  // A chart's words and digits are characters of the file, written as often as its part states them: uncounted, one chart could hold what no file may.
  test('a chart’s words and its numbers’ digits are counted with the file’s characters, a category once for each series', () => {
    // One series: the category, the value's digit and the ticks' two digits are the characters.
    const at = (length: number, series = 1): AxisChart => {
      const chart = full('wordy', series, 1)
      return { ...chart, categories: ['x'.repeat(length)] }
    }
    expect(() => renderDocx(documentOf([at(MAX_DOCX_CHARACTERS - 3)]))).not.toThrow()
    expect(refusalOf(documentOf([at(MAX_DOCX_CHARACTERS - 2)]))).toMatchObject({ code: 'content-too-large', subject: 'wordy' })
    // Two series name the category twice, and hold a digit each.
    expect(refusalOf(documentOf([at(MAX_DOCX_CHARACTERS / 2 - 1, 2)]))).toMatchObject({ code: 'content-too-large', subject: 'wordy' })
    expect(() => renderDocx(documentOf([at(MAX_DOCX_CHARACTERS / 2 - 2, 2)]))).not.toThrow()
  })

  // The digits of a chart's numbers are written as they are: uncounted, sixteen charts of the longest numbers would hold twice a file's characters.
  test('a number’s digits are counted with the characters, as often as the part writes them', () => {
    const longest = `${'9'.repeat(308)}.${'9'.repeat(20)}`
    const heavy = (index: number): AxisChart => {
      const chart = full(`c${index}`, 8, 200)
      return {
        ...chart,
        ticks: [value('0'), value(`1${'0'.repeat(308)}`)],
        series: chart.series.map((each) => ({ ...each, values: each.values.map(() => value(longest)) })),
      }
    }
    // 1,600 values of 329 characters and the ticks' 310 are 526,710 a chart: the eighth takes the file past four million.
    expect(refusalOf(documentOf(many(16, heavy)))).toMatchObject({ code: 'content-too-large', subject: 'c7' })
    expect(() => renderDocx(documentOf(many(7, heavy)))).not.toThrow()
  })

  // What the checks work out of a number they work out in BigInt, digit by digit: a number of a million digits at every point would hold the thread.
  test('a number written longer than any the runtime resolves is refused before it is read as one', () => {
    const longest = `-${'9'.repeat(308)}.${'9'.repeat(20)}`
    const axis = [value(`-1${'0'.repeat(308)}`), value('0')]
    const chart = (exact: string): AxisChart => bars({ chart: 'line', ticks: axis, series: [{ color: '#1f77b4', values: [value(exact), value('0')] }] })
    expect(MAX_DOCX_CHART_DIGITS).toBe(330)
    expect(only(chart(longest)).chart.series[0]!.values).toEqual([longest, '0'])
    const refusal = refusalOf(documentOf([chart(`${longest}9`)]))
    expect(refusal).toMatchObject({ code: 'content-too-large', subject: 'sales' })
    expect(refusal.message).toMatch(/holds a number written in 331 characters; a report's number is at most 330/)
    expect(refusalOf(documentOf([pie({ slices: [{ color: '#1f77b4', value: value('1'.repeat(331)) }], legend: [] })]))).toMatchObject({
      code: 'content-too-large',
    })
    expect(refusalOf(documentOf([bars({ ticks: [value('0'), value(`0.${'0'.repeat(400)}1`)] })]))).toMatchObject({ code: 'content-too-large' })
  })

  // A chart is a paragraph of the body, and one with nothing to draw a cell and its two lines: neither passes the paragraphs' bound uncounted.
  test(
    'a chart is counted as a paragraph, and one with nothing to draw as its cell and its lines',
    () => {
      const spacers = many(MAX_DOCX_PARAGRAPHS - 1, () => ({ kind: 'spacer', height: 1 }))
      expect(refusalOf(documentOf([...spacers, { kind: 'spacer', height: 1 }, bars()]))).toMatchObject({ code: 'content-too-large', subject: 'sales' })
      // Its cell two, as every table of one cell (`ONE_CELL_TABLE`), and its title and its empty text a paragraph each.
      expect(refusalOf(documentOf([...spacers.slice(2), nothing({ title: 'Balance' })]))).toMatchObject({ code: 'content-too-large', subject: 'nothing' })
      expect(() => renderDocx(documentOf([...spacers.slice(3), nothing({ title: 'Balance' })]))).not.toThrow()
      expect(() => renderDocx(documentOf([...spacers, bars()]))).not.toThrow()
    },
    2 * TIMEOUT,
  )
})
