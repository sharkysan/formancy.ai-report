/**
 * Commands on the component tree: insert, remove, move, update and
 * duplicate, at any depth, and the ids new components take.
 *
 * Every drag has a keyboard path (formancy.ai 0046), so these are that
 * path: a location is a region or container and an index, and an index
 * outside the list is refused, never clamped, so that a keyboard move and a
 * pointer drop that name the same place do the same thing.
 */
import { componentAt, walkComponents } from '@formancy/report-spec'
import type { Component, ComponentKind, ReportDefinition } from '@formancy/report-spec'
import { freshId, nextId } from '../ids.js'
import { checkIndex, insertedAt, patched, removedAt } from '../lists.js'
import type { Patch } from '../lists.js'
import { isRefusal, quote, refuse } from '../outcome.js'
import type { CommandOutcome, Refusal } from '../outcome.js'
import { listAt, standing, updateAt, withChildren } from '../tree.js'
import type { ComponentList, Location } from '../tree.js'

/**
 * A change to a component of kind `K`: any of its own properties, but never
 * its id or its kind. Typed per kind, so a patch for a text cannot carry a
 * table's columns; `null` removes an optional property.
 */
export type ComponentPatch<K extends ComponentKind> = K extends ComponentKind ? Patch<Omit<Extract<Component, { kind: K }>, 'id' | 'kind'>> : never

function missing(id: string): Refusal {
  return refuse('not-found', `no component is ${quote(id)}`, { componentId: id })
}

/** `component` put at `index` of `target`. */
function placed(report: ReportDefinition, target: ComponentList, index: number, component: Component): CommandOutcome {
  const outside = checkIndex(index, target.list.length, `a list of ${target.list.length} components`, { path: target.pointer })
  if (outside !== undefined) return outside
  return { ok: true, report: updateAt<readonly Component[]>(report, target.pointer, (list) => insertedAt(list, index, component)) }
}

export function insertComponent(report: ReportDefinition, location: Location, component: Component): CommandOutcome {
  const target = listAt(report, location)
  return isRefusal(target) ? target : placed(report, target, location.index, component)
}

/** Removes a component and everything it holds. */
export function removeComponent(report: ReportDefinition, id: string): CommandOutcome {
  const found = componentAt(report, id)
  if (found === undefined) return missing(id)
  const { pointer, index } = standing(found.path)
  return { ok: true, report: updateAt<readonly Component[]>(report, pointer, (list) => removedAt(list, index)) }
}

/**
 * Moves a component, with everything it holds, so that it ends at
 * `location`. The location is read in the report as it is without the
 * component, so moving one down its own list is its index plus one.
 */
export function moveComponent(report: ReportDefinition, id: string, location: Location): CommandOutcome {
  const found = componentAt(report, id)
  if (found === undefined) return missing(id)
  const parent = location.parent === undefined ? undefined : componentAt(report, location.parent)
  if (parent !== undefined && (parent.path === found.path || parent.path.startsWith(`${found.path}/`))) {
    return refuse('into-itself', `${quote(id)} cannot be moved into itself or into something it holds`, { path: found.path, componentId: id })
  }
  const { pointer, index } = standing(found.path)
  const without = updateAt<readonly Component[]>(report, pointer, (list) => removedAt(list, index))
  const target = listAt(without, location)
  return isRefusal(target) ? target : placed(without, target, location.index, found.component)
}

/**
 * Changes a component's own properties. `kind` says which kind the patch is
 * for, so the patch is typed; it is checked against the component's, for a
 * caller -- a proposal read from JSON -- whose types were never checked.
 */
export function updateComponent<K extends ComponentKind>(report: ReportDefinition, id: string, kind: K, patch: ComponentPatch<K>): CommandOutcome {
  const found = componentAt(report, id)
  if (found === undefined) return missing(id)
  if (found.component.kind !== kind) return refuse('kind-mismatch', `${quote(id)} is a ${found.component.kind}, not a ${kind}`, { path: found.path, componentId: id })
  for (const key of ['id', 'kind'] as const) {
    if (Object.hasOwn(patch, key)) {
      return refuse('immutable-property', `a component's ${key} never changes in place; insert a new component instead`, { path: `${found.path}/${key}`, componentId: id })
    }
  }
  return { ok: true, report: updateAt<Component>(report, found.path, (component) => patched(component as object, patch as Patch<object>)) }
}

function idsOf(report: ReportDefinition): Set<string> {
  return new Set(walkComponents(report).map(({ component }) => component.id))
}

/**
 * What a new component of each kind is named after: its kind, written as an
 * identifier. A table over every kind, so a kind added to the format is
 * named too; a camelCase kind is not an identifier as it stands.
 */
const NAMED_AFTER: { readonly [K in ComponentKind]: string } = {
  text: 'text',
  image: 'image',
  qrCode: 'qr-code',
  epcQrCode: 'epc-qr-code',
  line: 'line',
  rectangle: 'rectangle',
  spacer: 'spacer',
  columns: 'columns',
  section: 'section',
  table: 'table',
  pageBreak: 'page-break',
  keepTogether: 'keep-together',
}

/**
 * An id no component in `report` has: `prefix` itself when it is free, and
 * otherwise `prefix-2`, `prefix-3` and so on, counted from the prefix's base
 * when it already ends in a number. A component kind is a prefix too, the
 * palette's: `pageBreak` gives `page-break`. Throws a RangeError for any
 * other prefix that is not an identifier, which would give an id the
 * validator refuses.
 */
export function nextComponentId(report: ReportDefinition, prefix: string): string {
  const named = Object.hasOwn(NAMED_AFTER, prefix) ? NAMED_AFTER[prefix as ComponentKind] : prefix
  return nextId(named, idsOf(report), prefix)
}

/** A copy of `component` and all it holds, each given a fresh id, recorded in `taken` as it is given. */
function renamed(component: Component, taken: Set<string>): Component {
  const id = freshId(component.id, taken)
  taken.add(id)
  return withChildren({ ...component, id }, (list) => list.map((child) => renamed(child, taken)))
}

/** Copies a component, and everything it holds, to just after it, with fresh ids; the outcome says the copy's id. */
export function duplicateComponent(report: ReportDefinition, id: string): CommandOutcome<{ readonly id: string }> {
  const found = componentAt(report, id)
  if (found === undefined) return missing(id)
  const copy = renamed(found.component, idsOf(report))
  const { pointer, index } = standing(found.path)
  return { ok: true, report: updateAt<readonly Component[]>(report, pointer, (list) => insertedAt(list, index + 1, copy)), id: copy.id }
}
