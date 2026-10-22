/**
 * Where a report's datasets are read from a formancy form's submissions
 * (0042): what of the submissions each dataset reads, and where each of its
 * fields is. The structure alone, which the report holds: whether a version
 * of a form has a field at a path, of a kind the field's type reads, is
 * report-forms' to say, per render, against the version that collected each
 * submission. A dataset is read from a form whole, and both datasets are,
 * or neither, because a submission is read into the whole envelope at once.
 */
import type { Findings } from './check.js'
import { kindOf, oneOf, optional, quote, readObject, reference, shape, strictKeys, text } from './check.js'
import { DATASET_FORM_KINDS, FORM_READS } from './data.js'
import type { DatasetFormBinding, DatasetFormKind, DatasetRole, FieldFormBinding, FieldType } from './data.js'
import { MAX_FORM_MEMBER_LENGTH, MAX_FORM_PATH_KEYS } from './limits.js'
import { at } from './pointer.js'
import { isFormPath } from './syntax.js'

const PATH_RULE = `field keys joined by dots, as formancy writes a data path in one scope: at most ${MAX_FORM_PATH_KEYS} keys, each letters, digits and underscores, and no repeater's []`

/** A data path in one scope, or a repeater's. */
function formPath(f: Findings, value: unknown, path: string): string | undefined {
  const string = reference(f, value, path)
  if (string === undefined || isFormPath(string)) return string
  f.report(path, 'invalid-form-path', `expected ${PATH_RULE}, found ${quote(string)}`)
  return undefined
}

/**
 * Where a field of `type` is read from a submission, when it says; undefined
 * when it does not, or when what it says could not all be read. A choice
 * prints text, so only a string field says how one prints.
 */
export function readFieldForm(f: Findings, value: unknown, path: string, type: FieldType | undefined): FieldFormBinding | undefined {
  const o = shape(f, value, path, ['path'], ['member', 'read'])
  if (o === undefined) return undefined
  const where = formPath(f, o.path, at(path, 'path'))
  const member = text(f, o.member, at(path, 'member'), MAX_FORM_MEMBER_LENGTH)
  if (member === '') f.report(at(path, 'member'), 'invalid-form-path', "a member is a matrix row's value or a selectboxes option's, which formancy writes as one character at least")
  // The label is the default, and spelled out it would hash apart from the binding that leaves it out.
  const read = o.read === 'label' ? undefined : oneOf(f, o.read, at(path, 'read'), FORM_READS)
  if (o.read === 'label') f.report(at(path, 'read'), 'not-one-of', 'a choice prints its label when read is left out, so leave it out: one binding has one spelling, and one hash')
  if (read !== undefined && type !== undefined && type !== 'string') {
    f.report(at(path, 'read'), 'binding-type-mismatch', `a choice prints its label or its stored value, both text, and this field is a ${type}`)
  }
  const whole = where !== undefined && (o.member === undefined || (member !== undefined && member !== '')) && (o.read === undefined || read !== undefined)
  return whole ? { path: where, ...optional('member', member), ...optional('read', read) } : undefined
}

/** What a dataset says of a form: the binding when it could be read whole, and its kind where that could be read. */
export interface DatasetFormRead {
  readonly binding: DatasetFormBinding | undefined
  readonly kind: DatasetFormKind | undefined
}

/** What of the submissions a dataset reads. */
export function readDatasetForm(f: Findings, value: unknown, path: string): DatasetFormRead {
  const o = readObject(f, value, path)
  const kind = o && kindOf(f, o, path, DATASET_FORM_KINDS)
  if (o === undefined || kind === undefined) return { binding: undefined, kind: undefined }
  if (kind !== 'repeater') {
    strictKeys(f, o, path, ['kind'])
    return { binding: { kind }, kind }
  }
  strictKeys(f, o, path, ['kind', 'repeater'])
  const repeater = formPath(f, o.repeater, at(path, 'repeater'))
  return { binding: repeater === undefined ? undefined : { kind, repeater }, kind }
}

/**
 * Refuses a field of a dataset read from a form that says nowhere it is
 * read, and one that says where in a dataset read from none. `bound` says,
 * field by field, whether each says where, as it was written.
 */
export function checkFieldsBound(f: Findings, path: string, read: boolean, bound: readonly boolean[]): void {
  bound.forEach((says, index) => {
    if (says === read) return
    const field = at(at(path, 'fields'), index)
    if (read) f.report(field, 'incomplete-form-binding', 'the dataset is read from a form, and this field says nowhere it is read: it would be missing from every render, which a final render refuses')
    else f.report(at(field, 'form'), 'incomplete-form-binding', 'the dataset is read from no form, so nothing reads where this field says a form holds it')
  })
}

/** What a declared dataset says of a form: whether it reads one, and its kind where that could be read. */
export interface DatasetForm {
  readonly read: boolean
  readonly kind: DatasetFormKind | undefined
}

const ROLE_KINDS: { readonly [R in DatasetRole]: { readonly kinds: readonly DatasetFormKind[]; readonly is: string; readonly not: string } } = {
  header: { kinds: ['submission'], is: "the header is one record, a submission's answers", not: 'rows' },
  detail: { kinds: ['repeater', 'submissions'], is: "the detail is rows, a repeater's or one for each submission", not: 'one record' },
}

/**
 * Refuses datasets that read what they are not, and a report with one
 * dataset read from a form beside one that is not: the header is one
 * submission's answers, the detail rows; and a report of one row per
 * submission has no one record to head it.
 */
export function checkDatasetForms(f: Findings, path: string, forms: { readonly [R in DatasetRole]?: DatasetForm }): void {
  for (const role of ['header', 'detail'] as const) {
    const kind = forms[role]?.kind
    const { kinds, is, not } = ROLE_KINDS[role]
    if (kind !== undefined && !kinds.includes(kind)) f.report(at(at(at(path, role), 'form'), 'kind'), 'misplaced-form-binding', `${is}, and ${quote(kind)} reads ${not}`)
  }
  const { header, detail } = forms
  if (detail?.kind === 'submissions' && header !== undefined) {
    f.report(at(path, 'header'), 'misplaced-form-binding', 'a report of one row per submission has no one record to head it: which submission would the header read? What it prints is read in the rows')
  } else if (header !== undefined && detail !== undefined && header.read !== detail.read) {
    f.report(at(path, header.read ? 'detail' : 'header'), 'incomplete-form-binding', 'the other dataset is read from a form, and a submission is read into both at once: this one would have nothing to read')
  }
}
