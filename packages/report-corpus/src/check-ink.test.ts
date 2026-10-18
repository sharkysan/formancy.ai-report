import { clip, endPath, fill, PDFDocument, popGraphicsState, pushGraphicsState, rectangle, setFillingRgbColor, type PDFOperator } from '@pdfme/pdf-lib'
import type { ContentSvg } from 'pdfmake/interfaces.js'
import { describe, expect, test } from 'vitest'
import { inkAround, INK_BAND, INK_SCALE, verifyInk } from './check-ink.js'
import { verify } from './checks.js'
import type { ResolvedDocument } from './document.js'
import { expectation, type Fixture } from './fixture.js'
import { SVG_WINDOW } from './fixtures/svg.js'
import { rasterPixels } from './raster.js'
import { readPdf } from './read-pdf.js'
import { pdfmakePdf } from './testing/pdfmake.js'

/**
 * The pixels around a drawing (`check-ink.ts`): what a clip kept inside an
 * SVG image's box, which the operator list cannot say, since a path
 * painted inside a clip is listed whole however much of it the clip hides.
 */

const A4: [number, number] = [595.28, 841.89]
const group = (...operators: PDFOperator[]): PDFOperator[] => [pushGraphicsState(), ...operators, popGraphicsState()]

/** A page whose drawing is a blue square 60 pt wide at 100, 700, inside a clip of that square, and `after`, drawn once the clip is restored. */
async function page(...after: PDFOperator[]): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.addPage(A4).pushOperators(...group(rectangle(100, 700, 60, 60), clip(), endPath(), setFillingRgbColor(0.1, 0.3, 0.5), rectangle(90, 690, 80, 80), fill()), ...after)
  return document.save()
}

/** One SVG image of 60 pt square, alone on a page with 40 pt margins: what the PDFs here draw. */
function fixtureOf(fit: 'contain' | 'cover'): Fixture {
  const document: ResolvedDocument = {
    info: { title: 'Ink', creationDate: '2026-01-01T00:00:00Z' },
    page: { size: 'A4', orientation: 'portrait', margins: { top: 40, right: 40, bottom: 40, left: 40 } },
    pageHeader: [],
    pageFooter: [],
    body: [{ kind: 'image', asset: { id: 'window', mediaType: 'image/svg+xml', bytes: SVG_WINDOW }, width: 60, height: 60, fit }],
  }
  return { id: 'ink', title: 'ink', document, maxPages: 1, expect: expectation(document, { maxPagesExpected: 1, noEmptyPages: false }) }
}

describe('inkAround', () => {
  // Inside its clip, a drawing larger than its box shows nothing past it.
  // Painted once the clip is gone, a sliver a point wide beside it is ink
  // in the band, and the problem says how much and where it starts.
  test('finds no ink past a clipped drawing, and the ink of what is painted beside it', async () => {
    const box = { x: 100, top: A4[1] - 760, bottom: A4[1] - 700, width: 60, height: 60 }
    expect(inkAround(await rasterPixels(await page(), 1, INK_SCALE), INK_SCALE, box, INK_BAND)).toEqual([])
    const beside = await rasterPixels(await page(setFillingRgbColor(0.1, 0.3, 0.5), rectangle(160, 700, 1, 60), fill()), 1, INK_SCALE)
    expect(inkAround(beside, INK_SCALE, box, INK_BAND)).toEqual([expect.stringMatching(/^a drawing at 100, 81\.89 shows past its box: \d{3} pixels of ink within 2 pt of it, the first at 160, 81\.75$/)])
  })

  // A drawing at the paper's edge has no band past the edge to read: the
  // band is cut there, never read out of the page.
  test('reads the band up to the edge of the page and no further', async () => {
    const document = await PDFDocument.create()
    document.addPage(A4).pushOperators(setFillingRgbColor(0, 0, 0), rectangle(0, A4[1] - 20, 20, 20), fill())
    const pixels = await rasterPixels(await document.save(), 1, INK_SCALE)
    expect(inkAround(pixels, INK_SCALE, { x: 0, top: 0, bottom: 20, width: 20, height: 20 }, INK_BAND)).toEqual([])
    expect(inkAround(pixels, INK_SCALE, { x: 0, top: 0, bottom: 19, width: 19, height: 19 }, INK_BAND)).toEqual([expect.stringMatching(/^a drawing at 0, 0 shows past its box: \d+ pixels of ink within 2 pt of it, the first at 19, 0$/)])
  })
})

describe('verifyInk', () => {
  // `cover` draws the window twice as wide as its square box and leaves the
  // clip to hide the rest: the operator list shows it past the box, and the
  // pixels show none of it there. The drawing is found -- verify passes --
  // so the band was read and not skipped.
  test('finds nothing of a covering drawing past its box', async () => {
    const fixture = fixtureOf('cover')
    // The converter's options, which pdfmake hands it and its types do not name: the slice the renderer asks for to cover.
    const covering: ContentSvg & { readonly options: { readonly preserveAspectRatio: string } } = { svg: new TextDecoder().decode(SVG_WINDOW), width: 60, height: 60, options: { preserveAspectRatio: 'xMidYMid slice' } }
    const bytes = await pdfmakePdf({ pageMargins: [40, 40, 40, 40], content: [covering] })
    const pdf = await readPdf(bytes)
    expect(pdf.pages[0]!.paths.some((path) => path.x < 40 || path.x + path.width > 100)).toBe(true)
    expect(verify(fixture, pdf)).toEqual([])
    expect(await verifyInk(fixture, bytes)).toEqual([])
  })

  // Part of a drawing painted once its clip is restored -- a converter
  // that closed the clip one path too early -- is found inside its box by
  // the operator list and past it by the pixels, named by fixture and page.
  test("finds what a drawing paints past its box once its clip is restored, by the fixture's drawings", async () => {
    const fixture = fixtureOf('contain')
    const document = await PDFDocument.create()
    const clipped = (x: number, y: number, ...inside: PDFOperator[]): PDFOperator[] => group(rectangle(x, y, 60, 60), clip(), endPath(), ...inside)
    document.addPage(A4).pushOperators(...clipped(40, A4[1] - 100, setFillingRgbColor(0.1, 0.3, 0.5), rectangle(40, A4[1] - 100, 60, 60), fill()), setFillingRgbColor(0.1, 0.3, 0.5), rectangle(40, A4[1] - 102, 60, 2), fill())
    const bytes = await document.save()
    expect(await verifyInk(fixture, bytes)).toEqual([expect.stringMatching(/^ink: page 1: a drawing at 40, 40 shows past its box: \d+ pixels of ink within 2 pt of it, the first at 40, 100$/)])
  })
})
