/**
 * Commands on what a report declares: print styles, datasets and their
 * fields, parameters, assets and aggregates.
 *
 * Every declaration is a list of objects with an id (0007), so one pair of
 * operations serves them all: a put, which replaces the declaration with
 * that id where it stands or appends a new one, and a remove. The id is the
 * key, and the body is everything else, so a put cannot rename: renaming
 * would leave every reference to the old id behind.
 *
 * A remove does not chase references. Removing a style a component still
 * uses gives a report the validator refuses, so the session refuses the
 * edit with the validator's `unknown-style` at each place that uses it,
 * which is what an author needs to see before deciding.
 *
 * An asset has an add besides, which never replaces: an image a person adds
 * is named before a host keeps its bytes under that id and digest, and only
 * then declared (0033), so a put under an id the report came to declare
 * meanwhile would swap another image for it, unseen. `nextAssetId` names
 * it, by the rule a new component's id is made by, the file's name
 * numbered as it stands.
 */
import type { AggregateDef, AssetRef, DatasetContract, DatasetRole, FieldContract, ParameterDef, PrintStyle, ReportDefinition } from '@formancy/report-spec'
import { checkPrefix, freshId } from '../ids.js'
import { checkIndex, movedTo, removedAt, replacedAt } from '../lists.js'
import { quote, refuse } from '../outcome.js'
import type { CommandOutcome, Refusal } from '../outcome.js'

interface Declared {
  readonly id: string
}

/** `list` with the declaration `id` replaced where it stands, or appended. */
function put<T extends Declared>(list: readonly T[], id: string, body: Omit<T, 'id'>): T[] {
  const item = { id, ...body } as unknown as T
  const index = list.findIndex((existing) => existing.id === id)
  return index === -1 ? [...list, item] : replacedAt(list, index, item)
}

/** `list` without the declaration `id`, or a refusal pointing at the list. */
function remove<T extends Declared>(list: readonly T[], id: string, path: string, what: string): T[] | Refusal {
  const index = list.findIndex((existing) => existing.id === id)
  return index === -1 ? refuse('not-found', `no ${what} is ${quote(id)}`, { path }) : removedAt(list, index)
}

/** `report` with `key` set to `list`, or the refusal. */
function withList<K extends 'styles' | 'parameters' | 'assets' | 'aggregates'>(
  report: ReportDefinition,
  key: K,
  list: ReportDefinition[K] | Refusal,
): CommandOutcome {
  return 'ok' in list ? list : { ok: true, report: { ...report, [key]: list } }
}

export function putStyle(report: ReportDefinition, id: string, style: Omit<PrintStyle, 'id'>): CommandOutcome {
  return withList(report, 'styles', put(report.styles, id, style))
}

export function removeStyle(report: ReportDefinition, id: string): CommandOutcome {
  return withList(report, 'styles', remove(report.styles, id, '/styles', 'style'))
}

export function putParameter(report: ReportDefinition, id: string, parameter: Omit<ParameterDef, 'id'>): CommandOutcome {
  return withList(report, 'parameters', put(report.parameters, id, parameter))
}

export function removeParameter(report: ReportDefinition, id: string): CommandOutcome {
  return withList(report, 'parameters', remove(report.parameters, id, '/parameters', 'parameter'))
}

/** The parameter `id` moved so that it ends at `index`: the order the parameter form shows. */
export function moveParameter(report: ReportDefinition, id: string, index: number): CommandOutcome {
  const from = report.parameters.findIndex((parameter) => parameter.id === id)
  if (from === -1) return refuse('not-found', `no parameter is ${quote(id)}`, { path: '/parameters' })
  const outside = checkIndex(index, report.parameters.length - 1, 'the parameters', { path: '/parameters' })
  return outside ?? { ok: true, report: { ...report, parameters: movedTo(report.parameters, from, index) } }
}

export function putAsset(report: ReportDefinition, id: string, asset: Omit<AssetRef, 'id'>): CommandOutcome {
  return withList(report, 'assets', put(report.assets, id, asset))
}

/** The asset appended under `id`; refused as `already-declared` when the report declares one under it already. */
export function addAsset(report: ReportDefinition, id: string, asset: Omit<AssetRef, 'id'>): CommandOutcome {
  if (report.assets.some((existing) => existing.id === id))
    return refuse('already-declared', `an asset is already declared as ${quote(id)}; an add never replaces one`, { path: '/assets' })
  return withList(report, 'assets', put(report.assets, id, asset))
}

/**
 * An id no asset of `report` has, and none of `handed`: `base` itself when
 * it is free, and otherwise `base-2`, `base-3` and so on, shortened so that
 * its number fits, as a new component's is. The base is a file's name,
 * folded, so a number it ends in is its own and is numbered too:
 * `img-4711` taken gives `img-4711-2`. Assets are a namespace of their own
 * (0007), so a component's id does not count; `handed` holds the ids a
 * builder has handed a host already, which an undo may declare again for
 * the bytes it handed under them (0033). Throws a RangeError for a base
 * that is not an identifier.
 */
export function nextAssetId(report: ReportDefinition, base: string, handed: ReadonlySet<string> = new Set()): string {
  checkPrefix(base)
  return freshId(base, new Set([...handed, ...report.assets.map(({ id }) => id)]), base)
}

export function removeAsset(report: ReportDefinition, id: string): CommandOutcome {
  return withList(report, 'assets', remove(report.assets, id, '/assets', 'asset'))
}

export function putAggregate(report: ReportDefinition, id: string, aggregate: Omit<AggregateDef, 'id'>): CommandOutcome {
  return withList(report, 'aggregates', put(report.aggregates, id, aggregate))
}

export function removeAggregate(report: ReportDefinition, id: string): CommandOutcome {
  return withList(report, 'aggregates', remove(report.aggregates, id, '/aggregates', 'aggregate'))
}

/** The dataset in `slot`: the header or the detail contract, replaced whole. */
export function putDataset(report: ReportDefinition, slot: DatasetRole, contract: DatasetContract): CommandOutcome {
  return { ok: true, report: { ...report, datasets: { ...report.datasets, [slot]: contract } } }
}

export function removeDataset(report: ReportDefinition, slot: DatasetRole): CommandOutcome {
  if (report.datasets[slot] === undefined) return refuse('not-found', `the report declares no ${slot} dataset`, { path: `/datasets/${slot}` })
  const { [slot]: _removed, ...datasets } = report.datasets
  return { ok: true, report: { ...report, datasets } }
}

/** `report` with the fields of the dataset in `slot` changed by `change`, or a refusal when there is no such dataset. */
function withFields(
  report: ReportDefinition,
  slot: DatasetRole,
  change: (fields: readonly FieldContract[]) => readonly FieldContract[] | Refusal,
): CommandOutcome {
  const dataset = report.datasets[slot]
  if (dataset === undefined) return refuse('not-found', `the report declares no ${slot} dataset`, { path: `/datasets/${slot}` })
  const fields = change(dataset.fields)
  return 'ok' in fields ? fields : { ok: true, report: { ...report, datasets: { ...report.datasets, [slot]: { ...dataset, fields } } } }
}

export function putField(report: ReportDefinition, slot: DatasetRole, fieldId: string, field: Omit<FieldContract, 'id'>): CommandOutcome {
  return withFields(report, slot, (fields) => put(fields, fieldId, field))
}

export function removeField(report: ReportDefinition, slot: DatasetRole, fieldId: string): CommandOutcome {
  return withFields(report, slot, (fields) => remove(fields, fieldId, `/datasets/${slot}/fields`, `field of the ${slot} dataset`))
}
