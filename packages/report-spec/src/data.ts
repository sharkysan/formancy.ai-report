/**
 * The data a report reads: the datasets it names by the contract each
 * promises, the one way the format refers to one of their fields, and the
 * parameters a person supplies before it renders. The template names them;
 * the deployment supplies what each resolves to.
 */

export const FIELD_TYPES = ['string', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'instant', 'image'] as const
export type FieldType = (typeof FIELD_TYPES)[number]

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
