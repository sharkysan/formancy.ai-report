/**
 * A view of the host's own -- the Studio's PDF -- in the design view's
 * place (0029). The host gives it as a template:
 *
 * ```html
 * <report-builder [editor]="editor">
 *   <ng-template reportHostView><app-preview /></ng-template>
 * </report-builder>
 * ```
 *
 * and the builder stamps it into a bare region, named by the editor's
 * `hostView`, while the editor's `view` is the host's, and destroys it when
 * the design view comes back. A template rather than projected content:
 * Angular makes projected content once, whether its slot is drawn or not,
 * so a view projected into the middle pane would live -- and the Studio's
 * Preview print -- behind the design view.
 *
 * `NgTemplateOutlet` would stamp it, but it is `@angular/common`'s, which is
 * not this package's peer; the outlet below is `@angular/core` alone.
 */
import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core'

/** Marks the template a host gives `<report-builder>` as its view. */
@Directive({ selector: 'ng-template[reportHostView]' })
export class ReportHostView {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef)
}

/**
 * Stamps the host's template where it stands, for as long as it stands
 * there: the builder's template draws it only while the host's view is in
 * the middle, and the view goes with the element when that ends.
 */
@Directive({ selector: '[reportHostOutlet]' })
export class ReportHostOutlet {
  readonly template = input.required<TemplateRef<unknown> | null>({ alias: 'reportHostOutlet' })
  private readonly container = inject(ViewContainerRef)

  constructor() {
    effect(() => {
      const template = this.template()
      this.container.clear()
      if (template !== null) this.container.createEmbeddedView(template)
    })
  }
}
