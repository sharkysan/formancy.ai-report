import type { Image, ImageAsset, ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf as renderInBrowser } from './browser.js'
import { finalizeInOrder } from './image-order.js'
import { renderPdf as renderInNode } from './node.js'
import { DECODED, imageOrder, SIDE, writtenAt } from './testing/decoding.js'
import { bareDocument, TIMEOUT } from './testing/documents.js'
import { invoiced } from './testing/e-invoice.js'

/**
 * The order the renderer writes the images PDFKit decodes before it
 * embeds them, in both entries and on the PDF/A path an e-invoice takes
 * (0035). Two renders of one document differed in which soft mask took
 * which number, by which image's decode finished first, and the e-invoice
 * gate failed once on it (run 39320332202).
 *
 * Rendering twice and comparing the bytes cannot catch that: a large
 * image's decode, started before a small one's, finishes after it on
 * every render, so the bytes are the same each time and still not in the
 * document's order. So each of the three ways PDFKit decodes first is
 * drawn large, each at a size of its own, above one small image with an
 * alpha channel, and the PDF is held to the document's order. The images'
 * own numbers are PDFKit's, given as pdfmake opens them (pdfkit.js 3888),
 * and held by their widths, which makes the order of numbers the
 * document's; the masks' numbers, and where the images and the masks are
 * written, are the renderer's. Without the renderer's order those three
 * failed on every render in each row below and the widths held, and the
 * renders of each row were one PDF (measured on 20 October 2026; 0035
 * gives the counts).
 */

const image = (of: ImageAsset): Image => ({ kind: 'image', asset: of, width: 120, height: 120, fit: 'contain' })
const DRAWN = ['alpha', 'interlaced', 'paletted', 'small'] as const
const DOCUMENT: ResolvedDocument = bareDocument('Images in order', DRAWN.map((kind) => image(DECODED[kind])))

const ascending = (numbers: readonly number[]): number[] => [...numbers].sort((a, b) => a - b)

describe.each([
  ['the Node entry', (document: ResolvedDocument) => renderInNode(document, { maxPages: 1 })],
  ['the browser entry', (document: ResolvedDocument) => renderInBrowser(document, { maxPages: 1 })],
  // The PDF/A-3b's `finish` acts on the document after the order is set
  // and before it is ended (`engine.ts`): an e-invoice's images are held
  // here, not only by the e-invoice gate's record, which a few draws in a
  // hundred would have failed.
  ['the Node entry, as an e-invoice', (document: ResolvedDocument) => renderInNode(invoiced(document), { maxPages: 1 })],
  ['the browser entry, as an e-invoice', (document: ResolvedDocument) => renderInBrowser(invoiced(document), { maxPages: 1 })],
] as const)('the images PDFKit decodes before it embeds them, in %s', (_, render) => {
  // A soft mask numbered by whichever decode finished first gave one
  // document two PDFs. In the document's order: the images, numbered as
  // pdfmake opened them; their masks, numbered as the images are; and
  // each of both written in that order, the interlaced image, which has
  // no mask, among them.
  test('are numbered, their masks numbered, and both written in the order pdfmake opened them, whichever decode finishes first', async () => {
    const { widths, masks, drawnAt, masksAt } = await imageOrder(await render(DOCUMENT))
    expect(widths).toEqual(DRAWN.map((kind) => SIDE[kind]))
    expect(masks).toHaveLength(3)
    expect(masks).toEqual(ascending(masks))
    expect(drawnAt).toEqual(ascending(drawnAt))
    expect(masksAt).toEqual(ascending(masksAt))
  }, TIMEOUT)
})

/** A stand-in for one of PDFKit's images in pdfmake's registry: `image` set while it decodes, and a `finalize` that records its name. */
function standIn(name: string, written: string[], { decoding = true, finalize = true } = {}): { image: unknown; finalize?: () => unknown } {
  return { image: decoding ? {} : null, ...(finalize ? { finalize: () => written.push(name) } : {}) }
}

describe('finalizeInOrder', () => {
  // The PDFs above show the order; this is the wrapper's own account of
  // it, on stand-ins for PDFKit's images, decodes finishing in an order of
  // the test's choosing: an image whose decode finished waits for every
  // one opened before it, and is written the moment they are, and an
  // image already written -- a JPEG, a PNG embedded at once -- is left
  // alone.
  test('writes an image whose decode finished once every image opened before it is written', () => {
    const written: string[] = []
    const registry = { image0: standIn('first', written), image1: standIn('jpeg', written, { decoding: false }), image2: standIn('second', written), image3: standIn('third', written) }
    const jpeg = registry.image1.finalize
    finalizeInOrder({ _imageRegistry: registry })
    expect(registry.image1.finalize).toBe(jpeg)
    registry.image3.finalize!()
    registry.image2.finalize!()
    expect(written).toEqual([])
    registry.image0.finalize!()
    expect(written).toEqual(['first', 'second', 'third'])
  })

  // A PDFKit within pdfmake's range that moved what this reads must not
  // stop a report from printing. An image still decoding with no
  // `finalize` to wrap would, wrapped around, hold every image after it
  // forever and the document would never end: so nothing is wrapped, and
  // the images are written as their decodes finish, as before 0035. A
  // document with no registry has opened no image to order.
  test('leaves every image to its own decode where one cannot be wrapped, and a document with no registry alone', () => {
    const written: string[] = []
    const registry = { image0: standIn('unwrappable', written, { finalize: false }), image1: standIn('second', written) }
    const second = registry.image1.finalize
    finalizeInOrder({ _imageRegistry: registry })
    expect(registry.image1.finalize).toBe(second)
    registry.image1.finalize!()
    expect(written).toEqual(['second'])
    expect(() => finalizeInOrder({})).not.toThrow()
  })
})

describe('the cross-reference table the order is read from', () => {
  // Where an object is written is read from the table PDFKit writes; a
  // table read wrong would make any order look like another. Every
  // object's offset is held to the object written there, and a table
  // that points elsewhere, leaves an object out or is not there is refused.
  test('gives every object where it is written, and refuses a table that points elsewhere, leaves an object out or is not there', async () => {
    const bytes = await renderInNode(bareDocument('One image', [image(DECODED.small)]), { maxPages: 1 })
    const text = Buffer.from(bytes).toString('latin1')
    const at = writtenAt(bytes)
    expect(at.size).toBeGreaterThan(10)
    for (const [object, offset] of at) expect(text.startsWith(`${String(object)} 0 obj\n`, offset)).toBe(true)
    const pdf = (edited: string): Uint8Array => new Uint8Array(Buffer.from(edited, 'latin1'))
    // Object 1's entry: ten digits of offset, the generation, and `n`.
    const first = text.indexOf('0000000000 65535 f \n', text.lastIndexOf('xref\n0 ')) + '0000000000 65535 f \n'.length
    const moved = `${text.slice(0, first)}${String(Number(text.slice(first, first + 10)) + 1).padStart(10, '0')}${text.slice(first + 10)}`
    expect(() => writtenAt(pdf(moved))).toThrow('object 1 is not where the cross-reference table says')
    const free = `${text.slice(0, first + 17)}f${text.slice(first + 18)}`
    expect(() => writtenAt(pdf(free))).toThrow('the cross-reference table has no offset for object 1')
    expect(() => writtenAt(pdf(text.replace(/startxref\n\d+\n/, 'startxref\n0\n')))).toThrow('startxref points at no cross-reference table')
    expect(() => writtenAt(bytes.subarray(0, bytes.length - 1))).toThrow('the PDF does not end in startxref')
    await expect(imageOrder(pdf(text.replace(/xref\n0 \d+\n/, 'xref\n0 2\n')))).rejects.toThrow(/^object \d+ has no offset in the cross-reference table$/)
  }, TIMEOUT)
})

