import { inflateSync } from 'node:zlib'
import { PDFDocument } from '@pdfme/pdf-lib'
import { RenderRefusal, type Block, type ImageAsset } from '../document.js'

/**
 * The image assets a document draws, checked before pdfme sees any of them:
 * each is what its media type says, inside the limits, and decodes. An asset
 * that is not is refused as `invalid-asset`, naming it -- never drawn as a
 * hole, and never handed to a decoder that cannot cope with it.
 *
 * That last part is not caution. pdfme embeds a PNG through `@pdfme/pdf-lib`,
 * which decodes it with UPNG 1.0.1, whose inflater reads past the end of its
 * input without checking: given a PNG whose compressed pixel data is
 * truncated or corrupt, it never returns. It spins synchronously, so no
 * timer and no abort signal in the same thread can stop it. A PNG's pixel
 * data is therefore inflated here first, by Node's zlib, which stops at the
 * end of its input and checks the stream's checksum, and only a stream that
 * inflates to exactly the size the header implies goes on to pdf-lib.
 *
 * The limits are the trial's, not a product decision: 4096 pixels a side and
 * 20 MB of bytes, enough for a logo or a scanned signature at print
 * resolution, and small enough that decoding one cannot exhaust a worker.
 */
const MAX_SIDE = 4096
const MAX_BYTES = 20 * 1024 * 1024

/** An asset's size in pixels, read from its own header. */
export interface Pixels {
  readonly width: number
  readonly height: number
}

/** Every image asset `blocks` draw, keep-together blocks included, each checked once, by id. */
export async function checkedImages(blocks: readonly Block[]): Promise<Map<string, Pixels>> {
  const checked = new Map<string, Pixels>()
  for (const asset of assetsIn(blocks)) {
    if (!checked.has(asset.id)) checked.set(asset.id, await checkedImage(asset))
  }
  return checked
}

function assetsIn(blocks: readonly Block[]): ImageAsset[] {
  return blocks.flatMap((block) => (block.kind === 'image' ? [block.asset] : block.kind === 'keepTogether' ? assetsIn(block.blocks) : []))
}

/**
 * The header first, so that the limits hold before anything is inflated or
 * decoded; then, for a PNG, its pixel data inflated by zlib; then the bytes
 * embedded once in a scratch document by `@pdfme/pdf-lib`, the library pdfme
 * embeds them with. pdf-lib embeds a JPEG as it stands, its scan data never
 * decoded, so for a JPEG the headers are the whole check.
 */
async function checkedImage(asset: ImageAsset): Promise<Pixels> {
  const refuse = (reason: string): RenderRefusal => new RenderRefusal('invalid-asset', `the image asset '${asset.id}' ${reason}`, asset.id)
  if (asset.bytes.length > MAX_BYTES) throw refuse(`is ${asset.bytes.length} bytes; at most ${MAX_BYTES} are allowed`)
  const png = asset.mediaType === 'image/png' ? readPng(asset.bytes) : undefined
  const pixels = asset.mediaType === 'image/png' ? png : jpegPixels(asset.bytes)
  if (pixels === undefined) throw refuse(`is not a ${asset.mediaType === 'image/png' ? 'PNG' : 'JPEG'}, as its media type ${asset.mediaType} says`)
  if (pixels.width === 0 || pixels.height === 0 || pixels.width > MAX_SIDE || pixels.height > MAX_SIDE) {
    throw refuse(`is ${pixels.width} × ${pixels.height} pixels; at most ${MAX_SIDE} a side are allowed`)
  }
  const problem = png === undefined ? undefined : pixelDataProblem(png)
  if (problem !== undefined) throw refuse(problem)
  try {
    const scratch = await PDFDocument.create()
    await (asset.mediaType === 'image/png' ? scratch.embedPng(asset.bytes) : scratch.embedJpg(asset.bytes))
  } catch (error) {
    throw refuse(`does not decode: ${error instanceof Error ? error.message : String(error)}`)
  }
  return pixels
}

/** What a PNG's chunks say about its pixels, and its compressed pixel data, the IDAT chunks joined. */
interface Png extends Pixels {
  readonly bitDepth: number
  readonly colourType: number
  readonly interlaced: boolean
  readonly idat: Uint8Array
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

/** The bit depths each colour type allows, and its samples a pixel, from the PNG specification's IHDR table. */
const COLOUR_TYPES: ReadonlyMap<number, { readonly depths: readonly number[]; readonly samples: number }> = new Map([
  [0, { depths: [1, 2, 4, 8, 16], samples: 1 }],
  [2, { depths: [8, 16], samples: 3 }],
  [3, { depths: [1, 2, 4, 8], samples: 1 }],
  [4, { depths: [8, 16], samples: 2 }],
  [6, { depths: [8, 16], samples: 4 }],
])

/**
 * A PNG's chunks, walked from the signature to IEND with every length kept
 * inside the bytes; undefined when the bytes are not a PNG: no signature, no
 * IHDR first, a chunk running past the end, or no IEND.
 */
function readPng(bytes: Uint8Array): Png | undefined {
  if (bytes.length < 8 || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const idat: Uint8Array[] = []
  let header: Omit<Png, 'idat'> | undefined
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const data = offset + 12 + length <= bytes.length ? bytes.subarray(offset + 8, offset + 8 + length) : undefined
    if (data === undefined || (header === undefined && type !== 'IHDR')) return undefined
    if (type === 'IEND') return { ...header!, idat: joined(idat) }
    if (type === 'IHDR' && length === 13) {
      const fields = new DataView(data.buffer, data.byteOffset, 13)
      // Compression and filter method 0 are the only ones the specification defines.
      if (fields.getUint8(10) !== 0 || fields.getUint8(11) !== 0 || fields.getUint8(12) > 1) return undefined
      header = {
        width: fields.getUint32(0),
        height: fields.getUint32(4),
        bitDepth: fields.getUint8(8),
        colourType: fields.getUint8(9),
        interlaced: fields.getUint8(12) === 1,
      }
    } else if (type === 'IHDR') {
      return undefined
    }
    if (type === 'IDAT') idat.push(data)
    offset += 12 + length
  }
  return undefined
}

function joined(parts: readonly Uint8Array[]): Uint8Array {
  const all = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    all.set(part, offset)
    offset += part.length
  }
  return all
}

/**
 * Why a PNG's pixel data cannot be decoded, or undefined when it can: its
 * colour type and depth are ones the specification allows, and its
 * compressed data inflates -- checksum and all -- to exactly one filter byte
 * and one row of samples for every scanline, each filter byte one of the
 * five filters there are. A palette image without its palette passes here
 * and is left to pdf-lib, which fails on it and says so.
 */
function pixelDataProblem(png: Png): string | undefined {
  const colour = COLOUR_TYPES.get(png.colourType)
  if (colour === undefined || !colour.depths.includes(png.bitDepth))
    return `has colour type ${png.colourType} at ${png.bitDepth} bits, which PNG does not allow`
  const passes = scanlines(png, colour.samples * png.bitDepth)
  const expected = passes.reduce((total, pass) => total + pass.rows * (1 + pass.rowBytes), 0)
  let inflated: Uint8Array
  try {
    inflated = inflateSync(png.idat, { maxOutputLength: Math.max(expected, 1) })
  } catch (error) {
    return `has pixel data that does not inflate: ${error instanceof Error ? error.message : String(error)}`
  }
  if (inflated.length !== expected) return `has ${inflated.length} bytes of pixel data; its header implies ${expected}`
  let offset = 0
  for (const pass of passes) {
    for (let row = 0; row < pass.rows; row++) {
      if (inflated[offset]! > 4) return `has a scanline with filter type ${inflated[offset]}; PNG has five, 0 to 4`
      offset += 1 + pass.rowBytes
    }
  }
  return undefined
}

/** Adam7's seven passes: the first row and column each starts at, and the steps between them. */
const ADAM7 = [
  { row: 0, column: 0, rowStep: 8, columnStep: 8 },
  { row: 0, column: 4, rowStep: 8, columnStep: 8 },
  { row: 4, column: 0, rowStep: 8, columnStep: 4 },
  { row: 0, column: 2, rowStep: 4, columnStep: 4 },
  { row: 2, column: 0, rowStep: 4, columnStep: 2 },
  { row: 0, column: 1, rowStep: 2, columnStep: 2 },
  { row: 1, column: 0, rowStep: 2, columnStep: 1 },
] as const

/** The scanlines the pixel data holds, as rows of so many bytes each: one pass, or Adam7's seven, empty passes left out. */
function scanlines(png: Png, bitsPerPixel: number): { rows: number; rowBytes: number }[] {
  const pass = (rows: number, columns: number): { rows: number; rowBytes: number } => ({ rows, rowBytes: Math.ceil((columns * bitsPerPixel) / 8) })
  if (!png.interlaced) return [pass(png.height, png.width)]
  const count = (size: number, start: number, step: number): number => (size > start ? Math.ceil((size - start) / step) : 0)
  return ADAM7.map((adam) => pass(count(png.height, adam.row, adam.rowStep), count(png.width, adam.column, adam.columnStep))).filter(
    (scan) => scan.rows > 0 && scan.rowBytes > 0,
  )
}

/** Start-of-frame markers, the ones that carry a JPEG's size: every SOFn but the DHT, JPG and DAC markers that share their range. */
const FRAME_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

/**
 * A JPEG's size from its frame header, found by walking the marker segments
 * from the start-of-image; undefined when the bytes are not a JPEG or reach
 * the scan without a frame.
 */
function jpegPixels(bytes: Uint8Array): Pixels | undefined {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return undefined
    const marker = bytes[offset + 1]!
    // Fill bytes before a marker, and the markers that carry no length.
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += marker === 0xff ? 1 : 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) return undefined
    if (FRAME_MARKERS.has(marker)) {
      if (offset + 9 > bytes.length) return undefined
      return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) }
    }
    offset += 2 + view.getUint16(offset + 2)
  }
  return undefined
}
