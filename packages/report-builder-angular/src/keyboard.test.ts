/**
 * The keyboard, beyond what the scenarios walk: the place chooser's way out,
 * the toolbar as one tab stop, the panes a narrow screen switches between,
 * the outline as one tab stop, a text field's own keys, and the live region
 * saying the same words twice. Found by role and accessible name.
 */
import { TestBed } from '@angular/core/testing'
import { createReportEditor, scenarioReport } from '@formancy/report-builder-core'
import { fireEvent, screen, within } from '@testing-library/angular'
import { afterEach, describe, expect, test } from 'vitest'
import { mountBuilder, mountScenarioBuilder } from './test-mount'
import { sessionOver } from './test-support'
import { click, press } from './test-user'

afterEach(() => {
  TestBed.resetTestingModule()
})

const button = (name: string): HTMLElement => screen.getByRole('button', { name })
const dialog = (name: string): HTMLElement | null => screen.queryByRole('dialog', { name })
const announced = (): string => screen.getByRole('status', { name: '' }).textContent ?? ''

describe('the place chooser', () => {
  // A chooser that kept focus where it opened would leave a keyboard user
  // tabbing through the whole editor to reach a place; one that dropped
  // focus on cancelling would leave them at the top of the page.
  test('takes focus when it opens, and gives it back to what opened it on Escape', async () => {
    const { settle } = await mountScenarioBuilder()
    const text = button('Text')
    text.focus()
    press('Enter')
    await settle()
    const chooser = dialog('Insert Text: choose a place')
    expect(chooser).not.toBeNull()
    expect(document.activeElement).toBe(within(chooser as HTMLElement).getAllByRole('button')[0])
    press('Escape')
    await settle()
    expect(dialog('Insert Text: choose a place')).toBeNull()
    expect(document.activeElement).toBe(text)
    expect(announced()).toBe('Nothing was moved.')
  })

  // Cancel is the pointer's way out, and lands where Escape does.
  test('gives focus back to Move to… when cancelled with its button', async () => {
    const { settle } = await mountScenarioBuilder()
    click(screen.getByRole('treeitem', { name: 'Findings' }))
    await settle()
    const moveTo = button('Move to…')
    click(moveTo)
    await settle()
    click(within(dialog('Move Findings: choose a place') as HTMLElement).getByRole('button', { name: 'Cancel' }))
    await settle()
    expect(dialog('Move Findings: choose a place')).toBeNull()
    expect(document.activeElement).toBe(moveTo)
  })
})

describe('the toolbar', () => {
  // Twelve buttons that are twelve tab stops are twelve presses of Tab
  // between the outline and the canvas; the toolbar pattern makes them one,
  // with the arrows between them.
  test('is one tab stop, with the arrow keys, Home and End between its buttons', async () => {
    await mountScenarioBuilder()
    const toolbar = screen.getByRole('toolbar', { name: 'Report tools' })
    const buttons = within(toolbar).getAllByRole('button')
    expect(buttons.filter((candidate) => candidate.tabIndex === 0)).toEqual([button('Undo')])
    button('Undo').focus()
    press('ArrowRight')
    expect(document.activeElement).toBe(button('Redo'))
    press('ArrowLeft')
    press('ArrowLeft')
    expect(document.activeElement).toBe(button('Problems'))
    press('Home')
    expect(document.activeElement).toBe(button('Undo'))
    press('End')
    expect(document.activeElement).toBe(button('Problems'))
    // With a modifier, an arrow is the browser's or the screen reader's.
    press('ArrowRight', ['Control'])
    expect(document.activeElement).toBe(button('Problems'))
  })

  // In a right-to-left page the next tool is to the left, and → goes back,
  // as the React builder's toolbar steps.
  test('steps the way the page reads', async () => {
    await mountScenarioBuilder()
    const page = screen.getByRole('region', { name: 'Report editor' })
    page.setAttribute('dir', 'rtl')
    button('Undo').focus()
    press('ArrowLeft')
    expect(document.activeElement).toBe(button('Redo'))
    press('ArrowRight')
    expect(document.activeElement).toBe(button('Undo'))
  })

  // A disabled button drops focus to the page when it becomes disabled
  // under the keyboard -- Redo pressed until there is nothing to redo --
  // and the next Ctrl+Z reaches nothing. aria-disabled says the same and
  // keeps focus; pressed, it still asks the editor, which says why nothing
  // happened, as it does in the React builder.
  test('marks what has nowhere to go aria-disabled, keeps it focusable, and says why it did nothing', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    const undo = button('Undo')
    expect(undo.getAttribute('aria-disabled')).toBe('true')
    undo.focus()
    press('Enter')
    await settle()
    expect(document.activeElement).toBe(undo)
    expect(announced()).toBe('Nothing to undo.')
    expect(editor.state().history.canUndo).toBe(false)
    click(button('Delete'))
    await settle()
    expect(announced()).toBe('Nothing is selected.')
  })

  // A zoom tool at the end of its range is marked as React marks it, from
  // the editor's own answer.
  test('marks a zoom tool unavailable at the end of its range', async () => {
    const { settle } = await mountScenarioBuilder()
    expect(button('Actual size').getAttribute('aria-disabled')).toBe('true')
    for (let step = 0; step < 4; step += 1) {
      click(button('Zoom out'))
      await settle()
    }
    expect(button('Zoom out').getAttribute('aria-disabled')).toBe('true')
    expect(button('Actual size').getAttribute('aria-disabled')).toBeNull()
  })
})

describe('the panes', () => {
  // On a narrow screen report-builder.css shows the one pane the editor's
  // `panel` names. The toolbar stands in no pane, so it is always there to
  // switch them; each pane's button names it, and takes focus into it, so
  // the pane that appears is where the keyboard is. Without them a narrow
  // screen showed the outline and nothing else, ever.
  test('are shown and entered from the toolbar', async () => {
    const report = scenarioReport()
    const { settle } = await mountBuilder(
      createReportEditor(
        sessionOver({
          ...report,
          regions: {
            ...report.regions,
            body: report.regions.body.map((component) => (component.id === 'intro' ? { ...component, visibleWhen: { cel: 'params.missing' } } : component)),
          },
        }),
      ),
    )
    const editor = screen.getByRole('region', { name: 'Report editor' })
    expect(editor.getAttribute('data-panel')).toBe('outline')
    expect(screen.getByRole('toolbar', { name: 'Report tools' }).closest('[data-pane]')).toBeNull()

    click(button('Properties'))
    await settle()
    expect(editor.getAttribute('data-panel')).toBe('properties')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Title' }))

    click(button('Problems'))
    await settle()
    expect(editor.getAttribute('data-panel')).toBe('diagnostics')
    expect(document.activeElement).toBe(screen.getByRole('list', { name: 'Problems' }))

    click(button('Design view'))
    await settle()
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Design view, not the PDF' }))

    click(button('Outline'))
    await settle()
    expect(editor.getAttribute('data-panel')).toBe('outline')
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Findings' }))
  })

  // The chooser floats over the outline pane; opened from the design view
  // on a narrow screen, it would otherwise open in a pane nobody can see.
  test('show the outline when the place chooser opens, which it floats over', async () => {
    const { settle } = await mountScenarioBuilder()
    const editor = screen.getByRole('region', { name: 'Report editor' })
    click(button('Design view'))
    await settle()
    click(screen.getByRole('treeitem', { name: 'Findings' }))
    await settle()
    click(button('Move to…'))
    await settle()
    expect(editor.getAttribute('data-panel')).toBe('outline')
    expect(dialog('Move Findings: choose a place')?.closest('[data-pane]')?.getAttribute('data-pane')).toBe('outline')
  })
})

describe('the outline', () => {
  // A tree of every component that is a tab stop per row costs a long
  // report hundreds of presses to get past.
  test('is one tab stop, on the selected row, with nesting said by aria-level', async () => {
    const { settle } = await mountScenarioBuilder()
    const rows = screen.getAllByRole('treeitem')
    expect(rows.filter((row) => row.tabIndex === 0).map((row) => row.textContent)).toEqual(['Findings'])
    expect(screen.getByRole('treeitem', { name: 'Note' }).getAttribute('aria-level')).toBe('2')
    click(screen.getByRole('treeitem', { name: 'Note' }))
    await settle()
    expect(screen.getAllByRole('treeitem').filter((row) => row.tabIndex === 0)).toEqual([screen.getByRole('treeitem', { name: 'Note', selected: true })])
  })

  // Focus and selection are one in the tree: a row reached by Tab, or by
  // focus put there, is the selected row, so Delete deletes the row the
  // keyboard is on rather than saying nothing is selected.
  test('selects the row focus moves to, so Delete deletes it', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    screen.getByRole('treeitem', { name: 'Findings', selected: false }).focus()
    await settle()
    expect(screen.getByRole('treeitem', { name: 'Findings', selected: true })).toBe(document.activeElement)
    expect(screen.getByRole('form', { name: 'Text: Findings' })).toBeTruthy()
    press('Delete')
    await settle()
    expect(editor.state().document.regions.find((region) => region.region === 'body')?.count).toBe(4)
    expect(screen.queryByRole('treeitem', { name: 'Findings' })).toBeNull()
  })

  // Deleting the last row leaves a tree with no rows. Focus left with the
  // row would land on the page, outside the editor's keys: the next Ctrl+Z
  // would reach nothing and Tab would skip the empty tree. The tree itself
  // takes focus and is a tab stop, and Ctrl+Z there brings the row back --
  // unselected, as the editor leaves it, with focus still on the tree: a row
  // given focus would select itself, which no key asked for.
  test('keeps focus in an emptied tree, where Ctrl+Z still undoes', async () => {
    const report = scenarioReport()
    const { settle } = await mountBuilder(
      createReportEditor(sessionOver({ ...report, styles: [], regions: { ...report.regions, body: [{ id: 'gap', kind: 'spacer', height: 12 }] } })),
    )
    click(screen.getByRole('treeitem', { name: 'Spacer' }))
    await settle()
    press('Delete')
    await settle()
    const tree = screen.getByRole('tree', { name: 'Outline' })
    expect(document.activeElement).toBe(tree)
    expect(tree.tabIndex).toBe(0)
    press('z', ['Control'])
    await settle()
    expect(screen.getByRole('treeitem', { name: 'Spacer', selected: false })).toBeTruthy()
    expect(document.activeElement).toBe(tree)
    expect(announced()).toBe('Undone: Delete Spacer.')
  })

  // Undo of an insert takes away the row that had focus, and the selection
  // with it. Focus that went with the row would land on the page, where the
  // next arrow key scrolls it instead of walking the outline; focus put on
  // the first row would select it, and the next Delete would delete the
  // findings nobody chose. It goes to the tree itself.
  test('keeps focus in the tree when undo takes away the focused row', async () => {
    const { settle } = await mountScenarioBuilder()
    screen.getByRole('button', { name: 'Text' }).focus()
    press('Enter')
    await settle()
    press('Enter')
    await settle()
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'New text', selected: true }))
    press('z', ['Control'])
    await settle()
    expect(screen.queryByRole('treeitem', { name: 'New text' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('tree', { name: 'Outline' }))
    expect(screen.getByRole('treeitem', { name: 'Findings', selected: false })).toBeTruthy()
  })

  // Clicking the row already selected changes nothing in the state. The
  // focus owed to the click lands with the render the click itself causes;
  // owed until the next change instead, it would be pulled out of the field
  // the person has moved on to by the first edit made there.
  test('does not take focus back later for a click that changed nothing', async () => {
    const { settle } = await mountScenarioBuilder()
    click(screen.getByRole('treeitem', { name: 'Introduction' }))
    await settle()
    click(screen.getByRole('treeitem', { name: 'Introduction' }))
    await settle()
    const text = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Text' })
    text.focus()
    fireEvent.change(text, { target: { value: 'Introduction, revised' } })
    await settle()
    expect(screen.getByRole('treeitem', { name: 'Introduction, revised' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Text' }))
  })

  // Each region is a group named by its label, so a screen reader says
  // which region a row is in; an empty region still says so.
  test('groups the rows by region, an empty region included', async () => {
    await mountScenarioBuilder()
    const body = screen.getByRole('group', { name: 'Body' })
    expect(
      within(body)
        .getAllByRole('treeitem')
        .map((row) => row.textContent),
    ).toEqual(['Findings', 'Introduction', 'Section', 'Note', 'Spacer'])
    expect(within(screen.getByRole('group', { name: 'Summary' })).queryAllByRole('treeitem')).toEqual([])
  })
})

describe('the problems', () => {
  // A problem about the report as a whole -- a style nothing uses -- has no
  // row to go to. It shows the report's own properties, and focus stays on
  // the problem rather than jumping to a row that has nothing to do with it.
  test('show the report’s properties for a problem about the report, and keep focus', async () => {
    const report = scenarioReport()
    const { settle } = await mountBuilder(createReportEditor(sessionOver({ ...report, styles: [...report.styles, { id: 'unused', size: 9 }] })))
    click(screen.getByRole('treeitem', { name: 'Introduction' }))
    await settle()
    const problem = screen.getByRole('button', { name: 'Warning: Report' })
    click(problem)
    await settle()
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeTruthy()
    expect(screen.queryByRole('treeitem', { selected: true })).toBeNull()
    expect(document.activeElement).toBe(problem)
  })

  // A problem found while the keyboard is on another -- a field committed
  // as Tab lands on the list, or an edit from another editor over the
  // session -- may be listed before it. Each problem's button stays its own
  // element, tracked by what it is: tracked by its place, the button under
  // the keyboard was kept and given the new problem's name, so the keyboard
  // was on a problem it never went to, where the React builder's dropped it
  // to the page. The browser gate's comparison of the two builders found it.
  test('keep the keyboard on the problem it is on when another is listed before it', async () => {
    const report = scenarioReport()
    const { editor, settle } = await mountBuilder(createReportEditor(sessionOver({ ...report, styles: [...report.styles, { id: 'unused', size: 9 }] })))
    const warning = screen.getByRole('button', { name: 'Warning: Report' })
    warning.focus()
    editor.dispatch({ type: 'select', id: 'intro' })
    editor.dispatch({ type: 'setProperty', key: '/visibleWhen', value: 'params.missing' })
    await settle()
    const problems = within(screen.getByRole('list', { name: 'Problems' })).getAllByRole('button')
    expect(problems.map((problem) => problem.textContent)).toEqual(['Error: Introduction', 'Warning: Report'])
    expect(document.activeElement).toBe(warning)
    expect(warning.textContent).toBe('Warning: Report')
  })

  // With nothing wrong, an empty list says nothing; the sentence says so.
  test('say so when there are none', async () => {
    await mountScenarioBuilder()
    expect(within(screen.getByRole('list', { name: 'Problems' })).queryAllByRole('listitem')).toEqual([])
    expect(screen.getByText('No problems found.')).toBeTruthy()
  })
})

describe('keys', () => {
  // Ctrl+Z in a field undoes typing there. Sent to the report too, one
  // keystroke would take back a whole step of the document as well.
  test('pressed in a text field are the field’s', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    click(screen.getByRole('treeitem', { name: 'Spacer' }))
    press('Delete')
    await settle()
    click(screen.getByRole('treeitem', { name: 'Introduction' }))
    await settle()
    screen.getByRole('textbox', { name: 'Text' }).focus()
    press('z', ['Control'])
    await settle()
    expect(editor.state().history.canUndo).toBe(true)
  })

  // Saying "Nothing to undo." a second time changes no text; a live region
  // that only had its text replaced would say nothing the second time, and
  // the second Ctrl+Z would look like a key that did not land.
  test('that do the same thing twice are announced twice', async () => {
    const { settle } = await mountScenarioBuilder()
    const status = screen.getByRole('status', { name: '' })
    const added: string[] = []
    new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) added.push(node.textContent ?? '')
    }).observe(status, { childList: true })
    button('Redo').focus()
    press('y', ['Control'])
    await settle()
    press('y', ['Control'])
    await settle()
    expect(added).toEqual(['Nothing to redo.', 'Nothing to redo.'])
  })

  // Escape outside a drag is the page's: a host's dialog around the editor
  // closes on it, and the editor must not swallow it.
  test('Escape with nothing being placed is left to the page', async () => {
    await mountScenarioBuilder()
    button('Undo').focus()
    const passed: boolean[] = []
    document.addEventListener('keydown', (event) => passed.push(!event.defaultPrevented), { once: true })
    press('Escape')
    expect(passed).toEqual([true])
  })
})
