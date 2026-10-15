/**
 * What the runtime can say is wrong with the data and parameters it is
 * given, as stable codes, and the bounded list one check collects.
 *
 * A code is for a program and the message for a person. An error's path is
 * a JSON Pointer into what was given -- `/detail/17/amount` -- and neither
 * the path nor the message ever holds a value from it: the data is the
 * customer's, and an error is the kind of thing that ends up in a log.
 */
import { MAX_ERRORS, MAX_KEY_LENGTH } from '@formancy/report-spec'
import { VALUE_ERROR_CODES } from './values.js'

export const DATA_ERROR_CODES = [
  ...VALUE_ERROR_CODES,
  /** Something JavaScript can hold and JSON cannot: a getter, a hole, a symbol key, an object that throws when read. */
  'not-data',
  /** A part of the data envelope the runtime does not know. */
  'unknown-property',
  /** A dataset the report declares and the data lacks. */
  'missing-dataset',
  /** Data for a dataset the report does not declare. */
  'undeclared-dataset',
  /** A field the contract declares and a record lacks, which is not the same as null. */
  'missing-field',
  /** Null where the contract or the parameter does not allow it. */
  'unexpected-null',
  /** A field the contract does not declare: a report never carries what it does not print. */
  'undeclared-field',
  /** More detail rows than `MAX_DETAIL_ROWS`. */
  'too-many-rows',
  /** Data the provider says is incomplete, in a final render. */
  'incomplete',
  /** A captured count other than the rows given, or more than the cap. */
  'completeness-mismatch',
  'invalid-completeness',
  'invalid-consistency',
  /** A required parameter with no value and no default. */
  'missing-parameter',
  /** A value for a parameter the report does not declare. */
  'undeclared-parameter',
  /** More errors were found than are listed. */
  'too-many-errors',
] as const
export type DataErrorCode = (typeof DATA_ERROR_CODES)[number]

export interface DataError {
  /** A JSON Pointer into the data or the parameter values: `/detail/17/amount`, `/from`. */
  readonly path: string
  readonly code: DataErrorCode
  /** For a person: what was expected, never what was found. */
  readonly message: string
}

/**
 * Errors listed per check: as many as report-spec lists for a report, for
 * the same reasons. Past it, one `too-many-errors` entry says the list was
 * cut short, and the check stops reading.
 */
export const MAX_DATA_ERRORS = MAX_ERRORS

/** The errors one check has found, bounded. */
export class DataFindings {
  readonly #errors: DataError[] = []
  #overflowed = false

  report(path: string, code: DataErrorCode, message: string): void {
    if (this.#errors.length < MAX_DATA_ERRORS) this.#errors.push({ path, code, message })
    else this.#overflowed = true
  }

  /** Whether the list is cut short: once it is, nothing more is worth reading. */
  get full(): boolean {
    return this.#overflowed
  }

  get empty(): boolean {
    return this.#errors.length === 0
  }

  /** The errors in the order found, and a last one when more were found than listed. */
  errors(): DataError[] {
    const errors = [...this.#errors]
    if (this.#overflowed) errors.push({ path: '', code: 'too-many-errors', message: `more than ${MAX_DATA_ERRORS} errors were found; the first ${MAX_DATA_ERRORS} are listed` })
    return errors
  }
}

/** `path` extended by one key or index, escaped as RFC 6901 says. */
export function at(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}/${key}`
  return `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`
}

/** Whether `key` is longer than any id the format allows: such a key is never one the report declares, and never goes into a path or a message. */
export function isLongKey(key: string): boolean {
  return key.length > MAX_KEY_LENGTH
}

/** The path to `key` in the object at `path`; the object's own path for a long key. */
export function keyAt(path: string, key: string): string {
  return isLongKey(key) ? path : at(path, key)
}
