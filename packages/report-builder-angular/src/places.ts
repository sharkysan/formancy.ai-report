/**
 * The place chooser: the keyboard's path for every drag (formancy.ai 0046).
 *
 * While a person chooses where to put something by keyboard, this is a
 * dialog named for what is being placed, with a button per place the
 * session accepts -- report-core's `validLocations`, named by
 * report-builder-core -- and a Cancel button. It floats over the outline
 * pane, a pane of the workbench's own, so the design view beside it stays
 * in sight. Focus moves to the first place when it opens, or to Cancel when
 * there is none, which the dialog's description then explains; the place a
 * button stands for is drawn on the canvas while the button has focus.
 * Choosing one puts focus on the outline row of what was placed; Cancel, or
 * Escape, puts it back on what opened the chooser. It is not modal: the
 * rest of the editor stays usable while it is open.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import type { DropTarget } from '@formancy/report-builder-core'
import { ReportEditorRoot } from './root'

@Component({
  selector: 'div[reportPlaces]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-report-part': 'places',
    // The workbench dresses a pane's buttons; idle, the chooser is no pane,
    // because the pane's display would override \`hidden\`.
    '[class.wb-pane]': 'choosing() !== null',
    '[hidden]': 'choosing() === null',
    '[attr.role]': 'choosing() === null ? null : "dialog"',
    '[attr.aria-labelledby]': 'choosing() === null ? null : title',
    '[attr.aria-describedby]': 'choosing()?.nowhere === undefined ? null : nowhere',
  },
  template: `
    @if (choosing(); as drag) {
      <header [id]="title">{{ drag.title }}</header>
      @if (drag.nowhere !== undefined) {
        <p class="wb-problem" [id]="nowhere">{{ drag.nowhere }}</p>
      }
      @for (target of state().dropTargets; track target.index) {
        <button type="button" data-report-part="place" (focus)="show(target)" (click)="root.place(drag.subject, target)">{{ target.label }}</button>
      }
      <button type="button" (click)="root.cancelPlacing()">{{ t()('places.cancel') }}</button>
    }
  `,
})
export class ReportPlaces {
  protected readonly root = inject(ReportEditorRoot)
  protected readonly state = this.root.state
  protected readonly t = this.root.t
  /** The drag a keyboard is choosing a place for; a pointer's is drawn on the canvas instead. */
  protected readonly choosing = computed(() => {
    const drag = this.state().drag
    return drag?.via === 'keyboard' ? drag : null
  })
  protected readonly title = `${this.root.id}-places`
  protected readonly nowhere = `${this.root.id}-nowhere`

  protected show(target: DropTarget): void {
    this.root.dispatch({ type: 'updateDrag', over: target.index })
  }
}
