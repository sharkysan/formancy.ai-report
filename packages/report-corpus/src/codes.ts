import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import type { PdfBox } from './read-pdf.js'
import { rasterPixels, type PagePixels } from './raster.js'

/**
 * The QR codes a page prints, read as a scanner reads them: the page drawn
 * by PDF.js (`rasterPixels`) and decoded by ZXing-C++ 's WebAssembly build,
 * zxing-wasm. A claim about a code is a claim about the PDF (0003): what it
 * decodes to, at which error correction level and version, and where it
 * stands, and nothing about how the engine was asked to draw it.
 *
 * zxing-wasm finds its WebAssembly at an address on a CDN unless it is
 * given the bytes. They are read here from the package's own file, once,
 * and nothing reaches the network.
 */

export interface PdfCode extends PdfBox {
  /** What a scanner shows: the bytes as text, in the character set ZXing reads them in. */
  readonly text: string
  /** The bytes the symbol encodes, exactly. */
  readonly bytes: Uint8Array
  readonly ecLevel: 'L' | 'M' | 'Q' | 'H'
  readonly version: number
}

/**
 * Four pixels to the point: the smallest module the renderer draws, 0.4 mm
 * or 1.13 pt, is 4.5 pixels across. A whole A4 page at that scale is 2382 by
 * 3368 pixels, all of it drawn and decoded for every read.
 */
const SCALE = 4

let wasmBinary: ArrayBuffer | undefined

/** A code as ZXing finds it in a picture's pixels: what it says, and where its symbol stands, in pixels from the top left, without the quiet zone. */
export type PixelCode = PdfCode

/**
 * Every QR code `pixels` show, as ZXing reads them, each placed in the
 * pixels' own unit: a page PDF.js drew (`readCodes`), or the picture a
 * Word file embeds for a code (`code-picture.ts`, 0074).
 */
export async function codesIn(pixels: PagePixels): Promise<PixelCode[]> {
  wasmBinary ??= new Uint8Array(readFileSync(createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm'))).buffer
  // The same bytes every call, so zxing-wasm keeps the module it made of them.
  await prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true })
  // Read as an ImageData by its data, width and height alone, which is all a page's pixels have here: Node has no ImageData.
  const results = await readBarcodes(pixels as ImageData, { formats: ['QRCode'], maxNumberOfSymbols: 255 })
  return results.map((result): PixelCode => {
    const { topLeft, topRight, bottomLeft, bottomRight } = result.position
    const xs = [topLeft.x, topRight.x, bottomLeft.x, bottomRight.x]
    const ys = [topLeft.y, topRight.y, bottomLeft.y, bottomRight.y]
    const [x, top, right, bottom] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    const { ecLevel, version } = symbolOf(result.extra)
    return { text: result.text, bytes: result.bytes, ecLevel, version, x, top, width: right - x, height: bottom - top, bottom }
  })
}

/**
 * Every QR code on page `pageNumber`, from 1, in reading order: by their
 * tops to the nearest point, then from the left. ZXing places a code by its
 * finder patterns, and two codes side by side at one top can come back a
 * fraction of a point apart. Positions are in points, without the quiet zone.
 */
export async function readCodes(bytes: Uint8Array, pageNumber: number, scale = SCALE): Promise<PdfCode[]> {
  const found = await codesIn(await rasterPixels(bytes, pageNumber, scale))
  return found
    .map((code): PdfCode => ({
      ...code,
      x: code.x / scale,
      top: code.top / scale,
      width: code.width / scale,
      height: code.height / scale,
      bottom: code.bottom / scale,
    }))
    .sort((a, b) => Math.round(a.top) - Math.round(b.top) || a.x - b.x)
}

/** The level and version ZXing read, from the details it gives as JSON; a result without them is a reader this one does not know. */
export function symbolOf(extra: string): Pick<PdfCode, 'ecLevel' | 'version'> {
  const { ECLevel, Version } = JSON.parse(extra) as { ECLevel?: unknown; Version?: unknown }
  if ((ECLevel !== 'L' && ECLevel !== 'M' && ECLevel !== 'Q' && ECLevel !== 'H') || !/^\d+$/.test(String(Version)))
    throw new Error(`ZXing read a QR code without a level and a version: ${extra}`)
  return { ecLevel: ECLevel, version: Number(Version) }
}
