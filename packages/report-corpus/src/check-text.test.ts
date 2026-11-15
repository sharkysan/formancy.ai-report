import { describe, expect, test } from 'vitest'
import type { Page } from './check-page.js'
import { fontNames, shiftedRuns } from './check-text.js'
import type { ExpectedFontName } from './fixture.js'
import { pageLines } from './lines.js'
import type { PdfTextItem } from './read-pdf.js'

/**
 * Each run held to the face it prints in (0043): the fontNames check reads
 * the PostScript name the PDF gives each run, after the subset prefix, and
 * holds every item that bears a marker to the face the fixture names. A run
 * in the wrong face -- serif text drawn in Roboto, or in the mono face --
 * extracts as the same text, so only this check catches it.
 */

/** A text item drawn in `font`, bearing `text`; the box is nothing this check reads. */
function item(text: string, font: string): PdfTextItem {
  return { text, font, x: 0, top: 0, bottom: 10, width: 10, height: 10, angle: 0 }
}

/** A page of these items, as the checks read one; the fontNames check reads only the items. */
function page(...items: PdfTextItem[]): Page {
  return { page: { number: 1, width: 595, height: 842, items, images: [], paths: [], clips: [] }, lines: [], header: [], footer: [], body: [], drawings: [] }
}

const expected: readonly ExpectedFontName[] = [
  { text: 'SERIFREG', postScriptName: 'LiberationSerif' },
  { text: 'MONOREG', postScriptName: 'LiberationMono' },
]

describe('fontNames', () => {
  // A run bearing each marker, drawn in the expected face with the subset
  // prefix every embedded font carries: nothing is wrong.
  test('passes when each marker is drawn in its face', () => {
    const pages = [page(item('SERIFREG Zürich', 'BZZZZZ+LiberationSerif'), item('MONOREG Zürich', 'CZZZZZ+LiberationMono'))]
    expect(fontNames(pages, expected)).toEqual([])
  })

  // A serif run drawn in another face reads the same text; the check names
  // the marker, the face it found and the one expected.
  test('fails when a run prints in the wrong face', () => {
    const pages = [page(item('SERIFREG Zürich', 'AAAAAA+Roboto'), item('MONOREG Zürich', 'CZZZZZ+LiberationMono'))]
    const problems = fontNames(pages, expected)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('SERIFREG')
    expect(problems[0]).toContain('Roboto')
    expect(problems[0]).toContain('LiberationSerif')
  })

  // A marker split across items drawn in two faces is caught: every item
  // bearing the marker must be the one face.
  test('fails when a marker is drawn in more than one face', () => {
    const pages = [page(item('SERIFREG a', 'BZZZZZ+LiberationSerif'), item('SERIFREG b', 'AAAAAA+Roboto'), item('MONOREG', 'CZZZZZ+LiberationMono'))]
    expect(fontNames(pages, expected)).toHaveLength(1)
  })

  // A marker nothing bears is a run that did not print: the fixture names a
  // face for text that is not there.
  test('fails when a marker is on no run', () => {
    const pages = [page(item('MONOREG Zürich', 'CZZZZZ+LiberationMono'))]
    const problems = fontNames(pages, expected)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('SERIFREG')
  })
})

/**
 * Each run set below or above the line held on the PDF (0061): read into
 * its line by the line reader, at `SHIFTED_SIZE` of its paragraph's size,
 * its baseline moved by `SHIFTED_RISE`. A run printed on the line, at
 * another size or moved otherwise is not read so, and a run read so that
 * the document does not set is drawn as something it is not.
 */
describe('shiftedRuns', () => {
  /** A run of `size` at `baseline` and `x`, as the reader reports it. */
  const at = (text: string, x: number, baseline: number, size: number, width: number): PdfTextItem => ({
    text,
    font: 'Roboto-Regular',
    x,
    top: baseline + 0.2 * size - size,
    bottom: baseline + 0.2 * size,
    width,
    height: size,
    angle: 0,
  })
  /** A page of these runs, its lines read as the checks read them. */
  const read = (number: number, ...items: PdfTextItem[]): Page => {
    const pdfPage = { number, width: 595, height: 842, items, images: [], paths: [], clips: [] }
    const lines = pageLines(pdfPage)
    return { page: pdfPage, lines, header: [], footer: [], body: lines, drawings: [] }
  }
  /** "H2O" at 10 points, its digit drawn as `digit`. */
  const formula = (digit: PdfTextItem, number = 1): Page => read(number, at('H', 50, 100, 10, 7.13), digit, at('O', 60.39, 100, 10, 6.88))
  const lowered = at('2', 57.13, 102.03, 5.8, 3.26)
  const expected = { shiftedRuns: [{ text: '2', shift: 'subscript', size: 10 }], pageRegionShiftedRuns: [] } as const

  // The digit drawn as the document sets it: nothing is wrong.
  test('passes a run read at its size and moved as the document sets it', () => {
    expect(shiftedRuns([formula(lowered)], expected)).toEqual([])
  })

  // Drawn on the line, the digit reads as "H2O" too, and only its size and
  // place say it was not set below the line; drawn at another size or moved
  // otherwise, it is no run the document set.
  test.each([
    ['drawn on the line', at('2', 57.13, 100, 10, 5.62)],
    ['at another size', at('2', 57.13, 102.03, 6.5, 3.65)],
    ['moved otherwise', at('2', 57.13, 103.5, 5.8, 3.26)],
    ['set above the line instead', at('2', 57.13, 95.65, 5.8, 3.26)],
  ])('fails a run expected below the line that is %s', (_name, digit) => {
    const problems = shiftedRuns([formula(digit)], expected)
    expect(problems.some((problem) => problem.includes("'2'") && problem.includes('below the line'))).toBe(true)
  })

  // A run drawn below the line that the document prints on it is text
  // printed as something it is not; and a report with no such run, every
  // fixture before 0061 among them, holds that the reader read none so.
  test('fails a run read below the line that the document does not set', () => {
    const problems = shiftedRuns([formula(lowered)], { shiftedRuns: [], pageRegionShiftedRuns: [] })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain("'2'")
    expect(problems[0]).toContain('does not set')
  })

  // A page region's run is printed on every page, and expected on each: a
  // page that dropped it, or printed it on the line, fails on that page.
  test("holds a page region's run on every page", () => {
    const regions = { shiftedRuns: [], pageRegionShiftedRuns: [{ text: '2', shift: 'subscript' }] } as const
    expect(shiftedRuns([formula(lowered, 1), formula(lowered, 2)], regions)).toEqual([])
    const problems = shiftedRuns([formula(lowered, 1), formula(at('2', 57.13, 100, 10, 5.62), 2)], regions)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('page 2')
  })
})
