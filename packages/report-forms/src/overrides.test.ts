import { schemaHash } from '@formancy/spec'
import { describe, expect, test } from 'vitest'
import { answers, field, formOf, headerOf, read, readData, readMany, refusals, reportOf, rowsOf } from './test-support.js'

/**
 * Per render, a field is read in each version where the report's binding
 * says that version holds it (0048): at its path, or where a review put
 * it for that version, or not at all. A review's override is for the one
 * version it names, by its hash; every other version reads the binding's
 * own path, and one that moved the field is refused, naming the review
 * that would lift it.
 */

const BEFORE = formOf([
  { key: 'site', type: 'text' },
  { key: 'inspector', type: 'group', fields: [{ key: 'name', type: 'text' }] },
  { key: 'findings', type: 'repeater', fields: [{ key: 'area', type: 'text' }] },
])
/** The next version: the inspector's group renamed the technician's, the findings the defects. */
const AFTER = formOf([
  { key: 'site', type: 'text' },
  { key: 'technician', type: 'group', renamedFrom: 'inspector', fields: [{ key: 'name', type: 'text' }] },
  { key: 'defects', type: 'repeater', renamedFrom: 'findings', fields: [{ key: 'area', type: 'text' }] },
])
/** A version after it that moved the name out of its group, which no review has seen. */
const LATER = formOf([
  { key: 'site', type: 'text' },
  { key: 'name', type: 'text' },
  { key: 'defects', type: 'repeater', fields: [{ key: 'area', type: 'text' }] },
])

const BEFORE_HASH = schemaHash(BEFORE)
const AFTER_HASH = schemaHash(AFTER)
const LATER_HASH = schemaHash(LATER)

describe('a binding overridden for one version', () => {
  // The review of AFTER put the name at the technician's: AFTER's
  // submissions read it there, BEFORE's where they always did.
  test('reads a field where the override says, in that version alone', () => {
    const report = reportOf({
      header: answers(field('site', 'string', 'site'), field('name', 'string', 'inspector.name', { overrides: { [AFTER_HASH]: { path: 'technician.name' } } })),
    })
    expect(headerOf(read(report, AFTER, { site: 'Bern', technician: { name: 'Lea' } }))).toEqual({ site: 'Bern', name: 'Lea' })
    expect(headerOf(read(report, BEFORE, { site: 'Thun', inspector: { name: 'Anna' } }))).toEqual({ site: 'Thun', name: 'Anna' })
  })

  // Nothing printed of a field from a version: its every submission
  // hands the field null, which prints as nothing, and the other versions
  // their answers.
  test('reads nothing of a field from a version the override says prints none of it', () => {
    const report = reportOf({
      header: answers(field('site', 'string', 'site'), field('name', 'string', 'inspector.name', { overrides: { [AFTER_HASH]: { omit: true } } })),
    })
    expect(headerOf(read(report, AFTER, { site: 'Bern', technician: { name: 'Lea' } }))).toEqual({ site: 'Bern', name: null })
    expect(headerOf(read(report, BEFORE, { site: 'Thun', inspector: { name: 'Anna' } }))).toEqual({ site: 'Thun', name: 'Anna' })
    const many = reportOf({
      detail: {
        id: 'visits',
        form: { kind: 'submissions' },
        fields: [field('name', 'string', 'inspector.name', { overrides: { [AFTER_HASH]: { omit: true } } })],
      },
    })
    const listed = readMany(many, {
      forms: [BEFORE, AFTER],
      complete: true,
      submissions: [
        { id: 'b682a5ed-ed01-4f8c-8d80-cf53db4e8380', formHash: BEFORE_HASH, data: { inspector: { name: 'Anna' } } },
        { id: '8861b39c-51df-4cc0-b71e-63a6d3f16b1b', formHash: AFTER_HASH, data: { technician: { name: 'Lea' } } },
      ],
    })
    expect(readData(listed).detail).toEqual([{ name: 'Anna' }, { name: null }])
  })

  // The detail's rows are read from the repeater the override names in
  // that version, each row's fields at their own paths in them.
  test("reads the detail's rows from the repeater the override names, in that version alone", () => {
    const report = reportOf({
      header: answers(field('site', 'string', 'site')),
      detail: {
        ...rowsOf('findings', field('area', 'string', 'area')),
        form: { kind: 'repeater', repeater: 'findings', overrides: { [AFTER_HASH]: { repeater: 'defects' } } },
      },
    })
    expect(readData(read(report, AFTER, { site: 'Bern', defects: [{ _id: 'r1', area: 'Keller' }] })).detail).toEqual([{ area: 'Keller' }])
    expect(readData(read(report, BEFORE, { site: 'Thun', findings: [{ _id: 'r1', area: 'Dach' }] })).detail).toEqual([{ area: 'Dach' }])
  })

  // An override is a review of one version. A later version that moved
  // the field again is refused, as any version that moved it is, never
  // read where an earlier review put it: and the refusal says what would
  // lift it, a review of that version.
  test('follows no override of another version, and its refusal names the review that lifts it', () => {
    const report = reportOf({
      header: answers(field('site', 'string', 'site'), field('name', 'string', 'inspector.name', { overrides: { [AFTER_HASH]: { path: 'technician.name' } } })),
      detail: {
        ...rowsOf('findings', field('area', 'string', 'area')),
        form: { kind: 'repeater', repeater: 'findings', overrides: { [AFTER_HASH]: { repeater: 'defects' } } },
      },
    })
    const outcome = read(report, LATER, { site: 'Bern', name: 'Lea' })
    expect(refusals(outcome)).toEqual(['version-lacks-field /datasets/header/fields/1/form', 'version-lacks-field /datasets/detail/form/repeater'])
    for (const error of outcome.ok ? [] : outcome.errors) {
      expect(error.message).toContain(LATER_HASH)
      expect(error.message).toContain('reviewFormVersion')
    }
    const retyped = read(reportOf({ header: answers(field('site', 'boolean', 'site')) }), BEFORE, { site: 'Bern' })
    expect(retyped.ok ? '' : retyped.errors[0]?.message).toContain('reviewFormVersion')
  })

  // A row's field is read in the rows the version's own override names:
  // its refusal names those rows, where a refusal naming the binding's
  // repeater would send its reader to rows the version does not hold.
  test('names the rows an override reads where a field of them is refused', () => {
    const report = reportOf({
      header: answers(field('site', 'string', 'site')),
      detail: {
        ...rowsOf('findings', field('area', 'string', 'zone')),
        form: { kind: 'repeater', repeater: 'findings', overrides: { [AFTER_HASH]: { repeater: 'defects' } } },
      },
    })
    const outcome = read(report, AFTER, { site: 'Bern', defects: [{ _id: 'r1', area: 'Keller' }] })
    expect(refusals(outcome)).toEqual(['version-lacks-field /datasets/detail/fields/0/form'])
    expect(outcome.ok ? '' : outcome.errors[0]?.message).toContain('in the rows of "defects"')
  })
})
