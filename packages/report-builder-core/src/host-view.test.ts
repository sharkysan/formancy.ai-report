/**
 * A host's view in the editor: a view of the host's own -- the Studio's PDF
 * preview -- that a builder draws in the design view's place while it is
 * shown there, and the host draws beside the builder while it stands there
 * (0029).
 *
 * The editor holds whether it is shown and where, so the toolbar's Design
 * view, the host's own control and the other framework's builder over the
 * same editor all read one answer. Like the hidden panes it is the editor's,
 * never the report's: no edit, undo or other editor touches it.
 */
import { setTitle } from '@formancy/report-core'
import { describe, expect, test, vi } from 'vitest'
import { createReportEditor } from './editor.js'
import type { EditorAction, EditorOutcome } from './model-actions.js'
import { EDITOR_LOCALES, editorText } from './text.js'
import { editorOver, richReport, sessionOver } from './test-support.js'

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

const preview = (shown = false, place: 'middle' | 'beside' = 'middle') => ({ hostView: { name: 'Preview', shown, place } }) as const

describe('an editor made without a host’s view', () => {
  // A host that never named a view has none to show: the builder draws the
  // design view, and an action about a view nobody gave is refused, said,
  // and changes nothing else -- not a region the builder would draw empty.
  test('has none, shows the design view, and refuses to show, hide or place one', () => {
    const { editor } = editorOver()
    expect(editor.state().hostView).toBeNull()
    expect(editor.state().view).toBe('design')
    const actions: EditorAction[] = [{ type: 'showHostView' }, { type: 'hideHostView' }, { type: 'placeHostView', place: 'beside' }]
    for (const action of actions) {
      const outcome = editor.dispatch(action)
      expect(outcome, action.type).toMatchObject({ ok: false, code: 'unavailable', message: editorText('en')('status.noHostView') })
      expect(editor.state().status.text).toBe(editorText('en')('status.noHostView'))
      expect(editor.state().hostView).toBeNull()
      expect(editor.state().view).toBe('design')
      expect(editor.state().panel).toBe('outline')
    }
  })
})

describe('an editor made with a host’s view', () => {
  // Hidden, in the design view's place, until the host says otherwise: an
  // option given only a name changes nothing a builder draws.
  test('starts hidden, in the middle, with the design view drawn', () => {
    const { editor } = editorOver(richReport(), { hostView: { name: 'Preview' } })
    expect(editor.state().hostView).toEqual({ name: 'Preview', shown: false, place: 'middle' })
    expect(editor.state().view).toBe('design')
    expect(editor.state().panel).toBe('outline')
  })

  // A narrow layout shows one pane; an editor made with its host's view
  // shown in the middle opens on that pane, not on an outline beside which
  // nothing is shown. Beside, the narrow layout is not the editor's to have.
  test('made shown in the middle, opens on it; made shown beside, on the outline', () => {
    const middle = editorOver(richReport(), preview(true)).editor.state()
    expect(middle.view).toBe('host')
    expect(middle.panel).toBe('canvas')
    const beside = editorOver(richReport(), preview(true, 'beside')).editor.state()
    expect(beside.view).toBe('design')
    expect(beside.panel).toBe('outline')
  })

  // A region with no name is a landmark a screen reader cannot tell from
  // another, and a place nobody knows is a view drawn nowhere: a host's
  // mistake, refused when it is made rather than drawn wrong later.
  test('refuses a view with no name, or a place it does not know', () => {
    const session = sessionOver(richReport())
    expect(() => createReportEditor(session, { hostView: { name: '' } })).toThrow(RangeError)
    expect(() => createReportEditor(session, { hostView: { name: '  ' } })).toThrow(RangeError)
    expect(() => createReportEditor(session, { hostView: { name: 'Preview', place: 'above' as never } })).toThrow(RangeError)
  })

  // The option is copied, never kept: the state is frozen to its leaves, and
  // freezing the host's own object would make it throw on the host's next
  // write to it, far from here.
  test('keeps a copy of the option, and leaves the host’s own object as it was', () => {
    const option = { name: 'Preview', shown: true }
    const { editor } = editorOver(richReport(), { hostView: option })
    const view = editor.state().hostView
    expect(view).toEqual({ name: 'Preview', shown: true, place: 'middle' })
    expect(view).not.toBe(option)
    expect(Object.isFrozen(view)).toBe(true)
    expect(Object.isFrozen(option)).toBe(false)
  })
})

describe('showing and hiding it', () => {
  // The Studio's Preview pressed: the PDF takes the design view's place,
  // the pane a narrow layout shows is that one, and the live region says
  // how to get the design view back -- the person's keyboard stays on the
  // host's control, which says only that it is pressed.
  test('shown in the middle, takes the design view’s place and says how to bring it back', () => {
    for (const locale of EDITOR_LOCALES) {
      const { editor } = editorOver(richReport(), { locale, ...preview() })
      ok(editor.dispatch({ type: 'openPanel', panel: 'properties' }))
      ok(editor.dispatch({ type: 'showHostView' }))
      const state = editor.state()
      expect(state.hostView, locale).toEqual({ name: 'Preview', shown: true, place: 'middle' })
      expect(state.view, locale).toBe('host')
      expect(state.panel, locale).toBe('canvas')
      expect(state.status.text, locale).toBe(editorText(locale)('status.hostViewShown', { view: 'Preview', pane: editorText(locale)('pane.canvas') }))
    }
  })

  // On a narrow screen the person can choose another pane while the view
  // is shown; showing it again is how it comes back into sight, so it is
  // the pane shown, and the live region says so as it did when it came:
  // the keyboard stays on the host's control, still pressed, and a screen
  // reader's user would hear nothing of what changed in front of them.
  // Asked again once it is the pane shown, nothing changes and nothing is
  // said.
  test('shown again in the middle, becomes the pane a narrow layout shows and says so; asked again, changes nothing', () => {
    const { editor } = editorOver(richReport(), preview(true))
    ok(editor.dispatch({ type: 'openPanel', panel: 'outline' }))
    const before = editor.state().status
    ok(editor.dispatch({ type: 'showHostView' }))
    expect(editor.state().panel).toBe('canvas')
    expect(editor.state().view).toBe('host')
    expect(editor.state().status).toEqual({
      text: editorText('en')('status.hostViewShown', { view: 'Preview', pane: 'Design view' }),
      sequence: before.sequence + 1,
    })
    const shown = editor.state()
    ok(editor.dispatch({ type: 'showHostView' }))
    expect(editor.state()).toBe(shown)
  })

  // Beside the builder the host draws it: the design view keeps its place,
  // and the pane a narrow layout shows is not the host's to change.
  test('shown beside, leaves the design view and the pane where they are', () => {
    const { editor } = editorOver(richReport(), preview(false, 'beside'))
    ok(editor.dispatch({ type: 'showHostView' }))
    expect(editor.state().hostView).toEqual({ name: 'Preview', shown: true, place: 'beside' })
    expect(editor.state().view).toBe('design')
    expect(editor.state().panel).toBe('outline')
    expect(editor.state().status.text).toBe('')
  })

  // Hidden by the host's own control, which says so by its pressed state:
  // the editor adds no sentence, and hiding what is hidden changes nothing.
  test('hidden, gives the design view its place back, silently', () => {
    const { editor } = editorOver(richReport(), preview(true))
    ok(editor.dispatch({ type: 'hideHostView' }))
    expect(editor.state().hostView?.shown).toBe(false)
    expect(editor.state().view).toBe('design')
    expect(editor.state().panel).toBe('canvas')
    expect(editor.state().status.text).toBe('')
    const hidden = editor.state()
    ok(editor.dispatch({ type: 'hideHostView' }))
    expect(editor.state()).toBe(hidden)
  })
})

describe('the toolbar’s Design view', () => {
  // The toolbar's Design view is the way back from the PDF to the design
  // view: it gives the design view its place, so the host's control reads
  // unpressed -- the Studio's Preview, swapped out, prints nothing.
  test('takes the design view’s place back from a host’s view in the middle', () => {
    const { editor } = editorOver(richReport(), preview(true))
    ok(editor.dispatch({ type: 'openPanel', panel: 'canvas' }))
    expect(editor.state().hostView?.shown).toBe(false)
    expect(editor.state().view).toBe('design')
  })

  // Beside the builder the PDF and the design view are in view together:
  // the toolbar's Design view takes nothing away there, or a wide screen
  // would lose its PDF to a button that only means "the design view".
  test('leaves a host’s view beside the builder shown, and every other pane leaves it in the middle', () => {
    const beside = editorOver(richReport(), preview(true, 'beside')).editor
    ok(beside.dispatch({ type: 'openPanel', panel: 'canvas' }))
    expect(beside.state().hostView?.shown).toBe(true)
    const middle = editorOver(richReport(), preview(true)).editor
    for (const panel of ['outline', 'properties', 'diagnostics'] as const) {
      ok(middle.dispatch({ type: 'openPanel', panel }))
      expect(middle.state().hostView?.shown, panel).toBe(true)
      expect(middle.state().view, panel).toBe('host')
    }
  })

  // A narrow layout's pane hidden gives way to the middle pane, whatever
  // stands in it: the host's view stays there, shown.
  test('a narrow layout’s pane hidden gives way to the host’s view in the middle', () => {
    const { editor } = editorOver(richReport(), preview(true))
    ok(editor.dispatch({ type: 'openPanel', panel: 'properties' }))
    ok(editor.dispatch({ type: 'hidePanel', panel: 'properties' }))
    expect(editor.state().panel).toBe('canvas')
    expect(editor.state().view).toBe('host')
  })
})

describe('the zoom, with it in the design view’s place', () => {
  // The zoom is the design view's. With the host's view in its place the
  // toolbar's zoom changed a readout beside a PDF at its own zoom, and
  // nothing anybody saw: it is unavailable, and asked anyway -- a shortcut
  // pressed in the outline -- it says why and changes nothing.
  test('is unavailable, and asked anyway says why and changes nothing', () => {
    for (const locale of EDITOR_LOCALES) {
      const t = editorText(locale)
      const { editor } = editorOver(richReport(), { locale, zoom: 1.5, ...preview(true) })
      expect(editor.state().can, locale).toMatchObject({ zoomIn: false, zoomOut: false, zoomReset: false })
      const asks: EditorAction[] = [{ type: 'zoomIn' }, { type: 'zoomOut' }, { type: 'setZoom', zoom: 1 }]
      for (const action of asks) {
        expect(editor.dispatch(action), `${locale} ${action.type}`).toMatchObject({
          ok: false,
          code: 'unavailable',
          message: t('status.zoomHidden', { view: 'Preview', pane: t('pane.canvas') }),
        })
        expect(editor.state().zoom, `${locale} ${action.type}`).toBe(1.5)
      }
    }
  })

  // Beside the builder, or once the toolbar's Design view brings it back,
  // the design view is drawn, and its zoom is the person's again.
  test('is the design view’s again wherever the design view is drawn', () => {
    const beside = editorOver(richReport(), { zoom: 1.5, ...preview(true, 'beside') }).editor
    expect(beside.state().can).toMatchObject({ zoomIn: true, zoomOut: true, zoomReset: true })
    ok(beside.dispatch({ type: 'zoomIn' }))
    const middle = editorOver(richReport(), { zoom: 1.5, ...preview(true) }).editor
    ok(middle.dispatch({ type: 'openPanel', panel: 'canvas' }))
    expect(middle.state().can).toMatchObject({ zoomIn: true, zoomOut: true, zoomReset: true })
    ok(middle.dispatch({ type: 'zoomOut' }))
    expect(middle.state().zoom).toBe(1.25)
  })
})

describe('placing it', () => {
  // Where the view stands is the host's to say, from the room it has; the
  // person's choice to see it or not stays as it was, and so does the pane.
  test('moves it between the middle and beside, shown or not as it was, silently', () => {
    const { editor } = editorOver(richReport(), preview(true))
    ok(editor.dispatch({ type: 'placeHostView', place: 'beside' }))
    expect(editor.state().hostView).toEqual({ name: 'Preview', shown: true, place: 'beside' })
    expect(editor.state().view).toBe('design')
    expect(editor.state().panel).toBe('canvas')
    ok(editor.dispatch({ type: 'placeHostView', place: 'middle' }))
    expect(editor.state().view).toBe('host')
    expect(editor.state().status.text).toBe('')
  })

  // A host places every editor it holds whenever its window crosses the
  // width, and again on each mount: placing it where it stands is no change,
  // tells no listener, and draws nothing again.
  test('placed where it stands, changes nothing and tells no one', () => {
    const { editor } = editorOver(richReport(), preview(true))
    const before = editor.state()
    const listener = vi.fn()
    editor.subscribe(listener)
    ok(editor.dispatch({ type: 'placeHostView', place: 'middle' }))
    expect(editor.state()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })

  // From a caller tsc never saw: a place nobody knows is refused, and the
  // view stays where it was.
  test('refuses a place it does not know', () => {
    const { editor } = editorOver(richReport(), preview(true))
    expect(editor.dispatch({ type: 'placeHostView', place: 'above' } as never)).toMatchObject({ ok: false, code: 'invalid-value' })
    expect(editor.state().hostView?.place).toBe('middle')
  })
})

describe('the host’s view is the editor’s', () => {
  // A host that subscribes to the view alone re-renders only when it
  // changes: the same object through an edit, a selection and a pane hidden.
  test('is the same object until it changes', () => {
    const { editor, session } = editorOver(richReport(), preview(true))
    const view = editor.state().hostView
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    ok(editor.dispatch({ type: 'hidePanel', panel: 'outline' }))
    expect(session.apply((report) => setTitle(report, 'Orders, Zürich')).ok).toBe(true)
    expect(editor.state().hostView).toBe(view)
    ok(editor.dispatch({ type: 'hideHostView' }))
    expect(editor.state().hostView).not.toBe(view)
  })

  // Undo takes back the report's steps, never where a person looked: a
  // Preview hidden stays hidden through an undo of the edit before it.
  test('is not touched by undo, and never reaches the report', () => {
    const { editor, session } = editorOver(richReport(), preview(true))
    const before = JSON.stringify(session.document())
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    ok(editor.dispatch({ type: 'delete' }))
    ok(editor.dispatch({ type: 'hideHostView' }))
    ok(editor.dispatch({ type: 'undo' }))
    expect(editor.state().hostView?.shown).toBe(false)
    expect(JSON.stringify(session.document())).toBe(before)
    expect(session.canRedo()).toBe(true)
  })

  // Two people's editors over one session each have their own: one hiding
  // its Preview hides nobody else's.
  test('is each editor’s own, over one session', () => {
    const session = sessionOver(richReport())
    const one = createReportEditor(session, preview(true))
    const two = createReportEditor(session, preview(true))
    ok(one.dispatch({ type: 'hideHostView' }))
    expect(two.state().hostView?.shown).toBe(true)
    expect(two.state().view).toBe('host')
  })
})
