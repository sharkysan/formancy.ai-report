/**
 * The builder over a session it does not own: mounted, unmounted, mounted
 * again, given another editor, and shown twice at once.
 *
 * The document and its undo history live in the session, and what is one
 * person's -- selection, zoom, a drag -- in their editor (plan 11.4). So a
 * builder can come and go without losing an edit, and without leaving a
 * subscription that would re-render a component nobody shows.
 */
import { createReportEditor, editorText, scenarioReport } from '@formancy/report-builder-core'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'
import { ReportBuilder } from './report-builder.js'
import { sessionOver, violations } from './test-support.js'

afterEach(cleanup)

const en = editorText('en')
const de = editorText('de-CH')

const ids = (report: { readonly regions: { readonly body: readonly { readonly id: string }[] } }): string => report.regions.body.map((component) => component.id).join()

describe('a builder that comes and goes', () => {
  // A builder that stayed subscribed after unmounting would re-render a
  // component React has thrown away, once per edit, for as long as the
  // editor lives -- and a Studio that switches builders would collect them.
  test('unmounting leaves the editor with the listeners it had', async () => {
    const editor = createReportEditor(sessionOver(scenarioReport()))
    const before = editor.listenerCount()
    const { unmount } = render(<ReportBuilder editor={editor} />)
    expect(editor.listenerCount()).toBe(before + 1)
    await userEvent.setup().click(screen.getByRole('treeitem', { name: 'Introduction' }))
    unmount()
    expect(editor.listenerCount()).toBe(before)
  })

  // The edit made before the builder went away, and the step that undoes
  // it, are the session's: a builder mounted again over the same editor
  // shows the one and can take back the other.
  test('mounted again over the same editor, it has the document and its history', async () => {
    const session = sessionOver(scenarioReport())
    const editor = createReportEditor(session)
    const user = userEvent.setup()
    const first = render(<ReportBuilder editor={editor} />)
    await user.click(screen.getByRole('treeitem', { name: 'Spacer' }))
    await user.keyboard('{Delete}')
    first.unmount()

    render(<ReportBuilder editor={editor} />)
    expect(screen.queryByRole('treeitem', { name: 'Spacer' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('treeitem', { name: 'Spacer' })).toBeTruthy()
    expect(ids(session.document())).toBe('findings,intro,notes,gap')
  })

  // Plan 21's switch, between two editors over one session: an edit made in
  // one is undone in the next and redone in a third, and the editor given
  // up has no listener left -- the builder let it go when its prop changed.
  test('given another editor, it lets the old one go and shows the session through the new one', async () => {
    const session = sessionOver(scenarioReport())
    const english = createReportEditor(session)
    const user = userEvent.setup()
    const { rerender } = render(<ReportBuilder editor={english} />)
    await user.click(screen.getByRole('treeitem', { name: 'Findings' }))
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(ids(session.document())).toBe('intro,findings,notes,gap')

    const german = createReportEditor(session, { locale: 'de-CH' })
    rerender(<ReportBuilder editor={german} />)
    expect(english.listenerCount()).toBe(0)
    expect(german.listenerCount()).toBe(1)
    english.dispose()
    await user.click(screen.getByRole('button', { name: de('action.undo') }))
    expect(ids(session.document())).toBe('findings,intro,notes,gap')

    const french = createReportEditor(session, { locale: 'fr-CH' })
    rerender(<ReportBuilder editor={french} />)
    expect(german.listenerCount()).toBe(0)
    await user.click(screen.getByRole('button', { name: editorText('fr-CH')('action.redo') }))
    expect(ids(session.document())).toBe('intro,findings,notes,gap')
  })
})

describe('two builders on one session', () => {
  // A place dialog is the editor's drag, so it outlives the builder that
  // opened it: a Studio that switches frameworks draws it again in the next
  // builder, which never saw what opened it. Drawing it must not pull the
  // keyboard out of the control the person is using, and Escape in it must
  // not drop the keyboard on the page: it goes to the palette entry of what
  // was being placed, in the pane the dialog floated over.
  test('drawn again, a place dialog leaves focus where it is, and Escape lands on its palette entry', async () => {
    const editor = createReportEditor(sessionOver(scenarioReport()))
    const user = userEvent.setup()
    const first = render(<ReportBuilder editor={editor} />)
    await user.click(screen.getByRole('button', { name: en('kind.text') }))
    first.unmount()

    const elsewhere = document.body.appendChild(document.createElement('button'))
    elsewhere.textContent = 'Angular'
    elsewhere.focus()
    render(<ReportBuilder editor={editor} />)
    const dialog = screen.getByRole('dialog', { name: en('places.insert', { kind: en('kind.text') }) })
    expect(document.activeElement).toBe(elsewhere)

    act(() => within(dialog).getByRole('button', { name: en('places.cancel') }).focus())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: en('kind.text') }))
    elsewhere.remove()
  })

  // The Studio may show a report twice -- two people's views, or a React
  // and an Angular builder side by side. Each edit is the session's, so
  // both show it at once; each selection is its editor's, so neither
  // takes the other's place.
  test('stay in step, each with its own selection', async () => {
    const session = sessionOver(scenarioReport())
    const user = userEvent.setup()
    render(
      <>
        <div role="region" aria-label="First">
          <ReportBuilder editor={createReportEditor(session)} />
        </div>
        <div role="region" aria-label="Second">
          <ReportBuilder editor={createReportEditor(session, { locale: 'de-CH' })} />
        </div>
      </>,
    )
    const first = within(screen.getByRole('region', { name: 'First' }))
    const second = within(screen.getByRole('region', { name: 'Second' }))

    await user.click(first.getByRole('treeitem', { name: 'Introduction' }))
    await user.keyboard('{Delete}')
    expect(second.queryByRole('treeitem', { name: 'Introduction' })).toBeNull()

    await user.click(second.getByRole('button', { name: de('action.undo') }))
    expect(first.getByRole('treeitem', { name: 'Introduction' })).toBeTruthy()
    expect(second.getByRole('treeitem', { name: 'Introduction', selected: false })).toBeTruthy()
    expect(await violations()).toEqual([])
  })

  // Two builders on one page mint no id twice. axe only asks for a review of
  // a duplicated id, so this holds it by what a duplicate would break: a
  // field is labelled through its id, so the second builder's first field
  // would be unnamed and the first builder's named twice, in two languages.
  // The forms and the lists are named in words, which no id lends.
  test('name their own parts, never each other’s', async () => {
    const session = sessionOver(scenarioReport())
    render(
      <>
        <ReportBuilder editor={createReportEditor(session)} />
        <ReportBuilder editor={createReportEditor(session, { locale: 'de-CH' })} />
      </>,
    )
    await userEvent.setup().click(screen.getAllByRole('treeitem', { name: 'Introduction' })[0] as HTMLElement)
    expect(screen.getByRole('form', { name: `${en('kind.text')}: Introduction` })).toBeTruthy()
    expect(screen.getByRole('form', { name: de('properties.report') })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: en('field.text') })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: de('field.title') })).toBeTruthy()
  })
})
