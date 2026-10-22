import { describe, expect, test } from 'vitest'
import type { Page } from './check-page.js'
import { fontNames } from './check-text.js'
import type { ExpectedFontName } from './fixture.js'
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
