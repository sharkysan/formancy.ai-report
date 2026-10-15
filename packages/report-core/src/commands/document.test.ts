import { describe, expect, test } from 'vitest'
import { accepted, frozenSample, sampleReport } from '../test-support.js'
import { replaceDocument, setLocale, setPage, setTitle } from './document.js'

describe('setTitle and setLocale', () => {
  // The title is what the toolbar and the PDF's metadata show; a command
  // that wrote to the frozen input would throw here instead of returning.
  test('change only the property they name, on a new report', () => {
    const report = frozenSample()
    const titled = accepted(setTitle(report, 'Orders'))
    expect(titled).not.toBe(report)
    expect(titled).toEqual({ ...sampleReport(), title: 'Orders' })
    expect(accepted(setLocale(report, 'en-GB'))).toEqual({ ...sampleReport(), locale: 'en-GB' })
  })

  // What did not change is the same object, so a builder that memoises a
  // region's rendering by identity does not redraw it for a title edit.
  test('share everything they did not change', () => {
    const report = frozenSample()
    const titled = accepted(setTitle(report, 'Orders'))
    expect(titled.regions).toBe(report.regions)
    expect(titled.page).toBe(report.page)
  })
})

describe('setPage', () => {
  // A margin typed into one field must not reset the other three, nor the
  // page size, which is what replacing the whole page object would do.
  test('patches the size, the orientation and single margins', () => {
    const report = frozenSample()
    const page = accepted(setPage(report, { orientation: 'landscape', margins: { left: 30 } })).page
    expect(page).toEqual({ size: 'A4', orientation: 'landscape', margins: { ...sampleReport().page.margins, left: 30 } })
    expect(accepted(setPage(report, { size: 'Letter' })).page).toEqual({ ...sampleReport().page, size: 'Letter' })
  })

  // An empty patch is no change, and must not build a page that differs.
  test('leaves the page as it was when the patch names nothing', () => {
    const report = frozenSample()
    expect(accepted(setPage(report, {})).page).toEqual(report.page)
  })
})

describe('replaceDocument', () => {
  // A pasted or AI-written document goes through the same path as any
  // edit; the command itself takes it whole, and the session validates it.
  test('gives the next document as the result', () => {
    const next = { ...sampleReport(), title: 'Replaced' }
    expect(accepted(replaceDocument(frozenSample(), next))).toBe(next)
  })
})
