import type { ChartComponent, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { sampleReport, withChart } from '../test-support.js'
import { chartDiagnostics } from './chart.js'

/** The sample with its chart's series replaced and its value printed at `scale` places. */
const charted = (series: ChartComponent['series'], scale: number): ReportDefinition =>
  withChart(sampleReport(), (chart) => ({ ...chart, series, valueFormat: { kind: 'number', scale, grouping: true } }))

const AVERAGE = { id: 'mean', label: 'Mean', fn: 'avg', of: { dataset: 'detail', field: 'amount' }, rounding: { scale: 2, mode: 'half-even' } } as const

describe('chartDiagnostics', () => {
  // An average rounded to two places and printed at none is rounded twice,
  // by a rule nobody declared.
  test('says a series printed at fewer places than its rounding keeps is rounded again', () => {
    expect(chartDiagnostics(charted([AVERAGE], 0))).toEqual([
      expect.objectContaining({
        code: 'format-rounds-again',
        severity: 'error',
        path: '/regions/summary/0/components/3/valueFormat',
        componentId: 'site-chart',
        message: expect.stringContaining('series "mean" of chart "site-chart"'),
      }),
    ])
  })

  // A count, and a sum, a least or a greatest of integers, is an integer,
  // which has no places to round: the runtime refuses its rounding, as an
  // aggregate's, so the editor says so before a render does. An average of
  // integers is a decimal, and so is a sum of decimals.
  test('says a series that declares a rounding and totals an integer has no places to round', () => {
    const rounding = { scale: 2, mode: 'half-even' } as const
    const quantity = { dataset: 'detail', field: 'quantity' } as const
    const at = (series: ChartComponent['series'][number]): string[] =>
      chartDiagnostics(charted([series], 2)).map(({ code, path, componentId }) => `${code} ${path} ${String(componentId)}`)
    const refused = ['rounding-not-decimal /regions/summary/0/components/3/series/0/rounding site-chart']
    expect(at({ id: 'lines', label: 'Lines', fn: 'count', rounding })).toEqual(refused)
    expect(at({ id: 'units', label: 'Units', fn: 'sum', of: quantity, rounding })).toEqual(refused)
    expect(at({ id: 'most', label: 'Most', fn: 'max', of: quantity, rounding })).toEqual(refused)
    expect(at({ id: 'mean', label: 'Mean', fn: 'avg', of: quantity, rounding })).toEqual([])
    expect(at({ ...AVERAGE, fn: 'sum' })).toEqual([])
    // Named by ids alone: a label is the author's words.
    expect(chartDiagnostics(charted([{ id: 'lines', label: 'Lines', fn: 'count', rounding }], 2))[0]?.message).toBe(
      'series "lines" of chart "site-chart" declares a rounding, and computes an integer, which has no places to round',
    )
  })

  // A format that keeps every place the rounding does rounds nothing again;
  // a diagnostic here would be a false alarm on every correct chart.
  test('says nothing of a series printed at the places it keeps, or of one that declares no rounding', () => {
    expect(chartDiagnostics(charted([AVERAGE], 2))).toEqual([])
    expect(chartDiagnostics(charted([{ id: 'lines', label: 'Lines', fn: 'count' }], 0))).toEqual([])
  })
})
