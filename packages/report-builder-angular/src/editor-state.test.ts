import { ChangeDetectionStrategy, Component, input, provideZonelessChangeDetection } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { createReportEditor } from '@formancy/report-builder-core'
import type { ReportEditor } from '@formancy/report-builder-core'
import { render, screen } from '@testing-library/angular'
import { afterEach, describe, expect, test } from 'vitest'
import { injectEditorState } from './editor-state'
import { scenarioSession } from './test-support'

/** The smallest view over an editor: its zoom, as the state says it. */
@Component({
  selector: 'test-zoom',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<output aria-label="Zoom">{{ state().zoomLabel }}</output>`,
})
class ZoomView {
  readonly editor = input.required<ReportEditor>()
  protected readonly state = injectEditorState(this.editor)
}

const editor = (): ReportEditor => createReportEditor(scenarioSession())

async function mount(over: ReportEditor) {
  const view = await render(ZoomView, { componentInputs: { editor: over }, providers: [provideZonelessChangeDetection()] })
  await view.fixture.whenStable()
  return view
}

const zoom = (): string => screen.getByRole('status', { name: 'Zoom' }).textContent ?? ''

afterEach(() => {
  TestBed.resetTestingModule()
})

describe('injectEditorState', () => {
  // A view that read the state once would show the editor as it was when it
  // mounted: an action taken anywhere else -- the other builder, a host's
  // shortcut -- would never reach it.
  test('shows each change the editor makes, from wherever it was asked for', async () => {
    const over = editor()
    const view = await mount(over)
    expect(zoom()).toBe('100%')
    over.dispatch({ type: 'zoomIn' })
    await view.fixture.whenStable()
    expect(zoom()).toBe('125%')
  })

  // A view destroyed with its subscription still live keeps being told
  // about every edit, and keeps itself and its editor's state alive, for as
  // long as the session lasts (plan 21).
  test('unsubscribes when the view is destroyed', async () => {
    const over = editor()
    const before = over.listenerCount()
    const view = await mount(over)
    expect(over.listenerCount()).toBe(before + 1)
    view.fixture.destroy()
    expect(over.listenerCount()).toBe(before)
  })

  // A view given another editor that still listened to the first would show
  // whichever spoke last, and leak the first subscription (plan 21's
  // "replacing the session input").
  test('follows the editor its input names now, and lets the old one go', async () => {
    const first = editor()
    const second = editor()
    const view = await mount(first)
    second.dispatch({ type: 'setZoom', zoom: 2 })
    view.fixture.componentRef.setInput('editor', second)
    await view.fixture.whenStable()
    expect(zoom()).toBe('200%')
    expect(first.listenerCount()).toBe(0)
    expect(second.listenerCount()).toBe(1)
    first.dispatch({ type: 'zoomOut' })
    await view.fixture.whenStable()
    expect(zoom()).toBe('200%')
  })
})
