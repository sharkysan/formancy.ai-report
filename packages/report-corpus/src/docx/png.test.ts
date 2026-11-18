import { deflateSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { encodePng, pngOf } from '../fixtures/png.js'
import { readPng } from './png.js'

/**
 * The corpus's reader of a code's picture (0074): what it reads, on PNGs
 * made here with Node's zlib, and what it refuses, each a file that is not
 * the one kind of picture a code is written as. A reader that passed any
 * PNG could be shown a picture's bytes it never looked at.
 */

/** A header of `width` by `height` pixels: one bit of grey each, deflated, filtered by line, not interlaced, unless `more` says otherwise. */
function header(width: number, height: number, more: readonly number[] = [1, 0, 0, 0, 0]): Uint8Array {
  const bytes = new Uint8Array(13)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  bytes.set(more, 8)
  return bytes
}

/** A PNG of `lines`, each a filter byte and the bytes of a scanline of `width` pixels. */
function png(width: number, lines: readonly (readonly number[])[], chunks: (data: Uint8Array) => readonly (readonly [string, Uint8Array])[] = one): Uint8Array {
  return pngOf([['IHDR', header(width, lines.length)], ...chunks(new Uint8Array(deflateSync(Uint8Array.from(lines.flat())))), ['IEND', new Uint8Array(0)]])
}
const one = (data: Uint8Array): readonly (readonly [string, Uint8Array])[] => [['IDAT', data]]

/** The pixels as rows of 1 for white and 0 for black. */
const rows = (read: { readonly width: number; readonly height: number; readonly data: Uint8Array }): number[][] =>
  Array.from({ length: read.height }, (_, y) => Array.from(read.data.subarray(y * read.width, (y + 1) * read.width), (value) => value / 255))

describe('readPng', () => {
  // A pixel is a bit, the highest of its byte first, and the bits past a line's last pixel are no pixels: read otherwise, a symbol is mirrored
  // in every byte, or a column wider than it is.
  test('reads each bit as a pixel, the highest of a byte first, and none past the width', () => {
    expect(rows(readPng(png(10, [[0, 0b10100000, 0b01111111]])))).toEqual([[1, 0, 1, 0, 0, 0, 0, 0, 0, 1]])
  })

  // The writer writes a repeated scanline as nothing but its filter, and another writer would choose another: the reading rests on none.
  // Each line below is 0b11001010 0b00110101 once its filter is undone.
  test('undoes every filter PNG defines', () => {
    const [first, second] = [0b11001010, 0b00110101]
    const lines = [
      [0, first, second],
      // Sub: each byte less the one to its left.
      [1, first, (second - first) & 0xff],
      // Up: each byte less the one above.
      [2, 0, 0],
      // Average: each byte less the mean of the one to its left and the one above, rounded down.
      [3, (first - (first >> 1)) & 0xff, (second - ((first + second) >> 1)) & 0xff],
      // Paeth, under a line like it: each byte less the one above, which is what it predicts there.
      [4, 0, 0],
    ]
    const read = rows(readPng(png(16, lines)))
    for (const line of read) expect(line).toEqual(read[0])
    expect(read[0]).toEqual([1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1])
  })

  // Paeth predicts a byte by whichever of the one to its left, the one above and the one above left is nearest to left + above - above
  // left: under 0x18 0x20, a line of 0x10 0x55 is predicted from above and then from above left; under 0xAA 0xAA, a line of 0x0F 0xF0
  // from above and then from the left. A reader that took the byte above every time would read the second byte of each wrongly.
  test('undoes Paeth by the nearest of the three bytes it predicts from', () => {
    const lines = [
      [0, 0x18, 0x20],
      [4, (0x10 - 0x18) & 0xff, 0x55 - 0x18],
      [0, 0xaa, 0xaa],
      [4, (0x0f - 0xaa) & 0xff, 0xf0 - 0x0f],
    ]
    const bytes = rows(readPng(png(16, lines))).map((line) => [Number.parseInt(line.slice(0, 8).join(''), 2), Number.parseInt(line.slice(8).join(''), 2)])
    expect(bytes).toEqual([
      [0x18, 0x20],
      [0x10, 0x55],
      [0xaa, 0xaa],
      [0x0f, 0xf0],
    ])
  })

  // PNG lets a picture's data stand in several chunks, which are one stream: read chunk by chunk, the second is no stream at all.
  test('reads image data that stands in two chunks as the one stream it is', () => {
    const halved = (data: Uint8Array): readonly (readonly [string, Uint8Array])[] => [
      ['IDAT', data.subarray(0, 5)],
      ['IDAT', data.subarray(5)],
    ]
    expect(rows(readPng(png(8, [[0, 0b11110000]], halved)))).toEqual([[1, 1, 1, 1, 0, 0, 0, 0]])
  })

  // Each a file that is no picture of a code as the writer makes one: passed, a check would hold a code to pixels it misread.
  test.each<[string, () => Uint8Array, RegExp]>([
    ['is no PNG', () => new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'), /does not open with its signature/],
    // Its last twelve bytes are its end's chunk and the four before them its image data's CRC: cut two bytes into that.
    ['ends inside a chunk', () => png(8, [[0, 0xff]]).subarray(0, -14), /the PNG ends inside a chunk/],
    // The signature is eight bytes and the header's chunk twenty-five: cut two bytes into the length of the image data's.
    ['ends inside a chunk’s length', () => png(8, [[0, 0xff]]).subarray(0, 35), /the PNG ends inside a chunk/],
    [
      'has a chunk that does not sum',
      () => {
        const bytes = png(8, [[0, 0xff]])
        bytes[20] = bytes[20]! ^ 1
        return bytes
      },
      /the PNG's IHDR chunk does not sum to its CRC/,
    ],
    ['holds a chunk of text', () => png(8, [[0, 0xff]], (data) => [['tEXt', new Uint8Array(4)], ...one(data)]), /holds the chunks IHDR, tEXt, IDAT, IEND/],
    [
      'holds no image data',
      () =>
        pngOf([
          ['IHDR', header(8, 1)],
          ['IEND', new Uint8Array(0)],
        ]),
      /holds the chunks IHDR, IEND/,
    ],
    [
      'does not end',
      () =>
        pngOf([
          ['IHDR', header(8, 1)],
          ['IDAT', new Uint8Array(deflateSync(Uint8Array.from([0, 0xff])))],
        ]),
      /holds the chunks IHDR, IDAT/,
    ],
    [
      'has a header of another length',
      () =>
        pngOf([
          ['IHDR', new Uint8Array(12)],
          ['IDAT', new Uint8Array(1)],
          ['IEND', new Uint8Array(0)],
        ]),
      /a header of another length/,
    ],
    ['is in colour', () => encodePng(2, 2, () => [0, 0, 0]), /not one bit of grey a pixel, deflated and not interlaced: its header states 8, 2, 0, 0, 0/],
    [
      'is interlaced',
      () =>
        pngOf([
          ['IHDR', header(8, 1, [1, 0, 0, 0, 1])],
          ['IDAT', new Uint8Array(deflateSync(Uint8Array.from([0, 0xff])))],
          ['IEND', new Uint8Array(0)],
        ]),
      /not one bit of grey a pixel, deflated and not interlaced/,
    ],
    [
      'has no pixels',
      () =>
        pngOf([
          ['IHDR', header(0, 1)],
          ['IDAT', new Uint8Array(deflateSync(new Uint8Array(1)))],
          ['IEND', new Uint8Array(0)],
        ]),
      /has no pixels/,
    ],
    [
      'holds a line more than its header promises',
      () =>
        pngOf([
          ['IHDR', header(8, 1)],
          ['IDAT', new Uint8Array(deflateSync(new Uint8Array(4)))],
          ['IEND', new Uint8Array(0)],
        ]),
      /image data of 4 bytes where its header promises 2/,
    ],
    ['has a filter PNG does not define', () => png(8, [[5, 0xff]]), /an unknown filter type \(5\)/],
  ])('refuses a file that %s', (_name, bytes, why) => {
    expect(() => readPng(bytes())).toThrow(why)
  })

  // Image data that is no zlib stream is zlib's own error, never pixels.
  test('refuses image data that does not inflate', () => {
    expect(() =>
      readPng(
        pngOf([
          ['IHDR', header(8, 1)],
          ['IDAT', Uint8Array.from([1, 2, 3, 4])],
          ['IEND', new Uint8Array(0)],
        ]),
      ),
    ).toThrow()
  })
})
