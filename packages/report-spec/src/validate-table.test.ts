import { describe, expect, test } from 'vitest'
import type { ReportDefinition } from './definition.js'
import { reportHash } from './hash.js'
import { MAX_KEEP_WITH_ROWS } from './limits.js'
import { editable, getAt, refusals, removeAt, richReport, setAt } from './test-support.js'
import { validateReport } from './validate.js'

/** The fixture's table over the detail dataset, and its one group. */
const TABLE = '/regions/body/2'
const GROUP = `${TABLE}/group`

/** The fixture with its group's kept rows set to `count`, or removed where it is undefined. */
function keeping(count: unknown): Record<string, unknown> {
  const report = editable(richReport())
  if (count === undefined) removeAt(report, `${GROUP}/keepWithRows`)
  else setAt(report, `${GROUP}/keepWithRows`, count)
  return report
}

/** The report the validator read from `document`, which must be valid. */
function read(document: unknown): ReportDefinition {
  const outcome = validateReport(document)
  if (!outcome.valid) throw new Error(`the document was refused: ${outcome.errors.map(({ code, path }) => `${code} ${path}`).join(', ')}`)
  return outcome.report
}

describe("a table group's kept rows", () => {
  // The validator's copy is what a session commits and what is hashed. A
  // count it read and left out of its copy would be dropped by the first
  // edit, and a published template would be named by the hash of a report
  // that keeps one row where its author stated more (0059).
  test('is read back whole, and is part of what the hash names', () => {
    expect(getAt(read(keeping(3)), `${GROUP}/keepWithRows`)).toBe(3)
    expect(Object.hasOwn(getAt(read(keeping(undefined)), GROUP) as object, 'keepWithRows')).toBe(false)
    expect(reportHash(read(keeping(3)))).not.toBe(reportHash(read(keeping(undefined))))
    expect(reportHash(read(keeping(3)))).not.toBe(reportHash(read(keeping(4))))
  })

  // One written out is kept as written, never normalised to the member's
  // absence: the validator does not rewrite what a report says, so the two
  // spellings of the rule every header has print alike and hash apart,
  // which is the cost 0059 states and why the builders write the absence.
  test('keeps one as written, hashed apart from the absence it prints as', () => {
    expect(getAt(read(keeping(1)), `${GROUP}/keepWithRows`)).toBe(1)
    expect(reportHash(read(keeping(1)))).not.toBe(reportHash(read(keeping(undefined))))
  })

  // Absent is the one row every group header has been kept with; 1 is that
  // rule written out, accepted as a flag's default is; the bound itself is
  // a count a report may state. Refusing any of them would refuse a report
  // that prints.
  test.each([
    ['absent', undefined],
    ['one', 1],
    ['two', 2],
    ['the bound', MAX_KEEP_WITH_ROWS],
  ])('accepts %s', (_name, count) => {
    expect(refusals(keeping(count))).toEqual([])
  })

  // A count of none would keep a header with nothing under it, which is
  // the page end the member exists to prevent; past the bound is a count
  // nobody means, and what the renderer adds up for each header grows with
  // it. A fraction of a row, a negative count, a string or a null is no
  // count, and a validator that read one as a number, or a null as the
  // member's absence, would print a report its author did not write. Not
  // a number and infinity are no JSON, and are refused as such before any
  // rule of the count reads them.
  test.each([
    ['none', 0, 'out-of-range'],
    ['a negative count', -1, 'out-of-range'],
    ['one past the bound', MAX_KEEP_WITH_ROWS + 1, 'out-of-range'],
    ['a fraction', 2.5, 'not-an-integer'],
    ['a string', '3', 'wrong-type'],
    ['null', null, 'wrong-type'],
    ['not a number', Number.NaN, 'not-json'],
    ['infinity', Number.POSITIVE_INFINITY, 'not-json'],
  ])('refuses %s', (_name, count, code) => {
    expect(refusals(keeping(count))).toEqual([`${code} ${GROUP}/keepWithRows`])
  })

  // The count is the group's, so that each level of a later nesting states
  // its own. On the table it is a member the table does not have, and a
  // validator that took it there would print a table that keeps nothing
  // its author stated.
  test('is refused on the table, which is not the group', () => {
    const report = editable(richReport())
    removeAt(report, `${GROUP}/keepWithRows`)
    setAt(report, `${TABLE}/keepWithRows`, 3)
    expect(refusals(report)).toEqual([`unknown-property ${TABLE}/keepWithRows`])
  })

  // A count beside a group that cannot be read is not read back on its own
  // into a group: the group is refused for what it lacks, and the count is
  // still held to its rule, so an author sees both at once.
  test('is held to its rule beside a group that is refused for something else', () => {
    const report = keeping(0)
    removeAt(report, `${GROUP}/direction`)
    expect(refusals(report)).toEqual([`missing-property ${GROUP}/direction`, `out-of-range ${GROUP}/keepWithRows`])
  })
})
