import { deflate, Inflate, type ZStream } from 'pako'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { BoundedInflate, decoded, type InflateBudget } from './inflate.js'
import { DECODER_VALUES, INFLATER_VALUES, MAX_DOCUMENT_VALUES } from './limits.js'
import type { PdfDict, PdfStream, PdfValue } from './model.js'
import { AT_A_BOUND } from './parse-test-support.js'
import { Reading } from './reading.js'
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

/** A budget of `left` bytes, on a reading of its own that has counted `counted` values already. */
function budgetOf(left: number, counted = 0): InflateBudget {
  const reading = new Reading()
  reading.counted(counted)
  return { left, reading }
}

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
    expect(decoded(flate(new Uint8Array(MIB)), budgetOf(limit))).toEqual(refusal('inflated'))
    // Every chunk is whole until the one that passes the limit, and none follows it.
    const lengths = onData.mock.calls.map(([chunk]) => chunk.length)
    const before = lengths.slice(0, -1).reduce((sum, length) => sum + length, 0)
    expect(before).toBeLessThanOrEqual(limit)
    expect(before + (lengths.at(-1) ?? 0)).toBeGreaterThan(limit)
    expect(new Set(lengths).size).toBe(1)
  })

  // pako writes a stream into chunks of one size, 64 KiB unless it is told
  // otherwise, and allocates the first however short the stream: a hundred
  // thousand streams of a byte each cost 6.1 GiB of chunks that held a byte
  // each, and the collection of them took most of a read past a second. A
  // stream is written into chunks four times its input, from 1 KiB, and
  // never more than pako's 64 KiB.
  test('a stream is inflated into chunks sized to its input, from 1 KiB, never past 64 KiB', () => {
    const started = vi.spyOn(BoundedInflate.prototype, 'onStart')
    const chunkOf = (stream: PdfStream): number => {
      started.mockClear()
      decoded(stream, budgetOf(64 * MIB))
      return (started.mock.calls[0]?.[0] as ZStream).output.length
    }
    expect(chunkOf(flate(TEXT))).toBe(1024)
    const middling = deflate(
      Uint8Array.from({ length: 6 * 1024 }, (_, at) => (at * 2_654_435_761) >>> 24),
      { level: 0 },
    )
    expect(chunkOf(streamOf(middling, { Filter: name('FlateDecode') }))).toBe(4 * (middling.length - 2))
    const large = deflate(
      Uint8Array.from({ length: 64 * 1024 }, (_, at) => (at * 2_654_435_761) >>> 24),
      { level: 0 },
    )
    expect(chunkOf(streamOf(large, { Filter: name('FlateDecode') }))).toBe(65_536)
  })

  // The bound is the document's, not each stream's: two streams that each
  // fit must not together pass it, nor the two stages of one stream.
  test('every stage of every stream is taken from one budget', () => {
    const budget = budgetOf(3 * 1024)
    expect(decoded(flate(new Uint8Array(2048)), budget)).toEqual(new Uint8Array(2048))
    expect(budget.left).toBe(1024)
    expect(decoded(flate(new Uint8Array(2048)), budget)).toEqual(refusal('inflated'))
    const twice = streamOf(deflate(deflate(new Uint8Array(4096))), { Filter: [name('FlateDecode'), name('FlateDecode')] })
    const first = deflate(new Uint8Array(4096)).length
    const exact = budgetOf(first + 4096)
    expect(decoded(twice, exact)).toEqual(new Uint8Array(4096))
    expect(exact.left).toBe(0)
    expect(decoded(twice, budgetOf(first + 4095))).toEqual(refusal('inflated'))
  })

  // A stream with no filter is its bytes: nothing was decoded, so nothing
  // is charged against what the document may decode.
  test('a stream with no filter is its bytes, and costs nothing', () => {
    const budget = budgetOf(0)
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
    expect(decoded(streamOf(bytes, { Filter: name('FlateDecode') }), budgetOf(MIB))).toEqual(TEXT)
  })

  // What follows the deflate data inside the stream is its checksum and
  // perhaps the end of line a writer counted in /Length. Anything else is
  // bytes no viewer shows and the reader would hand on as part of the
  // stream: refused.
  test('a stream with bytes after its end is malformed', () => {
    const bytes = deflate(TEXT)
    expect(decoded(streamOf(concat([bytes, latin1('\r\n')]), { Filter: name('FlateDecode') }), budgetOf(MIB))).toEqual(TEXT)
    expect(decoded(streamOf(concat([bytes, latin1('\r\nq 1 0 0 1 0 0 cm')]), { Filter: name('FlateDecode') }), budgetOf(MIB))).toEqual(refusal('flate-after'))
  })

  // A stream cut short inflates to the start of what it held: printed, it
  // would be a page with its end missing.
  test('a stream cut short is malformed', () => {
    const bytes = deflate(new Uint8Array(4096).fill(0x41))
    expect(decoded(streamOf(bytes.subarray(0, bytes.length - 8), { Filter: name('FlateDecode') }), budgetOf(MIB))).toEqual(refusal('flate-data'))
    expect(decoded(streamOf(latin1('x\x9cnot deflate data'), { Filter: name('FlateDecode') }), budgetOf(MIB))).toEqual(refusal('flate-data'))
  })

  // The zlib header is checked as PDF.js checks it -- deflate, a check
  // that holds, no preset dictionary -- since the data is inflated raw.
  test('a stream whose zlib header is not one is malformed', () => {
    const bytes = deflate(TEXT)
    for (const header of [[0x78], [0x79, 0x9c], [0x78, 0x9d], [0x78, 0xbb]]) {
      const broken = concat([Uint8Array.from(header), bytes.subarray(2)])
      expect(decoded(streamOf(header.length === 1 ? Uint8Array.from(header) : broken, { Filter: name('FlateDecode') }), budgetOf(MIB))).toEqual(
        refusal('flate-header'),
      )
    }
  })
})

describe('a decoder is counted as it is built', () => {
  // A stage of a stream's filters builds a decoder of its own, whatever it
  // decodes: a file within every bound named six Flate stages for each of
  // 95,000 streams, and read whole had built 570,000 pako inflaters; eight
  // RunLength stages for each of 80,000, 640,000 of pdf-lib's decoders.
  // Each is counted on the document's reading against MAX_DOCUMENT_VALUES
  // where it is built -- an inflater as INFLATER_VALUES, a decoder of a
  // fixed ratio as DECODER_VALUES -- so a file of them is refused at what
  // they cost, before the one past the bound is built.
  test('every stage of a stream is counted for the decoder it builds, a Flate stage as INFLATER_VALUES, any other as DECODER_VALUES', () => {
    let deflated = TEXT
    for (let i = 0; i < 6; i += 1) deflated = deflate(deflated)
    const flates = streamOf(deflated, { Filter: Array.from({ length: 6 }, () => name('FlateDecode')) })
    expect(decoded(flates, budgetOf(MIB, MAX_DOCUMENT_VALUES - 6 * INFLATER_VALUES))).toEqual(TEXT)
    expect(decoded(flates, budgetOf(MIB, MAX_DOCUMENT_VALUES - 6 * INFLATER_VALUES + 1))).toEqual(refusal('values'))
    const fixed = streamOf(latin1('48656C6C6F>'), { Filter: name('ASCIIHexDecode') })
    expect(decoded(fixed, budgetOf(MIB, MAX_DOCUMENT_VALUES - DECODER_VALUES))).toEqual(latin1('Hello'))
    expect(decoded(fixed, budgetOf(MIB, MAX_DOCUMENT_VALUES - DECODER_VALUES + 1))).toEqual(refusal('values'))
    const runs = streamOf(Uint8Array.of(0x04, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x80), { Filter: name('RunLengthDecode') })
    expect(decoded(runs, budgetOf(MIB, MAX_DOCUMENT_VALUES - DECODER_VALUES + 1))).toEqual(refusal('values'))
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
    expect(decoded(flate(TEXT), budgetOf(MIB))).toEqual(refusal('unreadable'))
  })
})

describe('decoded undoes a predictor', () => {
  const rows = Uint8Array.of(1, 2, 3, 4, 5, 6)
  const predicted = (types: readonly number[]): Uint8Array => Uint8Array.of(types[0] ?? 0, 1, 2, 3, types[1] ?? 0, ...(types[1] === 2 ? [3, 3, 3] : [4, 5, 6]))

  // Acrobat writes its cross-reference streams under PNG's Up predictor;
  // read as they are, its rows would place every object wrongly.
  test("PNG's predictors, row by row, as /DecodeParms gives them", () => {
    const parms = dictOf({ Predictor: 12, Columns: 3 })
    expect(decoded(flate(predicted([0, 2]), { DecodeParms: parms }), budgetOf(MIB))).toEqual(rows)
    expect(decoded(flate(predicted([0, 0]), { DecodeParms: [parms] }), budgetOf(MIB))).toEqual(rows)
    expect(decoded(flate(rows, { DecodeParms: dictOf({ Predictor: 1 }) }), budgetOf(MIB))).toEqual(rows)
    // Sub, Average and Paeth, against the same rows written by hand.
    const sub = Uint8Array.of(1, 1, 1, 1, 1, 4, 1, 1)
    expect(decoded(flate(sub, { DecodeParms: dictOf({ Predictor: 11, Columns: 3 }) }), budgetOf(MIB))).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6))
    const average = Uint8Array.of(3, 2, 3, 3, 3, 4, 4, 4)
    expect(decoded(flate(average, { DecodeParms: dictOf({ Predictor: 13, Columns: 3 }) }), budgetOf(MIB))).toEqual(Uint8Array.of(2, 4, 5, 5, 8, 10))
    const paeth = Uint8Array.of(4, 1, 1, 1, 4, 3, 1, 1)
    expect(decoded(flate(paeth, { DecodeParms: dictOf({ Predictor: 15, Columns: 3 }) }), budgetOf(MIB))).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6))
    // Paeth's three choices: above (b) and, where it is nearest, above and to the left (c).
    const corner = Uint8Array.of(0, 15, 20, 4, 251, 18)
    expect(decoded(flate(corner, { DecodeParms: dictOf({ Predictor: 15, Columns: 2 }) }), budgetOf(MIB))).toEqual(Uint8Array.of(15, 20, 10, 33))
  })

  // TIFF's predictor is legal and unread; a predictor PDF does not define,
  // a PNG filter type past Paeth, or a last row cut short would each be
  // read as other bytes than the writer meant.
  test("TIFF's predictor is unsupported, and rows that do not fit the predictor are malformed", () => {
    expect(decoded(flate(rows, { DecodeParms: dictOf({ Predictor: 2, Columns: 3 }) }), budgetOf(MIB))).toEqual(refusal('filter'))
    expect(decoded(flate(rows, { DecodeParms: dictOf({ Predictor: 7 }) }), budgetOf(MIB))).toEqual(refusal('predictor'))
    expect(decoded(flate(Uint8Array.of(5, 1, 2, 3), { DecodeParms: dictOf({ Predictor: 12, Columns: 3 }) }), budgetOf(MIB))).toEqual(refusal('predictor'))
    expect(decoded(flate(Uint8Array.of(0, 1, 2, 3, 0, 4), { DecodeParms: dictOf({ Predictor: 12, Columns: 3 }) }), budgetOf(MIB))).toEqual(refusal('predictor'))
    expect(decoded(flate(rows, { DecodeParms: dictOf({ Predictor: 12, Columns: 0 }) }), budgetOf(MIB))).toEqual(refusal('predictor'))
  })
})

describe('decoded admits', () => {
  // ASCII85 is in 116 files of the spike's sample. Each of the three is
  // decoded by pdf-lib's port of PDF.js, and refused before a byte is
  // decoded where the most it could write would pass the budget.
  test('ASCIIHex, ASCII85 and RunLength, refused before decoding where they could pass the limit', () => {
    expect(decoded(streamOf(latin1('48 65 6c6C6f>'), { Filter: name('ASCIIHexDecode') }), budgetOf(7))).toEqual(latin1('Hello'))
    expect(decoded(streamOf(latin1('87cURD]j7BEbo80~>'), { Filter: name('ASCII85Decode') }), budgetOf(68))).toEqual(latin1('Hello world!'))
    expect(decoded(streamOf(latin1('z~>'), { Filter: name('ASCII85Decode') }), budgetOf(12))).toEqual(new Uint8Array(4))
    expect(decoded(streamOf(Uint8Array.of(0xfd, 0x41, 0x01, 0x42, 0x43, 0x80), { Filter: name('RunLengthDecode') }), budgetOf(384))).toEqual(latin1('AAAABC'))
    // The most each could write: half its bytes, four times them (`z`), sixty-four times them (a run of 128 from two bytes).
    expect(decoded(streamOf(latin1('48 65 6c6C6f>'), { Filter: name('ASCIIHexDecode') }), budgetOf(6))).toEqual(refusal('inflated'))
    expect(decoded(streamOf(latin1('z~>'), { Filter: name('ASCII85Decode') }), budgetOf(11))).toEqual(refusal('inflated'))
    expect(decoded(streamOf(Uint8Array.of(0x81, 0x41), { Filter: name('RunLengthDecode') }), budgetOf(127))).toEqual(refusal('inflated'))
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
      expect(decoded(streamOf(TEXT, { Filter: name(filter) }), budgetOf(MIB))).toEqual(refusal('filter'))
      expect(decoded(flate(TEXT, { Filter: [name('FlateDecode'), name(filter)] }), budgetOf(MIB))).toEqual(refusal('filter'))
    }
  })

  // A filter named by a reference is resolved by the objects the stream
  // stands among, which a stream's decode does not hold: refused rather
  // than read as no filter.
  test('a filter named other than directly, by name, is malformed', () => {
    for (const filter of [{ object: 7 }, 3, [{ object: 7 }], [3]] as const) {
      expect(decoded(streamOf(TEXT, { Filter: filter }), budgetOf(MIB))).toEqual(refusal('filter-name'))
    }
    expect(decoded(flate(TEXT, { DecodeParms: { object: 7 } }), budgetOf(MIB))).toEqual(refusal('filter-name'))
    expect(decoded(flate(TEXT, { DecodeParms: [{ object: 7 }] }), budgetOf(MIB))).toEqual(refusal('filter-name'))
  })

  // A stream whose dictionary names a file (/F) keeps its data there, and
  // its filters for it under /FFilter and /FDecodeParms (ISO 32000-1
  // 7.3.8.2): read as its own bytes, unfiltered, it would be what no viewer
  // reads -- and PDF.js reads /F as /Filter, so a bomb named /F
  // /FlateDecode would pass the reader as data it never inflated and
  // inflate in PDF.js. Refused before a byte of it is read, nothing taken
  // from the budget; Report never fetches by address.
  test('a stream that keeps its data in another file is refused before its data is read', AT_A_BOUND, () => {
    const budget = budgetOf(MIB)
    const bomb = deflate(new Uint8Array(2 * MIB))
    for (const entries of [{ F: { bytes: latin1('data.bin') } }, { F: name('FlateDecode') }, { FFilter: name('FlateDecode') }, { FDecodeParms: dictOf({}) }]) {
      expect(decoded(streamOf(bomb, entries), budget)).toEqual(refusal('external'))
      expect(decoded(flate(TEXT, entries), budget)).toEqual(refusal('external'))
    }
    expect(budget.left).toBe(MIB)
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

  // The reader sizes the chunks pako writes into by the option pako reads
  // them from: if an update of pako ignored `chunkSize`, or allocated its
  // output elsewhere, every stream would again cost a 64 KiB chunk, and the
  // test above would see the size pako used, not the size it was asked for.
  test('pako allocates its output as `chunkSize` asks, on the stream it hands onStart', () => {
    for (const chunkSize of [1024, 65_536]) {
      let stream: ZStream | undefined
      const inflater = new Inflate({ raw: true, chunkSize })
      inflater.onStart = (strm: ZStream): void => {
        stream = strm
      }
      inflater.push(deflate(TEXT).subarray(2), true)
      expect(inflater.err).toBe(0)
      expect(stream?.output.length).toBe(chunkSize)
    }
  })
})
