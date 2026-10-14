import { describe, expect, test } from 'vitest'
import { emptyReport } from './empty.js'
import { mmToPt } from './units.js'
import { validateReport } from './validate.js'

describe('emptyReport', () => {
  // The Studio's "blank report" and every test that needs a report start
  // here. If it were not valid, the first edit would be made on a document
  // the validator refuses.
  test('is a valid report', () => {
    const report = emptyReport('blank', 'Blank', 'de-CH')
    expect(validateReport(report)).toEqual({ valid: true, report })
  })

  // A4 portrait with 20 mm margins and nothing in it: the shape the author
  // starts from, and the provenance that says it was started blank.
  test('is an A4 portrait page with 20 mm margins and empty regions', () => {
    const margin = mmToPt(20)
    expect(emptyReport('blank', 'Blank', 'en')).toEqual({
      reportSpecVersion: '0',
      id: 'blank',
      title: 'Blank',
      locale: 'en',
      page: { size: 'A4', orientation: 'portrait', margins: { top: margin, right: margin, bottom: margin, left: margin } },
      styles: [],
      datasets: {},
      parameters: [],
      assets: [],
      aggregates: [],
      regions: { reportHeader: [], pageHeader: [], body: [], pageFooter: [], summary: [] },
      provenance: { kind: 'blank' },
    })
  })

  // Handed an id or a locale the format refuses, it says so rather than
  // returning a report every later step would refuse.
  test('refuses an id or a locale the format would refuse, naming it', () => {
    expect(() => emptyReport('Blank Report', 'Blank', 'en')).toThrow(/\/id/)
    expect(() => emptyReport('blank', 'Blank', 'english')).toThrow(/\/locale/)
  })
})
