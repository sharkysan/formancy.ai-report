import fc from 'fast-check'
import { deflate } from 'pako'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { annotation, widget } from './annotations-test-support.js'
import { Tally } from './notices.js'
import { leaf, pagesFile } from './pages-test-support.js'
import { AT_A_BOUND } from './parse-test-support.js'
import { readDocument, type DocumentRead, type PrintableDocument } from './read.js'
import { DOCUMENT_REFUSAL_CODES, refusal } from './refusals.js'
import { CONTENT, latin1 } from './test-pdf.js'

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
    expect(readDocument(sample())).toEqual(refusal('unreadable'))
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
