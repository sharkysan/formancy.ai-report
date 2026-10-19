/**
 * The images PDFKit decodes before it embeds them, written in the order
 * pdfmake opened them, so that one document renders to the same bytes
 * however its decodes finish (0035).
 *
 * pdfmake opens each image as it lays the page out, in the document's
 * order, and PDFKit numbers the image's object then (pdfkit.js 3888). A
 * PNG with a palette's transparency, an alpha channel or interlacing is
 * decoded first, by png-js's `decodePixels`, whose inflate calls back
 * when it is done (pdfkit.js 3926-3931): in Node from libuv's thread pool,
 * in pdfmake's browser build from a timer. The callback calls
 * `this.finalize()` (3974, 3990, 3996), which numbers the soft mask and
 * writes the mask and the image (3935-3953). Left alone, then, both the
 * masks' numbers and where each image is written follow whichever decode
 * finishes first, and two renders of one document differed so.
 *
 * Each image still decoding when pdfmake hands the document over has its
 * `finalize` wrapped, for this document alone: an image whose decode has
 * finished waits for every one opened before it, and is written as soon
 * as they are. Nothing is renumbered and nothing written twice: PDFKit
 * writes every object itself, in the order its images were opened.
 *
 * It rests on what `written` hands it: PDFKit's document laid out and not
 * yet ended, before any decode has called back -- which none can, since
 * pdfmake lays the document out in one synchronous step after its last
 * await, and both callbacks wait for the event loop to turn. And on three
 * details of PDFKit 0.19.1, read and wrapped here and typed at the
 * boundary, as `pdfa.ts` types `file`: the registry pdfmake keeps the
 * images it opened in, by the names the renderer gives them, `image0`,
 * `image1`... (`content.ts`), which no array index is, so in the order it
 * added them, each embedded before it is added (`PDFDocument.js` 108-109)
 * and so decoding already if it decodes; a PNG's `image`, which is set
 * until the image is written; and `finalize`, called through `this`.
 *
 * A PDFKit within pdfmake's range that moved one of them meets one of two
 * ends. One that finds nothing still decoding, or an image it cannot
 * wrap, wraps none and leaves the images to be written as their decodes
 * finish: a report prints as it did in 0.2.0, in bytes that may vary. One
 * that kept `finalize` but called it otherwise than through `this` on one
 * of its three decodes would write that image unseen by its wrapper, and
 * every image opened after it would wait for it forever: the render would
 * never end. The install gate, which installs the PDFKit a host resolves,
 * draws an image of each of the three ahead of another, and fails on
 * either end.
 */

/** One of PDFKit's images as pdfmake's registry holds it: a PNG, a JPEG (pdfkit.js 3807-3999). */
interface PdfKitImage {
  /** png-js's decoder of a PNG, set until `finalize` has written the image; a JPEG has none. */
  readonly image?: unknown
  /** Numbers the image's soft mask, if it has one, and writes the mask and the image. */
  finalize?: () => unknown
}

/** PDFKit's document as `written` receives it: the images pdfmake opened, by name, in the order it opened them (pdfmake's `PDFDocument.js` 77-110). */
export interface PdfKitImages {
  readonly _imageRegistry?: Readonly<Record<string, PdfKitImage>>
}

/** Has every image of `document` still decoding written in the order pdfmake opened it, whichever decode finishes first. */
export function finalizeInOrder(document: PdfKitImages): void {
  const decoding = Object.values(document._imageRegistry ?? {}).filter((image) => image.image != null)
  const finalizers = decoding.map((image) => image.finalize)
  // One left unwrapped would hold every image after it forever, and the document would never end;
  // a wrapped one whose decode calls `finalize` past its wrapper would do the same, and is the install gate's to find.
  if (!finalizers.every((finalize) => typeof finalize === 'function')) return
  const decoded = new Set<number>()
  let next = 0
  decoding.forEach((image, at) => {
    image.finalize = () => {
      decoded.add(at)
      for (; decoded.has(next); next += 1) finalizers[next]!.call(decoding[next])
    }
  })
}
