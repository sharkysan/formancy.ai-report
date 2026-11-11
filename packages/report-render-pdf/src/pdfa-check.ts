import { E_INVOICE_PREVIEW_LABEL, PREVIEW_LABEL, RenderRefusal } from '@formancy/report-runtime'
import type { Block, EInvoiceFile, ResolvedDocument } from '@formancy/report-runtime'
import { checkCopyLabel, checkEInvoice } from './e-invoice.js'
import type { PdfA } from './pdfa.js'

/**
 * What a document is drawn as, decided once, before pdfmake sees it: a
 * Factur-X e-invoice as the PDF/A-3b that embeds its XML (0031); an
 * XRechnung as the plain copy its label says it is (0038); a document a
 * host asks for as `pdfa: '2b'` as a PDF/A-2b, which embeds nothing
 * (0057); and every other document as a plain PDF, as it always was. The
 * definition, the final pass's hook and the image checks read the one
 * answer, `Checked.pdfa`, and none of them decides it again.
 *
 * **What a PDF/A-2b cannot be it refuses**, as `unsupported`, saying to
 * render it without `pdfa`: a Factur-X, whose PDF/A-3b is the one PDF that
 * may embed its XML, and which drawn as a 2b would be a picture of the
 * invoice in an archive that cannot hold the invoice; an XRechnung's copy,
 * whose invoice is its XML, which a host sends, and whose PDF says on
 * every page it is not the invoice; and a preview the runtime labels so,
 * which says on every page it is not the report, and would be kept as the
 * report. An e-invoice the renderer does not know is refused first,
 * whatever was asked, for what it is (`e-invoice.ts`).
 *
 * The renderer has no mode: a resolved document carries none, and the
 * runtime's manifest, which says preview, is the host's. So it reads the
 * runtime's own labels, as it reads the copy's: a page header that opens
 * with a paragraph of one run, `PREVIEW_LABEL` or `E_INVOICE_PREVIEW_LABEL`,
 * is a preview, whatever its style. A preview of a report that is no
 * e-invoice and lacks nothing carries no label, is the same document as its
 * final render, and is drawn as one. What this does not see: a label among
 * other runs or below another block, and a preview made otherwise and left
 * unlabelled, are documents like any other.
 *
 * And it refuses, in whichever PDF/A, a title PDFKit cannot write into its
 * XMP (`checkPdfATitle`), naming the title and never quoting it.
 */

const refusal = (message: string, subject: string): RenderRefusal => new RenderRefusal('unsupported', message, subject)

/** What `document` is drawn as, `asked` the host's `pdfa`: a PDF/A, or undefined for a plain PDF; refused where it can be neither as it was asked. */
export function checkPdfA(document: ResolvedDocument, asked: '2b' | undefined): PdfA | undefined {
  // An e-invoice it does not know is refused, never embedded as something else or drawn as a plain PDF (`e-invoice.ts`), whatever was asked.
  const eInvoice = document.eInvoice === undefined ? undefined : checkEInvoice(document.eInvoice)
  if (asked === '2b') refuseAs2b(eInvoice, document.pageHeader)
  // An XRechnung's PDF is a plain copy, labelled so on every page (0038).
  if (eInvoice?.kind === 'xrechnung') checkCopyLabel(document.pageHeader)
  const pdfa: PdfA | undefined = eInvoice?.kind === 'facturX' ? { subset: 'PDF/A-3b', file: eInvoice } : asked === '2b' ? { subset: 'PDF/A-2b' } : undefined
  if (pdfa !== undefined) checkPdfATitle(document.info.title, pdfa)
  return pdfa
}

/** Refuses a document asked for as a PDF/A-2b that cannot be one: a Factur-X, an XRechnung's copy and a preview the runtime labels so. */
function refuseAs2b(eInvoice: EInvoiceFile | undefined, pageHeader: readonly Block[]): void {
  if (eInvoice?.kind === 'facturX') {
    throw refusal(
      'a Factur-X e-invoice is drawn as the PDF/A-3b that embeds its XML, and a PDF/A-2b may embed no such file: render it without pdfa',
      'eInvoice',
    )
  }
  if (eInvoice?.kind === 'xrechnung') {
    throw refusal("an XRechnung's PDF is the plain copy of its XML, labelled so on every page, and never an archival PDF/A: render it without pdfa", 'eInvoice')
  }
  if (labelledPreview(pageHeader)) {
    throw refusal(
      'this document is a preview, labelled on every page as not a final report, and a PDF/A-2b of it would be kept as the report: draw the final render as PDF/A-2b, and the preview without pdfa',
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

/**
 * Refuses a PDF/A's title that PDFKit cannot write into its XMP: it puts
 * the title into `dc:title` as it stands, unescaped (pdfkit.js 6025-6032;
 * `pdfmake.test.ts` holds it), so an ampersand or an angle bracket, or a
 * character XML 1.0 cannot write, leaves the XMP not well-formed -- a PDF
 * that says it is a PDF/A and is not one (veraPDF 6.6.2.1-4). report-spec
 * refuses such a title in an e-invoice report, so an e-invoice the runtime
 * resolved never reaches this; a report that is none may hold one, and as
 * a PDF/A-2b is refused here, as is a document made otherwise, naming the
 * title and not quoting it. The information dictionary would hold it as
 * written, and in a report drawn as no PDF/A it reaches no XMP and is
 * drawn.
 */
export function checkPdfATitle(title: string, pdfa: PdfA): void {
  if (/[&<>]/.test(title) || [...title].some((character) => !xmlCharacter(character.codePointAt(0)!))) {
    throw refusal(
      pdfa.subset === 'PDF/A-3b'
        ? "an e-invoice's title is written into its PDF/A's XMP as it stands, where it may hold no &, < or > and no character XML 1.0 cannot write: this one does"
        : "a PDF/A-2b's title is written into its XMP as it stands, where it may hold no &, < or > and no character XML 1.0 cannot write: this one does",
      'info.title',
    )
  }
}

/** Refuses the CMYK JPEG `id`, which a PDF/A cannot hold beside its sRGB output intent (veraPDF 6.2.4.3-3), naming it. */
export function refuseCmyk(id: string, pdfa: PdfA): never {
  throw refusal(
    pdfa.subset === 'PDF/A-3b'
      ? `the image ${id} is a CMYK JPEG, which an e-invoice cannot hold: it is drawn as a PDF/A-3 whose output intent is sRGB, beside which no image may be CMYK`
      : `the image ${id} is a CMYK JPEG, which a PDF/A-2b cannot hold: its output intent is sRGB, beside which no image may be CMYK`,
    id,
  )
}

/** XML 1.0's Char: tab, line feed and carriage return, and every code point from U+0020 but the surrogates, U+FFFE and U+FFFF. A lone surrogate is read as its own code point, and is none. */
function xmlCharacter(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0x10ffff)
  )
}
