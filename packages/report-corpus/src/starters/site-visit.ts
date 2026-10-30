import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { SITE_VISIT_SUBMISSION_V2 } from '../forms/site-visit.js'
import type { Starter } from './starter.js'

/**
 * The site visit starter (0045): the report `generateReport` writes of the
 * corpus's site visit form, version 2, in Swiss German, its table over the
 * findings -- a draft a person starts from -- and the visit version 2
 * collected, as the bridge reads it into the draft.
 *
 * Both are written out as data. The corpus cannot
 * call the generator: report-forms' tests import the corpus, so the corpus
 * importing report-forms would make a cycle. Instead report-forms'
 * `starter.test.ts` generates the draft from `SITE_VISIT_V2` with these
 * options and holds it equal to this report by its hash, and reads
 * `SITE_VISIT_SUBMISSION_V2` into it and holds that equal to this data, so
 * the two cannot drift. A change to the generator that moves this draft is
 * a change to this file.
 */

/** What the starter was generated with: its id, its locale, and the repeater its table reads. */
export const SITE_VISIT_STARTER_OPTIONS = { id: 'site-visit', locale: 'de-CH', detail: { kind: 'repeater', repeater: 'findings' } } as const

/**
 * The `schemaHash` of the site visit form's version 2, written out: what
 * the draft's provenance names it by, and its data's source. report-forms'
 * `starter.test.ts` holds it to the hash computed of `SITE_VISIT_V2`.
 */
const VERSION_2 = '0f8c0cf8365c481c2b30e00f93c0d7f13fc20565b56e3e89451c112b48568a4b'

/** The draft, as the generator writes it: a line for each answer in model order, the inspector a section, the ticked boxes and the matrix a section each, the findings one table. */
const REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'site-visit',
  title: 'Site visit',
  locale: 'de-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [
    { id: 'title', size: 16, bold: true },
    { id: 'heading', size: 11, bold: true },
    { id: 'footer', size: 8, align: 'center' },
  ],
  datasets: {
    header: {
      id: 'answers',
      fields: [
        { id: 'site', type: 'string', label: 'Objekt', nullable: false, form: { path: 'site' } },
        { id: 'visitedOn', type: 'date', label: 'Besucht am', nullable: false, form: { path: 'visitedOn' } },
        { id: 'arrivedAt', type: 'instant', label: 'Angekommen um', nullable: true, form: { path: 'arrivedAt' } },
        { id: 'startedAt', type: 'string', label: 'Begonnen um', nullable: true, form: { path: 'startedAt' } },
        { id: 'outcome', type: 'string', label: 'Ergebnis', nullable: true, form: { path: 'outcome' } },
        { id: 'name', type: 'string', label: 'Name', nullable: true, form: { path: 'inspector.name' } },
        { id: 'licence', type: 'string', label: 'Ausweis', nullable: true, form: { path: 'inspector.licence' } },
        { id: 'checks_roof', type: 'boolean', label: 'Geprüft: Dach', nullable: true, form: { path: 'checks', member: 'roof' } },
        { id: 'checks_wiring', type: 'boolean', label: 'Geprüft: Elektrik', nullable: true, form: { path: 'checks', member: 'wiring' } },
        { id: 'checks_boiler', type: 'boolean', label: 'Geprüft: Heizkessel', nullable: true, form: { path: 'checks', member: 'boiler' } },
        { id: 'condition_safety', type: 'string', label: 'Zustand: Sicherheit', nullable: true, form: { path: 'condition', member: 'safety' } },
        { id: 'condition_cleanliness', type: 'string', label: 'Zustand: Sauberkeit', nullable: true, form: { path: 'condition', member: 'cleanliness' } },
        { id: 'summary', type: 'string', label: 'Zusammenfassung', nullable: true, form: { path: 'summary' } },
      ],
      form: { kind: 'submission' },
    },
    detail: {
      id: 'rows',
      fields: [
        { id: 'ref', type: 'string', label: 'Nr.', nullable: true, form: { path: 'ref' } },
        { id: 'area', type: 'string', label: 'Bereich', nullable: true, form: { path: 'area' } },
        { id: 'severity', type: 'string', label: 'Dringlichkeit', nullable: true, form: { path: 'severity' } },
        { id: 'hours', type: 'decimal', label: 'Stunden', nullable: true, scale: 2, form: { path: 'hours' } },
        { id: 'parts', type: 'integer', label: 'Teile', nullable: true, form: { path: 'parts' } },
        { id: 'fixed', type: 'boolean', label: 'Vor Ort behoben', nullable: true, form: { path: 'fixed' } },
      ],
      form: { kind: 'repeater', repeater: 'findings' },
    },
  },
  parameters: [],
  assets: [],
  aggregates: [],
  regions: {
    reportHeader: [{ id: 'title', style: 'title', kind: 'text', content: [{ kind: 'text', text: 'Site visit' }] }],
    pageHeader: [],
    body: [
      {
        id: 'line-1',
        kind: 'text',
        content: [
          { kind: 'text', text: 'Objekt: ' },
          { kind: 'field', field: { dataset: 'header', field: 'site' } },
        ],
      },
      {
        id: 'line-2',
        kind: 'text',
        content: [
          { kind: 'text', text: 'Besucht am: ' },
          { kind: 'field', field: { dataset: 'header', field: 'visitedOn' }, format: { kind: 'date', style: 'medium' } },
        ],
      },
      {
        id: 'line-3',
        kind: 'text',
        content: [
          { kind: 'text', text: 'Angekommen um: ' },
          { kind: 'field', field: { dataset: 'header', field: 'arrivedAt' }, format: { kind: 'date', style: 'medium' } },
        ],
      },
      {
        id: 'line-4',
        kind: 'text',
        content: [
          { kind: 'text', text: 'Begonnen um: ' },
          { kind: 'field', field: { dataset: 'header', field: 'startedAt' } },
        ],
      },
      {
        id: 'line-5',
        kind: 'text',
        content: [
          { kind: 'text', text: 'Ergebnis: ' },
          { kind: 'field', field: { dataset: 'header', field: 'outcome' } },
        ],
      },
      {
        id: 'section-1',
        kind: 'section',
        components: [
          { id: 'heading-1', style: 'heading', kind: 'text', content: [{ kind: 'text', text: 'Inspektor' }], keepWithNext: true },
          {
            id: 'line-6',
            kind: 'text',
            content: [
              { kind: 'text', text: 'Name: ' },
              { kind: 'field', field: { dataset: 'header', field: 'name' } },
            ],
          },
          {
            id: 'line-7',
            kind: 'text',
            content: [
              { kind: 'text', text: 'Ausweis: ' },
              { kind: 'field', field: { dataset: 'header', field: 'licence' } },
            ],
          },
        ],
      },
      {
        id: 'section-2',
        kind: 'section',
        components: [
          { id: 'heading-2', style: 'heading', kind: 'text', content: [{ kind: 'text', text: 'Geprüft' }], keepWithNext: true },
          {
            id: 'line-8',
            kind: 'text',
            content: [
              { kind: 'text', text: 'Dach: ' },
              { kind: 'expression', expression: { cel: 'header["checks_roof"] == true ? "[x]" : header["checks_roof"] == false ? "[ ]" : ""' } },
            ],
          },
          {
            id: 'line-9',
            kind: 'text',
            content: [
              { kind: 'text', text: 'Elektrik: ' },
              { kind: 'expression', expression: { cel: 'header["checks_wiring"] == true ? "[x]" : header["checks_wiring"] == false ? "[ ]" : ""' } },
            ],
          },
          {
            id: 'line-10',
            kind: 'text',
            content: [
              { kind: 'text', text: 'Heizkessel: ' },
              { kind: 'expression', expression: { cel: 'header["checks_boiler"] == true ? "[x]" : header["checks_boiler"] == false ? "[ ]" : ""' } },
            ],
          },
        ],
      },
      {
        id: 'section-3',
        kind: 'section',
        components: [
          { id: 'heading-3', style: 'heading', kind: 'text', content: [{ kind: 'text', text: 'Zustand' }], keepWithNext: true },
          {
            id: 'line-11',
            kind: 'text',
            content: [
              { kind: 'text', text: 'Sicherheit: ' },
              { kind: 'field', field: { dataset: 'header', field: 'condition_safety' } },
            ],
          },
          {
            id: 'line-12',
            kind: 'text',
            content: [
              { kind: 'text', text: 'Sauberkeit: ' },
              { kind: 'field', field: { dataset: 'header', field: 'condition_cleanliness' } },
            ],
          },
        ],
      },
      { id: 'heading-4', style: 'heading', kind: 'text', content: [{ kind: 'text', text: 'Befunde' }], keepWithNext: true },
      {
        id: 'table',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'column-1', header: 'Nr.', width: 'fill', align: 'left', value: { kind: 'field', field: { dataset: 'detail', field: 'ref' } } },
          { id: 'column-2', header: 'Bereich', width: 'fill', align: 'left', value: { kind: 'field', field: { dataset: 'detail', field: 'area' } } },
          { id: 'column-3', header: 'Dringlichkeit', width: 'fill', align: 'left', value: { kind: 'field', field: { dataset: 'detail', field: 'severity' } } },
          {
            id: 'column-4',
            header: 'Stunden',
            width: 'fill',
            align: 'right',
            value: { kind: 'field', field: { dataset: 'detail', field: 'hours' }, format: { kind: 'number', scale: 2, grouping: true } },
          },
          { id: 'column-5', header: 'Teile', width: 'fill', align: 'right', value: { kind: 'field', field: { dataset: 'detail', field: 'parts' } } },
          {
            id: 'column-6',
            header: 'Vor Ort behoben',
            width: 'fill',
            align: 'left',
            value: { kind: 'expression', expression: { cel: 'row["fixed"] == true ? "[x]" : row["fixed"] == false ? "[ ]" : ""' } },
          },
        ],
        emptyText: '–',
        repeatHeader: true,
      },
      {
        id: 'line-13',
        kind: 'text',
        content: [
          { kind: 'text', text: 'Zusammenfassung: ' },
          { kind: 'field', field: { dataset: 'header', field: 'summary' } },
        ],
      },
    ],
    pageFooter: [{ id: 'page-number', style: 'footer', kind: 'text', content: [{ kind: 'pageNumber' }, { kind: 'text', text: ' / ' }, { kind: 'pageCount' }] }],
    summary: [],
  },
  provenance: { kind: 'form', form: 'site-visit', formHash: VERSION_2 },
}

/** The version-2 visit, read into the draft by the bridge: version 2's labels, the hours as their digits, a ticked box as a boolean, an unanswered one as null. */
const DATA: ReportData = {
  header: {
    site: 'Bahnhofplatz 1, 3011 Bern',
    visitedOn: '2026-10-21',
    arrivedAt: '2026-10-21T12:05:00Z',
    startedAt: null,
    outcome: 'Nicht bestanden',
    name: 'Marc Rüegg',
    licence: 'BE-5120',
    checks_roof: false,
    checks_wiring: true,
    checks_boiler: false,
    condition_safety: 'Schlecht',
    condition_cleanliness: null,
    summary: 'Die Elektrik ist sofort zu prüfen.',
  },
  detail: [
    { ref: 'F-01', area: 'Dachrinne Nord', severity: 'Kritisch', hours: '1.5', parts: '0', fixed: true },
    { ref: 'F-02', area: 'Heizraum', severity: 'Niedrig', hours: '0.25', parts: '1', fixed: false },
    { ref: 'F-03', area: 'Treppenhaus', severity: 'Kritisch', hours: '2', parts: '2', fixed: false },
  ],
  completeness: { complete: true, captured: 3 },
  consistency: 'host-captured',
  source: {
    provider: 'formancy-form',
    submissions: [{ id: SITE_VISIT_SUBMISSION_V2.id, form: 'site-visit', formHash: VERSION_2 }],
  },
}

export const SITE_VISIT_STARTER: Starter = {
  id: 'site-visit',
  title: 'Site visit',
  proves: 'a report generated from a formancy form version, which names that version, and a submission of it read into the draft against it',
  report: REPORT,
  data: DATA,
  parameters: {},
}
