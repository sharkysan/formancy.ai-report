import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs'

/**
 * A page of a PDF as a PNG, drawn by PDF.js on the canvas pdfjs-dist brings
 * to Node (`@napi-rs/canvas`): the page images decision 0003 leaves for what
 * extracted text cannot show -- rules, borders, fills, colour -- and the
 * README's pictures of the starters.
 *
 * Pixels depend on the platform's build of the canvas, so nothing here is
 * compared pixel for pixel or byte for byte across machines: a picture is
 * held to the text of the page it was drawn from, which `readPdf` reads
 * from the same bytes. The page is drawn on white, as it prints, at `scale`
 * pixels to the point.
 */
export async function rasterPage(bytes: Uint8Array, pageNumber: number, scale: number): Promise<Uint8Array> {
  // A copy: PDF.js takes ownership of the buffer it is given and may detach it.
  const task = getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false, verbosity: VerbosityLevel.ERRORS })
  try {
    const document = await task.promise
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > document.numPages) throw new RangeError(`the PDF has no page ${pageNumber}; it has ${document.numPages}`)
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale })
    const { canvas, context } = (document.canvasFactory as unknown as CanvasFactory).create(Math.ceil(viewport.width), Math.ceil(viewport.height))
    await page.render({ canvas: canvas as never, canvasContext: context as never, viewport, background: '#ffffff' }).promise
    return new Uint8Array(canvas.toBuffer('image/png'))
  } finally {
    await task.destroy()
  }
}

/** What PDF.js's canvas factory makes in Node: an `@napi-rs/canvas` canvas, which encodes itself as a PNG. */
interface CanvasFactory {
  create(width: number, height: number): { readonly canvas: { toBuffer(type: 'image/png'): Uint8Array }; readonly context: unknown }
}
