import { readPdfObjects } from '@formancy/report-corpus'
import type { ImageAsset } from '@formancy/report-runtime'
import { asset, encodePng } from './images.js'

/**
 * Images PDFKit decodes before it embeds them, and the order a PDF numbers
 * and writes them in, for the renderer's order (0035) and for PDFKit's
 * own, which it works around. A PNG with an alpha channel, interlacing or
 * a palette's transparency is decoded by an inflate that calls back when
 * it is done (pdfkit.js 3926-3931), and PDFKit numbers its soft mask and
 * writes it from that callback (3935-3996): in the order the decodes
 * finish, where a small image's finishes before a large one's.
 */

/**
 * Pixels a side of each image: the large ones each their own, so that a
 * PDF's images are told apart by their widths, and the small one's 16,
 * whose decode finishes before every large one's in either build's
 * inflate.
 */
export const SIDE = { alpha: 256, interlaced: 240, paletted: 224, small: 16 } as const

/** Four colours, and an alpha for each: the paletted image's PLTE and tRNS. */
const PALETTE = new Uint8Array([200, 30, 30, 30, 160, 60, 40, 60, 200, 240, 200, 40])
const PALETTE_ALPHA = new Uint8Array([255, 192, 64, 0])

/** One large image each way PDFKit decodes before it embeds, and a small one with an alpha channel. */
export const DECODED = {
  alpha: asset(
    encodePng(SIDE.alpha, SIDE.alpha, (x, y) => [x, y, 128, (x + y) & 255], { colour: 6 }),
    'image/png',
    'large-alpha',
  ),
  interlaced: asset(
    encodePng(SIDE.interlaced, SIDE.interlaced, (x, y) => [y, x, 64], { interlace: true }),
    'image/png',
    'large-interlaced',
  ),
  paletted: asset(
    encodePng(SIDE.paletted, SIDE.paletted, (x, y) => [(x + y) % 4], {
      colour: 3,
      chunks: [
        ['PLTE', PALETTE],
        ['tRNS', PALETTE_ALPHA],
      ],
    }),
    'image/png',
    'large-paletted',
  ),
  small: asset(
    encodePng(SIDE.small, SIDE.small, (x, y) => [x * 16, y * 16, 64, 255 - x * 8], { colour: 6 }),
    'image/png',
    'small-alpha',
  ),
} as const satisfies Readonly<Record<string, ImageAsset>>

/** `of` as an entry of a pdfmake definition's `images`: a data URL. */
export const dataUrl = (of: ImageAsset): string => `data:${of.mediaType};base64,${Buffer.from(of.bytes).toString('base64')}`

export interface ImageOrder {
  /** The widths of the images the pages draw -- every image object no other names as its soft mask -- in the order of their numbers. */
  readonly widths: readonly number[]
  /** The soft masks they name, in the order of the images that name them. */
  readonly masks: readonly number[]
  /** Where each drawn image, and each mask, is written in the file, in the same orders. */
  readonly drawnAt: readonly number[]
  readonly masksAt: readonly number[]
}

/** The order `bytes`, a PDF, numbers and writes its images and their soft masks in: read by pdf-lib (`readPdfObjects`) and the file's cross-reference table. */
export async function imageOrder(bytes: Uint8Array): Promise<ImageOrder> {
  const { images } = await readPdfObjects(bytes)
  const named = new Set(images.flatMap(({ softMask }) => (softMask === undefined ? [] : [softMask])))
  const drawn = images.filter(({ object }) => !named.has(object))
  const masks = drawn.flatMap(({ softMask }) => (softMask === undefined ? [] : [softMask]))
  const at = writtenAt(bytes)
  const offset = (object: number): number => {
    const found = at.get(object)
    // An offset left out would compare as equal to any other, and pass for an order.
    if (found === undefined) throw new Error(`object ${String(object)} has no offset in the cross-reference table`)
    return found
  }
  return { widths: drawn.map(({ width }) => width), masks, drawnAt: drawn.map(({ object }) => offset(object)), masksAt: masks.map(offset) }
}

/**
 * Where each object is written, by number: the offsets of the one
 * cross-reference table PDFKit writes, at `startxref` (pdfkit.js
 * 6309-6331), each held to the object it points at, so that a table read
 * wrong throws rather than passing for an order.
 */
export function writtenAt(bytes: Uint8Array): ReadonlyMap<number, number> {
  const text = Buffer.from(bytes).toString('latin1')
  const start = /startxref\n(\d+)\n%%EOF\n$/.exec(text)
  if (start === null) throw new Error('the PDF does not end in startxref')
  const lines = text.slice(Number(start[1])).split('\n')
  const count = /^0 (\d+)$/.exec(lines[1] ?? '')
  if (lines[0] !== 'xref' || count === null) throw new Error('startxref points at no cross-reference table')
  const offsets = new Map<number, number>()
  for (let object = 1; object < Number(count[1]); object++) {
    const entry = /^(\d{10}) 00000 n $/.exec(lines[2 + object] ?? '')
    if (entry === null) throw new Error(`the cross-reference table has no offset for object ${String(object)}`)
    const offset = Number(entry[1])
    if (!text.startsWith(`${String(object)} 0 obj\n`, offset)) throw new Error(`object ${String(object)} is not where the cross-reference table says`)
    offsets.set(object, offset)
  }
  return offsets
}
