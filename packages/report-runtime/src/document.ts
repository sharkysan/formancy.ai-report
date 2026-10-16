/**
 * The resolved document: a report after the runtime has read its data,
 * evaluated its expressions and conditions, grouped, sorted, totalled and
 * formatted it, with nothing left to decide but where each line falls on a
 * page. The runtime lowers a report definition to it, and
 * `@formancy/report-render-pdf` draws it
 * ([0005](../../../docs/decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)).
 *
 * It names no engine and holds no engine's options. It is plain data, every
 * part of it serialisable but an image's bytes, which are a `Uint8Array`.
 * Every length is in PDF points. Every value is already the string that
 * prints: an exact number stays a string all the way to the page, and an
 * engine never formats, rounds or converts one.
 *
 * It holds everything version 0 of the definition can print: the columns,
 * sections, rule weights and colours, fonts and colours, image fits and
 * group headers across a table that
 * [0007](../../../docs/decisions/0007-a-report-definition-is-its-own-versioned-document.md)
 * found the renderer trial's document without. Its vocabularies -- font
 * tokens, alignments, fits, page sizes, colours -- are report-spec's own
 * types, so the definition and the document cannot name different ones. An
 * absent style property is the renderer's default, as report-spec's print
 * styles say.
 *
 * Where a block may stand -- a table or a page break never inside columns or
 * a keep-together block, page fields only in the page regions -- is the
 * definition's to validate and the renderer's to refuse. These types do not
 * hold it.
 */
import type { Alignment, AssetMediaType, Border, FontFamily, ImageFit, Margins, Orientation, PageSizeName, QrErrorCorrection, Width } from '@formancy/report-spec'

/**
 * A run of text, or a number only the engine knows when it lays out the
 * page, which prints only in the page header and footer. A run in bold
 * inside a paragraph that is not was the trial's; version 0 of the
 * definition sets weight per paragraph.
 */
export type Inline = { readonly text: string; readonly bold?: boolean } | { readonly field: 'pageNumber' } | { readonly field: 'pageCount' }

/**
 * How text prints: report-spec's `PrintStyle`, resolved. The runtime lays
 * each conditional style that held over the base one, a later rule's
 * property winning, and hands the engine the result; an engine never merges
 * styles itself.
 */
export interface TextStyle {
  /** A font token, never a font's name: the renderer maps each to a font it embeds. */
  readonly font?: FontFamily
  /** Points. */
  readonly size?: number
  readonly bold?: boolean
  readonly italic?: boolean
  /** Lower-case `#rrggbb`. */
  readonly color?: string
  readonly align?: Alignment
}

/** Text that wraps at the width it is given. A word wider than that width still prints whole, broken across lines. */
export interface Paragraph {
  readonly kind: 'paragraph'
  readonly runs: readonly Inline[]
  readonly style?: TextStyle
  /** Never the last thing on a page when something follows it: a heading moves with what it heads. */
  readonly keepWithNext?: boolean
}

export interface TableColumn {
  /** Points, or `'fill'` for an equal share of the width the fixed columns leave. */
  readonly width: Width
  /** How each cell in the column is aligned, unless the cell's style says otherwise. */
  readonly align: Alignment
}

/**
 * One row of a table, its cells in column order, each aligned to the top of
 * the row, so that a row's first line holds its first cell.
 *
 * A `groupHeader` is never the last row on a page: it moves to the next page
 * with the row it heads. A `detail` row may be taller than a page; the engine
 * then continues it on the next one, or refuses with `content-too-large`, and
 * never clips it.
 */
export interface TableRow {
  readonly kind: 'detail' | 'groupHeader' | 'groupFooter' | 'total'
  /** One per column; exactly one when the row runs `across` the table. */
  readonly cells: readonly string[]
  /**
   * The row is one cell across every column: a group header, which version
   * 0 prints as one line across the table rather than in its first column.
   */
  readonly across?: true
  /** Every cell's style; absent, the renderer's for a row of its kind. */
  readonly style?: TextStyle
  /**
   * A cell's own style, one entry per cell, `null` where the cell has the
   * row's. A cell's own is its whole style, the row's already laid under it
   * by the runtime, never merged again by the engine: a column's print
   * style, or one of its conditional styles that held for this row.
   */
  readonly cellStyles?: readonly (TextStyle | null)[]
}

export interface Table {
  readonly kind: 'table'
  readonly id: string
  readonly columns: readonly TableColumn[]
  /** The one header row, repeated at the top of every page the table spans. */
  readonly header: readonly string[]
  /** The header row's style; absent, the renderer's. */
  readonly headerStyle?: TextStyle
  readonly rows: readonly TableRow[]
  /** Printed under the header, in place of detail rows, when there are none. Group and total rows still print. */
  readonly emptyText: string
}

/**
 * The most bytes one image asset may have: 20 MB, the renderer trial's
 * limit, the plan's "enforced limits" made a number to test. The runtime
 * refuses an answer past it before copying it, and the renderer before
 * decoding it, from this one constant.
 */
export const MAX_ASSET_BYTES = 20 * 1024 * 1024

/**
 * An approved asset's bytes, already fetched by the host: an engine never
 * resolves an address. Every image that draws the same asset shares one
 * object, which an engine embeds once.
 */
export interface ImageAsset {
  readonly id: string
  readonly mediaType: AssetMediaType
  readonly bytes: Uint8Array
}

/**
 * An image in a box of fixed size, which the layout reserves whole whatever
 * the image holds. `contain` draws all of the image at its own proportions,
 * as large as the box allows; `cover` fills the box at the image's
 * proportions and crops what falls outside it. Either way the image is
 * centred in its box, as CSS's `object-fit` centres one by default, and
 * nothing of it is drawn outside the box. For an image of the box's own
 * proportions the two are the same drawing. Bytes the engine cannot decode
 * are refused as `invalid-asset`, naming the asset.
 */
export interface Image {
  readonly kind: 'image'
  readonly asset: ImageAsset
  readonly width: number
  readonly height: number
  readonly fit: ImageFit
}

/**
 * A QR code (ISO/IEC 18004): `text`, encoded as UTF-8 at the error
 * correction level asked for, drawn dark on white in a square `size` points
 * a side, whose quiet zone of four modules lies inside that square. `text`
 * is what the component's content prints, formatted as a paragraph's runs
 * are; it never holds a page number or count, which report-spec refuses in
 * a QR code. In a final render it holds every value its content reads and
 * is never empty: the runtime refuses a run whose value is null, and
 * content that prints nothing, as `no-qr-value` and `empty-qr-code`. In a
 * preview it is what the content resolves to, a value that is null as
 * nothing, and it can be empty, which an engine draws as a symbol of no
 * data. Which version of the symbol holds the text, and so how large a
 * module is, is the engine's to work out: text no version holds at the
 * level, or modules too small to print, are refused as `content-too-large`,
 * naming the code by `id`, never drawn as a code that does not scan.
 */
export interface QrCode {
  readonly kind: 'qrCode'
  /** The component's id, which a refusal names as its subject. */
  readonly id: string
  readonly text: string
  /** Points: the side of the square, quiet zone included. */
  readonly size: number
  readonly errorCorrection: QrErrorCorrection
}

/** A horizontal line across the width it is given: the printable area's, or its column's. */
export interface Rule {
  readonly kind: 'rule'
  /** Points. */
  readonly thickness: number
  /** Lower-case `#rrggbb`. */
  readonly color?: string
}

/** A box of fixed size: filled, outlined, both, or neither, when it is only space. */
export interface Rectangle {
  readonly kind: 'rectangle'
  readonly width: number
  readonly height: number
  /** Lower-case `#rrggbb`. */
  readonly fill?: string
  /** The outline's colour, lower-case `#rrggbb`, drawn at the renderer's weight. */
  readonly stroke?: string
}

export interface Spacer {
  readonly kind: 'spacer'
  readonly height: number
}

/** Starts a new page. */
export interface PageBreak {
  readonly kind: 'pageBreak'
}

/**
 * Blocks that are printed on one page, such as a report's summary. When they
 * do not fit in what is left of the page they move whole to the next one;
 * when they are taller than a whole page the engine refuses with
 * `content-too-large` rather than splitting them.
 */
export interface KeepTogether {
  readonly kind: 'keepTogether'
  readonly blocks: readonly Block[]
}

/** One column of a columns block, as distinct from a table's column. */
export interface ColumnSlot {
  /** Points, or `'fill'` for an equal share of the width the fixed columns leave. */
  readonly width: Width
  readonly blocks: readonly Block[]
}

/**
 * Two to four columns side by side, each laying its blocks out down its own
 * width, with no gap between them but what their widths leave. The block is
 * as tall as its tallest column. When it does not fit on what is left of the
 * page, the engine continues its columns on the next page or refuses with
 * `content-too-large`, and never clips them.
 */
export interface Columns {
  readonly kind: 'columns'
  readonly columns: readonly ColumnSlot[]
}

/**
 * Blocks in a frame: the border drawn around them, the fill behind them, and
 * the padding between the border and them. A section adds no layout rule:
 * its blocks flow as though they stood in its place, across pages too, and
 * the frame is drawn around the part on each page. Without a border, a fill
 * or padding it is its blocks and nothing more.
 */
export interface Section {
  readonly kind: 'section'
  readonly blocks: readonly Block[]
  readonly border?: Border
  /** Lower-case `#rrggbb`. */
  readonly fill?: string
  /** Points, on every side. */
  readonly padding?: number
}

export type Block = Paragraph | Table | Image | QrCode | Rule | Rectangle | Spacer | PageBreak | KeepTogether | Columns | Section

export interface PageSetup {
  readonly size: PageSizeName
  readonly orientation: Orientation
  /**
   * From each edge of the paper to the printable area. Everything prints
   * inside it: the page header at its top, the page footer at its bottom, and
   * the body between them.
   */
  readonly margins: Margins
}

export interface ResolvedDocument {
  readonly info: {
    readonly title: string
    /** An ISO instant, fixed by the caller, so that the same document renders to the same PDF. */
    readonly creationDate: string
  }
  readonly page: PageSetup
  /** Repeated on every page, at the top of the printable area. */
  readonly pageHeader: readonly Block[]
  /** Repeated on every page, at the bottom of the printable area. */
  readonly pageFooter: readonly Block[]
  /**
   * What prints once, in order. A definition's report header is simply the
   * start of the body, and its summary the end: each prints once, before or
   * after everything else, so neither needs a block kind of its own. A
   * summary that must stay on one page is a keep-together block.
   */
  readonly body: readonly Block[]
}

export const REFUSAL_CODES = ['too-many-pages', 'content-too-large', 'invalid-asset', 'cancelled', 'unsupported'] as const
export type RefusalCode = (typeof REFUSAL_CODES)[number]

/**
 * Why an engine produced no PDF. An engine refuses rather than truncates: a
 * report that cannot be printed whole is not printed, and the caller is told
 * what stopped it. `subject` names the asset, table or block concerned, when
 * the refusal is about one.
 */
export class RenderRefusal extends Error {
  readonly code: RefusalCode
  readonly subject: string | undefined

  constructor(code: RefusalCode, message: string, subject?: string) {
    super(message)
    this.name = 'RenderRefusal'
    this.code = code
    this.subject = subject
  }
}
