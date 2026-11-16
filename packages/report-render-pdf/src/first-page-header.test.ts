import {
  drawingsOn,
  expectation as corpusExpectation,
  FIRST_PAGE_FIXTURES,
  readCodes,
  readPdf,
  verify,
  type Fixture,
  type ReadPdf,
} from '@formancy/report-corpus'
import { checkSvg, type Block, type Image, type ImageAsset, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { drawingUnits, MAX_SVG_DRAWING } from './assets.js'
import { renderPdf } from './node.js'
import { billDocument, resolvedBill, SIX_EXAMPLES } from './testing/bills.js'
import { bareDocument, details, documentOf, expectation, fixtureOf, heading, ledger, paragraph, TIMEOUT } from './testing/documents.js'
import { pageLines, type Line } from './testing/lines.js'
import { svg, svgAsset } from './testing/svg.js'

/**
 * Page 1's own header (0060), in the page header's place, proved on the
 * PDF the engine produced, read back with PDF.js (0003): page 1 prints its
 * own header, or none, and every later page the page header; each page's
 * body starts below the header that page prints; and what page 1's header
 * holds is a page region's, drawn on page 1 alone. The corpus's fixtures
 * of it -- a letterhead taller than the page header, none, and one
 * shorter -- are proved by its checks in `corpus.test.ts`; here each is
 * held to where a page header like its own would stand.
 */

async function rendered(document: ResolvedDocument, maxPages = 20): Promise<ReadPdf> {
  return readPdf(await renderPdf(document, { maxPages }))
}

/** `document` with page 1's own header taken away: what it was before the region existed. */
function withoutOwn(document: ResolvedDocument): ResolvedDocument {
  const { firstPageHeader: _own, ...rest } = document
  return rest
}

/** The one line of `page` that reads `text`. */
function line(pdf: ReadPdf, page: number, text: string): Line {
  const found = pageLines(pdf.pages[page - 1]!).filter((each) => each.text === text)
  expect(found, `page ${page}: ${text}`).toHaveLength(1)
  return found[0]!
}

const COLUMN_HEADER = 'Key Description Amount'

describe('the expectation the renderer derives', () => {
  // The renderer's tests derive what a PDF must show with their own copy
  // of the corpus's `expectation` (`testing/documents.ts`). Were the two to
  // disagree about page 1, a renderer that printed the page header there
  // could pass one and fail the other, and nobody would find out which.
  test("holds page 1 to its own header as the corpus's does", () => {
    for (const { document, expect: stated } of FIRST_PAGE_FIXTURES) {
      const ours = expectation(document, { maxPagesExpected: stated.maxPagesExpected })
      expect(ours.firstPage, document.info.title).toBeDefined()
      expect(ours.firstPage).toEqual(corpusExpectation(document, { maxPagesExpected: stated.maxPagesExpected }).firstPage)
    }
    expect(expectation(documentOf('Without', []), { maxPagesExpected: 1 })).not.toHaveProperty('firstPage')
  })
})

describe("page 1's own header, where a page header like it would stand", () => {
  // Page 1's own header is drawn in page 1's background and pdfmake's top
  // margin stays the page header's, page 1's body moved by the difference.
  // So page 1 must read exactly as it would under a page header like its
  // own -- its lines and drawing at the same places, its body starting at
  // the same top -- and every later page exactly as under the page header
  // alone. A body moved by the wrong amount would start under the header,
  // or leave a gap the report did not ask for, which the corpus's checks
  // would see only past their tolerance.
  test.each(FIRST_PAGE_FIXTURES.map((fixture): readonly [string, Fixture] => [fixture.id, fixture]))(
    '%s',
    async (_, fixture) => {
      const { document } = fixture
      const own = document.firstPageHeader!
      const [pdf, likeIt, before] = await Promise.all([
        rendered(document),
        rendered({ ...withoutOwn(document), pageHeader: own }),
        rendered(withoutOwn(document)),
      ])
      expect(verify(fixture, pdf)).toEqual([])
      expect(pdf.pages.length).toBeGreaterThanOrEqual(2)
      // Page 1: its own header's lines and drawings where the page header's would be, and the body from the same top.
      for (const text of fixture.expect.firstPage!.headerLines) expect(line(pdf, 1, text).top, text).toBeCloseTo(line(likeIt, 1, text).top, 2)
      expect(drawingsOn(pdf.pages[0]!)).toEqual(drawingsOn(likeIt.pages[0]!))
      expect(line(pdf, 1, COLUMN_HEADER).top).toBeCloseTo(line(likeIt, 1, COLUMN_HEADER).top, 2)
      // Every later page: as under the page header alone, and none of page 1's drawings.
      for (const [index, page] of pdf.pages.entries()) {
        if (index === 0) continue
        expect(line(pdf, page.number, COLUMN_HEADER).top, `page ${page.number}`).toBeCloseTo(line(before, 2, COLUMN_HEADER).top, 2)
        expect(drawingsOn(page), `page ${page.number}`).toEqual([])
      }
    },
    TIMEOUT,
  )
})

describe("page 1's own header, page by page", () => {
  const LETTERHEAD = Array.from({ length: 10 }, (_, index) => paragraph(`Letterhead line ${index + 1}`))

  // How many pages a report has is known only once it is laid out, so a
  // one-page report under its own header prints it, and the page header on
  // no page: an order that fits its first page reads as a letter, with no
  // running header above its letterhead.
  test(
    'a one-page report prints its own header, and the page header on no page',
    async () => {
      const document = { ...documentOf('One page', [paragraph('A short body')]), firstPageHeader: LETTERHEAD }
      const pdf = await rendered(document)
      expect(verify(fixtureOf('one-page', document, { minPagesExpected: 1, maxPagesExpected: 1 }), pdf)).toEqual([])
      const lines = pageLines(pdf.pages[0]!).map((each) => each.text)
      expect(lines).toContain('Letterhead line 10')
      expect(lines).not.toContain('Formancy Report corpus: One page')
    },
    TIMEOUT,
  )

  // A QR-bill's slip is the last page's foot, which on a one-page report
  // is page 1's: the slip is drawn there under page 1's own header, and
  // decodes as the bill it carries.
  test(
    'a one-page report with a QR-bill draws its slip under its own header',
    async () => {
      const bill = resolvedBill(SIX_EXAMPLES.two)
      const document = {
        ...billDocument(bill, [paragraph('Invoice 2026-0042')]),
        firstPageHeader: [paragraph('Invented Supplies Ltd', { size: 14, bold: true })],
      }
      const bytes = await renderPdf(document, { maxPages: 5 })
      const pdf = await readPdf(bytes)
      expect(pdf.pages).toHaveLength(1)
      expect((await readCodes(bytes, 1)).map((code) => code.text)).toEqual([bill.payload])
      const lines = pageLines(pdf.pages[0]!).map((each) => each.text)
      expect(lines).toContain('Invented Supplies Ltd')
      expect(lines).not.toContain('Formancy Report corpus: Invoice')
    },
    TIMEOUT,
  )

  // The slip prints on the last page, and which page that is is known only
  // once the pages are laid out: a first page header that reaches into the
  // slip is refused, though the body runs on to a later page whose page
  // header leaves the slip its room. The cost the record names.
  test('holds the slip below the taller header, page 1’s own among them', async () => {
    const own = Array.from({ length: 53 }, (_, index) => paragraph(`Letterhead line ${index + 1}`, { size: 8 }))
    const document = { ...billDocument(resolvedBill(SIX_EXAMPLES.two), [ledger('lines', details(1, 80))]), firstPageHeader: own }
    await expect(renderPdf(document, { maxPages: 10 })).rejects.toMatchObject({ code: 'content-too-large', subject: 'paymentPart' })
    await expect(renderPdf({ ...document, firstPageHeader: own.slice(0, 40) }, { maxPages: 10 })).resolves.toBeInstanceOf(Uint8Array)
  })

  // A heading first on page 1, kept with a block page 1 cannot hold under
  // a letterhead, is first on its page: breaking before it would leave
  // page 1 its letterhead alone, and the heading no better kept on the
  // next. Page 1's first line starts below its own header, lower than any
  // later page's, so a rule that took the page header's top for page 1's
  // would break before it.
  test(
    'keeps a heading first on page 1 there, its block on the next page',
    async () => {
      const block: Block = { kind: 'keepTogether', blocks: Array.from({ length: 64 }, (_, index) => paragraph(`Measured line ${index + 1}`)) }
      const document = { ...documentOf('Heading', [heading('Measurements'), block]), firstPageHeader: LETTERHEAD }
      const pdf = await rendered(document)
      expect(verify(fixtureOf('heading-first', document, { minPagesExpected: 2, maxPagesExpected: 2, noEmptyPages: false }), pdf)).toEqual([])
      expect(line(pdf, 1, 'Measurements').top).toBeGreaterThan(line(pdf, 1, 'Letterhead line 10').bottom)
      expect(pageLines(pdf.pages[1]!)[1]?.text).toBe('Measured line 1')
    },
    TIMEOUT,
  )

  // Where page 1's own header is the taller, page 1's body is the shorter,
  // and a block kept together that a later page holds but page 1 does not
  // starts on page 2: page 1 prints its header and nothing under it, and
  // nothing of the block is lost. The cost the record names.
  test(
    'starts a block page 1 cannot hold under its taller header on page 2, whole',
    async () => {
      const block: Block = { kind: 'keepTogether', blocks: Array.from({ length: 64 }, (_, index) => paragraph(`Measured line ${index + 1}`)) }
      const document = { ...documentOf('Block', [block]), firstPageHeader: LETTERHEAD }
      const pdf = await rendered(document)
      expect(verify(fixtureOf('block-first', document, { minPagesExpected: 2, maxPagesExpected: 2, noEmptyPages: false }), pdf)).toEqual([])
      expect(pageLines(pdf.pages[0]!).map((each) => each.text)).toEqual([...LETTERHEAD.map((_, index) => `Letterhead line ${index + 1}`), 'Page 1 of 2'])
    },
    TIMEOUT,
  )

  // Page 1's body is taller where page 1's own header takes less room than
  // the page header, and a report that fits the page limit only with that
  // room is drawn: neither the least height a body needs nor the page the
  // body's tables are measured on may count page 1 as short as the others.
  test(
    'draws a table that fits the page limit only in page 1’s taller body',
    async () => {
      const tall = Array.from({ length: 70 }, (_, index) => paragraph(`Running header line ${index + 1}`, { size: 8 }))
      const document = { ...documentOf('Taller page 1', [ledger('lines', details(1, 30))]), pageHeader: tall, firstPageHeader: [] }
      const pdf = await rendered(document, 1)
      expect(verify(fixtureOf('taller-page-1', document, { minPagesExpected: 1, maxPagesExpected: 1 }), pdf)).toEqual([])
    },
    TIMEOUT,
  )
})

describe("what page 1's own header holds", () => {
  /** A drawing of one path of `lines` lines, filled: about `lines` units to draw. */
  const path = (lines: number): string =>
    svg(`<path d="M0 0${Array.from({ length: lines }, (_, i) => `L${(i * 37) % 100} ${(i * 61) % 100}`).join('')}" fill="#1f4e79"/>`)
  const image = (asset: ImageAsset): Image => ({ kind: 'image', asset, width: 30, height: 30, fit: 'contain' })

  // A drawing in the page header is drawn on every page and counts as
  // many times as the report may have pages (0030); page 1's own header is
  // drawn on page 1 alone, so its drawing counts once, as the body's does.
  // Counted on every page, a letterhead's logo would refuse a long report
  // for drawings it never draws.
  test(
    'counts its SVG once toward what a render may draw',
    async () => {
      const asset = svgAsset(path(MAX_SVG_DRAWING / 100 - 1 - 24 - 2000), 'logo')
      const checked = checkSvg(asset.bytes)
      if (!checked.ok) throw new Error(checked.message)
      const pages = Math.floor(MAX_SVG_DRAWING / drawingUnits(checked)) + 1
      const bare = bareDocument('Logo', [paragraph('One page')])
      await expect(renderPdf({ ...bare, pageHeader: [image(asset)] }, { maxPages: pages })).rejects.toMatchObject({
        code: 'content-too-large',
        subject: 'logo',
      })
      const pdf = await readPdf(await renderPdf({ ...bare, firstPageHeader: [image(asset)] }, { maxPages: pages }))
      expect(drawingsOn(pdf.pages[0]!).map((drawing) => drawing.box.slice(2))).toEqual([[30, 30]])
    },
    TIMEOUT,
  )

  // Page 1's own header is a page region: a heading in it is kept with
  // nothing, as in the page header, and gets no id, which pdfmake would
  // write as a named destination. Built as the body, it would carry a rule
  // pdfmake runs for the background's nodes too, and a destination the
  // report never asked for.
  test(
    'keeps a heading in it with nothing, and names no destination for it',
    async () => {
      const kept = [heading('Invented Supplies Ltd'), paragraph('1 Example Street, 1000 Sample Town')]
      // PDFKit writes the catalog's names tree uncompressed, and its `/Dests` in every PDF, empty or not: the names are the strings in it.
      const destinations = async (document: ResolvedDocument): Promise<string[]> => {
        const text = Buffer.from(await renderPdf(document, { maxPages: 5 })).toString('latin1')
        const names = /\/Dests <<\s*\/Names \[(.*?)\n\]/s.exec(text)
        expect(names, document.info.title).not.toBeNull()
        return [...names![1]!.matchAll(/\(([^)]*)\)/g)].map((match) => match[1]!)
      }
      expect(await destinations(documentOf('In the body', kept))).toEqual(['kept-1'])
      expect(await destinations({ ...documentOf('In page 1’s header', [paragraph('Body')]), firstPageHeader: kept })).toEqual([])
    },
    TIMEOUT,
  )
})
