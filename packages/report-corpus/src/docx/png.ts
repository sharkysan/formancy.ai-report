import { crc32, inflateSync } from 'node:zlib'

/**
 * A code's picture read back to its pixels (0074, extending 0003): the PNG
 * a Word file embeds for a QR code, decoded by the corpus's own walk of its
 * chunks and Node's zlib, never by its writer and never by fflate, which
 * deflated it.
 *
 * It reads the one kind of PNG report-render-docx makes of a symbol and
 * refuses every other, saying why: one bit a pixel of grey, not
 * interlaced, its chunks the header, the image data and the end, each
 * summed as PNG sums a chunk, and its data one zlib stream of exactly the
 * scanlines the header promises. Every filter PNG defines is undone, so
 * that what is read does not rest on which the writer chose.
 */

/** A picture's pixels, a byte each from the top left: 0 for black, 255 for white. */
export interface GreyPixels {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** The chunks of a PNG, in order, each by its type and its data; throws where the file is cut short or a chunk does not sum. */
function chunksOf(bytes: Uint8Array): { readonly type: string; readonly data: Uint8Array }[] {
  if (!SIGNATURE.every((byte, index) => bytes[index] === byte)) throw new Error('the picture is no PNG: it does not open with its signature')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: { type: string; data: Uint8Array }[] = []
  let at = SIGNATURE.length
  while (at < bytes.length) {
    if (at + 12 > bytes.length) throw new Error('the PNG ends inside a chunk')
    const length = view.getUint32(at)
    const end = at + 8 + length
    if (end + 4 > bytes.length) throw new Error('the PNG ends inside a chunk')
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8))
    if (crc32(bytes.subarray(at + 4, end)) !== view.getUint32(end)) throw new Error(`the PNG's ${type} chunk does not sum to its CRC`)
    chunks.push({ type, data: bytes.subarray(at + 8, end) })
    at = end + 4
  }
  return chunks
}

/** Paeth's predictor (PNG 9.4): of the byte to the left, the one above and the one above left, the nearest to their sum less the last. */
function paeth(left: number, above: number, corner: number): number {
  const estimate = left + above - corner
  const [toLeft, toAbove, toCorner] = [Math.abs(estimate - left), Math.abs(estimate - above), Math.abs(estimate - corner)]
  return toLeft <= toAbove && toLeft <= toCorner ? left : toAbove <= toCorner ? above : corner
}

/**
 * The scanlines as they were before they were filtered (PNG 9.2), `stride`
 * bytes a line after its filter byte. A pixel is a bit, so the byte "to
 * the left" is the byte before.
 */
function unfiltered(lines: Uint8Array, stride: number, height: number): Uint8Array {
  const out = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = lines[y * (stride + 1)]!
    if (filter > 4) throw new Error(`the PNG has a scanline with an unknown filter type (${filter})`)
    for (let x = 0; x < stride; x++) {
      const raw = lines[y * (stride + 1) + 1 + x]!
      const left = x === 0 ? 0 : out[y * stride + x - 1]!
      const above = y === 0 ? 0 : out[(y - 1) * stride + x]!
      const corner = x === 0 || y === 0 ? 0 : out[(y - 1) * stride + x - 1]!
      const predicted = [0, left, above, (left + above) >> 1, paeth(left, above, corner)][filter]!
      out[y * stride + x] = (raw + predicted) & 0xff
    }
  }
  return out
}

/** `bytes`, a PNG of one bit of grey a pixel, as its pixels; throws, saying why, where they are any other file. */
export function readPng(bytes: Uint8Array): GreyPixels {
  const chunks = chunksOf(bytes)
  const types = chunks.map((chunk) => chunk.type)
  const data = chunks.filter((chunk) => chunk.type === 'IDAT')
  if (types[0] !== 'IHDR' || types.at(-1) !== 'IEND' || data.length === 0 || types.length !== data.length + 2)
    throw new Error(`the PNG holds the chunks ${types.join(', ')}, where a code's picture holds its header, its image data and its end`)
  const header = chunks[0]!.data
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength)
  if (header.length !== 13) throw new Error('the PNG has a header of another length than thirteen bytes')
  const [width, height] = [view.getUint32(0), view.getUint32(4)]
  const [depth, colour, compression, filter, interlace] = header.subarray(8)
  if (depth !== 1 || colour !== 0 || compression !== 0 || filter !== 0 || interlace !== 0)
    throw new Error(`the PNG is not one bit of grey a pixel, deflated and not interlaced: its header states ${[...header.subarray(8)].join(', ')}`)
  if (width === 0 || height === 0) throw new Error('the PNG has no pixels')
  const stride = Math.ceil(width / 8)
  const stream = new Uint8Array(data.reduce((sum, chunk) => sum + chunk.data.length, 0))
  data.reduce((at, chunk) => (stream.set(chunk.data, at), at + chunk.data.length), 0)
  const lines = new Uint8Array(inflateSync(stream))
  if (lines.length !== height * (stride + 1))
    throw new Error(`the PNG has image data of ${lines.length} bytes where its header promises ${height * (stride + 1)}`)
  const rows = unfiltered(lines, stride, height)
  const pixels = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels[y * width + x] = ((rows[y * stride + (x >> 3)]! >> (7 - (x & 7))) & 1) * 255
  return { width, height, data: pixels }
}
