/**
 * The outline: the report's regions, and every component and table column
 * in them, as a tree.
 *
 * The rows are flat, in the order a person reads the report, with the depth
 * said by `aria-level` and the place among siblings by `aria-posinset` and
 * `aria-setsize` -- as formancy's builder's structure tree does -- so a
 * row's accessible name is its own label and never its children's too.
 * One row is a tab stop, the selected one, else the first; with no rows the
 * tree itself is, empty and described by the builder's sentence that says
 * so, so a keyboard learns there is nothing rather than skipping it. Focus and selection are one: focus moving to a row selects it, and
 * every action that selects moves focus to its row. The keys (arrows, Home
 * and End, Alt with an arrow to move, Delete, Ctrl+D) are the root's,
 * decided by report-builder-core's `actionForKey`. Each region is a group
 * named by its label. After the regions, at the tree's top, a row for each
 * part of the report's own level: its payment part, which prints after
 * every region (0039), selected as a row is and dragged nowhere.
 *
 * A row can be dragged, and a drag dropped on a row lands just before it or
 * just after it -- the upper or the lower half -- through the editor's
 * `targetBeside`, among the places the session accepts.
 */
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject } from '@angular/core'
import { targetBeside } from '@formancy/report-builder-core'
import type { OutlineNode, OutlinePart } from '@formancy/report-builder-core'
import { ReportEditorRoot } from './root'

/** A node with its place among its siblings. */
interface Row {
  readonly node: OutlineNode
  readonly position: number
  readonly siblings: number
}

/** Every row under `nodes`, each before what it holds. */
function rows(nodes: readonly OutlineNode[], into: Row[] = []): Row[] {
  nodes.forEach((node, at) => {
    into.push({ node, position: at + 1, siblings: nodes.length })
    rows(node.children, into)
  })
  return into
}

@Component({
  selector: 'div[reportOutline]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'tree',
    'data-report-part': 'outline',
    '[attr.aria-label]': 't()("pane.outline")',
    // With rows, focus from a script only: where it goes when an action
    // leaves nothing selected, since a row given focus would select itself.
    '[attr.tabindex]': 'stop() === undefined ? 0 : -1',
    '[attr.aria-describedby]': 'stop() === undefined ? root.outlineEmpty : null',
    '(dragover)': 'over($event)',
    '(drop)': 'root.putDown($event)',
  },
  // With no row at all the tree holds nothing: a tree owns rows, and a
  // region's name with none under it is not one. The builder says, beside
  // it, that it is empty (root.outlineEmpty).
  template: `
    @if (stop() !== undefined) {
    @for (region of regions(); track region.region) {
      <div role="group" data-report-part="outline-region" [attr.aria-label]="region.label">
        <span data-report-part="region-label" aria-hidden="true">{{ region.label }}</span>
        @for (row of region.rows; track row.node.key) {
          <div
            role="treeitem"
            data-report-part="outline-item"
            [attr.data-kind]="row.node.kind"
            [attr.aria-level]="row.node.depth + 1"
            [attr.aria-posinset]="row.position"
            [attr.aria-setsize]="row.siblings"
            [attr.aria-selected]="row.node.selected"
            [attr.aria-describedby]="described(row.node)"
            [attr.draggable]="row.node.column === undefined ? 'true' : null"
            [tabIndex]="row.node.key === stop() ? 0 : -1"
            (focus)="focused(row.node)"
            (click)="select(row.node)"
            (dragstart)="drag(row.node, $event)"
            (dragend)="root.dragEnded()"
          >{{ row.node.label }}@if (row.node.problems > 0) {
              <!-- The count is drawn, and said as the row's description: inside
                   the name it would make "Introduction" read "Introduction 1". -->
              <span data-report-part="badge" [attr.data-severity]="row.node.severity ?? null" aria-hidden="true">{{ row.node.problems }}</span>
              <span [id]="problems(row.node)" hidden>{{ t()('outline.problems', { count: row.node.problems }) }}</span>
            }
            @if (row.node.overflows) {
              <!-- What the canvas marks on a box too wide for its place, said where a keyboard is. -->
              <span [id]="overflow(row.node)" hidden>{{ t()('canvas.overflow') }}</span>
            }</div>
        } @empty {
          <span>{{ t()('outline.empty') }}</span>
        }
      </div>
    }
    @for (part of parts(); track part.key; let at = $index) {
      <div
        role="treeitem"
        data-report-part="outline-item"
        aria-level="1"
        [attr.aria-posinset]="at + 1"
        [attr.aria-setsize]="parts().length"
        [attr.aria-selected]="part.selected"
        [attr.aria-describedby]="part.problems > 0 ? problems(part) : null"
        [tabIndex]="part.key === stop() ? 0 : -1"
        (focus)="focusedPart(part)"
        (click)="selectPart(part)"
      >{{ part.label }}@if (part.problems > 0) {
          <span data-report-part="badge" [attr.data-severity]="part.severity ?? null" aria-hidden="true">{{ part.problems }}</span>
          <span [id]="problems(part)" hidden>{{ t()('outline.problems', { count: part.problems }) }}</span>
        }</div>
    }
    }
  `,
})
export class ReportOutline {
  protected readonly root = inject(ReportEditorRoot)
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)
  protected readonly t = this.root.t
  protected readonly regions = computed(() => this.root.state().outline.map((region) => ({ region: region.region, label: region.label, rows: rows(region.nodes) })))
  // ES2018, as ng-packagr compiles the published sources: no flatMap.
  private readonly all = computed(() => this.regions().reduce<OutlineNode[]>((nodes, region) => nodes.concat(region.rows.map((row) => row.node)), []))
  /** The rows of the parts of the report's own level, after the regions'. */
  protected readonly parts = computed(() => this.root.state().outlineParts)
  /** The row Tab lands on: the selected one, else the first; none when the tree is empty. */
  protected readonly stop = computed(() => {
    const all: readonly { readonly key: string; readonly selected: boolean }[] = [...this.all(), ...this.parts()]
    return (all.find((row) => row.selected) ?? all[0])?.key
  })

  protected problems(row: OutlineNode | OutlinePart): string {
    return `${this.root.id}-problems-${row.key}`
  }

  protected overflow(node: OutlineNode): string {
    return `${this.root.id}-overflow-${node.key}`
  }

  /** The ids of what describes a row: how many problems it has, and that it is wider than its place. */
  protected described(node: OutlineNode): string | null {
    const ids = [...(node.problems > 0 ? [this.problems(node)] : []), ...(node.overflows ? [this.overflow(node)] : [])]
    return ids.length === 0 ? null : ids.join(' ')
  }

  protected select(node: OutlineNode): void {
    this.root.dispatch({ type: 'select', id: node.id, ...(node.column === undefined ? {} : { column: node.column }) }, { to: 'selection' })
  }

  /** Focus that arrives on a row -- by Tab, or put there after an undo -- selects it, so the properties beside it are the focused row's. */
  protected focused(node: OutlineNode): void {
    if (!node.selected) this.root.dispatch({ type: 'select', id: node.id, ...(node.column === undefined ? {} : { column: node.column }) })
  }

  protected selectPart(part: OutlinePart): void {
    this.root.dispatch({ type: 'select', part: part.part }, { to: 'selection' })
  }

  protected focusedPart(part: OutlinePart): void {
    if (!part.selected) this.root.dispatch({ type: 'select', part: part.part })
  }

  protected drag(node: OutlineNode, event: DragEvent): void {
    this.root.pickUp(event, { id: node.id }, node.label)
  }

  /**
   * The place beside the row the pointer is over: before it over its upper
   * half, after it over its lower half. A row with no such place -- the one
   * being moved, a table's column -- takes no drop, and says so to the
   * browser by leaving the dragover alone.
   */
  protected over(event: DragEvent): void {
    const drag = this.root.state().drag
    if (drag?.via !== 'pointer') return
    const element = (event.target as Element).closest('[role="treeitem"]')
    const node = element === null ? undefined : this.all()[[...this.host.nativeElement.querySelectorAll('[role="treeitem"]')].indexOf(element)]
    let over: number | null = null
    if (element !== null && node !== undefined && node.column === undefined) {
      const box = element.getBoundingClientRect()
      over = targetBeside(this.root.state().dropTargets, node.id, event.clientY < box.top + box.height / 2 ? 'before' : 'after')
    }
    if (over !== null) event.preventDefault()
    if (over !== drag.over) this.root.dispatch({ type: 'updateDrag', over })
  }
}
