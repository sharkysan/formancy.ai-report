/**
 * The properties: one native control per field of the selection, or of the
 * report when nothing is selected, each labelled by its field's label.
 *
 * Which control a field gets is `PROPERTY_ROLES`, report-builder-core's, so
 * the role a test finds and the role the Angular builder renders are the
 * same. A typed value is the person's until it is committed -- on leaving
 * the field, or Enter in a single-line one -- and a value the editor refuses
 * stays as typed, `aria-invalid`, with the reason beside it as its
 * description. Escape gives back what the report holds. Under the
 * report's own fields, its images (`library`, 0033).
 *
 * Fields the editor groups -- a QR-bill's creditor and debtor (0039), an
 * e-invoice's parties, its VAT categories and its payment instructions
 * (0044) -- are a `group` named in the editor's words, their name drawn and
 * hidden from the tree, which reads the group's own, and the group's
 * buttons after them, one with nowhere to go `aria-disabled` and still
 * sent. A button keeps the keyboard where it is as its words change, Add to
 * Remove and back, unless the editor says where it goes once done (`then`):
 * the same button of the group a VAT category moved to, the list's Add once
 * one is removed, a new one's first field (report-builder.tsx). Add
 * QR-bill, which gives the properties the bill's in place of the report's,
 * takes its own button away, and the keyboard goes to the first field, the
 * bill's IBAN, as it does when a Remove takes its row.
 */
import { useState } from 'react'
import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import type { EditorAction, EditorState, PropertyAction, PropertyField, PropertyGroup } from '@formancy/report-builder-core'

export interface PropertiesProps {
  readonly state: EditorState
  readonly ids: string
  readonly act: (action: EditorAction) => void
  /** A group's button pressed: its action, and where the keyboard goes once it is done. */
  readonly press: (action: PropertyAction) => void
  /** The report's images, after its fields; nothing while something is selected. */
  readonly library?: ReactNode
}

/** What the control states about validity: invalid, and why, when the field has an error. */
interface Validity {
  readonly 'aria-invalid'?: true
  readonly 'aria-describedby'?: string
}

interface ControlProps {
  readonly field: PropertyField
  readonly id: string
  readonly validity: Validity
  readonly commit: (value: string | boolean) => void
}

/** A text, a colour, an expression, a number or a length: typed, then committed. */
function Typed({ field, id, validity, commit }: ControlProps): ReactElement {
  const held = String(field.value)
  const [draft, setDraft] = useState<string | null>(null)
  const finish = (): void => {
    if (draft !== null && draft !== held) commit(draft)
    setDraft(null)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') setDraft(null)
    else if (event.key === 'Enter' && field.kind !== 'multiline') {
      event.preventDefault()
      finish()
    }
  }
  const shared = {
    id,
    value: draft ?? held,
    required: field.required,
    ...(field.placeholder === undefined ? {} : { placeholder: field.placeholder }),
    ...validity,
    onBlur: finish,
    onKeyDown,
  }
  if (field.kind === 'multiline') return <textarea {...shared} onChange={(event) => setDraft(event.target.value)} />
  const numeric = field.kind === 'number' || field.kind === 'length'
  return (
    <input
      {...shared}
      type={numeric ? 'number' : 'text'}
      // Any decimal the format stores, not the browser's whole-number default step.
      step={numeric ? 'any' : undefined}
      spellCheck={field.kind === 'text' ? undefined : false}
      onChange={(event) => setDraft(event.target.value)}
    />
  )
}

function Control(props: ControlProps): ReactElement {
  const { field, id, validity, commit } = props
  switch (field.kind) {
    case 'boolean':
      return <input id={id} type="checkbox" checked={field.value === true} {...validity} onChange={(event) => commit(event.target.checked)} />
    case 'select':
    case 'binding':
    case 'style':
      return (
        <select id={id} value={String(field.value)} required={field.required} {...validity} onChange={(event) => commit(event.target.value)}>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    default:
      return <Typed {...props} />
  }
}

/** One field's row: its label, its control and, after a refusal or about a problem, why. `at` is its place among every field, for its ids. */
function Row({ field, at, ids, act }: { readonly field: PropertyField; readonly at: number; readonly ids: string; readonly act: PropertiesProps['act'] }): ReactElement {
  const id = `${ids}-field-${at}`
  const error = `${id}-error`
  const validity: Validity = field.error === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': error }
  return (
    <div data-report-part="property" data-kind={field.kind}>
      <label htmlFor={id}>{field.label}</label>
      <Control field={field} id={id} validity={validity} commit={(value) => act({ type: 'setProperty', key: field.key, value })} />
      {field.error === undefined ? null : (
        <p id={error} data-report-part="property-error">
          {field.error}
        </p>
      )}
    </div>
  )
}

/** A group of fields, named in the editor's words, with its buttons after them, each keyed by its place so that it keeps the keyboard as its words change. */
function Group({ group, first, ids, act, press }: { readonly group: PropertyGroup; readonly first: number; readonly ids: string; readonly act: PropertiesProps['act']; readonly press: PropertiesProps['press'] }): ReactElement {
  return (
    <div role="group" aria-label={group.label} data-report-part="property-group">
      <span aria-hidden="true">{group.label}</span>
      {group.fields.map((field, at) => (
        // A draft never outlives its field: leaving the field commits it, before anything else can be selected.
        <Row key={field.key} field={field} at={first + at} ids={ids} act={act} />
      ))}
      {group.actions.map((action, at) => (
        <button key={`action-${String(at)}`} type="button" aria-disabled={action.available ? undefined : true} onClick={() => press(action)}>
          {action.label}
        </button>
      ))}
    </div>
  )
}

export function Properties({ state, ids, act, press, library }: PropertiesProps): ReactElement {
  // Each field's place among every field, for its ids, groups' fields counted where they stand.
  let next = 0
  return (
    // Named in words, as the pane's heading says, never after the heading,
    // which a stylesheet sets in capitals that Chromium would put in the name.
    <form aria-label={state.properties.heading} data-report-part="properties" onSubmit={(event) => event.preventDefault()}>
      {state.properties.rows.map((row) => {
        const first = next
        if ('group' in row) {
          next += row.group.fields.length
          return <Group key={row.group.key} group={row.group} first={first} ids={ids} act={act} press={press} />
        }
        next += 1
        // A draft never outlives its field: leaving the field commits it, before anything else can be selected.
        return <Row key={row.field.key} field={row.field} at={first} ids={ids} act={act} />
      })}
      {library}
    </form>
  )
}
