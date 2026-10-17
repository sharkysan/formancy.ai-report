import { setTitle } from '@formancy/report-core'
import { componentAt } from '@formancy/report-spec'
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test, vi } from 'vitest'
import { createReportEditor } from './editor.js'
import type { EditorOutcome, EditorState, OutlineNode } from './model.js'
import { diagnosticKeys } from './state.js'
import { editorText } from './text.js'
import { countingSession, editorOver, richReport, sessionOver } from './test-support.js'

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

function flat(state: EditorState): OutlineNode[] {
  const nodes: OutlineNode[] = []
  const visit = (list: readonly OutlineNode[]): void => {
    for (const node of list) {
      nodes.push(node)
      visit(node.children)
    }
  }
  for (const region of state.outline) visit(region.nodes)
  return nodes
}

function bodyIds(report: ReportDefinition): string[] {
  return report.regions.body.map((component) => component.id)
}

function isDeeplyFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true
  return Object.isFrozen(value) && Object.values(value).every(isDeeplyFrozen)
}

describe('state', () => {
  // useSyncExternalStore loops forever on a snapshot that is a new object
  // each time it is read, and an Angular signal set from one would mark the
  // view dirty on every check.
  test('is the same object until something changes', () => {
    const { editor } = editorOver()
    expect(editor.state()).toBe(editor.state())
  })

  // A builder that wrote into the state would change what the other
  // builder, and the next state, were built from.
  test('is deeply frozen', () => {
    const { editor } = editorOver()
    expect(isDeeplyFrozen(editor.state())).toBe(true)
  })

  // A change the editor did not make -- an edit through the session from
  // anywhere -- is still a new state, or a builder would show the old
  // document until something local changed.
  test('is a new object after the session changes, with the change in it', () => {
    const { editor, session } = editorOver()
    const before = editor.state()
    session.apply((report) => setTitle(report, 'Renamed'))
    expect(editor.state()).not.toBe(before)
    expect(editor.state().document.title).toBe('Renamed')
    expect(editor.state().revision).toBe(session.revision())
  })

  // An action that changes nothing -- selecting what is selected -- would
  // otherwise redraw both builders for nothing.
  test('stays the same object when an action changes nothing', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    ok(editor.dispatch({ type: 'openPanel', panel: 'canvas' }))
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'text' } }))
    ok(editor.dispatch({ type: 'updateDrag', over: 1 }))
    const state = editor.state()
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    ok(editor.dispatch({ type: 'openPanel', panel: 'canvas' }))
    ok(editor.dispatch({ type: 'updateDrag', over: 1 }))
    expect(editor.state()).toBe(state)
    ok(editor.dispatch({ type: 'hidePanel', panel: 'outline' }))
    const hidden = editor.state()
    ok(editor.dispatch({ type: 'hidePanel', panel: 'outline' }))
    expect(editor.state()).toBe(hidden)
  })

  // Each builder keys a problem's element by this, so a problem listed
  // before the one the keyboard is on leaves that one's element, and the
  // keyboard, where they were. Keyed by their place in the list, the
  // Angular builder's focused button became the new problem's under the
  // keyboard, and the React builder's was drawn afresh with the keyboard
  // dropped to the page: the browser gate's comparison of the two found it.
  test('keys each diagnostic by what it is, and keeps the key while it is listed', () => {
    const report = richReport()
    const { editor } = editorOver({ ...report, styles: [...report.styles, { id: 'unused', size: 9 }] })
    const before = editor.state().diagnostics
    expect(before.map((entry) => entry.label)).toContain('Warning: Report')
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/visibleWhen', value: 'params.missing' }))
    const after = editor.state().diagnostics
    // The new problem is listed before the one that was there: the case the key is for.
    expect(after.map((entry) => entry.label).indexOf('Error: Introduction')).toBeLessThan(after.map((entry) => entry.label).indexOf('Warning: Report'))
    for (const entry of before) expect(after.find((each) => each.key === entry.key), entry.label).toMatchObject({ label: entry.label, message: entry.message })
    expect(new Set(after.map((entry) => entry.key)).size).toBe(after.length)
  })

  // A key two problems shared would be one element for both: React draws
  // one and warns, Angular's @for refuses the list. Two that report-core
  // says alike -- the same code at the same place -- are told apart by
  // their order, and the first keeps the key it would have alone.
  test('keys two diagnostics alike in what report-core says apart', () => {
    const alike = { severity: 'warning', code: 'unused-style', message: 'The style "a" is not used.', path: '/styles/0' } as const
    const other = { ...alike, path: '/styles/1' }
    expect(diagnosticKeys([alike, other, alike])).toEqual([diagnosticKeys([alike])[0], diagnosticKeys([other])[0], `${String(diagnosticKeys([alike])[0])} 2`])
    expect(diagnosticKeys([{ ...alike, position: { start: 0, end: 3 } }, { ...alike, position: { start: 4, end: 7 } }])).toEqual(['unused-style /styles/0 0-3', 'unused-style /styles/0 4-7'])
  })

  // A builder in another language shows another language: the state says
  // which one it was built in.
  test('starts in English at 100 %, or as the options say', () => {
    expect(editorOver().editor.state()).toMatchObject({ locale: 'en', zoom: 1, zoomLabel: '100%' })
    const { editor } = editorOver(richReport(), { locale: 'fr-CH', zoom: 1.5 })
    expect(editor.state().locale).toBe('fr-CH')
    expect(editor.state().zoom).toBe(1.5)
  })
})

describe('subscribe and dispose', () => {
  // A listener is how React and Angular learn to read the state again; one
  // that is not called leaves a builder showing a document that is gone.
  test('calls listeners once per change, local or the session’s', () => {
    const { editor, session } = editorOver()
    const listener = vi.fn()
    editor.subscribe(listener)
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    session.apply((report) => setTitle(report, 'Renamed'))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  // An edit the editor makes changes the session, which tells the editor,
  // which also changes its selection: one notification, not two, or a
  // builder renders a half-done action in between.
  test('calls listeners once for an action that edits the session and the selection', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    const listener = vi.fn()
    editor.subscribe(listener)
    ok(editor.dispatch({ type: 'delete' }))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  // One builder's listener that throws must not leave the other builder
  // unrendered: every listener is called, and the error surfaces after, from
  // the action that caused it -- as the session does with its own (0008).
  test('calls every listener when one throws, then throws its error', () => {
    const { editor } = editorOver()
    const after = vi.fn()
    editor.subscribe(() => {
      throw new Error('first')
    })
    editor.subscribe(after)
    expect(() => editor.dispatch({ type: 'select', id: 'intro' })).toThrow('first')
    expect(after).toHaveBeenCalledTimes(1)
    expect(editor.state().selection).toEqual({ id: 'intro' })
    editor.subscribe(() => {
      throw new Error('second')
    })
    expect(() => editor.dispatch({ type: 'select', id: 'gap' })).toThrow(AggregateError)
  })

  // A host's listener on the session that dispatches into the editor while
  // the editor's own edit is being told -- a status bar zooming on every
  // change -- is an action inside an action. It must not end the outer
  // one's batching: the listeners would hear the delete, the selection and
  // the announcement as three changes, and render the half-done ones.
  test('calls listeners once for an action even when a listener dispatches during it', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    let once = true
    session.subscribe(() => {
      if (once) editor.dispatch({ type: 'zoomIn' })
      once = false
    })
    const listener = vi.fn()
    editor.subscribe(listener)
    ok(editor.dispatch({ type: 'delete' }))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(editor.state()).toMatchObject({ zoom: 1.25, selection: { id: 'lines' } })
  })

  // A builder destroyed by a route change unsubscribes; a listener left
  // behind keeps it alive and keeps rendering a view nobody sees (plan 21).
  test('stops calling a listener once it unsubscribes, and counts what is left', () => {
    const { editor } = editorOver()
    const listener = vi.fn()
    const unsubscribe = editor.subscribe(listener)
    expect(editor.listenerCount()).toBe(1)
    unsubscribe()
    unsubscribe()
    expect(editor.listenerCount()).toBe(0)
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    expect(listener).not.toHaveBeenCalled()
  })

  // A disposed editor still subscribed to the session is the stale
  // subscription plan 21 tests for: it would rebuild a state for every edit
  // made in the other builder, forever.
  test('dispose unsubscribes from the session and drops its listeners', () => {
    const { session, live } = countingSession(sessionOver(richReport()))
    const editor = createReportEditor(session)
    expect(live()).toBe(1)
    const listener = vi.fn()
    editor.subscribe(listener)
    const before = editor.state()
    editor.dispose()
    expect(live()).toBe(0)
    session.apply((report) => setTitle(report, 'After'))
    expect(listener).not.toHaveBeenCalled()
    expect(editor.listenerCount()).toBe(0)
    expect(editor.state()).toBe(before)
  })

  // A builder written in plain JavaScript can send an action, or a kind,
  // that does not exist; it is refused, never thrown on.
  test('refuses an action or a kind it does not have', () => {
    const { editor, session } = editorOver()
    expect(editor.dispatch({ type: 'explode' } as never)).toMatchObject({ ok: false, code: 'not-found' })
    expect(editor.dispatch({ type: 'insert', kind: 'chart', target: { region: 'body', index: 0 } } as never)).toMatchObject({ ok: false, code: 'unavailable' })
    expect(editor.dispatch({ type: 'startDrag', subject: { kind: 'chart' } } as never)).toMatchObject({ ok: false, code: 'unavailable' })
    expect(editor.dispatch({ type: 'openPanel', panel: 'settings' } as never)).toMatchObject({ ok: false, code: 'invalid-value' })
    expect(editor.dispatch({ type: 'hidePanel', panel: 'settings' } as never)).toMatchObject({ ok: false, code: 'invalid-value' })
    expect(session.revision()).toBe(0)
  })

  // A disposed editor reached from a stale event handler -- React's strict
  // mode mounts twice -- must not edit the report behind the live one.
  test('refuses every action once disposed, and changes nothing', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    editor.dispose()
    editor.dispose()
    const outcome = editor.dispatch({ type: 'delete' })
    expect(outcome).toMatchObject({ ok: false, code: 'disposed' })
    expect(session.revision()).toBe(0)
  })
})

describe('editor-local state', () => {
  // Selection, zoom, the open pane and a drag belong to one person's view;
  // written into the report they would be undone by undo, saved in the
  // template and shown in the other builder.
  test('never reaches the session', () => {
    const { editor, session } = editorOver()
    const document = session.document()
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    ok(editor.dispatch({ type: 'setZoom', zoom: 2 }))
    ok(editor.dispatch({ type: 'openPanel', panel: 'properties' }))
    ok(editor.dispatch({ type: 'hidePanel', panel: 'outline' }))
    ok(editor.dispatch({ type: 'startDrag', subject: { kind: 'text' } }))
    ok(editor.dispatch({ type: 'cancelDrag' }))
    expect(session.revision()).toBe(0)
    expect(session.document()).toBe(document)
    expect(session.canUndo()).toBe(false)
    expect(editor.state().panel).toBe('properties')
    expect(editor.state().hidden).toEqual(['outline'])
  })

  // A person who needs the room hides the panes beside the design view; the
  // toolbar's pane tools are how a hidden pane comes back, so showing one is
  // opening it, and the live region says where it went.
  test('hides a side pane, says so, and opening it from the toolbar shows it again', () => {
    const { editor } = editorOver()
    expect(editor.state().hidden).toEqual([])
    ok(editor.dispatch({ type: 'hidePanel', panel: 'outline' }))
    expect(editor.state().hidden).toEqual(['outline'])
    expect(editor.state().status.text).toBe(editorText('en')('status.paneHidden', { pane: editorText('en')('pane.outline') }))
    ok(editor.dispatch({ type: 'openPanel', panel: 'outline' }))
    expect(editor.state().hidden).toEqual([])
    expect(editor.state().panel).toBe('outline')
  })

  // The order a builder draws them in, whatever order they were hidden in,
  // so the attribute report-builder.css reads is one string per set.
  test('lists the hidden panes in the order they stand in', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'hidePanel', panel: 'diagnostics' }))
    ok(editor.dispatch({ type: 'hidePanel', panel: 'outline' }))
    ok(editor.dispatch({ type: 'hidePanel', panel: 'properties' }))
    expect(editor.state().hidden).toEqual(['outline', 'properties', 'diagnostics'])
  })

  // With nothing but the design view left to hide, an editor would be a
  // toolbar over nothing; and a narrow layout shows the pane `panel` names,
  // so a hidden one there would leave the screen empty.
  test('never hides the design view, and a narrow layout’s pane, once hidden, gives way to it', () => {
    const { editor } = editorOver()
    expect(editor.dispatch({ type: 'hidePanel', panel: 'canvas' } as never)).toMatchObject({ ok: false, code: 'invalid-value' })
    ok(editor.dispatch({ type: 'openPanel', panel: 'properties' }))
    ok(editor.dispatch({ type: 'hidePanel', panel: 'properties' }))
    expect(editor.state().panel).toBe('canvas')
    expect(editor.state().hidden).toEqual(['properties'])
  })

  // A zoom tool with nowhere to go is marked unavailable by both builders
  // from the same three answers, so one cannot offer Zoom in at 400 % while
  // the other does not.
  test('says whether the zoom can go in, out or back to 100 %', () => {
    const { editor } = editorOver()
    expect(editor.state().can).toMatchObject({ zoomIn: true, zoomOut: true, zoomReset: false })
    ok(editor.dispatch({ type: 'setZoom', zoom: 4 }))
    expect(editor.state().can).toMatchObject({ zoomIn: false, zoomOut: true, zoomReset: true })
    ok(editor.dispatch({ type: 'setZoom', zoom: 0.25 }))
    expect(editor.state().can).toMatchObject({ zoomIn: true, zoomOut: false, zoomReset: true })
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    expect(editor.state().can).toMatchObject({ delete: true, zoomOut: false })
  })

  // The zoom is clamped, never refused: a wheel that overshoots stops at the
  // end of the range, and a value that is not a number changes nothing.
  test('clamps the zoom to its range, and steps it in and out', async () => {
    const { MAX_ZOOM, MIN_ZOOM } = await import('./geometry.js')
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'setZoom', zoom: 100 }))
    expect(editor.state().zoom).toBe(MAX_ZOOM)
    ok(editor.dispatch({ type: 'setZoom', zoom: 0 }))
    expect(editor.state().zoom).toBe(MIN_ZOOM)
    ok(editor.dispatch({ type: 'setZoom', zoom: 1 }))
    ok(editor.dispatch({ type: 'zoomIn' }))
    expect(editor.state().zoom).toBe(1.25)
    ok(editor.dispatch({ type: 'zoomOut' }))
    ok(editor.dispatch({ type: 'zoomOut' }))
    expect(editor.state().zoom).toBe(0.75)
    expect(editor.state().status.text).toBe('Zoom 75%.')
    expect(editor.dispatch({ type: 'setZoom', zoom: Number.NaN })).toMatchObject({ ok: false, code: 'invalid-value' })
    expect(editor.state().zoom).toBe(0.75)
  })
})

describe('selection', () => {
  // Arrow keys in the outline walk what the outline shows, in its order --
  // a table's columns included -- or focus jumps where the eye does not.
  test('selectNext and selectPrevious walk the outline in its order', () => {
    const { editor } = editorOver()
    const order = flat(editor.state()).map((node) => node.key)
    ok(editor.dispatch({ type: 'selectFirst' }))
    const seen = [editor.state().selection]
    for (let step = 1; step < order.length; step += 1) {
      ok(editor.dispatch({ type: 'selectNext' }))
      seen.push(editor.state().selection)
    }
    expect(seen.map((selection) => (selection?.column === undefined ? selection?.id : `${selection.id}/${selection.column}`))).toEqual(order)
    expect(editor.dispatch({ type: 'selectNext' })).toMatchObject({ ok: false, code: 'at-edge' })
    ok(editor.dispatch({ type: 'selectPrevious' }))
    expect(editor.state().selection).toEqual({ id: 'order-code' })
    ok(editor.dispatch({ type: 'selectLast' }))
    expect(editor.state().selection).toEqual({ id: 'pay-code' })
  })

  // Down from nothing starts at the top, and up from nothing at the bottom,
  // so the first key press in a tree with no selection does something.
  test('selectNext from nothing selects the first, selectPrevious the last', () => {
    const first = editorOver().editor
    ok(first.dispatch({ type: 'selectNext' }))
    expect(first.state().selection).toEqual({ id: 'heading' })
    const last = editorOver().editor
    ok(last.dispatch({ type: 'selectPrevious' }))
    expect(last.state().selection).toEqual({ id: 'pay-code' })
  })

  // A selection of something that is not there would leave the properties
  // pane showing nothing and the builder believing it showed something.
  test('refuses to select what is not there, and keeps the selection', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'lines', column: 'sku' }))
    expect(editor.dispatch({ type: 'select', id: 'missing' })).toMatchObject({ ok: false, code: 'not-found' })
    expect(editor.dispatch({ type: 'select', id: 'lines', column: 'missing' })).toMatchObject({ ok: false, code: 'not-found' })
    expect(editor.dispatch({ type: 'select', id: 'intro', column: 'sku' })).toMatchObject({ ok: false, code: 'not-found' })
    expect(editor.state().selection).toEqual({ id: 'lines', column: 'sku' })
    ok(editor.dispatch({ type: 'select', id: null }))
    expect(editor.state().selection).toBeNull()
  })

  // The tree pattern's Left and Right: Left from a row inside a container
  // goes to the container, and from a table's column to its table; Right
  // goes to the first thing a row holds. Without them a keyboard in a long
  // section walks every row back up to reach the section.
  test('selectParent and selectChild step out to what holds a row and into what it holds', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'box' }))
    ok(editor.dispatch({ type: 'selectParent' }))
    expect(editor.state().selection).toEqual({ id: 'notes' })
    ok(editor.dispatch({ type: 'selectChild' }))
    expect(editor.state().selection).toEqual({ id: 'note' })
    ok(editor.dispatch({ type: 'select', id: 'lines', column: 'amount' }))
    ok(editor.dispatch({ type: 'selectParent' }))
    expect(editor.state().selection).toEqual({ id: 'lines' })
    ok(editor.dispatch({ type: 'selectChild' }))
    expect(editor.state().selection).toEqual({ id: 'lines', column: 'sku' })
    ok(editor.dispatch({ type: 'select', id: 'title' }))
    ok(editor.dispatch({ type: 'selectParent' }))
    expect(editor.state().selection).toEqual({ id: 'heading' })
  })

  // With nowhere to step, the key says why rather than doing nothing: a row
  // at a region's top holds nothing above it, and a text holds nothing.
  test('selectParent and selectChild say why at a region’s top, or in a row that holds nothing', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    expect(editor.dispatch({ type: 'selectParent' })).toMatchObject({ ok: false, code: 'at-edge', message: 'Introduction is not inside a container.' })
    expect(editor.dispatch({ type: 'selectChild' })).toMatchObject({ ok: false, code: 'at-edge', message: 'Introduction holds nothing.' })
    ok(editor.dispatch({ type: 'select', id: 'lines', column: 'sku' }))
    expect(editor.dispatch({ type: 'selectChild' })).toMatchObject({ ok: false, code: 'at-edge' })
    // A container whose list is empty holds nothing either, though the next row is deeper than the one before it.
    const report = richReport()
    const empty = editorOver({ ...report, regions: { ...report.regions, body: [{ id: 'hollow', kind: 'section', components: [] }, ...report.regions.body] } }).editor
    ok(empty.dispatch({ type: 'select', id: 'hollow' }))
    expect(empty.dispatch({ type: 'selectChild' })).toMatchObject({ ok: false, code: 'at-edge' })
    expect(empty.state().selection).toEqual({ id: 'hollow' })
    expect(empty.dispatch({ type: 'select', id: null })).toEqual({ ok: true })
    expect(empty.dispatch({ type: 'selectParent' })).toMatchObject({ ok: false, code: 'nothing-selected' })
  })

  // Undo of an insert, or a delete in the other builder, takes the selected
  // component away; a selection left pointing at it would edit nothing.
  test('lets go of a component the session no longer has', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    session.apply((report) => ({ ok: true, report: { ...report, regions: { ...report.regions, body: report.regions.body.filter((component) => component.id !== 'gap') } } }))
    expect(editor.state().selection).toBeNull()
  })
})

describe('moving by keyboard', () => {
  // A keyboard nudge is a reorder within the list, the keyboard path for
  // dragging a block up or down (formancy.ai 0046).
  test('moveUp and moveDown reorder the selection within its list', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    ok(editor.dispatch({ type: 'moveUp' }))
    expect(bodyIds(session.document())).toEqual(['gap', 'intro', 'lines', 'notes', 'keep', 'break'])
    ok(editor.dispatch({ type: 'moveDown' }))
    ok(editor.dispatch({ type: 'moveDown' }))
    expect(bodyIds(session.document())).toEqual(['intro', 'lines', 'gap', 'notes', 'keep', 'break'])
    expect(editor.state().selection).toEqual({ id: 'gap' })
    expect(editor.state().status.text).toBe('Moved Spacer.')
  })

  // The first item has nowhere further up within its list; refusing --
  // never clamping, never jumping regions -- says so (0008).
  test('refuses to move past either end of the list', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    expect(editor.dispatch({ type: 'moveUp' })).toMatchObject({ ok: false, code: 'at-edge', message: 'Introduction is already first.' })
    ok(editor.dispatch({ type: 'select', id: 'break' }))
    expect(editor.dispatch({ type: 'moveDown' })).toMatchObject({ ok: false, code: 'at-edge', message: 'Page break is already last.' })
    expect(session.revision()).toBe(0)
  })

  // A table's column is reordered the same way, through moveColumn.
  test('moves a table column within its table', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'lines', column: 'amount' }))
    ok(editor.dispatch({ type: 'moveUp' }))
    const table = componentAt(session.document(), 'lines')?.component as Extract<Component, { kind: 'table' }>
    expect(table.columns.map((column) => column.id)).toEqual(['amount', 'sku'])
    expect(editor.dispatch({ type: 'moveUp' })).toMatchObject({ ok: false, code: 'at-edge' })
  })

  // Indent puts a component into the container before it, at its end;
  // outdent takes it out to just after its container: the keyboard path
  // for dragging into and out of a section.
  test('indent and outdent move into and out of the container before it', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'keep' }))
    ok(editor.dispatch({ type: 'indent' }))
    const notes = componentAt(session.document(), 'notes')?.component as Extract<Component, { kind: 'section' }>
    expect(notes.components.map((component) => component.id)).toEqual(['note', 'box', 'keep'])
    ok(editor.dispatch({ type: 'outdent' }))
    expect(bodyIds(session.document())).toEqual(['intro', 'gap', 'lines', 'notes', 'keep', 'break'])
    expect(editor.state().selection).toEqual({ id: 'keep' })
  })

  // Into the last column of a columns block, which is where an outliner's
  // indent puts it: at the end of what stands before it.
  test('indents into the last column of a columns block', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'rule' }))
    ok(editor.dispatch({ type: 'indent' }))
    const heading = componentAt(session.document(), 'heading')?.component as Extract<Component, { kind: 'columns' }>
    expect(heading.columns[1]?.components.map((component) => component.id)).toEqual(['title', 'rule'])
  })

  // What stands before is not a container, or nothing does, or the
  // validator refuses the result -- a table into a keep-together block:
  // each changes nothing and says why.
  test('refuses an indent with nowhere to go, or one the validator refuses', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    expect(editor.dispatch({ type: 'indent' })).toMatchObject({ ok: false, code: 'at-edge' })
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    expect(editor.dispatch({ type: 'indent' })).toMatchObject({ ok: false, code: 'at-edge' })
    ok(editor.dispatch({ type: 'select', id: 'lines', column: 'sku' }))
    expect(editor.dispatch({ type: 'indent' })).toMatchObject({ ok: false, code: 'at-edge' })
    ok(editor.dispatch({ type: 'select', id: 'break' }))
    const refused = editor.dispatch({ type: 'indent' })
    expect(refused).toMatchObject({ ok: false, code: 'refused' })
    expect(session.revision()).toBe(0)
    expect(editor.dispatch({ type: 'outdent' })).toMatchObject({ ok: false, code: 'at-edge' })
  })
})

describe('delete and duplicate', () => {
  // Focus after a deletion goes to the next item, else the one before,
  // else the container: never to nothing while something is left nearby
  // (plan 21's "focus after deletion").
  test('delete selects the next item in its list, else the previous, else its container', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    ok(editor.dispatch({ type: 'delete' }))
    expect(componentAt(session.document(), 'gap')).toBeUndefined()
    expect(editor.state().selection).toEqual({ id: 'lines' })
    expect(editor.state().status.text).toBe('Deleted Spacer.')
    ok(editor.dispatch({ type: 'select', id: 'break' }))
    ok(editor.dispatch({ type: 'delete' }))
    expect(editor.state().selection).toEqual({ id: 'keep' })
    ok(editor.dispatch({ type: 'select', id: 'kept' }))
    ok(editor.dispatch({ type: 'delete' }))
    expect(editor.state().selection).toEqual({ id: 'keep' })
    ok(editor.dispatch({ type: 'select', id: 'signature-image' }))
    ok(editor.dispatch({ type: 'delete' }))
    expect(editor.state().selection).toEqual({ id: 'order-code' })
    ok(editor.dispatch({ type: 'delete' }))
    expect(editor.state().selection).toEqual({ id: 'pay-code' })
    ok(editor.dispatch({ type: 'delete' }))
    expect(editor.state().selection).toBeNull()
  })

  // A column's deletion moves to the next column, then the table; the
  // validator refuses a table with none, and that refusal is shown.
  test('deletes a table column, and refuses to delete its last', () => {
    const { editor } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'lines', column: 'sku' }))
    ok(editor.dispatch({ type: 'delete' }))
    expect(editor.state().selection).toEqual({ id: 'lines', column: 'amount' })
    const refused = editor.dispatch({ type: 'delete' })
    expect(refused).toMatchObject({ ok: false, code: 'refused' })
    expect(editor.state().selection).toEqual({ id: 'lines', column: 'amount' })
  })

  // A duplicate the editor does not select is a copy the person then has to
  // find; it is selected, with the fresh id report-core gave it.
  test('duplicate selects the copy', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    ok(editor.dispatch({ type: 'duplicate' }))
    expect(bodyIds(session.document()).slice(0, 2)).toEqual(['intro', 'intro-2'])
    expect(editor.state().selection).toEqual({ id: 'intro-2' })
    ok(editor.dispatch({ type: 'select', id: 'lines', column: 'sku' }))
    ok(editor.dispatch({ type: 'duplicate' }))
    expect(editor.state().selection).toEqual({ id: 'lines', column: 'sku-2' })
  })

  // Every action about the selection, with nothing selected, says so
  // rather than acting on something chosen for the person.
  test('refuses actions about the selection when nothing is selected', () => {
    const { editor } = editorOver()
    for (const type of ['moveUp', 'moveDown', 'indent', 'outdent', 'delete', 'duplicate'] as const) {
      expect(editor.dispatch({ type }), type).toMatchObject({ ok: false, code: 'nothing-selected', message: 'Nothing is selected.' })
    }
  })
})

describe('insert and move to a place', () => {
  // The keyboard path for dropping from the palette: a kind and a place,
  // the new component selected so the next key acts on it.
  test('insert puts the palette’s component at the place and selects it', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'insert', kind: 'text', target: { region: 'body', index: 0 } }))
    expect(bodyIds(session.document())[0]).toBe('text')
    expect(editor.state().selection).toEqual({ id: 'text' })
    expect(session.undoLabel()).toBeDefined()
    expect(editor.state().history.undoLabel).toBe('Insert Text')
    // The rich report is in Swiss German, and a new text's words print: they are the report's.
    expect(editor.state().status.text).toBe('Inserted Neuer Text.')
  })

  // A place the validator refuses -- a table inside columns -- changes
  // nothing, and the refusal carries the validator's reasons.
  test('refuses an insert the validator refuses, and changes nothing', () => {
    const { editor, session } = editorOver()
    const outcome = editor.dispatch({ type: 'insert', kind: 'pageBreak', target: { region: 'reportHeader', index: 0 } })
    expect(outcome).toMatchObject({ ok: false, code: 'refused' })
    expect(!outcome.ok && outcome.refusal?.code).toBe('invalid-document')
    expect(session.revision()).toBe(0)
  })

  // An image with nothing to draw cannot be inserted; the palette said why,
  // and so does the refusal.
  test('refuses to insert a kind the report cannot hold yet', () => {
    const empty = richReport()
    const report: ReportDefinition = { ...empty, assets: [], datasets: {}, regions: { reportHeader: [], pageHeader: [], body: [], pageFooter: [], summary: [] }, aggregates: [], parameters: [] }
    const { editor } = editorOver(report)
    expect(editor.dispatch({ type: 'insert', kind: 'image', target: { region: 'body', index: 0 } })).toMatchObject({ ok: false, code: 'unavailable' })
  })

  // The keyboard path for dragging a component somewhere else.
  test('move puts a component at the place and keeps it selected', () => {
    const { editor, session } = editorOver()
    ok(editor.dispatch({ type: 'move', id: 'intro', target: { region: 'summary', index: 1 } }))
    expect(session.document().regions.summary.map((component) => component.id)).toEqual(['signature-image', 'intro', 'order-code', 'pay-code'])
    expect(editor.state().selection).toEqual({ id: 'intro' })
    expect(editor.dispatch({ type: 'move', id: 'missing', target: { region: 'body', index: 0 } })).toMatchObject({ ok: false, code: 'not-found' })
  })
})

describe('undo and redo', () => {
  // The toolbar says what undo takes back, in the person's language.
  test('undo and redo go through the session, and say what they did', () => {
    const { editor, session } = editorOver(richReport(), { locale: 'de-CH' })
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    ok(editor.dispatch({ type: 'delete' }))
    expect(editor.state().history).toEqual({ canUndo: true, canRedo: false, undoLabel: 'Löschen: Abstand', redoLabel: null })
    ok(editor.dispatch({ type: 'undo' }))
    expect(componentAt(session.document(), 'gap')).toBeDefined()
    expect(editor.state().status.text).toBe('Rückgängig gemacht: Löschen: Abstand.')
    ok(editor.dispatch({ type: 'redo' }))
    expect(componentAt(session.document(), 'gap')).toBeUndefined()
  })

  // Nothing to undo is said, not silently ignored: a keyboard user pressing
  // Ctrl+Z hears why nothing happened.
  test('refuses undo and redo with no step to take', () => {
    const { editor } = editorOver()
    expect(editor.dispatch({ type: 'undo' })).toMatchObject({ ok: false, code: 'no-history', message: 'Nothing to undo.' })
    expect(editor.dispatch({ type: 'redo' })).toMatchObject({ ok: false, code: 'no-history', message: 'Nothing to redo.' })
  })

  // A step labelled by someone else -- a proposal, a host's own command --
  // is shown with its own label, not dropped or replaced.
  test('shows a label this package did not write as it is', () => {
    const { editor, session } = editorOver(richReport(), { locale: 'de-CH' })
    session.apply((report) => setTitle(report, 'x'), { label: 'Apply proposal' })
    expect(editor.state().history.undoLabel).toBe('Apply proposal')
  })

  // The session's labels are read by more than this package: a host's own
  // toolbar, a history view or a proposal's review shows them as they are.
  // Kept as an encoding only an editor reads, they would show the encoding
  // there. The session keeps a sentence, and each editor still says the
  // step in its own words.
  test('keep a sentence in the session, which each editor says in its own language', () => {
    const { editor, session } = editorOver(richReport(), { locale: 'fr-CH' })
    ok(editor.dispatch({ type: 'select', id: 'gap' }))
    ok(editor.dispatch({ type: 'delete' }))
    expect(session.undoLabel()).toBe('Delete Spacer')
    expect(editor.state().history.undoLabel).toBe(editorText('fr-CH')('history.delete', { kind: editorText('fr-CH')('kind.spacer') }))
    ok(editor.dispatch({ type: 'select', id: 'intro' }))
    ok(editor.dispatch({ type: 'setProperty', key: '/content/0/text', value: 'Einleitung' }))
    expect(session.undoLabel()).toBe('Change Text')
    const french = editorText('fr-CH')
    expect(editor.state().history.undoLabel).toBe(french('history.change', { field: french('field.text') }))
  })
})

describe('announcements', () => {
  // A live region announces a change of its text; saying "Nothing to undo."
  // twice must still be two announcements, so each has its own number.
  test('numbers every announcement, the same words twice included', () => {
    const { editor } = editorOver()
    editor.dispatch({ type: 'undo' })
    const first = editor.state().status
    editor.dispatch({ type: 'undo' })
    expect(editor.state().status.text).toBe(first.text)
    expect(editor.state().status.sequence).toBe(first.sequence + 1)
  })
})
