import { chartProblems } from './check-charts.js'
import { emptyPages, footers, images, keptByRoom, keptTogether, outsidePrintable, overlaps, pageCount, pageSizes, regions } from './check-layout.js'
import { capped, pagesOf } from './check-page.js'
import { headers, orphans, readTables, rowProblems } from './check-tables.js'
import { exactText, fontNames, glyphs, keys, shiftedRuns, wrappedText } from './check-text.js'
import { RenderRefusal } from './document.js'
import { placeDrawings } from './drawings.js'
import type { Fixture } from './fixture.js'
import type { ReadPdf } from './read-pdf.js'

/**
 * Whether a rendered PDF shows what its fixture expects, proved on the text
 * and boxes PDF.js reads back from it. Each problem names the fixture, and the
 * page and the text it is about; none means the PDF passes.
 *
 * The checks are grouped by what they read: the words and lines
 * (`check-text.ts`), the tables row by row (`check-tables.ts`), where
 * things are on the page (`check-layout.ts`, which also says what positions
 * computed from text cannot see), and where each SVG image is drawn
 * (`drawings.ts`). What a drawing shows past its box is the pixels' to say,
 * and `verifyInk` (`check-ink.ts`) reads them.
 */
export function verify(fixture: Fixture, pdf: ReadPdf): string[] {
  const expected = fixture.expect
  if (expected.outcome === 'refuse') {
    return [`${fixture.id}: expected a refusal (${expected.refusal?.code ?? 'of any kind'}), but a PDF was produced`]
  }
  heldTogether(fixture)
  const drawings = placeDrawings(pdf, expected)
  const pages = pagesOf(pdf, expected, drawings)
  const tables = readTables(pages, expected.tables)
  const { page: setup } = fixture.document
  const problems = [
    ...pageCount(pages, expected),
    ...capped(pageSizes(pages, setup)),
    ...keys(pages, expected.keys),
    ...capped(exactText(pages, expected.exactText)),
    ...capped(wrappedText(pages, expected.wrappedText)),
    ...capped(glyphs(pages)),
    ...capped(fontNames(pages, expected.fontNames)),
    ...shiftedRuns(pages, expected),
    ...capped(rowProblems(tables)),
    ...capped(expected.keptTogether.flatMap((group) => keptTogether(pages, group))),
    ...(expected.keptTogetherByRoom ? keptByRoom(pages, expected.keptTogether) : []),
    ...capped(expected.onOnePage.flatMap((group) => keptTogether(pages, group, 'on one page'))),
    ...capped(regions(pages, expected)),
    ...capped(expected.footerEveryPage === undefined ? [] : footers(pages, expected.footerEveryPage)),
    ...capped(expected.noEmptyPages ? emptyPages(pages) : []),
    ...capped(headers(pages, tables, expected.tables)),
    ...capped(expected.noOrphanedHeaders ? orphans(pages, tables, expected.tables) : []),
    ...capped(expected.allTextInsidePrintable ? outsidePrintable(pages, setup) : []),
    ...capped(expected.noOverlaps ? overlaps(pages, expected.charts) : []),
    ...(expected.fontsEmbedded ? pdf.fonts.filter((font) => !font.embedded).map((font) => `the font ${font.name} is not embedded`) : []),
    ...capped(images(pages, expected)),
    ...capped([...drawings.problems]),
    ...capped(chartProblems(pdf, pages, expected.charts)),
  ]
  return problems.map((problem) => `${fixture.id}: ${problem}`)
}

/**
 * The charts `fixture`'s expectation seeks as drawings, by id, are the
 * charts it proves that draw something, in order, or the expectation is
 * the fixture's mistake, thrown before a page is read: both are derived
 * together (`drawingsOf`, `chartsOf`), and two that disagree would seek a
 * chart nothing proves, or prove one nothing sought, and nobody would
 * find out (N3).
 */
function heldTogether({ id, expect }: Fixture): void {
  const listed = (ids: readonly string[]): string => (ids.length === 0 ? 'none' : ids.join(', '))
  const sought = expect.drawings.flatMap((drawing) => (drawing.kind === 'chart' ? [drawing.id] : []))
  const proved = expect.charts.flatMap((chart) => (chart.empty ? [] : [chart.id]))
  if (sought.length !== proved.length || sought.some((each, index) => each !== proved[index]))
    throw new Error(
      `the expectation of ${id} seeks the charts ${listed(sought)} and proves the charts ${listed(proved)} that draw something: the two are derived together, in document order (\`drawingsOf\`, \`chartsOf\`)`,
    )
}

/**
 * Whether `error`, what an engine rejected with instead of producing a PDF,
 * is the refusal the fixture expects: a `RenderRefusal` with its code, naming
 * its subject when the fixture names one. Anything else -- a crash, another
 * refusal, a refusal where a PDF was expected -- is a problem.
 */
export function verifyRefusal(fixture: Fixture, error: unknown): string[] {
  const { outcome, refusal } = fixture.expect
  const problem = ((): string | undefined => {
    if (outcome === 'render') {
      return error instanceof RenderRefusal
        ? `refused with ${error.code} (${error.message}); expected a PDF`
        : `failed with ${described(error)}; expected a PDF`
    }
    if (refusal === undefined) return 'the fixture allows a refusal but names no refusal code'
    if (!(error instanceof RenderRefusal)) return `failed with ${described(error)}; expected the refusal ${refusal.code}`
    if (error.code !== refusal.code) return `refused with ${error.code}; expected ${refusal.code}`
    if (refusal.subject !== undefined && error.subject !== refusal.subject) {
      return `the refusal names ${error.subject === undefined ? 'nothing' : `'${error.subject}'`}; expected '${refusal.subject}'`
    }
    return undefined
  })()
  return problem === undefined ? [] : [`${fixture.id}: ${problem}`]
}

function described(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}
