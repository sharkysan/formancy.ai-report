/**
 * What the editor's state says of the page and the design view: boxes in
 * points and in CSS pixels, the page's geometry, and the canvas a builder
 * draws -- the regions' bands, each component's box, a payment part's band
 * and the rulers. A part of `model.ts`'s state (`EditorState`), apart
 * because the design view changes for reasons of its own.
 */
import type { DiagnosticSeverity } from '@formancy/report-core'
import type { Margins, Orientation, PageSizeName, RegionName } from '@formancy/report-spec'
import type { PartKind } from './model.js'

/** A rectangle: in points on the page, or in CSS pixels at the editor's zoom. */
export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

/** The page as the report sets it, in points, and as the canvas draws it, in CSS pixels at the zoom. */
export interface PageGeometry {
  readonly size: PageSizeName
  readonly orientation: Orientation
  /** Points. */
  readonly width: number
  /** Points. */
  readonly height: number
  /** Points. */
  readonly margins: Margins
  /** Points: what the margins leave. */
  readonly printable: Size
  /** CSS pixels at the editor's zoom. */
  readonly px: Size & { readonly margins: Margins }
}

/** A component's or a column's box on the canvas. */
export interface CanvasBox {
  readonly key: string
  readonly id: string
  readonly column?: string
  readonly kind: PartKind
  readonly label: string
  readonly depth: number
  readonly selected: boolean
  readonly problems: number
  /** The worst diagnostic about it, when there is one. */
  readonly severity?: DiagnosticSeverity
  /** Wider than the space it stands in: the layout will have to say what happens to it. */
  readonly overflows: boolean
  readonly pt: Box
  readonly px: Box
}

export interface CanvasRegion {
  readonly region: RegionName
  readonly label: string
  readonly empty: boolean
  readonly pt: Box
  readonly px: Box
}

/**
 * Where a report's payment part prints: a Swiss QR-bill's slip, the receipt
 * and the payment part, across the foot of the report's last page. Drawn as
 * a band the slip's size at the sheet's foot, below every region, and named
 * as SIX names the part. The slip itself is the renderer's to draw.
 */
export interface CanvasPaymentPart {
  readonly label: string
  /** Selected, as its outline row is: a click on the band selects the bill. */
  readonly selected: boolean
  /** Diagnostics about the bill, as its outline row counts them. */
  readonly problems: number
  readonly severity?: DiagnosticSeverity
  readonly pt: Box
  readonly px: Box
}

export interface RulerTick {
  /** CSS pixels from the sheet's edge. */
  readonly at: number
  readonly mm: number
  readonly major: boolean
  readonly label?: string
}

/**
 * The design view: one sheet as wide as the page, the regions stacked on it
 * as bands, each component's flow box inside its band, and a payment part's
 * band at the sheet's foot. A design-mode
 * approximation for selecting and placing things -- text measured by a rule
 * of thumb, a table as one row of each kind -- and never the PDF, which the
 * renderer lays out (plan 8).
 */
export interface Canvas {
  /** The canvas's accessible name, which says it is not the PDF. */
  readonly label: string
  /** The sentence shown with it, saying the same to a sighted reader. */
  readonly note: string
  /** CSS pixels per point at this zoom. */
  readonly scale: number
  readonly sheet: { readonly pt: Box; readonly px: Box }
  readonly regions: readonly CanvasRegion[]
  /** The payment part's band, for a report that has one; null for one that has none. */
  readonly paymentPart: CanvasPaymentPart | null
  readonly boxes: readonly CanvasBox[]
  readonly rulers: { readonly horizontal: readonly RulerTick[]; readonly vertical: readonly RulerTick[] }
}
