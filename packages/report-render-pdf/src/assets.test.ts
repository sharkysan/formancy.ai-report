import { deflateSync } from 'node:zlib'
import { readPdf } from '@formancy/report-corpus'
import { MAX_ASSET_BYTES, RenderRefusal, type ImageAsset } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { checkImageAsset } from './assets.js'
import { renderPdf } from './node.js'
import { bareDocument, TIMEOUT } from './testing/documents.js'
import { asset, encodePng, exifSegment, idat, ihdr, jpegOf, NONE, pngOf } from './testing/images.js'

/**
 * The image checks the renderer makes before pdfmake sees an asset. Every
 * image here is built in code from its parts, so a reviewer can read what
 * each one is: PNGs from their chunks, each with a correct CRC unless the
 * CRC is the point, and JPEGs from their segments.
 */

/** An 8 × 8 RGB image's chunks around `data`: 8 rows of 24 bytes when the data is right. */
const rgb8 = (data: Uint8Array): Uint8Array => pngOf([['IHDR', ihdr(8, 8)], ['IDAT', data], ['IEND', NONE]])

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
  return pngOf([['IHDR', ihdr(8, 8, { interlace: 1 })], ['IDAT', new Uint8Array(deflateSync(Buffer.concat(scanlines)))], ['IEND', NONE]])
}

/** A paletted 8 × 8 PNG: a palette of two colours, one byte an index per pixel. */
function palettedPng(): Uint8Array {
  return pngOf([['IHDR', ihdr(8, 8, { colour: 3 })], ['PLTE', new Uint8Array([0, 0, 0, 255, 255, 255])], ['IDAT', idat(8, 8)], ['IEND', NONE]])
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
    ['a PNG declared as a JPEG', () => asset(encodePng(8, 8, () => [1, 2, 3]), 'image/jpeg'), /is declared a JPEG and is not one: it is a PNG$/],
    ['a JPEG declared as a PNG', () => asset(jpegOf()), /is declared a PNG and is not one: it is a JPEG$/],
    ['bytes that are neither, declared a PNG', () => asset(new TextEncoder().encode('Not an image at all.')), /is declared a PNG and is not one$/],
    ['bytes that are neither, declared a JPEG', () => asset(new TextEncoder().encode('Not an image at all.'), 'image/jpeg'), /is declared a JPEG and is not one$/],
    ['a media type the renderer does not draw', () => asset(encodePng(8, 8, () => [1, 2, 3]), 'image/gif' as 'image/png'), /is of a media type the renderer does not draw \(image\/gif\)$/],
    ['no bytes at all', () => ({ ...asset(NONE), bytes: undefined as unknown as Uint8Array }), /has no bytes$/],
    ['a chunk whose CRC is wrong', () => asset(Uint8Array.from(encodePng(8, 8, () => [1, 2, 3]), (byte, index) => (index === 29 ? byte ^ 0xff : byte))), /has the wrong CRC on its IHDR chunk$/],
    ['image data before the header', () => asset(pngOf([['IDAT', idat(8, 24)], ['IHDR', ihdr(8, 8)], ['IEND', NONE]])), /does not start with its header chunk$/],
    ['a header of the wrong length', () => asset(pngOf([['IHDR', ihdr(8, 8).subarray(0, 12)], ['IDAT', idat(8, 24)], ['IEND', NONE]])), /has a header chunk of the wrong length$/],
    ['a colour type with a bit depth it does not allow', () => asset(pngOf([['IHDR', ihdr(8, 8, { depth: 4 })], ['IDAT', idat(8, 12)], ['IEND', NONE]])), /has an invalid colour type and bit depth \(2, 4\)$/],
    ['an interlace method PNG does not define', () => asset(pngOf([['IHDR', ihdr(8, 8, { interlace: 2 })], ['IDAT', idat(8, 24)], ['IEND', NONE]])), /has an unknown compression, filter or interlace method$/],
    ['no image data', () => asset(pngOf([['IHDR', ihdr(8, 8)], ['IEND', NONE]])), /has no image data$/],
    ['bytes after the end chunk', () => asset(new Uint8Array([...rgb8(idat(8, 24)), 0])), /has bytes after its end chunk$/],
    ['a paletted image without its palette', () => asset(pngOf([['IHDR', ihdr(8, 8, { colour: 3 })], ['IDAT', idat(8, 8)], ['IEND', NONE]])), /is paletted and has no palette$/],
    ['image data that is not deflated', () => asset(rgb8(new Uint8Array(32).fill(7))), /has image data that does not inflate$/],
    ['image data with bytes after its stream', () => asset(rgb8(new Uint8Array([...idat(8, 24), 1, 2, 3]))), /has image data that does not inflate$/],
    ['image data short of its scanlines', () => asset(rgb8(new Uint8Array(deflateSync(Buffer.alloc(10))))), /has image data of 10 bytes where its header promises 200$/],
    ['image data past its scanlines', () => asset(rgb8(idat(9, 24))), /has more image data than the 200 bytes its header promises$/],
    ['an interlaced image with the data of one that is not', () => asset(pngOf([['IHDR', ihdr(8, 8, { interlace: 1 })], ['IDAT', idat(8, 24)], ['IEND', NONE]])), /has image data of 200 bytes where its header promises 207$/],
    ['a scanline filter PNG does not define', () => asset(rgb8(idat(8, 24, 7))), /has a scanline with an unknown filter type \(7\)$/],
    ['a PNG of no pixels', () => asset(pngOf([['IHDR', ihdr(0, 8)], ['IDAT', idat(8, 1)], ['IEND', NONE]])), /has no pixels \(0 × 8\)$/],
    ['a PNG wider than 4096 pixels', () => asset(encodePng(4097, 1, () => [0, 0, 0])), /is 4097 × 1 pixels; the limit is 4096 pixels a side$/],
    ['an asset of more than 20 MB', () => asset(pngOf([['IHDR', ihdr(8, 8)], ['tEXt', new Uint8Array(MAX_ASSET_BYTES)], ['IEND', NONE]])), /is \d+ bytes; the limit is 20971520 \(20 MB\)$/],
    ['a JPEG taller than 4096 pixels', () => asset(jpegOf({ height: 5000, width: 10 }), 'image/jpeg'), /is 10 × 5000 pixels; the limit is 4096 pixels a side$/],
    ['a JPEG with a stray byte between segments', () => asset(new Uint8Array([0xff, 0xd8, 0x00, ...jpegOf().subarray(2)]), 'image/jpeg'), /has a malformed segment at byte 2$/],
    ['a JPEG segment longer than the file', () => asset(jpegOf().subarray(0, 30), 'image/jpeg'), /has a segment that runs past its end at byte 2$/],
    ['a JPEG frame header too short to hold a size', () => asset(new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x05, 8, 0, 8, 0xff, 0xd9]), 'image/jpeg'), /has a frame header of the wrong length$/],
    ['a JPEG scan before its frame header', () => asset(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0, 0x3f, 0xff, 0xd9]), 'image/jpeg'), /has image data before its frame header$/],
    ['a JPEG cut off in its scan', () => asset(jpegOf({ end: false }), 'image/jpeg'), /is cut off: it does not end with an end-of-image marker$/],
    ['a JPEG of tables and no scan', () => asset(jpegOf({ scan: false }), 'image/jpeg'), /is cut off before its image data$/],
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
    await expect(renderPdf(bareDocument('Broken', [{ kind: 'image', asset: broken, width: 40, height: 40, fit: 'contain' }]), { maxPages: 1 })).rejects.toMatchObject({ code: 'invalid-asset', subject: 'logo-broken' })
  })
})

describe('checkImageAsset accepts', () => {
  // A check that refused every image would pass every test above. These are
  // the kinds of image it reads past the header -- interlaced, paletted, and
  // a JPEG's segments -- each drawn by pdfmake and found in the PDF, so that
  // the arithmetic the checks rely on is the arithmetic a decoder uses.
  test.each([
    ['an RGB PNG', () => asset(encodePng(8, 8, (x, y) => [x * 30, y * 30, 90]))],
    ['a PNG with a chunk the check does not read', () => asset(pngOf([['IHDR', ihdr(8, 8)], ['tEXt', new TextEncoder().encode('Comment\0made in code')], ['IDAT', idat(8, 24)], ['IEND', NONE]]))],
    ['a PNG whose image data is split over chunks', () => asset(pngOf([['IHDR', ihdr(8, 8)], ['IDAT', idat(8, 24).subarray(0, 10)], ['IDAT', idat(8, 24).subarray(10)], ['IEND', NONE]]))],
    ['an interlaced PNG', () => asset(interlacedPng())],
    ['a paletted PNG', () => asset(palettedPng())],
    ['a baseline JPEG', () => asset(jpegOf(), 'image/jpeg')],
    ['a JPEG with an Exif block', () => asset(jpegOf({ exif: exifSegment(1) }), 'image/jpeg')],
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
  test('a PNG of 4096 × 4096 pixels, the largest it allows', async () => {
    expect(await checkImageAsset(asset(pngOf([['IHDR', ihdr(4096, 4096)], ['IDAT', idat(4096, 4096 * 3)], ['IEND', NONE]])))).toMatchObject({ width: 4096, height: 4096 })
  }, TIMEOUT)
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
    expect((await checkImageAsset(asset(encodePng(16, 8, () => [0, 0, 0])))).data).toBe(8 * (1 + 16 * 3))
    const jpeg = jpegOf({ width: 16, height: 8 })
    expect((await checkImageAsset(asset(jpeg, 'image/jpeg'))).data).toBe(jpeg.length)
  })

  // PDFKit turns a JPEG by its Exif orientation: 5 to 8 a quarter turn, so
  // it is shown as wide as its frame is tall. 2 to 4 flip it or turn it
  // half round, which keeps its size. Only the first Exif block counts, for
  // PDFKit and here; an orientation out of range is none.
  test.each([
    [1, { width: 16, height: 8 }],
    [3, { width: 16, height: 8 }],
    [5, { width: 8, height: 16 }],
    [6, { width: 8, height: 16 }],
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
    ['without an orientation', [0xff, 0xe1, 0, 30, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x10, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0]],
    ['that is not Exif', [0xff, 0xe1, 0, 8, 0x58, 0x4d, 0x50, 0, 0, 0]],
  ])('of a JPEG whose Exif block is %s', async (_, exif) => {
    expect(await checkImageAsset(asset(jpegOf({ width: 16, height: 8, exif }), 'image/jpeg'))).toMatchObject({ width: 16, height: 8 })
  })
})
