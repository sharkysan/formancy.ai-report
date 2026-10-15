import { crc32, deflateSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { RenderRefusal, type ImageAsset } from '../document.js'
import { documentOf } from '../fixtures/build.js'
import { encodePng } from '../fixtures/png.js'
import { readPdf } from '../read-pdf.js'
import { pdfmakeAdapter } from './pdfmake.js'
import { checkImageAsset, MAX_ASSET_BYTES } from './pdfmake-assets.js'

/**
 * The image checks the pdfmake adapter makes before pdfmake sees an asset.
 * Every image here is built in code from its parts, so a reviewer can read
 * what each one is: PNGs from their chunks, each with a correct CRC unless
 * the CRC is the point, and one JPEG from its segments.
 */

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const NONE = new Uint8Array(0)

/** A PNG of these chunks, each framed with its length and a correct CRC. */
function pngOf(chunks: readonly (readonly [string, Uint8Array])[]): Uint8Array {
  const framed = chunks.flatMap(([type, data]) => {
    const typed = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(typed))
    return [length, typed, crc]
  })
  return new Uint8Array(Buffer.concat([SIGNATURE, ...framed]))
}

function ihdr(width: number, height: number, { colour = 2, depth = 8, interlace = 0 } = {}): Uint8Array {
  const data = Buffer.alloc(13)
  data.writeUInt32BE(width, 0)
  data.writeUInt32BE(height, 4)
  data.set([depth, colour, 0, 0, interlace], 8)
  return data
}

/** Scanlines of `bytesPerRow` bytes each, after a filter-type byte of `filter`, deflated. */
function idat(rows: number, bytesPerRow: number, filter = 0): Uint8Array {
  const row = Buffer.concat([Buffer.from([filter]), Buffer.alloc(bytesPerRow, 0x80)])
  return new Uint8Array(deflateSync(Buffer.concat(Array.from({ length: rows }, () => row))))
}

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

/**
 * The smallest baseline JPEG a decoder accepts: an 8 × 8 grey image of one
 * block whose every coefficient is zero, so mid-grey. A quantisation table
 * of ones; a DC and an AC Huffman table of one code each, of one bit, for
 * "difference 0" and "end of block"; and a scan of those two bits, padded
 * with ones.
 */
function jpegOf({ height = 8, width = 8, scan = true, end = true } = {}): Uint8Array {
  const segment = (marker: number, body: readonly number[]): number[] => [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body]
  const oneCodeTable = (classAndId: number): number[] => [classAndId, 1, ...Array<number>(15).fill(0), 0]
  return new Uint8Array([
    0xff, 0xd8, // start of image
    ...segment(0xdb, [0, ...Array<number>(64).fill(1)]), // quantisation table 0
    ...segment(0xc0, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]), // baseline frame, one component
    ...segment(0xc4, oneCodeTable(0x00)), // DC table 0
    ...segment(0xc4, oneCodeTable(0x10)), // AC table 0
    ...(scan ? [...segment(0xda, [1, 1, 0x00, 0, 63, 0]), 0b0011_1111] : []), // the scan: "0" then "0", padded
    ...(end ? [0xff, 0xd9] : []), // end of image
  ])
}

function asset(bytes: Uint8Array, mediaType: ImageAsset['mediaType'] = 'image/png'): ImageAsset {
  return { id: 'asset-under-test', mediaType, bytes }
}

function refusal(of: ImageAsset): RenderRefusal | undefined {
  try {
    checkImageAsset(of)
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
    ['a chunk whose CRC is wrong', () => asset(Uint8Array.from(encodePng(8, 8, () => [1, 2, 3]), (byte, index) => (index === 29 ? byte ^ 0xff : byte))), /has the wrong CRC on its IHDR chunk$/],
    ['image data before the header', () => asset(pngOf([['IDAT', idat(8, 24)], ['IHDR', ihdr(8, 8)], ['IEND', NONE]])), /does not start with its header chunk$/],
    ['a header of the wrong length', () => asset(pngOf([['IHDR', ihdr(8, 8).subarray(0, 12)], ['IDAT', idat(8, 24)], ['IEND', NONE]])), /has a header chunk of the wrong length$/],
    ['a colour type with a bit depth it does not allow', () => asset(pngOf([['IHDR', ihdr(8, 8, { depth: 4 })], ['IDAT', idat(8, 12)], ['IEND', NONE]])), /has an invalid colour type and bit depth \(2, 4\)$/],
    ['an interlace method PNG does not define', () => asset(pngOf([['IHDR', ihdr(8, 8, { interlace: 2 })], ['IDAT', idat(8, 24)], ['IEND', NONE]])), /has an unknown compression, filter or interlace method$/],
    ['no image data', () => asset(pngOf([['IHDR', ihdr(8, 8)], ['IEND', NONE]])), /has no image data$/],
    ['bytes after the end chunk', () => asset(new Uint8Array([...rgb8(idat(8, 24)), 0])), /has bytes after its end chunk$/],
    ['a paletted image without its palette', () => asset(pngOf([['IHDR', ihdr(8, 8, { colour: 3 })], ['IDAT', idat(8, 8)], ['IEND', NONE]])), /is paletted and has no palette$/],
    ['image data that is not deflated', () => asset(rgb8(new Uint8Array(32).fill(7))), /has image data that does not inflate$/],
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
  ])('%s', (_, made, reason) => {
    const refused = refusal(made())
    expect(refused?.code).toBe('invalid-asset')
    expect(refused?.subject).toBe('asset-under-test')
    expect(refused?.message).toMatch(new RegExp(`^the image asset asset-under-test ${reason.source}`))
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
    ['an interlaced PNG', () => asset(interlacedPng())],
    ['a paletted PNG', () => asset(palettedPng())],
    ['a baseline JPEG', () => asset(jpegOf(), 'image/jpeg')],
  ])('%s, and pdfmake draws it', async (_, made) => {
    const image = made()
    expect(refusal(image)).toBeUndefined()
    const pdf = await readPdf(await pdfmakeAdapter.render(documentOf('Image', [{ kind: 'image', asset: image, width: 40, height: 40, fit: 'contain' }]), { maxPages: 1 }))
    expect(pdf.pages.flatMap((page) => page.images)).toHaveLength(1)
  })
})

describe('checkImageAsset reads the size', () => {
  // The adapter draws an image only at its own proportions, which it judges
  // from the size read here. Width and height read the wrong way round -- a
  // JPEG's frame header gives the height first -- would refuse every wide
  // image in a wide box and draw every wide image stretched into a tall one.
  test.each([
    ['a PNG', () => asset(encodePng(16, 8, () => [0, 0, 0]))],
    ['a JPEG', () => asset(jpegOf({ width: 16, height: 8 }), 'image/jpeg')],
  ])('of %s, 16 wide and 8 tall', (_, made) => {
    expect(checkImageAsset(made())).toEqual({ width: 16, height: 8 })
  })
})
