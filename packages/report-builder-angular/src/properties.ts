/**
 * The properties of what is selected, or of the report when nothing is: a
 * form named by the pane's heading, with one native control per field,
 * labelled by the field's label, with the role report-builder-core's
 * `PROPERTY_ROLES` gives its kind -- the control is chosen from that role,
 * so the two cannot disagree -- and required where the field is.
 *
 * A field commits when it changes: a text on leaving it, or on Enter in a
 * single-line one; a select or a checkbox at once. A value given back as it
 * already stands is not sent, so the change event a browser fires after
 * Enter commits nothing twice. Escape in a typed field gives back what the
 * report holds, so leaving it afterwards commits nothing. A refused value
 * stays as typed, marked invalid and described by the reason, which is
 * shown under it; the editor keeps both, so they survive a re-render.
 * Under the report's own fields, its images (`image-library.ts`, 0033).
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core'
import { PROPERTY_ROLES } from '@formancy/report-builder-core'
import type { PropertyField } from '@formancy/report-builder-core'
import { ReportImageLibrary } from './image-library'
import { ReportEditorRoot } from './root'

/** The native control for a role: a textbox is a text input, a spinbutton a number input. */
const CONTROLS = { textbox: 'text', spinbutton: 'number', combobox: 'select', checkbox: 'checkbox' } as const

type Control = (typeof CONTROLS)[keyof typeof CONTROLS] | 'textarea'

interface Shown {
  readonly field: PropertyField
  readonly control: Control
  readonly id: string
  readonly errorId: string | null
}

@Component({
  selector: 'form[reportProperties]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReportImageLibrary],
  host: {
    'data-report-part': 'properties',
    '[attr.aria-label]': 'root.state().properties.heading',
    // Enter in a single-line field commits it; the browser's implicit submission would reload the page.
    '(submit)': '$event.preventDefault()',
  },
  template: `
    @for (shown of shown(); track shown.id) {
      <div data-report-part="property" [attr.data-kind]="shown.field.kind">
        <label [attr.for]="shown.id">{{ shown.field.label }}</label>
        @switch (shown.control) {
          @case ('textarea') {
            <textarea
              [id]="shown.id"
              [value]="shown.field.value"
              [required]="shown.field.required"
              [attr.placeholder]="shown.field.placeholder ?? null"
              [attr.aria-invalid]="shown.errorId === null ? null : 'true'"
              [attr.aria-describedby]="shown.errorId"
              (change)="commit(shown.field, $any($event.target).value)"
              (keydown.escape)="giveBack(shown.field, $event)"
            ></textarea>
          }
          @case ('checkbox') {
            <input
              type="checkbox"
              [id]="shown.id"
              [checked]="shown.field.value === true"
              [attr.aria-invalid]="shown.errorId === null ? null : 'true'"
              [attr.aria-describedby]="shown.errorId"
              (change)="commit(shown.field, $any($event.target).checked)"
            />
          }
          @case ('select') {
            <select
              [id]="shown.id"
              [required]="shown.field.required"
              [attr.aria-invalid]="shown.errorId === null ? null : 'true'"
              [attr.aria-describedby]="shown.errorId"
              (change)="commit(shown.field, $any($event.target).value)"
            >
              @for (option of shown.field.options ?? []; track option.value) {
                <option [value]="option.value" [selected]="option.value === shown.field.value">{{ option.label }}</option>
              }
            </select>
          }
          @default {
            <input
              [type]="shown.control"
              [attr.step]="shown.control === 'number' ? 'any' : null"
              [id]="shown.id"
              [value]="shown.field.value"
              [required]="shown.field.required"
              [attr.placeholder]="shown.field.placeholder ?? null"
              [attr.aria-invalid]="shown.errorId === null ? null : 'true'"
              [attr.aria-describedby]="shown.errorId"
              (change)="commit(shown.field, $any($event.target).value)"
              (keydown.enter)="enter(shown.field, $event)"
              (keydown.escape)="giveBack(shown.field, $event)"
            />
          }
        }
        @if (shown.errorId !== null) {
          <p data-report-part="property-error" class="wb-problem" [id]="shown.errorId">{{ shown.field.error }}</p>
        }
      </div>
    }
    @if (root.state().selection === null && root.state().images.assets.length > 0) {
      <div reportImageLibrary></div>
    }
  `,
})
export class ReportProperties {
  protected readonly root = inject(ReportEditorRoot)

  /**
   * Each field with its control and ids. The ids carry whose fields these
   * are, and the rows are tracked by them, so a field of the next selection
   * is a new control rather than one still holding what was typed into the
   * last selection's.
   */
  protected readonly shown = computed<readonly Shown[]>(() => {
    const { selection, properties } = this.root.state()
    const owner = selection === null ? 'report' : `${selection.id}${selection.column === undefined ? '' : `-${selection.column}`}`
    return properties.fields.map((field, index) => {
      const id = `${this.root.id}-${owner}-${String(index)}`
      const control: Control = field.kind === 'multiline' ? 'textarea' : CONTROLS[PROPERTY_ROLES[field.kind]]
      return { field, control, id, errorId: field.error === undefined ? null : `${id}-error` }
    })
  })

  protected commit(field: PropertyField, value: string | boolean): void {
    // The field as the editor has it now: an Enter's commit has landed by the time the browser's change event follows it.
    const now = this.root.state().properties.fields.find((candidate) => candidate.key === field.key)
    if (now !== undefined && now.value === value) return
    this.root.dispatch({ type: 'setProperty', key: field.key, value })
  }

  protected enter(field: PropertyField, event: Event): void {
    event.preventDefault()
    this.commit(field, (event.target as HTMLInputElement).value)
  }

  /** Escape: what the report holds, back in the field, so nothing typed since is committed when it is left. */
  protected giveBack(field: PropertyField, event: Event): void {
    const now = this.root.state().properties.fields.find((candidate) => candidate.key === field.key) ?? field
    ;(event.target as HTMLInputElement | HTMLTextAreaElement).value = String(now.value)
  }
}
