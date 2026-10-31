/**
 * What stands in the list a location names, read from report-spec's walk
 * and the pointers it gives -- the same pointers report-core's locations
 * are built from -- so a drop target's neighbours and a keyboard move's
 * bounds are counted in one list.
 */
import type { Location } from '@formancy/report-core'
import { walkComponents } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'

/** The ids of the components in the list `place` names, in order, leaving out `excluding`: a move counts its index in the list without what moves. */
export function siblingsAt(report: ReportDefinition, place: Omit<Location, 'index'>, excluding?: string): string[] {
  const walked = walkComponents(report)
  const parent = place.parent === undefined ? undefined : walked.find(({ component }) => component.id === place.parent)?.path
  const pointer =
    place.parent === undefined
      ? `/regions/${place.region}`
      : place.column === undefined
        ? `${parent}/components`
        : `${parent}/columns/${place.column}/components`
  return walked
    .filter(({ component, path }) => component.id !== excluding && path.startsWith(`${pointer}/`) && !path.slice(pointer.length + 1).includes('/'))
    .map(({ component }) => component.id)
}
