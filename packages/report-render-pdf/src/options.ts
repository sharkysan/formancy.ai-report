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
}
