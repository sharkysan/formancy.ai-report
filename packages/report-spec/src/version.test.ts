import { describe, expect, test } from 'vitest'
import { checkSpecVersion, REPORT_FORMAT, REPORT_SPEC_VERSION } from './version.js'

describe('the report format', () => {
  // The identity a canonical hash will be taken over, so that a report and a
  // form with the same JSON body can never share a hash. An empty or
  // form-like name would make that envelope say nothing.
  test('is named, and its version is a string of digits, as formancy writes specVersion', () => {
    expect(REPORT_FORMAT).toBe('formancy-report')
    expect(REPORT_SPEC_VERSION).toMatch(/^\d+$/)
  })
})

describe('checkSpecVersion', () => {
  // The version this package reads is read. Everything else below is a
  // refusal, so a check that refused everything would pass them all.
  test('reads a document of the version this package reads', () => {
    expect(checkSpecVersion({ reportSpecVersion: REPORT_SPEC_VERSION })).toEqual({ ok: true })
  })

  // A formancy form is the document most likely to be handed to a report by
  // mistake: Data generates them, and the Studio will open them as starting
  // points. Read as a report it would render as an empty one; it is refused
  // as what it is, naming its own version so the author sees which document
  // was meant.
  test('refuses a formancy form as not a report, and says it is a form', () => {
    const outcome = checkSpecVersion({ specVersion: '3', id: 'order', title: 'Order', model: { fields: [] } })
    expect(outcome).toMatchObject({ ok: false, code: 'not-a-report' })
    expect(outcome.ok ? '' : outcome.message).toMatch(/formancy form \(specVersion "3"\)/)
  })

  // Nothing without the field is guessed to be a report: not an empty object,
  // not an array, not null, not a version written as a number, which JSON
  // round-trips would not keep apart from a string elsewhere.
  test('refuses anything without a reportSpecVersion string', () => {
    for (const value of [{}, [], null, undefined, 'formancy-report', 0, { reportSpecVersion: 0 }]) {
      expect(checkSpecVersion(value), JSON.stringify(value)).toMatchObject({ ok: false, code: 'not-a-report' })
    }
  })

  // A document from a later format is refused rather than partly rendered:
  // a field this version does not know could be the one that hides a row or
  // changes a total. The message names both versions.
  test('refuses a version it does not read, naming it and the one it reads', () => {
    const outcome = checkSpecVersion({ reportSpecVersion: '99' })
    expect(outcome).toEqual({
      ok: false,
      code: 'unsupported-version',
      message: `reportSpecVersion "99" is not one this package reads; it reads "${REPORT_SPEC_VERSION}"`,
    })
  })
})
