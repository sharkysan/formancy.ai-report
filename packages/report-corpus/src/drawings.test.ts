import type { Content, ContentSvg, TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { describe, expect, test } from 'vitest'
import { verify } from './checks.js'
import type { Block, Image, ResolvedDocument } from './document.js'
import { expectation, type Fixture } from './fixture.js'
import { encodePng } from './fixtures/png.js'
import { SVG_MARK } from './fixtures/svg.js'
import { readPdf } from './read-pdf.js'
import { pdfmakePdf } from './testing/pdfmake.js'

/**
 * Where the checks find an SVG image (`drawings.ts`): a rectangular clip of
 * its size with paint inside it, on PDFs made with pdfmake's own `svg`
 * node, one correct and the others each wrong in the one way a check
 * exists to see. A check that found nothing wrong anywhere would pass every
 * case but the first; one that complained about everything, only the first.
 */

const MARGIN = 40
const TITLE = 'Drawings report'
const MARK = new TextDecoder().decode(SVG_MARK)
/** A drawing that paints nothing: a square neither filled nor stroked. */
const NOTHING = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="none"/></svg>'

const svgImage = (width: number, height: number): Image => ({ kind: 'image', asset: { id: 'mark', mediaType: 'image/svg+xml', bytes: SVG_MARK }, width, height, fit: 'contain' })
const pngImage = (width: number, height: number): Image => ({ kind: 'image', asset: { id: 'seal', mediaType: 'image/png', bytes: encodePng(2, 2, () => [0, 0, 0]) }, width, height, fit: 'contain' })
const text = (value: string): Block => ({ kind: 'paragraph', runs: [{ text: value }] })

/** A document of two pages, the mark in the page header of each and once in the body, between two lines. */
function documentOf(body: readonly Block[] = [text('Before'), svgImage(60, 60), text('After'), { kind: 'pageBreak' }, text('Second page')], header: readonly Block[] = [text(TITLE), svgImage(20, 20)]): ResolvedDocument {
  return {
    info: { title: 'Drawings', creationDate: '2026-01-01T00:00:00Z' },
    page: { size: 'A4', orientation: 'portrait', margins: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } },
    pageHeader: header,
    pageFooter: [{ kind: 'paragraph', runs: [{ text: 'Page ' }, { field: 'pageNumber' }, { text: ' of ' }, { field: 'pageCount' }] }],
    body,
  }
}

function fixtureOf(document: ResolvedDocument = documentOf()): Fixture {
  return { id: 'drawings', title: 'drawings', document, maxPages: 5, expect: expectation(document, { minPagesExpected: 2, maxPagesExpected: 2 }) }
}

const svg = (width: number, height: number, drawing = MARK): ContentSvg => ({ svg: drawing, width, height })
/** A 2 × 2 black PNG as a data URL, made afresh for each definition: pdfmake replaces an image in the definition it is given. */
const png = (width: number, height: number): Content => ({ image: `data:image/png;base64,${Buffer.from(encodePng(2, 2, () => [0, 0, 0])).toString('base64')}`, width, height })

interface Options {
  /** What the page header draws under its title on page `page`: the mark at 20 × 20 unless told otherwise. */
  readonly header?: (page: number) => Content | undefined
  /** What the body draws between its two lines: the mark at 60 × 60 unless told otherwise, nothing for `null`. */
  readonly drawn?: Content | null
}

/** The two pages as pdfmake draws them: the page header in the top margin, the footer in the bottom one, both inside the document's own margins. */
function definition({ header = () => svg(20, 20), drawn = svg(60, 60) }: Options = {}): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [MARGIN, MARGIN + 50, MARGIN, MARGIN + 30],
    header: (page) => {
      const below = header(page)
      return { stack: [{ text: TITLE }, ...(below === undefined ? [] : [below])], margin: [MARGIN, MARGIN, MARGIN, 0] }
    },
    footer: (page, pages) => ({ text: `Page ${page} of ${pages}`, alignment: 'center', margin: [MARGIN, 10, MARGIN, 0] }),
    content: [{ text: 'Before' }, ...(drawn === null ? [] : [drawn]), { text: 'After' }, { text: 'Second page', pageBreak: 'before' }],
  }
}

async function problems(made: TDocumentDefinitions, of: Fixture = fixtureOf()): Promise<string[]> {
  return verify(of, await readPdf(await pdfmakePdf(made)))
}

describe('verify finds each SVG image by its drawing', () => {
  // Every case below is shown to complain about one defect; this shows the
  // drawings, the page header's on both pages and the body's, are found
  // where they are -- and that an SVG image, of which the PDF embeds no
  // image, is not counted as a missing one.
  test('finds nothing wrong with a correct PDF', async () => {
    expect(await problems(definition())).toEqual([])
  })

  // An SVG image left out prints a page with a hole where the logo is, and
  // every text check passes.
  test('a drawing missing from the body', async () => {
    expect(await problems(definition({ drawn: null }))).toEqual(['drawings: the SVG image 1 of the body, 60 × 60 pt, is not drawn: no clip of its size holds a painted path'])
  })

  // Drawn at another size, it is not the logo the author placed: the clips
  // that do hold paint are named, so that the size it was drawn at is seen.
  test('a drawing of the wrong size', async () => {
    expect(await problems(definition({ drawn: svg(60, 30) }))).toEqual(['drawings: the SVG image 1 of the body, 60 × 60 pt, is not drawn: no clip of its size holds a painted path; the clips that do are 60 × 30 pt on page 1'])
  })

  // The body's drawings are found in the order the document gives them,
  // as its images are: two logos printed in each other's places are both
  // on the page, and neither is where it belongs.
  test('two drawings printed in the other order', async () => {
    const two = fixtureOf(documentOf([text('Before'), svgImage(60, 60), svgImage(60, 30), text('After'), { kind: 'pageBreak' }, text('Second page')]))
    expect(await problems(definition({ drawn: { stack: [svg(60, 60), svg(60, 30)] } }), two)).toEqual([])
    expect(await problems(definition({ drawn: { stack: [svg(60, 30), svg(60, 60)] } }), two)).toEqual(['drawings: the SVG image 2 of the body, 60 × 30 pt, is not drawn: no clip of its size holds a painted path'])
  })

  // A clip of the right size with nothing painted inside it is a box the
  // converter set up and drew nothing in: the drawing lost on its way.
  test('a drawing with nothing painted inside its clip', async () => {
    expect(await problems(definition({ drawn: svg(60, 60, NOTHING) }))).toEqual([expect.stringMatching(/^drawings: the SVG image 1 of the body, 60 × 60 pt, has its clip at 40, [\d.]+ on page 1, and nothing painted inside it$/)])
  })

  // An SVG embedded as a picture of itself is not sharp at any size: it is
  // an image the document has no PNG for, and no drawing.
  test('a drawing printed as an image', async () => {
    expect(await problems(definition({ drawn: png(60, 60) }))).toEqual(['drawings: 1 image drawn; 0 expected', 'drawings: the SVG image 1 of the body, 60 × 60 pt, is not drawn: no clip of its size holds a painted path'])
  })

  // A page region is laid out again on every page: a logo in the page
  // header that the second page lost is missing there, wherever the first
  // page has it.
  test("a page header's drawing missing from a page", async () => {
    expect(await problems(definition({ header: (page) => (page === 2 ? undefined : svg(20, 20)) }))).toEqual(['drawings: page 2: the SVG image 1 of the page regions, 20 × 20 pt, is not drawn: no clip of its size holds a painted path'])
  })

  // The same holds for a PNG in a page header, counted on every page
  // before the body's images are.
  test("a page header's image missing from a page", async () => {
    const withSeal = fixtureOf(documentOf(undefined, [text(TITLE), pngImage(20, 20)]))
    expect(await problems(definition({ header: () => png(20, 20) }), withSeal)).toEqual([])
    expect(await problems(definition({ header: (page) => (page === 2 ? undefined : png(20, 20)) }), withSeal)).toEqual(["drawings: page 2: the page regions' image of 20 × 20 pt is not drawn"])
  })
})

describe('verify holds a drawing to the page as it holds an image', () => {
  // A drawing over text hides the text from a reader and from nobody else:
  // the text still extracts. Only the drawing's box shows it.
  test('a drawing over text', async () => {
    const found = await problems(definition({ drawn: { ...svg(60, 60), absolutePosition: { x: MARGIN, y: MARGIN + 50 } } }))
    expect(found).toContainEqual(expect.stringMatching(/^drawings: page 1: a drawing at 40, 90 overlaps 'Before' by [\d.]+ × [\d.]+ pt$/))
  })

  // A drawing past a margin is cut off by a printer, though a viewer shows it.
  test('a drawing past the right margin', async () => {
    const found = await problems(definition({ drawn: { ...svg(60, 60), absolutePosition: { x: 520, y: 400 } } }))
    expect(found).toContainEqual('drawings: page 1: a drawing at 520, 400 extends past the right margin (to 580 pt; the margin is at 555.28)')
  })

  // A page that holds a drawing alone prints something, and one whose only
  // drawing went missing prints nothing: both are told apart.
  test('a page that holds a drawing alone', async () => {
    const alone = fixtureOf(documentOf([text('Before'), { kind: 'pageBreak' }, svgImage(60, 60)], [text(TITLE)]))
    const made = (drawn: boolean): TDocumentDefinitions => ({ ...definition({ header: () => undefined }), content: [{ text: 'Before' }, drawn ? { ...svg(60, 60), pageBreak: 'before' } : { text: '', pageBreak: 'before' }] })
    expect(await problems(made(true), alone)).toEqual([])
    expect(await problems(made(false), alone)).toEqual(['drawings: page 2 prints nothing between its page header and footer', 'drawings: the SVG image 1 of the body, 60 × 60 pt, is not drawn: no clip of its size holds a painted path'])
  })
})
