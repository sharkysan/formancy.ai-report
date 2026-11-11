/**
 * A chart in the resolved document: a bar, line or pie chart of the detail
 * rows, with every number it prints decided by the runtime (`lower-chart.ts`)
 * and nothing left to a renderer but where each mark and word goes.
 *
 * The block holds every word the chart prints -- its title, its axes'
 * titles, each category's label, each tick's, each value's and each legend
 * entry -- each a string the runtime's formatter wrote, so a renderer prints
 * none of its own and formats, rounds or converts no number. It holds every
 * colour the chart paints but the grid's and the axis's, which are the
 * renderer's, as a table's rules are. A value is held twice: exactly, which
 * a renderer may make a coordinate of, and as the text it prints, which is
 * all a renderer prints of it.
 *
 * A chart with nothing to draw -- no rows, a bar or a line chart with no
 * value, a pie whose values are all zero -- holds its title and its empty
 * text and nothing else: its categories, series, ticks, slices and legend
 * are empty, and it has no axis to title.
 */
import type { TextStyle } from './document.js'

/** An exact number as the runtime holds it (`decimalToString`) and as it prints. A renderer may make a coordinate of `exact` (`Number`), and prints `text` alone. */
export interface ChartValue {
  readonly exact: string
  readonly text: string
}

/** One entry of a legend: what it says, and the colour of what it names, lower-case `#rrggbb`. */
export interface ChartLegendEntry {
  readonly text: string
  readonly color: string
}

/** What every kind of chart holds: its box, its words' style, its title and its legend. */
interface ChartFrame {
  readonly kind: 'chart'
  /** The component's id, which a refusal names as its subject. */
  readonly id: string
  /** Points: the box the chart is drawn in, which the layout reserves whole whatever it holds. */
  readonly width: number
  readonly height: number
  /** How its words print. */
  readonly style?: TextStyle
  readonly title?: string
  /** In the order its entries print: a bar or a line chart's series where it has more than one, a pie's categories. */
  readonly legend: readonly ChartLegendEntry[]
  /** Present exactly when there is nothing to draw (R7, R8): the chart's empty text, printed in place of its marks. */
  readonly empty?: string
}

/** One series of a bar or a line chart: its colour, and its value at each category, null where it has none. */
export interface ChartSeriesValues {
  readonly color: string
  /** One per category, in its order. */
  readonly values: readonly (ChartValue | null)[]
}

/** A bar or a line chart: categories along one axis, values up the other. */
export interface AxisChart extends ChartFrame {
  readonly chart: 'bar' | 'line'
  readonly categoryTitle?: string
  readonly valueTitle?: string
  /** Each category's label, in the order the chart lists them. */
  readonly categories: readonly string[]
  readonly series: readonly ChartSeriesValues[]
  /** The value axis, fixed: lowest first, the first and the last its range, each a gridline; a renderer draws these and no other. */
  readonly ticks: readonly ChartValue[]
  /** Whether each value prints its text beside its mark. */
  readonly valueLabels: boolean
}

/** A pie chart: one series, a slice for each category. */
export interface PieChart extends ChartFrame {
  readonly chart: 'pie'
  /** One per category, in its order; its legend entry is the same index. */
  readonly slices: readonly { readonly color: string; readonly value: ChartValue }[]
}

export type Chart = AxisChart | PieChart
