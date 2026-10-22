/**
 * The builder's accessible tree, beyond what axe's WCAG rules decide: every
 * element a person operates or reads is named, the editor is a landmark of
 * its own, the design view's boxes and places are pictures named as the
 * outline and the place chooser name them, and the tree says where each row
 * stands among its siblings. The React builder exposes the same; these are
 * the states the review found the two builders differing in.
 *
 * Two checks, because neither alone is enough: axe finds what it is sure
 * of, and says nothing of a control named by an empty string when the
 * markup gives it a way to be named; so every element with a role a person
 * operates or reads is also asked its name.
 *
 * Where a test reads the DOM it says why, as these do: how a name is
 * given, which jsdom's names cannot show, because jsdom applies no
 * stylesheet and Chromium puts one's text-transform into a name taken from
 * text on the page; where each row stands among its siblings, its level, place and
 * set size; and a QR-bill's row and its groups of fields (0039) -- that a
 * group's name is its own and not `aria-labelledby`'s, that the drawn name
 * is hidden from the tree, found by its `aria-hidden` ancestor, and the
 * row's level and the role of what holds it -- none of which a query by
 * role and name returns.
 */
import { TestBed } from '@angular/core/testing'
import { BUILDER_SCENARIOS, createReportEditor, scenarioReport } from '@formancy/report-builder-core'
import { screen, within } from '@testing-library/angular'
import axe from 'axe-core'
import { computeAccessibleName } from 'dom-accessibility-api'
import { afterEach, describe, expect, test } from 'vitest'
import { mountBuilder, mountScenarioBuilder } from './test-mount'
import { audit, richSession, sessionOver } from './test-support'
import { click } from './test-user'

afterEach(() => {
  TestBed.resetTestingModule()
})

/** The roles a person operates or reads by name. A status is left out on purpose: the live region says whole sentences, and needs no name to explain them. */
const NAMED = ['button', 'textbox', 'spinbutton', 'combobox', 'checkbox', 'treeitem', 'tree', 'group', 'img', 'list', 'form', 'region', 'dialog']

function unnamed(): string[] {
  return NAMED.flatMap((role) => screen.queryAllByRole(role).filter((element) => computeAccessibleName(element).trim() === '').map((element) => `${role}: ${element.outerHTML.slice(0, 80)}`))
}

/** axe's landmark rule: content outside every landmark is content a screen reader's landmark list cannot reach. */
async function outsideLandmarks(): Promise<string[]> {
  const results = await axe.run(document.body, { runOnly: { type: 'rule', values: ['region'] }, resultTypes: ['violations'] })
  return results.violations.flatMap((violation) => violation.nodes.map((node) => node.html))
}

describe('the accessible tree', () => {
  // The editor as a region named "Report editor", as React's is: unnamed and
  // without a role, everything in it stood outside every landmark, and a
  // screen reader's list of landmarks did not have the editor in it.
  test('is one landmark named for the editor, with everything inside it', async () => {
    await mountScenarioBuilder()
    const editor = screen.getByRole('region', { name: 'Report editor' })
    expect(within(editor).getByRole('toolbar', { name: 'Report tools' })).toBeTruthy()
    expect(await outsideLandmarks()).toEqual([])
    expect(unnamed()).toEqual([])
  })

  // A box is a picture of where a component stands, named by its label, so
  // reading the design view says what is on it; the places a drag may go are
  // pictures named as the chooser names them, the one in focus marked.
  test('pictures each box and each place by its name', async () => {
    const { settle } = await mountScenarioBuilder()
    const design = screen.getByRole('region', { name: 'Design view, not the PDF' })
    expect(within(design).getAllByRole('img').map((element) => computeAccessibleName(element))).toEqual(
      expect.arrayContaining(['Findings', 'Introduction', 'Section', 'Note', 'Spacer', 'Horizontal ruler in millimetres']),
    )
    click(screen.getByRole('treeitem', { name: 'Note' }))
    await settle()
    click(screen.getByRole('button', { name: 'Move to…' }))
    await settle()
    const place = within(screen.getByRole('dialog', { name: 'Move Note: choose a place' })).getAllByRole('button')[0] as HTMLElement
    expect(within(design).getByRole('img', { name: place.textContent ?? '' }).getAttribute('data-over')).toBe('true')
    expect(unnamed()).toEqual([])
    expect(await audit()).toEqual([])
    expect(await outsideLandmarks()).toEqual([])
  })

  // "Item 2 of 4" is how a screen reader says where a row stands; without
  // it, a flat tree reads as one list of every row in the report.
  test('says where each row stands among its siblings', async () => {
    await mountScenarioBuilder()
    const rows = within(screen.getByRole('group', { name: 'Body' })).getAllByRole('treeitem')
    expect(rows.map((row) => [row.textContent, row.getAttribute('aria-level'), row.getAttribute('aria-posinset'), row.getAttribute('aria-setsize')])).toEqual([
      ['Findings', '1', '1', '4'],
      ['Introduction', '1', '2', '4'],
      ['Section', '1', '3', '4'],
      ['Note', '2', '1', '1'],
      ['Spacer', '1', '4', '4'],
    ])
  })

  // An entry the report cannot hold yet is found, said to be unavailable,
  // and described by what to declare first, as React's is.
  test('marks a palette entry the report cannot hold yet unavailable', async () => {
    await mountScenarioBuilder()
    expect(screen.getByRole('button', { name: 'Image' }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('button', { name: 'Text' }).getAttribute('aria-disabled')).toBeNull()
  })

  // Chromium puts a stylesheet's text-transform into a name it takes from
  // text on the page: the Studio sets a pane's heading in capitals, so the
  // problems' count, named by aria-labelledby after its heading, was
  // "PROBLEMS" in Chromium, in this builder and in React's alike -- the
  // browser gate's reading of Chromium's tree found it, where the two
  // builders' trees were compared. jsdom applies no stylesheet, so its names
  // read the same however they are given: this reads from the DOM how each
  // is, with the place chooser, which was named after its header too, open.
  test('names its groups, form, list, statuses and dialog in its own words, never by another element’s text', async () => {
    const report = scenarioReport()
    const { editor, settle } = await mountBuilder(createReportEditor(sessionOver({ ...report, regions: { ...report.regions, body: report.regions.body.map((component) => (component.id === 'intro' ? { ...component, visibleWhen: { cel: 'params.missing' } } : component)) } })))
    click(screen.getByRole('treeitem', { name: 'Note' }))
    await settle()
    click(screen.getByRole('button', { name: 'Move to…' }))
    await settle()
    const { outline, properties } = editor.state()
    const named = [
      ...outline.map((region) => ({ role: 'group', name: region.label })),
      { role: 'form', name: properties.heading },
      { role: 'list', name: 'Problems' },
      { role: 'status', name: 'Problems' },
      { role: 'dialog', name: 'Move Note: choose a place' },
    ]
    for (const { role, name } of named) expect(screen.getByRole(role, { name }), `${role} ${name}`).toBeTruthy()
    const builder = screen.getByRole('region', { name: 'Report editor' })
    expect([...builder.querySelectorAll('[aria-labelledby]')].map((element) => element.outerHTML.slice(0, 80))).toEqual([])
  })

  // A QR-bill's parties are groups of fields (0039), named as the outline's
  // regions are: in the editor's words, the name drawn above the fields
  // and hidden from the tree, which would read it a second time among the
  // fields. Its row in the outline is a row at the tree's top, after the
  // regions' groups, and the debtor's button names what it does.
  test('names a QR-bill’s row and each group of its fields in its own words, the name drawn hidden', async () => {
    const billed = BUILDER_SCENARIOS.map((scenario) => scenario.report()).find((report) => report.paymentPart !== undefined)
    if (billed === undefined) throw new Error('no scenario has a report with a payment part')
    const { editor, settle } = await mountBuilder(createReportEditor(sessionOver(billed)))
    click(screen.getByRole('treeitem', { name: 'Payment part' }))
    await settle()
    const groups = editor.state().properties.rows.flatMap((row) => ('group' in row ? [row.group] : []))
    expect(groups.map((group) => group.label)).toEqual(['Creditor', 'Debtor'])
    for (const group of groups) {
      const drawn = screen.getByRole('group', { name: group.label })
      expect(drawn.hasAttribute('aria-labelledby'), group.label).toBe(false)
      expect(within(drawn).queryAllByText(group.label).filter((element) => element.closest('[aria-hidden="true"]') === null), group.label).toEqual([])
    }
    expect(within(screen.getByRole('group', { name: 'Debtor' })).getByRole('button', { name: 'Add debtor' })).toBeTruthy()
    const row = screen.getByRole('treeitem', { name: 'Payment part', selected: true })
    expect([row.getAttribute('aria-level'), row.parentElement?.getAttribute('role')]).toEqual(['1', 'tree'])
    expect(await audit()).toEqual([])
  })

  // Every row of a report holding every kind, named and audited with a
  // landmark around it, in one walk: the states the scenarios never reach.
  test('names every part with each row of every kind selected', async () => {
    const { settle } = await mountBuilder(createReportEditor(richSession()))
    for (const row of screen.getAllByRole('treeitem')) {
      click(row)
      await settle()
      expect(unnamed(), row.textContent ?? '').toEqual([])
    }
    expect(await outsideLandmarks()).toEqual([])
  }, 60_000)
})
