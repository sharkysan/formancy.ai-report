/**
 * What the tests mount the builder with. Only test files import this; the
 * published entry never reaches it.
 */
import { provideZonelessChangeDetection } from '@angular/core'
import type { ComponentFixture } from '@angular/core/testing'
import { createReportEditor } from '@formancy/report-builder-core'
import type { EditorLocale, ReportEditor } from '@formancy/report-builder-core'
import { render } from '@testing-library/angular'
import { ReportBuilder } from './builder'
import { scenarioSession } from './test-support'

export interface Mounted {
  readonly editor: ReportEditor
  readonly fixture: ComponentFixture<ReportBuilder>
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
  const view = await render(ReportBuilder, { componentInputs: { editor }, providers: [provideZonelessChangeDetection()] })
  const settle = async (): Promise<void> => {
    await view.fixture.whenStable()
  }
  await settle()
  return { editor, fixture: view.fixture, settle }
}

/** An editor over a fresh session of the scenario report, mounted. */
export async function mountScenarioBuilder(locale: EditorLocale = 'en'): Promise<Mounted> {
  return mountBuilder(createReportEditor(scenarioSession(), { locale }))
}
