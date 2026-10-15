/**
 * The toolbar: undo and redo, the structural actions on the selection, the
 * zoom, and the panes a narrow screen shows one at a time.
 *
 * One tab stop for the whole bar, the arrow keys moving within it, as the
 * ARIA toolbar pattern has it. A tool with nothing to act on is
 * `aria-disabled` rather than `disabled`: it stays where focus is, so the
 * person who just pressed Redo for the last time keeps their place, and
 * pressing it again says why nothing happened instead of doing nothing.
 */
import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import type { EditorAction, EditorPanel, EditorState, EditorText } from '@formancy/report-builder-core'

/** What activating a tool does: an action for the editor, the place dialog for the selection, or a pane. */
type Use = { readonly action: EditorAction } | { readonly placeSelection: true } | { readonly pane: EditorPanel }

interface Tool {
  readonly name: string
  readonly use: Use
  readonly available: boolean
  /** Said as its description: what undo or redo would take back. */
  readonly title?: string
}

export interface ToolbarProps {
  readonly state: EditorState
  readonly t: EditorText
  readonly act: (action: EditorAction) => void
  /** Opens the place dialog for the selection, focus to return to `from`. */
  readonly placeSelection: (from: HTMLElement) => void
  readonly showPane: (pane: EditorPanel) => void
}

function tools(state: EditorState, t: EditorText): { readonly before: readonly Tool[]; readonly zoom: readonly Tool[]; readonly panes: readonly Tool[] } {
  const { history, can } = state
  const act = (action: EditorAction): Use => ({ action })
  return {
    before: [
      { name: t('action.undo'), use: act({ type: 'undo' }), available: history.canUndo, ...(history.undoLabel === null ? {} : { title: t('action.undoWhat', { label: history.undoLabel }) }) },
      { name: t('action.redo'), use: act({ type: 'redo' }), available: history.canRedo, ...(history.redoLabel === null ? {} : { title: t('action.redoWhat', { label: history.redoLabel }) }) },
      { name: t('action.moveUp'), use: act({ type: 'moveUp' }), available: can.moveUp },
      { name: t('action.moveDown'), use: act({ type: 'moveDown' }), available: can.moveDown },
      { name: t('action.indent'), use: act({ type: 'indent' }), available: can.indent },
      { name: t('action.outdent'), use: act({ type: 'outdent' }), available: can.outdent },
      { name: t('action.moveTo'), use: { placeSelection: true }, available: can.moveTo },
      { name: t('action.duplicate'), use: act({ type: 'duplicate' }), available: can.duplicate },
      { name: t('action.delete'), use: act({ type: 'delete' }), available: can.delete },
    ],
    zoom: [
      { name: t('action.zoomOut'), use: act({ type: 'zoomOut' }), available: can.zoomOut },
      { name: t('action.zoomIn'), use: act({ type: 'zoomIn' }), available: can.zoomIn },
      { name: t('action.zoomReset'), use: act({ type: 'setZoom', zoom: 1 }), available: can.zoomReset },
    ],
    panes: [
      { name: t('pane.outline'), use: { pane: 'outline' }, available: true },
      { name: t('pane.canvas'), use: { pane: 'canvas' }, available: true },
      { name: t('pane.properties'), use: { pane: 'properties' }, available: true },
      { name: t('pane.problems'), use: { pane: 'diagnostics' }, available: true },
    ],
  }
}

/**
 * Which way the arrow keys step: the reading direction the page declares, so
 * → is "next" in a left-to-right page and "previous" in a right-to-left one.
 * A key held with a modifier is the browser's or the screen reader's, never
 * the toolbar's.
 */
function step(event: KeyboardEvent<HTMLElement>, at: number, count: number): number | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey) return undefined
  const forwards = event.currentTarget.closest('[dir]')?.getAttribute('dir') === 'rtl' ? -1 : 1
  switch (event.key) {
    case 'ArrowRight':
      return (at + forwards + count) % count
    case 'ArrowLeft':
      return (at - forwards + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return undefined
  }
}

export function Toolbar({ state, t, act, placeSelection, showPane }: ToolbarProps): ReactElement {
  const [active, setActive] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const { before, zoom, panes } = tools(state, t)
  const all = [...before, ...zoom, ...panes]

  function use(tool: Tool, from: HTMLElement): void {
    if ('pane' in tool.use) return showPane(tool.use.pane)
    // Every other unavailable tool still asks, and the editor says why not;
    // this one has no component to place, only a table's column.
    if ('placeSelection' in tool.use) return tool.available ? placeSelection(from) : undefined
    act(tool.use.action)
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>): void {
    const next = step(event, active, all.length)
    if (next === undefined) return
    event.preventDefault()
    buttons.current[next]?.focus()
  }

  const button = (tool: Tool, at: number): ReactElement => (
    <button
      key={tool.name}
      ref={(element) => {
        buttons.current[at] = element
      }}
      type="button"
      tabIndex={at === active ? 0 : -1}
      aria-disabled={tool.available ? undefined : true}
      title={tool.title}
      onFocus={() => setActive(at)}
      onClick={(event) => use(tool, event.currentTarget)}
    >
      {tool.name}
    </button>
  )

  return (
    <div role="toolbar" aria-label={t('toolbar.label')} data-report-part="toolbar" className="wb-tools" onKeyDown={onKeyDown}>
      {before.map((tool, at) => button(tool, at))}
      {button(zoom[0] as Tool, before.length)}
      {/* The zoom as a value, named. Off as a live region: the editor's own
          status line already says "Zoom 125%." once, and an <output> is a
          live region of its own that would say it twice. */}
      <output aria-label={t('zoom.label')} aria-live="off" data-report-part="zoom">
        {state.zoomLabel}
      </output>
      {zoom.slice(1).map((tool, at) => button(tool, before.length + 1 + at))}
      {panes.map((tool, at) => button(tool, before.length + zoom.length + at))}
    </div>
  )
}
