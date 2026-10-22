/*
 * The form bridge (0042), from the packed @formancy/report-forms under
 * Node: a formancy form version validated by the @formancy/spec it pins, a
 * submission of it read against that version and rendered, its labels
 * from that version's catalogue in the report's language, and its manifest
 * naming the submission and the version by the hash the bridge computed;
 * two submissions read by readSubmissions, one a row, the manifest naming
 * both; a report generated from the version (0045), naming it, with its
 * notes, the submission read into it and rendered; then a version that
 * moved a field the report reads, and a hash the host gives that is not
 * the form's, each refused; and a version that renamed a group the draft
 * reads (0048), reviewed by the packed bridge against the version the
 * draft was made from, its declared rename offered first and applied
 * through a report-core session against the hash it was computed for, the
 * version's visit then read, and the same resolution refused as stale.
 * consume.ts runs it and prints what it returns.
 * It lives apart because it changes when the bridge does, and the rest of
 * consume.ts does not. The packages/report-forms README's examples are
 * these lines (scripts/readme-example.test.mjs).
 */
import { readSubmission, readSubmissions } from '@formancy/report-forms'
import type { FormsError, SubmissionRead } from '@formancy/report-forms'
import { generateReport } from '@formancy/report-forms'
import type { Generated } from '@formancy/report-forms'
import { reviewFormVersion } from '@formancy/report-forms'
import type { FormReview } from '@formancy/report-forms'
import { openReportSession } from '@formancy/report-core'
import { renderPdf } from '@formancy/report-render-pdf'
import { resolveReport } from '@formancy/report-runtime'
import type { ReportDefinition } from '@formancy/report-spec'
import { schemaHash } from '@formancy/spec'
import { validateSchema } from '@formancy/spec/validate'

const text = (value: string): { kind: 'text'; text: string } => ({ kind: 'text', text: value })

/** Reads, renders and refuses a submission from the packed bridge; throws on the first wrong, and says what held. */
export async function formsRead(): Promise<string> {
  // A site visit at spec 3, as a host keeps the version a submission
  // answered: its outcome a radio whose labels are messages in English and
  // Swiss German, its inspector a group, its findings a repeater whose
  // hours are a number.
  const visitForm = {
    specVersion: '3',
    id: 'site-visit',
    title: 'Site visit',
    i18n: { defaultLocale: 'en', messages: { en: { pass: 'Passed', repair: 'Repairs needed' }, 'de-CH': { pass: 'Bestanden', repair: 'Reparaturen nötig' } } },
    model: {
      fields: [
        { key: 'site', type: 'text', label: 'Site' },
        { key: 'outcome', type: 'radio', label: 'Outcome', options: [{ value: 'pass', label: { $t: 'pass' } }, { value: 'repair', label: { $t: 'repair' } }] },
        { key: 'inspector', type: 'group', label: 'Inspector', fields: [{ key: 'name', type: 'text', label: 'Name' }] },
        { key: 'findings', type: 'repeater', label: 'Findings', fields: [{ key: 'area', type: 'text', label: 'Area' }, { key: 'hours', type: 'number', label: 'Hours', min: 0 }] },
      ],
    },
  }
  const validation = validateSchema(visitForm)
  if (!validation.valid) throw new Error(`the site visit form was refused by formancy's validator: ${validation.errors.map((error) => error.code).join(', ')}`)
  const visitReport: ReportDefinition = {
    reportSpecVersion: '0',
    id: 'site-visit',
    title: 'Begehung',
    locale: 'de-CH',
    page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 } },
    styles: [],
    datasets: {
      header: {
        id: 'visit',
        form: { kind: 'submission' },
        fields: [
          { id: 'site', type: 'string', label: 'Objekt', nullable: false, form: { path: 'site' } },
          { id: 'outcome', type: 'string', label: 'Ergebnis', nullable: true, form: { path: 'outcome' } },
          { id: 'inspector', type: 'string', label: 'Inspektor', nullable: true, form: { path: 'inspector.name' } },
        ],
      },
      detail: {
        id: 'findings',
        form: { kind: 'repeater', repeater: 'findings' },
        fields: [
          { id: 'area', type: 'string', label: 'Bereich', nullable: true, form: { path: 'area' } },
          { id: 'hours', type: 'decimal', label: 'Stunden', nullable: true, scale: 2, form: { path: 'hours' } },
        ],
      },
    },
    parameters: [],
    assets: [],
    aggregates: [],
    regions: {
      reportHeader: [
        { id: 'site', kind: 'text', content: [text('Objekt: '), { kind: 'field', field: { dataset: 'header', field: 'site' } }] },
        { id: 'outcome', kind: 'text', content: [text('Ergebnis: '), { kind: 'field', field: { dataset: 'header', field: 'outcome' } }, text(', '), { kind: 'field', field: { dataset: 'header', field: 'inspector' } }] },
      ],
      pageHeader: [],
      body: [
        {
          id: 'findings',
          kind: 'table',
          dataset: 'detail',
          columns: [
            { id: 'area', header: 'Bereich', width: 'fill', align: 'left', value: { kind: 'field', field: { dataset: 'detail', field: 'area' } } },
            { id: 'hours', header: 'Stunden', width: 80, align: 'right', value: { kind: 'field', field: { dataset: 'detail', field: 'hours' }, format: { kind: 'number', scale: 2, grouping: false } } },
          ],
          emptyText: 'Keine Befunde.',
          repeatHeader: true,
        },
      ],
      pageFooter: [],
      summary: [],
    },
  }
  const visitData = { site: 'Hauptstrasse 12, 3011 Bern', outcome: 'repair', inspector: { name: 'Anna Schär' }, findings: [{ _id: 'r1', area: 'Dachrinne Nord', hours: 1.25 }, { _id: 'r2', area: 'Heizraum', hours: 0.5 }] }
  const visitId = 'b682a5ed-ed01-4f8c-8d80-cf53db4e8380'
  // A report of many visits, one a row, and the visits the host lists, each with the hash of the version that collected it.
  const visitsReport: ReportDefinition = {
    ...visitReport,
    id: 'site-visits',
    datasets: {
      detail: {
        id: 'visits',
        form: { kind: 'submissions' },
        fields: [
          { id: 'site', type: 'string', label: 'Objekt', nullable: false, form: { path: 'site' } },
          { id: 'outcome', type: 'string', label: 'Ergebnis', nullable: true, form: { path: 'outcome' } },
        ],
      },
    },
    regions: { reportHeader: [], pageHeader: [], body: [], pageFooter: [], summary: [] },
  }
  const visitSubmissions = [
    { id: visitId, formHash: schemaHash(visitForm), data: visitData },
    { id: '8861b39c-51df-4cc0-b71e-63a6d3f16b1b', formHash: schemaHash(visitForm), data: { site: 'Bahnhofplatz 1, 3011 Bern', outcome: 'pass' } },
  ]

  const visit: SubmissionRead = readSubmission(visitReport, { form: visitForm, formHash: schemaHash(visitForm), submission: { id: visitId, data: visitData } })
  if (!visit.ok) throw new Error(visit.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
  const visitPrint = resolveReport(visitReport, visit.data, { mode: 'final', creationDate: '2026-10-22T08:00:00Z' })

  if (!visitPrint.ok) throw new Error(`the site visit read from its submission did not resolve: ${visitPrint.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
  const header = visit.data.header ?? {}
  if (header['outcome'] !== 'Reparaturen nötig' || header['inspector'] !== 'Anna Schär' || JSON.stringify(visit.data.detail) !== JSON.stringify([{ area: 'Dachrinne Nord', hours: '1.25' }, { area: 'Heizraum', hours: '0.5' }])) {
    throw new Error(`the site visit was not read as its version holds it: ${JSON.stringify([header, visit.data.detail])}`)
  }
  const named = visitPrint.manifest.source
  if (named?.provider !== 'formancy-form' || JSON.stringify(named.submissions) !== JSON.stringify([{ id: visitId, form: 'site-visit', formHash: schemaHash(visitForm) }]) || visitPrint.manifest.consistency !== 'host-captured') {
    throw new Error(`the site visit's manifest does not name its submission and version, host-captured: ${JSON.stringify(named)}`)
  }
  const pdf = await renderPdf(visitPrint.document, { maxPages: 5 })
  if (new TextDecoder().decode(pdf.subarray(0, 5)) !== '%PDF-') throw new Error('the site visit read from its submission did not render to a PDF')

  const visits: SubmissionRead = readSubmissions(visitsReport, { forms: [visitForm], submissions: visitSubmissions, complete: true })
  if (!visits.ok) throw new Error(`the site visits were refused: ${visits.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
  const visitsPrint = resolveReport(visitsReport, visits.data, { mode: 'final', creationDate: '2026-10-22T08:00:00Z' })
  if (!visitsPrint.ok) throw new Error(`the site visits read one a row did not resolve: ${visitsPrint.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
  const rows = JSON.stringify(visits.data.detail)
  const listed = JSON.stringify(visitsPrint.manifest.source?.provider === 'formancy-form' ? visitsPrint.manifest.source.submissions.map((submission) => submission.id) : [])
  if (rows !== JSON.stringify([{ site: 'Hauptstrasse 12, 3011 Bern', outcome: 'Reparaturen nötig' }, { site: 'Bahnhofplatz 1, 3011 Bern', outcome: 'Bestanden' }]) || listed !== JSON.stringify(visitSubmissions.map((submission) => submission.id))) {
    throw new Error(`the site visits were not read one a row, each named in the manifest: ${rows} ${listed}`)
  }

  // A report generated from the same version (0045): a first draft that
  // names the version it was made from, lists what it assumed -- the hours,
  // a number with no step, printed as their digits -- and reads the visit,
  // a submission of that version, which renders.
  const draft: Generated = generateReport(visitForm, { id: 'site-visit-draft', locale: 'de-CH', detail: { kind: 'repeater', repeater: 'findings' } })
  if (!draft.ok) throw new Error(draft.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
  const assumed = draft.notes.map((note) => `${note.code} at ${note.path}`)
  const draftVisit = readSubmission(draft.report, { form: visitForm, submission: { id: visitId, data: visitData } })
  if (!draftVisit.ok) throw new Error(draftVisit.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
  const draftPrint = resolveReport(draft.report, draftVisit.data, { mode: 'final', creationDate: '2026-10-22T08:00:00Z' })
  if (!draftPrint.ok) throw new Error(`the visit read into the generated draft did not resolve: ${draftPrint.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
  if (JSON.stringify(draft.report.provenance) !== JSON.stringify({ kind: 'form', form: 'site-visit', formHash: schemaHash(visitForm) }) || JSON.stringify(assumed) !== JSON.stringify(['number-decimal at /form/model/fields/3/fields/1'])) {
    throw new Error(`the generated draft does not name its version, or lists other assumptions: ${JSON.stringify([draft.report.provenance, assumed])}`)
  }
  if (JSON.stringify(draftVisit.data.header) !== JSON.stringify({ site: 'Hauptstrasse 12, 3011 Bern', outcome: 'Reparaturen nötig', name: 'Anna Schär' }) || JSON.stringify(draftVisit.data.detail) !== JSON.stringify(visit.data.detail)) {
    throw new Error(`the visit was not read into the generated draft as its version holds it: ${JSON.stringify([draftVisit.data.header, draftVisit.data.detail])}`)
  }
  const draftPdf = await renderPdf(draftPrint.document, { maxPages: 5 })
  if (new TextDecoder().decode(draftPdf.subarray(0, 5)) !== '%PDF-') throw new Error('the visit read into the generated draft did not render to a PDF')

  // A later version that moved the inspector's name out of its group: the
  // report's field is refused for that version, naming it and the hash,
  // until a review lifts it; and a hash the host gives that is not the
  // form's is refused, whichever is wrong.
  const moved = { ...visitForm, model: { fields: [...visitForm.model.fields.filter((field) => field.key !== 'inspector'), { key: 'inspectorName', type: 'text', label: 'Inspector' }] } }
  const refused = (outcome: SubmissionRead): readonly FormsError[] => (outcome.ok ? [] : outcome.errors)
  const lacking = refused(readSubmission(visitReport, { form: moved, submission: { id: visitId, data: { site: 'Bern' } } }))
  if (lacking.length !== 1 || lacking[0]?.code !== 'version-lacks-field' || lacking[0].path !== '/datasets/header/fields/2/form' || !lacking[0].message.includes(schemaHash(moved))) {
    throw new Error(`a version that moved the inspector's name was not refused naming the field and its hash: ${JSON.stringify(lacking)}`)
  }
  const mismatched = refused(readSubmission(visitReport, { form: visitForm, formHash: schemaHash(moved), submission: { id: visitId, data: visitData } }))
  if (mismatched.map((error) => `${error.code} ${error.path}`).join() !== 'hash-mismatch /formHash') throw new Error(`a hash that is not the form's was not refused: ${JSON.stringify(mismatched)}`)
  // A later version that renamed the inspector's group the technician's,
  // declared (0048): the draft's submissions of it are refused until
  // reviewed. The review, against the version the draft was made from,
  // offers the declared rename first; applied through a session against
  // the hash it was computed for, the version's visit reads, and applied
  // again it is stale.
  const renamedForm = { ...visitForm, model: { fields: visitForm.model.fields.map((field) => (field.key === 'inspector' ? { ...field, key: 'technician', renamedFrom: 'inspector' } : field)) } }
  const renamedData = { site: 'Kramgasse 49, 3011 Bern', technician: { name: 'Lea Gerber' } }
  const unreviewed = refused(readSubmission(draft.report, { form: renamedForm, submission: { id: visitId, data: renamedData } }))
  if (unreviewed.map((error) => `${error.code} ${error.path}`).join() !== 'version-lacks-field /datasets/header/fields/2/form' || !unreviewed[0]?.message.includes('reviewFormVersion')) {
    throw new Error(`a version that renamed the inspector's group was not refused, naming the review that lifts it: ${JSON.stringify(unreviewed)}`)
  }
  const review: FormReview = reviewFormVersion(draft.report, { form: renamedForm, versions: [visitForm] })
  if (!review.ok) throw new Error(review.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
  const follow = review.items[0]?.resolutions[0]
  const opening = openReportSession(draft.report)
  const applied = opening.ok && follow !== undefined ? opening.session.apply(follow.descriptor, { expectedHash: follow.expectedHash }) : undefined
  if (review.status !== 'blocked' || follow?.kind !== 'follow-rename' || follow.declared !== true || applied?.ok !== true || !opening.ok) {
    throw new Error(`the review did not offer the declared rename first, or the session did not take it: ${JSON.stringify([review.status, follow?.kind, applied?.ok])}`)
  }
  const reviewedVisit = readSubmission(opening.session.document(), { form: renamedForm, submission: { id: visitId, data: renamedData } })
  const again = opening.session.apply(follow.descriptor, { expectedHash: follow.expectedHash })
  if (!reviewedVisit.ok || reviewedVisit.data.header?.['name'] !== 'Lea Gerber' || again.ok || again.code !== 'stale-document') {
    throw new Error(`the reviewed draft did not read the renamed version's visit, or took the same resolution twice: ${JSON.stringify([reviewedVisit.ok ? reviewedVisit.data.header : reviewedVisit.errors, again.ok])}`)
  }
  return `the form bridge read a submission of a site visit validated by @formancy/spec against its version, its labels in Swiss German, host-captured, its manifest naming the submission and the version's hash, and it rendered to a ${pdf.length}-byte PDF; it read two visits one a row, the manifest naming both; it generated a draft from the version, naming it, its one assumption listed, read the visit into it and rendered it to a ${draftPdf.length}-byte PDF; a version that moved a field it reads, and a hash that is not the form's, were refused; a version that renamed a group the draft reads was refused, naming the review, and reviewed against the version the draft was made from, its declared rename offered first, applied through a session against its hash, after which the version's visit read and the same resolution was stale`
}
