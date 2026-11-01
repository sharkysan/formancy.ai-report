/**
 * The chart component: a bar, line or pie chart of the detail rows, drawn
 * as vectors from the numbers the runtime totals, never from a picture.
 *
 * What a chart groups by and what it totals is written here; the
 * validator (`validate-chart.ts`) holds a chart to its fields' types, the
 * runtime totals each series exactly, once, and the renderer draws the
 * resolved numbers and refuses what it cannot draw whole.
 */
import type { AggregateFunction, Rounding } from './aggregates.js'
import type { ComponentBase } from './components.js'
import type { FieldRef, FieldType } from './data.js'
import type { CurrencyFormat, Format, NumberFormat } from './values.js'

export const CHART_KINDS = ['bar', 'line', 'pie'] as const
export type ChartKind = (typeof CHART_KINDS)[number]

/** The order a chart lists its categories in: as the rows first have them, or by the first series' total, least or greatest first. */
export const CHART_ORDERS = ['data', 'asc', 'desc'] as const
export type ChartOrder = (typeof CHART_ORDERS)[number]

/** The types a category may be: text, a date, or a number. A boolean, a moment or an image names no group a reader would look for. Held by the validator. */
export const CHART_CATEGORY_TYPES: readonly FieldType[] = ['string', 'date', 'integer', 'decimal']

/** What a pie may total: a share of an average, a minimum or a maximum is no share of a whole. Held by the validator. */
export const PIE_FUNCTIONS: readonly AggregateFunction[] = ['sum', 'count']

/**
 * The colours a series is drawn in, by its place in the chart (a pie's
 * slices by the category's): eight, each at least 3:1 against white paper
 * (WCAG 2.2 1.4.11), the least `#1b9e77` at 3.39. A chart's own `palette`
 * overrides them. Held by `chart.test.ts`.
 */
export const CHART_PALETTE = ['#1f77b4', '#d95f02', '#1b9e77', '#7570b3', '#e7298a', '#5a8f1a', '#a6761d', '#666666'] as const

/** What the chart groups the detail rows by: one group, one category, for each value the field takes. */
export interface ChartCategory {
  readonly field: FieldRef
  readonly order: ChartOrder
  /** How the category prints; it must display the field's type. */
  readonly format?: Format
  /** The label of the rows whose category is null; asked of a field that may be null. */
  readonly nullLabel?: string
}

/** One thing a chart totals for each category: a function over a detail field, as an aggregate's, with `avg` declaring its rounding. */
export interface ChartSeries {
  /** Unique in the chart. */
  readonly id: string
  /** The legend's entry. */
  readonly label: string
  readonly fn: AggregateFunction
  /** Absent only for `count`, which then counts rows. */
  readonly of?: FieldRef
  readonly rounding?: Rounding
}

/** A chart drawn in a box of fixed size; the width and the height bound it whatever its data holds. */
export interface ChartComponent extends ComponentBase {
  readonly kind: 'chart'
  readonly chart: ChartKind
  readonly dataset: 'detail'
  readonly width: number
  readonly height: number
  readonly category: ChartCategory
  readonly series: readonly ChartSeries[]
  /** How every value prints: ticks, value labels and a pie's shares. */
  readonly valueFormat: NumberFormat | CurrencyFormat
  /** What prints in place of a chart with nothing to draw. */
  readonly emptyText: string
  readonly title?: string
  readonly categoryTitle?: string
  readonly valueTitle?: string
  readonly valueLabels?: boolean
  /** Replaces `CHART_PALETTE`: one to eight distinct colours. */
  readonly palette?: readonly string[]
}
