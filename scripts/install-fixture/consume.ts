/*
 * A consumer that knows nothing about the workspace.
 *
 * Copied into a temporary npm project by install-test.mjs, installed from the
 * packed tarballs, type-checked with skipLibCheck OFF and run under Node. What
 * is on trial is that the published entry points resolve, with the types that
 * shipped.
 */
import { checkSpecVersion, emptyReport, QR_BILL_TOP, qrBillPageBreak, REPORT_FORMAT, REPORT_SPEC_VERSION, reportHash, validateReport, walkComponents } from '@formancy/report-spec'
import { EPC_CAPTION, EPC_MAX_BYTES, epcCaptionBreak, epcLeastVersion } from '@formancy/report-spec'
import type { EpcQrCodeComponent, ReportDefinition, ReportError, ReportValidation, SpecVersionCheck, SwissQrBill, TableComponent, TextComponent } from '@formancy/report-spec'
import { compileReport, diagnose, expressionValues, insertComponent, nextComponentId, openReportSession, validLocations } from '@formancy/report-core'
import type { CommandDescriptor, CommandOutcome, CompiledExpression, Diagnostic, ReportCompilation, ReportSession, SessionOpening } from '@formancy/report-core'
import { actionForKey, createReportEditor, editorText } from '@formancy/report-builder-core'
import type { EditorAction, EditorOutcome, EditorState, ReportEditor } from '@formancy/report-builder-core'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolveReport } from '@formancy/report-runtime'
import { QR_BILL_TOP as RUNTIME_QR_BILL_TOP, qrBillPageBreak as runtimeQrBillPageBreak } from '@formancy/report-runtime'
import { EPC_CAPTION as RUNTIME_EPC_CAPTION, EPC_MAX_BYTES as RUNTIME_EPC_MAX_BYTES, epcCaptionBreak as runtimeEpcCaptionBreak, epcLeastVersion as runtimeEpcLeastVersion } from '@formancy/report-runtime'
import type { EpcQrCode, QrBill, ReportData, Resolution } from '@formancy/report-runtime'
import { renderPdf, RenderRefusal } from '@formancy/report-render-pdf'
import { readReportData } from '@formancy/report-data-provider'
import type { DataBinding, ProviderRead } from '@formancy/report-data-provider'
import { createDataClient } from '@formancy/data-client'
import type { PublishedForm } from '@formancy/data-client'
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
// builders need DOM types and their framework, which this consumer has
// neither of: react.tsx and angular.ts are theirs.
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

// The quotation as a bill: a Swiss QR-bill for its total across the foot of
// its last page, its account and reference SIX's own examples. The slip
// prints in the Liberation Sans the renderer ships in its `fonts`
// directory, which the Node entry reads beside its own `dist`. Every test
// in the workspace reads those files from the source tree, so a tarball
// without them, or an entry that looked elsewhere, would render every other
// report and refuse a bill only in a host; here it fails.
const text = (value: string): [{ kind: 'text'; text: string }] => [{ kind: 'text', text: value }]
const header = (field: string): [{ kind: 'field'; field: { dataset: 'header'; field: string } }] => [{ kind: 'field', field: { dataset: 'header', field } }]
const bill: SwissQrBill = {
  kind: 'swissQrBill',
  language: 'de',
  account: text('CH44 3199 9123 0008 8901 2'),
  creditor: { name: text('Formancy Haustechnik AG'), street: text('Industriestrasse'), buildingNumber: text('7'), postalCode: text('3052'), town: text('Zollikofen'), country: text('CH') },
  currency: 'CHF',
  amount: { cel: 'totals.total' },
  debtor: { name: header('customer'), street: header('street'), postalCode: header('postcode'), town: header('city'), country: text('CH') },
  reference: text('21 00000 00003 13947 14300 09017'),
}
const billed: ReportDefinition = { ...quotation, paymentPart: bill }
const billedValidation: ReportValidation = validateReport(billed)
if (!billedValidation.valid) throw new Error(`the quotation with a bill was refused: ${billedValidation.errors.map((error: ReportError) => `${error.code} ${error.path}`).join(', ')}`)
const billedResolution: Resolution = resolveReport(billed, quotationData, { mode: 'final', creationDate: '2026-10-15T08:00:00Z' })
if (!billedResolution.ok) throw new Error(`the quotation with a bill did not resolve: ${billedResolution.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
const resolvedBill: QrBill | undefined = billedResolution.document.paymentPart
if (resolvedBill?.payload.split('\n')[3] !== 'CH4431999123000889012') throw new Error("the bill's code does not hold its account")
const billPdf = await renderPdf(billedResolution.document, { maxPages: 50 })
const faces = new TextDecoder('latin1').decode(billPdf).match(/\/BaseFont \/[A-Z]{6}\+LiberationSans(?:-Bold)?\b/g) ?? []
if (new Set(faces.map((face) => face.slice(face.indexOf('+') + 1))).size !== 2) throw new Error(`the bill did not print in both faces of Liberation Sans: ${faces.join(', ')}`)

// The slip's place and its page's rule reach the renderer through the
// runtime as report-spec's own, so that the editor and a render refuse a
// page by one rule: a top margin past the slip's top, in the same words. A
// runtime whose dist carried a copy of report-spec would hand on a second
// rule, which nothing in the workspace would see.
if (runtimeQrBillPageBreak !== qrBillPageBreak || RUNTIME_QR_BILL_TOP !== QR_BILL_TOP) throw new Error("the runtime does not hand on report-spec's own QR-bill page rule")
const crowded: ReportDefinition = { ...billed, page: { ...billed.page, margins: { ...billed.page.margins, top: QR_BILL_TOP + 1 } } }
const crowdedValidation: ReportValidation = validateReport(crowded)
const editorSays = crowdedValidation.valid ? undefined : crowdedValidation.errors.find((error: ReportError) => error.path === '/page/margins/top')?.message
const renderSays = await renderPdf({ ...billedResolution.document, page: crowded.page }, { maxPages: 50 }).then(
  () => undefined,
  (error: unknown) => (error instanceof RenderRefusal ? error.message : String(error)),
)
if (editorSays === undefined || editorSays !== renderSays) throw new Error(`a top margin in the slip was refused differently: ${String(editorSays)}; ${String(renderSays)}`)

// A euro invoice paid by a SEPA credit transfer: an EPC QR code for its
// total at the end of its summary, in Austria's frame with "Zahlen mit
// Code". The code asks for euro, and nothing ties the value its amount
// reads to euro (0025): it stands on a report whose lines are euros -- the
// install check's own, read as a German invoice's -- and never on the
// quotation, whose total in francs it would ask for as so many euros. Its
// payload is the EPC's elements in their order, its BIC making it version
// 001 and its amount written as short as it can be. The caption prints in
// the Liberation Sans of the package's `fonts`, which a host that prints
// codes and never a bill reaches only through a captioned code: a tarball
// or an entry that lost them would print every other report and refuse
// only that one.
const epcCode: EpcQrCodeComponent = {
  id: 'pay-code',
  kind: 'epcQrCode',
  size: 85.04,
  beneficiary: text('Formancy Haustechnik GmbH'),
  iban: text('DE83 0123 4567 0012 3456 78'),
  bic: text('FMNCDEF0XXX'),
  amount: { cel: 'totals.total' },
  reference: text('RF72 2026 0815'),
  caption: 'zahlenMitCode',
}
const paid: ReportDefinition = { ...report, id: 'euro-invoice', title: 'Rechnung', locale: 'de-DE', regions: { ...report.regions, summary: [epcCode] } }
const euroLines: ReportData = { detail: [{ amount: '951.63' }, { amount: '180.81' }], completeness: { complete: true, captured: 2 }, consistency: 'host-captured' }
const paidValidation: ReportValidation = validateReport(paid)
if (!paidValidation.valid) throw new Error(`the euro invoice with an EPC QR code was refused: ${paidValidation.errors.map((error: ReportError) => `${error.code} ${error.path}`).join(', ')}`)
const paidResolution: Resolution = resolveReport(paid, euroLines, { mode: 'final', creationDate: '2026-10-15T08:00:00Z' })
if (!paidResolution.ok) throw new Error(`the euro invoice with an EPC QR code did not resolve: ${paidResolution.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
const resolvedCode = paidResolution.document.body.find((block): block is EpcQrCode => block.kind === 'epcQrCode')
const payload = ['BCD', '001', '1', 'SCT', 'FMNCDEF0XXX', 'Formancy Haustechnik GmbH', 'DE83012345670012345678', 'EUR1132.44', '', 'RF7220260815'].join('\n')
if (resolvedCode?.payload !== payload || resolvedCode.caption !== 'zahlenMitCode') throw new Error(`the EPC QR code does not hold the euro invoice's payment: ${JSON.stringify(resolvedCode?.payload)}`)
const paidPdf = await renderPdf(paidResolution.document, { maxPages: 50 })
if (!/\/BaseFont \/[A-Z]{6}\+LiberationSans\b/.test(new TextDecoder('latin1').decode(paidPdf))) throw new Error("the EPC QR code's caption did not print in the package's Liberation Sans")

// The EPC's print rules reach the renderer through the runtime as
// report-spec's own, as the QR-bill's do: a captioned square too small for
// any version is refused by the validator and by the renderer in the same
// words. A runtime whose dist carried a copy would hand on a second rule.
if (runtimeEpcCaptionBreak !== epcCaptionBreak || runtimeEpcLeastVersion !== epcLeastVersion || RUNTIME_EPC_CAPTION !== EPC_CAPTION || RUNTIME_EPC_MAX_BYTES !== EPC_MAX_BYTES) {
  throw new Error("the runtime does not hand on report-spec's own EPC QR code print rules")
}
const cramped: ReportDefinition = { ...paid, regions: { ...paid.regions, summary: [{ ...epcCode, size: 68.05 }] } }
const crampedValidation: ReportValidation = validateReport(cramped)
const specSays = crampedValidation.valid ? undefined : crampedValidation.errors.find((error: ReportError) => error.path.endsWith('/size'))?.message
const drawerSays = await renderPdf({ ...paidResolution.document, body: paidResolution.document.body.map((block) => (block.kind === 'epcQrCode' ? { ...block, size: 68.05 } : block)) }, { maxPages: 50 }).then(
  () => undefined,
  (error: unknown) => (error instanceof RenderRefusal ? error.message : String(error)),
)
if (specSays === undefined || drawerSays?.endsWith(specSays) !== true) throw new Error(`a captioned square too small was refused differently: ${String(specSays)}; ${String(drawerSays)}`)

// The Data provider, from its tarball, with @formancy/data-client at the
// exact release it pins, from the registry: the quotation read from a data
// server answering Formancy Data 0.1.0's routes -- its header as one
// record, its lines as that record's children, every value as Data spells
// it -- must be the quotation's own data, and render. The client checks
// every reply's shape, so a reply Data would not send fails here. The
// packages/report-data-provider README's example is these lines
// (scripts/readme-example.test.mjs).
const { header: quotationHeader = {}, detail: quotationLines = [] } = quotationData
const dataServer = 'https://data.invalid'
const quotationToken = 'q-1'
const formOf = (id: string, keys: readonly string[]): PublishedForm => ({
  form: { specVersion: '3', id, title: id, model: { fields: keys.map((key) => (key === 'quotation' ? { key, type: 'select', label: key, optionsSource: 'quotations' } : { key, type: 'text', label: key })) } },
  operations: ['read'],
  readable: [...keys],
  list: { searchable: [], sortable: [...keys] },
  deleting: null,
})
const lineKeys = ['quotation', ...Object.keys(quotationLines[0] ?? {})]
const dataRoutes: Readonly<Record<string, unknown>> = {
  'GET /v1/forms': { forms: [{ id: 'quotation', title: 'Quotations', operations: ['read'], children: [{ form: 'quotation-line', field: 'quotation' }] }] },
  'GET /v1/forms/quotation': formOf('quotation', Object.keys(quotationHeader)),
  'GET /v1/forms/quotation-line': formOf('quotation-line', lineKeys),
  'POST /v1/forms/quotation/records/read': { record: quotationToken, version: '1', answers: quotationHeader },
  'POST /v1/forms/quotation-line/records/list': { rows: quotationLines.map((line, index) => ({ record: `l-${String(index)}`, version: '1', answers: { quotation: quotationToken, ...line } })), hasMore: false },
}
Object.assign(globalThis, {
  fetch: (input: string, init: RequestInit): Promise<Response> => {
    const route = `${init.method ?? 'GET'} ${input.slice(dataServer.length)}`
    const body = Object.hasOwn(dataRoutes, route) ? dataRoutes[route] : { code: 'not-found', message: 'No such route.' }
    return Promise.resolve(new Response(JSON.stringify(body), { status: Object.hasOwn(dataRoutes, route) ? 200 : 404, headers: { 'content-type': 'application/json' } }))
  },
})
const fromData = await (async () => {
  // The host's own sign-in, whose token Data's policy reads on every request.
  const session = { token: (): string => 'install-check' }
  const client = createDataClient({ token: () => session.token(), base: dataServer })
  const binding: DataBinding = { header: { form: 'quotation', record: quotationToken }, detail: { form: 'quotation-line', parent: 'header' } }
  const provided: ProviderRead = await readReportData(client, quotation, binding, { cap: 5000 })
  if (!provided.ok) throw new Error(provided.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
  const resolution = resolveReport(quotation, provided.data, { mode: 'final', creationDate: '2026-10-16T08:00:00Z' })
  if (!resolution.ok) throw new Error(resolution.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
  if (JSON.stringify([provided.data.header, provided.data.detail]) !== JSON.stringify([quotationHeader, quotationLines]) || resolution.manifest.consistency !== 'best-effort') {
    throw new Error("the quotation read from Data is not the quotation's own data, read best-effort")
  }
  return renderPdf(resolution.document, { maxPages: 50 })
})()
if (new TextDecoder().decode(fromData.subarray(0, 5)) !== '%PDF-') throw new Error('the quotation read from Data did not render to a PDF')

console.log(
  `ok: ${REPORT_FORMAT} ${REPORT_SPEC_VERSION}; a form refused, a report read, validated and hashed (${hash.slice(0, 12)}...), a refused one not hashed; a session on a blank report inserted a text, refused an edit atomically, took a proposal from JSON, diagnosed its clock, refused a malformed one and undid back to its first snapshot; a page counter was offered the page regions only; a decimal total compiled and bound as a decimal; an editor inserted a text in the report's language as one change, labelled it in the session and in French, undid it by its key and let go of its listeners; the editor stylesheet resolved; the quotation resolved and rendered to a ${rendered.length}-byte PDF, and a name its font cannot draw was refused; with a Swiss QR-bill it validated, resolved and rendered to a ${billPdf.length}-byte PDF whose slip is in the package's Liberation Sans, and a top margin past its slip was refused in the same words by the validator and the renderer, through the runtime's hand-on of report-spec's rule; with an EPC QR code in Austria's frame it validated, resolved to the EPC's payload and rendered to a ${paidPdf.length}-byte PDF whose caption is in the package's Liberation Sans, and a captioned square too small was refused in the same words by the validator and the renderer; the Data provider read the quotation from Data 0.1.0's routes through @formancy/data-client as the quotation's own data, best-effort, and it rendered to a ${fromData.length}-byte PDF`,
)
