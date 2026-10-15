/**
 * The builder scenarios report-builder-core lists for every native builder,
 * run against the React one with Testing Library and user-event, each in
 * every language the editor speaks, with axe over the end state of each.
 *
 * The scenarios are data shared with the Angular builder, so neither can
 * quietly expect less of itself than the other does (plan 21). Here they
 * meet focus, roles and the DOM, which the model's own run of them cannot.
 */
import { BUILDER_SCENARIOS, builderScenarios, EDITOR_LOCALES } from '@formancy/report-builder-core'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { mount, runStep, violations } from './test-support.js'

afterEach(cleanup)

const ran = new Set<string>()

describe('the builder scenarios, in React', () => {
  // Each scenario, step by step, in each language; a step the builder
  // cannot do, a name it does not render or focus left in the wrong place
  // fails the scenario. Then axe: a scenario that ends in a state no
  // assistive technology can use has not passed.
  for (const locale of EDITOR_LOCALES) {
    for (const scenario of builderScenarios(locale)) {
      test(`${locale}: ${scenario.name}`, async () => {
        const mounted = mount(scenario.report(), scenario.locale)
        for (const step of scenario.steps) await runStep(step, mounted)
        expect(await violations()).toEqual([])
        ran.add(`${locale}: ${scenario.name}`)
      })
    }
  }

  // A scenario skipped, filtered out or lost from the loop above would leave
  // the builder unchecked against it while the suite stayed green. Last in
  // the file, so it runs after every scenario has.
  test('ran every scenario, in every language', () => {
    const expected = EDITOR_LOCALES.flatMap((locale) => BUILDER_SCENARIOS.map((scenario) => `${locale}: ${scenario.name}`))
    expect([...ran].sort()).toEqual(expected.sort())
  })
})
