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
import { actionForKey, createReportEditor, editorText } from '@formancy/report-builder-core'
import type { EditorAction, EditorOutcome, EditorState, ReportEditor } from '@formancy/report-builder-core'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolveReport } from '@formancy/report-runtime'
import type { Resolution } from '@formancy/report-runtime'
import { renderPdf, RenderRefusal } from '@formancy/report-render-pdf'
import { quotation, quotationData } from './quotation.js'

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

// The editor model both builders render, as a host drives it, under Node
// with no DOM and no framework: report-builder-core ships with report-core
// and report-spec as dependencies, and its state, its actions, its key map
// and its words all run here, outside the workspace. The React and Angular
// builders need a DOM and their framework, which this consumer has neither of.
const editing: SessionOpening = openReportSession(emptyReport('editor-check', 'Prüfbericht', 'de-CH'))
if (!editing.ok) throw new Error('the blank report did not open a session for the editor')
const blankDocument = editing.session.document()
const editor: ReportEditor = createReportEditor(editing.session, { locale: 'fr-CH' })
let told = 0
const unsubscribe = editor.subscribe(() => {
  told += 1
})
const before: EditorState = editor.state()
if (editor.state() !== before || !Object.isFrozen(before)) throw new Error('the editor state is not one frozen object until something changes')
const insertion: EditorOutcome = editor.dispatch({ type: 'insert', kind: 'text', target: { region: 'body', index: 0 } })
const [added] = editing.session.document().regions.body
const words = added?.kind === 'text' ? added.content[0] : undefined
// One notification for the insert and the selection it makes; a new text in
// the report's language, which prints, though the editor speaks French.
if (!insertion.ok || told !== 1 || editor.state().selection?.id !== added?.id || words?.kind !== 'text' || words.text !== 'Neuer Text') {
  throw new Error(`the editor did not insert a text as one change: ${JSON.stringify(added)}`)
}
// The session keeps a sentence any consumer can show; the editor says it in its own language.
const french = editorText('fr-CH')
if (editing.session.undoLabel() !== 'Insert Text' || editor.state().history.undoLabel !== french('history.insert', { kind: french('kind.text') })) {
  throw new Error(`the step was labelled ${String(editing.session.undoLabel())} in the session and ${String(editor.state().history.undoLabel)} by the editor`)
}
const undo: EditorAction | undefined = actionForKey({ key: 'z', ctrlKey: true }, 'outline')
if (undo === undefined || !editor.dispatch(undo).ok || editing.session.document() !== blankDocument || editor.state().selection !== null) {
  throw new Error('Ctrl+Z did not undo the insert back to the first snapshot')
}
unsubscribe()
editor.dispose()
if (editor.listenerCount() !== 0 || editor.dispatch({ type: 'redo' }).ok) throw new Error('a disposed editor kept its listeners or acted')
// The stylesheet subpath the exports map promises resolves to the file, and it is the workbench's dressing.
const stylesheet = readFileSync(fileURLToPath(import.meta.resolve('@formancy/report-builder-core/report-builder.css')), 'utf8')
if (!stylesheet.includes("[data-report-part='canvas']") || !stylesheet.includes('var(--wb-')) throw new Error('report-builder.css is not the editor stylesheet')

// The README's "Render a report", line for line, on the quotation starter:
// the runtime resolves it from its data, the renderer draws it, and what
// comes back is a PDF. scripts/readme-example.test.mjs holds the README's
// lines to these.
const rendered = await (async () => {
  const report = quotation
  const data = quotationData
  const resolution = resolveReport(report, data, { mode: 'final', parameters: {}, creationDate: '2026-10-15T08:00:00Z' })
  if (!resolution.ok) throw new Error(resolution.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
  const pdf: Uint8Array = await renderPdf(resolution.document, { maxPages: 50 })
  return pdf
})()
if (new TextDecoder().decode(rendered.subarray(0, 5)) !== '%PDF-') throw new Error('the quotation did not render to a PDF')

// A refusal travels as the class a host catches, from the runtime's
// declaration through the renderer's re-export: a customer's name in a
// script the embedded font cannot draw is refused, never printed as boxes.
const unprintable: Resolution = resolveReport(quotation, { ...quotationData, header: { ...quotationData.header, customer: '山田太郎' } }, { mode: 'final', creationDate: '2026-10-15T08:00:00Z' })
if (!unprintable.ok) throw new Error(`the quotation with a Japanese customer was refused before rendering: ${unprintable.errors.map((error) => error.code).join(', ')}`)
const refusal: unknown = await renderPdf(unprintable.document, { maxPages: 50 }).then(
  () => undefined,
  (error: unknown) => error,
)
if (!(refusal instanceof RenderRefusal) || refusal.code !== 'unsupported') throw new Error(`a character without a glyph was not refused as unsupported: ${String(refusal)}`)

console.log(
  `ok: ${REPORT_FORMAT} ${REPORT_SPEC_VERSION}; a form refused, a report read, validated and hashed (${hash.slice(0, 12)}...), a refused one not hashed; a session on a blank report inserted a text, refused an edit atomically, took a proposal from JSON, diagnosed its clock, refused a malformed one and undid back to its first snapshot; a page counter was offered the page regions only; a decimal total compiled and bound as a decimal; an editor inserted a text in the report's language as one change, labelled it in the session and in French, undid it by its key and let go of its listeners; the editor stylesheet resolved; the quotation resolved and rendered to a ${rendered.length}-byte PDF, and a name its font cannot draw was refused`,
)
