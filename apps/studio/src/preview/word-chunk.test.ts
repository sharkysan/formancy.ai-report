// @vitest-environment node

import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { readPdf } from '@formancy/report-corpus'
import { afterAll, beforeAll, expect, test, vi, type MockInstance } from 'vitest'
import { studioImages } from '../images/image-store.js'
import { decodeStarters, encodeStarters } from '../starters/codec.js'
import { preview } from './pipeline.js'

/**
 * The pipeline where the Word writer does not load at all: a file of its
 * own beside word-fault.test.ts, since a module is stood in for once a
 * file. There the writer loads and throws; here asking for it is what
 * fails, as a chunk of the build's that the network did not deliver does
 * in a browser. The module is made to fail as it is made, which is the
 * one way to have its import reject under Node.
 */

vi.mock('@formancy/report-render-docx', () => {
  throw new Error('the chunk of the Word writer did not load')
})

const { starters, images } = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))

// pdfmake's browser build's one warning outside a browser, as pipeline.test.ts silences and holds it.
let warn: MockInstance<typeof console.warn>
beforeAll(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterAll(() => {
  const warnings = new Set(warn.mock.calls.map((call) => String(call[0])))
  warn.mockRestore()
  expect([...warnings].filter((each) => !each.startsWith('No local access policy defined'))).toEqual([])
})

// The writer is a chunk of its own, asked for once a PDF has printed (0068). Asked for outside the guard that catches what it throws, a
// chunk that did not load would reject the whole preview: the PDF the renderer had already drawn would never reach the paper, for want
// of a file nobody had asked to download. The PDF is handed on as it printed, and the fault said of the Word file alone.
test('keeps the PDF that printed where the Word writer does not load, and says the fault of the Word file alone', async () => {
  const starter = starters.find((each) => each.id === 'quotation')
  if (starter === undefined) throw new Error('no quotation among the starters')
  const outcome = await preview(
    { report: starter.report, starter, mode: 'preview', images: studioImages(images).resolve, creationDate: '2026-10-16T08:00:00Z' },
    new AbortController().signal,
  )
  if (outcome.kind !== 'printed') throw new Error(`the quotation was not printed: ${JSON.stringify(outcome)}`)
  expect((await readPdf(outcome.pdf)).pages.flatMap((page) => page.items.map((item) => item.text)).join(' ')).toContain('Offerte')
  expect(outcome.word.kind).toBe('failed')
  // The words are the loader's, which wraps what the module threw: held to saying something, and to the module never having written a file.
  expect(outcome.word.kind === 'failed' && outcome.word.message).toMatch(/\S/)
})
