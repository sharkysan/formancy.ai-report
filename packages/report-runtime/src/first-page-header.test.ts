import type { Component, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { ReportData } from './data.js'
import type { Block, ResolvedDocument } from './document.js'
import { E_INVOICE_PREVIEW_LABEL, PREVIEW_LABEL, resolveReport, XRECHNUNG_COPY_PARAGRAPH } from './resolve.js'
import type { ResolveOptions } from './resolve.js'
import { invoiceData, invoiceReport, invoiceRow, sampleData, sampleReport, sampleRow, xrechnungData, xrechnungReport } from './test-support.js'

/**
 * A first page's own header, resolved (0060): present in the document
 * exactly when the report has one, lowered component by component as the
 * page header is, its conditions read once, and headed with every label
 * the page header carries, so that page 1 still says what a reader must
 * know. The renderer draws it on page 1 in the page header's place; what
 * it prints there is proved on the PDF, in report-render-pdf.
 */

const FINAL: ResolveOptions = { mode: 'final', parameters: { from: '2026-01-01' }, creationDate: '2026-10-15T08:00:00Z' }
const PREVIEW: ResolveOptions = { ...FINAL, mode: 'preview' }
/** The invoices declare no parameter. */
const INVOICE_FINAL: ResolveOptions = { mode: 'final', creationDate: '2026-10-15T08:00:00Z' }
const INVOICE_PREVIEW: ResolveOptions = { ...INVOICE_FINAL, mode: 'preview' }

const words = (id: string, text: string, extra: Partial<Component> = {}): Component =>
  ({ id, kind: 'text', content: [{ kind: 'text', text }], ...extra }) as Component

/** `report` with `firstPageHeader` as page 1's own header and `pageHeader` as the running one. */
function headed(report: ReportDefinition, firstPageHeader: readonly Component[] | undefined, pageHeader: readonly Component[] = []): ReportDefinition {
  const { firstPageHeader: _none, ...regions } = report.regions
  return {
    ...report,
    regions: { ...regions, pageHeader: [...pageHeader], ...(firstPageHeader === undefined ? {} : { firstPageHeader: [...firstPageHeader] }) },
  }
}

function resolved(report: ReportDefinition, data: ReportData, options: ResolveOptions = FINAL): ResolvedDocument {
  const outcome = resolveReport(report, data, options)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}

const text = (block: Block | undefined): string => (block?.kind === 'paragraph' ? block.runs.map((run) => ('text' in run ? run.text : '')).join('') : '')

describe('a report without a first page header', () => {
  // Every report that was is the same report: its document has no
  // `firstPageHeader` at all, not an empty one, which the renderer would
  // read as page 1's header that is none and print page 1 without the page
  // header.
  test('resolves to a document without one, its regions as before', () => {
    const report = headed(sampleReport(), undefined, [words('running', 'Deliveries')])
    const document = resolved(report, sampleData())
    expect(Object.keys(document)).toEqual(['info', 'page', 'pageHeader', 'pageFooter', 'body'])
    expect(document.pageHeader.map(text)).toEqual(['Deliveries'])
    expect('firstPageHeader' in resolved(sampleReport(), sampleData([sampleRow()]), PREVIEW)).toBe(false)
  })
})

describe('a first page header', () => {
  // Page 1's own header is lowered as the page header is: each component
  // to the block it prints, in the report's scope, and a component whose
  // condition does not hold prints nothing. The page header beside it is
  // lowered as it always was, for the pages after the first.
  test('resolves to the blocks its components print, a hidden one left out, beside the page header', () => {
    const own = [
      {
        id: 'order',
        kind: 'text',
        content: [
          { kind: 'text', text: 'Order ' },
          { kind: 'field', field: { dataset: 'header', field: 'reference' } },
        ],
      } as Component,
      words('draft-mark', 'Draft', { visibleWhen: { cel: 'params.draft' } }),
    ]
    const document = resolved(headed(sampleReport(), own, [words('running', 'Deliveries, continued')]), sampleData())
    expect(document.firstPageHeader?.map(text)).toEqual(['Order 42'])
    expect(document.pageHeader.map(text)).toEqual(['Deliveries, continued'])
    expect(Object.keys(document)).toEqual(['info', 'page', 'firstPageHeader', 'pageHeader', 'pageFooter', 'body'])
  })

  // None is an empty first page header, and is kept apart from no first
  // page header: an empty list, so that page 1 prints no header, never the
  // page header. A first page header whose every component is hidden this
  // render is none too: the choice is the report's, never the data's.
  test('resolves to an empty list for none, and for one whose every component is hidden', () => {
    expect(resolved(headed(sampleReport(), [], [words('running', 'Deliveries')]), sampleData()).firstPageHeader).toEqual([])
    const hidden = [words('draft-mark', 'Draft', { visibleWhen: { cel: 'params.draft' } })]
    const document = resolved(headed(sampleReport(), hidden, [words('running', 'Deliveries')]), sampleData())
    expect(document.firstPageHeader).toEqual([])
    expect(document.pageHeader.map(text)).toEqual(['Deliveries'])
  })
})

describe("a first page header's labels", () => {
  const incomplete = (): ReportData => ({ ...sampleData([sampleRow(), sampleRow({ sku: 'B-2' })]), completeness: { complete: false, captured: 2, cap: 2 } })
  const LINES = [invoiceRow()]

  // A preview of incomplete data says so on every page: page 1 prints its
  // own header in the page header's place, so the label heads it too, and
  // page 1's header that is none is the label alone. Without it page 1 of
  // a preview would read as the final report.
  test("heads a preview's own header, and its none, with the preview's label", () => {
    const document = resolved(headed(sampleReport(), [words('mark', 'Letterhead')], [words('running', 'Deliveries')]), incomplete(), PREVIEW)
    expect(document.firstPageHeader?.map(text)).toEqual([PREVIEW_LABEL, 'Letterhead'])
    expect(document.pageHeader.map(text)).toEqual([PREVIEW_LABEL, 'Deliveries'])
    expect(resolved(headed(sampleReport(), []), incomplete(), PREVIEW).firstPageHeader?.map(text)).toEqual([PREVIEW_LABEL])
    // Each header has a label of its own: the renderer names a block by where it stands, and one block in two places would have one name.
    expect(document.firstPageHeader?.[0]).not.toBe(document.pageHeader[0])
  })

  // A preview of an e-invoice writes no XML and is labelled so on every
  // page; and a final render of an XRechnung is a copy, which the renderer
  // refuses unless every header it draws opens with the copy's paragraph
  // as the runtime writes it (0038).
  test("heads an e-invoice preview's own header with its label, and an XRechnung's with the copy's paragraph", () => {
    const preview = resolved(headed(invoiceReport(), []), invoiceData(LINES), INVOICE_PREVIEW)
    expect(preview.firstPageHeader?.map(text)).toEqual([E_INVOICE_PREVIEW_LABEL])
    const copy = resolved(headed(xrechnungReport(), [words('mark', 'Letterhead')]), xrechnungData(LINES), INVOICE_FINAL)
    expect(copy.firstPageHeader?.[0]).toEqual(XRECHNUNG_COPY_PARAGRAPH)
    expect(copy.firstPageHeader?.map(text).slice(1)).toEqual(['Letterhead'])
    expect(copy.pageHeader[0]).toEqual(XRECHNUNG_COPY_PARAGRAPH)
    // A Factur-X invoice's final render is the invoice, and labels neither header.
    expect(resolved(headed(invoiceReport(), [words('mark', 'Letterhead')]), invoiceData(LINES), INVOICE_FINAL).firstPageHeader?.map(text)).toEqual([
      'Letterhead',
    ])
  })
})
