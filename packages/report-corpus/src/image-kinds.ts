import { deflateSync } from 'node:zlib'
import type { ImageAsset } from './document.js'
import { pngOf } from './fixtures/png.js'

/** Pixels a side of every PNG: 16, so that each of Adam7's seven passes holds pixels. */
const SIDE = 16

/** A palette of four colours, three bytes each. */
const PALETTE = new Uint8Array([200, 30, 30, 30, 160, 60, 40, 60, 200, 240, 200, 40])

/** Adam7's seven passes: the first column and row of each, and the steps between them. */
const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const

/**
 * An image of each kind PDFKit 0.19.1 embeds in a way of its own, made in
 * code from its parts, so that the corpus carries no binary file whose
 * contents a reviewer cannot read. PDFKit copies a PNG's data in the colour
 * space its colour type names -- DeviceGray or DeviceRGB, or Indexed over
 * its palette -- at its own bit depth behind a predictor, with a colour-key
 * /Mask from its tRNS chunk, or with a soft mask it splits from an alpha
 * channel or a palette's transparency, and decodes an interlaced one first
 * (pdfkit.js 3867-3999); it copies a JPEG whole, as DCTDecode, in the colour
 * space its component count names (pdfkit.js 3807-3865). Each kind below is
 * one of those ways, and its id says which. A JPEG of four components, which
 * PDFKit draws in DeviceCMYK, is not among them: an e-invoice refuses one
 * (0031).
 *
 * The e-invoice gate draws every one into an e-invoice, beside the sample's
 * page, for veraPDF and Mustang to judge, as a logo would stand in a
 * customer's template (0031); `image-kinds.test.ts` holds each to the way
 * PDFKit embeds it.
 */
export const IMAGE_KINDS: readonly ImageAsset[] = [
  png('png-rgb', { colour: 2, depth: 8 }, (x, y) => [x * 16, y * 16, 128]),
  png('png-rgba', { colour: 6, depth: 8 }, (x, y) => [x * 16, y * 16, 128, 255 - x * 8]),
  png('png-grey', { colour: 0, depth: 8 }, (x) => [x * 16]),
  png('png-grey-alpha', { colour: 4, depth: 8 }, (x, y) => [x * 16, 255 - y * 8]),
  png('png-grey-16', { colour: 0, depth: 16 }, (x, y) => [x * 4096 + y]),
  png('png-bilevel', { colour: 0, depth: 1 }, (x, y) => [(x + y) % 2]),
  // tRNS for a grey or an RGB image is the one colour drawn transparent, two bytes a sample: here grey 128, and RGB 0, 0, 128.
  png('png-grey-keyed', { colour: 0, depth: 8, chunks: [['tRNS', new Uint8Array([0, 128])]] }, (x) => [x * 16]),
  png('png-rgb-keyed', { colour: 2, depth: 8, chunks: [['tRNS', new Uint8Array([0, 0, 0, 0, 0, 128])]] }, (x, y) => [x * 16, y * 16, 128]),
  png('png-paletted', { colour: 3, depth: 8, chunks: [['PLTE', PALETTE]] }, (x, y) => [(x + y) % 4]),
  // tRNS for a paletted image is an alpha for each entry of its palette.
  png(
    'png-paletted-transparent',
    {
      colour: 3,
      depth: 8,
      chunks: [
        ['PLTE', PALETTE],
        ['tRNS', new Uint8Array([255, 192, 64, 0])],
      ],
    },
    (x, y) => [(x + y) % 4],
  ),
  png('png-interlaced', { colour: 2, depth: 8, interlace: true }, (x, y) => [x * 16, y * 16, 128]),
  jpeg('jpeg-grey', 1),
  jpeg('jpeg-colour', 3),
]

interface PngKind {
  /** PNG's colour type: 0 grey, 2 RGB, 3 paletted, 4 grey and alpha, 6 RGB and alpha. */
  readonly colour: 0 | 2 | 3 | 4 | 6
  readonly depth: 1 | 8 | 16
  readonly interlace?: boolean
  /** Chunks between the header and the image data: a palette, a transparency. */
  readonly chunks?: readonly (readonly [type: string, data: Uint8Array])[]
}

/**
 * A PNG of `SIDE` by `SIDE` pixels, each the samples `pixel` gives it, one
 * a channel, of `depth` bits; every scanline unfiltered, and in Adam7's
 * passes where it is interlaced.
 */
function png(id: string, { colour, depth, interlace = false, chunks = [] }: PngKind, pixel: (x: number, y: number) => readonly number[]): ImageAsset {
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, SIDE)
  view.setUint32(4, SIDE)
  header.set([depth, colour, 0, 0, interlace ? 1 : 0], 8)
  const scanlines: number[] = []
  for (const [left, top, across, down] of interlace ? ADAM7 : [[0, 0, 1, 1] as const]) {
    for (let y = top; y < SIDE; y += down) {
      const samples: number[] = []
      for (let x = left; x < SIDE; x += across) samples.push(...pixel(x, y))
      scanlines.push(0, ...packed(samples, depth))
    }
  }
  const bytes = pngOf([['IHDR', header], ...chunks, ['IDAT', new Uint8Array(deflateSync(Uint8Array.from(scanlines)))], ['IEND', new Uint8Array(0)]])
  return { id, mediaType: 'image/png', bytes }
}

/** `samples` of `depth` bits each as bytes: two a sample, high byte first, at 16; eight a byte, first in the high bit, at 1. */
function packed(samples: readonly number[], depth: 1 | 8 | 16): number[] {
  if (depth === 8) return [...samples]
  if (depth === 16) return samples.flatMap((sample) => [sample >> 8, sample & 0xff])
  return Array.from({ length: Math.ceil(samples.length / 8) }, (_, byte) =>
    samples.slice(byte * 8, byte * 8 + 8).reduce((bits, sample, at) => bits | (sample << (7 - at)), 0),
  )
}

/** A JPEG segment: its marker, its length, which counts itself, and its body. */
function segment(marker: number, body: readonly number[]): number[] {
  return [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body]
}

/**
 * The smallest baseline JPEG a decoder accepts, of `components`: an 8 × 8
 * image of one block a component whose every coefficient is zero, so
 * mid-grey. A quantisation table of ones; a DC and an AC Huffman table of
 * one code each, of one bit, for "difference 0" and "end of block"; and a
 * scan of those two bits for each component, padded with ones.
 */
function jpeg(id: string, components: 1 | 3): ImageAsset {
  const oneCodeTable = (classAndId: number): number[] => [classAndId, 1, ...Array<number>(15).fill(0), 0]
  const ids = Array.from({ length: components }, (_, index) => index + 1)
  const bits = 2 * components
  const bytes = new Uint8Array([
    0xff,
    0xd8, // start of image
    ...segment(0xdb, [0, ...Array<number>(64).fill(1)]), // quantisation table 0
    ...segment(0xc0, [8, 0, 8, 0, 8, components, ...ids.flatMap((each) => [each, 0x11, 0])]), // baseline frame, 8 × 8
    ...segment(0xc4, oneCodeTable(0x00)), // DC table 0
    ...segment(0xc4, oneCodeTable(0x10)), // AC table 0
    ...segment(0xda, [components, ...ids.flatMap((each) => [each, 0x00]), 0, 63, 0]),
    ...Array.from({ length: Math.ceil(bits / 8) }, (_, byte) => (0xff >> Math.min(8, bits - 8 * byte)) & 0xff),
    0xff,
    0xd9, // end of image
  ])
  return { id, mediaType: 'image/jpeg', bytes }
}
