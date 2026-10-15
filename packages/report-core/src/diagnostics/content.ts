/**
 * Content that prints nothing: a body with no components, a text with no
 * runs or only blank literal ones.
 *
 * Only what the document alone decides. Whether a keep-together block is
 * taller than a page, whether a fixed width fits its column, whether a
 * table's rows overflow: each depends on measured text and the data, and is
 * the layout's to report with the renderer, not this package's to guess.
 * A table without a detail dataset is no diagnostic either: the validator
 * refuses it (`unknown-dataset`), so a session never holds one.
 */
import { walkComponents } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { quote } from '../outcome.js'
import { diagnostic } from './codes.js'
import type { Diagnostic } from './codes.js'

export function contentDiagnostics(report: ReportDefinition): Diagnostic[] {
  const found: Diagnostic[] = []
  if (report.regions.body.length === 0) {
    found.push(diagnostic('empty-body', 'the body holds nothing, so the report prints only its headers, footers and summary', { path: '/regions/body' }))
  }
  for (const { component, path } of walkComponents(report)) {
    if (component.kind !== 'text') continue
    if (component.content.every((inline) => inline.kind === 'text' && inline.text.trim() === '')) {
      found.push(diagnostic('empty-text', `text ${quote(component.id)} prints nothing`, { path: `${path}/content`, componentId: component.id }))
    }
  }
  return found
}
