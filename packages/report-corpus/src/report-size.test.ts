import type { ReportDefinition } from '@formancy/report-runtime'
import { MAX_REPORT_BYTES } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { SITE_VISIT_REPORT } from './forms/site-visit.js'
import { E_INVOICE_SAMPLES, EURO_INVOICE_SAMPLES, INVOICE_SAMPLES, STARTERS, XRECHNUNG_SAMPLES } from './starters/index.js'

/** The factor `MAX_REPORT_BYTES`'s comment in report-spec's `limits.ts` states, which this file is the guard of. */
const MARGIN = 16

/** The bytes of a report as the draft's route reads it: the UTF-8 of its JSON, which is what a client sends. */
function serialisedBytes(report: ReportDefinition): number {
  return new TextEncoder().encode(JSON.stringify(report)).byteLength
}

/** Every report the corpus holds, once each: the starters and the samples that share their definitions, then the site visit's. */
const REPORTS = new Map<string, ReportDefinition>([
  ...[...STARTERS, ...INVOICE_SAMPLES, ...EURO_INVOICE_SAMPLES, ...E_INVOICE_SAMPLES, ...XRECHNUNG_SAMPLES].map(
    (starter) => [starter.id, starter.report] as const,
  ),
  ['site-visit-report', SITE_VISIT_REPORT],
])

describe('the size a report may have as a draft', () => {
  // A starter grown past the limit would be a report the Studio offers that
  // no server keeps: the draft's route would refuse the first save of what
  // a new author opened.
  test.each([...REPORTS])('%s fits MAX_REPORT_BYTES', (_id, report) => {
    expect(serialisedBytes(report)).toBeLessThanOrEqual(MAX_REPORT_BYTES)
  })

  // The limit's comment states the factor it leaves over the largest report
  // the corpus holds. Without this, a starter that grew toward the limit, or
  // a limit lowered toward the starters, would leave the comment stating a
  // margin nobody has: the first report a person adds to would be refused
  // on its next save.
  test('leaves the factor limits.ts states over the largest report the corpus holds', () => {
    const largest = Math.max(...[...REPORTS.values()].map(serialisedBytes))
    expect(MAX_REPORT_BYTES).toBeGreaterThanOrEqual(largest * MARGIN)
  })
})
