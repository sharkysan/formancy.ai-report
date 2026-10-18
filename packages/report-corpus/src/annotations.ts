import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs'

/**
 * The annotations a PDF's pages carry, read back with PDF.js: what a reader
 * acts on rather than draws -- a link it follows when the page is clicked, a
 * note, an attached file. Neither text nor an image, so `readPdf` does not
 * see one. A claim that a page carries none, or a link to where, is a claim
 * about the PDF (0003): pdfmake's SVG converter writes a link for an SVG's
 * `<a>`, to any address, whatever its callbacks say (0030).
 */
export interface PdfAnnotation {
  /** The page it is on, from 1. */
  readonly page: number
  /** PDF's name for its kind: `Link`, `Text`, `FileAttachment`. */
  readonly subtype: string
  /** A link's address as the file gives it, `javascript:` included, which PDF.js reads and would not follow; none for a link to a page of the document. */
  readonly url?: string
}

/** Every annotation on every page of `bytes`, page by page; rejects when they are not a PDF. */
export async function readAnnotations(bytes: Uint8Array): Promise<readonly PdfAnnotation[]> {
  // A copy: PDF.js takes ownership of the buffer it is given and may detach it.
  const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false, verbosity: VerbosityLevel.ERRORS })
  try {
    const document = await task.promise
    const found: PdfAnnotation[] = []
    for (let page = 1; page <= document.numPages; page++) {
      // PDF.js gives a URI as the file writes it in `unsafeUrl`, and in `url` only when it would follow it.
      for (const { subtype, unsafeUrl } of (await (await document.getPage(page)).getAnnotations()) as { subtype: string; unsafeUrl?: string }[]) {
        found.push(unsafeUrl === undefined ? { page, subtype } : { page, subtype, url: unsafeUrl })
      }
    }
    return found
  } finally {
    await task.destroy()
  }
}
