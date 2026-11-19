import {
  ALL_FIXTURES,
  CHART_FIXTURES,
  CODE_FIXTURES,
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
 * the nodes the writer built. A code is held on its picture's own pixels
 * and on what ZXing reads in them (0074), which is why the check is
 * waited for. A chart is held on its part, Word's own chart as the file
 * states it (0076).
 */

/** Section 20's fixtures, the SVG ones, the kept rows' one, page 1's own header's, the chart ones, those of runs set below or above the line and the code ones (0074). */
const CORPUS: readonly Fixture[] = [
  ...ALL_FIXTURES,
  ...SVG_FIXTURES,
  ...KEEP_WITH_FIXTURES,
  ...FIRST_PAGE_FIXTURES,
  ...CHART_FIXTURES,
  ...SHIFTED_FIXTURES,
  ...CODE_FIXTURES,
]

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
  // A chart is Word's own (0076): what fits its box is Word's to lay out, and the PDF's refusals of what ECharts laid out are not the writer's.
  ['chart-labels-too-wide', "category labels wider than their slots, by the widths the PDF measured: Word lays a chart's labels out itself"],
  ['chart-bars-too-thin', "bars under the least width the PDF draws: how wide a bar is in its box is Word's"],
  ['chart-bars-too-thin-labelled', "the same bars, each labelled: where a label stands is Word's"],
  ['chart-too-short', "a plot too short for two tick labels, by the PDF's layout: Word lays the axis out itself"],
])

/**
 * The fixtures both engines refuse for the same thing, which no rule of
 * `wordRefusal` derives: what any engine refuses of a chart's words is
 * the fixture's own to state (0076). Each by its id and why.
 */
const REFUSED_AS_THE_PDF_REFUSES: ReadonlyMap<string, string> = new Map([
  ['chart-unprintable-label', 'a category in a script no report prints, in a chart as in a paragraph'],
])

/**
 * How long one fixture may take to be written, read back and verified.
 * The oversized job, 6,000 rows, took 2.7 seconds alone and 5.2 to 6.2
 * under coverage, which is how CI's test job runs this suite and is past
 * vitest's own 5 seconds: measured on 18 November 2026 on an Intel Core
 * i9-10900K shared with other work, under Node 24.21.0. No CI runner was
 * timed; this is ten times what was measured here, so that a slower one
 * does not fail a file that is right.
 */
const WRITTEN_WITHIN = 60_000

describe.each(CORPUS.map((fixture) => [fixture.id, fixture] as const))('%s', (_id, fixture) => {
  const { document, expect: expected } = fixture
  const owed = wordRefusal(document)
  // A fixture whose bytes are no picture is refused by any engine, by the fixture's own refusal.
  const asset = expected.outcome === 'refuse' && expected.refusal?.code === 'invalid-asset' ? expected.refusal : undefined
  const refusal = owed ?? asset ?? (REFUSED_AS_THE_PDF_REFUSES.has(fixture.id) ? expected.refusal : undefined)

  if (refusal !== undefined) {
    // A file written of it would be the report with its chart or its picture left out, and nothing saying so.
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
  test(
    'is written as the file its document says',
    async () => {
      expect(await verifyDocx(fixture, written(document))).toEqual([])
    },
    WRITTEN_WITHIN,
  )
})

// A suite that wrote no code would hold none: every code fixture is written, each with a code in its file.
test('writes every code fixture of the corpus, and none is refused', () => {
  expect(CODE_FIXTURES.length).toBeGreaterThan(5)
  for (const fixture of CODE_FIXTURES) expect(wordRefusal(fixture.document), fixture.id).toBeUndefined()
})

// A suite that wrote no chart would hold none: every chart fixture but the one both engines refuse is written, and none is refused as a chart.
test('writes every chart fixture of the corpus but the one no engine prints', () => {
  expect(CHART_FIXTURES.length).toBeGreaterThan(10)
  for (const fixture of CHART_FIXTURES) expect(wordRefusal(fixture.document), fixture.id).toBeUndefined()
  expect(CHART_FIXTURES.filter((fixture) => REFUSED_AS_THE_PDF_REFUSES.has(fixture.id)).map((fixture) => fixture.id)).toEqual(['chart-unprintable-label'])
})

// The list above names fixtures: one that left the corpus would stay listed, and say the writer writes something it never saw.
test('every fixture named as written though the PDF refuses it is in the corpus, and refused there', () => {
  for (const id of WRITTEN_THOUGH_THE_PDF_REFUSES.keys()) expect(CORPUS.find((fixture) => fixture.id === id)?.expect.outcome).toBe('refuse')
})
