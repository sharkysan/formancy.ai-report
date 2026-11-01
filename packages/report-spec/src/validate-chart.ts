/**
 * A chart: its shape, and the rules that make what it draws a chart of
 * something. Its category and its series read detail fields and nothing
 * else (a chart holds no expression), so their types are checked here,
 * statically; the runtime totals each series exactly, once, with the
 * function an aggregate is totalled with.
 *
 * A chart is held to what a reader could use: a series told apart in the
 * legend, a category that has a word for its null rows, a pie that is a
 * share of a whole. What only the data can say -- whether the categories
 * fit the box, whether every value is zero -- is the runtime's and the
 * renderer's, and is refused there, never cut to fit.
 */
import { AGGREGATE_FUNCTIONS } from './aggregates.js'
import type { AggregateFunction, Rounding } from './aggregates.js'
import { all, flag, identifier, matches, oneOf, optional, points, readList, shape, text } from './check.js'
import { CHART_CATEGORY_TYPES, CHART_KINDS, CHART_ORDERS, CHART_PALETTE, PIE_FUNCTIONS } from './chart.js'
import type { ChartCategory, ChartComponent, ChartSeries } from './chart.js'
import type { ComponentBase } from './components.js'
import type { FieldType } from './data.js'
import type { RegionName } from './definition.js'
import { MAX_CHART_SERIES, MAX_LABEL_LENGTH, MIN_CHART_SIDE } from './limits.js'
import { at } from './pointer.js'
import { COLOR } from './syntax.js'
import { readRounding } from './validate-aggregates.js'
import { declare, withinPage } from './validate-context.js'
import type { Ctx } from './validate-context.js'
import { readCheckedFormat, readFieldRef, readFormat } from './validate-inline.js'
import type { InlineScope } from './validate-inline.js'
import type { CurrencyFormat, NumberFormat } from './values.js'

export const CHART_REQUIRED = ['chart', 'dataset', 'width', 'height', 'category', 'series', 'valueFormat', 'emptyText']
export const CHART_OPTIONAL = ['title', 'categoryTitle', 'valueTitle', 'valueLabels', 'palette']

/** What a series totals: a sum, an average, a minimum or a maximum of text or of a date has no number to print. A count takes any field. */
const TOTALLED: readonly FieldType[] = ['integer', 'decimal']

/** A side of the box, held to what a plot needs and to the printable area, as an image's box is held to the page. */
function side(c: Ctx, value: unknown, path: string, which: 'width' | 'height'): number | undefined {
  const length = points(c.f, value, path, 'positive')
  if (length === undefined) return undefined
  if (length < MIN_CHART_SIDE) {
    c.f.report(path, 'out-of-range', `${length} points of ${which} leaves a chart no plot beneath its words; at least ${MIN_CHART_SIDE} are needed`)
    return undefined
  }
  withinPage(c, length, path, which, 'this chart')
  return length
}

/** A label, title or text, and whether it is blank where a reader needs words. */
function words(c: Ctx, value: unknown, path: string, needed: string | undefined): string | undefined {
  const read = text(c.f, value, path, MAX_LABEL_LENGTH)
  if (read !== undefined && needed !== undefined && read.trim() === '') c.f.report(path, 'invalid-chart', `${needed} cannot be blank`)
  return read
}

function readCategory(c: Ctx, value: unknown, path: string, scope: InlineScope): ChartCategory | undefined {
  const o = shape(c.f, value, path, ['field', 'order'], ['format', 'nullLabel'])
  if (o === undefined) return undefined
  const field = readFieldRef(c, o.field, at(path, 'field'), 'detail')
  const order = oneOf(c.f, o.order, at(path, 'order'), CHART_ORDERS)
  if (field?.type !== undefined && !CHART_CATEGORY_TYPES.includes(field.type)) {
    c.f.report(at(path, 'field'), 'binding-type-mismatch', `a chart groups by ${CHART_CATEGORY_TYPES.join(', ')} values, and this field is a ${field.type}`)
  }
  const format = readCheckedFormat(c, o.format, at(path, 'format'), scope, field?.type)
  const nullLabel = text(c.f, o.nullLabel, at(path, 'nullLabel'), MAX_LABEL_LENGTH)
  // Rows without a category would be drawn under no word, or dropped.
  if (field !== undefined && !Object.hasOwn(o, 'nullLabel') && c.declared.nullable.get(field.ref.dataset)?.has(field.ref.field) === true) {
    c.f.report(at(path, 'nullLabel'), 'missing-property', 'this field may be null, so the chart says what its rows without a value are called')
  }
  return field === undefined || order === undefined
    ? undefined
    : { field: field.ref, order, ...optional('format', format), ...optional('nullLabel', nullLabel) }
}

/** A series, and its function when that could be read: a pie is held to it. */
function readSeries(c: Ctx, value: unknown, path: string): { series: ChartSeries | undefined; fn: AggregateFunction | undefined } {
  const o = shape(c.f, value, path, ['id', 'label', 'fn'], ['of', 'rounding'])
  if (o === undefined) return { series: undefined, fn: undefined }
  const id = identifier(c.f, o.id, at(path, 'id'))
  const label = words(c, o.label, at(path, 'label'), "the label of a series, the legend's entry for it,")
  const fn = oneOf(c.f, o.fn, at(path, 'fn'), AGGREGATE_FUNCTIONS)
  const of = o.of === undefined ? undefined : readFieldRef(c, o.of, at(path, 'of'), 'detail')
  if (fn !== undefined && fn !== 'count' && o.of === undefined) {
    c.f.report(at(path, 'of'), 'missing-property', `a ${fn} needs a field to total; only a count may leave it out, to count rows`)
  }
  const mismatch = fn !== undefined && fn !== 'count' && of?.type !== undefined && !TOTALLED.includes(of.type)
  if (mismatch) c.f.report(at(path, 'of'), 'aggregate-type-mismatch', `${fn} takes ${TOTALLED.join(' or ')} values, and this field is a ${of.type}`)
  const rounding: Rounding | undefined = readRounding(c.f, o.rounding, at(path, 'rounding'))
  // An exact average is rarely a terminating decimal: 1, 1 and 2 average 1.333...
  if (fn === 'avg' && o.rounding === undefined) c.f.report(at(path, 'rounding'), 'missing-property', 'an average is rarely exact, so it says how it is rounded')
  if (id === undefined || label === undefined || fn === undefined || (o.of !== undefined && of === undefined)) return { series: undefined, fn }
  return { series: { id, label, fn, ...optional('of', of?.ref), ...optional('rounding', rounding) }, fn }
}

function readPalette(c: Ctx, value: unknown, path: string): readonly string[] | undefined {
  const items = readList(c.f, value, path, 1, CHART_PALETTE.length)
  if (items === undefined) return undefined
  const colors = items.map((item, index) => matches(c.f, item, at(path, index), COLOR, 'invalid-color', 'a colour written #rrggbb in lower case'))
  // Two series of one colour are told apart by nothing.
  colors.forEach((color, index) => {
    if (color !== undefined && colors.indexOf(color) < index) c.f.report(at(path, index), 'invalid-chart', `the palette already has ${color}`)
  })
  return all(colors)
}

export function readChart(c: Ctx, o: Record<string, unknown>, path: string, region: RegionName, base: ComponentBase | undefined): ChartComponent | undefined {
  const scope: InlineScope = { region, reads: 'report' }
  const chart = oneOf(c.f, o.chart, at(path, 'chart'), CHART_KINDS)
  const dataset = oneOf(c.f, o.dataset, at(path, 'dataset'), ['detail'] as const)
  const chartWidth = side(c, o.width, at(path, 'width'), 'width')
  const height = side(c, o.height, at(path, 'height'), 'height')
  const category = readCategory(c, o.category, at(path, 'category'), scope)

  const where = at(path, 'series')
  const items = readList(c.f, o.series, where, 1, MAX_CHART_SERIES)
  const read = items?.map((item, index) => readSeries(c, item, at(where, index)))
  if (read !== undefined && items !== undefined) {
    declare(
      c.f,
      read.map(({ series }, index) => ({ id: series?.id, path: at(at(where, index), 'id'), value: true as const })),
      'duplicate-id',
      (duplicate) => `another series of this chart is already ${duplicate}`,
    )
  }
  const series = read && all(read.map((entry) => entry.series))

  // The values print in a number or a currency, read where the report is: a chart has no current row.
  const valueFormat = readFormat(c, o.valueFormat, at(path, 'valueFormat'), scope)
  if (valueFormat !== undefined && valueFormat.kind !== 'number' && valueFormat.kind !== 'currency') {
    c.f.report(
      at(path, 'valueFormat'),
      'format-type-mismatch',
      `a chart prints totals, in a number or a currency format, and this is a ${valueFormat.kind} format`,
    )
  }
  const emptyText = words(c, o.emptyText, at(path, 'emptyText'), 'the text a chart with nothing to draw prints')
  const title = text(c.f, o.title, at(path, 'title'), MAX_LABEL_LENGTH)
  const categoryTitle = text(c.f, o.categoryTitle, at(path, 'categoryTitle'), MAX_LABEL_LENGTH)
  const valueTitle = text(c.f, o.valueTitle, at(path, 'valueTitle'), MAX_LABEL_LENGTH)
  const valueLabels = flag(c.f, o.valueLabels, at(path, 'valueLabels'))
  const palette = readPalette(c, o.palette, at(path, 'palette'))

  // The kinds' own rules last: each needs the series read.
  if (chart === 'pie' && read !== undefined) {
    if (read.length > 1) c.f.report(where, 'invalid-chart', 'a pie is the shares of one series, and this chart has more')
    for (const [index, { fn }] of read.entries()) {
      if (fn !== undefined && !PIE_FUNCTIONS.includes(fn)) {
        c.f.report(
          at(at(where, index), 'fn'),
          'invalid-chart',
          `a pie shows shares of a whole, which only ${PIE_FUNCTIONS.join(' or ')} give; a ${fn} is no share`,
        )
      }
    }
  }
  if (chart === 'pie') {
    for (const key of ['categoryTitle', 'valueTitle'] as const) {
      if (o[key] !== undefined) c.f.report(at(path, key), 'invalid-chart', `a pie has no axis to title`)
    }
  }
  if (chart === 'line' && valueLabels === true && read !== undefined && read.length > 1) {
    c.f.report(at(path, 'valueLabels'), 'invalid-chart', 'value labels on a line of several series would be printed over one another at a category')
  }

  if (base === undefined || chart === undefined || dataset === undefined || chartWidth === undefined || height === undefined) return undefined
  if (category === undefined || series === undefined || valueFormat === undefined || emptyText === undefined) return undefined
  if (valueFormat.kind !== 'number' && valueFormat.kind !== 'currency') return undefined
  if (o.palette !== undefined && palette === undefined) return undefined
  const typedFormat: NumberFormat | CurrencyFormat = valueFormat
  return {
    ...base,
    kind: 'chart',
    chart,
    dataset,
    width: chartWidth,
    height,
    category,
    series,
    valueFormat: typedFormat,
    emptyText,
    ...optional('title', title),
    ...optional('categoryTitle', categoryTitle),
    ...optional('valueTitle', valueTitle),
    ...optional('valueLabels', valueLabels),
    ...optional('palette', palette),
  }
}
