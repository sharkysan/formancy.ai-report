/**
 * The properties each thing has, as fields: which fields each kind, a
 * table column and the report have, in the order the panel shows them,
 * and the groups they are drawn in.
 *
 * Derived from report-spec's types, kind by kind, as a table over every
 * kind, so a kind added to the format without its fields does not compile.
 * How a field is shown, and how what is typed becomes a value, is
 * `field-specs.ts`'s.
 */
import { EPC_CAPTIONS, QR_ERROR_CORRECTION } from '@formancy/report-spec'
import type { Component, ComponentKind, FieldRef, Inline, QrErrorCorrection, ReportDefinition, TableColumn } from '@formancy/report-spec'
import {
  booleanField,
  choiceField,
  colorField,
  countField,
  expressionField,
  lengthField,
  pointsField,
  refused,
  styleField,
  textField,
  UNCHANGED,
  value,
} from './field-specs.js'
import type { FieldSpec, FieldWords } from './field-specs.js'
import type { EditorAction } from './model-actions.js'
import type { PropertyOption } from './model-properties.js'
import { formatPercent } from './text.js'
import type { EditorLocale, EditorText, MessageId } from './text.js'

/** What a text is named by: its words, or its words and the number of the list's item it is of. */
export type TextName = MessageId | { readonly id: MessageId; readonly item: number }

/** A group's button: its words -- with the item's number, for an item of a list -- the action it sends, whether it has somewhere to go, and where the keyboard goes once it is done (`PropertyAction`'s `then`). */
export interface GroupButton {
  readonly words: MessageId
  readonly item?: number
  readonly action: EditorAction
  readonly available: boolean
  readonly then?: { readonly group: string; readonly button?: number }
}

/**
 * A list of groups the properties edit item by item -- an e-invoice's VAT
 * categories (0044) -- as its own group says it: where it is, the items
 * it holds, what Add puts at its end, the words each item is named by, and
 * how the history names adding, removing and moving one. Where the list
 * could take nothing more, `full` says why, and its Add is unavailable.
 */
export interface ListSpec {
  readonly key: string
  readonly items: readonly unknown[]
  readonly value: unknown
  readonly full?: MessageId
  readonly item: MessageId
  readonly added: MessageId
  readonly removed: MessageId
  readonly moved: MessageId
}

/**
 * Fields drawn together under one name, and the buttons the group has. An
 * optional group -- a bill's debtor -- also says what adding it puts at
 * its key and how the history names adding and removing it; its button is
 * Add while it is absent, when it has no fields, and Remove while it is
 * there. A list's own group has no fields and its Add, and says what its
 * list is (`list`); each item of it is a group of its own, numbered `n`
 * from 1, with Move up, Move down and Remove.
 */
export interface GroupSpec {
  readonly key: string
  readonly words: MessageId
  readonly item?: number
  readonly fields: readonly FieldSpec[]
  readonly buttons: readonly GroupButton[]
  readonly optional?: {
    readonly present: boolean
    readonly value: unknown
    readonly added: MessageId
    readonly removed: MessageId
    readonly announced?: { readonly added: MessageId; readonly removed: MessageId }
  }
  readonly list?: ListSpec
}

/** What a panel shows, in order: a field by itself, or a group of fields. */
export type PanelSpec = FieldSpec | GroupSpec

export function isGroup(spec: PanelSpec): spec is GroupSpec {
  return 'fields' in spec
}

/** Every field of `specs`, those in a group among them, in the order shown. */
export function flatFields(specs: readonly PanelSpec[]): FieldSpec[] {
  return specs.flatMap((spec) => (isGroup(spec) ? spec.fields : [spec]))
}

/** The words an optional group's button and its history steps say, and, where "Added {name}." would not agree with its name, what the live region says. */
export interface OptionalWords {
  readonly add: MessageId
  readonly remove: MessageId
  readonly added: MessageId
  readonly removed: MessageId
  readonly announced?: { readonly added: MessageId; readonly removed: MessageId }
}

/**
 * The optional group at `key`: its fields and a Remove while it is there,
 * `fields` given; an Add and no fields while it is not, which puts `value`
 * at its key.
 */
export function optionalGroup(key: string, words: MessageId, fields: readonly FieldSpec[] | undefined, value: unknown, said: OptionalWords): GroupSpec {
  const present = fields !== undefined
  return {
    key,
    words,
    fields: fields ?? [],
    buttons: [
      present
        ? { words: said.remove, action: { type: 'removeGroup', key }, available: true }
        : { words: said.add, action: { type: 'addGroup', key }, available: true },
    ],
    optional: { present, value, added: said.added, removed: said.removed, ...(said.announced === undefined ? {} : { announced: said.announced }) },
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

const refToken = (ref: FieldRef): string => `field:${ref.dataset}:${ref.field}`

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
function runsFields(runs: readonly Inline[], key: string, context: FieldContext, name?: TextName, lines?: 'text' | 'multiline'): FieldSpec[] {
  const single = runs.length === 1
  const id = typeof name === 'object' ? name.id : name
  const item = typeof name === 'object' ? { item: name.item } : {}
  return runs.flatMap((run, index) => {
    const part = { n: index + 1, run: run.kind }
    const words: FieldWords = single
      ? { id: id ?? (run.kind === 'text' ? 'field.text' : `run.${run.kind}`), ...item }
      : id === undefined
        ? { id: 'field.part', ...part }
        : { id: 'field.textPart', of: id, ...part, ...item }
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
 * would end its element of the code; an e-invoice's payment terms, where a
 * line break stands (BT-20), are `multiline`.
 */
export function codeTextFields(runs: readonly Inline[], key: string, name: TextName, context: FieldContext, lines: 'text' | 'multiline' = 'text'): FieldSpec[] {
  return runsFields(runs, key, context, name, lines)
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

const ALIGN_OPTIONS = (t: EditorText) => (['left', 'center', 'right'] as const).map((align) => ({ value: align, label: t(`option.${align}`), stored: align }))

/**
 * The share of a QR code each level of error correction restores, as
 * ISO/IEC 18004 gives it (about 7, 15, 25 and 30 %): what a level's option
 * says, so a sturdier code can be weighed against a denser one.
 */
const RESTORES: { readonly [L in QrErrorCorrection]: number } = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 }

const LEVEL_OPTIONS = ({ t, locale }: FieldContext) =>
  QR_ERROR_CORRECTION.map((level) => ({
    value: level,
    label: t(`option.errorCorrection${level}`, { share: formatPercent(RESTORES[level], locale) }),
    stored: level,
  }))

/** An EPC payment code alone, which is the absence of a caption, or with each caption the format has. */
const CAPTION_OPTIONS = (t: EditorText) => [
  { value: '', label: t('option.noCaption'), stored: null },
  ...EPC_CAPTIONS.map((caption) => ({ value: caption, label: t(`option.${caption}`), stored: caption })),
]

type Fields<C> = (component: C, context: FieldContext) => FieldSpec[]

/** Each kind's own fields, in the order the panel shows them; the ones every component has follow. */
const KIND_FIELDS: { readonly [K in ComponentKind]: Fields<Extract<Component, { kind: K }>> } = {
  text: (component, context) => [
    ...contentFields(component.content, context),
    booleanField('/keepWithNext', { id: 'field.keepWithNext' }, component.keepWithNext),
  ],
  image: (component, { report, t }) => {
    const assets = report.assets.map((asset) => ({
      value: `asset:${asset.id}`,
      label: t('option.asset', { id: asset.id }),
      stored: { kind: 'asset', asset: asset.id },
    }))
    const images = (report.datasets.header?.fields ?? [])
      .filter((field) => field.type === 'image')
      .map((field) => ({
        value: refToken({ dataset: 'header', field: field.id }),
        label: field.label,
        stored: { kind: 'field', field: { dataset: 'header', field: field.id } },
      }))
    const { source } = component
    const fits = (['contain', 'cover'] as const).map((fit) => ({ value: fit, label: t(`option.${fit}`), stored: fit }))
    return [
      choiceField(
        '/source',
        { id: 'field.source' },
        'select',
        [...assets, ...images],
        source.kind === 'asset' ? `asset:${source.asset}` : refToken(source.field),
      ),
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
  line: (component) => [
    pointsField('/thickness', { id: 'field.thickness' }, component.thickness, true),
    colorField('/color', { id: 'field.color' }, component.color),
  ],
  rectangle: (component) => [
    lengthField('/width', { id: 'field.width' }, component.width, 'required'),
    lengthField('/height', { id: 'field.height' }, component.height, 'required'),
    colorField('/fill', { id: 'field.fill' }, component.fill),
    colorField('/stroke', { id: 'field.stroke' }, component.stroke),
  ],
  spacer: (component) => [lengthField('/height', { id: 'field.height' }, component.height, 'required')],
  columns: (component) =>
    component.columns.map((column, index) => lengthField(`/columns/${index}/width`, { id: 'field.columnWidth', n: index + 1 }, column.width, 'fill')),
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
    return [
      colorField('/fill', { id: 'field.fill' }, component.fill),
      lengthField('/padding', { id: 'field.padding' }, component.padding, 'optional'),
      borderThickness,
      borderColor,
    ]
  },
  table: (component, { report, t }) => [
    textField('/emptyText', { id: 'field.emptyText' }, 'text', () => component.emptyText),
    styleField('/headerStyle', { id: 'field.headerStyle' }, report.styles, component.headerStyle, t),
    // The group's own, as the format has it: a table without a group has no header to keep with its rows (0059).
    ...(component.group === undefined ? [] : [countField('/group/keepWithRows', { id: 'field.keepWithRows' }, component.group.keepWithRows)]),
  ],
  chart: () => [], // R10: only the fields every component has, until the builders edit a chart's own
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
  const orientations = (['portrait', 'landscape'] as const).map((orientation) => ({
    value: orientation,
    label: t(`option.${orientation}`),
    stored: orientation,
  }))
  const margin = (side: 'top' | 'right' | 'bottom' | 'left', id: MessageId) =>
    lengthField(`/page/margins/${side}`, { id }, report.page.margins[side], 'required')
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
