import { deflate, Inflate, type ZStream } from 'pako'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { BoundedInflate, decoded } from './inflate.js'
import type { PdfDict, PdfStream, PdfValue } from './model.js'
import { refusal } from './refusals.js'
import { concat, latin1, MIB } from './test-pdf.js'

/**
 * A stream's bytes decoded through its filters, every stage's output taken
 * from one budget as it is written: what holds a Flate bomb to the bound
 * wherever the reader decodes one (the content, object and cross-reference
 * streams of the parse's tests), and what the filters admitted are.
 */

const name = (text: string): PdfValue => ({ name: text })
const dictOf = (entries: Record<string, PdfValue>): PdfDict => ({ entries: new Map(Object.entries(entries)) })
const streamOf = (bytes: Uint8Array, entries: Record<string, PdfValue> = {}): PdfStream => ({ dict: dictOf(entries), bytes })
const flate = (bytes: Uint8Array, entries: Record<string, PdfValue> = {}): PdfStream => streamOf(deflate(bytes), { Filter: name('FlateDecode'), ...entries })

const TEXT = latin1('BT /F1 12 Tf 72 712 Td (Hello) Tj ET\n')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('decoded inflates', () => {
  // What pako writes a chunk at a time is charged as it is written, and
  // the inflate stops by a throw from the chunk that passed the limit: a
  // check after the inflate would have written the whole bomb first.
  test('inflation stops once the output passes the limit, without reading on', () => {
    const onData = vi.spyOn(BoundedInflate.prototype, 'onData')
    const limit = 100_000
    expect(decoded(flate(new Uint8Array(MIB)), { left: limit })).toEqual(refusal('inflated'))
    // pako's chunks are 64 KiB: the second passes the limit, and none follows it.
    expect(onData.mock.calls.map(([chunk]) => chunk.length)).toEqual([65_536, 65_536])
  })

  // The bound is the document's, not each stream's: two streams that each
  // fit must not together pass it, nor the two stages of one stream.
  test('every stage of every stream is taken from one budget', () => {
    const budget = { left: 3 * 1024 }
    expect(decoded(flate(new Uint8Array(2048)), budget)).toEqual(new Uint8Array(2048))
    expect(budget.left).toBe(1024)
    expect(decoded(flate(new Uint8Array(2048)), budget)).toEqual(refusal('inflated'))
    const twice = streamOf(deflate(deflate(new Uint8Array(4096))), { Filter: [name('FlateDecode'), name('FlateDecode')] })
    const first = deflate(new Uint8Array(4096)).length
    const exact = { left: first + 4096 }
    expect(decoded(twice, exact)).toEqual(new Uint8Array(4096))
    expect(exact.left).toBe(0)
    expect(decoded(twice, { left: first + 4095 })).toEqual(refusal('inflated'))
  })

  // A stream with no filter is its bytes: nothing was decoded, so nothing
  // is charged against what the document may decode.
  test('a stream with no filter is its bytes, and costs nothing', () => {
    const budget = { left: 0 }
    expect(decoded(streamOf(TEXT), budget)).toEqual(TEXT)
    expect(decoded(streamOf(TEXT, { Filter: [] }), budget)).toEqual(TEXT)
  })

  // The decision the spike's sample made: twelve of Apple's PDFs carry
  // Flate streams whose Adler-32 does not match and print in every viewer,
  // and PDF.js and pdf-lib do not compare it either. The reader inflates
  // the data and does not compare its checksum.
  test('a checksum that does not match is not compared', () => {
    const bytes = deflate(TEXT)
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff
    expect(decoded(streamOf(bytes, { Filter: name('FlateDecode') }), { left: MIB })).toEqual(TEXT)
  })

  // What follows the deflate data inside the stream is its checksum and
  // perhaps the end of line a writer counted in /Length. Anything else is
  // bytes no viewer shows and the reader would hand on as part of the
  // stream: refused.
  test('a stream with bytes after its end is malformed', () => {
    const bytes = deflate(TEXT)
    expect(decoded(streamOf(concat([bytes, latin1('\r\n')]), { Filter: name('FlateDecode') }), { left: MIB })).toEqual(TEXT)
    expect(decoded(streamOf(concat([bytes, latin1('\r\nq 1 0 0 1 0 0 cm')]), { Filter: name('FlateDecode') }), { left: MIB })).toEqual(refusal('flate-after'))
  })

  // A stream cut short inflates to the start of what it held: printed, it
  // would be a page with its end missing.
  test('a stream cut short is malformed', () => {
    const bytes = deflate(new Uint8Array(4096).fill(0x41))
    expect(decoded(streamOf(bytes.subarray(0, bytes.length - 8), { Filter: name('FlateDecode') }), { left: MIB })).toEqual(refusal('flate-data'))
    expect(decoded(streamOf(latin1('x\x9cnot deflate data'), { Filter: name('FlateDecode') }), { left: MIB })).toEqual(refusal('flate-data'))
  })

  // The zlib header is checked as PDF.js checks it -- deflate, a check
  // that holds, no preset dictionary -- since the data is inflated raw.
  test('a stream whose zlib header is not one is malformed', () => {
    const bytes = deflate(TEXT)
    for (const header of [[0x78], [0x79, 0x9c], [0x78, 0x9d], [0x78, 0xbb]]) {
      const broken = concat([Uint8Array.from(header), bytes.subarray(2)])
      expect(decoded(streamOf(header.length === 1 ? Uint8Array.from(header) : broken, { Filter: name('FlateDecode') }), { left: MIB })).toEqual(
        refusal('flate-header'),
      )
    }
  })
})

describe('decoded refuses what escapes the inflate', () => {
  // The budget's sentinel is the one exception the inflate turns into
  // inflates-too-far; anything else thrown inside pako is the parse's to
  // refuse as it refuses any exception, never mistaken for the bound.
  test('an exception inside the inflate other than the budget is malformed', () => {
    vi.spyOn(BoundedInflate.prototype, 'onData').mockImplementation(() => {
      throw new Error('inside pako')
    })
    expect(decoded(flate(TEXT), { left: MIB })).toEqual(refusal('unreadable'))
  })
})

describe('decoded undoes a predictor', () => {
  const rows = Uint8Array.of(1, 2, 3, 4, 5, 6)
  const predicted = (types: readonly number[]): Uint8Array => Uint8Array.of(types[0] ?? 0, 1, 2, 3, types[1] ?? 0, ...(types[1] === 2 ? [3, 3, 3] : [4, 5, 6]))

  // Acrobat writes its cross-reference streams under PNG's Up predictor;
  // read as they are, its rows would place every object wrongly.
  test("PNG's predictors, row by row, as /DecodeParms gives them", () => {
    const parms = dictOf({ Predictor: 12, Columns: 3 })
    expect(decoded(flate(predicted([0, 2]), { DecodeParms: parms }), { left: MIB })).toEqual(rows)
    expect(decoded(flate(predicted([0, 0]), { DecodeParms: [parms] }), { left: MIB })).toEqual(rows)
    expect(decoded(flate(rows, { DecodeParms: dictOf({ Predictor: 1 }) }), { left: MIB })).toEqual(rows)
    // Sub, Average and Paeth, against the same rows written by hand.
    const sub = Uint8Array.of(1, 1, 1, 1, 1, 4, 1, 1)
    expect(decoded(flate(sub, { DecodeParms: dictOf({ Predictor: 11, Columns: 3 }) }), { left: MIB })).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6))
    const average = Uint8Array.of(3, 2, 3, 3, 3, 4, 4, 4)
    expect(decoded(flate(average, { DecodeParms: dictOf({ Predictor: 13, Columns: 3 }) }), { left: MIB })).toEqual(Uint8Array.of(2, 4, 5, 5, 8, 10))
    const paeth = Uint8Array.of(4, 1, 1, 1, 4, 3, 1, 1)
    expect(decoded(flate(paeth, { DecodeParms: dictOf({ Predictor: 15, Columns: 3 }) }), { left: MIB })).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6))
    // Paeth's three choices: above (b) and, where it is nearest, above and to the left (c).
    const corner = Uint8Array.of(0, 15, 20, 4, 251, 18)
    expect(decoded(flate(corner, { DecodeParms: dictOf({ Predictor: 15, Columns: 2 }) }), { left: MIB })).toEqual(Uint8Array.of(15, 20, 10, 33))
  })

  // TIFF's predictor is legal and unread; a predictor PDF does not define,
  // a PNG filter type past Paeth, or a last row cut short would each be
  // read as other bytes than the writer meant.
  test("TIFF's predictor is unsupported, and rows that do not fit the predictor are malformed", () => {
    expect(decoded(flate(rows, { DecodeParms: dictOf({ Predictor: 2, Columns: 3 }) }), { left: MIB })).toEqual(refusal('filter'))
    expect(decoded(flate(rows, { DecodeParms: dictOf({ Predictor: 7 }) }), { left: MIB })).toEqual(refusal('predictor'))
    expect(decoded(flate(Uint8Array.of(5, 1, 2, 3), { DecodeParms: dictOf({ Predictor: 12, Columns: 3 }) }), { left: MIB })).toEqual(refusal('predictor'))
    expect(decoded(flate(Uint8Array.of(0, 1, 2, 3, 0, 4), { DecodeParms: dictOf({ Predictor: 12, Columns: 3 }) }), { left: MIB })).toEqual(refusal('predictor'))
    expect(decoded(flate(rows, { DecodeParms: dictOf({ Predictor: 12, Columns: 0 }) }), { left: MIB })).toEqual(refusal('predictor'))
  })
})

describe('decoded admits', () => {
  // ASCII85 is in 116 files of the spike's sample. Each of the three is
  // decoded by pdf-lib's port of PDF.js, and refused before a byte is
  // decoded where the most it could write would pass the budget.
  test('ASCIIHex, ASCII85 and RunLength, refused before decoding where they could pass the limit', () => {
    expect(decoded(streamOf(latin1('48 65 6c6C6f>'), { Filter: name('ASCIIHexDecode') }), { left: 7 })).toEqual(latin1('Hello'))
    expect(decoded(streamOf(latin1('87cURD]j7BEbo80~>'), { Filter: name('ASCII85Decode') }), { left: 68 })).toEqual(latin1('Hello world!'))
    expect(decoded(streamOf(latin1('z~>'), { Filter: name('ASCII85Decode') }), { left: 12 })).toEqual(new Uint8Array(4))
    expect(decoded(streamOf(Uint8Array.of(0xfd, 0x41, 0x01, 0x42, 0x43, 0x80), { Filter: name('RunLengthDecode') }), { left: 384 })).toEqual(latin1('AAAABC'))
    // The most each could write: half its bytes, four times them (`z`), sixty-four times them (a run of 128 from two bytes).
    expect(decoded(streamOf(latin1('48 65 6c6C6f>'), { Filter: name('ASCIIHexDecode') }), { left: 6 })).toEqual(refusal('inflated'))
    expect(decoded(streamOf(latin1('z~>'), { Filter: name('ASCII85Decode') }), { left: 11 })).toEqual(refusal('inflated'))
    expect(decoded(streamOf(Uint8Array.of(0x81, 0x41), { Filter: name('RunLengthDecode') }), { left: 127 })).toEqual(refusal('inflated'))
  })

  // LZW is in none of the sample's files and is the one stream filter
  // whose output the reader has no decoder of its own to bound; Crypt is
  // encryption; an image's filters are the viewer's to decode, never the
  // reader's; a name PDF does not define is no filter at all.
  test('a filter outside the admitted list is unsupported-filter', () => {
    // Names an object's prototype holds are no filters either: looked up as keys of a plain object, they were found.
    for (const filter of [
      'LZWDecode',
      'Crypt',
      'DCTDecode',
      'JPXDecode',
      'CCITTFaxDecode',
      'JBIG2Decode',
      'Fl',
      'Unknown',
      'constructor',
      'toString',
      '__proto__',
    ]) {
      expect(decoded(streamOf(TEXT, { Filter: name(filter) }), { left: MIB })).toEqual(refusal('filter'))
      expect(decoded(flate(TEXT, { Filter: [name('FlateDecode'), name(filter)] }), { left: MIB })).toEqual(refusal('filter'))
    }
  })

  // A filter named by a reference is resolved by the objects the stream
  // stands among, which a stream's decode does not hold: refused rather
  // than read as no filter.
  test('a filter named other than directly, by name, is malformed', () => {
    for (const filter of [{ object: 7 }, 3, [{ object: 7 }], [3]] as const) {
      expect(decoded(streamOf(TEXT, { Filter: filter }), { left: MIB })).toEqual(refusal('filter-name'))
    }
    expect(decoded(flate(TEXT, { DecodeParms: { object: 7 } }), { left: MIB })).toEqual(refusal('filter-name'))
    expect(decoded(flate(TEXT, { DecodeParms: [{ object: 7 }] }), { left: MIB })).toEqual(refusal('filter-name'))
  })
})

describe('what decoding reaches into pako for', () => {
  // The reader hands its own Inflate to pako's, and reads the bytes after
  // the deflate data from the stream pako hands onStart: if an update of
  // pako stopped calling onStart, or consumed the checksum in raw mode,
  // every stream would be refused, or junk after one read.
  test('pako hands its stream to onStart, and leaves the bytes after the deflate data in avail_in', () => {
    let stream: ZStream | undefined
    const inflater = new Inflate({ raw: true })
    inflater.onStart = (strm: ZStream): void => {
      stream = strm
    }
    inflater.push(concat([deflate(TEXT).subarray(2), latin1('after')]), true)
    expect(inflater.err).toBe(0)
    expect(inflater.ended).toBe(true)
    expect(stream?.avail_in).toBe(4 + 'after'.length)
  })
})
