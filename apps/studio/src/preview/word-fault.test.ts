// @vitest-environment node

import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { readPdf } from '@formancy/report-corpus'
import { afterAll, beforeAll, expect, test, vi, type MockInstance } from 'vitest'
import { studioImages } from '../images/image-store.js'
import { decodeStarters, encodeStarters } from '../starters/codec.js'
import { preview } from './pipeline.js'

/**
 * The pipeline over a Word writer that fails: the one suite where the
 * writer is stood in for, since no document is known to make the real one
 * throw anything but its refusal. What a file it writes holds is
 * pipeline.test.ts's, over the real writer; here there is no file to
 * prove, only what the pipeline does when it gets none.
 */

vi.mock('@formancy/report-render-docx', () => ({
  renderDocx: () => {
    throw new TypeError('the writer read a property of undefined')
  },
}))

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

// The Word file is written beside a PDF that printed (0068). A fault of
// the writer's -- anything it throws that is no refusal -- left as an
// exception would be the whole preview's fault: the PDF the renderer drew
// would never reach the paper, and a defect in the newer writer would take
// away the preview every report had before it. The PDF is handed on as it
// printed, and the fault said of the Word file alone.
test('keeps the PDF that printed where the Word writer fails, and says the fault of the Word file alone', async () => {
  const starter = starters.find((each) => each.id === 'quotation')
  if (starter === undefined) throw new Error('no quotation among the starters')
  const outcome = await preview(
    { report: starter.report, starter, mode: 'preview', images: studioImages(images).resolve, creationDate: '2026-10-16T08:00:00Z' },
    new AbortController().signal,
  )
  if (outcome.kind !== 'printed') throw new Error(`the quotation was not printed: ${JSON.stringify(outcome)}`)
  expect((await readPdf(outcome.pdf)).pages.flatMap((page) => page.items.map((item) => item.text)).join(' ')).toContain('Offerte')
  expect(outcome.word).toEqual({ kind: 'failed', message: 'the writer read a property of undefined' })
})
