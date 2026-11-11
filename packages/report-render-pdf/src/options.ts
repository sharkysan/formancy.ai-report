/**
 * What a caller passes `renderPdf`, in a module of its own: the package's
 * published types import nothing of pdfmake's, whose types are a
 * devDependency a consumer does not install.
 */
export interface RenderOptions {
  /** The most pages the PDF may have. A document that needs more is refused with `too-many-pages`, never cut short. */
  readonly maxPages: number
  /**
   * Cancels the render: it rejects with `cancelled` and resolves nothing.
   * The render yields to the event loop between its passes, so that an
   * abort from a timer or a closed request can arrive, and reads the signal
   * before the first pass, between passes and once more before the PDF is
   * returned. A pass itself -- pdfmake measuring and laying out a whole
   * document, a second or more for a long one -- runs in one synchronous
   * step that no signal can interrupt; a host that must stop a render at
   * once runs it in a worker it can terminate.
   */
  readonly signal?: AbortSignal
  /**
   * Asks for the final render drawn as a PDF/A-2b, the archival PDF the
   * Swiss EPR admits, which embeds no file; `'2b'` is the one value, and any
   * other is a `RangeError`. A Factur-X e-invoice, which is drawn as the
   * PDF/A-3b that embeds its XML, an XRechnung's copy and a preview the
   * runtime labels so are refused with it as `unsupported`, each to be
   * rendered without it (0057). In Node, PDFKit reads the sRGB profile its
   * output intent embeds from its own `data/sRGB_IEC61966_2_1.icc` on disk,
   * so a host that bundles the Node entry ships that file beside it; the
   * browser build carries the same bytes.
   */
  readonly pdfa?: '2b'
}
