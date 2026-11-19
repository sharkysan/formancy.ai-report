import { epcSymbol, qrSymbol, type Block, type QrSymbol } from '@formancy/report-runtime'
import { beforeEach, expect, test, vi } from 'vitest'
import { MAX_DOCX_CODES } from './limits.js'
import { renderDocx } from './render.js'
import { documentOf, refusalOf } from './testing/support.js'

/**
 * How often the writer asks for a code's symbol (0074): once, where it
 * checks the document, and never for a code past its bound. The rule
 * that decides a symbol is the runtime's, and encodes it; asked for once
 * to be checked and again to be drawn, a code would be two decisions
 * that could disagree, and asked for past the bound, a document of ten
 * thousand codes would be encoded ten thousand times to be refused.
 *
 * In a suite of its own, since it stands in the runtime's place to
 * count: every call is passed on to the runtime's own rule, and every
 * symbol written was decided by it.
 */

vi.mock('@formancy/report-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@formancy/report-runtime')>()
  return { ...actual, qrSymbol: vi.fn(actual.qrSymbol), epcSymbol: vi.fn(actual.epcSymbol) }
})
beforeEach(() => {
  vi.mocked(qrSymbol).mockClear()
  vi.mocked(epcSymbol).mockClear()
})

const qr = (index: number): Block => ({ kind: 'qrCode', id: `code-${index}`, text: `CODE-${index}`, size: 40, errorCorrection: 'M' })

// What is refused and what is written are one symbol: the one the check was handed is the one the picture is made of.
test('asks for each code’s symbol once, a framed EPC QR code’s among them, and writes that symbol', () => {
  const framed: Block = { kind: 'epcQrCode', id: 'pay', payload: 'BCD\n002', size: 85.04, caption: 'zahlenMitCode' }
  renderDocx(documentOf([qr(1), framed], { pageFooter: [qr(2)] }))
  expect(qrSymbol).toHaveBeenCalledTimes(2)
  expect(epcSymbol).toHaveBeenCalledTimes(1)
  // Where it stands so wide: the printable area of the page, 495.28 points.
  expect(vi.mocked(epcSymbol).mock.calls[0]).toEqual([framed, expect.closeTo(495.28, 2)])
  expect((vi.mocked(qrSymbol).mock.results[0]!.value as QrSymbol).modules).toHaveLength(21)
})

// The bounds are there for what a code costs: one past the count is refused before anything of it is worked out, and none is encoded
// after the one whose symbol took the file's modules past theirs. Seventeen of the largest symbol are encoded to cross that bound,
// which took the case 1.9 seconds here under coverage beside another build on 19 November 2026, where CI's runner took a case of this
// suite's neighbour half as long again: under the five a case has where it states no more, and too near them to state none.
test('asks for no symbol of a code past the count, and for none after the code that crossed the modules’ bound', { timeout: 60_000 }, () => {
  const codes = Array.from({ length: MAX_DOCX_CODES + 20 }, (_, index) => qr(index))
  expect(refusalOf(documentOf(codes))).toMatchObject({ code: 'content-too-large', subject: `code-${MAX_DOCX_CODES}` })
  expect(qrSymbol).toHaveBeenCalledTimes(MAX_DOCX_CODES)
  vi.mocked(qrSymbol).mockClear()
  const large = Array.from({ length: 30 }, (_, index): Block => ({
    kind: 'qrCode',
    id: `large-${index}`,
    text: 'x'.repeat(1273),
    size: 210,
    errorCorrection: 'H',
  }))
  expect(refusalOf(documentOf(large))).toMatchObject({ code: 'content-too-large', subject: 'large-16' })
  expect(qrSymbol).toHaveBeenCalledTimes(17)
})
