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

/** Adam7's seven passes: the first column and row of each, and the steps between them. */
const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const

export interface PngKind {
  /** PNG's colour type: 2 RGB, 3 paletted, 6 RGB and alpha. */
  readonly colour?: 2 | 3 | 6
  readonly interlace?: boolean
  /** Chunks between the header and the image data: a palette, a transparency. */
  readonly chunks?: readonly (readonly [type: string, data: Uint8Array])[]
}

/**
 * A PNG of 8 bits a sample, each pixel the samples `pixel` gives it --
 * three for the truecolour of the default kind, four with an alpha, one
 * index for a palette -- every scanline unfiltered, and in Adam7's passes
 * where it is interlaced: the corpus's `png` (`image-kinds.ts`), at 8 bits
 * and at any size, but an interlaced one at least 5 pixels a side, where
 * each of the seven passes holds pixels, as an empty one has no scanlines.
 */
export function encodePng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => readonly number[],
  { colour = 2, interlace = false, chunks = [] }: PngKind = {},
): Uint8Array {
  const scanlines: number[] = []
  for (const [left, top, across, down] of interlace ? ADAM7 : [[0, 0, 1, 1] as const]) {
    for (let y = top; y < height; y += down) {
      const row: number[] = []
      for (let x = left; x < width; x += across) row.push(...pixel(x, y))
      scanlines.push(0, ...row)
    }
  }
  return pngOf([
    ['IHDR', ihdr(width, height, { colour, interlace: interlace ? 1 : 0 })],
    ...chunks,
    ['IDAT', new Uint8Array(deflateSync(Uint8Array.from(scanlines)))],
    ['IEND', NONE],
  ])
}

const segment = (marker: number, body: readonly number[]): number[] => [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body]

/**
 * A frame header as `jpegOf` writes its own: 8 bits a sample, the height,
 * the width, and each component's id, sampling factors and table. `marker`
 * makes it another segment of the same bytes, as a JPG (0xC8) or a DAC
 * (0xCC) segment shaped as a frame header is.
 */
export function frameSegment({ marker = 0xc0, height = 8, width = 8, components = 1 } = {}): number[] {
  const ids = Array.from({ length: components }, (_, index) => index + 1)
  return segment(marker, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, components, ...ids.flatMap((id) => [id, 0x11, 0])])
}

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
 *
 * `components` makes it 3 (as YCbCr is) or 4 (as CMYK is): each component
 * one block of the same tables, two bits each in the scan, so four fill
 * its byte exactly. PDFKit draws a JPEG by its component count: 1 as
 * DeviceGray, 3 as DeviceRGB, 4 as DeviceCMYK (pdfkit.js 3808-3812).
 * `segments` puts segments of a test's own after the Exif segment and
 * before the tables, `frameSegment`'s among them, and `afterFrame` after
 * the frame header.
 */
export function jpegOf({
  height = 8,
  width = 8,
  scan = true,
  end = true,
  exif = [] as readonly number[],
  components = 1,
  segments = [] as readonly number[],
  afterFrame = [] as readonly number[],
} = {}): Uint8Array {
  const oneCodeTable = (classAndId: number): number[] => [classAndId, 1, ...Array<number>(15).fill(0), 0]
  const ids = Array.from({ length: components }, (_, index) => index + 1)
  const bits = 2 * components
  return new Uint8Array([
    0xff,
    0xd8, // start of image
    ...exif,
    ...segments,
    ...segment(0xdb, [0, ...Array<number>(64).fill(1)]), // quantisation table 0
    ...frameSegment({ height, width, components }), // baseline frame
    ...afterFrame,
    ...segment(0xc4, oneCodeTable(0x00)), // DC table 0
    ...segment(0xc4, oneCodeTable(0x10)), // AC table 0
    // The scan: "0" then "0" for each component, padded with ones to whole bytes.
    ...(scan
      ? [
          ...segment(0xda, [components, ...ids.flatMap((id) => [id, 0x00]), 0, 63, 0]),
          ...Array.from({ length: Math.ceil(bits / 8) }, (_, byte) => (0xff >> Math.min(8, bits - 8 * byte)) & 0xff),
        ]
      : []),
    ...(end ? [0xff, 0xd9] : []), // end of image
  ])
}

export function asset(bytes: Uint8Array, mediaType: ImageAsset['mediaType'] = 'image/png', id = 'asset-under-test'): ImageAsset {
  return { id, mediaType, bytes }
}
