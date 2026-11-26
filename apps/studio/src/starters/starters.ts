/**
 * The reports the Studio opens: the corpus's starters, plan 7's three
 * (R19), the invoice with its QR-bill, the invoice with its EPC QR code,
 * the e-invoice (0044) and its template as an XRechnung beside it, billing
 * a buyer of its own (0065), the site visit generated from a formancy form (0045), the
 * order confirmation and the product data sheet (0064), the payment
 * reminder (0066), and the monthly sales report with its charts (0067),
 * each with its synthetic data, and a blank report to build from nothing.
 * The Studio opens on the invoice, which the picker lists first (0082).
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

/**
 * The starter the Studio opens on, by its corpus id: the invoice, which
 * prints what a business sends -- the firm's mark, its lines, VAT and the
 * total, and the Swiss QR-bill that pays it -- on one page. The corpus's
 * first, the service inspection, is a stress test of long text over two
 * pages, and was a visitor's first look until 0082.
 */
export const OPENS_ON = 'invoice'

/**
 * What the picker lists, in its order: the starter the Studio opens on
 * (`OPENS_ON`), then the corpus's others in the corpus's order, which is
 * plan 7's and stays every other reader's, then Blank. The Studio opens on
 * the first it is given. A corpus without that starter is refused, rather
 * than opened on whichever came first.
 */
export function studioStarters(corpus: readonly StudioStarter[]): readonly StudioStarter[] {
  const first = corpus.find((starter) => starter.id === OPENS_ON)
  if (first === undefined) throw new Error(`the Studio opens on the starter "${OPENS_ON}", and the corpus holds none of that id`)
  return [first, ...corpus.filter((starter) => starter !== first), BLANK]
}

/** The bar's words, which are English: the builder's, where it has the word. */
const WORDS = editorText('en')

/** The builder's word for each kind of e-invoice, as its heading names it: "Factur-X: E-invoice" (0044). */
const KIND: Readonly<Record<NonNullable<ReportDefinition['eInvoice']>['kind'], MessageId>> = { facturX: 'kind.facturX', xrechnung: 'kind.xrechnung' }

/**
 * What the picker calls a starter. An e-invoice, by its kind, in the
 * builder's words: "E-invoice (Factur-X)" and "E-invoice (XRechnung)",
 * one template in both kinds, each billing its own buyer (0065). Any other, from
 * its id: 'grouped-equipment' is "Grouped equipment".
 */
export function starterLabel(starter: Pick<StudioStarter, 'id' | 'report'>): string {
  const invoice = starter.report.eInvoice
  if (invoice !== undefined) return `${WORDS('outline.eInvoice')} (${WORDS(KIND[invoice.kind])})`
  const words = starter.id.split('-').join(' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}
