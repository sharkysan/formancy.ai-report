/**
 * The data a report reads: the datasets it names by the contract each
 * promises, the one way the format refers to one of their fields, and the
 * parameters a person supplies before it renders. The template names them;
 * the deployment supplies what each resolves to.
 */

export const FIELD_TYPES = ['string', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'instant', 'image'] as const
export type FieldType = (typeof FIELD_TYPES)[number]

/**
 * How a choice's answer prints, where it does not print its label (0042):
 * the value the submission stores. Its label -- the one its option has in
 * the form version that collected it, in the report's locale -- is what it
 * prints when `read` is left out, and has no spelling of its own, so that
 * one binding has one hash.
 */
export const FORM_READS = ['value'] as const
export type FormRead = (typeof FORM_READS)[number]

/**
 * Where a formancy form's submission holds a field's answer (0042): its
 * data path in the dataset's scope, as formancy writes one -- field keys
 * joined by dots, a group's child `address.street`; a page scopes nothing
 * and has no key in it. The header's scope and one row per submission's is
 * the submission's; a repeater's rows' is the row's.
 */
export interface FieldFormBinding {
  readonly path: string
  /** A matrix row's value, whose chosen column the field prints, or a selectboxes option's value, whether it is ticked. */
  readonly member?: string
  /** How a choice prints -- a select, a radio, a matrix row's column: `value`, its stored value; absent, its label. Only a string field reads a choice. */
  readonly read?: FormRead
  /**
   * What a review decided for a form version (0048), keyed by the
   * version's `schemaHash`: where that version holds the field -- `path`
   * itself, for the version a followed rename moved `path` to -- or that
   * the report prints nothing of it from that version. Every version not
   * named is read at `path`.
   */
  readonly overrides?: Readonly<Record<string, FieldFormOverride>>
}

/**
 * How one form version's submissions fill a field, where it is not as the
 * binding says (0048): from another data path in the same scope, the
 * member and the reading kept; or not at all, null in every submission of
 * that version, which only a field that may be null takes.
 */
export type FieldFormOverride = { readonly path: string } | { readonly omit: true }

/**
 * What of a formancy form's submissions a dataset reads (0042): the header
 * one submission's answers; the detail one of its repeater's rows, or one
 * row for each submission of a report of many, which has no header. Which
 * version of which form is the render's input, never the report's: each
 * submission is read against the version that collected it.
 */
export const DATASET_FORM_KINDS = ['submission', 'repeater', 'submissions'] as const
export type DatasetFormKind = (typeof DATASET_FORM_KINDS)[number]

export type DatasetFormBinding =
  | { readonly kind: 'submission' }
  | {
      readonly kind: 'repeater'
      /** The repeater's data path in the submission's scope. */
      readonly repeater: string
      /** Where a form version holds the rows, keyed by its `schemaHash`, as a review decided (0048) -- `repeater` itself, for the version a followed rename moved it to; its rows' fields are read at their own paths in them. Every version not named reads `repeater`. */
      readonly overrides?: Readonly<Record<string, { readonly repeater: string }>>
    }
  | { readonly kind: 'submissions' }

/**
 * A field a dataset contract promises.
 *
 * Values of exact types arrive as strings, never as JavaScript numbers. An
 * `image` field's value is an approved asset -- its id and its `sha256:`
 * digest -- which the host resolves to bytes, never an address: a photo or
 * a signature captured with a form arrives this way, and prints only as an
 * image. A field that is not nullable never holds null; one that is prints
 * null as nothing. A field the data lacks altogether is the runtime's error,
 * never an empty string.
 */
export interface FieldContract {
  /** A field key: what an expression reads it as, `header.<id>` or `row.<id>`. */
  readonly id: string
  readonly type: FieldType
  readonly label: string
  readonly nullable: boolean
  /** Digits after the decimal point; decimal fields only. */
  readonly scale?: number
  /** Where a formancy form's submission holds it, in a dataset read from one; absent in any other. */
  readonly form?: FieldFormBinding
}

/**
 * A dataset the report reads, by the logical id a deployment's binding set
 * maps to a provider. The fields are the contract the template was written
 * against, so the template itself records which revision of the contract it
 * expects.
 */
export interface DatasetContract {
  readonly id: string
  readonly fields: readonly FieldContract[]
  /** What of a formancy form's submissions it reads; absent, the host hands its data over as it captured it. */
  readonly form?: DatasetFormBinding
}

/** The two datasets a version-0 report can read: one row of header data, and the one primary detail dataset. */
export const DATASET_ROLES = ['header', 'detail'] as const
export type DatasetRole = (typeof DATASET_ROLES)[number]

export interface Datasets {
  readonly header?: DatasetContract
  readonly detail?: DatasetContract
}

/** A field of the header or the detail dataset: the one way the format refers to one. */
export interface FieldRef {
  readonly dataset: DatasetRole
  readonly field: string
}

export const PARAMETER_TYPES = ['string', 'integer', 'decimal', 'boolean', 'date'] as const
export type ParameterType = (typeof PARAMETER_TYPES)[number]

/** A value a person supplies before rendering, on a formancy form whose field key is the parameter's id (plan 12.4). */
export interface ParameterDef {
  /** A field key: what an expression reads it as, `params.<id>`. */
  readonly id: string
  readonly type: ParameterType
  readonly label: string
  readonly required: boolean
  /** A boolean for a boolean parameter; for every other type, the exact value as a string. */
  readonly default?: string | boolean
}
