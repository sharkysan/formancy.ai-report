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

/** Where a line ends in a run's text: at a line feed, at a carriage return, and once at the two together. Each is a break of the file (`wml.ts`). */
export const LINE_ENDING = /\r\n|\r|\n/

/** `LINE_ENDING`, found one after another. */
const EACH_ENDING = new RegExp(LINE_ENDING.source, 'g')

/**
 * The line endings `text` holds. Each is written as a break, and what
 * follows it as a `w:t` of its own, so each is counted as a run
 * (`check.ts`). Found without keeping a line: a text is counted before it
 * is known to be short enough to write.
 */
export function lineEndings(text: string): number {
  let found = 0
  EACH_ENDING.lastIndex = 0
  while (EACH_ENDING.test(text)) found += 1
  return found
}

/**
 * `text` as the last run of a paragraph, or a cell, holds it: without the
 * line ending that ends it, where one does. The PDF's engine ends its last
 * line there and opens none after it -- `one\n` prints one line, and the
 * paragraph after it stands where it stands after `one` -- so a break
 * written for it would be a line the PDF does not print. Only that one: of
 * two that end a text the first is a line the PDF prints, and so is one
 * that any later run follows, a run of nothing among them
 * (`against-pdf.test.ts` counts the lines of each).
 */
export function withoutLastEnding(text: string): string {
  return text.replace(/(?:\r\n|\r|\n)$/, '')
}

/** An inline chart (0076): its extent, and the relationship, in the body's part, of the part that states it. */
export interface ChartNode {
  /** Its number among the file's drawings, from one. */
  readonly id: number
  /** Points. */
  readonly width: number
  readonly height: number
  readonly part: RelationshipId
}

export type RunNode =
  | { readonly kind: 'text'; readonly text: string; readonly style: RunStyle }
  | { readonly kind: 'field'; readonly field: 'PAGE' | 'NUMPAGES'; readonly style: RunStyle }
  | { readonly kind: 'picture'; readonly picture: PictureNode }
  | { readonly kind: 'chart'; readonly chart: ChartNode }

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
  /** Which way its text reads where it is turned: from bottom to top, as an EPC QR code's caption reads (0074). */
  readonly direction?: 'btLr'
  /** Where its content stands in a cell taller than it: in the middle, as the words of a chart with nothing to draw do (0076); absent, at the top. */
  readonly align?: 'center'
  readonly content: BlockNode[]
}

export interface RowNode {
  cantSplit: boolean
  readonly header?: true
  /** Exactly so many points tall, or at least so many where `atLeast`. */
  readonly height?: number
  /** Its height the least it is, which Word grows the row past to hold what its cells hold: Austria's frame's (0074) and a chart's with nothing to draw (0076), and no other row. */
  readonly atLeast?: true
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

/**
 * The paragraphs that end `nodes`: the last of them where it is a
 * paragraph, and every paragraph of its last row where it is a table. A
 * row is kept with what follows it by every paragraph of it, so what ends
 * a list ends it in every cell of that row.
 */
export function endOf(nodes: readonly BlockNode[]): ParagraphNode[] {
  const last = nodes.at(-1)
  if (last === undefined) return []
  // A table has a row: its header, a rectangle's one, a columns block's one.
  return last.kind === 'paragraph' ? [last] : paragraphsOf(last.rows.at(-1)!.cells.flatMap((cell) => cell.content))
}

/** A paragraph that holds nothing and is exactly `height` points tall: a spacer, the gap between a region and the body, and what stands between two tables. */
export function emptyLine(height: number): ParagraphNode {
  return { kind: 'paragraph', runs: [], mark: undefined, keepNext: false, keepLines: false, line: height }
}

/** The height of the paragraph that stands between two tables, and after one that ends a cell, a footer or the body: a point. */
export const SEPARATOR = 1
