import { MAX_ASSET_BYTES, RenderRefusal, type ImageAsset } from '@formancy/report-runtime'
import { crc32, inflate } from './bytes.js'

/**
 * Image assets checked before pdfmake sees them. pdfmake, through PDFKit,
 * copies a PNG's compressed data and a JPEG's scan into the PDF without
 * decoding either, so bytes that only look like an image arrive in the PDF
 * as a broken one, and bytes that do not look like one at all fail with an
 * error that names no asset. Both are refused here instead, naming it, as
 * `invalid-asset`.
 *
 * What is checked: the size limits; for a PNG, every chunk's length and CRC,
 * the header, and that the image data inflates to exactly the scanlines the
 * header promises, each with a known filter; for a JPEG, the segment
 * structure up to the scan, the frame header's size, and the end marker. A
 * JPEG's entropy-coded scan is not decoded: a corrupt scan inside an
 * otherwise well-formed JPEG still reaches the PDF.
 *
 * The size returned is the size the image is shown at: a JPEG whose Exif
 * orientation turns it a quarter turn is as wide as its frame is tall, as
 * PDFKit draws it. The check runs on the standard library alone, so that the
 * browser entry makes exactly the same one (`bytes.ts`).
 */

/** Pixels a side. */
export const MAX_ASSET_SIDE = 4096

/**
 * The image data one render may hold, once inflated: two images of the
 * largest kind an asset may be, 4096 by 4096 pixels of 16-bit RGBA, whose
 * scanlines inflate to 134,221,824 bytes each. PDFKit decodes such a PNG to
 * embed it: one took 1.8 seconds and grew the process by 343 MB, two 3.4
 * seconds, four 6.5 seconds (measured on 2026-10-15, on an Intel i9-10900K
 * under Node 24.21). A JPEG is embedded as it is, and counts its bytes.
 */
export const MAX_IMAGE_DATA = 2 * MAX_ASSET_SIDE * (1 + MAX_ASSET_SIDE * 8)

/** An image's size in pixels, as it is shown, and how many bytes of image data it holds once a PNG's are inflated. */
export interface Pixels {
  readonly width: number
  readonly height: number
  readonly data: number
}

/** The asset's size in pixels, once its bytes pass; refused as `invalid-asset`, naming it and why, when they do not. */
export async function checkImageAsset(asset: ImageAsset): Promise<Pixels> {
  const read = await readAsset(asset)
  if (typeof read === 'string') throw new RenderRefusal('invalid-asset', `the image asset ${asset.id} ${read}`, asset.id)
  return read
}

/** The asset's size in pixels, or what is wrong with it. */
async function readAsset(asset: ImageAsset): Promise<Pixels | string> {
  const { bytes } = asset
  if (!(bytes instanceof Uint8Array)) return 'has no bytes'
  if (bytes.length > MAX_ASSET_BYTES) return `is ${bytes.length} bytes; the limit is ${MAX_ASSET_BYTES} (20 MB)`
  const isPng = startsWith(bytes, PNG_SIGNATURE)
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
  if (asset.mediaType === 'image/png') return isPng ? readPng(bytes) : `is declared a PNG and is not one${isJpeg ? ': it is a JPEG' : ''}`
  if (asset.mediaType === 'image/jpeg') return isJpeg ? readJpeg(bytes) : `is declared a JPEG and is not one${isPng ? ': it is a PNG' : ''}`
  return `is of a media type the renderer does not draw (${String(asset.mediaType)})`
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

async function readPng(bytes: Uint8Array): Promise<Pixels | string> {
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
  return (await scanlineProblem(header, data)) ?? { width: header.width, height: header.height, data: inflatedLength(header) }
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

/** The scanlines of each pass of the image: the bytes of one, its filter byte included, and how many there are. */
function scanlines(header: PngHeader): { readonly bytes: number; readonly count: number }[] {
  const passes = header.interlaced ? ADAM7.map(([x, y, dx, dy]) => [Math.ceil((header.width - x) / dx), Math.ceil((header.height - y) / dy)] as const) : [[header.width, header.height] as const]
  return passes.filter(([width, height]) => width > 0 && height > 0).map(([width, height]) => ({ bytes: 1 + Math.ceil((width * header.bitsPerPixel) / 8), count: height }))
}

/** The bytes the image data inflates to, as the header promises. */
function inflatedLength(header: PngHeader): number {
  return scanlines(header).reduce((total, row) => total + row.bytes * row.count, 0)
}

/**
 * Whether the image data inflates to exactly the scanlines the header
 * promises, each starting with a filter type PNG defines. Read as it
 * inflates: the filter bytes are where the scanlines say, so nothing of the
 * image is kept.
 */
async function scanlineProblem(header: PngHeader, data: readonly Uint8Array[]): Promise<string | undefined> {
  if (data.length === 0) return 'has no image data'
  const rows = scanlines(header)
  const expected = inflatedLength(header)
  const filters = filterOffsets(rows)
  let next = filters.next()
  let unknown: number | undefined
  const inflated = await inflate(concat(data), expected, (chunk, offset) => {
    while (unknown === undefined && !next.done && next.value < offset + chunk.length) {
      const filter = chunk[next.value - offset]!
      if (filter > 4) unknown = filter
      next = filters.next()
    }
  })
  if (inflated.kind === 'too-long') return `has more image data than the ${expected} bytes its header promises`
  if (inflated.kind === 'invalid') return 'has image data that does not inflate'
  if (inflated.length < expected) return `has image data of ${inflated.length} bytes where its header promises ${expected}`
  return unknown === undefined ? undefined : `has a scanline with an unknown filter type (${unknown})`
}

/** Where each scanline's filter byte is in the inflated data, in order. */
function* filterOffsets(rows: readonly { readonly bytes: number; readonly count: number }[]): Generator<number, void> {
  let offset = 0
  for (const row of rows) {
    for (let index = 0; index < row.count; index++, offset += row.bytes) yield offset
  }
}

/** Start-of-frame markers: every SOFn but DHT (C4), JPG (C8) and DAC (CC). */
const JPEG_FRAMES = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

/** APP1, where an Exif block lives. */
const APP1 = 0xe1

/**
 * The segments before the scan, each a marker and a length, as a baseline or
 * progressive encoder writes them. Fill bytes between segments, which the
 * standard allows and encoders do not write, are refused with the rest of
 * what is malformed: failing closed costs a JPEG that could have been drawn.
 */
function readJpeg(bytes: Uint8Array): Pixels | string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let pixels: Pixels | undefined
  let orientation: number | undefined
  for (let offset = 2; offset + 4 <= bytes.length; ) {
    const marker = bytes[offset + 1]!
    if (bytes[offset] !== 0xff || marker === 0xff) return `has a malformed segment at byte ${offset}`
    const length = view.getUint16(offset + 2)
    if (length < 2 || offset + 2 + length > bytes.length) return `has a segment that runs past its end at byte ${offset}`
    if (JPEG_FRAMES.has(marker)) {
      if (length < 8) return 'has a frame header of the wrong length'
      const [width, height] = [view.getUint16(offset + 7), view.getUint16(offset + 5)]
      const size = sizeProblem(width, height)
      if (size !== undefined) return size
      pixels = { width, height, data: bytes.length }
    }
    if (marker === APP1 && orientation === undefined && startsWith(bytes.subarray(offset + 4), EXIF)) orientation = exifOrientation(bytes.subarray(offset + 4 + EXIF.length, offset + 2 + length))
    if (marker === 0xda) {
      if (pixels === undefined) return 'has image data before its frame header'
      if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return 'is cut off: it does not end with an end-of-image marker'
      // Orientations 5 to 8 turn the image a quarter turn, as PDFKit draws it.
      return (orientation ?? 0) > 4 ? { ...pixels, width: pixels.height, height: pixels.width } : pixels
    }
    offset += 2 + length
  }
  return 'is cut off before its image data'
}

/** What an APP1 segment that holds Exif data starts with. */
const EXIF = [0x45, 0x78, 0x69, 0x66, 0, 0] as const

/**
 * The orientation the first Exif block gives its image, read as PDFKit reads
 * it: the Orientation tag (0x0112) of the first image file directory, from 1
 * to 8. Anything else -- a block cut short, no such tag, a value out of
 * range -- is no orientation, which PDFKit draws as 1, upright. Only the
 * first Exif block counts, for PDFKit and here, so `0` stands for one read
 * without an orientation.
 */
function exifOrientation(block: Uint8Array): number {
  if (block.length < 8) return 0
  const tiff = new DataView(block.buffer, block.byteOffset, block.byteLength)
  const order = tiff.getUint16(0)
  if (order !== 0x4949 && order !== 0x4d4d) return 0
  const little = order === 0x4949
  if (tiff.getUint16(2, little) !== 42) return 0
  const directory = tiff.getUint32(4, little)
  if (directory + 2 > tiff.byteLength) return 0
  const entries = tiff.getUint16(directory, little)
  for (let index = 0; index < entries; index++) {
    const entry = directory + 2 + index * 12
    if (entry + 12 > tiff.byteLength) return 0
    if (tiff.getUint16(entry, little) === 0x0112) {
      const value = tiff.getUint16(entry + 8, little)
      return value >= 1 && value <= 8 ? value : 0
    }
  }
  return 0
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte)
}

function concat(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    joined.set(part, offset)
    offset += part.length
  }
  return joined
}
