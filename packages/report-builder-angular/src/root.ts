/**
 * The editor's root: the element every part of the builder stands in, and
 * the one object the parts share.
 *
 * It holds the editor's state as a signal, the editor's words, and the
 * three things only the root can do: route a key press to the action it
 * asks for, dispatch an action, and put focus where the action left the
 * person. The parts inject it, as a form control injects its form. What any
 * of it means is report-builder-core's: which key does what (`actionForKey`),
 * what is selected, where a component may go. This decides only where focus
 * goes in this DOM.
 */
import { afterEveryRender, computed, Directive, ElementRef, inject, input } from '@angular/core'
import { actionForKey, editorText } from '@formancy/report-builder-core'
import type { DragSubject, DropTarget, EditorAction, EditorOutcome, EditorPanel, EditorText, KeyScope, ReportEditor } from '@formancy/report-builder-core'
import { injectEditorState } from './editor-state'

/** Where focus goes once what an action changed has rendered. */
export type FocusAfter =
  /** The selected outline row, which focus follows (the tree pattern); the tree itself when nothing is selected. */
  | { readonly to: 'selection' }
  /** The first place in the place chooser that has just opened, or its Cancel when there is none. */
  | { readonly to: 'places' }
  /** Back to the element that opened the place chooser. */
  | { readonly to: 'element'; readonly element: HTMLElement }
  /** Into a pane a narrow screen has just shown: its tree, its view, its first field or its list. */
  | { readonly to: 'pane'; readonly panel: EditorPanel }

let roots = 0

/** Inputs whose own keys win: typing, and a select's arrows. Ctrl+Z in one undoes typing, not the report. */
function keepsItsKeys(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true
  if (element instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(element.type)
  return element instanceof HTMLElement && element.isContentEditable
}

/**
 * What focus lands on in each pane, the first of these that is there: the
 * selected outline row, else the tree's one tab stop, else the tree itself;
 * the design view; the first field; the problems' list.
 */
const PANE_FOCUS: Readonly<Record<EditorPanel, readonly string[]>> = {
  outline: ['[role="treeitem"][aria-selected="true"]', '[role="treeitem"][tabindex="0"]', '[role="tree"]'],
  canvas: ['[data-report-part="canvas"]'],
  properties: ['[data-report-part="properties"] :is(input, select, textarea)'],
  diagnostics: ['[data-report-part="diagnostics"]'],
}

/**
 * Where focus goes after an action in the outline: the selected row, else
 * the tree itself -- never the first row, which focus would select, so that
 * after an undo that leaves nothing selected the next Delete deletes nothing
 * the person did not choose.
 */
const SELECTION_FOCUS: readonly string[] = ['[role="treeitem"][aria-selected="true"]', '[role="tree"]']

@Directive({
  selector: '[reportEditor]',
  host: {
    role: 'region',
    'data-report-part': 'editor',
    class: 'wb',
    '[attr.aria-label]': 't()("editor.label")',
    '[attr.data-panel]': 'state().panel',
    '(keydown)': 'keydown($event)',
  },
})
export class ReportEditorRoot {
  /** The editor this builder renders and acts on. Several builders may share one; each is told of the others' edits. */
  readonly editor = input.required<ReportEditor>({ alias: 'reportEditor' })
  readonly state = injectEditorState(this.editor)
  /** The editor's own words, in the editor's language. */
  readonly t = computed<EditorText>(() => editorText(this.state().locale))
  /** Unique on the page, so the ids tying a label or a description to its control are too. */
  readonly id = `report-editor-${String((roots += 1))}`
  /** The sentence beside an outline with no row, which describes the empty tree. */
  readonly outlineEmpty = `${this.id}-outline-empty`

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)
  private focusAfter: FocusAfter | null = null
  /** What opened the place chooser, for focus to go back to when it is cancelled. */
  private opener: HTMLElement | null = null

  constructor() {
    afterEveryRender(() => this.moveFocus())
  }

  /**
   * Sends `action` to the editor, and moves focus as `focus` says once
   * what it changed has rendered. Every action comes from a listener of this
   * builder's, and a listener marks its view for check, so a render follows
   * even an action that changed nothing: the focus never waits for whatever
   * renders next.
   */
  dispatch(action: EditorAction, focus?: FocusAfter): EditorOutcome {
    if (focus !== undefined) this.focusAfter = focus
    return this.editor().dispatch(action)
  }

  /**
   * Opens the place chooser for `subject`, remembering `opener` to come back
   * to. It floats over the outline pane, so that is the pane a narrow screen
   * shows while it is open.
   */
  choosePlace(subject: DragSubject, opener: HTMLElement): void {
    this.opener = opener
    const outcome = this.dispatch({ type: 'startDrag', subject, via: 'keyboard' }, { to: 'places' })
    // Refused -- an image with nothing to draw -- and announced; there is no chooser to come back from.
    if (outcome.ok) this.dispatch({ type: 'openPanel', panel: 'outline' })
    else this.opener = null
  }

  /** Puts `subject` at `target`: an insert or a move, never a second copy of either. */
  place(subject: DragSubject, target: DropTarget): void {
    this.opener = null
    this.dispatch('kind' in subject ? { type: 'insert', kind: subject.kind, target: target.location } : { type: 'move', id: subject.id, target: target.location }, { to: 'selection' })
  }

  /**
   * Starts a pointer's drag of `subject`. One the editor refuses -- a kind
   * the report cannot hold yet -- is announced, and not picked up at all.
   */
  pickUp(event: DragEvent, subject: DragSubject, label: string): void {
    // Firefox starts no drag without data. What is dragged is the editor's to know; this is a name for it.
    event.dataTransfer?.setData('text/plain', label)
    if (!this.dispatch({ type: 'startDrag', subject, via: 'pointer' }).ok) event.preventDefault()
  }

  /** Drops what a pointer drags on the place it is over; focus follows to what was placed, as after the keyboard's choice. */
  putDown(event: DragEvent): void {
    if (this.state().drag?.via !== 'pointer') return
    event.preventDefault()
    this.dispatch({ type: 'drop' }, { to: 'selection' })
  }

  /**
   * Ends a drag without placing anything. A keyboard's goes back to what
   * opened the chooser (the dialog pattern); a pointer's leaves focus where
   * it is, because a pointer never moved it.
   */
  cancelPlacing(): void {
    const keyboard = this.state().drag?.via === 'keyboard'
    const back = this.opener ?? (keyboard ? this.placedFrom() : null)
    this.opener = null
    this.dispatch({ type: 'cancelDrag' }, back === null ? undefined : { to: 'element', element: back })
  }

  /**
   * Where a keyboard's chooser goes back to when this builder did not open
   * it -- the drag is the editor's and outlives a builder, so a Studio that
   * switches frameworks draws it here: the palette entry of what is being
   * placed, else the selected outline row, else the tree. Never nothing,
   * which would leave the keyboard on the page.
   */
  private placedFrom(): HTMLElement | null {
    const subject = this.state().drag?.subject
    const root = this.host.nativeElement
    const entry = subject !== undefined && 'kind' in subject ? root.querySelector<HTMLElement>(`[data-report-part="palette-item"][data-kind="${subject.kind}"]`) : null
    return entry ?? root.querySelector<HTMLElement>(SELECTION_FOCUS.join(', '))
  }

  /** A pointer's drag let go of anywhere but a place: it ends, and nothing changes. After a drop there is none left to end. */
  dragEnded(): void {
    if (this.state().drag?.via === 'pointer') this.cancelPlacing()
  }

  /** Shows `panel` on a narrow screen and takes focus into it, so the pane that appears is where the keyboard is. */
  showPane(panel: EditorPanel): void {
    this.dispatch({ type: 'openPanel', panel }, { to: 'pane', panel })
  }

  protected keydown(event: KeyboardEvent): void {
    // A key press reaches the root from an element inside it.
    const target = event.target as Element
    if (keepsItsKeys(target)) return
    const scope: KeyScope = target.closest('[role="tree"]') === null ? 'editor' : 'outline'
    const action = actionForKey(event, scope, this.state().drag !== null)
    if (action === undefined) return
    // Alt+Left is the browser's Back and Ctrl+D its bookmark: the editor's, here.
    event.preventDefault()
    if (action.type === 'cancelDrag') return this.cancelPlacing()
    this.dispatch(action, scope === 'outline' ? { to: 'selection' } : undefined)
  }

  private moveFocus(): void {
    const focus = this.focusAfter
    if (focus === null) return
    this.focusAfter = null
    const root = this.host.nativeElement
    // In the order the selectors are listed, not the order of the page: the selected row before the first one.
    const first = (selectors: readonly string[]): HTMLElement | null => selectors.reduce<HTMLElement | null>((found, selector) => found ?? root.querySelector<HTMLElement>(selector), null)
    const element =
      focus.to === 'element'
        ? focus.element
        : focus.to === 'places'
          ? root.querySelector<HTMLElement>('[data-report-part="places"] button')
          : first(focus.to === 'pane' ? PANE_FOCUS[focus.panel] : SELECTION_FOCUS)
    element?.focus()
  }
}
