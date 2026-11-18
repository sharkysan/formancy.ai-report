import { checkSvg, imageHeader, MAX_ASSET_BYTES, RenderRefusal, sniffImage, type Image, type ImageAsset, type PngHeader } from '@formancy/report-runtime'
import { Inflate, type ZStream } from 'pako'
import { MAX_DOCX_IMAGE_DATA } from './limits.js'

/**
 * A picture's asset, read before its bytes go into the file (0068). A
 * Word file embeds the bytes as they are, so bytes that only look like a
 * picture would arrive in it as a broken one, and an SVG's are the one
 * place bytes from outside enter the package as XML that Word parses.
 *
 * What is checked is what the PDF renderer checks, and refused as it
 * refuses it, `invalid-asset`, naming the asset: the size limit; the
 * bytes against the type they are declared as; a PNG's or a JPEG's
 * structure, by report-spec's `imageHeader`; that a PNG's image data is
 * one whole zlib stream -- its header, deflate data as zlib reads it, the
 * checksum of what it inflates to, and nothing after -- and inflates to
 * exactly the scanlines its header promises, each with a filter PNG
 * defines, read as it inflates and never kept; and an SVG by
 * report-spec's `checkSvg`, which accepts only the drawing `cleanSvg`
 * writes -- no script, no entity, no reference to an address (0030).
 *
 * The renderer inflates a PNG's data with the platform's
 * `DecompressionStream`, which is zlib under Node and a browser's own in
 * a browser, and asynchronous; the writer is synchronous, and inflates
 * with pako, a port of zlib's own inflate, so that what is no stream to
 * the one is none to the other. The corpus's malformed documents hold
 * the two engines to each other, under Node, on one PNG for each way its
 * data is no such stream that was looked for; that pako and the
 * platform's decompressor agree on every other is pako's claim, as a
 * port, and no test's here.
 *
 * Between a PNG's or a JPEG's header and anything more of it, the image
 * data it holds is counted with that of the pictures read before it, as
 * the PDF renderer counts it, and refused past `MAX_DOCX_IMAGE_DATA` as
 * `content-too-large`: before a PNG's data is inflated, so that no more
 * than the bound ever is. The renderer inflates a PNG and then counts
 * it, so of a PNG past the bound whose data is no stream either, the
 * renderer says the second and the writer the first.
 *
 * Then what nobody has seen Word print as the PDF does, refused as
 * `unsupported`: a JPEG whose Exif block turns or mirrors it, which
 * PDFKit turns, and one of four components, which PDFKit draws in CMYK.
 */

/** A picture as the writer embeds it: its own size, in pixels as it is shown or in an SVG's units, the part it becomes, and what it holds. */
export interface Picture {
  readonly kind: 'png' | 'jpeg' | 'svg'
  readonly width: number
  readonly height: number
  /** The image data it holds, as `MAX_DOCX_IMAGE_DATA` counts it: a PNG's scanlines as its header promises them, a JPEG's bytes, and none for an SVG. */
  readonly data: number
}

/**
 * The asset as it is embedded, once its bytes pass; refused, naming it
 * and why, when they do not, and when its image data and `held`, that of
 * the pictures read before it, are more than a file may hold.
 */
export function readPicture(asset: ImageAsset, held: number): Picture {
  const read = pictureOf(asset, held)
  if (typeof read === 'string') throw new RenderRefusal('invalid-asset', `the image asset ${asset.id} ${read}`, asset.id)
  return read
}

/**
 * The size `image` draws `picture` at, in points: contained, the picture
 * at its own proportions, as large as the box allows; covering, the box.
 * The one place it is worked out: the checks hold it to Word's unit, and
 * the picture is written at it (`blocks.ts`).
 */
export function drawnSize(image: Image, picture: Picture): { readonly width: number; readonly height: number; readonly scale: number } {
  const cover = image.fit === 'cover'
  const scale = (cover ? Math.max : Math.min)(image.width / picture.width, image.height / picture.height)
  return cover ? { width: image.width, height: image.height, scale } : { width: picture.width * scale, height: picture.height * scale, scale }
}

function pictureOf(asset: ImageAsset, held: number): Picture | string {
  const { bytes, id } = asset
  if (!(bytes instanceof Uint8Array)) return 'has no bytes'
  if (bytes.length > MAX_ASSET_BYTES) return `is ${bytes.length} bytes; the limit is ${MAX_ASSET_BYTES} (20 MB)`
  const sniffed = sniffImage(bytes)
  const [isPng, isJpeg] = [sniffed === 'image/png', sniffed === 'image/jpeg']
  // Read as an SVG only to say what bytes declared otherwise are.
  const actually = (): string => (isPng ? ': it is a PNG' : isJpeg ? ': it is a JPEG' : checkSvg(bytes).ok ? ': it is an SVG' : '')
  if (asset.mediaType === 'image/png') return isPng ? raster(bytes, id, held) : `is declared a PNG and is not one${actually()}`
  if (asset.mediaType === 'image/jpeg') return isJpeg ? raster(bytes, id, held) : `is declared a JPEG and is not one${actually()}`
  if (asset.mediaType !== 'image/svg+xml') return `is of a media type a Word file does not hold (${String(asset.mediaType)})`
  if (isPng || isJpeg) return `is declared an SVG and is not one${actually()}`
  const checked = checkSvg(bytes)
  return checked.ok
    ? { kind: 'svg', width: checked.viewBox.width, height: checked.viewBox.height, data: 0 }
    : `is not an SVG a report draws: ${checked.message}`
}

/** `data`, the image data the picture `id` holds, where it and `held` are within what a file may hold; refused past that, before anything more of the picture is read. */
function counted(data: number, held: number, id: string): number {
  if (held + data > MAX_DOCX_IMAGE_DATA)
    throw new RenderRefusal(
      'content-too-large',
      `the pictures up to ${id} hold ${held + data} bytes of image data, a PNG's the scanlines its header promises and a JPEG's its bytes; a Word file may hold ${MAX_DOCX_IMAGE_DATA}`,
      id,
    )
  return data
}

function raster(bytes: Uint8Array, id: string, held: number): Picture | string {
  const header = imageHeader(bytes)
  if (!header.ok) return header.message
  if (header.mediaType === 'image/png') {
    const rows = scanlines(header)
    const data = counted(
      rows.reduce((total, row) => total + row.bytes * row.count, 0),
      held,
      id,
    )
    return scanlineProblem(header, rows, data) ?? { kind: 'png', width: header.width, height: header.height, data }
  }
  const data = counted(bytes.length, held, id)
  if (header.orientation !== undefined)
    throw new RenderRefusal(
      'unsupported',
      `the image ${id} is a JPEG its Exif block turns or mirrors (orientation ${header.orientation}); the PDF draws it so, and whether Word does is not known here: a Word file holds an upright JPEG alone`,
      id,
    )
  if (header.components === 4)
    throw new RenderRefusal(
      'unsupported',
      `the image ${id} is a JPEG of four components, which the PDF draws in CMYK; what Word draws of one is not known here: a Word file holds a grey or an RGB JPEG alone`,
      id,
    )
  return { kind: 'jpeg', width: header.width, height: header.height, data }
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

/** The scanlines of one pass of an image: the bytes of one, its filter byte included, and how many there are. */
interface Scanlines {
  readonly bytes: number
  readonly count: number
}

/** The scanlines of each pass of the image. */
function scanlines(header: PngHeader): Scanlines[] {
  const passes = header.interlaced
    ? ADAM7.map(([x, y, dx, dy]) => [Math.ceil((header.width - x) / dx), Math.ceil((header.height - y) / dy)] as const)
    : [[header.width, header.height] as const]
  return passes
    .filter(([width, height]) => width > 0 && height > 0)
    .map(([width, height]) => ({ bytes: 1 + Math.ceil((width * header.bitsPerPixel) / 8), count: height }))
}

/** The most pako writes of what it inflates before it hands it on: its own default, 64 KiB. A picture that inflates to less is written into as much as its header promises. */
const CHUNK = 64 * 1024

/** Thrown out of the inflater once more has inflated than the header promises: pako lets it through its `push`. */
class TooLong extends Error {}

/** What the PDF renderer says of image data its decompressor refuses, for whichever reason: said here of the same data. */
const NO_STREAM = 'has image data that does not inflate'

/**
 * pako's inflater over one PNG's image data: what it inflates is handed
 * to `each` a chunk at a time and never kept, and what it left unread
 * once the stream ended is `after`.
 *
 * A zlib stream and no other: left to itself pako reads the wrapper off
 * the data and inflates a gzip member too, which the platform's
 * decompressor, asked for `deflate`, refuses; stating the window, fifteen
 * bits, the most a zlib stream may state, is what turns that off.
 */
class Scanning extends Inflate {
  private readonly each: (chunk: Uint8Array) => void
  private stream: ZStream | undefined

  constructor(chunkSize: number, each: (chunk: Uint8Array) => void) {
    super({ windowBits: 15, chunkSize })
    this.each = each
  }

  override onStart(strm: ZStream): void {
    this.stream = strm
  }

  override onData(chunk: Uint8Array<ArrayBuffer>): void {
    this.each(chunk)
  }

  /** The bytes left unread when the stream ended. pako hands its stream to `onStart` before it inflates a byte. */
  get after(): number {
    return (this.stream as ZStream).avail_in
  }
}

/**
 * Whether the image data is one whole zlib stream that inflates to exactly
 * the scanlines the header promises, `expected` bytes in `rows`, each
 * starting with a filter type PNG defines: the PDF renderer's check
 * (`assets.ts` there), by pako where it has the platform's decompressor.
 * Read as it inflates, a chunk at a time, and nothing of the image kept.
 *
 * pako is zlib's inflate: it refuses a block zlib refuses, compares the
 * stream's checksum with what it inflated, and stops where the stream
 * ends, saying how much it left unread -- so data that is cut short, that
 * does not sum, or that zlib would not read is its error, and a byte after
 * the stream is one it left. Reading stops with the stream, whatever
 * follows it, and with the chunk that passes what the header promises.
 */
function scanlineProblem(header: PngHeader, rows: readonly Scanlines[], expected: number): string | undefined {
  let [length, row, left, next, unknown] = [0, 0, rows[0]?.count ?? 0, 0, undefined as number | undefined]
  const inflater = new Scanning(Math.min(CHUNK, expected), (chunk) => {
    // Where each scanline's filter byte is in what has inflated so far.
    while (unknown === undefined && row < rows.length && next < length + chunk.length) {
      const filter = chunk[next - length]!
      if (filter > 4) unknown = filter
      next += rows[row]!.bytes
      if (--left === 0) left = rows[++row]?.count ?? 0
    }
    length += chunk.length
    if (length > expected) throw new TooLong()
  })
  try {
    inflater.push(header.data, true)
  } catch (error) {
    if (error instanceof TooLong) return `has more image data than the ${expected} bytes its header promises`
    throw error
  }
  if (inflater.err !== 0 || inflater.after !== 0) return NO_STREAM
  if (length < expected) return `has image data of ${length} bytes where its header promises ${expected}`
  return unknown === undefined ? undefined : `has a scanline with an unknown filter type (${unknown})`
}

/**
 * The picture a reader that draws no SVG shows in an SVG's place: a PNG
 * of one pixel, grey (`#bfbfbf`), which Word stretches to the picture's
 * box. A grey box, never an empty space: no rasteriser is in the package,
 * so it cannot be the drawing. Typed out, chunk by chunk -- the
 * signature, a header of one pixel of eight-bit grey, the pixel in a
 * stored deflate block, and the end -- and held to `imageHeader` and its
 * pixel by `pictures.test.ts`.
 */
// prettier-ignore
export const SVG_FALLBACK = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x00, 0x00, 0x00, 0x00, 0x3a, 0x7e, 0x9b, 0x55,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x01, 0x01, 0x02, 0x00, 0xfd, 0xff, 0x00, 0xbf, 0x00, 0xc1, 0x00, 0xc0, 0x93, 0x18, 0x48, 0x28,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])
