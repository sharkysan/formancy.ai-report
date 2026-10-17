/**
 * A report's e-invoice resolved (0027): its lines and its totals before
 * anything is lowered, since the page prints them; and after the page is
 * lowered, in a final render, the XML the PDF embeds.
 *
 * 1. **The lines**, read once from the rows of the table that prints them
 *    (`e-invoice-lines.ts`), each column's value kept for the table to
 *    print.
 * 2. **The paid amount and the totals**, computed once from the lines
 *    (`e-invoice-totals.ts`) and bound as `invoice`, `vatBasis` and
 *    `vatAmount` for every scope that reads them.
 * 3. **The other terms**, read in the report's scope and held to EN
 *    16931's rules (`e-invoice-terms.ts`); a payment code is held to the
 *    amount due and the account they give (`e-invoice-payable.ts`).
 * 4. **The XML** (`cii.ts`), written from those very values.
 *
 * **A preview is not the invoice.** In Germany the XML a hybrid invoice
 * embeds is the invoice, so a preview writes none and the PDF that leaves
 * it is no e-invoice; it prints the totals of what it has, and warns
 * `e-invoice-preview` whatever data it has, so that every page carries a
 * preview label, complete data or not. A final render writes the XML or
 * refuses.
 */
import { FACTUR_X, FACTUR_X_PROFILES } from '@formancy/report-spec'
import type { EInvoice, EInvoiceKind, FacturXInvoice } from '@formancy/report-spec'
import { ciiXml } from './cii.js'
import type { CiiInvoice } from './cii.js'
import type { EInvoiceFile } from './document.js'
import { readLines, writtenLines } from './e-invoice-lines.js'
import { paidAmount, readTerms } from './e-invoice-terms.js'
import { invoiceNames, invoiceTotals } from './e-invoice-totals.js'
import type { InvoiceReads, Render } from './render-context.js'

/** An e-invoice resolved before lowering: what lowering reads, and what a final render writes its XML from. */
export interface ResolvedInvoice {
  readonly reads: InvoiceReads
  /** In a final render whose every term resolved, what the XML is written from; undefined in a preview, or where a term was refused, which is recorded. */
  readonly written: CiiInvoice | undefined
}

type Resolver<E extends EInvoice> = (render: Omit<Render, 'invoice'>, invoice: E) => ResolvedInvoice | undefined

function facturX(render: Omit<Render, 'invoice'>, invoice: FacturXInvoice): ResolvedInvoice | undefined {
  const read = readLines(render, invoice)
  const paid = paidAmount(render, invoice)
  if (read === undefined || paid === undefined) return undefined
  // A line a preview cannot place, its amount or its category lacking, is in no total.
  const placed = read.lines.flatMap(({ netAmount, category }) => (netAmount === null || category === null ? [] : [{ netAmount, category }]))
  const totals = invoiceTotals(invoice.vat, placed, paid)
  const { terms, account } = readTerms(
    render,
    invoice,
    totals.breakdown.map(({ category }) => category),
  )
  const lines = writtenLines(read.lines)
  const written = render.preview || terms === undefined || lines === undefined ? undefined : { profile: invoice.profile, type: invoice.type, currency: invoice.currency, terms, lines, totals }
  return { reads: { names: invoiceNames(invoice, totals), columns: read.columns, payable: { amount: totals.duePayable, account } }, written }
}

/** How each kind of e-invoice is resolved. A table over every kind, so a kind added to report-spec without a way down does not compile. */
const RESOLVERS: { readonly [K in EInvoiceKind]: Resolver<Extract<EInvoice, { kind: K }>> } = {
  facturX,
}

/**
 * `invoice`, `render`'s e-invoice, resolved before anything is lowered:
 * its lines, its totals and its terms. Undefined when its lines or its
 * totals could not be, which is recorded: nothing that prints them can be
 * lowered. A term refused is recorded, and leaves nothing to write.
 */
export function resolveEInvoice(render: Omit<Render, 'invoice'>, invoice: EInvoice): ResolvedInvoice | undefined {
  return RESOLVERS[invoice.kind](render, invoice)
}

/** What a preview of an e-invoice warns, whatever data it has. */
const PREVIEWED = 'this is a preview, which writes no e-invoice: a final render alone writes its XML, and this PDF is not the invoice'

/**
 * The file the PDF of `render` embeds, once its page is lowered: in a
 * final render the XML, named as report-spec names it; in a preview none,
 * and the warning that says so. Undefined too where anything was refused,
 * which refuses the document.
 *
 * A final render with nothing to write and nothing recorded would hand on
 * a document without its XML, which a renderer draws as a plain PDF: a
 * picture of an invoice handed over as though it were one. Every way to
 * nothing records an error first, so that is a defect, and throws.
 */
export function eInvoiceFile(render: Render, resolved: ResolvedInvoice, invoice: EInvoice): EInvoiceFile | undefined {
  if (render.preview) {
    render.problems.warn({ stage: 'resolve', code: 'e-invoice-preview', path: '/eInvoice', message: `the e-invoice: ${PREVIEWED}` })
    return undefined
  }
  if (render.problems.failed) return undefined
  if (resolved.written === undefined) throw new RangeError('a final render of an e-invoice wrote no XML and recorded no reason: a defect, refused rather than drawn as a plain PDF')
  const profile = FACTUR_X_PROFILES[invoice.profile]
  return { xml: ciiXml(resolved.written), fileName: FACTUR_X.fileName, relationship: profile.relationship, conformanceLevel: profile.conformanceLevel }
}
