import { deflateSync } from 'node:zlib'
import pdfmake from 'pdfmake'
import { IMAGE_KINDS, readPdf } from '@formancy/report-corpus'
import { MAX_ASSET_BYTES, RenderRefusal, XRECHNUNG_COPY_LABEL, type Image, type ImageAsset, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import { checkImageAsset } from './assets.js'
import { renderPdf } from './node.js'
import { bareDocument, paragraph, TIMEOUT } from './testing/documents.js'
import { copied, invoiced } from './testing/e-invoice.js'
import { asset, encodePng, exifSegment, frameSegment, idat, ihdr, jpegOf, NONE, pngOf } from './testing/images.js'
import { svg, svgAsset } from './testing/svg.js'

/**
 * The image checks the renderer makes before pdfmake sees an asset. Every
 * image here is built in code from its parts, so a reviewer can read what
 * each one is: PNGs from their chunks, each with a correct CRC unless the
 * CRC is the point, and JPEGs from their segments.
 */

/** An 8 × 8 RGB image's chunks around `data`: 8 rows of 24 bytes when the data is right. */
const rgb8 = (data: Uint8Array): Uint8Array =>
  pngOf([
    ['IHDR', ihdr(8, 8)],
    ['IDAT', data],
    ['IEND', NONE],
  ])

/**
 * An interlaced 8 × 8 RGB PNG of one grey: Adam7's seven passes, each a
 * small image of its own -- 1×1, 1×1, 2×1, 2×2, 4×2, 4×4 and 8×4 pixels --
 * one scanline after another.
 */
function interlacedPng(): Uint8Array {
  const passes = [
    [1, 1],
    [1, 1],
    [2, 1],
    [2, 2],
    [4, 2],
    [4, 4],
    [8, 4],
  ] as const
  const scanlines = passes.flatMap(([width, height]) => Array.from({ length: height }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x80)])))
  return pngOf([
    ['IHDR', ihdr(8, 8, { interlace: 1 })],
    ['IDAT', new Uint8Array(deflateSync(Buffer.concat(scanlines)))],
    ['IEND', NONE],
  ])
}

/** A paletted 8 × 8 PNG: a palette of two colours, one byte an index per pixel. */
function palettedPng(): Uint8Array {
  return pngOf([
    ['IHDR', ihdr(8, 8, { colour: 3 })],
    ['PLTE', new Uint8Array([0, 0, 0, 255, 255, 255])],
    ['IDAT', idat(8, 8)],
    ['IEND', NONE],
  ])
}

async function refusal(of: ImageAsset): Promise<RenderRefusal | undefined> {
  try {
    await checkImageAsset(of)
    return undefined
  } catch (error) {
    if (error instanceof RenderRefusal) return error
    throw error
  }
}

describe('checkImageAsset refuses, naming the asset and why', () => {
  // Each is bytes that pdfmake would copy into the PDF as a broken image, or
  // fail on with an error that names no asset: PDFKit embeds a PNG's
  // compressed data and a JPEG's scan without decoding either.
  test.each([
    ['bytes cut off between chunks', () => asset(encodePng(8, 8, () => [1, 2, 3]).subarray(0, 40)), /is cut off at byte 33$/],
    ['bytes cut off inside a chunk', () => asset(encodePng(8, 8, () => [1, 2, 3]).subarray(0, 50)), /is cut off at byte 33$/],
    [
      'a PNG declared as a JPEG',
      () =>
        asset(
          encodePng(8, 8, () => [1, 2, 3]),
          'image/jpeg',
        ),
      /is declared a JPEG and is not one: it is a PNG$/,
    ],
    ['a JPEG declared as a PNG', () => asset(jpegOf()), /is declared a PNG and is not one: it is a JPEG$/],
    ['bytes that are neither, declared a PNG', () => asset(new TextEncoder().encode('Not an image at all.')), /is declared a PNG and is not one$/],
    [
      'bytes that are neither, declared a JPEG',
      () => asset(new TextEncoder().encode('Not an image at all.'), 'image/jpeg'),
      /is declared a JPEG and is not one$/,
    ],
    [
      'a media type the renderer does not draw',
      () =>
        asset(
          encodePng(8, 8, () => [1, 2, 3]),
          'image/gif' as 'image/png',
        ),
      /is of a media type the renderer does not draw \(image\/gif\)$/,
    ],
    ['no bytes at all', () => ({ ...asset(NONE), bytes: undefined as unknown as Uint8Array }), /has no bytes$/],
    [
      'a chunk whose CRC is wrong',
      () =>
        asset(
          Uint8Array.from(
            encodePng(8, 8, () => [1, 2, 3]),
            (byte, index) => (index === 29 ? byte ^ 0xff : byte),
          ),
        ),
      /has the wrong CRC on its IHDR chunk$/,
    ],
    [
      'image data before the header',
      () =>
        asset(
          pngOf([
            ['IDAT', idat(8, 24)],
            ['IHDR', ihdr(8, 8)],
            ['IEND', NONE],
          ]),
        ),
      /does not start with its header chunk$/,
    ],
    [
      'a header of the wrong length',
      () =>
        asset(
          pngOf([
            ['IHDR', ihdr(8, 8).subarray(0, 12)],
            ['IDAT', idat(8, 24)],
            ['IEND', NONE],
          ]),
        ),
      /has a header chunk of the wrong length$/,
    ],
    [
      'a colour type with a bit depth it does not allow',
      () =>
        asset(
          pngOf([
            ['IHDR', ihdr(8, 8, { depth: 4 })],
            ['IDAT', idat(8, 12)],
            ['IEND', NONE],
          ]),
        ),
      /has an invalid colour type and bit depth \(2, 4\)$/,
    ],
    [
      'an interlace method PNG does not define',
      () =>
        asset(
          pngOf([
            ['IHDR', ihdr(8, 8, { interlace: 2 })],
            ['IDAT', idat(8, 24)],
            ['IEND', NONE],
          ]),
        ),
      /has an unknown compression, filter or interlace method$/,
    ],
    [
      'no image data',
      () =>
        asset(
          pngOf([
            ['IHDR', ihdr(8, 8)],
            ['IEND', NONE],
          ]),
        ),
      /has no image data$/,
    ],
    ['bytes after the end chunk', () => asset(new Uint8Array([...rgb8(idat(8, 24)), 0])), /has bytes after its end chunk$/],
    [
      'a paletted image without its palette',
      () =>
        asset(
          pngOf([
            ['IHDR', ihdr(8, 8, { colour: 3 })],
            ['IDAT', idat(8, 8)],
            ['IEND', NONE],
          ]),
        ),
      /is paletted and has no palette$/,
    ],
    ['image data that is not deflated', () => asset(rgb8(new Uint8Array(32).fill(7))), /has image data that does not inflate$/],
    ['image data with bytes after its stream', () => asset(rgb8(new Uint8Array([...idat(8, 24), 1, 2, 3]))), /has image data that does not inflate$/],
    [
      'image data short of its scanlines',
      () => asset(rgb8(new Uint8Array(deflateSync(Buffer.alloc(10))))),
      /has image data of 10 bytes where its header promises 200$/,
    ],
    ['image data past its scanlines', () => asset(rgb8(idat(9, 24))), /has more image data than the 200 bytes its header promises$/],
    [
      'an interlaced image with the data of one that is not',
      () =>
        asset(
          pngOf([
            ['IHDR', ihdr(8, 8, { interlace: 1 })],
            ['IDAT', idat(8, 24)],
            ['IEND', NONE],
          ]),
        ),
      /has image data of 200 bytes where its header promises 207$/,
    ],
    ['a scanline filter PNG does not define', () => asset(rgb8(idat(8, 24, 7))), /has a scanline with an unknown filter type \(7\)$/],
    [
      'a PNG of no pixels',
      () =>
        asset(
          pngOf([
            ['IHDR', ihdr(0, 8)],
            ['IDAT', idat(8, 1)],
            ['IEND', NONE],
          ]),
        ),
      /has no pixels \(0 × 8\)$/,
    ],
    ['a PNG wider than 4096 pixels', () => asset(encodePng(4097, 1, () => [0, 0, 0])), /is 4097 × 1 pixels; the limit is 4096 pixels a side$/],
    [
      'an asset of more than 20 MB',
      () =>
        asset(
          pngOf([
            ['IHDR', ihdr(8, 8)],
            ['tEXt', new Uint8Array(MAX_ASSET_BYTES)],
            ['IEND', NONE],
          ]),
        ),
      /is \d+ bytes; the limit is 20971520 \(20 MB\)$/,
    ],
    ['a JPEG taller than 4096 pixels', () => asset(jpegOf({ height: 5000, width: 10 }), 'image/jpeg'), /is 10 × 5000 pixels; the limit is 4096 pixels a side$/],
    [
      'a JPEG with a stray byte between segments',
      () => asset(new Uint8Array([0xff, 0xd8, 0x00, ...jpegOf().subarray(2)]), 'image/jpeg'),
      /has a malformed segment at byte 2$/,
    ],
    ['a JPEG segment longer than the file', () => asset(jpegOf().subarray(0, 30), 'image/jpeg'), /has a segment that runs past its end at byte 2$/],
    [
      'a JPEG frame header too short to hold a size',
      () => asset(new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x05, 8, 0, 8, 0xff, 0xd9]), 'image/jpeg'),
      /has a frame header of the wrong length$/,
    ],
    [
      'a JPEG scan before its frame header',
      () => asset(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0, 0x3f, 0xff, 0xd9]), 'image/jpeg'),
      /has image data before its frame header$/,
    ],
    ['a JPEG cut off in its scan', () => asset(jpegOf({ end: false }), 'image/jpeg'), /is cut off: it does not end with an end-of-image marker$/],
    ['a JPEG of tables and no scan', () => asset(jpegOf({ scan: false }), 'image/jpeg'), /is cut off before its image data$/],
    // PDFKit takes the first segment whose marker is a frame's, JPG's (C8)
    // or DAC's (CC) for the frame header and draws the image by its
    // component count (pdfkit.js 3807, 3822-3843). One that stands before
    // the frame, or a second frame header, would have PDFKit draw it
    // otherwise than the check read it: a DAC segment shaped as a frame of
    // four components drew an RGB JPEG in DeviceCMYK, past an e-invoice's
    // refusal, and veraPDF 1.30.3 failed it on 6.2.4.3-3 (measured on
    // 18 October 2026). Two components PDFKit gives no colour space at all.
    [
      'a JPEG with a DAC segment before its frame header',
      () => asset(jpegOf({ components: 3, segments: frameSegment({ marker: 0xcc, components: 4 }) }), 'image/jpeg'),
      /has a DAC segment \(FFCC\) before its frame header, which PDFKit would read as the frame header$/,
    ],
    [
      'a JPEG with a JPG segment before its frame header',
      () => asset(jpegOf({ components: 3, segments: frameSegment({ marker: 0xc8, components: 4 }) }), 'image/jpeg'),
      /has a JPG segment \(FFC8\) before its frame header, which PDFKit would read as the frame header$/,
    ],
    [
      'a JPEG of two frame headers, of four components and then three',
      () => asset(jpegOf({ components: 3, segments: frameSegment({ components: 4 }) }), 'image/jpeg'),
      /has two frame headers$/,
    ],
    [
      'a JPEG of two frame headers, of three components and then four',
      () => asset(jpegOf({ components: 4, segments: frameSegment({ components: 3 }) }), 'image/jpeg'),
      /has two frame headers$/,
    ],
    ['a JPEG of two components', () => asset(jpegOf({ components: 2 }), 'image/jpeg'), /has a frame header of 2 components, where PDFKit draws 1, 3 or 4$/],
    ['a JPEG declared an SVG', () => asset(jpegOf(), 'image/svg+xml'), /is declared an SVG and is not one: it is a JPEG$/],
    [
      'an SVG not in the form cleanSvg writes',
      () => asset(new TextEncoder().encode(svg('<!-- made by hand --><rect width="1" height="1"/>')), 'image/svg+xml'),
      /is not an SVG the renderer draws: the drawing holds a comment, which cleaning removes; clean it with cleanSvg first$/,
    ],
    [
      'bytes that are not an SVG, declared one',
      () => asset(new TextEncoder().encode('Not an image at all.'), 'image/svg+xml'),
      /is not an SVG the renderer draws: /,
    ],
  ])('%s', async (_, made, reason) => {
    const refused = await refusal(made())
    expect(refused?.code).toBe('invalid-asset')
    expect(refused?.subject).toBe('asset-under-test')
    expect(refused?.message).toMatch(new RegExp(`^the image asset asset-under-test ${reason.source}`))
  })

  // A render refuses the asset as the check does, naming it, and draws no
  // page with a hole where the image was.
  test('a render with an invalid asset', async () => {
    const broken = asset(new TextEncoder().encode('These bytes say they are a PNG.'), 'image/png', 'logo-broken')
    await expect(
      renderPdf(bareDocument('Broken', [{ kind: 'image', asset: broken, width: 40, height: 40, fit: 'contain' }]), { maxPages: 1 }),
    ).rejects.toMatchObject({ code: 'invalid-asset', subject: 'logo-broken' })
  })
})

describe('checkImageAsset accepts', () => {
  // A check that refused every image would pass every test above. These are
  // the kinds of image it reads past the header -- interlaced, paletted, and
  // a JPEG's segments -- each drawn by pdfmake and found in the PDF, so that
  // the arithmetic the checks rely on is the arithmetic a decoder uses.
  test.each([
    ['an RGB PNG', () => asset(encodePng(8, 8, (x, y) => [x * 30, y * 30, 90]))],
    [
      'a PNG with a chunk the check does not read',
      () =>
        asset(
          pngOf([
            ['IHDR', ihdr(8, 8)],
            ['tEXt', new TextEncoder().encode('Comment\0made in code')],
            ['IDAT', idat(8, 24)],
            ['IEND', NONE],
          ]),
        ),
    ],
    [
      'a PNG whose image data is split over chunks',
      () =>
        asset(
          pngOf([
            ['IHDR', ihdr(8, 8)],
            ['IDAT', idat(8, 24).subarray(0, 10)],
            ['IDAT', idat(8, 24).subarray(10)],
            ['IEND', NONE],
          ]),
        ),
    ],
    ['an interlaced PNG', () => asset(interlacedPng())],
    ['a paletted PNG', () => asset(palettedPng())],
    ['a baseline JPEG', () => asset(jpegOf(), 'image/jpeg')],
    ['a JPEG with an Exif block', () => asset(jpegOf({ exif: exifSegment(1) }), 'image/jpeg')],
    // PDFKit has read the frame header by then, so a DAC segment after it is a table like any other.
    [
      'a JPEG with a DAC segment after its frame header',
      () => asset(jpegOf({ components: 3, afterFrame: frameSegment({ marker: 0xcc, components: 4 }) }), 'image/jpeg'),
    ],
  ])('%s, and pdfmake draws it', async (_, made) => {
    const image = made()
    expect(await refusal(image)).toBeUndefined()
    const pdf = await readPdf(await renderPdf(bareDocument('Image', [{ kind: 'image', asset: image, width: 40, height: 40, fit: 'contain' }]), { maxPages: 1 }))
    expect(pdf.pages.flatMap((page) => page.images)).toHaveLength(1)
  })

  // An image larger than a page is not pixels the check keeps: it reads the
  // filter bytes as the data inflates, and holds no more of it than a chunk.
  // Inflating its 50 MB of scanlines took 0.5 seconds on its own and past
  // vitest's default 5 under coverage on a busy machine, hence the timeout.
  test(
    'a PNG of 4096 × 4096 pixels, the largest it allows',
    async () => {
      expect(
        await checkImageAsset(
          asset(
            pngOf([
              ['IHDR', ihdr(4096, 4096)],
              ['IDAT', idat(4096, 4096 * 3)],
              ['IEND', NONE],
            ]),
          ),
        ),
      ).toMatchObject({ width: 4096, height: 4096 })
    },
    TIMEOUT,
  )
})

describe('checkImageAsset reads an SVG', () => {
  // The renderer fits an SVG by its viewBox, as it fits a picture by its
  // pixels, hands pdfmake the very text that was approved, and holds a
  // render to what it costs and an e-invoice to how far its numbers reach:
  // a viewBox read the wrong way round would squeeze a wide logo into a
  // tall box, an origin lost would bound an e-invoice's numbers short
  // (`svg-pdfa.ts`), and a cost of nothing would let a header logo be drawn
  // on every page unbounded.
  test('as its viewBox, its drawing as approved, what it costs and how far it reaches', async () => {
    const approved = svgAsset(svg('<rect x="10" y="20" width="200" height="100" fill="#1f4e79"/>', '10 20 200 100'))
    expect(await checkImageAsset(approved)).toEqual({
      kind: 'vector',
      x: 10,
      y: 20,
      width: 200,
      height: 100,
      svg: new TextDecoder().decode(approved.bytes),
      segments: 5,
      groups: 0,
      units: 5 + 12 * 2 + Math.ceil(approved.bytes.length / 32),
      extent: { groups: { inverse: 0, origin: 0 }, patterns: { linear: 0, offset: 0 }, local: 0, own: 210, nesting: 3 },
    })
  })
})

describe('checkImageAsset reads the size', () => {
  // The renderer fits an image by the size read here. Width and height read
  // the wrong way round -- a JPEG's frame header gives the height first --
  // would draw every wide image squeezed into a tall box.
  test.each([
    ['a PNG', () => asset(encodePng(16, 8, () => [0, 0, 0])), { width: 16, height: 8 }],
    ['a JPEG', () => asset(jpegOf({ width: 16, height: 8 }), 'image/jpeg'), { width: 16, height: 8 }],
  ])('of %s, 16 wide and 8 tall', async (_, made, size) => {
    expect(await checkImageAsset(made())).toMatchObject(size)
  })

  // The image data a render holds is bounded (`MAX_IMAGE_DATA`): a PNG holds
  // its scanlines once inflated, which PDFKit decodes, here 8 rows of a
  // filter byte and 16 RGB pixels; a JPEG is embedded as it is.
  test('and the image data it holds', async () => {
    expect(await checkImageAsset(asset(encodePng(16, 8, () => [0, 0, 0])))).toMatchObject({ kind: 'raster', data: 8 * (1 + 16 * 3) })
    const jpeg = jpegOf({ width: 16, height: 8 })
    expect(await checkImageAsset(asset(jpeg, 'image/jpeg'))).toMatchObject({ kind: 'raster', data: jpeg.length })
  })

  // PDFKit turns a JPEG by its Exif orientation: 5 to 8 a quarter turn, so
  // it is shown as wide as its frame is tall. 2 to 4 flip it or turn it
  // half round, which keeps its size, 4 the last that does. Only the first
  // Exif block counts, for PDFKit and here; an orientation out of range is
  // none.
  test.each([
    [1, { width: 16, height: 8 }],
    [2, { width: 16, height: 8 }],
    [3, { width: 16, height: 8 }],
    [4, { width: 16, height: 8 }],
    [5, { width: 8, height: 16 }],
    [6, { width: 8, height: 16 }],
    [7, { width: 8, height: 16 }],
    [8, { width: 8, height: 16 }],
    [9, { width: 16, height: 8 }],
  ])('of a JPEG of Exif orientation %i', async (orientation, size) => {
    expect(await checkImageAsset(asset(jpegOf({ width: 16, height: 8, exif: exifSegment(orientation) }), 'image/jpeg'))).toMatchObject(size)
  })

  test('of a JPEG whose second Exif block would turn it, and whose first does not', async () => {
    const twice = [...exifSegment(1), ...exifSegment(6)]
    expect(await checkImageAsset(asset(jpegOf({ width: 16, height: 8, exif: twice }), 'image/jpeg'))).toMatchObject({ width: 16, height: 8 })
  })

  // A malformed Exif block is no orientation, as it is to PDFKit, not a refusal.
  test.each([
    ['cut short', [0xff, 0xe1, 0, 8, 0x45, 0x78, 0x69, 0x66, 0, 0]],
    ['in an unknown byte order', [0xff, 0xe1, 0, 16, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x58, 0x58, 0, 42, 0, 0, 0, 8]],
    ['without the TIFF mark', [0xff, 0xe1, 0, 16, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 41, 0, 0, 0, 8]],
    ['pointing past its end', [0xff, 0xe1, 0, 16, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 80]],
    ['with an entry cut short', [0xff, 0xe1, 0, 18, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1]],
    [
      'without an orientation',
      [0xff, 0xe1, 0, 30, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x10, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0],
    ],
    ['that is not Exif', [0xff, 0xe1, 0, 8, 0x58, 0x4d, 0x50, 0, 0, 0]],
  ])('of a JPEG whose Exif block is %s', async (_, exif) => {
    expect(await checkImageAsset(asset(jpegOf({ width: 16, height: 8, exif }), 'image/jpeg'))).toMatchObject({ width: 16, height: 8 })
  })
})

describe('a CMYK JPEG', () => {
  // PDFKit draws a JPEG of four components in DeviceCMYK (pdfkit.js
  // 3808-3812). That is any report's right, and no e-invoice's: a PDF/A
  // draws DeviceCMYK only beside a CMYK output intent (veraPDF 6.2.4.3-3,
  // failed by such a JPEG on veraPDF 1.30.3, 2026-10-17), and every output
  // intent must share one profile (6.2.3-2), the sRGB one an e-invoice
  // carries. So the check reads the component count from the frame header,
  // and a render that is an e-invoice refuses the image, naming it.
  test.each([
    ['a grey JPEG', () => jpegOf(), false],
    ['a three-component JPEG', () => jpegOf({ components: 3 }), false],
    ['a four-component JPEG', () => jpegOf({ components: 4 }), true],
  ])('is read from the frame header: %s', async (_, made, cmyk) => {
    expect(await checkImageAsset(asset(made(), 'image/jpeg'))).toMatchObject({ cmyk })
  })

  test('is never a PNG, whatever its colour type', async () => {
    expect(await checkImageAsset(asset(encodePng(8, 8, () => [0, 0, 0])))).toMatchObject({ cmyk: false })
  })

  const cmyk = (id: string): ImageAsset => asset(jpegOf({ components: 4 }), 'image/jpeg', id)
  const image = (of: ImageAsset): Image => ({ kind: 'image', asset: of, width: 40, height: 40, fit: 'contain' })

  // Wherever it stands -- the body, a page region -- and wherever it came
  // from, an approved asset or a field's image, the resolved document
  // holds it as an image block like any other, and it is refused before
  // pdfmake sees it: no PDF that says it is a PDF/A and is not one.
  test.each([
    ['in the body', (of: ImageAsset): ResolvedDocument => bareDocument('Rechnung', [image(of)])],
    ['in the page header', (of: ImageAsset): ResolvedDocument => ({ ...bareDocument('Rechnung', [paragraph('Rechnung')]), pageHeader: [image(of)] })],
  ])('%s of an e-invoice is refused as unsupported, naming the image', async (_, place) => {
    const createPdf = vi.spyOn(pdfmake, 'createPdf')
    try {
      await expect(renderPdf(invoiced(place(cmyk('logo-cmyk'))), { maxPages: 1 })).rejects.toMatchObject({
        code: 'unsupported',
        subject: 'logo-cmyk',
        message:
          'the image logo-cmyk is a CMYK JPEG, which an e-invoice cannot hold: it is drawn as a PDF/A-3 whose output intent is sRGB, beside which no image may be CMYK',
      })
      expect(createPdf).not.toHaveBeenCalled()
    } finally {
      createPdf.mockRestore()
    }
  })

  // The refusal is the e-invoice's: the same image in a report that is
  // not one is drawn as it always was, in DeviceCMYK.
  test('is drawn in a report that is no e-invoice', async () => {
    const pdf = await readPdf(await renderPdf(bareDocument('Image', [image(cmyk('logo-cmyk'))]), { maxPages: 1 }))
    expect(pdf.pages.flatMap((page) => page.images)).toHaveLength(1)
  })

  // The refusal is the PDF/A's, not the e-invoice's: an XRechnung's PDF is
  // a plain copy (0038), which holds DeviceCMYK as any report does. A check
  // that refused the image in every e-invoice would refuse a print shop's
  // logo on a copy that could carry it.
  test('is drawn in the copy of an XRechnung, which is no PDF/A', async () => {
    const pdf = await readPdf(await renderPdf(copied(bareDocument('Rechnung', [image(cmyk('logo-cmyk'))])), { maxPages: 1 }))
    expect(pdf.pages.flatMap((page) => page.images)).toHaveLength(1)
    expect(pdf.pages[0]?.items[0]?.text).toBe(XRECHNUNG_COPY_LABEL)
  })

  // A check that refused every JPEG in an e-invoice, or more than CMYK,
  // would pass the case above: the corpus's image of every other kind
  // PDFKit embeds -- grey and colour JPEGs, and PNGs of every colour type,
  // with alpha, a palette, a colour key, 1 and 16 bits, interlaced -- is
  // drawn in one, which the e-invoice gate has veraPDF judge (0031).
  test(
    'leaves an image of every kind but a CMYK JPEG drawn in an e-invoice',
    async () => {
      const pdf = await readPdf(await renderPdf(invoiced(bareDocument('Rechnung', IMAGE_KINDS.map(image))), { maxPages: 2 }))
      expect(pdf.pages.flatMap((page) => page.images)).toHaveLength(IMAGE_KINDS.length)
    },
    TIMEOUT,
  )
})
