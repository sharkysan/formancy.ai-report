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
 *
 * A QR code's content is read run by run as a paragraph's is, and joined
 * into the one text the code encodes (`encodedText`), where a value that
 * prints as nothing is refused in a final render.
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

/** A run whose value is read: anything but literal text and a page counter. */
type BoundInline = Exclude<ReportInline, { kind: 'text' | 'pageNumber' | 'pageCount' }>

/** The value `inline` prints, read in `scope`; undefined when its evaluation failed, which is recorded. */
function valueAt(render: Render, scope: Scope, inline: BoundInline, path: string): TypedValue | null | undefined {
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

/** The value `inline` reads in `scope`, and the text it prints; undefined when either could not be had, which is recorded. */
function printed(render: Render, scope: Scope, inline: BoundInline, path: string, owner: Owner): { readonly value: TypedValue | null; readonly text: string } | undefined {
  const value = valueAt(render, scope, inline, path)
  if (value === undefined) return undefined
  const formatted = render.formatter.format(value, inline.format, scope.currency)
  if (formatted.ok) return { value, text: formatted.text }
  const where = [owner.componentId && `component ${owner.componentId}`, owner.columnId && `column ${owner.columnId}`, scope.row !== undefined && `detail row ${scope.row}`].filter(Boolean).join(', ')
  render.problems.error({ stage: 'format', code: formatted.code, path, message: `${where}: ${formatted.message}`, ...placed({ ...owner, row: scope.row }) })
  return undefined
}

/** `inline`, at `path` in the report, as the run it prints in `scope`; undefined when it could not be, which is recorded. */
export function runOf(render: Render, scope: Scope, inline: ReportInline, path: string, owner: Owner): Inline | undefined {
  if (inline.kind === 'text') return { text: inline.text }
  if (inline.kind === 'pageNumber' || inline.kind === 'pageCount') return { field: inline.kind }
  const run = printed(render, scope, inline, path, owner)
  return run && { text: run.text }
}

/**
 * The text the QR code `id` encodes: its `content`, at `path`, read in
 * `scope` run by run as a paragraph's runs are, so that the two never
 * format a value apart, and joined. Undefined when it is refused, which is
 * recorded, naming the code.
 *
 * A final render refuses a run whose value is null, and content that
 * prints nothing at all: a code of less than its content scans as some
 * other reference, a code of nothing as no code, and neither says so on
 * the page. A preview encodes both as they resolve, as a paragraph prints
 * them. A page counter has no value before there are pages, and
 * report-spec refuses one in a code; one that reaches here all the same
 * throws, never encoded as nothing.
 */
export function encodedText(render: Render, scope: Scope, content: readonly ReportInline[], path: string, id: string): string | undefined {
  const texts: string[] = []
  let refused = false
  for (const [index, inline] of content.entries()) {
    const at = `${path}/content/${index}`
    if (inline.kind === 'pageNumber' || inline.kind === 'pageCount') {
      throw new RangeError(`the QR code ${id} holds a ${inline.kind} at ${at}, which has no value before there are pages; report-spec refuses it`)
    }
    const run = inline.kind === 'text' ? { value: undefined, text: inline.text } : printed(render, scope, inline, at, { componentId: id })
    if (run?.value === null && !render.preview) {
      render.problems.error({ stage: 'resolve', code: 'no-qr-value', path: at, message: `component ${id}: this run has no value, and a QR code without it would scan as some other text`, componentId: id })
      refused = true
    } else if (run === undefined) refused = true
    else texts.push(run.text)
  }
  if (refused) return undefined
  const text = texts.join('')
  if (text !== '' || render.preview) return text
  render.problems.error({ stage: 'resolve', code: 'empty-qr-code', path: `${path}/content`, message: `component ${id}: its content prints nothing, and a QR code of nothing scans as no code`, componentId: id })
  return undefined
}

/** The text of runs that hold no page counter: what a table cell or a group header prints. */
export function textOfRuns(runs: readonly Inline[]): string {
  return runs.map((run) => ('text' in run ? run.text : '')).join('')
}
