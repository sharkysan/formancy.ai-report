/**
 * Every scenario report-builder-core lists for a native builder, run
 * against this one, in each of the editor's languages: the same user-visible
 * behaviour the React builder runs, found by role and accessible name and
 * nothing else (plan 21).
 *
 * Each scenario ends with axe over the page as the scenario left it, so a
 * dialog, an error or a moved row is audited in the state a person meets
 * it, not only the state the builder starts in.
 *
 * But for one element: the file input Add image… opens, hidden and with
 * no role, which an `upload` step finds beside the button in the DOM to
 * hand it the file (0033). A scenario about images makes its editor with
 * the store `scenarioStore` gives it.
 */
import { TestBed } from '@angular/core/testing'
import {
  BUILDER_SCENARIOS,
  builderScenarios,
  createReportEditor,
  EDITOR_LOCALES,
  SCENARIO_ACTIONS,
  SCENARIO_EXPECTATIONS,
  scenarioStore,
} from '@formancy/report-builder-core'
import type { AddedImage, BuilderScenario, ReportEditor, ScenarioFile, ScenarioQuery, ScenarioStep } from '@formancy/report-builder-core'
import type { ReportSession } from '@formancy/report-core'
import { screen, waitFor } from '@testing-library/angular'
import { computeAccessibleDescription } from 'dom-accessibility-api'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { mountBuilder, mountWithHostView } from './test-mount'
import type { Mounted } from './test-mount'
import { audit, sessionOver } from './test-support'
import { choose, click, fileInputOf, fill, pick, press } from './test-user'

afterEach(() => {
  TestBed.resetTestingModule()
})

/** The element a step names, by its role and accessible name, and its selection where the step says. */
function find(query: ScenarioQuery): HTMLElement {
  return screen.getByRole(query.role, { name: query.name, ...(query.selected === undefined ? {} : { selected: query.selected }) })
}

function absent(query: ScenarioQuery): boolean {
  return screen.queryByRole(query.role, { name: query.name, ...(query.selected === undefined ? {} : { selected: query.selected }) }) === null
}

/**
 * Add image… clicked, and `file` handed to the input it opened. Done once
 * the editor has said what became of the file: it says it is adding it,
 * then how that ended. A click that opened no chooser, or a file the
 * editor never took, fails the step.
 */
async function upload(button: HTMLElement, file: ScenarioFile, mounted: Mounted<unknown>): Promise<void> {
  const input = fileInputOf(button)
  let opened = 0
  const open = (): void => {
    opened += 1
  }
  input.addEventListener('click', open)
  try {
    click(button)
  } finally {
    input.removeEventListener('click', open)
  }
  expect(opened, `${button.textContent ?? ''} opened no file chooser`).toBe(1)
  const editor: ReportEditor = mounted.editor
  const before = editor.state().status.sequence
  pick(input, new File([Uint8Array.from(file.bytes)], file.name, { type: file.type }))
  await waitFor(() => {
    const now = editor.state()
    expect(now.images.adding === null && now.status.sequence >= before + 2, `the editor never took ${file.name}, or is adding it still`).toBe(true)
  })
}

/** The kinds of step this runner has done, across every scenario. */
const done = new Set<string>()
/** The English scenarios run, by name: none may be skipped. */
const ran = new Set<string>()

async function run(step: ScenarioStep, mounted: Mounted<unknown>, session: ReportSession, kept: readonly AddedImage[]): Promise<void> {
  done.add('do' in step ? step.do : step.expect)
  if ('do' in step) {
    switch (step.do) {
      case 'click':
        click(find(step))
        break
      case 'focus':
        find(step).focus()
        break
      case 'press':
        press(step.key, step.modifiers)
        break
      case 'fill':
        fill(find(step), step.text)
        break
      case 'choose':
        choose(find(step), step.option)
        break
      case 'host':
        // What the host's own control does -- the Studio's Preview, in its bar -- through the editor.
        mounted.editor.dispatch(step.action)
        break
      case 'upload':
        await upload(find(step), step.file, mounted)
        break
    }
    await mounted.settle()
    return
  }
  switch (step.expect) {
    case 'present':
      return void find(step)
    case 'absent':
      return void expect(absent(step), `${step.role} ${step.name} is still there`).toBe(true)
    case 'focused':
      return void expect(document.activeElement).toBe(find(step))
    case 'value':
      return void expect((find(step) as HTMLInputElement).value).toBe(step.value)
    case 'text':
      return void expect(find(step).textContent).toContain(step.text)
    case 'invalid': {
      const field = find(step)
      expect(field.getAttribute('aria-invalid')).toBe('true')
      return void expect(computeAccessibleDescription(field)).not.toBe('')
    }
    case 'document':
      return void expect(step.check(session.document()), step.says).toBe(true)
    case 'kept':
      return void expect(step.check(kept), step.says).toBe(true)
  }
}

async function play(scenario: BuilderScenario): Promise<void> {
  const session = sessionOver(scenario.report())
  const { host } = scenario
  const images = scenarioStore(scenario)
  const editor = createReportEditor(session, {
    locale: scenario.locale,
    ...(host === undefined ? {} : { hostView: host }),
    ...(images === undefined ? {} : { images: images.store }),
  })
  const mounted = host === undefined ? await mountBuilder(editor) : await mountWithHostView(editor, host.control)
  for (const step of scenario.steps) await run(step, mounted, session, images?.kept ?? [])
  expect(await audit()).toEqual([])
}

describe('the builder scenarios', () => {
  for (const scenario of BUILDER_SCENARIOS) {
    test(scenario.name, async () => {
      await play(scenario)
      ran.add(scenario.name)
    })
  }

  // The names are the catalogue's, so a scenario passing in English and
  // failing in German is a word the builder hard-coded.
  for (const locale of EDITOR_LOCALES.filter((locale) => locale !== 'en')) {
    for (const scenario of builderScenarios(locale)) {
      test(`${locale}: ${scenario.name}`, async () => {
        await play(scenario)
      })
    }
  }

  // The guard on the guard: an audit that could not fail would pass every
  // scenario above for having looked at nothing.
  test('audit with an axe that finds what it is for', async () => {
    document.body.innerHTML = '<button type="button"></button>'
    expect((await audit()).join()).toMatch(/^button-name: /)
    document.body.innerHTML = ''
  })

  // A scenario this file stopped running, or a kind of step this runner
  // stopped doing, would leave the builder short of the React one without
  // any test going red.
  afterAll(() => {
    expect([...ran]).toEqual(BUILDER_SCENARIOS.map((scenario) => scenario.name))
    expect(done).toEqual(new Set([...SCENARIO_ACTIONS, ...SCENARIO_EXPECTATIONS]))
  })
})
