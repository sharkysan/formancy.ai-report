/**
 * Which key does what, decided once for both builders: a builder passes
 * each key press from the outline or the editor's chrome here and
 * dispatches what comes back, so the two cannot bind different keys.
 *
 * The outline follows the tree pattern -- Up and Down walk it, Left goes
 * to what holds the row and Right to the first thing it holds, Home and End
 * jump -- and adds the keyboard path for every drag (formancy.ai 0046): Alt
 * with an arrow moves within the list, into the container before, and out
 * of one. Undo, redo and zoom work anywhere in the editor. A text field keeps
 * its own keys and is never asked: its Ctrl+Z undoes typing, not the report.
 */
import type { EditorAction } from './model-actions.js'

/** A key press, as a KeyboardEvent says it. */
export interface KeyPress {
  readonly key: string
  readonly altKey?: boolean
  readonly ctrlKey?: boolean
  readonly metaKey?: boolean
  readonly shiftKey?: boolean
}

/** Where focus is: the outline's tree, or anywhere else in the editor that is not a text field. */
export type KeyScope = 'outline' | 'editor'

const PLAIN: Readonly<Record<string, EditorAction>> = {
  ArrowDown: { type: 'selectNext' },
  ArrowUp: { type: 'selectPrevious' },
  ArrowLeft: { type: 'selectParent' },
  ArrowRight: { type: 'selectChild' },
  Home: { type: 'selectFirst' },
  End: { type: 'selectLast' },
  Delete: { type: 'delete' },
  Backspace: { type: 'delete' },
}

const WITH_ALT: Readonly<Record<string, EditorAction>> = {
  ArrowUp: { type: 'moveUp' },
  ArrowDown: { type: 'moveDown' },
  ArrowRight: { type: 'indent' },
  ArrowLeft: { type: 'outdent' },
}

/** With Ctrl, or Cmd on a Mac, anywhere in the editor. */
const COMMAND: Readonly<Record<string, EditorAction>> = {
  z: { type: 'undo' },
  y: { type: 'redo' },
  '+': { type: 'zoomIn' },
  '=': { type: 'zoomIn' },
  '-': { type: 'zoomOut' },
  '0': { type: 'setZoom', zoom: 1 },
}

/** The action a key press asks for where focus is, or undefined for a key the editor leaves to the browser and the page. */
export function actionForKey(press: KeyPress, scope: KeyScope, dragging = false): EditorAction | undefined {
  const { key, altKey = false, ctrlKey = false, metaKey = false, shiftKey = false } = press
  const command = ctrlKey || metaKey
  if (key === 'Escape') return dragging && !command && !altKey ? { type: 'cancelDrag' } : undefined
  if (command && !altKey) {
    const lower = key.toLowerCase()
    if (lower === 'z') return shiftKey ? { type: 'redo' } : COMMAND.z
    // A plus is typed with Shift on many keyboards.
    if (lower === '+') return COMMAND['+']
    if (shiftKey) return undefined
    if (lower === 'd') return scope === 'outline' ? { type: 'duplicate' } : undefined
    return Object.hasOwn(COMMAND, lower) ? COMMAND[lower] : undefined
  }
  if (scope !== 'outline' || command || shiftKey) return undefined
  const table = altKey ? WITH_ALT : PLAIN
  return Object.hasOwn(table, key) ? table[key] : undefined
}
