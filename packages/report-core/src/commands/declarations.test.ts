import { isIdentifier, reportHash } from '@formancy/report-spec'
import type { AssetRef, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { CommandOutcome } from '../outcome.js'
import { openReportSession } from '../session.js'
import type { ReportSession } from '../session.js'
import { accepted, frozen, frozenSample, refused, sampleReport } from '../test-support.js'
import { insertComponent } from './components.js'
import {
  addAsset,
  moveParameter,
  nextAssetId,
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

/** An asset's body, as a builder declares one a person added: the digest is any the format accepts. */
const STAMP: Omit<AssetRef, 'id'> = { mediaType: 'image/svg+xml', digest: `sha256:${'5e'.repeat(32)}` }

describe('nextAssetId', () => {
  // A builder names an image a person adds after its file, and the host
  // keeps the bytes under that id before the report declares it (0033). An
  // id the report already declares would be refused only after that, or
  // name another image.
  test('is the base when it is free, and the base numbered from 2 when not', () => {
    const report = frozenSample()
    expect(nextAssetId(report, 'stamp')).toBe('stamp')
    expect(nextAssetId(report, 'logo')).toBe('logo-2')
    const taken = accepted(addAsset(report, 'logo-2', STAMP))
    expect(nextAssetId(taken, 'logo')).toBe('logo-3')
  })

  // The base is a file's name, folded: its own number is part of the name a
  // person recognises. A second IMG_4711.png announced as "img-2" would be
  // read as another photo's, and a second 2024.jpg as "image-2" as no year.
  test('numbers a base that ends in a number as it stands', () => {
    const report = ['img-4711', 'image-2024', 'logo-2'].reduce((declared, id) => accepted(addAsset(declared, id, STAMP)), frozenSample())
    expect(nextAssetId(report, 'img-4711')).toBe('img-4711-2')
    expect(nextAssetId(report, 'image-2024')).toBe('image-2024-2')
    expect(nextAssetId(report, 'logo-2')).toBe('logo-2-2')
  })

  // A builder hands a host the bytes under the id before the report
  // declares it, and an undo can declare an id again that a remove took:
  // an id a host was handed for other bytes is taken too, so that a host
  // keyed by it never holds two images under one id.
  test('counts as taken the ids it is given besides the report’s', () => {
    const report = frozenSample()
    expect(nextAssetId(report, 'stamp', new Set(['stamp']))).toBe('stamp-2')
    expect(nextAssetId(report, 'logo', new Set(['logo-2']))).toBe('logo-3')
  })

  // Assets are a namespace of their own (0007): a component called
  // logo-image does not take the asset id, and an asset id taken is taken
  // whatever draws it.
  test('counts asset ids alone, never component ids', () => {
    const report = frozenSample()
    expect(report.assets.map(({ id }) => id)).not.toContain('logo-image')
    expect(nextAssetId(report, 'logo-image')).toBe('logo-image')
    expect(nextAssetId(report, 'seal')).toBe('seal-2')
  })

  // An id is at most 64 characters; a long base is shortened so that its
  // number fits, and every id it gives is one the validator accepts.
  test('keeps a long base within the identifier rule', () => {
    const long = `a${'b'.repeat(63)}`
    const report = accepted(addAsset(frozenSample(), long, STAMP))
    expect(nextAssetId(report, long)).toBe(`a${'b'.repeat(61)}-2`)
    for (const base of ['a', 'a-', 'a--', `a${'-'.repeat(63)}`, `a${'9'.repeat(63)}`]) {
      const crowded = accepted(addAsset(frozenSample(), base, STAMP))
      expect(isIdentifier(nextAssetId(crowded, base)), base).toBe(true)
    }
  })

  // A base that is not an identifier would give an id the validator
  // refuses; that is a mistake in the caller, said where it is made.
  test('throws a RangeError for a base that is not an identifier', () => {
    expect(() => nextAssetId(frozenSample(), 'Logo Müller')).toThrow(RangeError)
  })
})

describe('addAsset', () => {
  // A person's image is appended, so the report's properties list it last
  // and the palette's Image, which draws the newest, draws it.
  test('appends the asset', () => {
    const report = frozenSample()
    expect(accepted(addAsset(report, 'stamp', STAMP)).assets).toEqual([...sampleReport().assets, { id: 'stamp', ...STAMP }])
  })

  // putAsset replaces by id. While a host kept a person's image, the report
  // may have come to declare another asset under the same id; a put would
  // swap that image for this one, unseen, so an add is refused instead.
  test('refuses an id the report already declares, and replaces nothing', () => {
    const report = frozenSample()
    expect(refused(addAsset(report, 'logo', STAMP))).toMatchObject({ code: 'already-declared', path: '/assets', message: 'an asset is already declared as "logo"; an add never replaces one' })
    expect(report).toEqual(sampleReport())
  })
})

describe('an asset added or removed in a session', () => {
  function open(report: ReportDefinition = sampleReport()): ReportSession {
    const opening = openReportSession(report)
    if (!opening.ok) throw new Error('the report did not open')
    return opening.session
  }

  // Adding a person's image is one step: undo takes the declaration back
  // whole, and redo gives it back, so a toolbar's Undo after an upload
  // leaves the report as it was.
  test('an add is one undo step', () => {
    const session = open()
    const before = session.document()
    expect(session.apply((report) => addAsset(report, 'stamp', STAMP), { label: 'Add image' }).ok).toBe(true)
    expect(session.revision()).toBe(1)
    expect(session.undoLabel()).toBe('Add image')
    expect(session.undo()).toBe(true)
    expect(session.document()).toBe(before)
    expect(session.canUndo()).toBe(false)
    expect(session.redo()).toBe(true)
    expect(session.document().assets.at(-1)).toEqual({ id: 'stamp', ...STAMP })
  })

  // Removing an image nothing draws is one step, and undoing it puts it
  // back where it stood, not at the end.
  test('a remove of an asset nothing draws is one undo step, undone where it stood', () => {
    const unused = { ...sampleReport(), assets: [{ id: 'spare', ...STAMP }, ...sampleReport().assets] }
    const session = open(unused)
    const before = session.document()
    expect(session.apply((report) => removeAsset(report, 'spare')).ok).toBe(true)
    expect(session.document().assets.map(({ id }) => id)).toEqual(['logo', 'seal'])
    expect(session.undo()).toBe(true)
    expect(session.document()).toBe(before)
    expect(session.document().assets.map(({ id }) => id)).toEqual(['spare', 'logo', 'seal'])
  })

  // A refused edit changes nothing (0008): not the document, its revision,
  // its hash or what undo would take back. An image drawn by a component is
  // refused with the validator's reason at the place that draws it, so a
  // builder can say what draws it.
  test.each([
    ['an add under an id already declared', (report: ReportDefinition) => addAsset(report, 'seal', STAMP), { code: 'already-declared' }],
    ['a remove of an asset an image draws', (report: ReportDefinition) => removeAsset(report, 'seal'), { code: 'invalid-document', errors: expect.arrayContaining([expect.objectContaining({ code: 'unknown-asset', path: expect.stringMatching(/\/source\/asset$/) })]) }],
  ])('%s changes nothing', (_, command, refusal) => {
    const session = open()
    expect(session.apply((report) => insertComponent(report, { region: 'body', index: 0 }, { id: 'gap-2', kind: 'spacer', height: 4 })).ok).toBe(true)
    const [document, revision, hash, label] = [session.document(), session.revision(), session.hash(), session.undoLabel()]
    expect(refused(session.apply(command))).toMatchObject(refusal)
    expect([session.document(), session.revision(), session.hash(), session.undoLabel()]).toEqual([document, revision, hash, label])
    expect(session.document()).toBe(document)
    expect(reportHash(session.document())).toBe(hash)
  })
})
