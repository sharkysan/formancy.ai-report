/**
 * The report every builder scenario starts from, or breaks one thing in: a
 * site visit's findings, an introduction, a section holding a note, and a
 * spacer. Its own module, so that the scenarios of each subject -- the
 * images' among them (0033) -- start from one report without importing one
 * another.
 */
import type { ReportDefinition } from '@formancy/report-spec'

const SCENARIO_REPORT: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'site-visit',
  title: 'Site visit',
  locale: 'en',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [{ id: 'heading', size: 14, bold: true }],
  datasets: {},
  parameters: [],
  assets: [],
  aggregates: [],
  regions: {
    reportHeader: [],
    pageHeader: [],
    body: [
      { id: 'findings', kind: 'text', style: 'heading', content: [{ kind: 'text', text: 'Findings' }] },
      { id: 'intro', kind: 'text', content: [{ kind: 'text', text: 'Introduction' }] },
      { id: 'notes', kind: 'section', components: [{ id: 'note', kind: 'text', content: [{ kind: 'text', text: 'Note' }] }] },
      { id: 'gap', kind: 'spacer', height: 12 },
    ],
    pageFooter: [],
    summary: [],
  },
}

/** The report every scenario starts from, or breaks one thing in: a fresh copy. scenarios.test.ts opens it, so it is valid. */
export function scenarioReport(): ReportDefinition {
  return JSON.parse(JSON.stringify(SCENARIO_REPORT)) as ReportDefinition
}
