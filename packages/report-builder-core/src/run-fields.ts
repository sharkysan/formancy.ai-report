/**
 * The fields of a run of text -- a text's content, a column's value, a
 * payment code's texts -- one per run: literal text typed, a field or a
 * parameter chosen, an expression's source, a total chosen. Page counters
 * have nothing to edit.
 *
 * Where the runs stand at a word -- a text's content, a column's value, a
 * bill's message -- and the language edited is not the report's own, a
 * word's run is its translation's field instead (`word-fields.ts`, 0063):
 * literal text that holds a letter, and an expression that prints words,
 * as report-core's `wordExpressions` says. A code's runs -- a QR code's
 * content, a payment code's account -- hold no words.
 *
 * A paragraph's runs are each a group of their own, holding the run's
 * field and its Subscript and Superscript (0061), in the report's own
 * language and in every other: a baseline is the run's, which a
 * translation's text prints at.
 */
import { BASELINE_SHIFTS, isWord } from '@formancy/report-spec'
import type { FieldRef, Inline } from '@formancy/report-spec'
import type { PropertyOption } from './model-properties.js'
import { choiceField, expressionField, refused, textField, UNCHANGED, value } from './field-specs.js'
import type { FieldSpec, FieldWords } from './field-specs.js'
import type { FieldContext, GroupButton, GroupSpec, TextName } from './property-fields.js'
import type { MessageId } from './text.js'
import { translating, wordExpressionField, wordField } from './word-fields.js'

/** Whether runs stand where words do, or in a code a scanner reads. */
type Standing = 'words' | 'code'

export const refToken = (ref: FieldRef): string => `field:${ref.dataset}:${ref.field}`

/** The fields and parameters a run can be bound to where it stands: detail fields only in a row. */
type Binding = PropertyOption & { readonly stored: Inline }

function bindings(context: FieldContext): Binding[] {
  const { report, t } = context
  const fields = (dataset: 'header' | 'detail') =>
    (report.datasets[dataset]?.fields ?? [])
      .filter((field) => field.type !== 'image')
      .map((field): Binding => ({
        value: refToken({ dataset, field: field.id }),
        label: field.label,
        stored: { kind: 'field', field: { dataset, field: field.id } },
      }))
  const parameters = report.parameters.map((parameter): Binding => ({
    value: `parameter:${parameter.id}`,
    label: t('option.parameter', { label: parameter.label }),
    stored: { kind: 'parameter', parameter: parameter.id },
  }))
  return [...(context.row ? fields('detail') : []), ...fields('header'), ...parameters]
}

/**
 * The field for one run of text: literal text, a binding, an expression or
 * a total. Page counters have nothing to edit. Literal text is a textarea
 * where a line break may stand in it, and one line where it may not.
 */
export function runField(
  run: Inline,
  key: string,
  words: FieldWords,
  context: FieldContext,
  lines: 'text' | 'multiline' = 'multiline',
  standing: Standing = 'code',
): FieldSpec | undefined {
  const translated = standing === 'words' && translating(context) ? context.edited : undefined
  switch (run.kind) {
    case 'text':
      if (translated !== undefined && isWord(run.text)) return wordField(`${key}/text`, words, lines, run.text, translated)
      return textField(`${key}/text`, words, lines, () => run.text)
    case 'field':
    case 'parameter': {
      // Rebound, a run keeps how it is displayed and where it stands against its line (0061).
      const kept = { ...(run.format === undefined ? {} : { format: run.format }), ...(run.baseline === undefined ? {} : { baseline: run.baseline }) }
      const options = bindings(context).map((option) => ({ ...option, stored: { ...option.stored, ...kept } }))
      return choiceField(key, words, 'binding', options, run.kind === 'field' ? refToken(run.field) : `parameter:${run.parameter}`)
    }
    case 'expression':
      if (translated?.expressions.has(run.expression.cel) === true) return wordExpressionField(`${key}/expression`, words, run.expression.cel, translated)
      return expressionField(`${key}/expression`, words, run.expression.cel, true)
    case 'aggregate': {
      const options = context.report.aggregates.map((aggregate) => ({ value: aggregate.id, label: aggregate.id, stored: aggregate.id }))
      return choiceField(`${key}/aggregate`, words, 'select', options, run.aggregate)
    }
    case 'pageNumber':
    case 'pageCount':
      return undefined
  }
}

/**
 * The runs of a text at `key`, the field of each at its place, none for a
 * page counter. A lone run is named by what it is, or by `name`, the
 * text's own where it has one; one of several by its place and kind, after
 * the text's name.
 */
function runsFields(
  runs: readonly Inline[],
  key: string,
  context: FieldContext,
  name?: TextName,
  lines?: 'text' | 'multiline',
  standing: Standing = 'code',
): (FieldSpec | undefined)[] {
  const single = runs.length === 1
  const id = typeof name === 'object' ? name.id : name
  const item = typeof name === 'object' ? { item: name.item } : {}
  return runs.map((run, index) => {
    const part = { n: index + 1, run: run.kind }
    const words: FieldWords = single
      ? { id: id ?? (run.kind === 'text' ? 'field.text' : `run.${run.kind}`), ...item }
      : id === undefined
        ? { id: 'field.part', ...part }
        : { id: 'field.textPart', of: id, ...part, ...item }
    return runField(run, `${key}/${index}`, words, context, lines, standing)
  })
}

/** The fields of the runs that have one. */
const editable = (fields: readonly (FieldSpec | undefined)[]): FieldSpec[] => fields.filter((field): field is FieldSpec => field !== undefined)

/** A content's runs: a lone run named by what it is, one of several by its place and kind; a QR code's stand in a code. */
export function contentFields(content: readonly Inline[], context: FieldContext): FieldSpec[] {
  return editable(runsFields(content, '/content', context))
}

/** What each of a run's two buttons is named by, and shows. */
const SHIFT_WORDS = {
  subscript: { name: 'action.subscriptOf', text: 'action.subscript' },
  superscript: { name: 'action.superscriptOf', text: 'action.superscript' },
} as const

/**
 * A paragraph's runs, which stand where words do, each a group of its own
 * named as its field is, holding that field and its two buttons, Subscript
 * and Superscript, each named after the run and pressed while the run is
 * set so: pressed, it sets the run back on the line (0061). A page
 * counter, which has nothing to edit and takes no baseline, has none.
 */
export function paragraphRuns(content: readonly Inline[], context: FieldContext): GroupSpec[] {
  return runsFields(content, '/content', context, undefined, undefined, 'words').flatMap((field, index): GroupSpec[] => {
    const run = content[index]
    if (field === undefined || run === undefined || run.kind === 'pageNumber' || run.kind === 'pageCount') return []
    const key = `/content/${String(index)}`
    const buttons = BASELINE_SHIFTS.map((shift): GroupButton => ({
      words: SHIFT_WORDS[shift].name,
      of: field.words,
      text: SHIFT_WORDS[shift].text,
      action: { type: 'setBaseline', key, baseline: run.baseline === shift ? null : shift },
      available: true,
      pressed: run.baseline === shift,
    }))
    return [{ key, words: field.words, fields: [field], buttons }]
  })
}

/**
 * A payment code's text at `key`, named `name`, its runs a field each as a
 * content's are, named by the text. Each is one line, as a line break
 * would end its element of the code; an e-invoice's payment terms, where a
 * line break stands (BT-20), are `multiline`.
 */
export function codeTextFields(runs: readonly Inline[], key: string, name: TextName, context: FieldContext, lines: 'text' | 'multiline' = 'text'): FieldSpec[] {
  return editable(runsFields(runs, key, context, name, lines))
}

/**
 * An optional text of a payment code. Absent, or one literal run, it is one
 * field at its key: what is typed becomes that one run, and emptied, the
 * text is removed, as every optional property is, and the code leaves its
 * element empty, which `placeholder`, where given, says the meaning of.
 * Bound, or of several runs, it is edited run by run.
 */
export function optionalCodeTextFields(
  runs: readonly Inline[] | undefined,
  key: string,
  name: TextName,
  context: FieldContext,
  placeholder?: MessageId,
  lines: 'text' | 'multiline' = 'text',
): FieldSpec[] {
  const [only, ...rest] = runs ?? []
  if (only !== undefined && (only.kind !== 'text' || rest.length > 0)) return codeTextFields([only, ...rest], key, name, context, lines)
  const shown = only?.text ?? ''
  return [
    {
      key,
      words: typeof name === 'object' ? { id: name.id, item: name.item } : { id: name },
      kind: lines,
      required: false,
      ...(placeholder === undefined ? {} : { placeholder }),
      read: () => shown,
      write: (input) => {
        if (typeof input !== 'string') return refused('input.option')
        if (input === shown) return UNCHANGED
        return value(input === '' ? null : [{ kind: 'text', text: input }])
      },
    },
  ]
}

/**
 * A payment code's optional text where words stand -- a bill's message --
 * in a language besides the report's own: a lone literal word one field at
 * `key`, as the report's own language shows it, runs of several a field
 * each. Undefined in the report's own language, and for a text that holds
 * no word, which the report's own fields edit as they always do.
 */
export function translatedTextFields(runs: readonly Inline[] | undefined, key: string, name: MessageId, context: FieldContext): FieldSpec[] | undefined {
  if (!translating(context) || runs === undefined) return undefined
  const { edited } = context
  const holds = runs.some((run) => (run.kind === 'text' && isWord(run.text)) || (run.kind === 'expression' && edited.expressions.has(run.expression.cel)))
  if (!holds) return undefined
  const [only, ...rest] = runs
  if (only?.kind === 'text' && rest.length === 0) return [wordField(key, { id: name }, 'text', only.text, edited)]
  return editable(runsFields(runs, key, context, name, 'text', 'words'))
}
