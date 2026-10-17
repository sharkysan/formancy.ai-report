/**
 * What the tests build editors from. Only test files import this; the
 * published entry never reaches it.
 *
 * `richReport` is one valid report that holds every component kind, a table
 * with columns and a group, every kind of run in a text, and containers
 * nested in each region that may hold them, so that an outline, a canvas, a
 * property panel or a list of drop targets can be shown to cover them all.
 */
import { openReportSession } from '@formancy/report-core'
import type { ReportSession } from '@formancy/report-core'
import { validateReport } from '@formancy/report-spec'
import type { FieldRef, PaymentPart, ReportDefinition } from '@formancy/report-spec'
import { createReportEditor } from './editor.js'
import type { ReportEditor, ReportEditorOptions } from './editor.js'

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const detail = (field: string): FieldRef => ({ dataset: 'detail', field })

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
      // The EPC's first example (EPC069-12 v3.1 2.3), its BIC, name, IBAN
      // and purpose, paying the report's total, with a remittance text of
      // two runs where the example has a reference, in Austria's frame.
      {
        id: 'pay-code',
        kind: 'epcQrCode',
        size: 85.04,
        beneficiary: [{ kind: 'text', text: 'Franz Mustermänn' }],
        iban: [{ kind: 'text', text: 'DE71 1102 2033 0123 4567 89' }],
        bic: [{ kind: 'text', text: 'BHBLDEHHXXX' }],
        amount: { cel: 'totals.total' },
        purpose: 'GDDS',
        text: [{ kind: 'text', text: 'Orders for ' }, { kind: 'field', field: header('customer') }],
        caption: 'zahlenMitCode',
      },
    ],
  },
}

/** A fresh, mutable copy of the rich report, checked valid. */
export function richReport(): ReportDefinition {
  const copy = JSON.parse(JSON.stringify(RICH)) as ReportDefinition
  const outcome = validateReport(copy)
  if (!outcome.valid) throw new Error(`the rich report is not valid: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return copy
}

/**
 * A Swiss QR-bill for the rich report: SIX's second example (IG 2.4, Annex
 * A), a QR-IBAN with a QR reference, its debtor read from the header and its
 * amount the report's total.
 */
export function richBill(): PaymentPart {
  return {
    kind: 'swissQrBill',
    language: 'de',
    account: [{ kind: 'text', text: 'CH44 3199 9123 0008 8901 2' }],
    creditor: {
      name: [{ kind: 'text', text: 'Max Muster & Söhne' }],
      street: [{ kind: 'text', text: 'Musterstrasse' }],
      buildingNumber: [{ kind: 'text', text: '123' }],
      postalCode: [{ kind: 'text', text: '8000' }],
      town: [{ kind: 'text', text: 'Seldwyla' }],
      country: [{ kind: 'text', text: 'CH' }],
    },
    currency: 'CHF',
    amount: { cel: 'totals.total' },
    debtor: {
      name: [{ kind: 'field', field: header('customer') }],
      postalCode: [{ kind: 'text', text: '8000' }],
      town: [{ kind: 'text', text: 'Seldwyla' }],
      country: [{ kind: 'text', text: 'CH' }],
    },
    reference: [{ kind: 'text', text: '21 00000 00003 13947 14300 09017' }],
    message: [{ kind: 'text', text: 'Orders' }],
  }
}

/**
 * The rich report with `richBill` for its payment part, checked valid. An
 * invoice is paid by its bill or by an EPC code, so it holds no EPC code,
 * and its regions stand on the page above the slip.
 */
export function billedReport(): ReportDefinition {
  const rich = richReport()
  const summary = rich.regions.summary.filter((component) => component.kind !== 'epcQrCode')
  const report = { ...rich, regions: { ...rich.regions, summary }, paymentPart: richBill() }
  const outcome = validateReport(report)
  if (!outcome.valid) throw new Error(`the billed report is not valid: ${outcome.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return report
}

/** A session over `report`; fails the test when it does not open. */
export function sessionOver(report: unknown): ReportSession {
  const opening = openReportSession(report)
  if (!opening.ok) throw new Error(`the report did not open: ${opening.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return opening.session
}

/** An editor over a new session of `report` (the rich report when absent), and the session. */
export function editorOver(report: ReportDefinition = richReport(), options: ReportEditorOptions = {}): { readonly editor: ReportEditor; readonly session: ReportSession } {
  const session = sessionOver(report)
  return { editor: createReportEditor(session, options), session }
}

/** Every string anywhere in `value`: what a state could put on a page. */
export function stringsIn(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') into.add(value)
  else if (typeof value === 'object' && value !== null) for (const child of Object.values(value)) stringsIn(child, into)
  return into
}

/**
 * `session` with its subscriptions counted: what plan 21's "destroying a
 * builder removes its subscriptions" is checked with, from outside.
 */
export function countingSession(session: ReportSession): { readonly session: ReportSession; readonly live: () => number } {
  let live = 0
  const counted: ReportSession = {
    ...session,
    subscribe(listener) {
      live += 1
      const unsubscribe = session.subscribe(listener)
      let subscribed = true
      return () => {
        if (!subscribed) return
        subscribed = false
        live -= 1
        unsubscribe()
      }
    },
  }
  return { session: counted, live: () => live }
}
