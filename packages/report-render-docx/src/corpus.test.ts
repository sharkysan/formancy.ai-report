import {
  ALL_FIXTURES,
  CHART_FIXTURES,
  FIRST_PAGE_FIXTURES,
  KEEP_WITH_FIXTURES,
  SHIFTED_FIXTURES,
  SVG_FIXTURES,
  verifyDocx,
  wordRefusal,
  type Fixture,
} from '@formancy/report-corpus'
import { describe, expect, test } from 'vitest'
import { refusalOf, written } from './testing/support.js'

/**
 * The writer on the corpus (0068, extending 0003): every fixture the PDF
 * renderer answers to, written and proved on the file the writer
 * produced, read back by the corpus's reader and held by the corpus's
 * check -- or refused as the corpus derives from the document. Never on
 * the nodes the writer built.
 */

/** Section 20's fixtures, the SVG ones, the kept rows' one, page 1's own header's, the chart ones and those of runs set below or above the line. */
const CORPUS: readonly Fixture[] = [...ALL_FIXTURES, ...SVG_FIXTURES, ...KEEP_WITH_FIXTURES, ...FIRST_PAGE_FIXTURES, ...CHART_FIXTURES, ...SHIFTED_FIXTURES]

/**
 * The fixtures the PDF renderer refuses for what it measured, which the
 * writer writes, since it measures nothing: Word may print what the PDF
 * refuses (0068). Each by its id and why, so that a fixture refused for
 * something a Word file must refuse too is not written by being listed
 * here unread.
 */
const WRITTEN_THOUGH_THE_PDF_REFUSES: ReadonlyMap<string, string> = new Map([
  ['oversized', 'more pages than its host allows: the writer counts no page'],
  ['shifted-alone', "a word of nothing but runs off the line, which pdfmake could print on a line of its own: where a line breaks is Word's"],
  ['shifted-after-space', 'a raised mark after a space, a word of its own to pdfmake'],
  ['shifted-before-space', 'a raised mark before a space, a word of its own to pdfmake'],
  ['shifted-empty-before', 'a lowered digit whose only neighbour prints nothing'],
  ['shifted-empty-after', 'a raised digit whose only neighbour in its word prints nothing'],
  ['shifted-too-wide', 'a word wider than its column, by the widths the PDF measured'],
])

describe.each(CORPUS.map((fixture) => [fixture.id, fixture] as const))('%s', (_id, fixture) => {
  const { document, expect: expected } = fixture
  const owed = wordRefusal(document)
  // A fixture whose bytes are no picture is refused by any engine, by the fixture's own refusal.
  const asset = expected.outcome === 'refuse' && expected.refusal?.code === 'invalid-asset' ? expected.refusal : undefined
  const refusal = owed ?? asset

  if (refusal !== undefined) {
    // A file written of it would be the report with its chart, its code or its picture left out, and nothing saying so.
    test(`is refused as ${refusal.code}, naming ${String(refusal.subject)}`, () => {
      expect(refusalOf(document)).toMatchObject(refusal)
    })
    return
  }

  // A fixture the PDF refuses and no rule here refuses must be one this suite names: a new one is read before it is written.
  test('is one the writer is known to write', () => {
    expect(expected.outcome !== 'refuse' || WRITTEN_THOUGH_THE_PDF_REFUSES.has(fixture.id)).toBe(true)
  })

  // Every word, cell, mark, picture and length the document states, on the file itself.
  test('is written as the file its document says', () => {
    expect(verifyDocx(fixture, written(document))).toEqual([])
  })
})

// The list above names fixtures: one that left the corpus would stay listed, and say the writer writes something it never saw.
test('every fixture named as written though the PDF refuses it is in the corpus, and refused there', () => {
  for (const id of WRITTEN_THOUGH_THE_PDF_REFUSES.keys()) expect(CORPUS.find((fixture) => fixture.id === id)?.expect.outcome).toBe('refuse')
})
