import type { ReportDefinition } from '@formancy/report-runtime'

/**
 * A formancy form, two versions of it, submissions of each, and a report
 * that reads them (0042): the site visit a technician fills in, and the
 * report printed from one visit, its findings one a row.
 *
 * The form is spec 4 and uses most kinds the form bridge reads: text, a
 * date, an instant, a time of day, a radio, a group, ticked boxes, a
 * matrix, a repeater whose rows hold a select, two numbers -- one a count
 * that steps by whole numbers, one hours that steps by 0.05, so by
 * quarters and tenths of an hour -- and a tick box, and a long text. A
 * hidden value and a rich text it does not hold; report-forms' own tests
 * read those. Its labels are messages in English and Swiss German.
 *
 * Version 2 rewrites one choice's label and nothing else: a finding of high
 * severity reads "Kritisch" where version 1 reads "Hoch". A reprint of a
 * version-1 visit prints version 1's label (plan 12.2), which the PDF of a
 * version-1 submission proves (report-forms' `pdf.test.ts`).
 *
 * Version 3 moves fields a report prints, by a rename its author declared
 * (0048): the inspector's group is the technician's, `renamedFrom` the
 * inspector, so its name and its licence stand at `technician.name` and
 * `technician.licence`. A report made from version 2 refuses a version-3
 * visit until a review follows the rename, which the PDF of a version-3
 * visit proves (report-forms' `review-pdf.test.ts`).
 *
 * Plain data, as a host holds a form it kept and a submission it stored:
 * the corpus does not depend on `@formancy/spec`, and the bridge takes a
 * form as `unknown`.
 */

const MESSAGES_EN = {
  site: 'Site',
  visitedOn: 'Visited on',
  arrivedAt: 'Arrived at',
  startedAt: 'Started at',
  outcome: 'Outcome',
  'outcome.pass': 'Passed',
  'outcome.repair': 'Repairs needed',
  'outcome.fail': 'Failed',
  inspector: 'Inspector',
  'inspector.name': 'Name',
  'inspector.licence': 'Licence',
  checks: 'Checked',
  'checks.roof': 'Roof',
  'checks.wiring': 'Wiring',
  'checks.boiler': 'Boiler',
  condition: 'Condition',
  'condition.safety': 'Safety',
  'condition.cleanliness': 'Cleanliness',
  'condition.good': 'Good',
  'condition.fair': 'Fair',
  'condition.poor': 'Poor',
  findings: 'Findings',
  ref: 'Reference',
  area: 'Area',
  severity: 'Severity',
  'severity.low': 'Low',
  'severity.high': 'High',
  hours: 'Hours',
  parts: 'Parts',
  fixed: 'Fixed on site',
  summary: 'Summary',
} as const

const MESSAGES_DE_CH: { readonly [K in keyof typeof MESSAGES_EN]: string } = {
  site: 'Objekt',
  visitedOn: 'Besucht am',
  arrivedAt: 'Angekommen um',
  startedAt: 'Begonnen um',
  outcome: 'Ergebnis',
  'outcome.pass': 'Bestanden',
  'outcome.repair': 'Reparaturen nötig',
  'outcome.fail': 'Nicht bestanden',
  inspector: 'Inspektor',
  'inspector.name': 'Name',
  'inspector.licence': 'Ausweis',
  checks: 'Geprüft',
  'checks.roof': 'Dach',
  'checks.wiring': 'Elektrik',
  'checks.boiler': 'Heizkessel',
  condition: 'Zustand',
  'condition.safety': 'Sicherheit',
  'condition.cleanliness': 'Sauberkeit',
  'condition.good': 'Gut',
  'condition.fair': 'Mittel',
  'condition.poor': 'Schlecht',
  findings: 'Befunde',
  ref: 'Nr.',
  area: 'Bereich',
  severity: 'Dringlichkeit',
  'severity.low': 'Niedrig',
  'severity.high': 'Hoch',
  hours: 'Stunden',
  parts: 'Teile',
  fixed: 'Vor Ort behoben',
  summary: 'Zusammenfassung',
}

const t = (id: keyof typeof MESSAGES_EN) => ({ $t: id })
const option = (value: string, id: keyof typeof MESSAGES_EN) => ({ value, label: t(id) })

/** The site visit form as a version writes it; `messages` are its catalogues. */
function visitForm(messages: { readonly en: object; readonly 'de-CH': object }): Record<string, unknown> {
  return {
    specVersion: '4',
    id: 'site-visit',
    title: 'Site visit',
    i18n: { defaultLocale: 'en', messages },
    model: {
      fields: [
        { key: 'site', type: 'text', label: t('site'), required: true },
        { key: 'visitedOn', type: 'date', label: t('visitedOn'), required: true },
        { key: 'arrivedAt', type: 'datetime', label: t('arrivedAt') },
        { key: 'startedAt', type: 'time', label: t('startedAt') },
        {
          key: 'outcome',
          type: 'radio',
          label: t('outcome'),
          options: [option('pass', 'outcome.pass'), option('repair', 'outcome.repair'), option('fail', 'outcome.fail')],
        },
        {
          key: 'inspector',
          type: 'group',
          label: t('inspector'),
          fields: [
            { key: 'name', type: 'text', label: t('inspector.name') },
            { key: 'licence', type: 'text', label: t('inspector.licence') },
          ],
        },
        {
          key: 'checks',
          type: 'selectboxes',
          label: t('checks'),
          options: [option('roof', 'checks.roof'), option('wiring', 'checks.wiring'), option('boiler', 'checks.boiler')],
        },
        {
          key: 'condition',
          type: 'matrix',
          label: t('condition'),
          rows: [option('safety', 'condition.safety'), option('cleanliness', 'condition.cleanliness')],
          options: [option('good', 'condition.good'), option('fair', 'condition.fair'), option('poor', 'condition.poor')],
        },
        {
          key: 'findings',
          type: 'repeater',
          label: t('findings'),
          fields: [
            { key: 'ref', type: 'text', label: t('ref') },
            { key: 'area', type: 'text', label: t('area') },
            { key: 'severity', type: 'select', label: t('severity'), options: [option('low', 'severity.low'), option('high', 'severity.high')] },
            { key: 'hours', type: 'number', label: t('hours'), min: 0, step: 0.05 },
            { key: 'parts', type: 'number', label: t('parts'), min: 0, step: 1 },
            { key: 'fixed', type: 'checkbox', label: t('fixed') },
          ],
        },
        { key: 'summary', type: 'textarea', label: t('summary') },
      ],
    },
  }
}

/** Version 1 of the site visit form. */
export const SITE_VISIT_V1: Readonly<Record<string, unknown>> = visitForm({ en: MESSAGES_EN, 'de-CH': MESSAGES_DE_CH })

/** The label version 1 gives a finding of high severity in Swiss German, and the one version 2 gives it. */
export const SITE_VISIT_HIGH = { v1: MESSAGES_DE_CH['severity.high'], v2: 'Kritisch' } as const

/** Version 2: a finding of high severity is "Critical", "Kritisch", where version 1 said "High", "Hoch". Nothing else changed. */
export const SITE_VISIT_V2: Readonly<Record<string, unknown>> = visitForm({
  en: { ...MESSAGES_EN, 'severity.high': 'Critical' },
  'de-CH': { ...MESSAGES_DE_CH, 'severity.high': SITE_VISIT_HIGH.v2 },
})

/** Version 3: version 2 with the inspector's group renamed the technician's, the rename declared. Nothing else changed. */
export const SITE_VISIT_V3: Readonly<Record<string, unknown>> = {
  ...SITE_VISIT_V2,
  model: {
    fields: (SITE_VISIT_V2['model'] as { readonly fields: readonly { readonly key: string }[] }).fields.map((field) =>
      field.key === 'inspector' ? { ...field, key: 'technician', renamedFrom: 'inspector' } : field,
    ),
  },
}

/** One submission as a host stores it: its id, and the answers formancy's engine wrote. */
export interface StoredSubmission {
  readonly id: string
  readonly data: Readonly<Record<string, unknown>>
}

const AREAS = ['Dachrinne Nord', 'Heizraum', 'Treppenhaus', 'Keller Ost', 'Lift', 'Fassade West', 'Tiefgarage', 'Waschküche', 'Estrich', 'Eingang']
/** Hours as a technician types them, to the quarter or the tenth. */
const HOURS = [1.5, 0.25, 2, 0.75, 3.25, 1.1, 0.3, 4, 0.5, 2.6]

/** `count` findings, `F-01` up, every second one urgent, each a row with its own `_id` as formancy writes one. */
export function siteVisitFindings(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => ({
    _id: `r${index + 1}`,
    ref: `F-${String(index + 1).padStart(2, '0')}`,
    area: AREAS[index % AREAS.length],
    severity: index % 2 === 0 ? 'high' : 'low',
    hours: HOURS[index % HOURS.length],
    parts: index % 4,
    fixed: index % 3 === 0,
  }))
}

/** A visit collected by version 1: eight findings, half of them of high severity. */
export const SITE_VISIT_SUBMISSION_V1: StoredSubmission = {
  id: 'b682a5ed-ed01-4f8c-8d80-cf53db4e8380',
  data: {
    site: 'Hauptstrasse 12, 3011 Bern',
    visitedOn: '2026-10-15',
    arrivedAt: '2026-10-15T07:45:00Z',
    startedAt: '09:50',
    outcome: 'repair',
    inspector: { name: 'Anna Schär', licence: 'BE-4471' },
    checks: ['roof', 'boiler'],
    condition: { safety: 'fair', cleanliness: 'good' },
    findings: siteVisitFindings(8),
    summary: 'Zwei Befunde sind dringend und vor dem Winter zu beheben.',
  },
}

/** A visit collected by version 2: three findings, and no time it started, which a person left out. */
export const SITE_VISIT_SUBMISSION_V2: StoredSubmission = {
  id: '8861b39c-51df-4cc0-b71e-63a6d3f16b1b',
  data: {
    site: 'Bahnhofplatz 1, 3011 Bern',
    visitedOn: '2026-10-21',
    arrivedAt: '2026-10-21T12:05:00Z',
    outcome: 'fail',
    inspector: { name: 'Marc Rüegg', licence: 'BE-5120' },
    checks: ['wiring'],
    condition: { safety: 'poor' },
    findings: siteVisitFindings(3),
    summary: 'Die Elektrik ist sofort zu prüfen.',
  },
}

/** A visit collected by version 3: two findings, the technician's name and licence under the group's new key. */
export const SITE_VISIT_SUBMISSION_V3: StoredSubmission = {
  id: 'c5f0d3a2-7e41-4b8a-9a35-2f6f1d0b9e74',
  data: {
    site: 'Kramgasse 49, 3011 Bern',
    visitedOn: '2026-10-22',
    arrivedAt: '2026-10-22T06:30:00Z',
    startedAt: '08:40',
    outcome: 'pass',
    technician: { name: 'Lea Gerber', licence: 'BE-6203' },
    checks: ['roof', 'wiring', 'boiler'],
    condition: { safety: 'good', cleanliness: 'good' },
    findings: siteVisitFindings(2),
    summary: 'Keine dringenden Befunde.',
  },
}

const header = (field: string) => ({ dataset: 'header', field }) as const
const detail = (field: string) => ({ dataset: 'detail', field }) as const
const text = (value: string) => ({ kind: 'text', text: value }) as const
/** Hours to the hundredth, as the field's scale holds them: a quarter prints 0.25, and 2 prints 2.00. */
const HOURS_FORMAT = { kind: 'number', scale: 2, grouping: false } as const

/**
 * The report a site visit prints: the visit's answers in the header, its
 * findings one a row, in Swiss German. Each field says where the visit
 * holds it: a group's child by its path, a ticked box and a matrix row by
 * their member, the outcome by its label and by its stored value.
 */
export const SITE_VISIT_REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'site-visit',
  title: 'Begehungsbericht',
  locale: 'de-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 } },
  styles: [
    { id: 'title', size: 16, bold: true },
    { id: 'heading', size: 11, bold: true },
    { id: 'small', size: 8, color: '#555555' },
    { id: 'footer', size: 8, align: 'center' },
  ],
  datasets: {
    header: {
      id: 'visit',
      form: { kind: 'submission' },
      fields: [
        { id: 'site', type: 'string', label: 'Objekt', nullable: false, form: { path: 'site' } },
        { id: 'visitedOn', type: 'date', label: 'Besucht am', nullable: false, form: { path: 'visitedOn' } },
        { id: 'arrivedAt', type: 'instant', label: 'Angekommen um', nullable: true, form: { path: 'arrivedAt' } },
        { id: 'startedAt', type: 'string', label: 'Begonnen um', nullable: true, form: { path: 'startedAt' } },
        { id: 'outcome', type: 'string', label: 'Ergebnis', nullable: true, form: { path: 'outcome' } },
        { id: 'outcomeCode', type: 'string', label: 'Ergebniscode', nullable: true, form: { path: 'outcome', read: 'value' } },
        { id: 'inspector', type: 'string', label: 'Inspektor', nullable: true, form: { path: 'inspector.name' } },
        { id: 'licence', type: 'string', label: 'Ausweis', nullable: true, form: { path: 'inspector.licence' } },
        { id: 'roofChecked', type: 'boolean', label: 'Dach geprüft', nullable: true, form: { path: 'checks', member: 'roof' } },
        { id: 'safety', type: 'string', label: 'Sicherheit', nullable: true, form: { path: 'condition', member: 'safety' } },
        { id: 'summary', type: 'string', label: 'Zusammenfassung', nullable: true, form: { path: 'summary' } },
      ],
    },
    detail: {
      id: 'findings',
      form: { kind: 'repeater', repeater: 'findings' },
      fields: [
        { id: 'ref', type: 'string', label: 'Nr.', nullable: true, form: { path: 'ref' } },
        { id: 'area', type: 'string', label: 'Bereich', nullable: true, form: { path: 'area' } },
        { id: 'severity', type: 'string', label: 'Dringlichkeit', nullable: true, form: { path: 'severity' } },
        { id: 'hours', type: 'decimal', label: 'Stunden', nullable: true, scale: 2, form: { path: 'hours' } },
        { id: 'parts', type: 'integer', label: 'Teile', nullable: true, form: { path: 'parts' } },
        { id: 'fixed', type: 'boolean', label: 'Vor Ort behoben', nullable: true, form: { path: 'fixed' } },
      ],
    },
  },
  parameters: [],
  assets: [],
  aggregates: [
    { id: 'findings', fn: 'count' },
    { id: 'hours', fn: 'sum', of: { kind: 'field', field: detail('hours') } },
  ],
  regions: {
    pageHeader: [{ id: 'running-head', kind: 'text', style: 'small', content: [text('Begehung · '), { kind: 'field', field: header('site') }] }],
    reportHeader: [
      { id: 'title', kind: 'text', style: 'title', content: [text('Begehungsbericht')] },
      { id: 'site', kind: 'text', content: [text('Objekt: '), { kind: 'field', field: header('site') }] },
      { id: 'date', kind: 'text', content: [text('Besucht am: '), { kind: 'field', field: header('visitedOn'), format: { kind: 'date', style: 'long' } }] },
      {
        id: 'times',
        kind: 'text',
        content: [
          text('Angekommen: '),
          { kind: 'field', field: header('arrivedAt'), format: { kind: 'date', style: 'medium' } },
          text(', begonnen um '),
          { kind: 'field', field: header('startedAt') },
        ],
      },
      {
        id: 'inspector',
        kind: 'text',
        content: [text('Inspektor: '), { kind: 'field', field: header('inspector') }, text(', Ausweis '), { kind: 'field', field: header('licence') }],
      },
      {
        id: 'outcome',
        kind: 'text',
        content: [text('Ergebnis: '), { kind: 'field', field: header('outcome') }, text(' ('), { kind: 'field', field: header('outcomeCode') }, text(')')],
      },
      { id: 'safety', kind: 'text', content: [text('Sicherheit: '), { kind: 'field', field: header('safety') }] },
      {
        id: 'roof',
        kind: 'text',
        content: [{ kind: 'expression', expression: { cel: 'header.roofChecked == true ? "Dach geprüft" : "Dach nicht geprüft"' } }],
      },
      { id: 'head-gap', kind: 'spacer', height: 12 },
    ],
    body: [
      {
        id: 'findings',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'ref', header: 'Nr.', width: 40, align: 'left', value: { kind: 'field', field: detail('ref') } },
          { id: 'area', header: 'Bereich', width: 'fill', align: 'left', value: { kind: 'field', field: detail('area') } },
          { id: 'severity', header: 'Dringlichkeit', width: 80, align: 'left', value: { kind: 'field', field: detail('severity') } },
          { id: 'hours', header: 'Stunden', width: 60, align: 'right', value: { kind: 'field', field: detail('hours'), format: HOURS_FORMAT } },
          { id: 'parts', header: 'Teile', width: 40, align: 'right', value: { kind: 'field', field: detail('parts') } },
          { id: 'fixed', header: 'Behoben', width: 60, align: 'left', value: { kind: 'expression', expression: { cel: 'row.fixed == true ? "ja" : "nein"' } } },
        ],
        totals: [
          {
            cells: [
              { column: 'ref', value: text('Total') },
              { column: 'area', value: { kind: 'aggregate', aggregate: 'findings', over: 'report' } },
              { column: 'hours', value: { kind: 'aggregate', aggregate: 'hours', over: 'report', format: HOURS_FORMAT } },
            ],
          },
        ],
        emptyText: 'Keine Befunde.',
        repeatHeader: true,
      },
    ],
    summary: [
      { id: 'summary-heading', kind: 'text', style: 'heading', keepWithNext: true, content: [text('Zusammenfassung')] },
      { id: 'summary', kind: 'text', content: [{ kind: 'field', field: header('summary') }] },
    ],
    pageFooter: [{ id: 'page-of', kind: 'text', style: 'footer', content: [text('Seite '), { kind: 'pageNumber' }, text(' von '), { kind: 'pageCount' }] }],
  },
  provenance: { kind: 'blank' },
}
