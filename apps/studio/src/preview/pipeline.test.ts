// @vitest-environment node

import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { readPdf } from '@formancy/report-corpus'
import { afterAll, beforeAll, describe, expect, test, vi, type MockInstance } from 'vitest'
import { decodeStarters, encodeStarters } from '../starters/codec.js'
import { BLANK, imagesOf } from '../starters/starters.js'
import { preview } from './pipeline.js'
import type { PreviewRequest } from './pipeline.js'

/**
 * The preview's pipeline as the page runs it -- the starters as the page
 * receives them, the runtime, and the renderer's browser entry -- run here
 * under Node, where PDF.js reads the PDFs back (0003), so a claim about
 * what printed rests on the PDF, not on what the renderer was handed. The
 * journey runs the same entry under jsdom, and the browser gate in
 * Chromium.
 */

const { starters, images } = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))
const CREATED = '2026-10-16T08:00:00Z'

function request(id: string, overrides: Partial<PreviewRequest> = {}): PreviewRequest {
  const starter = [...starters, BLANK].find((each) => each.id === id)
  if (starter === undefined) throw new Error(`no starter ${id}`)
  return { report: starter.report, starter, mode: 'preview', images: imagesOf(images), creationDate: CREATED, ...overrides }
}

// pdfmake's browser build warns, outside a browser, that it has no local
// access policy to set; report-render-pdf's own browser test silences that
// one warning the same way, and holds that it is the only one.
let warn: MockInstance<typeof console.warn>
beforeAll(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterAll(() => {
  const warnings = new Set(warn.mock.calls.map((call) => String(call[0])))
  warn.mockRestore()
  expect([...warnings].filter((each) => !each.startsWith('No local access policy defined'))).toEqual([])
})

describe('the preview pipeline', () => {
  // Each starter opens in the Studio and previews at once. One that came
  // back refused -- an image the host's lookup did not hand over, data the
  // page decoded differently -- would greet the person with an error for a
  // report the corpus proves prints.
  test.each(['service-inspection', 'quotation', 'grouped-equipment', 'blank'])('prints %s, and the PDF holds its title', async (id) => {
    const outcome = await preview(request(id), new AbortController().signal)
    if (outcome.kind !== 'printed') throw new Error(`${id} was not printed: ${JSON.stringify(outcome)}`)
    const pdf = await readPdf(outcome.pdf)
    expect(pdf.pages.length).toBeGreaterThan(0)
    if (id !== 'blank') expect(pdf.pages.flatMap((page) => page.items.map((item) => item.text)).join(' ')).toContain(id === 'quotation' ? 'Offerte' : id === 'grouped-equipment' ? 'Equipment register' : 'Service inspection')
    expect(outcome.manifest.mode).toBe('preview')
  })

  // What the runtime refuses comes back as its errors, each with its stage
  // and the component it is in, for the pane to list and link -- not as an
  // exception that leaves the preview blank. Final refuses data a preview
  // would show with a warning.
  test('returns what the runtime refuses, with where it is', async () => {
    const quotation = request('quotation')
    const header = { ...(quotation.starter.data.header ?? {}) }
    delete header[Object.keys(header)[0] ?? '']
    const lacking = { ...quotation.starter, data: { ...quotation.starter.data, header } }
    const final = await preview({ ...quotation, starter: lacking, mode: 'final' }, new AbortController().signal)
    expect(final.kind).toBe('refused')
    if (final.kind === 'refused') expect(final.errors.map((error) => error.stage)).toContain('data')
    const sample = await preview({ ...quotation, starter: lacking, mode: 'preview' }, new AbortController().signal)
    expect(sample.kind).toBe('printed')
    if (sample.kind === 'printed') expect(sample.warnings.length).toBeGreaterThan(0)
  })

  // What the renderer refuses -- here, the inspection's two pages against a
  // limit of one -- comes back as its code and subject, never as a PDF cut
  // short (0011).
  test("returns the renderer's refusal, never part of a PDF", async () => {
    const outcome = await preview(request('service-inspection'), new AbortController().signal, { maxPages: 1 })
    expect(outcome).toEqual({ kind: 'not-drawn', refusal: expect.objectContaining({ code: 'too-many-pages' }) })
  })

  // An abort is the renderer's `cancelled`: the scheduler drops it, and
  // nothing else hears of it as a failure.
  test('is cancelled by its signal', async () => {
    const controller = new AbortController()
    controller.abort()
    const outcome = await preview(request('quotation'), controller.signal)
    expect(outcome).toEqual({ kind: 'not-drawn', refusal: expect.objectContaining({ code: 'cancelled' }) })
  })
})
