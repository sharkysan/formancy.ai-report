/**
 * The outline: the report as a tree a keyboard can walk -- the regions, the
 * components in each, what each container holds and a table's columns --
 * and the one order selectNext and selectPrevious follow.
 *
 * Built from report-spec's walk and the paths it gives, so the outline, the
 * commands and the validator visit components in one order, and which kinds
 * hold components is decided there and nowhere here.
 */
import type { DiagnosticSeverity } from '@formancy/report-core'
import { REGION_NAMES, walkComponents } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { columnKey, regionLabel } from './labels.js'
import type { OutlineNode, OutlineRegion, Selection } from './model.js'
import type { EditorText } from './text.js'

/** What the outline needs besides the report: the labels, what is selected, the diagnostics about each key, and what is wider than its place. */
export interface OutlineInputs {
  readonly labels: ReadonlyMap<string, string>
  readonly selection: Selection | null
  readonly problems: ReadonlyMap<string, number>
  readonly severities: ReadonlyMap<string, DiagnosticSeverity>
  readonly overflowing: ReadonlySet<string>
}

/** The key a selection stands for: a component's id, or its table's column's key. */
export function selectionKey(selection: Selection): string {
  return selection.column === undefined ? selection.id : columnKey(selection.id, selection.column)
}

/** A component's place in a container's list: the container's path, and the column of a columns block it is in. */
const HELD = /^(.*?)(?:\/columns\/(\d+))?\/components\/\d+$/

type Building = { -readonly [K in keyof OutlineNode]: OutlineNode[K] } & { children: OutlineNode[] }

/** The outline: every region in reading order, each with its components as a tree. */
export function buildOutline(report: ReportDefinition, inputs: OutlineInputs, t: EditorText): readonly OutlineRegion[] {
  const selected = inputs.selection === null ? undefined : selectionKey(inputs.selection)
  const row = (key: string, id: string, kind: OutlineNode['kind'], depth: number): Building => {
    const severity = inputs.severities.get(key)
    return {
      key,
      id,
      kind,
      label: inputs.labels.get(key) ?? key,
      depth,
      selected: key === selected,
      problems: inputs.problems.get(key) ?? 0,
      ...(severity === undefined ? {} : { severity }),
      overflows: inputs.overflowing.has(key),
      children: [],
    }
  }
  const tops = new Map(REGION_NAMES.map((region) => [region, [] as OutlineNode[]]))
  const byPath = new Map<string, Building>()
  for (const { component, region, path, depth } of walkComponents(report)) {
    const node = row(component.id, component.id, component.kind, depth)
    if (component.kind === 'table') {
      node.children = component.columns.map((column) => ({ ...row(columnKey(component.id, column.id), component.id, 'tableColumn', depth + 1), column: column.id }))
    }
    byPath.set(path, node)
    if (depth === 0) {
      tops.get(region)?.push(node)
      continue
    }
    const [, parentPath, slot] = HELD.exec(path) ?? []
    if (slot !== undefined) node.slot = Number(slot)
    byPath.get(parentPath ?? '')?.children.push(node)
  }
  return REGION_NAMES.map((region) => ({ region, label: regionLabel(region, t), nodes: tops.get(region) ?? [] }))
}

/** Every row of the outline, in the order it shows them: what the arrow keys walk. */
export function outlineOrder(outline: readonly OutlineRegion[]): Selection[] {
  const order: Selection[] = []
  const visit = (nodes: readonly OutlineNode[]): void => {
    for (const node of nodes) {
      order.push(node.column === undefined ? { id: node.id } : { id: node.id, column: node.column })
      visit(node.children)
    }
  }
  for (const region of outline) visit(region.nodes)
  return order
}
