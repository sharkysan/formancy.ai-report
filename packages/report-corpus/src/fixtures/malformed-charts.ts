import type { AxisChart, Block, Chart, ChartValue, PieChart, ResolvedDocument } from '../document.js'
import { documentOf, paragraph } from './build.js'

/**
 * Charts no engine prints (0076): each the chart of a document that
 * breaks a chart's contract with an engine in one way -- where it stands,
 * what it is, a bound no chart the runtime resolves passes, its style or
 * a colour, parts that do not match, a word that is no text a chart
 * prints, numbers that are no axis and no shares -- and that an engine
 * can refuse from the block alone, before it lays anything out.
 *
 * What an engine must refuse of a chart's block is stated in each
 * engine, report-render-pdf's `check-chart.ts` and report-render-docx's
 * `chart-check.ts`, since no package below both holds it. These are what
 * holds the two statements together, as the list they are part of holds
 * every other block's (`malformed.ts`): report-render-docx's
 * `against-pdf.test.ts` holds both engines to the same code and the same
 * subject for each. What the PDF renderer refuses of what ECharts laid
 * out -- words that meet, bars too thin -- is not here: a Word file's
 * chart is Word's to lay out.
 */

const value = (exact: string): ChartValue => ({ exact, text: exact })
const untyped = <T>(wrong: unknown): T => wrong as T

/** A bar chart as the runtime resolves one: two series over two categories on an axis from 0 to 10. */
const BARS: AxisChart = {
  kind: 'chart',
  chart: 'bar',
  id: 'wrong',
  width: 300,
  height: 200,
  title: 'Sales',
  categories: ['North', 'South'],
  series: [
    { color: '#1f77b4', values: [value('4'), value('10')] },
    { color: '#d95f02', values: [value('0'), null] },
  ],
  ticks: [value('0'), value('5'), value('10')],
  valueLabels: true,
  legend: [
    { text: 'Plan', color: '#1f77b4' },
    { text: 'Actual', color: '#d95f02' },
  ],
}

/** A pie as the runtime resolves one. */
const PIE: PieChart = {
  kind: 'chart',
  chart: 'pie',
  id: 'wrong',
  width: 200,
  height: 200,
  slices: [
    { color: '#1f77b4', value: value('3') },
    { color: '#d95f02', value: value('1') },
  ],
  legend: [
    { text: 'North', color: '#1f77b4' },
    { text: 'South', color: '#d95f02' },
  ],
}

const NOTHING: Chart = {
  kind: 'chart',
  chart: 'bar',
  id: 'wrong',
  width: 300,
  height: 100,
  legend: [],
  empty: 'No rows',
  categories: [],
  series: [],
  ticks: [],
  valueLabels: false,
}

export interface MalformedChart {
  readonly id: string
  readonly title: string
  readonly document: ResolvedDocument
}

const body = (id: string, title: string, chart: unknown): MalformedChart => ({ id, title, document: documentOf(title, [untyped<Block>(chart)]) })
const region = (id: string, title: string, more: Partial<ResolvedDocument>): MalformedChart => ({
  id,
  title,
  document: { ...documentOf(title, [paragraph(title)]), ...more },
})
const many = <T>(count: number, make: (index: number) => T): T[] => Array.from({ length: count }, (_, index) => make(index))
/** Colours enough for nine series or slices, each apart. */
const PAINTS = many(9, (index) => `#${String(index + 1).repeat(6)}`)

export const MALFORMED_CHARTS: readonly MalformedChart[] = [
  region('chart-in-page-header', 'A chart in the page header', { pageHeader: [BARS] }),
  region('chart-in-first-page-header', "A chart in page 1's own header", { firstPageHeader: [BARS] }),
  body('chart-unknown-kind', 'A chart of a kind no report knows', { ...BARS, chart: 'radar' }),
  body('chart-no-size', 'A chart of no width', { ...BARS, width: 0 }),
  body('chart-height-not-a-number', 'A chart whose height is no number', { ...BARS, height: Number.NaN }),
  body('chart-too-many-slices', 'A pie of more slices than a palette has colours', {
    ...PIE,
    slices: PAINTS.map((color) => ({ color, value: value('1') })),
    legend: [],
  }),
  body('chart-too-many-categories', 'A chart of more categories than the runtime groups', {
    ...BARS,
    categories: many(201, String),
    series: [{ color: '#1f77b4', values: many(201, () => value('1')) }],
    legend: [],
  }),
  body('chart-too-many-series', 'A chart of more series than a palette has colours', {
    ...BARS,
    series: PAINTS.map((color) => ({ color, values: [value('1'), value('2')] })),
    legend: [],
  }),
  body('chart-too-many-ticks', 'An axis of more ticks than the runtime writes', { ...BARS, ticks: many(8, (index) => value(String(index * 2))) }),
  body('chart-unmapped-font', 'A chart set in a font the report maps to nothing', { ...BARS, style: { font: 'serif' } }),
  body('chart-size-of-words', 'A chart whose words are larger than any text', { ...BARS, style: { size: 400 } }),
  // Each with no legend, or one in the same colour: a legend in another colour than its series is refused for that, whatever the colour is.
  body('chart-series-colour', 'A series in a colour that is none', { ...BARS, series: [{ ...BARS.series[0]!, color: 'blue' }, BARS.series[1]!], legend: [] }),
  body('chart-slice-colour', 'A slice in a colour written in capitals', {
    ...PIE,
    slices: [{ ...PIE.slices[0]!, color: '#1F77B4' }, PIE.slices[1]!],
    legend: [{ text: 'North', color: '#1F77B4' }, PIE.legend[1]!],
  }),
  body('chart-values-short', 'A series with a value too few', { ...BARS, series: [{ color: '#1f77b4', values: [value('4')] }, BARS.series[1]!] }),
  body('chart-legend-short', 'A legend that names one series of two', { ...BARS, legend: [BARS.legend[0]!] }),
  body('chart-legend-other-colour', "A legend entry in another series' colour", { ...BARS, legend: [BARS.legend[1]!, BARS.legend[0]!] }),
  body('chart-empty-with-marks', 'A chart with nothing to draw that holds a series', {
    ...NOTHING,
    categories: ['North'],
    series: [{ color: '#1f77b4', values: [null] }],
  }),
  body('chart-empty-pie-with-slices', 'A pie with nothing to draw that holds a slice', { ...PIE, legend: [], empty: 'None' }),
  body('chart-no-value', 'A chart with no value and no empty text', { ...BARS, series: BARS.series.map(({ color }) => ({ color, values: [null, null] })) }),
  body('chart-title-not-text', 'A chart whose title is no text', { ...BARS, title: 7 }),
  body('chart-category-line-break', 'A category with a line break in it', { ...BARS, categories: ['North', 'South\nEast'] }),
  body('chart-legend-tab', 'A legend entry with a tab in it', { ...PIE, legend: [{ text: 'North\tWest', color: '#1f77b4' }, PIE.legend[1]!] }),
  body('chart-tick-script', 'A tick in a script no report prints', { ...BARS, ticks: [value('0'), { exact: '5', text: '五' }, value('10')] }),
  body('chart-label-script', 'A value label in a script no report prints', {
    ...BARS,
    series: [{ color: '#1f77b4', values: [{ exact: '4', text: '四' }, value('10')] }, BARS.series[1]!],
  }),
  body('chart-empty-text-script', 'An empty text in a script no report prints', { ...NOTHING, empty: '無' }),
  body('chart-value-not-decimal', 'A value that is no decimal', {
    ...BARS,
    series: [{ color: '#1f77b4', values: [value('4'), value('1e1')] }, BARS.series[1]!],
  }),
  body('chart-value-not-a-string', 'A value held as a number', {
    ...BARS,
    series: [{ color: '#1f77b4', values: [value('4'), { exact: 10, text: '10' }] }, BARS.series[1]!],
  }),
  body('chart-tick-not-decimal', 'A tick that is no decimal', { ...BARS, ticks: [value('0'), value('5'), value('ten')] }),
  body('chart-one-tick', 'An axis of one tick', { ...BARS, ticks: [value('0')], series: [{ color: '#1f77b4', values: [value('0'), null] }], legend: [] }),
  body('chart-ticks-uneven', 'Ticks in unequal steps', { ...BARS, ticks: [value('0'), value('5'), value('12')] }),
  body('chart-ticks-descending', 'Ticks that descend', { ...BARS, ticks: [value('10'), value('5'), value('0')] }),
  body('chart-value-past-ticks', 'A value above the highest tick', {
    ...BARS,
    series: [{ color: '#1f77b4', values: [value('4'), value('10.01')] }, BARS.series[1]!],
  }),
  body('chart-value-under-ticks', 'A value under the lowest tick', { ...BARS, chart: 'line', ticks: [value('5'), value('10')] }),
  body('chart-bars-off-zero', 'A bar chart whose axis does not hold zero', {
    ...BARS,
    ticks: [value('2'), value('6'), value('10')],
    series: [{ color: '#1f77b4', values: [value('4'), value('10')] }],
    legend: [],
  }),
  body('chart-slice-below-zero', 'A pie with a slice below zero', { ...PIE, slices: [PIE.slices[0]!, { color: '#d95f02', value: value('-1') }] }),
  body('chart-slices-of-nothing', 'A pie whose slices sum to nothing', { ...PIE, slices: PIE.slices.map(({ color }) => ({ color, value: value('0') })) }),
  body('chart-slice-not-decimal', 'A pie with a slice that is no decimal', { ...PIE, slices: [PIE.slices[0]!, { color: '#d95f02', value: value('1/4') }] }),
  body('chart-too-wide', 'A chart wider than where it stands', { ...BARS, width: 2000 }),
  {
    id: 'chart-too-wide-for-column',
    title: 'A chart wider than its column',
    document: documentOf('A chart wider than its column', [
      {
        kind: 'columns',
        columns: [
          { width: 200, blocks: [BARS] },
          { width: 'fill', blocks: [paragraph('Beside it')] },
        ],
      },
    ]),
  },
]
