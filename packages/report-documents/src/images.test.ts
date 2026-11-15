import { deflate } from 'pako'
import { describe, expect, test } from 'vitest'
import { imagePixels } from './images.js'
import { MAX_DOCUMENT_IMAGE_PIXELS, MAX_DOCUMENT_INFLATED } from './limits.js'
import type { PdfStream } from './model.js'
import { AT_A_BOUND, parsed } from './parse-test-support.js'
import { expectPrintRefused, letter, pagesFile, printedWhole, type Body } from './pages-test-support.js'
import { refusal, type DocumentRefusal } from './refusals.js'
import { deflatedZeros, latin1, MIB } from './test-pdf.js'

/**
 * An image as a viewer of the report decodes it: held to the pixels it
 * declares and passed on as it is written, its data charged nothing -- an
 * image XObject and its masks, each an image where it stands; anything
 * else that says it is an image is decoded as any stream is.
 */

const MAX = MAX_DOCUMENT_IMAGE_PIXELS

/** An image XObject of `entries` after its type, holding `data`: one byte unless said otherwise, which no reader decodes. */
const image = (entries: string, data: Uint8Array = new Uint8Array(1)): Body => ({ dict: `/Type/XObject/Subtype/Image${entries}`, data })

/** A grey image of `width` by `height`, eight bits a sample. */
const grey = (width: number, height: number): string => `/Width ${width}/Height ${height}/ColorSpace/DeviceGray/BitsPerComponent 8`

/** A page that draws image 30, written as `body`, beside `objects`. */
const drawing = (body: Body, objects: Readonly<Record<number, Body>> = {}): Uint8Array =>
  pagesFile([letter('', { resources: '<</XObject<</Im0 30 0 R>>>>' })], { 30: body, ...objects })

/** Data that is no Flate, which the reader refuses wherever it decodes it. */
const NOT_FLATE = latin1('not deflate data')

/** The pixels image 30 of a page declares, `entries` its own after its type, or why they cannot be counted. */
function pixels(entries: string, objects: Readonly<Record<number, Body>> = {}): number | DocumentRefusal {
  const document = parsed(drawing(image(entries), objects))
  return imagePixels(document, (document.objects.get(30) as PdfStream).dict)
}

/** A page whose TrueType font 20 keeps its file in 22, written as `file`, beside `objects`, and draws `resources` besides. */
const font = (file: Body, objects: Readonly<Record<number, Body>> = {}, resources = '<</Font<</F1 20 0 R>>>>'): Uint8Array =>
  pagesFile([letter('', { resources })], {
    20: '<</Type/Font/Subtype/TrueType/BaseFont/Probe/FontDescriptor 21 0 R>>',
    21: '<</Type/FontDescriptor/FontName/Probe/FontFile2 22 0 R>>',
    22: file,
    ...objects,
  })

describe('an image is held to the pixels it declares', () => {
  // The reader never decodes an image, so what a viewer of the report
  // decodes it to is what it declares: past the bound, a file of a few
  // bytes would have every viewer allocate gigabytes. At the bound it
  // reads, whatever its colours -- a 48-megapixel colour photograph among
  // them -- and one pixel more is refused, however its width and its
  // height make it up.
  test('an image XObject at MAX_DOCUMENT_IMAGE_PIXELS reads and one pixel more is refused', () => {
    expect(printedWhole(drawing(image('/Width 10000/Height 5000/ColorSpace/DeviceCMYK/BitsPerComponent 8'))).closure.has(30)).toBe(true)
    expect(printedWhole(drawing(image('/Width 8000/Height 6000/ColorSpace/DeviceRGB/BitsPerComponent 8'))).closure.has(30)).toBe(true)
    expectPrintRefused(drawing(image(grey(MAX + 1, 1))), 'inflates-too-far', 'image-pixels')
    expectPrintRefused(drawing(image(grey(1, MAX + 1))), 'inflates-too-far', 'image-pixels')
    expectPrintRefused(drawing(image('/Width 10001/Height 5000/ColorSpace/DeviceCMYK/BitsPerComponent 8')), 'inflates-too-far', 'image-pixels')
    expectPrintRefused(drawing(image(`/ImageMask true/Width ${MAX + 1}/Height 1`)), 'inflates-too-far', 'image-pixels')
  })

  // A lossless scan inflates to megabytes a page, which the budget would
  // refuse a document of a few pages for, though a viewer decodes no more
  // of it than the image's size: its data is passed on as it is written
  // and charged nothing, where a form's of the same size is charged. Data
  // that is no Flate at all, or a JPEG behind a Flate stage, is the
  // viewer's to decode, and the reader reads neither.
  test("an image XObject's Flate data is passed on undecoded and charges nothing to the budget", AT_A_BOUND, () => {
    const zeros = deflatedZeros(30 * MIB)
    const form: Body = { dict: '/Type/XObject/Subtype/Form/BBox[0 0 10 10]/Filter/FlateDecode', data: zeros }
    const beside = (body: Body): Uint8Array => pagesFile([letter('', { resources: '<</XObject<</Im0 30 0 R/Fm0 31 0 R>>>>' })], { 30: body, 31: form })
    expect(printedWhole(beside(image(`${grey(5_120, 6_144)}/Filter/FlateDecode`, zeros))).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - 30 * MIB)
    expectPrintRefused(beside(form), 'inflates-too-far', 'inflated')
    expect(printedWhole(drawing(image(`${grey(1, 1)}/Filter/FlateDecode`, NOT_FLATE))).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED)
    const behind = image(`${grey(1, 1)}/Filter[/FlateDecode/DCTDecode]`, deflate(latin1('JFIF')))
    expect(printedWhole(drawing(behind)).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED)
  })

  // An image is held to its pixels and nothing else of what it declares:
  // what its colours are is the viewer's, and a JPEG 2000 image that leaves
  // them to its data, or one whose colour space is a name only a viewer's
  // resources resolve, is no less bounded for it. Counting them would
  // refuse such images for nothing the bound needs.
  test('an image XObject is not refused for colours the reader cannot count', () => {
    for (const space of ['/Filter/JPXDecode', '/ColorSpace/CS0', '/ColorSpace/Pattern', '/ColorSpace[/ICCBased 5]', '']) {
      expect(pixels(`/Width 10/Height 2/BitsPerComponent 8${space}`)).toBe(20)
    }
    expect(printedWhole(drawing(image('/Width 10/Height 2/BitsPerComponent 8/Filter/JPXDecode'), {})).closure.has(30)).toBe(true)
  })

  // PDF.js reads an image's width as /W before /Width and its height as /H,
  // an XObject's as an inline image's: read by the full key alone, an image
  // that wrote /W 50000 and /Width 1 would be held to one column and
  // decoded to fifty thousand. Each is read either way and refused where
  // both are given, and a size that is not a whole number from one is
  // refused.
  test("an image's size is read abbreviated or in full, and refused where it gives both", () => {
    expect(pixels('/W 10/H 2')).toBe(20)
    expect(pixels('/Width 46 0 R/Height 2', { 46: '10' })).toBe(20)
    for (const size of ['/W 10/Width 10/Height 2', '/Width 10/H 2/Height 2', '/Height 2', '/Width 10', '/Width 0/Height 2', '/Width 1.5/Height 2']) {
      expect(pixels(size)).toEqual(refusal('image-size'))
    }
    for (const size of ['/Width -1/Height 2', '/Width(10)/Height 2', '/Width 99 0 R/Height 2']) {
      expect(pixels(size)).toEqual(refusal('image-size'))
    }
    expectPrintRefused(drawing(image('/W 50000/Width 1/Height 1/ColorSpace/DeviceGray')), 'malformed', 'image-size')
  })

  // A soft mask and a stencil mask are images a viewer decodes beside the
  // image they mask, each to its own size and whatever its own /Subtype
  // says: an image of one pixel masked by one of a hundred million is
  // decoded to a hundred million. Each is held to the bound as an image of
  // its own where it stands, and its data passed on undecoded.
  test('an /SMask image is held to the same bound', () => {
    const masked = (mask: Body, key = 'SMask'): Uint8Array => drawing(image(`${grey(1, 1)}/${key} 31 0 R`), { 31: mask })
    expect(printedWhole(masked(image(grey(MAX, 1)))).closure.has(31)).toBe(true)
    expectPrintRefused(masked(image(grey(MAX + 1, 1))), 'inflates-too-far', 'image-pixels')
    expectPrintRefused(masked({ dict: grey(MAX + 1, 1), data: new Uint8Array(1) }), 'inflates-too-far', 'image-pixels')
    expectPrintRefused(masked(image(`/ImageMask true/Width ${MAX + 1}/Height 1`), 'Mask'), 'inflates-too-far', 'image-pixels')
    expect(printedWhole(masked(image(`${grey(1, 1)}/Filter/FlateDecode`, NOT_FLATE))).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED)
    expect(printedWhole(masked({ dict: `${grey(1, 1)}/Filter/FlateDecode`, data: NOT_FLATE })).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED)
  })

  // Whether a stream is an image is where it stands, never what it says of
  // itself (the closure's lesson): a font file or a sampled function that
  // writes /Subtype /Image is read by a viewer as the font or the function
  // it stands as, decoded whole, and so is decoded and charged as any
  // stream is -- passed on undecoded, its Flate would reach every viewer
  // unbounded. An image a font descriptor also names is decoded as that
  // font, whichever the closure reaches first.
  test('a font file or function writing /Subtype /Image is decoded and charged as any stream is', () => {
    const rows = deflate(latin1('a font file of no glyphs'))
    expect(printedWhole(font({ dict: `/Subtype/Image${grey(1, 1)}/Filter/FlateDecode`, data: rows })).parsed.budget.left).toBe(
      MAX_DOCUMENT_INFLATED - 'a font file of no glyphs'.length,
    )
    expectPrintRefused(font({ dict: `/Subtype/Image${grey(1, 1)}/Filter/FlateDecode`, data: NOT_FLATE }), 'malformed', 'flate-header')
    expectPrintRefused(font({ dict: `/Subtype/Image${grey(1, 1)}/Filter/DCTDecode`, data: NOT_FLATE }), 'unsupported-filter', 'filter')
    expect(printedWhole(font({ dict: `/Subtype/Image${grey(MAX + 1, 1)}`, data: NOT_FLATE })).closure.has(22)).toBe(true)
    const tinted = (fn: string): Uint8Array =>
      pagesFile([letter('', { resources: '<</ColorSpace<</CS0[/Separation/Spot/DeviceCMYK 40 0 R]>>>>' })], { 40: { dict: fn, data: NOT_FLATE } })
    const sampled = '/FunctionType 0/Domain[0 1]/Range[0 1 0 1 0 1 0 1]/Size[2]/BitsPerSample 8/Filter/FlateDecode'
    expectPrintRefused(tinted(`${sampled}/Subtype/Image${grey(1, 1)}`), 'malformed', 'flate-header')
    const named = { dict: `/Subtype/Image${grey(1, 1)}/Filter/FlateDecode`, data: NOT_FLATE }
    for (const resources of ['<</XObject<</Im0 22 0 R>>/Font<</F1 20 0 R>>>>', '<</Font<</F1 20 0 R>>/XObject<</Im0 22 0 R>>>>']) {
      expectPrintRefused(font(named, {}, resources), 'malformed', 'flate-header')
    }
  })

  // An XObject is drawn as an image where its /Subtype says so, a reference
  // resolved as Do resolves it: read unresolved, an image written so would
  // be decoded as data a viewer never decodes. And a map of XObjects is
  // read as one wherever else the same dictionary stands -- as a pattern
  // map, here, met first -- or an image a viewer draws from it would never
  // be held to its pixels.
  test('an image is held where it stands as an XObject, however else the closure meets it', () => {
    const resolvedType = drawing({ dict: '/Type/XObject/Subtype 31 0 R/Width 1/Height 1/Filter/FlateDecode', data: NOT_FLATE }, { 31: '/Image' })
    expect(printedWhole(resolvedType).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED)
    const shared = pagesFile([letter('', { resources: '<</XObject 50 0 R/Pattern 50 0 R>>' })], { 30: image(grey(MAX + 1, 1)), 50: '<</Im0 30 0 R>>' })
    expectPrintRefused(shared, 'inflates-too-far', 'image-pixels')
  })

  // A viewer that prints by the standard prints the alternate an image
  // marks /DefaultForPrinting (ISO 32000-1 8.9.5.4), and Report prints:
  // read as data, an alternate's declared size was never held, and one of
  // a few bytes of Flate passed every bound. Each alternate's /Image is an
  // image where it stands, whatever it says of itself, the list and its
  // entries written by reference or not: held to its pixels and passed on
  // undecoded.
  test("an image's alternates are images, held to their pixels", () => {
    const alternated = (alternate: Body, alternates = '[<</Image 31 0 R/DefaultForPrinting true>>]', objects = {}): Uint8Array =>
      drawing(image(`${grey(1, 1)}/Alternates ${alternates}`), { 31: alternate, ...objects })
    expect(printedWhole(alternated(image(grey(MAX, 1)))).closure.has(31)).toBe(true)
    expectPrintRefused(alternated(image(grey(MAX + 1, 1))), 'inflates-too-far', 'image-pixels')
    expectPrintRefused(alternated({ dict: grey(MAX + 1, 1), data: new Uint8Array(1) }), 'inflates-too-far', 'image-pixels')
    expectPrintRefused(alternated(image(grey(MAX + 1, 1)), '32 0 R', { 32: '[33 0 R]', 33: '<</Image 31 0 R>>' }), 'inflates-too-far', 'image-pixels')
    // An alternate the closure meets first as any value -- under a key after /Alternates -- is read as an alternate all the same.
    const probed = drawing(image(`${grey(1, 1)}/Alternates[33 0 R]/Probe 33 0 R`), { 31: image(grey(MAX + 1, 1)), 33: '<</Image 31 0 R>>' })
    expectPrintRefused(probed, 'inflates-too-far', 'image-pixels')
    // /Image anywhere else is no image: decoded as any stream is.
    expectPrintRefused(
      drawing(image(`${grey(1, 1)}/Probe<</Image 31 0 R>>`), { 31: { dict: '/Filter/FlateDecode', data: NOT_FLATE } }),
      'malformed',
      'flate-header',
    )
    expect(printedWhole(alternated(image(`${grey(1, 1)}/Filter/FlateDecode`, NOT_FLATE))).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED)
  })

  // An image's data is passed on as it is written, so one that keeps it in
  // another file (/F) is one whose bytes the reader would pass on as data a
  // viewer reads elsewhere -- or decodes through the filters PDF.js reads
  // /F as -- and is refused as any stream is, never decoded.
  test('an image that keeps its data in another file is refused', () => {
    expectPrintRefused(drawing(image(`${grey(1, 1)}/F(scan.jpg)`)), 'unsupported-filter', 'external')
    expectPrintRefused(drawing(image(`${grey(1, 1)}/F/FlateDecode`, NOT_FLATE)), 'unsupported-filter', 'external')
  })
})
