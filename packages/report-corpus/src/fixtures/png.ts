import { crc32, deflateSync } from 'node:zlib'

/**
 * A truecolour PNG made in code, so the corpus carries no binary file whose
 * contents a reviewer cannot read: 8 bits per channel, no alpha, no
 * interlacing, every scanline unfiltered.
 */
export function encodePng(width: number, height: number, pixel: (x: number, y: number) => readonly [number, number, number]): Uint8Array {
  const stride = 1 + width * 3
  const scanlines = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      scanlines.set(pixel(x, y), y * stride + 1 + x * 3)
    }
  }
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  header.set([8, 2, 0, 0, 0], 8) // bit depth 8, colour type 2 (RGB), deflate, adaptive filtering, no interlace
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(deflateSync(scanlines))),
    chunk('IEND', new Uint8Array(0)),
  ])
}

/** Length, type, data, and the CRC of type and data. */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const typed = concat([new TextEncoder().encode(type), data])
  const framed = new Uint8Array(4 + typed.length + 4)
  const view = new DataView(framed.buffer)
  view.setUint32(0, data.length)
  framed.set(typed, 4)
  view.setUint32(4 + typed.length, crc32(typed))
  return framed
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    joined.set(part, offset)
    offset += part.length
  }
  return joined
}
