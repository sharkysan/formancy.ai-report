import pdfmake from 'pdfmake'
import { readPdfNumbers, SVG_BOUND, SVG_BOUND_SIDE } from '@formancy/report-corpus'
import { RenderRefusal, type Block, type Image, type ImageAsset, type ResolvedDocument } from '@formancy/report-runtime'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { checkImageAsset, type Vector } from './assets.js'
import { renderPdf } from './node.js'
import { PDF_A_INTEGER, PDF_A_NESTING, SVG_INTEGER_BOUND, svgReach } from './svg-pdfa.js'
import { bareDocument, PAGE, TIMEOUT } from './testing/documents.js'
import { invoiced } from './testing/e-invoice.js'
import { svg, svgAsset } from './testing/svg.js'

/**
 * An SVG in an e-invoice (`svg-pdfa.ts`, 0030 beside 0031), proved on the
 * PDF the engine produced (0003): each drawing either drawn, and then no
 * integer in its PDF past the 2,147,483,647 a PDF/A-3 may hold -- read
 * from every object and every content stream, inflated, by report-corpus's
 * `readPdfNumbers`, since veraPDF reads none in a soft mask's group, a
 * clip's -- or refused as unsupported before pdfmake runs, naming the
 * asset. The same drawings in a report that is no e-invoice still draw.
 */

const GRADIENT = '<linearGradient id="g"><stop/><stop offset="1" stop-color="#e76f51"/></linearGradient>'
const TRANSLUCENT = '<linearGradient id="t"><stop/><stop offset="1" stop-opacity="0.5"/></linearGradient>'
const CLIP = '<clipPath id="c"><rect width="1" height="1"/></clipPath>'
const BOX_CLIP = '<clipPath id="c" clipPathUnits="objectBoundingBox"><rect width="0.5" height="0.5"/></clipPath>'
const BACKGROUND = '<rect width="1" height="1" fill="#264653"/>'
/** A gradient two millionths as wide as the box it is drawn in, moved on half its width: in the box of a curve's control points it starts at the box's left edge, and in the curve's own, further in. */
const NARROW = '<linearGradient id="n" gradientTransform="matrix(0.000002 0 0 1 0.5 0)"><stop/><stop offset="1" stop-color="#e76f51"/></linearGradient>'

/** svg-threats.test.ts's drawing shrunk to the bound: a clip, a group opacity and a translucent gradient under two groups of a thousandth. */
const SHRUNK = svg(
  `${CLIP}${TRANSLUCENT}<rect width="100" height="100" fill="#264653"/><g transform="scale(0.001)"><g transform="scale(0.001)"><rect width="5" height="5" clip-path="url(#c)"/><g opacity="0.5"><rect width="5" height="5" fill="url(#t)"/></g></g></g>`,
)

/** A group at an opacity shrunk by `scale` in a viewBox one unit square at (10^6, 10^6): its inverse takes the origin `1 / scale` times as far. */
const farOrigin = (scale: string): string =>
  svg(
    `<rect x="1000000" y="1000000" width="1" height="1" fill="#264653"/><g opacity="0.5" transform="scale(${scale})"><rect width="1" height="1" fill="#e9c46a"/></g>`,
    '1000000 1000000 1 1',
  )

/** Twenty-five or twenty-six groups with a transform each, nested, a square at the foot: drawn 28 or 29 graphics states deep. */
const nested = (levels: number): string =>
  svg(`${'<g transform="translate(0.001)">'.repeat(levels)}<rect width="1" height="1" fill="#264653"/>${'</g>'.repeat(levels)}`, '0 0 1 1')

/** An arc of radii a millionth and a million drawn across a million, which the converter grows to reach its ends. */
const GROWN_ARC = svg('<path d="M0 0 A0.000001 1000000 0 1 1 1000000 0 Z" fill="#264653"/>', '0 0 1000 1000')

/** A quadratic and `count` reflected after it between -10^6 and 10^6: each reflection takes the control point 2 × 10^6 further out. */
const reflected = (count: number): string =>
  `M0 0 Q0 1000000 1000000 0${Array.from({ length: count }, (_, i) => (i % 2 === 0 ? ' T-1000000 0' : ' T1000000 0')).join('')}`

type Paper = 'portrait' | 'landscape' | 'bare'

/** What an e-invoice does with the drawing: draws it, or refuses it for its numbers' range or for its nesting. */
type Verdict = 'drawn' | 'range' | 'nesting'

interface Case {
  readonly name: string
  readonly drawing: string
  readonly width: number
  readonly height: number
  readonly fit: Image['fit']
  readonly paper: Paper
  readonly verdict: Verdict
  /** How many times the largest number its PDF writes the bound may be, where the bound passes 10^8. */
  readonly slack?: number
}

const square = (name: string, drawing: string, side: number, verdict: Verdict, paper: Paper = 'portrait', slack?: number): Case => ({
  name,
  drawing,
  width: side,
  height: side,
  fit: 'contain',
  paper,
  verdict,
  ...(slack === undefined ? {} : { slack }),
})

/**
 * The drawings the defect was measured on, on 18 October 2026 with veraPDF
 * 1.30.3 (the first six), and those the analysis of the converter and its
 * review found beside them. The first: drawn a point square on A4, the
 * shrunk drawing's groups wrote /BBox entries of -5,669,000,000 and
 * 78,520,000,000 into an e-invoice that said it was a PDF/A-3b, failing
 * veraPDF's 6.1.13-1 four times -- the page's corners, 56.69 pt of margin
 * and 785.2 pt of page below the image, over the fit's 0.01, through the
 * groups' inverse of 10^6.
 */
const CASES: readonly Case[] = [
  square('the shrunk drawing, a point square', SHRUNK, 1, 'range'),
  square('the shrunk drawing, 480 pt square', SHRUNK, 480, 'drawn'),
  square(
    'a gradient scaled a thousandfold, 550 pt square on a landscape page',
    svg(`${GRADIENT}<g transform="scale(1000)"><rect width="1000" height="1000" fill="url(#g)"/></g>`, '0 0 1 1'),
    550,
    'drawn',
    'landscape',
  ),
  square(
    'a gradient scaled a thousandfold, a point square',
    svg(`${GRADIENT}<g transform="scale(1000)"><rect width="1000" height="1000" fill="url(#g)"/></g>`, '0 0 1 1'),
    1,
    'drawn',
  ),
  square(
    'paths to the bound, a point square',
    svg('<path d="M0 0 L999999 0 L999999 999999 Z" fill="#1f4e79"/><path d="M0 0 L-999999 1 L0 1 Z" fill="#e9c46a"/>', '0 0 1 1'),
    1,
    'drawn',
  ),
  square(
    'paths to the bound, 480 pt square',
    svg('<path d="M0 0 L999999 0 L999999 999999 Z" fill="#1f4e79"/><path d="M0 0 L-999999 1 L0 1 Z" fill="#e9c46a"/>', '0 0 1 1'),
    480,
    'drawn',
  ),
  // A viewBox a million wide in a box a tenth of a point: the fit's scale
  // is 10^-7, and a clipped group's box ten times its 7.85 × 10^8 at a point.
  square(
    'a clipped group in a viewBox a million wide, a point square',
    svg(
      `${'<clipPath id="c"><rect width="1000000" height="500000"/></clipPath>'}<g clip-path="url(#c)"><rect width="1000000" height="1000000" fill="#264653"/></g>`,
      '0 0 1000000 1000000',
    ),
    1,
    'drawn',
  ),
  square(
    'a clipped group in a viewBox a million wide, a tenth of a point square',
    svg(
      `${'<clipPath id="c"><rect width="1000000" height="500000"/></clipPath>'}<g clip-path="url(#c)"><rect width="1000000" height="1000000" fill="#264653"/></g>`,
      '0 0 1000000 1000000',
    ),
    0.1,
    'range',
  ),
  // The fit is written as a cm of its scale and of the viewBox's origin
  // times it: 480 times 10^6, which no group or gradient here outgrows.
  square(
    'a square a million from the origin, 480 pt square',
    svg('<rect x="1000000" y="1000000" width="1" height="1" fill="#264653"/>', '1000000 1000000 1 1'),
    480,
    'drawn',
  ),
  square('a group shrunk a thousandfold far from the origin', farOrigin('0.001'), 100, 'drawn'),
  square('a group shrunk ten thousandfold far from the origin', farOrigin('0.0001'), 100, 'range'),
  square(
    'a group translated a million and shrunk a millionfold',
    svg(`${BACKGROUND}<g opacity="0.5" transform="translate(1000000 1000000) scale(0.000001)"><rect width="1" height="1" fill="#e9c46a"/></g>`, '0 0 1 1'),
    100,
    'range',
  ),
  square(
    'a group translated and shrunk back near the origin',
    svg(
      `${BACKGROUND}<g opacity="0.5" transform="translate(-0.5 -0.5) scale(0.0001) translate(10000 10000)"><rect width="1" height="1" fill="#e9c46a"/></g>`,
      '0 0 1 1',
    ),
    100,
    'drawn',
  ),
  // Inside a group PDFKit's matrix starts again: a gradient there is drawn
  // under the matrices below the group's, here 10^6 times a box of 10^4,
  // which wrote a pattern /Matrix of 10,000,000,000 at any size.
  square(
    'a gradient grown inside a group shrunk a millionfold',
    svg(
      `${GRADIENT}${BACKGROUND}<g opacity="0.5" transform="scale(0.000001)"><rect transform="scale(1000000)" width="10000" height="10000" fill="url(#g)"/></g>`,
      '0 0 1 1',
    ),
    480,
    'range',
  ),
  // A clip in objectBoundingBox units draws in its group's box, here 10^12
  // wide, written as a cm inside the clip's group: veraPDF passed it.
  square(
    'a group clipped in its own box of 10^12',
    svg(`${BOX_CLIP}<g clip-path="url(#c)"><rect transform="scale(1000000)" width="1000000" height="1000000" fill="#264653"/></g>`, '0 0 1 1'),
    100,
    'range',
  ),
  // The box the converter draws a gradient or a clip in is the outline's,
  // and the cleaner's of a curve its control points': the two differ, and
  // a bound in the cleaner's box alone fell short (the review, 18 October
  // 2026). This curve's control points span -5 × 10^5 to 5 × 10^5 and its
  // outline starts at -2.5 × 10^5: `NARROW` in the cleaner's box started
  // at its left edge, 0, and in the converter's a quarter of the way on,
  // and grown back a millionfold inside its group the converter wrote
  // 125,000,000,000, where the bound in the cleaner's box said 2 × 10^6.
  // Over every box inside the cleaner's it reaches 5 × 10^11, four times
  // what is written, since a box at the curve's right edge is among them.
  square(
    'a gradient in the box of a curve, grown back inside a group',
    svg(
      `${NARROW}${BACKGROUND}<g opacity="0.5" transform="scale(0.000001)"><g transform="scale(1000000)"><path d="M500000 0 C-500000 0 -500000 1 500000 1 Z" fill="url(#n)"/></g></g>`,
      '0 0 1 1',
    ),
    480,
    'range',
    'portrait',
    4,
  ),
  // A clip in its group's box on a curve: the cleaner's box of it is 2 to 4
  // × 10^9 across, the converter's from 2.5 × 10^9, which it wrote into the
  // clip's group; the cleaner's near corner, 2 × 10^9, was under the bound.
  square(
    'a group clipped in the box of a curve',
    svg(
      `${BOX_CLIP}${BACKGROUND}<g clip-path="url(#c)"><path transform="scale(4000)" d="M1000000 0 C500000 0 500000 1 1000000 1 Z" fill="#e9c46a"/></g>`,
      '0 0 1 1',
    ),
    100,
    'range',
  ),
  // The converter grows an arc's radii until they reach its ends, keeping
  // their ratio: radii of a millionth and a million drawn across a million
  // became 0.5 and 5 × 10^17, and its control points, -5.2 × 10^17, were
  // written into the page's own stream at any box.
  square('an arc whose radii the converter grows across a million', GROWN_ARC, 100, 'range'),
  // A quadratic reflected after a quadratic walks its control point away:
  // two thousand of them between -10^6 and 10^6 wrote -2,667,000,000.
  square('a chain of reflected quadratics', svg(`<path d="${reflected(2000)} Z" fill="#264653"/>`, '0 0 1000 1000'), 100, 'range'),
  square('a short chain of reflected quadratics', svg(`<path d="${reflected(100)} Z" fill="#264653"/>`, '0 0 1000 1000'), 100, 'drawn'),
  // A gradient outside every group, translated two million from a viewBox
  // a million from the origin, covering an A4 page with no margins: its
  // pattern's translation reached 1,487,500,421, under the range.
  {
    name: 'a gradient far from a far origin, covering a page',
    drawing: svg(`${GRADIENT}<rect x="-1000000" y="-1000000" width="1000000" height="1000000" fill="url(#g)"/>`, '1000000 1000000 1 1000000'),
    width: 595,
    height: 841,
    fit: 'cover',
    paper: 'bare',
    verdict: 'drawn',
  },
  square(`a square ${PDF_A_NESTING} graphics states deep`, nested(25), 100, 'drawn'),
  square(`a square ${PDF_A_NESTING + 1} graphics states deep`, nested(26), 100, 'nesting'),
]

const PAPERS: Readonly<Record<Paper, ResolvedDocument['page']>> = {
  portrait: PAGE,
  landscape: { size: 'A4', orientation: 'landscape', margins: { top: 20, right: 20, bottom: 20, left: 20 } },
  bare: { size: 'A4', orientation: 'portrait', margins: { top: 0, right: 0, bottom: 0, left: 0 } },
}

/** `body` on a page of `paper`, after a page break, as the defect was measured: an image at the top of a second page. */
const documentOf = (paper: Paper, body: readonly Block[]): ResolvedDocument => ({
  ...bareDocument('Rechnung', [{ kind: 'pageBreak' }, ...body]),
  page: PAPERS[paper],
})

const imageOf = (asset: ImageAsset, { width, height, fit }: Pick<Case, 'width' | 'height' | 'fit'>): Image => ({ kind: 'image', asset, width, height, fit })

/** The integers of `pdf` past what a PDF/A may hold. */
async function pastTheRange(pdf: Uint8Array): Promise<number[]> {
  return (await readPdfNumbers(pdf)).filter((number) => number.integer && Math.abs(number.value) > PDF_A_INTEGER).map((number) => number.value)
}

/** PDFKit rounds what it writes to six places (pdfkit.js 173-178), so a number is read back up to half a millionth past what was computed. */
const ROUNDING = 5e-7

/** The largest magnitude of any number `pdf` writes. */
async function largest(pdf: Uint8Array): Promise<number> {
  return Math.max(...(await readPdfNumbers(pdf)).map((number) => Math.abs(number.value)))
}

/** What `document` refuses with, or undefined when it draws. */
const refusalOf = (document: ResolvedDocument): Promise<unknown> =>
  renderPdf(document, { maxPages: 2 }).then(
    () => undefined,
    (error: unknown) => error,
  )

/** What each refusal's message begins with. */
const REFUSED: Readonly<Record<Exclude<Verdict, 'drawn'>, RegExp>> = {
  range: /^the image logo is an SVG whose numbers/,
  nesting: /^the image logo is an SVG that pdfmake's converter draws \d+ graphics states deep/,
}

/** That `document` is refused as unsupported for `verdict`, naming the image `logo`, before pdfmake is asked for anything. */
async function expectRefused(document: ResolvedDocument, verdict: Exclude<Verdict, 'drawn'> = 'range'): Promise<void> {
  const created = vi.spyOn(pdfmake, 'createPdf')
  const refusal = await refusalOf(document)
  expect(refusal).toBeInstanceOf(RenderRefusal)
  expect(refusal).toMatchObject({ code: 'unsupported', subject: 'logo', message: expect.stringMatching(REFUSED[verdict]) })
  expect(created).not.toHaveBeenCalled()
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('an SVG in an e-invoice', () => {
  // Each drawing is either drawn, and its PDF/A-3 holds no integer past
  // the range anywhere -- a renderer that refused nothing would fail the
  // shrunk drawing at a point, the grown gradients, the curves' boxes, the
  // arc, the chain and the far origins -- or refused before pdfmake is
  // asked for anything, naming the asset: no PDF that says it is a PDF/A
  // and is not one. A renderer that refused every group, or every curve,
  // would fail the drawings drawn.
  test.each(CASES)(
    '$name: $verdict',
    async ({ name, drawing, paper, verdict, ...box }) => {
      const document = invoiced(documentOf(paper, [imageOf(svgAsset(drawing, 'logo'), box)]))
      if (verdict === 'drawn') expect(await pastTheRange(await renderPdf(document, { maxPages: 2 })), name).toEqual([])
      else await expectRefused(document, verdict)
    },
    TIMEOUT,
  )

  // The refusal is the e-invoice's: a report that is no e-invoice is no
  // PDF/A, and draws every one of them as it always did -- those refused
  // for their range with the integers past it the e-invoice would have
  // held.
  test(
    'leaves every drawing drawn in a report that is no e-invoice',
    async () => {
      for (const { name, drawing, paper, verdict, ...box } of CASES) {
        const pdf = await renderPdf(documentOf(paper, [imageOf(svgAsset(drawing, 'logo'), box)]), { maxPages: 2 })
        if (verdict === 'range') expect((await pastTheRange(pdf)).length, name).toBeGreaterThan(0)
      }
    },
    TIMEOUT,
  )

  // The bound is a bound: every number the converter wrote for each
  // drawing, read back from the PDF, is no larger than it, so a refusal
  // that compared the PDF/A's range with it holds the PDF to the range. And
  // it is near what was written where the drawing's numbers are large, so
  // that it refuses no drawing for a bound grown loose: at most twice, or
  // the case's slack, where it passes 10^8. A bound that left out the
  // page's side, the fit's offset, the origin, a gradient's translation, a
  // curve's outline inside its control points or the points the converter
  // draws an outline with would fall short of one of them.
  test(
    'is at least every number the PDF writes for each drawing, and near the largest',
    async () => {
      const page = (paper: Paper): { paperWidth: number; paperHeight: number } =>
        PAPERS[paper].orientation === 'landscape' ? { paperWidth: 841.89, paperHeight: 595.28 } : { paperWidth: 595.28, paperHeight: 841.89 }
      for (const { name, drawing, paper, slack = 2, ...box } of CASES) {
        const asset = svgAsset(drawing, 'logo')
        const vector = (await checkImageAsset(asset)) as Vector
        const reach = svgReach(vector, box, page(paper))
        const without = await largest(await renderPdf(documentOf(paper, []), { maxPages: 2 }))
        const drawnLargest = await largest(await renderPdf(documentOf(paper, [imageOf(asset, box)]), { maxPages: 2 }))
        expect(drawnLargest, name).toBeLessThanOrEqual(Math.max(reach, without) + ROUNDING)
        if (reach > 1e8) expect(drawnLargest, name).toBeGreaterThanOrEqual(reach / slack)
      }
    },
    TIMEOUT,
  )

  // What to do depends on what reached past the range: a drawing whose
  // groups grow as its box shrinks is drawn larger, and one whose own
  // outlines reach that far, at any box, is saved again from its program.
  // Telling the person with the arc to draw it larger would send them to
  // a box that changes nothing.
  test(
    'says to draw it larger, or to save it again, by what reached past the range',
    async () => {
      const at = (drawing: string, side: number): Promise<unknown> =>
        refusalOf(invoiced(documentOf('portrait', [imageOf(svgAsset(drawing, 'logo'), { width: side, height: side, fit: 'contain' })])))
      expect(await at(SHRUNK, 1)).toMatchObject({ message: expect.stringMatching(/: draw it larger, or flatten the transforms/) })
      expect(await at(GROWN_ARC, 480)).toMatchObject({ message: expect.stringMatching(/: save it again from the drawing program/) })
    },
    TIMEOUT,
  )

  // An image in a page header or footer is drawn on every page, and held
  // as one in the body is: the shrunk drawing a point square in a page
  // header. A check that passed the regions' images over would draw it,
  // writing 78,520,000,000 as it does in a report that is no e-invoice.
  test(
    'refuses an image in a page region as one in the body',
    async () => {
      const asset = svgAsset(SHRUNK, 'logo')
      await expectRefused(invoiced({ ...documentOf('portrait', []), pageHeader: [imageOf(asset, { width: 1, height: 1, fit: 'contain' })] }))
    },
    TIMEOUT,
  )

  // The box decides, so each image of an asset is held, not the asset
  // once: the shrunk drawing drawn 480 pt square and then a point square.
  // A check that held the asset's first image alone would pass the second.
  test(
    'holds every image of an asset, each in its own box',
    async () => {
      const asset = svgAsset(SHRUNK, 'logo')
      await expectRefused(
        invoiced(
          documentOf('portrait', [imageOf(asset, { width: 480, height: 480, fit: 'contain' }), imageOf(asset, { width: 1, height: 1, fit: 'contain' })]),
        ),
      )
    },
    TIMEOUT,
  )

  // A landscape page's corners are as far from the image as its long side,
  // its width: report-corpus's drawing at the bound, 35 pt square, which
  // the groups' term decides, reaches 1e6 × 841.89 / 0.35, 2.4 × 10^9, past
  // the bound, and only 1.7 × 10^9 by the page's height. A bound that took
  // the height would draw it.
  test(
    "takes a landscape page's long side for the corners' reach",
    async () => {
      const asset: ImageAsset = { id: 'logo', mediaType: 'image/svg+xml', bytes: SVG_BOUND }
      await expectRefused(invoiced(documentOf('landscape', [imageOf(asset, { width: 35, height: 35, fit: 'contain' })])))
    },
    TIMEOUT,
  )

  // At the bound and a hundredth past it: report-corpus's drawing at every
  // bound, which the e-invoice gate has veraPDF judge, is drawn in its
  // smallest box and refused in one a hundredth smaller, so that the
  // corpus's side is the renderer's; and drawn, its groups' boxes and its
  // gradient's matrix are under the range by no more than the margin.
  test(
    "draws report-corpus's drawing at the bound in its side, and refuses it a hundredth smaller",
    async () => {
      const asset: ImageAsset = { id: 'bound', mediaType: 'image/svg+xml', bytes: SVG_BOUND }
      const at = (side: number): ResolvedDocument => invoiced(documentOf('portrait', [imageOf(asset, { width: side, height: side, fit: 'contain' })]))
      const pdf = await renderPdf(at(SVG_BOUND_SIDE), { maxPages: 2 })
      expect(await pastTheRange(pdf)).toEqual([])
      expect(await largest(pdf)).toBeGreaterThan(SVG_INTEGER_BOUND * 0.9)
      expect(await refusalOf(at(SVG_BOUND_SIDE * 0.99))).toMatchObject({ code: 'unsupported', subject: 'bound' })
    },
    TIMEOUT,
  )
})
