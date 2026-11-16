import type { AxisChart } from '@formancy/report-runtime'
import { registerPreprocessor } from 'echarts/core'
import { afterEach, describe, expect, test } from 'vitest'
import { drawChart, type DrawnChart } from './chart-draw.js'
import { value } from './testing/charts.js'
import { TIMEOUT } from './testing/documents.js'
import { measured, planned } from './testing/echarts.js'

/**
 * ECharts' registries are the process's, and a host's (0058). The
 * renderer registers its components on the one `echarts` a Node install
 * or a bundler dedupes every importer of ECharts 6.1.0 to, and guards the
 * one zrender's platform it measures with; but a preprocessor, a
 * processor, a visual, a layout or an update a host registers on that
 * same ECharts runs on every chart the renderer lays out too. The drawing
 * holds every word to the runtime's and every path to the chart's box,
 * not a bar to its value: what such a registration changes of a chart's
 * marks prints, and nothing is refused.
 *
 * This case pins the exposure, which `limitations.json` states, rather
 * than a behaviour wanted: should the drawing come to hold each mark to
 * its place, it fails, and the limitation goes with it.
 */

/** One series of bars over two regions, 10 and 5 on an axis of 0 to 20: no title, no legend, no label. */
const SALES: AxisChart = {
  kind: 'chart',
  chart: 'bar',
  id: 'sales',
  width: 300,
  height: 200,
  categories: ['North', 'South'],
  series: [{ color: '#1f77b4', values: [value('10'), value('5')] }],
  ticks: ['0', '5', '10', '15', '20'].map((exact) => value(exact)),
  valueLabels: false,
  legend: [],
}

/** The height of each bar `drawing` paints in SALES's colour, as zrender writes a bar: a rectangle of relative sides. */
const bars = ({ svg }: DrawnChart): number[] =>
  [...svg.matchAll(/<path d="M-?[\d.]+ -?[\d.]+l-?[\d.]+ 0l0 (-?[\d.]+)l-?[\d.]+ 0Z" fill="#1f77b4"/g)].map(([, height]) => -Number(height))

/** Whether the host's preprocessor below halves what it is handed: armed for one draw at a time, so that no other case meets it. */
let halving = false
afterEach(() => {
  halving = false
})

// Registered once: ECharts keeps a preprocessor for the life of the
// process and has no way to remove one. It halves every bar series' data,
// as a host's own preprocessor, written for its own charts, might.
registerPreprocessor((option) => {
  if (!halving) return
  const series = [option['series'] ?? []].flat() as { type?: string; data?: unknown[] }[]
  for (const each of series)
    if (each.type === 'bar' && each.data !== undefined) each.data = each.data.map((datum) => (typeof datum === 'number' ? datum / 2 : datum))
})

describe("ECharts' registries, shared with a host", () => {
  // A host's preprocessor, registered on the ECharts the renderer lays out
  // with, reaches the renderer's charts: every bar drawn half as tall as
  // its value stands on the runtime's ticks, the ticks' words as they
  // were, and the chart drawn, refused by nothing.
  test(
    "draws a chart's bars as a host's preprocessor changed them",
    async () => {
      const { faces, widths } = await measured(planned(), {})
      const before = drawChart(SALES, faces, widths)
      halving = true
      const after = drawChart(SALES, faces, widths)
      expect(bars(before)).toHaveLength(2)
      expect(bars(after).map((height) => Math.round(height * 10) / 10)).toEqual(bars(before).map((height) => Math.round((height / 2) * 10) / 10))
      expect(after.words.map(({ key, text }) => [key, text])).toEqual(before.words.map(({ key, text }) => [key, text]))
    },
    TIMEOUT,
  )
})
