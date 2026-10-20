/**
 * The report an author starts from when they start from nothing.
 */
import type { ReportDefinition } from './definition.js'
import { describeErrors } from './errors.js'
import { mmToPt } from './units.js'
import { validateReport } from './validate.js'
import { REPORT_SPEC_VERSION } from './version.js'

/** The default margin: 20 mm, a common default for A4 business documents. */
const MARGIN_MM = 20

/**
 * A valid, empty A4 portrait report with 20 mm margins, nothing declared and
 * nothing in any region, recorded as started blank.
 *
 * Throws a RangeError naming the property when `id`, `title` or `locale` is
 * one the format refuses, rather than returning a report every later step
 * would refuse.
 */
export function emptyReport(id: string, title: string, locale: string): ReportDefinition {
  const margin = mmToPt(MARGIN_MM)
  const outcome = validateReport({
    reportSpecVersion: REPORT_SPEC_VERSION,
    id,
    title,
    locale,
    page: { size: 'A4', orientation: 'portrait', margins: { top: margin, right: margin, bottom: margin, left: margin } },
    styles: [],
    datasets: {},
    parameters: [],
    assets: [],
    aggregates: [],
    regions: { reportHeader: [], pageHeader: [], body: [], pageFooter: [], summary: [] },
    provenance: { kind: 'blank' },
  })
  if (outcome.valid) return outcome.report
  throw new RangeError(`not a valid empty report: ${describeErrors(outcome.errors)}`)
}
