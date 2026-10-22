/**
 * The design view: one sheet as wide as the page, the regions as bands on
 * it, each component's box in its band, a payment part's band at its foot,
 * rulers in millimetres along two sides. Every size and position is the
 * state's, in pixels at the zoom; this only draws them.
 *
 * It is labelled as not the PDF, because it is not (plan 8). Each box is a
 * picture of where a component stands -- `role="img"`, named by its label,
 * so reading the view says what is on it. A click selects one, and focus
 * follows to its outline row; a box is not a tab stop, because the outline
 * is the keyboard's way to every box. The payment part's band is the same
 * for the bill (0039). The view itself is one stop, so a
 * keyboard can scroll a zoomed sheet. Dragging a palette button, a box or
 * an outline row onto it places at the nearest place the session accepts,
 * with the places drawn, and named, while the drag lasts; the place chooser
 * is the keyboard's path for the same.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { targetNear } from '@formancy/report-builder-core'
import type { CanvasBox } from '@formancy/report-builder-core'
import { ReportEditorRoot } from './root'

@Component({
  selector: 'section[reportCanvas]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-report-part': 'canvas',
    tabindex: '0',
    '[attr.aria-label]': 'canvas().label',
  },
  template: `
    <p data-report-part="canvas-note">{{ canvas().note }}</p>
    <div data-report-part="ruler" data-orientation="horizontal" role="img" [attr.aria-label]="t()('ruler.horizontal')" [style.width.px]="canvas().sheet.px.width">
      @for (tick of canvas().rulers.horizontal; track tick.mm) {
        <span data-report-part="ruler-tick" [attr.data-major]="tick.major ? 'true' : null" [style.left.px]="tick.at">@if (tick.label) {<span>{{ tick.label }}</span>}</span>
      }
    </div>
    <div data-report-part="ruler" data-orientation="vertical" role="img" [attr.aria-label]="t()('ruler.vertical')" [style.height.px]="canvas().sheet.px.height">
      @for (tick of canvas().rulers.vertical; track tick.mm) {
        <span data-report-part="ruler-tick" [attr.data-major]="tick.major ? 'true' : null" [style.top.px]="tick.at">@if (tick.label) {<span>{{ tick.label }}</span>}</span>
      }
    </div>
    <div data-report-part="sheet" [style.width.px]="canvas().sheet.px.width" [style.height.px]="canvas().sheet.px.height" (dragover)="over($event)" (drop)="root.putDown($event)">
      @for (band of canvas().regions; track band.region) {
        <div
          data-report-part="region"
          [attr.data-empty]="band.empty ? 'true' : null"
          [style.left.px]="band.px.x"
          [style.top.px]="band.px.y"
          [style.width.px]="band.px.width"
          [style.height.px]="band.px.height"
        ><span data-report-part="region-label">{{ band.label }}</span></div>
      }
      @for (box of canvas().boxes; track box.key) {
        <div
          role="img"
          data-report-part="box"
          [attr.aria-label]="box.label"
          [attr.data-kind]="box.kind"
          [attr.data-selected]="box.selected ? 'true' : null"
          [attr.data-overflows]="box.overflows ? 'true' : null"
          [attr.data-dragging]="box.id === dragged() && box.column === undefined ? 'true' : null"
          [attr.title]="box.overflows ? t()('canvas.overflow') : null"
          [attr.draggable]="box.column === undefined ? 'true' : null"
          [style.left.px]="box.px.x"
          [style.top.px]="box.px.y"
          [style.width.px]="box.px.width"
          [style.height.px]="box.px.height"
          (click)="select(box)"
          (dragstart)="drag(box, $event)"
          (dragend)="root.dragEnded()"
        ><span data-report-part="box-label">{{ box.label }}</span>@if (box.problems > 0) {<span data-report-part="badge" [attr.data-severity]="box.severity ?? null" aria-hidden="true">{{ box.problems }}</span>}</div>
      }
      <!-- Where a payment part's slip prints, below every region: a picture
           named as SIX names the part, as a box is named by its label, which
           a click selects the bill by, as it does a box's component. -->
      @if (canvas().paymentPart; as band) {
        <div
          role="img"
          data-report-part="payment-part"
          [attr.aria-label]="band.label"
          [attr.data-selected]="band.selected ? 'true' : null"
          [style.left.px]="band.px.x"
          [style.top.px]="band.px.y"
          [style.width.px]="band.px.width"
          [style.height.px]="band.px.height"
          (click)="selectBill()"
        ><span data-report-part="region-label">{{ band.label }}</span>@if (band.problems > 0) {<span data-report-part="badge" [attr.data-severity]="band.severity ?? null" aria-hidden="true">{{ band.problems }}</span>}</div>
      }
      <!-- Drawn only for the places the session accepts, named as the place
           chooser names them; the one under the pointer, or focused in the
           chooser, is marked. -->
      @for (target of state().dropTargets; track target.index) {
        <div
          role="img"
          data-report-part="drop-indicator"
          [attr.aria-label]="target.label"
          [attr.data-over]="target.index === state().drag?.over ? 'true' : null"
          [style.left.px]="target.px.x"
          [style.top.px]="target.px.y"
          [style.width.px]="target.px.width"
          [style.height.px]="target.px.height"
        ></div>
      }
    </div>
  `,
})
export class ReportCanvas {
  protected readonly root = inject(ReportEditorRoot)
  protected readonly state = this.root.state
  protected readonly t = this.root.t
  protected readonly canvas = computed(() => this.state().canvas)
  /** The component being moved, drawn faded where it stands. */
  protected readonly dragged = computed(() => {
    const subject = this.state().drag?.subject
    return subject !== undefined && 'id' in subject ? subject.id : null
  })

  protected select(box: CanvasBox): void {
    this.root.dispatch({ type: 'select', id: box.id, ...(box.column === undefined ? {} : { column: box.column }) }, { to: 'selection' })
  }

  protected selectBill(): void {
    this.root.dispatch({ type: 'select', part: 'paymentPart' }, { to: 'selection' })
  }

  protected drag(box: CanvasBox, event: DragEvent): void {
    // A box inside another is inside its parent's box too: the innermost one moves.
    event.stopPropagation()
    this.root.pickUp(event, { id: box.id }, box.label)
  }

  /**
   * The place nearest the pointer, among those whose list it is over;
   * dropping is allowed only while a pointer drags. The places are in pixels
   * from the sheet's padding edge, where its placed children start: inside
   * its border, which the bounding box includes.
   */
  protected over(event: DragEvent): void {
    const drag = this.state().drag
    if (drag?.via !== 'pointer') return
    event.preventDefault()
    const sheet = event.currentTarget as HTMLElement
    const box = sheet.getBoundingClientRect()
    const over = targetNear(this.state().dropTargets, { x: event.clientX - box.left - sheet.clientLeft, y: event.clientY - box.top - sheet.clientTop })
    if (over !== drag.over) this.root.dispatch({ type: 'updateDrag', over })
  }
}
