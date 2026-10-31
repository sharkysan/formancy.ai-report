import {
  checkSvg,
  imageHeader,
  MAX_ASSET_BYTES,
  MAX_ASSET_SIDE,
  RenderRefusal,
  sniffImage,
  type CheckedSvg,
  type ImageAsset,
  type PngHeader,
  type SvgExtent,
} from '@formancy/report-runtime'
import { inflate } from './bytes.js'

/**
 * Image assets checked before pdfmake sees them. pdfmake, through PDFKit,
 * copies a PNG's compressed data and a JPEG's scan into the PDF without
 * decoding either, so bytes that only look like an image arrive in the PDF
 * as a broken one, and bytes that do not look like one at all fail with an
 * error that names no asset. Both are refused here instead, naming it, as
 * `invalid-asset`.
 *
 * What is checked: the size limits; a PNG's or a JPEG's structure, by
 * report-spec's `imageHeader`, which a builder refuses an image a person
 * adds by too (0033) -- for a PNG, every chunk's length and CRC, the header
 * and the palette, and for a JPEG, the segment structure up to the scan,
 * one frame header, read where PDFKit reads it, its size and its component
 * count, and the end marker; and here, that a PNG's image data inflates to
 * exactly the scanlines the header promises, each with a known filter,
 * which needs the platform's decompressor. A JPEG's entropy-coded scan is
 * not decoded: a corrupt scan inside an otherwise well-formed JPEG still
 * reaches the PDF.
 *
 * An SVG is checked by report-spec's `checkSvg`, which the runtime hands
 * on: its bytes must be exactly the drawing `cleanSvg` writes, so that what
 * prints is in the form that was approved, and nothing is cleaned, dropped
 * or rewritten at print (0030). Its size is its viewBox's, and with it come
 * what it costs to draw, which `check.ts` holds a render to.
 *
 * The size returned is the size the image is shown at, as `imageHeader`
 * reads it: a JPEG whose Exif orientation turns it a quarter turn is as wide
 * as its frame is tall, as PDFKit draws it. The check runs on the standard
 * library alone, so that the browser entry makes exactly the same one
 * (`bytes.ts`).
 */

/**
 * The image data one render may hold, once inflated: two images of the
 * largest kind an asset may be, 4096 by 4096 pixels of 16-bit RGBA, whose
 * scanlines inflate to 134,221,824 bytes each. PDFKit decodes such a PNG to
 * embed it: one took 1.8 seconds and grew the process by 343 MB, two 3.4
 * seconds, four 6.5 seconds (measured on 2026-10-15, on an Intel i9-10900K
 * under Node 24.21). A JPEG is embedded as it is, and counts its bytes.
 */
export const MAX_IMAGE_DATA = 2 * MAX_ASSET_SIDE * (1 + MAX_ASSET_SIDE * 8)

/** A PNG's or a JPEG's size in pixels, as it is shown, how many bytes of image data it holds once a PNG's are inflated, and whether PDFKit draws it in DeviceCMYK. */
export interface Raster {
  readonly kind: 'raster'
  readonly width: number
  readonly height: number
  readonly data: number
  /**
   * A JPEG whose frame header says four components, which PDFKit draws in
   * DeviceCMYK (pdfkit.js 3808-3812), as it draws one of three in
   * DeviceRGB and one of one in DeviceGray, and no other count, which the
   * check refuses; never a PNG, which PDFKit draws in RGB or grey. An
   * e-invoice's PDF/A cannot hold one.
   */
  readonly cmyk: boolean
}

/**
 * An SVG in the form `cleanSvg` writes: its viewBox, whose proportions
 * `contain` and `cover` keep; the drawing, as the ASCII text it is, which
 * every pass hands pdfmake unchanged; what it costs, as `checkSvg` counts
 * it and `drawingUnits` weights it; and how far the converter's numbers for
 * it reach, which an e-invoice holds it to (`svg-pdfa.ts`).
 */
export interface Vector {
  readonly kind: 'vector'
  /** The viewBox's origin. */
  readonly x: number
  readonly y: number
  /** The viewBox's size. */
  readonly width: number
  readonly height: number
  readonly svg: string
  /** What a reader paints for it, in `MAX_SVG_SEGMENTS`' weighted segments. */
  readonly segments: number
  /** The page-sized transparency groups it makes, in `MAX_SVG_GROUPS`' units. */
  readonly groups: number
  /** What drawing it once costs the renderer, in `MAX_SVG_DRAWING`'s units. */
  readonly units: number
  /** How far the numbers the converter writes for it reach wherever it is placed, and how deep it nests the graphics state, as `checkSvg` measures them. */
  readonly extent: SvgExtent
}

/** An image asset as the checks read it. */
export type CheckedImage = Raster | Vector

/** The asset as it is drawn, once its bytes pass; refused as `invalid-asset`, naming it and why, when they do not. */
export async function checkImageAsset(asset: ImageAsset): Promise<CheckedImage> {
  const read = await readAsset(asset)
  if (typeof read === 'string') throw new RenderRefusal('invalid-asset', `the image asset ${asset.id} ${read}`, asset.id)
  return read
}

/** The asset as it is drawn, or what is wrong with it. */
async function readAsset(asset: ImageAsset): Promise<CheckedImage | string> {
  const { bytes } = asset
  if (!(bytes instanceof Uint8Array)) return 'has no bytes'
  if (bytes.length > MAX_ASSET_BYTES) return `is ${bytes.length} bytes; the limit is ${MAX_ASSET_BYTES} (20 MB)`
  const sniffed = sniffImage(bytes)
  const isPng = sniffed === 'image/png'
  const isJpeg = sniffed === 'image/jpeg'
  // Read as an SVG only to say what bytes declared otherwise are; cleanSvg refuses bytes past a mebibyte unread.
  const actually = (): string => (isPng ? ': it is a PNG' : isJpeg ? ': it is a JPEG' : checkSvg(bytes).ok ? ': it is an SVG' : '')
  if (asset.mediaType === 'image/png') return isPng ? readRaster(bytes) : `is declared a PNG and is not one${actually()}`
  if (asset.mediaType === 'image/jpeg') return isJpeg ? readRaster(bytes) : `is declared a JPEG and is not one${actually()}`
  if (asset.mediaType === 'image/svg+xml') return isPng || isJpeg ? `is declared an SVG and is not one${actually()}` : readSvg(bytes)
  return `is of a media type the renderer does not draw (${String(asset.mediaType)})`
}

/**
 * The drawing one render may cost the renderer, in units of what
 * svg-to-pdfkit does each time it draws an SVG: once for each image of it in
 * the body, and on every page for one in a page region, which pdfmake lays
 * out and draws anew on each page (0030). A move, a line or a close is one
 * unit; a curve, an element, a gradient stop and a page-sized transparency
 * group are weighted by what each costs beside a line, rounded up; and every
 * `DRAWING_WEIGHT.bytes` bytes of the drawing are one unit more, since
 * pdfmake reads the whole text again with xmldoc in every pass and the
 * converter on every draw, whatever it draws. At the budget the renderer
 * spends about 2.9 seconds drawing SVGs, about what `MAX_IMAGE_DATA`'s two
 * largest PNGs cost it to decode.
 *
 * Measured on 2026-10-18 on an Intel i9-10900K, shared with other work,
 * under Node 24.21.0 with pdfmake 0.3.11: whole renders, every pass, of an
 * SVG 15 mm square in the page header of a report of so many pages, against
 * the same report with an SVG of one rectangle in its place, medians of five
 * (three at 400 pages). A line costs 2.9 microseconds a page (30,000 lines on
 * 32 pages, 2.79 s more); a cubic 6.8, 2.3 lines (9,999 on 32 pages, 2.18 s);
 * an element 33 beyond its segments, 11.4 lines (6,001 rectangles on 8 pages,
 * 2.29 s); a gradient stop 17, 5.9 lines (a 64-stop gradient on 400
 * rectangles on 7 pages, 3.2 s); a transparency group 0.10 ms beyond its
 * element and segments, 34 to 36 lines (four clipped shapes, and two shapes
 * painted with a translucent gradient, on 400 pages, 0.32 s and 0.25 s).
 * Those lines were short, seven bytes each. On 16 pages a line of 18.7
 * bytes cost 4.4 microseconds a page and one of 37 bytes 5.2, against 3.1
 * for a short one; and 10,506 arcs that draw nothing, a mebibyte of
 * seventeen-digit numbers, cost 109 ms a page on 8 pages, what 35,000 short
 * lines do, though each is counted as a line. With a unit more for every 32
 * bytes, each of these drawings costs from 13 % less than its units say
 * (900 rectangles of seventeen-digit numbers and dash arrays) to 27 % more
 * (the 37-byte lines).
 */
export const MAX_SVG_DRAWING = 1_000_000

/** What each thing svg-to-pdfkit draws costs the renderer, in lines' worth of its time, rounded up, and how many bytes of the drawing are one more unit (`MAX_SVG_DRAWING`). */
const DRAWING_WEIGHT = { curve: 3, element: 12, stop: 6, group: 40, bytes: 32 } as const

/** What drawing an SVG once costs the renderer, in `MAX_SVG_DRAWING`'s units. */
export function drawingUnits(checked: Pick<CheckedSvg, 'bytes' | 'drawn' | 'groups'>): number {
  const { lines, curves, elements, stops } = checked.drawn
  const commands =
    lines + DRAWING_WEIGHT.curve * curves + DRAWING_WEIGHT.element * elements + DRAWING_WEIGHT.stop * stops + DRAWING_WEIGHT.group * checked.groups
  return commands + Math.ceil(checked.bytes.length / DRAWING_WEIGHT.bytes)
}

/** An SVG's drawing, when its bytes are exactly what `cleanSvg` writes; report-spec's refusal, which repeats no value, when they are not. */
function readSvg(bytes: Uint8Array): Vector | string {
  const checked = checkSvg(bytes)
  if (!checked.ok) return `is not an SVG the renderer draws: ${checked.message}`
  const { viewBox, segments, groups, extent } = checked
  return {
    kind: 'vector',
    x: viewBox.x,
    y: viewBox.y,
    width: viewBox.width,
    height: viewBox.height,
    svg: ascii(checked.bytes),
    segments,
    groups,
    units: drawingUnits(checked),
    extent,
  }
}

/** ASCII bytes as text, a chunk at a time: a mebibyte is more than one call takes as arguments. */
function ascii(bytes: Uint8Array): string {
  let text = ''
  for (let start = 0; start < bytes.length; start += 0x2000) text += String.fromCharCode(...bytes.subarray(start, start + 0x2000))
  return text
}

/**
 * A PNG or a JPEG as it is drawn, once its structure, read by
 * `imageHeader`, and a PNG's image data pass. A JPEG is embedded as it is,
 * and counts its bytes; a PNG counts its scanlines, which PDFKit decodes.
 */
async function readRaster(bytes: Uint8Array): Promise<Raster | string> {
  const header = imageHeader(bytes)
  if (!header.ok) return header.message
  if (header.mediaType === 'image/jpeg')
    return { kind: 'raster', width: header.width, height: header.height, data: bytes.length, cmyk: header.components === 4 }
  return (await scanlineProblem(header)) ?? { kind: 'raster', width: header.width, height: header.height, data: inflatedLength(header), cmyk: false }
}

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

/** The scanlines of each pass of the image: the bytes of one, its filter byte included, and how many there are. */
function scanlines(header: PngHeader): { readonly bytes: number; readonly count: number }[] {
  const passes = header.interlaced
    ? ADAM7.map(([x, y, dx, dy]) => [Math.ceil((header.width - x) / dx), Math.ceil((header.height - y) / dy)] as const)
    : [[header.width, header.height] as const]
  return passes
    .filter(([width, height]) => width > 0 && height > 0)
    .map(([width, height]) => ({ bytes: 1 + Math.ceil((width * header.bitsPerPixel) / 8), count: height }))
}

/** The bytes the image data inflates to, as the header promises. */
function inflatedLength(header: PngHeader): number {
  return scanlines(header).reduce((total, row) => total + row.bytes * row.count, 0)
}

/**
 * Whether the image data inflates to exactly the scanlines the header
 * promises, each starting with a filter type PNG defines. Read as it
 * inflates: the filter bytes are where the scanlines say, so nothing of the
 * image is kept.
 */
async function scanlineProblem(header: PngHeader): Promise<string | undefined> {
  const rows = scanlines(header)
  const expected = inflatedLength(header)
  const filters = filterOffsets(rows)
  let next = filters.next()
  let unknown: number | undefined
  const inflated = await inflate(header.data, expected, (chunk, offset) => {
    while (unknown === undefined && !next.done && next.value < offset + chunk.length) {
      const filter = chunk[next.value - offset]!
      if (filter > 4) unknown = filter
      next = filters.next()
    }
  })
  if (inflated.kind === 'too-long') return `has more image data than the ${expected} bytes its header promises`
  if (inflated.kind === 'invalid') return 'has image data that does not inflate'
  if (inflated.length < expected) return `has image data of ${inflated.length} bytes where its header promises ${expected}`
  return unknown === undefined ? undefined : `has a scanline with an unknown filter type (${unknown})`
}

/** Where each scanline's filter byte is in the inflated data, in order. */
function* filterOffsets(rows: readonly { readonly bytes: number; readonly count: number }[]): Generator<number, void> {
  let offset = 0
  for (const row of rows) {
    for (let index = 0; index < row.count; index++, offset += row.bytes) yield offset
  }
}
