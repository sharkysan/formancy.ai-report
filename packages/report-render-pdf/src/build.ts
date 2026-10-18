import type { Node, NodeQueries } from 'pdfmake/interfaces.js'
import type { Block, EpcQrCode, ImageAsset, QrCode, Table, TableRow } from '@formancy/report-runtime'
import type { CheckedImage } from './assets.js'
import type { KeepBlock } from './breaks.js'
import type { QrSymbol } from './qr.js'
import type { WordRoom } from './words.js'

/**
 * What building one pdfmake document from a resolved one accumulates, in one
 * of two modes. `render` is what the PDF is made of. `measure` is the same
 * content made fully breakable, with a mark on each table row, for the passes
 * that measure heights before the PDF is laid out (`measure.ts`).
 *
 * pdfmake knows nothing of keep-with-next or group headers. Both are rules
 * run by its `pageBreakBefore` hook, which it calls for each node once it
 * has laid the document out, and lays it out again whenever a rule asks for
 * a break. The node a rule runs for is found by its `headlineLevel`, which
 * pdfmake passes to the hook and otherwise ignores: here it is not a level
 * but a number that names the node.
 *
 * The node a rule looks for -- the row a group header heads, the block a
 * heading is kept with -- carries an `id` as well, and the rule reads the
 * page it starts on. pdfmake records the position of a node inside an
 * unbreakable block (a row it keeps whole, a keep-together block) before it
 * moves the block to the next page, and corrects the page afterwards only
 * for a node with an id; without one, a row moved to the next page still
 * says it is on the last. The cost: every id is also a named destination in
 * the PDF.
 */

/** A rule run when pdfmake asks whether to break before a marked node: true to break. */
export type BreakRule = (node: Node, queries: NodeQueries) => boolean

/** How a table in the body is broken across pages, decided from its measured rows (`tablePlan`). */
export interface TablePlan {
  /** Every row fits on a page under what repeats or moves with it, so none is split. */
  readonly dontBreakRows: boolean
  /** Rows after the header that move to the next page with it, so the header never ends a page. */
  readonly keepWithHeaderRows: number
  /** Each row's height and the rule under it, as measured, the header first. */
  readonly pitches: readonly number[]
  /** The rows the table's rules keep on one page (`breaks.ts`). */
  readonly blocks: readonly KeepBlock[]
}

/** The plan of a table nothing measured: a table in a keep-together block or a page region, which no rule breaks. */
export const UNPLANNED: TablePlan = { dontBreakRows: false, keepWithHeaderRows: 0, pitches: [], blocks: [] }

/** What a row of a table is, as pdfmake lays it out: the column header, the empty text, or one of the document's rows. */
export type RowKind = TableRow['kind'] | 'header' | 'empty'

/** The values of the page fields, known only in a page region and only to pdfmake's header and footer functions. */
export interface Fields {
  readonly pageNumber: number
  readonly pageCount: number
}

export interface Build {
  readonly mode: 'measure' | 'render'
  /** Where the body starts on every page, from the top of the paper. */
  readonly bodyTop: number
  /** Where it ends. */
  readonly bodyBottom: number
  readonly plans: ReadonlyMap<Table, TablePlan>
  /** Each image asset as the asset checks read it. */
  readonly assets: ReadonlyMap<ImageAsset, CheckedImage>
  /** Each QR code's and EPC QR code's symbol, as the checks encoded it. */
  readonly codes: ReadonlyMap<QrCode | EpcQrCode, QrSymbol>
  /** Filled in: each asset's key in pdfmake's image dictionary, and the dictionary. */
  readonly imageKeys: Map<ImageAsset, string>
  readonly images: Record<string, string>
  /** Filled in: the rules for marked nodes, by mark. */
  readonly rules: Map<number, BreakRule>
  /** Filled in, in measure mode: each table's rows as pdfmake lays them out, with the mark on each one's first cell. */
  readonly measuredRows: Map<Table, readonly { readonly kind: RowKind; readonly mark: number }[]>
  /** Where each paragraph stands in the document, `body[2]`, for a refusal to name. */
  readonly paths: ReadonlyMap<Block, string>
  /** Filled in: every text node whose widest word is held to its room once pdfmake has measured it (`words.ts`). */
  readonly words: WordRoom[]
  /** The next unused mark. */
  next: number
}

export function newBuild(
  mode: Build['mode'],
  checked: { readonly assets: ReadonlyMap<ImageAsset, CheckedImage>; readonly codes: ReadonlyMap<QrCode | EpcQrCode, QrSymbol>; readonly paths: ReadonlyMap<Block, string> },
  body: { readonly top: number; readonly bottom: number } = { top: 0, bottom: 0 },
  plans: ReadonlyMap<Table, TablePlan> = new Map(),
): Build {
  const { assets, codes, paths } = checked
  return { mode, bodyTop: body.top, bodyBottom: body.bottom, plans, assets, codes, paths, imageKeys: new Map(), images: {}, rules: new Map(), measuredRows: new Map(), words: [], next: 1 }
}

/** Marks `node`, keeping a mark it already has, and returns the mark. */
export function mark(node: { headlineLevel?: number }, build: Build): number {
  return (node.headlineLevel ??= build.next++)
}

/** Whether a node with one of `ids`, among those pdfmake has on this page and the next, starts on `page`. */
export function startsOnPage(queries: NodeQueries, ids: ReadonlySet<string>, page: number): boolean {
  return [...queries.getFollowingNodesOnPage(), ...queries.getNodesOnNextPage()].some((other) => other.id !== undefined && ids.has(other.id) && other.startPosition.pageNumber === page)
}

/**
 * The page a node handed to pdfmake starts on in its last layout, read from
 * the node itself: pdfmake records each node's positions on it, and reports
 * the first as the node's `startPosition`. `startsOnPage` asks pdfmake's
 * queries, each of which walks every node to the end of the document, so a
 * rule per row of a long table made the rules' work grow with the square of
 * the table; this is one read. Undefined for a node pdfmake laid out
 * nowhere. `pdfmake.test.ts` holds that 0.3.11 still records positions here.
 */
export function pageOf(node: object): number | undefined {
  return (node as { readonly positions?: readonly { readonly pageNumber: number }[] }).positions?.[0]?.pageNumber
}
