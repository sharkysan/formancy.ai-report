import { E_INVOICE_PREVIEW_LABEL, PREVIEW_LABEL, RenderRefusal, XRECHNUNG_COPY_LABEL, type Block, type ResolvedDocument } from '@formancy/report-runtime'

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
 * sample that passes for the report. And an XRechnung's PDF copy, its
 * XML taken off by a host, which says on every page, on page 1's own
 * header too, that "this PDF" is not the invoice: in a Word file that
 * sentence is about another file. A Factur-X's final render with its XML
 * taken off carries no label and is written as a report like any other;
 * a Word file is held to what the runtime resolved, and 0077 says so
 * among its costs. A payment part was refused
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
  // An XRechnung's final render with its XML taken off is its PDF's copy still, and says so on every page: in a Word file the sentence is
  // about another file, and the file would stand where the copy the runtime labels for one does (0077).
  for (const [subject, header] of [['pageHeader', document.pageHeader] as const, ['firstPageHeader', document.firstPageHeader ?? []] as const]) {
    if (opensWith(header, [XRECHNUNG_COPY_LABEL]))
      throw new RenderRefusal(
        'unsupported',
        `this document is an XRechnung's PDF copy, labelled on every page as "this PDF is not the invoice", which a Word file is not: ${PRINT}`,
        subject,
      )
  }
}

/** Whether a header opens as the runtime heads a preview's every page: a paragraph of its label, the one run. */
function labelledPreview(pageHeader: readonly Block[]): boolean {
  return opensWith(pageHeader, [PREVIEW_LABEL, E_INVOICE_PREVIEW_LABEL])
}

/** Whether `header` opens with a paragraph of one of `labels` alone, the one run, whatever its style. */
function opensWith(header: readonly Block[], labels: readonly string[]): boolean {
  const first = header[0]
  if (first?.kind !== 'paragraph' || first.runs.length !== 1) return false
  const run = first.runs[0]!
  return 'text' in run && labels.includes(run.text)
}
