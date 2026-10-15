/**
 * The live region: what the last action did, or why it did nothing, in the
 * editor's words.
 *
 * Shown, not hidden, because a sighted keyboard user needs the same
 * confirmation. Each announcement is a new element, keyed by the editor's
 * count of them, so saying the same words twice -- "Nothing to undo." on a
 * second Ctrl+Z -- is announced twice rather than taken for no change.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { ReportEditorRoot } from './root'

@Component({
  selector: 'p[reportStatus]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'data-report-part': 'status' },
  template: `@for (said of said(); track said.sequence) {<span>{{ said.text }}</span>}`,
})
export class ReportStatus {
  private readonly root = inject(ReportEditorRoot)
  protected readonly said = computed(() => {
    const status = this.root.state().status
    return status.text === '' ? [] : [status]
  })
}
