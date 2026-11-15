/**
 * A run of a paragraph set below or above the line, or back on it (0061):
 * what a press of a run's Subscript or Superscript does to the text's
 * content, and the editor's action that makes the press one undo step.
 *
 * Decided here once, so that neither builder works any of it out: the
 * characters a person selected in a literal run's field are snapped to
 * whole graphemes and split from their run, a bound run is set whole, and
 * the run a press set is joined to the literal runs beside it on its
 * baseline, so the content stays in as few runs as it can -- and no other
 * run is touched. A builder adds only what the DOM knows, the field's
 * selection and the text it showed, which is applied only to the text the
 * report holds: a refused value left typed in the field is other text, and
 * its offsets would set the wrong characters. Whether the result is a
 * report -- a split past `MAX_INLINES` -- is the validator's to say, when
 * the session applies it (0008).
 *
 * Lent what it needs of the editor, as `part-actions.ts` is, and run
 * through the editor's one `dispatch`.
 */
import { updateComponent } from '@formancy/report-core'
import type { CommandOutcome } from '@formancy/report-core'
import { BASELINE_SHIFTS } from '@formancy/report-spec'
import type { BaselineShift, Inline, TextInline } from '@formancy/report-spec'
import type { Edit } from './edits.js'
import type { EditorOutcome, EditorRefusalCode, FieldSelection } from './model-actions.js'
import { propertyTarget, specsOf } from './properties.js'
import { groupName, isGroup } from './property-groups.js'
import type { Derived, Local } from './state.js'
import type { EditorLocale, EditorText } from './text.js'

/** The characters of a literal run's text a press sets, in UTF-16 code units from its start, as a text field's selection counts them. */
export interface TextRange {
  readonly start: number
  readonly end: number
}

/** What a press made of a text's content, and the index of the run that holds the text it set. */
export interface Baselined {
  readonly content: readonly Inline[]
  readonly at: number
}

/** The run's own properties with `baseline` set, or, for `null`, without one: the format's "on the line". */
function shifted<R extends Inline>(run: R, baseline: BaselineShift | null): R {
  const copy: Record<string, unknown> = { ...run }
  if (baseline === null) delete copy['baseline']
  else copy['baseline'] = baseline
  return copy as R
}

/** Where every grapheme of `text` starts, and its end: the only places a selection may be cut. */
function boundaries(text: string): number[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return [...[...segmenter.segment(text)].map((segment) => segment.index), text.length]
}

/**
 * `range` widened to the whole characters it touches: the last cut at or
 * before its start, the first at or after its end. The text's start and
 * end are cuts, so each side has one.
 */
function snapped(text: string, range: TextRange): TextRange {
  const cuts = boundaries(text)
  return { start: Math.max(...cuts.filter((cut) => cut <= range.start)), end: Math.min(...cuts.filter((cut) => cut >= range.end)) }
}

/** The two runs as one literal run, where they print as one would: both literal, on the same baseline. */
function joined(a: Inline | undefined, b: Inline | undefined): TextInline | undefined {
  return a?.kind === 'text' && b?.kind === 'text' && a.baseline === b.baseline ? { ...a, text: a.text + b.text } : undefined
}

/**
 * The content with the run at `index` set to `baseline` -- the characters
 * `range` selects in a literal run, snapped to whole graphemes, or the
 * whole run where it selects none, all of it, or the run is bound -- and
 * that run joined to the literal runs beside it on the same baseline.
 * Never a run of nothing: a selection at either end splits in two. The
 * run at `index` is one a baseline may be set on, which the caller asks.
 */
export function setBaseline(content: readonly Inline[], index: number, baseline: BaselineShift | null, range?: TextRange): Baselined {
  const run = content[index] as Inline
  const cut = run.kind === 'text' && range !== undefined && range.start < range.end ? snapped(run.text, range) : undefined
  const pieces: Inline[] =
    run.kind === 'text' && cut !== undefined && (cut.start > 0 || cut.end < run.text.length)
      ? [
          ...(cut.start > 0 ? [{ ...run, text: run.text.slice(0, cut.start) }] : []),
          shifted({ ...run, text: run.text.slice(cut.start, cut.end) }, baseline),
          ...(cut.end < run.text.length ? [{ ...run, text: run.text.slice(cut.end) }] : []),
        ]
      : [shifted(run, baseline)]
  const next = [...content.slice(0, index), ...pieces, ...content.slice(index + 1)]
  const set = index + (cut !== undefined && cut.start > 0 && pieces.length > 1 ? 1 : 0)
  const right = joined(next[set], next[set + 1])
  if (right !== undefined) next.splice(set, 2, right)
  const left = joined(next[set - 1], next[set])
  if (left === undefined) return { content: next, at: set }
  next.splice(set - 1, 2, left)
  return { content: next, at: set - 1 }
}

/** What the baseline actions are lent of the editor. */
export interface BaselineLent {
  readonly current: () => Derived
  readonly local: () => Local
  readonly refuse: (code: EditorRefusalCode, text: string, refusal?: Extract<CommandOutcome, { ok: false }>) => EditorOutcome
  readonly applyEdit: (edit: Edit, name: () => string) => EditorOutcome
}

/** The words a press is said and kept in the history in, by where it set its text. */
const SAID = {
  subscript: { step: 'history.subscript', announce: 'status.subscript' },
  superscript: { step: 'history.superscript', announce: 'status.superscript' },
  line: { step: 'history.onTheLine', announce: 'status.onTheLine' },
} as const

/** Whether `selected`, from a caller tsc never saw, is a field's selection of `text`: whole offsets, in order, within it. */
function selects(selected: unknown, text: string): selected is FieldSelection {
  if (typeof selected !== 'object' || selected === null) return false
  const { start, end, text: shown } = selected as { readonly start?: unknown; readonly end?: unknown; readonly text?: unknown }
  return (
    shown === text &&
    typeof start === 'number' &&
    typeof end === 'number' &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    start <= end &&
    end <= text.length
  )
}

/**
 * The run at `key` of the selected text -- "/content/1" -- set to
 * `baseline`, its `selected` characters where a builder sends them, as one
 * `updateComponent` and one undo step; the keyboard then goes to the
 * pressed button of the group of the run that holds the text it set,
 * which a split or a join has moved. Refused, the report unchanged, for a
 * key that names no run with a baseline to set -- a page counter's among
 * them -- a selection of text the report does not hold, and a press that
 * would change nothing.
 */
export function setRunBaseline(
  lent: BaselineLent,
  t: EditorText,
  locale: EditorLocale,
  key: unknown,
  baseline: unknown,
  selected: FieldSelection | undefined,
): EditorOutcome {
  const { report } = lent.current()
  // The editor keeps its selection one the document has, so there is a target.
  const target = propertyTarget(report, lent.local().selection) as NonNullable<ReturnType<typeof propertyTarget>>
  const group = specsOf(target, report, t, locale)
    .filter(isGroup)
    .find((spec) => spec.key === key)
  const index = typeof key === 'string' ? Number(/^\/content\/(\d+)$/.exec(key)?.[1]) : Number.NaN
  const component = target.kind === 'component' && target.component.kind === 'text' ? target.component : undefined
  const run = component?.content[index]
  // A run of no text, or one with nothing to edit -- a page counter, which takes no baseline -- has no group.
  if (group === undefined || component === undefined || run === undefined || run.kind === 'pageNumber' || run.kind === 'pageCount')
    return lent.refuse('not-found', t('status.notFound', { name: String(key) }))
  const name = groupName(group, t)
  if (baseline !== null && !(BASELINE_SHIFTS as readonly unknown[]).includes(baseline))
    return lent.refuse('invalid-value', t('status.notFound', { name: JSON.stringify(baseline) }))
  const shift = baseline as BaselineShift | null
  if (run.kind === 'text' && selected !== undefined && !selects(selected, run.text)) return lent.refuse('invalid-value', t('status.selectionStale', { name }))
  const range = run.kind === 'text' && selected !== undefined ? { start: selected.start, end: selected.end } : undefined
  const made = setBaseline(component.content, index, shift, range)
  if (JSON.stringify(made.content) === JSON.stringify(component.content)) return lent.refuse('unavailable', t('status.baselineUnchanged', { name }))
  const said = SAID[shift ?? 'line']
  const selection = lent.local().selection
  const edit: Edit = {
    command: (r) => updateComponent(r, component.id, 'text', { content: made.content }),
    step: { do: 'said', id: said.step },
    announce: said.announce,
    then: () => selection,
  }
  const outcome = lent.applyEdit(edit, () => name)
  // The button pressed: the one of the shift it set, or, set back on the line, the one of the shift it took away.
  const pressed = BASELINE_SHIFTS.indexOf(shift ?? (run.baseline as BaselineShift))
  return outcome.ok ? { ok: true, then: { group: `/content/${String(made.at)}`, button: pressed } } : outcome
}
