/**
 * The properties of what is selected, or of the report when nothing is: a
 * form named by the pane's heading, with one native control per field,
 * labelled by the field's label, with the role report-builder-core's
 * `PROPERTY_ROLES` gives its kind -- the control is chosen from that role,
 * so the two cannot disagree -- and required where the field is. Each
 * field is a `property-row.ts`, which says when it commits.
 *
 * Fields the editor groups -- a QR-bill's creditor and debtor (0039), an
 * e-invoice's parties, its VAT categories and its payment instructions
 * (0044) -- are a `group` named in the editor's words, their name drawn and
 * hidden from the tree, which reads the group's own, and the group's
 * buttons after them, one with nowhere to go `aria-disabled` and still
 * sent. A button keeps the keyboard where it is as its words change, Add
 * to Remove and back, unless the editor says where it goes once done
 * (`then`): the same button of the group a VAT category moved to, the
 * list's Add once one is removed, a new one's first field (`root.ts`). Add
 * QR-bill, which gives the properties the bill's in place of the report's,
 * takes its own button away, and the keyboard goes to the first field, the
 * bill's IBAN, as it does when a Remove takes its row.
 * Under the report's own fields, its images (`image-library.ts`, 0033).
 *
 * Each run of a paragraph is such a group, its buttons Subscript and
 * Superscript, each named after the run, showing only its own word, and
 * `aria-pressed` as the run is set (0061). Pressed, one sends the
 * selection of its group's text field -- its start, its end and the text
 * it is of -- read from the element as the button is pressed: the one
 * thing only the DOM knows, which the editor applies to the text the
 * report holds and to nothing else. The keyboard then goes where the
 * editor's outcome says, the run that holds the text now.
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { PROPERTY_ROLES } from '@formancy/report-builder-core'
import type { EditorAction, PropertyAction, PropertyField } from '@formancy/report-builder-core'
import { ReportImageLibrary } from './image-library'
import { CONTROLS, ReportPropertyRow } from './property-row'
import type { Control, Shown } from './property-row'
import { ReportEditorRoot } from './root'

/**
 * What a group's button sends: a run's `setBaseline` with what its group's
 * text field has selected, read from the element now, as only the DOM
 * knows it (0061); any other action as the state gives it. A field bound
 * to a value is a select, and has no selection: its run is set whole.
 */
function sent(action: EditorAction, group: HTMLElement): EditorAction {
  if (action.type !== 'setBaseline') return action
  const field = group.querySelector('input, textarea')
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || field.selectionStart === null || field.selectionEnd === null)
    return action
  return { ...action, selected: { start: field.selectionStart, end: field.selectionEnd, text: field.value } }
}

/** A group of fields as the form draws it: its name, its fields and its buttons. */
interface ShownGroup {
  readonly label: string
  readonly fields: readonly Shown[]
  readonly actions: readonly PropertyAction[]
}

/** A row of the form: a field by itself, or a group of them with its button; the other one null. */
interface Row {
  readonly key: string
  readonly field: Shown | null
  readonly group: ShownGroup | null
}

@Component({
  selector: 'form[reportProperties]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportImageLibrary, ReportPropertyRow],
  host: {
    'data-report-part': 'properties',
    '[attr.aria-label]': 'root.state().properties.heading',
    // Enter in a single-line field commits it; the browser's implicit submission would reload the page.
    '(submit)': '$event.preventDefault()',
  },
  template: `
    @for (row of rows(); track row.key) {
      @if (row.group; as group) {
        <div #element role="group" data-report-part="property-group" [attr.aria-label]="group.label">
          <span aria-hidden="true">{{ group.label }}</span>
          @for (shown of group.fields; track shown.id) {
            <div reportPropertyRow [shown]="shown"></div>
          }
          @for (action of group.actions; track $index) {
            <button
              type="button"
              [attr.aria-label]="action.text === undefined ? null : action.label"
              [attr.aria-pressed]="action.pressed === undefined ? null : action.pressed"
              [attr.aria-disabled]="action.available ? null : 'true'"
              (click)="press(action, element)"
            >{{ action.text ?? action.label }}</button>
          }
        </div>
      } @else {
        <div reportPropertyRow [shown]="fieldOf(row)"></div>
      }
    }
    @if (root.state().selection === null && root.state().images.assets.length > 0) {
      <div reportImageLibrary></div>
    }
  `,
})
export class ReportProperties {
  protected readonly root = inject(ReportEditorRoot)

  /**
   * Each row, each field with its control and ids. The ids carry whose
   * fields these are, and the rows are tracked by them, so a field of the
   * next selection is a new control rather than one still holding what was
   * typed into the last selection's.
   */
  protected readonly rows = computed<readonly Row[]>(() => {
    const { selection, properties } = this.root.state()
    const owner =
      selection === null ? 'report' : 'part' in selection ? selection.part : `${selection.id}${selection.column === undefined ? '' : `-${selection.column}`}`
    let index = 0
    const shown = (field: PropertyField): Shown => {
      const id = `${this.root.id}-${owner}-${String(index)}`
      index += 1
      const control: Control = field.kind === 'multiline' ? 'textarea' : CONTROLS[PROPERTY_ROLES[field.kind]]
      const errorId = field.error === undefined ? null : `${id}-error`
      const noteId = field.note === undefined ? null : `${id}-note`
      const described = [errorId, noteId].filter((part) => part !== null).join(' ')
      return { field, control, id, errorId, noteId, describedBy: described === '' ? null : described }
    }
    return properties.rows.map((row): Row => {
      if ('field' in row) {
        const field = shown(row.field)
        return { key: field.id, field, group: null }
      }
      const { group } = row
      return {
        key: `${this.root.id}-${owner}-${group.key}`,
        field: null,
        group: { label: group.label, fields: group.fields.map(shown), actions: group.actions },
      }
    })
  })

  /** The field of a row that is no group. */
  protected fieldOf(row: Row): Shown {
    return row.field as Shown
  }

  /** A group's button: what it says it does, the keyboard going where the editor says once it is done. */
  protected press(action: PropertyAction, group: HTMLElement): void {
    this.root.attempt(sent(action.action, group), action.then === undefined ? undefined : { to: 'group', ...action.then })
  }
}
