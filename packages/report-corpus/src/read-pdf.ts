import { getDocument, OPS, VerbosityLevel, type PageViewport, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js'
import { drawnOn } from './operators.js'

/**
 * What a rendered PDF shows, read back with PDF.js: the text on each page and
 * where it is, the images drawn and where, the paths painted and the
 * rectangles clipped to, whether each font the pages use travels inside the
 * file, and the files it embeds. The checks prove a fixture on this, never
 * on the engine's input.
 */

/** A box on a page, in points, measured down from the page's top edge and in from its left edge. */
export interface PdfBox {
  readonly x: number
  readonly top: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}

/**
 * One run of text as PDF.js extracts it. `bottom` is the baseline plus a
 * descent allowance of a fifth of the font size, and `top` is one font size
 * above that. A fifth is how far the descenders of Roboto and Helvetica reach
 * (Roboto's hhea descender is 0.244 em, Helvetica's 0.207 em, and the glyphs
 * that use it, g, p and y, stop near 0.2 em). The box is therefore as tall as
 * the font size, which keeps the boxes of two consecutive lines of the same
 * size apart (a line's pitch is at least 1.15 em in both fonts) while still
 * reaching below the baseline far enough to catch a footer drawn into the
 * last line's descenders.
 *
 * That is a run that reads across the page. A run turned on the page -- an
 * EPC QR code's caption reads from bottom to top -- has the box that box
 * turns into: one turned a quarter turn is its font size wide and its
 * advance tall.
 */
export interface PdfTextItem extends PdfBox {
  readonly text: string
  /** Which way its baseline runs, in degrees counter-clockwise from the page's x-axis, to the hundredth: 0 across the page, 90 up it. */
  readonly angle: number
  /** The name of the font the run is drawn in, as the PDF holds it: a subset prefix such as `BZZZZZ+` and the face's PostScript name (0043), or the loaded name where PDF.js gives none. */
  readonly font: string
}

/** A colour a path is painted in: `#rrggbb`, or `pattern` for a gradient or a pattern, which has no one colour. */
export type PdfPaint = `#${string}` | 'pattern'

/**
 * A path the page paints: the box of its points on the page, before any
 * stroke's width -- a curve's box is the curve's own, not its control
 * points' -- how it is painted and in what. A vector drawing is paths: an
 * SVG image, a QR code, a rule, a table's borders.
 */
export interface PdfPath extends PdfBox {
  readonly paint: 'fill' | 'stroke' | 'fillStroke'
  /** Present when it is filled. */
  readonly fill?: PdfPaint
  /** Present when it is stroked. */
  readonly stroke?: PdfPaint
  /** The innermost rectangular clip in force when it was painted, by its index among the page's `clips`; none when no rectangle clipped it. */
  readonly clip?: number
}

export interface PdfPage {
  /** From 1. */
  readonly number: number
  readonly width: number
  readonly height: number
  /** In the order the page's content draws them, without items that are only whitespace. */
  readonly items: readonly PdfTextItem[]
  readonly images: readonly PdfBox[]
  /** In the order the page paints them; none from inside a soft mask, which paints nothing a reader sees (`operators.ts`). */
  readonly paths: readonly PdfPath[]
  /** Each clip the page sets that is one rectangle with sides along the page's, in the order it sets them: an SVG image is drawn inside one of its box. */
  readonly clips: readonly PdfBox[]
}

export interface PdfFont {
  /** The font's name in the PDF, with a subset prefix such as `CZZZZZ+` when the file carries a subset. */
  readonly name: string
  readonly embedded: boolean
}

/**
 * A file the PDF embeds, as PDF.js finds it: by its name in the catalog's
 * /Names /EmbeddedFiles tree, which is where PDF.js looks and nowhere else.
 * A file only on the catalog's /AF is not among them; `readPdfObjects`, a
 * second reader, reads both places.
 */
export interface PdfAttachment {
  /** Its key in the name tree. */
  readonly name: string
  /** The file specification's /Desc, empty where it has none. */
  readonly description: string
  /** The embedded file's bytes, inflated; undefined where the specification embeds none. */
  readonly bytes: Uint8Array | undefined
}

export interface ReadPdf {
  readonly pages: readonly PdfPage[]
  /** Every font a page draws text with, once each. */
  readonly fonts: readonly PdfFont[]
  /** Every file the name tree names, in its order; none for a PDF that embeds none. */
  readonly attachments: readonly PdfAttachment[]
}

/** How far below the baseline a text box reaches, as a fraction of the font size. See `PdfTextItem`. */
const DESCENT = 0.2

/** The baseline the text sits on, in points from the top of the page. */
export function baselineOf(item: PdfTextItem): number {
  return item.bottom - DESCENT * item.height
}

/**
 * Reads `bytes` as a PDF; rejects when they are not one.
 *
 * Embedded fonts are told apart by asking PDF.js whether it found the font's
 * program in the file (`missingFile` on the font object a page's operator list
 * loads). That is why no `standardFontDataUrl` is passed: with it, PDF.js
 * fills a missing Helvetica or Times with its own copy and reports the font as
 * present. Without it, text is still placed by the widths the PDF declares or,
 * for the fourteen standard fonts, by the metrics PDF.js has built in. The
 * method's limit: it sees whether a font program is in the file, not whether
 * that program holds every glyph drawn. A character the font has no glyph
 * for extracts as U+0000, which the glyph check reports, and text drawn in
 * the wrong glyphs extracts as other text, which the row and exact-text
 * checks see.
 *
 * Images, paths and clips are read from the page's operator list
 * (`operators.ts`), each where it lands on the page.
 */
export async function readPdf(bytes: Uint8Array): Promise<ReadPdf> {
  // A copy: PDF.js takes ownership of the buffer it is given and may detach it.
  // No `isEvalSupported`: PDF.js 6 no longer has the option, nor the eval it switched off.
  const task = getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    fontExtraProperties: true,
    verbosity: VerbosityLevel.ERRORS,
  })
  try {
    const document = await task.promise
    const pages: PdfPage[] = []
    const fonts = new Map<string, PdfFont>()
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number)
      const viewport = page.getViewport({ scale: 1 })
      const { images, paths, clips, fontIds } = await drawnOn(page, viewport)
      for (const id of fontIds) {
        const font = fontObject(page, id)
        fonts.set(`${font.name}\u0000${font.embedded}`, font)
      }
      pages.push({ number, width: viewport.width, height: viewport.height, items: await textItems(page, viewport), images, paths, clips })
    }
    return { pages, fonts: [...fonts.values()], attachments: await attachmentsOf(document) }
  } finally {
    await task.destroy()
  }
}

/** The name tree's files, each one's bytes asked for by its name, since PDF.js 6 lists a file without them. */
async function attachmentsOf(document: PDFDocumentProxy): Promise<PdfAttachment[]> {
  const listed = await document.getAttachments()
  const attachments: PdfAttachment[] = []
  for (const [name, { description }] of listed ?? []) attachments.push({ name, description, bytes: (await document.getAttachmentContent(name)) ?? undefined })
  return attachments
}

async function textItems(page: PDFPageProxy, viewport: PageViewport): Promise<PdfTextItem[]> {
  const content = await page.getTextContent()
  const items: PdfTextItem[] = []
  for (const item of content.items) {
    if (!('str' in item) || item.str.trim() === '') continue
    items.push(textBox(item, viewport, fontNameOf(page, item.fontName)))
  }
  return items
}

/**
 * The name of the font a run is drawn in, from the page's loaded font
 * objects: the subset-prefixed PostScript name the PDF holds (0043). The
 * fonts are loaded by the operator-list read `readPdf` does before this, so
 * `commonObjs` has each run's; where it does not, the loaded name stands.
 */
function fontNameOf(page: PDFPageProxy, fontName: string): string {
  try {
    const font = page.commonObjs.get(fontName) as { name?: string; loadedName?: string }
    return font.name ?? font.loadedName ?? fontName
  } catch {
    return fontName
  }
}

/**
 * A run's box: its advance along its baseline, from a fifth of its size
 * below the baseline to the rest of it above, turned as the run is, and
 * the box on the page that holds it. Across the page that is the box
 * `PdfTextItem` describes, exactly: a turn of 0 has a cosine of 1 and a
 * sine of 0.
 */
function textBox(item: TextItem, viewport: PageViewport, font: string): PdfTextItem {
  const [a, b, c, d, e, f] = item.transform as [number, number, number, number, number, number]
  const size = Math.hypot(c, d)
  const angle = Math.round((Math.atan2(b, a) * 18000) / Math.PI) / 100
  const [cos, sin] = [Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180)]
  const corners = [0, item.width].flatMap((along) => [-DESCENT * size, (1 - DESCENT) * size].map((up) => viewport.convertToViewportPoint(e + along * cos - up * sin, f + along * sin + up * cos) as [number, number]))
  const [x, top] = [Math.min(...corners.map(([across]) => across)), Math.min(...corners.map(([, down]) => down))]
  const [width, height] = [Math.abs(item.width * cos) + Math.abs(size * sin), Math.abs(item.width * sin) + Math.abs(size * cos)]
  return { text: item.str, x, top, bottom: top + height, width, height, angle, font }
}

function fontObject(page: PDFPageProxy, id: string): PdfFont {
  const font = page.commonObjs.get(id) as { name?: string; loadedName?: string; missingFile?: boolean }
  return { name: font.name ?? font.loadedName ?? id, embedded: font.missingFile !== true }
}
