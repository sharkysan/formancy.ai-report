import pdfmake from 'pdfmake'
import {
  ALL_FIXTURES,
  AXIS_PAINT,
  CHART_FIXTURES,
  CODE_FIXTURES,
  E_INVOICE,
  FIRST_PAGE_FIXTURES,
  GRID_PAINT,
  HEADERLESS_FIXTURES,
  KEEP_WITH_FIXTURES,
  KEPT_HEADING_FIXTURES,
  LABEL_DISTANCE,
  pageDimensions,
  readPdf,
  SHARE_UNIT,
  SHIFTED_FIXTURES,
  starterImages,
  SVG_FIXTURES,
  verify,
  verifyInk,
  verifyRefusal,
  type Fixture,
  type PdfPage,
  type ReadPdf,
} from '@formancy/report-corpus'
import { RenderRefusal, resolveReport } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import { AXIS, GRID, QUOTIENT_UNIT, VALUE_LABEL_DISTANCE } from './chart-option.js'
import { renderPdf } from './node.js'
import type { RenderOptions } from './options.js'
import { BARS } from './testing/charts.js'
import { documentOf, fixture, fixtureOf, paragraph, TIMEOUT, type Stated } from './testing/documents.js'

/**
 * The renderer on the corpus: every fixture rendered and proved on the PDF
 * it produced, with the corpus's own checks, never on the definition pdfmake
 * was given (0003). These are the gate decision 0005 names: the trial chose
 * pdfmake on this corpus, and the renderer grown from its adapter is held to
 * it here, and to the corpus's SVG fixtures beside it (0030), which the
 * trial's engines never drew, its kept rows' fixture (0059), which they
 * never kept, its fixtures of page 1's own header (0060), which they
 * never drew either, its runs set below or above the line (0061),
 * which they never set, its QR codes and EPC QR codes (0074), which a
 * Word file's are held to: a code fixture this renderer refused, or drew
 * over its neighbours, would be compared with nothing there -- what each
 * code says is read from the page by qr.test.ts and epc-qr-code.test.ts --
 * its headings kept with tables that run past the page, which the trial's
 * pdfme never kept, and its table without a header row (0078), which the
 * trial's documents never lacked.
 */

/** Section 20's fixtures, the SVG ones, the kept rows' one, page 1's own header's, the chart ones, those of runs set below or above the line, the codes', the kept headings' and the headerless table's. */
const CORPUS: readonly Fixture[] = [
  ...ALL_FIXTURES,
  ...SVG_FIXTURES,
  ...KEEP_WITH_FIXTURES,
  ...FIRST_PAGE_FIXTURES,
  ...CHART_FIXTURES,
  ...SHIFTED_FIXTURES,
  ...CODE_FIXTURES,
  ...KEPT_HEADING_FIXTURES,
  ...HEADERLESS_FIXTURES,
]

/**
 * Why each chart fixture the renderer refuses is refused, by its message,
 * which names the chart and its box and the sizes that do not hold, and
 * quotes none of its words: a fixture refused for another reason than its
 * own -- bars for their labels, labels for their bars -- passes its code
 * and its subject and proves nothing it is named for.
 */
const CHART_REFUSALS: ReadonlyMap<string, RegExp> = new Map([
  [
    'chart-labels-too-wide',
    /^the chart wide-labels, 300 by 240 points, has category labels too wide for their slots of [\d.]+ points across, and never turned$/,
  ],
  ['chart-bars-too-thin', /^the chart thin-bars, 300 by 240 points, has bars [\d.]+ points wide, narrower than the 3\.5 points a bar is drawn at least$/],
  [
    'chart-bars-too-thin-labelled',
    /^the chart thin-labelled, 300 by 240 points, has bars [\d.]+ points wide, narrower than the 3\.5 points a bar is drawn at least$/,
  ],
  ['chart-too-short', /^the chart short, 300 by 30 points, has a plot [\d.]+ points tall, too short to label two of its 5 ticks 1\.25 lines apart$/],
  ['chart-unprintable-label', /^category 2 of the chart tokyo prints U\+6771, which is in no script the renderer prints/],
])

/**
 * The fixtures the renderer cannot satisfy, each with what it cannot do and
 * exactly the problems the checks report. A fixture listed here is still
 * rendered and checked, and its case asserts those problems: it fails the day
 * the fixture passes and the day it fails another way, so the list can
 * neither outlive its finding nor stand for a different one.
 */
const CANNOT: ReadonlyMap<string, { readonly reason: string; readonly problems: readonly string[] }> = new Map()

/** What the fixture's checks find wrong with what the renderer did: a PDF that fails them, or a refusal that is not the one expected. */
async function problems(each: Fixture, options: RenderOptions = { maxPages: each.maxPages }): Promise<string[]> {
  const rendered = await renderPdf(each.document, options).then(
    (bytes) => ({ bytes }),
    (error: unknown) => ({ error }),
  )
  if ('error' in rendered) return verifyRefusal(each, rendered.error)
  return verify(each, await readPdf(rendered.bytes))
}

describe('the renderer on the corpus', () => {
  // Each fixture is one way a report goes wrong -- a row lost at a page
  // break, a header that does not repeat, a total that is not the one the
  // data holds, a truncated job -- and its checks are what would see it.
  // A fixture here that passes is one the renderer does not get wrong.
  for (const each of CORPUS) {
    const finding = CANNOT.get(each.id)
    test(
      `${each.id}: ${finding === undefined ? each.title : `fails: ${finding.reason}`}`,
      async () => {
        expect(await problems(each)).toEqual(finding?.problems ?? [])
      },
      TIMEOUT,
    )
  }

  // A chart the renderer cannot draw so that it reads is refused whole,
  // naming it (Review Focus 4): each such fixture is refused for the
  // reason it is named for, and every one of them is listed.
  for (const [id, reason] of CHART_REFUSALS) {
    test(
      `${id}: is refused for its own reason`,
      async () => {
        const each = CHART_FIXTURES.find((fixture) => fixture.id === id)!
        const refused: unknown = await renderPdf(each.document, { maxPages: each.maxPages }).then(
          () => 'rendered',
          (error: unknown) => error,
        )
        expect(refused).toBeInstanceOf(RenderRefusal)
        expect((refused as RenderRefusal).message).toMatch(reason)
      },
      TIMEOUT,
    )
  }

  // A drawing is painted inside a clip of its box, and `cover` paints it
  // past the box for the clip to hide: the operator list cannot say what
  // the clip kept in, and the pixels can (0003). Each SVG fixture's every
  // page, drawn by PDF.js, shows nothing of a drawing past its box.
  for (const each of SVG_FIXTURES.filter((fixture) => fixture.expect.outcome === 'render')) {
    test(
      `${each.id}: shows nothing of a drawing past its box, by its pixels`,
      async () => {
        expect(await verifyInk(each, await renderPdf(each.document, { maxPages: each.maxPages }))).toEqual([])
      },
      TIMEOUT,
    )
  }

  // An empty corpus would pass every case above, and so would a list of
  // fixtures the renderer is excused from that grew to cover all of them.
  test('runs a corpus that has fixtures, and excuses none of them', () => {
    expect(ALL_FIXTURES.length).toBeGreaterThan(0)
    expect(SVG_FIXTURES.filter((fixture) => fixture.expect.outcome === 'render').length).toBeGreaterThan(0)
    expect(FIRST_PAGE_FIXTURES.filter((fixture) => fixture.expect.outcome === 'render').length).toBeGreaterThan(0)
    expect(CHART_FIXTURES.filter((fixture) => fixture.expect.outcome === 'render').length).toBeGreaterThan(0)
    expect([...CHART_REFUSALS.keys()]).toEqual(CHART_FIXTURES.filter((fixture) => fixture.expect.outcome === 'refuse').map((fixture) => fixture.id))
    expect(SHIFTED_FIXTURES.filter((fixture) => fixture.expect.outcome === 'render').length).toBeGreaterThan(0)
    expect(CODE_FIXTURES.filter((fixture) => fixture.expect.outcome === 'render').length).toBeGreaterThan(0)
    expect(KEPT_HEADING_FIXTURES.filter((fixture) => fixture.expect.outcome === 'render').length).toBeGreaterThan(0)
    expect(HEADERLESS_FIXTURES.filter((fixture) => fixture.expect.outcome === 'render').length).toBeGreaterThan(0)
    expect([...CANNOT.keys()]).toEqual([])
  })
})

describe("the corpus's checks on a chart the renderer drew", () => {
  // A chart is proved where the walk that places drawings finds it: an
  // expectation that sought no drawing found no chart, and the chart's
  // check, finding none placed, said nothing, so a chart drawn with no
  // bar at all passed every check. Its renderer's PDF passes; the same
  // PDF with its bars taken out is said to lack each of them.
  test(
    'finds a bar chart drawn with no bar',
    async () => {
      const each = fixtureOf('bars', documentOf('Bars', [paragraph('Before'), BARS]), { maxPagesExpected: 1 })
      const pdf = await readPdf(await renderPdf(each.document, { maxPages: 5 }))
      expect(verify(each, pdf)).toEqual([])
      const colours = new Set(BARS.series.map(({ color }) => color))
      const barless: ReadPdf = {
        ...pdf,
        pages: pdf.pages.map((page) => ({ ...page, paths: page.paths.filter((path) => path.paint !== 'fill' || !colours.has(path.fill ?? '')) })),
      }
      const lacking = [
        'bars: page 1: the chart sales draws no bar of series 1 at category 1',
        'bars: page 1: the chart sales draws no bar of series 2 at category 1',
        'bars: page 1: the chart sales draws no bar of series 2 at category 2',
      ]
      expect(verify(each, barless)).toEqual(lacking)
      // Stated away, the drawings it seeks are derived all the same: a fixture cannot seek no drawing for its chart.
      const stated = { maxPagesExpected: 1, drawings: [], charts: [] } as unknown as Stated
      expect(verify(fixtureOf('bars', each.document, stated), barless)).toEqual(lacking)
    },
    TIMEOUT,
  )
})

describe("the corpus's checks on a chart's legend and labels, on the renderer's PDF", () => {
  /** A chart fixture rendered and read back. */
  const drawn = async (id: string): Promise<{ readonly each: Fixture; readonly pdf: ReadPdf }> => {
    const each = CHART_FIXTURES.find((fixture) => fixture.id === id)!
    return { each, pdf: await readPdf(await renderPdf(each.document, { maxPages: each.maxPages })) }
  }
  /** `pdf` with its first page's runs and paths changed. */
  const changed = (
    pdf: ReadPdf,
    items: (items: PdfPage['items']) => PdfPage['items'],
    paths: (paths: PdfPage['paths']) => PdfPage['paths'] = (each) => each,
  ): ReadPdf => ({
    ...pdf,
    pages: pdf.pages.map((page, index) => (index === 0 ? { ...page, items: items(page.items), paths: paths(page.paths) } : page)),
  })
  /** The runs of `a` and `b` with each other's texts and widths. */
  const swapped =
    (a: string, b: string) =>
    (items: PdfPage['items']): PdfPage['items'] => {
      const [first, second] = [items.find(({ text }) => text === a)!, items.find(({ text }) => text === b)!]
      return items.map((item) =>
        item === first ? { ...item, text: b, width: second.width } : item === second ? { ...item, text: a, width: first.width } : item,
      )
    }
  /** The run of `text` moved to `x` across, or its top to `top`. */
  const placed =
    (text: string, to: { readonly x?: number; readonly top?: number }) =>
    (items: PdfPage['items']): PdfPage['items'] =>
      items.map((item) => (item.text === text ? { ...item, x: to.x ?? item.x, top: to.top ?? item.top, bottom: (to.top ?? item.top) + item.height } : item))
  const swatch = ({ paint }: PdfPage['paths'][number]): boolean => paint === 'fillStroke'

  // Every word of a chart's legend and every value's label printed once
  // inside its box passed, wherever it printed: a legend naming each
  // series or slice by another's colour, a legend with no swatch, or a
  // number at another bar (r6, r14). Each is the renderer's PDF of a
  // chart fixture, doctored as a renderer that drew it so would, and each
  // is now said.
  test(
    "finds a legend naming its marks by each other's colours, or by none, and a label away from its mark",
    async () => {
      const bars = await drawn('chart-bars')
      const pie = await drawn('chart-pie')
      const ledger = await drawn('chart-line-no-value')
      const line = await drawn('chart-line')
      const said = ({ each, pdf }: { readonly each: Fixture; readonly pdf: ReadPdf }, doctored: ReadPdf): string[] => {
        expect(verify(each, pdf), each.id).toEqual([])
        return verify(each, doctored)
      }
      expect(said(bars, changed(bars.pdf, swapped('Plan', 'Actual')))).toContainEqual(
        expect.stringMatching(/prints 'Actual' beside the swatch of legend entry 1, which names 'Plan'$/),
      )
      expect(said(pie, changed(pie.pdf, swapped('North: 45 (45.0 %)', 'South: 30 (30.0 %)')))).toContainEqual(
        expect.stringMatching(/prints 'South: 30 \(30\.0 %\)' beside the swatch of legend entry 1, which names 'North: 45 \(45\.0 %\)'$/),
      )
      const owed = (path: PdfPage['paths'][number]): boolean => swatch(path) && path.fill === '#ff7f0e'
      expect(
        said(
          ledger,
          changed(
            ledger.pdf,
            (items) => items,
            (paths) => paths.filter((path) => !owed(path)),
          ),
        ),
      ).toEqual(['chart-line-no-value: page 1: the chart ledger draws no swatch of legend entry 2 in its colour #ff7f0e'])
      expect(
        said(
          ledger,
          changed(
            ledger.pdf,
            (items) => items,
            (paths) => paths.filter((path) => !swatch(path)),
          ),
        ),
      ).toHaveLength(2)
      const repainted = (paths: PdfPage['paths']): PdfPage['paths'] =>
        paths.map((path) =>
          !swatch(path) ? path : owed(path) ? { ...path, fill: '#1f77b4', stroke: '#1f77b4' } : { ...path, fill: '#ff7f0e', stroke: '#ff7f0e' },
        )
      expect(
        said(
          ledger,
          changed(ledger.pdf, (items) => items, repainted),
        ),
      ).toContainEqual(expect.stringMatching(/prints 'Owed' beside the swatch of legend entry 1, which names 'Paid'$/))
      expect(
        said(
          bars,
          changed(
            bars.pdf,
            (items) => items,
            (paths) => paths.filter((path) => !swatch(path)),
          ),
        ),
      ).toHaveLength(2)
      // South's plan, -5.00, at the lowest tick: at North's bar, in West's slot, above zero, and at the plot's top.
      expect(said(bars, changed(bars.pdf, swapped('10.25', '-5.00')))).toContainEqual(
        expect.stringMatching(/prints the label '10\.25' of series 1 at category 1 centred at/),
      )
      expect(said(bars, changed(bars.pdf, placed('-5.00', { x: 330 })))).toContainEqual(
        expect.stringMatching(/prints the label '-5\.00' of series 1 at category 2 centred at/),
      )
      for (const top of [195.3, 128])
        expect(said(bars, changed(bars.pdf, placed('-5.00', { top })))).toContainEqual(
          expect.stringMatching(
            /prints the label '-5\.00' of series 1 at category 2 from [\d.]+ to [\d.]+ pt down the page; it stands 5 pt below its value's end at/,
          ),
        )
      // A line's label is held above its marker: February's 12, printed under it.
      const twelve = line.pdf.pages[0]!.items.find(({ text }) => text === '12')!
      expect(said(line, changed(line.pdf, placed('12', { top: twelve.top + 24 })))).toContainEqual(
        expect.stringMatching(/prints the label '12' of series 1 at category 2 from .* it stands 5 pt above its marker at/),
      )
    },
    TIMEOUT,
  )
})

describe('a chart drawn twice', () => {
  // A chart drawn a second time on its page prints its data twice, and
  // passed: a clip nothing matches is no problem. The renderer's bar
  // chart, its clip, its paths and its words copied 300 pt lower.
  test(
    'is found by the clip of its size that holds its paint, which no drawing took',
    async () => {
      const bars = CHART_FIXTURES.find(({ id }) => id === 'chart-bars')!
      const pdf = await readPdf(await renderPdf(bars.document, { maxPages: bars.maxPages }))
      const [page] = pdf.pages as [PdfPage]
      const down = 300
      const own = page.paths.filter((path) => path.clip !== undefined)
      const indices = [...new Set(own.map((path) => path.clip!))]
      const lower = <T extends { readonly top: number; readonly bottom: number }>(box: T): T => ({ ...box, top: box.top + down, bottom: box.bottom + down })
      const point = ([x, y]: readonly [number, number]): readonly [number, number] => [x, y + down]
      const copies = own.map((path) => ({
        ...lower(path),
        clip: page.clips.length + indices.indexOf(path.clip!),
        subpaths: path.subpaths.map((points) => points.map(point)),
        curves: path.curves.map(({ from, through: [a, b], to }) => ({ from: point(from), through: [point(a), point(b)] as const, to: point(to) })),
      }))
      const words = page.items.filter(({ top, text }) => top > 60 && top < 320 && !text.startsWith('Formancy'))
      const doubled: ReadPdf = {
        ...pdf,
        pages: [
          {
            ...page,
            clips: [...page.clips, ...indices.map((index) => lower(page.clips[index]!))],
            paths: [...page.paths, ...copies],
            items: [...page.items, ...words.map(lower)],
          },
        ],
      }
      expect(verify(bars, doubled)).toEqual([
        expect.stringMatching(/^chart-bars: page 1: the chart sales is drawn twice: a second clip of its size, at 40, [\d.]+, holds its paint$/),
      ])
    },
    TIMEOUT,
  )
})

describe("the faces the corpus holds a chart's words to", () => {
  // A chart's words print in its style's face and its title bold in it
  // (0058), Roboto's where its token maps no host font: the corpus names
  // Roboto's four faces as the PDF does, and a name it had wrong would
  // fail a chart drawn in that face. Each style's chart is drawn and
  // passes; the bar chart's title printed in Roboto's regular face, as a
  // renderer that dropped the title's weight would print it, is seen.
  test(
    "holds a Roboto chart's every word to its face, its title bold",
    async () => {
      for (const style of [{}, { bold: true }, { italic: true }, { bold: true, italic: true }]) {
        const each = fixtureOf('styled', documentOf('Styled', [paragraph('Before'), { ...BARS, style }]), { maxPagesExpected: 1 })
        expect(verify(each, await readPdf(await renderPdf(each.document, { maxPages: 5 }))), JSON.stringify(style)).toEqual([])
      }
      const chartBars = CHART_FIXTURES.find(({ id }) => id === 'chart-bars')!
      const pdf = await readPdf(await renderPdf(chartBars.document, { maxPages: chartBars.maxPages }))
      const [page] = pdf.pages
      const regular = page!.items.find(({ text }) => text === 'Region')!.font
      const light: ReadPdf = {
        ...pdf,
        pages: [{ ...page!, items: page!.items.map((item) => (item.text === 'Sales by region' ? { ...item, font: regular } : item)) }],
      }
      expect(verify(chartBars, light)).toEqual(["chart-bars: page 1: the chart sales prints 'Sales by region' in Roboto-Regular; its face is Roboto-Medium"])
    },
    TIMEOUT,
  )
})

describe("the corpus's copies of the renderer's constants", () => {
  // The corpus depends on no renderer, so it reads a chart by copies of
  // four of the renderer's constants: its gridlines and its category
  // axis's line are found by their colours, a pie's slice of no share by
  // the parts the renderer hands ECharts a share in, and a value's label
  // by how far from its mark's end the renderer has ECharts set it. A
  // copy that drifted would find no axis on any chart, expect a sliver
  // drawn that the renderer draws nothing of, or none of one it draws, or
  // hold every label to a place it never stands.
  test("are the renderer's grid and axis colours, its share unit and its labels' distance", () => {
    expect([GRID_PAINT, AXIS_PAINT, SHARE_UNIT, LABEL_DISTANCE]).toEqual([GRID.color, AXIS.color, QUOTIENT_UNIT, VALUE_LABEL_DISTANCE])
  })
})

describe('a render', () => {
  // A PDF that differs on every run cannot be reproduced from its inputs, nor
  // found again by its digest: the creation date is the document's own, and
  // nothing else in the file may vary.
  test(
    'renders the same document to the same bytes',
    async () => {
      const { document, maxPages } = fixture('group-boundary')
      const [first, second] = await Promise.all([renderPdf(document, { maxPages }), renderPdf(document, { maxPages })])
      expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
      expect(Buffer.from(first).toString('latin1')).toContain('(D:20260101000000Z)')
    },
    TIMEOUT,
  )

  // An e-invoice is found again by its digest, or by nothing. A PDF/A adds
  // what a plain PDF has not -- an embedded file and its dates, the XMP,
  // an output intent -- and none of it may vary: the file's dates are the
  // document's, the XMP holds no clock and no random id, and the profile
  // is a fixed file. The same document renders to the same bytes, its
  // creation date in the file's /Params as in the information dictionary.
  test(
    'renders the same e-invoice to the same bytes',
    async () => {
      const outcome = resolveReport(E_INVOICE.report, E_INVOICE.data, {
        mode: 'final',
        parameters: E_INVOICE.parameters,
        images: starterImages,
        creationDate: '2026-10-16T08:00:00Z',
      })
      if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path}`).join('; '))
      const [first, second] = await Promise.all([renderPdf(outcome.document, { maxPages: 5 }), renderPdf(outcome.document, { maxPages: 5 })])
      expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
      expect(
        Buffer.from(first)
          .toString('latin1')
          .match(/\(D:20261016080000Z\)/g),
      ).toHaveLength(3)
    },
    TIMEOUT,
  )

  // A cancelled job that still returns a PDF has not been cancelled.
  test('refuses a job whose signal is already aborted, before anything is laid out', async () => {
    const controller = new AbortController()
    controller.abort()
    const createPdf = vi.spyOn(pdfmake, 'createPdf')
    try {
      await expect(renderPdf(fixture('one-row').document, { maxPages: 5, signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' })
      expect(createPdf).not.toHaveBeenCalled()
    } finally {
      createPdf.mockRestore()
    }
  })

  // A job the caller gave up on is cancelled, whatever else is wrong with
  // it: the caller is told it was cancelled, not to fix a colour in a report
  // it no longer wants.
  test('refuses an aborted job as cancelled before reading the document', async () => {
    const controller = new AbortController()
    controller.abort()
    const document = { ...fixture('one-row').document, body: [{ kind: 'rule', thickness: 1, color: 'red' }] as const }
    await expect(renderPdf(document, { maxPages: 5 })).rejects.toMatchObject({ code: 'unsupported' })
    await expect(renderPdf(document, { maxPages: 5, signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' })
  })

  // An abort that arrives while pdfmake works: its layout is synchronous and
  // cannot be interrupted, so the renderer must look again once it returns,
  // rather than hand back the PDF of a job the caller gave up on.
  test('refuses a job aborted while it renders', async () => {
    const controller = new AbortController()
    const rendering = renderPdf(fixture('one-row').document, { maxPages: 5, signal: controller.signal })
    controller.abort()
    await expect(rendering).rejects.toBeInstanceOf(RenderRefusal)
    await expect(rendering).rejects.toMatchObject({ code: 'cancelled' })
  })

  // The last pass is the PDF itself: an abort during it is seen once it is
  // written, and the PDF is thrown away rather than resolved.
  test('refuses a job aborted during its last pass, with the PDF already written', async () => {
    const controller = new AbortController()
    const createPdf = pdfmake.createPdf.bind(pdfmake)
    let passes = 0
    const spy = vi.spyOn(pdfmake, 'createPdf').mockImplementation((definition, options) => {
      // one-row has a page header and footer and a table: regions, body, then the PDF.
      if (++passes === 3) controller.abort()
      return createPdf(definition, options)
    })
    try {
      await expect(renderPdf(fixture('one-row').document, { maxPages: 5, signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' })
      expect(passes).toBe(3)
    } finally {
      spy.mockRestore()
    }
  })

  // A page limit that is not a whole number of pages would be compared
  // against page numbers as though it were one: a limit of 2.5 allows two
  // pages, and NaN allows every page there is.
  test.each([0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses a page limit of %s as the caller’s mistake', async (maxPages) => {
    await expect(renderPdf(fixture('one-row').document, { maxPages })).rejects.toBeInstanceOf(RangeError)
  })
})

describe('the page limit', () => {
  // pdfmake's own limit, `maxPagesNumber`, cuts the document short and
  // returns the first pages as though they were all of it. The renderer's
  // limit must refuse one page past it and allow exactly it, or a report one
  // page over the limit arrives looking complete.
  test(
    'allows a document of exactly the limit and refuses one page more',
    async () => {
      const { document, maxPages } = fixture('long-table')
      const pages = (await readPdf(await renderPdf(document, { maxPages }))).pages.length
      expect(pages).toBeGreaterThan(1)
      expect((await readPdf(await renderPdf(document, { maxPages: pages }))).pages).toHaveLength(pages)
      await expect(renderPdf(document, { maxPages: pages - 1 })).rejects.toMatchObject({ code: 'too-many-pages' })
    },
    TIMEOUT,
  )

  // A refusal that comes only after laying out all six thousand rows costs
  // what rendering them would: the limit bounds the work, not just the
  // output. Watched on pdfmake itself, which still does the layout: each of
  // the renderer's passes is laid out until pdfmake begins a page past the
  // limit's worth of paper, and no further.
  test(
    'stops laying out an oversized job one page past the limit',
    async () => {
      const oversized = fixture('oversized')
      const laidOut: number[] = []
      const createPdf = pdfmake.createPdf.bind(pdfmake)
      const spy = vi.spyOn(pdfmake, 'createPdf').mockImplementation((definition, options) => {
        const pass = laidOut.push(0) - 1
        const background = definition.background
        return createPdf(
          {
            ...definition,
            background: (page, size) => {
              // The height of the pages begun before this one.
              laidOut[pass] = (page - 1) * size.height
              return typeof background === 'function' ? background(page, size) : null
            },
          },
          options,
        )
      })
      try {
        await expect(renderPdf(oversized.document, { maxPages: oversized.maxPages })).rejects.toMatchObject({ code: 'too-many-pages' })
      } finally {
        spy.mockRestore()
      }
      const { height } = pageDimensions(oversized.document.page)
      expect(laidOut.length).toBeGreaterThan(0)
      expect(Math.max(...laidOut)).toBeLessThanOrEqual((oversized.maxPages + 1) * height)
    },
    TIMEOUT,
  )
})
