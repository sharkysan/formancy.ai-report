import { SITE_VISIT_HIGH, SITE_VISIT_REPORT, SITE_VISIT_SUBMISSION_V1, SITE_VISIT_SUBMISSION_V2, SITE_VISIT_V1, SITE_VISIT_V2 } from '@formancy/report-corpus'
import { resolveReport, SUBMISSION_ID_SYNTAX } from '@formancy/report-runtime'
import type { ReportDefinition } from '@formancy/report-spec'
import { schemaHash } from '@formancy/spec'
import { describe, expect, test } from 'vitest'
import { answers, field, formOf, headerOf, read, readData, readOne, refusals, reportOf, rowsOf, SUBMISSION } from './test-support.js'

const RESOLVE = { mode: 'final', creationDate: '2026-10-22T08:00:00Z', timeZone: 'Europe/Zurich' } as const
const V1 = schemaHash(SITE_VISIT_V1)
const V2 = schemaHash(SITE_VISIT_V2)

/** The site visit report read from `submission` against `form`. */
const visit = (form: unknown, submission = SITE_VISIT_SUBMISSION_V1, more: { readonly formHash?: string } = {}) =>
  readOne(SITE_VISIT_REPORT, { form, ...more, submission })

describe('readSubmission', () => {
  // The bridge's one job: a stored submission becomes data a final render
  // prints, its answers in the header and one repeater's rows in the
  // detail. Labelled best-effort, one document written at one moment would
  // be printed as data read across moments; named by a hash the host gave,
  // the manifest would name a version nobody checked, where it names the
  // one the bridge computed (0041).
  test('reads a visit into data a final render resolves, host-captured, naming the submission and its version', () => {
    const data = readData(visit(SITE_VISIT_V1))
    expect(data.header).toEqual({
      site: 'Hauptstrasse 12, 3011 Bern',
      visitedOn: '2026-10-15',
      arrivedAt: '2026-10-15T07:45:00Z',
      startedAt: '09:50',
      outcome: 'Reparaturen nötig',
      outcomeCode: 'repair',
      inspector: 'Anna Schär',
      licence: 'BE-4471',
      roofChecked: true,
      safety: 'Mittel',
      summary: 'Zwei Befunde sind dringend und vor dem Winter zu beheben.',
    })
    expect(data.detail?.map((row) => row['ref'])).toEqual(['F-01', 'F-02', 'F-03', 'F-04', 'F-05', 'F-06', 'F-07', 'F-08'])
    expect(data.detail?.[0]).toEqual({ ref: 'F-01', area: 'Dachrinne Nord', severity: SITE_VISIT_HIGH.v1, hours: '1.5', parts: '0', fixed: true })
    expect([data.completeness, data.consistency]).toEqual([{ complete: true, captured: 8 }, 'host-captured'])
    expect(data.source).toEqual({ provider: 'formancy-form', submissions: [{ id: SITE_VISIT_SUBMISSION_V1.id, form: 'site-visit', formHash: V1 }] })
    const resolution = resolveReport(SITE_VISIT_REPORT, data, RESOLVE)
    expect(resolution.ok ? resolution.manifest.source : resolution.errors).toEqual(data.source)
  })

  // A reprint uses the labels of the version that collected the answers,
  // never today's (plan 12.2): version 2 rewrote a label, and a version-1
  // visit still prints version 1's. The labels come from the version the
  // host hands over, so handed version 2, the same answers print version
  // 2's -- which is why the host must hand over the version that
  // collected them.
  test('prints the labels of the version it is handed: a version-1 visit version 1’s, a version-2 visit version 2’s', () => {
    const severities = (outcome: ReturnType<typeof visit>) => readData(outcome).detail?.map((row) => row['severity'])
    expect(severities(visit(SITE_VISIT_V1))).toContain(SITE_VISIT_HIGH.v1)
    expect(severities(visit(SITE_VISIT_V1))).not.toContain(SITE_VISIT_HIGH.v2)
    expect(severities(visit(SITE_VISIT_V2, SITE_VISIT_SUBMISSION_V2))).toEqual([SITE_VISIT_HIGH.v2, 'Niedrig', SITE_VISIT_HIGH.v2])
    // Version 2 has every path version 1 has, so a version-1 visit handed over with it prints version 2's labels: only the host can tell the two apart.
    expect(severities(visit(SITE_VISIT_V2))).toContain(SITE_VISIT_HIGH.v2)
    expect(readData(visit(SITE_VISIT_V2, SITE_VISIT_SUBMISSION_V2)).source).toEqual({
      provider: 'formancy-form',
      submissions: [{ id: SITE_VISIT_SUBMISSION_V2.id, form: 'site-visit', formHash: V2 }],
    })
  })

  // The version's identity is its hash, computed here of the document
  // handed over and never taken on trust: a hash the host stored beside a
  // version that is not that document's says the host's record and its
  // document disagree, and either could be the wrong one.
  test('computes the version’s hash itself, and refuses one the host gives that differs', () => {
    expect(readData(visit(SITE_VISIT_V1, SITE_VISIT_SUBMISSION_V1, { formHash: V1 })).source).toEqual({
      provider: 'formancy-form',
      submissions: [{ id: SITE_VISIT_SUBMISSION_V1.id, form: 'site-visit', formHash: V1 }],
    })
    for (const formHash of [V2, V1.toUpperCase(), `sha256:${V1}`, 'Erika Mustermann']) {
      const outcome = visit(SITE_VISIT_V1, SITE_VISIT_SUBMISSION_V1, { formHash })
      expect(refusals(outcome), formHash).toEqual(['hash-mismatch /formHash'])
      if (!outcome.ok) expect(JSON.stringify(outcome.errors)).not.toContain('Erika')
    }
  })

  // Every answer is under a data path of the version that collected it.
  // An answer the version has no field for means the submission is another
  // version's, or another form's: refused by its path, which names the
  // key where it is a field key and never the value -- a key that is no
  // field key may be the answer itself.
  test('refuses an answer at a path the version has no field for, by its path and never its value', () => {
    const data = SITE_VISIT_SUBMISSION_V1.data
    const findings = data['findings'] as readonly Record<string, unknown>[]
    const unknown = {
      ...data,
      weather: 'Erika Mustermann',
      inspector: { ...(data['inspector'] as object), email: 'erika@example.ch' },
      findings: [{ ...findings[0], photo: 'erika.jpg' }, ...findings.slice(1)],
      'Erika Mustermann': 'Erika Mustermann',
      _id: 'r9',
    }
    const outcome = visit(SITE_VISIT_V1, { id: SUBMISSION, data: unknown })
    expect(refusals(outcome)).toEqual([
      'unknown-answer /submission/data/inspector/email',
      'unknown-answer /submission/data/findings/0/photo',
      'unknown-answer /submission/data/weather',
      'unknown-answer /submission/data',
      'unknown-answer /submission/data/_id',
    ])
    if (!outcome.ok) expect(JSON.stringify(outcome.errors)).not.toMatch(/Erika|erika/)
  })

  // Per render and per submission (0042): a field the report reads that
  // the submission's version lacks -- removed, renamed, moved into a group
  // or into a row, or a repeater gone -- or has as another kind, would
  // print wrong or not at all. Refused naming the field and the version's
  // hash, before any answer is read, until a review lifts it; a path is
  // never guessed from a name.
  test('refuses a field the version lacks, moved or retyped, naming the field and the version’s hash', () => {
    const moved = formOf([
      { key: 'inspectorName', type: 'text' },
      { key: 'site', type: 'text' },
      {
        key: 'items',
        type: 'repeater',
        fields: [
          { key: 'ref', type: 'text' },
          { key: 'parts', type: 'text' },
        ],
      },
    ])
    const report = reportOf({
      header: answers(field('inspector', 'string', 'inspector.name'), field('ref', 'string', 'ref'), field('site', 'string', 'site')),
      detail: rowsOf('findings', field('ref', 'string', 'ref')),
    })
    const outcome = read(report, moved, {})
    expect(refusals(outcome)).toEqual([
      'version-lacks-field /datasets/header/fields/0/form',
      'version-lacks-field /datasets/header/fields/1/form',
      'version-lacks-field /datasets/detail/form/repeater',
    ])
    if (!outcome.ok) {
      for (const error of outcome.errors) expect(error.message).toContain(schemaHash(moved))
      expect(outcome.errors[0]?.message).toContain('inspector')
    }
    const retyped = reportOf({ detail: rowsOf('items', field('parts', 'date', 'parts')) })
    expect(refusals(read(retyped, moved, {}))).toEqual(['version-retypes-field /datasets/detail/fields/0/form'])
    expect(refusals(read(reportOf({ detail: rowsOf('site', field('ref', 'string', 'ref')) }), moved, {}))).toEqual([
      'version-retypes-field /datasets/detail/form/repeater',
    ])
  })

  // The version's own refusal is the one that says what to do: a field it
  // lacks is reviewed into the report. Were the answers read first, a
  // submission of that version would also be refused for every answer
  // under a path it has no field for, the reason buried among them, and a
  // getter in them run.
  test('refuses a field the version lacks before it reads any answer', () => {
    const moved = formOf([
      { key: 'inspectorName', type: 'text' },
      { key: 'site', type: 'text' },
    ])
    const report = reportOf({ header: answers(field('inspector', 'string', 'inspector.name'), field('site', 'string', 'site')) })
    let calls = 0
    const data = Object.defineProperty({ weather: 'Regen', inspector: { name: 'Anna' } }, 'site', {
      enumerable: true,
      get: () => {
        calls += 1
        return 'Bern'
      },
    })
    expect(refusals(read(report, moved, data))).toEqual(['version-lacks-field /datasets/header/fields/0/form'])
    expect(calls).toBe(0)
  })

  // A version that touched nothing the report reads prints without a
  // review (0.3.0's FB-Q5): a field it added is never read by itself, and
  // never rides into the data, which holds what the report declares and
  // nothing else.
  test('reads a version that added a field, without handing the field over', () => {
    const added = {
      ...SITE_VISIT_V1,
      model: { fields: [...(SITE_VISIT_V1['model'] as { fields: unknown[] }).fields, { key: 'weather', type: 'text', label: 'Weather' }] },
    }
    const data = readData(visit(added, { id: SUBMISSION, data: { ...SITE_VISIT_SUBMISSION_V1.data, weather: 'Regen' } }))
    expect(Object.keys(data.header ?? {})).not.toContain('weather')
    expect(JSON.stringify(data)).not.toContain('Regen')
  })

  // An answer the submission does not have -- a hidden field formancy
  // pruned, a question never reached -- is null, which prints as nothing;
  // whether a field may be null is its contract's, so the runtime refuses
  // a final render of a field that may not. A repeater with no rows is no
  // rows, captured as none.
  test('hands over an absent answer as null, and a repeater with none as no rows', () => {
    const data = readData(visit(SITE_VISIT_V1, { id: SUBMISSION, data: { site: 'Bern', visitedOn: '2026-10-15' } }))
    expect(data.header).toEqual({
      site: 'Bern',
      visitedOn: '2026-10-15',
      arrivedAt: null,
      startedAt: null,
      outcome: null,
      outcomeCode: null,
      inspector: null,
      licence: null,
      roofChecked: null,
      safety: null,
      summary: null,
    })
    expect([data.detail, data.completeness]).toEqual([[], { complete: true, captured: 0 }])
    const resolved = resolveReport(SITE_VISIT_REPORT, readData(visit(SITE_VISIT_V1, { id: SUBMISSION, data: { visitedOn: '2026-10-15' } })), RESOLVE)
    expect(resolved.ok ? 'resolved' : resolved.errors.map((error) => `${error.code} ${error.path}`)).toEqual(['unexpected-null /header/site'])
  })

  // The rows a computed rule writes are stored with an `_id` from
  // formancy 0.11.0 and without one before it (formancy.ai 0218), and a
  // host keeps both. A bridge that keyed a row by its id would refuse
  // every older submission of such a form, or print its rows as none; a
  // row is read by its place and its fields, so both print, in order.
  test('reads the rows a computed rule wrote, stored with their ids or without', () => {
    const form = formOf([{ key: 'lines', type: 'repeater', fields: [{ key: 'ref', type: 'text' }] }], {
      logic: { rules: [{ target: 'lines', kind: 'computed', cel: "[{'ref': 'A'}, {'ref': 'B'}]" }] },
    })
    const report = reportOf({ detail: rowsOf('lines', field('ref', 'string', 'ref')) })
    const before = readData(read(report, form, { lines: [{ ref: 'A' }, { ref: 'B' }] }))
    const after = readData(
      read(report, form, {
        lines: [
          { _id: 'lines-0', ref: 'A' },
          { _id: 'lines-1', ref: 'B' },
        ],
      }),
    )
    expect([before.detail, after.detail]).toEqual([
      [{ ref: 'A' }, { ref: 'B' }],
      [{ ref: 'A' }, { ref: 'B' }],
    ])
  })

  // Every answer is held to its field's type by the runtime's own reading
  // of a value (0010), at the answer's path in the submission, so the
  // bridge and the runtime cannot read a value two ways: a decimal past
  // the field's scale is refused, never rounded.
  test('holds each answer to its field’s type by the runtime’s reading, at its path in the submission', () => {
    const findings = siteVisitRows([{ hours: 1.255 }])
    expect(refusals(visit(SITE_VISIT_V1, { id: SUBMISSION, data: { ...SITE_VISIT_SUBMISSION_V1.data, findings } }))).toEqual([
      'invalid-answer /submission/data/findings/0/hours',
    ])
    expect(refusals(visit(SITE_VISIT_V1, { id: SUBMISSION, data: { ...SITE_VISIT_SUBMISSION_V1.data, visitedOn: '2026-02-30' } }))).toEqual([
      'invalid-answer /submission/data/visitedOn',
    ])
    expect(refusals(visit(SITE_VISIT_V1, { id: SUBMISSION, data: { ...SITE_VISIT_SUBMISSION_V1.data, site: 'a\uD800' } }))).toEqual([
      'invalid-answer /submission/data/site',
    ])
  })

  // A submission is named in every manifest by its id, held to the
  // runtime's own syntax for one (0041) before any answer is read: a
  // name, an email address or a path where an id stands would ride into
  // every manifest kept beside the PDF.
  test('refuses a submission whose id is not one a source names, before reading an answer', () => {
    for (const id of ['Erika Mustermann', 'erika@example.ch', '', 7]) {
      const outcome = readOne(SITE_VISIT_REPORT, { form: SITE_VISIT_V1, submission: { id, data: { site: 7 } } })
      expect(refusals(outcome), String(id)).toEqual(['invalid-submission /submission/id'])
      if (!outcome.ok) {
        expect(JSON.stringify(outcome.errors)).not.toMatch(/Erika|erika/)
        // In the runtime's words for its rule, so the two never describe one rule two ways.
        expect(outcome.errors[0]?.message).toContain(SUBMISSION_ID_SYNTAX)
      }
    }
  })

  // The bridge reads a report whose datasets are read from a form, and
  // only that: a report bound to no form would be filled with nothing it
  // asked for, and one of one row per submission is readSubmissions'.
  test('refuses a report it cannot read: invalid, read from no form, or of one row per submission', () => {
    const unbound = {
      ...SITE_VISIT_REPORT,
      datasets: { header: { id: 'visit', fields: [{ id: 'site', type: 'string', label: 'Site', nullable: true }] } },
      regions: { ...SITE_VISIT_REPORT.regions, reportHeader: [], pageHeader: [], body: [], summary: [] },
      aggregates: [],
    } as ReportDefinition
    expect(refusals(readOne(unbound, { form: SITE_VISIT_V1, submission: SITE_VISIT_SUBMISSION_V1 }))).toEqual(['unbound-report /datasets'])
    expect(
      refusals(readOne({ ...SITE_VISIT_REPORT, title: 7 } as unknown as ReportDefinition, { form: SITE_VISIT_V1, submission: SITE_VISIT_SUBMISSION_V1 })),
    ).toEqual(['invalid-report '])
    const many = reportOf({ detail: { id: 'visits', form: { kind: 'submissions' }, fields: [field('site', 'string', 'site')] } })
    expect(refusals(readOne(many, { form: SITE_VISIT_V1, submission: SITE_VISIT_SUBMISSION_V1 }))).toEqual(['unbound-report /datasets/detail/form'])
  })

  // What the host hands over is { form, formHash?, submission: { id, data } }
  // and nothing else: a part the bridge does not know may be one a later
  // release reads (fail closed), and data that is not an object holds no
  // answers.
  test('refuses input of another shape', () => {
    const shape = (input: unknown) => refusals(readOne(SITE_VISIT_REPORT, input))
    expect(shape('visit')).toEqual(['invalid-input '])
    expect(shape({ form: SITE_VISIT_V1 })).toEqual(['invalid-input /submission'])
    expect(shape({ form: SITE_VISIT_V1, submission: { id: SUBMISSION } })).toEqual(['invalid-input /submission/data'])
    expect(shape({ form: SITE_VISIT_V1, submission: SITE_VISIT_SUBMISSION_V1, version: 1 })).toEqual(['invalid-input /version'])
    expect(shape({ form: SITE_VISIT_V1, submission: { ...SITE_VISIT_SUBMISSION_V1, submittedAt: '2026-10-15' } })).toEqual([
      'invalid-input /submission/submittedAt',
    ])
    expect(shape({ form: SITE_VISIT_V1, submission: { id: SUBMISSION, data: [] } })).toEqual(['invalid-answer /submission/data'])
  })
})

/** The visit's findings, the first rows changed by `changes`. */
function siteVisitRows(changes: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const rows = SITE_VISIT_SUBMISSION_V1.data['findings'] as readonly Record<string, unknown>[]
  return rows.map((row, index) => ({ ...row, ...changes[index] }))
}

describe('a submission of every spec version', () => {
  // formancy's versions are supersets, and a host's forms may be at any
  // of them: 0004 decided the bridge reads what upstream's validator
  // reads, and narrows nothing.
  test.each([
    [
      '1',
      [
        { key: 'site', type: 'text', label: 'Site' },
        { key: 'parts', type: 'number' },
        { key: 'kind', type: 'select', options: [{ value: 'a', label: 'Annual' }] },
        { key: 'on', type: 'date' },
        { key: 'ok', type: 'checkbox' },
        { key: 'g', type: 'group', fields: [{ key: 'name', type: 'text' }] },
        { key: 'rows', type: 'repeater', fields: [{ key: 'x', type: 'text' }] },
      ],
    ],
    // In pages, which scope nothing: the site is read at its own key, as modelDataPaths writes it.
    [
      '2',
      [
        {
          key: 'first',
          type: 'page',
          fields: [
            { key: 'site', type: 'text' },
            { key: 'at', type: 'time' },
          ],
        },
        {
          key: 'second',
          type: 'page',
          fields: [
            { key: 'seen', type: 'datetime' },
            { key: 'notes', type: 'richtext' },
            { key: 'checks', type: 'selectboxes', options: [{ value: 'roof', label: 'Roof' }] },
          ],
        },
      ],
    ],
    [
      '3',
      [
        { key: 'site', type: 'text' },
        { key: 'signed', type: 'signature', box: [300, 100] },
      ],
    ],
    [
      '4',
      [
        { key: 'site', type: 'text' },
        {
          key: 'rating',
          type: 'matrix',
          rows: [{ value: 'taste', label: 'Taste' }],
          options: [
            { value: 'good', label: 'Good' },
            { value: 'poor', label: 'Poor' },
          ],
        },
      ],
    ],
    // Spec 5 adds properties alone, each for the person filling the form
    // in (formancy.ai 0201): help text, an example, an autofill purpose, a
    // default, a shuffled order and an option chosen on its own. An answer
    // holds what it held at spec 4, so the bridge reads it as it reads 4.
    [
      '5',
      [
        {
          key: 'site',
          type: 'text',
          label: 'Site',
          description: 'As on the deed',
          placeholder: 'Hauptstrasse 12',
          autocomplete: 'street-address',
          default: 'Bern',
        },
        {
          key: 'checks',
          type: 'selectboxes',
          shuffle: true,
          options: [
            { value: 'roof', label: 'Roof' },
            { value: 'none', label: 'None of these', exclusive: true, keepPlace: true },
          ],
        },
      ],
    ],
  ])('reads a form at spec %s', (specVersion, fields) => {
    const form = formOf(fields, {}, specVersion)
    const report = reportOf({ header: answers(field('site', 'string', 'site')) })
    expect(headerOf(read(report, form, { site: `Spec ${specVersion}` }))).toEqual({ site: `Spec ${specVersion}` })
  })

  // Plan 25.1's regression case: a form Formancy Data generated, at spec 3
  // (formancy.ai-data 0042), with Data's controls -- a decimal as text
  // under a pattern, never a number; an integer as a bounded number; a
  // nullable yes-or-no as a radio of "true" and "false". A text read as a
  // decimal hands its string over, which the runtime holds to a
  // decimal's one spelling: the remedy the number rule names.
  test('reads a form Formancy Data generated at spec 3', () => {
    const form = formOf(
      [
        { key: 'number', type: 'text', label: 'Number', required: true, maxLength: 20 },
        { key: 'total', type: 'text', label: 'Total', pattern: '^-?(?:0|[1-9][0-9]{0,15})(?:\\.[0-9]{1,2})?$' },
        { key: 'quantity', type: 'number', label: 'Quantity', min: -2147483648, max: 2147483647 },
        {
          key: 'paid',
          type: 'radio',
          label: 'Paid',
          options: [
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ],
        },
        { key: 'orderedOn', type: 'date', label: 'Ordered on' },
        { key: 'shippedAt', type: 'datetime', label: 'Shipped at' },
      ],
      { id: 'order' },
      '3',
    )
    const report = reportOf(
      {
        header: answers(
          field('number', 'string', 'number'),
          field('total', 'decimal', 'total', { scale: 2 }),
          field('quantity', 'integer', 'quantity'),
          field('paid', 'string', 'paid'),
          field('orderedOn', 'date', 'orderedOn'),
          field('shippedAt', 'instant', 'shippedAt'),
        ),
      },
      'en',
    )
    const outcome = read(report, form, {
      number: 'Q-2026-0042',
      total: '99999999999999.99',
      quantity: 3,
      paid: 'false',
      orderedOn: '2026-10-15',
      shippedAt: '2026-10-15T08:30:00Z',
    })
    expect(headerOf(outcome)).toEqual({
      number: 'Q-2026-0042',
      total: '99999999999999.99',
      quantity: '3',
      paid: 'No',
      orderedOn: '2026-10-15',
      shippedAt: '2026-10-15T08:30:00Z',
    })
    expect(readData(outcome).source).toEqual({ provider: 'formancy-form', submissions: [{ id: SUBMISSION, form: 'order', formHash: schemaHash(form) }] })
    expect(refusals(read(report, form, { total: '1,50' }))).toEqual(['invalid-answer /submission/data/total'])
  })

  // Every formancy server from 0.2.0 to 0.11.0 published a pattern that
  // backtracks only as its engine runs it, with the `u` flag, such as
  // `(\p{L}+)+`, and 0.12.0's refuses one only when the form is published
  // again (formancy.ai 0226): until then a host keeps the version and its
  // submissions. The bridge reads what the pinned validator reads (0004),
  // which compiles a pattern as the engine does and never analyses it; a
  // bridge that refused such a version would leave every submission of it
  // unprintable. Nor does the bridge run a pattern: one that did would let
  // that version hold a render as it held formancy's server, so an answer
  // the pattern refuses, which formancy's engine never stores, prints. A
  // pattern that does not compile with the `u` flag is no version.
  test('reads a version whose pattern backtracks, never running it, and refuses one that does not compile', () => {
    const report = reportOf({ header: answers(field('site', 'string', 'site')) })
    const backtracking = formOf([{ key: 'site', type: 'text', pattern: '(\\p{L}+)+' }])
    expect(headerOf(read(report, backtracking, { site: 'Bern' }))).toEqual({ site: 'Bern' })
    expect(headerOf(read(report, backtracking, { site: 'Hauptstrasse 12' }))).toEqual({ site: 'Hauptstrasse 12' })
    // A quantifier's brace with nothing to count is a literal without `u` and an error with it.
    const broken = read(report, formOf([{ key: 'site', type: 'text', pattern: 'a{' }]), { site: 'Bern' })
    expect(refusals(broken)).toEqual(['invalid-form /form/model/fields/0/pattern'])
    if (!broken.ok) expect(broken.errors[0]?.message).toContain('pattern.invalid')
  })

  // A form of a version upstream's pinned validator does not read is
  // refused whole, naming that version and the ones it reads (0004): a
  // field of spec 6 could be the one that hides a row.
  test('refuses a spec the pinned validator does not read, naming both versions', () => {
    const outcome = read(reportOf({ header: answers(field('site', 'string', 'site')) }), formOf([{ key: 'site', type: 'text' }], {}, '6'), { site: 'Bern' })
    expect(refusals(outcome)).toEqual(['unsupported-spec-version /form/specVersion'])
    if (!outcome.ok) expect(outcome.errors[0]?.message).toMatch(/"6".*"1", "2", "3", "4", "5"\D/)
    // A version that is no string of digits may be anything a host stored, a name among it: said as what it is not.
    const named = read(reportOf({ header: answers(field('site', 'string', 'site')) }), formOf([{ key: 'site', type: 'text' }], {}, 'Erika Mustermann'), {})
    expect(refusals(named)).toEqual(['unsupported-spec-version /form/specVersion'])
    if (!named.ok) expect(JSON.stringify(named.errors)).not.toContain('Erika')
  })

  // What formancy's validator refuses is no form: two fields under one
  // key would fill one answer twice, and a repeater in a repeater has
  // rows no reader can address (formancy refuses it, so the bridge never
  // meets one). Refused with formancy's own code, where it points.
  test('refuses a form formancy’s validator refuses, by its code and where it points', () => {
    const report = reportOf({ header: answers(field('site', 'string', 'site')) })
    const twice = read(
      report,
      formOf([
        { key: 'site', type: 'text' },
        { key: 'site', type: 'text' },
      ]),
      {},
    )
    expect(refusals(twice)).toEqual(['invalid-form /form/model/fields/1/key'])
    if (!twice.ok) expect(twice.errors[0]?.message).toContain('key.taken')
    const nested = read(
      report,
      formOf([
        { key: 'site', type: 'text' },
        { key: 'rows', type: 'repeater', fields: [{ key: 'inner', type: 'repeater', fields: [] }] },
      ]),
      {},
    )
    expect(refusals(nested)).toEqual(['invalid-form /form/model/fields/1/fields/0/type'])
    if (!nested.ok) expect(nested.errors[0]?.message).toContain('repeater.nested')
  })

  // formancy's validator points into the form by whatever the form holds:
  // a catalogue's locale or a message's id, which may be a name. A
  // refusal that named that pointer whole would carry the form's text into
  // a log; it is cut where a segment is neither a field key nor an index,
  // as a submission's path is (`answerAt`), and each of formancy's codes
  // there is said once.
  test('refuses a form at where formancy points, cut before what the form names', () => {
    const report = reportOf({ header: answers(field('site', 'string', 'site')) })
    const catalogue = { i18n: { defaultLocale: 'en', messages: { en: { 'Erika Mustermann 1970-01-01': 7, site: 'Site' }, 'Erika Mustermann': { site: 8 } } } }
    const outcome = read(report, formOf([{ key: 'site', type: 'text', label: { $t: 'site' } }], catalogue), {})
    expect(refusals(outcome)).toEqual(['invalid-form /form/i18n/messages/en', 'invalid-form /form/i18n/messages'])
    if (!outcome.ok) expect(JSON.stringify(outcome.errors)).not.toContain('Erika')
  })
})
