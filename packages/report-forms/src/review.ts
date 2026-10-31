/**
 * A review of a form version for a report (0048): whether the version's
 * submissions print, and what would make them, as data a host shows and
 * a builder applies.
 *
 * The per-render check (0042) is the judge of what blocks: a field the
 * report reads that the version lacks, holds elsewhere or holds as another
 * kind, where the binding reads it, refuses every submission of that
 * version, and anything else prints, so a version blocks only where it
 * moved, retyped or removed a field the report reads (FB-Q5). The review
 * then says what the version did, by comparing it, through formancy's
 * `diffSchemas`, with each version the report was made from -- its
 * provenance -- or reviewed against -- each its overrides name -- which
 * the host hands over, as it hands over every version (0042); and it
 * offers what would lift each refusal (`review-fields.ts`). A path is
 * never guessed from a name. A field the version added is said and never
 * added, and a version that names its form by another id is said.
 * Nothing is applied: each resolution is a command as data, computed
 * against the report's hash (`review-resolutions.ts`).
 *
 * An item names the report's field by its id, a data path by its keys,
 * and what the version did by the diff's kind; never a label, an option or
 * an answer of the form's, which may name a person.
 */
import { compileReport } from '@formancy/report-core'
import type { ReportCompilation } from '@formancy/report-core'
import { MAX_DETAIL_ROWS } from '@formancy/report-runtime'
import { reportHash, validateReport } from '@formancy/report-spec'
import type { DatasetFormBinding, DatasetRole, ReportDefinition } from '@formancy/report-spec'
import { diffSchemas } from '@formancy/spec'
import { Findings, named } from './errors.js'
import type { FormsError, FormsErrorCode } from './errors.js'
import { readList, readParts } from './json.js'
import { fieldAt, KINDS, planField, planRepeater, repeaterIn } from './kinds.js'
import { blockedField, blockedRepeater, offeredPaths, pathIn, relabelled, reusedField } from './review-fields.js'
import type { Baseline, Placing, Read, Review } from './review-fields.js'
import { declaredMoves } from './review-moves.js'
import { offering } from './review-resolutions.js'
import type { Resolution } from './review-resolutions.js'
import { readVersion } from './version.js'
import type { Version } from './version.js'

/** The new version, and the versions the report names, as the host keeps them. */
export interface ReviewInput {
  /** The version to review: validated and hashed here, as a read does. */
  readonly form: unknown
  /** Its `schemaHash` as the host has it, where it has one: refused unless it is the hash of `form`. */
  readonly formHash?: string
  /**
   * The version the report was made from, its provenance's, and each its
   * overrides name: every one the review compares the new version with,
   * each refused as missing where it is not here. And any other version
   * the host keeps: compared with nothing, and kept reading where it read
   * once a rename is followed. At most `MAX_DETAIL_ROWS`, as many as a
   * read of one row per submission is handed forms.
   */
  readonly versions?: readonly unknown[]
}

/** What a version's submissions do in the report: print as they are; print, with something an author may want to follow; or be refused until reviewed. */
export type ReviewStatus = 'compatible' | 'review' | 'blocked'

export interface ReviewItem {
  /** The dataset the item is about; absent for one about the form itself. */
  readonly dataset?: DatasetRole
  /** The field it is about, by its id; absent for the detail's repeater, a field the version added, and the form itself. */
  readonly field?: string
  /** A JSON Pointer into the report: the field's binding, the detail's, a field the version added's dataset, or, for the form itself, the report's provenance. */
  readonly path: string
  /** What the version did, as formancy's `diffSchemas` names it -- `field.renamed`, `field.removed`, `field.typeChanged`, `field.relabelled`, `field.added`, `document.identityChanged` -- where a version the review compared says. */
  readonly change?: string
  /** Where a field the version added stands, in its dataset's scope. */
  readonly formPath?: string
  /** Whether the version's submissions are refused until a resolution is applied; and the per-render refusal's code where they are. */
  readonly blocks: boolean
  readonly code?: FormsErrorCode
  /** For a person: what the version did and what refuses it, never what the form says. */
  readonly message: string
  /** What would resolve it, a declared rename first; none for a field the version added, which nothing adds, and none where nothing would. */
  readonly resolutions: readonly Resolution[]
}

export type FormReview =
  | { readonly ok: true; readonly status: ReviewStatus; readonly formHash: string; readonly reportHash: string; readonly items: readonly ReviewItem[] }
  | { readonly ok: false; readonly errors: readonly FormsError[] }

const refused = (f: Findings): FormReview => ({ ok: false, errors: f.errors() })

/** The hashes of the versions the report names, the one it was made from first, then each its overrides name, in order. */
function versionsNamed(report: ReportDefinition): string[] {
  const overrides = [report.datasets.header, report.datasets.detail].flatMap((contract) => [
    ...(contract?.form?.kind === 'repeater' ? Object.keys(contract.form.overrides ?? {}) : []),
    ...(contract?.fields ?? []).flatMap((field) => Object.keys(field.form?.overrides ?? {})),
  ])
  const made = report.provenance?.kind === 'form' ? [report.provenance.formHash] : []
  return [...new Set([...made, ...[...new Set(overrides)].sort()])]
}

/** The versions handed over, by the hash computed of each; undefined after reporting why one is no version. */
function readVersions(f: Findings, raw: unknown, present: boolean): Map<string, Version> | undefined {
  const versions = new Map<string, Version>()
  if (!present) return versions
  const list = readList(raw, '/versions', MAX_DETAIL_ROWS)
  if (!list.ok) {
    f.report(list.path, list.tooMany === true ? 'too-many-rows' : list.wrongType === true ? 'invalid-input' : 'not-data', list.message)
    return undefined
  }
  for (const [index, form] of list.value.entries()) {
    if (f.full) break
    const version = readVersion(f, form, `/versions/${index}`)
    if (version !== undefined) versions.set(version.hash, version)
  }
  return f.empty ? versions : undefined
}

/** How each dataset the report reads from a form is read in a version. */
function datasetsOf(report: ReportDefinition): Read[] {
  const reads: Read[] = []
  const { header, detail } = report.datasets
  if (header?.form !== undefined) reads.push({ role: 'header', contract: header, scopeIn: (version) => ({ scope: version.answers, prefix: '' }) })
  const form = detail?.form
  if (detail === undefined || form === undefined) return reads
  if (form.kind !== 'repeater') reads.push({ role: 'detail', contract: detail, scopeIn: (version) => ({ scope: version.answers, prefix: '' }) })
  else {
    reads.push({
      role: 'detail',
      contract: detail,
      scopeIn: (version) => {
        const rows = planRepeater(new Findings(), version, repeaterIn(form, version), '')
        return rows === undefined ? undefined : { scope: rows.rows, prefix: `${repeaterIn(form, version)}[].` }
      },
    })
  }
  return reads
}

/** The items of one dataset: its repeater's, where the version moved it, or each field's. */
function datasetItems(review: Review, read: Read): ReviewItem[] {
  const { version } = review
  const form = read.contract.form as DatasetFormBinding
  const found = read.scopeIn(version)
  if (found === undefined && form.kind === 'repeater') return [blockedRepeater(review, read.contract, form)]
  // Only a repeater's rows can be missing from a version: the submission's own scope is every version's.
  const scope = found as Placing
  const items: ReviewItem[] = []
  for (const [index, field] of read.contract.fields.entries()) {
    const f = new Findings()
    const plan = planField(f, version, scope.scope, field, `/datasets/${read.role}/fields/${index}/form`, undefined)
    const item =
      plan === undefined
        ? blockedField(review, read, index, f.errors()[0] as FormsError, scope)
        : 'omitted' in plan
          ? undefined
          : (reusedField(review, read, index, scope) ?? relabelled(review, read, index, plan))
    if (item !== undefined) items.push(item)
  }
  return items
}

/**
 * A field the version added, in the scope of a dataset the report reads,
 * of a kind a report reads, that no field of the report reads in the
 * version, as the diff from a version the report names calls it: said,
 * never added, once; nor one a resolution of a field it refuses would read.
 */
function addedItems(review: Review, reads: readonly Read[]): ReviewItem[] {
  // A field another version the report names held, which a declared rename moved here, is no new one.
  const moved = new Set(review.baselines.flatMap(({ moves }) => [...moves.values()]))
  const said = new Set<string>()
  const items: ReviewItem[] = []
  for (const read of reads) {
    const scope = read.scopeIn(review.version)
    if (scope === undefined) continue
    const printed = new Set([...read.contract.fields.map((field) => pathIn(field, review.version)), ...offeredPaths(review, read, scope)])
    for (const change of review.baselines.flatMap(({ changes }) => changes)) {
      const path = change.path.slice('model.fields.'.length)
      if (change.kind !== 'field.added' || !path.startsWith(scope.prefix) || moved.has(path) || said.has(path)) continue
      const own = path.slice(scope.prefix.length)
      const def = own.includes('[]') ? undefined : fieldAt(review.version, scope.scope, own.split('.'))
      if (def === undefined || !('reads' in KINDS[def.type]) || printed.has(own)) continue
      said.add(path)
      items.push({
        dataset: read.role,
        path: `/datasets/${read.role}`,
        change: 'field.added',
        formPath: own,
        blocks: false,
        message: `the form version ${review.version.hash} holds a field at ${named(own)} the report does not print; a field is never added to a report by itself`,
        resolutions: [],
      })
    }
  }
  return items
}

/** The item for a version that names its form by another id than a version the report names, which formancy calls a lossy change: it may be another form. */
function identityItem(review: Review): ReviewItem | undefined {
  if (!review.baselines.some(({ changes }) => changes.some((change) => change.kind === 'document.identityChanged'))) return undefined
  return {
    path: review.report.provenance?.kind === 'form' ? '/provenance' : '',
    change: 'document.identityChanged',
    blocks: false,
    message: `the form version ${review.version.hash} names its form by another id than a version the report names: it may be another form, whose fields the report reads wherever they stand where it reads them`,
    resolutions: [],
  }
}

/**
 * The review of the form version `input.form` for `report`: its status,
 * and an item for each field it moved, retyped, removed, relabelled,
 * reused or added, and for its form's id where it changed, with what would
 * resolve each; or every reason it could not be made.
 */
export function reviewFormVersion(report: ReportDefinition, input: ReviewInput): FormReview {
  const f = new Findings()
  const checked = validateReport(report)
  if (!checked.valid) return { ok: false, errors: [{ path: '', code: 'invalid-report', message: 'report-spec refuses this report; validateReport says why' }] }
  const reads = datasetsOf(checked.report)
  if (reads.length === 0) {
    f.report('/datasets', 'unbound-report', 'the report reads no dataset from a form, so no form version is anything to it')
    return refused(f)
  }
  const parts = readParts(f, input, '', ['form'], ['formHash', 'versions'])
  if (parts === undefined || !f.empty) return refused(f)
  const version = readVersion(f, parts.get('form'), '/form')
  const versions = readVersions(f, parts.get('versions'), parts.has('versions'))
  if (version === undefined || versions === undefined) return refused(f)
  if (parts.has('formHash') && parts.get('formHash') !== version.hash) {
    f.report(
      '/formHash',
      'hash-mismatch',
      `the host names another hash, and the form it handed over hashes to ${version.hash}: its record of the version and the version disagree`,
    )
    return refused(f)
  }
  // Every version handed over, compared with the new one; the ones the report names are its baselines.
  const handed = new Map(
    [...versions.values()]
      .filter((before) => before.hash !== version.hash)
      .map((before): [string, Baseline] => {
        const changes = diffSchemas(before.schema, version.schema)
        return [before.hash, { version: before, changes, moves: declaredMoves(version.schema, changes) }]
      }),
  )
  const baselines: Baseline[] = []
  for (const hash of versionsNamed(checked.report)) {
    if (hash === version.hash) continue
    const before = handed.get(hash)
    if (before === undefined)
      f.report(
        '/versions',
        'missing-version',
        `the report was made from or reviewed against the form version ${hash}, which was not handed over: a review compares the new version with each`,
        `missing-version ${hash}`,
      )
    else baselines.push(before)
  }
  if (!f.empty) return refused(f)
  const hash = reportHash(checked.report)
  let compiled: ReportCompilation | undefined
  const review: Review = {
    report: checked.report,
    version,
    baselines,
    handed: [...handed.values()],
    on: offering(checked.report, hash),
    compiled: () => (compiled ??= compileReport(checked.report)),
  }
  const identity = identityItem(review)
  const items = [...(identity === undefined ? [] : [identity]), ...reads.flatMap((read) => datasetItems(review, read)), ...addedItems(review, reads)]
  const status: ReviewStatus = items.some((item) => item.blocks) ? 'blocked' : items.length > 0 ? 'review' : 'compatible'
  return { ok: true, status, formHash: version.hash, reportHash: hash, items }
}
