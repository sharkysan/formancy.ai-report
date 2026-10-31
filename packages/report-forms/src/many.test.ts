import { SITE_VISIT_SUBMISSION_V1, SITE_VISIT_SUBMISSION_V2, SITE_VISIT_V1, SITE_VISIT_V2 } from '@formancy/report-corpus'
import { MAX_DETAIL_ROWS, resolveReport } from '@formancy/report-runtime'
import { schemaHash } from '@formancy/spec'
import { describe, expect, test } from 'vitest'
import { field, formOf, perSubmission, readData, readMany, refusals, reportOf, SUBMISSION } from './test-support.js'

/** A report of many visits, one a row: the site, the outcome by its label, and the day. */
const VISITS = reportOf({
  detail: perSubmission(
    field('site', 'string', 'site'),
    field('outcome', 'string', 'outcome'),
    field('visitedOn', 'date', 'visitedOn'),
    field('inspector', 'string', 'inspector.name'),
  ),
})
const V1 = schemaHash(SITE_VISIT_V1)
const V2 = schemaHash(SITE_VISIT_V2)
/** The visits, each paired with the hash of the version that collected it. */
const SUBMISSIONS = [
  { ...SITE_VISIT_SUBMISSION_V1, formHash: V1 },
  { ...SITE_VISIT_SUBMISSION_V2, formHash: V2 },
]

describe('readSubmissions', () => {
  // A report of many submissions prints one a row, each read against the
  // version that collected it. Read against one version for all, a list
  // that spans a relabelling would print one version's labels on every
  // row, and a manifest naming one hash would say every submission was
  // collected by it (0041).
  test('reads one row per submission, each against the version that collected it', () => {
    const data = readData(readMany(VISITS, { forms: [SITE_VISIT_V1, SITE_VISIT_V2], submissions: SUBMISSIONS, complete: true }))
    expect(data.detail).toEqual([
      { site: 'Hauptstrasse 12, 3011 Bern', outcome: 'Reparaturen nötig', visitedOn: '2026-10-15', inspector: 'Anna Schär' },
      { site: 'Bahnhofplatz 1, 3011 Bern', outcome: 'Nicht bestanden', visitedOn: '2026-10-21', inspector: 'Marc Rüegg' },
    ])
    expect([data.completeness, data.consistency]).toEqual([{ complete: true, captured: 2 }, 'host-captured'])
    expect(data.source).toEqual({
      provider: 'formancy-form',
      submissions: [
        { id: SITE_VISIT_SUBMISSION_V1.id, form: 'site-visit', formHash: V1 },
        { id: SITE_VISIT_SUBMISSION_V2.id, form: 'site-visit', formHash: V2 },
      ],
    })
    const resolution = resolveReport(VISITS, data, { mode: 'final', creationDate: '2026-10-22T08:00:00Z' })
    expect(resolution.ok ? resolution.manifest.source : resolution.errors).toEqual(data.source)
  })

  // Each version's labels are its own. Read with the first version handed
  // over, or the last, a list of one submission of each of two versions
  // that relabelled a choice would print one version's label for both.
  test('prints each submission’s labels from its own version', () => {
    const version = (failed: string) =>
      formOf([
        { key: 'site', type: 'text' },
        {
          key: 'outcome',
          type: 'radio',
          options: [
            { value: 'fail', label: failed },
            { value: 'pass', label: 'Passed' },
          ],
        },
      ])
    const [first, second] = [version('Failed'), version('Not passed')]
    const outcomes = reportOf({ detail: perSubmission(field('site', 'string', 'site'), field('outcome', 'string', 'outcome')) })
    const submissions = [
      { id: SUBMISSION, formHash: schemaHash(first), data: { site: 'A', outcome: 'fail' } },
      { id: 'c0ffee00-0000-4000-8000-000000000002', formHash: schemaHash(second), data: { site: 'B', outcome: 'fail' } },
    ]
    expect(readData(readMany(outcomes, { forms: [second, first], submissions, complete: true })).detail).toEqual([
      { site: 'A', outcome: 'Failed' },
      { site: 'B', outcome: 'Not passed' },
    ])
  })

  // A version may rename the form: formancy calls it lossy, not breaking,
  // and the fields a report reads are where they were, so it prints. Named
  // by one form id for all, the manifest would say a submission came from
  // a form id its version never had (0041).
  test('names each submission by its own version’s form id, where a version renamed the form', () => {
    const renamed = { ...SITE_VISIT_V2, id: 'site-visit-2026' }
    const data = readData(
      readMany(VISITS, {
        forms: [SITE_VISIT_V1, renamed],
        submissions: [SUBMISSIONS[0]!, { ...SITE_VISIT_SUBMISSION_V2, formHash: schemaHash(renamed) }],
        complete: true,
      }),
    )
    expect((data.source as { submissions: readonly { form: string }[] }).submissions.map((submission) => submission.form)).toEqual([
      'site-visit',
      'site-visit-2026',
    ])
  })

  // Whether the list is every submission is the host's to say, as any
  // host's completeness is. Called complete by the bridge, a list the host
  // knows to be partial would print as the whole period in a final render.
  test('says the list is incomplete where the host does, which a final render refuses', () => {
    const data = readData(readMany(VISITS, { forms: [SITE_VISIT_V1, SITE_VISIT_V2], submissions: SUBMISSIONS, complete: false }))
    expect(data.completeness).toEqual({ complete: false, captured: 2 })
    const resolved = resolveReport(VISITS, data, { mode: 'final', creationDate: '2026-10-22T08:00:00Z' })
    expect(resolved.ok ? 'resolved' : resolved.errors.map((error) => error.code)).toEqual(['incomplete'])
  })

  // A submission is paired with its version by the version's hash, which
  // formancy's server stores beside each version: one naming a version no
  // form handed over hashes to has no version to be read against, and one
  // named twice would print twice.
  test('refuses a submission paired with no version handed over, and one named twice', () => {
    expect(refusals(readMany(VISITS, { forms: [SITE_VISIT_V1], submissions: SUBMISSIONS, complete: true }))).toEqual(['hash-mismatch /submissions/1/formHash'])
    expect(refusals(readMany(VISITS, { forms: [SITE_VISIT_V1], submissions: [{ ...SUBMISSIONS[0]!, formHash: 'Erika Mustermann' }], complete: true }))).toEqual(
      ['hash-mismatch /submissions/0/formHash'],
    )
    expect(
      refusals(
        readMany(VISITS, {
          forms: [SITE_VISIT_V1, SITE_VISIT_V2],
          submissions: [SUBMISSIONS[0]!, { ...SUBMISSIONS[1]!, id: SITE_VISIT_SUBMISSION_V1.id }],
          complete: true,
        }),
      ),
    ).toEqual(['invalid-submission /submissions/1/id'])
  })

  // Per render and per version: a field a version lacks is refused once
  // for that version, naming the field and its hash, whichever submission
  // met it first. Said for every submission, one version's refusal would
  // fill the error list; said once for all versions, a second version that
  // lacks it too would go unnamed.
  test('refuses a field one version lacks, once, naming that version', () => {
    const renamed = {
      ...SITE_VISIT_V2,
      model: {
        fields: (SITE_VISIT_V2['model'] as { fields: { key: string }[] }).fields.map((each) => (each.key === 'site' ? { ...each, key: 'address' } : each)),
      },
    }
    const hash = schemaHash(renamed)
    const outcome = readMany(VISITS, {
      forms: [SITE_VISIT_V1, renamed],
      submissions: [
        SUBMISSIONS[0]!,
        { ...SITE_VISIT_SUBMISSION_V2, formHash: hash, data: { visitedOn: '2026-10-21' } },
        { id: 'c0ffee00-0000-4000-8000-000000000003', formHash: hash, data: {} },
      ],
      complete: true,
    })
    expect(refusals(outcome)).toEqual(['version-lacks-field /datasets/detail/fields/0/form'])
    if (!outcome.ok) expect(outcome.errors[0]?.message).toContain(hash)
    // Two versions that each lack it are two refusals, each naming its own version.
    const other = { ...renamed, title: 'Site visit, 2027' }
    const both = readMany(VISITS, {
      forms: [renamed, other],
      submissions: [
        { id: SUBMISSION, formHash: hash, data: {} },
        { id: 'c0ffee00-0000-4000-8000-000000000004', formHash: schemaHash(other), data: {} },
      ],
      complete: true,
    })
    expect(refusals(both)).toEqual(['version-lacks-field /datasets/detail/fields/0/form', 'version-lacks-field /datasets/detail/fields/0/form'])
    if (!both.ok) expect(both.errors.map((error) => [hash, schemaHash(other)].findIndex((each) => error.message.includes(each)))).toEqual([0, 1])
  })

  // Every version handed over is read as one, and every submission as one,
  // where it stands. A form formancy refuses, read anyway, would print by
  // rules formancy never accepted; one that is no data could answer the
  // validator one thing and the reader another.
  test('refuses a form that is no version, and a submission of another shape, where each stands', () => {
    const twice = {
      ...SITE_VISIT_V1,
      model: {
        fields: [
          { key: 'site', type: 'text' },
          { key: 'site', type: 'text' },
        ],
      },
    }
    expect(refusals(readMany(VISITS, { forms: [SITE_VISIT_V1, twice], submissions: SUBMISSIONS.slice(0, 1), complete: true }))).toEqual([
      'invalid-form /forms/1/model/fields/1/key',
    ])
    expect(
      refusals(
        readMany(VISITS, {
          forms: [SITE_VISIT_V1, Object.defineProperty({}, 'id', { get: () => 'x', enumerable: true })],
          submissions: SUBMISSIONS.slice(0, 1),
          complete: true,
        }),
      ),
    ).toEqual(['not-data /forms/1/id'])
    expect(refusals(readMany(VISITS, { forms: [SITE_VISIT_V1], submissions: [{ ...SUBMISSIONS[0]!, data: [] }], complete: true }))).toEqual([
      'invalid-answer /submissions/0/data',
    ])
    expect(refusals(readMany(VISITS, { forms: [SITE_VISIT_V1], submissions: [{ ...SUBMISSIONS[0]!, version: 1 }, 'visit'] as never, complete: true }))).toEqual(
      ['invalid-input /submissions/0/version', 'invalid-input /submissions/1'],
    )
  })

  // A report of one submission read as many would print its header from
  // nothing; and a list past the most a render reads would be read whole
  // before the runtime refused it, so it is refused before a submission
  // is read.
  test('refuses a report of one submission, input of another shape, and more submissions than a render reads', () => {
    const one = reportOf({ header: { id: 'visit', form: { kind: 'submission' }, fields: [field('site', 'string', 'site')] } })
    expect(refusals(readMany(one, { forms: [SITE_VISIT_V1], submissions: SUBMISSIONS.slice(0, 1), complete: true }))).toEqual([
      'unbound-report /datasets/detail',
    ])
    expect(refusals(readMany(VISITS, { forms: [SITE_VISIT_V1], submissions: SUBMISSIONS.slice(0, 1), complete: 'yes' }))).toEqual(['invalid-input /complete'])
    expect(refusals(readMany(VISITS, { forms: SITE_VISIT_V1, submissions: SUBMISSIONS, complete: true }))).toEqual(['invalid-input /forms'])
    let read = 0
    const many = new Proxy([] as unknown[], {
      getOwnPropertyDescriptor: (target, key) => {
        if (key === 'length') return { value: MAX_DETAIL_ROWS + 1, writable: true, enumerable: false, configurable: false }
        read += 1
        return Reflect.getOwnPropertyDescriptor(target, key)
      },
    })
    expect(refusals(readMany(VISITS, { forms: [SITE_VISIT_V1], submissions: many as never, complete: true }))).toEqual(['too-many-rows /submissions'])
    expect(read).toBe(0)
  })

  // A source names at least one submission (0041), so data of none would
  // be refused by the runtime at a path the host never wrote. The bridge
  // says so itself, where the host handed the list over.
  test('refuses a list of no submissions, where the host handed it over', () => {
    const outcome = readMany(VISITS, { forms: [SITE_VISIT_V1], submissions: [], complete: true })
    expect(refusals(outcome)).toEqual(['invalid-input /submissions'])
  })

  // A submission is read as a list item JSON could hold, where it stands:
  // a hole would be read as a submission that is missing, and a getter in
  // its place run to find out what it is.
  test('refuses a hole or a getter in the submissions where it stands, and never runs the getter', () => {
    // eslint-disable-next-line no-sparse-arrays -- a hole in the array is the input under test
    expect(refusals(readMany(VISITS, { forms: [SITE_VISIT_V1], submissions: [, SUBMISSIONS[0]], complete: true }))).toEqual(['not-data /submissions/0'])
    let calls = 0
    const getter = Object.defineProperty([] as unknown[], 0, {
      enumerable: true,
      get: () => {
        calls += 1
        return SUBMISSIONS[0]
      },
    })
    expect(refusals(readMany(VISITS, { forms: [SITE_VISIT_V1], submissions: getter, complete: true }))).toEqual(['not-data /submissions/0'])
    expect(calls).toBe(0)
  })

  // As for one submission: a version's own refusal comes before any answer
  // is read, so neither an answer under no path of the version nor a
  // getter among the answers buries it, and the getter never runs.
  test('refuses a field a version lacks before it reads any submission’s answers', () => {
    const renamed = {
      ...SITE_VISIT_V2,
      model: {
        fields: (SITE_VISIT_V2['model'] as { fields: { key: string }[] }).fields.map((each) => (each.key === 'site' ? { ...each, key: 'address' } : each)),
      },
    }
    let calls = 0
    const data = Object.defineProperty({ weather: 'Regen' }, 'address', {
      enumerable: true,
      get: () => {
        calls += 1
        return 'Bern'
      },
    })
    const outcome = readMany(VISITS, {
      forms: [SITE_VISIT_V1, renamed],
      submissions: [SUBMISSIONS[0]!, { id: 'c0ffee00-0000-4000-8000-000000000005', formHash: schemaHash(renamed), data }],
      complete: true,
    })
    expect(refusals(outcome)).toEqual(['version-lacks-field /datasets/detail/fields/0/form'])
    expect(calls).toBe(0)
  })
})
