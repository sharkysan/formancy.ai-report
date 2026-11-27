import { ALL_FIXTURES, QUOTATION, quotationData, quotationLines } from '@formancy/report-corpus'
import { MAX_DETAIL_ROWS, MAX_STRING_LENGTH, PREVIEW_LABEL } from '@formancy/report-runtime'
import type { RenderManifest, RuntimeError } from '@formancy/report-runtime'
import { emptyReport, MAX_REPORT_BYTES } from '@formancy/report-spec'
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test, vi } from 'vitest'
import { bounded, MAX_ANSWER_BYTES, MAX_CHECK_PAGES, renderCheck } from './render.js'
import type { CheckedPage, RenderCheckInput } from './render.js'
import { bytesOf, quotationOf, STARTER_ASSETS } from './test-support.js'
import type { ToolResult } from './tools.js'

/**
 * render_check as a function, over the corpus's quotation and reports
 * made to the bound (0089).
 *
 * Every verdict is another package's -- the validator's, the runtime's,
 * the renderer's -- so a case holds the answer to the code that package
 * gives; what is the check's own is held here: the assets held to their
 * digests before anything resolves, the three bounds, each at the bound
 * and one past it, and the PDF answered as its lines and never as bytes.
 * `pdf-text.test.ts` holds the lines to the corpus's reading of the same
 * PDF.
 */

interface Rendered {
  readonly rendered: true
  readonly pages: readonly CheckedPage[]
  readonly warnings: readonly RuntimeError[]
  readonly manifest: RenderManifest
}

interface Refused {
  readonly rendered: false
  readonly refusal?: { readonly code: string; readonly message: string; readonly asset?: string; readonly pages?: number }
  readonly runtime?: readonly RuntimeError[]
  readonly renderer?: { readonly code: string; readonly message: string }
}

const dataOf = <T>(result: ToolResult): T => result.data as T

/** The quotation as an agent passes it: its report, its data, its firm's mark. */
const quotation = (more: Partial<RenderCheckInput> = {}): RenderCheckInput => ({
  report: QUOTATION.report,
  data: quotationData(),
  parameters: QUOTATION.parameters,
  assets: STARTER_ASSETS,
  ...more,
})

/** What a report of no detail dataset is rendered with: none of its rows missing, captured by the host. */
const NO_ROWS = { completeness: { complete: true, captured: 0 }, consistency: 'host-captured' }

/** A report of `pages` pages: a line on each, a page break between two. */
function paged(pages: number): ReportDefinition {
  const body: Component[] = Array.from({ length: pages }, (_, at) => [
    ...(at === 0 ? [] : [{ id: `break-${String(at)}`, kind: 'pageBreak' } as const]),
    { id: `page-${String(at)}`, kind: 'text', content: [{ kind: 'text', text: `Page ${String(at + 1)}` }] } as const,
  ]).flat()
  const report = emptyReport('pages', 'Pages', 'en-GB')
  return { ...report, regions: { ...report.regions, body } }
}

describe('what render_check answers', () => {
  // What only the PDF knows: the page the quotation's lines landed on, in
  // the order a reader meets them, its title and its total among them.
  test('answers the quotation’s one page, its lines top to bottom, read from its PDF', async () => {
    const result = await renderCheck(quotation())
    expect(result.ok).toBe(true)
    const { pages, warnings, manifest } = dataOf<Rendered>(result)
    expect(pages.map(({ page }) => page)).toEqual([1])
    const lines = pages[0]?.lines ?? []
    expect(lines[0]).toBe('Offerte Q-2026-0415')
    // The address and the quotation's own lines stand in two columns, read
    // across the page as a reader reads them, where the document lists
    // one column and then the other.
    expect(lines.slice(2, 6)).toEqual(['Bäckerei Müller AG', 'Offerte', 'z. Hd. Herr Peter Kühni', 'Nummer: Q-2026-0415'])
    const subtotal = lines.indexOf("Zwischensumme CHF 2'907.49")
    expect(subtotal).toBeGreaterThan(-1)
    expect(lines.indexOf("Total CHF 3'143.00")).toBeGreaterThan(subtotal)
    expect(lines.at(-1)).toBe('Seite 1 von 1')
    expect(warnings).toEqual([])
    expect(manifest).toMatchObject({ mode: 'final', locale: 'de-CH' })
    expect(result.summary).toContain('1 page')
  })

  // A final render refuses data that lacks a field the report reads, and
  // the agent is told the runtime's code at the field's path, not that
  // the render failed.
  test('answers the runtime’s refusal of data a final render refuses, by its code, and renders nothing', async () => {
    const { customer: _customer, ...header } = quotationData().header as Record<string, unknown>
    const result = await renderCheck(quotation({ data: { ...quotationData(), header } }))
    expect(result.ok).toBe(false)
    const { rendered, runtime } = dataOf<Refused>(result)
    expect(rendered).toBe(false)
    expect(runtime).toEqual([expect.objectContaining({ stage: 'data', code: 'missing-field', path: '/header/customer' })])
    expect(result.summary).toContain('runtime')
    expect(result.data).not.toHaveProperty('pages')
  })

  // The data is the runtime's envelope, a host's as an agent's: sample
  // data of header and detail alone is refused by the runtime's codes for
  // what it lacks, which the tool's description names.
  test('answers the runtime’s refusal of data without its completeness and its consistency', async () => {
    const { header, detail } = quotationData() as { header: unknown; detail: unknown }
    const result = await renderCheck(quotation({ data: { header, detail } }))
    expect(dataOf<Refused>(result).runtime?.map(({ code }) => code)).toEqual(['invalid-completeness', 'invalid-consistency'])
  })

  // A preview prints what a final render refuses, and every page says it
  // is one: the agent sees the label, and the warning that put it there.
  test('prints a preview of the same data, labelled, with the runtime’s warning', async () => {
    const { customer: _customer, ...header } = quotationData().header as Record<string, unknown>
    const result = await renderCheck(quotation({ data: { ...quotationData(), header }, mode: 'preview' }))
    expect(result.ok).toBe(true)
    const { pages, warnings, manifest } = dataOf<Rendered>(result)
    expect(pages[0]?.lines[0]).toBe(PREVIEW_LABEL)
    expect(warnings).toEqual([expect.objectContaining({ code: 'missing-field', path: '/header/customer' })])
    expect(manifest.mode).toBe('preview')
  })

  // The locale and the zone are the runtime's to judge, as a host's are:
  // one the report does not declare, and a zone Intl does not know, are
  // refused by its codes.
  test('hands the locale and the time zone to the runtime, which refuses one the report does not declare and a zone it does not know', async () => {
    const codes = async (more: Partial<RenderCheckInput>) => dataOf<Refused>(await renderCheck(quotation(more))).runtime?.map(({ code }) => code)
    expect(await codes({ locale: 'fr-CH' })).toEqual(['undeclared-locale'])
    expect(await codes({ timeZone: 'Mars/Olympus' })).toEqual(['unsupported-time-zone'])
    expect((await renderCheck(quotation({ locale: 'de-CH', timeZone: 'Europe/Zurich' }))).ok).toBe(true)
  })

  // The renderer's refusal is the renderer's, by its code: a document it
  // cannot print whole is never cut to the pages that fit.
  test('prints MAX_CHECK_PAGES pages, and answers the renderer’s too-many-pages one page past them', async () => {
    const at = await renderCheck({ report: paged(MAX_CHECK_PAGES), data: NO_ROWS })
    expect(at.ok).toBe(true)
    const { pages } = dataOf<Rendered>(at)
    expect(pages.map(({ lines }) => lines)).toEqual(Array.from({ length: MAX_CHECK_PAGES }, (_, page) => [`Page ${String(page + 1)}`]))
    const past = await renderCheck({ report: paged(MAX_CHECK_PAGES + 1), data: NO_ROWS })
    expect(past.ok).toBe(false)
    expect(dataOf<Refused>(past)).toMatchObject({ rendered: false, renderer: { code: 'too-many-pages' } })
    expect(past.summary).toContain('too-many-pages')
  })

  // A report the validator refuses is never resolved: its errors are the
  // answer, as validate_report gives them.
  test('answers the validator’s errors for a document that is no report', async () => {
    const result = await renderCheck({ report: { specVersion: '4', id: 'contact' }, data: NO_ROWS })
    expect(result.ok).toBe(false)
    expect(result.data).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'not-a-report' })] })
  })

  // A signal aborted before the render stops it: the renderer's own
  // cancelled, and no PDF.
  test('answers the renderer’s cancelled where the call’s signal is aborted', async () => {
    const stop = new AbortController()
    stop.abort()
    const result = await renderCheck(quotation(), stop.signal)
    expect(dataOf<Refused>(result)).toMatchObject({ rendered: false, renderer: { code: 'cancelled' } })
  })
})

describe('the assets an agent passes', () => {
  // Bytes that are not the digest they came with would print a picture the
  // report never pinned; they are refused before the runtime asks for
  // them, whether or not the report draws them, and before data the
  // runtime would refuse is read.
  test('refuses an asset whose bytes are not its digest before anything resolves', async () => {
    const [logo] = STARTER_ASSETS
    if (logo === undefined) throw new Error('the corpus has no starter image')
    const other = { ...logo, base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64') }
    const result = await renderCheck(quotation({ assets: [other], data: { header: {} } }))
    expect(result.ok).toBe(false)
    expect(dataOf<Refused>(result)).toMatchObject({ rendered: false, refusal: { code: 'asset-not-its-digest', asset: logo.asset } })
    expect(result.data).not.toHaveProperty('runtime')
    const unused = { asset: 'unused', digest: logo.digest, mediaType: logo.mediaType, base64: other.base64 }
    expect(dataOf<Refused>(await renderCheck(quotation({ assets: [...STARTER_ASSETS, unused] }))).refusal?.code).toBe('asset-not-its-digest')
  })

  // A font is an asset as an image is (0043): a face the report maps
  // comes as bytes with its digest, and its lines print in it; a face
  // whose bytes are not its digest is refused before anything resolves.
  test('prints in a face the report maps, passed as bytes with its digest', async () => {
    const serif = ALL_FIXTURES.find(({ id }) => id === 'host-fonts')?.document.fonts?.serif?.normal
    if (serif === undefined) throw new Error('the corpus has no host serif')
    const report = QUOTATION.report
    const mapped: ReportDefinition = {
      ...report,
      assets: [...report.assets, { id: 'serif', mediaType: 'font/ttf', digest: serif.digest }],
      fonts: { serif: { normal: 'serif' } },
      styles: report.styles.map((style) => (style.id === 'address' ? { ...style, font: 'serif' } : style)),
    }
    const face = { asset: 'serif', digest: serif.digest, mediaType: 'font/ttf', base64: Buffer.from(serif.bytes).toString('base64') }
    const result = await renderCheck(quotation({ report: mapped, assets: [...STARTER_ASSETS, face] }))
    expect(result.ok, result.summary).toBe(true)
    expect(dataOf<Rendered>(result).pages[0]?.lines).toContain('Bäckerei Müller AG')
    expect(dataOf<Refused>(await renderCheck(quotation({ report: mapped }))).runtime?.map(({ code }) => code)).toContain('missing-asset')
    const wrong = { ...face, base64: Buffer.from(serif.bytes.subarray(1)).toString('base64') }
    expect(dataOf<Refused>(await renderCheck(quotation({ report: mapped, assets: [...STARTER_ASSETS, wrong] }))).refusal?.code).toBe('asset-not-its-digest')
  })

  // An image the report draws and the call does not carry is the
  // runtime's missing-asset, as a host's lookup that has none is.
  test('answers the runtime’s missing-asset for an image the call does not carry', async () => {
    const result = await renderCheck(quotation({ assets: [] }))
    expect(dataOf<Refused>(result).runtime?.map(({ code }) => code)).toContain('missing-asset')
  })

  // A list of another shape, bytes that are not base64 and a mode that is
  // neither are refused as the call's, before anything resolves.
  test('refuses assets that are not four strings, bytes that are not base64 and a mode that is neither', async () => {
    const [logo] = STARTER_ASSETS
    const code = async (more: Partial<RenderCheckInput>) => dataOf<Refused>(await renderCheck(quotation(more))).refusal?.code
    expect(await code({ assets: 'logo' })).toBe('invalid-arguments')
    expect(await code({ assets: [{ ...logo, digest: 7 }] })).toBe('invalid-arguments')
    expect(await code({ assets: [null] })).toBe('invalid-arguments')
    expect(await code({ assets: [{ ...logo, base64: 'not base64!' }] })).toBe('asset-not-base64')
    expect(await code({ assets: [{ ...logo, base64: `${logo?.base64 ?? ''}=` }] })).toBe('asset-not-base64')
    expect(await code({ mode: 'draft' as unknown as 'final' })).toBe('invalid-arguments')
  })
})

describe('no PDF leaves it', () => {
  // The PDF stays here: an answer that carried its bytes, raw or in base64,
  // would multiply its size and hand the agent what it cannot read.
  test('answers no byte of the PDF, raw or in base64', async () => {
    const answer = JSON.stringify(await renderCheck(quotation()))
    expect(answer).not.toContain('%PDF')
    expect(answer).not.toContain(Buffer.from('%PDF-').toString('base64').slice(0, 6))
    expect(Object.keys(dataOf<Rendered>(await renderCheck(quotation()))).sort()).toEqual(['manifest', 'pages', 'rendered', 'warnings'])
  })
})

describe('what one call may cost', () => {
  // The report is held to the bound a save holds it to, before anything
  // resolves: at the bound the renderer judges it, a byte past it nothing
  // does.
  test('takes a report of MAX_REPORT_BYTES to the renderer and refuses one a byte past it before anything resolves', async () => {
    const at = await renderCheck(quotation({ report: quotationOf(MAX_REPORT_BYTES) }))
    expect(dataOf<Refused>(at).refusal?.code).not.toBe('report-too-large')
    const past = await renderCheck(quotation({ report: quotationOf(MAX_REPORT_BYTES + 1) }))
    expect(dataOf<Refused>(past)).toMatchObject({ rendered: false, refusal: { code: 'report-too-large' } })
  }, 30_000)

  // The data's rows are the runtime's bound: MAX_DETAIL_ROWS reach the
  // renderer, which refuses what cannot fit before laying it out, and one
  // more is the runtime's too-many-rows.
  test('takes MAX_DETAIL_ROWS rows to the renderer and answers one more as the runtime refuses it', async () => {
    const at = await renderCheck(quotation({ data: quotationData(MAX_DETAIL_ROWS) }))
    expect(dataOf<Refused>(at)).toMatchObject({ rendered: false, renderer: { code: 'too-many-pages' } })
    const past = await renderCheck(quotation({ data: quotationData(MAX_DETAIL_ROWS + 1) }))
    expect(dataOf<Refused>(past).runtime).toEqual([expect.objectContaining({ stage: 'data', code: 'too-many-rows', path: '/detail' })])
  }, 60_000)

  // A string's length is the runtime's bound too: one of MAX_STRING_LENGTH
  // characters prints, across the pages it needs, and one more is refused.
  test('prints a string of MAX_STRING_LENGTH characters and answers one more as the runtime refuses it', async () => {
    const described = (length: number) => {
      const [first, ...rest] = quotationLines(12)
      return { ...quotationData(), detail: [{ ...first, description: 'Wartung '.repeat(length).slice(0, length) }, ...rest] }
    }
    const at = await renderCheck(quotation({ data: described(MAX_STRING_LENGTH) }))
    expect(at.ok).toBe(true)
    expect(dataOf<Rendered>(at).pages.length).toBeGreaterThan(1)
    const past = await renderCheck(quotation({ data: described(MAX_STRING_LENGTH + 1) }))
    expect(dataOf<Refused>(past).runtime).toEqual([expect.objectContaining({ code: 'string-too-long', path: '/detail/0/description' })])
  }, 30_000)

  // The answer is held to MAX_ANSWER_BYTES whole: at the bound it is
  // answered, a byte past it refused with the page count, and never a page
  // or a line cut to fit.
  test('answers an answer of MAX_ANSWER_BYTES and refuses one a byte past it, every line or none', () => {
    const manifest = {
      reportHash: 'h',
      reportSpecVersion: '0',
      locale: 'en-GB',
      timeZone: 'UTC',
      mode: 'final',
      consistency: 'host-captured',
      completeness: { complete: true },
      parameters: {},
    } as unknown as RenderManifest
    const of = (length: number): CheckedPage[] => [{ page: 1, lines: ['x'.repeat(length)] }]
    const padding = MAX_ANSWER_BYTES - bytesOf({ rendered: true, pages: of(0), warnings: [], manifest })
    const at = bounded(of(padding), [], manifest)
    expect(bytesOf(at.data)).toBe(MAX_ANSWER_BYTES)
    expect(at.ok).toBe(true)
    const past = bounded(of(padding + 1), [], manifest)
    expect(past.ok).toBe(false)
    expect(past.data).toEqual({
      rendered: false,
      refusal: { code: 'answer-too-large', message: expect.any(String), pages: 1, bytes: MAX_ANSWER_BYTES + 1, max: MAX_ANSWER_BYTES },
    })
  })

  // A real render past it: a table of small print within the page bound
  // prints more than the answer may hold, and is refused with its pages.
  test('refuses a render whose lines are past MAX_ANSWER_BYTES, naming its pages', async () => {
    const report = QUOTATION.report
    const dense: ReportDefinition = {
      ...report,
      styles: [...report.styles, { id: 'dense', size: 4 }],
      regions: {
        ...report.regions,
        body: [
          {
            id: 'lines',
            kind: 'table',
            dataset: 'detail',
            columns: [
              {
                id: 'description',
                header: 'Beschreibung',
                width: 'fill',
                align: 'left',
                value: { kind: 'field', field: { dataset: 'detail', field: 'description' } },
                style: 'dense',
              },
            ],
            emptyText: 'Keine Positionen.',
            repeatHeader: true,
          },
        ],
      },
    }
    const long = 'Wartung Lüftungsanlage Filterwechsel Kontrolle Heizung Sanitär '.repeat(4).slice(0, 230).trim()
    const rows = quotationData(1200)
    const result = await renderCheck(
      quotation({ report: dense, data: { ...rows, detail: quotationLines(1200).map((row) => ({ ...row, description: long })) } }),
    )
    const { refusal } = dataOf<Refused>(result)
    expect(refusal?.code).toBe('answer-too-large')
    expect(refusal?.pages).toBeGreaterThan(1)
    expect(refusal?.pages).toBeLessThanOrEqual(MAX_CHECK_PAGES)
  }, 30_000)
})

describe('what it reaches', () => {
  // Data passed in and nothing fetched: a render check that asked the
  // network for an asset, a font or a worker would be one an agent's
  // client could not run offline, and one a hostile report could point.
  test('fetches nothing', async () => {
    const fetching = vi.spyOn(globalThis, 'fetch')
    try {
      expect((await renderCheck(quotation())).ok).toBe(true)
      expect(fetching).not.toHaveBeenCalled()
    } finally {
      fetching.mockRestore()
    }
  })
})

describe('a fault', () => {
  // What the renderer throws that is no refusal is a fault: thrown on, for
  // the protocol to answer as the call's error, and never told to an agent
  // as the renderer's verdict on its report.
  test('throws on what the renderer throws that is no refusal', async () => {
    vi.resetModules()
    vi.doMock('@formancy/report-render-pdf', () => ({ renderPdf: () => Promise.reject(new Error('the engine broke')) }))
    try {
      const fresh = await import('./render.js')
      await expect(fresh.renderCheck(quotation())).rejects.toThrow('the engine broke')
    } finally {
      vi.doUnmock('@formancy/report-render-pdf')
      vi.resetModules()
    }
  })
})
