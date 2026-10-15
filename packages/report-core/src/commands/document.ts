/**
 * Commands on the report as a whole: its title, its locale, its page, and
 * the whole document at once.
 */
import type { Margins, Orientation, PageSizeName, ReportDefinition } from '@formancy/report-spec'
import { patched } from '../lists.js'
import type { CommandOutcome } from '../outcome.js'

export function setTitle(report: ReportDefinition, title: string): CommandOutcome {
  return { ok: true, report: { ...report, title } }
}

export function setLocale(report: ReportDefinition, locale: string): CommandOutcome {
  return { ok: true, report: { ...report, locale } }
}

/** A change to the page: its size, its orientation, any of its margins. */
export interface PagePatch {
  readonly size?: PageSizeName
  readonly orientation?: Orientation
  readonly margins?: Partial<Margins>
}

export function setPage(report: ReportDefinition, patch: PagePatch): CommandOutcome {
  const { margins, ...rest } = patch
  const page = { ...patched(report.page, rest), margins: margins === undefined ? report.page.margins : { ...report.page.margins, ...margins } }
  return { ok: true, report: { ...report, page } }
}

/**
 * The whole document, replaced: a paste, an import, an AI proposal that
 * rewrote the report. Taken as one edit, so the session validates it and
 * records it as one undo step like any other.
 */
export function replaceDocument(_report: ReportDefinition, next: ReportDefinition): CommandOutcome {
  return { ok: true, report: next }
}
