/**
 * Where a component stands, every place one could go, and the places one
 * may go: what a builder needs for a drop target, a keyboard move and focus
 * after a deletion (plan 8, plan 21's "valid drop destinations").
 *
 * Where a component may stand is the validator's to decide (0007): a page
 * counter only in the page header and footer, a table never inside columns.
 * So the destinations are found by asking it, place by place, rather than
 * by a second copy of its placement rules that could disagree with it.
 */
import { REGION_NAMES, validateReport, walkComponents } from '@formancy/report-spec'
import type { Component, RegionName, ReportDefinition } from '@formancy/report-spec'
import { insertComponent, moveComponent, removeComponent } from './commands/components.js'
import type { CommandOutcome } from './outcome.js'
import { heldLists, standing } from './tree.js'
import type { Location } from './tree.js'

/** A columns block's list: the pointer to the block, and the column. */
const SLOT = /^(.*)\/columns\/(\d+)\/components$/

/**
 * Where the component `id` stands, as the location `moveComponent` and
 * `insertComponent` take: a move to it puts the component back where it
 * was. Undefined when the report has no such component.
 */
export function locationOf(report: ReportDefinition, id: string): Location | undefined {
  const all = walkComponents(report)
  const found = all.find(({ component }) => component.id === id)
  if (found === undefined) return undefined
  const { pointer, index } = standing(found.path)
  if (pointer === `/regions/${found.region}`) return { region: found.region, index }
  // Inside a container: a columns block's column, or another container's
  // one list, under `components`.
  const slot = SLOT.exec(pointer)
  const parentPath = slot === null ? pointer.slice(0, -'/components'.length) : (slot[1] as string)
  const parent = all.find(({ path }) => path === parentPath)?.component.id as string
  return { region: found.region, parent, ...(slot === null ? {} : { column: Number(slot[2]) }), index }
}

/**
 * Every place a component could be put, in reading order: before each
 * component and at the end of each list, a container's places right after
 * the place before the container. Each is a location `insertComponent`
 * takes; whether the validator accepts what is put there is
 * `validLocations`' question.
 */
export function locations(report: ReportDefinition): Location[] {
  const found: Location[] = []
  const visit = (region: RegionName, list: readonly Component[], place: Omit<Location, 'region' | 'index'>): void => {
    for (const [index, component] of list.entries()) {
      found.push({ region, ...place, index })
      for (const { column, list: held } of heldLists(component)) visit(region, held, { parent: component.id, ...(column === undefined ? {} : { column }) })
    }
    found.push({ region, ...place, index: list.length })
  }
  for (const region of REGION_NAMES) visit(region, report.regions[region], {})
  return found
}

/**
 * The places `subject` may go, in reading order: for a new component, each
 * location where inserting it gives a report the validator accepts; for the
 * id of one the report holds, each location a move of it to gives one --
 * read, as `moveComponent` reads it, in the report without it. None for an
 * id the report lacks, or a component no place accepts, such as a second
 * detail table or one whose id is taken.
 *
 * It validates the whole report once per place, so its cost is the
 * report's size times its number of places: a builder asks it when a drag
 * starts, not on every pointer move.
 */
export function validLocations(report: ReportDefinition, subject: Component | string): Location[] {
  if (typeof subject !== 'string') return acceptedOf(locations(report), (location) => insertComponent(report, location, subject))
  const without = removeComponent(report, subject)
  return without.ok ? acceptedOf(locations(without.report), (location) => moveComponent(report, subject, location)) : []
}

/** The candidates where `put` gives a report the validator accepts. */
function acceptedOf(candidates: readonly Location[], put: (location: Location) => CommandOutcome): Location[] {
  return candidates.filter((location) => {
    const outcome = put(location)
    return outcome.ok && validateReport(outcome.report).valid
  })
}
