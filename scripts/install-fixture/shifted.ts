/*
 * A run set below or above the line (0061), from the packed packages under
 * Node. consume.ts runs it and prints what it returns; it lives apart
 * because consume.ts stands near its size budget.
 *
 * - the runtime hands on report-spec's own names for a shift, not a copy,
 *   and states the size and the move an engine draws such a run at;
 * - a report whose paragraph sets one resolves to a document whose runs
 *   carry it, and none on a run that sets none;
 * - the packed renderer draws it to a PDF, and refuses a word of nothing
 *   but such runs, naming the paragraph, as it would be drawn into the
 *   line before.
 */
import { BASELINE_SHIFTS } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { BASELINE_SHIFTS as RUNTIME_BASELINE_SHIFTS, resolveReport, SHIFTED_RISE, SHIFTED_SIZE } from '@formancy/report-runtime'
import type { BaselineShift, ReportData } from '@formancy/report-runtime'
import { renderPdf, RenderRefusal } from '@formancy/report-render-pdf'

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
  return `a formula's digit set below the line and a unit's power above it resolved with their baselines and rendered to a ${pdf.length}-byte PDF, at the runtime's ${SHIFTED_SIZE} of the paragraph's size, and a word of nothing but such a run was refused, naming its paragraph`
}
