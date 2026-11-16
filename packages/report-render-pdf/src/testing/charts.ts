import type { AxisChart, ChartValue, PieChart, ResolvedFaces } from '@formancy/report-runtime'
import { fixture } from './documents.js'

/**
 * Charts for the renderer's tests of a chart in the document: the check's
 * (`charts.test.ts`) and the drawing's in the PDF (`chart-content.test.ts`).
 * Each is built by hand as the runtime resolves one (`lower-chart.ts`),
 * and each passes every check and draws in Roboto and in Liberation Serif,
 * so that a case that changes one is refused, or drawn otherwise, for its
 * own change.
 */

/** A value the runtime resolved: exactly, and as it prints. */
export const value = (exact: string, text = exact): ChartValue => ({ exact, text })

/** Two series of bars over two regions, one value missing and one at each end of the axis, every value labelled, with a title, axis titles and a legend: every word a bar chart prints. */
export const BARS: AxisChart = {
  kind: 'chart',
  chart: 'bar',
  id: 'sales',
  width: 300,
  height: 200,
  title: 'Sales',
  categoryTitle: 'Region',
  valueTitle: 'CHF',
  categories: ['North', 'South'],
  series: [
    { color: '#1f77b4', values: [value('10.25'), null] },
    { color: '#ff7f0e', values: [value('15'), value('-5')] },
  ],
  ticks: ['-5', '0', '5', '10', '15'].map((exact) => value(exact)),
  valueLabels: true,
  legend: [
    { text: 'Plan', color: '#1f77b4' },
    { text: 'Actual', color: '#ff7f0e' },
  ],
}
export const [PLAN, ACTUAL] = BARS.series as [AxisChart['series'][number], AxisChart['series'][number]]

/** One line over three months, its axis above zero, which only a bar stands on, its values unlabelled and no legend. */
export const LINE: AxisChart = {
  kind: 'chart',
  chart: 'line',
  id: 'balance',
  width: 260,
  height: 160,
  title: 'Balance',
  categoryTitle: 'Month',
  valueTitle: 'CHF',
  categories: ['Jan', 'Feb', 'Mar'],
  series: [{ color: '#2ca02c', values: [value('6'), value('12'), value('9')] }],
  ticks: ['5', '10', '15'].map((exact) => value(exact)),
  valueLabels: false,
  legend: [],
}

/** A pie of three slices, one of them nothing, its legend its categories with their values and shares. */
export const PIE: PieChart = {
  kind: 'chart',
  chart: 'pie',
  id: 'shares',
  width: 200,
  height: 200,
  title: 'Shares',
  slices: [
    { color: '#1f77b4', value: value('3') },
    { color: '#ff7f0e', value: value('1') },
    { color: '#2ca02c', value: value('0') },
  ],
  legend: [
    { text: 'North: 3 (75.0 %)', color: '#1f77b4' },
    { text: 'South: 1 (25.0 %)', color: '#ff7f0e' },
    { text: 'East: 0 (0.0 %)', color: '#2ca02c' },
  ],
}

/** A line chart with nothing to draw: its title and its empty text, and nothing else, as the runtime resolves one. */
export const EMPTY: AxisChart = {
  kind: 'chart',
  chart: 'line',
  id: 'nothing',
  width: 200,
  height: 100,
  title: 'Balance',
  empty: 'No data',
  legend: [],
  categories: [],
  series: [],
  ticks: [],
  valueLabels: false,
}

/** Liberation Serif 2.1.5's four faces, the corpus's host font, its assets `serif` and `serif-bold` among them. */
export const SERIF: ResolvedFaces = fixture('host-fonts').document.fonts!.serif!

/** Liberation Mono 2.1.5's regular and bold faces, the corpus's other host font: a face of other widths than Liberation Serif's. */
export const MONO: ResolvedFaces = fixture('host-fonts').document.fonts!.mono!
