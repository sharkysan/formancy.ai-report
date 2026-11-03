import { deflate } from 'pako'
import { describe, expect, test } from 'vitest'
import { closureOf } from './closure.js'
import { MAX_DOCUMENT_INFLATED, MAX_DOCUMENT_OBJECTS } from './limits.js'
import type { PdfDict, PdfValue } from './model.js'
import type { ParsedDocument } from './parse.js'
import { expectPrintRefused, letter, pagesFile, printedWhole, type Body } from './pages-test-support.js'
import { refusal } from './refusals.js'
import { CONTENT, deflatedZeros, latin1, MIB } from './test-pdf.js'

/**
 * The closure: every object a document's pages draw with, by number, each
 * once, held to the document's bounds, and never a page -- what a renderer
 * copies into a report's PDF beside the pages it places.
 */

/** A page drawing with the form XObject `form` and the font 20. */
const drawing = (form: number): string => letter('', `<</Font<</F1 20 0 R>>/XObject<</X ${form} 0 R>>>>`)

/** A form XObject of `data`, deflated where it says so, holding `entries`. */
const form = (data: Uint8Array, entries = ''): Body => ({ dict: `/Type/XObject/Subtype/Form/BBox[0 0 10 10]${entries}`, data })

/** The font 20, its descriptor 21 and its file 22, deflated: what two pages may share. */
const FONT: Readonly<Record<number, Body>> = {
  20: '<</Type/Font/Subtype/TrueType/BaseFont/Probe/FontDescriptor 21 0 R>>',
  21: '<</Type/FontDescriptor/FontName/Probe/FontFile2 22 0 R>>',
  22: { dict: '/Filter/FlateDecode', data: deflate(latin1('a font file of no glyphs')) },
}

describe('the closure holds', () => {
  // A font two pages draw with is one object of the document; a closure
  // that held it once a page would write it into the report twice, and
  // decode it twice from one budget.
  test('a font shared by two pages is one object of the closure', () => {
    const whole = printedWhole(pagesFile([drawing(30), drawing(30)], { ...FONT, 30: form(CONTENT) }))
    expect([...whole.closure.keys()].sort((a, b) => a - b)).toEqual([20, 21, 22, 30])
    expect(whole.closure.get(20)).toEqual({
      entries: new Map<string, PdfValue>([
        ['Type', { name: 'Font' }],
        ['Subtype', { name: 'TrueType' }],
        ['BaseFont', { name: 'Probe' }],
        ['FontDescriptor', { object: 21 }],
      ]),
    })
    expect(whole.parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - 'a font file of no glyphs'.length)
  })

  // An annotation's /P names its page, a field's and a node's /Parent lead
  // back up the tree, and /Metadata and /PieceInfo hold what a reader or
  // the writing program reads and nothing prints: followed, the closure
  // would refuse a form that names its page, copy a document's tree into a
  // report, and decode a writer's private streams.
  test('/Metadata and /PieceInfo are not followed', () => {
    const file = pagesFile([drawing(30)], {
      ...FONT,
      30: form(CONTENT, '/Metadata 31 0 R/PieceInfo 32 0 R/Group<</S/Transparency/P 10 0 R/Parent 2 0 R>>'),
      31: { dict: '/Type/Metadata/Subtype/XML/Filter/LZWDecode', data: latin1('not decoded') },
      32: '<</Probe<</Private 10 0 R>>>>',
    })
    const whole = printedWhole(file)
    expect([...whole.closure.keys()].sort((a, b) => a - b)).toEqual([20, 21, 22, 30])
  })

  // A reference to no object is null (ISO 32000-1 7.3.10): nothing to
  // copy, and nothing to refuse.
  test('a reference to no object is nothing of the closure', () => {
    const whole = printedWhole(pagesFile([letter('', '<</Font<</F1 99 0 R>>>>')]))
    expect(whole.closure.size).toBe(0)
  })

  // A file's images arrive in the filters a camera or a scanner wrote:
  // JPEG, JPEG 2000, fax, JBIG2. A viewer decodes those into an image of
  // the size it declares, and the reader never does; refused, every scanned
  // document would be. What comes before such a filter is decoded and
  // charged like any stream's, and anywhere else -- not last, not on an
  // image, or LZW on anything -- it is a filter the reader cannot hold to
  // the budget.
  test("an image's own filter, last on an image, is left to the viewer, and refused anywhere else", () => {
    const image = (filter: string, data = latin1('JFIF')): Uint8Array =>
      pagesFile([letter('', '<</XObject<</I 30 0 R>>>>')], {
        30: { dict: `/Type/XObject/Subtype/Image/Width 1/Height 1/ColorSpace/DeviceGray/BitsPerComponent 8/Filter${filter}`, data },
      })
    for (const filter of ['/DCTDecode', '/JPXDecode', '/CCITTFaxDecode', '/JBIG2Decode']) {
      expect(printedWhole(image(filter)).parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED)
    }
    const deflated = printedWhole(image('[/FlateDecode/DCTDecode]', deflate(latin1('JFIF'))))
    expect(deflated.parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - 4)
    expectPrintRefused(image('[/FlateDecode/DCTDecode]'), 'malformed', 'flate-header')
    expectPrintRefused(image('[/DCTDecode/FlateDecode]'), 'unsupported-filter', 'filter')
    expectPrintRefused(image('/LZWDecode'), 'unsupported-filter', 'filter')
    expectPrintRefused(pagesFile([drawing(30)], { ...FONT, 30: form(latin1('JFIF'), '/Filter/DCTDecode') }), 'unsupported-filter', 'filter')
  })
})

describe('the closure is refused', () => {
  // A resource that names a page would carry that page into the report as
  // a resource of another, and with it everything the page draws with,
  // its annotations and, through them, the rest of the document: refused
  // wherever it is reached -- by the resources themselves, through a chain
  // of objects, or through the catalog and the tree.
  test('a resource that reaches a page object is refused as resource-names-a-page', () => {
    expectPrintRefused(pagesFile([letter('', '<</XObject<</X 10 0 R>>>>')]), 'resource-names-a-page', 'resource-page')
    const chained = pagesFile([letter(), drawing(30)], {
      ...FONT,
      21: '<</Type/FontDescriptor/FontName/Probe/FontFile2 22 0 R/Style<</Probe[1 40 0 R]>>>>',
      30: form(CONTENT),
      40: '<</Next 10 0 R>>',
    })
    expectPrintRefused(chained, 'resource-names-a-page', 'resource-page')
    expectPrintRefused(pagesFile([letter('', '<</Properties<</MC0 1 0 R>>>>')]), 'resource-names-a-page', 'resource-page')
  })

  // A parse holds no more objects than the bound, so no file reaches it
  // here; handed more -- by a caller that read them elsewhere -- the
  // closure counts each as it is reached, before it is kept, and refuses
  // the one past it. A chain of the bound's length is walked without
  // recursion.
  test('the closure counts against MAX_DOCUMENT_OBJECTS', () => {
    expect(closureOf(chain(MAX_DOCUMENT_OBJECTS), [{ object: 1 }])).toHaveProperty('size', MAX_DOCUMENT_OBJECTS)
    expect(closureOf(chain(MAX_DOCUMENT_OBJECTS + 1), [{ object: 1 }])).toEqual(refusal('reached'))
  })

  // Every stream the closure holds is decoded once, from the budget the
  // parse and the pages' content drew on: decoded again for each page that
  // names it, a shared form would count twice; decoded from a fresh budget,
  // a document could decode MAX_DOCUMENT_INFLATED in its content and as
  // much again in its forms, and decoded not at all, a bomb would reach the
  // report's PDF and the first viewer to open it.
  test('every Flate stream the closure holds is inflated once against MAX_DOCUMENT_INFLATED, all of them together', () => {
    const zeros = deflatedZeros(17 * MIB)
    const shared = printedWhole(pagesFile([drawing(30), drawing(30)], { ...FONT, 30: form(zeros, '/Filter/FlateDecode') }))
    expect(shared.parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - 17 * MIB - 'a font file of no glyphs'.length)
    const two = pagesFile([drawing(30), drawing(31)], { ...FONT, 30: form(zeros, '/Filter/FlateDecode'), 31: form(zeros, '/Filter/FlateDecode') })
    expectPrintRefused(two, 'inflates-too-far', 'inflated')
    const afterContent = pagesFile([drawing(30)], {
      ...FONT,
      4: { dict: '/Filter/FlateDecode', data: zeros },
      30: form(zeros, '/Filter/FlateDecode'),
    })
    expectPrintRefused(afterContent, 'inflates-too-far', 'inflated')
  })
})

/** A document of `count` dictionaries, each naming the next: more than a parse would hand over, where `count` passes the bound. */
function chain(count: number): ParsedDocument {
  const objects = new Map<number, PdfDict>()
  for (let num = 1; num <= count; num += 1) {
    objects.set(num, { entries: new Map<string, PdfValue>(num < count ? [['Next', { object: num + 1 }]] : []) })
  }
  const empty: PdfDict = { entries: new Map() }
  return { objects, trailer: empty, catalog: empty, pages: [], budget: { left: MAX_DOCUMENT_INFLATED } }
}
