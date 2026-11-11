import { PDFDocument, PDFName } from '@pdfme/pdf-lib'
import fc from 'fast-check'
import { deflate } from 'pako'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { annotation, widget } from './annotations-test-support.js'
import { Tally } from './notices.js'
import { leaf, pagesFile } from './pages-test-support.js'
import { AT_A_BOUND } from './parse-test-support.js'
import { readDocument, type DocumentRead, type PrintableDocument } from './read.js'
import { DOCUMENT_REFUSAL_CODES, refusal } from './refusals.js'
import { CONTENT, latin1, onePageUnderXrefStream, withObject5 } from './test-pdf.js'

/**
 * `readDocument`, the reader's one entry: a PDF's bytes read whole -- its
 * pages, every object they draw with, and what does not survive printing
 * -- or refused, and never anything thrown, never a part of it, and
 * nothing that changes when the caller's bytes do.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Two pages that touch every part of the read: the first draws a font
 * whose file is compressed, an image and a form, within a transparency
 * group, its content compressed and holding an inline image; the second
 * lists a filled field, which prints its appearance with a font of its
 * own, and a link without a border; the catalog runs a script on opening.
 */
function sample(): Uint8Array {
  const resources = '<</Font<</F1 20 0 R>>/XObject<</Im0 30 0 R/Fm0 31 0 R>>>>'
  const group = '/Group<</S/Transparency/CS 40 0 R>>'
  const first = leaf(`/MediaBox[0 0 612 792]/Resources ${resources}/Contents 4 0 R${group}`)
  const second = leaf('/MediaBox[0 0 595 842]/Rotate 90/Resources<<>>/Annots[50 0 R 51 0 R]')
  return pagesFile(
    [first, second],
    {
      4: { dict: '/Filter/FlateDecode', data: deflate(latin1('q BI /W 1/H 1/CS/G/BPC 8 ID x\nEI Q /Im0 Do /Fm0 Do 0 0 m 10 10 l S\n')) },
      20: '<</Type/Font/Subtype/TrueType/BaseFont/Probe/FontDescriptor 21 0 R>>',
      21: '<</Type/FontDescriptor/FontName/Probe/FontFile2 22 0 R>>',
      22: { dict: '/Filter/FlateDecode', data: deflate(latin1('a font file of no glyphs')) },
      30: {
        dict: '/Type/XObject/Subtype/Image/Width 2/Height 2/ColorSpace/DeviceGray/BitsPerComponent 8/Filter/FlateDecode',
        data: deflate(new Uint8Array(4)),
      },
      31: { dict: '/Type/XObject/Subtype/Form/BBox[0 0 10 10]/Resources<<>>', data: CONTENT },
      40: '/DeviceRGB',
      50: widget('/FT/Tx/T(Name)/V(Jane Doe)/Rect[72 700 272 740]/AP<</N 52 0 R>>'),
      51: annotation('Link', '/Rect[0 0 10 10]/Border[0 0 0]/A<</S/URI/URI(https://example.invalid)>>'),
      52: { dict: '/Type/XObject/Subtype/Form/BBox[0 0 100 20]/Resources<</Font<</Helv 53 0 R>>>>', data: CONTENT },
      53: '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    },
    { catalog: '/OpenAction<</S/JavaScript/JS(app.alert(1))>>' },
  )
}

/** The document `read` holds, failing the test where it is a refusal. */
function whole(read: DocumentRead): PrintableDocument {
  if (!read.ok) throw new Error(`refused: ${read.message}`)
  return read.document
}

/** A refusal's message without the places the reader counted -- an annotation, its subtype, a page -- which are its own words and numbers. */
const unplaced = (message: string): string => message.replace(/, annotation \d+( \([A-Za-z0-9]+\))?/, '').replace(/, on page \d+/, '')

describe('readDocument reads a document whole', () => {
  // The composition is the reader's one: a page's resources, its group and
  // its appearances' forms are what the closure is taken from, and the
  // notices are counted from the pages and the catalog together. A root
  // left out would leave a font an appearance draws with out of the
  // objects a renderer copies, and the report would print the field in
  // another face, or not at all.
  test('its pages, every object they draw with -- through their resources, groups and appearances -- and what does not survive printing', () => {
    const document = whole(readDocument(sample()))
    expect(Object.keys(document)).toEqual(['pages', 'objects', 'notices'])
    expect(document.pages.map((page) => [page.width, page.height, page.rotate, page.appearances.length])).toEqual([
      [612, 792, 0, 0],
      [842, 595, 90, 1],
    ])
    expect([...document.objects.keys()].sort((a, b) => a - b)).toEqual([20, 21, 22, 30, 31, 40, 53])
    expect(document.notices).toEqual([
      { code: 'links', count: 1 },
      { code: 'javascript', count: 1 },
      { code: 'form-fields', count: 1 },
    ])
  })
})

describe('readDocument never throws', () => {
  // A host calls the reader on whatever a person uploads: an exception
  // that escaped it would be a server's 500 and a builder's broken panel,
  // and its message may quote the file. A seeded fuzz -- reproducible, two
  // thousand files, each the sample with up to three splices of random
  // bytes or of PDF's own tokens, most of them in place so that the
  // cross-reference still finds the objects and the read goes deep -- must
  // each read whole or be refused, by one of the reader's codes, in its
  // own words.
  test('readDocument never throws: a parser exception is a malformed refusal', AT_A_BOUND, () => {
    const file = sample()
    const TOKENS = ['0', '9', ' ', '\n', '(', ')', '<', '>', '<<', '>>', '[', ']', '/', '#', '%', 'R', ' 0 R', 'obj', 'endobj', 'stream\n', 'endstream']
    const MORE = ['xref', 'trailer', 'BI', ' ID ', 'EI', '-', '.', '1e9', '99999999999999999999', '/Filter/FlateDecode', '/Length 0', '/Parent 2 0 R']
    const piece = fc.oneof(
      { weight: 1, arbitrary: fc.uint8Array({ minLength: 1, maxLength: 8 }) },
      { weight: 3, arbitrary: fc.constantFrom(...TOKENS, ...MORE).map(latin1) },
    )
    // Anywhere in the file, evenly: fast-check leans a number towards its ends, which here is the header.
    const at = fc.noBias(fc.nat({ max: file.length }))
    const splice = fc.oneof(
      { weight: 8, arbitrary: fc.record({ at, put: piece }).map((each) => ({ ...each, cut: each.put.length })) },
      { weight: 2, arbitrary: fc.record({ at, cut: fc.nat({ max: 16 }), put: piece }) },
      { weight: 1, arbitrary: fc.record({ at, cut: fc.nat(), put: piece }) },
    )
    const counts = { read: 0, refused: 0 }
    fc.assert(
      fc.property(fc.array(splice, { minLength: 1, maxLength: 3 }), (splices) => {
        let bytes = file
        for (const splice of splices) {
          const from = Math.min(splice.at, bytes.length)
          bytes = Uint8Array.from([...bytes.subarray(0, from), ...splice.put, ...bytes.subarray(from + splice.cut)])
        }
        const read = readDocument(bytes)
        if (read.ok) {
          counts.read += 1
          expect(read.document.pages.length).toBeGreaterThan(0)
        } else {
          counts.refused += 1
          expect(DOCUMENT_REFUSAL_CODES).toContain(read.code)
          expect(unplaced(read.message)).toMatch(/^[A-Za-z ,;'-]+$/)
        }
      }),
      { seed: 20_261_105, numRuns: 2_000 },
    )
    // Neither half empty: a fuzz whose every file was refused at its header would show nothing of the read.
    expect(counts.read).toBeGreaterThan(0)
    expect(counts.refused).toBeGreaterThan(0)
  })

  // The stages each catch what they throw; what runs after them -- the
  // notices, the result's freezing -- is caught at the reader's edge too:
  // anything thrown there is the reader's own refusal, never the
  // exception, whose words may be anything.
  test('an exception after the pages and the closure are read is a malformed refusal too', () => {
    vi.spyOn(Tally.prototype, 'notices').mockImplementation(() => {
      throw new TypeError('a fault of the reader, quoting (Jane Doe)')
    })
    const read = readDocument(sample())
    expect(read).toEqual(refusal('unreadable'))
    // Frozen as a refusal a stage returns is: a host holds every read alike.
    expect(Object.isFrozen(read)).toBe(true)
  })

  // A host that is not TypeScript may hand over an ArrayBuffer, a DataView
  // or anything else: an ArrayBuffer has no length, so it passed the byte
  // bound unread, and was read as a view of the caller's buffer, which a
  // later write changed under the read. A Proxy can throw from any trap,
  // and threw out of the reader through the very check that caught it.
  // Anything but a Uint8Array is refused before a property of it is read,
  // by a check no trap sees.
  test('anything but a Uint8Array is refused before a property of it is read', () => {
    const file = sample()
    const traps: string[] = []
    const hostile = new Proxy(file, {
      ...Object.fromEntries(
        (['get', 'has', 'getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor', 'apply', 'construct'] as const).map((trap) => [
          trap,
          (): never => {
            traps.push(trap)
            throw new Error('a trap')
          },
        ]),
      ),
    })
    for (const input of [file.buffer, new DataView(file.buffer), [...file], 'a string', hostile]) {
      expect(readDocument(input as unknown as Uint8Array)).toEqual(refusal('not-bytes'))
    }
    expect(traps).toEqual([])
  })

  // An iframe's or a vm's Uint8Array is no instance of this realm's, and
  // the check that refuses an ArrayBuffer unread refuses it too: a host
  // that holds bytes of another realm copies them into its own first. This
  // fails closed, where a check that let it through would have to read it.
  test('a Uint8Array of another realm is refused, until a host copies it into its own', () => {
    const vm = (
      globalThis as unknown as { process: { getBuiltinModule: (id: string) => { runInNewContext: (code: string) => unknown } } }
    ).process.getBuiltinModule('node:vm')
    const file = sample()
    const foreign = vm.runInNewContext(`new Uint8Array(${file.length})`) as Uint8Array
    foreign.set(file)
    expect(foreign instanceof Uint8Array).toBe(false)
    expect(readDocument(foreign)).toEqual(refusal('not-bytes'))
    expect(readDocument(Uint8Array.from(foreign)).ok).toBe(true)
  })
})

describe('readDocument holds a copy of its own', () => {
  // A host may reuse the buffer it read a file into -- the next upload, a
  // pool -- or another thread may write a SharedArrayBuffer while the read
  // runs: a document whose streams were views of the caller's bytes would
  // print the next file's bytes, or bytes that changed after they were
  // checked. Node's Buffer, which a host reads a file into, slices to a
  // view and not a copy, so a reader that copied by slice would keep the
  // caller's bytes all the same. What the read returns is frozen where
  // JavaScript can freeze it: the document, its pages and theirs, its
  // notices; a Map and a typed array cannot be.
  test("a frozen, deep copy: changing the caller's bytes after the read changes nothing it returned", () => {
    /** A Uint8Array whose slice is a view, as Node's Buffer's is. */
    class Viewing extends Uint8Array {
      override slice(start?: number, end?: number): Uint8Array<ArrayBuffer> {
        return this.subarray(start, end)
      }
    }
    const expected = readDocument(sample())
    for (const bytes of [sample(), new Viewing(sample())]) {
      const read = readDocument(bytes)
      bytes.fill(0x20)
      expect(read).toEqual(expected)
      expect(whole(read).pages[0]?.content.bytes.buffer).not.toBe(bytes.buffer)
    }
    const document = whole(expected)
    const page = document.pages[1]
    const drawn = page?.appearances[0]
    for (const part of [expected, document, document.pages, page, page?.box, page?.appearances, drawn, drawn?.matrix, document.notices, document.notices[0]]) {
      expect(Object.isFrozen(part)).toBe(true)
    }
  })

  // A read is a function of the bytes: two reads that differed -- a pool
  // shared between them, a count kept from the last -- would print one
  // upload two ways, in the builder's preview and in the server's render.
  // Neither shares anything with the other, so that a host that changes
  // one changes nothing of the next.
  test('two reads of one file are deep-equal', () => {
    const bytes = sample()
    const first = readDocument(bytes)
    const second = readDocument(bytes)
    expect(first).toEqual(second)
    const [a, b] = [whole(first), whole(second)]
    expect(a.objects).not.toBe(b.objects)
    a.pages[0]?.content.bytes.fill(0x20)
    expect(second).toEqual(readDocument(sample()))
  })
})

/**
 * Files that reach every part of pdf-lib the reader runs: the sample's
 * Flate content, font file and image; a page whose content is behind
 * ASCIIHex, ASCII85 and RunLength, which pdf-lib's own decoders decode; a
 * cross-reference stream whose rows are predicted; and an object of a
 * thousand distinct keys, each valued by a distinct name.
 */
function fixtures(): Uint8Array[] {
  const staged = pagesFile([leaf('/MediaBox[0 0 612 792]/Resources<<>>/Contents[4 0 R 5 0 R 6 0 R]')], {
    4: { dict: '/Filter/ASCIIHexDecode', data: latin1('30203020 6d>') },
    5: { dict: '/Filter/ASCII85Decode', data: latin1('87cURD]j7BEbo80~>') },
    6: { dict: '/Filter/RunLengthDecode', data: Uint8Array.of(0x04, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x80) },
  })
  const names = Array.from({ length: 1000 }, (_, i) => `/Key${String(i)} /Value${String(i)}`).join(' ')
  return [sample(), staged, onePageUnderXrefStream(true), withObject5(`<<${names}>>`)]
}

describe("readDocument feeds pdf-lib's pools nothing of a file", () => {
  // pdf-lib keeps every distinct name it makes for the life of the process
  // (the parser spike measured about 28 bytes a character, never freed):
  // a name of the file's reaching PDFName.of would let a server's every
  // upload grow it. The reader reads names itself, so only names pdf-lib's
  // own code passes -- a filter's, its parameters' and the keys it looks
  // them up by, each fixed -- may reach it, while pdf-lib decodes the
  // three fixed-ratio filters. A spy on PDFName.of over files that reach
  // every decoder holds it, as parse.test.ts's holds PDFRef.of.
  test("no name a file holds reaches PDFName.of, only the fixed names pdf-lib's decoders look up", () => {
    const FIXED = ['Filter', 'DecodeParms', 'FlateDecode', 'LZWDecode', 'ASCII85Decode', 'ASCIIHexDecode', 'RunLengthDecode', 'EarlyChange']
    const of = vi.spyOn(PDFName, 'of')
    for (const file of fixtures()) expect(readDocument(file).ok).toBe(true)
    const met = new Set(of.mock.calls.map(([name]) => name))
    expect(met.has('ASCII85Decode') && met.has('RunLengthDecode')).toBe(true)
    expect([...met].filter((name) => !FIXED.includes(name))).toEqual([])
  })
})

describe("readDocument never runs pdf-lib's PNG decoder", () => {
  /** The UPNG pdf-lib imported, as pdf-lib resolves it: the module, or its default where the module is a namespace. */
  function upngOfPdfLib(): { decode: (input: ArrayBuffer) => unknown } {
    type Require = { (id: string): unknown; resolve: (id: string) => string }
    const node = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => { createRequire: (from: string) => Require } } }).process
    const { createRequire } = node.getBuiltinModule('node:module')
    const fromPdfLib = createRequire(createRequire((import.meta as unknown as { url: string }).url).resolve('@pdfme/pdf-lib'))
    const loaded = fromPdfLib('@pdf-lib/upng') as { decode?: unknown; default?: { decode: (input: ArrayBuffer) => unknown } }
    return typeof loaded.decode === 'function'
      ? (loaded as { decode: (input: ArrayBuffer) => unknown })
      : (loaded.default as { decode: (input: ArrayBuffer) => unknown })
  }

  // pdf-lib decodes PNGs with UPNG 1.0.1, which never returns on truncated
  // pixel data and blocks its thread (0005), and imports it at its top, so
  // it is in every host's install of the reader. The reader embeds no PNG
  // and passes an image on undecoded, so nothing it reads may reach it: a
  // file whose image data reached UPNG could hang the read where no bound
  // stops it. A decode that throws, put on the object pdf-lib holds -- its
  // own embedPng fails through it, which shows the mock reaches pdf-lib --
  // is never called while the fixtures, an image among them, are read. The
  // PNG the control embeds is whole, a 1-by-1 grey pixel pdf-lib embeds
  // unmocked, so that a mock that missed fails the control, where a
  // truncated one would hang the worker in UPNG itself.
  test('UPNG, which pdf-lib imports, is never called while a file is read', async () => {
    const decode = vi.spyOn(upngOfPdfLib(), 'decode').mockImplementation(() => {
      throw new Error('UPNG decoded')
    })
    const png = Uint8Array.of(
      ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      ...[0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x00, 0x00, 0x00, 0x00, 0x3a, 0x7e, 0x9b, 0x55],
      ...[0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x48, 0xaf, 0xa4, 0x71],
      ...[0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82],
    )
    await expect((await PDFDocument.create()).embedPng(png)).rejects.toThrow('UPNG decoded')
    decode.mockClear()
    for (const file of fixtures()) expect(readDocument(file).ok).toBe(true)
    expect(decode).not.toHaveBeenCalled()
  })
})
