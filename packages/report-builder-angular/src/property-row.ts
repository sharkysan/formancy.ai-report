/**
 * One field of the properties: its label, its native control and, after a
 * refusal or about a problem, why -- drawn where the properties stand it,
 * by itself or in a group (0039), from the same template.
 *
 * A field commits when it changes: a text on leaving it, or on Enter in a
 * single-line one; a select or a checkbox at once. A value given back as it
 * already stands is not sent, so the change event a browser fires after
 * Enter commits nothing twice. Escape in a typed field gives back what the
 * report holds, so leaving it afterwards commits nothing. A value the
 * editor takes as no edit -- a count emptied, which reads one (0059) --
 * changes nothing the template binds, so Angular would leave what was
 * typed in the control: once committed, the control takes back what the
 * field reads, as React's draft gives way to it. A refused value
 * stays as typed, marked invalid and described by the reason, which is
 * shown under it; the editor keeps both, so they survive a re-render.
 */
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core'
import type { PropertyField } from '@formancy/report-builder-core'
import { ReportEditorRoot } from './root'

/** The native control for a role: a textbox is a text input, a spinbutton a number input. */
export const CONTROLS = { textbox: 'text', spinbutton: 'number', combobox: 'select', checkbox: 'checkbox' } as const

export type Control = (typeof CONTROLS)[keyof typeof CONTROLS] | 'textarea'

/** A field as the properties draw it: with its control and its ids. */
export interface Shown {
  readonly field: PropertyField
  readonly control: Control
  readonly id: string
  readonly errorId: string | null
}

@Component({
  selector: 'div[reportPropertyRow]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-report-part': 'property',
    '[attr.data-kind]': 'shown().field.kind',
  },
  template: `
    <label [attr.for]="shown().id">{{ shown().field.label }}</label>
    @switch (shown().control) {
      @case ('textarea') {
        <textarea
          [id]="shown().id"
          [value]="shown().field.value"
          [required]="shown().field.required"
          [attr.placeholder]="shown().field.placeholder ?? null"
          [attr.aria-invalid]="shown().errorId === null ? null : 'true'"
          [attr.aria-describedby]="shown().errorId"
          (change)="commit(shown().field, $any($event.target).value, $any($event.target))"
          (keydown.escape)="giveBack(shown().field, $event)"
        ></textarea>
      }
      @case ('checkbox') {
        <input
          type="checkbox"
          [id]="shown().id"
          [checked]="shown().field.value === true"
          [attr.aria-invalid]="shown().errorId === null ? null : 'true'"
          [attr.aria-describedby]="shown().errorId"
          (change)="commit(shown().field, $any($event.target).checked)"
        />
      }
      @case ('select') {
        <select
          [id]="shown().id"
          [required]="shown().field.required"
          [attr.aria-invalid]="shown().errorId === null ? null : 'true'"
          [attr.aria-describedby]="shown().errorId"
          (change)="commit(shown().field, $any($event.target).value)"
        >
          @for (option of shown().field.options ?? []; track option.value) {
            <option [value]="option.value" [selected]="option.value === shown().field.value">{{ option.label }}</option>
          }
        </select>
      }
      @default {
        <input
          [type]="shown().control"
          [attr.step]="shown().control === 'number' ? 'any' : null"
          [id]="shown().id"
          [value]="shown().field.value"
          [required]="shown().field.required"
          [attr.placeholder]="shown().field.placeholder ?? null"
          [attr.aria-invalid]="shown().errorId === null ? null : 'true'"
          [attr.aria-describedby]="shown().errorId"
          (change)="commit(shown().field, $any($event.target).value, $any($event.target))"
          (keydown.enter)="enter(shown().field, $event)"
          (keydown.escape)="giveBack(shown().field, $event)"
        />
      }
    }
    @if (shown().errorId !== null) {
      <p data-report-part="property-error" class="wb-problem" [id]="shown().errorId">{{ shown().field.error }}</p>
    }
  `,
})
export class ReportPropertyRow {
  private readonly root = inject(ReportEditorRoot)
  readonly shown = input.required<Shown>()

  /** The field as the editor has it now. */
  private now(field: PropertyField): PropertyField | undefined {
    return this.root.state().properties.fields.find((candidate) => candidate.key === field.key)
  }

  /** `value` sent, where it is not what the field holds; then, for a typed control, what the field reads back in it. */
  protected commit(field: PropertyField, value: string | boolean, control?: HTMLInputElement | HTMLTextAreaElement): void {
    // An Enter's commit has landed by the time the browser's change event follows it.
    const now = this.now(field)
    if (now !== undefined && now.value === value) return
    this.root.dispatch({ type: 'setProperty', key: field.key, value })
    // Taken as no edit, it leaves every binding as it was, so Angular writes nothing into the control.
    const reads = this.now(field)?.value
    if (control !== undefined && reads !== undefined && control.value !== String(reads)) control.value = String(reads)
  }

  protected enter(field: PropertyField, event: Event): void {
    event.preventDefault()
    const control = event.target as HTMLInputElement
    this.commit(field, control.value, control)
  }

  /** Escape: what the report holds, back in the field, so nothing typed since is committed when it is left. */
  protected giveBack(field: PropertyField, event: Event): void {
    const now = this.now(field) ?? field
    ;(event.target as HTMLInputElement | HTMLTextAreaElement).value = String(now.value)
  }
}
