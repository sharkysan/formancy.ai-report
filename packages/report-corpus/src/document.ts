/**
 * The document every engine adapter renders: a report after its data has been
 * read, grouped, totalled and formatted, with nothing left to decide but where
 * each line falls on a page.
 *
 * Provisional. It is the renderer trial's input, and it becomes
 * `@formancy/report-runtime`'s output once the runtime exists, so it names no
 * engine and holds no engine's options. Every length is in PDF points. Every
 * value is already the string that prints: an exact number stays a string all
 * the way to the page, and an engine never formats, rounds or converts one.
 */

/** A run of text, or a number only the engine knows when it lays out the page. */
export type Inline =
  | { readonly text: string; readonly bold?: boolean }
  | { readonly field: 'pageNumber' }
  | { readonly field: 'pageCount' }

export interface ParagraphStyle {
  /** Font size in points. */
  readonly size?: number
  readonly bold?: boolean
  readonly italic?: boolean
  readonly align?: 'left' | 'center' | 'right'
}

/** Text that wraps at the width it is given. A word wider than that width still prints whole, broken across lines. */
export interface Paragraph {
  readonly kind: 'paragraph'
  readonly runs: readonly Inline[]
  readonly style?: ParagraphStyle
  /** Never the last thing on a page when something follows it: a heading moves with what it heads. */
  readonly keepWithNext?: boolean
}

export interface TableColumn {
  /** Points, or `'fill'` for an equal share of the width the fixed columns leave. */
  readonly width: number | 'fill'
  readonly align: 'left' | 'right' | 'center'
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
  readonly cells: readonly string[]
}

export interface Table {
  readonly kind: 'table'
  readonly id: string
  readonly columns: readonly TableColumn[]
  /** The one header row, repeated at the top of every page the table spans. */
  readonly header: readonly string[]
  readonly rows: readonly TableRow[]
  /** Printed under the header, in place of detail rows, when there are none. Group and total rows still print. */
  readonly emptyText: string
}

/** An approved asset's bytes, already fetched by the host: an engine never resolves an address. */
export interface ImageAsset {
  readonly id: string
  readonly mediaType: 'image/png' | 'image/jpeg'
  readonly bytes: Uint8Array
}

/** An image drawn at exactly this size. Bytes the engine cannot decode are refused as `invalid-asset`, naming the asset. */
export interface Image {
  readonly kind: 'image'
  readonly asset: ImageAsset
  readonly width: number
  readonly height: number
}

/** A horizontal line across the width of the printable area. */
export interface Rule {
  readonly kind: 'rule'
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

export type Block = Paragraph | Table | Image | Rule | Spacer | PageBreak | KeepTogether

export interface PageSetup {
  readonly size: 'A4' | 'Letter'
  readonly orientation: 'portrait' | 'landscape'
  /**
   * From each edge of the paper to the printable area. Everything prints
   * inside it: the page header at its top, the page footer at its bottom, and
   * the body between them.
   */
  readonly margins: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number }
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
  readonly body: readonly Block[]
}

/**
 * Portrait sizes in points, as PDF engines write them: ISO A4 is 210 by 297
 * millimetres, rounded to the hundredth of a point; US Letter is 8.5 by 11
 * inches.
 */
const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
} as const

/** The paper's width and height in points, with its orientation applied. */
export function pageDimensions(page: PageSetup): { readonly width: number; readonly height: number } {
  const { width, height } = PAGE_SIZES[page.size]
  return page.orientation === 'portrait' ? { width, height } : { width: height, height: width }
}

export type RefusalCode = 'too-many-pages' | 'content-too-large' | 'invalid-asset' | 'cancelled' | 'unsupported'

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

export interface RenderOptions {
  /** The most pages the PDF may have. A document that needs more is refused with `too-many-pages`, never cut short. */
  readonly maxPages: number
  readonly signal?: AbortSignal
}

/**
 * One PDF engine behind the trial's common input. It returns the PDF's bytes,
 * or rejects with a `RenderRefusal`; anything else it rejects with is the
 * engine failing.
 */
export interface EngineAdapter {
  readonly name: string
  /** The engine's exact package version, recorded with every result. */
  readonly version: string
  render(document: ResolvedDocument, options: RenderOptions): Promise<Uint8Array>
}
