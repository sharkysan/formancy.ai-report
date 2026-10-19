import { SCENARIO_PNG } from '@formancy/report-builder-core'
import type { AddedImage } from '@formancy/report-builder-core'
import { setTitle } from '@formancy/report-core'
import { describe, expect, test } from 'vitest'
import { MIDDLE } from './layout.js'
import { BLANK } from './starters/starters.js'
import { setWidth } from './test-width.js'
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

  // An image added in one starter's builder is kept where the Preview's
  // lookup finds it, whichever starter adds it: one store, given to every
  // editor the workspace makes. An editor made without it would offer no
  // Add image…, and one made with a store of its own would keep bytes the
  // page's lookup never sees, and its Preview would refuse the image.
  test('makes every starter’s editor with the one store the page keeps images in', async () => {
    const kept: AddedImage[] = []
    const workspace = createWorkspace([BLANK, OTHER], { images: { keep: async (image) => (kept.push(image), { ok: true }) } })
    const file = { name: 'logo.png', size: SCENARIO_PNG.length, arrayBuffer: async () => Uint8Array.from(SCENARIO_PNG).buffer }
    for (const id of ['blank', 'other']) {
      const { editor } = workspace.open(id)
      expect(editor.state().images.store).toBe(true)
      expect(await editor.addImage(file)).toEqual({ ok: true })
    }
    expect(kept.map((image) => image.asset)).toEqual(['logo', 'logo'])
    workspace.dispose()
    // and without a store, an editor that offers no Add image…
    const bare = createWorkspace([BLANK])
    expect(bare.open('blank').editor.state().images.store).toBe(false)
    bare.dispose()
  })

  // A starter the list does not have is a bug in the page, said as one.
  test('refuses a starter it does not have', () => {
    expect(() => createWorkspace([BLANK]).open('missing')).toThrow(/missing/)
  })

  // Every starter opens with its PDF in sight (0029): in the design view's
  // place where the window has no room beside the builder, beside it where
  // it has. An editor made in the middle and moved beside only after its
  // first frame would print one Preview in the builder and tear it down.
  test('opens each editor with its Preview shown, where the window has room for it', () => {
    const workspace = createWorkspace([BLANK, OTHER])
    expect(workspace.open('blank').editor.state().hostView).toEqual({ name: 'Preview', shown: true, place: 'middle' })
    setWidth(2053)
    expect(workspace.open('other').editor.state().hostView).toEqual({ name: 'Preview', shown: true, place: 'beside' })
    workspace.dispose()
  })

  // The window crossing 2052 pixels moves every starter's Preview, not only
  // the one shown: a starter picked again after the window was widened
  // would otherwise draw its Preview in the builder's middle in a window
  // with room beside it. Disposed, the workspace stops listening.
  test('tells every editor where its Preview stands as the window crosses the width', () => {
    const room = window.matchMedia(MIDDLE)
    const listening = new Set<unknown>()
    const add = room.addEventListener.bind(room)
    const remove = room.removeEventListener.bind(room)
    room.addEventListener = ((type: string, listener: EventListener) => (listening.add(listener), add(type, listener))) as typeof room.addEventListener
    room.removeEventListener = ((type: string, listener: EventListener) => (listening.delete(listener), remove(type, listener))) as typeof room.removeEventListener
    const workspace = createWorkspace([BLANK, OTHER], { room })
    const [blank, other] = [workspace.open('blank').editor, workspace.open('other').editor]
    setWidth(2053)
    expect([blank.state().hostView?.place, other.state().hostView?.place]).toEqual(['beside', 'beside'])
    setWidth(2052)
    expect([blank.state().hostView?.place, other.state().hostView?.place]).toEqual(['middle', 'middle'])
    expect(listening.size).toBe(1)
    workspace.dispose()
    expect(listening.size).toBe(0)
  })
})
