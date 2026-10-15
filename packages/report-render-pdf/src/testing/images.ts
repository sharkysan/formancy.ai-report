import { crc32, deflateSync } from 'node:zlib'
import type { ImageAsset } from '@formancy/report-runtime'

/**
 * Images made in code from their parts, so that no test carries a binary
 * file whose contents a reviewer cannot read: copies of the corpus's
 * `encodePng` and of its asset tests' builders, which its index does not
 * export, and an Exif block for a JPEG that is turned.
 */

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
export const NONE = new Uint8Array(0)

/** A PNG of these chunks, each framed with its length and a correct CRC. */
export function pngOf(chunks: readonly (readonly [string, Uint8Array])[]): Uint8Array {
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

export function ihdr(width: number, height: number, { colour = 2, depth = 8, interlace = 0 } = {}): Uint8Array {
  const data = Buffer.alloc(13)
  data.writeUInt32BE(width, 0)
  data.writeUInt32BE(height, 4)
  data.set([depth, colour, 0, 0, interlace], 8)
  return data
}

/** Scanlines of `bytesPerRow` bytes each, after a filter-type byte of `filter`, deflated. */
export function idat(rows: number, bytesPerRow: number, filter = 0): Uint8Array {
  const row = Buffer.concat([Buffer.from([filter]), Buffer.alloc(bytesPerRow, 0x80)])
  return new Uint8Array(deflateSync(Buffer.concat(Array.from({ length: rows }, () => row))))
}

/** A truecolour PNG, 8 bits per channel, every scanline unfiltered, each pixel the colour `pixel` gives it. */
export function encodePng(width: number, height: number, pixel: (x: number, y: number) => readonly [number, number, number]): Uint8Array {
  const stride = 1 + width * 3
  const scanlines = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) scanlines.set(pixel(x, y), y * stride + 1 + x * 3)
  }
  return pngOf([
    ['IHDR', ihdr(width, height)],
    ['IDAT', new Uint8Array(deflateSync(scanlines))],
    ['IEND', NONE],
  ])
}

const segment = (marker: number, body: readonly number[]): number[] => [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body]

/**
 * An APP1 segment of Exif data whose first image file directory has one
 * entry, the Orientation tag (0x0112) set to `orientation`, in big-endian
 * ("MM") byte order.
 */
export function exifSegment(orientation: number): number[] {
  const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0]
  return segment(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff])
}

/**
 * The smallest baseline JPEG a decoder accepts: an 8 × 8 grey image of one
 * block whose every coefficient is zero, so mid-grey. A quantisation table
 * of ones; a DC and an AC Huffman table of one code each, of one bit, for
 * "difference 0" and "end of block"; and a scan of those two bits, padded
 * with ones. A frame other than 8 × 8 keeps the one block, which a decoder
 * repeats; `exif` puts an Exif segment after the start.
 */
export function jpegOf({ height = 8, width = 8, scan = true, end = true, exif = [] as readonly number[] } = {}): Uint8Array {
  const oneCodeTable = (classAndId: number): number[] => [classAndId, 1, ...Array<number>(15).fill(0), 0]
  return new Uint8Array([
    0xff, 0xd8, // start of image
    ...exif,
    ...segment(0xdb, [0, ...Array<number>(64).fill(1)]), // quantisation table 0
    ...segment(0xc0, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]), // baseline frame, one component
    ...segment(0xc4, oneCodeTable(0x00)), // DC table 0
    ...segment(0xc4, oneCodeTable(0x10)), // AC table 0
    ...(scan ? [...segment(0xda, [1, 1, 0x00, 0, 63, 0]), 0b0011_1111] : []), // the scan: "0" then "0", padded
    ...(end ? [0xff, 0xd9] : []), // end of image
  ])
}

export function asset(bytes: Uint8Array, mediaType: ImageAsset['mediaType'] = 'image/png', id = 'asset-under-test'): ImageAsset {
  return { id, mediaType, bytes }
}
