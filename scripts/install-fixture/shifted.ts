/*
 * A run set below or above the line (0061), from the packed packages under
 * Node. consume.ts runs it and prints what it returns; it lives apart
 * because consume.ts stands near its size budget.
 *
 * - the published types and validator take one on a paragraph's run, and
 *   refuse one on a table's cell, which prints one string at one size,
 *   where it is written;
 * - the runtime hands on report-spec's own names for a shift, not a copy,
 *   and states the size and the move an engine draws such a run at;
 * - a report whose paragraph sets one resolves to a document whose runs
 *   carry it, and none on a run that sets none;
 * - the packed renderer draws it to a PDF, and refuses a word of nothing
 *   but such runs, naming the paragraph, as it would be drawn into the
 *   line before;
 * - the packed editor sets the characters a builder says were selected in
 *   a run's field below the line, in one step, its outcome saying where the
 *   keyboard goes, and the run's button pressed, its public types naming
 *   what a builder sends and is told.
 */
import { createReportEditor } from '@formancy/report-builder-core'
import type { FieldSelection, GroupFocus } from '@formancy/report-builder-core'
import { openReportSession } from '@formancy/report-core'
import { BASELINE_SHIFTS, validateReport } from '@formancy/report-spec'
import type { ReportDefinition, TableComponent, TextComponent } from '@formancy/report-spec'
import { BASELINE_SHIFTS as RUNTIME_BASELINE_SHIFTS, resolveReport, SHIFTED_RISE, SHIFTED_SIZE } from '@formancy/report-runtime'
import type { BaselineShift, ReportData } from '@formancy/report-runtime'
import { renderPdf, RenderRefusal } from '@formancy/report-render-pdf'

/** Checks a run set off the line against consume.ts's `report`, whose `table` is its body, through the packed validator; throws on the first wrong, and says what held. */
export function shiftedValidated(report: ReportDefinition, table: TableComponent): string {
  const formula: TextComponent = {
    id: 'formula',
    kind: 'text',
    content: [
      { kind: 'text', text: 'H' },
      { kind: 'text', text: '2', baseline: 'subscript' },
      { kind: 'text', text: 'O' },
    ],
  }
  if (BASELINE_SHIFTS.join() !== 'subscript,superscript') throw new Error(`the published baselines are ${BASELINE_SHIFTS.join(', ')}`)
  const lowered = validateReport({ ...report, regions: { ...report.regions, summary: [formula] } })
  if (!lowered.valid) throw new Error(`a paragraph's run set below the line was refused: ${lowered.errors.map((error) => error.code).join(', ')}`)
  const shiftedCell: TableComponent = {
    ...table,
    columns: table.columns.map((column) => ({ ...column, value: { kind: 'field', field: { dataset: 'detail', field: 'amount' }, baseline: 'superscript' } })),
  }
  const misplaced = validateReport({ ...report, regions: { ...report.regions, body: [shiftedCell] } })
  if (misplaced.valid || !misplaced.errors.some((error) => error.code === 'misplaced-baseline'))
    throw new Error("a table's cell set above the line was not refused")
  return "a paragraph's run set below the line read and a table's cell set above it refused"
}

/** Checks a run set off the line through the packed packages; throws on the first wrong, and says what held. */
export async function shiftedRendered(): Promise<string> {
  if (RUNTIME_BASELINE_SHIFTS !== BASELINE_SHIFTS) throw new Error("the runtime's baselines are not report-spec's own")
  const rise: Readonly<Record<BaselineShift, number>> = SHIFTED_RISE
  if (SHIFTED_SIZE !== 0.58 || rise.superscript !== 0.75 * SHIFTED_SIZE || rise.subscript !== -0.35 * SHIFTED_SIZE)
    throw new Error(`the runtime states a run set off the line at ${SHIFTED_SIZE}, moved ${rise.superscript} up and ${rise.subscript} down`)
  const report: ReportDefinition = {
    reportSpecVersion: '0',
    id: 'formula',
    title: 'Formula',
    locale: 'en',
    page: { size: 'A4', orientation: 'portrait', margins: { top: 40, right: 40, bottom: 40, left: 40 } },
    styles: [],
    datasets: {},
    parameters: [],
    assets: [],
    aggregates: [],
    regions: {
      reportHeader: [
        {
          id: 'formula',
          kind: 'text',
          content: [
            { kind: 'text', text: 'H' },
            { kind: 'text', text: '2', baseline: 'subscript' },
            { kind: 'text', text: 'O in 1 m' },
            { kind: 'text', text: '3', baseline: 'superscript' },
          ],
        },
      ],
      pageHeader: [],
      body: [],
      pageFooter: [],
      summary: [],
    },
  }
  const data: ReportData = { completeness: { complete: true, captured: 0 }, consistency: 'host-captured' }
  const resolution = resolveReport(report, data, { mode: 'final', parameters: {}, creationDate: '2026-10-15T08:00:00Z' })
  if (!resolution.ok) throw new Error(`the formula was refused: ${resolution.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
  const runs = JSON.stringify(resolution.document.body.map((block) => (block.kind === 'paragraph' ? block.runs : block.kind)))
  if (runs !== JSON.stringify([[{ text: 'H' }, { text: '2', baseline: 'subscript' }, { text: 'O in 1 m' }, { text: '3', baseline: 'superscript' }]]))
    throw new Error(`the formula resolved to ${runs}`)
  const pdf = await renderPdf(resolution.document, { maxPages: 5 })
  if (new TextDecoder().decode(pdf.subarray(0, 5)) !== '%PDF-') throw new Error('the formula did not render to a PDF')
  const alone = await renderPdf({ ...resolution.document, body: [{ kind: 'paragraph', runs: [{ text: '2', baseline: 'subscript' }] }] }, { maxPages: 5 }).then(
    () => undefined,
    (error: unknown) => error,
  )
  if (!(alone instanceof RenderRefusal) || alone.code !== 'unsupported' || alone.subject !== 'body[0]')
    throw new Error(`a word of nothing but a run set below the line was not refused, naming its paragraph: ${String(alone)}`)
  // The packed editor: the digit of H2O, selected in its field, set below the line as a builder sends it.
  const opening = openReportSession({
    ...report,
    regions: { ...report.regions, reportHeader: [{ id: 'water', kind: 'text', content: [{ kind: 'text', text: 'H2O' }] }] },
  })
  if (!opening.ok) throw new Error('the formula did not open a session')
  const editor = createReportEditor(opening.session)
  const selected: FieldSelection = { start: 1, end: 2, text: 'H2O' }
  const pressed = editor.dispatch({ type: 'select', id: 'water' }).ok
    ? editor.dispatch({ type: 'setBaseline', key: '/content/0', baseline: 'subscript', selected })
    : undefined
  const then: GroupFocus | undefined = pressed?.ok === true ? pressed.then : undefined
  const on = editor
    .state()
    .properties.rows.flatMap((row) => ('group' in row ? row.group.actions : []))
    .filter((action) => action.pressed === true)
    .map((action) => action.label)
  const written = JSON.stringify(opening.session.document().regions.reportHeader[0])
  editor.dispose()
  if (
    then?.group !== '/content/1' ||
    then.button !== 0 ||
    JSON.stringify(on) !== JSON.stringify(['Part 2: Text, subscript']) ||
    opening.session.undoLabel() !== 'Set below the line'
  )
    throw new Error(`the editor did not set the selected digit below the line in one step: ${written}, the keyboard sent to ${JSON.stringify(then)}`)
  return `a formula's digit set below the line and a unit's power above it resolved with their baselines and rendered to a ${pdf.length}-byte PDF, the runtime stating ${SHIFTED_SIZE} of the paragraph's size for such a run, and a word of nothing but such a run was refused, naming its paragraph; the editor set a digit selected in its field below the line in one step, its button pressed and the keyboard sent to it`
}
