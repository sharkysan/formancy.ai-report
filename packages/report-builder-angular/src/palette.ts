/**
 * The palette: one button per kind of component the report format has.
 *
 * Activating one -- a click, Enter or Space -- opens the place chooser for
 * that kind, which is the keyboard's path for the drag (formancy.ai 0046).
 * Dragging one onto the design view is the pointer's. A kind the report
 * cannot hold yet stays in the list, `aria-disabled` and described by what
 * to declare first, so it is found rather than missed; activating it
 * announces the same.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import type { PaletteEntry } from '@formancy/report-builder-core'
import { ReportEditorRoot } from './root'

@Component({
  selector: 'div[reportPalette]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    'data-report-part': 'palette',
    '[attr.aria-label]': 't()("pane.palette")',
  },
  template: `
    @for (entry of state().palette; track entry.kind) {
      <button
        type="button"
        data-report-part="palette-item"
        draggable="true"
        [attr.data-kind]="entry.kind"
        [attr.aria-disabled]="entry.component === null ? 'true' : null"
        [attr.aria-describedby]="entry.unavailable === undefined ? null : why(entry)"
        (click)="choose(entry, $event)"
        (dragstart)="drag(entry, $event)"
        (dragend)="root.dragEnded()"
      >{{ entry.label }}@if (entry.unavailable !== undefined) {<span [id]="why(entry)" hidden>{{ entry.unavailable }}</span>}</button>
    }
  `,
})
export class ReportPalette {
  protected readonly root = inject(ReportEditorRoot)
  protected readonly state = this.root.state
  protected readonly t = this.root.t

  protected why(entry: PaletteEntry): string {
    return `${this.root.id}-unavailable-${entry.kind}`
  }

  protected choose(entry: PaletteEntry, event: Event): void {
    this.root.choosePlace({ kind: entry.kind }, event.currentTarget as HTMLElement)
  }

  protected drag(entry: PaletteEntry, event: DragEvent): void {
    this.root.pickUp(event, { kind: entry.kind }, entry.label)
  }
}
