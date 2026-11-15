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
import {
  BUILDER_SCENARIOS,
  createReportEditor,
  EDITOR_PANELS,
  editorText,
  REPORT_ATTRIBUTES,
  REPORT_PARTS,
  scenarioReport,
  WORKBENCH_CLASSES,
} from '@formancy/report-builder-core'
import { emptyReport } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { screen, within } from '@testing-library/angular'
import { computeAccessibleDescription } from 'dom-accessibility-api'
import { afterEach, describe, expect, test } from 'vitest'
import { mountBuilder, mountWithHostView } from './test-mount'
import { sessionOver } from './test-support'
import { choose, click, fill } from './test-user'

afterEach(() => {
  TestBed.resetTestingModule()
})

/**
 * The scenario report with what the rarer hooks need: a condition on a
 * parameter nobody declared (a diagnostic, and its badge), a rectangle
 * wider than the column it stands in (an overflow), and a payment part (its
 * band), the one a scenario's report has.
 */
function everythingReport(): ReportDefinition {
  const report = scenarioReport()
  const paymentPart = BUILDER_SCENARIOS.map((scenario) => scenario.report().paymentPart).find((bill) => bill !== undefined)
  if (paymentPart === undefined) throw new Error('no scenario has a report with a payment part')
  const body = report.regions.body.map((component) => (component.id === 'intro' ? { ...component, visibleWhen: { cel: 'params.missing' } } : component))
  return {
    ...report,
    paymentPart,
    regions: {
      ...report.regions,
      body: [
        ...body,
        {
          id: 'side',
          kind: 'columns',
          columns: [
            { width: 100, components: [{ id: 'wide', kind: 'rectangle', width: 150, height: 20 }] },
            { width: 'fill', components: [] },
          ],
        },
      ],
    },
  }
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
  within(screen.getByRole('dialog', { name: 'Move Spacer: choose a place' }))
    .getAllByRole('button')[0]
    ?.focus()
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

/**
 * The hooks of the builder with the host's view in the design view's place:
 * the one part no other state draws, as the design view's are the parts it
 * does not.
 */
async function hostHooks(): Promise<Set<string | null>> {
  TestBed.resetTestingModule()
  const editor = createReportEditor(sessionOver(scenarioReport()), { hostView: { name: 'Preview', shown: true } })
  const mounted = await mountWithHostView(editor, 'Download PDF')
  const root = mounted.fixture.nativeElement as HTMLElement
  return new Set([...root.querySelectorAll('[data-report-part]')].map((element) => element.getAttribute('data-report-part')))
}

/**
 * The hooks, and the states, of the builder over a report written in a
 * second language with none of its words yet, showing that language with
 * a text selected (0063): the switch in the bar, the boxes marked missing,
 * and the text's field marked, with its note.
 */
async function languageHooks(): Promise<{ readonly parts: Set<string | null>; readonly states: Set<string> }> {
  TestBed.resetTestingModule()
  const report: ReportDefinition = { ...scenarioReport(), translations: [{ locale: 'fr-CH', words: [], expressions: [] }] }
  const mounted = await mountBuilder(createReportEditor(sessionOver(report)))
  choose(screen.getByRole('combobox', { name: 'Edited language' }), 'French (Switzerland), words missing: 4')
  await mounted.settle()
  click(screen.getByRole('treeitem', { name: 'Introduction' }))
  await mounted.settle()
  const root = mounted.fixture.nativeElement as HTMLElement
  // The field and the box of the word not written yet, each marked: the stylesheet dresses both (0063).
  expect(root.querySelector('[data-report-part="property"][data-missing="true"] textarea')).not.toBeNull()
  expect(root.querySelector('[data-report-part="box"][data-missing="true"]')).not.toBeNull()
  const elements = [root, ...root.querySelectorAll('*')]
  return {
    parts: new Set(elements.filter((element) => element.hasAttribute('data-report-part')).map((element) => element.getAttribute('data-report-part'))),
    states: new Set(elements.flatMap((element) => element.getAttributeNames().filter((name) => name.startsWith('data-')))),
  }
}

/** The data attributes of the root of a builder whose outline the person hid. */
async function hiddenRoot(): Promise<string[]> {
  TestBed.resetTestingModule()
  const mounted = await mountBuilder(createReportEditor(sessionOver(scenarioReport())))
  click(screen.getByRole('button', { name: 'Hide Outline' }))
  await mounted.settle()
  const root = mounted.fixture.nativeElement as HTMLElement
  expect(root.getAttribute('data-hidden')).toBe('outline')
  return root.getAttributeNames().filter((name) => name.startsWith('data-'))
}

describe('the stylesheet’s hooks', () => {
  // A part report-builder.css dresses that this builder does not render is
  // a piece drawn unstyled here and styled in React; a part it renders that
  // the list does not have is one the stylesheet's own test does not know.
  test('are every part report-builder-core lists, and no other', async () => {
    const root = await everything()
    const rendered = new Set([root, ...root.querySelectorAll('[data-report-part]')].map((element) => element.getAttribute('data-report-part')))
    expect(rendered.has('outline-empty')).toBe(false)
    expect(rendered.has('view')).toBe(false)
    for (const part of await emptyHooks()) rendered.add(part)
    // The host's view and the design view are never drawn together.
    const host = await hostHooks()
    expect(host.has('view')).toBe(true)
    expect(host.has('canvas')).toBe(false)
    for (const part of host) rendered.add(part)
    // The switch between languages, and a field's note, are drawn only for a report written in more than one.
    const languages = await languageHooks()
    expect(rendered.has('language')).toBe(false)
    for (const part of languages.parts) rendered.add(part)
    expect(rendered).toEqual(new Set(REPORT_PARTS))
  })

  // A state set under a name the stylesheet does not select by -- a
  // `data-active` where it reads `data-selected` -- draws nothing.
  test('set only the states the stylesheet selects by, and all of them', async () => {
    const root = await everything()
    const used = new Set([root, ...root.querySelectorAll('*')].flatMap((element) => element.getAttributeNames().filter((name) => name.startsWith('data-'))))
    // The panes the person hid are on the root, which `everything` has none of.
    for (const name of await hiddenRoot()) used.add(name)
    // A word missing in the language edited is marked only in a report written in more than one.
    for (const name of (await languageHooks()).states) used.add(name)
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

describe('a payment part’s band in another language', () => {
  // A QR-bill's message is a word too, printed on the slip: its band is
  // marked by `data-missing` and described as missing as a box is, and a
  // builder that left either off would draw the slip in the French view
  // as though its message were French (0063). The mark read from the DOM,
  // as the stylesheet reads it; the description as assistive technology
  // computes it.
  test('is marked missing, described so, and no longer once its message is written', async () => {
    const t = editorText('en')
    const paymentPart = BUILDER_SCENARIOS.map((scenario) => scenario.report().paymentPart).find((bill) => bill !== undefined)
    if (paymentPart === undefined) throw new Error('no scenario has a report with a payment part')
    const report: ReportDefinition = { ...scenarioReport(), paymentPart, translations: [{ locale: 'fr-CH', words: [], expressions: [] }] }
    const mounted = await mountBuilder(createReportEditor(sessionOver(report)))
    const band = (): HTMLElement => screen.getByRole('img', { name: t('canvas.paymentPart') })
    expect(band().hasAttribute('data-missing')).toBe(false)
    expect(computeAccessibleDescription(band())).toBe('')
    const switcher = screen.getByRole<HTMLSelectElement>('combobox', { name: t('language.label') })
    const french = [...switcher.options].find((option) => option.value === 'fr-CH')
    choose(switcher, french?.text ?? 'fr-CH')
    await mounted.settle()
    expect(band().getAttribute('data-missing')).toBe('true')
    expect(computeAccessibleDescription(band())).toBe(t('canvas.missing', { language: 'French (Switzerland)' }))
    click(band())
    await mounted.settle()
    fill(screen.getByRole('textbox', { name: t('field.message') }), 'Visite')
    await mounted.settle()
    expect(band().hasAttribute('data-missing')).toBe(false)
    expect(computeAccessibleDescription(band())).toBe('')
  })
})
