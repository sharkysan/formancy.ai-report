/*
 * A consumer that knows nothing about the workspace.
 *
 * Copied into a temporary npm project by install-test.mjs, installed from the
 * packed tarballs, type-checked with skipLibCheck OFF and run under Node. What
 * is on trial is that the published entry points resolve, with the types that
 * shipped.
 */
import { checkSpecVersion, emptyReport, REPORT_FORMAT, REPORT_SPEC_VERSION, reportHash, validateReport, walkComponents } from '@formancy/report-spec'
import type { ReportDefinition, ReportError, ReportValidation, SpecVersionCheck, TableComponent, TextComponent } from '@formancy/report-spec'
import { compileReport, diagnose, expressionValues, insertComponent, nextComponentId, openReportSession, validLocations } from '@formancy/report-core'
import type { CommandDescriptor, CommandOutcome, CompiledExpression, Diagnostic, ReportCompilation, ReportSession, SessionOpening } from '@formancy/report-core'

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

// The editing core, as a host opens it: on the blank report an author
// starts from. Its code and declarations ship with report-spec's and
// @formancy/expressions' as dependencies, so a session, an atomic refusal,
// undo, a diagnostic and the compilation the runtime evaluates all run here,
// outside the workspace.
const opening: SessionOpening = openReportSession(emptyReport('site-visit', 'Site visit', 'de-CH'))
if (!opening.ok) throw new Error(`the blank report did not open a session: ${opening.errors.map((error) => error.code).join(', ')}`)
const session: ReportSession = opening.session
const first = session.document()
const note: TextComponent = { id: nextComponentId(first, 'text'), kind: 'text', content: [{ kind: 'text', text: 'Findings' }] }
const inserted: CommandOutcome = session.apply((draft) => insertComponent(draft, { region: 'body', index: 0 }, note), { label: 'Insert text' })
if (!inserted.ok || session.revision() !== 1 || session.undoLabel() !== 'Insert text') throw new Error('a text was not inserted as one undo step')
const withNote = session.document()

// A refused edit changes nothing: not the document object, not the revision.
const outside: CommandOutcome = session.apply((draft) => insertComponent(draft, { region: 'body', index: 9 }, { ...note, id: 'late' }))
if (outside.ok || outside.code !== 'index-out-of-range' || session.document() !== withNote || session.revision() !== 1) throw new Error('a refused edit changed the session')

// An operation as a proposal carries it, read back from JSON: the text now
// prints the clock, which a report may not, and the diagnostic says so where
// it is. One whose arguments are not what its command takes is refused, not
// thrown.
const proposal = JSON.parse(JSON.stringify({ command: 'updateComponent', args: [note.id, 'text', { content: [{ kind: 'expression', expression: { cel: 'string(now())' } }] }] })) as CommandDescriptor
const proposed: CommandOutcome = session.apply(proposal)
const diagnostics: Diagnostic[] = diagnose(session.document())
const [clock] = diagnostics
if (!proposed.ok || diagnostics.length !== 1 || clock?.code !== 'expression-not-reproducible' || clock.componentId !== note.id) {
  throw new Error(`the clock was not diagnosed on the text: ${diagnostics.map((diagnostic) => diagnostic.code).join(', ')}`)
}
const junk: CommandOutcome = session.apply(JSON.parse('{"command":"setPage","args":[null]}') as CommandDescriptor)
if (junk.ok || junk.code !== 'invalid-arguments') throw new Error('a descriptor with an argument of the wrong type was not refused')
if (!session.undo() || !session.undo() || session.document() !== first) throw new Error('undo did not restore the opened snapshot')

// A page counter may stand only in the page header and footer; the places
// offered are the validator's.
const counter: TextComponent = { id: 'counter', kind: 'text', content: [{ kind: 'pageNumber' }] }
const regions = new Set(validLocations(first, counter).map((location) => location.region))
if ([...regions].sort().join() !== 'pageFooter,pageHeader') throw new Error(`a page counter was offered ${[...regions].join(', ')}`)

// The compilation the runtime evaluates: a decimal total read as a decimal,
// and the value bound as one from the exact string the data holds.
const priced: ReportDefinition = { ...report, regions: { ...report.regions, summary: [{ id: 'doubled', kind: 'text', content: [{ kind: 'expression', expression: { cel: 'string(totals.total * dec("2"))' } }] }] } }
const compilation: ReportCompilation = compileReport(priced)
const compiled: CompiledExpression | undefined = compilation.expressions.get('/regions/summary/0/content/0/expression/cel')
const bound = compiled === undefined ? undefined : expressionValues(compiled, { totals: { total: '12.50' } })
if (compilation.diagnostics.length !== 0 || compiled?.reads[0]?.type !== 'decimal' || typeof bound?.totals_total !== 'object') throw new Error('a decimal total was not compiled and bound as a decimal')

console.log(
  `ok: ${REPORT_FORMAT} ${REPORT_SPEC_VERSION}; a form refused, a report read, validated and hashed (${hash.slice(0, 12)}...), a refused one not hashed; a session on a blank report inserted a text, refused an edit atomically, took a proposal from JSON, diagnosed its clock, refused a malformed one and undid back to its first snapshot; a page counter was offered the page regions only; a decimal total compiled and bound as a decimal`,
)
