import type { AxisChart, Block, Chart, ChartValue, PieChart, ResolvedDocument } from '../document.js'
import { expectation, type ExpectedRefusal, type Fixture, type Stated } from '../fixture.js'
import { documentOf, heading, paragraph } from './build.js'
import { hostFonts } from './host-fonts.js'

/**
 * Charts (0058), each a block built by hand as the runtime resolves one
 * (`lower-chart.ts`): its ticks, its values' texts and its legend's words
 * written as the runtime writes them, every colour its palette's. Each
 * stands in the corpus's document, and is proved on the PDF the renderer
 * draws of it by the corpus's checks (`check-charts.ts`): each word in its
 * box, and in its face where a host's font prints it, each bar its
 * value's length, each line through its points, each slice its share's
 * sector, and nothing past its box.
 *
 * Between them they hold what the drawing must and must not do: a bar
 * below zero labelled under its end, at the lowest tick, which the
 * renderer draws only where it keeps room for the label below the plot
 * (Task 21), though no check here proves where a value's label stands,
 * only that it prints inside the box and meets no other word; a line
 * broken where a value is missing, and a series with no value at all,
 * which draws no mark and prints its legend's entry; a pie with a slice of
 * nothing, which
 * draws no path and keeps its legend's entry, and one of 9999 and 1,
 * which draws both; charts with nothing to draw; a chart that does not
 * fit at the page's foot, moved whole with the heading kept with it, and
 * one in a keep-together block; charts side by side in columns, an empty
 * one beside a drawn one; a chart's words in a host's font; and words
 * ECharts would read as markup (Review Focus 2). And charts the renderer
 * refuses whole, naming the chart, never drawing one that cannot be read
 * (Review Focus 4): labels too wide for their slots, bars narrower than
 * the least it draws, labelled or not, a plot too short for two tick
 * labels, and a word in a script it does not print.
 *
 * Not in `ALL_FIXTURES`, which is the corpus the renderer trial chose an
 * engine on (0005): neither trial adapter draws a chart.
 */

/** A value the runtime resolved: exactly, and as it prints. */
const value = (exact: string, text = exact): ChartValue => ({ exact, text })

/** The ticks the runtime writes from `from` to `to` in steps of `step`, each printing as `text` makes it. */
function ticks(from: number, to: number, step: number, text: (tick: number) => string = String): ChartValue[] {
  return Array.from({ length: (to - from) / step + 1 }, (_, index) => {
    const tick = from + index * step
    return value(String(tick), text(tick))
  })
}

/** The runtime's palette, which a chart's series and slices are coloured from, in order. */
const PALETTE = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'] as const

/** A document of `body` whose expectation is derived, laid under `stated`. */
function fixtureOf(id: string, title: string, body: readonly Block[], stated: Stated, document: Partial<ResolvedDocument> = {}): Fixture {
  const made: ResolvedDocument = { ...documentOf(title, body), ...document }
  return { id, title, document: made, maxPages: 5, expect: expectation(made, stated) }
}

/** A document of `chart` under a heading, which the renderer refuses whole, naming the chart, with `code`. */
function refusedOf(id: string, title: string, chart: Chart, code: ExpectedRefusal['code']): Fixture {
  return fixtureOf(id, title, [heading(title), chart], { outcome: 'refuse', refusal: { code, subject: chart.id }, maxPagesExpected: 5 })
}

/**
 * Two series of bars over four regions, each labelled: one bar at each end
 * of the axis, the one below zero at its lowest tick, labelled under its
 * end; a zero, which stands along zero; and a value missing, which draws
 * nothing.
 */
const SALES: AxisChart = {
  kind: 'chart',
  chart: 'bar',
  id: 'sales',
  width: 360,
  height: 240,
  title: 'Sales by region',
  categoryTitle: 'Region',
  valueTitle: 'CHF thousands',
  categories: ['North', 'South', 'East', 'West'],
  series: [
    { color: PALETTE[0], values: [value('10.25'), value('-5', '-5.00'), null, value('7.5', '7.50')] },
    { color: PALETTE[1], values: [value('15', '15.00'), value('2.5', '2.50'), value('-2.5', '-2.50'), value('0', '0.00')] },
  ],
  ticks: ticks(-5, 15, 5),
  valueLabels: true,
  legend: [
    { text: 'Plan', color: PALETTE[0] },
    { text: 'Actual', color: PALETTE[1] },
  ],
}

export const chartBars = fixtureOf('chart-bars', 'Bar chart', [heading('Bar chart'), SALES], { maxPagesExpected: 1 })

/** One labelled line over six months, broken where March has no value, one of its values below zero. */
const BALANCE: AxisChart = {
  kind: 'chart',
  chart: 'line',
  id: 'balance',
  width: 360,
  height: 220,
  title: 'Balance',
  categoryTitle: 'Month',
  valueTitle: 'CHF',
  categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  series: [{ color: PALETTE[2], values: [value('6'), value('12'), null, value('9'), value('-3'), value('4')] }],
  ticks: ticks(-5, 15, 5),
  valueLabels: true,
  legend: [],
}

export const chartLine = fixtureOf('chart-line', 'Line chart', [heading('Line chart'), BALANCE], { maxPagesExpected: 1 })

/**
 * Two lines and a legend naming both: one with a lone value and a stretch
 * after a gap, which ECharts draws as a marker alone and a line of two
 * points; one with no value at all, which draws no mark, and whose
 * legend's entry still prints.
 */
const LEDGER: AxisChart = {
  kind: 'chart',
  chart: 'line',
  id: 'ledger',
  width: 360,
  height: 220,
  title: 'Paid and owed',
  categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [
    { color: PALETTE[0], values: [value('4'), null, value('6'), value('8')] },
    { color: PALETTE[1], values: [null, null, null, null] },
  ],
  ticks: ticks(0, 8, 2),
  valueLabels: false,
  legend: [
    { text: 'Paid', color: PALETTE[0] },
    { text: 'Owed', color: PALETTE[1] },
  ],
}

export const chartLineNoValue = fixtureOf('chart-line-no-value', 'Line with a series of no value', [heading('Line with a series of no value'), LEDGER], {
  maxPagesExpected: 1,
})

/** A pie of four regions, one of them nothing, its values and shares in its legend, which names the slice of nothing too. */
const TURNOVER: PieChart = {
  kind: 'chart',
  chart: 'pie',
  id: 'turnover',
  width: 240,
  height: 240,
  title: 'Turnover by region',
  slices: [
    { color: PALETTE[0], value: value('45') },
    { color: PALETTE[1], value: value('30') },
    { color: PALETTE[2], value: value('0') },
    { color: PALETTE[3], value: value('25') },
  ],
  legend: [
    { text: 'North: 45 (45.0 %)', color: PALETTE[0] },
    { text: 'South: 30 (30.0 %)', color: PALETTE[1] },
    { text: 'East: 0 (0.0 %)', color: PALETTE[2] },
    { text: 'West: 25 (25.0 %)', color: PALETTE[3] },
  ],
}

export const chartPie = fixtureOf('chart-pie', 'Pie chart', [heading('Pie chart'), TURNOVER], { maxPagesExpected: 1 })

/** A pie of 9999 and 1 at 160.23 pt, whose sliver zrender wrote as an arc whose ends round to one point, and which once printed blank. */
const SLIVER: PieChart = {
  kind: 'chart',
  chart: 'pie',
  id: 'sliver',
  width: 160.23,
  height: 160.23,
  title: 'Shares',
  slices: [
    { color: PALETTE[0], value: value('9999') },
    { color: PALETTE[1], value: value('1') },
  ],
  legend: [
    { text: 'S1 9999', color: PALETTE[0] },
    { text: 'S2 1', color: PALETTE[1] },
  ],
}

export const chartPieSliver = fixtureOf('chart-pie-sliver', 'Pie of 9999 and 1', [heading('Pie of 9999 and 1'), SLIVER], { maxPagesExpected: 1 })

/** A chart with nothing to draw: its title and its empty text, and nothing else, as the runtime resolves one (R7, R8). */
function emptyChart(id: string, chart: Chart['chart'], width: number, height: number, empty: string, title?: string): Chart {
  const frame = { kind: 'chart', id, width, height, ...(title === undefined ? {} : { title }), legend: [], empty } as const
  return chart === 'pie' ? { ...frame, chart, slices: [] } : { ...frame, chart, categories: [], series: [], ticks: [], valueLabels: false }
}

export const chartEmpty = fixtureOf(
  'chart-empty',
  'Charts with nothing to draw',
  [
    heading('Charts with nothing to draw'),
    emptyChart('nothing', 'line', 300, 120, 'No rows to chart', 'Balance'),
    emptyChart('no-turnover', 'pie', 200, 200, 'No turnover yet'),
  ],
  { maxPagesExpected: 1 },
)

/** Points: the spacer at the top of `chart-page-foot`'s first and second pages, which leaves the chart after it less room than it takes. */
export const FOOT_SPACERS = [600, 420] as const

/** The heading kept with the chart at the first page's foot, and the line kept with the pie in a keep-together block at the second's. */
export const FOOT_HEADING = 'Turnover at the foot'
export const FOOT_KEPT = 'Kept with its pie'

/**
 * A chart under a heading that keeps with it, where a spacer leaves the
 * page's foot less room than the two take: both move to the next page
 * whole, its words with it, never split or drawn over the footer; and a
 * pie in a keep-together block with a line, at the foot of that page,
 * which moves to the third the same way (Review Focus 4).
 */
export const chartPageFoot = fixtureOf(
  'chart-page-foot',
  'Charts at the foot of a page',
  [
    paragraph('Above the spacer on the first page.'),
    { kind: 'spacer', height: FOOT_SPACERS[0] },
    heading(FOOT_HEADING),
    { ...SALES, id: 'moved', title: 'Quarterly turnover', legend: [], series: [SALES.series[0]!] },
    { kind: 'spacer', height: FOOT_SPACERS[1] },
    { kind: 'keepTogether', blocks: [paragraph(FOOT_KEPT), { ...TURNOVER, id: 'kept', title: 'Regional shares' }] },
  ],
  {
    minPagesExpected: 3,
    maxPagesExpected: 3,
    // Every page prints text between its page regions, so a page left empty is still a problem, spacers or not.
    noEmptyPages: true,
    // Each heading or line on the page its chart's title is on.
    keptTogether: [
      [FOOT_HEADING, 'Quarterly turnover'],
      [FOOT_KEPT, 'Regional shares'],
    ],
  },
)

/**
 * Charts side by side in columns, a bar chart beside a pie; and below them
 * a column with a line under a spacer beside one with a chart with
 * nothing to draw, which stands higher than the line: its words are
 * sought after what stands before the columns, never after the line
 * beside it.
 */
export const chartInColumns = fixtureOf(
  'chart-in-columns',
  'Charts in columns',
  [
    heading('Charts in columns'),
    {
      kind: 'columns',
      columns: [
        { width: 'fill', blocks: [{ ...SALES, id: 'left', width: 250, height: 200, categoryTitle: 'Area', valueTitle: 'CHF' }] },
        { width: 'fill', blocks: [{ ...TURNOVER, id: 'right', width: 250, height: 200 }] },
      ],
    },
    {
      kind: 'columns',
      columns: [
        {
          width: 'fill',
          blocks: [
            { kind: 'spacer', height: 40 },
            { ...LEDGER, id: 'lower', width: 250, height: 160 },
          ],
        },
        { width: 'fill', blocks: [emptyChart('beside', 'bar', 250, 100, 'Nothing to compare', 'Compared')] },
      ],
    },
  ],
  { maxPagesExpected: 1 },
)

/** The serif face the host font fixture maps, its regular and bold among them. */
const SERIF = { serif: hostFonts.document.fonts!.serif! }

export const chartHostFont = fixtureOf(
  'chart-host-font',
  'Chart in a host font',
  [heading('Chart in a host font'), { ...SALES, id: 'serif', style: { font: 'serif' } }],
  { maxPagesExpected: 1 },
  { fonts: SERIF },
)

/** A number as fr-CH prints it under ICU 78.3: an ASCII apostrophe between its thousands (C8). */
const swiss = (amount: number): string => String(amount).replace(/\B(?=(\d{3})+$)/g, "'")

/**
 * Words ECharts would read as something else, printed as written: its
 * rich text and its templates (`{a|b}`, `{name}`), XML's markup (`A & B`,
 * `<b>`), the apostrophe zrender writes as `&#39;` (`l'été`), and numbers
 * written with it, as fr-CH writes them (Review Focus 2, C8).
 */
const MARKUP: AxisChart = {
  kind: 'chart',
  chart: 'bar',
  id: 'markup',
  width: 420,
  height: 220,
  title: 'Sales & <returns>',
  categories: ['{a|b}', '{name}', 'A & B', '<b>', "l'été"],
  series: [{ color: PALETTE[4], values: [1200, 450, 1500, 0, 980].map((amount) => value(String(amount), swiss(amount))) }],
  ticks: ticks(0, 1500, 500, swiss),
  valueLabels: true,
  legend: [],
}

export const chartMarkup = fixtureOf('chart-markup', 'Chart words read as markup', [heading('Chart words read as markup'), MARKUP], { maxPagesExpected: 1 })

/** Six regions whose names are wider than their slots, across or turned: refused, never turned, cut or hidden (R6). */
export const chartLabelsTooWide = refusedOf(
  'chart-labels-too-wide',
  'Category labels too wide',
  {
    ...SALES,
    id: 'wide-labels',
    width: 300,
    valueLabels: false,
    categories: ['Northern Highlands', 'Southern Lowlands', 'Eastern Seaboard', 'Western Plateau', 'Central Basin', 'Outer Islands'],
    series: SALES.series.map(({ color }) => ({ color, values: ['3', '5', '2', '7', '4', '6'].map((exact) => value(exact)) })),
  },
  'content-too-large',
)

/** Two series over fifty categories in 300 pt: bars under the 3.5 pt the renderer draws at least, whatever the plot. */
const THIN: AxisChart = {
  ...SALES,
  id: 'thin-bars',
  width: 300,
  valueLabels: false,
  categories: Array.from({ length: 50 }, (_, index) => String(index + 1)),
  series: SALES.series.map(({ color }) => ({ color, values: Array.from({ length: 50 }, (_, index) => value(String(index % 15))) })),
}

export const chartBarsTooThin = refusedOf('chart-bars-too-thin', 'Bars too thin', THIN, 'content-too-large')

/** The same bars labelled: refused for their width, before ECharts drops a label it has no room for (Task 21). */
export const chartBarsTooThinLabelled = refusedOf(
  'chart-bars-too-thin-labelled',
  'Labelled bars too thin',
  { ...THIN, id: 'thin-labelled', valueLabels: true },
  'content-too-large',
)

/** A bar chart 30 pt tall, with no title, axis title or legend: no room for two tick labels apart beside a plot. */
const SHORT: AxisChart = {
  kind: 'chart',
  chart: 'bar',
  id: 'short',
  width: 300,
  height: 30,
  categories: SALES.categories,
  series: SALES.series,
  ticks: SALES.ticks,
  valueLabels: false,
  legend: [],
}

export const chartTooShort = refusedOf('chart-too-short', 'Chart too short', SHORT, 'content-too-large')

/** A Japanese category: a script the renderer does not print, in any face (0043). */
export const chartUnprintableLabel = refusedOf(
  'chart-unprintable-label',
  'Chart word in an unprinted script',
  { ...SALES, id: 'tokyo', categories: ['North', 'South', '東京', 'West'] },
  'unsupported',
)

/** The chart fixtures, which the renderer answers to beside `ALL_FIXTURES` and the SVG ones. */
export const CHART_FIXTURES: readonly Fixture[] = [
  chartBars,
  chartLine,
  chartLineNoValue,
  chartPie,
  chartPieSliver,
  chartEmpty,
  chartPageFoot,
  chartInColumns,
  chartHostFont,
  chartMarkup,
  chartLabelsTooWide,
  chartBarsTooThin,
  chartBarsTooThinLabelled,
  chartTooShort,
  chartUnprintableLabel,
]
