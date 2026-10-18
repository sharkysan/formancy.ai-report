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
import { duplicate, indent, moveBy, outdent, remove } from './edits.js'
import type { Edit, Planned } from './edits.js'
import { clampZoom, zoomedIn, zoomedOut } from './geometry.js'
import { shownLabel, stepLabel } from './history.js'
import { columnKey, kindLabel } from './labels.js'
import { EDITOR_PANELS, HIDEABLE_PANELS, HOST_VIEW_PLACES } from './model.js'
import type { DragSubject, DropTarget, EditorAction, EditorActionType, EditorOutcome, EditorRefusalCode, EditorState, HideablePanel, HostView, HostViewPlace, Selection } from './model.js'
import { selectionKey } from './outline.js'
import { fieldLabel, fieldsOf, pageRoomMessage, propertyCommand, propertyTarget, refusalMessage } from './properties.js'
import { fieldWords } from './property-fields.js'
import { selected } from './selection.js'
import type { Selected } from './selection.js'
import { buildState, derive, dragged, viewOf } from './state.js'
import type { Derived, Local } from './state.js'
import { dropTargets } from './targets.js'
import { editorText, formatZoom } from './text.js'
import type { EditorLocale } from './text.js'

/**
 * A view of the host's own the editor makes room for -- the Studio's PDF
 * preview -- by its name: hidden, and in the design view's place, unless
 * it says otherwise.
 */
export interface HostViewOptions {
  readonly name: string
  readonly shown?: boolean
  readonly place?: HostViewPlace
}

export interface ReportEditorOptions {
  /** The language of the editor's own words; English when absent. */
  readonly locale?: EditorLocale
  /** The zoom to start at, clamped to the range; 100 % when absent. */
  readonly zoom?: number
  /** A view of the host's own, which a builder draws in the design view's place while it is shown there. */
  readonly hostView?: HostViewOptions
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
  /** Unsubscribes from the session and forgets every listener; every action after it is refused. */
  dispose(): void
}

const DONE: EditorOutcome = Object.freeze({ ok: true })

/** Each pane that can be hidden, by the message that names it: the diagnostics are the problems. */
const PANE_NAMES = { outline: 'pane.outline', properties: 'pane.properties', diagnostics: 'pane.problems' } as const satisfies Record<HideablePanel, string>

type Handlers = { readonly [T in EditorActionType]: (action: Extract<EditorAction, { readonly type: T }>) => EditorOutcome }

/**
 * The host's view as the editor keeps it: a copy of the option, never the
 * host's own object, which the frozen state would freeze. A view with no
 * name, or in a place nobody knows, is the host's mistake, refused when it
 * is made rather than drawn as a nameless region later.
 */
function hostViewOf(option: HostViewOptions | undefined): HostView | null {
  if (option === undefined) return null
  if (typeof option.name !== 'string' || option.name.trim() === '') throw new RangeError('A host’s view needs a name: a builder names the region it draws the view in by it.')
  const place = option.place ?? 'middle'
  if (!(HOST_VIEW_PLACES as readonly string[]).includes(place)) throw new RangeError(`A host’s view stands in one of ${HOST_VIEW_PLACES.join(', ')}, not ${String(place)}.`)
  return { name: option.name, shown: option.shown === true, place }
}

/** `host` with `next` in it: the same object when nothing changes, so a host that reads the view alone draws nothing again. */
function hostAs(host: HostView, next: Partial<HostView>): HostView {
  const merged = { ...host, ...next }
  return merged.shown === host.shown && merged.place === host.place ? host : merged
}

export function createReportEditor(session: ReportSession, options: ReportEditorOptions = {}): ReportEditor {
  const locale = options.locale ?? 'en'
  const t = editorText(locale)
  const start = options.zoom
  const host = hostViewOf(options.hostView)
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
  }
  let derived: Derived | undefined
  let cached: EditorState | undefined
  let targetsCache: { readonly derived: Derived; readonly subject: string; readonly zoom: number; readonly targets: readonly DropTarget[] } | undefined
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
    if (derived?.report !== report) derived = derive(report, t)
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

  /** A pane's name, as its tool in the toolbar says it. */
  function paneName(panel: HideablePanel): string {
    return t(PANE_NAMES[panel])
  }

  function refuse(code: EditorRefusalCode, text: string, refusal?: Extract<CommandOutcome, { ok: false }>): EditorOutcome {
    setLocal(announce(text))
    return { ok: false, code, message: text, ...(refusal === undefined ? {} : { refusal }) }
  }

  function labelOf(key: string): string {
    return current().labels.get(key) ?? key
  }

  function targets(): readonly DropTarget[] {
    const drag = local.drag
    if (drag === null) return []
    const now = current()
    const subject = JSON.stringify(drag.subject)
    if (targetsCache?.derived === now && targetsCache.subject === subject && targetsCache.zoom === local.zoom) return targetsCache.targets
    const component = dragged(now, drag.subject)
    const found = component === null ? [] : dropTargets(now.report, component, { labels: now.labels, layout: now.layout, zoom: local.zoom }, t)
    targetsCache = { derived: now, subject, zoom: local.zoom, targets: found }
    return found
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

  /** Applies an edit through the session, selects what it says, and announces it by `name` -- or says why the session refused. */
  function applyEdit(edit: Edit, name: () => string): EditorOutcome {
    const before = name()
    const outcome = commit(edit.command, stepLabel(edit.step))
    if (!outcome.ok) return refuse('refused', t('status.refused', { name: before, reason: refusalMessage(outcome, '') }), outcome)
    const selection = edit.then(outcome)
    setLocal({ selection, errors: new Map(), drag: null })
    const said = edit.announce === 'status.inserted' ? name() : before
    setLocal(announce(t(edit.announce, { name: said })))
    return DONE
  }

  function structural(plan: (target: Selected) => Planned): EditorOutcome {
    return withSelection((target) => {
      const planned = plan(target)
      const name = labelOf(target.kind === 'column' ? columnKey(target.table.id, target.column.id) : target.component.id)
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

  /** The container the selection stands in, or a column's table; at a region's top there is none, and that is said. */
  function selectParent(): EditorOutcome {
    return withSelection((target) => {
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
      const holds = target.kind === 'component' && child !== undefined && (child.kind === 'column' ? child.table.id : child.location.parent) === target.component.id
      return holds ? select(next as Selection) : refuse('at-edge', t('status.nothingInside', { name: labelOf(key) }))
    })
  }

  function select(selection: Selection | null): EditorOutcome {
    if (selection !== null && selected(current().report, selection) === undefined) return refuse('not-found', t('status.notFound', { name: selection.id }))
    const same = selection === null ? local.selection === null : local.selection !== null && selectionKey(selection) === selectionKey(local.selection)
    if (!same) setLocal({ selection, errors: new Map() })
    return DONE
  }

  function insert(kind: ComponentKind, target: Location): EditorOutcome {
    const entry = current().palette.find((candidate) => candidate.kind === kind)
    const component = entry?.component ?? null
    if (component === null) return refuse('unavailable', entry?.unavailable ?? t('status.notFound', { name: kind }))
    const edit: Edit = { command: (r) => insertComponent(r, target, component), step: { do: 'insert', kind }, announce: 'status.inserted', then: () => ({ id: component.id }) }
    return applyEdit(edit, () => current().labels.get(component.id) ?? kindLabel(kind, t))
  }

  function move(id: string, target: Location): EditorOutcome {
    const found = componentAt(current().report, id)
    if (found === undefined) return refuse('not-found', t('status.notFound', { name: id }))
    const edit: Edit = { command: (r) => moveComponent(r, id, target), step: { do: 'move', kind: found.component.kind }, announce: 'status.moved', then: () => ({ id }) }
    return applyEdit(edit, () => labelOf(id))
  }

  function startDrag(subject: DragSubject, via: 'pointer' | 'keyboard'): EditorOutcome {
    const now = current()
    if ('id' in subject) {
      if (componentAt(now.report, subject.id) === undefined) return refuse('not-found', t('status.notFound', { name: subject.id }))
    } else {
      const entry = now.palette.find((candidate) => candidate.kind === subject.kind)
      if (entry === undefined || entry.component === null) return refuse('unavailable', entry?.unavailable ?? t('status.notFound', { name: subject.kind }))
    }
    const name = 'id' in subject ? labelOf(subject.id) : kindLabel(subject.kind, t)
    setLocal({ drag: { subject, via, over: null }, ...announce(t('status.choosePlace', { name })) })
    return DONE
  }

  function drop(): EditorOutcome {
    const drag = local.drag
    if (drag === null) return refuse('not-dragging', t('status.notMoved'))
    const target = drag.over === null ? undefined : targets()[drag.over]
    if (target === undefined) {
      setLocal({ drag: null })
      return refuse('no-target', t('status.notMoved'))
    }
    return 'id' in drag.subject ? move(drag.subject.id, target.location) : insert(drag.subject.kind, target.location)
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
    const outcome = commit(propertyCommand(target, at, written.value), stepLabel({ do: 'change', field: spec.words }))
    if (!outcome.ok) {
      const path = `${target.path}${at}`
      const message = pageRoomMessage(outcome, path, { spec, value: written.value, report }, t, number.format) ?? refusalMessage(outcome, path)
      setLocal(keep(message))
      return refuse('refused', t('status.invalid', { field: label, reason: message }), outcome)
    }
    setLocal({ errors: forget, ...announce(t('status.changed', { field: fieldWords(spec.words, t) })) })
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

  /** The host's view, or the refusal for an editor made without one. */
  function withHostView(act: (host: HostView) => EditorOutcome): EditorOutcome {
    return local.host === null ? refuse('unavailable', t('status.noHostView')) : act(local.host)
  }

  /**
   * Shows the host's view. In the middle it takes the design view's place,
   * and is the pane a narrow layout shows -- which is also how a view shown
   * already comes back into sight there, from another pane. Either way what
   * is in front of the person changed, so the live region says how to bring
   * the design view back; asked again of a view that is the pane shown
   * already, nothing changes and nothing is said.
   */
  function showHostView(host: HostView): EditorOutcome {
    const next = hostAs(host, { shown: true })
    if (viewOf(next) !== 'host') setLocal({ host: next })
    else if (next !== host || local.panel !== 'canvas') setLocal({ host: next, panel: 'canvas', ...announce(t('status.hostViewShown', { view: host.name, pane: t('pane.canvas') })) })
    return DONE
  }

  function zoom(to: number): EditorOutcome {
    // The zoom is the design view's: with the host's view in its place it would change what nobody sees.
    if (local.host !== null && viewOf(local.host) === 'host') return refuse('unavailable', t('status.zoomHidden', { view: local.host.name, pane: t('pane.canvas') }))
    if (!Number.isFinite(to)) return refuse('invalid-value', t('input.number'))
    const next = clampZoom(to)
    setLocal({ zoom: next, ...announce(t('status.zoom', { zoom: formatZoom(next, locale) })) })
    return DONE
  }

  const handlers: Handlers = {
    select: (action) => select(action.id === null ? null : action.column === undefined ? { id: action.id } : { id: action.id, column: action.column }),
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
    delete: () => structural((target) => remove(current().report, target)),
    duplicate: () => structural(duplicate),
    insert: (action) => insert(action.kind, action.target),
    move: (action) => move(action.id, action.target),
    setProperty: (action) => setProperty(action.key, action.value),
    undo: () => history('undo'),
    redo: () => history('redo'),
    setZoom: (action) => zoom(action.zoom),
    zoomIn: () => zoom(zoomedIn(local.zoom)),
    zoomOut: () => zoom(zoomedOut(local.zoom)),
    startDrag: (action) => startDrag(action.subject, action.via ?? 'pointer'),
    updateDrag: (action) => {
      const drag = local.drag
      if (drag === null) return refuse('not-dragging', t('status.notMoved'))
      if (action.over !== null && targets()[action.over] === undefined) return refuse('not-found', t('status.notFound', { name: String(action.over) }))
      if (action.over !== drag.over) setLocal({ drag: { ...drag, over: action.over } })
      return DONE
    },
    drop,
    cancelDrag: () => {
      if (local.drag === null) return refuse('not-dragging', t('status.notMoved'))
      setLocal({ drag: null, ...announce(t('status.notMoved')) })
      return DONE
    },
    openPanel: (action) => {
      if (!(EDITOR_PANELS as readonly string[]).includes(action.panel)) return refuse('invalid-value', t('input.option'))
      const shown = local.hidden.filter((panel) => panel !== action.panel)
      // The design view takes its place back from a host's view standing in it; one beside the builder stays.
      const back = action.panel === 'canvas' && local.host !== null && viewOf(local.host) === 'host' ? { host: hostAs(local.host, { shown: false }) } : {}
      setLocal({ panel: action.panel, ...(shown.length === local.hidden.length ? {} : { hidden: shown }), ...back })
      return DONE
    },
    hidePanel: (action) => {
      if (!(HIDEABLE_PANELS as readonly string[]).includes(action.panel)) return refuse('invalid-value', t('input.option'))
      if (local.hidden.includes(action.panel)) return DONE
      const hidden = HIDEABLE_PANELS.filter((panel) => panel === action.panel || local.hidden.includes(panel))
      // The pane a narrow layout shows is never one that is hidden.
      setLocal({ hidden, ...(local.panel === action.panel ? { panel: 'canvas' } : {}), ...announce(t('status.paneHidden', { pane: paneName(action.panel) })) })
      return DONE
    },
    showHostView: () => withHostView(showHostView),
    // The host's own control says it, by its pressed state: the editor adds no sentence.
    hideHostView: () =>
      withHostView((host) => {
        setLocal({ host: hostAs(host, { shown: false }) })
        return DONE
      }),
    placeHostView: (action) =>
      withHostView((host) => {
        if (!(HOST_VIEW_PLACES as readonly string[]).includes(action.place)) return refuse('invalid-value', t('input.option'))
        setLocal({ host: hostAs(host, { place: action.place }) })
        return DONE
      }),
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
        cached = buildState(now, { revision: session.revision(), history }, local, locale, t, targets)
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
      depth += 1
      let outcome: EditorOutcome | undefined
      const errors: unknown[] = []
      try {
        outcome = (handlers[action.type] as (action: EditorAction) => EditorOutcome)(action)
      } catch (error) {
        errors.push(error)
      } finally {
        depth -= 1
      }
      // The outermost dispatch tells the listeners, once, whatever threw on
      // the way: a builder must render the edit that stands.
      if (depth === 0) {
        errors.push(...deferred.splice(0))
        if (pending) {
          pending = false
          errors.push(...listen())
        }
      }
      raise(errors)
      return outcome as EditorOutcome
    },
    dispose() {
      if (disposed) return
      disposed = true
      unsubscribe()
      listeners.clear()
    },
  }
}
