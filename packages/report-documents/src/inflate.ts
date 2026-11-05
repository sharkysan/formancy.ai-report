import { decodePDFRawStream, PDFContext, PDFDict, PDFName, PDFRawStream } from '@pdfme/pdf-lib'
import { Inflate, type ZStream } from 'pako'
import { isWhite } from './bytes.js'
import { isArray, isDict, isName, type PdfDict, type PdfStream, type PdfValue } from './model.js'
import { caught, refuse, type DocumentRefusal } from './refusals.js'

/**
 * A stream's bytes decoded through its filters, synchronously, against a
 * budget every stage of every stream is taken from: what holds a Flate
 * bomb to `MAX_DOCUMENT_INFLATED` wherever the reader decodes one.
 *
 * Flate is inflated with pako's streaming `Inflate`, its zlib header
 * checked here and its data inflated raw, each chunk charged as it is
 * written and the inflate stopped by a throw from the chunk that passes the
 * budget, so that nothing past it is ever written. Its Adler-32 is not
 * compared, as PDF.js and pdf-lib do not compare it: twelve of Apple's PDFs
 * in the parser spike's sample carry checksums that do not match and print
 * in every viewer. ASCIIHex, ASCII85 and RunLength write at most a fixed
 * multiple of their input, so each is refused before it is decoded where
 * that multiple passes the budget, then decoded by pdf-lib's port of
 * PDF.js and charged what it wrote. Nothing else is decoded: LZW, Crypt and
 * an image's own filters are refused where a stream must be decoded. An
 * image is never decoded: its filters are checked and it is passed on to
 * the viewer as it is written (`passedOn`), held to the pixels it declares
 * instead (images.ts). A stream that keeps its data in another file is
 * refused before a byte of it is read (`filtersOf`).
 */

/**
 * What a document may still decode. Every decode stage's output is taken
 * from `left` as it is written: Flate's a chunk at a time, a fixed-ratio
 * filter's at most its ratio of its input before it is decoded and then
 * what it wrote. A predictor's output is not charged: it is never larger
 * than the inflated rows it is undone from, which were. The pages take
 * from it too, for each copy of their content they hold again (pages.ts).
 */
export interface InflateBudget {
  left: number
}

/** The private sentinel `onData` throws once the budget is spent, which pako lets through its `push`. */
const PAST_THE_BUDGET = new Error('past the budget')

/** pako's Inflate, raw, charging each chunk to `budget` as pako writes it; on success, pako joins what it kept into `result`. */
export class BoundedInflate extends Inflate {
  private readonly budget: InflateBudget
  private stream: ZStream | undefined

  constructor(budget: InflateBudget) {
    super({ raw: true })
    this.budget = budget
  }

  override onStart(strm: ZStream): void {
    this.stream = strm
  }

  override onData(chunk: Uint8Array<ArrayBuffer>): void {
    this.budget.left -= chunk.length
    if (this.budget.left < 0) throw PAST_THE_BUDGET
    super.onData(chunk)
  }

  /** The input left after the deflate data ended: its checksum, and whatever followed it. pako hands its stream to onStart before it inflates a byte. */
  get after(): number {
    return (this.stream as ZStream).avail_in
  }
}

/** What a zlib stream at the start of `data` inflates to, taken from `budget`, and where it ends: after its deflate data, the four bytes of its checksum. */
function inflate(data: Uint8Array, budget: InflateBudget): { readonly bytes: Uint8Array; readonly end: number } {
  if (data.length < 2) refuse('flate-header')
  const cmf = data[0] as number
  const flg = data[1] as number
  // Deflate, a header check that holds, no preset dictionary: what PDF.js holds a Flate stream's header to.
  if ((cmf & 0x0f) !== 8 || ((cmf << 8) | flg) % 31 !== 0 || (flg & 0x20) !== 0) refuse('flate-header')
  const inflater = new BoundedInflate(budget)
  try {
    inflater.push(data.subarray(2), true)
  } catch (error) {
    if (error === PAST_THE_BUDGET) refuse('inflated')
    throw error
  }
  // Pushed as the last input, the data ends the inflate either way: done, or cut short or damaged.
  if (inflater.err !== 0) refuse('flate-data')
  return { bytes: inflater.result, end: data.length - inflater.after + 4 }
}

function inflated(data: Uint8Array, budget: InflateBudget): Uint8Array {
  const { bytes, end } = inflate(data, budget)
  // After the checksum, nothing but white space, the end of line a writer may count in /Length.
  for (let at = end; at < data.length; at += 1) if (!isWhite(data[at])) refuse('flate-after')
  return bytes
}

/**
 * Internal: where Flate data that `data` begins with ends, its checksum
 * counted -- what an inline image's data is delimited by -- inflated
 * against `budget` to find it; throws the refusal.
 */
export function inflatedEnd(data: Uint8Array, budget: InflateBudget): number {
  return inflate(data, budget).end
}

/** The most each fixed-ratio filter writes for a byte it reads: ASCIIHex half; ASCII85 four, for `z`; RunLength 64, a two-byte run of 128. */
const RATIO: ReadonlyMap<string, number> = new Map([
  ['ASCIIHexDecode', 0.5],
  ['ASCII85Decode', 4],
  ['RunLengthDecode', 64],
])

/** One context for the one-filter dictionaries pdf-lib's decoders read their filter from; it holds no object. */
const CONTEXT = PDFContext.create()

function fixedRatio(filter: string, ratio: number, data: Uint8Array, budget: InflateBudget): Uint8Array {
  if (Math.ceil(data.length * ratio) > budget.left) refuse('inflated')
  const dict = PDFDict.withContext(CONTEXT)
  dict.set(PDFName.of('Filter'), PDFName.of(filter))
  const out = decodePDFRawStream(PDFRawStream.of(dict, data)).decode()
  budget.left -= out.length
  return out
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** A positive integer a predictor's parameter may be, its default where absent, or a refusal. */
function parameter(parms: PdfDict | undefined, key: string, fallback: number): number {
  const value = parms?.entries.get(key) ?? fallback
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) refuse('predictor')
  return value
}

/**
 * Flate's output with its predictor undone: none, or one of PNG's (10 to
 * 15) row by row by each row's own filter type. TIFF's (2) is legal and
 * unread; anything else, a filter type past Paeth's, or a last row cut
 * short is not what the writer meant to be read.
 */
function unpredicted(data: Uint8Array, parms: PdfDict | undefined): Uint8Array {
  const predictor = parameter(parms, 'Predictor', 1)
  if (predictor === 1) return data
  if (predictor === 2) refuse('filter')
  if (predictor < 10 || predictor > 15) refuse('predictor')
  const colors = parameter(parms, 'Colors', 1)
  const bits = parameter(parms, 'BitsPerComponent', 8)
  const columns = parameter(parms, 'Columns', 1)
  const bpp = Math.max(1, Math.ceil((colors * bits) / 8))
  const row = Math.ceil((colors * bits * columns) / 8)
  if (data.length % (row + 1) !== 0) refuse('predictor')
  const rows = data.length / (row + 1)
  const out = new Uint8Array(rows * row)
  for (let r = 0; r < rows; r += 1) {
    const type = data[r * (row + 1)]
    const src = r * (row + 1) + 1
    const dst = r * row
    for (let i = 0; i < row; i += 1) {
      // Every index here is within the rows the length check above admitted.
      const x = data[src + i] as number
      const a = i >= bpp ? (out[dst + i - bpp] as number) : 0
      const b = r > 0 ? (out[dst - row + i] as number) : 0
      const c = r > 0 && i >= bpp ? (out[dst - row + i - bpp] as number) : 0
      if (type === 0) out[dst + i] = x
      else if (type === 1) out[dst + i] = x + a
      else if (type === 2) out[dst + i] = x + b
      else if (type === 3) out[dst + i] = x + ((a + b) >> 1)
      else if (type === 4) out[dst + i] = x + paeth(a, b, c)
      else refuse('predictor')
    }
  }
  return out
}

/** A value that may be one of a list or the list itself, as a list; none where absent. */
const listed = (value: PdfValue | undefined): readonly PdfValue[] => (value === undefined ? [] : isArray(value) ? value : [value])

/**
 * The entries that say a stream's data is in another file (ISO 32000-1
 * 7.3.8.2): read as written, the stream's own bytes would be taken for its
 * data where a viewer reads another file's, or -- PDF.js reads /F as
 * /Filter -- where a viewer decodes them through filters the reader never
 * saw.
 */
const EXTERNAL = ['F', 'FFilter', 'FDecodeParms'] as const

/** Internal: the filters a stream names, in order: a name, an array of names, or none; refused, before its data is read, where its data is in another file. */
export function filtersOf(dict: PdfDict): readonly string[] {
  if (EXTERNAL.some((key) => dict.entries.has(key))) refuse('external')
  return listed(dict.entries.get('Filter')).map((item) => (isName(item) ? item.name : refuse('filter-name')))
}

/** Each filter's /DecodeParms, a dictionary or none, by the filter's place. */
function parmsOf(dict: PdfDict, count: number): readonly (PdfDict | undefined)[] {
  const each = listed(dict.entries.get('DecodeParms'))
  return Array.from({ length: count }, (_, i) => {
    const item = each[i]
    if (item === undefined || item === null) return undefined
    return isDict(item) ? item : refuse('filter-name')
  })
}

/**
 * An image's own filters, which a viewer decodes and the reader never does:
 * what they write is bounded by the image's size, not by their input, and
 * written in a form only an image decoder reads.
 */
const IMAGE_FILTERS: ReadonlySet<string> = new Set(['DCTDecode', 'JPXDecode', 'CCITTFaxDecode', 'JBIG2Decode'])

/**
 * Internal: refused where one of an image's filters, in order, is not one
 * a viewer decodes it through and the reader passes on as it is written --
 * Flate and the fixed-ratio filters anywhere, an image's own only last. An
 * image is never decoded, and a filter the reader does not know is no more
 * admitted on one than where it decodes.
 */
export function passedOn(filters: readonly string[]): void {
  for (const [i, filter] of filters.entries()) {
    const own = IMAGE_FILTERS.has(filter) && i === filters.length - 1
    if (!own && filter !== 'FlateDecode' && !RATIO.has(filter)) refuse('filter')
  }
}

/** `stream`'s bytes decoded through its filters, each stage taken from `budget`; throws the refusal. */
export function decodedBytes(stream: PdfStream, budget: InflateBudget): Uint8Array {
  const filters = filtersOf(stream.dict)
  const parms = parmsOf(stream.dict, filters.length)
  let data = stream.bytes
  for (const [i, filter] of filters.entries()) {
    // A Map, not an object's keys: /constructor or /__proto__ would find what an object's prototype holds.
    const ratio = RATIO.get(filter)
    if (filter === 'FlateDecode') data = unpredicted(inflated(data, budget), parms[i])
    else if (ratio !== undefined) data = fixedRatio(filter, ratio, data, budget)
    else refuse('filter')
  }
  return data
}

/** Internal: `stream`'s bytes decoded through its filters, refused once every stage together passes what `budget` has left. */
export function decoded(stream: PdfStream, budget: InflateBudget): Uint8Array | DocumentRefusal {
  return caught(() => decodedBytes(stream, budget))
}
