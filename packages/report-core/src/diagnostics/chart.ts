/**
 * A chart's series rounded where it has no places, or rounded twice. A
 * series declares its rounding as an aggregate does, and is held to the
 * same two rules (`rounding.ts` says why, for an aggregate): a count, and a
 * sum, a least or a greatest of integers, is an integer, which has no
 * places to round, and the runtime refuses its rounding; and the chart's
 * value format shows a rounded total rounding half away from zero to the
 * places it shows, so where those are fewer than the rounding keeps, the
 * number is rounded again by a rule nobody declared. What a series computes
 * is typed as an aggregate over the same field is, by `COMPUTES`.
 */
import { walkComponents } from '@formancy/report-spec'
import type { ChartSeries, ReportDefinition } from '@formancy/report-spec'
import { COMPUTES, readAs } from '../expressions/members.js'
import { quote } from '../outcome.js'
import { diagnostic } from './codes.js'
import type { Diagnostic } from './codes.js'
import { unrounded } from './rounding.js'

/** What `series` computes, typed as the compiler types an aggregate of its function over its field. */
function computed(report: ReportDefinition, series: ChartSeries): string {
  return COMPUTES[series.fn](readAs(report.datasets.detail?.fields.find(({ id }) => id === series.of?.field)?.type)).type
}

export function chartDiagnostics(report: ReportDefinition): Diagnostic[] {
  const found: Diagnostic[] = []
  for (const { component, path } of walkComponents(report)) {
    if (component.kind !== 'chart') continue
    const printed = component.valueFormat.scale
    for (const [index, series] of component.series.entries()) {
      if (series.rounding === undefined) continue
      const named = `series ${quote(series.id)} of chart ${quote(component.id)}`
      const what = unrounded(computed(report, series))
      if (what !== undefined) {
        const said = `${named} declares a rounding, and computes ${what}, which has no places to round`
        found.push(diagnostic('rounding-not-decimal', said, { path: `${path}/series/${index}/rounding`, componentId: component.id }))
        continue
      }
      const kept = series.rounding.scale
      if (printed >= kept) continue
      const said = `${named} is rounded to ${kept} places as it declares, and printed at ${printed}, which rounds it again by another rule; print it at ${kept} places or declare its rounding at ${printed}`
      found.push(diagnostic('format-rounds-again', said, { path: `${path}/valueFormat`, componentId: component.id }))
    }
  }
  return found
}
