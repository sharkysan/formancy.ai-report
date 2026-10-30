/**
 * Roundings the runtime would refuse, or apply twice.
 *
 * A total is rounded once, by its declared rule (0007). A format then shows
 * it, and rounds half away from zero to the places it shows. Where it shows
 * fewer places than the rounding keeps, the total is rounded a second time,
 * by a rule nobody declared: summed and rounded half-even to three places,
 * 1.2449 is 1.245, and shown at two places that is 1.25, where rounding the
 * total once to two places gives 1.24 in either mode. So such a format is an
 * error, and the author declares the rounding at the places printed.
 *
 * A rounding on an aggregate that computes an integer, a date, a text or
 * an instant has no places to round, and the runtime refuses it; it is an
 * error here too, so the editor says so before a render does. One whose
 * type the compiler cannot tell (`dyn`) is rounded as a decimal, as the
 * runtime does.
 */
import type { ReportDefinition } from '@formancy/report-spec'
import type { ExpressionMember } from '../expressions/members.js'
import { quote } from '../outcome.js'
import { diagnostic } from './codes.js'
import type { Diagnostic } from './codes.js'
import type { PrintedTotal } from './parts.js'

/** The types a rounding has places in. */
const ROUNDED = new Set(['decimal', 'dyn'])

export function roundingDiagnostics(report: ReportDefinition, printed: readonly PrintedTotal[], totals: ReadonlyMap<string, ExpressionMember>): Diagnostic[] {
  const found: Diagnostic[] = []
  for (const [index, aggregate] of report.aggregates.entries()) {
    const type = totals.get(aggregate.id)?.type
    if (aggregate.rounding === undefined || type === undefined || ROUNDED.has(type)) continue
    const what = type === 'int' ? 'an integer' : type === 'timestamp' ? 'an instant' : 'a date or a text'
    found.push(
      diagnostic('rounding-not-decimal', `aggregate ${quote(aggregate.id)} declares a rounding, and computes ${what}, which has no places to round`, {
        path: `/aggregates/${index}/rounding`,
      }),
    )
  }
  for (const total of printed) {
    const kept = report.aggregates.find(({ id }) => id === total.aggregate)?.rounding?.scale
    if (kept === undefined || total.scale >= kept) continue
    const said = `aggregate ${quote(total.aggregate)} is rounded to ${kept} places as it declares, and printed at ${total.scale}, which rounds it again by another rule; declare its rounding at ${total.scale} places`
    found.push(diagnostic('format-rounds-again', said, { path: total.path, componentId: total.componentId, columnId: total.columnId }))
  }
  return found
}
