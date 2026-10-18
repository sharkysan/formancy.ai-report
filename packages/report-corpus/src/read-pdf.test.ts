import {
  appendBezierCurve,
  clip,
  closePath,
  concatTransformationMatrix,
  degrees,
  drawObject,
  endPath,
  fill,
  fillAndStroke,
  lineTo,
  moveTo,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setFillingRgbColor,
  setStrokingRgbColor,
  StandardFonts,
  stroke,
  type PDFOperator,
} from '@pdfme/pdf-lib'
import { describe, expect, test } from 'vitest'
import { encodePng } from './fixtures/png.js'
import { readPdf } from './read-pdf.js'
import { exactBuffer, pdfmakePdf } from './testing/pdfmake.js'

/**
 * Roboto's ascender is 1900 of its 2048 units per em, and pdfmake puts a
 * line's baseline that far below the top of the line's box.
 */
const ROBOTO_ASCENDER = 1900 / 2048

/** A value as the page boxes are compared here: to the hundredth of a point. */
const hundredths = (value: number): number => Math.round(value * 100) / 100

/** `operators` between a save and a restore of the graphics state. */
const group = (...operators: PDFOperator[]): PDFOperator[] => [pushGraphicsState(), ...operators, popGraphicsState()]

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

  // A caption set from bottom to top -- an EPC QR code's "Zahlen mit
  // Code" (PSA v3.0 5) -- is a run whose baseline runs up the page. Read
  // as an upright run, its box would lie across the page from where it
  // starts, over whatever stands to its right, and nothing could say which
  // way it reads. Its angle is counted counter-clockwise from the page's
  // x-axis, and its box is the one its letters' box turns into: from its
  // start up the page by its advance, its letters' tops to the left.
  test('reads which way each run reads, and boxes a turned run where it stands', async () => {
    const document = await PDFDocument.create()
    const font = await document.embedFont(StandardFonts.Helvetica)
    const page = document.addPage([595.28, 841.89])
    page.drawText('upright', { x: 100, y: 700, size: 10, font })
    page.drawText('Zahlen mit Code', { x: 300, y: 400, size: 7, font, rotate: degrees(90) })
    page.drawText('downward', { x: 400, y: 400, size: 10, font, rotate: degrees(-90) })
    const [upright, up, down] = (await readPdf(await document.save())).pages[0]!.items
    expect(upright).toMatchObject({ text: 'upright', angle: 0, x: expect.closeTo(100, 3), height: 10 })
    const advance = font.widthOfTextAtSize('Zahlen mit Code', 7)
    expect(up).toMatchObject({ text: 'Zahlen mit Code', angle: 90 })
    expect(up!.x).toBeCloseTo(300 - 0.8 * 7, 3)
    expect(up!.width).toBeCloseTo(7, 3)
    expect(up!.bottom).toBeCloseTo(841.89 - 400, 3)
    expect(up!.top).toBeCloseTo(841.89 - 400 - advance, 3)
    expect(up!.height).toBeCloseTo(advance, 3)
    // Read top to bottom, its letters' tops to the right.
    expect(down).toMatchObject({ text: 'downward', angle: -90 })
    expect(down!.x).toBeCloseTo(400 - 0.2 * 10, 3)
    expect(down!.top).toBeCloseTo(841.89 - 400, 3)
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

  // An embedded file is invisible to the page's text and images. PDF.js
  // reads it from the name tree, by name, with its description and its
  // bytes inflated; a PDF that embeds none has none, read so rather than
  // left out, which a test asking "how many files" would take for none.
  test('reads each file the name tree embeds, with its bytes, and none from a PDF that embeds none', async () => {
    const xml = new TextEncoder().encode('<Rechnung>Grüße</Rechnung>\r\n')
    const embedded = await pdfmakePdf({ content: [{ text: 'with a file' }] }, (document) => document.file(exactBuffer(xml), { name: 'factur-x.xml', type: 'text/xml', description: 'invoice data' }))
    expect((await readPdf(embedded)).attachments).toEqual([{ name: 'factur-x.xml', description: 'invoice data', bytes: xml }])
    expect((await readPdf(await pdfmakePdf({ content: [{ text: 'without' }] }))).attachments).toEqual([])
  })

  // A vector drawing -- an SVG image, a QR code -- is paths, which text
  // extraction and image boxes never see. Each is where the page puts it,
  // through a transform and a form XObject's matrix as an image is, with how
  // it is painted and in what: read wrong, a drawing in other colours, or
  // past its box, would pass.
  test('finds each path painted, where it lands, how it is painted and in what', async () => {
    const inner = await PDFDocument.create()
    inner.addPage([200, 100]).pushOperators(setFillingRgbColor(0, 1, 0), rectangle(10, 20, 50, 40), fill())
    const document = await PDFDocument.create()
    const form = await document.embedPage((await PDFDocument.load(await inner.save())).getPage(0), undefined, [2, 0, 0, 2, 0, 0])
    const page = document.addPage([595.28, 841.89])
    page.pushOperators(
      ...group(setFillingRgbColor(0.2, 0.4, 0.6), rectangle(100, 700, 50, 20), fill()),
      ...group(concatTransformationMatrix(2, 0, 0, 2, 300, 500), setStrokingRgbColor(1, 0, 0), moveTo(0, 0), lineTo(10, 5), stroke()),
      ...group(setFillingRgbColor(0, 0, 0), setStrokingRgbColor(0, 0, 1), rectangle(50, 50, 10, 10), fillAndStroke()),
    )
    page.drawPage(form, { x: 100, y: 500 })
    const { paths } = (await readPdf(await document.save())).pages[0]!
    expect(paths.map((path) => ({ box: [path.x, path.top, path.width, path.height].map(hundredths), paint: path.paint, fill: path.fill, stroke: path.stroke }))).toEqual([
      { box: [100, 121.89, 50, 20], paint: 'fill', fill: '#336699' },
      // The line's box is its points', two units by one doubled, before any stroke's width.
      { box: [300, 331.89, 20, 10], paint: 'stroke', stroke: '#ff0000' },
      { box: [50, 781.89, 10, 10], paint: 'fillStroke', fill: '#000000', stroke: '#0000ff' },
      // The form's 50 × 40 rectangle at 10, 20, doubled by its matrix, then moved to 100, 500 on the page.
      { box: [120, 221.89, 100, 80], paint: 'fill', fill: '#00ff00' },
    ])
  })

  // An SVG image is drawn inside a clip of exactly its box, which is how a
  // check finds it. A clip is a rectangle by its corners on the page: a
  // diamond's bounding box is a square, and judged by it, a clip that cut
  // the corners off a logo would pass as its box (0030). A path knows
  // the innermost rectangle it was painted inside, until the state that set
  // it is restored.
  test('lists a clip only when it is one rectangle on the page, judged by its corners', async () => {
    const document = await PDFDocument.create()
    const page = document.addPage([595.28, 841.89])
    const square = (x: number, y: number, side: number): PDFOperator[] => [moveTo(x, y), lineTo(x + side, y), lineTo(x + side, y + side), lineTo(x, y + side), closePath()]
    const diamond = (x: number, y: number, side: number): PDFOperator[] => [moveTo(x, y + side / 2), lineTo(x + side / 2, y), lineTo(x + side, y + side / 2), lineTo(x + side / 2, y + side), closePath()]
    const paint = (x: number, y: number): PDFOperator[] => [setFillingRgbColor(1, 0, 0), rectangle(x, y, 5, 5), fill()]
    page.pushOperators(
      ...group(rectangle(100, 600, 80, 40), clip(), endPath(), ...paint(90, 590)),
      ...paint(300, 600),
      ...group(...square(400, 600, 50), clip(), endPath(), ...paint(410, 610)),
      ...group(...diamond(500, 600, 50), clip(), endPath(), ...paint(520, 620)),
      ...group(moveTo(100, 300), appendBezierCurve(100, 350, 150, 350, 150, 300), closePath(), clip(), endPath(), ...paint(110, 310)),
      // A quarter turn: the rectangle 40 by 20 stands 20 wide and 40 tall on the page, its sides still along the page's.
      ...group(concatTransformationMatrix(0, 1, -1, 0, 300, 300), rectangle(0, 0, 40, 20), clip(), endPath()),
      ...group(rectangle(100, 100, 200, 200), clip(), endPath(), ...group(...diamond(150, 150, 50), clip(), endPath(), ...paint(170, 170))),
      // Two rectangles are no one rectangle, a triangle is none, and a clip of no path is none; a square drawn back to its start before it closes is one.
      ...group(rectangle(400, 100, 20, 20), rectangle(430, 100, 20, 20), clip(), endPath()),
      ...group(moveTo(500, 100), lineTo(550, 100), lineTo(525, 150), closePath(), clip(), endPath()),
      ...group(clip(), endPath()),
      ...group(moveTo(400, 200), lineTo(450, 200), lineTo(450, 250), lineTo(400, 250), lineTo(400, 200), closePath(), clip(), endPath()),
    )
    const { clips, paths } = (await readPdf(await document.save())).pages[0]!
    expect(clips.map(({ x, top, width, height }) => [x, top, width, height].map(hundredths))).toEqual([
      [100, 201.89, 80, 40],
      [400, 191.89, 50, 50],
      [280, 501.89, 20, 40],
      [100, 541.89, 200, 200],
      [400, 591.89, 50, 50],
    ])
    // Painted inside the first, after it, inside the square, inside the diamond and the curve alone, and inside the diamond inside the last rectangle.
    expect(paths.map((path) => path.clip)).toEqual([0, undefined, 1, undefined, undefined, 3])
  })

  // An SVG's clip path is painted into a soft mask, in white: it says where
  // the drawing shows, and paints nothing a reader sees. Read as paint, a
  // white mark on blue would pass a check of its colours for the wrong
  // reason (0030). And PDF.js hands a transparency group's form -- a
  // group at an opacity -- no matrix, which the reader once took for six
  // numbers and threw on: no SVG with a group could be read at all.
  test('reads nothing of a soft mask, where an SVG clip path is painted white, and reads through a group and a gradient', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<defs><clipPath id="c"><circle cx="50" cy="50" r="40"/></clipPath><linearGradient id="g"><stop offset="0" stop-color="#000000"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>' +
      '<rect width="100" height="100" fill="#1f4e79" clip-path="url(#c)"/><rect y="90" width="100" height="10" fill="url(#g)"/>' +
      '<g opacity="0.5"><rect width="10" height="10" fill="#e9c46a"/></g><rect x="20" y="20" width="60" height="40" fill="none" stroke="url(#g)" stroke-width="2"/></svg>'
    const { paths, clips } = (await readPdf(await pdfmakePdf({ pageMargins: [40, 60, 40, 60], content: [{ svg, width: 100, height: 100 }] }))).pages[0]!
    expect(paths.map(({ paint, fill, stroke, clip: inside }) => ({ paint, fill, stroke, inside }))).toEqual([
      { paint: 'fill', fill: '#1f4e79', stroke: undefined, inside: 0 },
      { paint: 'fill', fill: 'pattern', stroke: undefined, inside: 0 },
      { paint: 'fill', fill: '#e9c46a', stroke: undefined, inside: 0 },
      { paint: 'stroke', fill: undefined, stroke: 'pattern', inside: 0 },
    ])
    expect(clips.map(({ x, top, width, height }) => [x, top, width, height].map(hundredths))).toEqual([[40, 60, 100, 100]])
  })

  // A soft mask is skipped whole, however deep it holds groups of its own:
  // the white of a mask's second shape, after a group at an opacity inside
  // it, is no more paint a reader sees than its first.
  test('reads nothing of a soft mask that holds a group of its own', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><mask id="m">' +
      '<g opacity="0.5"><rect width="100" height="100" fill="#ffffff"/></g><rect width="50" height="50" fill="#ffffff"/>' +
      '</mask></defs><rect width="100" height="100" fill="#1f4e79" mask="url(#m)"/></svg>'
    const { paths } = (await readPdf(await pdfmakePdf({ content: [{ svg, width: 100, height: 100 }] }))).pages[0]!
    expect(paths.map((path) => path.fill)).toEqual(['#1f4e79'])
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
