import { deflate } from 'pako'
import { expect, test, vi } from 'vitest'
import { heldInlineImages } from './inline-images.js'
import { MAX_DOCUMENT_PAGES } from './limits.js'
import { AT_A_BOUND } from './parse-test-support.js'
import { letter, pagesFile, printedWhole } from './pages-test-support.js'
import { repeated } from './test-pdf.js'

/**
 * A content the pages share is lexed for inline images once, however many
 * resources its pages draw it with. A file of its own: it counts the bytes
 * handed to the lexer, through the module the pages read it with, wrapped.
 */

vi.mock('./inline-images.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./inline-images.js')>()
  return { ...actual, heldInlineImages: vi.fn(actual.heldInlineImages) }
})

// A page's content is charged only its encoded length for each page that
// holds it again, so a Flate content of megabytes that holds "BI" -- in
// strings is enough -- shared by a thousand pages that each write their
// own /Resources was lexed again for each, for a few kilobytes of budget a
// page: gigabytes lexed, minutes, within every bound. Lexed once, its
// colour-space names alone counted again for each page's resources; held
// to the bytes handed to the lexer.
test('a content a thousand pages share, each with its own resources, is lexed once', AT_A_BOUND, () => {
  const text = repeated('(BI) Tj ', 10_000)
  const pages = Array.from({ length: MAX_DOCUMENT_PAGES }, (_, i) => letter('', { resources: `<</Probe ${i}>>` }))
  vi.mocked(heldInlineImages).mockClear()
  printedWhole(pagesFile(pages, { 4: { dict: '/Filter/FlateDecode', data: deflate(text) } }))
  const lexed = vi.mocked(heldInlineImages).mock.calls.reduce((bytes, [, content]) => bytes + content.length, 0)
  expect(lexed).toBe(text.length)
})
