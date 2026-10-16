/**
 * The Angular builder as the Studio shows it: `<report-builder>` over the
 * editor the application was started with, and nothing else -- the same
 * builder a host puts on its page, so a difference on screen between the
 * two frameworks is a difference of builder.
 *
 * `display: contents` on the host, so the builder's root is laid out by the
 * Studio's pane as the React builder's root is.
 *
 * **This file holds the component and nothing else**, for the reason in
 * angular-editor.ts.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { ReportBuilder } from '@formancy/report-builder-angular'
import { STUDIO_EDITOR } from './angular-editor.js'

@Component({
  selector: 'report-studio-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportBuilder],
  host: { style: 'display: contents' },
  template: `<report-builder [editor]="editor" />`,
})
export class StudioAngularBuilder {
  protected readonly editor = inject(STUDIO_EDITOR)
}
