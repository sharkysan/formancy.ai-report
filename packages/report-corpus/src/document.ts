/**
 * The document every engine adapter renders, as the corpus uses it.
 *
 * The document itself is `@formancy/report-runtime`'s: the runtime's output,
 * and what the renderer draws. It is re-exported here so that the fixtures,
 * the checks and the trial's adapters keep one place to import it from, and
 * so that `RenderRefusal` is the runtime's own class -- the one a renderer
 * throws and `verifyRefusal` recognises.
 *
 * Two things stay the corpus's:
 * - **`pageDimensions`**, the paper sizes the checks measure a PDF against,
 *   written out here rather than read from the definition's package, which
 *   the corpus does not depend on;
 * - **`EngineAdapter`**, the trial's common interface over its two engines.
 *   [0005](../../../docs/decisions/0005-pdfmake-renders-reports-behind-one-adapter.md)
 *   keeps it in the corpus: the renderer is one engine behind a package
 *   boundary, not a plug-in, and a published interface with one
 *   implementation would be the plug-in system that record forecloses.
 */
import type { PageSetup, ResolvedDocument } from '@formancy/report-runtime'

export { REFUSAL_CODES, RenderRefusal } from '@formancy/report-runtime'
export type {
  Block,
  Columns,
  ColumnSlot,
  Image,
  ImageAsset,
  Inline,
  KeepTogether,
  PageBreak,
  PageSetup,
  Paragraph,
  QrBill,
  QrBillHeadings,
  QrCode,
  Rectangle,
  RefusalCode,
  ResolvedDocument,
  Rule,
  Section,
  Spacer,
  Table,
  TableColumn,
  TableRow,
  TextStyle,
} from '@formancy/report-runtime'

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
