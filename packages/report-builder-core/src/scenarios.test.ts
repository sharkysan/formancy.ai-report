/**
 * The scenarios, run against the editor model by a headless driver that
 * reads the state the way the builder contract in the README says a builder
 * renders it: a toolbar of buttons, the palette's buttons, a dialog of places
 * while a keyboard chooses one, a tree of the outline whose focus is its
 * selection, a field per property with a button back to the report's own,
 * a button per diagnostic and a status counting them, and the live region.
 *
 * It is the third reading of that contract, on purpose and only here: it
 * shows that every name a scenario looks for is one the state gives, and that
 * every step can be done with the state alone, before either framework runs
 * the scenarios with Testing Library. What it cannot show -- focus, roles,
 * what a person sees -- is what the framework runs are for.
 */
import type { ReportSession } from '@formancy/report-core'
import { componentAt } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { createReportEditor } from './editor.js'
import type { ReportEditor } from './editor.js'
import { actionForKey } from './keys.js'
import type { EditorAction, EditorState, OutlineNode } from './model.js'
import { PROPERTY_ROLES } from './model.js'
import { BUILDER_SCENARIOS, builderScenarios, SCENARIO_ACTIONS, SCENARIO_EXPECTATIONS, scenarioReport } from './scenarios.js'
import type { BuilderScenario, ScenarioQuery, ScenarioStep } from './scenarios.js'
import { EDITOR_LOCALES, editorText } from './text.js'
import type { EditorText } from './text.js'
import { sessionOver } from './test-support.js'

function nodes(state: EditorState): OutlineNode[] {
  const all: OutlineNode[] = []
  const visit = (list: readonly OutlineNode[]): void => {
    for (const node of list) {
      all.push(node)
      visit(node.children)
    }
  }
  for (const region of state.outline) visit(region.nodes)
  return all
}

/** The toolbar's buttons, by name, and what each dispatches. */
function toolbar(t: EditorText, state: EditorState): Map<string, EditorAction | undefined> {
  const selection = state.selection
  return new Map<string, EditorAction | undefined>([
    [t('action.undo'), { type: 'undo' }],
    [t('action.redo'), { type: 'redo' }],
    [t('action.moveUp'), { type: 'moveUp' }],
    [t('action.moveDown'), { type: 'moveDown' }],
    [t('action.indent'), { type: 'indent' }],
    [t('action.outdent'), { type: 'outdent' }],
    [t('action.moveTo'), selection === null ? undefined : { type: 'startDrag', subject: { id: selection.id }, via: 'keyboard' }],
    [t('action.duplicate'), { type: 'duplicate' }],
    [t('action.delete'), { type: 'delete' }],
    [t('action.zoomOut'), { type: 'zoomOut' }],
    [t('action.zoomIn'), { type: 'zoomIn' }],
    [t('action.zoomReset'), { type: 'setZoom', zoom: 1 }],
    [t('pane.outline'), { type: 'openPanel', panel: 'outline' }],
    [t('pane.canvas'), { type: 'openPanel', panel: 'canvas' }],
    [t('pane.properties'), { type: 'openPanel', panel: 'properties' }],
    [t('pane.problems'), { type: 'openPanel', panel: 'diagnostics' }],
  ])
}

/** Every button the state shows, by name, and what activating it dispatches. */
function buttons(t: EditorText, state: EditorState): Map<string, EditorAction | undefined> {
  const found = toolbar(t, state)
  const choosing = state.drag?.via === 'keyboard' ? state.drag : null
  if (choosing !== null) {
    for (const target of state.dropTargets) {
      const subject = choosing.subject
      found.set(target.label, 'kind' in subject ? { type: 'insert', kind: subject.kind, target: target.location } : { type: 'move', id: subject.id, target: target.location })
    }
    found.set(t('places.cancel'), { type: 'cancelDrag' })
  } else {
    for (const entry of state.palette) found.set(entry.label, { type: 'startDrag', subject: { kind: entry.kind }, via: 'keyboard' })
  }
  for (const entry of state.diagnostics) found.set(entry.label, entry.target === null ? { type: 'select', id: null } : { type: 'select', ...entry.target })
  // Back to the report's own properties, shown while something else is selected.
  if (state.selection !== null) found.set(t('properties.report'), { type: 'select', id: null })
  return found
}

/** What a status says: the zoom's readout, the problems' count, or -- the one with no name -- the live region. */
function statusText(t: EditorText, state: EditorState, name: string): string | undefined {
  if (name === t('zoom.label')) return state.zoomLabel
  if (name === t('pane.problems')) return state.diagnostics.length === 0 ? name : `${name} ${state.diagnostics.length}`
  return name === '' ? state.status.text : undefined
}

class Driver {
  readonly session: ReportSession
  readonly editor: ReportEditor
  readonly t: EditorText
  focused: { readonly role: string; readonly name: string } | null = null
  constructor(scenario: BuilderScenario) {
    this.session = sessionOver(scenario.report())
    this.editor = createReportEditor(this.session, { locale: scenario.locale })
    this.t = editorText(scenario.locale)
  }

  get state(): EditorState {
    return this.editor.state()
  }

  /** The selected node's tree item, which focus follows in the outline. */
  private focusSelection(): void {
    const selected = nodes(this.state).find((node) => node.selected)
    this.focused = selected === undefined ? null : { role: 'treeitem', name: selected.label }
  }

  private dispatch(action: EditorAction | undefined, what: string): void {
    if (action === undefined) throw new Error(`${what} does nothing here`)
    this.editor.dispatch(action)
  }

  /** Selects the outline row named `name`, which focus follows. */
  private selectRow(name: string): void {
    const node = nodes(this.state).find((candidate) => candidate.label === name)
    if (node === undefined) throw new Error(`no tree item ${name}`)
    if (!node.selected) this.dispatch({ type: 'select', id: node.id, ...(node.column === undefined ? {} : { column: node.column }) }, name)
    this.focusSelection()
  }

  private activate(query: ScenarioQuery): void {
    if (query.role === 'treeitem') return this.selectRow(query.name)
    if (query.role !== 'button') throw new Error(`nothing to activate in a ${query.role}`)
    const shown = buttons(this.t, this.state)
    if (!shown.has(query.name)) throw new Error(`no button ${query.name} among ${[...shown.keys()].join(' | ')}`)
    const action = shown.get(query.name)
    const choosing = this.state.drag?.via === 'keyboard'
    this.dispatch(action, query.name)
    const selects = action?.type === 'insert' || action?.type === 'move' || action?.type === 'select'
    const first = this.state.properties.fields[0]
    // Back at the report's properties, focus is on the first of them.
    if (query.name === this.t('properties.report') && first !== undefined) this.focused = { role: PROPERTY_ROLES[first.kind], name: first.label }
    else if (selects || (choosing && action?.type === 'cancelDrag')) this.focusSelection()
    else if (action?.type === 'startDrag') this.focused = null
    else this.focused = { role: 'button', name: query.name }
  }

  private field(query: ScenarioQuery) {
    const found = this.state.properties.fields.find((field) => field.label === query.name && PROPERTY_ROLES[field.kind] === query.role)
    if (found === undefined) throw new Error(`no ${query.role} ${query.name} among ${this.state.properties.fields.map((field) => field.label).join(' | ')}`)
    return found
  }

  private present(query: ScenarioQuery): boolean {
    const state = this.state
    switch (query.role) {
      case 'treeitem':
        return nodes(state).some((node) => node.label === query.name && (query.selected === undefined || node.selected === query.selected))
      case 'dialog':
        return state.drag?.via === 'keyboard' && state.drag.title === query.name
      case 'button':
        return buttons(this.t, state).has(query.name)
      case 'status':
        return statusText(this.t, state, query.name) !== undefined
      default:
        return state.properties.fields.some((field) => field.label === query.name && PROPERTY_ROLES[field.kind] === query.role)
    }
  }

  step(step: ScenarioStep): void {
    if ('do' in step) {
      switch (step.do) {
        case 'click':
          return this.activate(step)
        case 'focus':
          if (!this.present(step)) throw new Error(`nothing to focus: ${step.role} ${step.name}`)
          if (step.role === 'treeitem') return this.selectRow(step.name)
          this.focused = { role: step.role, name: step.name }
          return
        case 'press': {
          const modifiers = new Set(step.modifiers ?? [])
          if (step.key === 'Enter' && this.focused !== null) return this.activate(this.focused)
          const where = this.focused?.role === 'treeitem' ? 'outline' : 'editor'
          const press = { key: step.key, altKey: modifiers.has('Alt'), ctrlKey: modifiers.has('Control'), metaKey: modifiers.has('Meta'), shiftKey: modifiers.has('Shift') }
          this.dispatch(actionForKey(press, where, this.state.drag !== null), `the key ${step.key}`)
          if (where === 'outline') this.focusSelection()
          return
        }
        case 'fill':
          this.editor.dispatch({ type: 'setProperty', key: this.field(step).key, value: step.text })
          return
        case 'choose': {
          const field = this.field(step)
          const option = field.options?.find((candidate) => candidate.label === step.option)
          if (option === undefined) throw new Error(`no option ${step.option} in ${step.name}`)
          this.editor.dispatch({ type: 'setProperty', key: field.key, value: option.value })
          return
        }
      }
    }
    const expectation = step
    switch (expectation.expect) {
      case 'present':
        return void expect(this.present(expectation), `${expectation.role} ${expectation.name}`).toBe(true)
      case 'absent':
        return void expect(this.present(expectation), `${expectation.role} ${expectation.name}`).toBe(false)
      case 'focused':
        expect(this.focused).toEqual({ role: expectation.role, name: expectation.name })
        return void expect(this.present(expectation)).toBe(true)
      case 'value':
        return void expect(this.field(expectation).value).toBe(expectation.value)
      case 'text':
        expect(expectation.role).toBe('status')
        return void expect(statusText(this.t, this.state, expectation.name)).toContain(expectation.text)
      case 'invalid':
        return void expect(this.field(expectation).error ?? '').not.toBe('')
      case 'document':
        return void expect(expectation.check(this.session.document()), expectation.says).toBe(true)
    }
  }
}

describe('the builder scenarios', () => {
  // Each scenario, every step, against the model in every language: a name
  // a scenario looks for that the state never gives would fail a framework
  // run for a reason no builder could fix.
  for (const locale of EDITOR_LOCALES) {
    for (const scenario of builderScenarios(locale)) {
      test(`${locale}: ${scenario.name}`, () => {
        const driver = new Driver(scenario)
        for (const step of scenario.steps) driver.step(step)
      })
    }
  }

  // The list the framework tests run is the English one, and every
  // language has the same scenarios, step for step.
  test('are the same scenarios in every language', () => {
    // A check is a function, so the lists are compared as the data they are.
    expect(JSON.stringify(BUILDER_SCENARIOS)).toBe(JSON.stringify(builderScenarios('en')))
    const shape = (scenarios: readonly BuilderScenario[]) => scenarios.map((scenario) => [scenario.name, scenario.steps.map((step) => ('do' in step ? step.do : step.expect))])
    for (const locale of EDITOR_LOCALES) expect(shape(builderScenarios(locale)), locale).toEqual(shape(BUILDER_SCENARIOS))
  })

  // A document check that already holds before any step passes whether the
  // builder did anything or not; the first one of each scenario must not,
  // unless it says it checks that something stayed as it was.
  test('check, first, something the steps change', () => {
    for (const scenario of BUILDER_SCENARIOS) {
      const first = scenario.steps.find((step) => 'expect' in step && step.expect === 'document')
      if (first === undefined || !('expect' in first) || first.expect !== 'document') continue
      expect(first.check(scenario.report()), `${scenario.name}: ${first.says}`).toBe(first.unchanged === true)
    }
  })

  // A framework's runner implements every kind of step; one no scenario
  // uses is one no runner is ever made to implement correctly.
  test('use every kind of step', () => {
    const used = new Set(BUILDER_SCENARIOS.flatMap((scenario) => scenario.steps.map((step) => ('do' in step ? step.do : step.expect))))
    expect(used).toEqual(new Set([...SCENARIO_ACTIONS, ...SCENARIO_EXPECTATIONS]))
  })

  // The task list plan 21 names: insert by keyboard, select in the
  // outline, edit the title, refuse an invalid property, move, delete with
  // focus, duplicate, undo and redo, a diagnostic linked to its component,
  // zoom -- each is a scenario.
  test('cover what plan 21 asks of every builder', () => {
    const names = BUILDER_SCENARIOS.map((scenario) => scenario.name)
    for (const required of ['insert', 'outline', 'title', 'invalid', 'move', 'delete', 'duplicate', 'undo', 'diagnostic', 'zoom']) {
      expect(names.some((name) => name.includes(required)), required).toBe(true)
    }
  })

  // The scenarios' report is valid, and diagnoses clean, so an error a
  // scenario looks for is the one it put there.
  test('start from a valid report that a scenario breaks on purpose', () => {
    const editor = createReportEditor(sessionOver(scenarioReport()))
    expect(editor.state().diagnostics).toEqual([])
    expect(componentAt(scenarioReport(), 'intro')).toBeDefined()
  })
})
