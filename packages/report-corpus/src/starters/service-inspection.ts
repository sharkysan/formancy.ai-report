import { createHash } from 'node:crypto'
import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { encodePng } from '../fixtures/png.js'
import type { Starter, StarterImage } from './starter.js'

/**
 * The service or inspection report (plan 7): what a technician recorded on
 * a visit, turned into one consistent document. It proves long text that
 * flows over pages, a section that prints only when there is a defect, a
 * bounded photograph from the data, and a signature line.
 *
 * The photo, when there is one, and the sign-off stand together on one
 * page, after a sentence saying what is signed: so the last page never
 * holds signature lines alone, under nothing they sign. Without a photo,
 * neither its heading nor its box prints. An expression reads no image
 * field (0009), so the visit says whether a photo was taken.
 *
 * The photograph is an image field: its value is an approved asset's id and
 * digest, and the bytes are the host's to hand over (`STARTER_IMAGES`),
 * never fetched by the report.
 */

const header = (field: string) => ({ dataset: 'header', field }) as const

/** A photo made in code: a 160 by 120 gradient, so the starter carries no binary file. */
const PHOTO_BYTES = encodePng(160, 120, (x, y) => [40 + x, 80 + y, 160] as const)

export const INSPECTION_PHOTO: StarterImage = {
  asset: 'inspection-photo-0415',
  digest: `sha256:${createHash('sha256').update(PHOTO_BYTES).digest('hex')}`,
  mediaType: 'image/png',
  bytes: PHOTO_BYTES,
}

const REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'service-inspection',
  title: 'Service inspection report',
  locale: 'en-GB',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [
    { id: 'title', font: 'sans', size: 16, bold: true },
    { id: 'heading', size: 11, bold: true },
    { id: 'body', size: 9.5 },
    { id: 'small', size: 8, color: '#555555' },
    { id: 'footer', size: 8, align: 'center' },
    { id: 'defect', bold: true, color: '#b00020' },
  ],
  datasets: {
    header: {
      id: 'inspection',
      fields: [
        { id: 'reference', type: 'string', label: 'Reference', nullable: false },
        { id: 'customer', type: 'string', label: 'Customer', nullable: false },
        { id: 'site', type: 'string', label: 'Site', nullable: false },
        { id: 'inspectedOn', type: 'date', label: 'Inspected on', nullable: false },
        { id: 'inspector', type: 'string', label: 'Inspector', nullable: false },
        { id: 'notes', type: 'string', label: 'Notes', nullable: false },
        { id: 'defectFound', type: 'boolean', label: 'Defect found', nullable: false },
        { id: 'defect', type: 'string', label: 'Defect', nullable: true },
        { id: 'photo', type: 'image', label: 'Photo', nullable: true },
        { id: 'hasPhoto', type: 'boolean', label: 'Photo taken', nullable: false },
      ],
    },
  },
  parameters: [],
  assets: [],
  aggregates: [],
  regions: {
    pageHeader: [
      {
        id: 'running-head',
        kind: 'text',
        style: 'small',
        content: [{ kind: 'text', text: 'Service inspection ' }, { kind: 'field', field: header('reference') }, { kind: 'text', text: ' · ' }, { kind: 'field', field: header('customer') }],
      },
    ],
    reportHeader: [
      { id: 'title', kind: 'text', style: 'title', content: [{ kind: 'text', text: 'Service inspection report' }] },
      {
        id: 'visit',
        kind: 'columns',
        style: 'body',
        columns: [
          {
            width: 'fill',
            components: [
              { id: 'customer', kind: 'text', content: [{ kind: 'text', text: 'Customer: ' }, { kind: 'field', field: header('customer') }] },
              { id: 'site', kind: 'text', content: [{ kind: 'text', text: 'Site: ' }, { kind: 'field', field: header('site') }] },
            ],
          },
          {
            width: 'fill',
            components: [
              { id: 'date', kind: 'text', content: [{ kind: 'text', text: 'Date: ' }, { kind: 'field', field: header('inspectedOn'), format: { kind: 'date', style: 'long' } }] },
              { id: 'inspector', kind: 'text', content: [{ kind: 'text', text: 'Inspector: ' }, { kind: 'field', field: header('inspector') }] },
            ],
          },
        ],
      },
      { id: 'head-rule', kind: 'line', thickness: 0.5, color: '#999999' },
    ],
    body: [
      { id: 'notes-heading', kind: 'text', style: 'heading', keepWithNext: true, content: [{ kind: 'text', text: 'Notes' }] },
      { id: 'notes', kind: 'text', style: 'body', content: [{ kind: 'field', field: header('notes') }] },
      {
        id: 'defects',
        kind: 'section',
        visibleWhen: { cel: 'header.defectFound' },
        border: { thickness: 1, color: '#b00020' },
        padding: 6,
        components: [
          { id: 'defect-heading', kind: 'text', style: 'defect', keepWithNext: true, content: [{ kind: 'text', text: 'Defect found' }] },
          { id: 'defect', kind: 'text', style: 'body', content: [{ kind: 'field', field: header('defect') }] },
        ],
      },
    ],
    summary: [
      {
        id: 'sign-off',
        kind: 'keepTogether',
        components: [
          { id: 'photo-heading', kind: 'text', style: 'heading', visibleWhen: { cel: 'header.hasPhoto' }, content: [{ kind: 'text', text: 'Photo' }] },
          { id: 'photo', kind: 'image', visibleWhen: { cel: 'header.hasPhoto' }, source: { kind: 'field', field: header('photo') }, width: 240, height: 180, fit: 'contain' },
          { id: 'statement-gap', kind: 'spacer', height: 12 },
          {
            id: 'statement',
            kind: 'text',
            style: 'body',
            content: [
              { kind: 'text', text: 'Inspected as recorded above by ' },
              { kind: 'field', field: header('inspector') },
              { kind: 'text', text: ' on ' },
              { kind: 'field', field: header('inspectedOn'), format: { kind: 'date', style: 'long' } },
              { kind: 'text', text: '.' },
            ],
          },
          { id: 'sign-gap', kind: 'spacer', height: 12 },
          {
            id: 'signatures',
            kind: 'columns',
            columns: [
              {
                width: 200,
                components: [
                  { id: 'signature-space', kind: 'spacer', height: 28 },
                  { id: 'signature-line', kind: 'line', thickness: 0.75 },
                  { id: 'signature-label', kind: 'text', style: 'small', content: [{ kind: 'text', text: "Inspector's signature" }] },
                ],
              },
              { width: 'fill', components: [] },
              {
                width: 160,
                components: [
                  { id: 'place-space', kind: 'spacer', height: 28 },
                  { id: 'place-line', kind: 'line', thickness: 0.75 },
                  { id: 'place-label', kind: 'text', style: 'small', content: [{ kind: 'text', text: 'Place and date' }] },
                ],
              },
            ],
          },
        ],
      },
    ],
    pageFooter: [
      { id: 'page-of', kind: 'text', style: 'footer', content: [{ kind: 'text', text: 'Page ' }, { kind: 'pageNumber' }, { kind: 'text', text: ' of ' }, { kind: 'pageCount' }] },
    ],
  },
  provenance: { kind: 'blank' },
}

const OBSERVATIONS = [
  'the supply fan runs smoothly and its bearings are quiet at full speed',
  'the filter differential pressure is within the range the maintainer gives',
  'the condensate tray is clean and drains freely into the siphon',
  'the heat recovery wheel turns evenly and its seals show only light wear',
  'the control panel logs no alarms since the last service visit',
  'the duct insulation in the plant room is intact along its whole length',
]

/** The notes a technician wrote: `count` numbered observations, `N01` to `Nnn`, each a sentence a reader can find once. */
export function inspectionNotes(count: number): string {
  return Array.from({ length: count }, (_, index) => {
    const label = `N${String(index + 1).padStart(2, '0')}`
    return `${label}: at check point ${index + 1}, ${OBSERVATIONS[index % OBSERVATIONS.length]}, and nothing further was found that needs a follow-up visit.`
  }).join(' ')
}

/** One visit: with a defect or without, `notes` observations long, with its photo or without one. */
export function inspectionData({ defect = true, notes = 60, photo = true }: { readonly defect?: boolean; readonly notes?: number; readonly photo?: boolean } = {}): ReportData {
  return {
    header: {
      reference: 'INS-2026-0415',
      customer: 'Bäckerei Müller AG',
      site: 'Hauptstrasse 12, 3011 Bern',
      inspectedOn: '2026-10-15',
      inspector: 'Anna Schär',
      notes: inspectionNotes(notes),
      defectFound: defect,
      defect: defect ? 'The belt of the exhaust fan is cracked and must be replaced within 30 days.' : null,
      photo: photo ? { asset: INSPECTION_PHOTO.asset, digest: INSPECTION_PHOTO.digest } : null,
      hasPhoto: photo,
    },
    completeness: { complete: true, captured: 0 },
    consistency: 'host-captured',
  }
}

export const SERVICE_INSPECTION: Starter = {
  id: 'service-inspection',
  title: 'Service inspection report',
  proves: 'long text over pages, a section shown only when a defect exists, a bounded photo from the data, a signature line',
  report: REPORT,
  data: inspectionData(),
  parameters: {},
}
