/**
 * Dragging with a pointer: the second way to place a component, after the
 * place dialog, through the editor's own drag state machine.
 *
 * jsdom lays nothing out, so every element's box is at 0,0 with no size:
 * a pointer position given here is a position on the sheet, in the same
 * pixels the editor's drop targets and boxes are in. Positions are read from
 * the editor's state -- where it says a target or a box is -- and elements
 * are found by role and name.
 */
import { editorText, scenarioReport } from '@formancy/report-builder-core'
import type { Box, ReportEditor } from '@formancy/report-builder-core'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { computeAccessibleDescription } from 'dom-accessibility-api'
import { afterEach, describe, expect, test } from 'vitest'
import { mount } from './test-support.js'
import type { Mounted } from './test-support.js'
import type { ReportDefinition } from '@formancy/report-spec'

afterEach(cleanup)

const t = editorText('en')
const body = (mounted: Mounted): string =>
  mounted.session
    .document()
    .regions.body.map((component) => component.id)
    .join()
const canvas = (): HTMLElement => screen.getByRole('region', { name: t('canvas.label') })
const centre = (box: Box): { clientX: number; clientY: number } => ({ clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 })

/** Where the editor draws the target named `label`, while a drag is on. */
function target(editor: ReportEditor, label: string): Box {
  const found = editor.state().dropTargets.find((candidate) => candidate.label === label)
  if (found === undefined)
    throw new Error(
      `no target ${label} among ${editor
        .state()
        .dropTargets.map((candidate) => candidate.label)
        .join(' | ')}`,
    )
  return found.px
}

/** Presses on `element` and moves far enough onto the canvas for the press to become a drag. */
async function pickUp(mounted: Mounted, element: HTMLElement): Promise<void> {
  await mounted.user.pointer([
    { keys: '[MouseLeft>]', target: element, coords: { clientX: 0, clientY: 0 } },
    { target: canvas(), coords: { clientX: 1, clientY: 30 } },
  ])
}

/** The scenario report with a table in its summary: a column named Article, whose box and row are a column's. */
function withTable(): ReportDefinition {
  const report = scenarioReport()
  return {
    ...report,
    datasets: { detail: { id: 'lines', fields: [{ id: 'sku', type: 'string', label: 'SKU', nullable: false }] } },
    regions: {
      ...report.regions,
      summary: [
        {
          id: 'lines',
          kind: 'table',
          dataset: 'detail',
          columns: [{ id: 'sku', header: 'Article', width: 'fill', align: 'left', value: { kind: 'field', field: { dataset: 'detail', field: 'sku' } } }],
          emptyText: 'None.',
          repeatHeader: true,
        },
      ],
    },
  }
}

describe('a pointer drag', () => {
  // The pointer path inserts where the pointer lets go, at a place the
  // session accepts, and leaves the person on the new component -- the same
  // result the place dialog gives the keyboard.
  test('from the palette onto the canvas inserts there, and focuses the new row', async () => {
    const mounted = mount(scenarioReport())
    await pickUp(mounted, screen.getByRole('button', { name: t('kind.text') }))
    const place = t('target.after', { where: t('region.body'), name: 'Introduction' })
    await mounted.user.pointer({ target: canvas(), coords: centre(target(mounted.editor, place)) })
    // The place under the pointer is marked, by the name the dialog gives it.
    expect(screen.getByRole('img', { name: place }).getAttribute('data-over')).toBe('true')
    await mounted.user.pointer({ keys: '[/MouseLeft]', target: canvas() })
    expect(body(mounted)).toBe('findings,intro,text,notes,gap')
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: t('default.text'), selected: true }))
    expect(screen.queryByRole('img', { name: place })).toBeNull()
  })

  // A box dragged on the canvas moves; one dragged by its outline row and let
  // go over another row lands beside it -- here after it, the lower half of
  // a row with no height in jsdom.
  test('moves a box on the canvas, or a row beside another row', async () => {
    const mounted = mount(scenarioReport())
    await pickUp(mounted, screen.getByRole('img', { name: 'Findings' }))
    await mounted.user.pointer({
      target: canvas(),
      coords: centre(target(mounted.editor, t('target.after', { where: t('region.body'), name: t('kind.spacer') }))),
    })
    await mounted.user.pointer({ keys: '[/MouseLeft]', target: canvas() })
    expect(body(mounted)).toBe('intro,notes,gap,findings')

    await pickUp(mounted, screen.getByRole('treeitem', { name: 'Findings' }))
    await mounted.user.pointer({ target: screen.getByRole('treeitem', { name: 'Introduction' }), coords: { clientX: 1, clientY: 1 } })
    await mounted.user.pointer({ keys: '[/MouseLeft]', target: screen.getByRole('treeitem', { name: 'Introduction' }) })
    expect(body(mounted)).toBe('intro,findings,notes,gap')
  })

  // The places are in pixels from the sheet's padding edge, where its boxes
  // start; the pointer's position is read from its border edge. Read without
  // the sheet's 1 px border, the pointer is a pixel off at every zoom, and
  // just above the midpoint between two places it lands on the lower one.
  test('reads the pointer inside the sheet’s border', async () => {
    const mounted = mount(scenarioReport())
    const sheet = screen.getByRole('img', { name: 'Findings' }).parentElement as HTMLElement
    sheet.getBoundingClientRect = () => ({ left: 10, top: 10, right: 810, bottom: 1110, width: 800, height: 1100, x: 10, y: 10, toJSON: () => ({}) })
    Object.defineProperty(sheet, 'clientLeft', { value: 1 })
    Object.defineProperty(sheet, 'clientTop', { value: 1 })
    await pickUp(mounted, screen.getByRole('button', { name: t('kind.text') }))
    const before = target(mounted.editor, t('target.before', { where: t('region.body'), name: 'Findings' }))
    const after = target(mounted.editor, t('target.after', { where: t('region.body'), name: 'Findings' }))
    const middle = (before.y + before.height / 2 + after.y + after.height / 2) / 2
    await mounted.user.pointer({ target: canvas(), coords: { clientX: 10 + 1 + before.x + 4, clientY: 10 + 1 + middle - 0.4 } })
    expect(screen.getByRole('img', { name: t('target.before', { where: t('region.body'), name: 'Findings' }) }).getAttribute('data-over')).toBe('true')
  })

  // A press that wobbles less than a drag's distance is a click: on a
  // palette entry it opens the place dialog, and it never starts a drag that
  // would announce "Nothing was moved." for a click.
  test('that hardly moves is a click', async () => {
    const mounted = mount(scenarioReport())
    const text = screen.getByRole('button', { name: t('kind.text') })
    await mounted.user.pointer([
      { keys: '[MouseLeft>]', target: text, coords: { clientX: 10, clientY: 10 } },
      { target: text, coords: { clientX: 12, clientY: 11 } },
      { keys: '[/MouseLeft]', target: text },
    ])
    expect(screen.getByRole('dialog', { name: t('places.insert', { kind: t('kind.text') }) })).toBeTruthy()
    expect(screen.queryByRole('img', { name: t('target.after', { where: t('region.body'), name: t('kind.spacer') }) })).toBeTruthy()
    expect(mounted.editor.state().drag?.via).toBe('keyboard')
  })

  // Let go over nothing, a drag changes nothing and says so; and the click
  // a drag ends in on the element it began on does not also activate it.
  test('let go over nothing changes nothing, and opens nothing', async () => {
    const mounted = mount(scenarioReport())
    const text = screen.getByRole('button', { name: t('kind.text') })
    await pickUp(mounted, text)
    await mounted.user.pointer([
      { target: text, coords: { clientX: 0, clientY: 0 } },
      { keys: '[/MouseLeft]', target: text },
    ])
    expect(body(mounted)).toBe('findings,intro,notes,gap')
    expect(screen.getByRole('status', { name: '' }).textContent).toBe(t('status.notMoved'))
    expect(screen.queryByRole('dialog')).toBeNull()
    // The next click is a click again.
    await mounted.user.click(text)
    expect(screen.getByRole('dialog', { name: t('places.insert', { kind: t('kind.text') }) })).toBeTruthy()
  })

  // A drag that ends away from where it began ends in no click on the entry
  // it began on, so the click it would have swallowed never comes. Swallowed
  // instead was the next activation of any entry -- Enter on a palette entry,
  // the keyboard's path to the place dialog, opened nothing. A key or a new
  // press after a drop is a person's next act, not the drag's.
  test('dropped elsewhere, leaves the next keyboard press of an entry a press', async () => {
    const mounted = mount(scenarioReport())
    await pickUp(mounted, screen.getByRole('button', { name: t('kind.spacer') }))
    const place = t('target.after', { where: t('region.body'), name: 'Introduction' })
    await mounted.user.pointer({ target: canvas(), coords: centre(target(mounted.editor, place)) })
    await mounted.user.pointer({ keys: '[/MouseLeft]', target: canvas() })
    expect(body(mounted)).toBe('findings,intro,spacer,notes,gap')
    screen.getByRole('button', { name: t('kind.text') }).focus()
    await mounted.user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: t('places.insert', { kind: t('kind.text') }) })).toBeTruthy()
  })

  // Escape ends a pointer drag as it ends the keyboard's; the release that
  // follows drops nothing.
  test('is cancelled by Escape', async () => {
    const mounted = mount(scenarioReport())
    await pickUp(mounted, screen.getByRole('img', { name: 'Findings' }))
    await mounted.user.keyboard('{Escape}')
    expect(mounted.editor.state().drag).toBeNull()
    await mounted.user.pointer([
      { target: canvas(), coords: { clientX: 5, clientY: 300 } },
      { keys: '[/MouseLeft]', target: canvas() },
    ])
    expect(body(mounted)).toBe('findings,intro,notes,gap')
  })

  // A drag belongs to the builder that started it: unmounted mid-drag, it
  // does not leave the editor waiting for a release that will never come.
  test('is cancelled when the builder goes away', async () => {
    const mounted = mount(scenarioReport())
    await pickUp(mounted, screen.getByRole('img', { name: 'Findings' }))
    expect(mounted.editor.state().drag?.via).toBe('pointer')
    mounted.view.unmount()
    expect(mounted.editor.state().drag).toBeNull()
  })

  // The browser takes a pointer away -- a touch turned scroll, a window
  // switch -- and the drag ends with nothing placed.
  test('is cancelled when the browser cancels the pointer', async () => {
    const mounted = mount(scenarioReport())
    await pickUp(mounted, screen.getByRole('img', { name: 'Findings' }))
    fireEvent.pointerCancel(canvas())
    expect(mounted.editor.state().drag).toBeNull()
    expect(body(mounted)).toBe('findings,intro,notes,gap')
  })

  // An entry the report cannot hold yet is not picked up by a pointer
  // either; the editor says why, as it does for a click.
  test('of a kind the report cannot hold never starts, and says why', async () => {
    const mounted = mount(scenarioReport())
    await pickUp(mounted, screen.getByRole('button', { name: t('kind.image') }))
    expect(mounted.editor.state().drag).toBeNull()
    expect(screen.getByRole('status', { name: '' }).textContent).toBe(t('palette.needsImage'))
  })

  // A click on a box selects it and puts focus on its outline row, where
  // the keyboard takes over -- and where a screen reader says what was
  // selected. A table's column is a box of its own.
  test('that is only a click on a box selects it, and focuses its row', async () => {
    const mounted = mount(withTable())
    await mounted.user.click(screen.getByRole('img', { name: 'Note' }))
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Note', selected: true }))
    await mounted.user.click(screen.getByRole('img', { name: 'Article' }))
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Article', selected: true }))
  })

  // Over an outline row the upper half is the place before it, as the lower
  // is the place after; a table's column is no place for a component.
  test('lands before a row from its upper half, and nowhere on a column', async () => {
    const mounted = mount(withTable())
    const findings = (): HTMLElement => screen.getByRole('treeitem', { name: 'Findings' })
    await pickUp(mounted, screen.getByRole('treeitem', { name: t('kind.spacer') }))
    // jsdom's rows are 0 pixels tall at 0, so above 0 is their upper half.
    await mounted.user.pointer([
      { target: findings(), coords: { clientX: 1, clientY: -1 } },
      { keys: '[/MouseLeft]', target: findings() },
    ])
    expect(body(mounted)).toBe('gap,findings,intro,notes')

    await pickUp(mounted, findings())
    await mounted.user.pointer([
      { target: screen.getByRole('treeitem', { name: 'Article' }), coords: { clientX: 1, clientY: 1 } },
      { keys: '[/MouseLeft]', target: canvas() },
    ])
    expect(body(mounted)).toBe('gap,findings,intro,notes')
    expect(screen.getByRole('status', { name: '' }).textContent).toBe(t('status.notMoved'))
  })

  // The secondary button opens a context menu, and a finger scrolls the
  // page; neither picks anything up.
  test('needs the primary button of a mouse or a pen', async () => {
    const mounted = mount(scenarioReport())
    await mounted.user.pointer([
      { keys: '[MouseRight>]', target: screen.getByRole('img', { name: 'Findings' }), coords: { clientX: 0, clientY: 0 } },
      { target: canvas(), coords: { clientX: 1, clientY: 30 } },
    ])
    expect(mounted.editor.state().drag).toBeNull()
    await mounted.user.pointer({ keys: '[/MouseRight]', target: canvas() })

    await mounted.user.pointer([
      { keys: '[TouchA>]', target: screen.getByRole('img', { name: 'Findings' }), coords: { clientX: 0, clientY: 0 } },
      { pointerName: 'TouchA', target: canvas(), coords: { clientX: 1, clientY: 30 } },
    ])
    expect(mounted.editor.state().drag).toBeNull()
    await mounted.user.pointer({ keys: '[/TouchA]', target: canvas() })
    expect(body(mounted)).toBe('findings,intro,notes,gap')
  })

  // A box wider than the space it stands in says so, to the eye as a mark
  // and to a screen reader as its description.
  test('finds a box that overflows described as one', () => {
    const report = scenarioReport()
    mount({
      ...report,
      regions: {
        ...report.regions,
        body: [
          {
            id: 'cols',
            kind: 'columns',
            columns: [
              { width: 60, components: [{ id: 'wide', kind: 'rectangle', width: 200, height: 20 }] },
              { width: 'fill', components: [] },
            ],
          },
        ],
      },
    })
    expect(computeAccessibleDescription(screen.getByRole('img', { name: t('kind.rectangle') }))).toBe(t('canvas.overflow'))
  })
})
