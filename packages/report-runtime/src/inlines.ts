/**
 * A run of a report -- literal, bound, computed, totalled or a page counter
 * -- lowered to the text it prints, formatted for the report's locale.
 *
 * The one place each kind of inline gets its value: a field from the header
 * or the current record, a parameter from the checked parameters, an
 * expression from its evaluation in the scope it stands in, an aggregate
 * from the report's totals or the current group's. Every value is formatted
 * by `format.ts` with the inline's format, or printed plainly without one,
 * and null prints as nothing (0007). A page counter stays a field the
 * engine fills in, since only it knows the pages.
 */
import type { Inline as ReportInline } from '@formancy/report-spec'
import type { Inline } from './document.js'
import type { TypedValue } from './format.js'
import { fieldValue, parameterType, valueOf } from './render-context.js'
import type { Render, Scope } from './render-context.js'
import { placed } from './resolve-errors.js'

/** What an error names besides the inline's path: the component, and in a table the column. */
export interface Owner {
  readonly componentId?: string
  readonly columnId?: string
}

/** The value `inline` prints, read in `scope`; undefined when its evaluation failed, which is recorded. */
function valueAt(render: Render, scope: Scope, inline: Exclude<ReportInline, { kind: 'text' | 'pageNumber' | 'pageCount' }>, path: string): TypedValue | null | undefined {
  switch (inline.kind) {
    case 'field':
      return fieldValue(render, scope.record, inline.field)
    case 'parameter': {
      const value = render.params[inline.parameter] ?? null
      return value === null ? null : ({ type: parameterType(render.report, inline.parameter), value } as TypedValue)
    }
    case 'expression':
      return valueOf(render, scope, `${path}/expression/cel`)
    case 'aggregate':
      // report-spec allows a group's aggregate only where there is a group.
      return (inline.over === 'group' ? scope.group : render.totals.report)?.get(inline.aggregate) ?? null
  }
}

/** `inline`, at `path` in the report, as the run it prints in `scope`; undefined when it could not be, which is recorded. */
export function runOf(render: Render, scope: Scope, inline: ReportInline, path: string, owner: Owner): Inline | undefined {
  if (inline.kind === 'text') return { text: inline.text }
  if (inline.kind === 'pageNumber' || inline.kind === 'pageCount') return { field: inline.kind }
  const value = valueAt(render, scope, inline, path)
  if (value === undefined) return undefined
  const formatted = render.formatter.format(value, inline.format, scope.currency)
  if (formatted.ok) return { text: formatted.text }
  const where = [owner.componentId && `component ${owner.componentId}`, owner.columnId && `column ${owner.columnId}`, scope.row !== undefined && `detail row ${scope.row}`].filter(Boolean).join(', ')
  render.problems.error({ stage: 'format', code: formatted.code, path, message: `${where}: ${formatted.message}`, ...placed({ ...owner, row: scope.row }) })
  return undefined
}

/** The text of runs that hold no page counter: what a table cell or a group header prints. */
export function textOfRuns(runs: readonly Inline[]): string {
  return runs.map((run) => ('text' in run ? run.text : '')).join('')
}
