import { compareDecimal, decimalFromString } from '@formancy/expressions'
import { CHART_PALETTE } from '@formancy/report-spec'
import type { ChartComponent, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { AxisChart, Chart, ChartValue, PieChart } from './chart-document.js'
import { checkData } from './data.js'
import type { ReportData } from './data.js'
import type { Table } from './document.js'
import { createFormatter } from './format.js'
import * as runtime from './index.js'
import { chartBlock, MAX_CHART_CATEGORIES, SHARE_PLACES } from './lower-chart.js'
import type { Render } from './render-context.js'
import { Problems } from './resolve-errors.js'
import { resolveReport } from './resolve.js'
import type { ResolveOptions } from './resolve.js'
import { chartData, chartReport, chartRow } from './test-support.js'
import type { ChartChange } from './test-support.js'

const OPTIONS: ResolveOptions = { mode: 'final', creationDate: '2026-10-15T08:00:00Z' }
const PREVIEW: ResolveOptions = { ...OPTIONS, mode: 'preview' }
const detail = (field: string) => ({ dataset: 'detail', field }) as const
const amounts = new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** An amount as the chart report prints one, written by Intl from its digits. */
const printed = (exact: string): string => amounts.format(exact as Intl.StringNumericLiteral)
/** A value as the block holds it: exact, and as the chart report prints it. */
const value = (exact: string): ChartValue => ({ exact, text: printed(exact) })

/** The resolved report's errors, as stage, code and path. */
function refusals(report: ReportDefinition, data: ReportData = chartData(), options: ResolveOptions = OPTIONS): string[] {
  const outcome = resolveReport(report, data, options)
  return outcome.ok ? [] : outcome.errors.map(({ stage, code, path }) => `${stage} ${code} ${path}`)
}

/** The document `report` resolves to over `data`, or a failure naming why it was refused. */
function resolved(report: ReportDefinition, data: ReportData = chartData(), options: ResolveOptions = OPTIONS) {
  const outcome = resolveReport(report, data, options)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}

/** The chart `report` resolves to over `data`: the first chart of its body. */
function chartOf(report: ReportDefinition, data: ReportData = chartData(), options: ResolveOptions = OPTIONS): Chart {
  return resolved(report, data, options).body.find((block) => block.kind === 'chart') as Chart
}

const axis = (report: ReportDefinition, data?: ReportData, options?: ResolveOptions): AxisChart => chartOf(report, data, options) as AxisChart
const pie = (report: ReportDefinition, data?: ReportData, options?: ResolveOptions): PieChart => chartOf(report, data, options) as PieChart

/**
 * What `chartBlock` reads of a render, made without the report check, for
 * what that check refuses before the runtime totals anything: the report,
 * its data checked, a formatter, and the problems it records.
 */
function unchecked(report: ReportDefinition, data: ReportData = chartData()): Render {
  const checked = checkData(report, data, { mode: 'final' })
  const formatter = createFormatter({ locale: report.locale, timeZone: 'UTC' })
  if (!checked.ok || !formatter.ok) throw new Error('the probe data or locale is refused')
  return {
    report,
    data: checked.data,
    params: {},
    formatter: formatter.formatter,
    problems: new Problems(),
    preview: false,
    totals: { report: new Map(), over: () => new Map() },
  } as unknown as Render
}

/** The chart report's chart, as `report` holds it. */
const chartIn = (report: ReportDefinition): ChartComponent => report.regions.body[0] as ChartComponent

/** A pie of the units sold in each region, in the data's order. */
const unitsPie = (chart: ChartChange = {}): ReportDefinition =>
  chartReport({
    chart: 'pie',
    category: { field: detail('region'), order: 'data', nullLabel: 'No region' },
    series: [{ id: 'units', label: 'Units', fn: 'sum', of: detail('units') }],
    valueFormat: { kind: 'number', scale: 0, grouping: true },
    categoryTitle: undefined,
    valueTitle: undefined,
    ...chart,
  })

/** Rows of one sale each in regions named R0, R1, ...: `count` categories. */
const regions = (count: number, row: Record<string, unknown> = {}): ReportData =>
  chartData(Array.from({ length: count }, (_, index) => chartRow({ region: `R${index}`, ...row })))

describe('a chart beside a table', () => {
  // The anti-goal: a number on a chart that differs from the same number in
  // the report's table. The chart and the table's group footer read the
  // same rows, by the same rule, in the same format: a chart that totalled
  // or printed by a rule of its own would print another number than the
  // table beside it, and nobody would find out from either.
  test("prints each bar the text the table's group footer prints for the same rows", () => {
    const document = resolved(chartReport())
    const chart = document.body[0] as AxisChart
    const table = document.body[1] as Table
    const footers = table.rows.filter((row) => row.kind === 'groupFooter').map((row) => row.cells)
    expect(chart.series.map((series) => series.values.map((each) => each?.text))).toEqual([footers.map((cells) => cells[1]), footers.map((cells) => cells[2])])
    expect(footers.map((cells) => cells[1])).toEqual(['10.25', '24.25', '1.50'])
  })

  // R18 -- the same definition as a series and as an aggregate, rounded and
  // refused alike. A series rounded by a rule of its own would print 24.30
  // where the table's subtotal, rounded half to even, prints 24.20; one
  // whose rounding of an integer were let through would print a count the
  // editor says has no places to round, and one said twice would send the
  // author to fix a rounding that never happens.
  test('rounds a series as the aggregate of its definition is rounded, and refuses the rounding of an integer total as it is refused', () => {
    const document = resolved(chartReport())
    const footers = (document.body[1] as Table).rows.filter((row) => row.kind === 'groupFooter').map((row) => row.cells[2])
    expect((document.body[0] as AxisChart).series[1]?.values.map((each) => each?.text)).toEqual(['10.20', '24.20', '1.50'])
    expect(footers).toEqual(['10.20', '24.20', '1.50'])

    const rounding = { scale: 3, mode: 'half-even' } as const
    const counted = chartReport({ series: [...chartIn(chartReport()).series.slice(0, 1), { id: 'lines', label: 'Lines', fn: 'count', rounding }] })
    expect(refusals(counted)).toEqual(['expressions rounding-not-decimal /regions/body/0/series/1/rounding'])
    const aggregated = chartReport({}, { aggregates: [...chartReport().aggregates, { id: 'lines', fn: 'count', rounding }] })
    expect(refusals(aggregated)).toEqual(['expressions rounding-not-decimal /aggregates/2/rounding'])

    // Past the editor's check, the runtime refuses a count or a sum of integers rounded itself, once for the series and in an aggregate's words, never once a category.
    const countRender = unchecked(counted)
    expect(chartBlock(countRender, chartIn(counted), '/regions/body/0', undefined)).toBeUndefined()
    expect(countRender.problems.errors()).toEqual([
      {
        stage: 'resolve',
        code: 'rounding-not-decimal',
        path: '/regions/body/0/series/1',
        message: 'series lines of chart by-region declares a rounding, and its total is an integer, which has no places to round',
        componentId: 'by-region',
      },
    ])
    const summed = chartReport({
      series: [...chartIn(chartReport()).series.slice(0, 1), { id: 'units', label: 'Units', fn: 'sum', of: detail('units'), rounding }],
    })
    expect(refusals(summed)).toEqual(['expressions rounding-not-decimal /regions/body/0/series/1/rounding'])
    const render = unchecked(summed)
    expect(chartBlock(render, chartIn(summed), '/regions/body/0', undefined)).toBeUndefined()
    expect(render.problems.errors()).toEqual([
      {
        stage: 'resolve',
        code: 'rounding-not-decimal',
        path: '/regions/body/0/series/1',
        message: 'series units of chart by-region declares a rounding, and its total is an integer, which has no places to round',
        componentId: 'by-region',
      },
    ])
  })
})

describe('a bar chart', () => {
  // What a renderer draws is this and nothing else: a category out of
  // order, a value through a double or a tick of its own would be a chart
  // that disagrees with its data.
  test('resolves a bar chart: categories in order, exact values, ticks, a legend of its two series', () => {
    expect(chartOf(chartReport())).toEqual({
      kind: 'chart',
      chart: 'bar',
      id: 'by-region',
      width: 400,
      height: 240,
      title: 'Sales by region',
      categoryTitle: 'Region',
      valueTitle: 'Amount',
      categories: ['North', 'South', 'No region'],
      series: [
        { color: CHART_PALETTE[0], values: [value('10.25'), value('24.25'), value('1.50')] },
        { color: CHART_PALETTE[1], values: [value('10.2'), value('24.2'), value('1.5')] },
      ],
      ticks: ['0', '5', '10', '15', '20', '25'].map(value),
      valueLabels: false,
      legend: [
        { text: 'Revenue', color: CHART_PALETTE[0] },
        { text: 'Rounded', color: CHART_PALETTE[1] },
      ],
    })
  })

  // A legend tells series apart, and one entry tells nothing apart: drawn,
  // it would take a line of the box from the plot to say what nothing
  // needs told. The brief's rule: one series' label then prints nowhere, so
  // a chart of one series is named by its title and its value axis's.
  test('has no legend for one series', () => {
    expect(axis(chartReport({ series: chartIn(chartReport()).series.slice(0, 1) })).legend).toEqual([])
  })

  // An axis ticked over one series would leave a taller second one standing
  // past its last tick, drawn off the axis or cut at the box, and nothing
  // would see it.
  test('ticks an axis that covers every series, not its first alone', () => {
    const report = chartReport({ series: [chartIn(chartReport()).series[0]!, { id: 'units', label: 'Units', fn: 'sum', of: detail('units') }] })
    const chart = axis(report, chartData([chartRow({ amount: '1.00', units: '900' })]))
    expect(chart.ticks.map(({ exact }) => exact)).toEqual(['0', '200', '400', '600', '800', '1000'])
  })

  // A series with no value at a category -- a greatest over rows that have
  // none -- holds null there, where the table's footer prints nothing; a
  // zero drawn instead would be a bar the data does not have.
  test('holds null where a series has no value, beside the values it has', () => {
    const report = chartReport({ series: [{ id: 'top', label: 'Top', fn: 'max', of: detail('discount') }] })
    const chart = axis(report, chartData([chartRow({ region: 'North', discount: null }), chartRow({ region: 'South', discount: '0.50' })]))
    expect(chart.categories).toEqual(['North', 'South'])
    expect(chart.series[0]?.values).toEqual([null, value('0.50')])
    expect(chart.ticks.map(({ exact }) => exact)).toEqual(['0', '0.1', '0.2', '0.3', '0.4', '0.5'])
  })

  // A decimal category the data spells at two scales is one category, and
  // with no format it prints as the first row in the data's order spells it,
  // which a table sorted otherwise may spell another way; a format with a
  // scale prints every spelling alike. A label read from another row would
  // change with rows the category does not depend on.
  test('prints a decimal category without a format as its first row spells it, and with one as the format does', () => {
    const rated = (format?: { kind: 'number'; scale: number; grouping: boolean }) =>
      chartReport({
        category: { field: detail('discount'), order: 'data', nullLabel: 'None', ...(format === undefined ? {} : { format }) },
        series: [{ id: 'lines', label: 'Lines', fn: 'count' }],
      })
    const spelt = (first: string, second: string) => chartData([chartRow({ discount: first }), chartRow({ discount: second })])
    expect(axis(rated(), spelt('0.5', '0.50')).categories).toEqual(['0.5'])
    expect(axis(rated(), spelt('0.50', '0.5')).categories).toEqual(['0.50'])
    const twoPlaces = { kind: 'number', scale: 2, grouping: true } as const
    expect(axis(rated(twoPlaces), spelt('0.5', '0.50')).categories).toEqual(['0.50'])
    expect(axis(rated(twoPlaces), spelt('0.50', '0.5')).categories).toEqual(['0.50'])
  })

  // R11 -- a bar or a line chart's own palette colours its series by place,
  // and its legend with them: a series drawn in the default colours would
  // not be the one its legend names, or the author chose.
  test('colours its series and its legend from its own palette', () => {
    const chart = axis(chartReport({ palette: ['#000000', '#444444'] }))
    expect(chart.series.map(({ color }) => color)).toEqual(['#000000', '#444444'])
    expect(chart.legend.map(({ color }) => color)).toEqual(['#000000', '#444444'])
  })

  // Review Focus 1 -- a formancy form's optional answer: rows without a
  // category dropped would be a total missing without a word, and two null
  // categories would split one total in two. In a preview a field the data
  // lacks reads as null, and prints as the rows without one do.
  test('prints rows without a category under its null label, once, last when sorted', () => {
    const rows = [
      chartRow({ region: null, amount: '1.00' }),
      chartRow({ region: 'South', amount: '2.00' }),
      chartRow({ region: null, amount: '4.00' }),
      chartRow({ region: 'North', amount: '8.00' }),
    ]
    const of = (order: 'asc' | 'desc' | 'data', data: ReportData = chartData(rows), options: ResolveOptions = OPTIONS) => {
      const chart = axis(chartReport({ category: { field: detail('region'), order, nullLabel: 'No region' } }), data, options)
      return chart.categories.map((category, index) => `${category} ${chart.series[0]?.values[index]?.exact}`)
    }
    expect(of('asc')).toEqual(['North 8.00', 'South 2.00', 'No region 5.00'])
    expect(of('desc')).toEqual(['South 2.00', 'North 8.00', 'No region 5.00'])
    expect(of('data')).toEqual(['No region 5.00', 'South 2.00', 'North 8.00'])
    const lacking = chartData(rows.map(({ region, ...row }) => (region === null ? row : { ...row, region })))
    expect(of('asc', lacking, PREVIEW)).toEqual(['North 8.00', 'South 2.00', 'No region 5.00'])
    // A chart that names no null label, over a field the validator holds never null: a preview that lacks it prints nothing for it, the data check having warned.
    const months = axis(chartReport({ category: { field: detail('month'), order: 'asc' } }), chartData(rows.map(({ month: _, ...row }) => row)), PREVIEW)
    expect(months.categories).toEqual([''])
  })
})

describe('a pie', () => {
  // A share computed through a double drifts at the last place, and one
  // rounded twice -- to 0.6665, then to 0.667 -- prints 66.7 % for a share
  // of 0.66649. A category totalling zero left out would be a category
  // missing without a word.
  test("resolves a pie's shares exactly, rounded once, and lists every category, a zero among them", () => {
    const data = chartData([
      chartRow({ region: 'North', units: '66649' }),
      chartRow({ region: 'South', units: '33351' }),
      chartRow({ region: 'East', units: '0' }),
    ])
    expect(pie(unitsPie({ valueLabels: true }), data)).toEqual({
      kind: 'chart',
      chart: 'pie',
      id: 'by-region',
      width: 400,
      height: 240,
      title: 'Sales by region',
      slices: [
        { color: CHART_PALETTE[0], value: { exact: '66649', text: '66,649' } },
        { color: CHART_PALETTE[1], value: { exact: '33351', text: '33,351' } },
        { color: CHART_PALETTE[2], value: { exact: '0', text: '0' } },
      ],
      legend: [
        { text: 'North: 66,649 (66.6%)', color: CHART_PALETTE[0] },
        { text: 'South: 33,351 (33.4%)', color: CHART_PALETTE[1] },
        { text: 'East: 0 (0.0%)', color: CHART_PALETTE[2] },
      ],
    })
    // Without value labels, its legend names its categories alone.
    expect(pie(unitsPie(), data).legend.map(({ text }) => text)).toEqual(['North', 'South', 'East'])
    expect(SHARE_PLACES).toBe(1)
  })

  // The legend's colon and parentheses are the runtime's, the same in every
  // language, around the locale's own figures: a join that changed with the
  // language would be words no formatter wrote and no record decided, and
  // figures printed as English would misstate a slice to its reader.
  test.each(['de-CH', 'fr-CH'])("joins a pie's legend entry as label: value (share) in %s, around the locale's figures", (locale) => {
    const data = chartData([chartRow({ region: 'North', units: '66649' }), chartRow({ region: 'South', units: '33351' })])
    const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    const percent = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
    const at = (digits: string) => digits as Intl.StringNumericLiteral
    expect(pie({ ...unitsPie({ valueLabels: true }), locale }, data).legend.map(({ text }) => text)).toEqual([
      `North: ${number.format(at('66649'))} (${percent.format(at('0.666'))})`,
      `South: ${number.format(at('33351'))} (${percent.format(at('0.334'))})`,
    ])
  })

  // Each share is rounded on its own: shares nudged to add up would change one
  // slice when another category's value did, and a reader who divides a value
  // by the whole would get another share than the one printed.
  test('rounds each share on its own, so three equal slices print 33.3% each', () => {
    expect(pie(unitsPie({ valueLabels: true }), regions(3, { units: '1' })).legend.map(({ text }) => text)).toEqual([
      'R0: 1 (33.3%)',
      'R1: 1 (33.3%)',
      'R2: 1 (33.3%)',
    ])
  })

  // R17 -- two slices of one colour are told apart by nothing. The runtime
  // assigns the colours, so it refuses a pie its palette cannot colour
  // apart, before a renderer cycles one.
  test('refuses a pie of more categories than its palette has colours, naming both counts', () => {
    const outcome = resolveReport(unitsPie(), regions(9), OPTIONS)
    expect(outcome.ok ? [] : outcome.errors).toEqual([
      {
        stage: 'resolve',
        code: 'chart-too-many-categories',
        path: '/regions/body/0/category',
        message: 'chart by-region is a pie of 9 categories; a pie colours each slice apart, and its palette has 8 colours',
        componentId: 'by-region',
      },
    ])
    const own = resolveReport(unitsPie({ palette: ['#000000', '#444444', '#888888'] }), regions(4), OPTIONS)
    expect(own.ok ? [] : own.errors.map(({ message }) => message)).toEqual([
      'chart by-region is a pie of 4 categories; a pie colours each slice apart, and its palette has 3 colours',
    ])
    expect(pie(unitsPie(), regions(8)).slices.map(({ color }) => color)).toEqual([...CHART_PALETTE])
  })

  // A pie is the shares of a whole, and a negative share is of nothing: a
  // slice drawn for it would misstate every other, and values that cancel
  // to nothing printed as a pie with nothing to draw would hide it. Its
  // refusal names the chart and quotes neither a total nor a category,
  // either of which may be the customer's.
  test('refuses a pie with a negative value, naming the chart and quoting nothing', () => {
    const report = unitsPie({ series: [{ id: 'amount', label: 'Amount', fn: 'sum', of: detail('amount') }] })
    const outcome = resolveReport(report, chartData([chartRow({ region: 'North', amount: '7.25' }), chartRow({ region: 'South', amount: '-12.50' })]), OPTIONS)
    expect(outcome).toMatchObject({
      ok: false,
      errors: [{ stage: 'resolve', code: 'chart-negative-share', path: '/regions/body/0/series/0', componentId: 'by-region' }],
    })
    const message = outcome.ok ? '' : (outcome.errors[0]?.message ?? '')
    expect(message).toContain('by-region')
    expect(message).not.toMatch(/\d|North|South/)
    const cancelled = chartData([chartRow({ region: 'North', amount: '5.00' }), chartRow({ region: 'South', amount: '-5.00' })])
    expect(refusals(report, cancelled)).toEqual(['resolve chart-negative-share /regions/body/0/series/0'])
  })
})

describe('a chart with nothing to draw', () => {
  // Review Focus 3, R7, R8 -- an axis drawn over no values, or a pie of no
  // whole, would draw a chart of nothing and say nothing; the chart holds
  // its title and its empty text, and nothing for a renderer to draw.
  test('prints its empty text where there is nothing to draw: no rows, no values, a pie of zeros', () => {
    const emptyBar = { kind: 'chart', chart: 'bar', id: 'by-region', width: 400, height: 240, title: 'Sales by region', empty: 'No sales.' }
    expect(chartOf(chartReport(), chartData([]))).toEqual({ ...emptyBar, legend: [], categories: [], series: [], ticks: [], valueLabels: false })
    const discount = chartReport({ series: [{ id: 'discount', label: 'Discount', fn: 'max', of: detail('discount') }] })
    expect(chartOf(discount)).toEqual({ ...emptyBar, legend: [], categories: [], series: [], ticks: [], valueLabels: false })
    const emptyPie = {
      kind: 'chart',
      chart: 'pie',
      id: 'by-region',
      width: 400,
      height: 240,
      title: 'Sales by region',
      empty: 'No sales.',
      legend: [],
      slices: [],
    }
    expect(chartOf(unitsPie(), chartData([]))).toEqual(emptyPie)
    expect(chartOf(unitsPie(), regions(3, { units: '0' }))).toEqual(emptyPie)
  })
})

describe("a chart's bounds", () => {
  // Grouping costs what a table's grouping of the same rows costs, and
  // totalling is the rows once for each series: a chart of more categories
  // than it groups is refused before a total is computed, or a refusal
  // would come after the work it was there to spare. A sum of integers
  // rounded past the editor's check would refuse its series, were it
  // totalled.
  test('refuses more categories than it groups, before it totals them', () => {
    expect(MAX_CHART_CATEGORIES).toBe(200)
    expect(resolveReport(chartReport(), regions(MAX_CHART_CATEGORIES + 1), OPTIONS)).toMatchObject({
      ok: false,
      errors: [
        {
          code: 'chart-too-many-categories',
          path: '/regions/body/0/category',
          message: 'chart by-region groups its rows into 201 categories, and a chart groups at most 200',
        },
      ],
    })
    expect(axis(chartReport(), regions(MAX_CHART_CATEGORIES)).categories).toHaveLength(MAX_CHART_CATEGORIES)
    const summed = chartReport({ series: [{ id: 'units', label: 'Units', fn: 'sum', of: detail('units'), rounding: { scale: 2, mode: 'half-even' } }] })
    expect(chartBlock(unchecked(summed, regions(1)), chartIn(summed), '/regions/body/0', undefined)).toBeUndefined()
    const render = unchecked(summed, regions(MAX_CHART_CATEGORIES + 1))
    expect(chartBlock(render, chartIn(summed), '/regions/body/0', undefined)).toBeUndefined()
    expect(render.problems.errors().map(({ code }) => code)).toEqual(['chart-too-many-categories'])
  })

  // Review Focus 3 -- a 40-digit total through a double would lose its last
  // 24 digits; one category, or every value equal, leaves an axis no span
  // to divide, and a flat line is measured from zero.
  test('covers a 40-digit total, a single category and every value equal', () => {
    const huge = '9999999999999999999999999999999999999.99'
    const chart = axis(chartReport(), chartData([chartRow({ amount: huge }), chartRow({ amount: huge })]))
    const total = '19999999999999999999999999999999999999.98'
    expect(chart.categories).toEqual(['North'])
    expect(chart.series[0]?.values).toEqual([value(total)])
    const ticks = chart.ticks.map(({ exact }) => decimalFromString(exact))
    expect(compareDecimal(ticks.at(-1)!, decimalFromString(total))).toBeGreaterThanOrEqual(0)
    expect(chart.ticks.map(({ exact }) => exact)).toEqual(['0', ...['5', '10', '15', '20'].map((digits) => `${digits}${'0'.repeat(36)}`)])
    expect(chart.ticks.map(({ text }) => text)).toEqual(chart.ticks.map(({ exact }) => printed(exact)))

    const flat = axis(chartReport({ chart: 'line' }), chartData([chartRow({ region: 'North', amount: '5.00' }), chartRow({ region: 'South', amount: '5.00' })]))
    expect(flat.series[0]?.values).toEqual([value('5.00'), value('5.00')])
    expect(flat.ticks.map(({ exact }) => exact)).toEqual(['0', '1', '2', '3', '4', '5'])
  })
})

describe("a chart's words", () => {
  // R19 -- what a renderer prints is here: every string the chart shows, and
  // nothing it would have to write itself. A tick or a label a renderer
  // formatted would be a number the runtime did not decide, in a format the
  // report did not ask for.
  test('holds every word the chart prints, each a string the formatter wrote', () => {
    const report = chartReport({
      category: { field: detail('month'), order: 'asc', format: { kind: 'date', style: 'medium' } },
      valueLabels: true,
    })
    const chart = axis(report)
    const months = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })
    expect([chart.title, chart.categoryTitle, chart.valueTitle]).toEqual(['Sales by region', 'Region', 'Amount'])
    expect(chart.categories).toEqual([Date.UTC(2026, 0, 1), Date.UTC(2026, 1, 1), Date.UTC(2026, 2, 1)].map((day) => months.format(day)))
    const numbers = [...chart.ticks, ...chart.series.flatMap(({ values }) => values)]
    expect(numbers.every((each) => each !== null && each.text === printed(each.exact))).toBe(true)
    expect(chart.series.map(({ values }) => values.map((each) => each?.text))).toEqual([
      ['10.25', '24.25', '1.50'],
      ['10.20', '24.20', '1.50'],
    ])
    expect(chart.ticks.map(({ text }) => text)).toEqual(['0.00', '5.00', '10.00', '15.00', '20.00', '25.00'])
    expect(chart.legend.map(({ text }) => text)).toEqual(['Revenue', 'Rounded'])
    expect(chart.valueLabels).toBe(true)
    // A value printed in a currency is the formatter's too, its symbol with it.
    const francs = axis(chartReport({ valueFormat: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } }))
    expect(francs.ticks.at(-1)?.text).toBe(new Intl.NumberFormat('en', { style: 'currency', currency: 'CHF' }).format(25))
  })
})

describe("a chart's formats", () => {
  const francs = { kind: 'currency', currency: { kind: 'field', field: { dataset: 'header', field: 'currency' } }, scale: 2 } as const
  /** The chart report with a header whose currency may be null, its chart changed by `chart`. */
  const headed = (chart: ChartChange): ReportDefinition =>
    chartReport(chart, {
      datasets: { ...chartReport().datasets, header: { id: 'sale', fields: [{ id: 'currency', type: 'string', label: 'Currency', nullable: true }] } },
    })
  const priced = (currency: string | null): ReportData => ({ ...chartData(), header: { currency } })

  // A value or a category printed as nothing would be a bar with no number,
  // or a slice with no name, and nothing to say why; one printed in a
  // currency read from anywhere but where the report is would be in
  // another currency than the table beside it prints. Each refusal names the
  // chart and quotes nothing of the data.
  test('refuses a value or a category its format cannot print, naming the chart, and prints a currency read where the report is', () => {
    const valued = headed({ valueFormat: francs })
    for (const [currency, code] of [
      [null, 'no-currency'],
      ['chf', 'invalid-currency'],
    ] as const) {
      expect(resolveReport(valued, priced(currency), OPTIONS), String(currency)).toMatchObject({
        ok: false,
        errors: [{ stage: 'format', code, path: '/regions/body/0/valueFormat', componentId: 'by-region', message: expect.stringContaining('chart by-region') }],
      })
    }
    const ticks = axis(valued, priced('CHF')).ticks
    expect(ticks.at(-1)?.text).toBe(new Intl.NumberFormat('en', { style: 'currency', currency: 'CHF' }).format(25))
    expect(ticks.at(-1)?.text).toBe('CHF\u00a025.00')

    const labelled = headed({ category: { field: detail('amount'), order: 'asc', format: francs } })
    expect(refusals(labelled, priced(null))).toEqual(['format no-currency /regions/body/0/category'])
    expect(refusals(labelled, priced('chf'))).toEqual(['format invalid-currency /regions/body/0/category'])
    expect(axis(labelled, priced('CHF')).categories[0]).toBe('CHF\u00a00.25')
  })

  // A pie holds every slice's value as the formatter wrote it, labelled or
  // not, so a format that cannot print one refuses the pie: a slice holding
  // a text no formatter wrote would break the block's word, and turning the
  // value labels on would print it.
  test('refuses a pie whose values its format cannot print, though it labels none', () => {
    const pied = headed({
      chart: 'pie',
      category: { field: detail('region'), order: 'data', nullLabel: 'No region' },
      series: [{ id: 'units', label: 'Units', fn: 'sum', of: detail('units') }],
      valueFormat: francs,
      categoryTitle: undefined,
      valueTitle: undefined,
    })
    expect(chartIn(pied).valueLabels).toBeUndefined()
    expect(refusals(pied, priced(null))).toEqual(['format no-currency /regions/body/0/valueFormat'])
  })
})

describe('what the runtime hands on of a chart', () => {
  // The bounds and the places a share prints at are the runtime's, and a
  // host that says so to an author reads them rather than a copy of the
  // number, which could disagree and nobody would find out.
  test('exports its bounds', () => {
    expect(runtime.MAX_CHART_CATEGORIES).toBe(MAX_CHART_CATEGORIES)
    expect(runtime.MAX_TICK_INTERVALS).toBe(5)
    expect(runtime.SHARE_PLACES).toBe(SHARE_PLACES)
  })
})
