/**
 * What the tests mount the builder with. Only test files import this; the
 * published entry never reaches it.
 */
import { ChangeDetectionStrategy, Component, input, provideZonelessChangeDetection } from '@angular/core'
import type { Type } from '@angular/core'
import type { ComponentFixture } from '@angular/core/testing'
import { createReportEditor } from '@formancy/report-builder-core'
import type { EditorLocale, ReportEditor } from '@formancy/report-builder-core'
import { render } from '@testing-library/angular'
import { ReportBuilder } from './builder'
import { ReportHostView } from './host-view'
import { scenarioSession } from './test-support'

export interface Mounted<T = ReportBuilder> {
  readonly editor: ReportEditor
  readonly fixture: ComponentFixture<T>
  /** Waits for the render a change causes, as a person's next look at the screen would. */
  settle(): Promise<void>
}

/**
 * Mounts `<report-builder [editor]>` with zoneless change detection, as an
 * Angular 22 application runs it.
 *
 * Zoneless Angular renders on its own schedule, and nothing a test fires
 * knows about it, so every step waits for the fixture to be stable before
 * the next one looks. Testing Library's React wraps the same wait in `act`;
 * here it is said out loud.
 */
export async function mountBuilder(editor: ReportEditor): Promise<Mounted> {
  return mounted(ReportBuilder, { editor })
}

async function mounted<T>(component: Type<T>, inputs: Readonly<Record<string, unknown>>): Promise<Mounted<T>> {
  const view = await render(component, { componentInputs: inputs, providers: [provideZonelessChangeDetection()] })
  const settle = async (): Promise<void> => {
    await view.fixture.whenStable()
  }
  await settle()
  return { editor: inputs['editor'] as ReportEditor, fixture: view.fixture, settle }
}

/** A host's page over the builder, giving it one button as the host's view, as the scenarios about one say. */
@Component({
  selector: 'test-host-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportBuilder, ReportHostView],
  template: `
    <report-builder [editor]="editor()">
      <ng-template reportHostView><button type="button">{{ control() }}</button></ng-template>
    </report-builder>
  `,
})
export class HostPage {
  readonly editor = input.required<ReportEditor>()
  readonly control = input.required<string>()
}

/** The builder over `editor` on a host's page whose view is one button named `control`. */
export async function mountWithHostView(editor: ReportEditor, control: string): Promise<Mounted<HostPage>> {
  return mounted(HostPage, { editor, control })
}

/** An editor over a fresh session of the scenario report, mounted. */
export async function mountScenarioBuilder(locale: EditorLocale = 'en'): Promise<Mounted> {
  return mountBuilder(createReportEditor(scenarioSession(), { locale }))
}
