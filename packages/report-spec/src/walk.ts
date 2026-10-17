/**
 * Finding components in a report: the walk the core's commands, the
 * builder's outline and the runtime share, so they visit components in one
 * order and name them by one path.
 */
import { at } from './pointer.js'
import { REGION_NAMES } from './types.js'
import type { Component, ComponentKind, RegionName, Regions, ReportDefinition } from './types.js'

export interface ComponentLocation {
  readonly component: Component
  readonly region: RegionName
  /** A JSON Pointer from the report's root: the path validation errors use. */
  readonly path: string
  /** How many containers enclose the component: 0 at a region's top level. */
  readonly depth: number
}

type ChildLists = readonly (readonly [string, readonly Component[]])[]

const NONE: ChildLists = []

/**
 * The component lists each kind holds, each with its path relative to the
 * component. A table over every kind, so a container added to the format
 * without saying where it keeps its children does not compile, and the walk
 * cannot quietly skip what the validator checked.
 */
const CHILDREN: { readonly [K in ComponentKind]: (component: Extract<Component, { kind: K }>) => ChildLists } = {
  text: () => NONE,
  image: () => NONE,
  qrCode: () => NONE,
  epcQrCode: () => NONE,
  line: () => NONE,
  rectangle: () => NONE,
  spacer: () => NONE,
  columns: (component) => component.columns.map((column, index) => [`/columns/${index}/components`, column.components] as const),
  section: (component) => [['/components', component.components]],
  table: () => NONE,
  pageBreak: () => NONE,
  keepTogether: (component) => [['/components', component.components]],
}

function childLists(component: Component): ChildLists {
  return (CHILDREN[component.kind] as (component: Component) => ChildLists)(component)
}

/** Every component in the report: regions in the order a reader meets them, each depth-first, a container before what it holds. */
export function walkComponents(report: ReportDefinition): readonly ComponentLocation[] {
  return walkRegions(report.regions)
}

/** Every component in `regions`, as `walkComponents` finds them: for a validation that has read the regions and not yet the whole report. */
export function walkRegions(regions: Regions): readonly ComponentLocation[] {
  const found: ComponentLocation[] = []
  const visit = (components: readonly Component[], region: RegionName, path: string, depth: number): void => {
    for (const [index, component] of components.entries()) {
      const where = at(path, index)
      found.push({ component, region, path: where, depth })
      for (const [suffix, children] of childLists(component)) visit(children, region, `${where}${suffix}`, depth + 1)
    }
  }
  for (const region of REGION_NAMES) visit(regions[region], region, at('/regions', region), 0)
  return found
}

/** The component with `id`, where it is, or undefined when the report has none. Ids are unique in a valid report. */
export function componentAt(report: ReportDefinition, id: string): ComponentLocation | undefined {
  return walkComponents(report).find(({ component }) => component.id === id)
}
