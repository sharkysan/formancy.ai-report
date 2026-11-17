/**
 * The reports the Studio opens: the corpus's starters, plan 7's three
 * (R19), the invoice with its QR-bill, the invoice with its EPC QR code,
 * the e-invoice (0044) and the same invoice terms as an XRechnung beside
 * it (0065), the site visit generated from a formancy form (0045), and the
 * order confirmation and the product data sheet (0064), each with its
 * synthetic data, and a blank report to build from nothing.
 */
import { editorText } from '@formancy/report-builder-core'
import type { MessageId } from '@formancy/report-builder-core'
import type { ReportDefinition } from '@formancy/report-runtime'
import { emptyReport } from '@formancy/report-spec'
import type { StudioStarter } from './codec.js'

/** An empty A4 page, nothing declared: what Blank opens, with the data envelope of a report that reads none. */
export const BLANK: StudioStarter = {
  id: 'blank',
  title: 'Blank report',
  proves: 'nothing yet: an empty page to build on',
  report: emptyReport('blank', 'Blank report', 'en-GB'),
  data: { completeness: { complete: true, captured: 0 }, consistency: 'host-captured' },
  parameters: {},
}

/** The corpus's starters, in its order, then Blank. */
export function studioStarters(corpus: readonly StudioStarter[]): readonly StudioStarter[] {
  return [...corpus, BLANK]
}

/** The bar's words, which are English: the builder's, where it has the word. */
const WORDS = editorText('en')

/** The builder's word for each kind of e-invoice, as its heading names it: "Factur-X: E-invoice" (0044). */
const KIND: Readonly<Record<NonNullable<ReportDefinition['eInvoice']>['kind'], MessageId>> = { facturX: 'kind.facturX', xrechnung: 'kind.xrechnung' }

/**
 * What the picker calls a starter. An e-invoice, by its kind, in the
 * builder's words: "E-invoice (Factur-X)" and "E-invoice (XRechnung)",
 * one template's terms in either kind, side by side (0065). Any other, from
 * its id: 'grouped-equipment' is "Grouped equipment".
 */
export function starterLabel(starter: Pick<StudioStarter, 'id' | 'report'>): string {
  const invoice = starter.report.eInvoice
  if (invoice !== undefined) return `${WORDS('outline.eInvoice')} (${WORDS(KIND[invoice.kind])})`
  const words = starter.id.split('-').join(' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}
