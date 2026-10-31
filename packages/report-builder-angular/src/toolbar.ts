/**
 * The toolbar: undo and redo, the keyboard's moves, the zoom, and the panes
 * a narrow screen shows one at a time.
 *
 * One tab stop, with the arrow keys between its buttons (the toolbar
 * pattern), stepping the way the page reads; an arrow held with a modifier
 * is the browser's or the screen reader's. A button whose action has
 * nowhere to go says so with `aria-disabled` and stays focusable, so
 * pressing Redo until there is nothing left to redo does not drop focus to
 * the page -- where the next Ctrl+Z would reach nothing -- and pressing it
 * again still asks the editor, which says why nothing happened.
 */
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal } from '@angular/core'
import type { EditorAction, EditorPanel, EditorState, EditorText } from '@formancy/report-builder-core'
import { ReportEditorRoot } from './root'

/** What a tool does: an action for the editor, the place chooser for the selection, or a pane. */
type Use = { readonly action: EditorAction } | { readonly placeSelection: true } | { readonly pane: EditorPanel }

interface Tool {
  readonly label: string
  readonly use: Use
  readonly available: boolean
  /** What undo or redo would take back. */
  readonly title: string | null
}

function tools(state: EditorState, t: EditorText): Tool[] {
  const { history, can } = state
  const tool = (label: Parameters<EditorText>[0], use: Use, available: boolean, title: string | null = null): Tool => ({
    label: t(label),
    use,
    available,
    title,
  })
  const act = (action: EditorAction): Use => ({ action })
  return [
    tool('action.undo', act({ type: 'undo' }), history.canUndo, history.undoLabel === null ? null : t('action.undoWhat', { label: history.undoLabel })),
    tool('action.redo', act({ type: 'redo' }), history.canRedo, history.redoLabel === null ? null : t('action.redoWhat', { label: history.redoLabel })),
    tool('action.moveUp', act({ type: 'moveUp' }), can.moveUp),
    tool('action.moveDown', act({ type: 'moveDown' }), can.moveDown),
    tool('action.indent', act({ type: 'indent' }), can.indent),
    tool('action.outdent', act({ type: 'outdent' }), can.outdent),
    tool('action.moveTo', { placeSelection: true }, can.moveTo),
    tool('action.duplicate', act({ type: 'duplicate' }), can.duplicate),
    tool('action.delete', act({ type: 'delete' }), can.delete),
    tool('action.zoomOut', act({ type: 'zoomOut' }), can.zoomOut),
    tool('action.zoomIn', act({ type: 'zoomIn' }), can.zoomIn),
    tool('action.zoomReset', act({ type: 'setZoom', zoom: 1 }), can.zoomReset),
    tool('pane.outline', { pane: 'outline' }, true),
    tool('pane.canvas', { pane: 'canvas' }, true),
    tool('pane.properties', { pane: 'properties' }, true),
    tool('pane.problems', { pane: 'diagnostics' }, true),
  ]
}

@Component({
  selector: 'div[reportToolbar]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'toolbar',
    'data-report-part': 'toolbar',
    class: 'wb-tools',
    '[attr.aria-label]': 't()("toolbar.label")',
    '(keydown)': 'along($event)',
  },
  template: `
    @for (tool of tools(); track tool.label; let at = $index) {
      @if (at === zoomAt()) {
        <!-- The live region already says "Zoom 125%."; the readout does not say it twice. -->
        <output data-report-part="zoom" aria-live="off" [attr.aria-label]="t()('zoom.label')">{{ state().zoomLabel }}</output>
      }
      <button
        type="button"
        [attr.aria-disabled]="tool.available ? null : 'true'"
        [attr.title]="tool.title"
        [tabIndex]="at === stop() ? 0 : -1"
        (focus)="stop.set(at)"
        (click)="use(tool, $event)"
      >{{ tool.label }}</button>
    }
  `,
})
export class ReportToolbar {
  private readonly root = inject(ReportEditorRoot)
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)
  protected readonly state = this.root.state
  protected readonly t = this.root.t
  protected readonly tools = computed(() => tools(this.state(), this.t()))
  /** Where the zoom's readout stands: just before Zoom in. */
  protected readonly zoomAt = computed(() => this.tools().findIndex((tool) => 'action' in tool.use && tool.use.action.type === 'zoomIn'))
  /** The button Tab lands on: the one last focused, Undo at first. */
  protected readonly stop = signal(0)

  protected use(tool: Tool, event: Event): void {
    const use = tool.use
    if ('pane' in use) return this.root.showPane(use.pane)
    // Every other unavailable tool still asks, and the editor says why not;
    // this one has no component to place, only a table's column, or nothing.
    if ('placeSelection' in use) {
      const selection = this.state().selection
      if (tool.available && selection !== null && 'id' in selection) this.root.choosePlace({ id: selection.id }, event.currentTarget as HTMLElement)
      return
    }
    this.root.dispatch(use.action)
  }

  protected along(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const buttons = [...this.host.nativeElement.querySelectorAll<HTMLElement>('button')]
    // Only its buttons take focus, so the key came from one of them.
    const at = buttons.findIndex((button) => button === event.target)
    // → is the next tool where the page reads left to right, and the one before where it reads right to left.
    const forwards = this.host.nativeElement.closest('[dir]')?.getAttribute('dir') === 'rtl' ? -1 : 1
    const count = buttons.length
    const to = new Map([
      ['ArrowRight', (at + forwards + count) % count],
      ['ArrowLeft', (at - forwards + count) % count],
      ['Home', 0],
      ['End', count - 1],
    ]).get(event.key)
    if (to === undefined) return
    event.preventDefault()
    buttons[to]?.focus()
  }
}
