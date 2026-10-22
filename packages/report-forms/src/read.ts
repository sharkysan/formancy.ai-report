/**
 * A report's data, read from a formancy form's submissions against the
 * exact version that collected each, as the host hands them over (0042).
 *
 * The host hands over documents and the bridge fetches nothing: the form
 * version and the submission it answered for a report of one submission,
 * its answers in the header and one repeater's rows in the detail; or the
 * versions and the submissions, each with its version's hash, for a report
 * of one row per submission. Everything that can be refused without an
 * answer is refused first -- the report, the input's shape, each id, each
 * version through upstream's validator and its hash computed here, each
 * field the report reads against each version -- and an answer is read
 * only then. A refusal anywhere hands over nothing.
 *
 * The data is `host-captured`: a stored submission is one document written
 * at one moment. Its source names each submission with the form's id and
 * the hash of the version that collected it (0041). Whether each value fits
 * its field is held here by the runtime's own reading of a value, at the
 * answer's path, and again by the runtime when it resolves.
 */
import { isSubmissionId, MAX_DETAIL_ROWS, SUBMISSION_ID_SYNTAX } from '@formancy/report-runtime'
import type { FormSubmission, ReportData } from '@formancy/report-runtime'
import { isSchemaHash, validateReport } from '@formancy/report-spec'
import type { DatasetContract, Datasets, ReportDefinition } from '@formancy/report-spec'
import { answerOf, readAnswers, rowsAt } from './answers.js'
import type { AnswerContext, AnswerRecord, OptionLabels } from './answers.js'
import { at, Findings } from './errors.js'
import type { FormsError } from './errors.js'
import { readList, readParts } from './json.js'
import { planField, planRepeater, repeaterIn } from './kinds.js'
import type { FieldPlan } from './kinds.js'
import { readVersion } from './version.js'
import type { Scope, Version } from './version.js'

export type { OptionLabels } from './answers.js'

/** One submission and the form version it answered, for a report of one submission. */
export interface SubmissionInput {
  /** The form version that collected the submission, as the host keeps it: validated and hashed here. */
  readonly form: unknown
  /** The version's `schemaHash` as the host has it, where it has one: refused unless it is the hash of `form`. */
  readonly formHash?: string
  readonly submission: {
    /** Its id, as the host names it; formancy's server makes a UUID. */
    readonly id: string
    /** Its answers, as formancy's engine stored them. */
    readonly data: unknown
  }
}

/** A submission of a report of many, with the hash of the version that collected it, by which it is paired with one of the forms. */
export interface ListedSubmission {
  readonly id: string
  readonly formHash: string
  readonly data: unknown
}

/** Submissions for a report of one row per submission, and every version they answered. */
export interface SubmissionsInput {
  readonly forms: readonly unknown[]
  readonly submissions: readonly ListedSubmission[]
  /** Whether these are every submission the report is of: the host's statement, which a final render holds it to. */
  readonly complete: boolean
}

export interface ReadOptions {
  /** The labels of a choice's options that a deployment resolves (`optionsSource`), in the report's locale. */
  readonly labels?: OptionLabels
}

export type SubmissionRead = { readonly ok: true; readonly data: ReportData } | { readonly ok: false; readonly errors: readonly FormsError[] }

const refused = (f: Findings): SubmissionRead => ({ ok: false, errors: f.errors() })

/** Reports a submission id that is not one a source names, or one named before. */
function checkId(f: Findings, id: unknown, path: string, seen: Set<string>): void {
  if (!isSubmissionId(id)) f.report(path, 'invalid-submission', `a submission's id: ${SUBMISSION_ID_SYNTAX}; never a name, an address or an answer`)
  else if (seen.has(id)) f.report(path, 'invalid-submission', 'an earlier submission has this id: each is read, and named in the manifest, once')
  else seen.add(id)
}

/** How each field of `contract` is read in `version`, from `scope`; undefined where one cannot be. */
function planFields(f: Findings, version: Version, scope: Scope, contract: DatasetContract, role: string, inRows?: string): readonly FieldPlan[] | undefined {
  const plans = contract.fields.map((field, index) => planField(f, version, scope, field, `/datasets/${role}/fields/${index}/form`, inRows))
  return plans.every((plan) => plan !== undefined) ? plans : undefined
}

/** One record of the report's data: each field read as its plan says, by its id, nothing else. */
function recordOf(f: Findings, plans: readonly FieldPlan[], answers: AnswerRecord, context: AnswerContext): Record<string, unknown> {
  const record: Record<string, unknown> = {}
  for (const plan of plans) {
    const value = answerOf(f, plan, answers, context)
    // Defined, not assigned, so that no field id reaches a setter an object inherits.
    if (value !== undefined) Object.defineProperty(record, plan.field.id, { value, enumerable: true, writable: true, configurable: true })
  }
  return record
}

/** Whether `datasets` are read from a form, as a report of one submission reads them; reported where not. */
function readsOneSubmission(f: Findings, datasets: Datasets): boolean {
  if (datasets.detail?.form?.kind === 'submissions') {
    f.report('/datasets/detail/form', 'unbound-report', 'a report of one row per submission is read by readSubmissions, from every submission it lists')
    return false
  }
  if (datasets.header?.form === undefined && datasets.detail?.form === undefined) {
    f.report('/datasets', 'unbound-report', 'the report reads no dataset from a form, so a submission would fill nothing it asked for')
    return false
  }
  return true
}

/**
 * The data `report` renders from, read from one submission against the
 * form version that collected it, or every reason it was not: its answers
 * in the header, the rows of the repeater the detail reads in the detail.
 */
export function readSubmission(report: ReportDefinition, input: SubmissionInput, options: ReadOptions = {}): SubmissionRead {
  const f = new Findings()
  const checked = validateReport(report)
  if (!checked.valid) return { ok: false, errors: [{ path: '', code: 'invalid-report', message: 'report-spec refuses this report; validateReport says why' }] }
  const { datasets, locale } = checked.report
  if (!readsOneSubmission(f, datasets)) return refused(f)
  const parts = readParts(f, input, '', ['form', 'submission'], ['formHash'])
  const submission = parts?.has('submission') === true ? readParts(f, parts.get('submission'), '/submission', ['id', 'data']) : undefined
  const id = submission?.get('id')
  if (submission?.has('id') === true) checkId(f, id, '/submission/id', new Set())
  if (!f.empty || parts === undefined || submission === undefined) return refused(f)
  const version = readVersion(f, parts.get('form'), '/form')
  if (version === undefined) return refused(f)
  if (parts.has('formHash') && parts.get('formHash') !== version.hash) {
    const given = isSchemaHash(parts.get('formHash')) ? 'the hash of another version' : 'no schemaHash'
    f.report('/formHash', 'hash-mismatch', `the host names ${given}, and the form it handed over hashes to ${version.hash}: its record of the version and the version disagree`)
    return refused(f)
  }
  const header = datasets.header === undefined ? undefined : planFields(f, version, version.answers, datasets.header, 'header')
  const repeaterPath = datasets.detail?.form?.kind === 'repeater' ? repeaterIn(datasets.detail.form, version) : undefined
  const repeater = repeaterPath === undefined ? undefined : planRepeater(f, version, repeaterPath, '/datasets/detail/form/repeater')
  const detail = datasets.detail !== undefined && repeaterPath !== undefined && repeater !== undefined ? planFields(f, version, repeater.rows, datasets.detail, 'detail', repeaterPath) : undefined
  if (!f.empty) return refused(f)
  const answers = readAnswers(f, version, version.answers, submission.get('data'), '/submission/data')
  if (answers === undefined) return refused(f)
  const context: AnswerContext = { version, locale, labels: options.labels }
  const headerRecord = header === undefined ? undefined : recordOf(f, header, answers, context)
  const rows = detail === undefined || repeater === undefined ? undefined : rowsAt(answers, repeater.keys).map((row) => recordOf(f, detail, row, context))
  if (!f.empty) return refused(f)
  const source: FormSubmission = { id: id as string, form: version.id, formHash: version.hash }
  return {
    ok: true,
    data: {
      ...(headerRecord === undefined ? {} : { header: headerRecord }),
      ...(rows === undefined ? {} : { detail: rows }),
      completeness: { complete: true, captured: rows?.length ?? 0 },
      consistency: 'host-captured',
      source: { provider: 'formancy-form', submissions: [source] },
    },
  }
}

/** The versions handed over, by the hash computed of each; undefined after reporting why one is no version. */
function readVersions(f: Findings, forms: readonly unknown[]): ReadonlyMap<string, Version> | undefined {
  const versions = new Map<string, Version>()
  for (const [index, form] of forms.entries()) {
    if (f.full) break
    const version = readVersion(f, form, `/forms/${index}`)
    if (version !== undefined) versions.set(version.hash, version)
  }
  return f.empty ? versions : undefined
}

/** One listed submission paired with its version, or undefined after reporting why not. */
function readListed(f: Findings, raw: unknown, path: string, versions: ReadonlyMap<string, Version>, seen: Set<string>): { readonly id: string; readonly version: Version; readonly data: unknown } | undefined {
  const parts = readParts(f, raw, path, ['id', 'formHash', 'data'])
  if (parts === undefined) return undefined
  if (parts.has('id')) checkId(f, parts.get('id'), at(path, 'id'), seen)
  const hash = parts.get('formHash')
  const version = typeof hash === 'string' ? versions.get(hash) : undefined
  if (parts.has('formHash') && version === undefined) {
    f.report(at(path, 'formHash'), 'hash-mismatch', 'the submission names a version none of the forms handed over hashes to: each is read against the version that collected it, and this one has none')
  }
  return version === undefined ? undefined : { id: parts.get('id') as string, version, data: parts.get('data') }
}

/**
 * The data `report` renders from, one row per submission, each read
 * against the version its hash names among `forms`, or every reason it
 * was not. Whether they are every submission is the host's to say.
 */
export function readSubmissions(report: ReportDefinition, input: SubmissionsInput, options: ReadOptions = {}): SubmissionRead {
  const f = new Findings()
  const checked = validateReport(report)
  if (!checked.valid) return { ok: false, errors: [{ path: '', code: 'invalid-report', message: 'report-spec refuses this report; validateReport says why' }] }
  const { datasets, locale } = checked.report
  const contract = datasets.detail
  if (contract?.form?.kind !== 'submissions') {
    f.report('/datasets/detail', 'unbound-report', 'readSubmissions reads a report whose detail is one row per submission; a report of one submission is read by readSubmission')
    return refused(f)
  }
  const parts = readParts(f, input, '', ['forms', 'submissions', 'complete'])
  if (parts === undefined) return refused(f)
  const complete = parts.get('complete')
  if (parts.has('complete') && typeof complete !== 'boolean') f.report('/complete', 'invalid-input', 'complete is true or false: whether these are every submission the report is of')
  const lists = (['forms', 'submissions'] as const).map((name) => {
    const list = parts.has(name) ? readList(parts.get(name), `/${name}`, MAX_DETAIL_ROWS) : undefined
    if (list !== undefined && !list.ok) f.report(list.path, list.tooMany === true ? 'too-many-rows' : list.wrongType === true ? 'invalid-input' : 'not-data', list.message)
    return list?.ok === true ? list.value : undefined
  })
  const [forms, listed] = lists
  // A source names at least one submission (0041): data of none is refused here, where the host handed the list over, and not by the runtime at a path the host never wrote.
  if (listed?.length === 0) f.report('/submissions', 'invalid-input', 'a report of one row per submission reads at least one: its source names each submission it was read from, and a list of none names nothing (0041)')
  if (!f.empty || forms === undefined || listed === undefined) return refused(f)
  const versions = readVersions(f, forms)
  if (versions === undefined) return refused(f)
  const seen = new Set<string>()
  const submissions = listed.flatMap((raw, index) => readListed(f, raw, `/submissions/${index}`, versions, seen) ?? [])
  // Each version's plan once, in the order the submissions meet them.
  const plans = new Map<string, readonly FieldPlan[] | undefined>()
  for (const { version } of submissions) if (!plans.has(version.hash)) plans.set(version.hash, planFields(f, version, version.answers, contract, 'detail'))
  // Nothing was reported, so every submission listed was paired, and each
  // stands at its own index.
  if (!f.empty) return refused(f)
  const rows: Record<string, unknown>[] = []
  for (const [index, { version, data }] of submissions.entries()) {
    if (f.full) break
    const answers = readAnswers(f, version, version.answers, data, `/submissions/${index}/data`)
    if (answers !== undefined) rows.push(recordOf(f, plans.get(version.hash) ?? [], answers, { version, locale, labels: options.labels }))
  }
  if (!f.empty) return refused(f)
  const named: FormSubmission[] = submissions.map(({ id, version }) => ({ id, form: version.id, formHash: version.hash }))
  return {
    ok: true,
    data: { detail: rows, completeness: { complete: complete as boolean, captured: rows.length }, consistency: 'host-captured', source: { provider: 'formancy-form', submissions: named } },
  }
}
