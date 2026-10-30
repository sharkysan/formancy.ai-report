import { COMPONENT_KINDS, componentAt, isIdentifier, walkComponents } from '@formancy/report-spec'
import type { Component, EpcQrCodeComponent, ReportDefinition, TextComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { Location } from '../tree.js'
import { accepted, frozenSample, idsIn, refused, sampleReport } from '../test-support.js'
import { duplicateComponent, insertComponent, moveComponent, nextComponentId, removeComponent, updateComponent } from './components.js'

const note = (id: string): TextComponent => ({ id, kind: 'text', content: [{ kind: 'text', text: id }] })

/** The ids of a region's top-level components, or of a container's, as `where` names it. */
function idsAt(report: ReportDefinition, where: string): string[] {
  const [region, parent, column] = where.split(':')
  const list =
    parent === undefined
      ? report.regions[region as keyof ReportDefinition['regions']]
      : ((): readonly Component[] => {
          const found = componentAt(report, parent)?.component
          if (found?.kind === 'columns') return found.columns[Number(column)]?.components ?? []
          return found !== undefined && 'components' in found ? found.components : []
        })()
  return list.map(({ id }) => id)
}

describe('insertComponent', () => {
  // The palette drops a component at a place in a region or a container;
  // each kind of place is reached by the same location shape.
  test.each([
    ['at the start of a region', { region: 'body', index: 0 }, 'body', ['new', 'intro', 'gap', 'lines', 'keep', 'break']],
    ['between two components', { region: 'body', index: 2 }, 'body', ['intro', 'gap', 'new', 'lines', 'keep', 'break']],
    ['at the end of a region', { region: 'body', index: 5 }, 'body', ['intro', 'gap', 'lines', 'keep', 'break', 'new']],
    ['into an empty region', { region: 'pageHeader', index: 1 }, 'pageHeader', ['running-title', 'new']],
    ['into a keep-together block', { region: 'body', parent: 'keep', index: 1 }, 'body:keep', ['box', 'new', 'note']],
    ['into a section', { region: 'summary', parent: 'closing', index: 3 }, 'summary:closing', ['threshold', 'statistics', 'signature-image', 'new']],
    ['into a column of a columns block', { region: 'reportHeader', parent: 'heading', column: 1, index: 0 }, 'reportHeader:heading:1', ['new', 'title']],
  ] as const)('places a component %s', (_name, location, where, ids) => {
    const report = frozenSample()
    const next = accepted(insertComponent(report, location, note('new')))
    expect(idsAt(next, where)).toEqual(ids)
    expect(componentAt(next, 'new')?.component).toEqual(note('new'))
  })

  // Everything outside the list that changed is the same object, so the
  // builder redraws only the part of the page that moved.
  test('shares every region and component it did not touch', () => {
    const report = frozenSample()
    const next = accepted(insertComponent(report, { region: 'body', parent: 'keep', index: 0 }, note('new')))
    expect(next.regions.summary).toBe(report.regions.summary)
    expect(next.regions.body[2]).toBe(report.regions.body[2])
    expect(next.regions.body[3]).not.toBe(report.regions.body[3])
  })

  // A drop target the builder computed wrongly is refused with a reason a
  // program can act on, never clamped into a place nobody chose: a keyboard
  // move and a pointer drop past the end then agree.
  test.each([
    ['a parent the report lacks', { region: 'body', parent: 'nowhere', index: 0 }, 'not-found'],
    ['a parent that holds nothing', { region: 'body', parent: 'intro', index: 0 }, 'not-a-container'],
    ['an EPC QR code, which holds nothing', { region: 'summary', parent: 'payment-code', index: 0 }, 'not-a-container'],
    ['a parent in another region', { region: 'summary', parent: 'keep', index: 0 }, 'invalid-location'],
    ['a column with no parent', { region: 'body', column: 0, index: 0 }, 'invalid-location'],
    ['a column of a block that is not columns', { region: 'body', parent: 'keep', column: 0, index: 0 }, 'invalid-location'],
    ['a columns block without a column', { region: 'reportHeader', parent: 'heading', index: 0 }, 'invalid-location'],
    ['a column the block lacks', { region: 'reportHeader', parent: 'heading', column: 2, index: 0 }, 'index-out-of-range'],
    ['an index past the end', { region: 'body', index: 6 }, 'index-out-of-range'],
    ['a negative index', { region: 'body', index: -1 }, 'index-out-of-range'],
    ['an index that is not whole', { region: 'body', index: 0.5 }, 'index-out-of-range'],
  ] as const)('refuses %s', (_name, location: Location, code) => {
    expect(refused(insertComponent(frozenSample(), location, note('new'))).code).toBe(code)
  })
})

describe('removeComponent', () => {
  // Deleting a selected component, at any depth, takes it and what it holds.
  test('removes a component, with whatever it holds, at any depth', () => {
    const report = frozenSample()
    expect(idsIn(accepted(removeComponent(report, 'keep')).regions.body)).toEqual(['intro', 'gap', 'lines', 'break'])
    expect(idsAt(accepted(removeComponent(report, 'title')), 'reportHeader:heading:1')).toEqual([])
  })

  // Deleting what is not there is a stale selection, not a no-op.
  test('refuses a component the report lacks', () => {
    expect(refused(removeComponent(frozenSample(), 'nowhere'))).toMatchObject({ code: 'not-found', componentId: 'nowhere' })
  })

  // A message quotes what it was handed, shortened, so a caller's string
  // cannot make a message as long as itself.
  test('quotes a long id in its message shortened', () => {
    const message = refused(removeComponent(frozenSample(), 'x'.repeat(5000))).message
    expect(message).toContain(`"${'x'.repeat(40)}..."`)
    expect(message.length).toBeLessThan(100)
  })
})

describe('moveComponent', () => {
  // The index is where the component ends up, counted without it, so
  // "move down" is index + 1 and "move up" is index - 1 in either direction.
  test.each([
    ['down one', 'gap', { region: 'body', index: 2 }, 'body', ['intro', 'lines', 'gap', 'keep', 'break']],
    ['up one', 'lines', { region: 'body', index: 1 }, 'body', ['intro', 'lines', 'gap', 'keep', 'break']],
    ['to the end', 'intro', { region: 'body', index: 4 }, 'body', ['gap', 'lines', 'keep', 'break', 'intro']],
    ['into a container', 'gap', { region: 'body', parent: 'keep', index: 2 }, 'body:keep', ['box', 'note', 'gap']],
    ['out of a container', 'note', { region: 'body', index: 0 }, 'body', ['note', 'intro', 'gap', 'lines', 'keep', 'break']],
    ['to another region', 'rule', { region: 'summary', index: 0 }, 'summary', ['rule', 'closing', 'seal-image', 'order-code', 'payment-code']],
    ['between columns', 'title', { region: 'reportHeader', parent: 'heading', column: 0, index: 1 }, 'reportHeader:heading:0', ['logo-image', 'title']],
  ] as const)('moves a component %s', (_name, id, location, where, ids) => {
    const report = frozenSample()
    const next = accepted(moveComponent(report, id, location))
    expect(idsAt(next, where)).toEqual(ids)
    expect(componentAt(next, id)?.component).toEqual(componentAt(sampleReport(), id)?.component)
    expect(idsIn(next).sort()).toEqual(idsIn(report).sort())
  })

  // A container moved into itself would vanish from the tree with all it
  // holds; that is refused before anything is removed.
  test('refuses to move a container into itself or into what it holds', () => {
    const report = accepted(insertComponent(frozenSample(), { region: 'body', parent: 'keep', index: 0 }, { id: 'inner', kind: 'section', components: [] }))
    expect(refused(moveComponent(report, 'keep', { region: 'body', parent: 'keep', index: 0 }))).toMatchObject({ code: 'into-itself', componentId: 'keep' })
    expect(refused(moveComponent(report, 'keep', { region: 'body', parent: 'inner', index: 0 }))).toMatchObject({ code: 'into-itself' })
  })

  // The target list is counted without the component moved, so the last
  // position within its own list is one less than the list's length.
  test('refuses an index outside the list as it is without the component', () => {
    expect(refused(moveComponent(frozenSample(), 'gap', { region: 'body', index: 5 })).code).toBe('index-out-of-range')
    expect(refused(moveComponent(frozenSample(), 'nowhere', { region: 'body', index: 0 })).code).toBe('not-found')
    expect(refused(moveComponent(frozenSample(), 'gap', { region: 'body', parent: 'intro', index: 0 })).code).toBe('not-a-container')
  })
})

describe('updateComponent', () => {
  // The property panel edits what is particular to the kind, and only that.
  test('sets and removes properties, keeping the rest', () => {
    const report = frozenSample()
    const next = componentAt(accepted(updateComponent(report, 'intro', 'text', { keepWithNext: true, visibleWhen: null, style: 'small' })), 'intro')?.component
    const { visibleWhen: _gone, ...rest } = componentAt(sampleReport(), 'intro')?.component as TextComponent
    expect(next).toEqual({ ...rest, keepWithNext: true, style: 'small' })
  })

  // Only null removes. A caller tsc never saw may send undefined, which
  // JSON would have dropped on the way: it changes nothing, so the same
  // patch does the same in memory and read back from JSON.
  test('leaves a property given undefined as it was, as JSON would', () => {
    const report = frozenSample()
    const patch = { visibleWhen: undefined, keepWithNext: true } as unknown as Parameters<typeof updateComponent<'text'>>[3]
    const next = componentAt(accepted(updateComponent(report, 'intro', 'text', patch)), 'intro')?.component
    expect(next).toEqual({ ...componentAt(sampleReport(), 'intro')?.component, keepWithNext: true })
  })

  // A patch typed for one kind cannot be applied to another; at run time,
  // where a proposal arrives as JSON, the kind is checked against the
  // component's.
  test('refuses a component of another kind, or none', () => {
    expect(refused(updateComponent(frozenSample(), 'gap', 'text', { keepWithNext: true }))).toMatchObject({ code: 'kind-mismatch', componentId: 'gap' })
    expect(refused(updateComponent(frozenSample(), 'nowhere', 'text', {}))).toMatchObject({ code: 'not-found' })
  })

  // An id is how every reference, selection and diagnostic names a
  // component, and a kind decides every other property; neither changes in
  // place, whatever an untyped caller sends.
  test('refuses a patch that changes the id or the kind', () => {
    const sneaky = (patch: object): Parameters<typeof updateComponent<'text'>>[3] => patch
    expect(refused(updateComponent(frozenSample(), 'intro', 'text', sneaky({ id: 'other' })))).toMatchObject({
      code: 'immutable-property',
      path: '/regions/body/0/id',
    })
    expect(refused(updateComponent(frozenSample(), 'intro', 'text', sneaky({ kind: 'spacer' })))).toMatchObject({
      code: 'immutable-property',
      path: '/regions/body/0/kind',
    })
  })

  // The patch type is per kind: these lines do not compile, which the
  // typecheck gate holds, so a text patch cannot carry a table's columns.
  test('types a patch by the kind it is for', () => {
    const report = frozenSample()
    // @ts-expect-error -- a text has no columns
    expect(updateComponent(report, 'intro', 'text', { columns: [] }).ok).toBe(true)
    // @ts-expect-error -- content is required, so it cannot be removed
    expect(updateComponent(report, 'intro', 'text', { content: null }).ok).toBe(true)
    // @ts-expect-error -- the id is not part of a patch
    expect(updateComponent(report, 'intro', 'text', { id: 'other' }).ok).toBe(false)
  })

  // An EPC QR code is edited as every component is: a text replaced, an
  // optional one removed with null, its purpose and caption set, and what
  // the patch does not name kept. Its IBAN is required, so a patch cannot
  // remove it.
  test('edits an EPC QR code field by field, keeping the rest', () => {
    const report = frozenSample()
    const iban = [{ kind: 'text', text: 'AT61 1904 3002 3457 3201' }] as const
    const next = accepted(updateComponent(report, 'payment-code', 'epcQrCode', { iban, bic: null, purpose: 'SALA', caption: 'zahlenMitCode' }))
    const { bic: _bic, ...rest } = componentAt(sampleReport(), 'payment-code')?.component as EpcQrCodeComponent
    expect(componentAt(next, 'payment-code')?.component).toEqual({ ...rest, iban, purpose: 'SALA', caption: 'zahlenMitCode' })
    // @ts-expect-error -- the IBAN is required, so it cannot be removed
    expect(updateComponent(report, 'payment-code', 'epcQrCode', { iban: null }).ok).toBe(true)
  })
})

describe('duplicateComponent', () => {
  // Duplicate puts the copy right after the original, and gives it and
  // everything inside it ids no other component has.
  test('copies a component and what it holds, with fresh ids, after the original', () => {
    const report = frozenSample()
    const outcome = duplicateComponent(report, 'keep')
    const next = accepted(outcome)
    expect(outcome.ok && outcome.id).toBe('keep-2')
    expect(idsIn(next.regions.body)).toEqual(['intro', 'gap', 'lines', 'keep', 'box', 'note', 'keep-2', 'box-2', 'note-2', 'break'])
    const original = componentAt(report, 'keep')?.component
    expect(JSON.stringify(componentAt(next, 'keep-2')?.component).replaceAll('-2"', '"')).toBe(JSON.stringify(original))
  })

  // A columns block keeps its children in slots; a copy that missed them
  // would carry the originals' ids and be refused as duplicates.
  test('renames the components in every column of a columns block', () => {
    const next = accepted(duplicateComponent(frozenSample(), 'heading'))
    const ids = idsIn(next.regions.reportHeader)
    expect(ids).toEqual(['heading', 'logo-image', 'title', 'heading-2', 'logo-image-2', 'title-2', 'rule'])
    expect(new Set(idsIn(next)).size).toBe(idsIn(next).length)
  })

  // Ids taken by earlier copies are skipped, so a third duplicate is -3.
  test('skips ids earlier copies took', () => {
    const twice = accepted(duplicateComponent(accepted(duplicateComponent(frozenSample(), 'gap')), 'gap'))
    expect(idsIn(twice.regions.body)).toEqual(['intro', 'gap', 'gap-3', 'gap-2', 'lines', 'keep', 'box', 'note', 'break'])
  })

  // A copy of an EPC QR code is the code with a fresh id, every text, its
  // amount, its purpose and its caption kept: a copy that lost its BIC or
  // its reference would pay to the same account by another code.
  test('copies an EPC QR code with every field it holds', () => {
    const outcome = duplicateComponent(frozenSample(), 'payment-code')
    expect(outcome.ok && outcome.id).toBe('payment-code-2')
    expect(componentAt(accepted(outcome), 'payment-code-2')?.component).toEqual({
      ...componentAt(sampleReport(), 'payment-code')?.component,
      id: 'payment-code-2',
    })
  })

  test('refuses a component the report lacks', () => {
    // Duplicating a stale selection is refused rather than copying nothing.
    expect(refused(duplicateComponent(frozenSample(), 'nowhere')).code).toBe('not-found')
  })
})

describe('nextComponentId', () => {
  // The palette names a new component by its kind. A kind written in
  // camelCase is no identifier, so each kind is written as one: pageBreak as
  // page-break, qrCode as qr-code. Without that, the palette would throw for
  // a page break, a keep-together block and a QR code, and for nothing else.
  test.each(COMPONENT_KINDS)('names a new %s after its kind, as an identifier', (kind) => {
    const id = nextComponentId(frozenSample(), kind)
    expect(isIdentifier(id)).toBe(true)
    expect(id.replaceAll('-', '')).toBe(kind.toLowerCase())
  })

  // Each word of a camelCase kind is a word of the id, as the README
  // says: an EPC QR code is epc-qr-code, never epcqrcode, which an author
  // reading the outline would not read as three words.
  test('writes each word of a kind apart', () => {
    expect(['pageBreak', 'qrCode', 'epcQrCode', 'keepTogether'].map((kind) => nextComponentId(frozenSample(), kind))).toEqual([
      'page-break',
      'qr-code',
      'epc-qr-code',
      'keep-together',
    ])
  })

  // The palette names a new component by its kind; the first free id wins.
  test('is the prefix when it is free, and the prefix numbered from 2 when not', () => {
    const report = frozenSample()
    expect(nextComponentId(report, 'paragraph')).toBe('paragraph')
    expect(nextComponentId(report, 'intro')).toBe('intro-2')
    const taken = accepted(insertComponent(report, { region: 'body', index: 0 }, note('intro-2')))
    expect(nextComponentId(taken, 'intro')).toBe('intro-3')
    // A numbered id is counted on from its base, not numbered again.
    expect(nextComponentId(taken, 'intro-2')).toBe('intro-3')
  })

  // An id is at most 64 characters (0007); a long prefix is shortened so
  // that its number still fits, and the result is still an identifier.
  test('keeps a long prefix within the identifier rule', () => {
    const long = `a${'b'.repeat(63)}`
    const report = accepted(insertComponent(frozenSample(), { region: 'body', index: 0 }, note(long)))
    const id = nextComponentId(report, long)
    expect(id).toBe(`a${'b'.repeat(61)}-2`)
    expect(isIdentifier(id)).toBe(true)
  })

  // A prefix that is not an identifier would give an id the validator
  // refuses; that is a mistake in the caller, said where it is made.
  test('throws a RangeError for a prefix that is not an identifier', () => {
    expect(() => nextComponentId(frozenSample(), 'Not An Id')).toThrow(RangeError)
  })

  // The ids are taken from the whole report: 'note' stands inside a
  // keep-together block, and a new component must not take it.
  test('counts ids at every depth', () => {
    expect(walkComponents(sampleReport()).find(({ component }) => component.id === 'note')?.depth).toBe(1)
    expect(nextComponentId(frozenSample(), 'note')).toBe('note-2')
  })
})
