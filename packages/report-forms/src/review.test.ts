import { openReportSession } from '@formancy/report-core'
import type { CommandDescriptor, ReportSession } from '@formancy/report-core'
import { E_INVOICE_EXEMPT_PAID } from '@formancy/report-corpus'
import { MAX_DETAIL_ROWS } from '@formancy/report-runtime'
import { reportHash, validateReport, walkComponents } from '@formancy/report-spec'
import type { Component, DatasetContract, DatasetFormBinding, FieldContract, ReportDefinition } from '@formancy/report-spec'
import { diffSchemas, schemaHash } from '@formancy/spec'
import type { FormSchema } from '@formancy/spec'
import { describe, expect, test } from 'vitest'
import { reviewFormVersion } from './review.js'
import type { FormReview, ReviewItem } from './review.js'
import { formOf, generate, generatedFrom, headerOf, read, readData, refusals } from './test-support.js'

/**
 * A form version that removes, moves or retypes a field a report prints
 * blocks that report's submissions of it until reviewed; anything else
 * prints (0048). `reviewFormVersion` compares the report with the new
 * version, through the versions it was made from and reviewed against,
 * and says what it would take: each item a field and what the version did
 * to it, as formancy's `diffSchemas` names it, and its resolutions, each a
 * report-core command as data, applied against the hash it was computed
 * for. A rename the form's author declared is offered first, and never
 * followed by itself; a path is never guessed from a name; a relabel is
 * offered, not applied; a new field is never added.
 */

/** The first version: a site, required; an inspector's name in a group; a count as text; findings, each an area and hours. */
const FIELDS = [
  { key: 'site', type: 'text', label: 'Site', required: true },
  { key: 'inspector', type: 'group', label: 'Inspector', fields: [{ key: 'name', type: 'text', label: 'Name' }] },
  { key: 'count', type: 'text', label: 'Count' },
  {
    key: 'findings',
    type: 'repeater',
    label: 'Findings',
    fields: [
      { key: 'area', type: 'text', label: 'Area' },
      { key: 'hours', type: 'number', label: 'Hours', min: 0, step: 0.25 },
    ],
  },
] as const

type Field = Readonly<Record<string, unknown>> & { readonly key: string; readonly fields?: readonly Field[] }

const V1 = formOf([...FIELDS])

/** A version of the form whose fields `edit` makes of the first's. */
const version = (edit: (fields: readonly Field[]) => readonly Field[], more: Record<string, unknown> = {}): Record<string, unknown> =>
  formOf([...edit(FIELDS)], more)

/** `fields` with the field `key`, at the top or in a container, replaced by what `change` makes of it, or removed where it makes nothing. */
function changed(fields: readonly Field[], key: string, change: (field: Field) => Field | undefined): Field[] {
  return fields.flatMap((field): Field[] => {
    if (field.key === key) {
      const next = change(field)
      return next === undefined ? [] : [next]
    }
    return field.fields === undefined ? [field] : [{ ...field, fields: changed(field.fields, key, change) }]
  })
}

/** The report generated from the first version, in English, its table over the findings: what a person starts from (0045). */
const REPORT: ReportDefinition = generatedFrom(generate(V1, { id: 'visit', locale: 'en', detail: { kind: 'repeater', repeater: 'findings' } })).report

/** A review of `form` for `report`, handed the versions it names. */
const reviewed = (form: unknown, report: ReportDefinition = REPORT, versions: readonly unknown[] = [V1]): FormReview =>
  reviewFormVersion(report, { form, versions })

/** The review's status and items, failing the test where it was refused. */
function itemsOf(review: FormReview): { readonly status: string; readonly items: readonly ReviewItem[] } {
  if (!review.ok) throw new Error(`refused: ${review.errors.map((error) => `${error.code} ${error.path}: ${error.message}`).join('; ')}`)
  return review
}

/** Each item as its dataset, field, change, whether it blocks, and its resolutions' kinds. */
const summary = (items: readonly ReviewItem[]) =>
  items.map((item) => [
    item.dataset,
    item.field ?? item.formPath ?? null,
    item.change ?? null,
    item.blocks,
    item.resolutions.map((resolution) => resolution.kind),
  ])

/** A session over `report`. */
function sessionOf(report: ReportDefinition = REPORT): ReportSession {
  const opening = openReportSession(report)
  if (!opening.ok) throw new Error('the report did not open')
  return opening.session
}

/** `report` with the review's resolution of `kind` for `field` applied, as a host applies it: against the hash it was computed for. */
function resolved(review: FormReview, field: string | undefined, kind: string, report: ReportDefinition = REPORT): ReportDefinition {
  const item = itemsOf(review).items.find((each) => each.field === field)
  const resolution = item?.resolutions.find((each) => each.kind === kind)
  if (resolution === undefined) throw new Error(`no ${kind} for ${String(field)}`)
  const session = sessionOf(report)
  const outcome = session.apply(resolution.descriptor, { expectedHash: resolution.expectedHash, label: kind })
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
  return session.document()
}

/** Each text component of `report` as the text it prints, its runs' kinds in braces. */
const texts = (report: ReportDefinition): string[] =>
  walkComponents(report).flatMap(({ component }: { component: Component }) =>
    component.kind === 'text' ? [component.content.map((run) => (run.kind === 'text' ? run.text : `{${run.kind}}`)).join('')] : [],
  )

/** A submission's answers to the first version, with what `more` adds. */
const answered = (more: Record<string, unknown> = {}): Record<string, unknown> => ({
  site: 'Hauptstrasse 12',
  inspector: { name: 'Anna' },
  count: '3',
  findings: [{ _id: 'r1', area: 'Dach', hours: 1.25 }],
  ...more,
})

/** The corpus's paid e-invoice, its header read from a form's answers and its lines from a repeater's rows, each field at its own key; and that form, which it names as made from. */
function invoiceFromForm(): { readonly report: ReportDefinition; readonly form: Record<string, unknown> } {
  const sample = E_INVOICE_EXEMPT_PAID.report
  const kind = (field: FieldContract): string => (field.type === 'date' ? 'date' : 'text')
  const fields = (contract: DatasetContract | undefined) => (contract?.fields ?? []).map((field) => ({ key: field.id, type: kind(field), label: field.label }))
  const form = formOf([...fields(sample.datasets.header), { key: 'lines', type: 'repeater', label: 'Lines', fields: fields(sample.datasets.detail) }])
  const bound = (contract: DatasetContract | undefined, binding: DatasetFormBinding): DatasetContract => ({
    ...(contract as DatasetContract),
    form: binding,
    fields: (contract?.fields ?? []).map((field) => ({ ...field, form: { path: field.id } })),
  })
  const report = validateReport({
    ...sample,
    datasets: { header: bound(sample.datasets.header, { kind: 'submission' }), detail: bound(sample.datasets.detail, { kind: 'repeater', repeater: 'lines' }) },
    provenance: { kind: 'form', form: 'site-visit', formHash: schemaHash(form) },
  })
  if (!report.valid) throw new Error(`the e-invoice bound to a form is no report: ${report.errors.map((error) => `${error.code} ${error.path}`).join('; ')}`)
  return { report: report.report, form }
}

describe('reviewFormVersion, what prints', () => {
  // FB-Q5: no review for every version. A version that changed nothing
  // the report prints -- a title, a layout -- prints, and says so; the
  // version the report was made from is no change at all.
  test('a version that changed nothing the report prints is compatible', () => {
    expect(itemsOf(reviewed(version((fields) => fields, { title: 'Site visit, revised' })))).toMatchObject({ status: 'compatible', items: [] })
    expect(itemsOf(reviewed(V1))).toMatchObject({ status: 'compatible', items: [] })
  })

  // A form's author who moves it to spec 5 to give a question help text,
  // an example or a default changes nothing an answer holds (formancy.ai
  // 0201), though formancy's diff calls each such field changed, by a rule
  // it has none for. A review that blocked on that would stop every
  // report of the form for words its submissions never hold; the version
  // prints, and its submissions read as the first version's do.
  test('a version that moves to spec 5 and adds only what helps a person fill it in is compatible', () => {
    const helped = version(
      (fields) =>
        changed(
          changed(
            changed(fields, 'site', (field) => ({
              ...field,
              description: 'Street, number and town',
              placeholder: 'Hauptstrasse 12',
              autocomplete: 'street-address',
              default: 'Bern',
            })),
            'name',
            (field) => ({ ...field, autocomplete: 'name' }),
          ),
          'hours',
          (field) => ({ ...field, placeholder: '1.25', default: 1 }),
        ),
      { specVersion: '5' },
    )
    const said = diffSchemas(V1 as unknown as FormSchema, helped as unknown as FormSchema).map((change) => `${change.kind} ${change.path}`)
    expect(said).toEqual([
      'field.changed model.fields.findings[].hours',
      'field.changed model.fields.inspector.name',
      'field.changed model.fields.site',
      'specVersion.changed specVersion',
    ])
    expect(itemsOf(reviewed(helped))).toMatchObject({ status: 'compatible', items: [] })
    expect(headerOf(read(REPORT, helped, answered()))).toEqual(headerOf(read(REPORT, V1, answered())))
  })

  // formancy 0.12.0 refuses at publish a pattern that backtracks as its
  // engine runs it, with the `u` flag, which every release before it
  // published (formancy.ai 0226), and asks a host to publish every form
  // with a pattern again: one it refuses goes out with the pattern
  // rewritten. A review that blocked on that would stop every report of
  // the form for a rule its answers met when they were stored. The draft
  // of the version that held the old pattern is the first version's but
  // for the version it names, and the version that rewrote it, a
  // constraint tightened in formancy's diff, prints.
  test('a version that rewrites a pattern formancy refuses from 0.12.0 is compatible with the report drafted from the one before', () => {
    const backtracking = version((fields) => changed(fields, 'name', (field) => ({ ...field, pattern: '(\\p{L}+)+' })))
    const rewritten = version((fields) => changed(fields, 'name', (field) => ({ ...field, pattern: '\\p{L}+' })))
    const drafted = generatedFrom(generate(backtracking, { id: 'visit', locale: 'en', detail: { kind: 'repeater', repeater: 'findings' } })).report
    expect({ ...drafted, provenance: REPORT.provenance }).toEqual(REPORT)
    const said = diffSchemas(backtracking as unknown as FormSchema, rewritten as unknown as FormSchema).map((change) => `${change.kind} ${change.path}`)
    expect(said).toEqual(['field.constraintTightened model.fields.inspector.name'])
    expect(itemsOf(reviewed(rewritten, drafted, [backtracking]))).toMatchObject({ status: 'compatible', items: [] })
    expect(headerOf(read(drafted, rewritten, answered()))).toEqual(headerOf(read(REPORT, V1, answered())))
  })

  // "A harmless additional column does not automatically appear in an
  // existing report" (plan 12.3): a field the version added is said, in
  // the scope it stands in, and nothing adds it. It blocks nothing; a
  // static text, which a report prints nothing of, is not said.
  test('a field the version added is said and never added, and blocks nothing', () => {
    const added = version((fields) => [
      ...changed(fields, 'findings', (field) => ({ ...field, fields: [...(field.fields ?? []), { key: 'parts', type: 'number', label: 'Parts' }] })),
      { key: 'remarks', type: 'textarea', label: 'Remarks' },
      { key: 'note', type: 'static', label: 'Thank you' },
    ])
    const review = itemsOf(reviewed(added))
    expect(review.status).toBe('review')
    expect(summary(review.items)).toEqual([
      ['header', 'remarks', 'field.added', false, []],
      ['detail', 'parts', 'field.added', false, []],
    ])
    expect(readData(read(REPORT, added, answered({ remarks: 'Alles gut' }))).header).not.toHaveProperty('remarks')
  })
})

describe('reviewFormVersion, a version that moves a field', () => {
  // A rename the form's author declared moves the answers, and the
  // version's submissions are refused where the report reads the old
  // path. The review offers to follow it, first, labelled as declared; it
  // follows nothing itself, so the status is blocked until it is applied.
  test('offers a declared rename first, labelled declared, and follows it only when applied', () => {
    const renamed = version((fields) => changed(fields, 'site', (field) => ({ ...field, key: 'address', renamedFrom: 'site' })))
    const review = itemsOf(reviewed(renamed))
    expect(review.status).toBe('blocked')
    expect(summary(review.items)).toEqual([['header', 'site', 'field.renamed', true, ['follow-rename', 'print-nothing', 'remove']]])
    const [item] = review.items
    expect([item?.code, item?.resolutions[0]?.declared]).toEqual(['version-lacks-field', true])
    expect(refusals(read(REPORT, renamed, { address: 'Bahnhofplatz 1' }))).toEqual(['version-lacks-field /datasets/header/fields/0/form'])
    const followed = resolved(reviewed(renamed), 'site', 'follow-rename')
    // The binding reads the field where the version reviewed holds it now, and names each version it knows where it reads it (review-later.test.ts).
    expect(followed.datasets.header?.fields[0]?.form).toEqual({
      path: 'address',
      overrides: { [schemaHash(V1)]: { path: 'site' }, [schemaHash(renamed)]: { path: 'address' } },
    })
    expect(headerOf(read(followed, renamed, { address: 'Bahnhofplatz 1' }))['site']).toBe('Bahnhofplatz 1')
    // The version it was made from goes on reading the field where it was.
    expect(headerOf(read(followed, V1, answered()))['site']).toBe('Hauptstrasse 12')
    expect(itemsOf(reviewed(renamed, followed)).status).toBe('compatible')
  })

  // A group renamed moves what it holds, though formancy reports the
  // group alone: the name under the inspector is the technician's now.
  test('follows a renamed group to the field beneath it', () => {
    const renamed = version((fields) => changed(fields, 'inspector', (field) => ({ ...field, key: 'technician', renamedFrom: 'inspector' })))
    expect(summary(itemsOf(reviewed(renamed)).items)).toEqual([['header', 'name', 'field.renamed', true, ['follow-rename', 'print-nothing', 'remove']]])
    const followed = resolved(reviewed(renamed), 'name', 'follow-rename')
    expect(headerOf(read(followed, renamed, { site: 'Bern', technician: { name: 'Lea' } }))['name']).toBe('Lea')
  })

  // A rename the form did not declare is a removal and an addition: a
  // field of the same key elsewhere is never taken for it. Guessing
  // wrong would print one answer under another's label.
  test('never guesses a path from a name', () => {
    const moved = version((fields) => [...changed(fields, 'name', () => undefined), { key: 'name', type: 'text', label: 'Name' }])
    const review = itemsOf(reviewed(moved))
    expect(summary(review.items.filter((item) => item.blocks))).toEqual([['header', 'name', 'field.removed', true, ['print-nothing', 'remove']]])
    expect(review.items.some((item) => item.change === 'field.added' && item.formPath === 'name')).toBe(true)
  })

  // The detail's repeater renamed moves every row: the review follows it
  // on the dataset, and each row's fields are read at their own paths in
  // the renamed rows.
  test("follows a declared rename of the detail's repeater", () => {
    const renamed = version((fields) => changed(fields, 'findings', (field) => ({ ...field, key: 'defects', renamedFrom: 'findings' })))
    expect(summary(itemsOf(reviewed(renamed)).items)).toEqual([['detail', null, 'field.renamed', true, ['follow-rename']]])
    const followed = resolved(reviewed(renamed), undefined, 'follow-rename')
    expect(followed.datasets.detail?.form).toEqual({
      kind: 'repeater',
      repeater: 'defects',
      overrides: { [schemaHash(V1)]: { repeater: 'findings' }, [schemaHash(renamed)]: { repeater: 'defects' } },
    })
    expect(readData(read(followed, renamed, { site: 'Bern', defects: [{ _id: 'r1', area: 'Keller', hours: 0.5 }] })).detail).toEqual([
      { area: 'Keller', hours: '0.5' },
    ])
  })

  // A report reviewed once reads the field from where the review put it
  // in that version; the next version renames it again, from there. The
  // review reads the rename from that version, which it was handed.
  test('follows a rename from the version an override reads, a version it was handed', () => {
    const v2 = version((fields) => changed(fields, 'site', (field) => ({ ...field, key: 'address', renamedFrom: 'site' })))
    const v3 = version((fields) => changed(fields, 'site', (field) => ({ ...field, key: 'location', renamedFrom: 'address' })))
    const once = resolved(reviewed(v2), 'site', 'follow-rename')
    expect(summary(itemsOf(reviewed(v3, once, [V1, v2])).items)).toEqual([
      ['header', 'site', 'field.renamed', true, ['follow-rename', 'print-nothing', 'remove']],
    ])
    const twice = resolved(reviewed(v3, once, [V1, v2]), 'site', 'follow-rename', once)
    expect(headerOf(read(twice, v3, { location: 'Kramgasse 49' }))['site']).toBe('Kramgasse 49')
    expect(headerOf(read(twice, v2, { address: 'Bahnhofplatz 1' }))['site']).toBe('Bahnhofplatz 1')
  })
})

describe('reviewFormVersion, a version that removes or retypes a field', () => {
  // A removed field is printed no more from that version's submissions,
  // or removed from the report with every reader of it: both offered,
  // neither applied. What a removal takes is said, by pointers into the
  // report, before anyone applies it.
  test('offers to print nothing of a removed field from that version, or to remove it with its readers', () => {
    const removed = version((fields) => changed(fields, 'count', () => undefined))
    const review = itemsOf(reviewed(removed))
    expect(summary(review.items)).toEqual([['header', 'count', 'field.removed', true, ['print-nothing', 'remove']]])
    const removal = review.items[0]?.resolutions.find((resolution) => resolution.kind === 'remove')
    const line = walkComponents(REPORT).find(({ component }) => component.kind === 'text' && JSON.stringify(component.content).includes('"count"'))
    expect(removal?.removes).toEqual([line?.path, '/datasets/header/fields/2'])
    const nothing = resolved(reviewed(removed), 'count', 'print-nothing')
    expect(headerOf(read(nothing, removed, { site: 'Bern' }))['count']).toBeNull()
    expect(headerOf(read(nothing, V1, answered()))['count']).toBe('3')
    // Reviewed, the version prints: nothing of the field is read from it, and nothing more is said of it.
    expect(itemsOf(reviewed(removed, nothing)).status).toBe('compatible')
    const gone = resolved(reviewed(removed), 'count', 'remove')
    expect([gone.datasets.header?.fields.map(({ id }) => id), texts(gone).some((text) => text.startsWith('Count'))]).toEqual([['site', 'name'], false])
  })

  // A field never null is declared nullable where nothing is to print of
  // it from a version, and the resolution says so: a field never null
  // would refuse every final render of that version's submissions.
  test('declares a field nullable where it prints nothing of it, and says so', () => {
    const removed = version((fields) => changed(fields, 'site', () => undefined))
    const nothing = itemsOf(reviewed(removed)).items[0]?.resolutions.find((resolution) => resolution.kind === 'print-nothing')
    expect(nothing?.message).toMatch(/nullable/)
    const applied = resolved(reviewed(removed), 'site', 'print-nothing')
    expect(applied.datasets.header?.fields[0]).toMatchObject({
      id: 'site',
      nullable: true,
      form: { path: 'site', overrides: { [schemaHash(removed)]: { omit: true } } },
    })
  })

  // Nothing is offered that the compiler would then refuse: a decimal
  // compared with == compiles only while it is never null (0009), so
  // printing nothing of it from a version is not offered there; its
  // removal is.
  test('offers nothing that would leave an expression the compiler refuses', () => {
    const lines = REPORT.datasets.detail as NonNullable<ReportDefinition['datasets']['detail']>
    const strict: ReportDefinition = {
      ...REPORT,
      datasets: {
        ...REPORT.datasets,
        detail: { ...lines, fields: lines.fields.map((field) => (field.id === 'hours' ? { ...field, nullable: false } : field)) },
      },
      regions: {
        ...REPORT.regions,
        body: REPORT.regions.body.map((component) =>
          component.kind === 'table'
            ? {
                ...component,
                columns: component.columns.map((column, index) =>
                  index === 0 ? { ...column, styleWhen: [{ when: { cel: 'row.hours == dec("1.00")' }, style: 'title' }] } : column,
                ),
              }
            : component,
        ),
      },
    }
    const removed = version((fields) => changed(fields, 'hours', () => undefined))
    expect(summary(itemsOf(reviewed(removed, strict)).items)).toEqual([['detail', 'hours', 'field.removed', true, ['remove']]])
    expect(summary(itemsOf(reviewed(removed)).items)).toEqual([['detail', 'hours', 'field.removed', true, ['print-nothing', 'remove']]])
  })

  // A field the version holds as another kind is refused per render
  // (0042). A type every version the report reads it from holds it as is
  // offered, each one; and the field read at its path printing nothing
  // from that version, or its removal, as for a field removed.
  test('offers each type both versions read a retyped field as', () => {
    const retyped = version((fields) => changed(fields, 'count', (field) => ({ ...field, type: 'number', step: 1 })))
    const review = itemsOf(reviewed(retyped))
    expect(summary(review.items)).toEqual([['header', 'count', 'field.typeChanged', true, ['print-nothing', 'retype', 'retype', 'remove']]])
    expect(review.items[0]?.code).toBe('version-retypes-field')
    const types = review.items[0]?.resolutions.filter((resolution) => resolution.kind === 'retype').map((resolution) => resolution.descriptor)
    expect(types?.map((descriptor) => (descriptor as { args: readonly unknown[] }).args[2])).toMatchObject([{ type: 'integer' }, { type: 'decimal' }])
    const counted = resolved(reviewed(retyped), 'count', 'retype')
    expect([headerOf(read(counted, retyped, { site: 'Bern', count: 4 }))['count'], headerOf(read(counted, V1, answered()))['count']]).toEqual(['4', '3'])
    // The first version holds the count as text, read as a number where it
    // spells one: a submission of it whose count is words printed as a
    // text, and is refused as a number. The kind is all a review can see,
    // so the retype says what it costs.
    expect(refusals(read(counted, V1, answered({ count: 'about three' })))).toEqual(['invalid-answer /submission/data/count'])
    expect(
      review.items[0]?.resolutions
        .filter((resolution) => resolution.kind === 'retype')
        .every((resolution) => resolution.message.includes('invalid-answer') && resolution.message.includes(schemaHash(V1))),
    ).toBe(true)
  })

  // A type the compiler would refuse an expression of is no retype the
  // review offers: a count never null appended to text is a string, and
  // as a number it would refuse every render. (One that may be null is
  // dyn to the compiler whatever its type, 0009.)
  test('offers no type an expression that reads the field would be refused at', () => {
    const appended: Component = { id: 'visits', kind: 'text', content: [{ kind: 'expression', expression: { cel: 'header.count + " visits"' } }] }
    const header = REPORT.datasets.header as DatasetContract
    const report: ReportDefinition = {
      ...REPORT,
      datasets: {
        ...REPORT.datasets,
        header: { ...header, fields: header.fields.map((field) => (field.id === 'count' ? { ...field, nullable: false } : field)) },
      },
      regions: { ...REPORT.regions, summary: [appended] },
    }
    const retyped = version((fields) => changed(fields, 'count', (field) => ({ ...field, type: 'number', step: 1 })))
    expect(summary(itemsOf(reviewed(retyped, report)).items)).toEqual([['header', 'count', 'field.typeChanged', true, ['print-nothing', 'remove']]])
  })

  // A field renamed and retyped in one version is not read by following
  // the rename: offered, it would be applied and the version still
  // refused. Its other resolutions are offered.
  test('offers no rename that would not lift the refusal alone', () => {
    const both = version((fields) => changed(fields, 'site', (field) => ({ ...field, key: 'address', renamedFrom: 'site', type: 'checkbox' })))
    expect(summary(itemsOf(reviewed(both)).items)).toEqual([['header', 'site', 'field.renamed', true, ['print-nothing', 'remove']]])
  })

  // A version that removed the detail's repeater, or holds another kind
  // there, leaves the detail no rows to read: only a rename of the
  // repeater its author declared reads them elsewhere, and nothing else is
  // offered -- the item says so, as the per-render refusal does, rather
  // than promise a resolution there is none of.
  test("offers nothing but a declared rename for the detail's repeater, and says so", () => {
    const removed = version((fields) => changed(fields, 'findings', () => undefined))
    const grouped = version((fields) => changed(fields, 'findings', (field) => ({ ...field, type: 'group' })))
    for (const [form, change] of [
      [removed, 'field.removed'],
      [grouped, 'field.typeChanged'],
    ] as const) {
      // A group's fields are the submission's own now, and said as added there.
      const review = itemsOf(reviewed(form))
      expect(summary(review.items.filter((item) => item.blocks))).toEqual([['detail', null, change, true, []]])
      expect(review.items[0]?.message).toContain('nothing but a rename')
      const refusal = read(REPORT, form, { site: 'Bern' })
      expect(refusal.ok ? '' : refusal.errors[0]?.message).toContain('nothing but a rename')
    }
  })

  // An option a field reads, removed, and a matrix row it reads, removed,
  // are refused per render: the item names what the diff says the version
  // did there, an option removed or the field changed.
  test('names the option or the row a version removed under a field it reads', () => {
    const ticked = formOf([
      {
        key: 'checks',
        type: 'selectboxes',
        label: 'Checked',
        options: [
          { value: 'roof', label: 'Roof' },
          { value: 'wiring', label: 'Wiring' },
        ],
      },
      {
        key: 'state',
        type: 'matrix',
        label: 'State',
        rows: [
          { value: 'roof', label: 'Roof' },
          { value: 'wall', label: 'Wall' },
        ],
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'bad', label: 'Bad' },
        ],
      },
    ])
    const report = generatedFrom(generate(ticked, { id: 'checks', locale: 'en' })).report
    const fewer = formOf([
      { key: 'checks', type: 'selectboxes', label: 'Checked', options: [{ value: 'wiring', label: 'Wiring' }] },
      {
        key: 'state',
        type: 'matrix',
        label: 'State',
        rows: [{ value: 'wall', label: 'Wall' }],
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'bad', label: 'Bad' },
        ],
      },
    ])
    expect(summary(itemsOf(reviewFormVersion(report, { form: fewer, versions: [ticked] })).items)).toEqual([
      ['header', 'checks_roof', 'field.optionRemoved', true, ['print-nothing', 'remove']],
      ['header', 'state_roof', 'field.changed', true, ['print-nothing', 'remove']],
    ])
  })

  // A type one version the report reads does not hold the field as would
  // refuse every submission of that version in turn: a tick box read as
  // text is no retype, since the earlier version's box is no text; nor is
  // a text that became a date read as a number, which the date is not.
  test('offers no type a version does not read the field as', () => {
    const boxed = formOf([{ key: 'done', type: 'checkbox', label: 'Done' }])
    const report = generatedFrom(generate(boxed, { id: 'done', locale: 'en' })).report
    const texted = formOf([{ key: 'done', type: 'text', label: 'Done' }])
    expect(summary(itemsOf(reviewFormVersion(report, { form: texted, versions: [boxed] })).items)).toEqual([
      ['header', 'done', 'field.typeChanged', true, ['print-nothing', 'remove']],
    ])
    const dated = version((fields) => changed(fields, 'count', (field) => ({ ...field, type: 'date' })))
    expect(summary(itemsOf(reviewed(dated)).items)).toEqual([['header', 'count', 'field.typeChanged', true, ['print-nothing', 'remove']]])
  })
})

describe('reviewFormVersion, a relabel', () => {
  // The form calls the field something else now. Its answers are where
  // they were, so it prints; but the report's texts still say the old
  // label, and the review offers the new one for each, never applying it:
  // a relabel is the author's to take (FB-Q6).
  test('offers the new label for every text that says the old, and applies none', () => {
    const relabelled = version((fields) => changed(fields, 'site', (field) => ({ ...field, label: 'Address' })))
    const review = itemsOf(reviewed(relabelled))
    expect([review.status, summary(review.items)]).toEqual(['review', [['header', 'site', 'field.relabelled', false, ['relabel']]]])
    expect(texts(REPORT)).toContain('Site: {field}')
    const applied = resolved(reviewed(relabelled), 'site', 'relabel')
    expect(texts(applied)).toContain('Address: {field}')
    expect(texts(applied)).not.toContain('Site: {field}')
    expect(applied.datasets.header?.fields[0]?.label).toBe('Address')
    expect(itemsOf(reviewed(relabelled, applied)).status).toBe('compatible')
  })

  // A column's heading over the field's value says its label too, and is
  // offered the new one; a heading of the same words over another field's
  // value is about that field, and is not touched.
  test("relabels a column's heading over the field's value, and no other column's", () => {
    const relabelled = version((fields) => changed(fields, 'area', (field) => ({ ...field, label: 'Zone' })))
    const table = walkComponents(REPORT).find(({ component }) => component.kind === 'table')?.component as Extract<Component, { kind: 'table' }>
    const other = {
      id: 'hours-again',
      header: 'Area',
      width: 60,
      align: 'right',
      value: { kind: 'field', field: { dataset: 'detail', field: 'hours' } },
    } as const
    const report: ReportDefinition = {
      ...REPORT,
      regions: {
        ...REPORT.regions,
        body: REPORT.regions.body.map((component) => (component.id === table.id ? { ...table, columns: [...table.columns, other] } : component)),
      },
    }
    const applied = resolved(reviewed(relabelled, report), 'area', 'relabel', report)
    const headers = (
      walkComponents(applied).find(({ component }) => component.kind === 'table')?.component as Extract<Component, { kind: 'table' }>
    ).columns.map(({ id, header }) => [id, header])
    expect(headers.filter(([, header]) => header === 'Zone')).toHaveLength(1)
    expect(headers).toContainEqual(['hours-again', 'Area'])
  })

  // A label held in the form's catalogue, changed there, relabels the
  // field as one changed on the field does: the diff names it a text
  // changed, and the review says so.
  test('relabels a field whose label the catalogue changed', () => {
    const catalogued = (label: string) =>
      formOf([{ key: 'site', type: 'text', label: { $t: 'site' } }], { i18n: { defaultLocale: 'en', messages: { en: { site: label } } } })
    const report = generatedFrom(generate(catalogued('Site'), { id: 'visit', locale: 'en' })).report
    expect(summary(itemsOf(reviewFormVersion(report, { form: catalogued('Address'), versions: [catalogued('Site')] })).items)).toEqual([
      ['header', 'site', 'text.changed', false, ['relabel']],
    ])
  })

  // A line says a field's label before the run that prints it: a text
  // that says the same words before another field's value is about that
  // field, and is not touched.
  test("relabels only a text that says the label before the field's own value", () => {
    const relabelled = version((fields) => changed(fields, 'site', (field) => ({ ...field, label: 'Address' })))
    const other: Component = {
      id: 'other',
      kind: 'text',
      content: [
        { kind: 'text', text: 'Site: ' },
        { kind: 'field', field: { dataset: 'header', field: 'count' } },
      ],
    }
    const report: ReportDefinition = { ...REPORT, regions: { ...REPORT.regions, summary: [other] } }
    const applied = resolved(reviewed(relabelled, report), 'site', 'relabel', report)
    expect(texts(applied)).toEqual(expect.arrayContaining(['Address: {field}', 'Site: {field}']))
    expect(applied.regions.summary).toEqual([other])
  })

  // A label the format cannot hold -- a field's past MAX_LABEL_LENGTH --
  // is no relabel the session would take: none is offered, and the item
  // still says the form labels the field otherwise.
  test('offers no relabel the report cannot hold', () => {
    const relabelled = version((fields) => changed(fields, 'site', (field) => ({ ...field, label: 'A'.repeat(201) })))
    expect(summary(itemsOf(reviewed(relabelled)).items)).toEqual([['header', 'site', 'field.relabelled', false, []]])
    // A label no font draws, or none at all, is no label to print: nothing is said of it.
    // A direction override would show the report's label in another order than it prints, in the builder that edits it.
    for (const label of ['Ort\u0007', ' ', 'Ort\u202Elinks', 'Ort\u2028Zeile'])
      expect(itemsOf(reviewed(version((fields) => changed(fields, 'site', (field) => ({ ...field, label })))))).toMatchObject({
        status: 'compatible',
        items: [],
      })
  })

  // A ticked option prints its option's label as its line's: that label,
  // relabelled, is the one offered, not the field's.
  test("relabels an option a field reads by the option's label", () => {
    const ticked = formOf([
      {
        key: 'checks',
        type: 'selectboxes',
        label: 'Checked',
        options: [
          { value: 'roof', label: 'Roof' },
          { value: 'wiring', label: 'Wiring' },
        ],
      },
    ])
    const report = generatedFrom(generate(ticked, { id: 'checks', locale: 'en' })).report
    const relabelled = formOf([
      {
        key: 'checks',
        type: 'selectboxes',
        label: 'Checked',
        options: [
          { value: 'roof', label: 'Roof and gutters' },
          { value: 'wiring', label: 'Wiring' },
        ],
      },
    ])
    const review = reviewFormVersion(report, { form: relabelled, versions: [ticked] })
    expect(summary(itemsOf(review).items)).toEqual([['header', 'checks_roof', 'field.optionRelabelled', false, ['relabel']]])
    expect(texts(resolved(review, 'checks_roof', 'relabel', report))).toContain('Roof and gutters: {expression}')
  })

  // The texts a report prints are its author's: one that says the label
  // no more -- reworded by hand -- is not touched, and with none left to
  // say it, nothing is offered.
  test('offers nothing for a label no text says any more', () => {
    const relabelled = version((fields) => changed(fields, 'area', (field) => ({ ...field, label: 'Zone' })))
    const reworded = sessionOf()
    const table = walkComponents(REPORT).find(({ component }) => component.kind === 'table')?.component as Extract<Component, { kind: 'table' }>
    const column = table.columns.find((each) => each.header === 'Area')
    const changedHeader = reworded.apply({ command: 'updateColumn', args: [table.id, column?.id as string, { header: 'Location' }] })
    if (!changedHeader.ok) throw new Error(changedHeader.message)
    const fields = (REPORT.datasets.detail?.fields ?? []).map((field) => (field.id === 'area' ? { ...field, label: 'Location' } : field))
    const done = reworded.apply({
      command: 'putDataset',
      args: ['detail', { ...(REPORT.datasets.detail as NonNullable<ReportDefinition['datasets']['detail']>), fields }],
    })
    if (!done.ok) throw new Error(done.message)
    expect(itemsOf(reviewed(relabelled, reworded.document())).status).toBe('compatible')
    expect(summary(itemsOf(reviewed(relabelled)).items)).toEqual([['detail', 'area', 'field.relabelled', false, ['relabel']]])
  })
})

describe('reviewFormVersion, other reports', () => {
  // A report of one row per submission reads its fields in the
  // submission's scope, as a report of one does; its review follows a
  // rename there.
  test('reviews a report of one row per submission as it reviews one of one', () => {
    const report = generatedFrom(generate(V1, { id: 'visits', locale: 'en', detail: { kind: 'submissions' } })).report
    const renamed = version((fields) => changed(fields, 'site', (field) => ({ ...field, key: 'address', renamedFrom: 'site' })))
    expect(summary(itemsOf(reviewed(renamed, report)).items)).toEqual([['detail', 'site', 'field.renamed', true, ['follow-rename', 'print-nothing', 'remove']]])
  })

  // A report written by hand names no version it was made from: a moved
  // field is refused as for any report, and with no version to compare
  // the new one with, nothing says where it went -- no rename offered, no
  // change named, no field said added. Nothing is guessed.
  test('offers a report that names no version no rename, and names no change', () => {
    const { provenance: _provenance, ...rest } = REPORT
    const blank = { ...rest, provenance: { kind: 'blank' } } as ReportDefinition
    const renamed = version((fields) => [
      ...changed(fields, 'site', (field) => ({ ...field, key: 'address', renamedFrom: 'site' })),
      { key: 'remarks', type: 'text', label: 'Remarks' },
    ])
    expect(summary(itemsOf(reviewFormVersion(blank, { form: renamed })).items)).toEqual([['header', 'site', null, true, ['print-nothing', 'remove']]])
  })

  // The QR-bill is changed by its own commands alone (0039): a field it
  // reads is offered no removal, which report-core's command refuses; and
  // nothing printed of it, nor another type, either of which would change
  // what the bill asks for -- whom it names, what amount -- under another
  // command's name, or refuse every final render of the version. The
  // item says why nothing is offered; a declared rename, which reads the
  // same answer from where it moved, is.
  test('offers nothing that changes what the QR-bill reads, and says so', () => {
    const text = (value: string) => [{ kind: 'text', text: value }] as const
    const billed = {
      ...REPORT,
      paymentPart: {
        kind: 'swissQrBill',
        language: 'de',
        account: text('CH58 3000 0000 0000 0000 0'),
        creditor: {
          name: text('Muster AG'),
          street: text('Musterstrasse'),
          buildingNumber: text('1'),
          postalCode: text('8000'),
          town: text('Zürich'),
          country: text('CH'),
        },
        currency: 'CHF',
        debtor: { name: [{ kind: 'field', field: { dataset: 'header', field: 'site' } }], postalCode: text('3011'), town: text('Bern'), country: text('CH') },
        reference: text('21 00000 00003 13947 14300 09017'),
      },
    } as unknown as ReportDefinition
    const removed = version((fields) => changed(fields, 'site', () => undefined))
    const review = itemsOf(reviewed(removed, billed))
    expect(summary(review.items)).toEqual([['header', 'site', 'field.removed', true, []]])
    expect(review.items[0]?.message).toContain('payment part')
    const renamed = version((fields) => changed(fields, 'site', (field) => ({ ...field, key: 'address', renamedFrom: 'site' })))
    expect(summary(itemsOf(reviewed(renamed, billed)).items)).toEqual([['header', 'site', 'field.renamed', true, ['follow-rename']]])
  })

  // So is the e-invoice: printing nothing of the amount a version no
  // longer asks for as paid would leave the XML's prepaid amount out and
  // its amount due higher, an invoice that says another thing.
  test('offers nothing that changes what the e-invoice reads, and says so', () => {
    const { report, form } = invoiceFromForm()
    const unpaid = { ...form, model: { fields: (form.model as { fields: Field[] }).fields.filter(({ key }) => key !== 'paid') } }
    const review = itemsOf(reviewFormVersion(report, { form: unpaid, versions: [form] }))
    expect(summary(review.items)).toEqual([['header', 'paid', 'field.removed', true, []]])
    expect(review.items[0]?.message).toContain('e-invoice')
  })

  // A removal the session would refuse is not offered: the e-invoice
  // prints its lines by the table's columns, and a field whose column it
  // names, removed with that column, would leave a report the validator
  // refuses.
  test('offers no removal the session would refuse', () => {
    const { report, form } = invoiceFromForm()
    const fields = (form.model as { fields: Field[] }).fields
    const priceless = {
      ...form,
      model: {
        fields: fields.map((field) => (field.key === 'lines' ? { ...field, fields: (field.fields ?? []).filter(({ key }) => key !== 'unitPrice') } : field)),
      },
    }
    const opening = openReportSession(report)
    if (!opening.ok) throw new Error('the report did not open')
    const refusal = opening.session.apply({ command: 'removeFieldWithReaders', args: ['detail', 'unitPrice'] })
    expect(refusal.ok ? 'applied' : refusal.code).toBe('invalid-document')
    const item = itemsOf(reviewFormVersion(report, { form: priceless, versions: [form] })).items.find((each) => each.field === 'unitPrice')
    expect([item?.blocks, item?.resolutions.map((resolution) => resolution.kind).includes('remove')]).toEqual([true, false])
  })

  // formancy lets a version change its form's id, and calls that a lossy
  // change: a version of another id may be another form, whose fields the
  // report reads wherever they share a key. Nothing per render refuses it,
  // so the review blocks nothing, and says so rather than call it
  // compatible.
  test('says a version names its form otherwise than the version the report was made from', () => {
    const other = { ...V1, id: 'payroll-2027' }
    expect(itemsOf(reviewed(other))).toMatchObject({
      status: 'review',
      items: [{ path: '/provenance', change: 'document.identityChanged', blocks: false, resolutions: [] }],
    })
    expect(itemsOf(reviewed(other)).items[0]).not.toHaveProperty('dataset')
  })

  // A version that blocks one field and relabels another is blocked: its
  // submissions are refused until the one is resolved, whatever the other
  // prints like.
  test('is blocked where one item blocks, whatever else prints', () => {
    const both = version((fields) =>
      changed(
        changed(fields, 'count', () => undefined),
        'site',
        (field) => ({ ...field, label: 'Address' }),
      ),
    )
    const review = itemsOf(reviewed(both))
    expect([review.status, summary(review.items).map(([, field, , blocks]) => [field, blocks])]).toEqual([
      'blocked',
      [
        ['site', false],
        ['count', true],
      ],
    ])
  })

  // A version an override of the detail's repeater names is one the
  // review compares with, as a field's are: not handed over, it is
  // missing.
  test("needs the version an override of the detail's repeater names", () => {
    const renamed = version((fields) => changed(fields, 'findings', (field) => ({ ...field, key: 'defects', renamedFrom: 'findings' })))
    const followed = resolved(reviewed(renamed), undefined, 'follow-rename')
    const missing = reviewFormVersion(followed, { form: V1, versions: [] })
    expect(missing.ok ? [] : missing.errors.map((error) => `${error.code} ${error.message.includes(schemaHash(renamed))}`)).toEqual(['missing-version true'])
  })
})

describe('reviewFormVersion, applying a resolution', () => {
  const renamed = version((fields) => changed(fields, 'site', (field) => ({ ...field, key: 'address', renamedFrom: 'site' })))

  // A resolution is computed for one report. Applied to a report edited
  // since, it could undo the edit or apply to something else: the
  // session refuses it as stale, and nothing changes.
  test('refuses a stale resolution, changing nothing', () => {
    const resolution = itemsOf(reviewed(renamed)).items[0]?.resolutions[0]
    if (resolution === undefined) throw new Error('nothing offered')
    expect(resolution.expectedHash).toBe(reportHash(REPORT))
    const session = sessionOf()
    const edited = session.apply({ command: 'setTitle', args: ['Visit, edited'] })
    if (!edited.ok) throw new Error(edited.message)
    const before = session.document()
    const outcome = session.apply(resolution.descriptor, { expectedHash: resolution.expectedHash })
    expect([outcome.ok ? 'applied' : outcome.code, session.document() === before, session.revision()]).toEqual(['stale-document', true, 1])
  })

  // A resolution travels as JSON to whoever applies it, and comes back
  // from a browser as data nobody type-checked: one that would leave a
  // report the validator refuses is refused whole, every command of it.
  test('refuses whole a resolution that would leave an invalid report', () => {
    const relabelled = version((fields) => changed(fields, 'site', (field) => ({ ...field, label: 'Address' })))
    const resolution = itemsOf(reviewed(relabelled)).items[0]?.resolutions[0]
    if (resolution === undefined) throw new Error('nothing offered')
    const tampered = JSON.parse(JSON.stringify(resolution.descriptor)) as { command: 'batch'; args: [unknown[]] }
    expect(tampered.command).toBe('batch')
    tampered.args[0].push({
      command: 'putField',
      args: ['header', 'site', { type: 'string', label: 'Address', nullable: false, form: { path: 'site', overrides: { v2: { path: 'x' } } } }],
    })
    const session = sessionOf()
    const before = session.document()
    const outcome = session.apply(tampered as unknown as CommandDescriptor, { expectedHash: resolution.expectedHash })
    expect([outcome.ok ? 'applied' : outcome.code, session.document() === before, session.revision()]).toEqual(['invalid-document', true, 0])
  })

  // Every resolution offered is one a session takes, and one undo puts
  // the report back as it was.
  test('applies each resolution as one undo step', () => {
    const review = itemsOf(reviewed(renamed))
    for (const resolution of review.items.flatMap((item) => item.resolutions)) {
      const session = sessionOf()
      const outcome = session.apply(resolution.descriptor, { expectedHash: resolution.expectedHash })
      expect(outcome.ok, resolution.kind).toBe(true)
      expect(session.revision()).toBe(1)
      session.undo()
      expect(session.document()).toEqual(REPORT)
    }
  })
})

describe('reviewFormVersion, what it is handed', () => {
  // A review compares the new version with the one the report was made
  // from, and with each its overrides read: one not handed over would
  // leave a declared rename unseen, so it is refused, by the hash it is
  // missing.
  test('refuses a review missing a version the report names', () => {
    const outcome = reviewFormVersion(REPORT, { form: V1, versions: [] })
    expect(outcome.ok ? [] : outcome.errors.map((error) => `${error.code} ${error.path}`)).toEqual([])
    const renamed = version((fields) => changed(fields, 'site', (field) => ({ ...field, key: 'address', renamedFrom: 'site' })))
    const missing = reviewFormVersion(REPORT, { form: renamed, versions: [] })
    expect(missing.ok ? [] : missing.errors.map((error) => `${error.code} ${error.path}`)).toEqual(['missing-version /versions'])
    expect(missing.ok ? '' : missing.errors[0]?.message).toContain(schemaHash(V1))
    // A version the report names nowhere is no harm: it is compared with nothing, and a rename followed keeps it reading where it read (review-later.test.ts).
    expect(itemsOf(reviewFormVersion(REPORT, { form: V1, versions: [V1, renamed] })).status).toBe('compatible')
    // As many versions as a read is handed forms, and no more: the list is refused before one is read.
    const many = reviewFormVersion(REPORT, { form: V1, versions: Array.from({ length: MAX_DETAIL_ROWS + 1 }, () => V1) })
    expect(many.ok ? [] : many.errors.map((error) => `${error.code} ${error.path}`)).toEqual(['too-many-rows /versions'])
  })

  // The versions are untrusted as a submission's are (0042): validated,
  // named by the hash computed of each, a hash the host gives compared;
  // the report the validator's.
  test('refuses what is no report, no version, or no binding to a form', () => {
    const errors = (outcome: FormReview) => (outcome.ok ? [] : outcome.errors.map((error) => `${error.code} ${error.path}`))
    expect(errors(reviewFormVersion({ ...REPORT, locale: 'deutsch' }, { form: V1, versions: [V1] }))).toEqual(['invalid-report '])
    expect(errors(reviewFormVersion(REPORT, { form: { specVersion: '4' }, versions: [V1] }))[0]).toMatch(/^invalid-form \/form/)
    expect(errors(reviewFormVersion(REPORT, { form: V1, formHash: '0'.repeat(64), versions: [V1] }))).toEqual(['hash-mismatch /formHash'])
    expect(errors(reviewFormVersion(REPORT, { form: V1, versions: [{ specVersion: '9' }] }))).toEqual(['unsupported-spec-version /versions/0/specVersion'])
    expect(errors(reviewFormVersion(REPORT, { form: V1, versions: [V1], also: true } as never))).toEqual(['invalid-input /also'])
    expect(errors(reviewFormVersion(REPORT, { form: V1, versions: V1 } as never))).toEqual(['invalid-input /versions'])
    const { datasets: _datasets, ...rest } = REPORT
    expect(errors(reviewFormVersion({ ...rest, datasets: {}, regions: { ...REPORT.regions, body: [] } }, { form: V1, versions: [V1] }))).toEqual([
      'unbound-report /datasets',
    ])
  })

  // What a review says ends up before a person and in a log: it names the
  // report's own fields, data paths of field keys and hashes, and never a
  // label or an answer of the form's, which may name a person.
  test('says no label of either version', () => {
    const named = (label: string) =>
      formOf([
        { key: 'site', type: 'text', label: `${label} site` },
        { key: 'inspector', type: 'group', label: `${label} group`, fields: [{ key: 'name', type: 'text', label: `${label} name` }] },
        { key: 'count', type: 'text', label: `${label} count` },
      ])
    const before = named('Erika Mustermann')
    const report = generatedFrom(generate(before, { id: 'visit', locale: 'en' })).report
    const after = {
      ...named('Hans Muster'),
      model: {
        fields: [
          { key: 'address', type: 'text', label: 'Hans Muster site', renamedFrom: 'site' },
          { key: 'inspector', type: 'group', label: 'Hans Muster group', fields: [{ key: 'name', type: 'text', label: 'Hans Muster name' }] },
          { key: 'count', type: 'number', label: 'Hans Muster count' },
        ],
      },
    }
    const review = itemsOf(reviewFormVersion(report, { form: after, versions: [before] }))
    // A rename, a relabel and a retype, each with what resolves it.
    expect(review.items.map((item) => item.resolutions[0]?.kind)).toEqual(['follow-rename', 'relabel', 'print-nothing'])
    const said = JSON.stringify(review.items.map((item) => [item.message, item.resolutions.map((resolution) => resolution.message)]))
    expect(said).not.toMatch(/Erika|Mustermann|Hans|Muster/)
  })
})
