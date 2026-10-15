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
 */
import { TestBed } from '@angular/core/testing'
import { createReportEditor } from '@formancy/report-builder-core'
import { screen, within } from '@testing-library/angular'
import axe from 'axe-core'
import { computeAccessibleName } from 'dom-accessibility-api'
import { afterEach, describe, expect, test } from 'vitest'
import { mountBuilder, mountScenarioBuilder } from './test-mount'
import { audit, richSession } from './test-support'
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
