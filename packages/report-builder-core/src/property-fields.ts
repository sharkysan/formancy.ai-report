/**
 * The properties each thing has, as fields: how each is shown, and how what
 * a person types becomes a value in the report.
 *
 * Derived from report-spec's types, kind by kind, as a table over every
 * kind, so a kind added to the format without its fields does not compile.
 * A field turns text into a value and nothing more: whether the value is
 * valid is the validator's question, asked when the edit is applied, so
 * the message a refused value shows is the validator's (0008). Only what
 * cannot become a value at all -- "tall" for a number -- is refused here.
 */
import { EPC_CAPTIONS, mmToPt, ptToMm, QR_ERROR_CORRECTION } from '@formancy/report-spec'
import type { Component, ComponentKind, FieldRef, Inline, PrintStyle, QrErrorCorrection, ReportDefinition, TableColumn } from '@formancy/report-spec'
import type { PropertyKind, PropertyOption } from './model.js'
import { formatPercent } from './text.js'
import type { EditorLocale, EditorText, MessageId } from './text.js'

/** What a field makes of what was typed: a value at `at` (its key unless it says), nothing changed, or why it cannot be one. */
export type Written =
  | { readonly ok: true; readonly value: unknown; readonly at?: string }
  | { readonly ok: true; readonly unchanged: true }
  | { readonly ok: false; readonly message: MessageId }

/** Which words name a field: a message and its values, so a history label is translated when it is shown. */
export interface FieldWords {
  readonly id: MessageId
  /** For "Column {n} width" and "Part {n}: {kind}". */
  readonly n?: number
  /** The run kind, for "Part {n}: {kind}". */
  readonly run?: Inline['kind']
  /** The text a run is part of, for "{name}, part {n}: {kind}": an EPC payment code's remittance text, say. */
  readonly of?: MessageId
}

export interface FieldSpec {
  readonly key: string
  readonly words: FieldWords
  readonly kind: PropertyKind
  readonly unit?: 'mm' | 'pt'
  readonly required: boolean
  readonly placeholder?: MessageId
  readonly options?: readonly PropertyOption[]
  readonly read: () => string | boolean
  readonly write: (input: string | boolean) => Written
}

/** The words of a field, filled in a language: "Part 2: Field". */
export function fieldWords(words: FieldWords, t: EditorText): string {
  return t(words.id, {
    ...(words.n === undefined ? {} : { n: words.n }),
    ...(words.run === undefined ? {} : { kind: t(`run.${words.run}`) }),
    ...(words.of === undefined ? {} : { name: t(words.of) }),
  })
}

const UNCHANGED: Written = { ok: true, unchanged: true }
const value = (next: unknown, at?: string): Written => ({ ok: true, value: next, ...(at === undefined ? {} : { at }) })
const refused = (message: MessageId): Written => ({ ok: false, message })

/** A number as typed: a decimal comma read as a point, as Swiss French types it; NaN when it is not one. */
function parsed(input: string): number {
  const text = input.trim().replace(',', '.')
  return /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : Number.NaN
}

/**
 * A field of plain text, stored as typed. An optional one emptied is
 * removed, and one given back as it was shown is left alone, so that
 * leaving an absent one empty is no edit and is not announced as one.
 */
function textField(key: string, words: FieldWords, kind: 'text' | 'multiline', read: () => string, use: 'required' | 'optional' = 'required'): FieldSpec {
  return {
    key,
    words,
    kind,
    required: use === 'required',
    read,
    write: (input) => {
      if (typeof input !== 'string') return refused('input.option')
      if (use === 'required') return value(input)
      return input === read() ? UNCHANGED : value(input === '' ? null : input)
    },
  }
}

/**
 * A length, stored in points and edited in millimetres. Empty means fill
 * where a width may fill, removal where the length is optional, and is
 * refused where it is neither. Given back as it was shown, it is left alone,
 * so leaving a field never moves a length by the conversion's hundredth.
 */
function lengthField(key: string, words: FieldWords, stored: number | 'fill' | undefined, use: 'required' | 'optional' | 'fill'): FieldSpec {
  const shown = typeof stored === 'number' ? String(ptToMm(stored)) : ''
  return {
    key,
    words,
    kind: 'length',
    unit: 'mm',
    required: use === 'required',
    ...(use === 'fill' ? { placeholder: 'option.fill' as const } : {}),
    read: () => shown,
    write: (input) => {
      if (typeof input !== 'string') return refused('input.number')
      if (input.trim() === shown) return UNCHANGED
      if (input.trim() === '') return use === 'fill' ? value('fill') : use === 'optional' ? value(null) : refused('input.required')
      const millimetres = parsed(input)
      return Number.isNaN(millimetres) ? refused('input.number') : value(mmToPt(millimetres))
    },
  }
}

/** A number edited as stored: a thickness in points. */
function pointsField(key: string, words: FieldWords, stored: number | undefined, required: boolean, write?: (points: number | null) => Written): FieldSpec {
  const shown = stored === undefined ? '' : String(stored)
  return {
    key,
    words,
    kind: 'number',
    unit: 'pt',
    required,
    read: () => shown,
    write: (input) => {
      if (typeof input !== 'string') return refused('input.number')
      if (input.trim() === shown) return UNCHANGED
      if (input.trim() === '') return required ? refused('input.required') : (write?.(null) ?? value(null))
      const points = parsed(input)
      return Number.isNaN(points) ? refused('input.number') : (write?.(points) ?? value(points))
    },
  }
}

/** An optional colour, written in lower case as the format stores it; empty removes it. */
function colorField(key: string, words: FieldWords, stored: string | undefined, write?: (color: string | null) => Written): FieldSpec {
  return {
    key,
    words,
    kind: 'color',
    required: false,
    read: () => stored ?? '',
    write: (input) => {
      if (typeof input !== 'string') return refused('input.option')
      const color = input.trim() === '' ? null : input.trim().toLowerCase()
      return write?.(color) ?? value(color)
    },
  }
}

/** An expression's source. An optional one emptied is removed; a required one is the validator's to refuse. */
function expressionField(key: string, words: FieldWords, stored: string | undefined, required: boolean): FieldSpec {
  return {
    key,
    words,
    kind: 'expression',
    required,
    read: () => stored ?? '',
    write: (input) => {
      if (typeof input !== 'string') return refused('input.option')
      return input.trim() === '' && !required ? value(null) : value({ cel: input })
    },
  }
}

/** One choice among `options`, each option's value mapped to what the report stores. */
function choiceField(key: string, words: FieldWords, kind: 'select' | 'style' | 'binding', options: readonly (PropertyOption & { readonly stored: unknown })[], current: string): FieldSpec {
  return {
    key,
    words,
    kind,
    // A choice that offers none -- no style, no frame -- is optional.
    required: options.every((option) => option.stored !== null),
    options: options.map(({ value: token, label }) => ({ value: token, label })),
    read: () => current,
    write: (input) => {
      const chosen = options.find((option) => option.value === input)
      return chosen === undefined ? refused('input.option') : value(chosen.stored)
    },
  }
}

function booleanField(key: string, words: FieldWords, stored: boolean | undefined): FieldSpec {
  return {
    key,
    words,
    kind: 'boolean',
    required: false,
    read: () => stored === true,
    // False is the format's default, so it is written as the property's absence.
    write: (input) => (typeof input === 'boolean' ? value(input ? true : null) : refused('input.option')),
  }
}

/** What fields are built from: the report, the editor's words and language, and what each name reads where the thing stands. */
export interface FieldContext {
  readonly report: ReportDefinition
  readonly t: EditorText
  /** For a number an option's words hold, written as the language writes it. */
  readonly locale: EditorLocale
  /** Whether a detail field has a value where the thing stands: a table's cell. */
  readonly row: boolean
}

function styleField(key: string, words: FieldWords, styles: readonly PrintStyle[], current: string | undefined, t: EditorText): FieldSpec {
  const options = [{ value: '', label: t('option.none'), stored: null }, ...styles.map((style) => ({ value: style.id, label: style.id, stored: style.id }))]
  return choiceField(key, words, 'style', options, current ?? '')
}

const refToken = (ref: FieldRef): string => `field:${ref.dataset}:${ref.field}`

/** The fields and parameters a run can be bound to where it stands: detail fields only in a row. */
function bindings(context: FieldContext): (PropertyOption & { readonly stored: Inline })[] {
  const { report, t } = context
  const fields = (dataset: 'header' | 'detail') =>
    (report.datasets[dataset]?.fields ?? [])
      .filter((field) => field.type !== 'image')
      .map((field) => ({ value: refToken({ dataset, field: field.id }), label: field.label, stored: { kind: 'field', field: { dataset, field: field.id } } as Inline }))
  const parameters = report.parameters.map((parameter) => ({
    value: `parameter:${parameter.id}`,
    label: t('option.parameter', { label: parameter.label }),
    stored: { kind: 'parameter', parameter: parameter.id } as Inline,
  }))
  return [...(context.row ? fields('detail') : []), ...fields('header'), ...parameters]
}

/**
 * The field for one run of text: literal text, a binding, an expression or
 * a total. Page counters have nothing to edit. Literal text is a textarea
 * where a line break may stand in it, and one line where it may not.
 */
function runField(run: Inline, key: string, words: FieldWords, context: FieldContext, lines: 'text' | 'multiline' = 'multiline'): FieldSpec | undefined {
  switch (run.kind) {
    case 'text':
      return textField(`${key}/text`, words, lines, () => run.text)
    case 'field':
    case 'parameter': {
      const format = 'format' in run && run.format !== undefined ? { format: run.format } : {}
      const options = bindings(context).map((option) => ({ ...option, stored: { ...option.stored, ...format } }))
      return choiceField(key, words, 'binding', options, run.kind === 'field' ? refToken(run.field) : `parameter:${run.parameter}`)
    }
    case 'expression':
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
 * The runs of a text at `key`, a field each. A lone run is named by what
 * it is, or by `name`, the text's own where it has one; one of several by
 * its place and kind, after the text's name.
 */
function runsFields(runs: readonly Inline[], key: string, context: FieldContext, name?: MessageId, lines?: 'text' | 'multiline'): FieldSpec[] {
  const single = runs.length === 1
  return runs.flatMap((run, index) => {
    const part = { n: index + 1, run: run.kind }
    const words: FieldWords = single ? { id: name ?? (run.kind === 'text' ? 'field.text' : `run.${run.kind}`) } : name === undefined ? { id: 'field.part', ...part } : { id: 'field.textPart', of: name, ...part }
    return runField(run, `${key}/${index}`, words, context, lines) ?? []
  })
}

/** A content's runs: a lone run named by what it is, one of several by its place and kind. */
function contentFields(content: readonly Inline[], context: FieldContext): FieldSpec[] {
  return runsFields(content, '/content', context)
}

/**
 * A payment code's text at `key`, named `name`, its runs a field each as a
 * content's are, named by the text. Each is one line, as a line break
 * would end its element of the code.
 */
function codeTextFields(runs: readonly Inline[], key: string, name: MessageId, context: FieldContext): FieldSpec[] {
  return runsFields(runs, key, context, name, 'text')
}

/**
 * An optional text of a payment code. Absent, or one literal run, it is one
 * field at its key: what is typed becomes that one run, and emptied, the
 * text is removed, as every optional property is, and the code leaves its
 * element empty, which `placeholder`, where given, says the meaning of.
 * Bound, or of several runs, it is edited run by run.
 */
function optionalCodeTextFields(runs: readonly Inline[] | undefined, key: string, name: MessageId, context: FieldContext, placeholder?: MessageId): FieldSpec[] {
  const [only, ...rest] = runs ?? []
  if (only !== undefined && (only.kind !== 'text' || rest.length > 0)) return codeTextFields([only, ...rest], key, name, context)
  const shown = only?.text ?? ''
  return [
    {
      key,
      words: { id: name },
      kind: 'text',
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

const ALIGN_OPTIONS = (t: EditorText) => (['left', 'center', 'right'] as const).map((align) => ({ value: align, label: t(`option.${align}`), stored: align }))

/**
 * The share of a QR code each level of error correction restores, as
 * ISO/IEC 18004 gives it (about 7, 15, 25 and 30 %): what a level's option
 * says, so a sturdier code can be weighed against a denser one.
 */
const RESTORES: { readonly [L in QrErrorCorrection]: number } = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 }

const LEVEL_OPTIONS = ({ t, locale }: FieldContext) =>
  QR_ERROR_CORRECTION.map((level) => ({ value: level, label: t(`option.errorCorrection${level}`, { share: formatPercent(RESTORES[level], locale) }), stored: level }))

/** An EPC payment code alone, which is the absence of a caption, or with each caption the format has. */
const CAPTION_OPTIONS = (t: EditorText) => [
  { value: '', label: t('option.noCaption'), stored: null },
  ...EPC_CAPTIONS.map((caption) => ({ value: caption, label: t(`option.${caption}`), stored: caption })),
]

type Fields<C> = (component: C, context: FieldContext) => FieldSpec[]

/** Each kind's own fields, in the order the panel shows them; the ones every component has follow. */
const KIND_FIELDS: { readonly [K in ComponentKind]: Fields<Extract<Component, { kind: K }>> } = {
  text: (component, context) => [...contentFields(component.content, context), booleanField('/keepWithNext', { id: 'field.keepWithNext' }, component.keepWithNext)],
  image: (component, { report, t }) => {
    const assets = report.assets.map((asset) => ({ value: `asset:${asset.id}`, label: t('option.asset', { id: asset.id }), stored: { kind: 'asset', asset: asset.id } }))
    const images = (report.datasets.header?.fields ?? [])
      .filter((field) => field.type === 'image')
      .map((field) => ({ value: refToken({ dataset: 'header', field: field.id }), label: field.label, stored: { kind: 'field', field: { dataset: 'header', field: field.id } } }))
    const { source } = component
    const fits = (['contain', 'cover'] as const).map((fit) => ({ value: fit, label: t(`option.${fit}`), stored: fit }))
    return [
      choiceField('/source', { id: 'field.source' }, 'select', [...assets, ...images], source.kind === 'asset' ? `asset:${source.asset}` : refToken(source.field)),
      lengthField('/width', { id: 'field.width' }, component.width, 'required'),
      lengthField('/height', { id: 'field.height' }, component.height, 'required'),
      choiceField('/fit', { id: 'field.fit' }, 'select', fits, component.fit),
    ]
  },
  qrCode: (component, context) => [
    ...contentFields(component.content, context),
    lengthField('/size', { id: 'field.size' }, component.size, 'required'),
    choiceField('/errorCorrection', { id: 'field.errorCorrection' }, 'select', LEVEL_OPTIONS(context), component.errorCorrection),
  ],
  // In the order the code holds them (EPC069-12 2.2), then its square and its frame.
  epcQrCode: (component, context) => [
    ...codeTextFields(component.beneficiary, '/beneficiary', 'field.beneficiary', context),
    ...codeTextFields(component.iban, '/iban', 'field.iban', context),
    ...optionalCodeTextFields(component.bic, '/bic', 'field.bic', context, 'option.noBic'),
    expressionField('/amount', { id: 'field.amount' }, component.amount?.cel, false),
    textField('/purpose', { id: 'field.purpose' }, 'text', () => component.purpose ?? '', 'optional'),
    ...optionalCodeTextFields(component.reference, '/reference', 'field.reference', context),
    ...optionalCodeTextFields(component.text, '/text', 'field.remittance', context),
    ...optionalCodeTextFields(component.information, '/information', 'field.information', context),
    lengthField('/size', { id: 'field.size' }, component.size, 'required'),
    choiceField('/caption', { id: 'field.caption' }, 'select', CAPTION_OPTIONS(context.t), component.caption ?? ''),
  ],
  line: (component) => [pointsField('/thickness', { id: 'field.thickness' }, component.thickness, true), colorField('/color', { id: 'field.color' }, component.color)],
  rectangle: (component) => [
    lengthField('/width', { id: 'field.width' }, component.width, 'required'),
    lengthField('/height', { id: 'field.height' }, component.height, 'required'),
    colorField('/fill', { id: 'field.fill' }, component.fill),
    colorField('/stroke', { id: 'field.stroke' }, component.stroke),
  ],
  spacer: (component) => [lengthField('/height', { id: 'field.height' }, component.height, 'required')],
  columns: (component) => component.columns.map((column, index) => lengthField(`/columns/${index}/width`, { id: 'field.columnWidth', n: index + 1 }, column.width, 'fill')),
  section: (component) => {
    const border = component.border
    // A border is a thickness and a colour together: a thickness emptied
    // takes the border away, and either given to a section without one
    // brings one, black or a point thick until said otherwise.
    const borderThickness = pointsField('/border/thickness', { id: 'field.borderThickness' }, border?.thickness, false, (points) =>
      value(points === null ? null : { thickness: points, color: border?.color ?? '#000000' }, '/border'),
    )
    const borderColor = colorField('/border/color', { id: 'field.borderColor' }, border?.color, (color) =>
      color === null ? value(null, '/border') : value({ thickness: border?.thickness ?? 1, color }, '/border'),
    )
    return [colorField('/fill', { id: 'field.fill' }, component.fill), lengthField('/padding', { id: 'field.padding' }, component.padding, 'optional'), borderThickness, borderColor]
  },
  table: (component, { report, t }) => [
    textField('/emptyText', { id: 'field.emptyText' }, 'text', () => component.emptyText),
    styleField('/headerStyle', { id: 'field.headerStyle' }, report.styles, component.headerStyle, t),
  ],
  pageBreak: () => [],
  keepTogether: () => [],
}

/** A component's fields: its kind's own, then its style and its condition. */
export function componentFields(component: Component, context: FieldContext): FieldSpec[] {
  const own = (KIND_FIELDS[component.kind] as Fields<Component>)(component, context)
  return [
    ...own,
    styleField('/style', { id: 'field.style' }, context.report.styles, component.style, context.t),
    expressionField('/visibleWhen', { id: 'field.visibleWhen' }, component.visibleWhen?.cel, false),
  ]
}

/** A table column's fields: its heading, width, alignment, value, style and condition. */
export function columnFields(column: TableColumn, context: FieldContext): FieldSpec[] {
  const valueField = runField(column.value, '/value', { id: 'field.value' }, context)
  return [
    textField('/header', { id: 'field.header' }, 'text', () => column.header),
    lengthField('/width', { id: 'field.width' }, column.width, 'fill'),
    choiceField('/align', { id: 'field.align' }, 'select', ALIGN_OPTIONS(context.t), column.align),
    ...(valueField === undefined ? [] : [valueField]),
    styleField('/style', { id: 'field.style' }, context.report.styles, column.style, context.t),
    expressionField('/visibleWhen', { id: 'field.visibleWhen' }, column.visibleWhen?.cel, false),
  ]
}

/** The report's own fields: its title, language and page. */
export function reportFields(report: ReportDefinition, t: EditorText): FieldSpec[] {
  const sizes = (['A4', 'Letter'] as const).map((size) => ({ value: size, label: size, stored: size }))
  const orientations = (['portrait', 'landscape'] as const).map((orientation) => ({ value: orientation, label: t(`option.${orientation}`), stored: orientation }))
  const margin = (side: 'top' | 'right' | 'bottom' | 'left', id: MessageId) => lengthField(`/page/margins/${side}`, { id }, report.page.margins[side], 'required')
  return [
    textField('/title', { id: 'field.title' }, 'text', () => report.title),
    textField('/locale', { id: 'field.locale' }, 'text', () => report.locale),
    choiceField('/page/size', { id: 'field.pageSize' }, 'select', sizes, report.page.size),
    choiceField('/page/orientation', { id: 'field.orientation' }, 'select', orientations, report.page.orientation),
    margin('top', 'field.marginTop'),
    margin('right', 'field.marginRight'),
    margin('bottom', 'field.marginBottom'),
    margin('left', 'field.marginLeft'),
  ]
}
