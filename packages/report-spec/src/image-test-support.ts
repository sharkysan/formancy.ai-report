/**
 * Test support for the image header reader (0033): PNGs and JPEGs made in
 * code from their parts, so that no test carries a binary file a reviewer
 * cannot read. They are copies of report-render-pdf's `testing/images.ts`,
 * written without Node: report-spec's library has no `Buffer` and no
 * `node:zlib`. Nothing here inflates, so a PNG's image data is any bytes;
 * the renderer, which inflates it, holds the scanlines.
 *
 * A chunk's CRC is computed here bit by bit, as the PNG specification's
 * annex D defines it, and not with the reader's table: a fixture framed by
 * the code under test would agree with it whatever it computed.
 */

/** CRC-32 one bit at a time: the reflected polynomial 0xedb88320, every bit inverted before and after. */
export function crcOf(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const
export const NONE = new Uint8Array(0)

const u32 = (value: number): number[] => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]

/** A PNG of these chunks, each framed with its length and a correct CRC. */
export function pngOf(chunks: readonly (readonly [string, Uint8Array])[]): Uint8Array {
  const framed = chunks.flatMap(([type, data]) => {
    const typed = Uint8Array.from([...[...type].map((character) => character.charCodeAt(0)), ...data])
    return [...u32(data.length), ...typed, ...u32(crcOf(typed))]
  })
  return Uint8Array.from([...SIGNATURE, ...framed])
}

/** A header chunk's 13 bytes: the size, then the bit depth, the colour type, and the compression, filter and interlace methods. */
export function ihdr(width: number, height: number, { colour = 2, depth = 8, interlace = 0 } = {}): Uint8Array {
  return Uint8Array.from([...u32(width), ...u32(height), depth, colour, 0, 0, interlace])
}

/** Image data the reader carries and never inflates. */
export const DATA = Uint8Array.from([0x78, 0x9c, 1, 2, 3, 4])

/** An 8 × 8 truecolour PNG of `DATA`. */
export function rgbPng(): Uint8Array {
  return pngOf([
    ['IHDR', ihdr(8, 8)],
    ['IDAT', DATA],
    ['IEND', NONE],
  ])
}

const segment = (marker: number, body: readonly number[]): number[] => [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body]

/** A frame header: 8 bits a sample, the height, the width, and each component's id, sampling factors and table; `marker` makes it a JPG (0xC8) or DAC (0xCC) segment of the same bytes. */
export function frameSegment({ marker = 0xc0, height = 8, width = 8, components = 1 } = {}): number[] {
  const ids = Array.from({ length: components }, (_, index) => index + 1)
  return segment(marker, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, components, ...ids.flatMap((id) => [id, 0x11, 0])])
}

/** An APP1 segment of Exif data whose first image file directory holds one entry, the Orientation tag (0x0112), big-endian. */
export function exifSegment(orientation: number): number[] {
  const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0]
  return segment(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff])
}

/**
 * A baseline JPEG of one block a component, as the renderer's tests make
 * it: a quantisation table, the frame header, a DC and an AC Huffman table
 * of one code each, and a scan of those codes. `exif` and `segments` stand
 * after the start, `afterFrame` after the frame header.
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
  return Uint8Array.from([
    0xff,
    0xd8, // start of image
    ...exif,
    ...segments,
    ...segment(0xdb, [0, ...Array<number>(64).fill(1)]), // quantisation table 0
    ...frameSegment({ height, width, components }),
    ...afterFrame,
    ...segment(0xc4, oneCodeTable(0x00)), // DC table 0
    ...segment(0xc4, oneCodeTable(0x10)), // AC table 0
    ...(scan
      ? [
          ...segment(0xda, [components, ...ids.flatMap((id) => [id, 0x00]), 0, 63, 0]),
          ...Array.from({ length: Math.ceil(bits / 8) }, (_, byte) => (0xff >> Math.min(8, bits - 8 * byte)) & 0xff),
        ]
      : []),
    ...(end ? [0xff, 0xd9] : []), // end of image
  ])
}
