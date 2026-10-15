import { componentAt, reportHash } from '@formancy/report-spec'
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test, vi } from 'vitest'
import { duplicateComponent, insertComponent, removeComponent } from './commands/components.js'
import { putStyle, removeStyle } from './commands/declarations.js'
import { setTitle } from './commands/document.js'
import type { CommandOutcome } from './outcome.js'
import type { Draft } from './draft.js'
import { openReportSession } from './session.js'
import type { ReportSession } from './session.js'
import { accepted, refused, sampleReport } from './test-support.js'

function open(document: unknown = sampleReport()): ReportSession {
  const opening = openReportSession(document)
  if (!opening.ok) throw new Error(`the session did not open: ${opening.errors.map(({ code, path }) => `${code} ${path}`).join(', ')}`)
  return opening.session
}

/** A session, and how many times it has notified. */
function watched(document: unknown = sampleReport()): { session: ReportSession; notified: () => number } {
  const session = open(document)
  const listener = vi.fn()
  session.subscribe(listener)
  return { session, notified: () => listener.mock.calls.length }
}

/** Every object and array in a value. */
function objectsIn(value: unknown, into: object[] = []): object[] {
  if (typeof value === 'object' && value !== null) {
    into.push(value)
    for (const child of Object.values(value)) objectsIn(child, into)
  }
  return into
}

/** What a refused edit must leave alone: the same document object, the same revision, no notification. */
function expectUnchanged(session: ReportSession, before: ReportDefinition, revision: number, notified: () => number, count: number): void {
  expect(session.document()).toBe(before)
  expect(session.revision()).toBe(revision)
  expect(notified()).toBe(count)
  expect(session.canUndo()).toBe(revision > 0)
}

describe('openReportSession', () => {
  // The session holds the validator's copy, frozen: the caller's object can
  // change afterwards without reaching the document or its history.
  test('opens on a valid report, holding a frozen copy that is not the caller\'s', () => {
    const mine = sampleReport()
    const session = open(mine)
    expect(session.document()).toEqual(mine)
    expect(session.document()).not.toBe(mine)
    expect(objectsIn(session.document()).every((object) => Object.isFrozen(object))).toBe(true)
    ;(mine as { title: string }).title = 'Changed later'
    expect(session.document().title).toBe('Orders by site')
    expect(session.revision()).toBe(0)
    expect(session.canUndo() || session.canRedo()).toBe(false)
  })

  // Opening a file a user picked is an expected failure, not an exception:
  // a formancy form, a later version or junk is refused with the reasons.
  test.each([
    ['a formancy form', { specVersion: '3', id: 'order', title: 'Order', model: { fields: [] } }, 'not-a-report'],
    ['nothing at all', undefined, 'not-a-report'],
    ['a report of a later version', { ...sampleReport(), reportSpecVersion: '9' }, 'unsupported-version'],
    ['a report with an error', { ...sampleReport(), locale: 'deutsch' }, 'invalid-locale'],
  ])('refuses %s with the validator\'s errors, without throwing', (_name, document, code) => {
    const opening = openReportSession(document)
    expect(opening.ok).toBe(false)
    expect(!opening.ok && opening.errors.map((error) => error.code)).toContain(code)
  })

  // A history limit is a count of undo steps; anything else is a mistake in
  // the host's configuration, said when the session is opened.
  test.each([-1, 1.5, Number.NaN])('throws a RangeError for a history limit of %s', (historyLimit) => {
    expect(() => openReportSession(sampleReport(), { historyLimit })).toThrow(RangeError)
  })
})

describe('apply', () => {
  // A commit is one step: the document, the revision, the history and one
  // notification move together.
  test('commits an accepted command: a new document, a revision, an undo step, one notification', () => {
    const { session, notified } = watched()
    const before = session.document()
    const outcome = session.apply((report) => setTitle(report, 'Orders'))
    expect(accepted(outcome)).toBe(session.document())
    expect(session.document()).not.toBe(before)
    expect(session.document().title).toBe('Orders')
    expect(session.revision()).toBe(1)
    expect(notified()).toBe(1)
    expect(session.canUndo()).toBe(true)
  })

  // A refused edit changes nothing at all: a builder that re-renders on a
  // notification, or compares the document by identity, sees no change.
  test('leaves everything as it was when the command refuses', () => {
    const { session, notified } = watched()
    const before = session.document()
    const outcome = session.apply((report) => removeComponent(report, 'nowhere'))
    expect(refused(outcome).code).toBe('not-found')
    expectUnchanged(session, before, 0, notified, 0)
  })

  // The command checks its own preconditions and the session the whole
  // result: removing a style a component still uses is refused with the
  // validator's reasons, pointing at the component that uses it.
  test('refuses a result the validator refuses, with its errors, and changes nothing', () => {
    const { session, notified } = watched()
    const before = session.document()
    const refusal = refused(session.apply((report) => removeStyle(report, 'title')))
    expect(refusal).toMatchObject({ code: 'invalid-document', path: '/regions/reportHeader/0/columns/1/components/0/style', componentId: 'title' })
    expect(refusal.errors?.map(({ code }) => code)).toEqual(['unknown-style'])
    expectUnchanged(session, before, 0, notified, 0)
  })

  // An edit that changes nothing -- a property field committed on blur with
  // the value it had -- is accepted without an undo step that undoes nothing.
  test('accepts an edit that changes nothing without a commit', () => {
    const { session, notified } = watched()
    const before = session.document()
    expect(accepted(session.apply((report) => setTitle(report, report.title)))).toBe(before)
    expectUnchanged(session, before, 0, notified, 0)
  })

  // What the command said besides the report survives the commit: the id a
  // duplicate was given is what the builder selects next.
  test('passes on what the command said besides the report', () => {
    const session = open()
    const outcome = session.apply((report) => duplicateComponent(report, 'gap'))
    expect(outcome.ok && outcome.id).toBe('gap-2')
    expect(accepted(outcome)).toBe(session.document())
  })

  // A descriptor runs the command it names, and labels the undo step with
  // that name for a host that has no label of its own.
  test('applies a command descriptor, labelled by its command', () => {
    const session = open()
    accepted(session.apply({ command: 'setTitle', args: ['Orders'] }))
    expect(session.document().title).toBe('Orders')
    expect(session.undoLabel()).toBe('setTitle')
    expect(refused(session.apply({ command: 'nothing', args: [] } as never)).code).toBe('unknown-command')
  })

  // The component handed to a command is the caller's object; the session
  // keeps its own, so a later write to it does not edit the document.
  test('keeps its own copy of what a command was handed', () => {
    const session = open()
    const mine = { id: 'added', kind: 'spacer', height: 10 } as { id: string; kind: 'spacer'; height: number }
    accepted(session.apply((report) => insertComponent(report, { region: 'body', index: 0 }, mine)))
    mine.height = 99
    expect(componentAt(session.document(), 'added')?.component).toEqual({ id: 'added', kind: 'spacer', height: 10 })
  })

  // A command that throws is a bug, and is not hidden as a refusal; nothing
  // was committed before it threw.
  test('lets an exception from a command through, unchanged', () => {
    const { session, notified } = watched()
    const before = session.document()
    expect(() =>
      session.apply(() => {
        throw new Error('broken command')
      }),
    ).toThrow('broken command')
    expectUnchanged(session, before, 0, notified, 0)
  })

  // A command is pure. One that edited the session itself would commit that
  // inner edit, and then the outer result -- computed from the document
  // before it, its expected hash checked before it -- would overwrite it,
  // leaving the inner edit only in the undo history. Refused loudly, as a
  // misuse, the way a transaction refuses it.
  test('throws when the session is edited from inside a command it is running, changing nothing', () => {
    const { session, notified } = watched()
    const before = session.document()
    const base = session.hash()
    const inner: (() => unknown)[] = [
      () => session.apply((report) => setTitle(report, 'Inner')),
      () => session.replaceDocument(sampleReport()),
      () => session.undo(),
      () => session.redo(),
      () => session.transaction('Nested', () => undefined),
    ]
    for (const edit of inner) {
      expect(() =>
        session.apply(
          (report) => {
            edit()
            return setTitle(report, 'Outer')
          },
          { expectedHash: base },
        ),
      ).toThrow(/running a command/)
      expectUnchanged(session, before, 0, notified, 0)
    }
    // The misuse ends with the command: the session is usable after it.
    accepted(session.apply((report) => setTitle(report, 'After')))
  })

  // Optimistic concurrency (plan 17): an edit bound to a hash the document no
  // longer has was made against a document that is gone.
  test('refuses an edit whose expected hash is not the document\'s', () => {
    const { session, notified } = watched()
    const stale = session.hash()
    accepted(session.apply((report) => setTitle(report, 'Orders')))
    const before = session.document()
    expect(refused(session.apply((report) => setTitle(report, 'Again'), { expectedHash: stale })).code).toBe('stale-document')
    expectUnchanged(session, before, 1, notified, 1)
    accepted(session.apply((report) => setTitle(report, 'Again'), { expectedHash: session.hash(), label: 'Rename' }))
    expect(session.undoLabel()).toBe('Rename')
  })
})

describe('document, hash and exportDocument', () => {
  // React's useSyncExternalStore and Angular's signals compare snapshots by
  // identity: a new object on every read would re-render forever.
  test('document() is the same object until a commit, and a new one after', () => {
    const session = open()
    const first = session.document()
    expect(session.document()).toBe(first)
    session.apply((report) => removeComponent(report, 'nowhere'))
    expect(session.document()).toBe(first)
    session.apply((report) => setTitle(report, 'Orders'))
    expect(session.document()).not.toBe(first)
  })

  // The hash is what a proposal and a save are bound to; it is the format's
  // hash of the current document, and follows undo back.
  test('hash() is the report hash of the current document, through undo', () => {
    const session = open()
    const first = session.hash()
    expect(first).toBe(reportHash(sampleReport()))
    expect(session.hash()).toBe(first)
    session.apply((report) => setTitle(report, 'Orders'))
    expect(session.hash()).toBe(reportHash({ ...sampleReport(), title: 'Orders' }))
    session.undo()
    expect(session.hash()).toBe(first)
  })

  // An export is for writing to a file or editing freely; writing to it
  // must not reach the session.
  test('exportDocument() is a mutable copy that shares nothing with the document', () => {
    const session = open()
    const copy = session.exportDocument()
    expect(copy).toEqual(session.document())
    copy.title = 'Changed'
    copy.regions.body.length = 0
    expect(session.document().title).toBe('Orders by site')
    expect(session.document().regions.body).toHaveLength(5)
  })
})

describe('replaceDocument', () => {
  // A paste or an AI-written report is one undo step: Ctrl+Z puts back what
  // was there.
  test('takes a whole document as one undoable step', () => {
    const { session, notified } = watched()
    const before = session.document()
    accepted(session.replaceDocument({ ...sampleReport(), title: 'Pasted' }))
    expect(session.document().title).toBe('Pasted')
    expect(session.undoLabel()).toBe('replaceDocument')
    expect(notified()).toBe(1)
    expect(session.undo()).toBe(true)
    expect(session.document()).toBe(before)
  })

  // A document from outside is untrusted: whatever it is, it is validated,
  // and a refusal changes nothing.
  test.each([
    ['a formancy form', { specVersion: '3' }, 'not-a-report'],
    ['an invalid report', { ...sampleReport(), page: { size: 'A5', orientation: 'portrait', margins: { top: 0, right: 0, bottom: 0, left: 0 } } }, 'not-one-of'],
  ])('refuses %s with the validator\'s errors', (_name, next, code) => {
    const { session, notified } = watched()
    const before = session.document()
    const refusal = refused(session.replaceDocument(next))
    expect(refusal.code).toBe('invalid-document')
    expect(refusal.errors?.map((error) => error.code)).toContain(code)
    expectUnchanged(session, before, 0, notified, 0)
  })

  // A replacement computed from an older document -- a proposal the model
  // wrote while the author kept editing -- must not overwrite those edits.
  test('refuses a replacement bound to a stale hash, and takes one bound to the current hash', () => {
    const { session, notified } = watched()
    const base = session.hash()
    accepted(session.apply((report) => setTitle(report, 'Edited meanwhile')))
    const before = session.document()
    expect(refused(session.replaceDocument({ ...sampleReport(), title: 'Proposal' }, { expectedHash: base })).code).toBe('stale-document')
    expectUnchanged(session, before, 1, notified, 1)
    accepted(session.replaceDocument({ ...sampleReport(), title: 'Proposal' }, { expectedHash: session.hash(), label: 'AI proposal' }))
    expect(session.undoLabel()).toBe('AI proposal')
  })
})

describe('transaction', () => {
  const spacer = (id: string): Component => ({ id, kind: 'spacer', height: 10 })

  // "Group by site, add a subtotal, move the address": several commands are
  // one undo step and one notification, validated once.
  test('commits several commands as one undo step, validated once at the end', () => {
    const { session, notified } = watched()
    const before = session.document()
    const outcome = session.transaction('Restyle', (draft) => {
      // In between, a component names a style the report does not declare
      // yet: the draft may be invalid until the transaction ends.
      draft.apply((report) => insertComponent(report, { region: 'body', index: 0 }, { ...spacer('a'), style: 'airy' }))
      expect(draft.document().regions.body[0]?.id).toBe('a')
      draft.apply((report) => putStyle(report, 'airy', { size: 14 }))
      draft.apply({ command: 'setTitle', args: ['Restyled'] })
    })
    expect(accepted(outcome)).toBe(session.document())
    expect(session.document().title).toBe('Restyled')
    expect(session.revision()).toBe(1)
    expect(notified()).toBe(1)
    expect(session.undoLabel()).toBe('Restyle')
    session.undo()
    expect(session.document()).toBe(before)
  })

  // A proposal is applied whole or not at all (plan 16): an invalid end
  // state refuses everything the transaction did.
  test('refuses the whole transaction when its result is invalid', () => {
    const { session, notified } = watched()
    const before = session.document()
    const refusal = refused(
      session.transaction('Half', (draft) => {
        draft.apply((report) => setTitle(report, 'Half done'))
        draft.apply((report) => insertComponent(report, { region: 'body', index: 0 }, { ...spacer('b'), style: 'missing' }))
      }),
    )
    expect(refusal).toMatchObject({ code: 'invalid-document', componentId: 'b' })
    expectUnchanged(session, before, 0, notified, 0)
  })

  // One refused operation fails the proposal: the rest are not run, and
  // the transaction gives that refusal.
  test('refuses the whole transaction at the first refused command, running nothing after it', () => {
    const { session, notified } = watched()
    const before = session.document()
    const after = vi.fn((report: ReportDefinition): CommandOutcome => setTitle(report, 'Never'))
    const outcomes: CommandOutcome[] = []
    const refusal = refused(
      session.transaction('Broken', (draft) => {
        outcomes.push(draft.apply((report) => setTitle(report, 'First')))
        outcomes.push(draft.apply((report) => removeComponent(report, 'nowhere')))
        outcomes.push(draft.apply(after))
      }),
    )
    expect(refusal.code).toBe('not-found')
    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, false, false])
    expect(outcomes[2]).toBe(outcomes[1])
    expect(after).not.toHaveBeenCalled()
    expectUnchanged(session, before, 0, notified, 0)
  })

  // An exception inside the transaction is the caller's to see; the session
  // is as it was, and usable.
  test('lets an exception through, unchanged, and stays usable', () => {
    const { session, notified } = watched()
    const before = session.document()
    expect(() =>
      session.transaction('Throws', (draft) => {
        draft.apply((report) => setTitle(report, 'Changed'))
        throw new Error('abandoned')
      }),
    ).toThrow('abandoned')
    expectUnchanged(session, before, 0, notified, 0)
    accepted(session.apply((report) => setTitle(report, 'After')))
  })

  // Editing the session itself from inside a transaction would be lost when
  // the transaction commits its draft; it is refused loudly, as a misuse.
  test('throws when the session is edited from inside a transaction, or the draft after it', () => {
    const session = open()
    let kept: Draft | undefined
    session.transaction('Misuse', (draft) => {
      kept = draft
      expect(() => session.apply((report) => setTitle(report, 'Inside'))).toThrow(/transaction/)
      expect(() => session.replaceDocument(sampleReport())).toThrow(/transaction/)
      expect(() => session.undo()).toThrow(/transaction/)
      expect(() => session.redo()).toThrow(/transaction/)
      expect(() => session.transaction('Nested', () => undefined)).toThrow(/transaction/)
    })
    expect(() => kept?.apply((report) => setTitle(report, 'Late'))).toThrow(/ended/)
    expect(() => kept?.document()).toThrow(/ended/)
  })

  // An await inside a transaction would end it half run: what came before
  // the await would commit as the whole proposal, and every step after it
  // would throw where only the promise sees it. A callback that returns a
  // promise is refused before anything commits; tsc refuses one outright,
  // and the check at run time holds for a caller tsc never saw.
  test('refuses a callback that returns a promise, committing nothing of it', async () => {
    const { session, notified } = watched()
    const before = session.document()
    let late: unknown
    const run = async (draft: Draft): Promise<void> => {
      draft.apply((report) => setTitle(report, 'First half'))
      await Promise.resolve()
      try {
        draft.apply((report) => removeComponent(report, 'gap'))
      } catch (error) {
        late = error
      }
    }
    let pending: Promise<void> | undefined
    // @ts-expect-error -- a transaction runs synchronously; an async callback does not compile
    expect(() => session.transaction('Proposal', (draft) => (pending = run(draft)))).toThrow(TypeError)
    expectUnchanged(session, before, 0, notified, 0)
    // The rest of the callback runs later, against a draft that has ended.
    await pending
    expect(late).toBeInstanceOf(Error)
    expectUnchanged(session, before, 0, notified, 0)
    // Any thenable, not only a native promise, is the same mistake.
    const thenable = { then: (): void => undefined }
    expect(() => session.transaction('Thenable', () => thenable as never)).toThrow(TypeError)
    expectUnchanged(session, before, 0, notified, 0)
  })

  // A transaction bound to a stale hash is refused before it runs, so a
  // proposal's operations never run against a document they were not
  // written for.
  test('refuses a stale expected hash before running anything', () => {
    const session = open()
    const base = session.hash()
    accepted(session.apply((report) => setTitle(report, 'Meanwhile')))
    const run = vi.fn()
    expect(refused(session.transaction('Late', run, { expectedHash: base })).code).toBe('stale-document')
    expect(run).not.toHaveBeenCalled()
    accepted(session.transaction('Current', () => undefined, { expectedHash: session.hash() }))
  })

  // A transaction that did nothing is not an undo step.
  test('accepts an empty transaction without a commit', () => {
    const { session, notified } = watched()
    const before = session.document()
    expect(accepted(session.transaction('Nothing', () => undefined))).toBe(before)
    expectUnchanged(session, before, 0, notified, 0)
  })
})
