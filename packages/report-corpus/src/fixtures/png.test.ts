import { crc32, inflateSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { encodePng } from './png.js'

/** The chunks of a PNG, each with the CRC it carries. */
function chunks(png: Uint8Array): { type: string; data: Uint8Array; crc: number }[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const found: { type: string; data: Uint8Array; crc: number }[] = []
  for (let offset = 8; offset < png.length;) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8))
    found.push({ type, data: png.subarray(offset + 8, offset + 8 + length), crc: view.getUint32(offset + 8 + length) })
    offset += 12 + length
  }
  return found
}

describe('encodePng', () => {
  // The images fixture claims an engine draws a valid PNG; a PNG that was
  // subtly broken -- a wrong CRC, a scanline short -- would make an engine's
  // refusal look like a defect in the engine. Each chunk is checked against
  // zlib's own CRC, and the pixels against what was asked for.
  test('writes a signature, IHDR, IDAT and IEND, each with a correct CRC, and the pixels asked for', () => {
    const png = encodePng(3, 2, (x, y) => [x * 10, y * 20, 7])
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const found = chunks(png)
    expect(found.map((chunk) => chunk.type)).toEqual(['IHDR', 'IDAT', 'IEND'])
    for (const chunk of found) {
      const typed = new Uint8Array([...new TextEncoder().encode(chunk.type), ...chunk.data])
      expect(chunk.crc, chunk.type).toBe(crc32(typed))
    }
    const header = new DataView(found[0]!.data.buffer, found[0]!.data.byteOffset, 13)
    expect([header.getUint32(0), header.getUint32(4), header.getUint8(8), header.getUint8(9)]).toEqual([3, 2, 8, 2])
    // Each scanline is a filter byte (0, none) and three bytes per pixel.
    expect([...inflateSync(found[1]!.data)]).toEqual([0, 0, 0, 7, 10, 0, 7, 20, 0, 7, 0, 0, 20, 7, 10, 20, 7, 20, 20, 7])
  })
})
