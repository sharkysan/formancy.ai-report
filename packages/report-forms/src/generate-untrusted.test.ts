import { MAX_DETAIL_ROWS } from '@formancy/report-runtime'
import { MAX_DATASET_FIELDS } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { MAX_FORMS_ERRORS } from './errors.js'
import { MAX_DOCUMENT_DEPTH } from './json.js'
import { formOf, generate, generatedFrom, generationRefusals, notesOf } from './test-support.js'

/**
 * A form is untrusted, even from the host's own store (CLAUDE.md, 0045):
 * the generator reads it as the bridge reads one, once and through its
 * descriptors, walks it by its model, takes time linear in it, refuses
 * what the format cannot hold rather than cut it short, and says no label
 * of it in a message. formancy bounds neither how many fields a form
 * holds, nor how deep its groups nest, nor how long a message of its
 * catalogue is; the bridge reads a list of at most `MAX_DETAIL_ROWS`
 * items and a document nested at most `MAX_DOCUMENT_DEPTH` deep (0042).
 *
 * Measured on 22 October 2026 from the built package on an Intel
 * i9-10900K under Node 24.21.0, runs two to six of six, twice, other
 * workflows loading it to between 3 % and all of it: the largest case
 * below, a form of 100,000 fields, took 2.3 to 5.2 seconds a run, most of
 * it formancy's validateSchema, which alone took 2.0 seconds on the same
 * form earlier that day; a grid of 100,000 columns out of order 0.89 to
 * 3.1 seconds, where ordered by formancy's datagridColumns it had taken
 * 40.7; 10,000 repeaters 0.13 to 0.22 seconds (0045 states the same).
 * `BOUND` is chosen well above them, so a runner several times slower
 * passes and a walk that went quadratic in the fields -- 10^10 steps --
 * fails.
 */
const BOUND = 30_000

/** How long `run` took, in milliseconds, and what it returned. */
function timed<T>(run: () => T): { readonly value: T; readonly ms: number } {
  const start = performance.now()
  const value = run()
  return { value, ms: performance.now() - start }
}

describe('an untrusted form', () => {
  // The most fields a list the bridge reads holds: generated, the draft
  // would declare more than a dataset holds, so it is refused, once, in
  // time linear in the form, and never cut to its first fields.
  test('of the most fields the bridge reads is refused, never cut short, in time linear in it', () => {
    const fields = Array.from({ length: MAX_DETAIL_ROWS }, (_, index) => ({ key: `f${index}`, type: 'text', label: `Field ${index}` }))
    const { value, ms } = timed(() => generate(formOf(fields), { id: 'r', locale: 'en' }))
    expect(generationRefusals(value)).toEqual(['too-many-fields /form/model/fields'])
    expect(ms).toBeLessThan(BOUND)
  }, 120_000)

  // A grid whose columns name its fields in another order than they stand
  // in: formancy's own datagridColumns finds each column's field by a scan,
  // which over the most fields the bridge reads took 40.7 seconds, past
  // `BOUND`, on the machine named above. Ordered in time linear in the
  // grid, it is refused as wider than a page, once, and never cut to its
  // first columns.
  test('of a grid of the most columns the bridge reads, each naming its field out of order, is refused in time linear in it', () => {
    const fields = Array.from({ length: MAX_DETAIL_ROWS }, (_, index) => ({ key: `c${index}`, type: 'text', label: 'Cell' }))
    const columns = fields.map((field) => ({ field: field.key })).reverse()
    const grid = formOf([{ key: 'rows', type: 'repeater', widget: 'datagrid', columns, fields }])
    const { value, ms } = timed(() => generate(grid, { id: 'r', locale: 'en', detail: { kind: 'repeater', repeater: 'rows' } }))
    expect(generationRefusals(value)).toEqual(['too-many-columns /form/model/fields/0/fields'])
    expect(ms).toBeLessThan(BOUND)
  }, 120_000)

  // Many repeaters, each left out but the one the table reads: a walk
  // that dropped one unsaid, or listed them out of order, would hide which
  // rows the draft does not print. Each is listed, in model order, and the
  // draft is the one field and the table.
  test('of many repeaters lists each it leaves out, in time linear in them', () => {
    const repeaters = Array.from({ length: 10_000 }, (_, index) => ({
      key: `r${index}`,
      type: 'repeater',
      label: 'Rows',
      fields: [{ key: `c${index}`, type: 'text', label: 'Cell' }],
    }))
    const { value, ms } = timed(() =>
      generate(formOf([{ key: 'site', type: 'text', label: 'Site' }, ...repeaters]), {
        id: 'r',
        locale: 'en',
        detail: { kind: 'repeater', repeater: 'r9999' },
      }),
    )
    const { report, notes } = generatedFrom(value)
    expect([report.datasets.header?.fields.length, report.datasets.detail?.fields.map((field) => field.id)]).toEqual([1, ['c9999']])
    expect(notesOf(notes)).toEqual(Array.from({ length: 9_999 }, (_, index) => `repeater-excluded /form/model/fields/${index + 1}`))
    expect(ms).toBeLessThan(BOUND)
  }, 120_000)

  // Groups nested past what the bridge reads are no data, refused where
  // the copy stops, before a stack is spent on them; nested as deep as it
  // reads, the field at the bottom has no path a binding names, refused.
  test('of groups nested past any path is refused, past what the bridge reads before it is walked', () => {
    const nested = (levels: number): unknown[] => {
      let fields: unknown[] = [{ key: 'leaf', type: 'text' }]
      for (let level = levels; level >= 1; level -= 1) fields = [{ key: `g${level}`, type: 'group', fields }]
      return fields
    }
    expect(generationRefusals(generate(formOf(nested(MAX_DOCUMENT_DEPTH)), { id: 'r', locale: 'en' })).map((refusal) => refusal.split(' ')[0])).toEqual([
      'not-data',
    ])
    const deepest = Math.floor((MAX_DOCUMENT_DEPTH - 4) / 2)
    expect(generationRefusals(generate(formOf(nested(deepest)), { id: 'r', locale: 'en' })).map((refusal) => refusal.split(' ')[0])).toEqual(['path-too-long'])
  })

  // A message of a catalogue is unbounded in formancy: a megabyte of
  // label is refused as longer than the format holds, by the field's
  // place, and no message repeats a word of it.
  test('of a label of a megabyte is refused by the field’s place, never repeated', () => {
    const label = 'Erika Mustermann '.repeat(64_000)
    const outcome = generate(
      formOf([{ key: 'name', type: 'text', label: { $t: 'name' } }], { i18n: { defaultLocale: 'en', messages: { en: { name: label } } } }),
      { id: 'r', locale: 'en' },
    )
    expect(generationRefusals(outcome)).toEqual(['label-too-long /form/model/fields/0'])
    if (!outcome.ok) expect(JSON.stringify(outcome.errors)).not.toContain('Erika')
    expect(JSON.stringify(outcome).length).toBeLessThan(1_000)
  })

  // A getter in a form could answer the validator one thing and the
  // generator another: refused where it stands, and never run.
  test('with a getter is refused where it stands, and the getter never runs', () => {
    let calls = 0
    const field = Object.defineProperty({ key: 'site', type: 'text' }, 'label', {
      enumerable: true,
      get: () => {
        calls += 1
        return 'Site'
      },
    })
    expect(generationRefusals(generate(formOf([field]), { id: 'r', locale: 'en' }))).toEqual(['not-data /form/model/fields/0/label'])
    let options = 0
    const asked = Object.defineProperty({ locale: 'en' }, 'id', {
      enumerable: true,
      get: () => {
        options += 1
        return 'r'
      },
    })
    expect(generationRefusals(generate(formOf([{ key: 'site', type: 'text' }]), asked))).toEqual(['not-data /options/id'])
    expect([calls, options]).toEqual([0, 0])
  })

  // A list of errors that grew with the form would grow a log line with
  // it. Bounded as a read's are, and a list cut short says so: a form of
  // many fields each labelled with a character no font draws lists the
  // first MAX_FORMS_ERRORS of them, then that there were more.
  test('lists at most MAX_FORMS_ERRORS errors, and says when there were more', () => {
    const fields = Array.from({ length: MAX_FORMS_ERRORS + MAX_DATASET_FIELDS }, (_, index) => ({ key: `f${index}`, type: 'text', label: 'Bell \u0007' }))
    const found = generationRefusals(generate(formOf(fields), { id: 'r', locale: 'en' }))
    expect(found).toHaveLength(MAX_FORMS_ERRORS + 1)
    expect([found[0], found.at(-1)]).toEqual(['label-unprintable /form/model/fields/0', 'too-many-errors '])
  })
})
