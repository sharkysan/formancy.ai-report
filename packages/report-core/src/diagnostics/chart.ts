/**
 * A chart's series rounded twice. A series that averages declares its
 * rounding as an aggregate does, and the chart's value format then shows
 * it, rounding half away from zero to the places it shows: where those are
 * fewer than the rounding keeps, the number is rounded again by a rule
 * nobody declared (`rounding.ts` says why, for an aggregate).
 */
import { walkComponents } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { quote } from '../outcome.js'
import { diagnostic } from './codes.js'
import type { Diagnostic } from './codes.js'

export function chartDiagnostics(report: ReportDefinition): Diagnostic[] {
  const found: Diagnostic[] = []
  for (const { component, path } of walkComponents(report)) {
    if (component.kind !== 'chart') continue
    const printed = component.valueFormat.scale
    for (const series of component.series) {
      const kept = series.rounding?.scale
      if (kept === undefined || printed >= kept) continue
      const said = `series ${quote(series.id)} of chart ${quote(component.id)} is rounded to ${kept} places as it declares, and printed at ${printed}, which rounds it again by another rule; print it at ${kept} places or declare its rounding at ${printed}`
      found.push(diagnostic('format-rounds-again', said, { path: `${path}/valueFormat`, componentId: component.id }))
    }
  }
  return found
}
