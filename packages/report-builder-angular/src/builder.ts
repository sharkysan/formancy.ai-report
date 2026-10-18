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
 * - the palette over the outline -- with no row in it, an empty tree and
 *   the sentence that says so -- with the place chooser floating over them
 *   while a keyboard chooses a place;
 * - the design view, or, while the editor's `view` is the host's, the
 *   host's view in its place: the template the host gave as
 *   `<ng-template reportHostView>`, stamped into a bare region named by the
 *   editor's `hostView` -- no workbench pane, so no rule of the builder's
 *   dresses what the host drew, and its keys are the host's;
 * - the properties and the problems, sharing the third column. On a narrow
 *   screen report-builder.css shows the one pane the state's `panel` names,
 *   so the column says it is whichever of the two is asked for, and each
 *   half carries its own name for the other to be hidden by;
 * - a bar with the live region.
 *
 * Each side pane's header has a Hide, named after the pane, which gives the
 * design view its room and the keyboard. A pane the state says is hidden
 * is not drawn, and the third column goes when both its halves are.
 *
 * A host that wants another arrangement puts `[reportEditor]` on its own
 * element and the parts inside it, as this template does.
 */
import { ChangeDetectionStrategy, Component, computed, contentChild, inject } from '@angular/core'
import type { HideablePanel } from '@formancy/report-builder-core'
import { ReportCanvas } from './canvas'
import { ReportHostOutlet, ReportHostView } from './host-view'
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
  imports: [ReportCanvas, ReportHostOutlet, ReportOutline, ReportPalette, ReportPlaces, ReportProblems, ReportProperties, ReportStatus, ReportToolbar],
  template: `
    <div class="wb-pane">
      <header>
        <span data-report-part="title">{{ state().document.title }}</span>
        <div reportToolbar></div>
      </header>
    </div>
    @if (shows('outline')) {
      <section class="wb-pane" data-pane="outline">
        <header>
          <span>{{ t()('pane.outline') }}</span>
          <button type="button" data-report-part="hide-pane" [attr.aria-label]="t()('action.hidePane', { pane: t()('pane.outline') })" (click)="root.hidePane('outline')">{{ t()('action.hide') }}</button>
        </header>
        <div class="wb-body">
          <div reportPalette></div>
          <div reportOutline></div>
          @if (empty()) {
            <p data-report-part="outline-empty" [id]="root.outlineEmpty">{{ t()('outline.empty') }}</p>
          }
        </div>
        <div reportPlaces></div>
      </section>
    }
    @if (state().view === 'host') {
      <section data-pane="canvas" data-report-part="view" tabindex="-1" [attr.aria-label]="state().hostView?.name">
        <ng-container [reportHostOutlet]="hostView()?.template ?? null"></ng-container>
      </section>
    } @else {
      <section class="wb-pane wb-canvas" data-pane="canvas">
        <header>{{ t()('pane.canvas') }}</header>
        <div class="wb-body">
          <section reportCanvas></section>
        </div>
      </section>
    }
    @if (shows('properties') || shows('diagnostics')) {
      <section class="wb-pane" [attr.data-pane]="state().panel === 'diagnostics' || !shows('properties') ? 'diagnostics' : 'properties'">
        @if (shows('properties')) {
          <header data-pane="properties">
            <span>{{ state().properties.heading }}</span>
            @if (state().selection !== null) {
              <button type="button" (click)="root.dispatch({ type: 'select', id: null }, { to: 'pane', panel: 'properties' })">{{ t()('properties.report') }}</button>
            }
            <button type="button" data-report-part="hide-pane" [attr.aria-label]="t()('action.hidePane', { pane: t()('pane.properties') })" (click)="root.hidePane('properties')">{{ t()('action.hide') }}</button>
          </header>
          <div class="wb-body" data-pane="properties">
            <form reportProperties></form>
          </div>
        }
        @if (shows('diagnostics')) {
          <header data-pane="diagnostics">
            <!-- A status, so a change in how many problems there are is said
                 without taking the person's place: "Problems 2". Named in
                 words, never after its own heading, which the Studio sets in
                 capitals that Chromium would put in the name. -->
            <div role="status" [attr.aria-label]="t()('pane.problems')">
              <span>{{ t()('pane.problems') }}</span>{{ count() > 0 ? ' ' : '' }}@if (count() > 0) {<span data-report-part="badge" [attr.data-severity]="severity()">{{ count() }}</span>}
            </div>
            <button type="button" data-report-part="hide-pane" [attr.aria-label]="t()('action.hidePane', { pane: t()('pane.problems') })" (click)="root.hidePane('diagnostics')">{{ t()('action.hide') }}</button>
          </header>
          <div class="wb-body" data-pane="diagnostics">
            <div reportProblems></div>
          </div>
        }
      </section>
    }
    <div class="wb-pane">
      <p reportStatus></p>
    </div>
  `,
})
export class ReportBuilder {
  protected readonly root = inject(ReportEditorRoot)
  protected readonly state = this.root.state
  protected readonly t = this.root.t
  protected readonly count = computed(() => this.state().diagnostics.length)
  /** The template the host gave as its view, if it gave one. */
  protected readonly hostView = contentChild(ReportHostView)
  /** No row in any region: the outline is an empty tree, and this says so beside it. */
  protected readonly empty = computed(() => this.state().outline.every((region) => region.nodes.length === 0))
  /** What colour the count is: an error's, when any problem is one. */
  protected readonly severity = computed(() => (this.state().diagnostics.some((entry) => entry.severity === 'error') ? 'error' : 'warning'))

  /** Whether the pane is drawn: every one the person has not hidden. */
  protected shows(panel: HideablePanel): boolean {
    return !this.state().hidden.includes(panel)
  }
}
