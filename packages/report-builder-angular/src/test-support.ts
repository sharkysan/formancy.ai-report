/**
 * What the tests open sessions with and audit a page with. Only test files
 * import this; the published entry never reaches it.
 */
import { scenarioReport } from '@formancy/report-builder-core'
import { openReportSession } from '@formancy/report-core'
import type { ReportSession } from '@formancy/report-core'
import type { FieldRef, ReportDefinition } from '@formancy/report-spec'
import axe from 'axe-core'
import { expect } from 'vitest'

/** A session over `report`; fails the test, with the validator's errors, when it does not open. */
export function sessionOver(report: unknown): ReportSession {
  const opening = openReportSession(report)
  expect(opening).toMatchObject({ ok: true })
  return (opening as Extract<typeof opening, { readonly ok: true }>).session
}

/** A session over the report every builder scenario starts from. */
export function scenarioSession(): ReportSession {
  return sessionOver(scenarioReport())
}

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const detail = (field: string): FieldRef => ({ dataset: 'detail', field })

/**
 * One report that holds every component kind, a table with columns and a
 * group, every kind of run in a text, and containers nested in each region
 * that may hold them -- report-builder-core's own test report, so a
 * property panel can be shown to cover every kind of field there is.
 */
const RICH: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'orders',
  title: 'Orders',
  locale: 'de-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [
    { id: 'title', size: 18, bold: true },
    { id: 'small', size: 8 },
  ],
  datasets: {
    header: {
      id: 'order-header',
      fields: [
        { id: 'customer', type: 'string', label: 'Customer', nullable: false },
        { id: 'signature', type: 'image', label: 'Signature', nullable: true },
      ],
    },
    detail: {
      id: 'order-lines',
      fields: [
        { id: 'site', type: 'string', label: 'Site', nullable: false },
        { id: 'sku', type: 'string', label: 'SKU', nullable: false },
        { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
      ],
    },
  },
  parameters: [{ id: 'from', type: 'date', label: 'From', required: true }],
  assets: [{ id: 'logo', mediaType: 'image/png', digest: `sha256:${'ab'.repeat(32)}` }],
  aggregates: [{ id: 'total', fn: 'sum', of: { kind: 'field', field: detail('amount') } }],
  regions: {
    reportHeader: [
      {
        id: 'heading',
        kind: 'columns',
        columns: [
          { width: 120, components: [{ id: 'logo-image', kind: 'image', source: { kind: 'asset', asset: 'logo' }, width: 100, height: 40, fit: 'contain' }] },
          { width: 'fill', components: [{ id: 'title', kind: 'text', style: 'title', content: [{ kind: 'text', text: 'Orders for ' }, { kind: 'field', field: header('customer') }] }] },
        ],
      },
      { id: 'rule', kind: 'line', thickness: 0.5, color: '#999999' },
    ],
    pageHeader: [{ id: 'running', kind: 'text', style: 'small', content: [{ kind: 'parameter', parameter: 'from' }] }],
    body: [
      { id: 'intro', kind: 'text', visibleWhen: { cel: 'params.from != ""' }, content: [{ kind: 'text', text: 'Introduction' }] },
      { id: 'gap', kind: 'spacer', height: 12 },
      {
        id: 'lines',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'sku', header: 'SKU', width: 80, align: 'left', value: { kind: 'field', field: detail('sku') } },
          { id: 'amount', header: 'Amount', width: 'fill', align: 'right', value: { kind: 'field', field: detail('amount') } },
        ],
        group: { by: detail('site'), direction: 'asc', header: [{ kind: 'field', field: detail('site') }], footer: [] },
        totals: [{ cells: [{ column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'report' } }] }],
        emptyText: 'No lines.',
        repeatHeader: true,
      },
      {
        id: 'notes',
        kind: 'section',
        padding: 6,
        border: { thickness: 0.5, color: '#333333' },
        components: [
          { id: 'note', kind: 'text', content: [{ kind: 'text', text: 'Note' }] },
          { id: 'box', kind: 'rectangle', width: 200, height: 40, fill: '#eeeeee' },
        ],
      },
      { id: 'keep', kind: 'keepTogether', components: [{ id: 'kept', kind: 'text', content: [{ kind: 'expression', expression: { cel: 'header.customer' } }] }] },
      { id: 'break', kind: 'pageBreak' },
    ],
    pageFooter: [{ id: 'page-of', kind: 'text', content: [{ kind: 'text', text: 'Page ' }, { kind: 'pageNumber' }, { kind: 'text', text: ' of ' }, { kind: 'pageCount' }] }],
    summary: [
      { id: 'signature-image', kind: 'image', source: { kind: 'field', field: header('signature') }, width: 150, height: 50, fit: 'contain' },
      { id: 'order-code', kind: 'qrCode', content: [{ kind: 'text', text: 'Orders for ' }, { kind: 'field', field: header('customer') }], size: 85.04, errorCorrection: 'Q' },
    ],
  },
}

/** A session over a fresh copy of the rich report. */
export function richSession(): ReportSession {
  return sessionOver(JSON.parse(JSON.stringify(RICH)))
}

/**
 * `session` with its subscriptions counted from outside: what "destroying a
 * builder leaves no subscription behind" is checked with, through the
 * session rather than through anything the builder says about itself.
 */
export function countingSession(session: ReportSession): { readonly session: ReportSession; readonly live: () => number } {
  let live = 0
  const counted: ReportSession = {
    ...session,
    subscribe(listener) {
      live += 1
      const unsubscribe = session.subscribe(listener)
      return () => {
        live -= 1
        unsubscribe()
      }
    },
  }
  return { session: counted, live: () => live }
}

/**
 * Rules that cannot be measured in jsdom, each with the reason, as
 * formancy.ai's conformance policy keeps them: jsdom has no layout and no
 * computed colour. They are left for the browser, not passed here.
 */
const UNMEASURABLE_IN_JSDOM: Readonly<Record<string, string>> = {
  'color-contrast': 'jsdom has no layout and no computed colour.',
  'target-size': 'WCAG 2.2 SC 2.5.8 is a measurement in CSS pixels, and jsdom measures everything as zero.',
}

/**
 * axe over the whole document, at WCAG 2.2 AA and what it subsumes --
 * formancy.ai's conformance tags, so the builders are held to the standard
 * formancy's own are. The body, not the builder's host: the place chooser
 * and the live region are as much the builder as its tree is.
 */
export async function audit(): Promise<readonly string[]> {
  const results = await axe.run(document.body, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    rules: Object.fromEntries(Object.keys(UNMEASURABLE_IN_JSDOM).map((id) => [id, { enabled: false }])),
    resultTypes: ['violations'],
  })
  return results.violations.map((violation) => `${violation.id}: ${violation.help} -- ${violation.nodes.map((node) => node.html).join(' | ')}`)
}
