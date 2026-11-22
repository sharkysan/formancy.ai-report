import { zlibSync } from 'fflate'
import { QR_QUIET_ZONE, type QrSymbol } from '@formancy/report-runtime'

/**
 * A code's symbol as the picture a Word file embeds for it (0074): a PNG
 * of one bit a pixel, black on white, every module a square of whole
 * pixels, the quiet zone of four modules inside it.
 *
 * A Word file holds no drawing of the writer's own but a picture, and a
 * symbol is a raster already. Word scales a picture to the paper as it
 * prints, and a reader that scales a small picture up smooths it: at one
 * pixel a module, a module's edge would be a ramp a module wide. So the
 * picture is fine enough for its size (`modulePixels`), and since a
 * module is a whole number of pixels no edge stands inside one.
 *
 * The bytes are the document's: the header, the image data and the end,
 * the data deflated by fflate, whose code is the same in every host, as
 * the file's own entries are (`package.ts`). Each row of modules is
 * written once and repeated by PNG's own filter -- a scanline that is
 * the one above it is nothing but that filter's byte -- so the picture of
 * the largest symbol is some ten kilobytes.
 */

/**
 * The least a code's picture holds of pixels to the inch at the size it
 * prints: 600, an office printer's. At that, a module's edge stands
 * within a 600th of an inch, 0.042 mm, of where the symbol puts it, a
 * tenth of the smallest module a code may have; and a printer of as many
 * dots draws the picture without scaling it up.
 */
export const CODE_RESOLUTION = 600

/**
 * The most pixels a side a code's picture is: 2,400. A module is drawn
 * in no more whole pixels than that many hold of the symbol's modules
 * and their quiet zone: twelve for the largest symbol, 185 across, whose
 * picture is then 2,220 pixels a side, and 82 for the smallest, 2,378.
 * So a code is `CODE_RESOLUTION` to the inch up to a width that depends
 * on its version -- 266.4 points for the largest symbol, 287.8 for the
 * version that fares best -- and coarser past it, the largest symbol 269
 * to the inch at 595 points; an edge a reader smooths is smoothed over a
 * twelfth of a module at the most. `codes.test.ts` works these figures
 * out from `modulePixels`. Without it a picture grows with the square of
 * the code's side, and what deflating it costs with it: the largest
 * symbol at the largest size a page holds, 595 points, was 4,995 pixels
 * a side and 3,126,870 bytes of scanlines, which fflate deflated in
 * 46 ms, and 64 of them held the thread 6.1 to 7.5 seconds
 * (`limits.ts`).
 */
export const MAX_CODE_SIDE = 2400

/**
 * The pixels a module of `module` points takes in a picture `across`
 * modules wide: the least whole number at which the picture is
 * `CODE_RESOLUTION` pixels to the inch or more, and no more than
 * `MAX_CODE_SIDE` pixels a side allow. A hair is taken off before it is
 * rounded up, so that a module of exactly so many pixels is not given
 * one more by its last binary place: 3.24 points are 27 pixels, and
 * 27.000000000000004 as a double.
 */
export function modulePixels(module: number, across: number): number {
  return Math.max(1, Math.min(Math.ceil((module * CODE_RESOLUTION) / 72 - 1e-9), Math.floor(MAX_CODE_SIDE / across)))
}

/** The CRC-32 a PNG sums each chunk with (ISO 3309), by the table of its 256 remainders. */
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let remainder = index
  for (let bit = 0; bit < 8; bit++) remainder = remainder & 1 ? 0xedb88320 ^ (remainder >>> 1) : remainder >>> 1
  return remainder
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** A chunk as PNG frames one: its data's length, its type, its data, and the CRC of the last two. */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const framed = new Uint8Array(12 + data.length)
  const view = new DataView(framed.buffer)
  view.setUint32(0, data.length)
  for (let index = 0; index < 4; index++) framed[4 + index] = type.charCodeAt(index)
  framed.set(data, 8)
  view.setUint32(8 + data.length, crc32(framed.subarray(4, 8 + data.length)))
  return framed
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** PNG's filter for a scanline that is the one above it, byte for byte: what is left of such a line is nothing. */
export const UP = 2

/**
 * `symbol` as a PNG, `pixels` a module: its quiet zone of four modules
 * of white around it, a set bit a white pixel. The same symbol at the
 * same pixels is the same bytes.
 */
export function codePng(symbol: QrSymbol, pixels: number): Uint8Array {
  const across = symbol.modules.length + 2 * QR_QUIET_ZONE
  const side = across * pixels
  const stride = 1 + Math.ceil(side / 8)
  const lines = new Uint8Array(side * stride)
  for (let row = 0; row < across; row++) {
    const first = row * pixels * stride
    // The row's first scanline as it is, its filter none, and every other the one above it.
    for (let column = 0; column < across; column++) {
      if (symbol.modules[row - QR_QUIET_ZONE]?.[column - QR_QUIET_ZONE] === true) continue
      for (let x = column * pixels; x < (column + 1) * pixels; x++) lines[first + 1 + (x >> 3)]! |= 0x80 >> (x & 7)
    }
    for (let repeat = 1; repeat < pixels; repeat++) lines[first + repeat * stride] = UP
  }
  return pngOf(side, lines)
}

/**
 * A PNG of one bit of grey a pixel, `side` pixels a side, of `lines`:
 * its scanlines as PNG filters them, each a filter's byte and the bytes
 * of its pixels, a set bit a white one.
 */
export function pngOf(side: number, lines: Uint8Array): Uint8Array {
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, side)
  view.setUint32(4, side)
  // One bit a pixel of grey, deflated, filtered by line, not interlaced.
  header.set([1, 0, 0, 0, 0], 8)
  // fflate's own default level, stated: at a lower one the picture is larger for no time saved, and at the highest it took twice as long.
  const chunks = [chunk('IHDR', header), chunk('IDAT', zlibSync(lines, { level: 6 })), chunk('IEND', new Uint8Array(0))]
  const png = new Uint8Array(chunks.reduce((length, each) => length + each.length, SIGNATURE.length))
  png.set(SIGNATURE)
  chunks.reduce((at, each) => (png.set(each, at), at + each.length), SIGNATURE.length)
  return png
}
