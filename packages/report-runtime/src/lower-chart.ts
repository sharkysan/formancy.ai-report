/**
 * A chart of the detail rows, lowered to the block a renderer draws: every
 * number it prints and every word, decided here, once, by the rules a
 * table's are decided by, so that a chart never disagrees with the table
 * beside it. In order:
 *
 * 1. **Its categories**, grouped where a table's rows are grouped
 *    (`categoryGroups`): in the data's order, each key once at its first
 *    row, or sorted, the rows without one last. More than
 *    `MAX_CHART_CATEGORIES`, or a pie of more categories than its palette
 *    has colours -- two slices of one colour are told apart by nothing --
 *    is refused before anything is totalled.
 * 2. **Each category's label**: its key in the category's format, or for
 *    the rows without one the chart's `nullLabel`. In a preview a field the
 *    data lacks reads as null; with no `nullLabel` it prints nothing, the
 *    data check having warned.
 * 3. **Each series' value at each category**, by `totalOf`, the one rule
 *    every total is computed by, in the decimals an aggregate of the same
 *    function over the same field is totalled in (report-core's
 *    `seriesType`, `totalsInDecimals`), and so rounded and refused alike;
 *    printed in the chart's value format, read where the report is.
 * 4. **Nothing to draw** -- no rows, a bar or a line chart with no value, a
 *    pie whose values are all zero -- is the chart's title and empty text,
 *    and nothing else.
 * 5. **A bar or a line chart's value axis** (`chartTicks`), each tick in the
 *    value format, and a legend of its series where it has more than one.
 * 6. **A pie's slices**, a negative one refused, and a legend of its
 *    categories; where it labels its values, each entry says its value and
 *    its share, the exact ratio rounded once to `SHARE_PLACES` places of a
 *    percentage, which `Formatter.percent` prints without rounding again.
 *
 * A refusal names the chart by its id and says counts, never a value, a
 * label or a category, each of which may be the data's.
 */
import { Decimal } from '@formancy/expressions'
import { seriesType } from '@formancy/report-core'
import { CHART_PALETTE } from '@formancy/report-spec'
import type { AggregateDef, ChartComponent, ChartSeries } from '@formancy/report-spec'
import type { AxisChart, Chart, ChartLegendEntry, ChartSeriesValues, ChartValue, PieChart } from './chart-document.js'
import { chartTicks } from './chart-ticks.js'
import { ratioRounded, sumDecimals } from './decimal.js'
import type { TextStyle } from './document.js'
import { plainText } from './format.js'
import type { CurrencyScope, Formatted, PrintableType, TypedValue } from './format.js'
import { fieldType, fieldValue, reportScope } from './render-context.js'
import type { Render } from './render-context.js'
import type { ResolveErrorCode } from './resolve-errors.js'
import { categoryGroups } from './sort-group.js'
import type { RowGroup } from './sort-group.js'
import { totalOf, totalsInDecimals } from './totals.js'

/**
 * The most categories a chart groups its rows into: 200, chosen, not
 * measured, as a bound on the work of totalling every series at every
 * category. How many a box draws legibly is the renderer's to say.
 */
export const MAX_CHART_CATEGORIES = 200

/** The places of a percentage a pie's share prints at: 12.5 %. */
export const SHARE_PLACES = 1

/** What one chart is lowered with. */
interface Charting {
  readonly render: Render
  readonly chart: ChartComponent
  readonly path: string
  /** Where a currency format finds its currency: the report's scope, since a chart has no current row. */
  readonly currency: CurrencyScope
  /** The colours it paints, by series (bar, line) or by category (pie). */
  readonly palette: readonly string[]
}

/** What every kind of chart holds but its legend and its marks. */
type Frame = Pick<Chart, 'kind' | 'id' | 'width' | 'height' | 'style' | 'title'>

/** Records a refusal of the chart at `at`; undefined, for its caller to return. */
function refuse(c: Charting, code: ResolveErrorCode, at: string, message: string): undefined {
  c.render.problems.error({ stage: 'resolve', code, path: at, message, componentId: c.chart.id })
  return undefined
}

/** `formatted`'s text, or undefined when the formatter refused it, which is recorded at `at`. */
function said(c: Charting, formatted: Formatted, at: string): string | undefined {
  if (formatted.ok) return formatted.text
  c.render.problems.error({ stage: 'format', code: formatted.code, path: at, message: `chart ${c.chart.id}: ${formatted.message}`, componentId: c.chart.id })
  return undefined
}

/** A value as the block holds it: its exact digits, and its text in the chart's value format. */
function charted(c: Charting, value: TypedValue): ChartValue | undefined {
  const text = said(c, c.render.formatter.format(value, c.chart.valueFormat, c.currency), `${c.path}/valueFormat`)
  return text === undefined ? undefined : { exact: plainText(value), text }
}

/** Each of `values` as the block holds it, null as null; undefined once one could not be printed, which is recorded, and nothing after it is tried. */
function chartedAll<T extends TypedValue | null>(c: Charting, values: readonly T[]): (T extends null ? null : ChartValue)[] | undefined {
  const found: (ChartValue | null)[] = []
  for (const value of values) {
    const each = value === null ? null : charted(c, value)
    if (each === undefined) return undefined
    found.push(each)
  }
  return found as (T extends null ? null : ChartValue)[]
}

const asDecimal = (total: TypedValue): Decimal => (total.type === 'integer' ? new Decimal(total.value, 0) : (total.value as Decimal))

/** Each category's label, in order; undefined when one could not be printed, which is recorded. */
function labels(c: Charting, groups: readonly RowGroup[]): string[] | undefined {
  const { field, format, nullLabel } = c.chart.category
  const found: string[] = []
  for (const group of groups) {
    const key = fieldValue(c.render, group.rows[0]?.record, field)
    const label = key === null ? (nullLabel ?? '') : said(c, c.render.formatter.format(key, format, c.currency), `${c.path}/category`)
    if (label === undefined) return undefined
    found.push(label)
  }
  return found
}

/** `series` as the aggregate of its definition: the same function, over the same field, rounded as it declares. */
function asAggregate(series: ChartSeries): AggregateDef {
  return {
    id: series.id,
    fn: series.fn,
    ...(series.of === undefined ? {} : { of: { kind: 'field', field: series.of } }),
    ...(series.rounding === undefined ? {} : { rounding: series.rounding }),
  }
}

/**
 * Each series' total at each category, null where it has none; undefined
 * when a series could not be totalled, which is recorded once for it. The
 * validator types every field a series reads, and report-core refuses a
 * rounding with no places to round before anything renders; one refused
 * here all the same is refused as an aggregate's is, never drawn.
 */
function totals(c: Charting, groups: readonly RowGroup[]): (TypedValue | null)[][] | undefined {
  const { render, chart } = c
  const collator = new Intl.Collator(render.report.locale, { usage: 'sort' })
  let refused = false
  const found = chart.series.map((series, index) => {
    const aggregate = asAggregate(series)
    const decimals = totalsInDecimals(seriesType(render.report, series).type, series.rounding)
    const of = series.of
    const values: (TypedValue | null)[] = []
    for (const group of groups) {
      const read = of === undefined ? undefined : group.rows.map((row) => fieldValue(render, row.record, of))
      const outcome = totalOf(aggregate, decimals, read, group.rows.length, collator)
      if (!outcome.ok) {
        refused = true
        refuse(c, outcome.code, `${c.path}/series/${index}`, `series ${series.id} of chart ${chart.id} ${outcome.message}`)
        break
      }
      values.push(outcome.value)
    }
    return values
  })
  return refused ? undefined : found
}

/** A bar or a line chart over `values`, one list for each series; with no value at all, its empty text. */
function axisChart(c: Charting, frame: Frame, categories: readonly string[], values: readonly (readonly (TypedValue | null)[])[]): AxisChart | undefined {
  const { chart } = c
  const kind = chart.chart as AxisChart['chart']
  const valueLabels = chart.valueLabels === true
  const exact = values.flat().flatMap((total) => (total === null ? [] : [asDecimal(total)]))
  if (exact.length === 0) return { ...frame, chart: kind, legend: [], empty: chart.emptyText, categories: [], series: [], ticks: [], valueLabels }
  const series: ChartSeriesValues[] = []
  for (const [index, each] of values.entries()) {
    const printed = chartedAll(c, each)
    if (printed === undefined) return undefined
    series.push({ color: c.palette[index] as string, values: printed })
  }
  const ticks = chartedAll(
    c,
    chartTicks(exact, kind, chart.valueFormat.scale).map((tick): TypedValue => ({ type: 'decimal', value: tick })),
  )
  if (ticks === undefined) return undefined
  const legend: ChartLegendEntry[] = chart.series.length > 1 ? chart.series.map(({ label }, index) => ({ text: label, color: c.palette[index] as string })) : []
  return {
    ...frame,
    chart: kind,
    ...(chart.categoryTitle === undefined ? {} : { categoryTitle: chart.categoryTitle }),
    ...(chart.valueTitle === undefined ? {} : { valueTitle: chart.valueTitle }),
    legend,
    categories,
    series,
    ticks,
    valueLabels,
  }
}

/**
 * A pie over `values`, a sum or a count at each category, which is never
 * null: a negative one refused; all zero, its empty text; otherwise a
 * slice and a legend entry for each, its share in the entry where the
 * chart labels its values.
 */
function pieChart(c: Charting, frame: Frame, categories: readonly string[], values: readonly TypedValue[]): PieChart | undefined {
  const { chart, path } = c
  const exact = values.map(asDecimal)
  if (exact.some((value) => value.units < 0n)) {
    return refuse(
      c,
      'chart-negative-share',
      `${path}/series/0`,
      `chart ${chart.id} is a pie, and a category of it totals less than nothing, which is no share of a whole`,
    )
  }
  const total = sumDecimals(exact)
  if (total.units === 0n) return { ...frame, chart: 'pie', legend: [], empty: chart.emptyText, slices: [] }
  const printed = chartedAll(c, values)
  if (printed === undefined) return undefined
  const legend: ChartLegendEntry[] = []
  for (const [index, value] of printed.entries()) {
    const label = categories[index] as string
    let text = label
    if (chart.valueLabels === true) {
      const share = ratioRounded(exact[index] as Decimal, total, { scale: SHARE_PLACES + 2, mode: 'half-away-from-zero' })
      const percent = said(c, c.render.formatter.percent(share, SHARE_PLACES), `${path}/valueFormat`)
      if (percent === undefined) return undefined
      text = `${label}: ${value.text} (${percent})`
    }
    legend.push({ text, color: c.palette[index] as string })
  }
  return { ...frame, chart: 'pie', legend, slices: printed.map((value, index) => ({ color: c.palette[index] as string, value })) }
}

/**
 * `chart`, at `path`, as the block a renderer draws, `style` its words'
 * resolved style; undefined when it is refused, the reason recorded.
 */
export function chartBlock(render: Render, chart: ChartComponent, path: string, style: TextStyle | undefined): Chart | undefined {
  const c: Charting = { render, chart, path, currency: reportScope(render, render.totals.report).currency, palette: chart.palette ?? CHART_PALETTE }
  const by = { field: chart.category.field.field, type: fieldType(render.report, chart.category.field) as PrintableType }
  const groups = categoryGroups(render.data.detail, by, chart.category.order, render.report.locale)
  if (groups.length > MAX_CHART_CATEGORIES) {
    const message = `chart ${chart.id} groups its rows into ${groups.length} categories, and a chart groups at most ${MAX_CHART_CATEGORIES}`
    return refuse(c, 'chart-too-many-categories', `${path}/category`, message)
  }
  if (chart.chart === 'pie' && groups.length > c.palette.length) {
    const message = `chart ${chart.id} is a pie of ${groups.length} categories; a pie colours each slice apart, and its palette has ${c.palette.length} colours`
    return refuse(c, 'chart-too-many-categories', `${path}/category`, message)
  }
  const categories = labels(c, groups)
  const values = categories && totals(c, groups)
  if (categories === undefined || values === undefined) return undefined
  const frame: Frame = {
    kind: 'chart',
    id: chart.id,
    width: chart.width,
    height: chart.height,
    ...(style === undefined ? {} : { style }),
    ...(chart.title === undefined ? {} : { title: chart.title }),
  }
  return chart.chart === 'pie' ? pieChart(c, frame, categories, (values[0] ?? []) as TypedValue[]) : axisChart(c, frame, categories, values)
}
