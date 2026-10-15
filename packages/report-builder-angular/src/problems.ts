/**
 * The problems: report-core's diagnostics, one button each, named by
 * severity and what it is about, and described by its sentence. Activating
 * one selects what it is about and puts focus on that outline row, so an
 * error message leads to the component it names (plan 8); one about the
 * report as a whole shows the report's own properties.
 *
 * The list is not a tab stop of its own: the toolbar's Problems button
 * moves focus to it, so what is said first is how many there are.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import type { DiagnosticEntry } from '@formancy/report-builder-core'
import { ReportEditorRoot } from './root'

@Component({
  selector: 'div[reportProblems]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul data-report-part="diagnostics" tabindex="-1" [attr.aria-label]="t()('pane.problems')">
      @for (entry of state().diagnostics; track $index) {
        <li data-report-part="diagnostic" [attr.data-severity]="entry.severity">
          <button type="button" [attr.aria-describedby]="message($index)" (click)="follow(entry)">{{ entry.label }}</button>
          <div [id]="message($index)">{{ entry.message }}</div>
        </li>
      }
    </ul>
    @if (state().diagnostics.length === 0) {
      <p>{{ t()('problems.none') }}</p>
    }
  `,
})
export class ReportProblems {
  private readonly root = inject(ReportEditorRoot)
  protected readonly state = this.root.state
  protected readonly t = this.root.t

  protected message(index: number): string {
    return `${this.root.id}-problem-${String(index)}`
  }

  protected follow(entry: DiagnosticEntry): void {
    const target = entry.target
    if (target === null) this.root.dispatch({ type: 'select', id: null })
    else this.root.dispatch({ type: 'select', ...target }, { to: 'selection' })
  }
}
