/**
 * Where a report's data came from, as its provider names it, and the check
 * that admits it (0041). The render's manifest carries it, so that a PDF
 * kept for years can be traced to what collected its data: plan 13.2's
 * identity and provenance, as far as identifiers say them.
 *
 * - **A formancy form**: each submission the data was read from, with the
 *   form's id and the `schemaHash` of the version that collected it -- one
 *   for a report of one submission, one a row for a report of many,
 *   whatever versions they answered. The form's id is a submission's too,
 *   since formancy lets a new version change it.
 * - **Formancy Data**: the published form each dataset was read from. Never
 *   a record's token, which spells the record's key (formancy.ai-data
 *   0012), and a key can be the customer's own data.
 *
 * A source names identifiers and nothing else. It is held to their syntax,
 * bounded in count and length, and refused rather than cut short; a key
 * its shape does not name is refused by its container's path, since the
 * key may be the answer, and a provider the runtime does not know is
 * refused, never read as one it does. The syntax keeps out a space, an
 * `@`, a `/`, a `:`, a letter beyond ASCII and anything past 128
 * characters; it cannot tell a single word, a personal number or a digest
 * of an answer from an identifier, which 0041 says is its cost. Whether a
 * source is true -- that the host read what it names -- is the provider's
 * statement, as its completeness is; the runtime holds its form.
 *
 * As `data.ts` does, the check reports every problem and returns what it
 * read; `checkData` refuses the data when any was reported, so what a
 * render keeps is a source read whole.
 */
import { isFormId, isSchemaHash } from '@formancy/report-spec'
import type { DatasetRole, Datasets } from '@formancy/report-spec'
import { at } from './data-errors.js'
import type { DataErrorCode, DataFindings } from './data-errors.js'
import { readList, readRecord, UNREADABLE } from './input.js'
import type { ContainerCode, PropertyProblem } from './input.js'

/** Who handed the data over: a formancy form's submissions, or Formancy Data's forms. */
export const SOURCE_PROVIDERS = ['formancy-form', 'formancy-data'] as const
export type SourceProvider = (typeof SOURCE_PROVIDERS)[number]

/** One submission the data was read from, and the version of the form that collected it. */
export interface FormSubmission {
  /** The submission's id, as the host that keeps it names it; formancy's server makes a UUID. */
  readonly id: string
  /** The form's id, as the version that collected the submission writes it: a version may change it. */
  readonly form: string
  /** `schemaHash` of the exact form version the submission answered: 64 lower-case hex digits. */
  readonly formHash: string
}

/** Data read from a formancy form's submissions. */
export interface FormSource {
  readonly provider: 'formancy-form'
  /** Each submission the data was read from, once, in the order the provider read them; at least one. */
  readonly submissions: readonly FormSubmission[]
}

/** Data read from Formancy Data: the published form each of the report's datasets was read from, by its id. */
export interface FormancyDataSource {
  readonly provider: 'formancy-data'
  readonly forms: { readonly [R in DatasetRole]?: string }
}

/** Where a report's data came from. Data a host captured itself may name none. */
export type DataSource = FormSource | FormancyDataSource

const ROLES: readonly DatasetRole[] = ['header', 'detail']

/** The characters a form's id and a submission's may hold, as a refusal says them. */
const ID_SYNTAX = "letters, digits, '.', '_' and '-', starting with a letter or a digit, at most 128 characters"

/**
 * A submission's id. The same characters as a form's id, by choice and not
 * by rule: report-spec's `FORM_ID` is formancy's syntax for a form, which
 * formancy may change, and a submission's id is the host's, which formancy's
 * server makes as a UUID. A UUID, a ULID or a number fits, and so does a
 * single word or a personal number, which a syntax cannot tell from an id.
 */
const SUBMISSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

/**
 * Whether `value` is a submission's id as a source names one: what the form
 * bridge holds an id to before it reads a submission, so that the two
 * cannot read an id differently (0042).
 */
export function isSubmissionId(value: unknown): value is string {
  return typeof value === 'string' && SUBMISSION_ID.test(value)
}

/** What `isSubmissionId` accepts, in the words a refusal says it: the form bridge says them when it refuses an id, so the two cannot describe one rule two ways. */
export const SUBMISSION_ID_SYNTAX = ID_SYNTAX

const FORM_ID = `a form's id as formancy writes one: ${ID_SYNTAX}`
const NOTHING_ELSE = 'and nothing else: a source names identifiers, and no answer rides into the manifest a PDF is kept with'
const SUBMISSION = 'a submission is { "id": its id, "form": the form\'s id, "formHash": the schemaHash of the version that collected it }'

/** What each provider's source names besides its provider. */
const NAMES: { readonly [P in SourceProvider]: readonly string[] } = { 'formancy-form': ['submissions'], 'formancy-data': ['forms'] }

/** A container that could not be read, as a source's error: what is not data stays `not-data`. */
const container = (code: ContainerCode): DataErrorCode => (code === 'not-data' ? 'not-data' : 'invalid-source')

/**
 * Reports a record's properties that are not data: a key of `known` where
 * it stands, any other by the record's own path, since a key the shape
 * does not name may be the answer. Returns the known keys reported.
 */
function notData(errors: DataFindings, path: string, problems: readonly PropertyProblem[], known: readonly string[]): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const { key, message } of problems) {
    const named = key !== undefined && known.includes(key)
    if (named) keys.add(key)
    errors.report(named ? at(path, key) : path, 'not-data', message)
  }
  return keys
}

/** Refuses, once and by the record's own path, the keys of `entries` that `known` does not hold. */
function onlyKnown(errors: DataFindings, path: string, entries: ReadonlyMap<string, unknown>, known: readonly string[], shape: string): void {
  if ([...entries.keys()].some((key) => !known.includes(key))) errors.report(path, 'invalid-source', `${shape}, ${NOTHING_ELSE}`)
}

/** One submission, or undefined when it cannot be read at all; `seen` holds the ids read before it. */
function readSubmission(errors: DataFindings, raw: unknown, path: string, seen: Set<string>): FormSubmission | undefined {
  const read = readRecord(raw)
  if (!read.ok) {
    errors.report(path, container(read.code), SUBMISSION)
    return undefined
  }
  const known = ['id', 'form', 'formHash']
  const unreadable = notData(errors, path, read.problems, known)
  onlyKnown(errors, path, read.entries, known, SUBMISSION)
  const [id, form, formHash] = known.map((key) => read.entries.get(key))
  if (!unreadable.has('id')) {
    if (!isSubmissionId(id)) {
      errors.report(at(path, 'id'), 'invalid-source', `a submission's id: ${ID_SYNTAX}; never a name, an address or an answer`)
    } else if (seen.has(id)) {
      errors.report(at(path, 'id'), 'invalid-source', 'a source names each submission once, and an earlier entry names this one')
    } else seen.add(id)
  }
  if (!unreadable.has('form') && !isFormId(form)) errors.report(at(path, 'form'), 'invalid-source', `the form the submission answered: ${FORM_ID}`)
  if (!unreadable.has('formHash') && !isSchemaHash(formHash)) {
    errors.report(at(path, 'formHash'), 'invalid-source', 'the schemaHash of the form version that collected the submission: 64 lower-case hex digits')
  }
  return Object.freeze({ id: id as string, form: form as string, formHash: formHash as string })
}

/** A formancy form's source: each submission, read after the bound is checked. */
function readFormSource(errors: DataFindings, entries: ReadonlyMap<string, unknown>, max: number): FormSource | undefined {
  const list = readList(entries.get('submissions'), max)
  if (!list.ok) {
    const message =
      list.code === 'too-many'
        ? `${list.message}: a source names no more submissions than the data gives detail rows, or one where it gives none, since a report of one submission reads its repeater's rows and a report of many one a row`
        : 'submissions is a list of { "id", "form", "formHash" }, one for each submission the data was read from'
    errors.report('/source/submissions', container(list.code), message)
    return undefined
  }
  if (list.items.length === 0) errors.report('/source/submissions', 'invalid-source', 'a form source names at least one submission the data was read from')
  const unreadable = new Map(list.problems.map(({ index, message }) => [index, message]))
  const seen = new Set<string>()
  const submissions: FormSubmission[] = []
  for (const [index, item] of list.items.entries()) {
    if (errors.full) break
    const path = at('/source/submissions', index)
    if (item === UNREADABLE) {
      errors.report(path, 'not-data', unreadable.get(index) as string)
      continue
    }
    const submission = readSubmission(errors, item, path, seen)
    if (submission !== undefined) submissions.push(submission)
  }
  return Object.freeze({ provider: 'formancy-form', submissions: Object.freeze(submissions) })
}

/** Formancy Data's source: a form for each dataset the report declares, for no other, and at least one. */
function readDataSource(errors: DataFindings, entries: ReadonlyMap<string, unknown>, datasets: Datasets): FormancyDataSource | undefined {
  const read = readRecord(entries.get('forms'))
  if (!read.ok) {
    errors.report('/source/forms', container(read.code), 'forms is { "header", "detail" }: the published form each dataset the report declares was read from')
    return undefined
  }
  const unreadable = notData(errors, '/source/forms', read.problems, ROLES)
  if (read.entries.size === 0 && read.problems.length === 0) {
    errors.report('/source/forms', 'invalid-source', 'a Formancy Data source names the form each dataset was read from, and data read from no form names no source')
    return undefined
  }
  onlyKnown(errors, '/source/forms', read.entries, ROLES, 'forms is keyed by the datasets a report declares, header and detail')
  for (const role of ROLES) {
    if (unreadable.has(role)) continue
    const declared = datasets[role] !== undefined
    if (!read.entries.has(role)) {
      if (declared) errors.report('/source/forms', 'invalid-source', `the report declares a ${role} dataset, and the source names no form it was read from`)
    } else if (!declared) errors.report(at('/source/forms', role), 'invalid-source', `the report declares no ${role} dataset, so none was read from a form`)
    else if (!isFormId(read.entries.get(role))) errors.report(at('/source/forms', role), 'invalid-source', `the published form the ${role} dataset was read from: ${FORM_ID}`)
  }
  // In the datasets' order, whatever the host's: one source, one spelling.
  const forms = Object.fromEntries(ROLES.filter((role) => read.entries.has(role)).map((role) => [role, read.entries.get(role) as string]))
  return Object.freeze({ provider: 'formancy-data', forms: Object.freeze(forms) })
}

/**
 * The source `raw` names, held to its provider's shape and to `datasets`,
 * as a frozen copy, with every problem reported to `errors`; undefined when
 * it cannot be read at all. No more than `maxSubmissions` submissions are
 * read, and a list past it is refused before any of its items is.
 */
export function checkSource(errors: DataFindings, raw: unknown, datasets: Datasets, maxSubmissions: number): DataSource | undefined {
  const shape = `a source is { "provider": one of ${SOURCE_PROVIDERS.map((provider) => `"${provider}"`).join(', ')}, and what that provider names }`
  const read = readRecord(raw)
  if (!read.ok) {
    errors.report('/source', container(read.code), shape)
    return undefined
  }
  const unreadable = notData(errors, '/source', read.problems, ['provider', ...new Set(Object.values(NAMES).flat())])
  if (unreadable.has('provider')) return undefined
  const provider = SOURCE_PROVIDERS.find((each) => each === read.entries.get('provider'))
  if (provider === undefined) {
    errors.report('/source/provider', 'invalid-source', shape)
    return undefined
  }
  const names = NAMES[provider]
  onlyKnown(errors, '/source', read.entries, ['provider', ...names], `a ${provider} source names ${names.join(' and ')}`)
  // What is not data was said where it stands, and is not said again as missing.
  if (names.some((name) => unreadable.has(name))) return undefined
  return provider === 'formancy-form' ? readFormSource(errors, read.entries, maxSubmissions) : readDataSource(errors, read.entries, datasets)
}
