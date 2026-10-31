/**
 * What the bridge can say is wrong, as stable codes, and the bounded list
 * one read or one generation collects (0042, 0045).
 *
 * The path is a JSON Pointer into what was handed over -- `/form/...` into
 * the form, `/submission/data/findings/3/hours` or
 * `/submissions/2/data/site` into an answer -- or into the report, where a
 * field the report reads does not fit the version:
 * `/datasets/detail/fields/1/form`; or, for a report generated from a
 * form, into the form or the options it was handed, `/form/model/fields/3`
 * or `/options/locale`. Neither the path nor the message ever
 * holds an answer: an answer is the customer's, and an error ends up in a
 * log. A path names a key where it is a field key, as formancy writes one,
 * and its container where it is not, since such a key may be the answer.
 */
import { isFieldKey, MAX_ERRORS } from '@formancy/report-spec'

export const FORMS_ERROR_CODES = [
  /** A report `validateReport` refuses: the runtime would refuse it too, and says why. Of a report generated from a form, a defect of the generator, never the form's. */
  'invalid-report',
  /** A report that reads no dataset from a form, or one the other reader reads: one row per submission is `readSubmissions`', one submission `readSubmission`'s. */
  'unbound-report',
  /** What the host handed over is not what the reader takes: not an object, a part it does not know, or a part missing. */
  'invalid-input',
  /** Something JavaScript holds and JSON cannot, in a form or a submission: a getter, never run, a symbol key, a hidden property, a hole, an object of a class, one that throws when read, a number that is not finite, an own `__proto__` in a form or an answer; or a form or an answer nested past `MAX_DOCUMENT_DEPTH`, or holding a list longer than `MAX_DETAIL_ROWS`. */
  'not-data',
  /** A form of a `specVersion` the pinned `@formancy/spec` does not read; both versions are named (0004). */
  'unsupported-spec-version',
  /** A form formancy's validator refuses, at the path it names, with its code. */
  'invalid-form',
  /** A version's hash the host gave that is not the hash of the form it gave, or that names no form handed over. */
  'hash-mismatch',
  /** A submission whose id is not one a data source names (0041), or one named twice. */
  'invalid-submission',
  /** An answer under a path the version has no field for, or a matrix's answer holding a row the version has none of: the submission is another version's, or another form's. */
  'unknown-answer',
  /** A field the report reads that the version lacks: no field at its path in its scope, no repeater where the detail reads one, or no row or option its member names. */
  'version-lacks-field',
  /** A field the report reads that the version holds as a kind its type does not read, or that holds no answer. */
  'version-retypes-field',
  /** A field the report reads of a kind the bridge reads nothing of yet: a file, a signature, a ranking, or ticked boxes whose options a deployment resolves. */
  'unsupported-field',
  /** An answer that is not what its kind stores, a string longer than the runtime's `MAX_STRING_LENGTH`, refused before it is read, or one its field's type refuses, as the runtime reads a value; and a repeater row formancy nulled. */
  'invalid-answer',
  /** A choice's answer, a tick or a matrix's column that is no option the version offers. */
  'unknown-option',
  /** A choice whose label neither its version nor the host's resolver gives: the resolver gave no string, or threw. */
  'unresolved-label',
  /** A number formancy stored that would print as another number: a fraction or past 2^53 for an integer, past 15 significant digits for a decimal (the number rule). */
  'inexact-number',
  /** More rows than the runtime's `MAX_DETAIL_ROWS`: a repeater's, or the submissions handed over. */
  'too-many-rows',
  /** A form that would give a generated report more fields than a dataset holds (`MAX_DATASET_FIELDS`): refused, never cut to the first of them. */
  'too-many-fields',
  /** A form that would give a generated report's table more columns than a landscape A4 page gives the room a heading's word needs, which the renderer breaks in no cell: refused, never cut to the first of them. */
  'too-many-columns',
  /** A form whose generated report would hold more components in its body than a region does (`MAX_REGION_COMPONENTS`). */
  'too-many-components',
  /** A label a generated report would print that is longer than where it prints holds: a column's heading past `MAX_LABEL_LENGTH`, a section's heading or a line's label past `MAX_TEXT_LENGTH`. Refused, never cut short. */
  'label-too-long',
  /** A label or a title a generated report would print holding a character no font draws: a control character, half of a surrogate pair, a direction override or isolate, or a line or paragraph separator. Refused, never dropped. */
  'label-unprintable',
  /** A field a generated report would read at a path of more keys than a binding names (`MAX_FORM_PATH_KEYS`). */
  'path-too-long',
  /** A matrix row or an option whose field's key leaves no room in a field key's 64 characters for an id of its own: refused, never named by a key cut short. */
  'id-too-long',
  /** Two fields a generated report would give one id: refused, never renamed by likeness to tell them apart. */
  'colliding-ids',
  /** A form, or the repeater asked for, that holds nothing a report prints: a report of it would print nothing. */
  'nothing-to-print',
  /** A version a review compares the new one with -- the one the report was made from, or one its overrides name -- that the host did not hand over (0048). */
  'missing-version',
  /** More errors were found than are listed. */
  'too-many-errors',
] as const
export type FormsErrorCode = (typeof FORMS_ERROR_CODES)[number]

export interface FormsError {
  /** A JSON Pointer (RFC 6901) into what was handed over, or into the report. */
  readonly path: string
  readonly code: FormsErrorCode
  /** For a person: what was expected and why, never what was found. */
  readonly message: string
}

/**
 * Errors listed per read: as many as report-spec lists for a report. Past
 * it, one `too-many-errors` entry says the list was cut short, and the read
 * stops reading.
 */
export const MAX_FORMS_ERRORS = MAX_ERRORS

/** The errors one read has found, bounded, each said once: once for a code at a path, unless `once` says what makes it one. */
export class Findings {
  readonly #errors: FormsError[] = []
  readonly #said = new Set<string>()
  #overflowed = false

  report(path: string, code: FormsErrorCode, message: string, once = `${code} ${path}`): void {
    if (this.#said.has(once)) return
    this.#said.add(once)
    if (this.#errors.length < MAX_FORMS_ERRORS) this.#errors.push({ path, code, message })
    else this.#overflowed = true
  }

  /** Whether the list is cut short: once it is, nothing more is worth reading. */
  get full(): boolean {
    return this.#overflowed
  }

  get empty(): boolean {
    return this.#errors.length === 0
  }

  errors(): FormsError[] {
    const errors = [...this.#errors]
    if (this.#overflowed)
      errors.push({ path: '', code: 'too-many-errors', message: `more than ${MAX_FORMS_ERRORS} errors were found; the first ${MAX_FORMS_ERRORS} are listed` })
    return errors
  }
}

/** A JSON Pointer's next segment, escaped (RFC 6901). */
export function at(path: string, segment: string | number): string {
  return `${path}/${String(segment).replaceAll('~', '~0').replaceAll('/', '~1')}`
}

/** The path of a key in a submission, or in what the host handed over: the key where it is a field key, as formancy writes one, its container where it is not. */
export function answerAt(path: string, key: string): string {
  return isFieldKey(key) ? at(path, key) : path
}

/** A form path as a message quotes it: field keys and dots, bounded by report-spec's syntax, never an answer. */
export function named(path: string): string {
  return `"${path}"`
}
