import { checkSvg, imageHeader, readFont, type ResolvedFonts } from '@formancy/report-runtime'
import type { Block, Columns, Image, Inline, Paragraph, Rectangle, Section, Table, TextStyle } from './document.js'
import type { DocxBlock, DocxBorder, DocxParagraph, DocxRunProps, DocxTable } from './docx/model.js'

/**
 * A region's blocks held to the paragraphs and tables a Word file states
 * for them (0068), block by block as record 0068's table maps them, and
 * only in what the document states outright: a run's words, its size,
 * weight, slant, colour and family where its style states them, how it is
 * set against the line, a paragraph's alignment and what it is kept with,
 * a table's grid, rows, cells and marks, a picture's bytes, extent, place
 * and crop, a rule's weight and colour, a rectangle's size and paints, a
 * spacer's height, a section's frame, a columns block's widths, a page
 * break. What the document leaves to an engine -- a size no style states,
 * a table's rules and padding, the space around a rule -- is not the
 * corpus's to know, and is held to the PDF where the writer's tests hold
 * it (`against-pdf.test.ts`).
 *
 * The walk is the corpus's own reading of the mapping, never the
 * writer's code: two transcriptions of one table, which fail together
 * only where both misread the record.
 */

/** Where a container's blocks stand: what a refusal calls it, the width they are laid out across, and what ends it. */
export interface Container {
  readonly at: string
  readonly width: number
  /** A cell ends with a paragraph and so does the body after a table; a header ends with the gap to the body, and a footer begins with it. */
  readonly kind: 'body' | 'cell' | 'header' | 'footer'
}

interface Walk {
  readonly fonts: ResolvedFonts | undefined
  readonly problems: string[]
  /** Every paragraph met, and whether it must be kept with the next and its lines together. */
  readonly kept: Map<DocxParagraph, { next: boolean; lines: boolean }>
}

/** A length in points read back from Word's units is the document's to within half of the coarsest unit, a twentieth of a point. */
const NEAR = 0.026
const near = (read: number, stated: number, within = NEAR): boolean => Math.abs(read - stated) <= within

/** The blocks with every section that has no frame replaced by its blocks, which flow as though they stood in its place. */
function unframed(blocks: readonly Block[]): Block[] {
  return blocks.flatMap((block) => (block.kind === 'section' && !framed(block) ? unframed(block.blocks) : [block]))
}

const framed = (section: Section): boolean => section.border !== undefined || section.fill !== undefined || (section.padding ?? 0) > 0

const inked = (text: string): boolean => text.trim() !== ''

/** Whether a block prints text or a picture: what a paragraph kept with the next is kept with. A table prints its empty text only in place of detail rows. */
function prints(block: Block): boolean {
  switch (block.kind) {
    case 'paragraph':
      return block.runs.length > 0
    case 'table':
      return (
        block.header.some(inked) ||
        block.rows.some((row) => row.cells.some(inked)) ||
        (!block.rows.some((row) => row.kind === 'detail') && inked(block.emptyText))
      )
    case 'image':
    case 'qrCode':
    case 'epcQrCode':
    case 'chart':
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

/** Every paragraph of `nodes`, through every table's cells, in order. */
export function paragraphsOf(nodes: readonly DocxBlock[]): DocxParagraph[] {
  return nodes.flatMap((node) => (node.kind === 'paragraph' ? [node] : node.rows.flatMap((row) => row.cells.flatMap((cell) => paragraphsOf(cell.blocks)))))
}

/** A paragraph that holds nothing and is exactly `height` points tall, or any height where none is given: a spacer, a separator, a region's gap. */
function emptyLine(node: DocxBlock | undefined, height?: number): node is DocxParagraph {
  return (
    node?.kind === 'paragraph' &&
    node.runs.length === 0 &&
    node.line?.rule === 'exact' &&
    (height === undefined || near(node.line.height, height)) &&
    node.bottom === undefined &&
    !node.pageBreakBefore
  )
}

/** `blocks` held to `nodes`, the whole of what the container holds; every difference a line of `problems`. */
export function verifyContainer(blocks: readonly Block[], nodes: readonly DocxBlock[], container: Container, fonts: ResolvedFonts | undefined): string[] {
  const walk: Walk = { fonts, problems: [], kept: new Map() }
  matchContainer(blocks, nodes, container, walk)
  for (const paragraph of paragraphsOf(nodes)) {
    const want = walk.kept.get(paragraph) ?? { next: false, lines: false }
    const text = paragraph.runs.map((run) => (run.kind === 'text' ? run.text : '')).join('') || 'an empty paragraph'
    if (paragraph.keepNext !== want.next) walk.problems.push(`${container.at}: '${text}' is ${paragraph.keepNext ? '' : 'not '}kept with what follows it`)
    if (paragraph.keepLines !== want.lines)
      walk.problems.push(`${container.at}: '${text}' ${paragraph.keepLines ? 'keeps' : 'does not keep'} its lines together`)
  }
  return walk.problems
}

function matchContainer(blocks: readonly Block[], nodes: readonly DocxBlock[], container: Container, walk: Walk): void {
  const cursor: Cursor = { nodes, at: 0, last: undefined, separators: new Set() }
  if (container.kind === 'footer') {
    if (emptyLine(nodes[0])) cursor.at = 1
    else walk.problems.push(`${container.at} does not begin with the gap to the body, an empty line of exact height`)
  }
  matchSequence(blocks, cursor, container.at, container.width, walk)
  const ended = cursor.nodes[cursor.at]
  if (container.kind === 'header') {
    if (emptyLine(ended)) cursor.at += 1
    else walk.problems.push(`${container.at} does not end with the gap to the body, an empty line of exact height`)
  } else if (cursor.last === 'table' || (container.kind === 'cell' && cursor.last === undefined)) {
    if (emptyLine(ended, 1)) cursor.at += 1
    else walk.problems.push(`${container.at} does not end with a paragraph a point tall after its ${cursor.last ?? 'nothing'}`)
  }
  if (cursor.at !== nodes.length) walk.problems.push(`${container.at} holds ${nodes.length - cursor.at} paragraphs or tables more than its blocks state`)
}

interface Cursor {
  readonly nodes: readonly DocxBlock[]
  at: number
  last: DocxBlock['kind'] | undefined
  /** The paragraphs taken as what stands between two tables. */
  readonly separators: Set<DocxBlock>
}

/** The next node, which must be a `kind`; between two tables stands one empty paragraph a point tall, taken first. */
function take<K extends DocxBlock['kind']>(cursor: Cursor, kind: K, at: string, walk: Walk): Extract<DocxBlock, { kind: K }> | undefined {
  if (kind === 'table' && cursor.last === 'table') {
    const between = cursor.nodes[cursor.at]
    if (emptyLine(between, 1)) {
      cursor.separators.add(between)
      cursor.at += 1
    } else walk.problems.push(`${at}: two tables with no paragraph a point tall between them`)
  }
  const node = cursor.nodes[cursor.at]
  if (node?.kind !== kind) {
    walk.problems.push(`${at} is ${node === undefined ? 'missing' : `a ${node.kind}`} where the file holds its ${kind}`)
    return undefined
  }
  cursor.at += 1
  cursor.last = kind
  return node as Extract<DocxBlock, { kind: K }>
}

/** `given` matched against the cursor's nodes; what each block took, for the keep rules. */
function matchSequence(given: readonly Block[], cursor: Cursor, path: string, width: number, walk: Walk): DocxBlock[][] {
  const blocks = unframed(given)
  const taken = blocks.map((block, index) => {
    const from = cursor.at
    matchBlock(block, cursor, `${path}[${index}]`, width, walk)
    return cursor.nodes.slice(from, cursor.at)
  })
  blocks.forEach((block, index) => {
    if (block.kind !== 'paragraph' || block.keepWithNext !== true) return
    let anchor = -1
    for (let next = index + 1; next < blocks.length && anchor < 0; next++) {
      const each = blocks[next]!
      if (each.kind === 'pageBreak') break
      if (!(each.kind === 'paragraph' && each.keepWithNext === true) && prints(each)) anchor = next
    }
    // A heading over nothing is kept with nothing; over something, it and all that stands between them are, the paragraph between two tables among it.
    if (anchor < 0) return
    const led = taken[anchor]!.findIndex((node) => !cursor.separators.has(node))
    keep(walk, [...taken.slice(index, anchor).flat(), ...taken[anchor]!.slice(0, Math.max(led, 0))], { next: true })
  })
  return taken
}

function keep(walk: Walk, nodes: readonly DocxBlock[], mark: { readonly next?: true; readonly lines?: true }): void {
  for (const paragraph of paragraphsOf(nodes)) {
    const known = walk.kept.get(paragraph) ?? { next: false, lines: false }
    walk.kept.set(paragraph, { next: known.next || mark.next === true, lines: known.lines || mark.lines === true })
  }
}

function matchBlock(block: Block, cursor: Cursor, at: string, width: number, walk: Walk): void {
  const say = (problem: string): void => void walk.problems.push(`${at}: ${problem}`)
  switch (block.kind) {
    case 'paragraph': {
      const node = take(cursor, 'paragraph', at, walk)
      if (node !== undefined) checkParagraph(block, node, walk.fonts, say)
      return
    }
    case 'table': {
      const node = take(cursor, 'table', at, walk)
      if (node !== undefined) checkTable(block, node, width, walk, (problem) => say(`table ${block.id}: ${problem}`))
      return
    }
    case 'image': {
      const node = take(cursor, 'paragraph', at, walk)
      if (node !== undefined) checkImage(block, node, say)
      return
    }
    case 'rule': {
      const node = take(cursor, 'paragraph', at, walk)
      if (node === undefined) return
      const line: DocxBorder = { weight: block.thickness, color: block.color ?? '#000000' }
      if (node.runs.length > 0 || !sameBorder(node.bottom, line)) say(`a rule ${block.thickness} pt thick is not an empty paragraph with that line under it`)
      // Between two paragraphs of the same borders Word draws the one between them alone (ECMA-376 Part 1, 17.3.1.7): without it two equal rules print one line.
      if (!sameBorder(node.between, line)) say('a rule states no line between it and a rule like it')
      return
    }
    case 'spacer': {
      // One that rounds to no twentieth of a point is no paragraph: no exact line is none.
      if (Math.round(block.height * 20) === 0) return
      const node = take(cursor, 'paragraph', at, walk)
      if (node !== undefined && !emptyLine(node, block.height)) say(`a spacer ${block.height} pt tall is not an empty line of exactly that height`)
      return
    }
    case 'pageBreak': {
      const node = take(cursor, 'paragraph', at, walk)
      if (node !== undefined && (node.runs.length > 0 || !node.pageBreakBefore)) say('a page break is not an empty paragraph that starts a page')
      return
    }
    case 'rectangle': {
      const node = take(cursor, 'table', at, walk)
      if (node !== undefined) checkRectangle(block, node, say)
      return
    }
    case 'keepTogether': {
      const from = cursor.at
      matchSequence(block.blocks, cursor, `${at}.blocks`, width, walk)
      const nodes = cursor.nodes.slice(from, cursor.at)
      keep(walk, nodes, { lines: true })
      // Kept with the next, every paragraph but those that end the block, which are kept with nothing after it.
      const ending = new Set(endOf(nodes))
      keep(
        walk,
        paragraphsOf(nodes).filter((paragraph) => !ending.has(paragraph)),
        { next: true },
      )
      if (nodes.some((node) => node.kind === 'table' && node.rows.some((row) => !row.cantSplit)))
        say('a table of a keep-together block has a row that may split')
      return
    }
    case 'columns': {
      const node = take(cursor, 'table', at, walk)
      if (node !== undefined) checkColumns(block, node, at, width, walk, say)
      return
    }
    case 'section': {
      const node = take(cursor, 'table', at, walk)
      if (node !== undefined) checkSection(block, node, at, width, walk, say)
      return
    }
    default:
      say(`a ${block.kind} block, which no Word file holds`)
  }
}

/** The paragraphs that end `nodes`: the last paragraph, or every paragraph of the last row where a table ends them -- a row is kept with the next by every paragraph of it, so one marked in some of its cells would be half kept. */
function endOf(nodes: readonly DocxBlock[]): DocxParagraph[] {
  const last = nodes.at(-1)
  if (last === undefined) return []
  return last.kind === 'paragraph' ? [last] : paragraphsOf(last.rows.at(-1)?.cells.flatMap((cell) => cell.blocks) ?? [])
}

const sameBorder = (read: DocxBorder | undefined, stated: DocxBorder): boolean =>
  read !== undefined && near(read.weight, stated.weight, 1 / 16 + 0.001) && read.color === stated.color

/** A string as a Word file holds it: every line ending a line feed, the one break the reader reads. */
const lineFeeds = (text: string): string => text.replace(/\r\n?/g, '\n')

/** `text` without the line ending that ends it, if one does: the PDF's engine ends its last line there and opens none after it, so a Word file states no break for it. */
const withoutLastEnding = (text: string): string => text.replace(/(?:\r\n|\r|\n)$/, '')

/**
 * The runs of `paragraph` a Word file holds: its last run without the line
 * ending that ends the paragraph, and then no run that prints nothing. In
 * that order: a run of nothing after a line ending is a run the PDF's
 * engine opens a line for, so the ending before it is a break.
 */
function writtenRuns(paragraph: Paragraph): Inline[] {
  const last = paragraph.runs.at(-1)
  const runs = last !== undefined && 'text' in last ? [...paragraph.runs.slice(0, -1), { ...last, text: withoutLastEnding(last.text) }] : paragraph.runs
  return runs.filter((run) => !('text' in run) || run.text !== '')
}

/** The family a style's token prints in where the document maps it, read from its normal face as Word lists the face; undefined where the engine's own face prints it. */
function familyOf(style: TextStyle | undefined, fonts: ResolvedFonts | undefined): string | undefined {
  const face = fonts?.[style?.font ?? 'sans']?.normal
  const read = face === undefined ? undefined : readFont(face.bytes)
  return read?.ok === true ? (read.names.legacyFamily ?? read.names.family) : undefined
}

/** What `style` states outright, held to a run's or a paragraph mark's properties; `bold` is the run's own where it has one. */
function styleProblems(style: TextStyle | undefined, props: DocxRunProps, fonts: ResolvedFonts | undefined, bold = style?.bold): string[] {
  const family = familyOf(style, fonts)
  return [
    ...(style?.size !== undefined && (props.size === undefined || !near(props.size, style.size, 0.26))
      ? [`is ${props.size ?? 'no'} pt where its style says ${style.size}`]
      : []),
    ...(bold !== undefined && props.bold !== bold ? [`is ${props.bold ? '' : 'not '}bold`] : []),
    ...(style?.italic !== undefined && props.italic !== style.italic ? [`is ${props.italic ? '' : 'not '}italic`] : []),
    ...(style?.color !== undefined && props.color !== style.color ? [`is ${props.color ?? 'of no colour'} where its style says ${style.color}`] : []),
    ...(family !== undefined && props.family !== family ? [`names the family ${props.family ?? 'of nothing'} where its font is ${family}`] : []),
  ]
}

const aligned = (read: DocxParagraph['align'], stated: TextStyle['align']): boolean => (read ?? 'left') === (stated ?? 'left')

function checkParagraph(paragraph: Paragraph, node: DocxParagraph, fonts: ResolvedFonts | undefined, say: (problem: string) => void): void {
  const { style } = paragraph
  const runs = writtenRuns(paragraph)
  if (runs.length !== node.runs.length) return say(`holds ${node.runs.length} runs where the paragraph has ${runs.length} that print`)
  runs.forEach((run: Inline, index) => {
    const read = node.runs[index]!
    const what = 'text' in run ? `the run '${run.text}'` : `the ${run.field} field`
    if ('text' in run) {
      if (read.kind !== 'text' || read.text !== lineFeeds(run.text)) return say(`${what} is ${read.kind === 'text' ? `'${read.text}'` : `a ${read.kind}`}`)
      if (read.props.shift !== run.baseline)
        say(`${what} is set ${read.props.shift ?? 'on the line'} where the paragraph sets it ${run.baseline ?? 'on the line'}`)
    } else if (read.kind !== 'field' || read.field !== (run.field === 'pageNumber' ? 'PAGE' : 'NUMPAGES'))
      return say(`${what} is ${read.kind === 'field' ? read.field : `a ${read.kind}`}`)
    for (const problem of styleProblems(style, read.props, fonts, ('text' in run ? run.bold : undefined) ?? style?.bold)) say(`${what} ${problem}`)
  })
  if (style?.size !== undefined && (node.mark.size === undefined || !near(node.mark.size, style.size, 0.26)))
    say("the paragraph's mark is of another size than its style's")
  if (!aligned(node.align, style?.align)) say(`is aligned ${node.align ?? 'left'} where its style says ${style?.align ?? 'left'}`)
}

/** A row that closes what is above it: a group's footer, a total. */
const closes = (kind: string | undefined): boolean => kind === 'groupFooter' || kind === 'total'

/**
 * The rows that stand on a page with the row after them, counted from the
 * column header at 0: the column header itself; a group header and as many
 * rows after it as it keeps, less one (0059); and what precedes each of a
 * table's closing rows that follow a detail row or the empty text, so that
 * a total never opens a page alone under a repeated header.
 */
function keptRows(table: Table, empty: boolean): Set<number> {
  const kinds: string[] = ['header', ...(empty ? ['empty'] : []), ...table.rows.map((row) => row.kind)]
  const offset = kinds.length - table.rows.length
  const kept = new Set<number>()
  if (kinds.length > 1) kept.add(0)
  kinds.forEach((kind, index) => {
    if (kind === 'groupHeader' && index + 1 < kinds.length)
      for (let each = 0; each < (table.rows[index - offset]!.keepWithRows ?? 1); each++) kept.add(index + each)
    if (!closes(kind)) return
    let anchor = index - 1
    while (closes(kinds[anchor])) anchor--
    if (kinds[anchor] === 'detail' || kinds[anchor] === 'empty') kept.add(index - 1)
  })
  return kept
}

function checkTable(table: Table, node: DocxTable, width: number, walk: Walk, say: (problem: string) => void): void {
  const widths = columnWidths(
    table.columns.map((column) => column.width),
    width,
  )
  if (node.grid.length !== widths.length || node.grid.some((each, index) => !near(each, widths[index]!)))
    say(`its grid is ${node.grid.join(', ')} pt where its columns are ${widths.join(', ')}`)
  const empty = !table.rows.some((row) => row.kind === 'detail')
  const stated = [
    { what: 'the header', cells: table.header, across: false, style: (): TextStyle | undefined => table.headerStyle },
    ...(empty ? [{ what: 'the empty text', cells: [table.emptyText], across: true, style: (): TextStyle | undefined => undefined }] : []),
    ...table.rows.map((row, index) => ({
      what: `row ${index}`,
      cells: row.cells,
      across: row.across === true,
      style: (column: number): TextStyle | undefined => row.cellStyles?.[column] ?? row.style,
    })),
  ]
  if (node.rows.length !== stated.length) return say(`holds ${node.rows.length} rows where the table prints ${stated.length}`)
  const kept = keptRows(table, empty)
  stated.forEach((row, index) => {
    const read = node.rows[index]!
    if (read.header !== (index === 0)) say(`${row.what} is ${read.header ? '' : 'not '}marked as the row to repeat on every page`)
    if (!read.cantSplit) say(`${row.what} may split across pages`)
    if (read.cells.length !== row.cells.length) return say(`${row.what} has ${read.cells.length} cells where the table states ${row.cells.length}`)
    if (kept.has(index))
      keep(
        walk,
        read.cells.flatMap((cell) => cell.blocks),
        { next: true },
      )
    row.cells.forEach((text, column) => {
      const cell = read.cells[column]!
      const where = `${row.what}, column ${column + 1},`
      if (cell.span !== (row.across ? table.columns.length : 1)) say(`${where} spans ${cell.span} columns`)
      const [paragraph, more] = cell.blocks
      if (paragraph?.kind !== 'paragraph' || more !== undefined) return say(`${where} is not one paragraph`)
      const printed = paragraph.runs.map((run) => (run.kind === 'text' ? run.text : `<${run.kind}>`)).join('')
      if (printed !== lineFeeds(withoutLastEnding(text))) say(`${where} prints '${printed}' where the table states '${text}'`)
      const style = row.style(column)
      for (const run of paragraph.runs) for (const problem of styleProblems(style, run.props, walk.fonts)) say(`${where} ${problem}`)
      if (!aligned(paragraph.align, style?.align ?? table.columns[row.across ? 0 : column]?.align)) say(`${where} is aligned ${paragraph.align ?? 'left'}`)
    })
  })
}

/** Each width in points: a fixed one its own, each fill an equal share of what the fixed ones leave of `width`. */
function columnWidths(widths: readonly (number | 'fill')[], width: number): number[] {
  const fixed = widths.reduce<number>((sum, each) => sum + (each === 'fill' ? 0 : each), 0)
  const fills = widths.filter((each) => each === 'fill').length
  return widths.map((each) => (each === 'fill' ? (width - fixed) / fills : each))
}

/** A picture's own size: a PNG's or a JPEG's pixels as it is shown, an SVG's viewBox. */
function naturalSize(image: Image): { readonly width: number; readonly height: number } | undefined {
  if (image.asset.mediaType === 'image/svg+xml') {
    const read = checkSvg(image.asset.bytes)
    return read.ok ? read.viewBox : undefined
  }
  const read = imageHeader(image.asset.bytes)
  return read.ok ? read : undefined
}

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean => left.length === right.length && left.every((byte, index) => byte === right[index])

function checkImage(image: Image, node: DocxParagraph, say: (problem: string) => void): void {
  const [run, more] = node.runs
  if (run?.kind !== 'picture' || more !== undefined) return say(`the image ${image.asset.id} is not a paragraph of one picture`)
  const { picture } = run
  const vector = image.asset.mediaType === 'image/svg+xml'
  const embedded = vector ? picture.svg : picture.part
  if (embedded === undefined || !sameBytes(embedded.bytes, image.asset.bytes)) say(`the image ${image.asset.id} embeds other bytes than its asset's`)
  if (embedded !== undefined && embedded.contentType !== image.asset.mediaType) say(`the image ${image.asset.id} is embedded as ${embedded.contentType}`)
  if (vector && picture.part.contentType !== 'image/png') say(`the image ${image.asset.id}, an SVG, has no PNG for a reader that draws none`)
  if (!vector && picture.svg !== undefined) say(`the image ${image.asset.id} is no SVG and embeds one`)
  const natural = naturalSize(image)
  if (natural === undefined) return say(`the image ${image.asset.id} is written though its bytes are no picture`)
  const cover = image.fit === 'cover'
  const scale = (cover ? Math.max : Math.min)(image.width / natural.width, image.height / natural.height)
  const [width, height] = cover ? [image.width, image.height] : [natural.width * scale, natural.height * scale]
  if (!near(picture.width, width) || !near(picture.height, height))
    say(`the image ${image.asset.id} is ${picture.width} × ${picture.height} pt where it is drawn ${width} × ${height}`)
  const [x, y] = [(image.width - width) / 2, (image.height - height) / 2]
  if (!near(node.indent, x) || !near(node.before, y) || !near(node.after, image.height - height - y))
    say(`the image ${image.asset.id} is not centred in its box of ${image.width} × ${image.height} pt`)
  const [across, down] = cover ? [1 - image.width / (natural.width * scale), 1 - image.height / (natural.height * scale)] : [0, 0]
  const crop = picture.crop ?? { left: 0, top: 0, right: 0, bottom: 0 }
  const cut = (read: number, stated: number): boolean => near(read, stated / 2, 0.00002)
  if (!cut(crop.left, across) || !cut(crop.right, across) || !cut(crop.top, down) || !cut(crop.bottom, down))
    say(`the image ${image.asset.id} is cropped otherwise than its fit says`)
}

/** A table of one row and one cell, as a rectangle, a section's frame and nothing else is written. */
function oneCell(node: DocxTable): DocxTable['rows'][number]['cells'][number] | undefined {
  return node.rows.length === 1 && node.rows[0]!.cells.length === 1 ? node.rows[0]!.cells[0] : undefined
}

const SIDES = ['top', 'left', 'bottom', 'right'] as const

function checkRectangle(rectangle: Rectangle, node: DocxTable, say: (problem: string) => void): void {
  const cell = oneCell(node)
  const height = node.rows[0]?.height
  if (
    cell === undefined ||
    node.grid.length !== 1 ||
    !near(node.grid[0]!, rectangle.width) ||
    height?.rule !== 'exact' ||
    !near(height.value, rectangle.height)
  )
    return say(`a rectangle of ${rectangle.width} × ${rectangle.height} pt is not a cell of exactly that size`)
  const outlined = SIDES.every((side) => cell.borders[side] !== undefined)
  const { fill, stroke } = rectangle
  // A box too small to hold its outline is all outline: the engine fills it with the outline's colour.
  const allOutline = stroke !== undefined && !outlined && cell.shade === stroke
  if (
    !allOutline &&
    (cell.shade !== fill ||
      outlined !== (stroke !== undefined) ||
      SIDES.some((side) => cell.borders[side] !== undefined && cell.borders[side].color !== stroke))
  )
    say('a rectangle is filled or outlined otherwise than it states')
}

function checkColumns(columns: Columns, node: DocxTable, at: string, width: number, walk: Walk, say: (problem: string) => void): void {
  const widths = columnWidths(
    columns.columns.map((slot) => slot.width),
    width,
  )
  const cells = node.rows.length === 1 ? node.rows[0]!.cells : []
  if (cells.length !== widths.length || node.grid.some((each, index) => !near(each, widths[index]!)))
    return say('a columns block is not one row of a cell a column, at its widths')
  if (Object.keys(node.borders).length > 0 || cells.some((cell) => Object.keys(cell.borders).length > 0 || cell.shade !== undefined))
    say('a columns block is bordered or filled')
  if (SIDES.some((side) => node.margins?.[side] !== 0)) say('a columns block pads its cells')
  columns.columns.forEach((slot, index) =>
    matchContainer(slot.blocks, cells[index]!.blocks, { at: `${at}.columns[${index}].blocks`, width: widths[index]!, kind: 'cell' }, walk),
  )
}

function checkSection(section: Section, node: DocxTable, at: string, width: number, walk: Walk, say: (problem: string) => void): void {
  const cell = oneCell(node)
  if (cell === undefined || !near(node.grid[0] ?? 0, width)) return say('a framed section is not a table of one cell as wide as where it stands')
  const { border, fill } = section
  const padding = section.padding ?? 0
  if (
    SIDES.some((side) =>
      border === undefined ? cell.borders[side] !== undefined : !sameBorder(cell.borders[side], { weight: border.thickness, color: border.color }),
    )
  )
    say('a framed section is bordered otherwise than it states')
  if (cell.shade !== fill) say(`a framed section is filled ${cell.shade ?? 'with nothing'} where it states ${fill ?? 'none'}`)
  if (SIDES.some((side) => node.margins?.[side] === undefined || !near(node.margins[side], padding)))
    say(`a framed section does not pad its blocks by ${padding} pt`)
  matchContainer(section.blocks, cell.blocks, { at: `${at}.blocks`, width: width - 2 * ((border?.thickness ?? 0) + padding), kind: 'cell' }, walk)
}
