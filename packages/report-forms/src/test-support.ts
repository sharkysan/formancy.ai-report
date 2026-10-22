/**
 * What the tests read submissions and generate reports with: a report
 * builder over one form's fields, forms of any spec, the reads and the
 * generator, failing a test where the outcome is not the one it expects.
 * Every read that hands data over has that data held to the runtime's
 * `checkData`, and every report generated is held to the runtime's
 * `checkReport`, so no test passes on what the bridge says is ready and
 * the runtime refuses. Only test files import this; the index does not
 * export it.
 */
import { checkData, checkReport } from '@formancy/report-runtime'
import type { ReportData } from '@formancy/report-runtime'
import type { DatasetContract, FieldContract, FieldFormBinding, FieldType, ReportDefinition } from '@formancy/report-spec'
import { generateReport } from './generate.js'
import type { Generated, GenerateNote, GenerateOptions } from './generate.js'
import { readSubmission, readSubmissions } from './read.js'
import type { ReadOptions, SubmissionInput, SubmissionRead, SubmissionsInput } from './read.js'

/** The submission id the tests read under: a UUID, as formancy's server makes one. */
export const SUBMISSION = 'b682a5ed-ed01-4f8c-8d80-cf53db4e8380'

/** A field of `type` read from the form at `path`, nullable, its label its id. */
export function field(id: string, type: FieldType, path: string, more: Omit<FieldFormBinding, 'path'> & { readonly scale?: number; readonly nullable?: boolean } = {}): FieldContract {
  const { scale, nullable = true, ...binding } = more
  return { id, type, label: id, nullable, ...(scale === undefined ? {} : { scale }), form: { path, ...binding } }
}

/** The header, read from a submission's answers. */
export const answers = (...fields: FieldContract[]): DatasetContract => ({ id: 'visit', form: { kind: 'submission' }, fields })

/** The detail, read from the rows of the repeater at `repeater`. */
export const rowsOf = (repeater: string, ...fields: FieldContract[]): DatasetContract => ({ id: 'findings', form: { kind: 'repeater', repeater }, fields })

/** The detail, one row per submission. */
export const perSubmission = (...fields: FieldContract[]): DatasetContract => ({ id: 'visits', form: { kind: 'submissions' }, fields })

/** A report reading `datasets`, in `locale`, that prints nothing: what is read is the question, not what prints. */
export function reportOf(datasets: ReportDefinition['datasets'], locale = 'de-CH'): ReportDefinition {
  return {
    reportSpecVersion: '0',
    id: 'visit-report',
    title: 'Visit',
    locale,
    page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 } },
    styles: [],
    datasets,
    parameters: [],
    assets: [],
    aggregates: [],
    regions: { reportHeader: [], pageHeader: [], body: [], pageFooter: [], summary: [] },
    provenance: { kind: 'blank' },
  }
}

/** A form of `fields` at `specVersion`, with what `more` adds. */
export function formOf(fields: readonly unknown[], more: Record<string, unknown> = {}, specVersion = '4'): Record<string, unknown> {
  return { specVersion, id: 'site-visit', title: 'Site visit', model: { fields }, ...more }
}

/**
 * `outcome`, once data it hands over is held to the runtime: what the
 * bridge says is ready, `checkData` admits, or the two read one envelope
 * two ways and a host meets the runtime's refusal at a path it never
 * wrote. The one refusal left to the runtime is the report's own contract
 * against the answers: a field declared not nullable that the submission
 * left unanswered (0042).
 */
function admitted(report: ReportDefinition, outcome: SubmissionRead): SubmissionRead {
  if (outcome.ok) {
    const check = checkData(report, outcome.data, { mode: 'preview' })
    const refused = check.ok ? [] : check.errors.filter((error) => error.code !== 'unexpected-null')
    if (refused.length > 0) throw new Error(`the bridge handed over data the runtime refuses: ${refused.map((error) => `${error.code} ${error.path}`).join('; ')}`)
  }
  return outcome
}

/** A submission read as `input`, by readSubmission. */
export const readOne = (report: ReportDefinition, input: unknown, options?: ReadOptions): SubmissionRead => admitted(report, readSubmission(report, input as SubmissionInput, options))

/** One submission of `data`, read against `form`. */
export function read(report: ReportDefinition, form: unknown, data: unknown, options?: ReadOptions): SubmissionRead {
  return readOne(report, { form, submission: { id: SUBMISSION, data } }, options)
}

/** The data of a read, failing the test with the errors where it was refused. */
export function readData(outcome: SubmissionRead): ReportData {
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path}: ${error.message}`).join('; ')}`)
  return outcome.data
}

/** Each error of a refusal as its code and path, failing the test where the read was not refused. */
export function refusals(outcome: SubmissionRead): string[] {
  if (outcome.ok) throw new Error(`read, where a refusal was expected: ${JSON.stringify(outcome.data)}`)
  return outcome.errors.map((error) => `${error.code} ${error.path}`)
}

/** The header record a read handed over. */
export const headerOf = (outcome: SubmissionRead): Readonly<Record<string, unknown>> => readData(outcome).header ?? {}

/** Many submissions, read as `input`, by readSubmissions. */
export const readMany = (report: ReportDefinition, input: unknown, options?: ReadOptions): SubmissionRead => admitted(report, readSubmissions(report, input as SubmissionsInput, options))

/**
 * `outcome`, once a report it hands over is held to report-spec's
 * validator and to the runtime's `checkReport`, which compiles every
 * expression with report-core: a generated report the runtime would
 * refuse is the generator's defect, and no test passes on one (0045).
 */
function compiles(outcome: Generated): Generated {
  if (outcome.ok) {
    const check = checkReport(outcome.report)
    if (!check.ok) throw new Error(`the generator handed over a report the runtime refuses: ${check.errors.map((error) => `${error.code} ${error.path}`).join('; ')}`)
  }
  return outcome
}

/** A report generated from `form` as `options` say, held to the runtime. */
export const generate = (form: unknown, options: unknown): Generated => compiles(generateReport(form, options as GenerateOptions))

/** The report and the notes of a generation, failing the test with the errors where it was refused. */
export function generatedFrom(outcome: Generated): { readonly report: ReportDefinition; readonly notes: readonly GenerateNote[] } {
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path}: ${error.message}`).join('; ')}`)
  return outcome
}

/** Each error of a refused generation as its code and path, failing the test where it was not refused. */
export function generationRefusals(outcome: Generated): string[] {
  if (outcome.ok) throw new Error(`generated, where a refusal was expected: ${JSON.stringify(outcome.notes)}`)
  return outcome.errors.map((error) => `${error.code} ${error.path}`)
}

/** Each note as its code and path. */
export const notesOf = (notes: readonly GenerateNote[]): string[] => notes.map((note) => `${note.code} ${note.path}`)
