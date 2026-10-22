import { diagnose } from '@formancy/report-core'
import { checkReport } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { SITE_VISIT_STARTER, SITE_VISIT_STARTER_OPTIONS } from '../starters/site-visit.js'
import { SITE_VISIT_HIGH, SITE_VISIT_REPORT, SITE_VISIT_SUBMISSION_V1, SITE_VISIT_SUBMISSION_V2, SITE_VISIT_SUBMISSION_V3, SITE_VISIT_V1, SITE_VISIT_V2, SITE_VISIT_V3 } from './site-visit.js'

/**
 * The site visit fixture says what it is: a report the runtime reads and an
 * author would leave as it is, two versions that differ in one label, and
 * submissions of each. Reading a submission is report-forms' to test; the
 * corpus does not depend on it.
 */
describe('the site visit', () => {
  // A report the runtime refuses, or one whose author's problems pane is
  // full, would prove nothing about the bridge that fills it.
  test('its report is one the runtime reads, with nothing an editor warns of, reading both datasets from the form', () => {
    const checked = checkReport(SITE_VISIT_REPORT)
    expect(checked.ok ? [] : checked.errors).toEqual([])
    expect(diagnose(SITE_VISIT_REPORT)).toEqual([])
    expect([SITE_VISIT_REPORT.datasets.header?.form, SITE_VISIT_REPORT.datasets.detail?.form]).toEqual([{ kind: 'submission' }, { kind: 'repeater', repeater: 'findings' }])
  })

  // The PDF proof reads version 1's label of a high-severity finding where
  // version 2 has another: were anything else different between the
  // versions, the proof would say less than it claims, and were the label
  // the same, nothing.
  test('version 2 rewrites the label of a high severity, in both languages, and nothing else', () => {
    const v2 = JSON.parse(JSON.stringify(SITE_VISIT_V2)) as { i18n: { messages: Record<string, Record<string, string>> } }
    expect([v2.i18n.messages['en']?.['severity.high'], v2.i18n.messages['de-CH']?.['severity.high']]).toEqual(['Critical', SITE_VISIT_HIGH.v2])
    expect(SITE_VISIT_HIGH.v1).not.toBe(SITE_VISIT_HIGH.v2)
    const restored = { ...v2, i18n: { ...v2.i18n, messages: { en: { ...v2.i18n.messages['en'], 'severity.high': 'High' }, 'de-CH': { ...v2.i18n.messages['de-CH'], 'severity.high': SITE_VISIT_HIGH.v1 } } } }
    expect(restored).toEqual(SITE_VISIT_V1)
  })

  // A version-1 visit with no finding of high severity would print no
  // label version 2 rewrote; one with an answer under a key the form does
  // not have is a submission of another form.
  test('each submission answers its version, the first with urgent findings among its rows', () => {
    const keys = ((SITE_VISIT_V1['model'] as { fields: { key: string }[] }).fields).map((field) => field.key)
    for (const { data } of [SITE_VISIT_SUBMISSION_V1, SITE_VISIT_SUBMISSION_V2]) expect(Object.keys(data).filter((key) => !keys.includes(key))).toEqual([])
    const rows = SITE_VISIT_SUBMISSION_V1.data['findings'] as readonly { severity: string }[]
    expect(rows.filter((row) => row.severity === 'high').length).toBeGreaterThan(0)
    expect(SITE_VISIT_SUBMISSION_V1.id).not.toBe(SITE_VISIT_SUBMISSION_V2.id)
  })

  // Version 3 moves a field the starter prints, by a rename its author
  // declared (0048): the inspector's group is the technician's, its name
  // and licence beneath it. Were anything else different, the review's
  // PDF proof would follow more than the rename it claims; and a version-3
  // visit answers version 3 alone, with answers no other visit has, so
  // the PDF shows which visit it printed.
  test('version 3 renames the inspector’s group, declared, and nothing else; a version-3 visit answers it', () => {
    const fields = (form: Readonly<Record<string, unknown>>) => (form['model'] as { fields: { key: string; renamedFrom?: string }[] }).fields
    const renamed = fields(SITE_VISIT_V3).find((field) => field.key === 'technician')
    expect(renamed?.renamedFrom).toBe('inspector')
    const { renamedFrom: _from, ...rest } = renamed as { key: string; renamedFrom?: string }
    expect({ ...SITE_VISIT_V3, model: { fields: fields(SITE_VISIT_V3).map((field) => (field.key === 'technician' ? { ...rest, key: 'inspector' } : field)) } }).toEqual(SITE_VISIT_V2)
    const keys = fields(SITE_VISIT_V3).map((field) => field.key)
    expect(Object.keys(SITE_VISIT_SUBMISSION_V3.data).filter((key) => !keys.includes(key))).toEqual([])
    expect(SITE_VISIT_SUBMISSION_V3.data['technician']).not.toEqual(SITE_VISIT_SUBMISSION_V2.data['inspector'])
    expect([SITE_VISIT_SUBMISSION_V1.id, SITE_VISIT_SUBMISSION_V2.id]).not.toContain(SITE_VISIT_SUBMISSION_V3.id)
  })

  // The starter generated from version 2 (0045) prints a visit version 2
  // collected, and names that one version twice: in its provenance, the
  // version it was made from, and in its data's source, the version that
  // collected the visit. Two hashes that differed would be a draft printing
  // another version's visit. That the hash is version 2's, and that the
  // starter is the generator's draft, is report-forms' starter.test.ts to
  // hold: the corpus does not depend on @formancy/spec or the bridge.
  test('has a starter generated from version 2 that prints a version-2 visit, naming that version twice', () => {
    const { report, data } = SITE_VISIT_STARTER
    const source = data.source?.provider === 'formancy-form' ? data.source.submissions : []
    expect(source.map(({ id, form }) => [id, form])).toEqual([[SITE_VISIT_SUBMISSION_V2.id, SITE_VISIT_V2['id']]])
    expect(report.provenance).toEqual({ kind: 'form', form: SITE_VISIT_V2['id'], formHash: source[0]?.formHash })
    expect(SITE_VISIT_STARTER_OPTIONS).toEqual({ id: SITE_VISIT_STARTER.id, locale: report.locale, detail: { kind: 'repeater', repeater: 'findings' } })
    expect(data.detail).toHaveLength((SITE_VISIT_SUBMISSION_V2.data['findings'] as readonly unknown[]).length)
  })
})
