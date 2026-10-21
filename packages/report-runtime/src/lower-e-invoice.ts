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
 *
 * **Both kinds are resolved alike** (0038): an XRechnung's terms are EN
 * 16931's, read by the same readers under its kind's rules, and written by
 * the same writer, its specification identifier apart. What differs is
 * the file the document carries: a Factur-X file a PDF/A-3b embeds, or an
 * XRechnung's XML a host takes and sends.
 */
import { FACTUR_X, FACTUR_X_PROFILES, XRECHNUNG } from '@formancy/report-spec'
import type { EInvoice, EInvoiceKind } from '@formancy/report-spec'
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

/** BT-24 of each kind: a Factur-X profile's identifier, or an XRechnung version's. A table over every kind, so a kind added without one does not compile. */
const GUIDELINES: { readonly [K in EInvoiceKind]: (invoice: Extract<EInvoice, { kind: K }>) => string } = {
  facturX: (invoice) => FACTUR_X_PROFILES[invoice.profile].guideline,
  xrechnung: (invoice) => XRECHNUNG[invoice.version].guideline,
}

/** The guideline of `invoice`, by its kind. */
const guidelineOf = (invoice: EInvoice): string => (GUIDELINES[invoice.kind] as (invoice: EInvoice) => string)(invoice)

/**
 * `invoice`, `render`'s e-invoice, resolved before anything is lowered,
 * whatever its kind: its lines, its totals and its terms, each held to its
 * kind's rules, and in a final render whose every term resolved what its
 * XML is written from. Undefined when its lines or its totals could not
 * be, which is recorded: nothing that prints them can be lowered. A term
 * refused is recorded, and leaves nothing to write.
 */
export function resolveEInvoice(render: Omit<Render, 'invoice'>, invoice: EInvoice): ResolvedInvoice | undefined {
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
  const written = render.preview || terms === undefined || lines === undefined ? undefined : { guideline: guidelineOf(invoice), type: invoice.type, currency: invoice.currency, terms, lines, totals }
  return { reads: { names: invoiceNames(invoice, totals), columns: read.columns, payable: { amount: totals.duePayable, account } }, written }
}

/**
 * The file of each kind, around its XML: Factur-X's, named as report-spec
 * names the file a PDF/A-3b embeds [S]; an XRechnung's, standalone, named
 * by its syntax, guideline and version. A table over every kind.
 */
const FILES: { readonly [K in EInvoiceKind]: (invoice: Extract<EInvoice, { kind: K }>, xml: string) => EInvoiceFile } = {
  facturX: (invoice, xml) => {
    const profile = FACTUR_X_PROFILES[invoice.profile]
    return { kind: 'facturX', xml, fileName: FACTUR_X.fileName, relationship: profile.relationship, conformanceLevel: profile.conformanceLevel }
  },
  xrechnung: (invoice, xml) => {
    const version = XRECHNUNG[invoice.version]
    return { kind: 'xrechnung', xml, syntax: version.syntax, guideline: version.guideline, version: invoice.version }
  },
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
  return (FILES[invoice.kind] as (invoice: EInvoice, xml: string) => EInvoiceFile)(invoice, ciiXml(resolved.written))
}
