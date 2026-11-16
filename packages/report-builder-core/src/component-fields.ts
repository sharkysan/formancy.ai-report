/**
 * The properties each component has, and each table column, as fields:
 * derived from report-spec's types, kind by kind, as a table over every
 * kind, so a kind added to the format without its fields does not compile.
 * How each field turns what is typed into a value is `field-specs.ts`'s.
 */
import { EPC_CAPTIONS, QR_ERROR_CORRECTION } from '@formancy/report-spec'
import type { Component, ComponentKind, QrErrorCorrection, TableColumn } from '@formancy/report-spec'
import { booleanField, choiceField, colorField, countField, expressionField, lengthField, pointsField, styleField, textField, value } from './field-specs.js'
import type { FieldSpec } from './field-specs.js'
import type { FieldContext, PanelSpec } from './property-fields.js'
import { contentFields, codeTextFields, optionalCodeTextFields, paragraphRuns, refToken, runField } from './run-fields.js'
import { formatPercent } from './text.js'
import type { EditorText } from './text.js'
import { wordOrTextField } from './word-fields.js'

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

type Fields<C> = (component: C, context: FieldContext) => PanelSpec[]

/** Each kind's own fields, in the order the panel shows them; the ones every component has follow. */
const KIND_FIELDS: { readonly [K in ComponentKind]: Fields<Extract<Component, { kind: K }>> } = {
  text: (component, context) => [
    ...paragraphRuns(component.content, context),
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
  table: (component, context) => [
    wordOrTextField('/emptyText', { id: 'field.emptyText' }, component.emptyText, context),
    styleField('/headerStyle', { id: 'field.headerStyle' }, context.report.styles, component.headerStyle, context.t),
    // The group's own, as the format has it: a table without a group has no header to keep with its rows (0059).
    ...(component.group === undefined ? [] : [countField('/group/keepWithRows', { id: 'field.keepWithRows' }, component.group.keepWithRows)]),
  ],
  chart: () => [], // R10: only the fields every component has, until the builders edit a chart's own
  pageBreak: () => [],
  keepTogether: () => [],
}

/** A component's fields: its kind's own, a paragraph's runs in groups, then its style and its condition. */
export function componentFields(component: Component, context: FieldContext): PanelSpec[] {
  const own = (KIND_FIELDS[component.kind] as Fields<Component>)(component, context)
  return [
    ...own,
    styleField('/style', { id: 'field.style' }, context.report.styles, component.style, context.t),
    expressionField('/visibleWhen', { id: 'field.visibleWhen' }, component.visibleWhen?.cel, false),
  ]
}

/** A table column's fields: its heading, width, alignment, value, style and condition. */
export function columnFields(column: TableColumn, context: FieldContext): FieldSpec[] {
  const valueField = runField(column.value, '/value', { id: 'field.value' }, context, 'multiline', 'words')
  return [
    wordOrTextField('/header', { id: 'field.header' }, column.header, context),
    lengthField('/width', { id: 'field.width' }, column.width, 'fill'),
    choiceField('/align', { id: 'field.align' }, 'select', ALIGN_OPTIONS(context.t), column.align),
    ...(valueField === undefined ? [] : [valueField]),
    styleField('/style', { id: 'field.style' }, context.report.styles, column.style, context.t),
    expressionField('/visibleWhen', { id: 'field.visibleWhen' }, column.visibleWhen?.cel, false),
  ]
}
