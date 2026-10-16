import { inflateSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { rasterPage, rasterPixels } from './raster.js'
import { pdfmakePdf } from './testing/pdfmake.js'

/** A PNG's size and its pixels, as RGBA rows: enough of a decoder to read back what `rasterPage` drew. */
function decode(png: Uint8Array): { width: number; height: number; pixel: (x: number, y: number) => readonly number[] } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const [width, height] = [view.getUint32(16), view.getUint32(20)]
  const [depth, colour] = [png[24], png[25]]
  if (depth !== 8 || colour !== 6) throw new Error(`expected 8-bit RGBA, got depth ${depth} colour ${colour}`)
  const chunks: Uint8Array[] = []
  for (let offset = 8; offset < png.length; ) {
    const length = view.getUint32(offset)
    if (String.fromCharCode(...png.subarray(offset + 4, offset + 8)) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length))
    offset += 12 + length
  }
  const raw = inflateSync(Buffer.concat(chunks))
  const stride = width * 4
  const rows: Uint8Array[] = []
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    const line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    const above = rows[y - 1] ?? new Uint8Array(stride)
    for (let x = 0; x < stride; x++) {
      const [a, b, c] = [x >= 4 ? line[x - 4]! : 0, above[x]!, x >= 4 ? above[x - 4]! : 0]
      const p = a + b - c
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c
      line[x] = (line[x]! + [0, a, b, (a + b) >> 1, paeth][filter]!) & 0xff
    }
    rows.push(line)
  }
  return { width, height, pixel: (x, y) => [...rows[y]!.subarray(x * 4, x * 4 + 4)] }
}

describe('rasterPage', () => {
  // A picture of the wrong size, or of nothing, would pass a check that
  // only asked for a PNG: the page is drawn at the scale asked, on white,
  // and what is on it is where the PDF puts it.
  test('draws a page at its scale, on white, with what is on it where it is', async () => {
    const pdf = await pdfmakePdf({ pageSize: 'A4', content: [{ canvas: [{ type: 'rect', x: 0, y: 0, w: 100, h: 50, color: '#000000' }], absolutePosition: { x: 100, y: 100 } }] })
    const { width, height, pixel } = decode(await rasterPage(pdf, 1, 2))
    expect([width, height]).toEqual([Math.ceil(595.28 * 2), Math.ceil(841.89 * 2)])
    expect(pixel(20, 20)).toEqual([255, 255, 255, 255])
    expect(pixel(2 * 150, 2 * 125)).toEqual([0, 0, 0, 255])
    expect(pixel(2 * 210, 2 * 125)).toEqual([255, 255, 255, 255])
  })

  // A page that is not there is the caller's mistake, never a blank picture.
  test.each([0, 2, 1.5])('refuses page %s of a one-page PDF', async (page) => {
    const pdf = await pdfmakePdf({ content: ['One page'] })
    await expect(rasterPage(pdf, page, 1)).rejects.toThrow(RangeError)
  })
})

describe('rasterPixels', () => {
  // A reader of codes handed pixels of another drawing than the page's, at
  // another scale or in another layout than RGBA rows, would read something
  // else or nothing: the pixels are rasterPage's page, each one of them.
  test('gives the page rasterPage draws, pixel for pixel, as RGBA rows at its scale', async () => {
    const pdf = await pdfmakePdf({ pageSize: 'A4', content: [{ canvas: [{ type: 'rect', x: 0, y: 0, w: 100, h: 50, color: '#000000' }], absolutePosition: { x: 100, y: 100 } }] })
    const { data, width, height } = await rasterPixels(pdf, 1, 2)
    expect([width, height]).toEqual([Math.ceil(595.28 * 2), Math.ceil(841.89 * 2)])
    expect(data).toBeInstanceOf(Uint8ClampedArray)
    expect(data.length).toBe(width * height * 4)
    const png = decode(await rasterPage(pdf, 1, 2))
    const differing = Array.from({ length: height }, (_, y) => y).find((y) => Array.from({ length: width }, (_, x) => x).some((x) => png.pixel(x, y).some((channel, at) => channel !== data[(y * width + x) * 4 + at])))
    expect(differing).toBeUndefined()
    expect([...data.subarray((250 * width + 300) * 4, (250 * width + 300) * 4 + 4)]).toEqual([0, 0, 0, 255])
  })

  // As rasterPage: a page that is not there is the caller's mistake.
  test.each([0, 2, 1.5])('refuses page %s of a one-page PDF', async (page) => {
    const pdf = await pdfmakePdf({ content: ['One page'] })
    await expect(rasterPixels(pdf, page, 1)).rejects.toThrow(RangeError)
  })
})
