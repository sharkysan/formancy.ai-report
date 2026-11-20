import type { Block, Chart, EpcQrCode, KeepTogether, QrCode, QrSymbol, Table } from '@formancy/report-runtime'
import type { PlacedImage } from './check-images.js'
import type { RenderFonts } from './host-fonts.js'
import type { RowLine } from './check-table.js'

/** A block that is drawn at a fixed height, which no page may be too short for. */
export interface Tall {
  readonly height: number
  /** The vertical space framed sections around it take from a page: their borders and padding, above and below. */
  readonly inset: number
  readonly what: string
  readonly subject: string
}

/** A table or keep-together block of the body that the body pass measures, at the width it stands at. */
export interface Measured {
  readonly block: Table | KeepTogether
  readonly at: string
  readonly width: number
  readonly inset: number
  /** A table's tallest line under its header (`checkTableCells`); none for a keep-together block. */
  readonly under: RowLine | undefined
}

/** Where a block stands. */
export interface Place {
  /** In a page region, not the body: the page header or footer, or page 1's own header. */
  readonly region: boolean
  /** In a region pdfmake draws on every page, the page header or footer, knowing the page's number and the count: not page 1's own header, nor the body. */
  readonly everyPage: boolean
  /** Inside a keep-together block. */
  readonly kept: boolean
  /** Inside a columns block. */
  readonly column: boolean
  readonly width: number
  readonly inset: number
  readonly depth: number
}

export interface Walk {
  readonly fonts: RenderFonts
  readonly paths: Map<Block, string>
  readonly images: PlacedImage[]
  readonly codes: Map<QrCode | EpcQrCode, QrSymbol>
  captioned: boolean
  readonly tall: Tall[]
  readonly measured: Measured[]
  /** Every chart of the body the checks passed, and where it stands: what the drawing lays out (`check-chart.ts`). */
  readonly charts: { readonly block: Chart; readonly at: string }[]
}

/** Something drawn at a fixed height in the body: judged against the body once the regions are measured. A page region's is judged by measuring the region. */
export function tall(walk: Walk, place: Place, height: number, what: string, subject: string): void {
  if (!place.region) walk.tall.push({ height, inset: place.inset, what, subject })
}
