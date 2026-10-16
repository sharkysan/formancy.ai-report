/**
 * The hooks report-builder-core's stylesheet dresses the editor by: one
 * `data-report-part` per piece, the `data-*` states on them, and the
 * workbench's shell classes. Both builders render the same ones, from the
 * same lists, so one stylesheet dresses both identically (parts.ts).
 *
 * This reads the rendered hooks as a stylesheet does -- every element that
 * has one -- rather than finding an element to act on, which is done by
 * role and accessible name everywhere else.
 */
import { TestBed } from '@angular/core/testing'
import { createReportEditor, EDITOR_PANELS, REPORT_ATTRIBUTES, REPORT_PARTS, scenarioReport, WORKBENCH_CLASSES } from '@formancy/report-builder-core'
import { emptyReport } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { screen, within } from '@testing-library/angular'
import { afterEach, describe, expect, test } from 'vitest'
import { mountBuilder } from './test-mount'
import { sessionOver } from './test-support'
import { click, fill } from './test-user'

afterEach(() => {
  TestBed.resetTestingModule()
})

/**
 * The scenario report with what the rarer hooks need: a condition on a
 * parameter nobody declared (a diagnostic, and its badge) and a rectangle
 * wider than the column it stands in (an overflow).
 */
function everythingReport(): ReportDefinition {
  const report = scenarioReport()
  const body = report.regions.body.map((component) => (component.id === 'intro' ? { ...component, visibleWhen: { cel: 'params.missing' } } : component))
  return { ...report, regions: { ...report.regions, body: [...body, { id: 'side', kind: 'columns', columns: [{ width: 100, components: [{ id: 'wide', kind: 'rectangle', width: 150, height: 20 }] }, { width: 'fill', components: [] }] }] } }
}

/** The builder showing every hook at once: a refused field, a move being placed by keyboard, a place pointed at, a problem. */
async function everything(): Promise<HTMLElement> {
  const mounted = await mountBuilder(createReportEditor(sessionOver(everythingReport())))
  click(screen.getByRole('treeitem', { name: 'Spacer' }))
  await mounted.settle()
  fill(screen.getByRole('spinbutton', { name: 'Height (mm)' }), '400')
  await mounted.settle()
  click(screen.getByRole('button', { name: 'Move to…' }))
  await mounted.settle()
  within(screen.getByRole('dialog', { name: 'Move Spacer: choose a place' })).getAllByRole('button')[0]?.focus()
  await mounted.settle()
  return mounted.fixture.nativeElement as HTMLElement
}

/** The hooks of the builder over a report with nothing in it: the sentence beside an empty outline, which a report with rows never shows. */
async function emptyHooks(): Promise<Set<string | null>> {
  TestBed.resetTestingModule()
  const mounted = await mountBuilder(createReportEditor(sessionOver(emptyReport('blank', 'Blank', 'en'))))
  const root = mounted.fixture.nativeElement as HTMLElement
  return new Set([...root.querySelectorAll('[data-report-part]')].map((element) => element.getAttribute('data-report-part')))
}

describe('the stylesheet’s hooks', () => {
  // A part report-builder.css dresses that this builder does not render is
  // a piece drawn unstyled here and styled in React; a part it renders that
  // the list does not have is one the stylesheet's own test does not know.
  test('are every part report-builder-core lists, and no other', async () => {
    const root = await everything()
    const rendered = new Set([root, ...root.querySelectorAll('[data-report-part]')].map((element) => element.getAttribute('data-report-part')))
    expect(rendered.has('outline-empty')).toBe(false)
    for (const part of await emptyHooks()) rendered.add(part)
    expect(rendered).toEqual(new Set(REPORT_PARTS))
  })

  // A state set under a name the stylesheet does not select by -- a
  // `data-active` where it reads `data-selected` -- draws nothing.
  test('set only the states the stylesheet selects by, and all of them', async () => {
    const root = await everything()
    const used = new Set([root, ...root.querySelectorAll('*')].flatMap((element) => element.getAttributeNames().filter((name) => name.startsWith('data-'))))
    const listed = REPORT_ATTRIBUTES.filter((name) => name.startsWith('data-'))
    expect(used).toEqual(new Set(listed))
  })

  // The panes are the workbench's, recoloured only through its variables;
  // a class of this builder's own would be one the React builder does not
  // have, and the narrow layout finds each pane by data-pane: every panel
  // the editor can show has one.
  test('use the workbench’s classes and no others, with a pane for each of the editor’s panels', async () => {
    const root = await everything()
    const classes = new Set([root, ...root.querySelectorAll('[class]')].flatMap((element) => [...element.classList]))
    expect(classes).toEqual(new Set(Object.values(WORKBENCH_CLASSES)))
    expect(new Set([...root.querySelectorAll('[data-pane]')].map((pane) => pane.getAttribute('data-pane')))).toEqual(new Set(EDITOR_PANELS))
    expect(root.getAttribute('data-panel')).toBe('outline')
  })
})
