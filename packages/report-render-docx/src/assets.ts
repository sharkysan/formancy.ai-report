import { Unzlib } from 'fflate'
import { checkSvg, imageHeader, MAX_ASSET_BYTES, RenderRefusal, sniffImage, type Image, type ImageAsset, type PngHeader } from '@formancy/report-runtime'

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
 * one whole zlib stream -- its header, deflate data that ends where the
 * four bytes of its checksum begin, and the checksum of what it inflates
 * to -- and inflates to exactly the scanlines its header promises, each
 * with a filter PNG defines, read as it inflates and never kept; and an
 * SVG by report-spec's `checkSvg`, which accepts only the drawing
 * `cleanSvg` writes -- no script, no entity, no reference to an address
 * (0030). The corpus's malformed documents hold the two engines to each
 * other, one PNG for each way its data is no such stream.
 *
 * Then what nobody has seen Word print as the PDF does, refused as
 * `unsupported`: a JPEG whose Exif block turns or mirrors it, which
 * PDFKit turns, and one of four components, which PDFKit draws in CMYK.
 */

/** A picture as the writer embeds it: its own size, in pixels as it is shown or in an SVG's units, and the part it becomes. */
export interface Picture {
  readonly kind: 'png' | 'jpeg' | 'svg'
  readonly width: number
  readonly height: number
}

/** The asset as it is embedded, once its bytes pass; refused, naming it and why, when they do not. */
export function readPicture(asset: ImageAsset): Picture {
  const read = pictureOf(asset)
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

function pictureOf(asset: ImageAsset): Picture | string {
  const { bytes, id } = asset
  if (!(bytes instanceof Uint8Array)) return 'has no bytes'
  if (bytes.length > MAX_ASSET_BYTES) return `is ${bytes.length} bytes; the limit is ${MAX_ASSET_BYTES} (20 MB)`
  const sniffed = sniffImage(bytes)
  const [isPng, isJpeg] = [sniffed === 'image/png', sniffed === 'image/jpeg']
  // Read as an SVG only to say what bytes declared otherwise are.
  const actually = (): string => (isPng ? ': it is a PNG' : isJpeg ? ': it is a JPEG' : checkSvg(bytes).ok ? ': it is an SVG' : '')
  if (asset.mediaType === 'image/png') return isPng ? raster(bytes, id) : `is declared a PNG and is not one${actually()}`
  if (asset.mediaType === 'image/jpeg') return isJpeg ? raster(bytes, id) : `is declared a JPEG and is not one${actually()}`
  if (asset.mediaType !== 'image/svg+xml') return `is of a media type a Word file does not hold (${String(asset.mediaType)})`
  if (isPng || isJpeg) return `is declared an SVG and is not one${actually()}`
  const checked = checkSvg(bytes)
  return checked.ok ? { kind: 'svg', width: checked.viewBox.width, height: checked.viewBox.height } : `is not an SVG a report draws: ${checked.message}`
}

function raster(bytes: Uint8Array, id: string): Picture | string {
  const header = imageHeader(bytes)
  if (!header.ok) return header.message
  if (header.mediaType === 'image/png') return scanlineProblem(header) ?? { kind: 'png', width: header.width, height: header.height }
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
  return { kind: 'jpeg', width: header.width, height: header.height }
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

/** What is pushed to the decompressor at once: at deflate's most, 1032 to one, a slice inflates to under 17 MB before it is counted. */
const SLICE = 16 * 1024

/** Thrown out of the decompressor's callback once more has inflated than the header promises. */
class TooLong extends Error {}

/** What the PDF renderer says of image data its decompressor refuses, for whichever reason: said here of the same data. */
const NO_STREAM = 'has image data that does not inflate'

/**
 * Whether fflate has read a zlib stream's last block to its end. It has no
 * word for that in what it declares, and without one a stream's end cannot
 * be told from a slice that inflated nothing -- so this reads the state it
 * keeps, as 0.8.3 keeps it and as its own gzip reader reads it to find
 * where a member ends: `f`, set once the last block has been met, and `l`,
 * the block still open. The dependency is pinned exactly, and
 * `pictures.test.ts` fails if a release keeps its state otherwise: every
 * PNG would be refused, or one with bytes after its stream written.
 */
function ended(stream: Unzlib): boolean {
  const { s } = stream as unknown as { readonly s: { readonly f?: number; readonly l?: object | null } }
  return s.f === 1 && (s.l === undefined || s.l === null)
}

/** The largest prime under 2^16, which Adler-32's two sums are taken modulo, and the bytes summed between two reductions: the most that leave the second under 2^32 (RFC 1950, zlib's `NMAX`). */
const ADLER = 65521
const ADLER_RUN = 5552

/**
 * Whether the image data is one whole zlib stream that inflates to exactly
 * the scanlines the header promises, each starting with a filter type PNG
 * defines: the PDF renderer's check (`assets.ts` there), by fflate's
 * streaming decompressor where it has the platform's. Read as it inflates,
 * a slice at a time, and nothing of the image kept.
 *
 * The platform's decompressor refuses a stream whose checksum is not its
 * data's and one with bytes after its end; fflate's compares no checksum
 * and reads past no end, so both are held here. The checksum, Adler-32, is
 * summed over what inflates and compared with the stream's last four
 * bytes. The end is held by pushing every byte but the last of the
 * deflate data and asking whether the stream has ended (`ended`): if it
 * has, bytes stand between its end and its checksum, and reading stops
 * there -- fflate keeps what it has not read and joins each later slice to
 * it, so reading on would cost the square of what follows (16 MB after a
 * stream of thirty bytes: 4.2 seconds, on 18 November 2026, on the machine
 * `limits.ts` names). Then the last byte is pushed with the checksum, and
 * the stream must have ended with it.
 */
function scanlineProblem(header: PngHeader): string | undefined {
  const rows = scanlines(header)
  const expected = rows.reduce((total, row) => total + row.bytes * row.count, 0)
  const { data } = header
  // The last byte of the deflate data stands before the checksum's four.
  const last = data.length - 5
  let [length, row, left, next, unknown] = [0, 0, rows[0]?.count ?? 0, 0, undefined as number | undefined]
  let [low, high] = [1, 0]
  const stream = new Unzlib((chunk) => {
    // Where each scanline's filter byte is in what has inflated so far.
    while (unknown === undefined && row < rows.length && next < length + chunk.length) {
      const filter = chunk[next - length]!
      if (filter > 4) unknown = filter
      next += rows[row]!.bytes
      if (--left === 0) left = rows[++row]?.count ?? 0
    }
    length += chunk.length
    if (length > expected) throw new TooLong()
    for (let at = 0; at < chunk.length;) {
      const end = Math.min(at + ADLER_RUN, chunk.length)
      for (; at < end; at++) {
        low += chunk[at]!
        high += low
      }
      low %= ADLER
      high %= ADLER
    }
  })
  // A zlib stream is its two bytes of header, deflate data and the four of its checksum: with no byte of data there is none to read.
  if (last < 2) return NO_STREAM
  try {
    for (let at = 0; at < last; at += SLICE) {
      stream.push(data.subarray(at, Math.min(at + SLICE, last)), false)
      if (ended(stream)) return NO_STREAM
    }
    stream.push(data.subarray(last), true)
  } catch (error) {
    return error instanceof TooLong ? `has more image data than the ${expected} bytes its header promises` : NO_STREAM
  }
  // Big-endian, as zlib writes it; unsigned, as the sums are.
  const stated = ((data[last + 1]! << 24) | (data[last + 2]! << 16) | (data[last + 3]! << 8) | data[last + 4]!) >>> 0
  if (!ended(stream) || stated !== ((high << 16) | low) >>> 0) return NO_STREAM
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
