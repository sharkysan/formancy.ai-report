import { componentAt } from '@formancy/report-spec'
import { describe, expect, test, vi } from 'vitest'
import { createReportEditor } from './editor.js'
import type { EditorOutcome } from './model-actions.js'
import { countingSession, richReport, sessionOver } from './test-support.js'

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

describe('several editors over one session', () => {
  // The document and its history live in the session, not in a builder:
  // an edit in one editor is the other's document at once, and the other
  // undoes it (plan 11.4, 0008).
  test('see each other’s edits, and undo them', () => {
    const session = sessionOver(richReport())
    const angular = createReportEditor(session, { locale: 'de-CH' })
    const react = createReportEditor(session, { locale: 'en' })
    const told = vi.fn()
    react.subscribe(told)
    ok(angular.dispatch({ type: 'select', id: 'gap' }))
    expect(told).not.toHaveBeenCalled()
    ok(angular.dispatch({ type: 'delete' }))
    expect(told).toHaveBeenCalledTimes(1)
    expect(react.state().outline.find((region) => region.region === 'body')?.nodes.map((node) => node.id)).not.toContain('gap')
    expect(react.state().history.undoLabel).toBe('Delete Spacer')
    ok(react.dispatch({ type: 'undo' }))
    expect(componentAt(session.document(), 'gap')).toBeDefined()
    expect(angular.state().history.redoLabel).toBe('Löschen: Abstand')
  })

  // One person's selection, zoom and drag are their own; the other builder
  // keeps what it had.
  test('keep their own selection, zoom and drag', () => {
    const session = sessionOver(richReport())
    const one = createReportEditor(session)
    const two = createReportEditor(session)
    ok(one.dispatch({ type: 'select', id: 'intro' }))
    ok(one.dispatch({ type: 'setZoom', zoom: 2 }))
    ok(one.dispatch({ type: 'startDrag', subject: { kind: 'text' } }))
    expect(two.state().selection).toBeNull()
    expect(two.state().zoom).toBe(1)
    expect(two.state().drag).toBeNull()
  })

  // Plan 21's critical integration test, at the model: edit in one builder,
  // switch to the other -- the first destroyed -- undo there, switch back,
  // and the document and history are the session's throughout, with no
  // subscription left behind by either.
  test('edit in one, switch, undo, switch back', () => {
    const { session, live } = countingSession(sessionOver(richReport()))
    const angular = createReportEditor(session, { locale: 'de-CH' })
    ok(angular.dispatch({ type: 'insert', kind: 'text', target: { region: 'body', index: 0 } }))
    const edited = session.document()
    angular.dispose()

    const react = createReportEditor(session)
    expect(live()).toBe(1)
    expect(react.state().history.undoLabel).toBe('Insert Text')
    expect(react.state().selection).toBeNull()
    ok(react.dispatch({ type: 'undo' }))
    react.dispose()

    const again = createReportEditor(session, { locale: 'de-CH' })
    expect(live()).toBe(1)
    expect(again.state().history).toMatchObject({ canUndo: false, canRedo: true, redoLabel: 'Einfügen: Text' })
    ok(again.dispatch({ type: 'redo' }))
    expect(session.document()).toBe(edited)
    again.dispose()
    expect(live()).toBe(0)
  })

  // A host's listener on one builder's editor that throws runs inside the
  // session's notification of an edit the other builder made. The session
  // commits first and throws after (0008); the editor that made the edit
  // must still finish it -- select what follows, say what it did, tell its
  // own listeners -- or its builder shows a document the session no longer
  // has. The error still surfaces, from the action, once all that is done.
  test('one editor’s listener that throws leaves the other’s edit finished, then throws', () => {
    const session = sessionOver(richReport())
    const one = createReportEditor(session)
    const other = createReportEditor(session)
    other.subscribe(() => {
      throw new Error('the other builder broke')
    })
    const told = vi.fn()
    one.subscribe(told)
    ok(one.dispatch({ type: 'select', id: 'gap' }))
    expect(() => one.dispatch({ type: 'delete' })).toThrow('the other builder broke')
    expect(componentAt(session.document(), 'gap')).toBeUndefined()
    expect(told).toHaveBeenCalledTimes(2)
    expect(one.state().selection).toEqual({ id: 'lines' })
    expect(one.state().status.text).toBe('Deleted Spacer.')
    expect(one.state().history.undoLabel).toBe('Delete Spacer')
    // Undo through the same broken neighbour: it stands, and is said.
    expect(() => one.dispatch({ type: 'undo' })).toThrow('the other builder broke')
    expect(componentAt(session.document(), 'gap')).toBeDefined()
    expect(one.state().status.text).toBe('Undone: Delete Spacer.')
    // A property edit, too.
    ok(one.dispatch({ type: 'select', id: 'intro' }))
    expect(() => one.dispatch({ type: 'setProperty', key: '/keepWithNext', value: true })).toThrow('the other builder broke')
    expect(one.state().status.text).toBe('Changed Keep with next.')
  })

  // An error before anything committed is no edit to finish: a command that
  // throws -- a defect -- passes straight through, and the editor is left
  // as it was, with nobody told of a change that did not happen.
  test('passes an error from before the commit straight through, changing nothing', () => {
    const session = sessionOver(richReport())
    const editor = createReportEditor(session)
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    const broken = { ...session, apply: () => { throw new Error('no commit') } } as typeof session
    const over = createReportEditor(broken)
    ok(over.dispatch({ type: 'select', id: 'gap' }))
    const told = vi.fn()
    over.subscribe(told)
    expect(() => over.dispatch({ type: 'delete' })).toThrow('no commit')
    expect(() => over.dispatch({ type: 'setProperty', key: '/height', value: '5' })).toThrow('no commit')
    expect(told).not.toHaveBeenCalled()
    expect(over.state().selection).toEqual({ id: 'gap' })
    const stuck = { ...session, canUndo: () => true, undo: () => { throw new Error('no undo') } } as typeof session
    expect(() => createReportEditor(stuck).dispatch({ type: 'undo' })).toThrow('no undo')
  })

  // A drag in progress while the other builder changes the document is a
  // drag over places that may no longer be there: its targets are found
  // again and the pointer's target is forgotten.
  test('a drag in one editor follows an edit made in the other', () => {
    const session = sessionOver(richReport())
    const dragging = createReportEditor(session)
    const other = createReportEditor(session)
    ok(dragging.dispatch({ type: 'startDrag', subject: { id: 'intro' } }))
    ok(dragging.dispatch({ type: 'updateDrag', over: 0 }))
    const before = dragging.state().dropTargets.length
    ok(other.dispatch({ type: 'select', id: 'gap' }))
    ok(other.dispatch({ type: 'delete' }))
    expect(dragging.state().drag?.over).toBeNull()
    expect(dragging.state().dropTargets.length).toBeLessThan(before)
  })
})
