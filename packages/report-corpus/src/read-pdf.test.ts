import { concatTransformationMatrix, drawObject, PDFDocument, popGraphicsState, pushGraphicsState } from '@pdfme/pdf-lib'
import { describe, expect, test } from 'vitest'
import { encodePng } from './fixtures/png.js'
import { readPdf } from './read-pdf.js'
import { pdfmakePdf } from './testing/pdfmake.js'

/**
 * Roboto's ascender is 1900 of its 2048 units per em, and pdfmake puts a
 * line's baseline that far below the top of the line's box.
 */
const ROBOTO_ASCENDER = 1900 / 2048

describe('readPdf', () => {
  // Pages are numbered from 1, as a reader of the PDF numbers them, and a
  // landscape page is wider than it is tall. A reader that numbered from 0 or
  // swapped the axes would put every "Page n of N" and every margin check out
  // by one page or one orientation.
  test('reads every page, numbered from 1, with its size in points', async () => {
    const pdf = await readPdf(await pdfmakePdf({ pageSize: 'A4', pageOrientation: 'landscape', content: [{ text: 'first' }, { text: 'second', pageBreak: 'before' }] }))
    expect(pdf.pages.map((page) => [page.number, page.width, page.height])).toEqual([
      [1, 841.89, 595.28],
      [2, 841.89, 595.28],
    ])
    expect(pdf.pages.map((page) => page.items.map((item) => item.text))).toEqual([['first'], ['second']])
  })

  // pdfjs measures a baseline up from the bottom edge; every check here reads
  // down from the top. Text placed 100pt from the top must be found there,
  // with its box running from the baseline's descent allowance up one font
  // size -- read the other way, a page header would be found at the foot of
  // the page and a footer collision would look like a header one.
  test('measures each text box from the top edge of the page', async () => {
    const pdf = await readPdf(await pdfmakePdf({ content: [{ text: 'placed', fontSize: 10, absolutePosition: { x: 100, y: 100 } }] }))
    const [item] = pdf.pages[0]!.items
    const baseline = 100 + ROBOTO_ASCENDER * 10
    expect(item!.text).toBe('placed')
    expect(item!.x).toBeCloseTo(100, 1)
    expect(item!.bottom).toBeCloseTo(baseline + 0.2 * 10, 1)
    expect(item!.top).toBeCloseTo(item!.bottom - 10, 5)
    expect(item!.height).toBe(10)
    expect(item!.width).toBeGreaterThan(20)
  })

  // pdfjs inserts a space item as wide as the gap between two table cells,
  // with no height. Kept, it would be text that overlaps nothing visible yet
  // spans the gap -- and, with a little height, every cell beside it.
  test('keeps no item that is only whitespace', async () => {
    const pdf = await readPdf(await pdfmakePdf({ content: [{ table: { widths: [80, 80, 80], body: [['one', 'two', 'three']] } }] }))
    expect(pdf.pages[0]!.items.map((item) => item.text)).toEqual(['one', 'two', 'three'])
  })

  // Text outside ASCII is read back through the font's ToUnicode map. An
  // umlaut that came back as a different character, or a typographic
  // apostrophe as a straight one, would make every exact-text check about
  // Swiss amounts fail -- or, worse, pass on a wrong value.
  test('reads text outside ASCII verbatim', async () => {
    const lines = ['äöüÄÖÜß éèçàœÉ', 'CHF 1’234.50 € 12,00 —', 'Zażółć gęślą jaźń']
    const pdf = await readPdf(await pdfmakePdf({ content: lines.map((text) => ({ text })) }))
    expect(pdf.pages[0]!.items.map((item) => item.text)).toEqual(lines)
  })

  // pdfjs substitutes its own copy of a standard font for one the file does
  // not carry, which would make an unembedded Helvetica look embedded. The
  // reader must say which fonts the PDF carries and which it only names.
  test('says which fonts are embedded and which the PDF only names', async () => {
    const embedded = await readPdf(await pdfmakePdf({ content: [{ text: 'Roboto only' }] }))
    expect(embedded.fonts).toEqual([{ name: expect.stringMatching(/Roboto-Regular$/), embedded: true }])
    const named = await readPdf(await pdfmakePdf({ content: [{ text: 'Roboto' }, { text: 'Helvetica', font: 'Helvetica' }] }))
    expect(named.fonts).toContainEqual({ name: 'Helvetica', embedded: false })
    expect(named.fonts).toContainEqual({ name: expect.stringMatching(/Roboto-Regular$/), embedded: true })
  })

  // An image is invisible to text extraction. Without its box a page could
  // print text over a logo, or a logo past the margin, and every check would
  // pass. The box is where it is drawn, from the top, in points.
  test('finds each image drawn and the box it is drawn in', async () => {
    const png = encodePng(4, 4, () => [200, 0, 0])
    const pdf = await readPdf(
      await pdfmakePdf({
        pageMargins: [40, 60, 40, 60],
        content: [{ image: `data:image/png;base64,${Buffer.from(png).toString('base64')}`, width: 120, height: 60 }],
      }),
    )
    expect(pdf.pages[0]!.images).toHaveLength(1)
    const [image] = pdf.pages[0]!.images
    expect(image!.x).toBeCloseTo(40, 1)
    expect(image!.top).toBeCloseTo(60, 1)
    expect(image!.bottom).toBeCloseTo(120, 1)
    expect(image!.width).toBeCloseTo(120, 1)
    expect(image!.height).toBeCloseTo(60, 1)
  })

  // An engine built on pdf-lib can place content through a form XObject,
  // whose own matrix PDF.js hands over as a typed array. An image drawn in
  // one is where both matrices put it -- here, its 50 × 40 box at 10, 20 on
  // the form, doubled by the form's matrix, then moved to 100, 500 on the page.
  test('finds an image drawn inside a form XObject, through both matrices', async () => {
    const inner = await PDFDocument.create()
    const image = await inner.embedPng(encodePng(4, 4, () => [0, 0, 200]))
    inner.addPage([200, 100]).drawImage(image, { x: 10, y: 20, width: 50, height: 40 })
    const loaded = await PDFDocument.load(await inner.save())
    const outer = await PDFDocument.create()
    const form = await outer.embedPage(loaded.getPage(0), undefined, [2, 0, 0, 2, 0, 0])
    outer.addPage([595.28, 841.89]).drawPage(form, { x: 100, y: 500 })
    const [box] = (await readPdf(await outer.save())).pages[0]!.images
    expect(box!.x).toBeCloseTo(120, 1)
    expect(box!.top).toBeCloseTo(841.89 - 540 - 80, 1)
    expect(box!.width).toBeCloseTo(100, 1)
    expect(box!.height).toBeCloseTo(80, 1)
  })

  // One image resource painted three times is three images on the page.
  // Counted by resource, a page that drew a logo three times -- or over the
  // text in three places -- would look like one that drew it once.
  test('finds each paint of one image drawn several times', async () => {
    const document = await PDFDocument.create()
    const image = await document.embedPng(encodePng(4, 4, () => [0, 200, 0]))
    const page = document.addPage([595.28, 841.89])
    const name = page.node.newXObject('Image', image.ref)
    for (const x of [40, 80, 120]) {
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(30, 0, 0, 30, x, 700), drawObject(name), popGraphicsState())
    }
    const boxes = (await readPdf(await document.save())).pages[0]!.images
    expect(boxes.map((box) => [box.x, box.top, box.width, box.height].map((value) => Math.round(value * 100) / 100))).toEqual([
      [40, 111.89, 30, 30],
      [80, 111.89, 30, 30],
      [120, 111.89, 30, 30],
    ])
  })

  // pdfjs takes ownership of the buffer it is given. Handed the caller's own
  // bytes, it could detach them, and a trial could not then save the PDF it
  // had just checked.
  test("leaves the caller's bytes as they were", async () => {
    const bytes = await pdfmakePdf({ content: [{ text: 'kept' }] })
    const length = bytes.byteLength
    await readPdf(bytes)
    expect(bytes.byteLength).toBe(length)
    expect((await readPdf(bytes)).pages).toHaveLength(1)
  })

  // An engine that returned something other than a PDF must fail the trial,
  // not read as a PDF with no pages, on which every check of overlap and
  // margins would pass for want of anything to check.
  test('rejects bytes that are not a PDF', async () => {
    await expect(readPdf(new TextEncoder().encode('not a pdf at all'))).rejects.toThrow()
  })
})
