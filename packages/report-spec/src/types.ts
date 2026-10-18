/**
 * The report definition, version 0: what a Formancy Report template is.
 *
 * A report is its own document, with its own version line
 * ([0007](../../../docs/decisions/0007-a-report-definition-is-its-own-versioned-document.md)).
 * Lengths are PDF points (1/72 inch), stored to the hundredth. Nothing here
 * holds customer data, credentials, asset bytes or rendered output: a
 * template names a dataset contract, an asset digest and a parameter, and
 * the deployment supplies what each resolves to.
 *
 * Four conventions hold throughout, so that one editor command, one binding
 * picker and one walk serve every part of the format:
 * - every shape that comes in kinds says which with `kind`;
 * - every declaration is a list of objects with an `id`, unique in its list;
 * - every reference to a dataset field is a `FieldRef`;
 * - a name an expression reads -- a field, a parameter, an aggregate -- is a
 *   field key, as formancy's form spec writes one (`isFieldKey`); every other
 *   id is an identifier (`isIdentifier`).
 *
 * The vocabularies are `const` lists, and each union type is derived from
 * its list, so the type and the validator's list cannot disagree.
 */
import type { EInvoice } from './e-invoice.js'
import type { EpcQrCodeComponent } from './epc-qr-code.js'
import type { PaymentPart } from './payment-part.js'
import type { REPORT_SPEC_VERSION } from './version.js'

export const PAGE_SIZE_NAMES = ['A4', 'Letter'] as const
export type PageSizeName = (typeof PAGE_SIZE_NAMES)[number]

export const ORIENTATIONS = ['portrait', 'landscape'] as const
export type Orientation = (typeof ORIENTATIONS)[number]

export interface Margins {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export interface PageSettings {
  readonly size: PageSizeName
  readonly orientation: Orientation
  readonly margins: Margins
}

export const FONT_FAMILIES = ['sans', 'serif', 'mono'] as const
export type FontFamily = (typeof FONT_FAMILIES)[number]

export const ALIGNMENTS = ['left', 'center', 'right'] as const
export type Alignment = (typeof ALIGNMENTS)[number]

/**
 * A print style: serialisable report tokens, never CSS. Nothing from the
 * editor's or the host's stylesheet reaches a printed page; what prints is
 * what these say (plan 11.4). An absent property is the renderer's default.
 */
export interface PrintStyle {
  readonly id: string
  readonly font?: FontFamily
  /** Points. */
  readonly size?: number
  readonly bold?: boolean
  readonly italic?: boolean
  /** Lower-case `#rrggbb`. */
  readonly color?: string
  readonly align?: Alignment
}

export const FIELD_TYPES = ['string', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'instant', 'image'] as const
export type FieldType = (typeof FIELD_TYPES)[number]

/**
 * A field a dataset contract promises.
 *
 * Values of exact types arrive as strings, never as JavaScript numbers. An
 * `image` field's value is an approved asset -- its id and its `sha256:`
 * digest -- which the host resolves to bytes, never an address: a photo or
 * a signature captured with a form arrives this way, and prints only as an
 * image. A field that is not nullable never holds null; one that is prints
 * null as nothing. A field the data lacks altogether is the runtime's error,
 * never an empty string.
 */
export interface FieldContract {
  /** A field key: what an expression reads it as, `header.<id>` or `row.<id>`. */
  readonly id: string
  readonly type: FieldType
  readonly label: string
  readonly nullable: boolean
  /** Digits after the decimal point; decimal fields only. */
  readonly scale?: number
}

/**
 * A dataset the report reads, by the logical id a deployment's binding set
 * maps to a provider. The fields are the contract the template was written
 * against, so the template itself records which revision of the contract it
 * expects.
 */
export interface DatasetContract {
  readonly id: string
  readonly fields: readonly FieldContract[]
}

/** The two datasets a version-0 report can read: one row of header data, and the one primary detail dataset. */
export const DATASET_ROLES = ['header', 'detail'] as const
export type DatasetRole = (typeof DATASET_ROLES)[number]

export interface Datasets {
  readonly header?: DatasetContract
  readonly detail?: DatasetContract
}

export const PARAMETER_TYPES = ['string', 'integer', 'decimal', 'boolean', 'date'] as const
export type ParameterType = (typeof PARAMETER_TYPES)[number]

/** A value a person supplies before rendering, on a formancy form whose field key is the parameter's id (plan 12.4). */
export interface ParameterDef {
  /** A field key: what an expression reads it as, `params.<id>`. */
  readonly id: string
  readonly type: ParameterType
  readonly label: string
  readonly required: boolean
  /** A boolean for a boolean parameter; for every other type, the exact value as a string. */
  readonly default?: string | boolean
}

/** An asset's bytes are a PNG, a JPEG, or an SVG in the form report-spec's `cleanSvg` writes (0030). */
export const ASSET_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'] as const
export type AssetMediaType = (typeof ASSET_MEDIA_TYPES)[number]

/**
 * An approved asset, named by id and pinned by digest. The bytes never live
 * in the definition, and rendering never follows a mutable "latest" asset
 * (plan 17): a new logo is a new digest and a new template release.
 */
export interface AssetRef {
  readonly id: string
  readonly mediaType: AssetMediaType
  /** `sha256:` and 64 lower-case hex digits. */
  readonly digest: string
}

/** A CEL expression, compiled and bounded by the runtime, not here. */
export interface Expression {
  readonly cel: string
}

/**
 * Where a value is read, which decides what it can name (plan 15's "current
 * row, group or report"): `row` in a table cell, once per detail row;
 * `group` in a group header or footer, once per group; `report` everywhere
 * else, the table's total rows included.
 */
export const VALUE_SCOPES = ['report', 'group', 'row'] as const
export type ValueScope = (typeof VALUE_SCOPES)[number]

/**
 * The names an expression reads in each scope, and nothing else: the
 * runtime binds exactly these. `params` maps parameter ids to values,
 * `header` the header dataset's fields, `row` the current detail row's,
 * `totals` each aggregate over every detail row, and `group` each aggregate
 * over the current group's rows and, as `GROUP_KEY`, the value the group
 * is keyed by.
 *
 * Whether an expression names only these is checked when the runtime
 * compiles it (plan 15's second level), not here: a second, partial CEL
 * parser would be a second place to disagree with the real one.
 */
export const EXPRESSION_NAMES: { readonly [S in ValueScope]: readonly string[] } = {
  report: ['params', 'header', 'totals'],
  group: ['params', 'header', 'totals', 'group'],
  row: ['params', 'header', 'totals', 'row'],
}

/**
 * The member of `group` that is the value the group is keyed by: in a group
 * header, `group.key` is the site a group of rows by site is for, of the
 * type of the field grouped by, and null for the group of rows without one.
 * An aggregate may not take the name (`reserved-id`), so `group.key` never
 * reads one.
 */
export const GROUP_KEY = 'key'

/** A field of the header or the detail dataset: the one way the format refers to one. */
export interface FieldRef {
  readonly dataset: DatasetRole
  readonly field: string
}

export const FORMAT_KINDS = ['number', 'currency', 'date', 'text'] as const
export type FormatKind = (typeof FORMAT_KINDS)[number]

export const DATE_STYLES = ['short', 'medium', 'long'] as const
export type DateStyle = (typeof DATE_STYLES)[number]

export const TEXT_TRANSFORMS = ['upper', 'lower'] as const
export type TextTransform = (typeof TEXT_TRANSFORMS)[number]

export interface NumberFormat {
  readonly kind: 'number'
  readonly scale: number
  readonly grouping: boolean
}

export const CURRENCY_SOURCE_KINDS = ['code', 'field', 'parameter'] as const
export type CurrencySourceKind = (typeof CURRENCY_SOURCE_KINDS)[number]

/** Which currency an amount is in: a code the template fixes, or a string field or parameter that supplies one per report or per row. */
export type CurrencySource =
  | { readonly kind: 'code'; /** ISO 4217, upper case. */ readonly code: string }
  | { readonly kind: 'field'; readonly field: FieldRef }
  | { readonly kind: 'parameter'; readonly parameter: string }

export interface CurrencyFormat {
  readonly kind: 'currency'
  readonly currency: CurrencySource
  readonly scale: number
}
export interface DateFormat {
  readonly kind: 'date'
  readonly style: DateStyle
}
export interface TextFormat {
  readonly kind: 'text'
  readonly transform?: TextTransform
}
/** How a value is displayed. Display only: calculation precision is the runtime's, with its declared rounding. */
export type Format = NumberFormat | CurrencyFormat | DateFormat | TextFormat

export interface TextInline {
  readonly kind: 'text'
  readonly text: string
}
export interface FieldInline {
  readonly kind: 'field'
  readonly field: FieldRef
  readonly format?: Format
}
export interface ParameterInline {
  readonly kind: 'parameter'
  readonly parameter: string
  readonly format?: Format
}
export interface ExpressionInline {
  readonly kind: 'expression'
  readonly expression: Expression
  readonly format?: Format
}

/** Whose rows an aggregate is taken over where it is printed: the current group's, or every detail row. */
export const AGGREGATE_SCOPES = ['group', 'report'] as const
export type AggregateScope = (typeof AGGREGATE_SCOPES)[number]

export interface AggregateInline {
  readonly kind: 'aggregate'
  /** An `AggregateDef` id. */
  readonly aggregate: string
  readonly over: AggregateScope
  readonly format?: Format
}
export interface PageNumberInline {
  readonly kind: 'pageNumber'
}
export interface PageCountInline {
  readonly kind: 'pageCount'
}

export const INLINE_KINDS = ['text', 'field', 'parameter', 'expression', 'aggregate', 'pageNumber', 'pageCount'] as const
export type InlineKind = (typeof INLINE_KINDS)[number]

/**
 * A run of text: literal, bound, computed, totalled or a page counter. The
 * one shape for a paragraph's runs, a table cell, a footer cell and a group
 * header. Null prints as nothing.
 */
export type Inline = TextInline | FieldInline | ParameterInline | ExpressionInline | AggregateInline | PageNumberInline | PageCountInline

/** What an aggregate reads from each detail row: a detail field, or an expression over the row. */
export type RowValue = { readonly kind: 'field'; readonly field: FieldRef } | { readonly kind: 'expression'; readonly expression: Expression }

export const AGGREGATE_FUNCTIONS = ['sum', 'count', 'min', 'max', 'avg'] as const
export type AggregateFunction = (typeof AGGREGATE_FUNCTIONS)[number]

export const ROUNDING_MODES = ['half-away-from-zero', 'half-even'] as const
export type RoundingMode = (typeof ROUNDING_MODES)[number]

/**
 * Declared rounding: an exact decimal is rounded once, by a named rule,
 * never by a float. To a multiple of `increment` when it is given -- '0.05'
 * for Swiss cash rounding -- and otherwise to `scale` places; ties go by
 * `mode` either way.
 */
export interface Rounding {
  readonly scale: number
  readonly mode: RoundingMode
  /** An exact decimal more than 0, with no more than `scale` places. */
  readonly increment?: string
}

/**
 * A total the report computes over the detail dataset, exactly, once, in
 * the runtime. Declared once and printed by id, over the current group in a
 * group header or footer and over every detail row anywhere else.
 *
 * - `count` without `of` counts rows; with it, the rows where it is not null.
 * - `sum` and `avg` take integers and decimals; `min` and `max` those and
 *   the three temporal types. Each skips nulls.
 * - Over no values, `count` and `sum` are 0, and `min`, `max` and `avg` are
 *   null, which prints as nothing.
 * - `avg` is rarely exact, so it declares its rounding.
 */
export interface AggregateDef {
  /** A field key: what an expression reads it as, `totals.<id>` or `group.<id>`. Never `GROUP_KEY`, which `group` holds already. */
  readonly id: string
  readonly fn: AggregateFunction
  /** Absent only for count. */
  readonly of?: RowValue
  readonly rounding?: Rounding
}

/** A style applied when a condition holds: each rule that holds applies its style over the base one, in order, a later rule's property winning. */
export interface StyleRule {
  readonly when: Expression
  /** A `PrintStyle` id. */
  readonly style: string
}

/** What every component has: a stable id, and optionally a condition and print styles. */
export interface ComponentBase {
  readonly id: string
  readonly visibleWhen?: Expression
  /** A `PrintStyle` id. */
  readonly style?: string
  readonly styleWhen?: readonly StyleRule[]
}

export interface TextComponent extends ComponentBase {
  readonly kind: 'text'
  readonly content: readonly Inline[]
  /** Never the last block on a page when something follows it: a heading moves with what it heads. */
  readonly keepWithNext?: boolean
}

export const IMAGE_FITS = ['contain', 'cover'] as const
export type ImageFit = (typeof IMAGE_FITS)[number]

export const IMAGE_SOURCE_KINDS = ['asset', 'field'] as const
export type ImageSourceKind = (typeof IMAGE_SOURCE_KINDS)[number]

/** What an image shows: an asset the template pins, the same in every render, or an image field of the header dataset, one per render. */
export type ImageSource = { readonly kind: 'asset'; /** An `AssetRef` id. */ readonly asset: string } | { readonly kind: 'field'; readonly field: FieldRef }

/** An image drawn in a box of fixed size; the width and the height bound it whatever its source holds. */
export interface ImageComponent extends ComponentBase {
  readonly kind: 'image'
  readonly source: ImageSource
  readonly width: number
  readonly height: number
  readonly fit: ImageFit
}

/**
 * How much of a QR code may be lost and its content still read: ISO/IEC
 * 18004's four levels, which restore about 7, 15, 25 and 30 % of the
 * codewords. A higher level holds less content in the same square.
 */
export const QR_ERROR_CORRECTION = ['L', 'M', 'Q', 'H'] as const
export type QrErrorCorrection = (typeof QR_ERROR_CORRECTION)[number]

/**
 * A QR code of the text its content prints, drawn as a square of fixed
 * size. The content is read once, as a paragraph's in the same place is,
 * and resolved whole before there are pages: it never holds a page number
 * or count, in any region.
 */
export interface QrCodeComponent extends ComponentBase {
  readonly kind: 'qrCode'
  readonly content: readonly Inline[]
  /** The side of the square in points, the quiet zone around the modules included. */
  readonly size: number
  readonly errorCorrection: QrErrorCorrection
}

export interface LineComponent extends ComponentBase {
  readonly kind: 'line'
  readonly thickness: number
  readonly color?: string
}

export interface RectangleComponent extends ComponentBase {
  readonly kind: 'rectangle'
  readonly width: number
  readonly height: number
  readonly fill?: string
  readonly stroke?: string
}

export interface SpacerComponent extends ComponentBase {
  readonly kind: 'spacer'
  readonly height: number
}

/** A width in points, or a share of what fixed widths leave. */
export type Width = number | 'fill'

/** One column of a columns block, as distinct from a table's column. */
export interface ColumnSlot {
  readonly width: Width
  readonly components: readonly Component[]
}

export interface ColumnsComponent extends ComponentBase {
  readonly kind: 'columns'
  readonly columns: readonly ColumnSlot[]
}

export interface Border {
  readonly thickness: number
  readonly color: string
}

/**
 * Components that belong together and nothing more: they flow as though
 * they stood where the section does, so one condition shows or hides them
 * all, and a border, a fill and padding can frame them. Unlike columns and
 * keep-together blocks, a section adds no layout rule.
 */
export interface SectionComponent extends ComponentBase {
  readonly kind: 'section'
  readonly components: readonly Component[]
  readonly border?: Border
  readonly fill?: string
  /** Points between the border and the content. */
  readonly padding?: number
}

export const SORT_DIRECTIONS = ['asc', 'desc'] as const
export type SortDirection = (typeof SORT_DIRECTIONS)[number]

export interface SortKey {
  /** A detail field. */
  readonly field: FieldRef
  readonly direction: SortDirection
}

export interface TableColumn {
  /** Unique within its table. */
  readonly id: string
  readonly header: string
  readonly width: Width
  readonly align: Alignment
  /** Read once per detail row. */
  readonly value: Inline
  /** Read once per report: a hidden column gives its width to the fill columns, and its footer cells hide with it. */
  readonly visibleWhen?: Expression
  readonly style?: string
  /** Read once per detail row. */
  readonly styleWhen?: readonly StyleRule[]
}

export interface TableFooterCell {
  /** A column id of the same table. */
  readonly column: string
  readonly value: Inline
}

/** A row under a group or under the table: a subtotal, a tax line, a total. */
export interface TableFooterRow {
  readonly cells: readonly TableFooterCell[]
  readonly style?: string
}

/**
 * One grouping level, the only one version 0 has. Rows are ordered by the
 * group's key first, then by the table's sort keys; rows whose keys are all
 * equal keep the order the provider gave them.
 */
export interface TableGroup {
  /** A detail field. */
  readonly by: FieldRef
  readonly direction: SortDirection
  /** One line across the table, read once per group. */
  readonly header: readonly Inline[]
  readonly headerStyle?: string
  readonly footer: readonly TableFooterRow[]
}

/** The table over the report's one detail dataset. Its header repeats on every page; version 0 has no other choice. */
export interface TableComponent extends ComponentBase {
  readonly kind: 'table'
  readonly dataset: 'detail'
  readonly columns: readonly TableColumn[]
  readonly headerStyle?: string
  readonly sort?: readonly SortKey[]
  readonly group?: TableGroup
  readonly totals?: readonly TableFooterRow[]
  readonly emptyText: string
  readonly repeatHeader: true
}

export interface PageBreakComponent extends ComponentBase {
  readonly kind: 'pageBreak'
}

export interface KeepTogetherComponent extends ComponentBase {
  readonly kind: 'keepTogether'
  readonly components: readonly Component[]
}

export const COMPONENT_KINDS = ['text', 'image', 'qrCode', 'epcQrCode', 'line', 'rectangle', 'spacer', 'columns', 'section', 'table', 'pageBreak', 'keepTogether'] as const
export type ComponentKind = (typeof COMPONENT_KINDS)[number]

export type Component =
  | TextComponent
  | ImageComponent
  | QrCodeComponent
  | EpcQrCodeComponent
  | LineComponent
  | RectangleComponent
  | SpacerComponent
  | ColumnsComponent
  | SectionComponent
  | TableComponent
  | PageBreakComponent
  | KeepTogetherComponent

/**
 * The report's regions, in the order a reader meets them. The body is flow
 * only in version 0: ordered blocks, so a growing table pushes what follows
 * down. Positioned elements in the page regions are deferred.
 */
export const REGION_NAMES = ['reportHeader', 'pageHeader', 'body', 'pageFooter', 'summary'] as const
export type RegionName = (typeof REGION_NAMES)[number]

export type Regions = { readonly [R in RegionName]: readonly Component[] }

export const PROVENANCE_KINDS = ['blank', 'form', 'dataset'] as const
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number]

/**
 * Where a report was started from, so a reviewer can find the exact form
 * version or the dataset a generated report came from.
 */
export type Provenance =
  | { readonly kind: 'blank' }
  | {
      readonly kind: 'form'
      /** The form's id, as formancy writes one. */
      readonly form: string
      /** `schemaHash` of the exact form version: 64 lower-case hex digits. */
      readonly formHash: string
    }
  | { readonly kind: 'dataset'; /** The dataset's id in the deployment's catalogue. */ readonly dataset: string }

export interface ReportDefinition {
  readonly reportSpecVersion: typeof REPORT_SPEC_VERSION
  readonly id: string
  readonly title: string
  /** A BCP 47 tag: language, optional script, optional region. */
  readonly locale: string
  readonly page: PageSettings
  readonly styles: readonly PrintStyle[]
  readonly datasets: Datasets
  readonly parameters: readonly ParameterDef[]
  readonly assets: readonly AssetRef[]
  readonly aggregates: readonly AggregateDef[]
  readonly regions: Regions
  /** A slip to pay the report by, printed at the foot of its last page: a Swiss QR-bill. Absent, the report has none. */
  readonly paymentPart?: PaymentPart
  /** The EN 16931 invoice the report is, written as Factur-X from what its page prints. Absent, the report is none. */
  readonly eInvoice?: EInvoice
  readonly provenance?: Provenance
}
