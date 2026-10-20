/**
 * What a PNG's or a JPEG's bytes say of the picture they hold, read once
 * for every reader: a builder, where a person adds an image, and the
 * renderer, where it prints (0033). A picture the renderer would refuse at
 * every print is refused when it is added, in the same words, so that a
 * host never keeps bytes no report could print.
 *
 * What is read: for a PNG, every chunk's length and CRC, the header, a
 * palette where the header needs one, the image data's chunks, the end
 * chunk and nothing after it; for a JPEG, the segment structure up to the
 * scan, one frame header, read where PDFKit reads it, its size and its
 * component count, the first Exif block's orientation, and the end
 * marker. What is not: whether a PNG's image data inflates to exactly the
 * scanlines its header promises, which needs a decompressor ES2023 does not
 * have and the renderer checks at print; and a JPEG's entropy-coded scan,
 * which nothing decodes, so a corrupt scan inside an otherwise well-formed
 * JPEG still reaches the PDF.
 *
 * The size returned is the size the picture is shown at: a JPEG whose Exif
 * orientation turns it a quarter turn is as wide as its frame is tall, as
 * PDFKit draws it. Every read is bounded by the bytes' length, and nothing
 * here throws for what the bytes hold.
 */
import type { AssetMediaType } from './assets.js'
import { MAX_ASSET_SIDE } from './limits.js'

/** A PNG's header, as the renderer needs it to check the image data: its scanlines follow from the size, the bits a pixel and the interlace. */
export interface PngHeader {
  readonly ok: true
  readonly mediaType: 'image/png'
  readonly width: number
  readonly height: number
  readonly bitsPerPixel: number
  /** Adam7, the one interlace method PNG defines. */
  readonly interlaced: boolean
  /** The image data, every IDAT chunk's joined in order: compressed, and not inflated here. */
  readonly data: Uint8Array<ArrayBuffer>
}

/** A JPEG's frame, as it is shown. */
export interface JpegHeader {
  readonly ok: true
  readonly mediaType: 'image/jpeg'
  readonly width: number
  readonly height: number
  /** Grey, RGB or CMYK, as PDFKit draws a JPEG of one, three or four components (pdfkit.js 3808-3812). */
  readonly components: 1 | 3 | 4
}

export type RasterHeader = PngHeader | JpegHeader

/** Why a PNG's or a JPEG's bytes are refused, each the first thing found wrong with them. */
export const IMAGE_REFUSAL_CODES = [
  /** Neither a PNG's signature nor a JPEG's start of image. */
  'not-raster',
  /** A PNG or a JPEG whose structure is broken, or that PDFKit would read otherwise than this does. */
  'malformed',
  /** No pixels: a width or a height of 0. */
  'no-pixels',
  /** Wider or taller than `MAX_ASSET_SIDE` pixels. */
  'too-large',
] as const
export type ImageRefusalCode = (typeof IMAGE_REFUSAL_CODES)[number]

/** A refusal, said in English after the image's name -- the renderer says `the image asset logo ${message}` -- and, for one of its size, the size, for a person's own language. */
export type ImageRefusal =
  | { readonly ok: false; readonly code: 'not-raster' | 'malformed'; readonly message: string }
  | { readonly ok: false; readonly code: 'no-pixels' | 'too-large'; readonly message: string; readonly width: number; readonly height: number }

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

/** A UTF-8 file's byte order mark; and UTF-16's, either way round, and big-endian UTF-32's, little-endian UTF-32's starting as UTF-16's does: the SVG cleaner refuses each as `encoding`. */
const UTF8_MARK = [0xef, 0xbb, 0xbf] as const
const WIDE_MARKS = [[0xfe, 0xff], [0xff, 0xfe], [0, 0, 0xfe, 0xff]] as const

/** XML's white space: space, tab, carriage return, line feed. */
const XML_SPACE = new Set([0x20, 0x09, 0x0d, 0x0a])

/**
 * What an image's bytes are, from their first bytes alone, never a file's
 * name or a type a browser guessed: a PNG by its signature, a JPEG by its
 * start of image, and an SVG to be cleaned by `<` after an optional UTF-8
 * byte order mark and white space, or by a UTF-16 or UTF-32 byte order
 * mark, so that a person who saved one so is told to save it as UTF-8.
 * Undefined for anything else. A sniff is no check: the bytes are read
 * whole by `imageHeader` or by `cleanSvg` next.
 */
export function sniffImage(bytes: Uint8Array): AssetMediaType | undefined {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (WIDE_MARKS.some((mark) => startsWith(bytes, mark))) return 'image/svg+xml'
  let at = startsWith(bytes, UTF8_MARK) ? UTF8_MARK.length : 0
  while (at < bytes.length && XML_SPACE.has(bytes[at]!)) at++
  return bytes[at] === 0x3c ? 'image/svg+xml' : undefined
}

/** A PNG's or a JPEG's header, read as the renderer reads it, or the first thing wrong with it. */
export function imageHeader(bytes: Uint8Array): RasterHeader | ImageRefusal {
  const sniffed = sniffImage(bytes)
  if (sniffed === 'image/png') return readPng(bytes)
  if (sniffed === 'image/jpeg') return readJpeg(bytes)
  return { ok: false, code: 'not-raster', message: 'is neither a PNG nor a JPEG' }
}

function malformed(message: string): ImageRefusal {
  return { ok: false, code: 'malformed', message }
}

function sizeRefusal(width: number, height: number): ImageRefusal | undefined {
  if (width === 0 || height === 0) return { ok: false, code: 'no-pixels', message: `has no pixels (${width} × ${height})`, width, height }
  if (width > MAX_ASSET_SIDE || height > MAX_ASSET_SIDE) return { ok: false, code: 'too-large', message: `is ${width} × ${height} pixels; the limit is ${MAX_ASSET_SIDE} pixels a side`, width, height }
  return undefined
}

/** CRC-32 as PNG and zlib compute it: the reflected polynomial 0xedb88320, every bit inverted before and after. */
const CRC_TABLE: readonly number[] = Array.from({ length: 256 }, (_, byte) => {
  let crc = byte
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

/** The CRC of `bytes` from `start` up to `end`, all of them when neither is given. */
export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let crc = 0xffffffff
  for (let at = start; at < end; at++) crc = CRC_TABLE[(crc ^ bytes[at]!) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** Channels per pixel for each PNG colour type, and the bit depths it allows. */
const PNG_COLOUR_TYPES: ReadonlyMap<number, { channels: number; depths: readonly number[] }> = new Map([
  [0, { channels: 1, depths: [1, 2, 4, 8, 16] }],
  [2, { channels: 3, depths: [8, 16] }],
  [3, { channels: 1, depths: [1, 2, 4, 8] }],
  [4, { channels: 2, depths: [8, 16] }],
  [6, { channels: 4, depths: [8, 16] }],
])

/** A PNG's header chunk, read. */
interface Ihdr {
  readonly width: number
  readonly height: number
  readonly bitsPerPixel: number
  readonly interlaced: boolean
  readonly paletted: boolean
}

/** The chunk types read, as the four bytes of each read as one big-endian number. */
const IHDR = 0x49484452
const PLTE = 0x504c5445
const IDAT = 0x49444154
const IEND = 0x49454e44

/**
 * A PNG's chunks walked once, each CRC checked, and nothing kept of a chunk
 * but what the header chunk says and how long the image data is: a file a
 * person chose may hold over a million chunks in its 20 MiB.
 */
function readPng(bytes: Uint8Array): PngHeader | ImageRefusal {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let header: Ihdr | undefined
  let palette = false
  let chunks = 0
  let length = 0
  for (let offset: number = PNG_SIGNATURE.length; ; ) {
    // A chunk is its length, its type, its data and its CRC: 12 bytes and the data.
    if (offset + 12 > bytes.length || offset + 12 + view.getUint32(offset) > bytes.length) return malformed(`is cut off at byte ${offset}`)
    const size = view.getUint32(offset)
    const end = offset + 12 + size
    const type = view.getUint32(offset + 4)
    if (crc32(bytes, offset + 4, offset + 8 + size) !== view.getUint32(offset + 8 + size)) return malformed(`has the wrong CRC on its ${String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))} chunk`)
    if (header === undefined) {
      if (type !== IHDR) return malformed('does not start with its header chunk')
      const parsed = pngHeader(bytes.subarray(offset + 8, offset + 8 + size))
      if ('ok' in parsed) return parsed
      header = parsed
    } else if (type === PLTE) {
      palette = true
    } else if (type === IDAT) {
      chunks += 1
      length += size
    } else if (type === IEND) {
      if (end !== bytes.length) return malformed('has bytes after its end chunk')
      break
    }
    offset = end
  }
  if (header.paletted && !palette) return malformed('is paletted and has no palette')
  if (chunks === 0) return malformed('has no image data')
  const { width, height, bitsPerPixel, interlaced } = header
  return { ok: true, mediaType: 'image/png', width, height, bitsPerPixel, interlaced, data: imageData(bytes, view, length) }
}

/** The `length` bytes of a PNG's image data, every IDAT chunk's copied in order into one array, of a PNG whose chunks `readPng` has walked. */
function imageData(bytes: Uint8Array, view: DataView, length: number): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(length)
  for (let offset: number = PNG_SIGNATURE.length, at = 0; at < length; ) {
    const size = view.getUint32(offset)
    if (view.getUint32(offset + 4) === IDAT && size > 0) {
      data.set(bytes.subarray(offset + 8, offset + 8 + size), at)
      at += size
    }
    offset += 12 + size
  }
  return data
}

function pngHeader(body: Uint8Array): Ihdr | ImageRefusal {
  if (body.length !== 13) return malformed('has a header chunk of the wrong length')
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
  const width = view.getUint32(0)
  const height = view.getUint32(4)
  const size = sizeRefusal(width, height)
  if (size !== undefined) return size
  const [depth = 0, colourType = 0, compression, filter, interlace = 0] = body.subarray(8)
  const colour = PNG_COLOUR_TYPES.get(colourType)
  if (colour === undefined || !colour.depths.includes(depth)) return malformed(`has an invalid colour type and bit depth (${colourType}, ${depth})`)
  if (compression !== 0 || filter !== 0 || interlace > 1) return malformed('has an unknown compression, filter or interlace method')
  return { width, height, bitsPerPixel: colour.channels * depth, interlaced: interlace === 1, paletted: colourType === 3 }
}

/** Start-of-frame markers: every SOFn, which are C0 to CF but DHT (C4), JPG (C8) and DAC (CC). */
const JPEG_FRAMES = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

/**
 * The two markers PDFKit takes for a frame header besides the SOFn: it
 * reads the first segment of any of the three as the frame (pdfkit.js 3807,
 * 3822-3843), so one of these before the frame would be read in its place.
 */
const READ_AS_FRAMES: ReadonlyMap<number, string> = new Map([
  [0xc8, 'JPG'],
  [0xcc, 'DAC'],
])

/** The component counts PDFKit gives a colour space: grey, RGB and CMYK (pdfkit.js 3808-3812). */
const JPEG_COMPONENTS: ReadonlySet<number> = new Set([1, 3, 4])

/** APP1, where an Exif block lives. */
const APP1 = 0xe1

/**
 * The segments before the scan, each a marker and a length, as a baseline or
 * progressive encoder writes them. Fill bytes between segments, which the
 * standard allows and encoders do not write, are refused with the rest of
 * what is malformed: failing closed costs a JPEG that could have been drawn.
 * So does a JPEG PDFKit would read otherwise than this does -- a JPG or DAC
 * segment before the frame header, which it reads as the frame, a second
 * frame header, or a component count it gives no colour space -- since the
 * size and the colour this reads are what the page and an e-invoice's
 * PDF/A rest on: arithmetic coding, which writes a DAC segment, may write
 * it before the frame header, and such a JPEG is refused.
 */
function readJpeg(bytes: Uint8Array): JpegHeader | ImageRefusal {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let frame: JpegHeader | undefined
  let orientation: number | undefined
  for (let offset = 2; offset + 4 <= bytes.length; ) {
    const marker = bytes[offset + 1]!
    if (bytes[offset] !== 0xff || marker === 0xff) return malformed(`has a malformed segment at byte ${offset}`)
    const length = view.getUint16(offset + 2)
    if (length < 2 || offset + 2 + length > bytes.length) return malformed(`has a segment that runs past its end at byte ${offset}`)
    const readAs = READ_AS_FRAMES.get(marker)
    if (frame === undefined && readAs !== undefined) return malformed(`has a ${readAs} segment (FF${marker.toString(16).toUpperCase()}) before its frame header, which PDFKit would read as the frame header`)
    if (JPEG_FRAMES.has(marker)) {
      if (frame !== undefined) return malformed('has two frame headers')
      if (length < 8) return malformed('has a frame header of the wrong length')
      const [width, height] = [view.getUint16(offset + 7), view.getUint16(offset + 5)]
      const size = sizeRefusal(width, height)
      if (size !== undefined) return size
      // The component count follows the size.
      const components = bytes[offset + 9]!
      if (!JPEG_COMPONENTS.has(components)) return malformed(`has a frame header of ${components} components, where PDFKit draws 1, 3 or 4`)
      frame = { ok: true, mediaType: 'image/jpeg', width, height, components: components as JpegHeader['components'] }
    }
    if (marker === APP1 && orientation === undefined && startsWith(bytes.subarray(offset + 4), EXIF)) orientation = exifOrientation(bytes.subarray(offset + 4 + EXIF.length, offset + 2 + length))
    if (marker === 0xda) {
      if (frame === undefined) return malformed('has image data before its frame header')
      if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return malformed('is cut off: it does not end with an end-of-image marker')
      // Orientations 5 to 8 turn the image a quarter turn, as PDFKit draws it.
      return (orientation ?? 0) > 4 ? { ...frame, width: frame.height, height: frame.width } : frame
    }
    offset += 2 + length
  }
  return malformed('is cut off before its image data')
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
