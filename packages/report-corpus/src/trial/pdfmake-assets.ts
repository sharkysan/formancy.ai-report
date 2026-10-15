import { crc32, inflateSync } from 'node:zlib'
import { RenderRefusal, type ImageAsset } from '../document.js'

/**
 * Image assets checked before pdfmake sees them. pdfmake, through PDFKit,
 * copies a PNG's compressed data and a JPEG's scan into the PDF without
 * decoding either, so bytes that only look like an image arrive in the PDF
 * as a broken one, and bytes that do not look like one at all fail with an
 * error that names no asset. Both are refused here instead, naming it.
 *
 * What is checked: the size limits; for a PNG, every chunk's length and CRC,
 * the header, and that the image data inflates to exactly the scanlines the
 * header promises, each with a known filter; for a JPEG, the segment
 * structure up to the scan, the frame header's size, and the end marker. A
 * JPEG's entropy-coded scan is not decoded: a corrupt scan inside an
 * otherwise well-formed JPEG still reaches the PDF.
 */

/** 20 MB: the trial's limit on one asset, the plan's "enforced limits" made a number to test. */
export const MAX_ASSET_BYTES = 20 * 1024 * 1024
/** Pixels a side. */
export const MAX_ASSET_SIDE = 4096

export function checkImageAsset(asset: ImageAsset): void {
  const problem = assetProblem(asset)
  if (problem !== undefined) throw new RenderRefusal('invalid-asset', `the image asset ${asset.id} ${problem}`, asset.id)
}

function assetProblem(asset: ImageAsset): string | undefined {
  const { bytes } = asset
  if (bytes.length > MAX_ASSET_BYTES) return `is ${bytes.length} bytes; the limit is ${MAX_ASSET_BYTES} (20 MB)`
  const isPng = startsWith(bytes, PNG_SIGNATURE)
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
  if (asset.mediaType === 'image/png') return isPng ? pngProblem(bytes) : `is declared a PNG and is not one${isJpeg ? ': it is a JPEG' : ''}`
  return isJpeg ? jpegProblem(bytes) : `is declared a JPEG and is not one${isPng ? ': it is a PNG' : ''}`
}

function sizeProblem(width: number, height: number): string | undefined {
  if (width === 0 || height === 0) return `has no pixels (${width} × ${height})`
  if (width > MAX_ASSET_SIDE || height > MAX_ASSET_SIDE) return `is ${width} × ${height} pixels; the limit is ${MAX_ASSET_SIDE} pixels a side`
  return undefined
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

/** Channels per pixel for each PNG colour type, and the bit depths it allows. */
const PNG_COLOUR_TYPES: ReadonlyMap<number, { channels: number; depths: readonly number[] }> = new Map([
  [0, { channels: 1, depths: [1, 2, 4, 8, 16] }],
  [2, { channels: 3, depths: [8, 16] }],
  [3, { channels: 1, depths: [1, 2, 4, 8] }],
  [4, { channels: 2, depths: [8, 16] }],
  [6, { channels: 4, depths: [8, 16] }],
])

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

interface PngHeader {
  readonly width: number
  readonly height: number
  readonly bitsPerPixel: number
  readonly interlaced: boolean
  readonly paletted: boolean
}

function pngProblem(bytes: Uint8Array): string | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let header: PngHeader | undefined
  let palette = false
  const data: Uint8Array[] = []
  for (let offset: number = PNG_SIGNATURE.length; ; ) {
    // A chunk is its length, its type, its data and its CRC: 12 bytes and the data.
    if (offset + 12 > bytes.length || offset + 12 + view.getUint32(offset) > bytes.length) return `is cut off at byte ${offset}`
    const length = view.getUint32(offset)
    const end = offset + 12 + length
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const body = bytes.subarray(offset + 8, offset + 8 + length)
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== view.getUint32(offset + 8 + length)) return `has the wrong CRC on its ${type} chunk`
    if (header === undefined) {
      if (type !== 'IHDR') return 'does not start with its header chunk'
      const parsed = pngHeader(body)
      if (typeof parsed === 'string') return parsed
      header = parsed
    } else if (type === 'PLTE') {
      palette = true
    } else if (type === 'IDAT') {
      data.push(body)
    } else if (type === 'IEND') {
      if (end !== bytes.length) return 'has bytes after its end chunk'
      break
    }
    offset = end
  }
  if (header.paletted && !palette) return 'is paletted and has no palette'
  return scanlineProblem(header, data)
}

function pngHeader(body: Uint8Array): PngHeader | string {
  if (body.length !== 13) return 'has a header chunk of the wrong length'
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
  const width = view.getUint32(0)
  const height = view.getUint32(4)
  const size = sizeProblem(width, height)
  if (size !== undefined) return size
  const [depth = 0, colourType = 0, compression, filter, interlace = 0] = body.subarray(8)
  const colour = PNG_COLOUR_TYPES.get(colourType)
  if (colour === undefined || !colour.depths.includes(depth)) return `has an invalid colour type and bit depth (${colourType}, ${depth})`
  if (compression !== 0 || filter !== 0 || interlace > 1) return 'has an unknown compression, filter or interlace method'
  return { width, height, bitsPerPixel: colour.channels * depth, interlaced: interlace === 1, paletted: colourType === 3 }
}

/** Whether the image data inflates to exactly the scanlines the header promises, each starting with a filter type PNG defines. */
function scanlineProblem(header: PngHeader, data: readonly Uint8Array[]): string | undefined {
  if (data.length === 0) return 'has no image data'
  const passes = header.interlaced ? ADAM7.map(([x, y, dx, dy]) => [Math.ceil((header.width - x) / dx), Math.ceil((header.height - y) / dy)] as const) : [[header.width, header.height] as const]
  const rows = passes.filter(([width, height]) => width > 0 && height > 0).map(([width, height]) => ({ bytes: 1 + Math.ceil((width * header.bitsPerPixel) / 8), count: height }))
  const expected = rows.reduce((total, row) => total + row.bytes * row.count, 0)
  let inflated: Uint8Array
  try {
    // Inflating stops, and throws, at the first byte past what the header promises.
    inflated = inflateSync(Buffer.concat(data), { maxOutputLength: expected })
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ERR_BUFFER_TOO_LARGE') return `has more image data than the ${expected} bytes its header promises`
    return 'has image data that does not inflate'
  }
  if (inflated.length < expected) return `has image data of ${inflated.length} bytes where its header promises ${expected}`
  let offset = 0
  for (const row of rows) {
    for (let index = 0; index < row.count; index++, offset += row.bytes) {
      if (inflated[offset]! > 4) return `has a scanline with an unknown filter type (${inflated[offset]})`
    }
  }
  return undefined
}

/** Start-of-frame markers: every SOFn but DHT (C4), JPG (C8) and DAC (CC). */
const JPEG_FRAMES = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

/**
 * The segments before the scan, each a marker and a length, as a baseline or
 * progressive encoder writes them. Fill bytes between segments, which the
 * standard allows and encoders do not write, are refused with the rest of
 * what is malformed: failing closed costs a JPEG that could have been drawn.
 */
function jpegProblem(bytes: Uint8Array): string | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let framed = false
  for (let offset = 2; offset + 4 <= bytes.length; ) {
    const marker = bytes[offset + 1]!
    if (bytes[offset] !== 0xff || marker === 0xff) return `has a malformed segment at byte ${offset}`
    const length = view.getUint16(offset + 2)
    if (length < 2 || offset + 2 + length > bytes.length) return `has a segment that runs past its end at byte ${offset}`
    if (JPEG_FRAMES.has(marker)) {
      if (length < 8) return 'has a frame header of the wrong length'
      const size = sizeProblem(view.getUint16(offset + 7), view.getUint16(offset + 5))
      if (size !== undefined) return size
      framed = true
    }
    if (marker === 0xda) {
      if (!framed) return 'has image data before its frame header'
      return bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9 ? undefined : 'is cut off: it does not end with an end-of-image marker'
    }
    offset += 2 + length
  }
  return 'is cut off before its image data'
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte)
}
