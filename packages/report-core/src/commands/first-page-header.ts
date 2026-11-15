/**
 * Commands on a first page's own header: what page 1 prints at its top in
 * place of the page header, which then prints from page 2 on
 * ([0060](../../../../docs/decisions/0060-a-reports-first-page-may-print-a-header-of-its-own-or-none-in-place-of-the-page-header.md)).
 *
 * Its presence is the choice: absent, page 1 prints the page header; an
 * empty one prints no header. So these two make the choice, a header of
 * its own put in whole or taken away, and every component command edits
 * what stands in it once it is there. Whether what it holds may stand
 * there -- no table, no page number -- is report-spec's question, which
 * the session asks of every edit alike (0008).
 */
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { refuse } from '../outcome.js'
import type { CommandOutcome } from '../outcome.js'

const PATH = '/regions/firstPageHeader'

/** The report with `components` for page 1's own header: added where it has none, in place of the one it has otherwise; none, page 1 prints no header. */
export function putFirstPageHeader(report: ReportDefinition, components: readonly Component[]): CommandOutcome {
  return { ok: true, report: { ...report, regions: { ...report.regions, firstPageHeader: components } } }
}

/** The report without page 1's own header, what it holds with it: page 1 prints the page header again. */
export function removeFirstPageHeader(report: ReportDefinition): CommandOutcome {
  if (report.regions.firstPageHeader === undefined) return refuse('not-found', 'page 1 prints the page header, and has no header of its own', { path: PATH })
  const { firstPageHeader: _removed, ...regions } = report.regions
  return { ok: true, report: { ...report, regions } }
}
