import type { Content, CustomTableLayout, Node, NodeQueries, TableCell } from 'pdfmake/interfaces.js'
import type { Block, ImageAsset, Inline, Paragraph, Table, TableColumn, TableRow } from '../document.js'

/**
 * The document's blocks as pdfmake content, in one of two modes. `render`
 * is what the PDF is made of. `measure` is the same content made fully
 * breakable, with a mark on each table row, for the pass that measures
 * heights before the PDF is laid out (`pdfmake-measure.ts`).
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

/** Text when a paragraph names no size. */
export const DEFAULT_SIZE = 10
/** A table's cells, whose size the document does not set: the body size the corpus's geometry assumes. */
export const TABLE_SIZE = 9

/** The table layout: horizontal rules of half a point, no vertical ones, 4pt of padding at the sides and 2pt above and below. */
export const RULE = 0.5
export const PADDING_X = 4
export const PADDING_Y = 2
const TABLE_LAYOUT: CustomTableLayout = {
  hLineWidth: () => RULE,
  vLineWidth: () => 0,
  hLineColor: (index) => (index === 1 ? '#000000' : '#bfbfbf'),
  paddingLeft: () => PADDING_X,
  paddingRight: () => PADDING_X,
  paddingTop: () => PADDING_Y,
  paddingBottom: () => PADDING_Y,
}

/** Space above and below a rule block's line, and the height the block takes in all. */
const RULE_GAP = 3
export const RULE_SPACE = RULE_GAP + RULE + RULE_GAP

/** How far a node may start below the top of what it sits under and still be first there: rounding, not layout. */
const AT_TOP = 0.5

/** Laid out as one line of text, as wide as a space, that no line break can fall in. */
const NO_BREAK_SPACE = String.fromCodePoint(0xa0)

/** A rule run when pdfmake asks whether to break before a marked node: true to break. */
export type BreakRule = (node: Node, queries: NodeQueries) => boolean

/** How a table in the body is broken across pages, decided from its measured rows (`tablePlan`). */
export interface TablePlan {
  /** Every row fits on a page under what repeats or moves with it, so none is split. */
  readonly dontBreakRows: boolean
  /** Rows after the header that move to the next page with it, so the header never ends a page. */
  readonly keepWithHeaderRows: number
}

/** What a row of a table is, as pdfmake lays it out: the column header, the empty text, or one of the document's rows. */
export type RowKind = TableRow['kind'] | 'header' | 'empty'

export interface Build {
  readonly mode: 'measure' | 'render'
  /** The printable width: every block is laid out across all of it. */
  readonly width: number
  /** Where the body starts on every page, from the top of the paper. */
  readonly bodyTop: number
  readonly plans: ReadonlyMap<Table, TablePlan>
  /** Filled in: each asset's key in pdfmake's image dictionary, and the dictionary. */
  readonly imageKeys: Map<ImageAsset, string>
  readonly images: Record<string, string>
  /** Filled in: the rules for marked nodes, by mark. */
  readonly rules: Map<number, BreakRule>
  /** Filled in, in measure mode: each table's rows as pdfmake lays them out, with the mark on each one's first cell. */
  readonly measuredRows: Map<Table, readonly { readonly kind: RowKind; readonly mark: number }[]>
  /** The next unused mark. */
  next: number
}

export function newBuild(mode: Build['mode'], width: number, bodyTop: number, plans: ReadonlyMap<Table, TablePlan> = new Map()): Build {
  return { mode, width, bodyTop, plans, imageKeys: new Map(), images: {}, rules: new Map(), measuredRows: new Map(), next: 1 }
}

/** The values of the page fields, known only in a page region and only to pdfmake's header and footer functions. */
export interface Fields {
  readonly pageNumber: number
  readonly pageCount: number
}

interface Scope {
  /** Inside a keep-together block: one page, so no rule may break inside it. */
  readonly kept: boolean
  readonly fields?: Fields
}

const BODY: Scope = { kept: false }

/** Content for the body's blocks, or a page region's when `fields` are given. */
export function contentOf(blocks: readonly Block[], build: Build, fields?: Fields): Content[] {
  return sequence(blocks, build, fields === undefined ? BODY : { kept: true, fields })
}

/**
 * The blocks' content. In the body, a keep-with-next paragraph breaks to the
 * next page when the block it is kept with does not start on its page --
 * unless it is first on its page already, where a break would leave the page
 * empty and the paragraph no better kept on the next.
 */
function sequence(blocks: readonly Block[], build: Build, scope: Scope): Content[] {
  const contents = blocks.map((block) => blockContent(block, build, scope))
  if (build.mode !== 'render' || scope.kept) return contents
  blocks.forEach((block, index) => {
    if (block.kind !== 'paragraph' || block.keepWithNext !== true) return
    const anchor = keptWith(blocks, contents, index)
    if (anchor === undefined) return
    anchor.id ??= `kept-${build.next++}`
    const ids = new Set([anchor.id])
    const own = build.next++
    ;(contents[index] as Anchor).headlineLevel = own
    build.rules.set(own, (node, queries) => node.startPosition.top > build.bodyTop + AT_TOP && !startsOnPage(queries, ids, node.startPosition.pageNumber))
  })
  return contents
}

/** A node of the content the adapter builds, as far as a rule needs to know it: always an object, every table cell included. */
interface Anchor {
  readonly text?: unknown
  readonly image?: unknown
  readonly stack?: readonly Anchor[]
  readonly table?: { readonly body: readonly (readonly Anchor[])[] }
  id?: string
  headlineLevel?: number
}

/** The first node of `node` that prints text, or an image when no text comes first: where pdfmake records the content's start. */
function anchorOf(node: Anchor): Anchor | undefined {
  const inner = node.stack ?? node.table?.body.flat()
  if (inner !== undefined) {
    for (const each of inner) {
      const anchor = anchorOf(each)
      if (anchor !== undefined) return anchor
    }
    return undefined
  }
  // A paragraph's text is an array of runs, and the adapter keeps nothing with a paragraph that prints nothing.
  const printsText = typeof node.text === 'string' ? node.text.trim() !== '' : Array.isArray(node.text)
  return printsText || node.image !== undefined ? node : undefined
}

/** Whether a node with one of `ids`, among those pdfmake has on this page and the next, starts on `page`. */
function startsOnPage(queries: NodeQueries, ids: ReadonlySet<string>, page: number): boolean {
  return [...queries.getFollowingNodesOnPage(), ...queries.getNodesOnNextPage()].some(
    (other) => other.id !== undefined && ids.has(other.id) && other.startPosition.pageNumber === page,
  )
}

/**
 * Where the block a keep-with-next paragraph at `index` stays with starts:
 * the anchor of the next block that prints text or an image, past spacers,
 * rules and other keep-with-next paragraphs, so that a run of headings moves
 * as one. None when a page break or the end comes first: a heading over
 * nothing is not kept with anything.
 */
function keptWith(blocks: readonly Block[], contents: readonly Content[], index: number): Anchor | undefined {
  for (let next = index + 1; next < blocks.length; next++) {
    const block = blocks[next]!
    if (block.kind === 'pageBreak') return undefined
    const anchor = block.kind === 'paragraph' && block.keepWithNext === true ? undefined : anchorOf(contents[next] as Anchor)
    if (anchor !== undefined) return anchor
  }
  return undefined
}

function blockContent(block: Block, build: Build, scope: Scope): Content {
  switch (block.kind) {
    case 'paragraph':
      return paragraphContent(block, scope.fields)
    case 'table':
      return tableContent(block, build, scope)
    case 'image':
      return { image: imageKey(block.asset, build), width: block.width, height: block.height }
    case 'rule':
      // pdfmake makes a canvas as tall as its lowest point and strokes a line
      // half its width to either side: the line half its width down, and the
      // other half of it in the margin below.
      return { canvas: [{ type: 'line', x1: 0, y1: RULE / 2, x2: build.width, y2: RULE / 2, lineWidth: RULE }], margin: [0, RULE_GAP, 0, RULE_GAP + RULE / 2] }
    // An empty stack, never empty text: pdfmake lays out empty text as one
    // line of the default size, which would add 11.7pt to every spacer and
    // to the top of the page after every break. At the foot of a page with
    // less room than it asks for, a spacer moves to the next page and starts
    // there, without the space.
    case 'spacer':
      return { stack: [], margin: [0, block.height, 0, 0] }
    case 'pageBreak':
      return { stack: [], pageBreak: 'before' }
    case 'keepTogether':
      return { stack: sequence(block.blocks, build, { ...scope, kept: true }), unbreakable: build.mode === 'render' }
    // The adapter refuses these before building anything (`undrawn.ts`).
    case 'columns':
    case 'section':
    case 'rectangle':
    case 'qrCode':
    case 'epcQrCode':
      throw new Error(`a ${block.kind} block reached the pdfmake content`)
  }
}

function paragraphContent(paragraph: Paragraph, fields: Fields | undefined): Content {
  const { size = DEFAULT_SIZE, bold, italic, align = 'left' } = paragraph.style ?? {}
  return {
    text: paragraph.runs.length === 0 ? '' : paragraph.runs.map((run) => inline(run, fields)),
    fontSize: size,
    alignment: align,
    ...(bold === undefined ? {} : { bold }),
    ...(italic === undefined ? {} : { italics: italic }),
  }
}

function inline(run: Inline, fields: Fields | undefined): { text: string; bold?: boolean } {
  if ('text' in run) return run.bold === undefined ? { text: run.text } : { text: run.text, bold: run.bold }
  // The adapter refuses a page field outside a page region before building anything.
  if (fields === undefined) throw new Error(`a ${run.field} field outside a page region`)
  return { text: String(fields[run.field]) }
}

function imageKey(asset: ImageAsset, build: Build): string {
  const known = build.imageKeys.get(asset)
  if (known !== undefined) return known
  const key = `image${build.imageKeys.size}`
  build.imageKeys.set(asset, key)
  build.images[key] = `data:${asset.mediaType};base64,${Buffer.from(asset.bytes).toString('base64')}`
  return key
}

/** A table cell as the adapter makes it. A cell a column span covers is one too, as pdfmake requires, and pdfmake lays out nothing of it. */
interface Cell {
  readonly text: string
  readonly bold: boolean
  readonly alignment: TableColumn['align']
  readonly italics?: boolean
  readonly colSpan?: number
  headlineLevel?: number
  id?: string
}

/** A row as pdfmake lays it out: the header, the empty text in place of detail rows when there are none, the document's rows. */
interface Row {
  readonly kind: RowKind
  readonly cells: readonly Cell[]
}

function tableContent(table: Table, build: Build, scope: Scope): Content {
  const measuring = build.mode === 'measure'
  // A no-break space where a cell is empty while measuring: every cell then
  // lays out one line, as tall as a cell of text beside it, so each row has a
  // first cell to mark. The adapter refuses a row whose cells are not one a column.
  const cell = (text: string, column: number, bold: boolean): Cell => ({
    text: measuring && text === '' ? NO_BREAK_SPACE : text,
    bold,
    alignment: table.columns[column]!.align,
  })
  const empty = !table.rows.some((row) => row.kind === 'detail')
  const emptyRow: Row = {
    kind: 'empty',
    cells: table.columns.map((_, column) =>
      column === 0 ? { ...cell(table.emptyText, 0, false), italics: true, colSpan: table.columns.length } : cell('', column, false),
    ),
  }
  const rows: Row[] = [
    { kind: 'header', cells: table.header.map((text, column) => cell(text, column, true)) },
    ...(empty ? [emptyRow] : []),
    ...table.rows.map((row) => ({ kind: row.kind, cells: row.cells.map((text, column) => cell(text, column, row.kind !== 'detail')) })),
  ]
  const plan = build.plans.get(table) ?? { dontBreakRows: false, keepWithHeaderRows: 0 }
  if (measuring) {
    build.measuredRows.set(
      table,
      rows.map((row) => ({ kind: row.kind, mark: mark(row.cells[0]!, build) })),
    )
  } else if (!scope.kept) {
    groupHeaderRules(rows, plan, build)
  }
  return {
    table: {
      headerRows: measuring ? 0 : 1,
      ...(measuring || plan.keepWithHeaderRows === 0 ? {} : { keepWithHeaderRows: plan.keepWithHeaderRows }),
      ...(measuring ? {} : { dontBreakRows: plan.dontBreakRows }),
      widths: table.columns.map((column) => (column.width === 'fill' ? '*' : column.width - 2 * PADDING_X)),
      body: rows.map((row): TableCell[] => [...row.cells]),
    },
    layout: TABLE_LAYOUT,
    fontSize: TABLE_SIZE,
  }
}

/** Marks `cell`, keeping a mark it already has, and returns the mark. */
function mark(cell: Cell, build: Build): number {
  return (cell.headlineLevel ??= build.next++)
}

/**
 * A group header is never the last row on its page. Each of its cells that
 * prints is marked with a rule, and each cell of the row it heads that
 * prints gets an id; when none of the latter starts on the group header's
 * page, the group header breaks to the next page, under the repeated column
 * header. pdfmake breaks before a cell, not a row, so a group header with
 * several cells of text breaks once for each, one layout after another.
 *
 * A group header first on its page always has the row it heads beside it:
 * the table's plan keeps rows whole only when each fits under its group
 * header (`tablePlan`), and a row that may split starts wherever a line of it
 * fits. So the rule never moves a group header to a page that only the
 * column header would be left on.
 *
 * Not when the group header is the first row under the column header: it
 * moves with the header then (`keepWithHeaderRows`), and a break inside
 * pdfmake's unbreakable block would lose the rows after it. A group header
 * followed by a row with no text cannot be kept with it: there is nothing on
 * the page for the rule to find.
 */
function groupHeaderRules(rows: readonly Row[], plan: TablePlan, build: Build): void {
  rows.forEach((row, index) => {
    const headed = rows[index + 1]
    if (row.kind !== 'groupHeader' || headed === undefined || index <= plan.keepWithHeaderRows) return
    const ids = new Set(printing(headed).map((cell) => (cell.id ??= `row-${build.next++}`)))
    if (ids.size === 0) return
    for (const cell of printing(row)) {
      build.rules.set(mark(cell, build), (node, queries) => !startsOnPage(queries, ids, node.startPosition.pageNumber))
    }
  })
}

/** The cells of a row that have text. */
function printing(row: Row): Cell[] {
  return row.cells.filter((cell) => cell.text.trim() !== '')
}
