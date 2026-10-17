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
 * A QR code's content, and each text of a QR-bill or an EPC QR code, is
 * read run by run as a paragraph's is, and joined into the one text the
 * code encodes (`joinedText`), where a value that prints as nothing is
 * refused in a final render.
 */
import type { Inline as ReportInline } from '@formancy/report-spec'
import type { Inline } from './document.js'
import type { TypedValue } from './format.js'
import { fieldValue, parameterType, valueOf } from './render-context.js'
import type { Render, Scope } from './render-context.js'
import { placed } from './resolve-errors.js'

/** What an error names besides the inline's path: the component, and in a table the column, or what holds it outside any component. */
export interface Owner {
  /** What holds the inline where no component does, by name: "the payment part". A component is named by its id. */
  readonly said?: string
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
  const where = [owner.componentId === undefined ? owner.said : `component ${owner.componentId}`, owner.columnId && `column ${owner.columnId}`, scope.row !== undefined && `detail row ${scope.row}`].filter(Boolean).join(', ')
  render.problems.error({ stage: 'format', code: formatted.code, path, message: `${where}: ${formatted.message}`, ...placed({ componentId: owner.componentId, columnId: owner.columnId, row: scope.row }) })
  return undefined
}

/** `inline`, at `path` in the report, as the run it prints in `scope`; undefined when it could not be, which is recorded. */
export function runOf(render: Render, scope: Scope, inline: ReportInline, path: string, owner: Owner): Inline | undefined {
  if (inline.kind === 'text') return { text: inline.text }
  if (inline.kind === 'pageNumber' || inline.kind === 'pageCount') return { field: inline.kind }
  const run = printed(render, scope, inline, path, owner)
  return run && { text: run.text }
}

/** What holds runs a code encodes, as an error names it: a QR code's or an EPC QR code's component, or the payment part. */
export interface Encoder {
  /** How an error's message names it: "component pay-code", "the payment part". */
  readonly said: string
  /** The component, for a code that is one. */
  readonly componentId?: string
  /** What the runs are encoded in. */
  readonly code: keyof typeof SCANNED_AS
}

/** What a code of less than its runs would scan as, by what they are encoded in. */
const SCANNED_AS = {
  'a QR code': 'some other text',
  'a QR-bill': 'some other bill',
  'an EPC QR code': 'some other transfer',
} as const

/** What runs encoded in a code join to, and whether a run of them had a value that is null, which a preview prints as nothing. */
export interface Encoded {
  readonly text: string
  readonly lacking: boolean
}

/**
 * The text `runs`, at `path`, join to when they are encoded in a code:
 * read in `scope` run by run as a paragraph's runs are, so that the two
 * never format a value apart. Undefined when a run is refused, which is
 * recorded, naming `encoder`.
 *
 * A final render refuses a run whose value is null: a code of less than
 * its content scans as some other text, and the page does not say so. A
 * preview encodes it as nothing, as a paragraph prints it, and says it
 * did. A page counter has no value before there are pages, and
 * report-spec refuses one in a code; one that reaches here all the same
 * throws, never encoded as nothing.
 *
 * `unused` is given for a text its code may leave out, and says whether
 * the text the runs print leaves its element unused. A text that does,
 * nulls and all -- a nullable field's way of saying "none" -- is no text
 * rather than one cut short, and a final render takes it as a preview
 * does; one whose other runs print something is still refused.
 */
export function joinedText(render: Render, scope: Scope, runs: readonly ReportInline[], path: string, encoder: Encoder, unused?: (text: string) => boolean): Encoded | undefined {
  const texts: string[] = []
  const nulls: string[] = []
  let refused = false
  for (const [index, inline] of runs.entries()) {
    const at = `${path}/${index}`
    if (inline.kind === 'pageNumber' || inline.kind === 'pageCount') {
      throw new RangeError(`${encoder.said} holds a ${inline.kind} at ${at}, which has no value before there are pages; report-spec refuses it`)
    }
    const run = inline.kind === 'text' ? { value: undefined, text: inline.text } : printed(render, scope, inline, at, encoder)
    if (run === undefined) refused = true
    else {
      if (run.value === null) nulls.push(at)
      texts.push(run.text)
    }
  }
  const text = texts.join('')
  if (!render.preview && nulls.length > 0 && unused?.(text) !== true) {
    for (const at of nulls) {
      render.problems.error({ stage: 'resolve', code: 'no-qr-value', path: at, message: `${encoder.said}: this run has no value, and ${encoder.code} without it would scan as ${SCANNED_AS[encoder.code]}`, ...placed(encoder) })
    }
    return undefined
  }
  return refused ? undefined : { text, lacking: render.preview && nulls.length > 0 }
}

/**
 * The text the QR code `id` encodes: its `content`, at `path`, joined as
 * `joinedText` joins it. Undefined when it is refused, which is recorded,
 * naming the code. A final render refuses content that prints nothing at
 * all, a code of nothing, which scans as no code; a preview encodes it.
 */
export function encodedText(render: Render, scope: Scope, content: readonly ReportInline[], path: string, id: string): string | undefined {
  const joined = joinedText(render, scope, content, `${path}/content`, { said: `component ${id}`, componentId: id, code: 'a QR code' })
  if (joined === undefined) return undefined
  if (joined.text !== '' || render.preview) return joined.text
  render.problems.error({ stage: 'resolve', code: 'empty-qr-code', path: `${path}/content`, message: `component ${id}: its content prints nothing, and a QR code of nothing scans as no code`, componentId: id })
  return undefined
}

/** The text of runs that hold no page counter: what a table cell or a group header prints. */
export function textOfRuns(runs: readonly Inline[]): string {
  return runs.map((run) => ('text' in run ? run.text : '')).join('')
}
