import { setTitle } from '@formancy/report-core'
import { describe, expect, test } from 'vitest'
import { BLANK } from './starters/starters.js'
import { createWorkspace } from './workspace.js'

const OTHER = { ...BLANK, id: 'other', report: { ...BLANK.report, id: 'other' } }

describe('the workspace', () => {
  // Picking another starter and coming back keeps what was done to the
  // first: its document, its undo history and its editor's selection. A
  // picker that reopened the starter each time would throw an afternoon's
  // edits away on one keystroke in a select.
  test('keeps one session and one editor per starter for as long as the page lives', () => {
    const workspace = createWorkspace([BLANK, OTHER])
    const first = workspace.open('blank')
    first.session.apply((report) => setTitle(report, 'Edited'))
    workspace.open('other')
    const again = workspace.open('blank')
    expect(again.session).toBe(first.session)
    expect(again.editor).toBe(first.editor)
    expect(again.session.document().title).toBe('Edited')
    expect(again.session.canUndo()).toBe(true)
    expect(workspace.open('other').session).not.toBe(first.session)
    workspace.dispose()
  })

  // The editor is shared by whichever builder is shown (0012): the Studio
  // makes it, so the Studio disposes it, and nothing it subscribed to the
  // session is left behind.
  test('disposes the editors it made', () => {
    const workspace = createWorkspace([BLANK])
    const { editor } = workspace.open('blank')
    workspace.dispose()
    expect(editor.dispatch({ type: 'zoomIn' }).ok).toBe(false)
  })

  // A starter the list does not have is a bug in the page, said as one.
  test('refuses a starter it does not have', () => {
    expect(() => createWorkspace([BLANK]).open('missing')).toThrow(/missing/)
  })
})
