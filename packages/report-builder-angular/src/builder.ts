/**
 * `<report-builder [editor]="editor" />`: the whole editor, in the
 * workbench's three panes, with a bar above them and one below.
 *
 * The element is the editor's root (`ReportEditorRoot`, as a host
 * directive), a region named "Report editor". Its children, as the React
 * builder's are:
 *
 * - a bar with the report's title and the toolbar, which on a narrow screen
 *   is what switches between the panes, so it stands in none of them;
 * - the palette over the outline, with the place chooser floating over
 *   them while a keyboard chooses a place;
 * - the design view;
 * - the properties and the problems, sharing the third column. On a narrow
 *   screen report-builder.css shows the one pane the state's `panel` names,
 *   so the column says it is whichever of the two is asked for, and each
 *   half carries its own name for the other to be hidden by;
 * - a bar with the live region.
 *
 * A host that wants another arrangement puts `[reportEditor]` on its own
 * element and the parts inside it, as this template does.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { ReportCanvas } from './canvas'
import { ReportOutline } from './outline'
import { ReportPalette } from './palette'
import { ReportPlaces } from './places'
import { ReportProblems } from './problems'
import { ReportProperties } from './properties'
import { ReportEditorRoot } from './root'
import { ReportStatus } from './status'
import { ReportToolbar } from './toolbar'

@Component({
  selector: 'report-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: ReportEditorRoot, inputs: ['reportEditor: editor'] }],
  imports: [ReportCanvas, ReportOutline, ReportPalette, ReportPlaces, ReportProblems, ReportProperties, ReportStatus, ReportToolbar],
  template: `
    <div class="wb-pane">
      <header>
        <span>{{ state().document.title }}</span>
        <div reportToolbar></div>
      </header>
    </div>
    <section class="wb-pane" data-pane="outline">
      <header>{{ t()('pane.outline') }}</header>
      <div class="wb-body">
        <div reportPalette></div>
        <div reportOutline></div>
      </div>
      <div reportPlaces></div>
    </section>
    <section class="wb-pane wb-canvas" data-pane="canvas">
      <header>{{ t()('pane.canvas') }}</header>
      <div class="wb-body">
        <section reportCanvas></section>
      </div>
    </section>
    <section class="wb-pane" [attr.data-pane]="state().panel === 'diagnostics' ? 'diagnostics' : 'properties'">
      <header data-pane="properties">
        <span>{{ state().properties.heading }}</span>
        @if (state().selection !== null) {
          <button type="button" (click)="root.dispatch({ type: 'select', id: null }, { to: 'pane', panel: 'properties' })">{{ t()('properties.report') }}</button>
        }
      </header>
      <div class="wb-body" data-pane="properties">
        <form reportProperties></form>
      </div>
      <header data-pane="diagnostics">
        <!-- A status, so a change in how many problems there are is said
             without taking the person's place: "Problems 2". -->
        <div role="status" [attr.aria-labelledby]="problems">
          <span [id]="problems">{{ t()('pane.problems') }}</span>{{ count() > 0 ? ' ' : '' }}@if (count() > 0) {<span data-report-part="badge" [attr.data-severity]="severity()">{{ count() }}</span>}
        </div>
      </header>
      <div class="wb-body" data-pane="diagnostics">
        <div reportProblems></div>
      </div>
    </section>
    <div class="wb-pane">
      <p reportStatus></p>
    </div>
  `,
})
export class ReportBuilder {
  protected readonly root = inject(ReportEditorRoot)
  protected readonly state = this.root.state
  protected readonly t = this.root.t
  protected readonly problems = `${this.root.id}-problems`
  protected readonly count = computed(() => this.state().diagnostics.length)
  /** What colour the count is: an error's, when any problem is one. */
  protected readonly severity = computed(() => (this.state().diagnostics.some((entry) => entry.severity === 'error') ? 'error' : 'warning'))
}
