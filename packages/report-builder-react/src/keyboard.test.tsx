/**
 * The keyboard and focus, beyond what the shared scenarios ask: the
 * toolbar's one tab stop, a tool with nothing to act on, the place dialog's
 * way out, the panes a narrow screen switches between, and the live region.
 */
import { createReportEditor, editorText, scenarioReport } from '@formancy/report-builder-core'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { computeAccessibleDescription } from 'dom-accessibility-api'
import { afterEach, describe, expect, test } from 'vitest'
import { Places } from './places.js'
import { ReportBuilder } from './report-builder.js'
import { mount, sessionOver } from './test-support.js'

afterEach(cleanup)

const t = editorText('en')
const button = (name: string): HTMLElement => screen.getByRole('button', { name })
const status = (): HTMLElement => screen.getByRole('status', { name: '' })

describe('the toolbar', () => {
  // Fifteen tools as fifteen tab stops would stand between a keyboard and
  // the outline every time; the ARIA toolbar is one stop, walked with the
  // arrows, wrapping at the ends.
  test('is one tab stop, walked with the arrow keys', async () => {
    const { user } = mount(scenarioReport())
    await user.tab()
    expect(document.activeElement).toBe(button(t('action.undo')))
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(button(t('action.redo')))
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(document.activeElement).toBe(button(t('pane.problems')))
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(button(t('action.undo')))
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(button(t('pane.problems')))
    await user.tab()
    expect(document.activeElement).toBe(button(t('kind.text')))
  })

  // An arrow held with Ctrl, Alt or Cmd is the browser's or the screen
  // reader's -- a word jump, a reading command -- and the toolbar leaves it
  // alone, as the Angular builder's does.
  test('leaves an arrow with a modifier to the browser', async () => {
    const { user } = mount(scenarioReport())
    await user.tab()
    await user.keyboard('{Control>}{ArrowRight}{/Control}')
    expect(document.activeElement).toBe(button(t('action.undo')))
    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    expect(document.activeElement).toBe(button(t('action.undo')))
  })

  // A zoom tool at the end of the range is marked unavailable, from the
  // editor's own answer, and still says why when pressed.
  test('marks a zoom tool unavailable at the end of its range', async () => {
    const { user } = mount(scenarioReport())
    expect(button(t('action.zoomReset')).getAttribute('aria-disabled')).toBe('true')
    for (let step = 0; step < 4; step += 1) await user.click(button(t('action.zoomOut')))
    expect(button(t('action.zoomOut')).getAttribute('aria-disabled')).toBe('true')
    expect(button(t('action.zoomReset')).getAttribute('aria-disabled')).toBeNull()
  })

  // In a right-to-left page the next tool is to the left, and → goes back.
  test('steps the way the page reads', async () => {
    const user = userEvent.setup()
    render(
      <div dir="rtl">
        <ReportBuilder editor={createReportEditor(sessionOver(scenarioReport()))} />
      </div>,
    )
    await user.tab()
    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(button(t('action.redo')))
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(button(t('action.undo')))
  })

  // A disabled button loses focus the moment it is pressed for the last
  // time, and pressing it says nothing. Undo with nothing to undo stays where
  // the person is, and says so in the live region.
  test('keeps an unavailable tool focusable, and says why it did nothing', async () => {
    const { user } = mount(scenarioReport())
    const undo = button(t('action.undo'))
    expect(undo.getAttribute('aria-disabled')).toBe('true')
    act(() => undo.focus())
    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(undo)
    expect(status().textContent).toBe(t('status.nothingToUndo'))
  })

  // The same words said twice are two announcements: a live region whose
  // text did not change says nothing the second time.
  test('announces the same words twice as two announcements', async () => {
    const { user } = mount(scenarioReport())
    const added: string[] = []
    new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) added.push(node.textContent ?? '')
    }).observe(status(), { childList: true, subtree: true })
    await user.click(button(t('action.undo')))
    await user.click(button(t('action.undo')))
    await waitFor(() => expect(added).toEqual([t('status.nothingToUndo'), t('status.nothingToUndo')]))
  })

  // Undo says what it would take back, as its description, so a person
  // knows before pressing it.
  test('describes what undo would take back', async () => {
    const { user } = mount(scenarioReport())
    await user.click(screen.getByRole('treeitem', { name: t('kind.spacer') }))
    await user.keyboard('{Delete}')
    expect(computeAccessibleDescription(button(t('action.undo')))).toBe(t('action.undoWhat', { label: t('history.delete', { kind: t('kind.spacer') }) }))
  })
})

describe('the place dialog', () => {
  // Leaving a dialog with Escape or Cancel puts the person back where they
  // were, on the palette entry they opened it from, and inserts nothing.
  test('closes with Escape or Cancel, focus back on what opened it', async () => {
    const mounted = mount(scenarioReport())
    const { user } = mounted
    const dialog = t('places.insert', { kind: t('kind.text') })
    await user.click(button(t('kind.text')))
    expect(screen.getByRole('dialog', { name: dialog })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: dialog })).toBeNull()
    expect(document.activeElement).toBe(button(t('kind.text')))

    await user.keyboard('{Enter}')
    await user.click(button(t('places.cancel')))
    expect(screen.queryByRole('dialog', { name: dialog })).toBeNull()
    expect(document.activeElement).toBe(button(t('kind.text')))
    expect(mounted.session.canUndo()).toBe(false)
  })

  // The dialog floats over the outline pane, leaving the canvas and its
  // marked place in view; on a narrow screen that pane is the one shown, so
  // the dialog opened from the design view is not drawn in a hidden pane.
  test('shows the outline pane, which it floats over', async () => {
    const { user } = mount(scenarioReport())
    const editor = screen.getByRole('region', { name: t('editor.label') })
    await user.click(button(t('pane.canvas')))
    expect(editor.getAttribute('data-panel')).toBe('canvas')
    await user.click(screen.getByRole('treeitem', { name: 'Findings' }))
    await user.click(button(t('action.moveTo')))
    expect(editor.getAttribute('data-panel')).toBe('outline')
  })

  // The place a keyboard is on is the one the canvas marks, so a sighted
  // keyboard user sees where a choice lands before making it.
  test('marks on the canvas the place that has focus', async () => {
    const { user } = mount(scenarioReport())
    await user.click(button(t('kind.text')))
    const after = t('target.after', { where: t('region.body'), name: 'Introduction' })
    act(() => button(after).focus())
    expect(screen.getByRole('img', { name: after }).getAttribute('data-over')).toBe('true')
    await user.keyboard('{Tab}')
    expect(screen.getByRole('img', { name: after }).getAttribute('data-over')).toBeNull()
  })

  // A dialog with no place in it says so, and leaves the keyboard on its
  // one way out rather than on nothing: the builder that opens it focuses
  // its first button, which is then Cancel. No report reached here has a
  // component with nowhere else to go, so the dialog is drawn over a state
  // that says so, and holds what the builder's focus lands on.
  test('with nowhere to go says so, Cancel its first button', () => {
    const state = createReportEditor(sessionOver(scenarioReport())).state()
    const drag = { subject: { id: 'gap' }, via: 'keyboard', over: null, title: t('places.move', { name: t('kind.spacer') }), nowhere: t('places.none', { name: t('kind.spacer') }) } as const
    render(<Places state={{ ...state, drag, dropTargets: [] }} drag={drag} t={t} ids="places" act={() => undefined} choose={() => undefined} cancel={() => undefined} />)
    const dialog = screen.getByRole('dialog', { name: drag.title })
    expect(computeAccessibleDescription(dialog)).toBe(drag.nowhere)
    expect(dialog.querySelector('button')).toBe(button(t('places.cancel')))
  })

  // An entry the report cannot hold yet is found, said to be unavailable,
  // described by what to declare first, and opens nothing.
  test('is not opened for a kind the report cannot hold, which says why', async () => {
    const { user } = mount(scenarioReport())
    const image = button(t('kind.image'))
    expect(image.getAttribute('aria-disabled')).toBe('true')
    expect(computeAccessibleDescription(image)).toBe(t('palette.needsImage'))
    await user.click(image)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(status().textContent).toBe(t('palette.needsImage'))
  })
})

describe('the outline', () => {
  // Focus and selection are one in the tree: tabbing or moving focus to a
  // row selects it, so the properties beside it are always the focused
  // row's.
  test('selects the row focus moves to', () => {
    mount(scenarioReport())
    const row = screen.getByRole('treeitem', { name: 'Findings', selected: false })
    act(() => row.focus())
    expect(screen.getByRole('treeitem', { name: 'Findings', selected: true })).toBe(row)
    expect(screen.getByRole('form', { name: `${t('kind.text')}: Findings` })).toBeTruthy()
  })

  // A report with nothing in it is still one tab stop away: the tree
  // itself, so the keyboard learns there is nothing rather than skipping it.
  test('is a tab stop with no rows', async () => {
    const report = scenarioReport()
    const { user, editor } = mount({ ...report, styles: [], regions: { ...report.regions, body: [] } })
    const tree = screen.getByRole('tree', { name: t('pane.outline') })
    act(() => button(editor.state().palette.at(-1)?.label ?? '').focus())
    await user.tab()
    expect(document.activeElement).toBe(tree)
    await user.click(button(t('pane.canvas')))
    await user.click(button(t('pane.outline')))
    expect(document.activeElement).toBe(tree)
  })

  // Following a problem about what is already selected changes nothing in
  // the editor, and still takes the keyboard to its row; one about a table's
  // column takes it to the column's row.
  test('takes focus to the row a problem is about, already selected or not', async () => {
    const report = scenarioReport()
    const { user } = mount({
      ...report,
      datasets: { detail: { id: 'lines', fields: [{ id: 'sku', type: 'string', label: 'SKU', nullable: false }] } },
      regions: {
        ...report.regions,
        body: report.regions.body.map((component) => (component.id === 'intro' ? { ...component, visibleWhen: { cel: 'params.missing' } } : component)),
        summary: [{ id: 'lines', kind: 'table', dataset: 'detail', columns: [{ id: 'sku', header: 'Article', width: 'fill', align: 'left', value: { kind: 'expression', expression: { cel: 'params.missing' } } }], emptyText: 'None.', repeatHeader: true }],
      },
    })
    await user.click(screen.getByRole('treeitem', { name: 'Introduction' }))
    await user.click(button(t('problem.item', { severity: t('severity.error'), where: 'Introduction' })))
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Introduction', selected: true }))
    await user.click(button(t('problem.item', { severity: t('severity.error'), where: 'Article' })))
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Article', selected: true }))
  })
})

describe('the panes', () => {
  // On a narrow screen report-builder.css shows the one pane the editor's
  // `panel` names; each pane's button names it, and takes focus into it, so
  // the pane that appears is where the keyboard is.
  test('are shown and entered from the toolbar', async () => {
    const report = scenarioReport()
    const { user } = mount({ ...report, regions: { ...report.regions, body: report.regions.body.map((component) => (component.id === 'intro' ? { ...component, visibleWhen: { cel: 'params.missing' } } : component)) } })
    const editor = screen.getByRole('region', { name: t('editor.label') })
    expect(editor.getAttribute('data-panel')).toBe('outline')

    await user.click(button(t('pane.properties')))
    expect(editor.getAttribute('data-panel')).toBe('properties')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: t('field.title') }))

    await user.click(button(t('pane.problems')))
    expect(editor.getAttribute('data-panel')).toBe('diagnostics')
    expect(document.activeElement).toBe(screen.getByRole('list', { name: t('pane.problems') }))

    await user.click(button(t('pane.canvas')))
    expect(document.activeElement).toBe(screen.getByRole('region', { name: t('canvas.label') }))

    await user.click(button(t('pane.outline')))
    expect(editor.getAttribute('data-panel')).toBe('outline')
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Findings' }))
  })
})
