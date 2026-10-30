/**
 * The editor: one person's view of one report session, as a state both
 * native builders render and the actions they send back.
 *
 * The document and its undo history live in the session and nowhere else,
 * so several editors -- a React one and an Angular one -- can share a
 * session at once or in turn (plan 11.4). What is the editor's own --
 * selection, zoom, the open pane, a drag, a host's view -- never reaches
 * the report.
 *
 * Here are the editor's state, its listeners and the actions that edit the
 * report or walk it. Its views -- the panes, the host's view and the zoom
 * -- are `views.ts`'s, its drag `dragging.ts`'s, its images `images.ts`'s
 * and what adds or removes a part or a group `part-actions.ts`'s: each is
 * lent what it needs of the editor, and every action of each runs through
 * the one `dispatch` here.
 *
 * `state()` is the same frozen object until something changes, which is
 * what React's `useSyncExternalStore` and an Angular signal compare by. An
 * action that edits the report and changes the selection tells listeners
 * once, when it is done -- also when something it set off dispatches again
 * before it is: a host's listener on the session, or another builder's.
 */
import { insertComponent, moveComponent } from '@formancy/report-core'
import type { Command, CommandOutcome, Location, ReportSession } from '@formancy/report-core'
import { componentAt } from '@formancy/report-spec'
import type { ComponentKind } from '@formancy/report-spec'
import { dragActions } from './dragging.js'
import { duplicate, indent, moveBy, outdent, remove } from './edits.js'
import type { Edit, Planned } from './edits.js'
import { clampZoom } from './geometry.js'
import { shownLabel, stepLabel } from './history.js'
import type { ImageFile, ImageStore } from './image-store.js'
import { imageActions, imagesOf } from './images.js'
import { columnKey, kindLabel, partLabel } from './labels.js'
import { DONE } from './model-actions.js'
import type { EditorState, Selection } from './model.js'
import type { EditorAction, EditorActionType, EditorOutcome, EditorRefusalCode } from './model-actions.js'
import { selectionKey } from './outline.js'
import { partActions } from './part-actions.js'
import { fieldLabel, fieldsOf, pageRoomMessage, propertyChange, propertyTarget, refusalMessage } from './properties.js'
import { fieldWords } from './property-fields.js'
import { isReportLevelPart, selected } from './selection.js'
import type { Selected } from './selection.js'
import { buildState, derive, viewOf } from './state.js'
import type { Derived, Local } from './state.js'
import { editorText } from './text.js'
import type { EditorLocale } from './text.js'
import { hostViewOf, viewActions } from './views.js'
import type { HostViewOptions } from './views.js'

export interface ReportEditorOptions {
  /** The language of the editor's own words; English when absent. */
  readonly locale?: EditorLocale
  /** The zoom to start at, clamped to the range; 100 % when absent. */
  readonly zoom?: number
  /** A view of the host's own, which a builder draws in the design view's place while it is shown there. */
  readonly hostView?: HostViewOptions
  /** Where an image a person adds is kept (0033). Without it the builders draw no Add image…, and the report's images are the host's alone to declare. */
  readonly images?: ImageStore
}

export interface ReportEditor {
  /** The state to render: deeply frozen, and the same object until something changes. */
  state(): EditorState
  /** Calls `listener` after each change, synchronously, until the function returned is called. */
  subscribe(listener: () => void): () => void
  /** Listeners subscribed now: what a test of a destroyed builder checks is back to none. */
  listenerCount(): number
  /**
   * Does what a builder asks, or says why not; never throws for the action
   * it is given. An error a listener throws surfaces from here, once every
   * listener has run, as the session's do.
   */
  dispatch(action: EditorAction): EditorOutcome
  /**
   * Adds the image in `file` as one of the report's assets, in one undo
   * step, or says why not, the report unchanged: recognised from its bytes
   * alone, checked as the format and the renderer read it, an SVG cleaned
   * (0030), its digest taken, kept by the host's store, and only then
   * declared. Resolves with the outcome, as `dispatch` returns one; rejects
   * only with what a listener threw, once the add is done.
   */
  addImage(file: ImageFile): Promise<EditorOutcome>
  /** Unsubscribes from the session and forgets every listener; every action after it is refused. */
  dispose(): void
}

type Handlers = { readonly [T in EditorActionType]: (action: Extract<EditorAction, { readonly type: T }>) => EditorOutcome }

export function createReportEditor(session: ReportSession, options: ReportEditorOptions = {}): ReportEditor {
  const locale = options.locale ?? 'en'
  const t = editorText(locale)
  const start = options.zoom
  const host = hostViewOf(options.hostView)
  const images = imagesOf(options.images, locale, t)
  let local: Local = {
    selection: null,
    zoom: start === undefined || !Number.isFinite(start) ? 1 : clampZoom(start),
    // A narrow layout shows one pane: made with its host's view in the middle, that one.
    panel: viewOf(host) === 'host' ? 'canvas' : 'outline',
    hidden: [],
    host,
    drag: null,
    errors: new Map(),
    status: { text: '', sequence: 0 },
    adding: null,
  }
  let derived: Derived | undefined
  let cached: EditorState | undefined
  const listeners = new Set<{ readonly listener: () => void }>()
  let disposed = false
  /** How many dispatches are running: one inside another -- a listener that dispatches -- counts as the outer one's. */
  let depth = 0
  let pending = false
  /** Errors from listeners of the session, after an edit this editor made had committed: thrown once the action is done. */
  const deferred: unknown[] = []
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })

  function current(): Derived {
    const report = session.document()
    if (derived?.report !== report) derived = derive(report, t, images.held !== null)
    return derived
  }

  /** Calls every listener, one that throws or not, and gives what they threw. */
  function listen(): unknown[] {
    const errors: unknown[] = []
    for (const subscription of [...listeners]) {
      if (!listeners.has(subscription)) continue
      try {
        subscription.listener()
      } catch (error) {
        errors.push(error)
      }
    }
    return errors
  }

  function raise(errors: readonly unknown[]): void {
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) throw new AggregateError(errors, `${errors.length} errors in one editor action`)
  }

  /**
   * Runs `run` as one action. The outermost tells the listeners, once,
   * whatever threw on the way -- a builder must render the edit that
   * stands -- and what `run`, the session's listeners after a commit and
   * this editor's threw is added to `errors`, for the caller to throw once
   * the action is done.
   */
  function act<T>(run: () => T, errors: unknown[]): T | undefined {
    depth += 1
    let value: T | undefined
    try {
      value = run()
    } catch (error) {
      errors.push(error)
    } finally {
      depth -= 1
    }
    if (depth === 0) {
      errors.push(...deferred.splice(0))
      if (pending) {
        pending = false
        errors.push(...listen())
      }
    }
    return value
  }

  /** Something the state is built from changed: the next read builds a new one, and listeners hear once the action is done. */
  function changed(): void {
    cached = undefined
    if (depth > 0) pending = true
    else raise(listen())
  }

  function setLocal(next: Partial<Local>): void {
    const merged = { ...local, ...next }
    const keys = Object.keys(next) as (keyof Local)[]
    if (keys.every((key) => merged[key] === local[key])) return
    local = merged
    changed()
  }

  /** The document changed under the editor: what it held about the old one is let go. */
  function onSession(): void {
    const report = session.document()
    const { selection, drag } = local
    const gone = selection !== null && selected(report, selection) === undefined
    const subjectGone = drag !== null && 'id' in drag.subject && componentAt(report, drag.subject.id) === undefined
    local = {
      ...local,
      selection: gone ? null : selection,
      errors: local.errors.size === 0 ? local.errors : new Map(),
      drag: drag === null || subjectGone ? null : { ...drag, over: null },
    }
    changed()
  }

  const unsubscribe = session.subscribe(onSession)

  function announce(text: string): Partial<Local> {
    return { status: { text, sequence: local.status.sequence + 1 } }
  }

  function refuse(code: EditorRefusalCode, text: string, refusal?: Extract<CommandOutcome, { ok: false }>): EditorOutcome {
    setLocal(announce(text))
    return { ok: false, code, message: text, ...(refusal === undefined ? {} : { refusal }) }
  }

  function labelOf(key: string): string {
    return current().labels.get(key) ?? key
  }

  /** The selection as the report has it, or the refusal for nothing selected. */
  function withSelection(act: (target: Selected) => EditorOutcome): EditorOutcome {
    const target = local.selection === null ? undefined : selected(current().report, local.selection)
    return target === undefined ? refuse('nothing-selected', t('status.nothingSelected')) : act(target)
  }

  /**
   * Applies `command` through the session. A listener of the session that
   * throws -- another editor's, or a host's -- does so after the edit has
   * committed (0008): the edit stands, so this editor finishes the action as
   * made, and the error is thrown from `dispatch` once it is done. An error
   * before the commit made no edit, and passes straight through.
   */
  function commit(command: Command<object>, label: string): CommandOutcome {
    const before = session.revision()
    let made: CommandOutcome | undefined
    try {
      return session.apply((report) => (made = command(report)), { label })
    } catch (error) {
      if (session.revision() === before || made?.ok !== true) throw error
      deferred.push(error)
      return made
    }
  }

  /** Undo or redo through the session, a listener's error after it kept for the end of the action, as `commit` keeps it. */
  function travel(direction: 'undo' | 'redo'): void {
    const before = session.revision()
    try {
      if (direction === 'undo') session.undo()
      else session.redo()
    } catch (error) {
      if (session.revision() === before) throw error
      deferred.push(error)
    }
  }

  /** Applies an edit through the session, selects what it says, and announces it by `name` -- or says why the session refused, in the words of `refused`. */
  function applyEdit(
    edit: Edit,
    name: () => string,
    refused: 'status.refused' | 'status.qrBillNotAdded' | 'status.addRefused' | 'status.removeRefused' = 'status.refused',
  ): EditorOutcome {
    const before = name()
    const outcome = commit(edit.command, stepLabel(edit.step))
    if (!outcome.ok) return refuse('refused', t(refused, { name: before, reason: refusalMessage(outcome, '') }), outcome)
    const selection = edit.then(outcome)
    setLocal({ selection, errors: new Map(), drag: null })
    const said = edit.announce === 'status.inserted' ? name() : before
    setLocal(announce(t(edit.announce, { ...edit.values, name: said })))
    return DONE
  }

  /** The key of what `target` is: its outline row's. */
  function keyOf(target: Selected): string {
    if (target.kind === 'part') return selectionKey({ part: target.part })
    return target.kind === 'column' ? columnKey(target.table.id, target.column.id) : target.component.id
  }

  function structural(plan: (target: Selected) => Planned): EditorOutcome {
    return withSelection((target) => {
      const planned = plan(target)
      const name = labelOf(keyOf(target))
      return 'edge' in planned ? refuse('at-edge', t(planned.edge, { name })) : applyEdit(planned, () => name)
    })
  }

  function step(by: 1 | -1, from: 'first' | 'last' | 'next' | 'previous'): EditorOutcome {
    const order = current().order
    if (order.length === 0) return refuse('at-edge', t('outline.empty'))
    const at = local.selection === null ? -1 : order.findIndex((row) => selectionKey(row) === selectionKey(local.selection as Selection))
    const index = from === 'first' ? 0 : from === 'last' ? order.length - 1 : at === -1 ? (by > 0 ? 0 : order.length - 1) : at + by
    const next = order[index]
    if (next === undefined) {
      const name = local.selection === null ? '' : labelOf(selectionKey(local.selection))
      return refuse('at-edge', t(by > 0 ? 'status.last' : 'status.first', { name }))
    }
    return select(next)
  }

  /** The container the selection stands in, or a column's table; at a region's top, and for a part of the report's own level, there is none, and that is said. */
  function selectParent(): EditorOutcome {
    return withSelection((target) => {
      if (target.kind === 'part') return refuse('at-edge', t('status.cannotOutdent', { name: labelOf(keyOf(target)) }))
      if (target.kind === 'column') return select({ id: target.table.id })
      const parent = target.location.parent
      return parent === undefined ? refuse('at-edge', t('status.cannotOutdent', { name: labelOf(target.component.id) })) : select({ id: parent })
    })
  }

  /** The first thing the selection holds, in the outline's order -- a table's first column -- or what says it holds nothing. */
  function selectChild(): EditorOutcome {
    return withSelection((target) => {
      const { order, report } = current()
      const key = selectionKey(local.selection as Selection)
      const next = order[order.findIndex((row) => selectionKey(row) === key) + 1]
      const child = next === undefined ? undefined : selected(report, next)
      const holds =
        target.kind === 'component' &&
        child !== undefined &&
        child.kind !== 'part' &&
        (child.kind === 'column' ? child.table.id : child.location.parent) === target.component.id
      return holds ? select(next as Selection) : refuse('at-edge', t('status.nothingInside', { name: labelOf(key) }))
    })
  }

  /** A part's name, said in a refusal: one a caller tsc never saw names -- a builder in plain JavaScript -- is said as it was sent. */
  function partName(part: unknown): string {
    return isReportLevelPart(part) ? partLabel(part, t) : String(part)
  }

  function select(selection: Selection | null): EditorOutcome {
    if (selection !== null && selected(current().report, selection) === undefined)
      return refuse('not-found', t('status.notFound', { name: 'part' in selection ? partName(selection.part) : selection.id }))
    const same = selection === null ? local.selection === null : local.selection !== null && selectionKey(selection) === selectionKey(local.selection)
    if (!same) setLocal({ selection, errors: new Map() })
    return DONE
  }

  function insert(kind: ComponentKind, target: Location): EditorOutcome {
    const entry = current().palette.find((candidate) => candidate.kind === kind)
    const component = entry?.component ?? null
    if (component === null) return refuse('unavailable', entry?.unavailable ?? t('status.notFound', { name: kind }))
    const edit: Edit = {
      command: (r) => insertComponent(r, target, component),
      step: { do: 'insert', kind },
      announce: 'status.inserted',
      then: () => ({ id: component.id }),
    }
    return applyEdit(edit, () => current().labels.get(component.id) ?? kindLabel(kind, t))
  }

  function move(id: string, target: Location): EditorOutcome {
    const found = componentAt(current().report, id)
    if (found === undefined) return refuse('not-found', t('status.notFound', { name: id }))
    const edit: Edit = {
      command: (r) => moveComponent(r, id, target),
      step: { do: 'move', kind: found.component.kind },
      announce: 'status.moved',
      then: () => ({ id }),
    }
    return applyEdit(edit, () => labelOf(id))
  }

  function setProperty(key: string, value: string | boolean): EditorOutcome {
    const report = current().report
    // The editor keeps its selection one the document has, so there is a target.
    const target = propertyTarget(report, local.selection) as NonNullable<ReturnType<typeof propertyTarget>>
    const spec = fieldsOf(target, report, t, locale).find((candidate) => candidate.key === key)
    if (spec === undefined) return refuse('not-found', t('status.notFound', { name: key }))
    const label = fieldLabel(spec, t)
    const written = spec.write(value)
    const keep = (message: string): Partial<Local> => ({ errors: new Map([...local.errors, [key, { input: value, message }]]) })
    if (!written.ok) {
      const message = t(written.message)
      setLocal(keep(message))
      return refuse('invalid-value', t('status.invalid', { field: label, reason: message }))
    }
    const forget = local.errors.has(key) ? new Map([...local.errors].filter(([field]) => field !== key)) : local.errors
    if ('unchanged' in written) {
      setLocal({ errors: forget })
      return DONE
    }
    const at = written.at ?? key
    const change = propertyChange(report, target, at, written.value)
    const outcome = commit(change.command, stepLabel({ do: 'change', field: spec.words }))
    if (!outcome.ok) {
      const path = `${target.path}${at}`
      const message = pageRoomMessage(outcome, path, { spec, value: written.value, report }, t, number.format) ?? refusalMessage(outcome, path)
      setLocal(keep(message))
      return refuse('refused', t('status.invalid', { field: label, reason: message }), outcome)
    }
    setLocal({ errors: forget, ...announce(t(change.said ?? 'status.changed', { field: fieldWords(spec.words, t) })) })
    return DONE
  }

  function history(direction: 'undo' | 'redo'): EditorOutcome {
    const can = direction === 'undo' ? session.canUndo() : session.canRedo()
    if (!can) return refuse('no-history', t(direction === 'undo' ? 'status.nothingToUndo' : 'status.nothingToRedo'))
    const label = shownLabel(direction === 'undo' ? session.undoLabel() : session.redoLabel(), t) ?? ''
    travel(direction)
    setLocal(announce(t(direction === 'undo' ? 'status.undone' : 'status.redone', { label })))
    return DONE
  }

  const views = viewActions({ local: () => local, setLocal, announce, refuse }, t, locale)
  const dragging = dragActions({ current, local: () => local, setLocal, announce, refuse, labelOf, insert, move }, t)
  const imaging = imageActions(images, { current, local: () => local, setLocal, announce, refuse, commit, act, raise, disposed: () => disposed })
  const parts = partActions({ current, local: () => local, refuse, applyEdit }, t, locale)

  const handlers: Handlers = {
    select: (action) =>
      select(
        'part' in action
          ? { part: action.part }
          : action.id === null
            ? null
            : action.column === undefined
              ? { id: action.id }
              : { id: action.id, column: action.column },
      ),
    selectNext: () => step(1, 'next'),
    selectPrevious: () => step(-1, 'previous'),
    selectFirst: () => step(1, 'first'),
    selectLast: () => step(-1, 'last'),
    selectParent,
    selectChild,
    moveUp: () => structural((target) => moveBy(current().report, target, -1)),
    moveDown: () => structural((target) => moveBy(current().report, target, 1)),
    indent: () => structural((target) => indent(current().report, target)),
    outdent: () => structural((target) => outdent(current().report, target)),
    delete: () => structural((target) => remove(current().report, target, current().order)),
    duplicate: () => structural(duplicate),
    insert: (action) => insert(action.kind, action.target),
    move: (action) => move(action.id, action.target),
    setProperty: (action) => setProperty(action.key, action.value),
    undo: () => history('undo'),
    redo: () => history('redo'),
    setZoom: (action) => views.zoom(action.zoom),
    zoomIn: () => views.zoomIn(),
    zoomOut: () => views.zoomOut(),
    startDrag: (action) => dragging.startDrag(action.subject, action.via ?? 'pointer'),
    updateDrag: (action) => dragging.updateDrag(action.over),
    drop: () => dragging.drop(),
    cancelDrag: () => dragging.cancelDrag(),
    openPanel: (action) => views.openPanel(action.panel),
    hidePanel: (action) => views.hidePanel(action.panel),
    showHostView: () => views.showHostView(),
    hideHostView: () => views.hideHostView(),
    placeHostView: (action) => views.placeHostView(action.place),
    chooseImage: () => imaging.chooseImage(),
    removeImage: (action) => imaging.removeImage(action.asset),
    addPart: (action) => parts.addPart(action.part),
    addGroup: (action) => parts.addGroup(action.key),
    removeGroup: (action) => parts.removeGroup(action.key),
    addItem: (action) => parts.addItem(action.key),
    removeItem: (action) => parts.removeItem(action.key),
    moveItem: (action) => parts.moveItem(action.key, action.to),
  }

  return {
    state() {
      if (cached === undefined) {
        const now = current()
        const history = {
          canUndo: session.canUndo(),
          canRedo: session.canRedo(),
          undoLabel: shownLabel(session.undoLabel(), t),
          redoLabel: shownLabel(session.redoLabel(), t),
        }
        cached = buildState(now, { revision: session.revision(), history }, local, locale, t, dragging.targets, images)
      }
      return cached
    },
    subscribe(listener) {
      const subscription = { listener }
      listeners.add(subscription)
      return () => {
        listeners.delete(subscription)
      }
    },
    listenerCount: () => listeners.size,
    dispatch(action) {
      if (disposed) return { ok: false, code: 'disposed', message: t('status.disposed') }
      // An action from a caller tsc never saw -- a builder in plain JavaScript -- may name none.
      if (!Object.hasOwn(handlers, action.type)) return refuse('not-found', t('status.notFound', { name: String(action.type) }))
      const errors: unknown[] = []
      const outcome = act(() => (handlers[action.type] as (action: EditorAction) => EditorOutcome)(action), errors)
      raise(errors)
      return outcome as EditorOutcome
    },
    addImage: (file) => imaging.addImage(file),
    dispose() {
      if (disposed) return
      disposed = true
      unsubscribe()
      listeners.clear()
    },
  }
}
