/*
 * A consumer that knows nothing about the workspace.
 *
 * Copied into a temporary npm project by install-test.mjs, installed from the
 * packed tarballs, type-checked with skipLibCheck OFF and run under Node. What
 * is on trial is that the published entry points resolve, with the types that
 * shipped.
 */
import { checkSpecVersion, emptyReport, REPORT_FORMAT, REPORT_SPEC_VERSION, reportHash, validateReport, walkComponents } from '@formancy/report-spec'
import type { ReportDefinition, ReportError, ReportValidation, SpecVersionCheck, TableComponent } from '@formancy/report-spec'

// The published code carries the refusal, not only the source: a formancy
// form handed over as a report is named as a form, and the version this
// package reads is read. A type-only export that lost the union, or a dist
// that lost the check, fails here rather than in a host.
const form: SpecVersionCheck = checkSpecVersion({ specVersion: '3', id: 'order', title: 'Order', model: { fields: [] } })
if (form.ok || form.code !== 'not-a-report') throw new Error('a formancy form was not refused as not a report')
const version: SpecVersionCheck = checkSpecVersion({ reportSpecVersion: REPORT_SPEC_VERSION })
if (!version.ok) throw new Error(`reportSpecVersion ${REPORT_SPEC_VERSION} was not read: ${version.message}`)

// A report written against the published types, as a host would write one.
// A declaration that lost a type, or a union that lost a member, does not
// compile here with skipLibCheck off.
const table: TableComponent = {
  id: 'lines',
  kind: 'table',
  dataset: 'detail',
  columns: [{ id: 'amount', header: 'Amount', width: 'fill', align: 'right', value: { kind: 'field', field: { dataset: 'detail', field: 'amount' } } }],
  totals: [{ cells: [{ column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'report' } }], style: 'strong' }],
  emptyText: 'No lines.',
  repeatHeader: true,
}
const report: ReportDefinition = {
  reportSpecVersion: REPORT_SPEC_VERSION,
  id: 'install-check',
  title: 'Prüfbericht',
  locale: 'de-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [{ id: 'strong', bold: true }],
  datasets: { detail: { id: 'lines', fields: [{ id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 }] } },
  parameters: [],
  assets: [],
  aggregates: [{ id: 'total', fn: 'sum', of: { kind: 'field', field: { dataset: 'detail', field: 'amount' } } }],
  regions: {
    reportHeader: [],
    pageHeader: [],
    body: [table],
    pageFooter: [{ id: 'page', kind: 'text', content: [{ kind: 'pageNumber' }] }],
    summary: [],
  },
}

// The published validator reads it, and the published hash names it.
const outcome: ReportValidation = validateReport(report)
if (!outcome.valid) throw new Error(`a valid report was refused: ${outcome.errors.map((error: ReportError) => `${error.code} ${error.path}`).join(', ')}`)
const hash = reportHash(outcome.report)
if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error(`reportHash gave ${hash}, not 64 hex digits`)

// The refusals travel too: a second detail table is refused with its code,
// and a report the validator refuses has no hash.
const twoTables: ReportDefinition = { ...report, regions: { ...report.regions, summary: [{ ...table, id: 'again' }] } }
const refused = validateReport(twoTables)
if (refused.valid || !refused.errors.some((error) => error.code === 'second-detail-table')) throw new Error('a second detail table was not refused')
let unhashed = false
try {
  reportHash(twoTables)
} catch (error) {
  unhashed = error instanceof RangeError
}
if (!unhashed) throw new Error('a refused report was given a hash')

// The blank report an author starts from is empty, and valid.
const blank = emptyReport('blank', 'Blank', 'en')
if (walkComponents(blank).length !== 0 || !validateReport(blank).valid) throw new Error('the blank report is not an empty, valid report')

console.log(`ok: ${REPORT_FORMAT} ${REPORT_SPEC_VERSION}; a form refused, a report read, validated and hashed (${hash.slice(0, 12)}...), a refused one not hashed`)
