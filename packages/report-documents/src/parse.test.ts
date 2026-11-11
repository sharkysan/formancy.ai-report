import { PDFRef } from '@pdfme/pdf-lib'
import { deflate } from 'pako'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { byteStreamOf, Grammar } from './grammar.js'
import { decoded } from './inflate.js'
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_INFLATED, MAX_DOCUMENT_NESTING, MAX_DOCUMENT_OBJECTS, MAX_DOCUMENT_VALUES } from './limits.js'
import { isDict, isStream, type PdfStream } from './model.js'
import { parseDocument, type ParsedDocument } from './parse.js'
import { AT_A_BOUND, expectRefused, parsed } from './parse-test-support.js'
import { refusal } from './refusals.js'
import {
  claimingXrefStream,
  claimingXrefTable,
  contentBomb,
  countLie,
  doubleBomb,
  encryptedAesv3,
  encryptedObjectStream,
  encryptedRc4,
  encryptionDictionary,
  hugeXrefTable,
  incrementalUpdate,
  junkBetween,
  kidsCycle,
  lengthChain,
  lengthPastEnd,
  manyPages,
  nestedArrays,
  nestedDicts,
  objectsFilling,
  objectStreamBomb,
  parentCycle,
  shadow,
  threePages,
  UPDATED_CONTENT,
  xrefStreamBomb,
} from './test-hostile.js'
import {
  basic,
  CONTENT,
  concat,
  deflatedZeros,
  exactly,
  latin1,
  MIB,
  ofBytes,
  onePage,
  onePageUnderXrefStream,
  PdfWriter,
  repeated,
  withObject5,
  type XrefEntry,
} from './test-pdf.js'

/**
 * The strict parse (the documents plan's Task 4), held to the hostile
 * files the parser spike measured pdf-lib against: each written again in
 * `test-pdf.ts`, at the size its own bound refuses it at, and each refused
 * by a code a host can act on, in the reader's own words. pdf-lib as it
 * stands hangs on H6, exhausts the heap on H5 and H9, prints H11's shadow
 * and loads H2 cut short; the reader refuses each before the work that
 * would cost it.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

/** One byte under the byte bound: the files that are to be refused by a bound of their own, not by that one. */
const UNDER_BYTES = MAX_DOCUMENT_BYTES - 1

/** The content stream every file here gives its page, object 4. */
function contentOf(document: ParsedDocument): PdfStream {
  const stream = document.objects.get(4)
  if (!isStream(stream)) throw new Error('object 4 is not a stream')
  return stream
}

describe('parseDocument reads', () => {
  // The shape every later stage reads: an object missing, a trailer from
  // the wrong section or a catalog not its /Root's would print another
  // document's pages, or none.
  test('a one-page file: every object by number, the trailer, the catalog and its one page', () => {
    const document = parsed(onePage())
    expect([...document.objects.keys()].sort()).toEqual([1, 2, 3, 4])
    expect(document.catalog.entries.get('Type')).toEqual({ name: 'Catalog' })
    expect(document.trailer.entries.get('Root')).toEqual({ object: 1 })
    expect(document.pages).toEqual([3])
    expect(contentOf(document)).toEqual({
      dict: { entries: new Map([['Length', CONTENT.length]]) },
      bytes: CONTENT,
    })
  })

  // A newer writer's file: a reader that read only classic tables, or
  // read an Acrobat's predicted rows as they are, would find its objects
  // nowhere.
  test('the same file under a cross-reference stream, its rows predicted or not', () => {
    for (const predicted of [false, true]) {
      const document = parsed(onePageUnderXrefStream(predicted))
      expect(document.pages).toEqual([3])
      expect(contentOf(document).bytes).toEqual(CONTENT)
    }
  })

  // H12, Review Focus 2: a filled or signed form is saved by an update,
  // and a person expects the revision their viewer shows -- the one the
  // last cross-reference names -- never the first one written.
  test('prints the page a later revision wrote, not the first', () => {
    const document = parsed(incrementalUpdate())
    expect(contentOf(document).bytes).toEqual(UPDATED_CONTENT)
  })

  // A font's name with a space in it, and a string in a single-byte
  // encoding: read as text, either would come back as other bytes, and the
  // page would print another font, or other characters.
  test('a name and a string keep their bytes: /Times#20New and a string of 0x80-0xff read back byte for byte', () => {
    const high = Uint8Array.from({ length: 128 }, (_, i) => 0x80 + i)
    const file = withObject5(concat([latin1('<</BaseFont/Times#20New/Raw/Caf\xe9/T#79pe/Font/Text('), high, latin1(')/Hex<80ff>>>')]))
    const dict = parsed(file).objects.get(5)
    expect(isDict(dict)).toBe(true)
    expect(dict).toEqual({
      entries: new Map<string, unknown>([
        ['BaseFont', { name: 'Times#20New' }],
        ['Raw', { name: 'Caf#E9' }],
        ['Type', { name: 'Font' }],
        ['Text', { bytes: high }],
        ['Hex', { bytes: Uint8Array.of(0x80, 0xff) }],
      ]),
    })
  })

  // Nesting is bounded, not forbidden: a structure tree or an annotation's
  // appearance nests a few levels, and a bound that refused what it admits
  // would refuse real files.
  test('nesting at MAX_DOCUMENT_NESTING parses', AT_A_BOUND, () => {
    parsed(withObject5(nestedArrays(MAX_DOCUMENT_NESTING)))
    parsed(withObject5(nestedDicts(MAX_DOCUMENT_NESTING)))
  })
})

describe('parseDocument refuses', () => {
  // H1: a document a person cannot print without a password, or that its
  // author restricted, is not decrypted around them: refused as what it
  // is, from its trailer, before any of its encrypted bytes is read as if
  // it were plain.
  test('an encrypted file is refused as encrypted, and nothing is decrypted', () => {
    expectRefused(encryptionDictionary(), 'encrypted', 'encrypted')
    expectRefused(encryptedRc4(), 'encrypted', 'encrypted')
    expectRefused(encryptedAesv3(), 'encrypted', 'encrypted')
    // Its object stream, met before the trailer that says it is encrypted, is not read as a damaged one.
    expectRefused(encryptedObjectStream(), 'encrypted', 'encrypted')
  })

  // The trailer the last startxref names is read once to see whether the
  // file is encrypted, then again by the loop. Read on a count of its own,
  // a last trailer of a million values was counted once for two reads, and
  // a file past MAX_DOCUMENT_VALUES read whole: both reads are counted on
  // the document's one count, so a real trailer's few values count twice.
  test("the encryption peek is counted on the document's one count, beside the loop's read of the same object", AT_A_BOUND, () => {
    const total = (bytes: Uint8Array): number => parsed(bytes).budget.reading.total
    const table = (entries: string): Uint8Array => {
      const w = new PdfWriter()
      basic(w)
      return w.end(w.xref(`/Root 1 0 R${entries}`))
    }
    const stream = (entries: string): Uint8Array => {
      const w = new PdfWriter()
      basic(w)
      const rows = new Map<number, XrefEntry>([...w.offsets].map(([num, offset]) => [num, { kind: 'at', offset }]))
      return w.end(w.xrefStream(5, `/Root 1 0 R${entries}`, rows))
    }
    // One entry more, which counts what it counts in any object, in a classic trailer and in a cross-reference stream's dictionary: each read twice.
    const entry = total(withObject5('<</Probe 1>>')) - total(withObject5('<<>>'))
    expect(entry).toBeGreaterThan(0)
    expect(total(table('/Probe 1')) - total(table(''))).toBe(2 * entry)
    expect(total(stream('/Probe 1')) - total(stream(''))).toBe(2 * entry)
    // Numbers past half the bound in the last trailer: within it read once, past it read twice.
    expectRefused(table(`/Pad[${'1 '.repeat(MAX_DOCUMENT_VALUES / 2 + 1)}]`), 'too-many-objects', 'values')
  })

  // H2: pdf-lib loads a file cut just before `startxref` as if it were
  // whole; a person's upload that broke off would print as fewer pages.
  test('a file cut short is refused as malformed, at any point', () => {
    const whole = threePages()
    expect(parsed(whole).pages).toEqual([3, 5, 7])
    for (const fraction of [0.1, 0.5, 0.9]) expectRefused(whole.slice(0, Math.floor(whole.length * fraction)), 'malformed', 'no-eof')
    const startxref = lastIndex(whole, 'startxref')
    expectRefused(whole.slice(0, startxref), 'malformed', 'no-eof')
    // Cut inside an update, what is left ends at the first revision's end
    // and then holds half an update: not the first revision, read.
    const updated = incrementalUpdate()
    expectRefused(updated.slice(0, Math.floor(updated.length * 0.9)), 'malformed', 'after-eof')
  })

  // H3: twenty mebibytes of zeros deflate to twenty kilobytes. pdf-lib
  // inflates an object stream whole before it looks at it; the reader
  // stops at the bound, in every place a stream is inflated, and counts
  // every stage of a stream behind two filters.
  test('a Flate bomb is refused as inflates-too-far, in a content stream, an object stream and an xref stream, and behind two filters', AT_A_BOUND, () => {
    const zeros = deflatedZeros(MAX_DOCUMENT_INFLATED + 1)
    expectRefused(objectStreamBomb(zeros), 'inflates-too-far', 'inflated')
    expectRefused(xrefStreamBomb(zeros), 'inflates-too-far', 'inflated')
    for (const file of [contentBomb(zeros), doubleBomb(zeros)]) {
      const document = parsed(file)
      expect(decoded(contentOf(document), { left: MAX_DOCUMENT_INFLATED, reading: document.budget.reading })).toEqual(refusal('inflated'))
    }
  })

  // An object stream or a cross-reference stream that names a file (/F)
  // keeps its data there (ISO 32000-1 7.3.8.2), and PDF.js reads /F as
  // /Filter: read as its own bytes, the objects or the rows it lists would
  // be ones no viewer reads. Each is refused before its data is read, as
  // every stream the reader decodes is.
  test('an object stream or a cross-reference stream that keeps its data in another file is refused', () => {
    const w = new PdfWriter()
    basic(w, { page: '/Probe 5 0 R' })
    w.stream(6, '/Type/ObjStm/N 1/First 4/F(objects.bin)/Filter/FlateDecode', deflate(latin1('5 0\n<</A 1>>')))
    const entries = new Map<number, XrefEntry>([...w.offsets].map(([num, offset]) => [num, { kind: 'at', offset }]))
    entries.set(5, { kind: 'in', stream: 6, index: 0 })
    expectRefused(w.end(w.xrefStream(7, '/Root 1 0 R', entries)), 'unsupported-filter', 'external')
    const x = new PdfWriter()
    basic(x)
    const rows = new Map<number, XrefEntry>([...x.offsets].map(([num, offset]) => [num, { kind: 'at', offset }]))
    expectRefused(x.end(x.xrefStream(5, '/Root 1 0 R/F(rows.bin)', rows)), 'unsupported-filter', 'external')
  })

  // H4: pdf-lib recurses into nested arrays until V8's stack ends; the
  // reader counts its depth and refuses past the bound, however deep the
  // file goes, before the stack is in question.
  test('nesting past MAX_DOCUMENT_NESTING is refused as too-deep and nesting at it parses', AT_A_BOUND, () => {
    parsed(withObject5(nestedArrays(MAX_DOCUMENT_NESTING)))
    for (const depth of [MAX_DOCUMENT_NESTING + 1, 1e3, 1e4, 1e5, 1e6]) {
      expectRefused(withObject5(nestedArrays(depth)), 'too-deep', 'depth')
      expectRefused(withObject5(nestedDicts(depth)), 'too-deep', 'depth')
    }
  })

  // Whatever escapes the grammar -- pdf-lib's own exceptions, or the
  // engine's when the stack runs out under a host that called the reader
  // deep in its own -- is a refusal with a stable code, never thrown and
  // never the exception's words: running out of stack is too-deep, any
  // other RangeError and anything else malformed.
  test('an exception inside the parse is a refusal: out of stack too-deep, anything else malformed', () => {
    const file = onePage()
    const overflow = stackOverflow()
    expect(overflow).toBeInstanceOf(RangeError)
    for (const [thrown, finding] of [
      [overflow, 'stack'],
      // SpiderMonkey's, in Firefox: no RangeError, an InternalError.
      [Object.assign(new Error('too much recursion'), { name: 'InternalError' }), 'stack'],
      [Object.assign(new Error('something else'), { name: 'InternalError' }), 'unreadable'],
      [new RangeError('Invalid typed array length: 12345'), 'unreadable'],
      [new TypeError('Cannot read properties of undefined'), 'unreadable'],
    ] as const) {
      const indirect = vi.spyOn(Grammar.prototype, 'indirect').mockImplementation(() => {
        throw thrown
      })
      expect(parseDocument(file)).toEqual(refusal(finding))
      indirect.mockRestore()
    }
  })

  // H5: pdf-lib reads a cross-reference's entries as its /Size or /Index
  // claims, a million or two billion of them, until the heap is gone. The
  // claim is held to the bound first: a claim within it and no entries is
  // refused for its missing entries, a claim past it before any is read.
  test('an xref that claims more objects than MAX_DOCUMENT_OBJECTS is refused before its entries are read', AT_A_BOUND, () => {
    expectRefused(claimingXrefTable(MAX_DOCUMENT_OBJECTS + 1), 'malformed', 'xref-entry')
    expectRefused(claimingXrefTable(MAX_DOCUMENT_OBJECTS + 2), 'too-many-objects', 'xref-claim')
    expectRefused(hugeXrefTable(), 'too-many-objects', 'xref-claim')
    expectRefused(claimingXrefStream('2147483647', [4, 8, 4], '0 2147483647'), 'too-many-objects', 'xref-claim')
    expectRefused(claimingXrefStream('6', [1, 2, 1], '0 2147483647'), 'too-many-objects', 'xref-claim')
    expectRefused(claimingXrefStream('6', [4, 8, 4], '0 6'), 'malformed', 'xref-stream')
    // The spike's H5-xrefstm-short claims within the bound but past its own /Size; within both, its rows are short.
    expectRefused(claimingXrefStream('6', [1, 2, 1], '0 100000'), 'malformed', 'xref-size')
    expectRefused(claimingXrefStream('100000', [1, 2, 1], '0 100000'), 'malformed', 'xref-stream-rows')
  })

  // H6: pdf-lib skips junk a byte at a time, trying an object at each, and
  // never finishes twenty mebibytes of digits. The reader reads one object
  // header and refuses: nothing between objects is skipped.
  test('digits between objects are refused at the first, however many follow', AT_A_BOUND, () => {
    expectRefused(
      exactly(UNDER_BYTES, (fill) => junkBetween(fill, 10)),
      'malformed',
      'object-header',
    )
    expectRefused(
      exactly(UNDER_BYTES, (fill) => junkBetween(fill, MIB)),
      'malformed',
      'number-length',
    )
  })

  // Review Focus 1: a viewer skips what it cannot read and opens the file;
  // the reader refuses it, and the person reads why and what to do, never
  // the bytes it found.
  test('junk between objects is refused as malformed, with a message that names no byte of the file and says how to save it again', () => {
    const file = onePage({}, (w) => w.raw('JUNKMARKER 12345 (a string) /AName\n'))
    expectRefused(file, 'malformed', 'between-objects')
    const result = parseDocument(file)
    if (!('ok' in result)) throw new Error('read')
    expect(result.message).toContain('save it again as a PDF from the program that made it')
    for (const quoted of ['JUNKMARKER', '12345', 'a string', 'AName']) expect(result.message).not.toContain(quoted)
  })

  // H7: pdf-lib recurses around a /Kids or /Parent cycle until the stack
  // ends, and never reads /Count: a page tree that is not a tree prints
  // pages twice, or a thousand million of them, or none.
  test('a cycle of /Kids, a /Parent cycle and a /Count that lies are refused as page-tree', () => {
    expectRefused(kidsCycle(), 'page-tree', 'pages-twice')
    expectRefused(parentCycle(), 'page-tree', 'pages-root-parent')
    expectRefused(countLie(), 'page-tree', 'pages-count')
  })

  // H8: a file of a million tiny objects, or of a hundred thousand pages,
  // within the byte bound: pdf-lib took 16 s on the first. The reader
  // counts definitions as it reads them and refuses at the bound.
  test('more objects than MAX_DOCUMENT_OBJECTS are refused as they are read', AT_A_BOUND, () => {
    expectRefused(objectsFilling(UNDER_BYTES), 'too-many-objects', 'objects')
  })

  // H8's other file: a hundred thousand pages, each an object of its own,
  // reach the objects bound while they are read, before a tree of them is
  // walked or a page of them laid out.
  test('a hundred thousand pages are refused as too many objects, before the tree is walked', AT_A_BOUND, () => {
    expectRefused(manyPages(100_000), 'too-many-objects', 'objects')
  })

  // H9: one token of twenty mebibytes. pdf-lib reads it a character at a
  // time into a string until the heap is gone; the reader measures it
  // first and refuses it past its bound.
  test('a name, a string or a number of twenty mebibytes is refused before it is read', AT_A_BOUND, () => {
    const filled = (open: string, fill: number, byte: string, close = ''): Uint8Array =>
      withObject5(concat([latin1(open), repeated(byte, fill), latin1(close)]))
    expectRefused(
      exactly(UNDER_BYTES, (fill) => filled('/', fill, 'A')),
      'malformed',
      'name-length',
    )
    expectRefused(
      exactly(UNDER_BYTES, (fill) => filled('(', fill, 'A', ')')),
      'malformed',
      'string-length',
    )
    expectRefused(
      exactly(UNDER_BYTES, (fill) => filled('', fill, '1')),
      'malformed',
      'number-length',
    )
  })

  // H10: pdf-lib searches for `endstream` wherever a /Length is wrong, and
  // follows a /Length through any chain of references: a stream that is
  // not where it says is read as some other bytes. The chain's first link
  // is an object that is nothing but a reference, refused as one.
  test('a /Length past the file, or one behind a chain of references, is refused as malformed', () => {
    expectRefused(lengthPastEnd(), 'malformed', 'stream-past-end')
    expectRefused(lengthChain(10_000), 'malformed', 'bare-reference')
    expect(contentOf(parsed(lengthChain(0))).bytes).toEqual(CONTENT)
  })

  // An object whose whole value is a reference to another makes every
  // look-up a chain: the reader resolves a reference one level, as it
  // resolves a box, a filter or an action, and would read the reference
  // where the object it names belongs -- a box of no numbers, a page with
  // no content -- where a viewer follows it. None of the spike's 1,484
  // files holds one, at the top level or in an object stream, so the file
  // is refused, wherever the object stands; a definition the
  // cross-reference does not name -- freed by an update -- is nothing to
  // every viewer, and is not refused for what it held.
  test('an object that is nothing but a reference to another is refused, at the top level and in an object stream', () => {
    expectRefused(withObject5('6 0 R'), 'malformed', 'bare-reference')
    const w = new PdfWriter()
    basic(w, { page: '/Probe 5 0 R' })
    const entries = new Map<number, XrefEntry>([...w.offsets].map(([num, offset]) => [num, { kind: 'at', offset }]))
    for (const [num, entry] of w.objectStream(6, [[5, '1 0 R']])) entries.set(num, entry)
    entries.set(6, { kind: 'at', offset: w.offsets.get(6) ?? 0 })
    expectRefused(w.end(w.xrefStream(7, '/Root 1 0 R', entries)), 'malformed', 'bare-reference')
    const v = new PdfWriter()
    basic(v)
    v.object(5, '6 0 R')
    const first = v.xref('/Root 1 0 R')
    v.raw(`startxref\n${first}\n%%EOF\n`)
    expect(parsed(v.end(v.xref(`/Root 1 0 R/Prev ${first}`, new Map([[5, 'free']]), 6))).objects.has(5)).toBe(false)
  })

  // H11, Review Focus 2: pdf-lib keeps the last definition written whatever
  // the cross-reference says, so it prints a page no viewer shows. A file
  // whose cross-reference and objects disagree prints differently in
  // different viewers, and is refused rather than printed one way.
  test('a file whose cross-reference names an earlier definition than the last one written is refused as xref-disagrees', () => {
    expectRefused(shadow(), 'xref-disagrees', 'shadow')
  })

  // The byte bound is held before anything is read: one byte past it is
  // refused whatever the bytes are, and a file at it is read.
  test('a file past MAX_DOCUMENT_BYTES is refused before a byte is parsed', AT_A_BOUND, () => {
    parsed(ofBytes(MAX_DOCUMENT_BYTES))
    const past = ofBytes(MAX_DOCUMENT_BYTES + 1)
    expectRefused(past, 'too-large', 'bytes')
    // Not parsed: the same bytes with their header broken are still too large, not not-pdf.
    past[0] = 0
    expectRefused(past, 'too-large', 'bytes')
  })

  // isPdf's rule, the reader's too: a header past a byte-order mark or a
  // space is one a viewer may find and the strict reader does not look for.
  test('bytes that do not begin as a PDF begins are refused as not-pdf', () => {
    expectRefused(latin1('hello'), 'not-pdf', 'header')
    expectRefused(concat([Uint8Array.of(0xef, 0xbb, 0xbf), onePage()]), 'not-pdf', 'header')
  })
})

describe('what the parse reaches into pdf-lib for', () => {
  // pdf-lib's PDFRef.of keeps every reference it makes in a module-level
  // pool for the life of the process: the spike measured 124 MiB kept after
  // a file of 900,000 distinct ones. The reader makes its references
  // itself. The pool is not exported, so the test reads the one way into
  // it, pdf-lib's static PDFRef.of, which must not be called.
  test("no reference a file holds reaches pdf-lib's pool, which keeps them for the life of the process", () => {
    const of = vi.spyOn(PDFRef, 'of')
    const document = parsed(withObject5(`[${Array.from({ length: 100 }, (_, i) => `${i + 10} 0 R`).join(' ')}]`))
    expect(document.objects.get(5)).toHaveLength(100)
    expect(of).not.toHaveBeenCalled()
  })

  // pdf-lib does not export the ByteStream its grammar reads through; the
  // reader takes the one a parser holds in the protected field `bytes`.
  // Renamed or reshaped by an update of pdf-lib, the reader would read
  // nothing, or from the wrong place: this fails first.
  test('a PDFObjectParser holds its ByteStream in `bytes`, which reads, moves and asserts as the reader uses it', () => {
    const stream = byteStreamOf(latin1('ab'))
    expect(stream.offset()).toBe(0)
    expect(stream.peek()).toBe(0x61)
    expect(stream.next()).toBe(0x61)
    expect(stream.offset()).toBe(1)
    expect(stream.done()).toBe(false)
    expect(() => stream.assertNext(0x61)).toThrow()
    expect(stream.assertNext(0x62)).toBe(0x62)
    expect(stream.done()).toBe(true)
    stream.moveTo(0)
    expect(stream.peek()).toBe(0x61)
  })
})

function lastIndex(bytes: Uint8Array, word: string): number {
  const text = latin1(word)
  for (let at = bytes.length - text.length; at >= 0; at -= 1) if (text.every((byte, i) => bytes[at + i] === byte)) return at
  return -1
}

/** The engine's own exception for a stack that ran out, as unbounded recursion throws it. */
function stackOverflow(): unknown {
  const recurse = (depth: number): number => recurse(depth + 1) + 1
  try {
    return recurse(0)
  } catch (error) {
    return error
  }
}
