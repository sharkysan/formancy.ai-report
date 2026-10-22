/**
 * A report generated from a formancy form version: a deterministic first
 * draft, and what it left out listed (0045).
 *
 * `generateReport(form, { id, locale, detail? })` reads the version as a
 * submission's is read (0042) -- copied as data, held to the pinned
 * `@formancy/spec`'s validator, named by the `schemaHash` computed of it --
 * and walks its model into a report: the form's title, a line of label and
 * value for each field that holds an answer, in model order, a group's in
 * a section of its own, one table over the repeater `detail` names or one
 * row per submission, on a page that gives each of its columns room for a
 * word of its heading, and the page's number and count in the footer. Its
 * provenance names the version by its hash, and its datasets say where a
 * submission of that version holds each field, so `readSubmission` reads
 * one into it. The same version and options give the same report, to its
 * hash. Nothing of the draft is stored as a base: a later version is
 * reviewed against the report itself (FB-Q6).
 *
 * The notes say, by stable codes, what the draft left out -- a static
 * text, a kind this release does not print, the repeaters the table does
 * not read -- and what it assumed: how each number and each yes or no
 * prints, which fields are proved always answered, labels in another
 * language, a landscape page. What the format or the page cannot hold is
 * refused, never cut to fit.
 */
import type { DatasetContract, Datasets, Orientation, PageSettings, ReportDefinition } from '@formancy/report-spec'
import { isFormPath, MAX_DATASET_FIELDS, MAX_REGION_COMPONENTS, validateReport } from '@formancy/report-spec'
import { resolvedLocale } from '@formancy/spec'
import { at, Findings } from './errors.js'
import type { FormsError } from './errors.js'
import { note } from './generate-fields.js'
import type { Draft, Planned } from './generate-fields.js'
import { titleOf } from './generate-labels.js'
import { columnsOn, counted, laidOut, MIN_COLUMN_WIDTH, pageOf } from './generate-layout.js'
import { outlineOf } from './generate-walk.js'
import type { DetailOf } from './generate-walk.js'
import { readParts } from './json.js'
import { planRepeater } from './kinds.js'
import type { GenerateNote } from './notes.js'
import { readVersion } from './version.js'
import type { Version } from './version.js'

export type { GenerateNote, NoteCode } from './notes.js'

export interface GenerateOptions {
  /** The report's id: lower-case letters, digits and hyphens, as report-spec writes one. */
  readonly id: string
  /** The report's locale, a BCP 47 tag report-spec reads: what its labels are read in from the version. */
  readonly locale: string
  /** What its table reads, as its detail dataset says it: the rows of the repeater at a data path, or one row per submission. Absent, it has no table. */
  readonly detail?: { readonly kind: 'repeater'; readonly repeater: string } | { readonly kind: 'submissions' }
}

export type Generated = { readonly ok: true; readonly report: ReportDefinition; readonly notes: readonly GenerateNote[] } | { readonly ok: false; readonly errors: readonly FormsError[] }

const refused = (f: Findings): Generated => ({ ok: false, errors: f.errors() })

/** The skeleton every generated report has, on `page`. */
function skeleton(id: unknown, locale: unknown, title: string, page: PageSettings): Record<string, unknown> {
  return {
    reportSpecVersion: '0',
    id,
    title,
    locale,
    page,
    styles: [],
    datasets: {},
    parameters: [],
    assets: [],
    aggregates: [],
    regions: { reportHeader: [], pageHeader: [], body: [], pageFooter: [], summary: [] },
  }
}

const RULES: Readonly<Record<string, string>> = {
  id: "the report's id: lower-case letters, digits and hyphens, from a letter, as report-spec writes one",
  locale: "the report's locale: a language, an optional script and an optional region, as report-spec reads one, de-CH or en",
}

/** What the options ask for, or undefined after reporting why they ask for nothing the generator makes. */
function readOptions(f: Findings, raw: unknown): { readonly id: string; readonly locale: string; readonly detail: GenerateOptions['detail'] } | undefined {
  const parts = readParts(f, raw, '/options', ['id', 'locale'], ['detail'])
  if (parts === undefined) return undefined
  // report-spec is the judge of an id and a locale, as it is of every report's.
  const checked = validateReport(skeleton(parts.get('id'), parts.get('locale'), 'Report', pageOf('portrait')))
  if (!checked.valid) {
    for (const key of ['id', 'locale']) if (parts.has(key) && checked.errors.some((error) => error.path === `/${key}`)) f.report(`/options/${key}`, 'invalid-input', RULES[key] as string)
  }
  const detail = parts.has('detail') ? readDetail(f, parts.get('detail')) : undefined
  return f.empty ? { id: parts.get('id') as string, locale: parts.get('locale') as string, detail } : undefined
}

/** The detail the options ask for, or undefined after reporting why it is none. */
function readDetail(f: Findings, raw: unknown): GenerateOptions['detail'] {
  const parts = readParts(f, raw, '/options/detail', ['kind'], ['repeater'])
  if (parts === undefined) return undefined
  const kind = parts.get('kind')
  if (kind === 'submissions' && !parts.has('repeater')) return { kind }
  if (kind !== 'repeater') {
    f.report('/options/detail/kind', 'invalid-input', 'the detail is { kind: "repeater", repeater }, the rows of the repeater at that data path, or { kind: "submissions" }, one row per submission')
    return undefined
  }
  const repeater = parts.get('repeater')
  if (isFormPath(repeater)) return { kind, repeater }
  f.report('/options/detail/repeater', 'invalid-input', "the repeater's data path in the submission's scope: field keys joined by dots, as formancy writes a group's child")
  return undefined
}

/** What is said of the whole version: labels in another language, layouts not followed, pages not broken. The default locale is the form's own string, and named by what it is. */
function versionNotes(draft: Draft): void {
  const { schema } = draft.version
  if (schema.i18n !== undefined && resolvedLocale(schema, draft.locale) !== draft.locale) {
    note(draft, 'labels-default-locale', '/form/i18n', `the form version has no catalogue in ${draft.locale}, so its labels are its default locale's`)
  }
  if ((schema.layouts ?? []).length > 0) note(draft, 'layouts-not-followed', '/form/layouts', 'the form version names layouts, arrangements for filling it in: the report follows none, and is in model order')
  const page = schema.model.fields.findIndex((field) => field.type === 'page')
  if (page >= 0) note(draft, 'pages-not-breaks', at('/form/model/fields', page), 'the form has pages, steps of filling it in: their fields print where they stand, and no page break is made of one')
}

/** A dataset of `fields`, read as `form` says, or none where it has none. */
function datasetOf(id: string, form: NonNullable<DatasetContract['form']>, fields: readonly Planned[]): DatasetContract | undefined {
  return fields.length === 0 ? undefined : { id, form, fields: fields.map((planned) => planned.field) }
}

/** Reports, at `where`, `fields` past the `most` of them the format holds as `what`. */
function bounded(f: Findings, fields: readonly Planned[], where: string, most: number, what: string): void {
  if (fields.length > most) f.report(where, 'too-many-fields', `the form gives the report ${fields.length} ${what}, and the format holds ${most}: it is refused, never cut to the first of them`)
}

/**
 * The page a table of `columns` stands on: portrait where it gives each
 * `MIN_COLUMN_WIDTH`, landscape where only that does, said at `where`;
 * or undefined after refusing a table wider than either.
 */
function orientationFor(draft: Draft, columns: number, where: string, mark: number): Orientation | undefined {
  const [portrait, landscape] = [columnsOn('portrait'), columnsOn('landscape')]
  if (columns <= portrait) return 'portrait'
  if (columns <= landscape) {
    draft.notes.splice(mark, 0, { code: 'table-landscape', path: where, message: `the table has ${columns} columns, more than the ${portrait} a portrait page gives ${MIN_COLUMN_WIDTH} pt each for the words of their headings, so the page is landscape` })
    return 'landscape'
  }
  draft.f.report(where, 'too-many-columns', `the table would have ${columns} columns, and a landscape A4 page gives ${landscape} the ${MIN_COLUMN_WIDTH} pt each a word of a heading needs, which the renderer breaks in no cell: it is refused, never cut to the first of them`)
  return undefined
}

/**
 * A report generated from `form`, the version handed over, as `options`
 * ask, and what it left out and assumed; or every reason it was not.
 */
export function generateReport(form: unknown, options: GenerateOptions): Generated {
  const f = new Findings()
  const asked = readOptions(f, options)
  if (asked === undefined) return refused(f)
  const version: Version | undefined = readVersion(f, form, '/form')
  if (version === undefined) return refused(f)
  const repeater = asked.detail?.kind === 'repeater' ? planRepeater(f, version, asked.detail.repeater, '/options/detail/repeater', false) : undefined
  if (!f.empty) return refused(f)
  const detail: DetailOf = asked.detail?.kind === 'submissions' ? asked.detail : repeater === undefined ? undefined : { kind: 'repeater', repeater: repeater.def }
  const rules = version.schema.logic?.rules ?? []
  const draft: Draft = {
    f,
    notes: [],
    version,
    locale: asked.locale,
    hidden: new Set(rules.filter((rule) => rule.kind === 'visible').map((rule) => rule.target)),
    skipped: new Set(rules.filter((rule) => rule.kind === 'skip').map((rule) => rule.target)),
    ids: { header: new Map(), detail: new Map() },
  }
  const title = titleOf(draft)
  versionNotes(draft)
  const said = draft.notes.length
  const outline = outlineOf(draft, detail)
  if (!f.empty || title === undefined) return refused(f)
  bounded(f, outline.header, '/form/model/fields', MAX_DATASET_FIELDS, 'fields of the submission')
  let orientation: Orientation | undefined = 'portrait'
  if (outline.columnsAt !== undefined) {
    orientation = orientationFor(draft, outline.detail.length, outline.columnsAt, said)
    if (outline.detail.length === 0) f.report(outline.columnsAt, 'nothing-to-print', 'the rows hold no field a report prints, so the table would have no column')
  } else if (outline.header.length === 0) f.report('/form/model/fields', 'nothing-to-print', 'the form version holds no field a report prints, so the report would print nothing but its title')
  if (!f.empty || orientation === undefined) return refused(f)
  const { regions, styles } = laidOut(title, outline.blocks, outline.detail)
  if (counted(regions.body) > MAX_REGION_COMPONENTS) {
    f.report('/form/model/fields', 'too-many-components', `the report's body would hold ${counted(regions.body)} components, its sections and their headings among them, and a region holds ${MAX_REGION_COMPONENTS}`)
    return refused(f)
  }
  const header = datasetOf('answers', { kind: 'submission' }, outline.header)
  const rows = asked.detail?.kind === 'repeater' ? datasetOf('rows', { kind: 'repeater', repeater: asked.detail.repeater }, outline.detail) : datasetOf('submissions', { kind: 'submissions' }, outline.detail)
  const datasets: Datasets = { ...(header === undefined ? {} : { header }), ...(rows === undefined ? {} : { detail: rows }) }
  const report = { ...skeleton(asked.id, asked.locale, title, pageOf(orientation)), styles, datasets, regions, provenance: { kind: 'form', form: version.id, formHash: version.hash } }
  const checked = validateReport(report)
  // Valid by construction, every bound of the format checked above; a report the validator refuses is the generator's defect, refused rather than handed over.
  if (!checked.valid) return { ok: false, errors: [{ path: '', code: 'invalid-report', message: `the report generated from this version is one report-spec refuses, a defect of the generator and not the form's: ${checked.errors.map((error) => error.code).join(', ')}` }] }
  return { ok: true, report: checked.report, notes: draft.notes }
}
