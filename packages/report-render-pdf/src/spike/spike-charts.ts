/**
 * SPIKE (Task 15, spike/chart-echarts): throwaway, never merged.
 *
 * The spike's hand-built chart blocks, as PR 2's runtime would resolve them:
 * every word and tick a string, every value exact and as it prints. The
 * e-invoice gate's `variant-charts-spike.pdf` draws these three too
 * (`scripts/e-invoice/pdf-corpus.mjs` holds its own copy, since the gate
 * reads the built packages alone).
 */
import type { AxisChart, Chart, ChartValue, PieChart } from './chart.js'

const v = (exact: string, text = exact): ChartValue => ({ exact, text })

/** Two series, a negative bar, value labels, both axis titles and a legend; ticks as Task 11's ['-30', '70'] bar row. */
export const BARS: AxisChart = {
  kind: 'chart',
  chart: 'bar',
  id: 'bars',
  width: 400,
  height: 220,
  title: 'Umsatz nach Region',
  categoryTitle: 'Region',
  valueTitle: 'CHF',
  categories: ['Nord', 'Süd', 'Ost & West'],
  series: [
    { color: '#5b4bb7', values: [v('70', '70.00'), v('-30', '-30.00'), v('45.5', '45.50')] },
    { color: '#1f9e89', values: [v('20', '20.00'), v('35.25', '35.25'), v('-12', '-12.00')] },
  ],
  ticks: [v('-50'), v('0'), v('50'), v('100')],
  valueLabels: true,
  legend: [
    { text: '2025', color: '#5b4bb7' },
    { text: '2026', color: '#1f9e89' },
  ],
}

/** One series with a gap, value labels and both axis titles; one series, so no legend. Ticks as Task 11's ['10.5', '12.25'] line row. */
export const LINE: AxisChart = {
  kind: 'chart',
  chart: 'line',
  id: 'line',
  width: 400,
  height: 200,
  title: 'Temperatur',
  categoryTitle: 'Monat',
  valueTitle: '°C',
  categories: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai'],
  series: [{ color: '#c0392b', values: [v('10.5', '10.50'), v('11.75', '11.75'), null, v('12.25', '12.25'), v('11', '11.00')] }],
  ticks: [v('10.5', '10.50'), v('11', '11.00'), v('11.5', '11.50'), v('12', '12.00'), v('12.5', '12.50')],
  valueLabels: true,
  legend: [],
}

/** Three slices, their values in the legend. */
export const PIE: PieChart = {
  kind: 'chart',
  chart: 'pie',
  id: 'pie',
  width: 300,
  height: 220,
  title: 'Anteile',
  slices: [
    { color: '#5b4bb7', value: v('50', '50.00') },
    { color: '#1f9e89', value: v('30', '30.00') },
    { color: '#e67e22', value: v('20', '20.00') },
  ],
  legend: [
    { text: 'Beratung 50.00 (50 %)', color: '#5b4bb7' },
    { text: 'Material 30.00 (30 %)', color: '#1f9e89' },
    { text: 'Reise 20.00 (20 %)', color: '#e67e22' },
  ],
}

/** The bars, their category labels turned a quarter (Q5): long enough that across they would not fit their slots. */
export const TURNED: AxisChart & { readonly spikeTurn: 90 } = {
  ...BARS,
  id: 'turned',
  height: 260,
  categories: ['Nordwestschweiz', 'Südostschweiz', 'Ost & Westschweiz'],
  spikeTurn: 90,
}

export const CHARTS: readonly Chart[] = [BARS, LINE, PIE]
