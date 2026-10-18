/**
 * The host's view in the React builder: what the host gives as `hostView`,
 * drawn in the design view's place while the editor's `view` is the host's
 * (0029).
 *
 * The scenarios find it by role and name. Two things they cannot see are
 * held here, and the first reads the DOM, because the accessibility tree
 * cannot answer it: which hooks the region carries decides which of the
 * workbench's and report-builder.css's rules reach what the host drew in
 * it, and a `wb-pane` class on it would dress the host's own buttons as the
 * builder's. The second is when the host's node lives, which is React's.
 */
import { createReportEditor, scenarioReport } from '@formancy/report-builder-core'
import { act, cleanup, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { afterEach, describe, expect, test } from 'vitest'
import { ReportBuilder } from './report-builder.js'
import { sessionOver, violations } from './test-support.js'

afterEach(cleanup)

const preview = (shown: boolean) => createReportEditor(sessionOver(scenarioReport()), { hostView: { name: 'Preview', shown } })

describe('the host’s view', () => {
  // A region the builder dresses would dress the host's view with the
  // builder's rules, and a second name for it -- a header saying "Design
  // view" -- would be read beside the host's own. The region is bare: the
  // middle pane's place and its own part, named by the host's view, a
  // target for focus but no tab stop, and in it only what the host gave.
  test('stands in the design view’s place as a bare region holding only the host’s node', async () => {
    render(<ReportBuilder editor={preview(true)} hostView={<button type="button">Download PDF</button>} />)
    const region = screen.getByRole('region', { name: 'Preview' })
    expect(screen.queryByRole('region', { name: 'Design view, not the PDF' })).toBeNull()
    expect(region.getAttribute('data-pane')).toBe('canvas')
    expect(region.getAttribute('data-report-part')).toBe('view')
    expect(region.getAttribute('class')).toBeNull()
    expect(region.getAttribute('tabindex')).toBe('-1')
    expect([...region.children].map((child) => child.outerHTML)).toEqual(['<button type="button">Download PDF</button>'])
    expect(await violations()).toEqual([])
  })

  // The Studio's Preview prints while it is mounted: a node kept alive
  // behind the design view would print every edit nobody sees. React mounts
  // the host's node with the region and unmounts it with the region.
  test('mounts the host’s node only while it is drawn', async () => {
    const lives: string[] = []
    function Counted(): ReactElement {
      useEffect(() => {
        lives.push('mounted')
        return () => {
          lives.push('unmounted')
        }
      }, [])
      return <p>Page 1 of 2</p>
    }
    const editor = preview(false)
    const listening = editor.listenerCount()
    const { unmount } = render(<ReportBuilder editor={editor} hostView={<Counted />} />)
    expect(lives).toEqual([])
    act(() => {
      editor.dispatch({ type: 'showHostView' })
    })
    expect(lives).toEqual(['mounted'])
    await userEvent.setup().click(screen.getByRole('button', { name: 'Design view' }))
    expect(lives).toEqual(['mounted', 'unmounted'])
    act(() => {
      editor.dispatch({ type: 'showHostView' })
    })
    expect(lives).toEqual(['mounted', 'unmounted', 'mounted'])
    unmount()
    expect(lives).toEqual(['mounted', 'unmounted', 'mounted', 'unmounted'])
    expect(editor.listenerCount()).toBe(listening)
  })

  // React bubbles an event from a portal through the components, not the
  // page: a menu or a dialog the host opens from its view into the body
  // would hand its keys to the builder, and Ctrl+Z on it undo the report.
  // The Angular builder never hears such a key; neither does this one.
  test('leaves the keys of a portal the host opens from its view to the host', async () => {
    const editor = preview(true)
    render(<ReportBuilder editor={editor} hostView={createPortal(<button type="button">Menu item</button>, document.body)} />)
    act(() => {
      editor.dispatch({ type: 'select', id: 'intro' })
      editor.dispatch({ type: 'delete' })
    })
    expect(editor.state().history.canUndo).toBe(true)
    const item = screen.getByRole('button', { name: 'Menu item' })
    expect(screen.getByRole('region', { name: 'Preview' }).contains(item)).toBe(false)
    act(() => item.focus())
    await userEvent.setup().keyboard('{Control>}z{/Control}')
    expect(editor.state().history.canRedo).toBe(false)
  })

  // The editor says a view stands in the middle, so the builder draws its
  // place, named, even when the host gave nothing to put there: the middle
  // pane is never a hole a narrow layout would show as nothing at all.
  test('is drawn, named and empty, for a host that gave no node', () => {
    render(<ReportBuilder editor={preview(true)} />)
    expect(screen.getByRole('region', { name: 'Preview' }).childElementCount).toBe(0)
  })
})
