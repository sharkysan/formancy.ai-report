/**
 * The builder's life: mounted over an editor, destroyed, mounted again, and
 * given another editor -- what plan 21 asks of a native builder besides the
 * scenarios. The document and its history are the session's, so none of it
 * may go with a builder; and a builder that goes leaves nothing listening.
 */
import { TestBed } from '@angular/core/testing'
import { createReportEditor } from '@formancy/report-builder-core'
import { setTitle } from '@formancy/report-core'
import { screen, within } from '@testing-library/angular'
import { afterEach, describe, expect, test } from 'vitest'
import { mountBuilder } from './test-mount'
import { countingSession, scenarioSession } from './test-support'
import { click, press } from './test-user'

afterEach(() => {
  TestBed.resetTestingModule()
})

const tree = (name: string): HTMLElement => screen.getByRole('treeitem', { name })

describe('a builder destroyed and made again', () => {
  // A builder that took the document or its undo history with it would
  // leave the next one -- the same framework or the other -- with an edit
  // nobody can undo; one that left its subscription behind would be told
  // of every later edit, for as long as the editor lives (plan 11.4).
  test('over the same editor, keeps the document and the history, and leaves no listener', async () => {
    const editor = createReportEditor(scenarioSession())
    const before = editor.listenerCount()
    const first = await mountBuilder(editor)
    expect(editor.listenerCount()).toBe(before + 1)
    click(tree('Introduction'))
    press('Delete')
    await first.settle()
    first.fixture.destroy()
    expect(editor.listenerCount()).toBe(before)
    TestBed.resetTestingModule()

    const second = await mountBuilder(editor)
    expect(screen.queryByRole('treeitem', { name: 'Introduction' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Undo' }).getAttribute('title')).toBe('Undo: Delete Text')
    click(screen.getByRole('button', { name: 'Undo' }))
    await second.settle()
    expect(tree('Introduction')).toBeTruthy()
    second.fixture.destroy()
    expect(editor.listenerCount()).toBe(before)
  })

  // A keyboard's place chooser is the editor's drag, so it outlives the
  // builder that opened it: a Studio that switches frameworks draws it in
  // the next builder, which never saw what opened it. Drawing it must leave
  // the keyboard where the person is, and Cancel in it must not drop the
  // keyboard on the page: it goes to the palette entry of what was being
  // placed, in the pane the chooser floated over.
  test('drawing a chooser another builder opened, leaves focus alone, and Cancel lands on its palette entry', async () => {
    const editor = createReportEditor(scenarioSession())
    const first = await mountBuilder(editor)
    click(screen.getByRole('button', { name: 'Text' }))
    await first.settle()
    first.fixture.destroy()
    TestBed.resetTestingModule()

    const elsewhere = document.body.appendChild(document.createElement('button'))
    elsewhere.textContent = 'React'
    elsewhere.focus()
    const second = await mountBuilder(editor)
    const dialog = screen.getByRole('dialog', { name: 'Insert Text: choose a place' })
    expect(document.activeElement).toBe(elsewhere)
    click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await second.settle()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Text' }))
    elsewhere.remove()
  })

  // Plan 21's switch, as far as one framework goes: edit in a builder, put
  // it and its editor away, undo in a builder over a new editor in another
  // language, switch back, redo. The session has every step, each editor
  // words it in its own language, and nothing is left subscribed to the
  // session once the editors are disposed. The React half is the React
  // builder's suite and report-builder-core's model test.
  test('over a new editor of the same session, in another language, undoes what the first did', async () => {
    const { session, live } = countingSession(scenarioSession())
    const german = createReportEditor(session, { locale: 'de-CH' })
    const first = await mountBuilder(german)
    click(tree('Abstand'))
    press('Delete')
    await first.settle()
    const edited = session.document()
    first.fixture.destroy()
    german.dispose()
    TestBed.resetTestingModule()

    const english = createReportEditor(session)
    const second = await mountBuilder(english)
    expect(screen.getByRole('button', { name: 'Undo' }).getAttribute('title')).toBe('Undo: Delete Spacer')
    click(screen.getByRole('button', { name: 'Undo' }))
    await second.settle()
    expect(tree('Spacer')).toBeTruthy()
    second.fixture.destroy()
    english.dispose()
    TestBed.resetTestingModule()

    const again = createReportEditor(session, { locale: 'de-CH' })
    const third = await mountBuilder(again)
    expect(screen.getByRole('button', { name: 'Wiederholen' }).getAttribute('title')).toBe('Wiederholen: Löschen: Abstand')
    click(screen.getByRole('button', { name: 'Wiederholen' }))
    await third.settle()
    expect(session.document()).toBe(edited)
    expect(screen.queryByRole('treeitem', { name: 'Abstand' })).toBeNull()
    third.fixture.destroy()
    again.dispose()
    expect(live()).toBe(0)
  })
})

describe('a builder given another editor', () => {
  // The host directive maps `editor` onto the root's input. A mapping that
  // went nowhere would leave the builder drawing the first editor's report
  // and acting on it, while the host believed it had switched.
  test('shows and edits the new editor’s report, and lets the old editor go', async () => {
    const old = createReportEditor(scenarioSession())
    const mounted = await mountBuilder(old)
    const other = scenarioSession()
    other.apply((report) => setTitle(report, 'Another visit'))
    const next = createReportEditor(other)
    mounted.fixture.componentRef.setInput('editor', next)
    await mounted.settle()
    expect((screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement).value).toBe('Another visit')
    expect(old.listenerCount()).toBe(0)
    expect(next.listenerCount()).toBe(1)
    click(tree('Spacer'))
    press('Delete')
    await mounted.settle()
    expect(other.document().regions.body.map((component) => component.id)).not.toContain('gap')
  })
})
