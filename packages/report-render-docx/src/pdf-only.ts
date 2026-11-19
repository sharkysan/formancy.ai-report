import { E_INVOICE_PREVIEW_LABEL, PREVIEW_LABEL, RenderRefusal, type Block, type ResolvedDocument } from '@formancy/report-runtime'

/**
 * What belongs to a report's PDF, and is refused whole in a Word file
 * (0068): each `unsupported`, naming what it is, in a sentence a person
 * can read. A Word file without one of them would be the report with
 * something left out and nothing saying so.
 *
 * Of the document itself, before any block: its e-invoice, which is the
 * PDF/A-3b that embeds its XML or the labelled copy of an XML a host
 * sends -- a Word file is written of the copy the runtime resolves for
 * one, which carries no e-invoice and says on every page what it is
 * (0077, `copy.ts`), and the refusal says to ask for it; and a
 * preview the runtime labelled, whose label a Word file holds as a
 * paragraph a person deletes -- read as the PDF renderer reads it where
 * it refuses a preview as a PDF/A (0057). A copy's label is a paragraph
 * a person deletes too, and what is left is the page of a final render,
 * whose every value is the invoice's; what is left of a preview is a
 * sample that passes for the report. A payment part was refused
 * here, as what SIX fixes to the foot of the last page, where a Word
 * file's pages are Word's; since 0075 its slip is written on a page of
 * its own, the file's last (`slip.ts`).
 *
 * Of its blocks, none any longer. A QR code and an EPC QR code were
 * refused here while what refuses one was decided in the PDF renderer
 * alone; since 0074 it is decided below both engines, and the writer
 * draws them (`codes.ts`). A chart was refused here as what ECharts lays
 * out for the PDF renderer alone (0058); since 0076 it is written as
 * Word's own chart, from the runtime's block, with no ECharts
 * (`charts.ts`).
 */

const PRINT =
  "a Word file is written of its copy, which says on every page that it is not the invoice: resolve the report with eInvoice: 'copy' for the Word file, and print the report as a PDF"

/** Refuses a document that carries what only its PDF is: an e-invoice, a preview's label. */
export function refusePdfOnly(document: ResolvedDocument): void {
  const invoice = document.eInvoice
  if (invoice !== undefined) {
    const what =
      invoice.kind === 'xrechnung'
        ? 'the report is an XRechnung, whose invoice is the XML a host sends and whose page is labelled as the PDF copy of it'
        : 'the report is an e-invoice, which is the PDF/A-3b that embeds its XML, and a Word file embeds none'
    throw new RenderRefusal('unsupported', `${what}: ${PRINT}`, 'eInvoice')
  }
  if (labelledPreview(document.pageHeader)) {
    throw new RenderRefusal(
      'unsupported',
      'this document is a preview, labelled on every page as not a final report; in a Word file the label is a paragraph a person deletes, and the file would then pass for the report: write the final render as a Word file, and print the preview as a PDF',
      'pageHeader',
    )
  }
}

/** Whether a page header opens as the runtime heads a preview's every page: a paragraph of its label, the one run. */
function labelledPreview(pageHeader: readonly Block[]): boolean {
  const first = pageHeader[0]
  if (first?.kind !== 'paragraph' || first.runs.length !== 1) return false
  const run = first.runs[0]!
  return 'text' in run && (run.text === PREVIEW_LABEL || run.text === E_INVOICE_PREVIEW_LABEL)
}
