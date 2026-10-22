/**
 * The report builder for React: the workbench's three panes over one
 * report-builder-core editor -- the palette and the outline, the design
 * view, the properties and the problems -- with the toolbar above them and
 * the status line below.
 *
 * It renders the editor's state and dispatches what the person did; it
 * decides nothing the editor decides. Keys are `actionForKey`'s, places are
 * the editor's drop targets, words are its catalogue. What is React's is
 * the subscription (`useSyncExternalStore`), the DOM, and focus: where focus
 * goes after an action, which only the builder can know, because only it
 * knows which element the person was on.
 *
 * The document and its history live in the session, so unmounting this and
 * mounting another builder -- React or Angular -- over the same session
 * loses nothing, and leaves no subscription behind.
 *
 * A host may give a view of its own -- the Studio's PDF -- which stands in
 * the design view's place while the editor says so (0029): a bare region,
 * named by the editor's `hostView`, holding what the host gave and nothing
 * of the builder's, its keys the host's.
 *
 * Where the host gave the editor a store for images, the palette ends with
 * Add image…, and the report's own properties list its images (0033): the
 * file a person chooses goes to `editor.addImage`, which says what became
 * of it; nothing here reads it.
 */
import { useCallback, useId, useLayoutEffect, useMemo, useRef } from 'react'
import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import { actionForKey, editorText } from '@formancy/report-builder-core'
import type { ComponentSelection, DiagnosticEntry, DragSubject, DropTarget, EditorAction, EditorOutcome, EditorPanel, HideablePanel, PropertyAction, ReportEditor } from '@formancy/report-builder-core'
import type { ComponentKind } from '@formancy/report-spec'
import { Canvas } from './canvas.js'
import { Diagnostics } from './diagnostics.js'
import { ImageChooser } from './image-chooser.js'
import { ImageLibrary } from './image-library.js'
import { Outline } from './outline.js'
import { Palette } from './palette.js'
import { Places } from './places.js'
import { usePointerDrag } from './pointer-drag.js'
import { Properties } from './properties.js'
import { Toolbar } from './toolbar.js'
import { useEditorState } from './use-editor-state.js'

export interface ReportBuilderProps {
  /**
   * The editor to render: one person's view of a report session. The
   * builder subscribes while it is mounted and never disposes the editor;
   * whoever created it does, once no builder shows it.
   */
  readonly editor: ReportEditor
  /**
   * What the builder draws in the design view's place while the editor's
   * `view` is the host's: the host's own view, named by the editor's
   * `hostView`. The builder lends it the middle pane's box and a region's
   * name, none of report-builder.css's rules -- the workbench's `.wb *`
   * reaches it, turning transitions off under reduced motion -- and none of
   * its keys; it is mounted only while drawn.
   */
  readonly hostView?: ReactNode
}

/**
 * Where focus goes once the result of an action is drawn: the selection's
 * outline row, the place dialog this builder has just opened, the element
 * that opened it, a pane, or where a group's button says (`then`): a button
 * of the group with that key, or its first field.
 */
type FocusAfter = 'selection' | 'places' | 'opener' | EditorPanel | NonNullable<PropertyAction['then']>

/** A field that keeps its own keys: Ctrl+Z in it undoes typing, not the report, and its arrows move its caret. A checkbox has no typing to undo. */
function keepsItsKeys(element: EventTarget): boolean {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true
  return element instanceof HTMLInputElement && element.type !== 'checkbox'
}

export function ReportBuilder({ editor, hostView }: ReportBuilderProps): ReactElement {
  const state = useEditorState(editor)
  const t = useMemo(() => editorText(state.locale), [state.locale])
  // Every id this builder mints starts here, so two builders on one page never share one.
  const ids = useId()
  const tree = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLElement>(null)
  /** The host's view's region, while it stands in the design view's place. */
  const view = useRef<HTMLElement>(null)
  /** The last key press the host's view had first: React bubbles one from a portal the host opened there through the view, wherever the portal's DOM is. */
  const hostKey = useRef<Event | null>(null)
  /** The element the keyboard last stood on in this builder, for a middle pane swapped from under it to hand the keyboard on. */
  const lastFocused = useRef<EventTarget | null>(null)
  /** Whether that element stood in the properties form, for a row taken from under it to hand the keyboard to the first field. */
  const lastInProperties = useRef(false)
  const sheet = useRef<HTMLDivElement>(null)
  const fields = useRef<HTMLDivElement>(null)
  const problemList = useRef<HTMLUListElement>(null)
  const root = useRef<HTMLElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  /** What the place dialog was placing when it closed, for focus to find its palette entry. */
  const closed = useRef<DragSubject | null>(null)
  const wanted = useRef<FocusAfter | null>(null)

  const focus = useCallback((where: FocusAfter): void => {
    const selectedRow = (): HTMLElement | null => tree.current?.querySelector<HTMLElement>('[role="treeitem"][aria-selected="true"]') ?? null
    if (typeof where === 'object') {
      // The groups stand in the form in the order of the state's rows: the one with the key, by its place among them.
      const groups = editor.state().properties.rows.flatMap((row) => ('group' in row ? [row.group.key] : []))
      const element = fields.current?.querySelectorAll<HTMLElement>('[data-report-part="property-group"]')[groups.indexOf(where.group)]
      return (where.button === undefined ? element?.querySelector<HTMLElement>('input, select, textarea') : element?.querySelectorAll<HTMLElement>(':scope > button')[where.button])?.focus()
    }
    switch (where) {
      // After an action that leaves nothing selected -- an undo of an
      // insert -- the tree itself: a row given focus would select itself,
      // and the next Delete would delete what nobody chose.
      case 'selection':
        return (selectedRow() ?? tree.current)?.focus()
      // Shown from the toolbar: the tree's tab stop, as Tab would reach it.
      case 'outline':
        return (selectedRow() ?? tree.current?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]') ?? tree.current)?.focus()
      case 'places':
        return root.current?.querySelector<HTMLElement>('[data-report-part="places"] button')?.focus()
      // What opened the place dialog; when another builder opened it -- the
      // drag outlived the builder that started it -- the palette entry of
      // what is being placed, or what is being moved, which stay in the
      // outline pane the dialog floated over.
      case 'opener': {
        const subject = closed.current
        const from =
          opener.current ??
          (subject !== null && 'kind' in subject ? root.current?.querySelector<HTMLElement>(`[data-report-part="palette-item"][data-kind="${subject.kind}"]`) : null) ??
          selectedRow() ??
          tree.current
        opener.current = null
        closed.current = null
        return from?.focus()
      }
      // The design view, or the host's view standing in its place.
      case 'canvas':
        return (canvas.current ?? view.current)?.focus()
      case 'properties':
        return fields.current?.querySelector<HTMLElement>('input, select, textarea')?.focus()
      case 'diagnostics':
        // The list, not its first entry: what is said first is how many there are.
        return problemList.current?.focus()
    }
  }, [editor])

  // After a render, the focus the action that caused it asked for: only now
  // is the row it selected, or the pane it opened, in the document.
  useLayoutEffect(() => {
    const where = wanted.current
    if (where === null) return
    wanted.current = null
    focus(where)
  })

  // The middle pane swapped by the host -- its view placed or shown from
  // outside, as the window crosses a width -- takes the keyboard along
  // rather than drop it on the page: where the element it stood on went
  // with the pane, and nothing has taken it since, it goes to what stands
  // in the middle now.
  useLayoutEffect(() => {
    const last = lastFocused.current
    const dropped = document.activeElement === null || document.activeElement === document.body
    if (last instanceof Node && !last.isConnected && dropped) focus('canvas')
  }, [state.view, focus])

  // An undo or a redo that takes away the row the keyboard stood on in the
  // properties -- an image's Remove, the add undone or the remove redone --
  // would leave it on the page: it goes to the first field, as a Remove
  // that worked sends it.
  useLayoutEffect(() => {
    const last = lastFocused.current
    const dropped = document.activeElement === null || document.activeElement === document.body
    if (lastInProperties.current && last instanceof Node && !last.isConnected && dropped) focus('properties')
  }, [state, focus])

  /** Dispatches `action`; when it succeeds, focus goes to `then` -- at once if nothing changed, else once the change is drawn. */
  function act(action: EditorAction, then?: FocusAfter): EditorOutcome {
    const before = editor.state()
    const outcome = editor.dispatch(action)
    if (then === undefined || !outcome.ok) return outcome
    if (editor.state() === before) focus(then)
    else wanted.current = then
    return outcome
  }

  const drag = usePointerDrag(editor, { tree, canvas, sheet }, () => {
    wanted.current = 'selection'
  })

  function onKeyDown(event: KeyboardEvent<HTMLElement>): void {
    // A key pressed in the host's view is the host's, as a text field's are its own.
    if (event.defaultPrevented || keepsItsKeys(event.target) || event.nativeEvent === hostKey.current) return
    const inTree = tree.current?.contains(event.target as Node) === true
    const action = actionForKey(event, inTree ? 'outline' : 'editor', state.drag !== null)
    if (action === undefined) return
    event.preventDefault()
    if (action.type === 'cancelDrag' && state.drag?.via === 'keyboard') return cancelPlaces()
    act(action, inTree ? 'selection' : undefined)
  }

  /**
   * Opens the place dialog for `subject`, focus to return to `from`, and
   * puts focus on its first place. Only here: a dialog that opened in
   * another builder -- the drag is the editor's, and outlives a builder --
   * is drawn by this one without taking the keyboard from where it is. It
   * floats over the outline pane, so that is the pane a narrow screen shows.
   */
  function openPlaces(subject: DragSubject, from: HTMLElement): void {
    opener.current = from
    if (!act({ type: 'startDrag', subject, via: 'keyboard' }).ok) {
      opener.current = null
      return
    }
    act({ type: 'openPanel', panel: 'outline' })
    // The drag began, so the dialog is drawn next: focus goes there then.
    wanted.current = 'places'
  }

  /** Closes the place dialog, Cancel or Escape, focus back to what opened it. */
  function cancelPlaces(): void {
    closed.current = editor.state().drag?.subject ?? null
    act({ type: 'cancelDrag' }, 'opener')
  }

  function place(kind: ComponentKind, from: HTMLElement): void {
    openPlaces({ kind }, from)
  }

  function placeSelection(from: HTMLElement): void {
    // The toolbar offers this only while `can.moveTo`, which holds only for a selected component.
    openPlaces({ id: (state.selection as ComponentSelection).id }, from)
  }

  function choose(subject: DragSubject, target: DropTarget): void {
    act('kind' in subject ? { type: 'insert', kind: subject.kind, target: target.location } : { type: 'move', id: subject.id, target: target.location }, 'selection')
  }

  function follow(entry: DiagnosticEntry): void {
    const { target } = entry
    if (target === null) act({ type: 'select', id: null })
    else if ('part' in target) act({ type: 'select', part: target.part }, 'selection')
    else act(target.column === undefined ? { type: 'select', id: target.id } : { type: 'select', id: target.id, column: target.column }, 'selection')
  }

  const choosing = state.drag?.via === 'keyboard' ? state.drag : null
  const count = state.diagnostics.length
  const shows = (panel: HideablePanel): boolean => !state.hidden.includes(panel)

  /** A side pane's Hide, named after the pane; the design view takes its room and the keyboard. */
  const hide = (panel: HideablePanel, name: string): ReactElement => (
    <button type="button" data-report-part="hide-pane" aria-label={t('action.hidePane', { pane: name })} onClick={() => act({ type: 'hidePanel', panel }, 'canvas')}>
      {t('action.hide')}
    </button>
  )

  return (
    <section
      ref={root}
      aria-label={t('editor.label')}
      className="wb"
      data-report-part="editor"
      data-panel={state.panel}
      data-hidden={state.hidden.length === 0 ? undefined : state.hidden.join(' ')}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        lastFocused.current = event.target
        lastInProperties.current = event.target.closest('[data-report-part="properties"]') !== null
      }}
    >
      {/* A bar across the panes: report-builder.css spans every root child that is no pane. */}
      <div className="wb-pane">
        <header>
          <span data-report-part="title">{state.document.title}</span>
          <Toolbar state={state} t={t} act={act} placeSelection={placeSelection} showPane={(pane) => act({ type: 'openPanel', panel: pane }, pane)} />
        </header>
      </div>

      {/* The place dialog floats over this pane: the canvas beside it stays
          in view, with the place the dialog's focus is on marked. Opening
          the dialog shows the pane, were it hidden. */}
      {shows('outline') ? (
        <section className="wb-pane" data-pane="outline">
          <header>
            <span>{t('pane.outline')}</span>
            {hide('outline', t('pane.outline'))}
          </header>
          <div className="wb-body">
            <Palette
              state={state}
              t={t}
              ids={ids}
              drag={drag}
              place={place}
              chooser={<ImageChooser state={state} t={t} ids={ids} choose={() => act({ type: 'chooseImage' }).ok} add={(file) => void editor.addImage(file)} />}
            />
            <Outline state={state} t={t} ids={ids} tree={tree} drag={drag} act={act} />
          </div>
          {choosing === null ? null : <Places state={state} drag={choosing} t={t} ids={ids} act={act} choose={choose} cancel={cancelPlaces} />}
        </section>
      ) : null}

      {/* The middle pane: the design view, or the host's view in its place --
          no workbench pane, so no rule of the builder's dresses what the host
          drew. Keyed, so that React draws each its own element rather than
          turn one into the other, the keyboard left on a pane no longer
          focusable. */}
      {state.view === 'host' ? (
        <section
          key="view"
          ref={view}
          aria-label={state.hostView?.name}
          data-pane="canvas"
          data-report-part="view"
          tabIndex={-1}
          onKeyDown={(event) => {
            hostKey.current = event.nativeEvent
          }}
        >
          {hostView}
        </section>
      ) : (
        <section key="design" className="wb-pane wb-canvas" data-pane="canvas">
          <header>{t('pane.canvas')}</header>
          <div className="wb-body">
            <Canvas state={state} t={t} canvas={canvas} sheet={sheet} drag={drag} select={(action) => act(action, 'selection')} />
          </div>
        </section>
      )}

      {/* The properties and the problems share the third column. On a narrow
          screen report-builder.css shows the one pane `data-panel` names, so
          this column says it is whichever of its two is asked for, and each
          half carries its own name for the other to be hidden by. Each half
          hides alone; the column goes with the second. */}
      {shows('properties') || shows('diagnostics') ? (
        <section className="wb-pane" data-pane={state.panel === 'diagnostics' || !shows('properties') ? 'diagnostics' : 'properties'}>
          {shows('properties') ? (
            <>
              <header data-pane="properties">
                <span>{state.properties.heading}</span>
                {state.selection === null ? null : (
                  <button type="button" onClick={() => act({ type: 'select', id: null }, 'properties')}>
                    {t('properties.report')}
                  </button>
                )}
                {hide('properties', t('pane.properties'))}
              </header>
              <div ref={fields} className="wb-body" data-pane="properties">
                <Properties
                  state={state}
                  ids={ids}
                  act={act}
                  press={(action) => act(action.action, action.then)}
                  library={state.selection === null ? <ImageLibrary state={state} t={t} ids={ids} remove={(asset) => act({ type: 'removeImage', asset }, 'properties')} /> : null}
                />
              </div>
            </>
          ) : null}
          {shows('diagnostics') ? (
            <>
              <header data-pane="diagnostics">
                {/* A status, so a change in how many problems there are is said
                    without taking the person's place: "Problems 2". Named in
                    words, never after its own heading, which the Studio sets in
                    capitals that Chromium would put in the name. */}
                <div role="status" aria-label={t('pane.problems')}>
                  <span>{t('pane.problems')}</span>
                  {count === 0 ? null : (
                    <>
                      {' '}
                      <span data-report-part="badge" data-severity={state.diagnostics.some((entry) => entry.severity === 'error') ? 'error' : 'warning'}>
                        {count}
                      </span>
                    </>
                  )}
                </div>
                {hide('diagnostics', t('pane.problems'))}
              </header>
              <div className="wb-body" data-pane="diagnostics">
                <Diagnostics state={state} t={t} ids={ids} list={problemList} follow={follow} />
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <div className="wb-pane">
        {/* The editor's announcements. Each is a new child, so the same words
            said twice -- "Nothing to undo." -- are two announcements, as the
            state's sequence number means them to be. */}
        <p role="status" data-report-part="status">
          {state.status.text === '' ? null : <span key={state.status.sequence}>{state.status.text}</span>}
        </p>
      </div>
    </section>
  )
}
