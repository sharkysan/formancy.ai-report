/**
 * The report's images, listed under its own properties (0033): a group
 * named by the catalogue, with a row per image the report declares -- its
 * label as text, and a Remove named after the image.
 *
 * A Remove whose image something draws is `aria-disabled`, described by
 * what draws it, and still sends `removeImage`, so the live region says
 * why nothing happened. One that removed its image takes its own button
 * away, so the keyboard goes to the first field, as the way back to the
 * report's properties takes it; a refused one leaves it where it is.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core'
import { ReportEditorRoot } from './root'

@Component({
  selector: 'div[reportImageLibrary]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-label]': 'root.t()("images.heading")',
  },
  template: `
    @for (image of root.state().images.assets; track image.id; let at = $index) {
      <div data-report-part="property">
        <span>{{ image.label }}</span>
        <button
          type="button"
          [attr.aria-label]="image.removeLabel"
          [attr.aria-disabled]="image.inUse === undefined ? null : 'true'"
          [attr.aria-describedby]="image.inUse === undefined ? null : why(at)"
          (click)="remove(image.id)"
        >{{ root.t()('images.remove') }}@if (image.inUse !== undefined) {<span [id]="why(at)" hidden>{{ image.inUse }}</span>}</button>
      </div>
    }
  `,
})
export class ReportImageLibrary {
  protected readonly root = inject(ReportEditorRoot)

  protected why(at: number): string {
    return `${this.root.id}-image-${String(at)}-in-use`
  }

  protected remove(asset: string): void {
    this.root.attempt({ type: 'removeImage', asset }, { to: 'pane', panel: 'properties' })
  }
}
