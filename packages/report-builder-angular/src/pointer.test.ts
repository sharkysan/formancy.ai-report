/**
 * The pointer's gestures: a click selects a box, a palette button, a box
 * or an outline row dragged onto the sheet lands at the place nearest the
 * pointer, one dropped on a row lands beside it, and a drag let go of
 * anywhere else changes nothing. Each has the keyboard path the scenarios
 * walk (formancy.ai 0046); these hold the pointer's to the same places.
 *
 * The design view's boxes are pictures, `role="img"` named by their label,
 * for the pointer only -- not focusable, with the outline as the keyboard's
 * way to each -- and found by that role and name.
 */
import { TestBed } from '@angular/core/testing'
import { screen, within } from '@testing-library/angular'
import { computeAccessibleDescription } from 'dom-accessibility-api'
import { afterEach, describe, expect, test } from 'vitest'
import { createReportEditor, scenarioReport } from '@formancy/report-builder-core'
import { mountBuilder, mountScenarioBuilder } from './test-mount'
import { richSession, sessionOver } from './test-support'
import { click } from './test-user'

afterEach(() => {
  TestBed.resetTestingModule()
})

const design = (): HTMLElement => screen.getByRole('region', { name: 'Design view, not the PDF' })
const box = (label: string): HTMLElement => within(design()).getByRole('img', { name: label })

/** jsdom has no DataTransfer; the builder writes to the one it is given. */
const transfer = (): object => ({ effectAllowed: '', dropEffect: '', setData: () => undefined, getData: () => '' })

/**
 * A drag event that keeps its coordinates. jsdom has no DragEvent, and
 * Testing Library's fallback drops clientX and clientY, so these are mouse
 * events carrying a DataTransfer, as formancy.ai's builders' tests make them.
 */
function dragEvent(type: string, at: { readonly clientX: number; readonly clientY: number } = { clientX: 0, clientY: 0 }, dataTransfer: object | null = transfer()): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...at })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  return event
}

describe('the design view', () => {
  // A box that a click does not select leaves a pointer user nothing to do
  // on the design view but look.
  test('selects the box clicked, and the outline follows', async () => {
    const { settle } = await mountScenarioBuilder()
    click(box('Introduction'))
    await settle()
    expect(screen.getByRole('treeitem', { name: 'Introduction', selected: true })).toBeTruthy()
  })

  // A table's column is a box of its own, and a click on it selects the
  // column -- its header and width -- not the whole table.
  test('selects a table’s column clicked, not its table', async () => {
    const editor = createReportEditor(richSession())
    const { settle } = await mountBuilder(editor)
    click(box('SKU'))
    await settle()
    expect(editor.state().selection).toEqual({ id: 'lines', column: 'sku' })
    expect(screen.getByRole('treeitem', { name: 'SKU', selected: true })).toBeTruthy()
  })

  // A click on a box selects it and takes the keyboard to its outline row,
  // as the React builder's does: the next arrow key walks on from there.
  test('takes focus to the outline row of the box clicked', async () => {
    const { settle } = await mountScenarioBuilder()
    click(box('Note'))
    await settle()
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Note', selected: true }))
  })

  // The places are in pixels from the sheet's padding edge, where its boxes
  // start; the pointer's position is read from its border edge. Read without
  // the sheet's 1 px border, the pointer is a pixel off at every zoom, and
  // just above the midpoint between two places it lands on the lower one.
  test('reads the pointer inside the sheet’s border', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    const sheet = box('Findings').parentElement as HTMLElement
    sheet.getBoundingClientRect = () => ({ left: 10, top: 10, right: 810, bottom: 1110, width: 800, height: 1100, x: 10, y: 10, toJSON: () => ({}) })
    Object.defineProperty(sheet, 'clientLeft', { value: 1 })
    Object.defineProperty(sheet, 'clientTop', { value: 1 })
    screen.getByRole('button', { name: 'Text' }).dispatchEvent(dragEvent('dragstart'))
    await settle()
    const place = (label: string) => editor.state().dropTargets.find((candidate) => candidate.label === label) as NonNullable<ReturnType<typeof editor.state>['dropTargets'][number]>
    const before = place('Body, before Findings')
    const after = place('Body, after Findings')
    const middle = (before.px.y + before.px.height / 2 + after.px.y + after.px.height / 2) / 2
    sheet.dispatchEvent(dragEvent('dragover', { clientX: 10 + 1 + before.px.x + 4, clientY: 10 + 1 + middle - 0.4 }))
    await settle()
    expect(editor.state().drag?.over).toBe(before.index)
    expect(screen.getByRole('img', { name: 'Body, before Findings' }).getAttribute('data-over')).toBe('true')
  })

  // A row dragged and let go over another row lands beside it -- after it,
  // over its lower half -- as the React builder's rows do; a table's column
  // has no place of its own to be moved to, and is not dragged.
  test('moves a row dropped on another row beside it', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    const findings = screen.getByRole('treeitem', { name: 'Findings' })
    expect(findings.getAttribute('draggable')).toBe('true')
    findings.dispatchEvent(dragEvent('dragstart'))
    await settle()
    const introduction = screen.getByRole('treeitem', { name: 'Introduction' })
    const over = dragEvent('dragover', { clientX: 1, clientY: 1 })
    introduction.dispatchEvent(over)
    await settle()
    expect(over.defaultPrevented).toBe(true)
    // Over the row being moved there is no place beside it: no drop is offered.
    const self = dragEvent('dragover', { clientX: 1, clientY: 1 })
    screen.getByRole('treeitem', { name: 'Findings' }).dispatchEvent(self)
    expect(self.defaultPrevented).toBe(false)
    introduction.dispatchEvent(dragEvent('dragover', { clientX: 1, clientY: 1 }))
    introduction.dispatchEvent(dragEvent('drop', { clientX: 1, clientY: 1 }))
    findings.dispatchEvent(dragEvent('dragend'))
    await settle()
    expect(editor.state().drag).toBeNull()
    expect(within(screen.getByRole('group', { name: 'Body' })).getAllByRole('treeitem').map((row) => row.textContent)).toEqual(['Introduction', 'Findings', 'Section', 'Note', 'Spacer'])
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Findings', selected: true }))

    TestBed.resetTestingModule()
    await mountBuilder(createReportEditor(richSession()))
    expect(screen.getByRole('treeitem', { name: 'SKU' }).getAttribute('draggable')).toBeNull()
  })

  // A box wider than the column it stands in is marked, and the mark says
  // why where a pointer rests on it; what the renderer does with it is the
  // renderer's to say.
  test('says why a box is marked as wider than the space it stands in', async () => {
    const report = scenarioReport()
    const side = { id: 'side', kind: 'columns', columns: [{ width: 100, components: [{ id: 'wide', kind: 'rectangle', width: 150, height: 20 }] }, { width: 'fill', components: [] }] }
    await mountBuilder(createReportEditor(sessionOver({ ...report, regions: { ...report.regions, body: [...report.regions.body, side] } })))
    expect(within(design()).getByTitle('Wider than the space it stands in')).toBe(box('Rectangle'))
  })

  // A drop where the drop indicator was not drawn, or at the wrong one, is
  // a component somewhere the person did not put it. The point is in the
  // sheet's pixels -- jsdom puts the sheet at the page's corner -- and the
  // place nearest it is the state's (`targetNear`), never this builder's.
  test('puts a palette kind dropped on the sheet at the place nearest the pointer', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    const text = screen.getByRole('button', { name: 'Text' })
    text.dispatchEvent(dragEvent('dragstart'))
    await settle()
    const target = editor.state().dropTargets.find((candidate) => candidate.label === 'Body, after Spacer')
    if (target === undefined) throw new Error('no place after the spacer')
    const at = { clientX: target.px.x + 4, clientY: target.px.y + target.px.height / 2 }
    box('Spacer').dispatchEvent(dragEvent('dragover', at))
    await settle()
    expect(editor.state().drag?.over).toBe(target.index)
    // A browser fires dragover again and again while the pointer rests.
    box('Spacer').dispatchEvent(dragEvent('dragover', at))
    await settle()
    expect(editor.state().drag?.over).toBe(target.index)
    box('Spacer').dispatchEvent(dragEvent('drop', at))
    text.dispatchEvent(dragEvent('dragend'))
    await settle()
    expect(editor.state().drag).toBeNull()
    expect(within(screen.getByRole('group', { name: 'Body' })).getAllByRole('treeitem').map((row) => row.textContent)).toEqual(['Findings', 'Introduction', 'Section', 'Note', 'Spacer', 'New text'])
  })

  // Moving a box by dragging it is the same move the keyboard's Move to…
  // makes, through the same command.
  test('moves a box dragged onto another place', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    box('Findings').dispatchEvent(dragEvent('dragstart'))
    await settle()
    const target = editor.state().dropTargets.find((candidate) => candidate.label === 'Section, after Note')
    if (target === undefined) throw new Error('no place after the note')
    const at = { clientX: target.px.x + 4, clientY: target.px.y + target.px.height / 2 }
    box('Note').dispatchEvent(dragEvent('dragover', at))
    box('Note').dispatchEvent(dragEvent('drop', at))
    box('Findings').dispatchEvent(dragEvent('dragend'))
    await settle()
    expect(within(screen.getByRole('group', { name: 'Body' })).getAllByRole('treeitem').map((row) => row.textContent)).toEqual(['Introduction', 'Section', 'Note', 'Findings', 'Spacer'])
  })

  // A drag let go of outside the sheet must not leave the editor
  // half-dragging, with places drawn that nothing will ever drop on.
  test('changes nothing when a drag ends anywhere but the sheet', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    const before = editor.state().revision
    const spacer = screen.getByRole('button', { name: 'Spacer' })
    // One a script made, with no DataTransfer, drags all the same.
    spacer.dispatchEvent(dragEvent('dragstart', undefined, null))
    await settle()
    expect(editor.state().dropTargets.length).toBeGreaterThan(0)
    spacer.dispatchEvent(dragEvent('dragend'))
    await settle()
    expect(editor.state().drag).toBeNull()
    expect(editor.state().revision).toBe(before)
  })

  // A file dragged in from the desktop, or text from another page, is
  // nothing the editor placed: refusing the dragover is what tells the
  // browser not to drop it here, and a drop that comes anyway does nothing.
  test('takes no drop it did not start', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    const before = editor.state().revision
    const over = dragEvent('dragover')
    box('Spacer').dispatchEvent(over)
    expect(over.defaultPrevented).toBe(false)
    box('Spacer').dispatchEvent(dragEvent('drop'))
    await settle()
    expect(editor.state().revision).toBe(before)
  })

  // A kind the report cannot hold yet -- an image, with no image to draw --
  // says why to a pointer as to a keyboard: in its description, and in the
  // live region when it is used, with nothing picked up and no chooser
  // opened over places it could not go.
  test('picks up nothing, and opens no chooser, for a kind the report cannot hold yet', async () => {
    const { editor, settle } = await mountScenarioBuilder()
    const image = screen.getByRole('button', { name: 'Image' })
    const why = editor.state().palette.find((entry) => entry.kind === 'image')?.unavailable ?? ''
    expect(why).not.toBe('')
    expect(computeAccessibleDescription(image)).toBe(why)
    const start = dragEvent('dragstart')
    image.dispatchEvent(start)
    expect(start.defaultPrevented).toBe(true)
    expect(editor.state().drag).toBeNull()
    click(image)
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(image)
    expect(screen.getByRole('status', { name: '' }).textContent).toBe(why)
  })
})
