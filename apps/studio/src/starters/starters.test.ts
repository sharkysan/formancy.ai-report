import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { resolveReport } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { encodeStarters, decodeStarters } from './codec.js'
import { BLANK, starterLabel, studioStarters } from './starters.js'

const decoded = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))

describe("the Studio's starters", () => {
  // The picker offers the corpus's starters in the corpus's order, then a
  // blank report. A list written out here would keep offering a starter the
  // corpus dropped, or never offer one it added; the names are derived from
  // the ids for the same reason.
  test('are the corpus’s, in its order, and a blank report last', () => {
    const listed = studioStarters(decoded.starters)
    expect(listed.map((starter) => starter.id)).toEqual([...STARTERS.map((starter) => starter.id), 'blank'])
    expect(listed.map(starterLabel)).toEqual(['Service inspection', 'Quotation', 'Grouped equipment', 'Invoice', 'Euro invoice', 'E-invoice', 'Site visit', 'Blank'])
  })

  // A blank report with no datasets still previews: an empty A4 page, not a
  // refusal for data it never asked for, which would greet the person who
  // picked Blank with an error.
  test('include a blank report that resolves against its data', () => {
    const resolved = resolveReport(BLANK.report, BLANK.data, { mode: 'final', parameters: BLANK.parameters, creationDate: '2026-10-16T08:00:00Z' })
    expect(resolved.ok).toBe(true)
  })
})
