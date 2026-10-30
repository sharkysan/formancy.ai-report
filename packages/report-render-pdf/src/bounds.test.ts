import pdfmake from 'pdfmake'
import { readPdf } from '@formancy/report-corpus'
import { RenderRefusal, type Block, type Image, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import { leastHeight } from './bound.js'
import { planFonts } from './host-fonts.js'
import { renderPdf } from './node.js'
import { PADDING_Y } from './table.js'
import { bareDocument, BODY_HEIGHT, details, documentOf, fixture, ledger, LINE, PAGE, paragraph, TIMEOUT } from './testing/documents.js'
import { idat, ihdr, NONE, pngOf } from './testing/images.js'

/**
 * What bounds a render's work, and what a caller can still stop: the page
 * limit refuses a job before pdfmake measures its body when the body
 * cannot fit, an abort reaches the render between its passes, and nothing
 * drawn at a fixed height -- a rule, a frame -- is taller than the page
 * it is drawn on.
 */

/** The plan of a report that maps no font: every line in Roboto's, 2400 of its 2048 units, which `leastHeight` counts the corpus's documents by. */
const ROBOTO = planFonts(undefined, { normal: new Set(), bold: new Set(), italics: new Set(), bolditalics: new Set() })

async function refusal(document: ResolvedDocument, maxPages = 5): Promise<unknown> {
  return renderPdf(document, { maxPages }).then(
    () => 'rendered',
    (error: unknown) => error,
  )
}

/** The documents pdfmake is handed during `render`, counted. */
async function passes(render: () => Promise<unknown>): Promise<number> {
  const spy = vi.spyOn(pdfmake, 'createPdf')
  try {
    await render().catch(() => undefined)
    return spy.mock.calls.length
  } finally {
    spy.mockRestore()
  }
}

describe('the page limit', () => {
  // pdfmake measures every node before it lays out a page, so refusing
  // 100,000 rows against five pages took 20 seconds of measuring, which no
  // abort could interrupt. A body too long for the limit at its least is
  // refused before pdfmake is handed it: the page regions are measured, and
  // nothing else.
  test(
    'refuses a body too long for it before pdfmake measures the body',
    async () => {
      const document = documentOf('Oversized', [ledger('rows', details(1, 100_000))])
      const handed = await passes(() => expect(renderPdf(document, { maxPages: 5 })).rejects.toMatchObject({ code: 'too-many-pages' }))
      expect(handed).toBe(1)
    },
    TIMEOUT,
  )

  // A body short enough at its least -- each row one line -- and too long
  // as laid out, its rows wrapping to several lines, passes the bound and is
  // refused by the body's measuring pass, which stops a page past the limit.
  test(
    'refuses a body that fits its least height and not its real one, once its rows are measured',
    async () => {
      const rows = Array.from({ length: 60 }, (_, index) => ({
        kind: 'detail' as const,
        cells: [`ROW-${index + 1}`, 'wrapping words '.repeat(40).trim(), '1.00'],
      }))
      const document = documentOf('Wrapping', [ledger('wrapping', rows)])
      expect(leastHeight(document.body, ROBOTO)).toBeLessThan(3 * BODY_HEIGHT)
      const handed = await passes(() => expect(renderPdf(document, { maxPages: 3 })).rejects.toMatchObject({ code: 'too-many-pages' }))
      expect(handed).toBe(2)
    },
    TIMEOUT,
  )

  // The least height is never more than pdfmake lays out, or a body that
  // fits would be refused: the corpus's long table, laid out on exactly as
  // many pages as it needs, is not refused, and its least height is less
  // than those pages hold.
  test(
    'counts no more of the body than pdfmake lays out',
    async () => {
      const { document } = fixture('long-table')
      const pages = (await readPdf(await renderPdf(document, { maxPages: 50 }))).pages.length
      expect(await refusal(document, pages)).toBe('rendered')
      expect(leastHeight(document.body, ROBOTO)).toBeGreaterThan((pages - 1) * BODY_HEIGHT * 0.9)
      expect(leastHeight(document.body, ROBOTO)).toBeLessThan(pages * BODY_HEIGHT)
    },
    TIMEOUT,
  )

  test.each<[string, Block, number]>([
    ['a spacer, which a page break can swallow', { kind: 'spacer', height: 50 }, 0],
    ['a page break', { kind: 'pageBreak' }, 0],
    ['a rule, without the space around it', { kind: 'rule', thickness: 2 }, 2],
    [
      'a framed section, its frame once',
      { kind: 'section', padding: 5, border: { thickness: 1, color: '#000000' }, blocks: [{ kind: 'rectangle', width: 10, height: 10 }] },
      22,
    ],
    [
      'columns, as tall as the tallest',
      {
        kind: 'columns',
        columns: [
          { width: 'fill', blocks: [{ kind: 'rectangle', width: 10, height: 30 }] },
          { width: 'fill', blocks: [{ kind: 'rectangle', width: 10, height: 20 }] },
        ],
      },
      30,
    ],
    [
      'a keep-together block, its blocks',
      {
        kind: 'keepTogether',
        blocks: [{ kind: 'image', asset: { id: 'x', mediaType: 'image/png', bytes: new Uint8Array() }, width: 10, height: 12, fit: 'contain' }, paragraph('')],
      },
      12 + 9 * (2400 / 2048),
    ],
    ['an empty paragraph', { kind: 'paragraph', runs: [] }, 0],
    // A row is its tallest cell's line, each cell at its own size: its style's, else its row's where its own is null, as the runtime writes a column with no style of its own, else the table's 9 pt. Counted at the table's size, or at the row's alone, the 30 pt cell went uncounted.
    [
      'a row, each cell at its own size',
      ledger('sizes', [{ kind: 'detail', cells: ['A', 'B', 'C'], style: { size: 20 }, cellStyles: [null, { size: 30 }, {}] }]),
      9 * LINE + 2 * PADDING_Y + 30 * LINE + 2 * PADDING_Y,
    ],
    // The empty text is a row pdfmake lays out, in place of detail rows, at the table's size.
    ['a table of no detail rows, its empty text', ledger('empty', []), 2 * (9 * LINE + 2 * PADDING_Y)],
  ])('counts %s', (_name, block, height) => {
    expect(leastHeight([block], ROBOTO)).toBeCloseTo(height, 6)
  })
})

describe('the images', () => {
  /** A 4096 by 4096 PNG of 16-bit RGBA, 130 KB that inflate to 134 MB: the largest image an asset may be. */
  const largest = (id: string): Image => ({
    kind: 'image',
    asset: {
      id,
      mediaType: 'image/png',
      bytes: pngOf([
        ['IHDR', ihdr(4096, 4096, { colour: 6, depth: 16 })],
        ['IDAT', idat(4096, 4096 * 8)],
        ['IEND', NONE],
      ]),
    },
    width: 100,
    height: 100,
    fit: 'contain',
  })

  // Four such images took 6.5 seconds to decode and embed, and an asset
  // drawn by forty components was embedded forty times. The image data a
  // render holds is bounded, counting each asset once however often it is
  // drawn.
  test(
    'hold no more image data than two of the largest images',
    async () => {
      const once = largest('photo')
      expect(await refusal(bareDocument('Same photo', [once, once, once]))).toBe('rendered')
      expect(await refusal(bareDocument('Three photos', [largest('first'), largest('second'), largest('third')]))).toMatchObject({
        code: 'content-too-large',
        subject: 'third',
      })
    },
    TIMEOUT,
  )
})

describe('an abort', () => {
  // Every await of a render resolved without the event loop turning, so an
  // abort from a timer, or from a request that closed, arrived only once
  // the PDF was written: a 417-page render resolved after 10.7 seconds with
  // a PDF its caller had given up on after 50 milliseconds. The render
  // yields to the event loop before it looks at the signal, between passes.
  test(
    'from a timer reaches a running render between its passes',
    async () => {
      const { document } = fixture('one-row')
      // Fonts read and cached, so that nothing but the yield lets the timer in.
      await renderPdf(document, { maxPages: 5 })
      const controller = new AbortController()
      const rendering = renderPdf(document, { maxPages: 5, signal: controller.signal })
      setTimeout(() => controller.abort(), 0)
      await expect(rendering).rejects.toBeInstanceOf(RenderRefusal)
      await expect(rendering).rejects.toMatchObject({ code: 'cancelled' })
    },
    TIMEOUT,
  )
})

describe('what is drawn at a fixed height', () => {
  // A rule 800pt thick was stroked across the page footer and off the
  // paper; one of 2,000pt crashed pdfmake with "otherArray.forEach is not a
  // function". Each is refused, naming the rule.
  test.each([800, 2000, 14_400])(
    'refuses a rule %s pt thick',
    async (thickness) => {
      expect(await refusal(documentOf('Thick rule', [paragraph('Before'), { kind: 'rule', thickness }, paragraph('After')]))).toMatchObject({
        code: 'content-too-large',
        subject: 'body[1]',
      })
    },
    TIMEOUT,
  )

  // The thickest rule the body holds, with the space around it, is drawn.
  test(
    'draws a rule as thick as the body holds',
    async () => {
      expect(await refusal(documentOf('Thick rule', [{ kind: 'rule', thickness: BODY_HEIGHT - 6 }]))).toBe('rendered')
    },
    TIMEOUT,
  )

  // On a landscape page a frame can be narrower than the page and taller
  // than its body: padding 250pt either side leaves 261.89pt of width and
  // none of the 492.53pt body. pdfmake crashed with blocks in it, and drew a
  // frame taller than the body without.
  test.each<[string, Block]>([
    ['with blocks', { kind: 'section', padding: 250, blocks: [{ kind: 'rule', thickness: 1 }] }],
    ['without', { kind: 'section', border: { thickness: 1, color: '#000000' }, padding: 250, blocks: [] }],
  ])(
    'refuses a frame taller than the body, %s',
    async (_name, section) => {
      const landscape: ResolvedDocument = { ...documentOf('Tall frame', [section]), page: { ...PAGE, orientation: 'landscape' } }
      expect(await refusal(landscape)).toMatchObject({ code: 'content-too-large', subject: 'body[0]' })
    },
    TIMEOUT,
  )
})
