/**
 * What a review says of each field a report reads from a new form
 * version, and of the detail's repeater (0048): what blocks, by the
 * per-render check (0042), and what would lift it; what prints, and what
 * an author may want to follow there.
 *
 * What the version did is formancy's `diffSchemas`, against each version
 * the report names -- a baseline. A rename the form's author declared is
 * offered first, and moves the binding to where the field is now, so a
 * later version that keeps it there prints unreviewed; a path a baseline
 * reads the field at, where the diff finds the same field in the new
 * version, is offered next, for a version the review that moved the
 * binding did not know; then nothing printed from the version, another
 * type, the field removed. A field the payment part or the e-invoice
 * reads is offered nothing that changes what they print (0039). A field
 * that prints is said where formancy calls what prints there new since a
 * version the report printed nothing of the field from -- a key a version
 * vacated and a later one reused -- and otherwise offered a relabel where
 * the report still says an old label. A path is never guessed from a
 * name.
 */
import type { ReportCompilation } from '@formancy/report-core'
import type { DatasetContract, DatasetFormBinding, DatasetRole, FieldContract, FieldType, ReportDefinition } from '@formancy/report-spec'
import type { Change } from '@formancy/spec'
import { Findings, named } from './errors.js'
import type { FormsError } from './errors.js'
import { KINDS, planField, planRepeater, repeaterIn } from './kinds.js'
import type { FieldPlan, ReadPlan } from './kinds.js'
import { labelIn, relabelSteps } from './review-labels.js'
import { changesAt } from './review-moves.js'
import { followed, offered, overridden, removal, repeaterFollowed, repeaterOverridden, retyped, withOverride } from './review-resolutions.js'
import type { Offering, Resolution } from './review-resolutions.js'
import type { ReviewItem } from './review.js'
import type { Scope, Version } from './version.js'

/** A version the new one is compared with, and what the diff says of the two. */
export interface Baseline {
  readonly version: Version
  readonly changes: readonly Change[]
  /** Each data path a declared rename moved, and where the new version holds it. */
  readonly moves: ReadonlyMap<string, string>
}

/** What reviewing one report reads: the report, the new version, the baselines, every other version handed over, and what resolutions are offered against. */
export interface Review {
  readonly report: ReportDefinition
  readonly version: Version
  readonly baselines: readonly Baseline[]
  /** Every version the host handed over but the new one, compared with it as a baseline is: each keeps reading where it read once a rename is followed. */
  readonly handed: readonly Baseline[]
  readonly on: Offering
  /** Every expression of the report compiled, once something asks: what a relabel reads. */
  readonly compiled: () => ReportCompilation
}

/** Where a dataset's fields are in one version: the scope they are looked up in, and the data path before a field's own there -- `findings[].` in a repeater's rows. */
export interface Placing {
  readonly scope: Scope
  readonly prefix: string
}

/** One dataset as the review reads it: its role, its contract, and where its fields are in a version, none where the version holds no repeater it reads. */
export interface Read {
  readonly role: DatasetRole
  readonly contract: DatasetContract
  readonly scopeIn: (version: Version) => Placing | undefined
}

/** Where `field` is read in `version`, as its binding and an override for it say: a data path, or none where nothing of it prints from that version. */
export function pathIn(field: FieldContract, version: Version): string | undefined {
  const override = field.form?.overrides?.[version.hash]
  return override === undefined ? field.form?.path : 'path' in override ? override.path : undefined
}

/** How `field` is read in `version`, from its dataset's scope there; undefined where the version refuses it, or holds none of the dataset's rows. */
function planIn(read: Read, field: FieldContract, version: Version): FieldPlan | undefined {
  const placing = read.scopeIn(version)
  return placing === undefined ? undefined : planField(new Findings(), version, placing.scope, field, '', undefined)
}

/** What the diff says a version did to a field that no longer prints, the likeliest cause first; and to one that prints otherwise labelled. */
const BLOCKING = ['field.renamed', 'field.removed', 'field.typeChanged', 'field.optionRemoved', 'field.changed']
const RELABELLING = ['field.relabelled', 'field.optionRelabelled', 'field.changed', 'text.changed']

/** What the diff says where a field is no longer the field it was. */
const ANOTHER = ['field.added', 'field.removed', 'field.renamed', 'field.typeChanged']

/** The first of `kinds` in `order`, or, of a change `order` does not list, the first the diff reported. */
function first(kinds: readonly string[], order: readonly string[]): string | undefined {
  return order.find((kind) => kinds.includes(kind)) ?? kinds[0]
}

/** What a field's refusal says of the version, by what the diff names it, or by the refusal's code. */
const DONE: Readonly<Record<string, string>> = {
  'field.renamed': "holds it elsewhere, by a rename the form's author declared",
  'field.removed': 'holds no field where the report reads it: removed, or moved without a declared rename',
  'field.typeChanged': 'holds it as another kind',
  'field.optionRemoved': 'no longer offers an option it reads',
  'field.changed': 'holds it otherwise: a row or an option it reads, or more, changed',
  'version-lacks-field': 'holds no field where the report reads it',
  'version-retypes-field': 'holds it as a kind its type does not read',
  'unsupported-field': 'holds it as a kind the bridge prints nothing of',
}

/**
 * Where a declared rename moved `field` from where each baseline reads it,
 * in the new version's `scope`, and what the diff says each baseline's
 * version did at that place.
 */
function movesOf(
  baselines: readonly Baseline[],
  read: Read,
  field: FieldContract,
  scope: Placing,
): { readonly moved: ReadonlySet<string>; readonly kinds: readonly string[] } {
  const moved = new Set<string>()
  const kinds: string[] = []
  for (const baseline of baselines) {
    const path = pathIn(field, baseline.version)
    const before = read.scopeIn(baseline.version)
    if (path === undefined || before === undefined) continue
    const to = baseline.moves.get(`${before.prefix}${path}`)
    const own = to?.startsWith(scope.prefix) === true ? to.slice(scope.prefix.length) : undefined
    if (own !== undefined && !own.includes('[]')) moved.add(own)
    kinds.push(...(to === undefined ? [] : ['field.renamed']), ...changesAt(baseline.changes, `${before.prefix}${path}`))
  }
  return { moved, kinds }
}

/**
 * Each path a baseline reads `field` at, in the new version's scope, other
 * than where the new version is read now, where formancy's diff finds the
 * same field in the new version: nothing added, removed, renamed or
 * retyped there, and nothing moved away from it; with the hash of the
 * baseline that reads it. What a version a review did not know -- one
 * between two the report names -- is offered: where it holds the field as
 * they do, by the diff's account, never by its name.
 */
function reviewedPaths(review: Review, read: Read, field: FieldContract, scope: Placing): ReadonlyMap<string, string> {
  const now = pathIn(field, review.version)
  const found = new Map<string, string>()
  for (const baseline of review.baselines) {
    const path = pathIn(field, baseline.version)
    const before = read.scopeIn(baseline.version)
    if (path === undefined || before === undefined || path === now || found.has(path) || before.prefix !== scope.prefix) continue
    if (unchangedAt(baseline, `${before.prefix}${path}`)) found.set(path, baseline.version.hash)
  }
  return found
}

/**
 * The paths in the new version's `scope` that a resolution of a field it
 * refuses would read: a declared rename's, or a baseline's the diff finds
 * the same field at. A field there is the report's own, not one the
 * version added, whatever a diff from another baseline calls it.
 */
export function offeredPaths(review: Review, read: Read, scope: Placing): ReadonlySet<string> {
  const paths = new Set<string>()
  for (const field of read.contract.fields) {
    if (planField(new Findings(), review.version, scope.scope, field, '', undefined) !== undefined) continue
    for (const path of movesOf(review.baselines, read, field, scope).moved) paths.add(path)
    for (const path of reviewedPaths(review, read, field, scope).keys()) paths.add(path)
  }
  return paths
}

/** Whether `field`, read at `path` in the new version, is read there. */
const lifts = (review: Review, scope: Placing, field: FieldContract, path: string): boolean =>
  planField(new Findings(), review.version, scope.scope, withOverride(field, review.version.hash, { path }), '', undefined) !== undefined

/** Whether nothing the diff from a version reports at `path`, a data path of the new version, says the field there is another: nothing added, removed, renamed or retyped there, and nothing moved away from it. */
const unchangedAt = ({ changes, moves }: Baseline, path: string): boolean => {
  const kinds = changesAt(changes, path)
  return !moves.has(path) && !ANOTHER.some((kind) => kinds.has(kind))
}

/**
 * The versions handed over that a followed rename of `field` to `to` keeps
 * reading at the binding's old path, by hash: every one the binding names
 * nothing for, but one that already holds the field at `to` as the new
 * version does -- read there and not at the old path, formancy's diff
 * finding the same field -- which reads it at the new path with it. One
 * that holds it at neither stays refused at the old path, as it was.
 */
function keptBy(review: Review, read: Read, field: FieldContract, scope: Placing, to: string): string[] {
  const overrides = field.form?.overrides ?? {}
  const there = (handed: Baseline): boolean => {
    const placing = read.scopeIn(handed.version)
    if (
      placing === undefined ||
      placing.prefix !== scope.prefix ||
      planField(new Findings(), handed.version, placing.scope, field, '', undefined) !== undefined
    )
      return false
    return (
      planField(new Findings(), handed.version, placing.scope, withOverride(field, handed.version.hash, { path: to }), '', undefined) !== undefined &&
      unchangedAt(handed, `${scope.prefix}${to}`)
    )
  }
  return review.handed.filter((handed) => !Object.hasOwn(overrides, handed.version.hash) && !there(handed)).map(({ version }) => version.hash)
}

/** The versions handed over that a followed rename of the detail's repeater to `to` keeps reading the old one, as `keptBy` keeps a field's. */
function keptRows(review: Review, form: Extract<DatasetFormBinding, { kind: 'repeater' }>, to: string): string[] {
  const overrides = form.overrides ?? {}
  const rows = (version: Version, repeater: string): boolean => planRepeater(new Findings(), version, repeater, '') !== undefined
  const there = (handed: Baseline): boolean => !rows(handed.version, form.repeater) && rows(handed.version, to) && unchangedAt(handed, to)
  return review.handed.filter((handed) => !Object.hasOwn(overrides, handed.version.hash) && !there(handed)).map(({ version }) => version.hash)
}

/** The item for a field the version refuses, and what would lift the refusal, a declared rename first. */
export function blockedField(review: Review, read: Read, index: number, refusal: FormsError, scope: Placing): ReviewItem {
  const field = read.contract.fields[index] as FieldContract
  const { version, baselines, on } = review
  const { moved, kinds } = movesOf(baselines, read, field, scope)
  const change = first(kinds, BLOCKING)
  const resolutions: (Resolution | undefined)[] = []
  for (const path of moved) {
    // Offered where it lifts the refusal alone: a field renamed and retyped in one version is not read by following the rename.
    if (!lifts(review, scope, field, path)) continue
    const message = `reads the field at ${named(path)} from this version on, where the form's author declared it renamed: each version the review was handed goes on reading it where it did, and a later version that keeps it there prints without a review`
    resolutions.push(
      offered(on, 'follow-rename', message, followed(read.role, field, version.hash, path, keptBy(review, read, field, scope, path)), { declared: true }),
    )
  }
  for (const [path, from] of reviewedPaths(review, read, field, scope)) {
    if (moved.has(path) || !lifts(review, scope, field, path)) continue
    const message = `reads the field at ${named(path)} in this version, where the form version ${from} the report names reads it and formancy's diff finds the same field; nobody declared it, and every other version is read as it was`
    resolutions.push(offered(on, 'follow-reviewed', message, overridden(read.role, field, version.hash, { path })))
  }
  const removing = removal(on, read.role, field)
  if (removing.part === undefined) {
    const nullable = field.nullable ? '' : ', and declares the field nullable, which an expression reads as dyn (0009)'
    const typed = { role: read.role, id: field.id }
    resolutions.push(
      offered(
        on,
        'print-nothing',
        `prints nothing of the field from this version's submissions${nullable}; every other version is read where it was`,
        overridden(read.role, field, version.hash, { omit: true }, true),
        {},
        field.nullable ? undefined : typed,
      ),
    )
    if (refusal.code === 'version-retypes-field') resolutions.push(...retypes(review, read, field))
  }
  resolutions.push(removing.resolution)
  const what = DONE[change ?? ''] ?? DONE[refusal.code] ?? 'refuses it'
  const part =
    removing.part === undefined
      ? ''
      : `; ${removing.part} reads it, which only its own commands change (0039), so nothing that changes what it prints is offered: change what it reads there first`
  return {
    dataset: read.role,
    field: field.id,
    path: `/datasets/${read.role}/fields/${index}/form`,
    ...(change === undefined ? {} : { change }),
    blocks: true,
    code: refusal.code,
    message: `the ${read.role} field ${field.id}: the form version ${version.hash} ${what}, so its submissions are refused (${refusal.code}) until a resolution is applied${part}`,
    resolutions: resolutions.filter((resolution) => resolution !== undefined),
  }
}

/**
 * A retype for each type every version the report reads the field from,
 * the new one among them, holds it as. A version that holds it as text,
 * read as a number where it spells one, prints its words today and would
 * refuse them as a number: the kind is all a review sees, so the
 * resolution names those versions and what it costs them.
 */
function retypes(review: Review, read: Read, field: FieldContract): (Resolution | undefined)[] {
  const { version, baselines, on } = review
  const types = new Set<FieldType>(Object.values(KINDS).flatMap((rule) => ('reads' in rule ? rule.reads : [])))
  const readFrom = baselines.flatMap((baseline) => {
    const plan = pathIn(field, baseline.version) === undefined ? undefined : planIn(read, field, baseline.version)
    return plan === undefined || 'omitted' in plan ? [] : [{ baseline, plan }]
  })
  const textual = readFrom.filter(({ plan }) => plan.as === 'text').map(({ baseline }) => baseline.version.hash)
  const fits = (type: FieldType): boolean => {
    const { scale: _scale, ...rest } = field
    const typed: FieldContract = { ...rest, type }
    return planIn(read, typed, version) !== undefined && readFrom.every(({ baseline }) => planIn(read, typed, baseline.version) !== undefined)
  }
  return [...types]
    .filter((type) => type !== field.type && fits(type))
    .map((type) => {
      const cost =
        type === 'string' || textual.length === 0
          ? ''
          : `; the form version ${textual.join(', ')} holds it as text, so a submission of it is then read as a ${type}, and refused (invalid-answer) where its answer spells none`
      return offered(
        on,
        'retype',
        `declares the field ${type}, which this version and every version the report names hold it as${cost}`,
        retyped(read.role, field, type),
        {},
        { role: read.role, id: field.id },
      )
    })
}

/**
 * The item for a field that prints in the new version from a field
 * formancy's diff calls added since a baseline the report printed nothing
 * of it from, or refused it in: a key that version vacated and this one
 * reused, or gave back. It prints, so it blocks nothing; it is said, with
 * what would print none of it, and offered no relabel.
 */
export function reusedField(review: Review, read: Read, index: number, scope: Placing): ReviewItem | undefined {
  const field = read.contract.fields[index] as FieldContract
  const { version, baselines, on } = review
  const here = `${scope.prefix}${pathIn(field, version) ?? ''}`
  const vacated = baselines.find((baseline) => {
    const then = planIn(read, field, baseline.version)
    return (then === undefined || 'omitted' in then) && changesAt(baseline.changes, here).has('field.added')
  })
  if (vacated === undefined) return undefined
  const removing = removal(on, read.role, field)
  const nothing =
    removing.part === undefined
      ? offered(
          on,
          'print-nothing',
          "prints nothing of the field from this version's submissions; every other version is read where it was",
          overridden(read.role, field, version.hash, { omit: true }, true),
          {},
          field.nullable ? undefined : { role: read.role, id: field.id },
        )
      : undefined
  return {
    dataset: read.role,
    field: field.id,
    path: `/datasets/${read.role}/fields/${index}/form`,
    change: 'field.added',
    blocks: false,
    message: `the ${read.role} field ${field.id}: the form version ${version.hash} holds a field where the report reads it that formancy's diff calls added since the form version ${vacated.version.hash}, from which the report printed nothing of it; its submissions print that field's answers as this one's`,
    resolutions: [nothing, removing.resolution].filter((resolution) => resolution !== undefined),
  }
}

/** The relabel offered for a field that prints in the new version, where the report's texts still say a label a baseline gave it; undefined where none does. */
export function relabelled(review: Review, read: Read, index: number, plan: ReadPlan): ReviewItem | undefined {
  const field = read.contract.fields[index] as FieldContract
  const { version, baselines, report, on } = review
  const now = labelIn(version, plan, report.locale)
  if (now === undefined) return undefined
  const here = `${read.scopeIn(version)?.prefix ?? ''}${pathIn(field, version) ?? ''}`
  const was = new Set<string>()
  const kinds: string[] = []
  for (const baseline of baselines) {
    const then = planIn(read, field, baseline.version)
    const label = then === undefined || 'omitted' in then ? undefined : labelIn(baseline.version, then, report.locale)
    if (label === undefined || label === now) continue
    was.add(label)
    kinds.push(...changesAt(baseline.changes, here), ...baseline.changes.map((change) => change.kind).filter((kind) => kind === 'text.changed'))
  }
  if (was.size === 0) return undefined
  const steps = relabelSteps(report, review.compiled(), read.role, field.id, was, now)
  if (steps.length === 0) return undefined
  const resolution = offered(
    on,
    'relabel',
    `says the label this version gives the field in ${steps.length} ${steps.length === 1 ? 'place' : 'places'} that say a label an earlier version gave it`,
    { command: 'batch', args: [steps] },
  )
  const change = first(kinds, RELABELLING)
  return {
    dataset: read.role,
    field: field.id,
    path: `/datasets/${read.role}/fields/${index}`,
    ...(change === undefined ? {} : { change }),
    blocks: false,
    message: `the ${read.role} field ${field.id}: the form version ${version.hash} labels it otherwise, and the report still says an earlier version's label of it; its submissions print as they are`,
    resolutions: resolution === undefined ? [] : [resolution],
  }
}

/**
 * The item for the detail's repeater, which the version does not hold
 * where the report reads its rows: a rename of it the form's author
 * declared, followed; a repeater a baseline reads the rows from, where the
 * diff finds it unchanged; and nothing else, which the item says.
 */
export function blockedRepeater(review: Review, contract: DatasetContract, form: Extract<DatasetFormBinding, { kind: 'repeater' }>): ReviewItem {
  const { version, baselines, on } = review
  const f = new Findings()
  planRepeater(f, version, repeaterIn(form, version), '/datasets/detail/form/repeater')
  const refusal = f.errors()[0] as FormsError
  const kinds: string[] = []
  const moved = new Set<string>()
  const reviewed = new Map<string, string>()
  const rows = (repeater: string): boolean => planRepeater(new Findings(), version, repeater, '') !== undefined
  for (const baseline of baselines) {
    const repeater = repeaterIn(form, baseline.version)
    const to = baseline.moves.get(repeater)
    if (to !== undefined && !to.includes('[]') && rows(to)) moved.add(to)
    else if (repeater !== repeaterIn(form, version) && unchangedAt(baseline, repeater) && rows(repeater)) reviewed.set(repeater, baseline.version.hash)
    kinds.push(...changesAt(baseline.changes, repeater), ...(to === undefined ? [] : ['field.renamed']))
  }
  const change = first(kinds, BLOCKING)
  const resolutions = [
    ...[...moved].map((to) =>
      offered(
        on,
        'follow-rename',
        `reads the detail's rows from the repeater at ${named(to)} from this version on, where the form's author declared it renamed: each version the review was handed goes on reading where it did, and a later version that keeps it there prints without a review`,
        repeaterFollowed(contract, version.hash, to, keptRows(review, form, to)),
        { declared: true },
      ),
    ),
    ...[...reviewed]
      .filter(([repeater]) => !moved.has(repeater))
      .map(([repeater, from]) =>
        offered(
          on,
          'follow-reviewed',
          `reads the detail's rows from the repeater at ${named(repeater)} in this version, where the form version ${from} the report names reads them and formancy's diff finds the same repeater; nobody declared it, and every other version is read as it was`,
          repeaterOverridden(contract, version.hash, repeater),
        ),
      ),
  ].filter((resolution) => resolution !== undefined)
  const none =
    resolutions.length === 0
      ? "; a review offers nothing but a rename of the repeater -- one its author declared, or the repeater a version the report names reads the rows from -- and finds neither: the detail is the author's to change"
      : ''
  return {
    dataset: 'detail',
    path: '/datasets/detail/form',
    ...(change === undefined ? {} : { change }),
    blocks: true,
    code: refusal.code,
    message: `the detail's rows: the form version ${version.hash} ${DONE[change ?? ''] ?? DONE[refusal.code] ?? 'refuses them'}, so its submissions are refused (${refusal.code}) until a resolution is applied${none}`,
    resolutions,
  }
}
