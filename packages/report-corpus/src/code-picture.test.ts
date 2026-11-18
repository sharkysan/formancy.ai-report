import { qrSymbol, type QrCode, type QrSymbol } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { codeGrid, readPictureCode } from './code-picture.js'
import { readPng, type GreyPixels } from './docx/png.js'
import { codePng } from './docx/testing/hand-codes.js'

/**
 * A code's picture held on its own pixels (0074): `codeGrid`, what makes
 * a picture a symbol drawn in whole pixels a module, on pictures made
 * here and with one thing wrong; and `readPictureCode`, what ZXing reads
 * in one. Neither asks an encoder what it meant to draw.
 */

const code = (text: string, errorCorrection: QrCode['errorCorrection'] = 'M'): QrCode => ({ kind: 'qrCode', id: 'code', text, size: 1000, errorCorrection })
const SYMBOL = qrSymbol(code('INV-2026-0042', 'Q'), 1000)
const pixelsOf = (symbol: QrSymbol, pixels: number, quiet = 4, spoil?: (x: number, y: number, dark: boolean) => boolean): GreyPixels =>
  readPng(codePng(symbol, pixels, quiet, spoil))

describe('codeGrid', () => {
  // The grid is found from the pixels: how many a module takes, and how many modules the symbol is, which is its version.
  test.each([
    ['one pixel a module', 1],
    ['nine', 9],
    ['a hundred and forty', 140],
  ])('finds a symbol drawn at %s', (_name, pixels) => {
    expect(codeGrid(pixelsOf(SYMBOL, pixels))).toEqual({ pixels, modules: 21, version: 1 })
  })

  test('finds the largest symbol, 177 modules a side', () => {
    expect(codeGrid(pixelsOf(qrSymbol(code('x'.repeat(1273), 'H'), 1000), 3))).toEqual({ pixels: 3, modules: 177, version: 40 })
  })

  // Each a picture Word would print as a code that scans badly or not at all: smoothed, cut, or with too little white around it.
  test.each<[string, () => GreyPixels, RegExp]>([
    ['is not square', () => ({ width: 4, height: 2, data: new Uint8Array(8) }), /is 4 by 2 pixels, and a code's is square/],
    ['is all white', () => pixelsOf({ modules: [] }, 3, 10), /is all white/],
    [
      'has a module a pixel short',
      () => pixelsOf(SYMBOL, 10, 4, (x, y, dark) => dark && !(y === 40 && x === 109)),
      /first dark run is 69 pixels, which is no seven modules of whole pixels/,
    ],
    ['has three modules of quiet zone', () => pixelsOf(SYMBOL, 10, 3), /starts 30 pixels in and 30 down, where four modules of 10 pixels are 40/],
    [
      'has its symbol a module lower than four',
      () => pixelsOf(SYMBOL, 10, 4, (x, y) => SYMBOL.modules[Math.floor(y / 10) - 5]?.[Math.floor(x / 10) - 4] === true),
      /starts 40 pixels in and 50 down/,
    ],
    [
      'is no version’s side',
      () => {
        const wide = pixelsOf(SYMBOL, 10)
        // Ten pixels more of white on every side: 31 modules across, and the symbol five in.
        const side = wide.width + 20
        const data = new Uint8Array(side * side).fill(255)
        for (let y = 0; y < wide.height; y++) data.set(wide.data.subarray(y * wide.width, (y + 1) * wide.width), (y + 10) * side + 10)
        return { width: side, height: side, data }
      },
      /starts 50 pixels in and 50 down/,
    ],
    [
      'is cut on the right',
      () => {
        const whole = pixelsOf(SYMBOL, 10)
        // Square still, twenty pixels fewer each way: 27 modules, which no version with its quiet zone is.
        const side = whole.width - 20
        const data = new Uint8Array(side * side)
        for (let y = 0; y < side; y++) data.set(whole.data.subarray(y * whole.width, y * whole.width + side), y * side)
        return { width: side, height: side, data }
      },
      /is 27 modules of 10 pixels across, which is no version's symbol with its quiet zone/,
    ],
    [
      'has a pixel of another colour than its module',
      () => pixelsOf(SYMBOL, 10, 4, (x, y, dark) => (x === 125 && y === 133 ? !dark : dark)),
      /the pixel 125, 133 is not the colour of the module it stands in/,
    ],
    [
      'is dark in its quiet zone',
      () => pixelsOf(SYMBOL, 10, 4, (x, y, dark) => dark || (x >= 280 && x < 290 && y >= 100 && y < 110)),
      /the pixel 280, 100 is dark inside the quiet zone/,
    ],
  ])('refuses a picture that %s', (_name, picture, why) => {
    expect(() => codeGrid(picture())).toThrow(why)
  })
})

describe('readPictureCode', () => {
  // What the picture says is ZXing's reading of its pixels: the text and its very bytes, the level, the version, and the symbol four modules in.
  test('reads the code a picture shows, and where its symbol stands in it', async () => {
    const text = 'Grüezi Zürich: CHF 12.50 oder 9,99 € 🧾'
    const read = await readPictureCode(pixelsOf(qrSymbol(code(text, 'H'), 1000), 8))
    expect(read).toMatchObject({ text, bytes: new TextEncoder().encode(text), ecLevel: 'H' })
    const modules = 17 + 4 * read!.version
    expect(read!.x).toBeCloseTo(32, 0)
    expect(read!.top).toBeCloseTo(32, 0)
    expect(read!.width).toBeCloseTo(modules * 8, 0)
  })

  // A symbol of no data is what an empty code is drawn as, and no code to a scanner.
  test('reads none in a symbol of no data', async () => {
    expect(await readPictureCode(pixelsOf(qrSymbol(code(''), 1000), 8))).toBeUndefined()
  })

  // One picture is one code: two in one would be a second code no document states.
  test('refuses a picture that shows two codes', async () => {
    const one = pixelsOf(SYMBOL, 6)
    const data = new Uint8Array(one.width * 2 * one.height)
    for (let y = 0; y < one.height; y++) {
      const row = one.data.subarray(y * one.width, (y + 1) * one.width)
      data.set(row, y * one.width * 2)
      data.set(row, y * one.width * 2 + one.width)
    }
    await expect(readPictureCode({ width: one.width * 2, height: one.height, data })).rejects.toThrow('the picture holds 2 codes')
  })
})
