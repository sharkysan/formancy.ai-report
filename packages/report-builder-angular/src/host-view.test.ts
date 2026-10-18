/**
 * The host's view in the Angular builder: the template a host gives as
 * `<ng-template reportHostView>`, stamped in the design view's place while
 * the editor's `view` is the host's (0029).
 *
 * The scenarios find it by role and name. Two things they cannot see are
 * held here, and the first reads the DOM, because the accessibility tree
 * cannot answer it: which hooks the region carries decides which of the
 * workbench's and report-builder.css's rules reach what the host drew in
 * it, and a `wb-pane` class on it would dress the host's own buttons as the
 * builder's. The second is when the host's view lives, which is Angular's:
 * a template stamped only while it is drawn, never content projected once
 * and kept alive behind the design view.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { createReportEditor, scenarioReport } from '@formancy/report-builder-core'
import type { ReportEditor } from '@formancy/report-builder-core'
import { render, screen } from '@testing-library/angular'
import { provideZonelessChangeDetection } from '@angular/core'
import { afterEach, describe, expect, test } from 'vitest'
import { ReportBuilder } from './builder'
import { ReportHostView } from './host-view'
import { mountBuilder, mountWithHostView } from './test-mount'
import { audit, sessionOver } from './test-support'
import { click } from './test-user'

afterEach(() => {
  TestBed.resetTestingModule()
})

const preview = (shown: boolean): ReportEditor => createReportEditor(sessionOver(scenarioReport()), { hostView: { name: 'Preview', shown } })

/** What was made and destroyed of the host's view, in order. */
const lives: string[] = []

@Component({
  selector: 'test-counted',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>Page 1 of 2</p>`,
})
class Counted {
  constructor() {
    lives.push('made')
    inject(DestroyRef).onDestroy(() => lives.push('destroyed'))
  }
}

@Component({
  selector: 'test-counting-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportBuilder, ReportHostView, Counted],
  template: `
    <report-builder [editor]="editor()">
      <ng-template reportHostView><test-counted /></ng-template>
    </report-builder>
  `,
})
class CountingPage {
  readonly editor = input.required<ReportEditor>()
}

describe('the host’s view', () => {
  // A region the builder dresses would dress the host's view with the
  // builder's rules, and a second name for it -- a header saying "Design
  // view" -- would be read beside the host's own. The region is bare: the
  // middle pane's place and its own part, named by the host's view, a
  // target for focus but no tab stop, and in it only what the host gave.
  test('stands in the design view’s place as a bare region holding only the host’s view', async () => {
    await mountWithHostView(preview(true), 'Download PDF')
    const region = screen.getByRole('region', { name: 'Preview' })
    expect(screen.queryByRole('region', { name: 'Design view, not the PDF' })).toBeNull()
    expect(region.getAttribute('data-pane')).toBe('canvas')
    expect(region.getAttribute('data-report-part')).toBe('view')
    expect(region.getAttribute('class')).toBeNull()
    expect(region.getAttribute('tabindex')).toBe('-1')
    expect([...region.children].map((child) => child.outerHTML)).toEqual(['<button type="button">Download PDF</button>'])
    expect(await audit()).toEqual([])
  })

  // The Studio's Preview prints while it lives: a view projected once and
  // kept behind the design view would print every edit nobody sees. The
  // template is stamped with the region and destroyed with it.
  test('stamps the host’s view only while it is drawn', async () => {
    lives.length = 0
    const editor = preview(false)
    const listening = editor.listenerCount()
    const view = await render(CountingPage, { componentInputs: { editor }, providers: [provideZonelessChangeDetection()] })
    await view.fixture.whenStable()
    expect(lives).toEqual([])
    editor.dispatch({ type: 'showHostView' })
    await view.fixture.whenStable()
    expect(lives).toEqual(['made'])
    expect(screen.getByRole('region', { name: 'Preview' }).textContent).toBe('Page 1 of 2')
    click(screen.getByRole('button', { name: 'Design view' }))
    await view.fixture.whenStable()
    expect(lives).toEqual(['made', 'destroyed'])
    editor.dispatch({ type: 'showHostView' })
    await view.fixture.whenStable()
    expect(lives).toEqual(['made', 'destroyed', 'made'])
    view.fixture.destroy()
    expect(lives).toEqual(['made', 'destroyed', 'made', 'destroyed'])
    expect(editor.listenerCount()).toBe(listening)
  })

  // The editor says a view stands in the middle, so the builder draws its
  // place, named, even when the host gave nothing to put there: the middle
  // pane is never a hole a narrow layout would show as nothing at all.
  test('is drawn, named and empty, for a host that gave no template', async () => {
    await mountBuilder(preview(true))
    expect(screen.getByRole('region', { name: 'Preview' }).childElementCount).toBe(0)
  })
})
