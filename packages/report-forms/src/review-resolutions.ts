/**
 * What a review offers, as data (0048): each resolution a report-core
 * command descriptor -- one command, or a batch of several as one edit --
 * with the hash of the report it was computed for, so that a host applies
 * it through a session against that hash and a stale one is refused
 * (0008). Nothing here applies anything.
 *
 * A resolution is offered only where it is an edit the session takes,
 * and, where it changes a field's type or whether it may be null, one
 * that leaves no expression the compiler refuses that it did not refuse
 * before -- a field made nullable that a decimal comparison reads (0009).
 * The validator and the compiler judge it, as they judge any edit; the
 * compiler over the expressions such a change can reach, which
 * report-core's `fieldReaders` names, never the whole report once a
 * resolution. A field the payment part or the e-invoice reads is offered
 * nothing that changes what they print (0039): its removal is refused as
 * `read-by-part`, and that refusal is what says so.
 */
import { compileReport, fieldReaders, tryEdit } from '@formancy/report-core'
import type { CommandDescriptor, FieldReaders } from '@formancy/report-core'
import { validateReport } from '@formancy/report-spec'
import type { DatasetContract, DatasetRole, FieldContract, FieldFormOverride, FieldType, ReportDefinition } from '@formancy/report-spec'

/**
 * What a resolution does: follow a rename the form's author declared;
 * read the field where a version the report names reads it, formancy's
 * diff finding it there unchanged; print nothing of a field from the
 * version; declare the field another type; remove it with what reads it;
 * say the form's new label.
 */
export const RESOLUTION_KINDS = ['follow-rename', 'follow-reviewed', 'print-nothing', 'retype', 'remove', 'relabel'] as const
export type ResolutionKind = (typeof RESOLUTION_KINDS)[number]

export interface Resolution {
  readonly kind: ResolutionKind
  /** A rename the form's author declared (`renamedFrom`): offered first, and never followed by itself. */
  readonly declared?: true
  /** For a person: what it changes, never what the form or a submission says. */
  readonly message: string
  /** The edit, as data: what a host applies through a session. */
  readonly descriptor: CommandDescriptor
  /** `reportHash` of the report it was computed for: apply it with this as `expectedHash`, and it is refused once the report has changed. */
  readonly expectedHash: string
  /** For a removal: what it takes, as JSON Pointers into the report, in document order. */
  readonly removes?: readonly string[]
}

/**
 * The report a review offers resolutions of: its hash, what reads each of
 * its fields, and what the compiler refuses of it as it stands, by code
 * and place, of each expression compiled so far -- each compiled once,
 * however many fields read it.
 */
export interface Offering {
  readonly report: ReportDefinition
  readonly hash: string
  readonly readers: FieldReaders
  readonly refused: Set<string>
  readonly compiled: Set<string>
}

/** What a review of `report` offers resolutions against: the report walked once, nothing compiled yet. */
export function offering(report: ReportDefinition, hash: string): Offering {
  return { report, hash, readers: fieldReaders(report), refused: new Set(), compiled: new Set() }
}

/** Each expression diagnostic of `report` among `only`, by code and place. */
const said = (report: ReportDefinition, only: ReadonlySet<string>): Set<string> => new Set(compileReport(report, only).diagnostics.map((diagnostic) => `${diagnostic.code} ${diagnostic.path ?? ''}`))

/** What the compiler refuses of the report as it stands, `only` among it compiled where it was not yet. */
function refusedOf(on: Offering, only: ReadonlySet<string>): ReadonlySet<string> {
  const missing = new Set([...only].filter((path) => !on.compiled.has(path)))
  if (missing.size > 0 || on.compiled.size === 0) for (const diagnostic of said(on.report, missing)) on.refused.add(diagnostic)
  for (const path of missing) on.compiled.add(path)
  return on.refused
}

/** The field of `role` and `id` a resolution changes the type of, or whether it may be null: what the compiler is asked about. */
export interface Typed {
  readonly role: DatasetRole
  readonly id: string
}

/**
 * `descriptor` as a resolution, or undefined where the session would
 * refuse it; or, where it changes the type of the field `typed` names, or
 * whether it may be null, where the compiler refuses an expression that
 * change reaches that it did not refuse before.
 */
export function offered(on: Offering, kind: ResolutionKind, message: string, descriptor: CommandDescriptor, more: Pick<Resolution, 'declared'> = {}, typed?: Typed): Resolution | undefined {
  const outcome = tryEdit(on.report, (draft) => draft.apply(descriptor))
  if (!outcome.ok) return undefined
  if (typed !== undefined) {
    const only = on.readers.expressions(typed.role, typed.id)
    const before = refusedOf(on, only)
    if ([...said(outcome.report, only)].some((diagnostic) => !before.has(diagnostic))) return undefined
  }
  return { kind, ...more, message, descriptor, expectedHash: on.hash }
}

/** The field `field` of `role` put back with `change` made to it: one command. */
function putField(role: DatasetRole, field: FieldContract, change: (body: Omit<FieldContract, 'id'>) => Omit<FieldContract, 'id'> = (body) => body): CommandDescriptor {
  const { id, ...body } = field
  return { command: 'putField', args: [role, id, change(body)] }
}

/** `field` read, in the version of hash `version`, as `override` says, every other version as it was: what an override resolution makes of it. */
export function withOverride(field: FieldContract, version: string, override: FieldFormOverride): FieldContract {
  const form = field.form as NonNullable<FieldContract['form']>
  return { ...field, form: { ...form, overrides: { ...form.overrides, [version]: override } } }
}

/** The field read, in the version of hash `version`, as `override` says, and declared nullable where `nullable` says. */
export function overridden(role: DatasetRole, field: FieldContract, version: string, override: FieldFormOverride, nullable = field.nullable): CommandDescriptor {
  return putField(role, withOverride(field, version, override), (body) => ({ ...body, nullable }))
}

/**
 * The field read at `to` from now on, where the version of hash `version`
 * holds it: the binding's own path moved there, that version named
 * reading it there, and each version of `kept` -- those the review knows
 * that would read otherwise at the new path -- named reading the old one,
 * so that every version the review knows reads as it did, and a later
 * version that keeps the field where the rename put it prints without
 * another review.
 */
export function followed(role: DatasetRole, field: FieldContract, version: string, to: string, kept: readonly string[]): CommandDescriptor {
  const form = field.form as NonNullable<FieldContract['form']>
  const old = Object.fromEntries(kept.map((hash) => [hash, { path: form.path }]))
  return putField(role, { ...field, form: { ...form, path: to, overrides: { ...form.overrides, ...old, [version]: { path: to } } } })
}

/** The field declared `type`: a scale is a decimal's, and the field is another type than it was. */
export function retyped(role: DatasetRole, field: FieldContract, type: FieldType): CommandDescriptor {
  return putField(role, field, ({ scale: _scale, ...body }) => ({ ...body, type }))
}

/** The detail's rows read, in the version of hash `version`, from the repeater at `repeater`, every other version as it was. */
export function repeaterOverridden(contract: DatasetContract, version: string, repeater: string): CommandDescriptor {
  const form = contract.form as Extract<NonNullable<DatasetContract['form']>, { kind: 'repeater' }>
  return { command: 'putDataset', args: ['detail', { ...contract, form: { ...form, overrides: { ...form.overrides, [version]: { repeater } } } }] }
}

/** The detail's rows read from the repeater at `to` from now on, as `followed` reads a field: each version of `kept` named reading the old repeater. */
export function repeaterFollowed(contract: DatasetContract, version: string, to: string, kept: readonly string[]): CommandDescriptor {
  const form = contract.form as Extract<NonNullable<DatasetContract['form']>, { kind: 'repeater' }>
  const old = Object.fromEntries(kept.map((hash) => [hash, { repeater: form.repeater }]))
  return { command: 'putDataset', args: ['detail', { ...contract, form: { ...form, repeater: to, overrides: { ...form.overrides, ...old, [version]: { repeater: to } } } }] }
}

/** The removal a review may offer of a field: the resolution, where the session would take it; and, where the field is read by the payment part or the e-invoice, which. */
export interface Removal {
  readonly resolution?: Resolution
  readonly part?: string
}

/**
 * The removal of `field` with everything that reads it, offered with what
 * it takes, where the validator accepts what it leaves, as the session
 * validates what a command leaves; nothing compiled, since every reader
 * goes with it. None where the command refuses it, and, where it refuses
 * it as `read-by-part`, the part that reads it named.
 */
export function removal(on: Offering, role: DatasetRole, field: FieldContract): Removal {
  const outcome = on.readers.removal(role, field.id)
  if (!outcome.ok) return outcome.code === 'read-by-part' ? { part: outcome.path?.startsWith('/eInvoice') === true ? "the report's e-invoice" : "the report's payment part" } : {}
  if (!validateReport(outcome.report).valid) return {}
  const parts = outcome.removed.length - 1
  const message = `removes the field from the report, with everything that reads it: ${parts === 0 ? 'nothing reads it' : `${parts} ${parts === 1 ? 'part' : 'parts'}, listed by their pointers`}; no version is read for it any more`
  return { resolution: { kind: 'remove', removes: outcome.removed, message, descriptor: { command: 'removeFieldWithReaders', args: [role, field.id] }, expectedHash: on.hash } }
}
