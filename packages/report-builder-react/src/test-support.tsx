/**
 * What the tests mount a builder with, audit it with, and drive the shared
 * scenarios through. Only test files import this; the published entry never
 * reaches it.
 *
 * Every element is found by its role and accessible name and nothing else,
 * as the scenarios are written (plan 21): a builder that renders the right
 * thing under the wrong name fails here, as it would fail a person using a
 * screen reader.
 */
import { createReportEditor } from '@formancy/report-builder-core'
import type { EditorLocale, ReportEditor, ScenarioHost, ScenarioStep } from '@formancy/report-builder-core'
import { openReportSession } from '@formancy/report-core'
import type { ReportSession } from '@formancy/report-core'
import type { ReportDefinition } from '@formancy/report-spec'
import { act, render, screen } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import axe from 'axe-core'
import { computeAccessibleDescription } from 'dom-accessibility-api'
import { expect } from 'vitest'
import { ReportBuilder } from './report-builder.js'

/** A session over `report`; fails the test when it does not open. */
export function sessionOver(report: unknown): ReportSession {
  const opening = openReportSession(report)
  if (!opening.ok) throw new Error(`the report did not open: ${opening.errors.map((error) => `${error.code} ${error.path}`).join(', ')}`)
  return opening.session
}

export interface Mounted {
  readonly session: ReportSession
  readonly editor: ReportEditor
  readonly user: ReturnType<typeof userEvent.setup>
  readonly view: RenderResult
}

/**
 * A builder over a new session of `report`, mounted into the document; with
 * `host`, its editor made with that view of the host's, and the builder
 * given, as the view, the one button the scenario names.
 */
export function mount(report: ReportDefinition, locale: EditorLocale = 'en', host?: ScenarioHost): Mounted {
  const session = sessionOver(report)
  const editor = createReportEditor(session, { locale, ...(host === undefined ? {} : { hostView: host }) })
  const user = userEvent.setup()
  const view = render(host === undefined ? <ReportBuilder editor={editor} /> : <ReportBuilder editor={editor} hostView={<button type="button">{host.control}</button>} />)
  return { session, editor, user, view }
}

/**
 * The standard the audit holds the builder to: WCAG 2.2 AA and what it
 * subsumes, by axe's tags. `best-practice` is left out, as formancy.ai's
 * builders leave it out: good advice, not the standard, and a suite that
 * failed on it would be the first one somebody turned off.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * Rules jsdom cannot decide, each with why. Not "does not apply": "cannot be
 * measured here". jsdom has no layout and no computed colour, so these would
 * report nothing either way; a browser gate decides them, and the README's
 * pictures are no such gate.
 */
const UNMEASURABLE_IN_JSDOM: Readonly<Record<string, string>> = {
  'color-contrast': 'jsdom computes no colour: the contrast of the workbench’s variables is for a browser to measure.',
  'target-size': 'WCAG 2.2 SC 2.5.8 is a size in CSS pixels, and jsdom lays nothing out, so every target is 0 by 0.',
}

/** axe's violations in the document as it stands: the rule, and the markup of each node. */
export async function violations(): Promise<{ readonly id: string; readonly nodes: readonly string[] }[]> {
  const rules = Object.fromEntries(Object.keys(UNMEASURABLE_IN_JSDOM).map((id) => [id, { enabled: false }]))
  const results = await axe.run(document.body, { runOnly: { type: 'tag', values: WCAG }, rules, resultTypes: ['violations'] })
  return results.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.html) }))
}

/** The one element with this role and name, and the selected state when the query names one. */
function find(query: { readonly role: string; readonly name: string; readonly selected?: boolean }): HTMLElement {
  return screen.getByRole(query.role, { name: query.name, ...(query.selected === undefined ? {} : { selected: query.selected }) })
}

function query(step: { readonly role: string; readonly name: string; readonly selected?: boolean }): HTMLElement | null {
  return screen.queryByRole(step.role, { name: step.name, ...(step.selected === undefined ? {} : { selected: step.selected }) })
}

/** What a control holds: an input's, a textarea's or a select's value. */
function valueOf(element: HTMLElement): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value
  throw new Error(`a ${element.tagName} has no value`)
}

/** user-event's keyboard text for a key held with modifiers: `{Alt>}{ArrowDown}{/Alt}`. */
function keys(key: string, modifiers: readonly string[] = []): string {
  return `${modifiers.map((modifier) => `{${modifier}>}`).join('')}{${key}}${[...modifiers].reverse().map((modifier) => `{/${modifier}}`).join('')}`
}

/** Does one scenario step against the mounted builder, as the scenario's comment in report-builder-core describes. */
export async function runStep(step: ScenarioStep, { user, session, editor }: Mounted): Promise<void> {
  if ('do' in step) {
    switch (step.do) {
      case 'click':
        return user.click(find(step))
      case 'focus': {
        const element = find(step)
        act(() => element.focus())
        return
      }
      case 'press':
        return user.keyboard(keys(step.key, step.modifiers))
      case 'fill': {
        const element = find(step)
        await user.clear(element)
        // Filling a field with nothing is clearing it: user-event has no keys to type for an empty text, and refuses one.
        if (step.text !== '') await user.type(element, step.text)
        return user.tab()
      }
      case 'choose':
        return void (await user.selectOptions(find(step), step.option))
      case 'host':
        // What the host's own control does -- the Studio's Preview, in its bar -- through the editor.
        return void act(() => {
          editor.dispatch(step.action)
        })
    }
  }
  switch (step.expect) {
    case 'present':
      return void expect(find(step)).toBeTruthy()
    case 'absent':
      return void expect(query(step), `${step.role} ${step.name}`).toBeNull()
    case 'focused':
      return void expect(document.activeElement, `focus on ${step.role} ${step.name}`).toBe(find(step))
    case 'value':
      return void expect(valueOf(find(step))).toBe(step.value)
    case 'text':
      return void expect(find(step).textContent).toContain(step.text)
    case 'invalid': {
      const element = find(step)
      expect(element.getAttribute('aria-invalid')).toBe('true')
      return void expect(computeAccessibleDescription(element)).not.toBe('')
    }
    case 'document':
      return void expect(step.check(session.document()), step.says).toBe(true)
  }
}
