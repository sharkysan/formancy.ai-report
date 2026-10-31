import { readPdf, verify, type ReadPdf } from '@formancy/report-corpus'
import type { Block, Image, ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { OUTLINE } from './content.js'
import { renderPdf } from './node.js'
import { bareDocument, BODY_HEIGHT, details, documentOf, fixtureOf, ledger, paragraph, PAGE, PRINTABLE_WIDTH, TIMEOUT } from './testing/documents.js'
import { readDrawing, type DrawnPage, type Shape } from './testing/drawing.js'
import { encodePng, exifSegment, jpegOf } from './testing/images.js'
import { lineOf, pageLines, runOf } from './testing/lines.js'

/**
 * The blocks the renderer trial's document did not have -- columns, rules of
 * any weight and colour, rectangles, sections, and images fitted to a box of
 * other proportions -- each drawn and read back from the PDF: its text with
 * the corpus's reader, its lines, rectangles and clips from the PDF's own
 * content stream (`testing/drawing.ts`), which PDF.js's text cannot show.
 */

const LEFT = PAGE.margins.left
const RIGHT = LEFT + PRINTABLE_WIDTH

async function rendered(document: ResolvedDocument, maxPages = 20): Promise<{ pdf: ReadPdf; drawing: DrawnPage[] }> {
  const bytes = await renderPdf(document, { maxPages })
  return { pdf: await readPdf(bytes), drawing: readDrawing(bytes) }
}

/**
 * Where a shape's ink is: its path, and half its line's weight beyond it
 * where it is stroked. A line's ends are cut square, as PDF draws them
 * unless told otherwise, so its ink reaches past it to either side only.
 */
function ink(shape: Shape): { x: number; top: number; right: number; bottom: number } {
  const half = shape.stroke === undefined ? 0 : shape.lineWidth / 2
  const [across, down] = shape.kind === 'rect' ? [half, half] : shape.height === 0 ? [0, half] : [half, 0]
  return { x: shape.x - across, top: shape.top - down, right: shape.x + shape.width + across, bottom: shape.top + shape.height + down }
}

describe('columns', () => {
  // Columns laid out one under another, or at widths other than their own,
  // print every word and the wrong page.
  test('puts its columns side by side, each at its own width', async () => {
    const { pdf } = await rendered(
      bareDocument('Columns', [
        {
          kind: 'columns',
          columns: [
            { width: 'fill', blocks: [paragraph('Left of two')] },
            { width: 100, blocks: [paragraph('Right of two')] },
          ],
        },
        {
          kind: 'columns',
          columns: [
            { width: 120, blocks: [paragraph('First of three')] },
            { width: 'fill', blocks: [paragraph('Second of three')] },
            { width: 'fill', blocks: [paragraph('Third of three')] },
          ],
        },
      ]),
    )
    const [left, right] = [runOf(pdf, 'Left of two'), runOf(pdf, 'Right of two')]
    expect(right.top).toBeCloseTo(left.top, 5)
    expect([left.x, right.x]).toEqual([LEFT, expect.closeTo(RIGHT - 100, 5)])
    const three = ['First of three', 'Second of three', 'Third of three'].map((text) => runOf(pdf, text))
    expect(three.map((line) => line.top)).toEqual(three.map(() => expect.closeTo(three[0]!.top, 5)))
    expect(three.map((line) => line.x)).toEqual([LEFT, expect.closeTo(LEFT + 120, 5), expect.closeTo(LEFT + 120 + (PRINTABLE_WIDTH - 120) / 2, 5)])
  })

  // A column taller than what is left of the page continues on the next
  // page, beside nothing, and loses no line at the break or below the footer.
  test(
    'continues a column taller than the page on the next one, losing nothing',
    async () => {
      const lefts = Array.from({ length: 100 }, (_, index) => `Left line ${index + 1}`)
      const document = documentOf('Long column', [
        {
          kind: 'columns',
          columns: [
            { width: 'fill', blocks: lefts.map((text) => paragraph(text)) },
            { width: 'fill', blocks: [paragraph('Right line 1'), paragraph('Right line 2')] },
          ],
        },
      ])
      const { pdf } = await rendered(document)
      expect(
        verify(fixtureOf('long-column', document, { keys: lefts, exactText: ['Right line 1', 'Right line 2'], minPagesExpected: 2, maxPagesExpected: 2 }), pdf),
      ).toEqual([])
      expect(runOf(pdf, 'Right line 1').top).toBeCloseTo(runOf(pdf, 'Left line 1').top, 5)
    },
    TIMEOUT,
  )

  // A keep-together block in a column still moves whole to the next page.
  test(
    'moves a keep-together block in a column to the next page whole',
    async () => {
      const kept = Array.from({ length: 6 }, (_, index) => `Kept in a column ${index + 1}`)
      const document = documentOf('Kept in a column', [
        { kind: 'spacer', height: BODY_HEIGHT - 40 },
        {
          kind: 'columns',
          columns: [
            { width: 'fill', blocks: [paragraph('Beside the kept block')] },
            { width: 'fill', blocks: [{ kind: 'keepTogether', blocks: kept.map((text) => paragraph(text)) }] },
          ],
        },
      ])
      const { pdf } = await rendered(document)
      expect(verify(fixtureOf('kept-in-a-column', document, { minPagesExpected: 2, maxPagesExpected: 2, noEmptyPages: false }), pdf)).toEqual([])
      expect(kept.map((text) => lineOf(pdf, text).page)).toEqual(kept.map(() => 2))
    },
    TIMEOUT,
  )
})

describe('rules', () => {
  // The trial drew every rule half a point thick and black. A rule drawn at
  // another weight or colour than its own, or across the page from inside a
  // column, is a different report.
  test('draws a rule at its thickness and colour, across the width it stands in', async () => {
    const { pdf, drawing } = await rendered(
      bareDocument('Rules', [
        paragraph('Above the rule'),
        { kind: 'rule', thickness: 2, color: '#c00000' },
        paragraph('Below the rule'),
        {
          kind: 'columns',
          columns: [
            { width: 'fill', blocks: [] },
            { width: 100, blocks: [{ kind: 'rule', thickness: 1 }] },
          ],
        },
      ]),
    )
    const lines = drawing[0]!.shapes.filter((shape) => shape.kind === 'line')
    expect(lines.map(({ x, width, lineWidth, stroke }) => ({ x, width, lineWidth, stroke }))).toEqual([
      { x: LEFT, width: expect.closeTo(PRINTABLE_WIDTH, 5), lineWidth: 2, stroke: '#c00000' },
      { x: expect.closeTo(RIGHT - 100, 5), width: expect.closeTo(100, 5), lineWidth: 1, stroke: '#000000' },
    ])
    // Its ink stands between the text above and below it, touching neither.
    const rule = ink(lines[0]!)
    expect(rule.top).toBeGreaterThan(lineOf(pdf, 'Above the rule').bottom)
    expect(rule.bottom).toBeLessThan(lineOf(pdf, 'Below the rule').top)
  })
})

describe('rectangles', () => {
  // A rectangle whose box the layout did not reserve would be drawn under
  // the text after it; one whose outline is stroked on its edge spills half
  // the outline outside its box.
  test('fills and outlines exactly its box, and the text after it starts below it', async () => {
    const { pdf, drawing } = await rendered(
      bareDocument('Rectangle', [
        paragraph('Above the box'),
        { kind: 'rectangle', width: 100, height: 40, fill: '#00c000', stroke: '#0000c0' },
        paragraph('Below the box'),
      ]),
    )
    const [box] = drawing[0]!.shapes
    expect(drawing[0]!.shapes).toHaveLength(1)
    expect(box).toMatchObject({ kind: 'rect', fill: '#00c000', stroke: '#0000c0', lineWidth: OUTLINE })
    const drawn = ink(box!)
    expect(drawn.right - drawn.x).toBeCloseTo(100, 5)
    expect(drawn.bottom - drawn.top).toBeCloseTo(40, 5)
    expect(drawn.x).toBeCloseTo(LEFT, 5)
    expect(drawn.top).toBeGreaterThan(lineOf(pdf, 'Above the box').bottom)
    expect(lineOf(pdf, 'Below the box').top).toBeGreaterThan(drawn.bottom)
  })

  // An outline alone is drawn with nothing filled inside it.
  test('outlines a rectangle without a fill', async () => {
    const { drawing } = await rendered(bareDocument('Outline', [{ kind: 'rectangle', width: 60, height: 20, stroke: '#404040' }]))
    expect(drawing[0]!.shapes).toEqual([expect.objectContaining({ kind: 'rect', stroke: '#404040', lineWidth: OUTLINE })])
    expect(drawing[0]!.shapes[0]!.fill).toBeUndefined()
  })

  // A rectangle of no colour is only space, and takes all of it; one too
  // thin for an outline inside it is all outline, its box filled with the
  // outline's colour rather than a stroke wider than the box.
  test('takes its box when it draws nothing, and fills it when it is all outline', async () => {
    const topOfBelow = async (blocks: Block[]): Promise<number> => lineOf((await rendered(bareDocument('Space', blocks))).pdf, 'Below').top
    const above = paragraph('Above')
    const below = paragraph('Below')
    expect((await topOfBelow([above, { kind: 'rectangle', width: 50, height: 30 }, below])) - (await topOfBelow([above, below]))).toBeCloseTo(30, 5)
    const { drawing } = await rendered(bareDocument('Thin', [{ kind: 'rectangle', width: 200, height: 0.8, stroke: '#808080' }]))
    expect(drawing[0]!.shapes).toEqual([expect.objectContaining({ kind: 'rect', fill: '#808080', width: 200, height: expect.closeTo(0.8, 5) })])
    expect(drawing[0]!.shapes[0]!.stroke).toBeUndefined()
  })
})

describe('sections', () => {
  // A frame drawn where the blocks are not, or blocks laid out over the
  // frame's border, print a box around nothing beside text over a line.
  test('frames its blocks with its border, its fill and its padding', async () => {
    const { pdf, drawing } = await rendered(
      bareDocument('Frame', [{ kind: 'section', border: { thickness: 1, color: '#333333' }, fill: '#eeeeee', padding: 5, blocks: [paragraph('Framed text')] }]),
    )
    const { shapes } = drawing[0]!
    const borders = shapes.filter((shape) => shape.stroke !== undefined)
    expect(borders).toHaveLength(4)
    expect(borders.every((shape) => shape.stroke === '#333333' && shape.lineWidth === 1)).toBe(true)
    const frame = borders.map(ink).reduce((all, each) => ({
      x: Math.min(all.x, each.x),
      top: Math.min(all.top, each.top),
      right: Math.max(all.right, each.right),
      bottom: Math.max(all.bottom, each.bottom),
    }))
    expect([frame.x, frame.right]).toEqual([expect.closeTo(LEFT, 5), expect.closeTo(RIGHT, 5)])
    const fill = shapes.find((shape) => shape.fill === '#eeeeee')!
    expect(fill.x).toBeGreaterThanOrEqual(frame.x)
    expect(fill.x + fill.width).toBeLessThanOrEqual(frame.right)
    const text = lineOf(pdf, 'Framed text')
    expect(text.x).toBeCloseTo(LEFT + 1 + 5, 5)
    expect(text.top).toBeGreaterThan(frame.top + 1 + 5 - 0.5)
    expect(text.bottom).toBeLessThan(frame.bottom - 1)
  })

  // A section is not a layout: without a frame its blocks are laid out
  // exactly where they would be without it.
  test('without a frame, lays its blocks out as though it were not there', async () => {
    const blocks = [paragraph('First'), paragraph('Second')]
    const tops = async (body: Block[]): Promise<number[]> => {
      const { pdf } = await rendered(bareDocument('Unframed', [paragraph('Before'), ...body, paragraph('After')]))
      return ['Before', 'First', 'Second', 'After'].map((text) => lineOf(pdf, text).top)
    }
    expect(await tops([{ kind: 'section', blocks }])).toEqual(await tops(blocks))
  })

  // A fill alone is a coloured box: pdfmake draws a line of no width, which
  // a viewer shows as the thinnest line it can, unless no line is drawn.
  test('with a fill alone, draws no line', async () => {
    const { drawing } = await rendered(bareDocument('Fill', [{ kind: 'section', fill: '#ffeecc', blocks: [paragraph('On a fill')] }]))
    expect(drawing[0]!.shapes.map(({ fill, stroke }) => ({ fill, stroke }))).toEqual([{ fill: '#ffeecc', stroke: undefined }])
  })

  // A framed section longer than a page continues on the next, its frame
  // drawn around the part on each page, every line printed once inside it.
  test(
    'draws its frame around the part on each page, and loses nothing',
    async () => {
      const lines = Array.from({ length: 90 }, (_, index) => `Framed line ${index + 1}`)
      const document = documentOf('Long frame', [
        { kind: 'section', border: { thickness: 2, color: '#000080' }, padding: 4, blocks: lines.map((text) => paragraph(text)) },
      ])
      const { pdf, drawing } = await rendered(document)
      expect(verify(fixtureOf('long-frame', document, { keys: lines, minPagesExpected: 2, maxPagesExpected: 2 }), pdf)).toEqual([])
      for (const page of drawing) {
        const frame = page.shapes.filter((shape) => shape.stroke === '#000080')
        expect(
          frame.filter((shape) => shape.height === 0),
          `page ${page.number}: a top and a bottom border`,
        ).toHaveLength(2)
        expect(
          frame.filter((shape) => shape.width === 0),
          `page ${page.number}: a left and a right border`,
        ).toHaveLength(2)
        const [top, bottom] = frame
          .filter((shape) => shape.height === 0)
          .map((shape) => shape.top)
          .sort((a, b) => a - b)
        const body = pageLines(pdf.pages[page.number - 1]!).filter((line) => line.text.startsWith('Framed line'))
        expect(body.length).toBeGreaterThan(0)
        expect(body.every((line) => line.x === LEFT + 2 + 4 && line.top > top! && line.bottom < bottom!)).toBe(true)
      }
    },
    TIMEOUT,
  )

  // A table is part of the flow, and a section can hold one: inside a frame
  // its header still repeats on every page, its rows inside the frame.
  test(
    'holds a table whose header repeats on every page, inside the frame',
    async () => {
      const document = documentOf('Table in a frame', [
        { kind: 'section', border: { thickness: 1, color: '#000000' }, padding: 6, blocks: [ledger('framed', details(1, 120))] },
      ])
      const { pdf } = await rendered(document)
      expect(verify(fixtureOf('table-in-a-frame', document, { minPagesExpected: 2, maxPagesExpected: 5 }), pdf)).toEqual([])
      const keys = pdf.pages.map((page) => pageLines(page).find((line) => line.text.startsWith('Key'))!)
      expect(keys.length).toBeGreaterThan(1)
      expect(keys.every((line) => Math.abs(line.x - (LEFT + 1 + 6 + 4)) < 1e-6)).toBe(true)
    },
    TIMEOUT,
  )
})

describe('images', () => {
  const wide = { id: 'wide', mediaType: 'image/png', bytes: encodePng(16, 8, (x) => [x * 16, 64, 128]) } as const

  // `contain` draws all of the image at its own proportions, as large as
  // the box allows and centred in it; the box is reserved whole, so what
  // follows starts below the box, not below the image.
  test('draws an image to contain, centred in a box the layout reserves whole', async () => {
    const image: Image = { kind: 'image', asset: wide, width: 100, height: 100, fit: 'contain' }
    const { pdf } = await rendered(bareDocument('Contain', [image, paragraph('Below')]))
    // The box is the first thing on the page: from the top margin, 100pt down.
    const boxTop = PAGE.margins.top
    expect(pdf.pages[0]!.images).toEqual([
      expect.objectContaining({
        x: expect.closeTo(LEFT, 5),
        top: expect.closeTo(boxTop + 25, 5),
        width: expect.closeTo(100, 5),
        height: expect.closeTo(50, 5),
      }),
    ])
    // The line after it starts at the foot of the box: its text within the line's first 9pt.
    expect(lineOf(pdf, 'Below').top).toBeGreaterThan(boxTop + 100)
    expect(lineOf(pdf, 'Below').top).toBeLessThan(boxTop + 100 + 9)
  })

  // `cover` fills the box at the image's proportions and crops what falls
  // outside it: the image drawn larger than the box and centred on it, and
  // clipped to it, so nothing of it prints outside the box.
  test('draws an image to cover, centred and clipped to its box', async () => {
    const image: Image = { kind: 'image', asset: wide, width: 100, height: 100, fit: 'cover' }
    const { pdf, drawing } = await rendered(bareDocument('Cover', [image]))
    const [drawn] = pdf.pages[0]!.images
    expect(drawn).toMatchObject({ x: expect.closeTo(LEFT - 50, 5), width: expect.closeTo(200, 5), height: expect.closeTo(100, 5) })
    expect(drawing[0]!.clips).toEqual([
      expect.objectContaining({
        x: expect.closeTo(LEFT, 5),
        top: expect.closeTo(drawn!.top, 5),
        width: expect.closeTo(100, 5),
        height: expect.closeTo(100, 5),
      }),
    ])
  })

  // A JPEG whose Exif orientation turns it a quarter turn is shown taller
  // than its frame is wide: fitted by its frame's size, it would be drawn
  // squeezed into a box of the wrong proportions.
  test('fits a JPEG turned by its Exif orientation by the size it is shown at', async () => {
    const turned = { id: 'turned', mediaType: 'image/jpeg', bytes: jpegOf({ width: 16, height: 8, exif: exifSegment(6) }) } as const
    const { pdf } = await rendered(bareDocument('Turned', [{ kind: 'image', asset: turned, width: 80, height: 80, fit: 'contain' }]))
    expect(pdf.pages[0]!.images).toEqual([
      expect.objectContaining({ x: expect.closeTo(LEFT + 20, 5), width: expect.closeTo(40, 5), height: expect.closeTo(80, 5) }),
    ])
  })
})
