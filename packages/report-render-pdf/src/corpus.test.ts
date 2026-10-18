import pdfmake from 'pdfmake'
import { ALL_FIXTURES, E_INVOICE, pageDimensions, readPdf, SVG_FIXTURES, verify, verifyInk, verifyRefusal, type Fixture } from '@formancy/report-corpus'
import { RenderRefusal, resolveReport } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import { renderPdf } from './node.js'
import type { RenderOptions } from './options.js'
import { fixture, TIMEOUT } from './testing/documents.js'

/**
 * The renderer on the corpus: every fixture rendered and proved on the PDF
 * it produced, with the corpus's own checks, never on the definition pdfmake
 * was given (0003). These are the gate decision 0005 names: the trial chose
 * pdfmake on this corpus, and the renderer grown from its adapter is held to
 * it here, and to the corpus's SVG fixtures beside it (0030), which the
 * trial's engines never drew.
 */

/** Section 20's fixtures, and the SVG ones. */
const CORPUS: readonly Fixture[] = [...ALL_FIXTURES, ...SVG_FIXTURES]

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
    test(`${each.id}: ${finding === undefined ? each.title : `fails: ${finding.reason}`}`, async () => {
      expect(await problems(each)).toEqual(finding?.problems ?? [])
    }, TIMEOUT)
  }

  // A drawing is painted inside a clip of its box, and `cover` paints it
  // past the box for the clip to hide: the operator list cannot say what
  // the clip kept in, and the pixels can (0003). Each SVG fixture's every
  // page, drawn by PDF.js, shows nothing of a drawing past its box.
  for (const each of SVG_FIXTURES.filter((fixture) => fixture.expect.outcome === 'render')) {
    test(`${each.id}: shows nothing of a drawing past its box, by its pixels`, async () => {
      expect(await verifyInk(each, await renderPdf(each.document, { maxPages: each.maxPages }))).toEqual([])
    }, TIMEOUT)
  }

  // An empty corpus would pass every case above, and so would a list of
  // fixtures the renderer is excused from that grew to cover all of them.
  test('runs a corpus that has fixtures, and excuses none of them', () => {
    expect(ALL_FIXTURES.length).toBeGreaterThan(0)
    expect(SVG_FIXTURES.filter((fixture) => fixture.expect.outcome === 'render').length).toBeGreaterThan(0)
    expect([...CANNOT.keys()]).toEqual([])
  })
})

describe('a render', () => {
  // A PDF that differs on every run cannot be reproduced from its inputs, nor
  // found again by its digest: the creation date is the document's own, and
  // nothing else in the file may vary.
  test('renders the same document to the same bytes', async () => {
    const { document, maxPages } = fixture('group-boundary')
    const [first, second] = await Promise.all([renderPdf(document, { maxPages }), renderPdf(document, { maxPages })])
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
    expect(Buffer.from(first).toString('latin1')).toContain('(D:20260101000000Z)')
  }, TIMEOUT)

  // An e-invoice is found again by its digest, or by nothing. A PDF/A adds
  // what a plain PDF has not -- an embedded file and its dates, the XMP,
  // an output intent -- and none of it may vary: the file's dates are the
  // document's, the XMP holds no clock and no random id, and the profile
  // is a fixed file. The same document renders to the same bytes, its
  // creation date in the file's /Params as in the information dictionary.
  test('renders the same e-invoice to the same bytes', async () => {
    const outcome = resolveReport(E_INVOICE.report, E_INVOICE.data, { mode: 'final', parameters: E_INVOICE.parameters, creationDate: '2026-10-16T08:00:00Z' })
    if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path}`).join('; '))
    const [first, second] = await Promise.all([renderPdf(outcome.document, { maxPages: 5 }), renderPdf(outcome.document, { maxPages: 5 })])
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
    expect(Buffer.from(first).toString('latin1').match(/\(D:20261016080000Z\)/g)).toHaveLength(3)
  }, TIMEOUT)

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
  test('allows a document of exactly the limit and refuses one page more', async () => {
    const { document, maxPages } = fixture('long-table')
    const pages = (await readPdf(await renderPdf(document, { maxPages }))).pages.length
    expect(pages).toBeGreaterThan(1)
    expect((await readPdf(await renderPdf(document, { maxPages: pages }))).pages).toHaveLength(pages)
    await expect(renderPdf(document, { maxPages: pages - 1 })).rejects.toMatchObject({ code: 'too-many-pages' })
  }, TIMEOUT)

  // A refusal that comes only after laying out all six thousand rows costs
  // what rendering them would: the limit bounds the work, not just the
  // output. Watched on pdfmake itself, which still does the layout: each of
  // the renderer's passes is laid out until pdfmake begins a page past the
  // limit's worth of paper, and no further.
  test('stops laying out an oversized job one page past the limit', async () => {
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
  }, TIMEOUT)
})
