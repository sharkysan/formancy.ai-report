import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { readCodes, symbolOf } from './codes.js'
import { pdfmakePdf } from './testing/pdfmake.js'

/**
 * The QR codes a page of a PDF prints, read back as a scanner reads them:
 * the page drawn by PDF.js and decoded by ZXing. The codes here are
 * pdfmake's own `qr` nodes, which draw a symbol with no quiet zone at
 * exactly where they are put: a reader that is right about them is right
 * about the page, not about one engine's way of drawing a code.
 */

// The decoder's own way to its WebAssembly is an address on a CDN. A test
// support module that fetched it would make every run depend on the
// network, and send a request no review had read. Every fetch in this file
// fails, and none is made.
const fetched = vi.fn(() => {
  throw new Error('readCodes reached for the network')
})
beforeAll(() => {
  vi.stubGlobal('fetch', fetched)
})
afterAll(() => {
  vi.unstubAllGlobals()
})

describe('readCodes', () => {
  // A reader that found one code of two, or told one's level or version for
  // the other's, or put a code anywhere but where it stands, would prove a
  // renderer right about a page it got wrong.
  test('reads every code on the page: its text, its bytes, its level and version, and where it stands in points', async () => {
    const pdf = await pdfmakePdf({
      pageSize: 'A4',
      content: [
        { qr: 'third', fit: 80, eccLevel: 'H', absolutePosition: { x: 300, y: 400 } },
        { qr: 'second', fit: 80, eccLevel: 'H', absolutePosition: { x: 100, y: 400 } },
        { qr: 'HELLO corpus', fit: 100, eccLevel: 'Q', absolutePosition: { x: 100, y: 100 } },
      ],
    })
    const codes = await readCodes(pdf, 1)
    // In reading order, whatever order they were drawn in. pdfmake draws
    // whole points a module, so a version 1 code fitted to 80 pt is 21
    // modules of 3 pt, 63 pt, and a version 2 one fitted to 100 pt is 25 of 4.
    expect(codes).toEqual([
      {
        text: 'HELLO corpus',
        bytes: new TextEncoder().encode('HELLO corpus'),
        ecLevel: 'Q',
        version: 2,
        x: expect.closeTo(100, 0),
        top: expect.closeTo(100, 0),
        width: expect.closeTo(100, 0),
        height: expect.closeTo(100, 0),
        bottom: expect.closeTo(200, 0),
      },
      {
        text: 'second',
        bytes: new TextEncoder().encode('second'),
        ecLevel: 'H',
        version: 1,
        x: expect.closeTo(100, 0),
        top: expect.closeTo(400, 0),
        width: expect.closeTo(63, 0),
        height: expect.closeTo(63, 0),
        bottom: expect.closeTo(463, 0),
      },
      {
        text: 'third',
        bytes: new TextEncoder().encode('third'),
        ecLevel: 'H',
        version: 1,
        x: expect.closeTo(300, 0),
        top: expect.closeTo(400, 0),
        width: expect.closeTo(63, 0),
        height: expect.closeTo(63, 0),
        bottom: expect.closeTo(463, 0),
      },
    ])
  })

  // Two codes side by side stand on one line of the page. ZXing places each
  // by its finder patterns, and where the top falls between pixels it puts
  // a version 1 and a version 4 code drawn at one top a quarter of a point
  // apart: 300.75 and 300.5 for 300.4, on 17 October 2026. Ordered by that,
  // the code on the right would read first. Tops are compared to the
  // nearest point.
  test('reads codes side by side at one top from the left, whatever their versions', async () => {
    const long = 'x'.repeat(50)
    const pdf = await pdfmakePdf({
      pageSize: 'A4',
      content: [
        { qr: long, fit: 80, eccLevel: 'M', absolutePosition: { x: 320, y: 300.4 } },
        { qr: 'A1', fit: 80, eccLevel: 'M', absolutePosition: { x: 60, y: 300.4 } },
      ],
    })
    const codes = await readCodes(pdf, 1)
    expect(codes.map(({ text, version }) => ({ text, version }))).toEqual([
      { text: 'A1', version: 1 },
      { text: long, version: 4 },
    ])
    // The tops ZXing gives do differ, and the wrong way: this is the case the rounding is for.
    expect(codes[0]!.top).toBeGreaterThan(codes[1]!.top)
  })

  // ZXing gives a code's level and version in a JSON string of details,
  // and deprecates the fields it gave them in before. A ZXing that gave
  // them otherwise would read every code as level undefined, version NaN,
  // and a test comparing text alone would not notice.
  test('fails loudly on details without a level or a version', () => {
    expect(symbolOf('{"DataMask":0,"Version":"2","ECLevel":"Q"}')).toEqual({ ecLevel: 'Q', version: 2 })
    expect(() => symbolOf('{"Version":"2"}')).toThrow('without a level and a version')
    expect(() => symbolOf('{"Version":"2","ECLevel":"25%"}')).toThrow('without a level and a version')
    expect(() => symbolOf('{"ECLevel":"M"}')).toThrow('without a level and a version')
  })

  // A page with no code reads as none, never as an error a test would have
  // to tell from a code it could not read.
  test('reads no code on a page that prints none', async () => {
    expect(await readCodes(await pdfmakePdf({ content: ['No code here'] }), 1)).toEqual([])
  })

  // A page that is not there is the caller's mistake, never a page with no code on it.
  test('refuses a page the PDF does not have', async () => {
    await expect(readCodes(await pdfmakePdf({ content: ['One page'] }), 2)).rejects.toThrow(RangeError)
  })

  // The decoder's WebAssembly is the package's own file, read from disk:
  // zxing-wasm's default would fetch it from a CDN.
  test('decodes with the WebAssembly in its package, and reaches for no address', async () => {
    const pdf = await pdfmakePdf({ content: [{ qr: 'offline', fit: 60 }] })
    expect((await readCodes(pdf, 1)).map((code) => code.text)).toEqual(['offline'])
    expect(fetched).not.toHaveBeenCalled()
  })
})
