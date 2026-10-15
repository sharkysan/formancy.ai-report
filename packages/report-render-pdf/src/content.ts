import type { Content, CustomTableLayout } from 'pdfmake/interfaces.js'
import type { Block, Columns, Image, ImageAsset, Inline, Paragraph, Rectangle, Rule, Section } from '@formancy/report-runtime'
import { base64 } from './bytes.js'
import { startsOnPage, type Build, type Fields } from './build.js'
import { DEFAULT_SIZE, textProperties } from './style.js'
import { tableContent } from './table.js'
import { columnWidths } from './widths.js'
import { MAX_WORD_LINES } from './words.js'

/**
 * The document's blocks as pdfmake content (`build.ts` says what a build
 * accumulates, and in which mode).
 *
 * Most blocks are one pdfmake node each. A section is its blocks: in a stack
 * of their own when it has no frame, as though it were not there, and in a
 * table of one cell when it has one, whose borders pdfmake draws around the
 * part of it on each page. A columns block is pdfmake's columns, with no gap
 * between them but what their widths leave.
 */

/** Space above and below a rule's line. A rule block takes its line and both. */
export const RULE_GAP = 3

/** The weight a rectangle's outline is drawn at, inside its box: the table rules' weight. */
export const OUTLINE = 0.5

/** How far a node may start below the top of what it sits under and still be first there: rounding, not layout. */
const AT_TOP = 0.5

/** Where a list of blocks stands. */
interface Scope {
  /** The width the blocks are laid out across. */
  readonly width: number
  /** No rule may break inside: a keep-together block, a page region, a column. */
  readonly kept: boolean
  /** Where a page's first line of these blocks would start: the body's top, below every frame around them. */
  readonly top: number
  readonly fields?: Fields
  /** Whether its text nodes are recorded for the word check: not a page region's in the last pass, which pdfmake builds anew for each page and a measuring pass has checked. */
  readonly record: boolean
}

/** Content for the body's blocks, laid out `width` wide, or a page region's when `fields` are given. */
export function contentOf(blocks: readonly Block[], build: Build, width: number, fields?: Fields): Content[] {
  const record = fields === undefined || build.mode === 'measure'
  return sequence(blocks, build, fields === undefined ? { width, kept: false, top: build.bodyTop, record } : { width, kept: true, top: 0, fields, record })
}

/** Border and padding on each side of a section: what it takes from the width, and from a page's height above and below. */
export function frameOf(section: Section): number {
  return (section.border?.thickness ?? 0) + (section.padding ?? 0)
}

/** A section with neither border, fill nor padding is its blocks and nothing more. */
function framed(section: Section): boolean {
  return section.border !== undefined || section.fill !== undefined || (section.padding ?? 0) > 0
}

/** The blocks with every section that has no frame replaced by its blocks, which flow as though they stood in its place. */
function unframed(blocks: readonly Block[]): Block[] {
  return blocks.flatMap((block) => (block.kind === 'section' && !framed(block) ? unframed(block.blocks) : [block]))
}

/**
 * The blocks' content. Outside a kept scope, a keep-with-next paragraph
 * breaks to the next page when the block it is kept with does not start on
 * its page -- unless it is first on its page already, where a break would
 * leave the page empty and the paragraph no better kept on the next.
 */
function sequence(given: readonly Block[], build: Build, scope: Scope): Content[] {
  const blocks = unframed(given)
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
    build.rules.set(own, (node, queries) => node.startPosition.top > scope.top + AT_TOP && !startsOnPage(queries, ids, node.startPosition.pageNumber))
  })
  return contents
}

/** A node of the content the renderer builds, as far as a rule needs to know it: always an object, every table cell and column included. */
interface Anchor {
  readonly text?: unknown
  readonly image?: unknown
  readonly stack?: readonly Anchor[]
  readonly columns?: readonly Anchor[]
  readonly table?: { readonly body: readonly (readonly Anchor[])[] }
  id?: string
  headlineLevel?: number
}

/** The first node of `node` that prints text, or an image when no text comes first: where pdfmake records the content's start. */
function anchorOf(node: Anchor): Anchor | undefined {
  const inner = node.stack ?? node.columns ?? node.table?.body.flat()
  if (inner !== undefined) {
    for (const each of inner) {
      const anchor = anchorOf(each)
      if (anchor !== undefined) return anchor
    }
    return undefined
  }
  // A paragraph's text is an array of runs, and the renderer keeps nothing with a paragraph that prints nothing.
  const printsText = typeof node.text === 'string' ? node.text.trim() !== '' : Array.isArray(node.text)
  return printsText || node.image !== undefined ? node : undefined
}

/**
 * Where the block a keep-with-next paragraph at `index` stays with starts:
 * the anchor of the next block that prints text or an image, past spacers,
 * rules, rectangles and other keep-with-next paragraphs, so that a run of
 * headings moves as one. None when a page break or the end of the list comes
 * first: a heading over nothing is not kept with anything.
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
      return paragraphContent(block, build, scope)
    case 'table':
      return tableContent(block, build, scope)
    case 'image':
      return imageContent(block, build)
    case 'rule':
      return ruleContent(block, scope.width)
    case 'rectangle':
      return rectangleContent(block)
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
    case 'columns':
      return columnsContent(block, build, scope)
    case 'section':
      return sectionContent(block, build, scope)
  }
}

function paragraphContent(paragraph: Paragraph, build: Build, scope: Scope): Content {
  const style = paragraph.style ?? {}
  const content = {
    text: paragraph.runs.length === 0 ? '' : paragraph.runs.map((run) => inline(run, scope.fields)),
    alignment: style.align ?? 'left',
    ...textProperties(style, { size: DEFAULT_SIZE }),
  }
  // check.ts walks every paragraph, and records where it stands, before anything is built.
  const at = build.paths.get(paragraph) as string
  if (scope.record) build.words.push({ node: content, width: scope.width, lines: MAX_WORD_LINES, what: at, subject: at })
  return content
}

function inline(run: Inline, fields: Fields | undefined): { text: string; bold?: boolean } {
  if ('text' in run) return run.bold === undefined ? { text: run.text } : { text: run.text, bold: run.bold }
  // The renderer refuses a page field outside a page region before building anything.
  if (fields === undefined) throw new Error(`a ${run.field} field outside a page region`)
  return { text: String(fields[run.field]) }
}

/**
 * An image in its box, which the layout reserves whole. `cover` is pdfmake's
 * own: the box clipped, the image scaled to fill it and centred. `contain`
 * is drawn at the size the box allows at the image's proportions, read from
 * its pixels, and centred in the box by margins that make up the rest of it.
 */
function imageContent(image: Image, build: Build): Content {
  const key = imageKey(image.asset, build)
  if (image.fit === 'cover') return { image: key, cover: { width: image.width, height: image.height, align: 'center', valign: 'center' } }
  // The asset checks read every image's pixels before anything is built.
  const pixels = build.pixels.get(image.asset)!
  const scale = Math.min(image.width / pixels.width, image.height / pixels.height)
  const [width, height] = [pixels.width * scale, pixels.height * scale]
  const [x, y] = [(image.width - width) / 2, (image.height - height) / 2]
  return { image: key, width, height, margin: [x, y, image.width - width - x, y] }
}

function imageKey(asset: ImageAsset, build: Build): string {
  const known = build.imageKeys.get(asset)
  if (known !== undefined) return known
  const key = `image${build.imageKeys.size}`
  build.imageKeys.set(asset, key)
  build.images[key] = `data:${asset.mediaType};base64,${base64(asset.bytes)}`
  return key
}

/**
 * pdfmake makes a canvas as tall as its lowest point and strokes a line half
 * its width to either side: the line half its width down, and the other half
 * of it in the margin below.
 */
function ruleContent(rule: Rule, width: number): Content {
  const half = rule.thickness / 2
  return {
    canvas: [{ type: 'line', x1: 0, y1: half, x2: width, y2: half, lineWidth: rule.thickness, lineColor: rule.color ?? '#000000' }],
    margin: [0, RULE_GAP, 0, RULE_GAP + half],
  }
}

/**
 * A rectangle's box, exactly: its outline is stroked inside it, half the
 * weight in from each edge, and the canvas, as tall as its lowest point,
 * takes the rest of the box in a margin. A box no wider or taller than two
 * outlines is all outline, and is filled with the outline's colour.
 */
function rectangleContent(rectangle: Rectangle): Content {
  const { width, height, fill, stroke } = rectangle
  if (stroke === undefined || Math.min(width, height) <= 2 * OUTLINE) {
    const color = stroke ?? fill
    return { canvas: color === undefined ? [] : [{ type: 'rect', x: 0, y: 0, w: width, h: height, color, lineWidth: 0 }], margin: [0, 0, 0, color === undefined ? height : 0] }
  }
  const half = OUTLINE / 2
  return {
    canvas: [{ type: 'rect', x: half, y: half, w: width - OUTLINE, h: height - OUTLINE, lineWidth: OUTLINE, lineColor: stroke, ...(fill === undefined ? {} : { color: fill }) }],
    margin: [0, 0, 0, half],
  }
}

/** Columns at the widths worked out here, never pdfmake's `'*'`, which a long word widens past the page (`widths.ts`). */
function columnsContent(columns: Columns, build: Build, scope: Scope): Content {
  const widths = columnWidths(columns.columns.map((slot) => slot.width), scope.width)
  return {
    columns: columns.columns.map((slot, index) => {
      const width = widths[index]!
      return { width, stack: sequence(slot.blocks, build, { ...scope, width, kept: true }) }
    }),
    columnGap: 0,
  }
}

/**
 * A section with a frame is a table of one cell: pdfmake draws its border
 * and fill around the part of it on each page, and lays out its blocks
 * inside the padding as it lays out the body, tables with their repeated
 * headers and page breaks included.
 */
function sectionContent(section: Section, build: Build, scope: Scope): Content {
  const frame = frameOf(section)
  const border = section.border?.thickness ?? 0
  const color = section.border?.color ?? '#000000'
  const padding = section.padding ?? 0
  const fill = section.fill
  const layout: CustomTableLayout = {
    hLineWidth: () => border,
    vLineWidth: () => border,
    hLineColor: () => color,
    vLineColor: () => color,
    paddingLeft: () => padding,
    paddingRight: () => padding,
    paddingTop: () => padding,
    paddingBottom: () => padding,
    ...(fill === undefined ? {} : { fillColor: () => fill }),
  }
  const width = scope.width - 2 * frame
  const inner = sequence(section.blocks, build, { ...scope, width, top: scope.top + frame })
  return { table: { widths: [width], body: [[{ stack: inner }]] }, layout }
}
