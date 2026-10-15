import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { CommandOutcome } from '../outcome.js'
import { accepted, frozen, frozenSample, refused, sampleReport } from '../test-support.js'
import {
  moveParameter,
  putAggregate,
  putAsset,
  putDataset,
  putField,
  putParameter,
  putStyle,
  removeAggregate,
  removeAsset,
  removeDataset,
  removeField,
  removeParameter,
  removeStyle,
} from './declarations.js'

/** One declaration list: how to read it, how to put and remove an entry, and a body to put. */
interface ListCase {
  readonly name: string
  readonly path: string
  readonly read: (report: ReportDefinition) => readonly { readonly id: string }[]
  readonly put: (report: ReportDefinition, id: string) => CommandOutcome
  readonly remove: (report: ReportDefinition, id: string) => CommandOutcome
  readonly existing: string
}

const LISTS: readonly ListCase[] = [
  {
    name: 'styles',
    path: '/styles',
    read: (report) => report.styles,
    put: (report, id) => putStyle(report, id, { bold: false, size: 12 }),
    remove: removeStyle,
    existing: 'body',
  },
  {
    name: 'parameters',
    path: '/parameters',
    read: (report) => report.parameters,
    put: (report, id) => putParameter(report, id, { type: 'string', label: 'Note', required: false }),
    remove: removeParameter,
    existing: 'draft',
  },
  {
    name: 'assets',
    path: '/assets',
    read: (report) => report.assets,
    put: (report, id) => putAsset(report, id, { mediaType: 'image/png', digest: `sha256:${'cd'.repeat(32)}` }),
    remove: removeAsset,
    existing: 'seal',
  },
  {
    name: 'aggregates',
    path: '/aggregates',
    read: (report) => report.aggregates,
    put: (report, id) => putAggregate(report, id, { fn: 'count' }),
    remove: removeAggregate,
    existing: 'gross',
  },
  {
    name: 'detail fields',
    path: '/datasets/detail/fields',
    read: (report) => report.datasets.detail?.fields ?? [],
    put: (report, id) => putField(report, 'detail', id, { type: 'string', label: 'Note', nullable: true }),
    remove: (report, id) => removeField(report, 'detail', id),
    existing: 'shipped',
  },
]

describe.each(LISTS)('$name', ({ path, read, put, remove, existing }) => {
  // A put is how the builder both adds and edits a declaration: a new id is
  // appended, so the order an author sees does not jump.
  test('a put with a new id appends the declaration', () => {
    const report = frozenSample()
    const next = read(accepted(put(report, 'added')))
    expect(next.map(({ id }) => id)).toEqual([...read(report).map(({ id }) => id), 'added'])
  })

  // Editing a declaration in a property panel must not move it to the end of
  // the list, which a remove-then-append would.
  test('a put with an existing id replaces it where it stands', () => {
    const report = frozenSample()
    const before = read(report)
    const next = read(accepted(put(report, existing)))
    expect(next.map(({ id }) => id)).toEqual(before.map(({ id }) => id))
    const index = before.findIndex(({ id }) => id === existing)
    expect(next[index]).not.toEqual(before[index])
    expect(next.filter((_, at) => at !== index)).toEqual(before.filter((_, at) => at !== index))
  })

  // Removing is by id, and only that entry goes.
  test('a remove takes out the declaration with that id', () => {
    const report = frozenSample()
    const next = read(accepted(remove(report, existing)))
    expect(next.map(({ id }) => id)).toEqual(read(report).flatMap(({ id }) => (id === existing ? [] : [id])))
  })

  // A remove of nothing is a mistake the caller should hear about, not an
  // undo step that changed nothing.
  test('a remove of an id the list does not have is refused', () => {
    const refusal = refused(remove(frozenSample(), 'nowhere'))
    expect(refusal).toMatchObject({ code: 'not-found', path })
  })
})

describe('datasets', () => {
  // A dataset is put and removed by its role: a report has one of each.
  test('are put and removed by role', () => {
    const report = frozenSample()
    const contract = { id: 'visit', fields: [{ id: 'site', type: 'string', label: 'Site', nullable: false }] } as const
    expect(accepted(putDataset(report, 'header', contract)).datasets).toEqual({ ...sampleReport().datasets, header: contract })
    expect(accepted(removeDataset(report, 'detail')).datasets).toEqual({ header: sampleReport().datasets.header })
  })

  // A field put into, or removed from, a dataset the report does not declare
  // has nowhere to go; refusing names the dataset.
  test('refuse a field edit, or a remove, where no dataset of that role is declared', () => {
    const report = frozen(accepted(removeDataset(frozenSample(), 'header')))
    expect(refused(removeDataset(report, 'header'))).toMatchObject({ code: 'not-found', path: '/datasets/header' })
    expect(refused(putField(report, 'header', 'site', { type: 'string', label: 'Site', nullable: false }))).toMatchObject({ code: 'not-found', path: '/datasets/header' })
    expect(refused(removeField(report, 'header', 'customer'))).toMatchObject({ code: 'not-found', path: '/datasets/header' })
  })
})

describe('moveParameter', () => {
  // The parameter form shows parameters in this order, so moving one is an
  // edit an author makes; the index is where it ends up.
  test('moves a parameter to the index it ends at', () => {
    const report = frozenSample()
    expect(accepted(moveParameter(report, 'from', 2)).parameters.map(({ id }) => id)).toEqual(['draft', 'threshold', 'from', 'currency', 'copies'])
    expect(accepted(moveParameter(report, 'copies', 0)).parameters.map(({ id }) => id)).toEqual(['copies', 'from', 'draft', 'threshold', 'currency'])
  })

  // An index past the end is refused rather than clamped, so a keyboard
  // "move down" on the last parameter and a drop past the end both say so.
  test('refuses an index outside the list, and a parameter the report lacks', () => {
    const report = frozenSample()
    expect(refused(moveParameter(report, 'from', 5))).toMatchObject({ code: 'index-out-of-range', path: '/parameters' })
    expect(refused(moveParameter(report, 'from', -1))).toMatchObject({ code: 'index-out-of-range' })
    expect(refused(moveParameter(report, 'from', 1.5))).toMatchObject({ code: 'index-out-of-range' })
    expect(refused(moveParameter(report, 'nowhere', 0))).toMatchObject({ code: 'not-found', path: '/parameters' })
  })
})
