/**
 * Where a report's datasets come from in Formancy Data, and what a published
 * form says about the fields a report reads from it -- everything the
 * provider can check before it reads a record.
 */
import type { ListSortTerm, PublishedForm } from '@formancy/data-client'
import type { DatasetContract, DatasetRole, Datasets } from '@formancy/report-spec'

/** The header's one record: a published form, and the token that addresses the record in it. */
export interface HeaderBinding {
  readonly form: string
  readonly record: string
}

/**
 * The detail rows: a published form's records, in the order of `sort`
 * (Data's key order when there is none). `parent` narrows them to one
 * record's children: `'header'` for the header record's, by the lookup
 * field the person's menu names between the two forms, or a field and a
 * record token given outright.
 */
export interface DetailBinding {
  readonly form: string
  readonly parent?: 'header' | { readonly field: string; readonly record: string }
  readonly sort?: readonly ListSortTerm[]
}

/** Which published form each of the report's datasets reads. */
export interface DataBinding {
  readonly header?: HeaderBinding
  readonly detail?: DetailBinding
}

export const PROVIDER_ERROR_CODES = [
  /** A report that `validateReport` refuses: the runtime would refuse it too, and says why. */
  'invalid-report',
  /** A cap that is not a whole number from 1 to the runtime's `MAX_DETAIL_ROWS`. */
  'invalid-cap',
  /** A dataset the report declares and the binding does not say where to read. */
  'unbound-dataset',
  /** A binding for a dataset the report does not declare. */
  'undeclared-dataset',
  /** `parent: 'header'`, and the person's menu does not name the detail form as the header form's child exactly once. */
  'unknown-parent',
  /** A field the report declares that the form does not let this person read, or does not have. */
  'unreadable-field',
  /** An image field: Data 0.1.0 holds no approved asset for one to print. */
  'unsupported-field',
  /** The detail form offers this person no list of its records. */
  'not-listable',
  /** Data answered a binding's form with a published form under another id, or one that is no formancy form id: Data 0.1.0 publishes a form only under its own (0041). */
  'unexpected-form',
  /** A lookup value whose label Data did not give this person. */
  'unresolved-label',
  /** Data refused a request; `refusal` carries its status and code, and the message is its sentence. */
  'refused',
] as const
export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number]

/**
 * What the provider can say is wrong. The path is a JSON Pointer into the
 * binding -- `/detail/parent` -- or into the data it would have handed over
 * -- `/header/customer`, `/detail/17/order`. Neither it nor the message
 * ever holds a value: a token or an answer is the customer's, and an error
 * ends up in a log. Data's own sentences promise the same
 * (formancy.ai-data 0011).
 */
export interface ProviderError {
  readonly path: string
  readonly code: ProviderErrorCode
  readonly message: string
  /** Data's answer, when Data refused: its HTTP status (0 when nothing answered) and its code. */
  readonly refusal?: { readonly status: number; readonly code: string }
}

export const ROLES: readonly DatasetRole[] = ['header', 'detail']

/** A binding that says where each declared dataset is, and nothing else. */
export function bindingErrors(datasets: Datasets, binding: DataBinding): ProviderError[] {
  const errors: ProviderError[] = []
  for (const role of ROLES) {
    const declared = datasets[role] !== undefined
    const bound = binding[role] !== undefined
    if (declared && !bound)
      errors.push({ path: `/${role}`, code: 'unbound-dataset', message: `the report reads a ${role} dataset and the binding names no form for it` })
    if (bound && !declared)
      errors.push({ path: `/${role}`, code: 'undeclared-dataset', message: `the binding names a form for a ${role} dataset the report does not declare` })
  }
  return errors
}

type Field = PublishedForm['form']['model']['fields'][number]

/** Every field whose answer is in a record, by key: groups and pages hold fields of the record; a repeater's are inside its rows. */
function answeredFields(fields: readonly Field[], into = new Map<string, Field>()): Map<string, Field> {
  for (const field of fields) {
    if (field.type === 'group' || field.type === 'page') answeredFields(field.fields ?? [], into)
    else if (field.type !== 'repeater') into.set(field.key, field)
  }
  return into
}

/**
 * A nullable yes-or-no column, as Data generates its control: a radio of
 * exactly "true" and "false" (formancy.ai-data's controls), whose answer is
 * one of those strings or null. A report that reads it as a boolean gets
 * true or false.
 */
function isYesOrNo(field: Field): boolean {
  const values = (field.options ?? []).map((option) => option.value)
  return field.type === 'radio' && values.length === 2 && values.includes('true') && values.includes('false')
}

/** How the provider reads one dataset's fields from a form: which are lookups, by source, and which yes-or-no strings become booleans. */
export interface FieldPlan {
  readonly fields: readonly string[]
  readonly lookups: ReadonlyMap<string, string>
  readonly yesOrNo: ReadonlySet<string>
}

/**
 * What `published` says about reading `contract` from it, for this person:
 * every declared field readable, none an image, and how each is read.
 */
export function planFields(role: DatasetRole, contract: DatasetContract, published: PublishedForm): { plan: FieldPlan; errors: ProviderError[] } {
  const readable = new Set(published.readable)
  const fields = answeredFields(published.form.model.fields)
  const errors: ProviderError[] = []
  const lookups = new Map<string, string>()
  const yesOrNo = new Set<string>()
  for (const declared of contract.fields) {
    const path = `/${role}/${declared.id}`
    const field = fields.get(declared.id)
    if (declared.type === 'image') {
      errors.push({
        path,
        code: 'unsupported-field',
        message: `${declared.id} is an image field, and a Formancy Data 0.1.0 form holds no approved asset to print`,
      })
    } else if (field === undefined || !readable.has(declared.id)) {
      errors.push({
        path,
        code: 'unreadable-field',
        message: `the form gives this person no field ${declared.id} to read: the form does not have it, or its policy does not let them read it`,
      })
    } else if (typeof field.optionsSource === 'string') {
      lookups.set(declared.id, field.optionsSource)
    } else if (declared.type === 'boolean' && isYesOrNo(field)) {
      yesOrNo.add(declared.id)
    }
  }
  return { plan: { fields: contract.fields.map((field) => field.id), lookups, yesOrNo }, errors }
}
