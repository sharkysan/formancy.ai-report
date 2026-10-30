import { inflateSync } from 'node:zlib'
import { checkSvg, cleanSvg } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import type { Block, ResolvedDocument } from '../document.js'
import { flatten, normalise, plainText, tables } from '../fixture.js'
import { ALL_FIXTURES } from './all.js'
import { decimals } from './decimals.js'
import { fonts } from './fonts.js'
import { BODY_HEIGHT, bodyHeight, BODY_SIZE, CHAR_EM_RANGE, LINE_FACTOR_RANGE, lineHeight, PRINTABLE_WIDTH, ROWS_PER_PAGE_RANGE } from './geometry.js'
import { groupBoundary } from './group-boundary.js'
import { imageInvalid, images } from './images.js'
import { IDENTIFIER, longParagraph, PARAGRAPH_WORDS } from './long-paragraph.js'
import { longTable } from './long-table.js'
import { oversized } from './oversized.js'
import { BOUNDARY, OVERFLOW, summaryFits, summaryOverflows, SWEEP, SWEEP_STEP } from './summary.js'
import { SVG_AS_SAVED, SVG_BOUND, SVG_FIXTURES, SVG_MARK, SVG_WINDOW, svgAsSaved, svgMark, svgWindow } from './svg.js'
import { DESCRIPTION_WORDS, tallRow } from './tall-row.js'

/**
 * The corpus checked against itself, before any engine sees it. A fixture
 * whose expectation its own data cannot meet would fail every engine and
 * teach nothing; one whose boundary arithmetic is wrong would pass every
 * engine without ever reaching the boundary it is named for.
 */

/** The words a document's body prints, in order: paragraph text, table headers and cells, the empty text of a table with no detail rows. */
function bodyWords(blocks: readonly Block[]): string[] {
  return flatten(blocks).flatMap((block) => {
    if (block.kind === 'paragraph') return words(block.runs.map((run) => ('text' in run ? run.text : '1')).join(''))
    if (block.kind !== 'table') return []
    const empty = block.rows.some((row) => row.kind === 'detail') ? [] : [block.emptyText]
    return [...block.header, ...empty, ...block.rows.flatMap((row) => row.cells)].flatMap(words)
  })
}

function words(text: string): string[] {
  const normalised = normalise(text)
  return normalised === '' ? [] : normalised.split(' ')
}

/** A finder for runs of whole words in `haystack`, indexed once by first word: the oversized fixture has 6001 keys. */
function occurrencesIn(haystack: readonly string[]): (sought: string) => number[] {
  const byFirstWord = new Map<string, number[]>()
  haystack.forEach((word, position) => byFirstWord.set(word, [...(byFirstWord.get(word) ?? []), position]))
  return (sought) => {
    const needle = words(sought)
    return (byFirstWord.get(needle[0] ?? '') ?? []).filter((start) => needle.every((word, offset) => haystack[start + offset] === word))
  }
}

/** The lines a document prints that are whole: paragraphs without page fields, table cells and headers. */
function documentLines(document: ResolvedDocument): string[] {
  return flatten([...document.pageHeader, ...document.body, ...document.pageFooter]).flatMap((block) => {
    if (block.kind === 'paragraph') return [plainText(block.runs) ?? '']
    if (block.kind === 'table') return [...block.header, block.emptyText, ...block.rows.flatMap((row) => row.cells)].map(normalise)
    return []
  })
}

/** Section 20's fixtures and the SVG ones: every fixture an engine answers to. */
const EVERY = [...ALL_FIXTURES, ...SVG_FIXTURES]

describe('the corpus', () => {
  // Section 20's list, spelled out once here: a fixture dropped from the
  // corpus would otherwise go unnoticed, and the engine decision would be made
  // without it.
  test('has every fixture section 20 asks for, each once', () => {
    expect(ALL_FIXTURES.map((fixture) => fixture.id)).toEqual([
      'empty-dataset',
      'one-row',
      'long-table',
      'tall-row',
      'long-paragraph',
      'group-boundary',
      'summary-fits',
      'summary-overflows',
      'decimals',
      'null-missing',
      'fonts',
      'host-fonts',
      'images',
      'image-invalid',
      'oversized',
    ])
  })

  // The SVG fixtures stand beside section 20's, which the renderer trial
  // ran on (0005): one dropped would leave an SVG unproved on the PDF.
  test('has the SVG fixtures beside them, each once', () => {
    expect(SVG_FIXTURES.map((fixture) => fixture.id)).toEqual(['svg-mark', 'svg-window', 'svg-as-saved'])
  })

  // A refusal without a code would accept any refusal, and a code on a
  // fixture that must render would be ignored and mislead whoever reads it.
  test('names a refusal exactly where one is allowed, and page bounds inside the page limit', () => {
    for (const fixture of EVERY) {
      const { outcome, refusal, minPagesExpected, maxPagesExpected } = fixture.expect
      expect(refusal === undefined, fixture.id).toBe(outcome === 'render')
      expect(minPagesExpected, fixture.id).toBeGreaterThanOrEqual(1)
      expect(minPagesExpected, fixture.id).toBeLessThanOrEqual(maxPagesExpected)
      expect(maxPagesExpected, fixture.id).toBeLessThanOrEqual(fixture.maxPages)
    }
  })

  // Every key is expected exactly once and in order, so the data must print
  // it exactly once and in order, and never in the page header or footer,
  // which print on every page.
  test('prints each key exactly once in the body, in order, and never in a page header or footer', () => {
    for (const fixture of EVERY) {
      const { document, expect: expected } = fixture
      const inBody = occurrencesIn(bodyWords(document.body))
      const inPageRegions = occurrencesIn(bodyWords([...document.pageHeader, ...document.pageFooter]))
      let previous = -1
      for (const key of expected.keys) {
        const found = inBody(key)
        expect(found, `${fixture.id}: ${key}`).toHaveLength(1)
        expect(found[0]!, `${fixture.id}: ${key} in order`).toBeGreaterThan(previous)
        expect(inPageRegions(key), `${fixture.id}: ${key} in a page region`).toEqual([])
        previous = found[0]!
      }
    }
  })

  // Exact and wrapped text is expected because the document prints it; text
  // the document does not hold would fail every engine.
  test('expects only text its document prints', () => {
    for (const fixture of EVERY) {
      const lines = documentLines(fixture.document)
      for (const text of fixture.expect.exactText) {
        expect(
          lines.some((line) => ` ${line} `.includes(` ${normalise(text)} `)),
          `${fixture.id}: ${text}`,
        ).toBe(true)
      }
      for (const text of fixture.expect.wrappedText) expect(lines, fixture.id).toContain(text)
    }
  })

  // A row with fewer cells than columns is a defect in the fixture that an
  // adapter would have to guess about; a row without a first cell cannot be
  // found on the page, so no check could see it go missing.
  test('gives every table row a cell per column and a first cell to know it by', () => {
    for (const fixture of EVERY) {
      for (const table of tables(fixture.document.body)) {
        expect(table.header, `${fixture.id}: ${table.id}`).toHaveLength(table.columns.length)
        for (const row of table.rows) {
          expect(row.cells, `${fixture.id}: ${row.cells[0]}`).toHaveLength(table.columns.length)
          expect(normalise(row.cells[0] ?? ''), fixture.id).not.toBe('')
        }
      }
    }
  })

  // The footer pattern is derived from the footer the document prints; it
  // must match that footer as printed, numbers in the named groups.
  test('derives a footer pattern that matches the footer as printed', () => {
    for (const fixture of EVERY) {
      const match = fixture.expect.footerEveryPage?.exec('Page 3 of 7')
      expect(match?.groups, fixture.id).toEqual({ pageNumber: '3', pageCount: '7' })
      expect(fixture.expect.footerEveryPage?.test('Page 3 of'), fixture.id).toBe(false)
    }
  })
})

describe('the boundary arithmetic', () => {
  // The header repeat is only tested if the table spans pages, under the
  // densest row any plausible engine draws.
  test('long-table runs to several pages however dense the rows', () => {
    const rows = tables(longTable.document.body)[0]!.rows
    expect(rows.filter((row) => row.kind === 'detail').map((row) => row.cells[0])).toEqual(
      Array.from({ length: 300 }, (_, i) => `ROW-${String(i + 1).padStart(4, '0')}`),
    )
    expect(Math.ceil(rows.length / ROWS_PER_PAGE_RANGE.max)).toBeGreaterThanOrEqual(2)
    expect(longTable.expect.minPagesExpected).toBeGreaterThanOrEqual(2)
  })

  // For every page height an engine might give, an engine that did not keep
  // a group header with its first row would leave one at the foot of a page.
  // Rows a page are counted under the repeated header row, and the table
  // begins at the top of the first page's body.
  test('group-boundary leaves a group header last on a page for every plausible number of rows a page', () => {
    const rows = tables(groupBoundary.document.body)[0]!.rows
    for (let perPage = ROWS_PER_PAGE_RANGE.min; perPage <= ROWS_PER_PAGE_RANGE.max; perPage++) {
      const orphaned = rows.some((row, index) => row.kind === 'groupHeader' && index % perPage === perPage - 1)
      expect(orphaned, `${perPage} rows a page`).toBe(true)
    }
  })

  // Subtotals and the total are computed from the detail amounts, exactly;
  // a fixture whose subtotal were wrong would fail a correct engine.
  test('group-boundary subtotals and total are the exact sums of their rows', () => {
    const cents = (value: string): bigint => BigInt(value.replace('.', ''))
    let group = 0n
    let total = 0n
    for (const row of tables(groupBoundary.document.body)[0]!.rows) {
      if (row.kind === 'groupHeader') group = 0n
      if (row.kind === 'detail') group += cents(row.cells[2]!)
      if (row.kind === 'detail') total += cents(row.cells[2]!)
      if (row.kind === 'groupFooter') expect(cents(row.cells[2]!), row.cells[0]).toBe(group)
      if (row.kind === 'total') expect(cents(row.cells[2]!)).toBe(total)
    }
    expect(groupBoundary.expect.exactText.length).toBeGreaterThan(1)
  })

  // The tall row must be taller than a page even at the narrowest character
  // width and tightest line height an engine might use, or the fixture tests
  // nothing about splitting a row.
  test('tall-row is taller than two pages under any plausible measurement', () => {
    const description = DESCRIPTION_WORDS.join(' ')
    const columnWidth = PRINTABLE_WIDTH - 160
    const lines = Math.ceil((description.length * CHAR_EM_RANGE.min * BODY_SIZE) / columnWidth)
    expect(DESCRIPTION_WORDS).toHaveLength(4000)
    expect(lines * BODY_SIZE * LINE_FACTOR_RANGE.min).toBeGreaterThan(2 * BODY_HEIGHT)
    expect(tallRow.expect.keys).toEqual(['ROW-0001', ...DESCRIPTION_WORDS])
  })

  // The identifier has no space to break at and is wider than the page:
  // an engine must break it somewhere or let it run off the page.
  test('long-paragraph has 2500 words and an identifier wider than the printable area', () => {
    expect(PARAGRAPH_WORDS).toHaveLength(2500)
    expect(IDENTIFIER).toMatch(/^ID-X{297}$/)
    expect(IDENTIFIER.length * CHAR_EM_RANGE.min * BODY_SIZE).toBeGreaterThan(PRINTABLE_WIDTH)
    expect(longParagraph.expect.wrappedText).toEqual([IDENTIFIER])
  })

  // The boundary is where a filler leaves a summary exactly room, and it is
  // wherever an engine's line height and page regions put it. The range is
  // computed from the extremes of the model; checked here against the model
  // by hand: six 9pt lines at 1.3 em in a body that lost two 8pt lines at
  // 1.3 em, and at 1.1 em.
  test('the boundary range runs from the tallest summary in the shortest body to the shortest in the tallest', () => {
    const line = (factor: number): number => 9 * factor
    expect(BOUNDARY.min).toBeCloseTo(bodyHeight(1.3) - 6 * line(1.3), 9)
    expect(BOUNDARY.max).toBeCloseTo(bodyHeight(1.1) - 6 * line(1.1), 9)
    expect(BOUNDARY.min).toBeLessThan(BODY_HEIGHT - 6 * lineHeight(BODY_SIZE))
    expect(BOUNDARY.max).toBeGreaterThan(BODY_HEIGHT - 6 * lineHeight(BODY_SIZE))
  })

  // A sweep that started inside the range could begin past an engine's
  // boundary, and one that ended inside it could stop short of it; steps a
  // line wide could step over a summary that just fits. So it starts below
  // the range, ends above it, and steps by less than a line, one summary per
  // step, each after its own filler.
  test('summary-fits sweeps the whole boundary range in steps of less than a line', () => {
    expect(SWEEP[0]).toBeLessThan(BOUNDARY.min)
    expect(SWEEP.at(-1)).toBeGreaterThan(BOUNDARY.max)
    expect(SWEEP_STEP).toBeLessThan(lineHeight(BODY_SIZE) * LINE_FACTOR_RANGE.min)
    SWEEP.slice(1).forEach((height, index) => expect(height - SWEEP[index]!).toBeCloseTo(SWEEP_STEP, 9))
    const fillers = flatten(summaryFits.document.body)
      .filter((block) => block.kind === 'image')
      .map((block) => block.height)
    expect(fillers).toEqual(SWEEP)
    expect(summaryFits.expect.keptTogether).toHaveLength(SWEEP.length)
    expect(summaryFits.expect.keptTogetherByRoom).toBe(true)
    // Every page of a filler fits it: a filler taller than an engine's body would be refused, not tested.
    expect(Math.max(...SWEEP)).toBeLessThan(bodyHeight(LINE_FACTOR_RANGE.max))
  })

  // The summary that must move misses by more than a line in the engine
  // that leaves it most room, and its filler still fits in the one that
  // leaves least; it lands on page 3 of 3 in every engine.
  test('summary-overflows misses on every plausible engine, after a filler that fits on every one', () => {
    expect(OVERFLOW - BOUNDARY.max).toBeGreaterThan(lineHeight(BODY_SIZE))
    expect(OVERFLOW).toBeLessThan(bodyHeight(LINE_FACTOR_RANGE.max))
    expect(summaryOverflows.expect).toMatchObject({ minPagesExpected: 3, maxPagesExpected: 3 })
  })

  // The page limit must bind: under the densest plausible rows the table
  // still needs more pages than the engine is allowed.
  test('oversized needs more pages than its limit however dense the rows', () => {
    const rows = tables(oversized.document.body)[0]!.rows.length
    expect(Math.ceil(rows / ROWS_PER_PAGE_RANGE.max)).toBeGreaterThan(oversized.maxPages)
    expect(oversized.expect.refusal).toEqual({ code: 'too-many-pages' })
  })
})

describe('the values', () => {
  // The fonts fixture's samples are printed in a regular paragraph, a bold
  // one and a table cell. Expected only as the bare samples, they are found
  // in the regular paragraphs while the bold line prints empty boxes; every
  // paragraph is expected whole instead.
  test('fonts expects every paragraph whole, the bold line of every sample included', () => {
    const paragraphs = flatten(fonts.document.body).flatMap((block) => (block.kind === 'paragraph' ? [plainText(block.runs)] : []))
    expect(fonts.expect.exactText).toEqual(paragraphs)
    expect(fonts.expect.exactText).toContain('äöüÄÖÜß · éèçàœÉ · CHF 1’234.50 · € 12,00 · Zażółć gęślą jaźń')
  })

  // The decimals fixture exists for values JavaScript's Number would change;
  // if none of them changed, it would prove nothing about exactness.
  test('decimals holds values that a Number would not print back the same', () => {
    expect(String(Number('9007199254740993'))).not.toBe('9007199254740993')
    expect(String(Number('99999999999999.9999'))).not.toBe('99999999999999.9999')
    expect(decimals.expect.exactText).toEqual(expect.arrayContaining(['99999999999999.9999', '9007199254740993', '-0.01', '0.00', 'CHF 1’234.50']))
  })

  // The valid image must be valid -- else an engine's refusal of it would be
  // right -- and the invalid one must not be, named so the refusal can be
  // checked against it.
  test('images draws a decodable PNG, and image-invalid has bytes no decoder accepts', () => {
    const [image] = flatten(images.document.body).filter((block) => block.kind === 'image')
    const bytes = image!.asset.bytes
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    expect([...bytes.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47])
    const [width, height] = [view.getUint32(16), view.getUint32(20)]
    const idat = bytes.subarray(41, 41 + view.getUint32(33))
    expect(inflateSync(idat)).toHaveLength(height * (1 + 3 * width))
    expect(images.expect.images).toEqual([{ kind: 'raster', width: 128, height: 64 }])

    const [invalid] = flatten(imageInvalid.document.body).filter((block) => block.kind === 'image')
    expect([...invalid!.asset.bytes.subarray(0, 4)]).not.toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(imageInvalid.expect.refusal).toEqual({ code: 'invalid-asset', subject: invalid!.asset.id })
  })

  // An approved SVG is the drawing cleanSvg writes, and the renderer draws
  // nothing else (0030): a drawing here that cleaning would change would be
  // refused by a correct renderer, and its fixture would teach nothing. Each
  // is what cleaning writes, and cleans to itself with nothing removed.
  test('the SVG drawings are what cleanSvg writes, and the drawing as saved is not', () => {
    for (const bytes of [SVG_MARK, SVG_WINDOW, SVG_BOUND]) {
      const cleaned = cleanSvg(bytes)
      expect(cleaned.ok && { bytes: [...cleaned.bytes], removed: cleaned.removed }).toEqual({ bytes: [...bytes], removed: [] })
      expect(checkSvg(bytes).ok).toBe(true)
    }
    // The drawing as saved is the mark, and not in the form approval writes: refused at print, with nothing the matter with it but that.
    const saved = cleanSvg(SVG_AS_SAVED)
    expect(saved.ok && [...saved.bytes]).toEqual([...SVG_MARK])
    expect(checkSvg(SVG_AS_SAVED)).toMatchObject({ ok: false, code: 'unsupported' })
    expect(svgAsSaved.expect.refusal).toEqual({ code: 'invalid-asset', subject: 'mark-as-saved' })
  })

  // Each drawing is expected as vectors, twice in the body and once in the
  // page header of each of its three pages, and the window is drawn through
  // a clip path, the shape a reader that counted soft masks would see.
  test('the SVG fixtures expect each drawing as vectors in the body and the page header, the window through a clip path', () => {
    for (const fixture of [svgMark, svgWindow]) {
      expect(
        fixture.expect.images.map(({ kind }) => kind),
        fixture.id,
      ).toEqual(['vector', 'vector'])
      expect(
        fixture.expect.pageRegionImages.map(({ kind }) => kind),
        fixture.id,
      ).toEqual(['vector'])
      expect(
        flatten(fixture.document.body).flatMap((block) => (block.kind === 'image' ? [block.fit] : [])),
        fixture.id,
      ).toEqual(['contain', 'cover'])
      expect(fixture.expect, fixture.id).toMatchObject({ minPagesExpected: 3, maxPagesExpected: 3, noEmptyPages: true })
    }
    expect(new TextDecoder().decode(SVG_WINDOW)).toContain('clip-path="url(#c1)"')
  })
})
