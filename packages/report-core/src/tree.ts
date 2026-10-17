/**
 * Places in a report: where a component stands or can be put, and how to
 * change one place without touching the rest.
 *
 * A place is named by the same JSON Pointers `walkComponents` and the
 * validator use, so a command, a diagnostic and a validation error about
 * one component all point at one path.
 */
import { componentAt } from '@formancy/report-spec'
import type { Component, ComponentKind, RegionName, ReportDefinition } from '@formancy/report-spec'
import { quote, refuse } from './outcome.js'
import type { Refusal } from './outcome.js'

/**
 * Where a component goes: a position in a region's list, or in the list a
 * container holds -- a section's, a keep-together block's, or one column's
 * of a columns block. `index` is the position the component ends at.
 */
export interface Location {
  readonly region: RegionName
  /** The id of the container; absent for the region's own list. */
  readonly parent?: string
  /** Which column, for a columns block, and only for one. */
  readonly column?: number
  readonly index: number
}

type Lists = (list: readonly Component[]) => readonly Component[]

/** A list of components a container holds, and for a columns block which column it is. */
export interface HeldList {
  readonly column?: number
  readonly list: readonly Component[]
}

/** How a kind holds components: the lists it holds, and itself rebuilt with every one of them changed. */
interface Holding<C extends Component> {
  readonly lists: (component: C) => readonly HeldList[]
  readonly rebuild: (component: C, change: Lists) => C
}

/** The one shape every container but a columns block has: one list, under `components`. */
function oneList<C extends Extract<Component, { readonly components: readonly Component[] }>>(): Holding<C> {
  return { lists: (component) => [{ list: component.components }], rebuild: (component, change) => ({ ...component, components: change(component.components) }) }
}

/**
 * How each kind holds components, or undefined for a kind that holds none.
 * A table over every kind, so a container added to the format without
 * saying where it keeps its children does not compile.
 */
const CONTAINERS: { readonly [K in ComponentKind]: Holding<Extract<Component, { kind: K }>> | undefined } = {
  text: undefined,
  image: undefined,
  qrCode: undefined,
  epcQrCode: undefined,
  line: undefined,
  rectangle: undefined,
  spacer: undefined,
  columns: {
    lists: (component) => component.columns.map((slot, column) => ({ column, list: slot.components })),
    rebuild: (component, change) => ({ ...component, columns: component.columns.map((slot) => ({ ...slot, components: change(slot.components) })) }),
  },
  section: oneList(),
  table: undefined,
  pageBreak: undefined,
  keepTogether: oneList(),
}

function holding(component: Component): Holding<Component> | undefined {
  return CONTAINERS[component.kind] as Holding<Component> | undefined
}

/** `component` with every list of components it holds changed by `change`; itself when it holds none. */
export function withChildren(component: Component, change: Lists): Component {
  return holding(component)?.rebuild(component, change) ?? component
}

/** The lists of components `component` holds, in order; none for a kind that holds none. */
export function heldLists(component: Component): readonly HeldList[] {
  return holding(component)?.lists(component) ?? []
}

/** A list of components, and the JSON Pointer to it. */
export interface ComponentList {
  readonly pointer: string
  readonly list: readonly Component[]
}

/** The list a location names, without its index, or why it names none. */
export function listAt(report: ReportDefinition, location: Omit<Location, 'index'>): ComponentList | Refusal {
  const { region, parent, column } = location
  if (parent === undefined) {
    if (column !== undefined) return refuse('invalid-location', 'a column is chosen only inside a columns block')
    return { pointer: `/regions/${region}`, list: report.regions[region] }
  }
  const found = componentAt(report, parent)
  if (found === undefined) return refuse('not-found', `no component is ${quote(parent)}`, { componentId: parent })
  const place = { path: found.path, componentId: parent }
  if (found.region !== region) return refuse('invalid-location', `${quote(parent)} stands in the ${found.region}, not the ${region}`, place)
  const container = found.component
  if (holding(container) === undefined) return refuse('not-a-container', `${quote(parent)} is a ${container.kind}, which holds no components`, place)
  if (container.kind === 'columns') {
    if (column === undefined) return refuse('invalid-location', 'a columns block holds components in its columns; say which column', place)
    const slot = container.columns[column]
    if (!Number.isInteger(column) || slot === undefined) {
      return refuse('index-out-of-range', `${String(column)} is not a column of ${quote(parent)}, which has ${container.columns.length}`, place)
    }
    return { pointer: `${found.path}/columns/${column}/components`, list: slot.components }
  }
  if (column !== undefined) return refuse('invalid-location', `${quote(parent)} is a ${container.kind}, which has no columns`, place)
  // Every other container holds one list, under `components`.
  return { pointer: `${found.path}/components`, list: (container as { readonly components: readonly Component[] }).components }
}

/** The list a component stands in, and its position there, from the component's own pointer. */
export function standing(path: string): { readonly pointer: string; readonly index: number } {
  const cut = path.lastIndexOf('/')
  return { pointer: path.slice(0, cut), index: Number(path.slice(cut + 1)) }
}

/** The segments of a JSON Pointer to something inside the report -- never '', the report itself -- unescaped (RFC 6901). */
function segments(pointer: string): string[] {
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
}

function updated(value: unknown, path: readonly string[], update: (value: unknown) => unknown): unknown {
  const [head, ...rest] = path
  if (head === undefined) return update(value)
  if (Array.isArray(value)) {
    const index = Number(head)
    return value.map((item: unknown, at) => (at === index ? updated(item, rest, update) : item))
  }
  const record = value as Record<string, unknown>
  return { ...record, [head]: updated(record[head], rest, update) }
}

/**
 * `report` with the value at `pointer` replaced by what `update` makes of
 * it. Only the objects and arrays on the way to it are copied; everything
 * else is shared with `report`, which is left as it was.
 */
export function updateAt<T>(report: ReportDefinition, pointer: string, update: (value: T) => unknown): ReportDefinition {
  return updated(report, segments(pointer), update as (value: unknown) => unknown) as ReportDefinition
}
