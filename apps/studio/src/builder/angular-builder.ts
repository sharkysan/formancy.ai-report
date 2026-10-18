/**
 * The Angular builder as the Studio shows it: `<report-builder>` over the
 * editor the application was started with, and nothing else -- the same
 * builder a host puts on its page, so a difference on screen between the
 * two frameworks is a difference of builder.
 *
 * Its view, the Studio's Preview, given as the builder's
 * `<ng-template reportHostView>`: an element the builder stamps into its
 * middle while the Preview stands there (0029), handed to the Studio
 * through `STUDIO_SLOT` for React to draw the Preview into, and handed
 * back, as null, when the builder takes it away. The Preview is one React
 * component in both builders; Angular owns the element and nothing drawn
 * in it, as the Studio's mount owns the builder's host and nothing Angular
 * draws in it.
 *
 * `display: contents` on the host and on that element, so the builder's
 * root is laid out by the Studio's pane as the React builder's root is,
 * and the Preview fills the box the builder lends it as it does in React's.
 *
 * **This file holds the component and nothing else**, for the reason in
 * angular-editor.ts.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, viewChild } from '@angular/core'
import type { ElementRef } from '@angular/core'
import { ReportBuilder, ReportHostView } from '@formancy/report-builder-angular'
import { STUDIO_EDITOR, STUDIO_SLOT } from './angular-editor.js'

@Component({
  selector: 'report-studio-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportBuilder, ReportHostView],
  host: { style: 'display: contents' },
  template: `
    <report-builder [editor]="editor">
      <ng-template reportHostView><div #slot style="display: contents"></div></ng-template>
    </report-builder>
  `,
})
export class StudioAngularBuilder {
  protected readonly editor = inject(STUDIO_EDITOR)
  // A query follows a template to where it is declared, here, wherever the builder stamps it.
  private readonly slot = viewChild<ElementRef<HTMLElement>>('slot')

  constructor() {
    const lend = inject(STUDIO_SLOT)
    effect(() => lend(this.slot()?.nativeElement ?? null))
    inject(DestroyRef).onDestroy(() => lend(null))
  }
}
