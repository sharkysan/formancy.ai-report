/**
 * What an editor shows about a valid report: the errors the runtime would
 * refuse it for, and the warnings an author probably wants to see.
 */
import type { ReportDefinition } from '@formancy/report-spec'
import { compiledSites } from '../expressions/compile-report.js'
import type { Diagnostic } from './codes.js'
import { contentDiagnostics } from './content.js'
import { eInvoiceDiagnostics } from './e-invoice.js'
import { examplePaymentPartDiagnostics } from './example-payment-part.js'
import { reportParts } from './parts.js'
import { roundingDiagnostics } from './rounding.js'
import { unusedDiagnostics } from './unused.js'

/**
 * Every diagnostic for `report`, a report the validator accepts -- a
 * session's document is one. Expressions first, in document order, the
 * aggregates' last, then roundings, then the e-invoice's unprinted totals,
 * then content, then a bill that holds SIX's examples, then unused
 * declarations in the order they are declared. The expressions' are `compileReport`'s,
 * so the editor reports exactly what the runtime refuses.
 */
export function diagnose(report: ReportDefinition): Diagnostic[] {
  const parts = reportParts(report)
  const compiled = compiledSites(report, parts.expressions)
  return [
    ...compiled.diagnostics,
    ...roundingDiagnostics(report, parts.printedTotals, compiled.members.totals),
    ...eInvoiceDiagnostics(report, parts.expressions),
    ...contentDiagnostics(report),
    ...examplePaymentPartDiagnostics(report),
    ...unusedDiagnostics(report, parts),
  ]
}
