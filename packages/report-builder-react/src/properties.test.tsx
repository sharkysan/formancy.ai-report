/**
 * The properties pane and the problems: when a typed value is committed and
 * when it is given back, whose keys a text field's are, the way back to the
 * report's own properties, and how a new problem is said.
 */
import { editorText, scenarioReport } from '@formancy/report-builder-core'
import type { ReportDefinition } from '@formancy/report-spec'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { mount } from './test-support.js'

afterEach(cleanup)

const t = editorText('en')
const title = (): HTMLInputElement => screen.getByRole('textbox', { name: t('field.title') })
const intro = (report: ReportDefinition) => report.regions.body.find((component) => component.id === 'intro')

describe('a typed field', () => {
  // Enter commits a single-line field without leaving it; Escape gives back
  // what the report holds, and the report never saw the draft.
  test('commits on Enter, and gives the draft back on Escape', async () => {
    const { user, session } = mount(scenarioReport())
    await user.clear(title())
    await user.type(title(), 'Draft{Escape}')
    expect(title().value).toBe('Site visit')
    await user.tab()
    expect(session.canUndo()).toBe(false)

    await user.clear(title())
    await user.type(title(), 'Kept{Enter}')
    expect(session.document().title).toBe('Kept')
    expect(document.activeElement).toBe(title())
  })

  // Ctrl+Z in a field undoes typing -- the browser's -- never the report's
  // last step, which a person in the middle of a word did not ask for.
  test('keeps its own keys', async () => {
    const { user, session } = mount(scenarioReport())
    await user.clear(title())
    await user.type(title(), 'Changed{Enter}')
    expect(session.canUndo()).toBe(true)
    await user.keyboard('{Control>}z{/Control}')
    expect(session.document().title).toBe('Changed')
  })

  // The fields are a <form>, and a form submitted -- by a browser's
  // implicit submission, or a host's script -- would load the page again and
  // lose the session. Submitting it does nothing.
  test('is in a form that never submits', () => {
    mount(scenarioReport())
    expect(fireEvent.submit(screen.getByRole('form', { name: t('properties.report') }))).toBe(false)
  })

  // A checkbox commits as it changes: there is nothing to type and leave.
  test('of a yes or no commits when it changes', async () => {
    const { user, session } = mount(scenarioReport())
    await user.click(screen.getByRole('treeitem', { name: 'Introduction' }))
    await user.click(screen.getByRole('checkbox', { name: t('field.keepWithNext') }))
    expect(intro(session.document())).toMatchObject({ keepWithNext: true })
    // A checkbox has no typing of its own to undo: Ctrl+Z on it is the report's.
    await user.keyboard('{Control>}z{/Control}')
    expect(intro(session.document())).not.toHaveProperty('keepWithNext')
  })
})

describe('the report’s own properties', () => {
  // Once something is selected the report's title and page are a button
  // away, and focus lands on the first of them; without it, the only way
  // back would be a diagnostic about the report.
  test('are a button away from any selection', async () => {
    const { user } = mount(scenarioReport())
    await user.click(screen.getByRole('treeitem', { name: 'Introduction' }))
    await user.click(screen.getByRole('button', { name: t('properties.report') }))
    expect(screen.getByRole('form', { name: t('properties.report') })).toBeTruthy()
    expect(document.activeElement).toBe(title())
    expect(screen.queryByRole('button', { name: t('properties.report') })).toBeNull()
  })

  // A diagnostic about the report as a whole -- an empty body -- has no
  // component to select; following it shows the report's properties.
  test('are what a diagnostic about the whole report shows', async () => {
    const report = scenarioReport()
    const { user } = mount({ ...report, styles: [], regions: { ...report.regions, body: [], summary: [{ id: 'end', kind: 'text', content: [{ kind: 'text', text: 'End' }] }] } })
    await user.click(screen.getByRole('treeitem', { name: 'End' }))
    await user.click(screen.getByRole('button', { name: t('problem.item', { severity: t('severity.warning'), where: t('problem.report') }) }))
    expect(screen.getByRole('form', { name: t('properties.report') })).toBeTruthy()
  })
})

describe('the problems', () => {
  // A problem an edit causes is said where the person is, politely, as the
  // count in the problems pane's heading; undone, the count goes.
  test('say how many there are when the count changes', async () => {
    const { user } = mount(scenarioReport())
    const count = (): string | null => screen.getByRole('status', { name: t('pane.problems') }).textContent
    expect(count()).toBe(t('pane.problems'))
    await user.click(screen.getByRole('treeitem', { name: 'Introduction' }))
    await user.type(screen.getByRole('textbox', { name: t('field.visibleWhen') }), 'params.missing')
    await user.tab()
    expect(count()).toBe(`${t('pane.problems')} 1`)
    expect(screen.getByRole('textbox', { name: t('field.visibleWhen') }).getAttribute('aria-invalid')).toBe('true')
    await user.click(screen.getByRole('button', { name: t('action.undo') }))
    expect(count()).toBe(t('pane.problems'))
  })
})
