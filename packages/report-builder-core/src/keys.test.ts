import { describe, expect, test } from 'vitest'
import { actionForKey } from './keys.js'

describe('actionForKey', () => {
  // The tree pattern's keys: arrows walk the outline, Home and End jump.
  // Decided here once, so the two builders cannot bind different keys.
  test('walks the outline with the arrows, Home and End', () => {
    expect(actionForKey({ key: 'ArrowDown' }, 'outline')).toEqual({ type: 'selectNext' })
    expect(actionForKey({ key: 'ArrowUp' }, 'outline')).toEqual({ type: 'selectPrevious' })
    expect(actionForKey({ key: 'Home' }, 'outline')).toEqual({ type: 'selectFirst' })
    expect(actionForKey({ key: 'End' }, 'outline')).toEqual({ type: 'selectLast' })
  })

  // The tree pattern's Left and Right: out to what holds the row, in to
  // the first thing it holds. Without them the two keys a screen reader
  // user presses first in a tree do nothing at all.
  test('steps out of a row and into it with Left and Right', () => {
    expect(actionForKey({ key: 'ArrowLeft' }, 'outline')).toEqual({ type: 'selectParent' })
    expect(actionForKey({ key: 'ArrowRight' }, 'outline')).toEqual({ type: 'selectChild' })
    expect(actionForKey({ key: 'ArrowLeft' }, 'editor')).toBeUndefined()
    expect(actionForKey({ key: 'ArrowRight', shiftKey: true }, 'outline')).toBeUndefined()
  })

  // Every drag has a keyboard path (formancy.ai 0046): Alt with an arrow
  // moves within the list, into the container before, and out of one.
  test('moves, indents and outdents with Alt and an arrow', () => {
    expect(actionForKey({ key: 'ArrowUp', altKey: true }, 'outline')).toEqual({ type: 'moveUp' })
    expect(actionForKey({ key: 'ArrowDown', altKey: true }, 'outline')).toEqual({ type: 'moveDown' })
    expect(actionForKey({ key: 'ArrowRight', altKey: true }, 'outline')).toEqual({ type: 'indent' })
    expect(actionForKey({ key: 'ArrowLeft', altKey: true }, 'outline')).toEqual({ type: 'outdent' })
  })

  // Delete and Backspace both delete, as in every outliner; Ctrl+D or
  // Cmd+D duplicates.
  test('deletes and duplicates the selection', () => {
    expect(actionForKey({ key: 'Delete' }, 'outline')).toEqual({ type: 'delete' })
    expect(actionForKey({ key: 'Backspace' }, 'outline')).toEqual({ type: 'delete' })
    expect(actionForKey({ key: 'd', ctrlKey: true }, 'outline')).toEqual({ type: 'duplicate' })
    expect(actionForKey({ key: 'D', metaKey: true }, 'outline')).toEqual({ type: 'duplicate' })
  })

  // Undo, redo and zoom work wherever focus is in the editor -- except a
  // text field, which keeps its own undo, and is never asked.
  test('undoes, redoes and zooms anywhere in the editor', () => {
    for (const where of ['outline', 'editor'] as const) {
      expect(actionForKey({ key: 'z', ctrlKey: true }, where)).toEqual({ type: 'undo' })
      expect(actionForKey({ key: 'z', metaKey: true }, where)).toEqual({ type: 'undo' })
      expect(actionForKey({ key: 'Z', ctrlKey: true, shiftKey: true }, where)).toEqual({ type: 'redo' })
      expect(actionForKey({ key: 'y', ctrlKey: true }, where)).toEqual({ type: 'redo' })
      expect(actionForKey({ key: '+', ctrlKey: true }, where)).toEqual({ type: 'zoomIn' })
      expect(actionForKey({ key: '=', ctrlKey: true }, where)).toEqual({ type: 'zoomIn' })
      // A plus is typed with Shift on many keyboards, and is still a plus.
      expect(actionForKey({ key: '+', ctrlKey: true, shiftKey: true }, where)).toEqual({ type: 'zoomIn' })
      expect(actionForKey({ key: '-', metaKey: true }, where)).toEqual({ type: 'zoomOut' })
      expect(actionForKey({ key: '0', ctrlKey: true }, where)).toEqual({ type: 'setZoom', zoom: 1 })
    }
  })

  // Escape lets go of a drag; with nothing dragged it is the page's, and a
  // dialog's, to use.
  test('cancels a drag with Escape, and only then', () => {
    expect(actionForKey({ key: 'Escape' }, 'editor', true)).toEqual({ type: 'cancelDrag' })
    expect(actionForKey({ key: 'Escape' }, 'editor')).toBeUndefined()
  })

  // A key the editor does not claim is left to the browser and the page:
  // the outline's keys outside the outline, letters typed, Alt with
  // anything but an arrow, a modifier that changes the shortcut.
  test('claims nothing else', () => {
    expect(actionForKey({ key: 'ArrowDown' }, 'editor')).toBeUndefined()
    expect(actionForKey({ key: 'Delete' }, 'editor')).toBeUndefined()
    expect(actionForKey({ key: 'd', ctrlKey: true }, 'editor')).toBeUndefined()
    expect(actionForKey({ key: 'a' }, 'outline')).toBeUndefined()
    expect(actionForKey({ key: 'Delete', altKey: true }, 'outline')).toBeUndefined()
    expect(actionForKey({ key: 'ArrowDown', ctrlKey: true }, 'outline')).toBeUndefined()
    expect(actionForKey({ key: 'ArrowDown', shiftKey: true }, 'outline')).toBeUndefined()
    expect(actionForKey({ key: 'z', ctrlKey: true, altKey: true }, 'outline')).toBeUndefined()
    expect(actionForKey({ key: 'D', ctrlKey: true, shiftKey: true }, 'outline')).toBeUndefined()
    expect(actionForKey({ key: 'Home', ctrlKey: true }, 'outline')).toBeUndefined()
  })
})
