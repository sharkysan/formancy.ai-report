/**
 * What the diagnostics say of a report in one language: the errors the
 * runtime would refuse it for, and the warnings an author probably wants
 * to see, with the walk and the compilation they were found by, which the
 * diagnostics of each of its translations read again (`words.ts`).
 */
import type { ReportDefinition } from '@formancy/report-spec'
import { compiledSites } from '../expressions/compile-report.js'
import type { ReportCompilation } from '../expressions/compile-report.js'
import { chartDiagnostics } from './chart.js'
import type { Diagnostic } from './codes.js'
import { contentDiagnostics } from './content.js'
import { eInvoiceDiagnostics } from './e-invoice.js'
import { examplePaymentPartDiagnostics } from './example-payment-part.js'
import { reportParts } from './parts.js'
import type { ReportParts } from './parts.js'
import { roundingDiagnostics } from './rounding.js'
import { unusedDiagnostics } from './unused.js'

/** A report's diagnostics in the language its words are written in, and what found them. */
export interface Diagnosis {
  readonly diagnostics: readonly Diagnostic[]
  readonly parts: ReportParts
  readonly compiled: ReportCompilation
}

/**
 * Every diagnostic for `report` as its words are written, its translations
 * unread: expressions first, in document order, the aggregates' last, then
 * roundings, then a chart's series' roundings, then the e-invoice's
 * unprinted totals, then content, then a bill that holds SIX's examples,
 * then unused declarations in the order they are declared. The
 * expressions' are `compileReport`'s, so the editor reports exactly what
 * the runtime refuses.
 */
export function diagnosis(report: ReportDefinition): Diagnosis {
  const parts = reportParts(report)
  const compiled = compiledSites(report, parts.expressions)
  const diagnostics = [
    ...compiled.diagnostics,
    ...roundingDiagnostics(report, parts.printedTotals, compiled.members.totals),
    ...chartDiagnostics(report),
    ...eInvoiceDiagnostics(report, parts.expressions),
    ...contentDiagnostics(report),
    ...examplePaymentPartDiagnostics(report),
    ...unusedDiagnostics(report, parts),
  ]
  return { diagnostics, parts, compiled }
}
