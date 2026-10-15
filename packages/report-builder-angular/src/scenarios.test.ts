/**
 * Every scenario report-builder-core lists for a native builder, run
 * against this one, in each of the editor's languages: the same user-visible
 * behaviour the React builder runs, found by role and accessible name and
 * nothing else (plan 21).
 *
 * Each scenario ends with axe over the page as the scenario left it, so a
 * dialog, an error or a moved row is audited in the state a person meets
 * it, not only the state the builder starts in.
 */
import { TestBed } from '@angular/core/testing'
import { BUILDER_SCENARIOS, builderScenarios, createReportEditor, EDITOR_LOCALES, SCENARIO_ACTIONS, SCENARIO_EXPECTATIONS } from '@formancy/report-builder-core'
import type { BuilderScenario, ScenarioQuery, ScenarioStep } from '@formancy/report-builder-core'
import type { ReportSession } from '@formancy/report-core'
import { screen } from '@testing-library/angular'
import { computeAccessibleDescription } from 'dom-accessibility-api'
import { afterAll, afterEach, describe, expect, test } from 'vitest'
import { mountBuilder } from './test-mount'
import type { Mounted } from './test-mount'
import { audit, sessionOver } from './test-support'
import { choose, click, fill, press } from './test-user'

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

/** The kinds of step this runner has done, across every scenario. */
const done = new Set<string>()
/** The English scenarios run, by name: none may be skipped. */
const ran = new Set<string>()

async function run(step: ScenarioStep, mounted: Mounted, session: ReportSession): Promise<void> {
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
  }
}

async function play(scenario: BuilderScenario): Promise<void> {
  const session = sessionOver(scenario.report())
  const mounted = await mountBuilder(createReportEditor(session, { locale: scenario.locale }))
  for (const step of scenario.steps) await run(step, mounted, session)
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
