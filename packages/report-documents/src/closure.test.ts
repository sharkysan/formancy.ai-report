import { deflate } from 'pako'
import { describe, expect, test } from 'vitest'
import { closureOf } from './closure.js'
import { MAX_DOCUMENT_INFLATED, MAX_DOCUMENT_OBJECTS, MAX_DOCUMENT_PAGES } from './limits.js'
import type { PdfDict, PdfValue } from './model.js'
import { Tally } from './notices.js'
import type { ParsedDocument } from './parse.js'
import { pagesOf, type PrintablePage } from './pages.js'
import { AT_A_BOUND, parsed } from './parse-test-support.js'
import { Counted, expectPrintRefused, leaf, letter, pagesFile, printedWhole, rootsOf, type Body } from './pages-test-support.js'
import { refusal } from './refusals.js'
import { CONTENT, deflatedZeros, latin1, MIB } from './test-pdf.js'

/**
 * The closure: every object a document's pages draw with, by number, each
 * once, held to the document's bounds, and never a page -- what a renderer
 * copies into a report's PDF beside the pages it places.
 */

/** A page drawing with the form XObject `form` and the font 20. */
const drawing = (form: number): string => letter('', { resources: `<</Font<</F1 20 0 R>>/XObject<</X ${form} 0 R>>>>` })

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
    // The font file inflated once, and the second page holding content 4 again.
    expect(whole.parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - 'a font file of no glyphs'.length - CONTENT.length)
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
    const whole = printedWhole(pagesFile([letter('', { resources: '<</Font<</F1 99 0 R>>>>' })]))
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
      pagesFile([letter('', { resources: '<</XObject<</I 30 0 R>>>>' })], {
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

describe('the closure follows every name a page draws with', () => {
  // A resources dictionary maps names its content stream chose to what it
  // draws, and /P, /Parent, /Metadata, /PieceInfo or /OC is a name like any
  // other there: read as the keys a structure gives them, a form named /P
  // escaped every guard -- a layer, a page, a bomb and a filter the reader
  // does not decode each read where the same form named /X is refused. In a
  // name map every value is followed and no key means anything, in every
  // map of every /Resources the walk meets.
  test('a resource named as a structure names its keys is held to every guard', AT_A_BOUND, () => {
    const zeros = deflatedZeros(17 * MIB)
    const layer = { 30: form(CONTENT, '/OC 31 0 R'), 31: '<<>>' }
    for (const name of ['X', 'P', 'Parent', 'Metadata', 'PieceInfo', 'OC']) {
      const named = (target: number, objects: Readonly<Record<number, Body>> = {}): Uint8Array =>
        pagesFile([letter('', { resources: `<</XObject<</${name} ${target} 0 R>>>>` })], objects)
      expectPrintRefused(named(30, layer), 'optional-content', 'layers')
      expectPrintRefused(named(10), 'resource-names-a-page', 'resource-page')
      expectPrintRefused(named(30, { 30: form(latin1('x'), '/Filter/LZWDecode') }), 'unsupported-filter', 'filter')
      const bombs = { 30: form(zeros, '/Filter/FlateDecode'), 31: form(zeros, '/Filter/FlateDecode') }
      expectPrintRefused(pagesFile([letter('', { resources: `<</XObject<</Y 30 0 R/${name} 31 0 R>>>>` })], bombs), 'inflates-too-far', 'inflated')
    }
    // Every map of a resources dictionary, by reference too, and the resources of a form the page draws.
    for (const map of ['ExtGState', 'ColorSpace', 'Pattern', 'Shading', 'XObject', 'Font', 'Properties']) {
      expectPrintRefused(pagesFile([letter('', { resources: `<</${map}<</P 10 0 R>>>>` })]), 'resource-names-a-page', 'resource-page')
    }
    expectPrintRefused(pagesFile([letter('', { resources: '<</Font 30 0 R>>' })], { 30: '<</Parent 10 0 R>>' }), 'resource-names-a-page', 'resource-page')
    const nested = { 30: form(CONTENT, '/Resources<</XObject<</Metadata 10 0 R>>>>') }
    expectPrintRefused(pagesFile([letter('', { resources: '<</XObject<</X 30 0 R>>>>' })], nested), 'resource-names-a-page', 'resource-page')
  })

  // A DeviceN colour space names its colorants, its solidities and its dot
  // gains, and a type 5 halftone its screens, by the names of the inks the
  // file prints with, and a spot colour may be named /P as well as /X:
  // skipped as a structure's key, its tint function, its dot gain or its
  // screen was left out of the closure, and a filter the reader does not
  // decode with it. Every map keyed by colorant names is followed as a
  // resource map is -- a halftone under /HT of any type follows every key,
  // its /Default and /Type read as the values they are -- and a colorant
  // named /OC is a name there, not a layer.
  test('a colorant named as a structure names its keys is followed as any other', () => {
    const lzw = { dict: '/FunctionType 0/Domain[0 1]/Range[0 1 0 1 0 1 0 1]/Size[2]/BitsPerSample 8/Filter/LZWDecode', data: latin1('x') }
    const tint = '<</FunctionType 2/Domain[0 1]/C0[0 0 0 0]/C1[0 0 0 1]/N 1>>'
    const screen = '<</HalftoneType 1/Frequency 60/Angle 45/SpotFunction/Round>>'
    const deviceN = (attributes: string, objects: Readonly<Record<number, Body>>): Uint8Array =>
      pagesFile([letter('', { resources: `<</ColorSpace<</CS0[/DeviceN[/X]/DeviceCMYK 80 0 R ${attributes}]>>>>` })], { 80: tint, ...objects })
    const halftone = (entries: string, objects: Readonly<Record<number, Body>>): Uint8Array =>
      pagesFile([letter('', { resources: `<</ExtGState<</G0<</HT<</Type/Halftone/Default 90 0 R${entries}>>>>>>>>` })], { 90: screen, ...objects })
    const threshold = { dict: '/HalftoneType 6/Width 1/Height 1/Filter/LZWDecode', data: latin1('x') }
    for (const name of ['X', 'P', 'Parent', 'Metadata', 'PieceInfo']) {
      expectPrintRefused(deviceN(`<</Colorants<</${name}[/Separation/${name}/DeviceCMYK 81 0 R]>>>>`, { 81: lzw }), 'unsupported-filter', 'filter')
      expectPrintRefused(deviceN(`<</MixingHints<</DotGain<</${name} 81 0 R>>>>>>`, { 81: lzw }), 'unsupported-filter', 'filter')
      expectPrintRefused(halftone(`/HalftoneType 5/${name} 91 0 R`, { 91: threshold }), 'unsupported-filter', 'filter')
    }
    expectPrintRefused(halftone('/HalftoneType 1/P 91 0 R', { 91: threshold }), 'unsupported-filter', 'filter')
    const inks = deviceN('<</Colorants<</OC[/Separation/OC/DeviceCMYK 81 0 R]>>/MixingHints<</Solidities<</OC 1>>/DotGain<</OC 82 0 R>>>>>>', {
      81: tint,
      82: tint,
    })
    expect([...printedWhole(inks).closure.keys()].sort((a, b) => a - b)).toEqual([80, 81, 82])
    expect([...printedWhole(halftone('/HalftoneType 5/OC 91 0 R', { 91: screen })).closure.keys()].sort((a, b) => a - b)).toEqual([90, 91])
  })

  // A halftone is keyed by colorant names where it stands, under an
  // ExtGState's /HT, and nowhere else: a page's resources, a form or a
  // font that wrote /HalftoneType 5 of itself -- a key every viewer ignores
  // there -- and was read as a name map for it, stopped reading its own
  // /Resources as resources and its own /OC as a layer, and let a form
  // named /P past every guard and glyph P out of the closure. Each is held
  // here to what its control, the same without the key, is held to.
  test('/HalftoneType 5 where no halftone stands changes nothing', AT_A_BOUND, () => {
    const layer = { 31: form(CONTENT, '/OC 32 0 R'), 32: '<<>>' }
    const bomb = form(deflatedZeros(17 * MIB), '/Filter/FlateDecode')
    const drawing = (resources: string, objects: Readonly<Record<number, Body>>): Uint8Array =>
      pagesFile([letter('', { resources: `<<${resources}>>` })], { 95: '5', ...objects })
    for (const type of ['', '/HalftoneType 5', '/HalftoneType 95 0 R']) {
      expectPrintRefused(drawing(`${type}/XObject<</P 31 0 R>>`, layer), 'optional-content', 'layers')
      expectPrintRefused(drawing(`${type}/XObject<</P 10 0 R>>`, {}), 'resource-names-a-page', 'resource-page')
      expectPrintRefused(drawing(`${type}/XObject<</P 31 0 R>>`, { 31: form(latin1('x'), '/Filter/LZWDecode') }), 'unsupported-filter', 'filter')
      expectPrintRefused(drawing(`${type}/XObject<</Y 33 0 R/P 34 0 R>>`, { 33: bomb, 34: bomb }), 'inflates-too-far', 'inflated')
      expectPrintRefused(
        drawing('/XObject<</X 30 0 R>>', { 30: form(CONTENT, `${type}/Resources<</XObject<</P 31 0 R>>>>`), ...layer }),
        'optional-content',
        'layers',
      )
      expectPrintRefused(drawing('/XObject<</X 30 0 R>>', { 30: form(CONTENT, `${type}/OC 32 0 R`), 32: '<<>>' }), 'optional-content', 'layers')
      const glyphs = drawing('/Font<</F1 20 0 R>>', {
        20: `<</Type/Font/Subtype/Type3${type}/FontBBox[0 0 1 1]/FontMatrix[1 0 0 1 0 0]/CharProcs<</A 40 0 R/P 41 0 R>>/FirstChar 65/LastChar 65/Widths[1]>>`,
        40: { dict: '', data: latin1('1000 0 d0') },
        41: { dict: '', data: latin1('1000 0 d0') },
      })
      expect(printedWhole(glyphs).closure.has(41)).toBe(true)
    }
  })

  // A Type 3 font draws each glyph with a procedure its /CharProcs names
  // by the glyph's name, and a chart's capital P is named /P: skipped as a
  // structure's key, the procedure that draws it was not in the closure,
  // and the report would print the chart without its letter.
  test("a Type 3 font's glyphs are each in the closure, whatever they are named", () => {
    const glyphs = ['A', 'P', 'Parent', 'Metadata', 'PieceInfo', 'OC']
    const procs = glyphs.map((glyph, i) => `/${glyph} ${40 + i} 0 R`).join('')
    const font = `<</Type/Font/Subtype/Type3/FontBBox[0 0 1 1]/FontMatrix[0.001 0 0 0.001 0 0]/CharProcs<<${procs}>>/FirstChar 65/LastChar 65/Widths[1]>>`
    const file = pagesFile([letter('', { resources: '<</Font<</F1 20 0 R>>>>' })], {
      20: font,
      ...Object.fromEntries(glyphs.map((_, i) => [40 + i, { dict: '', data: latin1('1000 0 d0 0 0 m 1 1 l S') }])),
    })
    expect([...printedWhole(file).closure.keys()].sort((a, b) => a - b)).toEqual([20, 40, 41, 42, 43, 44, 45])
  })

  // Marked content belongs to a layer through the property list its /OC
  // names in /Properties: a group or a membership dictionary reached there
  // is optional content a viewer may hide, though no dictionary holds /OC.
  test('a property list that is a layer is refused as optional-content', () => {
    const properties = (list: string): Uint8Array => pagesFile([letter('', { resources: '<</Properties<</MC0 30 0 R>>>>' })], { 30: list })
    expectPrintRefused(properties('<</Type/OCG/Name(Layer)>>'), 'optional-content', 'layers')
    expectPrintRefused(properties('<</Type/OCMD/OCGs[]>>'), 'optional-content', 'layers')
    expectPrintRefused(
      pagesFile([letter('', { resources: '<</Properties<</MC0 30 0 R>>>>' })], { 30: '<</Type 31 0 R>>', 31: '/OCG' }),
      'optional-content',
      'layers',
    )
    expect(printedWhole(properties('<</Probe 1>>')).closure.has(30)).toBe(true)
  })

  // A direct /Resources a node holds is one object every page under it
  // inherits: walked once a page, a thousand pages under one of a hundred
  // thousand values cost a hundred million steps. Each container is walked
  // once, which the objects map counts -- every reference in it names no
  // object, so each is a look-up -- and a walk that went again would stop
  // at the count before it spun.
  test('a direct /Resources every page inherits is walked once', AT_A_BOUND, () => {
    const refs = 100_000
    const pages = Array.from({ length: MAX_DOCUMENT_PAGES }, () => leaf('/MediaBox[0 0 612 792]/Contents 4 0 R'))
    const document = parsed(pagesFile(pages, {}, { root: `/Resources<</Junk[${'99999 0 R '.repeat(refs)}]>>` }))
    const read = pagesOf(document, new Tally()) as readonly PrintablePage[]
    const counted = new Counted(document.objects, 2 * refs)
    expect(closureOf({ ...document, objects: counted }, rootsOf(read))).toHaveProperty('size', 0)
    expect(counted.gets).toBeLessThan(counted.limit)
  })
})

describe('the closure is refused', () => {
  // A resource that names a page would carry that page into the report as
  // a resource of another, and with it everything the page draws with,
  // its annotations and, through them, the rest of the document: refused
  // wherever it is reached -- by the resources themselves, through a chain
  // of objects, or through the catalog and the tree.
  test('a resource that reaches a page object is refused as resource-names-a-page', () => {
    expectPrintRefused(pagesFile([letter('', { resources: '<</XObject<</X 10 0 R>>>>' })]), 'resource-names-a-page', 'resource-page')
    const chained = pagesFile([letter(), drawing(30)], {
      ...FONT,
      21: '<</Type/FontDescriptor/FontName/Probe/FontFile2 22 0 R/Style<</Probe[1 40 0 R]>>>>',
      30: form(CONTENT),
      40: '<</Next 10 0 R>>',
    })
    expectPrintRefused(chained, 'resource-names-a-page', 'resource-page')
    expectPrintRefused(pagesFile([letter('', { resources: '<</Properties<</MC0 1 0 R>>>>' })]), 'resource-names-a-page', 'resource-page')
  })

  // A parse holds no more objects than the bound, so no file reaches it
  // here; handed more -- by a caller that read them elsewhere -- the
  // closure counts each as it is reached, before it is kept, and refuses
  // the one past it. A chain of the bound's length is walked without
  // recursion.
  test('the closure counts against MAX_DOCUMENT_OBJECTS', AT_A_BOUND, () => {
    expect(closureOf(chain(MAX_DOCUMENT_OBJECTS), [{ object: 1 }])).toHaveProperty('size', MAX_DOCUMENT_OBJECTS)
    expect(closureOf(chain(MAX_DOCUMENT_OBJECTS + 1), [{ object: 1 }])).toEqual(refusal('reached'))
  })

  // Every stream the closure holds is decoded once, from the budget the
  // parse and the pages' content drew on: decoded again for each page that
  // names it, a shared form would count twice; decoded from a fresh budget,
  // a document could decode MAX_DOCUMENT_INFLATED in its content and as
  // much again in its forms, and decoded not at all, a bomb would reach the
  // report's PDF and the first viewer to open it.
  test('every Flate stream the closure holds is inflated once against MAX_DOCUMENT_INFLATED, all of them together', AT_A_BOUND, () => {
    const zeros = deflatedZeros(17 * MIB)
    const shared = printedWhole(pagesFile([drawing(30), drawing(30)], { ...FONT, 30: form(zeros, '/Filter/FlateDecode') }))
    expect(shared.parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - 17 * MIB - 'a font file of no glyphs'.length - CONTENT.length)
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
