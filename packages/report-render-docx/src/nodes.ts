/**
 * What a Word file is made of, between the resolved document and its XML
 * (0068): paragraphs and tables, in points and in the document's own
 * terms, with nothing of WordprocessingML's syntax yet. The blocks are
 * mapped onto these (`blocks.ts`, `table.ts`), the keep rules mark them
 * -- a heading kept with what it heads marks every paragraph between the
 * two, which only a list of nodes can say -- and `wml.ts` writes them out.
 * Mutable for those marks alone.
 */

/** What a run prints in: every property stated, since the file has no style to inherit one from. */
export interface RunStyle {
  readonly family: string
  /** Points. */
  readonly size: number
  readonly bold: boolean
  readonly italic: boolean
  /** Lower-case `#rrggbb`. */
  readonly color: string
  readonly shift?: 'subscript' | 'superscript'
}

/** A relationship's id in its part: the writer's own, by its order there. */
export type RelationshipId = `rId${number}`

/** An inline picture: its extent, the relationship of its part, an SVG's beside its fallback, and what is cut from its sides. */
export interface PictureNode {
  /** Its number among the file's pictures, from one. */
  readonly id: number
  /** Points. */
  readonly width: number
  readonly height: number
  /** The relationship, in the part it stands in, of the part it embeds. */
  readonly embed: RelationshipId
  /** The relationship of the SVG part, where it is one. */
  readonly svg?: RelationshipId
  /** The fraction cut from each side across and from each side down; absent where nothing is. */
  readonly crop?: { readonly across: number; readonly down: number }
}

export type RunNode =
  | { readonly kind: 'text'; readonly text: string; readonly style: RunStyle }
  | { readonly kind: 'field'; readonly field: 'PAGE' | 'NUMPAGES'; readonly style: RunStyle }
  | { readonly kind: 'picture'; readonly picture: PictureNode }

/** A single line of a border: points, and lower-case `#rrggbb`. */
export interface Line {
  readonly weight: number
  readonly color: string
}

export interface ParagraphNode {
  readonly kind: 'paragraph'
  readonly runs: readonly RunNode[]
  /** The paragraph mark's family and size, which size its last line and an empty paragraph's; `undefined`, a mark a point tall, of a paragraph that holds no text. */
  readonly mark: { readonly family: string; readonly size: number } | undefined
  readonly align?: 'left' | 'center' | 'right'
  keepNext: boolean
  keepLines: boolean
  readonly pageBreakBefore?: true
  /** Points of space before and after it. */
  readonly before?: number
  readonly after?: number
  /** Its line, exactly so many points tall. */
  readonly line?: number
  /** Points from the left. */
  readonly indent?: number
  /** A rule: the line under it, and between it and a rule like it. */
  readonly rule?: Line
}

export interface CellNode {
  /** Twentieths of a point: the sum of the grid columns it spans. */
  readonly width: number
  readonly span?: number
  /** The line on each of its sides that has one. */
  readonly borders?: { readonly top?: Line; readonly left?: Line; readonly bottom?: Line; readonly right?: Line }
  /** Lower-case `#rrggbb`. */
  readonly shade?: string
  readonly content: BlockNode[]
}

export interface RowNode {
  cantSplit: boolean
  readonly header?: true
  /** Exactly so many points tall. */
  readonly height?: number
  readonly cells: readonly CellNode[]
}

export interface TableNode {
  readonly kind: 'table'
  /** Twentieths of a point, a column each: rounded once, so that the table is as wide as its columns. */
  readonly grid: readonly number[]
  /** The table's own rules: above it, under it and between its rows. */
  readonly rules?: Line
  /** Every cell's padding in points, at the sides and above and below. */
  readonly padding: { readonly x: number; readonly y: number }
  readonly rows: readonly RowNode[]
}

export type BlockNode = ParagraphNode | TableNode

/** Every paragraph of `nodes`, through every table's cells, in order. */
export function paragraphsOf(nodes: readonly BlockNode[]): ParagraphNode[] {
  const found: ParagraphNode[] = []
  const walk = (list: readonly BlockNode[]): void => {
    for (const node of list) {
      if (node.kind === 'paragraph') found.push(node)
      else for (const row of node.rows) for (const cell of row.cells) walk(cell.content)
    }
  }
  walk(nodes)
  return found
}

/** A paragraph that holds nothing and is exactly `height` points tall: a spacer, the gap between a region and the body, and what stands between two tables. */
export function emptyLine(height: number): ParagraphNode {
  return { kind: 'paragraph', runs: [], mark: undefined, keepNext: false, keepLines: false, line: height }
}

/** The height of the paragraph that stands between two tables, and after one that ends a cell, a footer or the body: a point. */
export const SEPARATOR = 1
