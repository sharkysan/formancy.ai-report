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
 */
import { useCallback, useId, useLayoutEffect, useMemo, useRef } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import { actionForKey, editorText } from '@formancy/report-builder-core'
import type { DiagnosticEntry, DragSubject, DropTarget, EditorAction, EditorOutcome, EditorPanel, ReportEditor, Selection } from '@formancy/report-builder-core'
import type { ComponentKind } from '@formancy/report-spec'
import { Canvas } from './canvas.js'
import { Diagnostics } from './diagnostics.js'
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
}

/** Where focus goes once the result of an action is drawn: the selection's outline row, the element that opened the place dialog, or a pane. */
type FocusAfter = 'selection' | 'opener' | EditorPanel

/** A field that keeps its own keys: Ctrl+Z in it undoes typing, not the report, and its arrows move its caret. A checkbox has no typing to undo. */
function keepsItsKeys(element: EventTarget): boolean {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true
  return element instanceof HTMLInputElement && element.type !== 'checkbox'
}

export function ReportBuilder({ editor }: ReportBuilderProps): ReactElement {
  const state = useEditorState(editor)
  const t = useMemo(() => editorText(state.locale), [state.locale])
  // Every id this builder mints starts here, so two builders on one page never share one.
  const ids = useId()
  const tree = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const fields = useRef<HTMLDivElement>(null)
  const problemList = useRef<HTMLUListElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const wanted = useRef<FocusAfter | null>(null)

  const focus = useCallback((where: FocusAfter): void => {
    switch (where) {
      case 'selection':
      case 'outline': {
        const rows = tree.current
        const row = rows?.querySelector<HTMLElement>('[role="treeitem"][aria-selected="true"]') ?? rows?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]')
        return (row ?? rows)?.focus()
      }
      case 'opener':
        opener.current?.focus()
        opener.current = null
        return
      case 'canvas':
        return canvas.current?.focus()
      case 'properties':
        return fields.current?.querySelector<HTMLElement>('input, select, textarea')?.focus()
      case 'diagnostics':
        // The list, not its first entry: what is said first is how many there are.
        return problemList.current?.focus()
    }
  }, [])

  // After a render, the focus the action that caused it asked for: only now
  // is the row it selected, or the pane it opened, in the document.
  useLayoutEffect(() => {
    const where = wanted.current
    if (where === null) return
    wanted.current = null
    focus(where)
  })

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
    if (event.defaultPrevented || keepsItsKeys(event.target)) return
    const inTree = tree.current?.contains(event.target as Node) === true
    const action = actionForKey(event, inTree ? 'outline' : 'editor', state.drag !== null)
    if (action === undefined) return
    event.preventDefault()
    const closing = action.type === 'cancelDrag' && state.drag?.via === 'keyboard'
    act(action, inTree ? 'selection' : closing ? 'opener' : undefined)
  }

  /** Opens the place dialog for `subject`, focus to return to `from`. It floats over the outline pane, so that is the pane a narrow screen shows. */
  function openPlaces(subject: DragSubject, from: HTMLElement): void {
    opener.current = from
    if (act({ type: 'startDrag', subject, via: 'keyboard' }).ok) act({ type: 'openPanel', panel: 'outline' })
  }

  function place(kind: ComponentKind, from: HTMLElement): void {
    openPlaces({ kind }, from)
  }

  function placeSelection(from: HTMLElement): void {
    // The toolbar offers this only while `can.moveTo`, which holds only for a selected component.
    openPlaces({ id: (state.selection as Selection).id }, from)
  }

  function choose(subject: DragSubject, target: DropTarget): void {
    act('kind' in subject ? { type: 'insert', kind: subject.kind, target: target.location } : { type: 'move', id: subject.id, target: target.location }, 'selection')
  }

  function follow(entry: DiagnosticEntry): void {
    const { target } = entry
    if (target === null) act({ type: 'select', id: null })
    else act(target.column === undefined ? { type: 'select', id: target.id } : { type: 'select', id: target.id, column: target.column }, 'selection')
  }

  const choosing = state.drag?.via === 'keyboard' ? state.drag : null
  const heading = `${ids}-properties`
  const problems = `${ids}-problems`
  const count = state.diagnostics.length

  return (
    <section aria-label={t('editor.label')} className="wb" data-report-part="editor" data-panel={state.panel} onKeyDown={onKeyDown}>
      {/* A bar across the panes: report-builder.css spans every root child that is no pane. */}
      <div className="wb-pane">
        <header>
          <span>{state.document.title}</span>
          <Toolbar state={state} t={t} act={act} placeSelection={placeSelection} showPane={(pane) => act({ type: 'openPanel', panel: pane }, pane)} />
        </header>
      </div>

      {/* The place dialog floats over this pane: the canvas beside it stays
          in view, with the place the dialog's focus is on marked. */}
      <section className="wb-pane" data-pane="outline">
        <header>{t('pane.outline')}</header>
        <div className="wb-body">
          <Palette state={state} t={t} ids={ids} drag={drag} place={place} />
          <Outline state={state} t={t} ids={ids} tree={tree} drag={drag} act={act} />
        </div>
        {choosing === null ? null : <Places state={state} drag={choosing} t={t} ids={ids} act={act} choose={choose} cancel={() => act({ type: 'cancelDrag' }, 'opener')} />}
      </section>

      <section className="wb-pane wb-canvas" data-pane="canvas">
        <header>{t('pane.canvas')}</header>
        <div className="wb-body">
          <Canvas state={state} t={t} canvas={canvas} sheet={sheet} drag={drag} select={(action) => act(action, 'selection')} />
        </div>
      </section>

      {/* The properties and the problems share the third column. On a narrow
          screen report-builder.css shows the one pane `data-panel` names, so
          this column says it is whichever of its two is asked for, and each
          half carries its own name for the other to be hidden by. */}
      <section className="wb-pane" data-pane={state.panel === 'diagnostics' ? 'diagnostics' : 'properties'}>
        <header data-pane="properties">
          <span id={heading}>{state.properties.heading}</span>
          {state.selection === null ? null : (
            <button type="button" onClick={() => act({ type: 'select', id: null }, 'properties')}>
              {t('properties.report')}
            </button>
          )}
        </header>
        <div ref={fields} className="wb-body" data-pane="properties">
          <Properties state={state} ids={ids} heading={heading} act={act} />
        </div>
        <header data-pane="diagnostics">
          {/* A status, so a change in how many problems there are is said
              without taking the person's place: "Problems 2". */}
          <div role="status" aria-labelledby={problems}>
            <span id={problems}>{t('pane.problems')}</span>
            {count === 0 ? null : (
              <>
                {' '}
                <span data-report-part="badge" data-severity={state.diagnostics.some((entry) => entry.severity === 'error') ? 'error' : 'warning'}>
                  {count}
                </span>
              </>
            )}
          </div>
        </header>
        <div className="wb-body" data-pane="diagnostics">
          <Diagnostics state={state} t={t} ids={ids} heading={problems} list={problemList} follow={follow} />
        </div>
      </section>

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
