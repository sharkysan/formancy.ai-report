/**
 * The properties: one native control per field of the selection, or of the
 * report when nothing is selected, each labelled by its field's label.
 *
 * Which control a field gets is `PROPERTY_ROLES`, report-builder-core's, so
 * the role a test finds and the role the Angular builder renders are the
 * same. A typed value is the person's until it is committed -- on leaving
 * the field, or Enter in a single-line one -- and a value the editor refuses
 * stays as typed, `aria-invalid`, with the reason beside it as its
 * description. Escape gives back what the report holds.
 */
import { useState } from 'react'
import type { KeyboardEvent, ReactElement } from 'react'
import type { EditorAction, EditorState, EditorText, PropertyField } from '@formancy/report-builder-core'

export interface PropertiesProps {
  readonly state: EditorState
  readonly ids: string
  /** The element whose text names the form: the pane's heading. */
  readonly heading: string
  readonly act: (action: EditorAction) => void
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

export function Properties({ state, ids, heading, act }: PropertiesProps): ReactElement {
  return (
    <form aria-labelledby={heading} data-report-part="properties" onSubmit={(event) => event.preventDefault()}>
      {state.properties.fields.map((field, at) => {
        const id = `${ids}-field-${at}`
        const error = `${id}-error`
        const validity: Validity = field.error === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': error }
        return (
          // A draft never outlives its field: leaving the field commits it, before anything else can be selected.
          <div key={field.key} data-report-part="property" data-kind={field.kind}>
            <label htmlFor={id}>{field.label}</label>
            <Control field={field} id={id} validity={validity} commit={(value) => act({ type: 'setProperty', key: field.key, value })} />
            {field.error === undefined ? null : (
              <p id={error} data-report-part="property-error">
                {field.error}
              </p>
            )}
          </div>
        )
      })}
    </form>
  )
}
