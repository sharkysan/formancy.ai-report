import { validateSchema } from '@formancy/spec/validate'
import { describe, expect, test } from 'vitest'
import { reportHash } from './hash.js'
import { MAX_FORM_MEMBER_LENGTH, MAX_FORM_PATH_KEYS } from './limits.js'
import { isFormPath } from './syntax.js'
import { edited, getAt, readFromForm, refusals, removeAt, setAt } from './test-support.js'
import { validateReport } from './validate.js'

/** The fixture read from a form's submission (0042), then edited. */
function fromForm(edit: (report: Record<string, unknown>) => void = () => undefined): Record<string, unknown> {
  return edited((report) => {
    readFromForm(report)
    edit(report)
  })
}

describe('a dataset read from a formancy form', () => {
  // A report reads one submission: its answers in the header, one
  // repeater's rows in the detail, each field at its data path in its
  // scope -- a group's child by the group's key, a matrix row or a ticked
  // option by its member, a choice by its label or its stored value. Were
  // any of it refused, the bridge would have nowhere to read from.
  test('the header reads a submission and the detail a repeater, each field at its path', () => {
    const report = fromForm((r) => {
      setAt(r, '/datasets/detail/form', { kind: 'repeater', repeater: 'visit.lines' })
      setAt(r, '/datasets/header/fields/0/form', { path: 'customer.name' })
      setAt(r, '/datasets/header/fields/2/form', { path: 'currency', read: 'value' })
      setAt(r, '/datasets/detail/fields/0/form', { path: 'rating', member: 'site' })
      setAt(r, '/datasets/detail/fields/5/form', { path: 'checks', member: 'shipped' })
    })
    expect(refusals(report)).toEqual([])
    const outcome = validateReport(report)
    if (!outcome.valid) throw new Error('refused')
    expect(outcome.report.datasets.detail?.form).toEqual({ kind: 'repeater', repeater: 'visit.lines' })
    expect(outcome.report.datasets.header?.fields[2]?.form).toEqual({ path: 'currency', read: 'value' })
    expect(outcome.report.datasets.detail?.fields[0]?.form).toEqual({ path: 'rating', member: 'site' })
  })

  // A report of many submissions prints one a row and has no one record
  // to head it. Its header, read from a submission, would be which one?
  test('the detail may read one row per submission, beside no header', () => {
    const many = fromForm((r) => {
      setAt(r, '/datasets/detail/form', { kind: 'submissions' })
      removeAt(r, '/datasets/header')
    })
    expect(refusals(many).filter((error) => /^(?:invalid|incomplete|misplaced)-form/.test(error))).toEqual([])
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/form', { kind: 'submissions' })))).toEqual(['misplaced-form-binding /datasets/header'])
  })

  // The header is one record and the detail rows; a kind of the other's
  // reads what the dataset is not. A kind the format does not know is
  // refused, never read as one it does.
  test('each dataset reads what it is: the header one submission, the detail rows', () => {
    expect(refusals(fromForm((r) => setAt(r, '/datasets/header/form', { kind: 'submissions' })))).toEqual(['misplaced-form-binding /datasets/header/form/kind'])
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/form', { kind: 'submission' })))).toEqual(['misplaced-form-binding /datasets/detail/form/kind'])
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/form', { kind: 'table', repeater: 'lines' })))).toEqual(['unknown-kind /datasets/detail/form/kind'])
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/form', { kind: 'repeater' })))).toEqual(['missing-property /datasets/detail/form/repeater'])
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/form', { kind: 'submissions', repeater: 'lines' })))).toEqual(['unknown-property /datasets/detail/form/repeater', 'misplaced-form-binding /datasets/header'])
    expect(refusals(fromForm((r) => setAt(r, '/datasets/header/form', { kind: 'submission', form: 'site-visit' })))).toEqual(['unknown-property /datasets/header/form/form'])
  })

  // Read from a form, a dataset is read whole: a field that says nowhere
  // it is read is missing from every render, which a final render
  // refuses. A field that says where in a dataset read from no form says
  // something nothing reads; and one dataset read from a form beside one
  // that is not leaves the second with no one to hand it over, since a
  // submission is read into the whole envelope at once.
  test('a dataset is read from a form whole, and both datasets or neither', () => {
    expect(refusals(fromForm((r) => removeAt(r, '/datasets/header/fields/1/form')))).toEqual(['incomplete-form-binding /datasets/header/fields/1'])
    expect(refusals(edited((r) => setAt(r, '/datasets/header/fields/1/form', { path: 'orderedOn' })))).toEqual(['incomplete-form-binding /datasets/header/fields/1/form'])
    const half = fromForm((r) => {
      removeAt(r, '/datasets/header/form')
      for (const index of [0, 1, 2, 3]) removeAt(r, `/datasets/header/fields/${index}/form`)
    })
    expect(refusals(half)).toEqual(['incomplete-form-binding /datasets/header'])
  })

  // A path is field keys joined by dots, as formancy's modelDataPaths
  // writes one in a scope: a repeater's `[]`, an empty key, a key with a
  // hyphen or a space is no path formancy writes, and finds no answer in
  // any version. Bounded, so no path grows with the document; the longest,
  // MAX_FORM_PATH_KEYS keys of formancy's longest, 64 characters, is one a
  // form can hold, and a guard on the length that is tighter than its keys
  // would refuse it.
  test('a path, and a repeater, is field keys joined by dots, at most MAX_FORM_PATH_KEYS of them', () => {
    const keys = (count: number) => Array.from({ length: count }, (_, index) => `k${index}`).join('.')
    const longest = Array.from({ length: MAX_FORM_PATH_KEYS }, (_, index) => `${String.fromCharCode(97 + index)}${'b'.repeat(63)}`).join('.')
    for (const path of ['site', 'visit.site', '_a.B_2', keys(MAX_FORM_PATH_KEYS), `a${'b'.repeat(63)}`, longest, 'constructor', 'toString.valueOf']) {
      expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/fields/0/form/path', path))), path).toEqual([])
      expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/form/repeater', path))), path).toEqual([])
      expect(isFormPath(path), path).toBe(true)
    }
    for (const path of ['', 'lines[].site', 'visit.', '.site', 'visit..site', 'site-visit', 'site visit', '2nd', keys(MAX_FORM_PATH_KEYS + 1), `a${'b'.repeat(64)}`, 'visité']) {
      expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/fields/0/form/path', path))), path).toEqual(['invalid-form-path /datasets/detail/fields/0/form/path'])
      expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/form/repeater', path))), path).toEqual(['invalid-form-path /datasets/detail/form/repeater'])
      expect(isFormPath(path), path).toBe(false)
    }
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/fields/0/form/path', 7)))).toEqual(['wrong-type /datasets/detail/fields/0/form/path'])
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/fields/0/form', { member: 'site' })))).toEqual(['missing-property /datasets/detail/fields/0/form/path'])
    expect(isFormPath(['site'])).toBe(false)
  })

  // A member is a matrix row's or an option's value, which formancy
  // writes from 1 to 200 characters, any of them: an empty one names no
  // row, and a longer one none formancy could have written. The bound is
  // formancy's, held to the validator the repository pins: were formancy's
  // to grow, a report could not name a row a form holds.
  test('a member is a value formancy could have written: 1 to MAX_FORM_MEMBER_LENGTH characters', () => {
    const matrix = (value: string) => ({ specVersion: '4', id: 'f', title: 'F', model: { fields: [{ key: 'm', type: 'matrix', rows: [{ value, label: 'R' }], options: [{ value, label: 'A' }, { value: 'b', label: 'B' }] }] } })
    expect(validateSchema(matrix('m'.repeat(MAX_FORM_MEMBER_LENGTH))).valid).toBe(true)
    const longer = validateSchema(matrix('m'.repeat(MAX_FORM_MEMBER_LENGTH + 1)))
    expect(longer.valid ? [] : longer.errors.map((error) => error.path).sort()).toEqual(['/model/fields/0/options/0/value', '/model/fields/0/rows/0/value'])
    for (const member of ['x', 'follow-up', 'Zürich, Bahnhofstrasse 1', 'm'.repeat(MAX_FORM_MEMBER_LENGTH), '__proto__']) {
      expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/fields/0/form/member', member))), member).toEqual([])
    }
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/fields/0/form/member', '')))).toEqual(['invalid-form-path /datasets/detail/fields/0/form/member'])
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/fields/0/form/member', 'm'.repeat(MAX_FORM_MEMBER_LENGTH + 1))))).toEqual(['too-long /datasets/detail/fields/0/form/member'])
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/fields/0/form/member', 3)))).toEqual(['wrong-type /datasets/detail/fields/0/form/member'])
  })

  // A choice prints its label or its stored value, both of them text: a
  // field of another type that says how a choice prints is a choice read
  // into a number, a date or a yes-or-no, which none of them can hold.
  test('only a string field says how a choice prints', () => {
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/fields/1/form/read', 'value')))).toEqual([])
    for (const index of [2, 3, 5, 6, 7, 8, 9]) {
      const type = getAt(fromForm(), `/datasets/detail/fields/${index}/type`)
      expect(refusals(fromForm((r) => setAt(r, `/datasets/detail/fields/${index}/form/read`, 'value'))), String(type)).toEqual([`binding-type-mismatch /datasets/detail/fields/${index}/form/read`])
    }
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/fields/1/form/read', 'code')))).toEqual(['not-one-of /datasets/detail/fields/1/form/read'])
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/fields/1/form/sum', true)))).toEqual(['unknown-property /datasets/detail/fields/1/form/sum'])
  })

  // The label is what a choice prints when the binding says nothing. Were
  // it also spelled `read: 'label'`, one binding would have two spellings
  // and two hashes, and a template saved each way would read as two
  // reviews of the same reading (syntax.ts: one value, one hash).
  test('refuses the label spelled out, which is the binding that leaves it out', () => {
    expect(refusals(fromForm((r) => setAt(r, '/datasets/detail/fields/1/form/read', 'label')))).toEqual(['not-one-of /datasets/detail/fields/1/form/read'])
  })

  // The hash says which reading of a form a report was reviewed against:
  // the binding is the report's, so a change to it is a new version of
  // the template, never the same hash.
  test('the binding is part of what the report hashes', () => {
    const hashOf = (report: unknown) => {
      const outcome = validateReport(report)
      if (!outcome.valid) throw new Error('refused')
      return reportHash(outcome.report)
    }
    const read = hashOf(fromForm())
    expect(read).not.toBe(hashOf(edited(() => undefined)))
    expect(read).not.toBe(hashOf(fromForm((r) => setAt(r, '/datasets/detail/fields/0/form/path', 'visit.site'))))
  })
})
