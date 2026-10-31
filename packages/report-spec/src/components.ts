/**
 * The components a region holds: what every one has, each kind, and the
 * kinds as one list and one union. The table, whose rows, groups and
 * totals change for reasons of their own, is `table.ts`'s; the EPC QR code
 * is `epc-qr-code.ts`'s.
 */
import type { FieldRef } from './data.js'
import type { EpcQrCodeComponent } from './epc-qr-code.js'
import type { StyleRule } from './styles.js'
import type { TableComponent } from './table.js'
import type { Expression, Inline } from './values.js'

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

export interface PageBreakComponent extends ComponentBase {
  readonly kind: 'pageBreak'
}

export interface KeepTogetherComponent extends ComponentBase {
  readonly kind: 'keepTogether'
  readonly components: readonly Component[]
}

export const COMPONENT_KINDS = [
  'text',
  'image',
  'qrCode',
  'epcQrCode',
  'line',
  'rectangle',
  'spacer',
  'columns',
  'section',
  'table',
  'pageBreak',
  'keepTogether',
] as const
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
