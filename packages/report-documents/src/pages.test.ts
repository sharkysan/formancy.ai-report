import { deflate } from 'pako'
import { describe, expect, expectTypeOf, test } from 'vitest'
import { MAX_DOCUMENT_INFLATED, MAX_DOCUMENT_OBJECTS, MAX_DOCUMENT_PAGES } from './limits.js'
import { isName } from './model.js'
import { Tally } from './notices.js'
import { pagesOf } from './pages.js'
import { AT_A_BOUND, parsed } from './parse-test-support.js'
import {
  Counted,
  expectPrintRefused,
  leaf,
  outcome,
  letter,
  pagesFile,
  pagesRead,
  printed,
  printedWhole,
  spentByObjectStream,
  underAChain,
} from './pages-test-support.js'
import { refusal } from './refusals.js'
import { contentBomb, manyPages } from './test-hostile.js'
import { CONTENT, deflatedZeros, latin1, MIB } from './test-pdf.js'

/**
 * Each page as a viewer shows it: the box it shows, turned as it is turned,
 * at the size it is shown, what it draws and what it draws with -- or the
 * document refused, naming the page where what was found belongs to one.
 */

/** A file of one page under the root, `entries` its own beside content 4. */
const onePage = (entries: string): Uint8Array => pagesFile([leaf(`/Contents 4 0 R${entries}`)])

/** A US Letter page whose /Contents is `value`. */
const drawn = (value: string): string => letter().replace('/Contents 4 0 R', `/Contents ${value}`)

describe('a page is turned', () => {
  // A page turned by more than a turn, or backwards, is shown by every
  // viewer as the quarter turn it comes to: read as written, a renderer
  // would turn it by 450 degrees or refuse a page every viewer shows. Its
  // size is the box turned, so that a quarter turn swaps width and height.
  test('/Rotate 90, 180, 270, 450 and -90 read as 90, 180, 270, 90 and 270', () => {
    const turned = [90, 180, 270, 450, -90].map((rotate) => letter(`/Rotate ${rotate}`))
    const pages = pagesRead(pagesFile(turned))
    expect(pages.map((page) => page.rotate)).toEqual([90, 180, 270, 90, 270])
    expect(pages.map((page) => [page.width, page.height])).toEqual([
      [792, 612],
      [612, 792],
      [792, 612],
      [792, 612],
      [792, 612],
    ])
    expect(pagesRead(pagesFile([letter()]))[0]?.rotate).toBe(0)
  })

  // A page at an angle between quarter turns cannot be placed upright in a
  // report's body box without turning it further, which the rules forbid;
  // a fraction of a degree, or a /Rotate that is no number, is read by one
  // viewer as one angle and by another as none, and a turn past what a
  // double holds exactly -- 405323966463344641, which a double rounds onto
  // 2^52 times 90, a multiple of 90 it is not -- is no turn any two readers
  // agree on. Named by the reader's own count of the page, so that the
  // person can find it.
  test('/Rotate 45 is refused as unsupported-rotation, naming the page', () => {
    expectPrintRefused(pagesFile([letter(), letter('/Rotate 45')]), 'unsupported-rotation', 'rotation', 2)
    expectPrintRefused(pagesFile([letter('/Rotate 90.5')]), 'unsupported-rotation', 'rotation', 1)
    expectPrintRefused(pagesFile([letter('/Rotate/Ninety')]), 'unsupported-rotation', 'rotation', 1)
    expectPrintRefused(pagesFile([letter('/Rotate 9007199254740992')]), 'unsupported-rotation', 'rotation', 1)
    expectPrintRefused(pagesFile([letter('/Rotate 405323966463344641')]), 'unsupported-rotation', 'rotation', 1)
  })
})

describe('a page shows a box', () => {
  // A page that holds none of its box, its resources or its turn takes
  // them from the nearest node above it that does (ISO 32000-1 7.7.3.4):
  // read from the page alone, it would have no box, draw with no fonts and
  // stand upright where every viewer turns it. What it shows is its
  // CropBox within its MediaBox: a CropBox past the MediaBox shows no more
  // than the media holds.
  test('MediaBox, CropBox, Resources and Rotate are inherited from the page tree, and a CropBox past the MediaBox is cut to it', () => {
    const file = pagesFile([leaf('/Contents 4 0 R', 20), leaf('/Contents 4 0 R/MediaBox[0 0 300 400]/Rotate 0')], {
      2: '<</Type/Pages/Kids[20 0 R 11 0 R]/Count 2/MediaBox[0 0 612 792]/Resources 21 0 R/Rotate 90>>',
      20: '<</Type/Pages/Parent 2 0 R/Kids[10 0 R]/Count 1/CropBox[-10 -10 700 500]/Rotate 180>>',
      21: '<</Font<</F1 22 0 R>>>>',
      22: '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    })
    const [under, beside] = pagesRead(file)
    expect(under).toMatchObject({ box: [0, 0, 612, 500], rotate: 180, width: 612, height: 500 })
    expect(beside).toMatchObject({ box: [0, 0, 300, 400], rotate: 0, width: 300, height: 400 })
    expect(under?.resources.entries.has('Font')).toBe(true)
    expect(beside?.resources).toBe(under?.resources)
  })

  // A box is two corners in either order; one written right to left, top
  // to bottom, or below the origin is the same rectangle to every viewer,
  // and a size taken from its corners as written would be negative.
  test('a box written with its corners reversed or below zero reads ordered', () => {
    const pages = pagesRead(
      pagesFile([letter('', { box: '[612 792 0 0]' }), letter('', { box: '[-100 -200 -50 -20]' }), letter('', { box: '[100 -20 -200 50]' })]),
    )
    expect(pages.map((page) => page.box)).toEqual([
      [0, 0, 612, 792],
      [-100, -200, -50, -20],
      [-200, -20, 100, 50],
    ])
    expect(pages.map((page) => [page.width, page.height])).toEqual([
      [612, 792],
      [50, 180],
      [300, 70],
    ])
  })

  // A page of no area shows nothing, and a renderer that scales it into a
  // body box would divide by its width: refused, whether the media has no
  // area, or the crop has none, or the crop lies past the media.
  test('a box of no area is refused as no-area', () => {
    expectPrintRefused(pagesFile([letter('', { box: '[0 0 0 792]' })]), 'no-area', 'area', 1)
    expectPrintRefused(pagesFile([letter('', { box: '[10 10 10 10]' })]), 'no-area', 'area', 1)
    expectPrintRefused(pagesFile([letter('/CropBox[0 300 612 300]')]), 'no-area', 'area', 1)
    expectPrintRefused(pagesFile([letter(), letter('/CropBox[700 0 800 100]')]), 'no-area', 'area', 2)
    expectPrintRefused(pagesFile([letter('/CropBox[612 0 700 100]')]), 'no-area', 'area', 1)
  })

  // A box that is not four numbers is no rectangle a viewer agrees on, and
  // a page with no box at all is shown as Letter by one viewer and refused
  // by another.
  test('a box that is not four numbers, or no box, is refused as malformed', () => {
    expectPrintRefused(onePage('/MediaBox[0 0 612]'), 'malformed', 'box', 1)
    expectPrintRefused(onePage('/MediaBox[0 0 612 792 1]'), 'malformed', 'box', 1)
    expectPrintRefused(onePage('/MediaBox[0 0 612/Wide]'), 'malformed', 'box', 1)
    expectPrintRefused(onePage('/MediaBox<</Width 612>>'), 'malformed', 'box', 1)
    expectPrintRefused(onePage(''), 'malformed', 'box', 1)
    expectPrintRefused(pagesFile([letter('/CropBox 30 0 R')], { 30: '[0 0 612 9 0 R]' }), 'malformed', 'box', 1)
  })

  // A box, or one of its numbers, may be written as an object of its own,
  // as any value may (ISO 32000-1 7.3.10).
  test('a box and its numbers may be references', () => {
    const [page] = pagesRead(pagesFile([leaf('/MediaBox 30 0 R/Contents 4 0 R')], { 30: '[0 0 31 0 R 792]', 31: '612' }))
    expect(page?.box).toEqual([0, 0, 612, 792])
  })
})

describe('a page is shown at its size', () => {
  // A page whose unit is two points is shown at twice the size its box
  // gives in points (ISO 32000-1 14.11.2); read in points, it would print
  // at half the size the author saw.
  test('UserUnit 2 doubles the shown size', () => {
    const [plain, doubled, turned] = pagesRead(pagesFile([letter(), letter('/UserUnit 2'), letter('/UserUnit 2/Rotate 90')]))
    expect(plain).toMatchObject({ userUnit: 1, width: 612, height: 792 })
    expect(doubled).toMatchObject({ userUnit: 2, box: [0, 0, 612, 792], width: 1224, height: 1584 })
    expect(turned).toMatchObject({ userUnit: 2, width: 1584, height: 1224 })
  })

  // A unit of nothing, or below nothing, or no number, gives a page of no
  // size or of a negative one.
  test('a UserUnit that is not a positive number is refused as malformed', () => {
    expectPrintRefused(pagesFile([letter('/UserUnit 0')]), 'malformed', 'user-unit', 1)
    expectPrintRefused(pagesFile([letter('/UserUnit -2')]), 'malformed', 'user-unit', 1)
    expectPrintRefused(pagesFile([letter('/UserUnit/Two')]), 'malformed', 'user-unit', 1)
    expectPrintRefused(pagesFile([letter('/UserUnit 30 0 R')]), 'malformed', 'user-unit', 1)
  })
})

describe('a page draws its content', () => {
  // A page's content may be split across streams anywhere, even inside a
  // text object (ISO 32000-1 7.8.2): each is decoded and they are joined
  // with a newline, so that the last token of one and the first of the
  // next -- `Tj` and `ET` -- never run together into one.
  test('two content streams that split BT … ET between them are joined into one, with a newline between', () => {
    const first = latin1('BT /F1 12 Tf 72 712 Td (Hello) Tj')
    const file = pagesFile([letter('', { resources: '<</Font<</F1 22 0 R>>>>' }).replace('/Contents 4 0 R', '/Contents[20 0 R 21 0 R]')], {
      20: { dict: '/Filter/FlateDecode', data: deflate(first) },
      21: { dict: '', data: latin1('ET') },
      22: '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    })
    const [page] = pagesRead(file)
    expect(page?.content.bytes).toEqual(latin1('BT /F1 12 Tf 72 712 Td (Hello) Tj\nET'))
    expect([...(page?.content.dict.entries.keys() ?? [])]).toEqual([])
  })

  // One stream needs no joining, and decoding it only to write it again
  // would make a report's PDF larger by what its compression saved: it is
  // kept as written, with the filters that decode it. It is still inflated
  // once against the document's budget, so that a bomb is refused here
  // rather than in a viewer of the report.
  test('a single content stream is kept as encoded, its filter with it', () => {
    const deflated = deflate(CONTENT)
    const whole = printedWhole(pagesFile([letter(), drawn('[4 0 R]')], { 4: { dict: '/Filter/FlateDecode/DecodeParms<</Predictor 1>>', data: deflated } }))
    for (const page of whole.pages) {
      expect(page.content.bytes).toEqual(deflated)
      expect(isName(page.content.dict.entries.get('Filter'), 'FlateDecode')).toBe(true)
      expect([...page.content.dict.entries.keys()]).toEqual(['Filter', 'DecodeParms'])
    }
    // Shared by both pages, it was inflated once, and the second page holds it again.
    expect(whole.parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - CONTENT.length - deflated.length)
  })

  // A page with no content, or a list of none, is empty (ISO 32000-1
  // 7.7.3.3), as a blank page a writer adds is; read as a refusal, a
  // document with a blank page between its chapters would not print.
  test('a page with no /Contents, or a list of none, draws nothing', () => {
    const pages = pagesRead(pagesFile([leaf('/MediaBox[0 0 612 792]'), drawn('[]'), drawn('20 0 R')], { 20: '[]' }))
    expect(pages).toHaveLength(3)
    for (const page of pages) {
      expect(page.content.bytes).toEqual(new Uint8Array(0))
      expect([...page.content.dict.entries.keys()]).toEqual([])
    }
  })

  // Content named as no stream, or as a list that holds something else,
  // is content no viewer agrees on: one draws nothing, another stops at
  // the page.
  test('content that is not a stream or a list of streams is refused as malformed', () => {
    expectPrintRefused(pagesFile([drawn('[4 0 R 20 0 R]')], { 20: '<<>>' }), 'malformed', 'contents', 1)
    expectPrintRefused(pagesFile([drawn('[4 0 R 99 0 R]')]), 'malformed', 'contents', 1)
    expectPrintRefused(pagesFile([drawn('[4 0 R (stream)]')]), 'malformed', 'contents', 1)
    expectPrintRefused(pagesFile([drawn('20 0 R')], { 20: '<</Length 2>>' }), 'malformed', 'contents', 1)
    expectPrintRefused(pagesFile([drawn('99 0 R')]), 'malformed', 'contents', 1)
    expectPrintRefused(pagesFile([drawn('/Drawing')]), 'malformed', 'contents', 1)
    // A list written as an object of its own is a list like any other.
    expect(pagesRead(pagesFile([drawn('20 0 R')], { 20: '[4 0 R 4 0 R]' }))[0]?.content.bytes).toEqual(
      latin1(`${String.fromCharCode(...CONTENT)}\n${String.fromCharCode(...CONTENT)}`),
    )
  })

  // The content a page holds is the reader's to bound, not only what it
  // decodes: a list of two 8 MiB streams forty pages share was decoded
  // once and held forty times, 640 MiB from a file of 77 KB, and a list
  // that names one stream a hundred thousand times held a copy of it for
  // each. Every page that holds a content, and every repeat of a stream in
  // a list, takes its length from the budget again, each as it is met, so
  // that a list past the budget stops where the budget ends -- which the
  // objects map counts. Pages each with content of their own are charged
  // it once.
  test('the content the pages hold is charged, all of it together', AT_A_BOUND, () => {
    const eight = deflatedZeros(8 * MIB)
    const list = { 3: '[4 0 R 5 0 R]', 4: { dict: '/Filter/FlateDecode', data: eight }, 5: { dict: '/Filter/FlateDecode', data: eight } }
    expect(pagesRead(pagesFile([drawn('3 0 R')], list))).toHaveLength(1)
    expectPrintRefused(pagesFile([drawn('3 0 R'), drawn('3 0 R')], list), 'inflates-too-far', 'repeated', 2)

    const repeats = 100_000
    const document = parsed(pagesFile([drawn('3 0 R')], { 3: `[${'4 0 R '.repeat(repeats)}]`, 4: { dict: '', data: new Uint8Array(1024) } }))
    const counted = new Counted(document.objects, repeats)
    expect(outcome(pagesOf({ ...document, objects: counted }, new Tally()))).toEqual(refusal('repeated', 1))
    expect(counted.gets).toBeLessThan(counted.limit)

    // The newline that joins two streams is held content too: the first inflating to the whole budget, nothing repeats,
    // and the page is refused where the newline passes it.
    const whole = { dict: '/Filter/FlateDecode', data: deflatedZeros(MAX_DOCUMENT_INFLATED) }
    expectPrintRefused(pagesFile([drawn('[20 0 R 21 0 R]')], { 20: whole, 21: { dict: '', data: CONTENT } }), 'inflates-too-far', 'repeated', 1)

    const seven = { dict: '/Filter/FlateDecode', data: deflatedZeros(7 * MIB) }
    const own = printedWhole(pagesFile([drawn('[20 0 R 21 0 R]'), drawn('[22 0 R 23 0 R]')], { 20: seven, 21: seven, 22: seven, 23: seven }))
    expect(own.parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - 4 * 7 * MIB - 2)
  })

  // A list a thousand pages share is one content: joined again for each
  // page, a list of a hundred thousand references cost a hundred thousand
  // steps a page before the budget stopped it. It is built once, and each
  // page charged what it holds, which the objects map counts.
  test('a list the pages share is built once', AT_A_BOUND, () => {
    const refs = 100_000
    const pages = Array.from({ length: MAX_DOCUMENT_PAGES }, () => drawn('3 0 R'))
    const document = parsed(pagesFile(pages, { 3: `[${'4 0 R '.repeat(refs)}]`, 4: { dict: '', data: new Uint8Array(0) } }))
    const counted = new Counted(document.objects, 2 * refs)
    expect(outcome(pagesOf({ ...document, objects: counted }, new Tally()))).toEqual(refusal('repeated', Math.floor(MAX_DOCUMENT_INFLATED / (refs - 1)) + 1))
    expect(counted.gets).toBeLessThan(counted.limit)
    const few = pagesRead(pagesFile([drawn('3 0 R'), drawn('3 0 R')], { 3: '[4 0 R 4 0 R]' }))
    expect(few[0]?.content).toBe(few[1]?.content)
  })

  // A page's content decoded past the budget, damaged, or under a filter
  // the reader does not decode is refused as what was found, and the page
  // it belongs to named, so that a person knows which page to look at.
  test("a refusal found in a page's content names the page", AT_A_BOUND, () => {
    expectPrintRefused(contentBomb(deflatedZeros(MAX_DOCUMENT_INFLATED + 1)), 'inflates-too-far', 'inflated', 1)
    const damaged = { dict: '/Filter/FlateDecode', data: latin1('not compressed') }
    expectPrintRefused(pagesFile([letter(), letter()], { 4: damaged }), 'malformed', 'flate-header', 1)
    expectPrintRefused(
      pagesFile([letter(), letter().replace('/Contents 4 0 R', '/Contents 20 0 R')], { 20: { dict: '/Filter/LZWDecode', data: latin1('x') } }),
      'unsupported-filter',
      'filter',
      2,
    )
  })

  // The parse decodes object and cross-reference streams from the
  // document's budget; a page's content that drew on a fresh one could
  // decode MAX_DOCUMENT_INFLATED again, and a document of both twice.
  test('the content draws on what the parse left of MAX_DOCUMENT_INFLATED', AT_A_BOUND, () => {
    const content = deflatedZeros(13 * MIB)
    expect(pagesRead(contentBomb(content))).toHaveLength(1)
    expectPrintRefused(spentByObjectStream(20, content), 'inflates-too-far', 'inflated', 1)
  })
})

describe('a page draws with', () => {
  // A page with no resources anywhere above it draws with none, as every
  // viewer reads it; resources that are no dictionary are a page no two
  // viewers draw alike.
  test('its resources, none where no node gives any, and refused where they are no dictionary', () => {
    expect([...(pagesRead(pagesFile([leaf('/MediaBox[0 0 612 792]/Contents 4 0 R')]))[0]?.resources.entries ?? [])]).toEqual([])
    expectPrintRefused(pagesFile([letter('', { resources: '[]' })]), 'malformed', 'resources', 1)
    expectPrintRefused(pagesFile([letter('', { resources: '99 0 R' })]), 'malformed', 'resources', 1)
  })

  // A page's transparency group says how its content composes; dropped, a
  // page with transparency would print with other colours than it shows.
  // One that is no dictionary is refused rather than guessed at.
  test('its /Group where it has one, and refused where it is no dictionary', () => {
    const [plain, grouped] = pagesRead(pagesFile([letter(), letter('/Group 20 0 R')], { 20: '<</S/Transparency/CS/DeviceRGB>>' }))
    expect(plain?.group).toBeUndefined()
    expect(Object.keys(plain ?? {})).not.toContain('group')
    expect(isName(grouped?.group?.entries.get('S'), 'Transparency')).toBe(true)
    expectPrintRefused(pagesFile([letter('/Group/Transparency')]), 'malformed', 'group', 1)
  })

  // A page that lists no annotations, or an empty list, draws nothing
  // over its content; what a page's annotations draw is annotations.ts's.
  test('no appearances where it lists no annotations', () => {
    expect(pagesRead(pagesFile([letter(), letter('/Annots[]')])).map((page) => page.appearances)).toEqual([[], []])
  })
})

describe('a document', () => {
  // Layers the author turned off are hidden by every viewer and printed by
  // a renderer that copies the page's content as it is: a person would see
  // what they never saw on screen. Refused where the catalog says the
  // document has layers, and where anything a page draws with is marked as
  // belonging to one, however deep, whatever the mark names.
  test('a document with optional content is refused as optional-content', () => {
    expectPrintRefused(pagesFile([letter()], {}, { catalog: '/OCProperties<</OCGs[30 0 R]/D<</Order[]>>>>' }), 'optional-content', 'layers')
    const layered = (oc: string): Uint8Array =>
      pagesFile([letter('', { resources: '<</XObject<</X 20 0 R>>>>' })], {
        20: { dict: '/Type/XObject/Subtype/Form/BBox[0 0 10 10]/Resources<</XObject<</Y 21 0 R>>>>', data: latin1('/Y Do') },
        21: { dict: `/Type/XObject/Subtype/Form/BBox[0 0 10 10]${oc}`, data: CONTENT },
        30: '<</Type/OCG/Name(Layer)>>',
      })
    expectPrintRefused(layered('/OC 30 0 R'), 'optional-content', 'layers')
    expectPrintRefused(layered('/OC 99 0 R'), 'optional-content', 'layers')
    expect(pagesRead(layered(''))).toHaveLength(1)
  })

  // The bound is the parse's, held where the page tree is walked
  // (page-tree.test.ts): a file past it never reaches the pages, and one
  // at it has every page read.
  test('more pages than MAX_DOCUMENT_PAGES are refused before the page past it is read', AT_A_BOUND, () => {
    expect(printed(manyPages(MAX_DOCUMENT_PAGES + 1))).toEqual(refusal('pages'))
    expect(pagesOf(parsed(manyPages(MAX_DOCUMENT_PAGES)), new Tally())).toHaveLength(MAX_DOCUMENT_PAGES)
  })

  // A thousand pages under a chain of nodes that holds what they inherit
  // at its root would, climbed from each page, cost a hundred million
  // steps: here each node is read once, which the objects map counts, and
  // a climb that read them again would stop at the count before it spun.
  test('what pages inherit is read once a node, however deep the tree', AT_A_BOUND, () => {
    const pages = MAX_DOCUMENT_PAGES
    const document = parsed(underAChain(MAX_DOCUMENT_OBJECTS - pages - 3, pages))
    const counted = new Counted(document.objects, 2 * document.objects.size)
    const read = pagesOf({ ...document, objects: counted }, new Tally())
    expect(counted.gets).toBeLessThan(counted.limit)
    expect(read).toHaveLength(pages)
    expect(read).toMatchObject(Array.from({ length: pages }, () => ({ box: [0, 0, 612, 792] })))
  })

  // Anything other than a refusal thrown while a page is read -- a fault of
  // the reader's -- is a refusal of the reader's own words, never the
  // exception's, which may quote the file.
  test('an exception that is not a refusal is a refusal of its own words', () => {
    const document = parsed(pagesFile([letter()]))
    expect(pagesOf({ ...document, objects: new Counted(document.objects, 0) }, new Tally())).toEqual(refusal('unreadable'))
  })

  // A read that dropped what its pages counted -- their links, fields and
  // signatures -- would lose every notice of them without a word, and a
  // caller that forgot the tally would not be told: it is no optional
  // argument. Held by the typecheck, which reads this file.
  test('a read of the pages is handed the tally its notices are counted into', () => {
    expectTypeOf(pagesOf).parameter(1).toEqualTypeOf<Tally>()
  })
})
