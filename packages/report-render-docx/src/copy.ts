import { readCopyLabel, RenderRefusal, type Paragraph, type ResolvedDocument } from '@formancy/report-runtime'
import type { ParagraphNode } from './nodes.js'

/**
 * A copy of an e-invoice in a Word file (0077). An e-invoice is the
 * PDF/A-3b that embeds its XML, or the XML a host sends; a Word file,
 * which a person may change and which embeds nothing, is neither. What
 * is written is the copy the runtime resolves where a host asks for one
 * (`eInvoice: 'copy'`): the invoice's page, every header of which opens
 * with the runtime's label -- that this is a copy, that it is not the
 * invoice, and what the invoice is -- and which carries no XML.
 *
 * The label is the runtime's, in the render's language, and the writer
 * decides no word of it: it reads it (`readCopyLabel`), holds every
 * header to it, and writes it once more where the runtime could not, on
 * the page of a QR-bill's slip, which is a section of the file's own
 * with a header of its own (0075).
 *
 * **Refused**, each `unsupported`, before any block is walked: a page
 * header that opens with a copy's words printed otherwise than the
 * runtime writes them, in white or at one point, which say nothing to a
 * reader; page 1's own header (0060), where the document has one, that
 * does not open with the same label as written; and a label on page 1's
 * own header alone. The runtime labels every header, so each is a
 * document made otherwise. A document that is no copy is none of this,
 * and one that carries its e-invoice is refused before it (`pdf-only.ts`).
 */

/** Where a copy's label stands on a slip's page: 5 mm from the paper's top and from its sides, the margin SIX keeps clear around a slip's sections. */
export const COPY_LABEL_INSET = (5 * 72) / 25.4

const refusal = (message: string, subject: 'pageHeader' | 'firstPageHeader'): RenderRefusal => new RenderRefusal('unsupported', message, subject)

/** The label every header of `document` opens with where it is a copy of an e-invoice, as the document carries it; undefined where it is none. */
export function copyLabel(document: ResolvedDocument): Paragraph | undefined {
  const label = readCopyLabel(document.pageHeader)
  const first = document.firstPageHeader
  const own = first === undefined ? undefined : readCopyLabel(first)
  if (label === undefined) {
    if (own === undefined) return undefined
    throw refusal(
      "this document's first page header says the document is a copy of an e-invoice, and its page header does not: a copy says so at the top of every page, and a Word file of this one would pass for the invoice from its second page on",
      'pageHeader',
    )
  }
  if (!label.asWritten)
    throw refusal(
      "this document's page header opens with the words of a copy of an e-invoice, printed otherwise than the runtime writes them, at 8 pt, bold and in red: a label a reader cannot see says nothing",
      'pageHeader',
    )
  if (first !== undefined && !(own?.asWritten === true && own.paragraph === label.paragraph))
    throw refusal(
      'this document is a copy of an e-invoice, labelled so at the top of every page, and its first page header does not open with the label as the runtime writes it: page 1 of a Word file of it would pass for the invoice',
      'firstPageHeader',
    )
  return document.pageHeader[0] as Paragraph
}

/** `nodes`, the label's, as the header of a slip's page states them: in from the paper's sides, which that page's margins, none, would put them at. */
export function onSlipPage(nodes: readonly ParagraphNode[]): ParagraphNode[] {
  return nodes.map((node) => ({ ...node, indent: COPY_LABEL_INSET, indentRight: COPY_LABEL_INSET }))
}
