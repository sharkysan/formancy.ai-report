/**
 * Where a component being placed may go: report-core's `validLocations`,
 * each named for a person and drawn on the canvas.
 *
 * The places are the validator's answer, never a second copy of its rules
 * (0008), so a builder never offers a drop the session then refuses. A move
 * leaves out where the component already stands, and names each place in
 * the list as it is without it -- the list report-core counts a move's
 * index in -- so "after Spacer" is where it lands.
 */
import { locationOf, validLocations } from '@formancy/report-core'
import type { Location } from '@formancy/report-core'
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { listKey, toPx } from './geometry.js'
import type { Layout } from './geometry.js'
import { regionLabel } from './labels.js'
import type { Box, DropTarget } from './model.js'
import { siblingsAt } from './places.js'
import type { EditorText } from './text.js'

/** An indicator's thickness, in points: a line across the list, centred on the edge it marks. */
const INDICATOR = 2

/** What the targets are named and drawn from. */
export interface TargetInputs {
  readonly labels: ReadonlyMap<string, string>
  readonly layout: Layout
  readonly zoom: number
}

/** The places `subject` -- a new component, or the id of one the report holds -- may go, as the validator accepts them. */
export function placesFor(report: ReportDefinition, subject: Component | string): Location[] {
  const places = validLocations(report, subject)
  if (typeof subject !== 'string') return places
  const here = JSON.stringify(locationOf(report, subject))
  return places.filter((place) => JSON.stringify(place) !== here)
}

/** Whether two indicators would be drawn over each other: a hundredth of a point's touching is not overlapping. */
function overlaps(a: Box, b: Box): boolean {
  const slack = 0.005
  return a.x < b.x + b.width - slack && b.x < a.x + a.width - slack && a.y < b.y + b.height - slack && b.y < a.y + a.height - slack
}

/** An indicator, how deep its list is nested, and which way is into its list: down from its start, up from anywhere else. */
interface Drawn {
  readonly box: Box
  readonly depth: number
  readonly inward: 1 | -1
}

/**
 * The indicators moved apart where they would be drawn over each other.
 * Where a container begins or ends, the first or last place in the list
 * inside it and the place beside the container share an edge -- and with
 * no padding or border, the same box -- so a pointer could reach only one
 * of them. The place in the outer list keeps its edge; one in a list nested
 * deeper moves into its container, a thickness at a time, until it is
 * clear of every indicator kept before it.
 */
function apart(drawn: readonly Drawn[]): Box[] {
  const placed: Box[] = []
  const moved = drawn.map((item) => item.box)
  for (const index of drawn.map((_, at) => at).sort((a, b) => (drawn[a]?.depth ?? 0) - (drawn[b]?.depth ?? 0))) {
    let box = moved[index] as Box
    const step = INDICATOR * (drawn[index]?.inward ?? -1)
    while (placed.some((other) => overlaps(box, other))) box = { ...box, y: Math.round((box.y + step) * 100) / 100 }
    moved[index] = box
    placed.push(box)
  }
  return moved
}

/** Every place `subject` may go, named, with its indicator on the canvas. */
export function dropTargets(report: ReportDefinition, subject: Component | string, inputs: TargetInputs, t: EditorText): DropTarget[] {
  const moving = typeof subject === 'string' ? subject : undefined
  const boxes = new Map(inputs.layout.parts.map((part) => [part.key, part.box]))
  const depths = new Map(inputs.layout.parts.map((part) => [part.key, part.depth]))
  const label = (id: string): string => inputs.labels.get(id) ?? id
  const places = placesFor(report, subject)
  const lists = places.map((location) => siblingsAt(report, location, moving))
  // How deep each place's list is: a region's is 0, a container's one more than the container.
  const nesting = places.map((location) => (location.parent === undefined ? 0 : (depths.get(location.parent) ?? 0) + 1))
  const drawn = apart(
    places.map((location, index) => {
      const siblings = lists[index] ?? []
      const starts = location.index === 0 && siblings.length > 0
      return { box: indicator(location, siblings, inputs.layout, boxes), depth: nesting[index] ?? 0, inward: starts ? 1 : -1 }
    }),
  )
  return places.map((location, index) => {
    const siblings = lists[index] ?? []
    const parent = location.parent === undefined ? regionLabel(location.region, t) : label(location.parent)
    const where = location.column === undefined ? parent : t('target.column', { name: parent, n: location.column + 1 })
    const afterId = siblings[location.index - 1]
    const beforeId = siblings[location.index]
    const pt = drawn[index] as Box
    const named =
      afterId !== undefined ? t('target.after', { where, name: label(afterId) }) : beforeId !== undefined ? t('target.before', { where, name: label(beforeId) }) : t('target.inside', { where })
    return {
      index,
      location,
      label: named,
      ...(afterId === undefined ? {} : { afterId }),
      ...(beforeId === undefined ? {} : { beforeId }),
      pt,
      px: toPx(pt, inputs.zoom),
    }
  })
}

/** Where a place's indicator is drawn: a line across its list, centred on the edge of the neighbour it lands beside. */
function indicator(location: Location, siblings: readonly string[], layout: Layout, boxes: ReadonlyMap<string, Box>): Box {
  const afterId = siblings[location.index - 1]
  const beforeId = siblings[location.index]
  const list = layout.lists.get(listKey(location)) ?? { x: 0, y: 0, width: 0, height: 0 }
  const after = afterId === undefined ? undefined : boxes.get(afterId)
  const before = beforeId === undefined ? undefined : boxes.get(beforeId)
  const edge = after !== undefined ? after.y + after.height : before !== undefined ? before.y : list.y + list.height / 2
  return { x: list.x, y: Math.round((edge - INDICATOR / 2) * 100) / 100, width: list.width, height: INDICATOR }
}

/**
 * The target whose indicator is nearest `point`, in CSS pixels on the
 * sheet, among those whose list the point is over; the narrower list --
 * the deeper one -- wins a tie. Null when the point is over no list.
 */
export function targetNear(targets: readonly DropTarget[], point: { readonly x: number; readonly y: number }): number | null {
  let best: { readonly index: number; readonly distance: number; readonly width: number } | null = null
  for (const target of targets) {
    const { x, y, width, height } = target.px
    if (point.x < x || point.x > x + width) continue
    const distance = Math.abs(point.y - (y + height / 2))
    if (best === null || distance < best.distance || (distance === best.distance && width < best.width)) best = { index: target.index, distance, width }
  }
  return best?.index ?? null
}

/** The target just before or just after the component `id` -- an outline row's upper or lower half -- or null. */
export function targetBeside(targets: readonly DropTarget[], id: string, edge: 'before' | 'after'): number | null {
  const found = targets.find((target) => (edge === 'before' ? target.beforeId : target.afterId) === id)
  return found?.index ?? null
}
