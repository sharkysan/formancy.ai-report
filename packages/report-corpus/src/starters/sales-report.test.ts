import { CHART_PALETTE } from '@formancy/report-spec'
import { MAX_CHART_CATEGORIES, resolveReport } from '@formancy/report-runtime'
import type { AxisChart, Block, Chart, PieChart, ReportDefinition } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { starterImages } from './index.js'
import { SALES_REPORT, salesReportData, salesReportLines, type SalesReportLine } from './sales-report.js'

/**
 * The monthly sales report (0067): one month's sales lines of the firm, a
 * bar chart of each product line's sales and a pie of each region's
 * share (0052, 0055, 0058), and under them one table of the same lines
 * grouped by product line, each group closed by its total and the table by
 * the month's. What is held here is the report and its data, and the
 * numbers the runtime resolves its charts to, each total recomputed here
 * in BigInt from the data; what prints, and that the bars, the slices and
 * the table agree on the page, is held on the PDF by the renderer's
 * `sales-report.test.ts`.
 */

type Component = ReportDefinition['regions']['body'][number]
type Table = Extract<Component, { kind: 'table' }>
type ChartComponent = Extract<Component, { kind: 'chart' }>

/** Every component of `components`, a columns block's own among them, in document order. */
const flat = (components: readonly Component[]): Component[] =>
  components.flatMap((component) => [component, ...(component.kind === 'columns' ? flat(component.columns.flatMap((slot) => slot.components)) : [])])

const body = (): Component[] => flat(SALES_REPORT.report.regions.body)
const charts = (): ChartComponent[] => body().filter((component): component is ChartComponent => component.kind === 'chart')
const tables = (): Table[] => body().filter((component): component is Table => component.kind === 'table')

const cents = (amount: string): bigint => BigInt(amount.replace('.', ''))
/** Centimes as the runtime writes a decimal of two places: its digits, a point and its centimes, a minus before them where it is below zero. */
const exact = (value: bigint): string => {
  const size = value < 0n ? -value : value
  return `${value < 0n ? '-' : ''}${size / 100n}.${String(size % 100n).padStart(2, '0')}`
}
/** `numerator / denominator`, both positive, rounded half away from zero to a whole number. */
const halfAway = (numerator: bigint, denominator: bigint): bigint => (2n * numerator + denominator) / (2n * denominator)

/** Each key's lines' total, in centimes, the keys in the order `order` sorts them. */
function totalsBy(key: 'category' | 'region'): [string, bigint][] {
  const totals = new Map<string, bigint>()
  for (const line of salesReportLines()) totals.set(line[key], (totals.get(line[key]) ?? 0n) + cents(line.amount))
  return [...totals].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

/** The report's chart blocks, as the runtime resolved them against the starter's own data, in document order. */
function resolvedCharts(): Chart[] {
  const outcome = resolveReport(SALES_REPORT.report, salesReportData(), {
    mode: 'final',
    parameters: {},
    images: starterImages,
    creationDate: '2026-12-01T08:00:00Z',
  })
  if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path}`).join('; '))
  const walk = (blocks: readonly Block[]): Chart[] =>
    blocks.flatMap((block) =>
      block.kind === 'chart'
        ? [block]
        : block.kind === 'columns'
          ? walk(block.columns.flatMap((column) => column.blocks))
          : block.kind === 'section' || block.kind === 'keepTogether'
            ? walk(block.blocks)
            : [],
    )
  return walk(outcome.document.body)
}

describe('the sales report', () => {
  // The bars, the slices and the table's totals agree only if they total
  // one field over the same rows: a chart that summed another field, or a
  // table grouped by another than the bar chart's category, would print
  // bars no table total matches; a table with a condition (0062) would
  // total fewer rows than the charts, which read every detail row; and a
  // bar chart sorted otherwise than the table's groups would set its bars
  // in another order than the totals under them.
  test('draws a bar chart by product line and a pie by region over every line, and groups one table of every line by the bar chart’s category', () => {
    expect(
      charts().map(({ id, chart, category, series }) => [id, chart, category.field.field, category.order, series.map(({ fn, of }) => [fn, of?.field])]),
    ).toEqual([
      ['by-category', 'bar', 'category', 'asc', [['sum', 'amount']]],
      ['by-region', 'pie', 'region', 'asc', [['sum', 'amount']]],
    ])
    const [table] = tables()
    expect(tables()).toHaveLength(1)
    expect(table?.rowsWhen).toBeUndefined()
    expect([table?.group?.by.field, table?.group?.direction]).toEqual(['category', 'asc'])
    expect(SALES_REPORT.report.aggregates.find(({ id }) => id === 'sales')).toEqual({
      id: 'sales',
      fn: 'sum',
      of: { kind: 'field', field: { dataset: 'detail', field: 'amount' } },
    })
    const totalled = [...(table?.group?.footer ?? []), ...(table?.totals ?? [])].map(({ cells }) =>
      cells.flatMap(({ column, value }) => (value.kind === 'aggregate' ? [[column, value.aggregate, value.over]] : [])),
    )
    expect(totalled).toEqual([[['amount', 'sales', 'group']], [['amount', 'sales', 'table']]])
  })

  // The amounts print to the centime everywhere: on the bars, in the pie's
  // legend and in the table. A chart whose value format printed fewer
  // places than the table would round what the table prints exactly, and
  // the two would no longer read alike.
  test('prints every chart value to the centime, as the table prints its amounts', () => {
    expect(charts().map(({ valueFormat, valueLabels }) => [valueFormat, valueLabels])).toEqual([
      [{ kind: 'number', scale: 2, grouping: true }, true],
      [{ kind: 'number', scale: 2, grouping: true }, true],
    ])
    expect(tables()[0]?.columns.find(({ id }) => id === 'amount')?.value).toEqual({
      kind: 'field',
      field: { dataset: 'detail', field: 'amount' },
      format: { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 },
    })
  })

  // Grouping and ordering are proved only by lines that arrive out of the
  // order the table prints them in, and a group's total only by groups of
  // unlike sizes; a credit note only by a line below zero, in a product
  // line and a region that still sell more than they credit, since a pie
  // refuses a share below nothing (0055); and a month's report only by
  // lines dated inside the month it names.
  test('arrives out of order, its product lines of unlike sizes, with credit notes, and every line in the month it reports', () => {
    const lines = salesReportLines()
    const printed = (a: SalesReportLine, b: SalesReportLine): number =>
      a.category !== b.category ? (a.category < b.category ? -1 : 1) : a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.number < b.number ? -1 : 1
    expect(lines.map(({ number }) => number)).not.toEqual([...lines].sort(printed).map(({ number }) => number))
    const sizes = new Map<string, number>()
    for (const { category } of lines) sizes.set(category, (sizes.get(category) ?? 0) + 1)
    expect(new Set(sizes.values()).size).toBe(sizes.size)
    expect(lines.filter(({ amount }) => amount.startsWith('-')).length).toBeGreaterThan(0)
    for (const [, total] of [...totalsBy('category'), ...totalsBy('region')]) expect(total > 0n).toBe(true)
    expect(lines.every(({ amount }) => /^-?\d+\.\d\d$/.test(amount))).toBe(true)
    const { header } = salesReportData()
    expect(lines.every(({ date }) => date >= String(header?.['from']) && date <= String(header?.['to']))).toBe(true)
    expect(new Set(lines.map(({ number }) => number)).size).toBe(lines.length)
  })

  // A chart groups at most MAX_CHART_CATEGORIES categories, and a pie no
  // more than its palette has colours, two slices of one colour being told
  // apart by nothing (0055): either past its bound is refused, and the
  // starter would print nothing.
  test('stays inside the bounds a chart is resolved within', () => {
    expect(totalsBy('category').length).toBeLessThanOrEqual(MAX_CHART_CATEGORIES)
    expect(totalsBy('region').length).toBeLessThanOrEqual(CHART_PALETTE.length)
  })

  // The runtime totals each bar and each slice once, exactly (0055), and
  // each total here is recomputed from the data in plain BigInt: a bar of
  // another product line's lines, a slice of another region's, a total
  // left unrounded, or a share rounded twice, reads
  // otherwise here. Each share is the slice's total over the sum of the
  // slices, rounded once, half away from zero, to a tenth of a percent;
  // the shares need not add up to 100.0 %.
  test('resolves each bar to its product line’s exact total and each slice to its region’s, its share rounded once', () => {
    const [bars, pie] = resolvedCharts() as [AxisChart, PieChart]
    const byCategory = totalsBy('category')
    expect([bars.categories, bars.series.map(({ values }) => values.map((value) => value?.exact))]).toEqual([
      byCategory.map(([category]) => category),
      [byCategory.map(([, total]) => exact(total))],
    ])
    const byRegion = totalsBy('region')
    const whole = byRegion.reduce((sum, [, total]) => sum + total, 0n)
    expect(whole).toBe(byCategory.reduce((sum, [, total]) => sum + total, 0n))
    const digits = (value: bigint): string =>
      new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(exact(value) as Intl.StringNumericLiteral)
    const percent = (permille: bigint): string =>
      new Intl.NumberFormat('de-CH', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
        `${permille / 1000n}.${String(permille % 1000n).padStart(3, '0')}` as Intl.StringNumericLiteral,
      )
    expect([pie.slices.map(({ value }) => value.exact), pie.legend.map(({ text }) => text)]).toEqual([
      byRegion.map(([, total]) => exact(total)),
      byRegion.map(([region, total]) => `${region}: ${digits(total)} (${percent(halfAway(total * 1000n, whole))})`),
    ])
  })

  // Page 1 prints its own header, the letterhead, where page 2 on prints
  // the running header with the month (0060); the page footer counts every
  // page. A running header on page 1 would print above the letterhead,
  // and a letterhead in the page header on every page.
  test('prints its letterhead on page 1 alone, a running header with its month from page 2, and its pages counted', () => {
    const { regions } = SALES_REPORT.report
    expect(regions.firstPageHeader?.map(({ id }) => id)).toEqual(['logo', 'logo-gap', 'sender'])
    const runs = (components: readonly Component[]) => components.flatMap((component) => (component.kind === 'text' ? component.content : []))
    expect(runs(regions.pageHeader)).toEqual(expect.arrayContaining([{ kind: 'field', field: { dataset: 'header', field: 'month' } }]))
    expect(runs(regions.pageFooter).map(({ kind }) => kind)).toEqual(expect.arrayContaining(['pageNumber', 'pageCount']))
  })

  // A group's header kept with one row, the rule before 0059, could stand
  // at the foot of page 1 with a single line under it; the report runs
  // onto page 2, so each product line's header asks for its first three.
  test('keeps each product line’s header with its first three lines', () => {
    expect(tables()[0]?.group?.keepWithRows).toBe(3)
  })
})
