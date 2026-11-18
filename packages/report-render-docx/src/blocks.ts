import type { Block, Columns, Image, ImageAsset, Paragraph, Rectangle, Section } from '@formancy/report-runtime'
import { drawnSize, type Picture } from './assets.js'
import { framed } from './check.js'
import type { DocxFonts } from './fonts.js'
import { BLACK, DEFAULT_SIZE, OUTLINE, RULE_GAP } from './look.js'
import {
  emptyLine,
  endOf,
  paragraphsOf,
  SEPARATOR,
  type BlockNode,
  type CellNode,
  type Line,
  type ParagraphNode,
  type RelationshipId,
  type RunNode,
  type RunStyle,
  type TableNode,
  withoutLastEnding,
} from './nodes.js'
import { printsEmptyText } from './rows.js'
import { tableNode } from './table.js'
import { twips } from './units.js'
import { columnWidths } from './widths.js'

/**
 * A resolved document's blocks as the paragraphs and tables a Word file
 * holds, block by block as record 0068 maps them, and the marks that keep
 * them together. `check.ts` has passed the document: nothing here
 * refuses, and nothing here is XML yet (`wml.ts`).
 *
 * A Word file has no container but a table's cell, so a keep-together
 * block and a section without a frame are their blocks, in the list they
 * stand in, and what holds them together is a mark on each paragraph.
 */

/** What a part's blocks are built with: the fonts, the pictures as the checks read them, and where a picture's bytes and its relationship go. */
export interface Build {
  readonly fonts: DocxFonts
  readonly pictures: ReadonlyMap<ImageAsset, Picture>
  /** The relationship, in the part being built, of the part that holds `asset`'s bytes, and of the fallback an SVG is shown as where no SVG is drawn. */
  readonly embed: (asset: ImageAsset, picture: Picture) => RelationshipId
  readonly fallback: () => RelationshipId
  /** The file's pictures so far: each takes the next number. */
  readonly drawn: { pictures: number }
}

/** A container's nodes as they are built: the paragraphs taken to stand between two tables are remembered, since a heading kept with a table is kept through the one before it. */
interface Out {
  readonly nodes: BlockNode[]
  readonly separators: Set<BlockNode>
}

/** `node` at the end of the list; between two tables stands one empty paragraph a point tall, so that the two stay two. */
function push(out: Out, node: BlockNode): void {
  if (node.kind === 'table' && out.nodes.at(-1)?.kind === 'table') {
    const between = emptyLine(SEPARATOR)
    out.separators.add(between)
    out.nodes.push(between)
  }
  out.nodes.push(node)
}

/**
 * The nodes of a container's blocks, laid out `width` wide. A cell ends
 * with a paragraph, as WordprocessingML's readers expect of one, so an
 * empty cell and one that ends with a table are given one a point tall;
 * the body, a header and a footer are closed by their part (`package.ts`).
 */
export function nodesOf(blocks: readonly Block[], build: Build, width: number, cell = false): BlockNode[] {
  const out: Out = { nodes: [], separators: new Set() }
  sequence(blocks, out, build, width)
  if (cell && out.nodes.at(-1)?.kind !== 'paragraph') out.nodes.push(emptyLine(SEPARATOR))
  return out.nodes
}

/** The blocks with every section that has no frame replaced by its blocks, which flow as though they stood in its place. */
function unframed(blocks: readonly Block[]): Block[] {
  return blocks.flatMap((block) => (block.kind === 'section' && !framed(block) ? unframed(block.blocks) : [block]))
}

const inked = (text: string): boolean => text.trim() !== ''

/**
 * Whether a block prints text or a picture: what a paragraph kept with
 * the next is kept with, as the PDF renderer finds it, which reads the
 * cells a table lays out -- so a table's empty text counts only where the
 * table prints it, in place of detail rows.
 */
function prints(block: Block): boolean {
  switch (block.kind) {
    case 'paragraph':
      return block.runs.length > 0
    case 'table':
      return block.header.some(inked) || block.rows.some((row) => row.cells.some(inked)) || (printsEmptyText(block) && inked(block.emptyText))
    case 'image':
      return true
    case 'keepTogether':
    case 'section':
      return block.blocks.some(prints)
    case 'columns':
      return block.columns.some((slot) => slot.blocks.some(prints))
    default:
      return false
  }
}

/**
 * `given` appended to `out`, each block's nodes after the last. A
 * keep-with-next paragraph is kept with the next block that prints, past
 * spacers, rules, rectangles and other such paragraphs, as the PDF keeps
 * it: `w:keepNext` on it and on every paragraph between the two, the one
 * between two tables among them, since Word keeps a paragraph with the
 * paragraph after it and no further. Over a page break or nothing, a
 * heading is kept with nothing.
 *
 * In one pass: a run of such paragraphs is marked once, from the first of
 * them to what the last heads, never each from itself -- which cost the
 * square of the run, and a report of headings alone its thread.
 */
function sequence(given: readonly Block[], out: Out, build: Build, width: number): void {
  // Where the nodes of the first paragraph still to be kept with something begin; undefined while none waits.
  let waiting: number | undefined
  for (const block of unframed(given)) {
    const start = out.nodes.length
    blockNodes(block, out, build, width)
    if (block.kind === 'pageBreak') waiting = undefined
    else if (block.kind === 'paragraph' && block.keepWithNext === true) waiting ??= start
    else if (waiting !== undefined && prints(block)) {
      // As far as the block itself: the paragraph that keeps it apart from a table before it stands between the two, and is kept too.
      const end = out.separators.has(out.nodes[start]!) ? start + 1 : start
      for (const paragraph of paragraphsOf(out.nodes.slice(waiting, end))) paragraph.keepNext = true
      waiting = undefined
    }
  }
}

function blockNodes(block: Block, out: Out, build: Build, width: number): void {
  switch (block.kind) {
    case 'paragraph':
      return push(out, paragraphNode(block, build.fonts))
    case 'table':
      return push(out, tableNode(block, build.fonts, width))
    case 'image':
      return push(out, imageNode(block, build))
    case 'rule':
      // Its line under an exact line as tall as the space above it, and the space below it after: the PDF's rule, gap for gap.
      return push(out, { ...emptyLine(RULE_GAP), after: RULE_GAP, rule: { weight: block.thickness, color: block.color ?? BLACK } })
    case 'rectangle':
      return push(out, rectangleNode(block))
    case 'spacer':
      // One that rounds to no twentieth of a point writes nothing: no exact line is none.
      if (twips(block.height) > 0) push(out, emptyLine(block.height))
      return
    case 'pageBreak':
      return push(out, { ...emptyLine(SEPARATOR), pageBreakBefore: true })
    case 'keepTogether': {
      const from = out.nodes.length
      sequence(block.blocks, out, build, width)
      const kept = out.nodes.slice(from)
      // What ends the block is kept with nothing after it. By node, not by paragraph: a row is kept by every paragraph of it, so
      // "every paragraph but the last" would keep the row that ends a block in all its cells but one.
      const ending = new Set(endOf(kept))
      for (const paragraph of paragraphsOf(kept)) {
        paragraph.keepLines = true
        if (!ending.has(paragraph)) paragraph.keepNext = true
      }
      wholeRows(kept)
      return
    }
    case 'columns':
      return push(out, columnsNode(block, build, width))
    case 'section':
      // One without a frame was replaced by its blocks before this.
      return push(out, sectionNode(block, build, width))
    default:
      // A chart or a code: check.ts refuses one before anything is built.
      throw new Error(`a ${block.kind} block reached the writer`)
  }
}

/** Every row of every table among `nodes`, however deep, marked not to split: what a keep-together block holds stays whole. */
function wholeRows(nodes: readonly BlockNode[]): void {
  for (const node of nodes) {
    if (node.kind !== 'table') continue
    for (const row of node.rows) {
      row.cantSplit = true
      for (const cell of row.cells) wholeRows(cell.content)
    }
  }
}

function paragraphNode(paragraph: Paragraph, fonts: DocxFonts): ParagraphNode {
  const style = paragraph.style ?? {}
  const base = { family: fonts.family(style.font), size: style.size ?? DEFAULT_SIZE, italic: style.italic ?? false, color: style.color ?? BLACK }
  const runs = paragraph.runs.flatMap((run, index): RunNode[] => {
    if (!('text' in run)) return [{ kind: 'field', field: run.field === 'pageNumber' ? 'PAGE' : 'NUMPAGES', style: { ...base, bold: style.bold ?? false } }]
    // The paragraph's last run ends its text, and the line ending that ends that is no break.
    const text = index === paragraph.runs.length - 1 ? withoutLastEnding(run.text) : run.text
    // A run that prints nothing is no run of the file.
    if (text === '') return []
    const set: RunStyle = { ...base, bold: run.bold ?? style.bold ?? false, ...(run.baseline === undefined ? {} : { shift: run.baseline }) }
    return [{ kind: 'text', text, style: set }]
  })
  return {
    kind: 'paragraph',
    runs,
    mark: { family: base.family, size: base.size },
    ...(style.align === undefined || style.align === 'left' ? {} : { align: style.align }),
    keepNext: false,
    keepLines: false,
  }
}

/**
 * An image in its box, which a paragraph of its own reserves whole. A
 * contained one is drawn at the size the box allows at its own
 * proportions and centred by the paragraph's indent and the space before
 * and after it; a covering one fills the box, cropped at its sides or at
 * its top and foot by what its proportions leave over. An SVG is embedded
 * beside the picture a reader that draws none shows in its place.
 */
function imageNode(image: Image, build: Build): ParagraphNode {
  // check.ts reads every image's asset before anything is built.
  const picture = build.pictures.get(image.asset)!
  const cover = image.fit === 'cover'
  const { width, height, scale } = drawnSize(image, picture)
  const [x, y] = [(image.width - width) / 2, (image.height - height) / 2]
  const [across, down] = cover ? [(1 - image.width / (picture.width * scale)) / 2, (1 - image.height / (picture.height * scale)) / 2] : [0, 0]
  const vector = picture.kind === 'svg'
  const embedded = build.embed(image.asset, picture)
  return {
    kind: 'paragraph',
    runs: [
      {
        kind: 'picture',
        picture: {
          id: (build.drawn.pictures += 1),
          width,
          height,
          embed: vector ? build.fallback() : embedded,
          ...(vector ? { svg: embedded } : {}),
          ...(across > 0 || down > 0 ? { crop: { across: Math.max(across, 0), down: Math.max(down, 0) } } : {}),
        },
      },
    ],
    mark: undefined,
    keepNext: false,
    keepLines: false,
    ...(x > 0 ? { indent: x } : {}),
    ...(y > 0 ? { before: y, after: image.height - height - y } : {}),
  }
}

/** A table of one cell: what a rectangle and a section's frame are written as. */
function oneCell(width: number, cell: Omit<CellNode, 'width'>, row: { readonly height?: number }, padding = 0): TableNode {
  const grid = [twips(width)]
  return { kind: 'table', grid, padding: { x: padding, y: padding }, rows: [{ cantSplit: false, ...row, cells: [{ width: grid[0]!, ...cell }] }] }
}

const around = (line: Line): NonNullable<CellNode['borders']> => ({ top: line, left: line, bottom: line, right: line })

/**
 * A rectangle's box, exactly: a cell of its width in a row of exactly its
 * height, filled as it is filled and outlined at the PDF's weight. A box
 * no wider or taller than two outlines is all outline, as the PDF draws
 * it, and is filled with the outline's colour.
 */
function rectangleNode(rectangle: Rectangle): TableNode {
  const { width, height, fill, stroke } = rectangle
  const outline = stroke !== undefined && Math.min(width, height) > 2 * OUTLINE ? stroke : undefined
  const shade = outline === undefined ? (stroke ?? fill) : fill
  return oneCell(
    width,
    {
      ...(outline === undefined ? {} : { borders: around({ weight: OUTLINE, color: outline }) }),
      ...(shade === undefined ? {} : { shade }),
      content: [emptyLine(SEPARATOR)],
    },
    { height },
  )
}

/** A columns block as a table of one row, a cell a column, with no border and no padding: each column lays its blocks out down its own width. */
function columnsNode(columns: Columns, build: Build, width: number): TableNode {
  const widths = columnWidths(
    columns.columns.map((slot) => slot.width),
    width,
  )
  const grid = widths.map(twips)
  const cells = columns.columns.map((slot, index): CellNode => ({ width: grid[index]!, content: nodesOf(slot.blocks, build, widths[index]!, true) }))
  return { kind: 'table', grid, padding: { x: 0, y: 0 }, rows: [{ cantSplit: false, cells }] }
}

/** A section with a frame as a table of one cell: its border around it, its fill behind it, its padding the cell's, and its blocks inside, which Word may continue on the next page. */
function sectionNode(section: Section, build: Build, width: number): TableNode {
  const { border, fill } = section
  const padding = section.padding ?? 0
  const inner = width - 2 * ((border?.thickness ?? 0) + padding)
  return oneCell(
    width,
    {
      ...(border === undefined ? {} : { borders: around({ weight: border.thickness, color: border.color }) }),
      ...(fill === undefined ? {} : { shade: fill }),
      content: nodesOf(section.blocks, build, inner, true),
    },
    {},
    padding,
  )
}
